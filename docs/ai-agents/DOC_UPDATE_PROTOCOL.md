<!-- audience: ai-agents -->
<!-- doc-type: guide -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Documentation Update Protocol

> 🎯 **Audience:** AI agents
> **Scope:** All projects
> **Read when:** After making code changes — determine which docs to update.

Change-type to doc-file mapping table. After any code change, consult this table to identify which documentation files need updating.

---

## Change-Type → Doc-File Mapping

| Change Type | Update These Files |
|-------------|-------------------|
| Add/modify an AI agent | `CODEBASE_MAP.md`, root `ARCHITECTURE.md` (agent inventory), entry point (if new agent) |
| Add/modify a skill | `CODEBASE_MAP.md`, entry point (if new skill) |
| Add/modify a guideline | `CODEBASE_MAP.md` |
| Add a new LM tool (TS) | `CODEBASE_MAP.md`, `AGENT_GUIDE.md`, root `ARCHITECTURE.md` (tool parity), `uems-agent-chat/ARCHITECTURE.md` |
| Add a new MCP tool (Go) | `CODEBASE_MAP.md`, `AGENT_GUIDE.md`, root `ARCHITECTURE.md` (tool parity), `uems-agent-web/ARCHITECTURE.md` |
| Modify chat participant | `uems-agent-chat/ARCHITECTURE.md`, `WORKFLOWS.md` |
| Modify HTTP bridge | `uems-agent-chat/ARCHITECTURE.md`, `WORKFLOWS.md`, `GLOSSARY.md` (if new concepts) |
| Modify Copilot proxy / auth | `uems-agent-web/ARCHITECTURE.md`, `WORKFLOWS.md` |
| Modify server modes | `uems-agent-web/ARCHITECTURE.md`, `GLOSSARY.md`, `BUILD_GUIDE.md` |
| Modify sync behavior | `uems-agent-chat/ARCHITECTURE.md`, `WORKFLOWS.md` |
| Modify extension self-update | `uems-agent-chat/ARCHITECTURE.md`, `WORKFLOWS.md` |
| Add a new config flag | `uems-agent-web/ARCHITECTURE.md` (config table), `BUILD_GUIDE.md` |
| Modify build system | `BUILD_GUIDE.md`, `CODEBASE_MAP.md` |
| Change extension settings | `uems-agent-chat/ARCHITECTURE.md` (config table) |
| Add a repo to repos.json | `GLOSSARY.md` (if new term), root `ARCHITECTURE.md` |
| Rename/move files | `CODEBASE_MAP.md`, affected `ARCHITECTURE.md` files |
| New domain concept | `GLOSSARY.md` |
| Modify web frontend | `uems-agent-web/ARCHITECTURE.md` |
| Release extension | Entry point (commit hash) |

## Post-Change Checklist

After every completed change:

- [ ] `CODEBASE_MAP.md` updated if files added/moved/deleted
- [ ] Affected `ARCHITECTURE.md` updated if structure changed
- [ ] `GLOSSARY.md` updated if new terms introduced
- [ ] `BUILD_GUIDE.md` updated if build process changed
- [ ] `AGENT_GUIDE.md` updated if common task process changed
- [ ] `<!-- last-updated -->` and footer dates refreshed on all touched docs
- [ ] `<!-- last-documented-commit -->` updated in entry point

## Diff-Based Discovery

When updating docs for a release or periodic audit:

1. Read `<!-- last-documented-commit -->` from `.github/copilot-instructions.md`
2. Run: `git diff --name-only {hash}..HEAD`
3. Map changed files to docs using the table above
4. Read changed source files + affected docs
5. Update docs
6. Update `<!-- last-documented-commit -->` to current HEAD

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](CODEBASE_MAP.md) |
| Doc format rules | [`DOC_TEMPLATE.md`](DOC_TEMPLATE.md) |

---

*Last Updated: 2026-04-08*
