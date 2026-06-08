# Security Standards (OWASP-Aligned)

> Shared security principles across all platforms. All guidelines use **C-** prefixed IDs for traceability.
>
> Applied during planning, development, and review. Platform-specific enforcement details are in the platform security files (`linux/platform-security.md`, `mac/platform-security.md`, `windows/platform-security.md`).

**References:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)

---

## 1. Input Validation & Injection Resistance (OWASP A03)

- **C-INPUT-01**: Validate **all** external inputs: CLI args, config, server-driven commands, file contents, IPC messages, network data.
- **C-INPUT-02**: Validate type, range, and format for every input.
- **C-INPUT-03**: Use **allowlists** over denylists.
- **C-INPUT-04**: Escape/sanitize before use in commands, queries, or templates.
- **C-INPUT-05**: Reject unexpected input early — fail fast at system boundaries.
- **C-INPUT-06**: Never trust data from external sources without validation.

## 2. Authentication & Authorization (OWASP A01)

- **C-AUTH-01**: Verify caller identity at privilege boundaries.
- **C-AUTH-02**: Enforce least privilege for all operations.
- **C-AUTH-03**: Check entitlements/permissions before sensitive operations.
- **C-AUTH-04**: Audit authorization failures.
- **C-AUTH-05**: IPC channels MUST verify caller identity and enforce authorization.
- **C-AUTH-06**: Define clear trust boundaries between agent components.

## 3. Secrets Management (OWASP A02)

- **C-SECRET-01**: **Never log secrets** (tokens, keys, passwords, PII) at any log level.
- **C-SECRET-02**: Use platform-appropriate secure storage (Keychain / DPAPI / encrypted files).
- **C-SECRET-03**: No hard-coded credentials anywhere.
- **C-SECRET-04**: Clear secrets from memory after use.
- **C-SECRET-05**: No plaintext secrets in preferences, config files, or logs.
- **C-SECRET-06**: Rotate secrets on schedule.

## 4. Cryptography (OWASP A02)

- **C-CRYPTO-01**: Use vetted platform APIs — no custom crypto implementations.
- **C-CRYPTO-02**: Use cryptographically secure random number generators for all security-sensitive values.
- **C-CRYPTO-03**: Follow key management best practices (generation, storage, rotation, destruction).
- **C-CRYPTO-04**: Avoid deprecated algorithms (MD5, SHA-1 for security, DES, RC4).
- **C-CRYPTO-05**: Document crypto choices and their justification.

## 5. Transport Security (OWASP A02)

- **C-TLS-01**: Use TLS 1.2+ for all network communication.
- **C-TLS-02**: Validate certificates properly — never skip verification.
- **C-TLS-03**: Implement certificate pinning where required.
- **C-TLS-04**: Handle certificate errors securely — fail closed.
- **C-TLS-05**: No fallback to insecure protocols.

## 6. Error Handling & Logging (OWASP A09)

- **C-LOG-01**: No sensitive data leakage in error messages.
- **C-LOG-02**: PII redaction strategy for all log output.
- **C-LOG-03**: Don't expose internal implementation details in errors sent to untrusted surfaces.
- **C-LOG-04**: Log security-relevant events (auth failures, input validation failures, privilege changes).
- **C-LOG-05**: Use structured logging with appropriate levels.

## 7. Command Execution Safety (OWASP A03)

- **C-EXEC-01**: Use **full paths** for all executables — never rely on `PATH`.
- **C-EXEC-02**: Use argument arrays — no shell string interpolation.
- **C-EXEC-03**: Maintain command allowlists.
- **C-EXEC-04**: Verify signatures before executing child processes.
- **C-EXEC-05**: Validate and sanitize all command arguments.

## 8. File Operations (OWASP A01)

- **C-FILE-01**: Prevent path traversal — validate and canonicalize paths.
- **C-FILE-02**: Set secure file permissions (principle of least privilege).
- **C-FILE-03**: Create temp files securely (exclusive creation, secure location).
- **C-FILE-04**: Avoid symlink attacks — use `O_NOFOLLOW` or equivalent.
- **C-FILE-05**: Validate file contents before processing.

## 9. Supply Chain & Integrity (OWASP A08)

- **C-INTEG-01**: Code signature verification for all binaries.
- **C-INTEG-02**: Notarization/distribution signing as required by platform.
- **C-INTEG-03**: Verify integrity of downloaded updates/components.
- **C-INTEG-04**: Pin dependency versions.

