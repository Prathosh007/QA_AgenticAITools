package tools

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type validateTagInput struct {
	Repo string `json:"repo" jsonschema:"Repo name"`
	Tag  string `json:"tag" jsonschema:"Tag to validate (e.g. AGENT_UTILS_26.05.01)"`
}

// Tag format: PRODUCTNAME_YY.MM.BUILD (e.g. AGENT_UTILS_26.05.01)
var tagPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*_\d{2}\.\d{2}\.\d{2,3}$`)
var bareVersionPattern = regexp.MustCompile(`^\d{2}\.\d{2}\.\d{2,3}$`)

func registerValidateTag(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_validate_tag",
		Description: "Validate a git tag format and check if it exists in a repo. Accepts a full tag (PRODUCT_YY.MM.BUILD) or a bare version (YY.MM.BUILD) to discover matching tags.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input validateTagInput) (*mcp.CallToolResult, any, error) {
		rp := resolveRepoPath(input.Repo)
		if rp == "" {
			return errorResult(fmt.Sprintf("Repo %q not found on disk.", input.Repo)), nil, nil
		}

		isBareVersion := bareVersionPattern.MatchString(input.Tag)
		formatValid := isBareVersion || tagPattern.MatchString(input.Tag)

		// Check existence (skip for bare versions — they're never exact tags)
		exists := false
		if !isBareVersion {
			_, err := gitExec(rp, "rev-parse", "--verify", "refs/tags/"+input.Tag)
			exists = err == nil
		}

		// Find suggestions if tag doesn't exist
		var suggestions []string
		if !exists {
			var searchPattern string
			if isBareVersion {
				// Bare version: search with wildcards on both sides (e.g. *26.11.01*)
				searchPattern = "*" + input.Tag + "*"
			} else {
				parts := strings.Split(input.Tag, "_")
				prefix := input.Tag
				if len(parts) >= 3 {
					prefix = strings.Join(parts[:len(parts)-1], "_")
				}
				searchPattern = prefix + "*"
			}
			out, err := gitExec(rp, "tag", "-l", searchPattern, "--sort=-version:refname")
			if err == nil && out != "" {
				lines := strings.Split(out, "\n")
				for i, l := range lines {
					if i >= 5 {
						break
					}
					if l != "" {
						suggestions = append(suggestions, l)
					}
				}
			}
		}

		return jsonResponse(map[string]interface{}{
			"repo":        input.Repo,
			"tag":         input.Tag,
			"formatValid": formatValid,
			"exists":      exists,
			"suggestions": suggestions,
		}), nil, nil
	})
}
