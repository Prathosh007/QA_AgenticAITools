# Git Conventions

> Shared across all platforms. Applied during environment setup, development, and review.

---

## Tag Convention

**Format:** `<PRODUCT_NAME>_<YY>.<MM>.<WW>`

| Component | Format | Example |
|---|---|---|
| Product name | UPPERCASE, underscores | `UEMS_MAC_AGENT_UTILS` |
| Year | 2-digit | `26` |
| Month | 2-digit, zero-padded | `05` |
| Week | 2-digit, zero-padded | `01` |

**Valid examples:**
- `UEMS_MAC_AGENT_UTILS_26.05.01`
- `UEMS_MAC_PATCH_MANAGEMENT_26.03.02`
- `UEMS_LINUX_AGENT_26.01.04`

**Validation regex:** `^[A-Z][A-Z0-9_]+_\d{2}\.\d{2}\.\d{2}$`

**Rules:**
- Always validate tag format before branching from it
- If tag is invalid, report the expected format with examples and ask the user for correction
- If tag does not exist in the repo, run `git tag -l "<pattern>"` to list similar tags and show closest matches

---

## Branch Naming Convention

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<topic>` | `feature/remote-shell-support` |
| Bugfix | `bugfix/<topic>` | `bugfix/xpc-connection-leak` |
| Hotfix | `hotfix/<topic>` | `hotfix/crash-on-upgrade` |
| Refactor | `refactor/<topic>` | `refactor/logging-migration` |

**Rules:**
- `<topic>` must be lowercase, hyphen-separated, descriptive (no spaces, no uppercase)
- Validation regex: `^(feature|bugfix|hotfix|refactor)/[a-z0-9][a-z0-9-]{2,50}$`
- If the user provides a branch name that doesn't match, suggest a corrected name and confirm
- For multi-repo tasks, use the **same branch name** across all affected repos

---

## Commit Message Convention

**Format:**
```
<type>(<scope>): <short summary>

<body — optional>

<footer — optional>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `security` | Security fix or hardening |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build, config, or tooling changes |

### Scope

The affected module, component, or repo (e.g., `xpc`, `networking`, `patch-mgmt`, `agent-utils`).

### Rules

- **Short summary**: Imperative mood, lowercase, no period, max 72 characters
- **Body** (optional): Explain *what* and *why*, not *how*. Wrap at 80 characters.
- **Footer** (optional): Reference issue/ticket IDs, note breaking changes.
- **Multi-repo changes**: Each repo gets its own commit with the same type and summary, scoped to that repo's changes.
- **Never commit secrets, credentials, or sensitive data** — even in commit messages.

### Examples

```
feat(patch-mgmt): add retry logic for failed patch downloads

Retries up to 3 times with exponential backoff when the server
returns a transient error (5xx). Uses Agent-Utils networking wrapper.

Ref: UEMS-4521
```

```
fix(xpc): prevent connection leak on service timeout
```

```
security(agent-utils): sanitize file paths before archive extraction

Prevents path traversal (OWASP A01) when extracting server-provided
archives. Rejects paths containing ".." or absolute paths.
```

```
refactor(inventory): migrate logging to Agent-Utils wrapper
```

```
test(patch-mgmt): add unit tests for download retry logic
```