## 10. Privilege Management (OWASP A04)

- **C-PRIV-01**: Drop privileges when not needed.
- **C-PRIV-02**: Use minimal required entitlements/capabilities.
- **C-PRIV-03**: Validate privilege boundaries.
- **C-PRIV-04**: Audit privilege escalation paths.
- **C-PRIV-05**: Implement privilege separation via IPC where possible.
- **C-PRIV-06**: Never run with elevated privileges longer than necessary.

---

## Security Checklist for New Code

Use this checklist when adding new features or modifying existing code. Platform-specific enforcement details are in the platform security files.

### Input & Validation

| # | Check | Rule |
|---|-------|------|
| 1 | All external inputs validated (CLI, server, IPC, config) | C-INPUT-01 |
| 2 | File paths canonicalized and bounded to expected directories | C-FILE-01 |
| 3 | Numeric inputs bounds-checked | C-INPUT-02 |
| 4 | No shell string concatenation for command execution | C-EXEC-02 |
| 5 | Server-downloaded data size-limited | C-INPUT-05 |

### Cryptography & Secrets

| # | Check | Rule |
|---|-------|------|
| 6 | Cryptographically secure randomness used for security values | C-CRYPTO-02 |
| 7 | Secrets zeroed from memory after use | C-SECRET-04 |
| 8 | No secrets in log output | C-SECRET-01, C-LOG-01 |
| 9 | Encrypted storage for sensitive config values | C-SECRET-02 |
| 10 | TLS verification enabled, minimum version TLS 1.2 | C-TLS-01, C-TLS-02 |

### File System

| # | Check | Rule |
|---|-------|------|
| 11 | File permissions explicitly set (not relying on umask) | C-FILE-02 |
| 12 | Symlink attacks considered for file writes | C-FILE-04 |
| 13 | Temporary files use secure creation APIs | C-FILE-03 |
| 14 | No world-writable files or directories | C-FILE-02 |

### Process Execution

| # | Check | Rule |
|---|-------|------|
| 15 | Executables verified before execution (signature/checksum) | C-INTEG-01 |
| 16 | External commands use absolute paths | C-EXEC-01 |
| 17 | Timeouts set for external commands | C-EXEC-05 |

### Concurrency

| # | Check | Rule |
|---|-------|------|
| 18 | All concurrent operations have bounded lifetimes | — |
| 19 | Shared state protected by synchronization primitives | — |

### Network

| # | Check | Rule |
|---|-------|------|
| 20 | HTTP response status codes validated | C-TLS-01 |
| 21 | Response bodies closed properly | — |
| 22 | Download sizes bounded | C-INPUT-05 |

### Error Handling

| # | Check | Rule |
|---|-------|------|
| 23 | No secrets in error messages | C-LOG-01 |
| 24 | Predefined error codes used for external communication | C-LOG-03 |
| 25 | Cleanup in defer/finally blocks before exit | — |

---

## OWASP Top 10 Mapping

| OWASP Category | Relevant Rules |
|---------------|----------------|
| A01:2021 Broken Access Control | C-AUTH-*, C-FILE-*, C-PRIV-* |
| A02:2021 Cryptographic Failures | C-SECRET-*, C-CRYPTO-*, C-TLS-* |
| A03:2021 Injection | C-INPUT-*, C-EXEC-* |
| A04:2021 Insecure Design | C-AUTH-06 (trust boundaries), defense in depth |
| A05:2021 Security Misconfiguration | C-FILE-*, C-PRIV-* |
| A06:2021 Vulnerable Components | C-INTEG-* |
| A07:2021 Auth Failures | C-AUTH-*, C-TLS-* |
| A08:2021 Data Integrity Failures | C-INTEG-*, C-FILE-* |
| A09:2021 Logging Failures | C-LOG-* |
| A10:2021 SSRF | C-INPUT-*, C-TLS-* |

---

## Guideline Reference Index

| Prefix | Section | Count |
|--------|---------|-------|
| C-INPUT | Input Validation | 6 |
| C-AUTH | Authentication & Authorization | 6 |
| C-SECRET | Secrets Management | 6 |
| C-CRYPTO | Cryptography | 5 |
| C-TLS | Transport Security | 5 |
| C-LOG | Error Handling & Logging | 5 |
| C-EXEC | Command Execution Safety | 5 |
| C-FILE | File Operations | 5 |
| C-INTEG | Supply Chain & Integrity | 4 |
| C-PRIV | Privilege Management | 6 |
| **Total** | | **53** |
