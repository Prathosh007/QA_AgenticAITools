package tools

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Shared state set by RegisterAll.
var skillsDir string

type loadSkillsInput struct {
	Files []string `json:"files" jsonschema:"Skill folder names to load, e.g. platform-confirmation-protocol, tool-preference-rules"`
}

func registerLoadSkills(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_load_skills",
		Description: "Load UEMS skill files (SKILL.md) by folder name. Skills provide specialized workflows and best practices for specific domains like testing, security, code review, etc.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input loadSkillsInput) (*mcp.CallToolResult, any, error) {
		if len(input.Files) == 0 {
			// List available skills when no files specified
			return listAvailableSkills()
		}

		var results []map[string]string
		var notFound []string

		for _, name := range input.Files {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			skillPath := filepath.Join(skillsDir, name, "SKILL.md")
			content, err := os.ReadFile(skillPath)
			if err != nil {
				notFound = append(notFound, name)
				continue
			}
			results = append(results, map[string]string{
				"skill":   name,
				"path":    "skills/" + name + "/SKILL.md",
				"content": string(content),
			})
		}

		if len(results) == 0 {
			return errorResult("No skill files found for: " + strings.Join(notFound, ", ")), nil, nil
		}

		resp := map[string]interface{}{
			"loaded": results,
		}
		if len(notFound) > 0 {
			resp["not_found"] = notFound
		}
		return jsonResponse(resp), nil, nil
	})
}

func listAvailableSkills() (*mcp.CallToolResult, any, error) {
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		return errorResult("Skills directory not found: " + skillsDir), nil, nil
	}

	var skills []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		// Only list directories that contain a SKILL.md
		if _, err := os.Stat(filepath.Join(skillsDir, e.Name(), "SKILL.md")); err == nil {
			skills = append(skills, e.Name())
		}
	}

	if len(skills) == 0 {
		return errorResult("No skills found in skills directory."), nil, nil
	}

	return jsonResponse(map[string]interface{}{
		"available_skills": skills,
		"usage":            "Call again with files: [\"skill-name\"] to load specific skills.",
	}), nil, nil
}
