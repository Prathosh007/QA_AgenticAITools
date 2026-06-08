# Windows Repository Map

> Repo structure, dependencies, and URLs are available via tools (`#uems_agent_dependency_graph`, `#uems_agent_search_repos`).
> This file contains **rules and guidelines only** — things tools can't express.

---

## Mandatory Rules

1. **UEMS-Agent-Utils is mandatory** — all repos must route through UEMS-Agent-Utils for networking, logging, file I/O, secure storage, and process execution. Never call platform APIs directly.
2. **cmickey_utils is legacy** — provides XML parsing and legacy logger (being replaced by the UEMS-Agent-Utils logging wrapper). Still widely depended on, but **do not use for new code**. Changes ripple everywhere; extra caution required.
3. **uems_native_dependencies** — sole Layer 0 foundation; version updates affect all repos. Coordinate carefully.
4. **ME-Agent-Framework** — Layer 2 external dependency from the me-agent organization; changes require cross-team coordination.
5. **ME-One-Agent** — Layer 5 external dependency; UEMS-DS and UEMS-Agent-Internal depend on it. Changes require cross-team coordination.
6. **UEMS-Agent-Framework ↔ VMDR-Agent** — cross-layer dependency: Layer 4 depends on a feature-layer repo; changes to VMDR-Agent can impact the agent framework.
7. **UEMS-Agent-Driver** — kernel-mode component under `uems/native/drivers/`; requires driver signing, thorough testing, and WHQL certification consideration.
8. **New repos** must declare dependencies explicitly and follow the UEMS-Agent-Utils mandate.

## Cross-Repo Change Rules

- **Layer 0 changes** (cmickey_utils, uems_native_dependencies) → impact ALL repos. Require full cross-repo testing.
- **Layer 2 changes** (ME-Agent-Framework) → impact UEMS-Agent-Utils, UEMS-Agent-Framework, ME-One-Agent, and all feature repos. External dependency; coordinate with the me-agent team.
- **Layer 3 changes** (UEMS-Agent-Utils) → impact UEMS-Agent-Framework and all feature repos. Verify wrapper contracts are preserved.
- **Layer 4 changes** (UEMS-Agent-Framework) → impact VMDR-Quarantine-Compliance, UEMS-DS, and UEMS-Windows-Agent-Setup.
- **Layer 5 changes** (ME-One-Agent) → impact UEMS-DS, UEMS-Agent-Internal, and UEMS-Windows-Agent-Setup. External dependency; coordinate with the me-agent team.
- **Feature repo changes** → usually isolated. Verify UEMS-Windows-Agent-Setup integration.
- **VMDR-Agent changes** → also impacts UEMS-Agent-Framework (Layer 4) due to the cross-layer dependency.
