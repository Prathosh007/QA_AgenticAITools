<!-- audience: ai-agents -->
<!-- doc-type: template -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Documentation Template

> 🎯 **Audience:** AI agents
> **Scope:** All projects
> **Read when:** Creating or auditing any documentation file.

Format standard, header block, section skeletons, and conformance checklist for all docs in this repository.

---

## 1. Standard Header Block

Every doc must open with:

```markdown
<!-- audience: {ai-agents | both | humans-only} -->
<!-- doc-type: {reference | guide | decision | log | workflow | template} -->
<!-- project: {project-name | repo-wide | shared} -->
<!-- last-updated: YYYY-MM-DD -->

# {Title}

> 🎯 **Audience:** {description}
> **Scope:** {project or "All projects"}
> **{Skip if | Read when}:** {condition}

{One-sentence purpose statement — functional, not a greeting.}
```

## 2. Section Skeletons

| Doc Type | Skeleton |
|----------|----------|
| **Reference** | Header → Primary lookup table → Secondary sections → Related Docs → Footer date |
| **Guide** | Header → Prerequisites → Numbered steps → Verification checklist → Related Docs → Footer date |
| **Workflow** | Header → TOC → Per-workflow sections (numbered, with ASCII flow diagrams) → Cross-cutting → Related Docs → Footer date |
| **Template** | Header → Rules → Examples → Checklist → Related Docs → Footer date |

## 3. Naming

| Type | Convention | Example |
|------|-----------|---------|
| Core doc | `SCREAMING_SNAKE_CASE.md` | `CODEBASE_MAP.md` |
| Feature architecture | `{FEATURE}_ARCHITECTURE.md` | `SYNC_ARCHITECTURE.md` |
| Workflow hub | `WORKFLOWS.md` | `WORKFLOWS.md` |
| Sub-workflow | `{subsystem}-workflow.md` | `sync-workflow.md` |
| Index | `README.md` | One per directory |

## 4. Cross-References

- Every doc must have a `## Related Docs` table at the bottom
- Use relative paths from the current file
- Phrase left column as: "If you need..."
- Keep under 10 rows

## 5. Size Limits

| Doc Type | Target | Hard Limit |
|----------|--------|------------|
| Guide | <300 lines | 400 lines |
| Reference | <400 lines | 500 lines |
| Workflow | <500 lines | 600 lines |
| Entry point | 200–500 lines | 600 lines |

## 6. Conformance Checklist

Run after creating or editing any doc:

- [ ] Lines 1–3: `<!-- audience -->`, `<!-- doc-type -->`, `<!-- last-updated -->`
- [ ] Blank line before `#` heading
- [ ] `> 🎯 **Audience:**` line present
- [ ] Read-signal line present (`Skip if` or `Read when`)
- [ ] Purpose statement present (functional, not greeting)
- [ ] `## Related Docs` section at bottom
- [ ] Footer date matches `<!-- last-updated -->` tag
- [ ] No duplicated content (linked instead)
- [ ] Under the line limit
- [ ] Language specified for all code fences

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| When/what to update after code changes | [`DOC_UPDATE_PROTOCOL.md`](DOC_UPDATE_PROTOCOL.md) |
| File locations for any task | [`CODEBASE_MAP.md`](CODEBASE_MAP.md) |

---

*Last Updated: 2026-04-08*
