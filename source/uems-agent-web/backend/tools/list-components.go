package tools

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type listComponentsInput struct {
	Repo     string   `json:"repo" jsonschema:"Repo name"`
	Types    []string `json:"types,omitempty" jsonschema:"Component types: class protocol struct enum"`
	Platform string   `json:"platform,omitempty" jsonschema:"Platform: mac linux windows"`
}

func registerListComponents(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_list_components",
		Description: "List native code components (classes, protocols, structs, enums, functions, XPC services, Go interfaces) defined in a UEMS agent repository. Supports Swift, Objective-C, C, Go, and C++. Use this to discover what components exist in a repo.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input listComponentsInput) (*mcp.CallToolResult, any, error) {
		if input.Platform == "" {
			input.Platform = "mac"
		}
		if len(input.Types) == 0 {
			input.Types = []string{"class", "protocol", "struct"}
		}

		rp := resolveRepoPath(input.Repo)
		if rp == "" {
			return errorResult(fmt.Sprintf("Repo %q not found on disk.", input.Repo)), nil, nil
		}

		patterns := buildComponentPatterns(input.Types, input.Platform)
		if patterns == "" {
			return errorResult("No valid component types for this platform."), nil, nil
		}

		matches, _ := rgSearch(patterns, []string{rp}, filePatternForPlatform(input.Platform), 500, true)

		grouped := map[string][]string{}
		re := regexp.MustCompile(patterns)
		for _, m := range matches {
			sub := re.FindStringSubmatch(m.Text)
			name := m.Text
			if len(sub) > 1 {
				name = sub[1]
			}
			for _, t := range input.Types {
				if strings.Contains(strings.ToLower(m.Text), t) {
					grouped[t] = append(grouped[t], fmt.Sprintf("%s (%s:%d)", name, m.File, m.Line))
					break
				}
			}
		}

		return jsonResponse(map[string]interface{}{
			"repo":       input.Repo,
			"platform":   input.Platform,
			"total":      len(matches),
			"components": grouped,
		}), nil, nil
	})
}

func buildComponentPatterns(types []string, platform string) string {
	var parts []string
	if platform == "mac" || platform == "cross-platform" {
		for _, t := range types {
			switch t {
			case "class":
				parts = append(parts, `(?:@interface|@implementation|class)\s+(\w+)`)
			case "protocol":
				parts = append(parts, `@protocol\s+(\w+)`)
			case "struct":
				parts = append(parts, `struct\s+(\w+)`)
			case "enum":
				parts = append(parts, `(?:NS_ENUM|NS_OPTIONS|enum)\s+\(?(\w+)`)
			}
		}
	}
	if platform == "linux" || platform == "cross-platform" {
		for _, t := range types {
			switch t {
			case "class", "struct":
				parts = append(parts, `type\s+(\w+)\s+struct`)
			case "protocol":
				parts = append(parts, `type\s+(\w+)\s+interface`)
			case "enum":
				parts = append(parts, `type\s+(\w+)\s+(?:int|string|uint)`)
			}
		}
	}
	if platform == "windows" {
		for _, t := range types {
			switch t {
			case "class":
				parts = append(parts, `class\s+(\w+)`)
			case "struct":
				parts = append(parts, `struct\s+(\w+)`)
			case "enum":
				parts = append(parts, `enum\s+(?:class\s+)?(\w+)`)
			}
		}
	}
	return strings.Join(parts, "|")
}
