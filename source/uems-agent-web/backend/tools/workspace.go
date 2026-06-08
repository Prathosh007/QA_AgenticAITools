package tools

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// workspaceRoot is resolved at registration time from guidelinesDir.
var workspaceRoot string

type readWorkspaceInput struct {
	Path      string `json:"path" jsonschema:"Relative path from workspace root (e.g. testcases/AgentInstallation/KNOWLEDGE.md, GOAT_Operations_Context.md, skills/testcase-generation/SKILL.md)"`
	StartLine int    `json:"start_line,omitempty" jsonschema:"Optional start line (1-based). Omit to read from beginning."`
	EndLine   int    `json:"end_line,omitempty" jsonschema:"Optional end line (1-based inclusive). Omit to read to end."`
}

type listWorkspaceInput struct {
	Path string `json:"path,omitempty" jsonschema:"Relative directory path from workspace root (e.g. testcases, skills). Omit or use . for root."`
}

func registerReadWorkspace(s *mcp.Server) {
	// Derive workspace root: guidelinesDir is <root>/guidelines
	if guidelinesDir != "" {
		workspaceRoot = filepath.Dir(filepath.Clean(guidelinesDir))
	}

	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_read_workspace",
		Description: "Read a file from the UEMS workspace. Use this to read KNOWLEDGE.md, GOAT_Operations_Context.md, testcase CSV files, skill files, or any workspace file. Path is relative to the workspace root.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input readWorkspaceInput) (*mcp.CallToolResult, any, error) {
		if workspaceRoot == "" {
			return errRes("workspace root not configured")
		}

		cleanPath := filepath.Clean(input.Path)
		if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
			return errRes("invalid path: must be relative and within workspace")
		}

		absPath := filepath.Join(workspaceRoot, cleanPath)
		absRoot, _ := filepath.Abs(workspaceRoot)
		absTarget, _ := filepath.Abs(absPath)
		if !strings.HasPrefix(absTarget, absRoot) {
			return errRes("path outside workspace")
		}

		data, err := os.ReadFile(absPath)
		if err != nil {
			return errRes(fmt.Sprintf("cannot read file: %s", err.Error()))
		}

		text := string(data)

		// Apply line range if specified
		if input.StartLine > 0 || input.EndLine > 0 {
			lines := strings.Split(text, "\n")
			start := 0
			end := len(lines)
			if input.StartLine > 0 {
				start = input.StartLine - 1
				if start > len(lines) {
					start = len(lines)
				}
			}
			if input.EndLine > 0 && input.EndLine < end {
				end = input.EndLine
			}
			if start > end {
				start = end
			}
			text = strings.Join(lines[start:end], "\n")
		}

		// Truncate very large files
		if len(text) > 80000 {
			text = text[:80000] + "\n...(truncated at 80KB)"
		}

		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{
				Text: fmt.Sprintf("File: %s (%d bytes)\n\n%s", cleanPath, len(data), text),
			}},
		}, nil, nil
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_list_workspace",
		Description: "List files and directories at a path in the UEMS workspace. Use this to discover KNOWLEDGE.md files, testcase folders, or skill folders.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input listWorkspaceInput) (*mcp.CallToolResult, any, error) {
		if workspaceRoot == "" {
			return errRes("workspace root not configured")
		}

		dirPath := input.Path
		if dirPath == "" {
			dirPath = "."
		}

		cleanPath := filepath.Clean(dirPath)
		if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
			return errRes("invalid path: must be relative and within workspace")
		}

		absPath := filepath.Join(workspaceRoot, cleanPath)

		entries, err := os.ReadDir(absPath)
		if err != nil {
			return errRes(fmt.Sprintf("cannot list directory: %s", err.Error()))
		}

		var items []map[string]interface{}
		for _, e := range entries {
			info, _ := e.Info()
			item := map[string]interface{}{
				"name":  e.Name(),
				"isDir": e.IsDir(),
			}
			if info != nil {
				item["size"] = info.Size()
			}
			items = append(items, item)
		}

		return jsonResponse(map[string]interface{}{
			"path":    cleanPath,
			"entries": items,
		}), nil, nil
	})
}

func errRes(msg string) (*mcp.CallToolResult, any, error) {
	r := jsonResponse(map[string]string{"error": msg})
	r.IsError = true
	return r, nil, nil
}
