# Architecture Documentation Generation Plan — Native App Edition

> **Purpose:** Blueprint for building an AI-navigable documentation ecosystem for **native application repositories** — targeting C, C++, Objective-C, Swift, and Go codebases (no server/web frontend).
>
> **This is the index file.** The plan has been split into three focused documents to stay within AI agent context limits. Read the file relevant to your current need.

---

## The Three Plan Files

| # | File | Purpose | Read when... |
|---|------|---------|-------------|
| 1 | **[Doc System Blueprint](SYSTEM_BLUEPRINT.md)** | *What* to create, *where* to put it, *when* | Setting up the doc system, understanding folder structure, following the rollout plan |
| 2 | **[Doc Format Standard](FORMAT_STANDARD.md)** | *How* each doc should look | Creating/editing any doc — headers, templates, cross-refs, naming, size limits, update rules |
| 3 | **[Agent Behavior Rules](AGENT_BEHAVIOR_RULES.md)** | *How* the AI agent reads, verifies, avoids hallucination | Every coding session — grounding laws, reading protocol, verification |

---

## Quick Reference: What's Where

| Topic | File |
|-------|------|
| Core principles & design maxims | [Blueprint](SYSTEM_BLUEPRINT.md) §1 |
| Documentation layers (0–4) | [Blueprint](SYSTEM_BLUEPRINT.md) §2 |
| Folder structure (multi-project) | [Blueprint](SYSTEM_BLUEPRINT.md) §3 |
| ⛔ Project identification (repo ≠ project) | [Blueprint](SYSTEM_BLUEPRINT.md) §3 (Project Identification) |
| Document catalog (what to create) | [Blueprint](SYSTEM_BLUEPRINT.md) §4 |
| Rollout plan (phases 0–7) | [Blueprint](SYSTEM_BLUEPRINT.md) §5 |
| System verification checklist | [Blueprint](SYSTEM_BLUEPRINT.md) §6 |
| Quick start checklist | [Blueprint](SYSTEM_BLUEPRINT.md) §7 |
| Standard header block & tags | [Format](FORMAT_STANDARD.md) §1 |
| Section skeletons by doc type | [Format](FORMAT_STANDARD.md) §2 |
| Cross-referencing methodology | [Format](FORMAT_STANDARD.md) §3 |
| Naming & indexing conventions | [Format](FORMAT_STANDARD.md) §4 |
| AI-navigation techniques | [Format](FORMAT_STANDARD.md) §5 |
| Entry point design & template | [Format](FORMAT_STANDARD.md) §6 + Appendix A |
| Content patterns per doc type | [Format](FORMAT_STANDARD.md) §7 |
| Workflow doc format & template | [Format](FORMAT_STANDARD.md) §7.5 |
| Sub-workflow splitting pattern | [Format](FORMAT_STANDARD.md) §7.5 + §9.2 |
| Data schema / config file docs | [Format](FORMAT_STANDARD.md) §7.10 |
| Log file documentation | [Format](FORMAT_STANDARD.md) §7.11 |
| Diff-based update discovery | [Format](FORMAT_STANDARD.md) §8.0 |
| Doc update protocol | [Format](FORMAT_STANDARD.md) §8 |
| Size limits & split rules | [Format](FORMAT_STANDARD.md) §9 |
| Native architecture adaptation | [Format](FORMAT_STANDARD.md) §10 |
| Anti-hallucination & grounding | [Agent Rules](AGENT_BEHAVIOR_RULES.md) §1 |
| Forbidden assumptions (incl. repo ≠ project) | [Agent Rules](AGENT_BEHAVIOR_RULES.md) §1.1 |
| Pre/post-edit verification | [Agent Rules](AGENT_BEHAVIOR_RULES.md) §1.3–§1.4 |
| Workspace dependency discovery | [Agent Rules](AGENT_BEHAVIOR_RULES.md) §2.0 |
| Reading protocol (task→action) | [Agent Rules](AGENT_BEHAVIOR_RULES.md) §2 |
| When to create workflow docs | [Blueprint](SYSTEM_BLUEPRINT.md) §5 Phase 2 |
| Per-doc verification & smoke test | [Agent Rules](AGENT_BEHAVIOR_RULES.md) §3 |
| Generic vs native comparison | [Agent Rules](AGENT_BEHAVIOR_RULES.md) Appendix C |

---

## How to Use This Plan

1. **First-time setup:** Read all three files in order (Blueprint → Format → Agent Rules), then follow the Quick Start Checklist in [Blueprint §7](SYSTEM_BLUEPRINT.md).
2. **Creating a new doc:** Open [Format Standard](FORMAT_STANDARD.md) — use the header block (§1), skeleton (§2), and conformance checklist (§9.6).
3. **Starting a coding task:** Follow the Reading Protocol in [Agent Rules §2](AGENT_BEHAVIOR_RULES.md). For complex subsystem work, also read the project's WORKFLOWS.md.
4. **Creating a workflow doc:** Use the WORKFLOWS.md template and content pattern in [Format Standard §7.5](FORMAT_STANDARD.md). See the trigger checklist in [Blueprint §5 Phase 2](SYSTEM_BLUEPRINT.md).
5. **Auditing the system:** Run the System Verification Checklist in [Blueprint §6](SYSTEM_BLUEPRINT.md) + Smoke Test in [Agent Rules §3.2](AGENT_BEHAVIOR_RULES.md).

---

*Last Updated: 2026-04-10*
