package tools

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type loadGuidelinesInput struct {
	Platform string   `json:"platform,omitempty" jsonschema:"Platform: mac linux windows"`
	Category string   `json:"category,omitempty" jsonschema:"Category: all common platform doc-standards review-standards"`
	Files    []string `json:"files,omitempty" jsonschema:"Specific filenames to load"`
}

func registerLoadGuidelines(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_load_guidelines",
		Description: "Load UEMS engineering guidelines, security standards, coding conventions, doc-standards, and review-standards from the synced store. Returns file contents organized by category. Use this instead of cloning the uems-ai-toolkit repo — guidelines are synced automatically.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input loadGuidelinesInput) (*mcp.CallToolResult, any, error) {
		if input.Platform == "" {
			input.Platform = "mac"
		}
		if input.Category == "" {
			input.Category = "all"
		}

		fileFilter := map[string]bool{}
		for _, f := range input.Files {
			fileFilter[f] = true
		}

		result := map[string][]map[string]string{}

		if input.Category == "all" || input.Category == "common" {
			dir := filepath.Join(guidelinesDir, "common")
			result["common"] = readGuidelineDir(dir, "guidelines/common", fileFilter)
		}
		if input.Category == "all" || input.Category == "platform" {
			dir := filepath.Join(guidelinesDir, input.Platform)
			result["platform"] = readGuidelineDir(dir, "guidelines/"+input.Platform, fileFilter)
		}
		if input.Category == "all" || input.Category == "doc-standards" {
			dir := filepath.Join(guidelinesDir, "..", "agents", "document-generator", "doc-standards")
			result["doc-standards"] = readGuidelineDir(dir, "agents/document-generator/doc-standards", fileFilter)
		}
		if input.Category == "all" || input.Category == "review-standards" {
			dir := filepath.Join(guidelinesDir, "..", "agents", "delta-reviewer", "review-standards")
			result["review-standards"] = readGuidelineDir(dir, "agents/delta-reviewer/review-standards", fileFilter)
		}

		total := 0
		for _, files := range result {
			total += len(files)
		}
		if total == 0 {
			return errorResult("No guideline files found. Check guidelines directory path."), nil, nil
		}

		return jsonResponse(map[string]interface{}{
			"platform": input.Platform,
			"category": input.Category,
			"files":    result,
		}), nil, nil
	})
}

func readGuidelineDir(dir, label string, filter map[string]bool) []map[string]string {
	var files []map[string]string
	entries, err := os.ReadDir(dir)
	if err != nil {
		return files
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		if len(filter) > 0 && !filter[e.Name()] {
			continue
		}
		content, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		files = append(files, map[string]string{
			"path":    label + "/" + e.Name(),
			"content": string(content),
		})
	}
	return files
}
