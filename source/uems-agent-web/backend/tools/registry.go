// Package tools implements MCP tool handlers that mirror the VS Code
// extension's uems_agent_* tools. This is the single source of truth for
// all tool logic — the VS Code extension connects to this Go server via MCP.
package tools

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// repoEntry mirrors one entry from repos.json.
type repoEntry struct {
	GitURL        string   `json:"gitUrl"`
	Layer         int      `json:"layer"`
	Dependencies  []string `json:"dependencies"`
	Description   string   `json:"description"`
	IsDeliverable bool     `json:"isDeliverable"`
}

// repoRegistry is the full repos.json keyed by platform → repo name.
type repoRegistry map[string]map[string]repoEntry

// Shared state set by RegisterAll.
var (
	registry      repoRegistry
	repoDir       string
	guidelinesDir string
)

// RegisterAll loads repos.json and registers all MCP tools on the server.
func RegisterAll(s *mcp.Server, repoDirPath, guidelinesDirPath, skillsDirPath, repoDataPath string) error {
	repoDir = repoDirPath
	guidelinesDir = guidelinesDirPath
	skillsDir = skillsDirPath

	data, err := os.ReadFile(repoDataPath)
	if err != nil {
		return fmt.Errorf("reading repos.json: %w", err)
	}
	if err := json.Unmarshal(data, &registry); err != nil {
		return fmt.Errorf("parsing repos.json: %w", err)
	}

	registerSearchRepos(s)
	registerListComponents(s)
	registerFindWrapper(s)
	registerDependencyGraph(s)
	registerValidateTag(s)
	registerCreateBranch(s)
	registerSetupWorkspace(s)
	registerLoadGuidelines(s)
	registerLoadSkills(s)
	registerTestcaseDB(s)
	registerReadWorkspace(s)

	return nil
}

// ── Response helpers ─────────────────────────────────────────────

func jsonResponse(v interface{}) *mcp.CallToolResult {
	data, _ := json.MarshalIndent(v, "", "  ")
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: string(data)}},
	}
}

func errorResult(msg string) *mcp.CallToolResult {
	r := jsonResponse(map[string]string{"error": msg})
	r.IsError = true
	return r
}

// ── Repo path resolution ─────────────────────────────────────────

func resolveRepoPath(name string) string {
	// Direct: repoDir/<repo_name>
	p := filepath.Join(repoDir, name)
	if info, err := os.Stat(p); err == nil && info.IsDir() {
		return p
	}
	if info, err := os.Stat(p + ".git"); err == nil && info.IsDir() {
		return p + ".git"
	}
	// Platform-based: repoDir/<platform>/<repo_name> (e.g. "Code base/windows/vmdr_agent")
	for platform := range registry {
		pp := filepath.Join(repoDir, platform, name)
		if info, err := os.Stat(pp); err == nil && info.IsDir() {
			return pp
		}
	}
	return ""
}

func resolveRepoPaths(names []string) []string {
	var out []string
	for _, n := range names {
		if p := resolveRepoPath(n); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func allRepoNames() []string {
	var names []string
	for _, repos := range registry {
		for name := range repos {
			names = append(names, name)
		}
	}
	return names
}

// ── Search helpers (ripgrep) ─────────────────────────────────────

var identifierRe = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// normalizeQuery converts multi-term queries (space, |, &) into regex alternation.
// Returns the (possibly rewritten) query and whether it should be treated as regex.
func normalizeQuery(query string, isRegex bool) (string, bool) {
	// If user explicitly set isRegex, trust their query as-is
	if isRegex {
		return query, true
	}

	trimmed := strings.TrimSpace(query)

	// Pipe-separated terms: "foo|bar|baz"
	if strings.Contains(trimmed, "|") {
		terms := splitAndTrim(trimmed, "|")
		if len(terms) > 1 {
			return joinEscaped(terms), true
		}
	}

	// Ampersand-separated terms: "foo & bar"
	if strings.Contains(trimmed, "&") {
		terms := splitAndTrim(trimmed, "&")
		if len(terms) > 1 {
			return joinEscaped(terms), true
		}
	}

	// Space-separated identifier tokens: "WriteEvent ERRMSG StartLoggingEngine"
	tokens := strings.Fields(trimmed)
	if len(tokens) > 1 {
		allIdent := true
		for _, t := range tokens {
			if !identifierRe.MatchString(t) {
				allIdent = false
				break
			}
		}
		if allIdent {
			return joinEscaped(tokens), true
		}
	}

	return trimmed, false
}

func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.Trim(p, "\\")
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func joinEscaped(terms []string) string {
	escaped := make([]string, len(terms))
	for i, t := range terms {
		escaped[i] = regexp.QuoteMeta(t)
	}
	return strings.Join(escaped, "|")
}

type searchMatch struct {
	Repo string `json:"repo"`
	File string `json:"file"`
	Line int    `json:"line"`
	Text string `json:"text"`
}

func rgSearch(query string, repoPaths []string, filePattern string, maxResults int, isRegex bool) ([]searchMatch, bool) {
	args := []string{"--no-heading", "--line-number", "--color=never"}

	// Auto-enable regex if query contains pipe (OR) or other regex patterns
	if !isRegex && strings.ContainsAny(query, "|()[]{}*+?\\^$") {
		isRegex = true
	}

	if !isRegex {
		args = append(args, "--fixed-strings")
	}
	if maxResults > 0 {
		args = append(args, "--max-count", strconv.Itoa(maxResults))
	}
	if filePattern != "" {
		args = append(args, "--glob", filePattern)
	}
	args = append(args, query)
	args = append(args, repoPaths...)

	cmd := exec.Command("rg", args...)
	out, _ := cmd.Output()

	var matches []searchMatch
	for _, line := range strings.Split(string(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ":", 3)
		if len(parts) < 3 {
			continue
		}
		lineNum, _ := strconv.Atoi(parts[1])
		text := parts[2]
		if len(text) > 200 {
			text = text[:200]
		}

		repoName := filepath.Base(parts[0])
		for _, rp := range repoPaths {
			if strings.HasPrefix(parts[0], rp) {
				repoName = filepath.Base(rp)
				break
			}
		}

		matches = append(matches, searchMatch{
			Repo: repoName,
			File: parts[0],
			Line: lineNum,
			Text: text,
		})

		if maxResults > 0 && len(matches) >= maxResults {
			return matches, true
		}
	}
	return matches, false
}

// ── Git helpers ──────────────────────────────────────────────────

func gitExec(repoPath string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", repoPath}, args...)...)
	out, err := cmd.Output()
	return strings.TrimSpace(string(out)), err
}

// ── Platform helpers ─────────────────────────────────────────────

func filePatternForPlatform(platform string) string {
	switch platform {
	case "mac":
		return "*.{swift,h,m,mm}"
	case "linux":
		return "*.go"
	case "windows":
		return "*.{c,cpp,h,hpp,cs}"
	default:
		return "*.{swift,h,m,mm,go,c,cpp}"
	}
}
