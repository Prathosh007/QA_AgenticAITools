package tools

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type dependencyGraphInput struct {
	Repo      string `json:"repo,omitempty" jsonschema:"Repo name (omit for full platform graph)"`
	Platform  string `json:"platform,omitempty" jsonschema:"Platform: mac linux windows cross-platform"`
	Direction string `json:"direction,omitempty" jsonschema:"Direction: up down or both"`
}

func registerDependencyGraph(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_dependency_graph",
		Description: "Get the dependency graph for a specific UEMS repo or the full platform. Shows upstream dependencies and downstream dependents organized by layer (0-4). Use this to understand cross-repo impact before making changes.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input dependencyGraphInput) (*mcp.CallToolResult, any, error) {
		if input.Platform == "" {
			input.Platform = "mac"
		}
		if input.Direction == "" {
			input.Direction = "both"
		}

		platformRepos := registry[input.Platform]
		if platformRepos == nil {
			return errorResult(fmt.Sprintf("No repos for platform %q", input.Platform)), nil, nil
		}

		if input.Repo == "" {
			layers := map[int]map[string][]string{}
			for name, entry := range platformRepos {
				if layers[entry.Layer] == nil {
					layers[entry.Layer] = map[string][]string{}
				}
				layers[entry.Layer][name] = entry.Dependencies
			}
			return jsonResponse(map[string]interface{}{
				"platform": input.Platform,
				"total":    len(platformRepos),
				"layers":   layers,
			}), nil, nil
		}

		entry, ok := platformRepos[input.Repo]
		if !ok {
			if cpRepos := registry["cross-platform"]; cpRepos != nil {
				entry, ok = cpRepos[input.Repo]
			}
		}
		if !ok {
			return errorResult(fmt.Sprintf("Repo %q not found for platform %q", input.Repo, input.Platform)), nil, nil
		}

		result := map[string]interface{}{
			"repo":  input.Repo,
			"layer": entry.Layer,
		}

		if input.Direction == "up" || input.Direction == "both" {
			result["upstream"] = getUpstream(input.Repo, input.Platform)
		}
		if input.Direction == "down" || input.Direction == "both" {
			result["downstream"] = getDownstream(input.Repo, input.Platform)
		}

		return jsonResponse(result), nil, nil
	})
}

func getUpstream(repo, platform string) []string {
	platformRepos := registry[platform]
	if platformRepos == nil {
		return nil
	}
	entry, ok := platformRepos[repo]
	if !ok {
		return nil
	}
	var upstream []string
	for _, dep := range entry.Dependencies {
		upstream = append(upstream, fmt.Sprintf("%s(L%d)", dep, getLayer(dep, platform)))
	}
	return upstream
}

func getDownstream(repo, platform string) []string {
	var downstream []string
	platformRepos := registry[platform]
	if platformRepos == nil {
		return nil
	}
	for name, entry := range platformRepos {
		for _, dep := range entry.Dependencies {
			if dep == repo {
				downstream = append(downstream, fmt.Sprintf("%s(L%d)", name, entry.Layer))
				break
			}
		}
	}
	return downstream
}

func getLayer(repo, platform string) int {
	if r, ok := registry[platform][repo]; ok {
		return r.Layer
	}
	if r, ok := registry["cross-platform"][repo]; ok {
		return r.Layer
	}
	return -1
}
