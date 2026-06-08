package tools

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type createBranchInput struct {
	Repos      []string `json:"repos" jsonschema:"Repo names to create the branch in"`
	BranchName string   `json:"branchName" jsonschema:"Branch name (e.g. feature/my-feature)"`
	FromRef    string   `json:"fromRef" jsonschema:"Base ref — tag or branch to create from"`
}

// Branch naming: feature/<topic>, bugfix/<topic>, hotfix/<topic>, release/<version>
var branchPattern = regexp.MustCompile(`^(feature|bugfix|hotfix|release)/[a-z0-9][a-z0-9._-]*$`)

func registerCreateBranch(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_create_branch",
		Description: "Create a git branch from a tag or base branch across one or more UEMS repos. Validates branch naming convention (feature/, bugfix/, hotfix/, release/) and tag format before creating. Use this during environment setup to create working branches.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input createBranchInput) (*mcp.CallToolResult, any, error) {
		// Validate branch name
		if !branchPattern.MatchString(input.BranchName) {
			return errorResult(fmt.Sprintf(
				"Branch %q does not follow convention: feature/<topic>, bugfix/<topic>, hotfix/<topic>, or release/<version>. Use lowercase with hyphens.",
				input.BranchName,
			)), nil, nil
		}

		repoPaths := resolveRepoPaths(input.Repos)
		if len(repoPaths) == 0 {
			return errorResult(fmt.Sprintf("None of the specified repos found: %s", strings.Join(input.Repos, ", "))), nil, nil
		}

		// Validate tag format if fromRef looks like a tag
		if regexp.MustCompile(`\d{2}\.\d{2}`).MatchString(input.FromRef) {
			rp := repoPaths[0]
			if !tagPattern.MatchString(input.FromRef) {
				return errorResult(fmt.Sprintf(
					"Tag %q does not match expected format: PRODUCTNAME_YY.MM.BUILD (e.g. AGENT_UTILS_26.05.01)",
					input.FromRef,
				)), nil, nil
			}
			_, err := gitExec(rp, "rev-parse", "--verify", input.FromRef)
			if err != nil {
				return errorResult(fmt.Sprintf("Base ref %q not found in repo.", input.FromRef)), nil, nil
			}
		}

		var ok []string
		var failed []string

		for _, rp := range repoPaths {
			repoName := rp[strings.LastIndex(rp, "/")+1:]

			// Verify base ref exists
			if _, err := gitExec(rp, "rev-parse", "--verify", input.FromRef); err != nil {
				failed = append(failed, fmt.Sprintf("%s:ref %q not found", repoName, input.FromRef))
				continue
			}

			// Create branch
			if _, err := gitExec(rp, "checkout", "-b", input.BranchName, input.FromRef); err != nil {
				failed = append(failed, fmt.Sprintf("%s:%v", repoName, err))
				continue
			}

			sha, _ := gitExec(rp, "rev-parse", "HEAD")
			if len(sha) > 8 {
				sha = sha[:8]
			}
			ok = append(ok, fmt.Sprintf("%s:%s", repoName, sha))
		}

		return jsonResponse(map[string]interface{}{
			"branch": input.BranchName,
			"from":   input.FromRef,
			"ok":     ok,
			"failed": failed,
		}), nil, nil
	})
}
