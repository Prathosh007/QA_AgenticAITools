# Linux Repository Map

> Repo structure, dependencies, and URLs are available via tools (`#uems_agent_dependency_graph`, `#uems_agent_search_repos`).
> This file contains **rules and guidelines only** — things tools can't express.

---

## Mandatory Rules

1. **dcutils is mandatory** — all repos must route through dcutils for logging, networking, file I/O, secure storage, encryption, error handling, and process execution. Never call system APIs directly when a dcutils wrapper exists.
2. **uems_native_dependencies** — version updates here affect all repos. All third-party libraries are vendored as archives and extracted at build time. Coordinate version bumps carefully across the full dependency chain.
3. **uems_go_components** — built separately with Go toolchain. Interfaces with the Linux agent via IPC/files, not direct linking. Separate build pipeline.
4. **Monorepo discipline** — dc_native is a single repo containing agents for multiple platforms, organized by package. Keep packages focused and maintain clean dependency boundaries between internal packages.
5. **New packages** must use dcutils, follow the `dc` prefix naming convention, and integrate with the existing GOPATH-based build system.

## Cross-Repo Change Rules

- **Layer 0 changes** (uems_native_dependencies) → Impact all repos. Require full regression testing.
- **dcutils changes** → Impact all other packages across all platforms within dc_native. Verify wrapper contracts are preserved. Run full test suite.
- **Feature package changes** (linux_agent modules) → Usually isolated to the Linux agent. Verify unit tests pass.
- **uems_go_components changes** → Cross-platform impact. Coordinate with Mac and Windows teams.
