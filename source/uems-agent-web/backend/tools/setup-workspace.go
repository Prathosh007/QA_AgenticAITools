package tools

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type setupWorkspaceInput struct {
	Repos     []string `json:"repos,omitempty" jsonschema:"Repo names to clone/fetch (empty = all for platform)"`
	Platform  string   `json:"platform,omitempty" jsonschema:"Platform: mac linux windows"`
	TargetDir string   `json:"targetDir,omitempty" jsonschema:"Directory to clone repos into (default: repoDir)"`
	Branch    string   `json:"branch,omitempty" jsonschema:"Branch to checkout after clone/fetch"`
}

func registerSetupWorkspace(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_setup_workspace",
		Description: "Clone or fetch multiple UEMS agent repositories and verify workspace readiness. Optionally checkout a specific branch in all repos. Reports clone/fetch status, current branch, and clean/dirty state for each repo.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input setupWorkspaceInput) (*mcp.CallToolResult, any, error) {
		if input.Platform == "" {
			input.Platform = "mac"
		}
		baseDir := input.TargetDir
		if baseDir == "" {
			baseDir = repoDir
		}

		// Resolve which repos to set up
		var repos []struct {
			name   string
			gitURL string
		}

		if len(input.Repos) > 0 {
			for _, name := range input.Repos {
				for platform, platformRepos := range registry {
					if input.Platform != "" && platform != input.Platform && platform != "cross-platform" {
						continue
					}
					if entry, ok := platformRepos[name]; ok {
						repos = append(repos, struct {
							name   string
							gitURL string
						}{name, entry.GitURL})
						break
					}
				}
			}
			if len(repos) == 0 {
				return errorResult(fmt.Sprintf("No matching repos found for: %s", strings.Join(input.Repos, ", "))), nil, nil
			}
		} else {
			// All repos for the platform + cross-platform
			for _, platform := range []string{input.Platform, "cross-platform"} {
				platformRepos := registry[platform]
				for name, entry := range platformRepos {
					repos = append(repos, struct {
						name   string
						gitURL string
					}{name, entry.GitURL})
				}
			}
		}

		var statuses []string
		var cloned, fetched, errors int

		for _, repo := range repos {
			repoPath := filepath.Join(baseDir, repo.name)
			action, err := cloneOrFetch(repo.gitURL, repoPath)

			if err != nil {
				errors++
				statuses = append(statuses, fmt.Sprintf("%s:error:%s", repo.name, err))
				continue
			}

			// Get branch and clean status
			branch, _ := gitExec(repoPath, "rev-parse", "--abbrev-ref", "HEAD")
			statusOut, _ := gitExec(repoPath, "status", "--porcelain")
			clean := "clean"
			if statusOut != "" {
				clean = "dirty"
			}

			statuses = append(statuses, fmt.Sprintf("%s:%s:%s:%s", repo.name, action, branch, clean))

			if action == "cloned" {
				cloned++
			} else {
				fetched++
			}
		}

		// Checkout branch if requested
		var checkoutResults []string
		if input.Branch != "" {
			for _, repo := range repos {
				repoPath := filepath.Join(baseDir, repo.name)
				if _, err := os.Stat(repoPath); err != nil {
					continue
				}
				if _, err := gitExec(repoPath, "checkout", input.Branch); err != nil {
					checkoutResults = append(checkoutResults, fmt.Sprintf("%s:checkout-skipped:%v", repo.name, err))
				} else {
					checkoutResults = append(checkoutResults, fmt.Sprintf("%s:checked-out:%s", repo.name, input.Branch))
				}
			}
		}

		resp := map[string]interface{}{
			"cloned":  cloned,
			"fetched": fetched,
			"errors":  errors,
			"repos":   statuses,
		}
		if len(checkoutResults) > 0 {
			resp["checkout"] = checkoutResults
		}

		return jsonResponse(resp), nil, nil
	})
}

func cloneOrFetch(gitURL, targetDir string) (string, error) {
	info, err := os.Stat(targetDir)
	if err == nil && info.IsDir() {
		// Directory exists — check if it's a git repo and fetch
		if _, err := gitExec(targetDir, "rev-parse", "--is-inside-work-tree"); err == nil {
			if _, err := gitExec(targetDir, "fetch", "--all", "--tags"); err != nil {
				return "fetched", fmt.Errorf("fetch failed: %w", err)
			}
			return "fetched", nil
		}
		return "", fmt.Errorf("directory exists but is not a git repository")
	}

	// Clone
	if err := os.MkdirAll(filepath.Dir(targetDir), 0o755); err != nil {
		return "", fmt.Errorf("mkdir failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", "clone", gitURL, targetDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("clone failed: %s", strings.TrimSpace(string(out)))
	}
	return "cloned", nil
}
