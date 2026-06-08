package tools

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// testcaseDBURL is the base URL of the Node.js testcase DB server.
const testcaseDBURL = "http://prathosh-14802-t:3000"

type testcaseDBInput struct {
	Action        string      `json:"action" jsonschema:"The DB action to perform. One of: list_testcases, create_testcase, get_testcase, update_testcase, delete_testcase, list_payloads, create_payload, get_payload, list_gaps, create_gap, get_stats, delete_functionality, export_csv"`
	Functionality string      `json:"functionality,omitempty" jsonschema:"Filter by functionality name (e.g. AgentInstallation). Used by list_testcases, list_payloads, list_gaps, delete_functionality, export_csv."`
	TcID          string      `json:"tc_id,omitempty" jsonschema:"Test case ID (e.g. TC-AGENTINSTALL-MANUALGUI-001). Used by get_testcase, update_testcase, delete_testcase, get_payload, create_payload."`
	Data          interface{} `json:"data,omitempty" jsonschema:"JSON object with the test case or payload or gap data to create/update. Shape depends on action."`
}

func registerTestcaseDB(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_testcase_db",
		Description: "Interact with the UEMS Testcase DB to create, read, update, and delete test cases, GOAT payloads, and gap reports. Supported actions: list_testcases, create_testcase, get_testcase, update_testcase, delete_testcase, list_payloads, create_payload, get_payload, list_gaps, create_gap, get_stats, delete_functionality, export_csv.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, params testcaseDBInput) (*mcp.CallToolResult, any, error) {

		switch params.Action {
		case "list_testcases":
			url := testcaseDBURL + "/testcases"
			if params.Functionality != "" {
				url += "?functionality=" + params.Functionality
			}
			return dbGET3(url)

		case "get_testcase":
			if params.TcID == "" {
				return errorResult3("tc_id is required for get_testcase")
			}
			return dbGET3(testcaseDBURL + "/testcases/" + params.TcID)

		case "create_testcase":
			if params.Data == nil {
				return errorResult3("data is required for create_testcase")
			}
			return dbPOST3(testcaseDBURL+"/testcases", params.Data)

		case "update_testcase":
			if params.TcID == "" {
				return errorResult3("tc_id is required for update_testcase")
			}
			if params.Data == nil {
				return errorResult3("data is required for update_testcase")
			}
			return dbPUT3(testcaseDBURL+"/testcases/"+params.TcID, params.Data)

		case "delete_testcase":
			if params.TcID == "" {
				return errorResult3("tc_id is required for delete_testcase")
			}
			return dbDELETE3(testcaseDBURL + "/testcases/" + params.TcID)

		case "list_payloads":
			url := testcaseDBURL + "/payloads"
			if params.Functionality != "" {
				url += "?functionality=" + params.Functionality
			}
			return dbGET3(url)

		case "get_payload":
			if params.TcID == "" {
				return errorResult3("tc_id is required for get_payload")
			}
			return dbGET3(testcaseDBURL + "/payloads/" + params.TcID)

		case "create_payload":
			if params.Data == nil {
				return errorResult3("data is required for create_payload")
			}
			return dbPOST3(testcaseDBURL+"/payloads", params.Data)

		case "list_gaps":
			url := testcaseDBURL + "/gaps"
			if params.Functionality != "" {
				url += "?functionality=" + params.Functionality
			}
			return dbGET3(url)

		case "create_gap":
			if params.Data == nil {
				return errorResult3("data is required for create_gap")
			}
			return dbPOST3(testcaseDBURL+"/gaps", params.Data)

		case "get_stats":
			return dbGET3(testcaseDBURL + "/stats")

		case "delete_functionality":
			if params.Functionality == "" {
				return errorResult3("functionality is required for delete_functionality")
			}
			return dbDELETE3(testcaseDBURL + "/functionality/" + params.Functionality)

		case "export_csv":
			url := testcaseDBURL + "/export/csv"
			if params.Functionality != "" {
				url += "?functionality=" + params.Functionality
			}
			return dbGET3(url)

		default:
			return errorResult3("unknown action: " + params.Action + ". Valid actions: list_testcases, create_testcase, get_testcase, update_testcase, delete_testcase, list_payloads, create_payload, get_payload, list_gaps, create_gap, get_stats, delete_functionality, export_csv")
		}
	})
}

// ── HTTP helpers for testcase DB (3-return) ──────────────────────

var httpClient = &http.Client{Timeout: 30 * time.Second}

func errorResult3(msg string) (*mcp.CallToolResult, any, error) {
	r := jsonResponse(map[string]string{"error": msg})
	r.IsError = true
	return r, nil, nil
}

func textResult3(text string) (*mcp.CallToolResult, any, error) {
	if len(text) > 50000 {
		text = text[:50000] + "\n...(truncated)"
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: text}},
	}, nil, nil
}

func dbGET3(url string) (*mcp.CallToolResult, any, error) {
	resp, err := httpClient.Get(url)
	if err != nil {
		return errorResult3("DB request failed: " + err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return errorResult3(fmt.Sprintf("DB error %d: %s", resp.StatusCode, string(body)))
	}
	return textResult3(string(body))
}

func dbPOST3(url string, data interface{}) (*mcp.CallToolResult, any, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return errorResult3("failed to marshal data: " + err.Error())
	}
	resp, err := httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return errorResult3("DB request failed: " + err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return errorResult3(fmt.Sprintf("DB error %d: %s", resp.StatusCode, string(body)))
	}
	return textResult3(string(body))
}

func dbPUT3(url string, data interface{}) (*mcp.CallToolResult, any, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return errorResult3("failed to marshal data: " + err.Error())
	}
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return errorResult3("failed to create request: " + err.Error())
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return errorResult3("DB request failed: " + err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return errorResult3(fmt.Sprintf("DB error %d: %s", resp.StatusCode, string(body)))
	}
	return textResult3(string(body))
}

func dbDELETE3(url string) (*mcp.CallToolResult, any, error) {
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return errorResult3("failed to create request: " + err.Error())
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return errorResult3("DB request failed: " + err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return errorResult3(fmt.Sprintf("DB error %d: %s", resp.StatusCode, string(body)))
	}
	return textResult3(string(body))
}
