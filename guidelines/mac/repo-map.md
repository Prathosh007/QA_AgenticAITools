# Mac Repository Rules

> Repo structure, dependencies, and URLs are available via tools (`#uems_agent_dependency_graph`, `#uems_agent_search_repos`).
> This file contains **rules and guidelines only** — things tools can't express.

---

## Mandatory Rules

1. **Agent-Utils is mandatory** — all repos must route through Agent-Utils for networking, logging, file I/O, secure storage, and process execution. Never call platform APIs directly.
2. **cmickey_utils is legacy** — provides XML parsing and legacy logger (being replaced by the Agent-Utils logging wrapper). Still widely depended on, but **do not use for new code**. Changes ripple across 10+ repos; extra caution required.
3. **uems_native_dependencies** — version updates here affect all repos. Coordinate version bumps carefully across the full dependency chain.
4. **uems_go_components** — built separately with Go toolchain. Interfaces with the Mac agent via IPC/files, not direct linking. Separate build pipeline.
5. **New repos** must declare dependencies explicitly and follow the Agent-Utils mandate.

## Cross-Repo Change Rules

- **Layer 0 changes** (cmickey_utils, uems_native_dependencies) → impact ALL repos. Require full cross-repo testing.
- **Layer 1 changes** (agent-utils) → impact ALL feature and deliverable repos. Verify wrapper contracts are preserved.
- **Layer 2 changes** (configuration-framework) → impact framework-ops-suite and uems-mac-agent-setup.
- **Layer 3 changes** (feature repos) → usually isolated. Verify uems-mac-agent-setup integration.
- **Security repos** (application-control, browser-security, device-control-plus) → standalone deliverables. Share agent-utils dependency but are independent of each other.
