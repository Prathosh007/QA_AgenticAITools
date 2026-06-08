package tools

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type searchReposInput struct {
	Query       string   `json:"query" jsonschema:"Search pattern. Multiple terms can be separated by spaces, pipes (|), or ampersands (&) to match any of them (OR logic). Examples: 'WriteEvent ERRMSG' finds both, 'NSXPCConnection' finds exact match, 'init.*Logger' with isRegex=true for advanced regex."`
	Repos       []string `json:"repos,omitempty" jsonschema:"Repo names to search (e.g. ['agent-utils', 'patch-management']). Searches all workspace repos if omitted."`
	FilePattern string   `json:"filePattern,omitempty" jsonschema:"Glob pattern for files (e.g. '*.swift', '*.{h,cpp}')."`
	MaxResults  int      `json:"maxResults,omitempty" jsonschema:"Max results to return (default 200)."`
	IsRegex     bool     `json:"isRegex,omitempty" jsonschema:"Set to true only for advanced regex syntax (character classes, quantifiers, lookaheads). NOT needed for multi-term searches. Default: false."`
}

func registerSearchRepos(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_search_repos",
		Description: "Search for code patterns across UEMS agent repositories. Supports multiple search terms separated by spaces, pipes (|), or ampersands (&) — each term is matched independently (OR logic). Set isRegex=true only for advanced regex patterns.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input searchReposInput) (*mcp.CallToolResult, any, error) {
		repos := input.Repos
		if len(repos) == 0 {
			repos = allRepoNames()
		}
		repoPaths := resolveRepoPaths(repos)
		if len(repoPaths) == 0 {
			return errorResult("No matching repos found on disk. Ensure repos are cloned."), nil, nil
		}

		maxR := input.MaxResults
		if maxR <= 0 {
			maxR = 200
		}

		// Normalize multi-term queries: space, &, | separated terms → regex alternation
		query, isRegex := normalizeQuery(input.Query, input.IsRegex)

		matches, truncated := rgSearch(query, repoPaths, input.FilePattern, maxR, isRegex)

		grouped := map[string][]string{}
		for _, m := range matches {
			grouped[m.Repo] = append(grouped[m.Repo], fmt.Sprintf("%s:%d:%s", m.File, m.Line, m.Text))
		}

		// Attach platform metadata for each repo
		repoPlatforms := map[string]string{}
		for repoName := range grouped {
			for platform, platformRepos := range registry {
				if _, ok := platformRepos[repoName]; ok {
					repoPlatforms[repoName] = platform
					break
				}
			}
		}

		resp := map[string]interface{}{
			"total":     len(matches),
			"truncated": truncated,
			"results":   grouped,
		}
		if len(repoPlatforms) > 0 {
			resp["repoPlatforms"] = repoPlatforms
		}

		return jsonResponse(resp), nil, nil
	})
}
