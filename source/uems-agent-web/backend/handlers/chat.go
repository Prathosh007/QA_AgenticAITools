// Package handlers provides REST endpoints for tool invocation and tool
// definitions.  The chat orchestration (tool loop + streaming) is handled
// entirely client-side via the Copilot reverse proxy.
//
// Architecture (matching webclient-chat):
//
//	Frontend  →  POST /copilot/chat/completions  (reverse proxy, SSE stream)
//	          →  POST /api/tool                   (invoke one MCP tool)
//	          →  GET  /api/tools                  (list available tools)
//
// Each Copilot API round is a separate HTTP request from the browser.
// The frontend manages the tool loop, context, and retry logic.
package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// chatMCPServer holds a reference to the MCP server for invoking tools.
var chatMCPServer *mcp.Server
var toolTimeout = 2 * time.Minute // default, overridable via SetToolTimeout
var toolOutputLimit = 8000        // default, overridable via SetToolOutputLimit

// SetMCPServer sets the MCP server reference used by the tool handler.
func SetMCPServer(s *mcp.Server) { chatMCPServer = s }

// SetToolTimeout sets the maximum duration for a single tool invocation.
func SetToolTimeout(d time.Duration) { toolTimeout = d }

// SetToolOutputLimit sets the max characters returned in tool output.
func SetToolOutputLimit(n int) { toolOutputLimit = n }

// ── REST: GET /api/tools — return tool definitions ───────────────

// HandleListTools returns the OpenAI-format tool definitions for the frontend
// to include in Copilot API requests.
func HandleListTools(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(getToolDefinitions())
}

// ── REST: POST /api/tool — invoke a single tool ─────────────────

type toolInvokeRequest struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type toolInvokeResponse struct {
	Output string `json:"output"`
}

// HandleToolInvoke calls an MCP tool and returns the result.
func HandleToolInvoke(w http.ResponseWriter, r *http.Request) {
	var req toolInvokeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, `{"error":"tool name required"}`, http.StatusBadRequest)
		return
	}

	slog.Info("tool invoked", "tool", req.Name)

	// Apply a deadline so long-running tools don't block indefinitely.
	// The context is also cancelled if the client disconnects (HTTP request context).
	ctx, cancel := context.WithTimeout(r.Context(), toolTimeout)
	defer cancel()

	start := time.Now()
	output := invokeTool(ctx, req.Name, string(req.Arguments))
	RecordToolInvocation(req.Name, time.Since(start))
	slog.Info("tool completed", "tool", req.Name, "output_bytes", len(output), "duration_ms", time.Since(start).Milliseconds())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toolInvokeResponse{Output: output})
}

// ── Tool invocation via MCP server ───────────────────────────────

func invokeTool(ctx context.Context, name, argsJSON string) string {
	if chatMCPServer == nil {
		return `{"error":"MCP server not available"}`
	}

	clientTransport, serverTransport := mcp.NewInMemoryTransports()

	ss, err := chatMCPServer.Connect(ctx, serverTransport, nil)
	if err != nil {
		return jsonErr("server connect", err)
	}
	defer ss.Close()

	client := mcp.NewClient(&mcp.Implementation{
		Name:    "tool-handler",
		Version: "0.1.0",
	}, nil)
	cs, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		return jsonErr("client connect", err)
	}
	defer cs.Close()

	var args map[string]interface{}
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return jsonErr("invalid arguments", err)
		}
	}

	result, err := cs.CallTool(ctx, &mcp.CallToolParams{
		Name:      name,
		Arguments: args,
	})
	if err != nil {
		return jsonErr("tool call failed", err)
	}

	var texts []string
	for _, c := range result.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			texts = append(texts, tc.Text)
		}
	}
	if len(texts) > 0 {
		return strings.Join(texts, "\n")
	}
	data, _ := json.Marshal(result)
	return string(data)
}

func jsonErr(ctx string, err error) string {
	return `{"error":"` + ctx + `: ` + strings.ReplaceAll(err.Error(), `"`, `'`) + `"}`
}

// ── Tool definitions (derived from MCP server — single source of truth) ──

type toolDef struct {
	Type     string      `json:"type"`
	Function toolFuncDef `json:"function"`
}

type toolFuncDef struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"`
}

// cachedToolDefs caches the tool definitions after first fetch.
var (
	cachedToolDefs []toolDef
	toolDefsMu     sync.Once
)

// getToolDefinitions retrieves tool definitions from the MCP server and
// converts them to OpenAI function-calling format. Results are cached.
func getToolDefinitions() []toolDef {
	toolDefsMu.Do(func() {
		cachedToolDefs = fetchToolDefsFromMCP()
	})
	return cachedToolDefs
}

func fetchToolDefsFromMCP() []toolDef {
	if chatMCPServer == nil {
		slog.Warn("MCP server not available for tool definitions")
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientTransport, serverTransport := mcp.NewInMemoryTransports()

	ss, err := chatMCPServer.Connect(ctx, serverTransport, nil)
	if err != nil {
		slog.Error("failed to connect MCP for tool defs", "error", err)
		return nil
	}
	defer ss.Close()

	client := mcp.NewClient(&mcp.Implementation{
		Name:    "tool-def-loader",
		Version: "0.1.0",
	}, nil)
	cs, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		slog.Error("failed to connect MCP client for tool defs", "error", err)
		return nil
	}
	defer cs.Close()

	result, err := cs.ListTools(ctx, nil)
	if err != nil {
		slog.Error("failed to list MCP tools", "error", err)
		return nil
	}

	var defs []toolDef
	for _, tool := range result.Tools {
		params := map[string]interface{}{"type": "object"}
		if tool.InputSchema != nil {
			// InputSchema is already a JSON Schema object
			raw, _ := json.Marshal(tool.InputSchema)
			var schema map[string]interface{}
			if json.Unmarshal(raw, &schema) == nil {
				params = schema
			}
		}
		defs = append(defs, toolDef{
			Type: "function",
			Function: toolFuncDef{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  params,
			},
		})
	}

	slog.Info("tool definitions loaded from MCP", "count", len(defs))
	return defs
}
