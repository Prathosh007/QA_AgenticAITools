<!-- audience: both -->
<!-- doc-type: reference -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Documentation

> 🎯 **Audience:** AI agents and human developers
> **Scope:** All projects
> **Read when:** Starting any task — this is the top-level documentation index.

Single index for all AI-navigable documentation in the uems-ai-toolkit repository.

## Quick Links by Topic

| Topic | File |
|-------|------|
| File locations by task | [`ai-agents/CODEBASE_MAP.md`](ai-agents/CODEBASE_MAP.md) |
| Domain & platform terms | [`ai-agents/GLOSSARY.md`](ai-agents/GLOSSARY.md) |
| How to build & test | [`ai-agents/BUILD_GUIDE.md`](ai-agents/BUILD_GUIDE.md) |
| Common task walkthroughs | [`ai-agents/AGENT_GUIDE.md`](ai-agents/AGENT_GUIDE.md) |
| Repo-level architecture | [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) |
| uems-agent-chat architecture | [`architecture/uems-agent-chat/ARCHITECTURE.md`](architecture/uems-agent-chat/ARCHITECTURE.md) |
| uems-agent-web architecture | [`architecture/uems-agent-web/ARCHITECTURE.md`](architecture/uems-agent-web/ARCHITECTURE.md) |
| uems-agent-chat workflows | [`architecture/uems-agent-chat/WORKFLOWS.md`](architecture/uems-agent-chat/WORKFLOWS.md) |
| uems-agent-web workflows | [`architecture/uems-agent-web/WORKFLOWS.md`](architecture/uems-agent-web/WORKFLOWS.md) |
| Coding conventions | [`development/CONVENTIONS.md`](development/CONVENTIONS.md) |
| Doc update protocol | [`ai-agents/DOC_UPDATE_PROTOCOL.md`](ai-agents/DOC_UPDATE_PROTOCOL.md) |

## Directory Structure

```
docs/
├── README.md                        ← You are here
├── ai-agents/                       ← Layers 1–3: Navigation, lookup, task guides
│   ├── README.md
│   ├── CODEBASE_MAP.md
│   ├── GLOSSARY.md
│   ├── BUILD_GUIDE.md
│   ├── AGENT_GUIDE.md
│   ├── DOC_TEMPLATE.md
│   └── DOC_UPDATE_PROTOCOL.md
├── architecture/                    ← Layer 4: Deep reference
│   ├── README.md
│   ├── ARCHITECTURE.md              ← Repo-level project inventory
│   ├── uems-agent-chat/
│   │   ├── ARCHITECTURE.md
│   │   └── WORKFLOWS.md
│   └── uems-agent-web/
│       ├── ARCHITECTURE.md
│       └── WORKFLOWS.md
└── development/                     ← Coding standards
    ├── README.md
    └── CONVENTIONS.md
```

## Reading Order

| # | File | Type | Read when |
|---|------|------|-----------|
| 1 | [`ai-agents/CODEBASE_MAP.md`](ai-agents/CODEBASE_MAP.md) | reference | Every task |
| 2 | [`ai-agents/GLOSSARY.md`](ai-agents/GLOSSARY.md) | reference | Unfamiliar term |
| 3 | [`ai-agents/BUILD_GUIDE.md`](ai-agents/BUILD_GUIDE.md) | guide | Need to build or test |
| 4 | [`ai-agents/AGENT_GUIDE.md`](ai-agents/AGENT_GUIDE.md) | guide | Need code examples |
| 5 | [`architecture/{project}/ARCHITECTURE.md`](architecture/) | reference | Deep-dive into a project |
| 5a| [`architecture/{project}/WORKFLOWS.md`](architecture/) | workflow | Debugging/extending complex flows |

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Auto-loaded project summary | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) |
| Agent definitions | [`agents/`](../agents/) directory |
| Engineering guidelines | [`guidelines/`](../guidelines/) directory |
| Reusable skills | [`skills/`](../skills/) directory |

---

*Last Updated: 2026-04-08*
