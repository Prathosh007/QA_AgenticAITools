# Linux Platform Security

> Linux-specific security controls for UEMS Linux Agent (Go). All guidelines use **G-** prefixed IDs for traceability.
>
> **Shared standards** (OWASP mapping, input validation, secrets management, privilege management principles) are in [`common/security-standards.md`](../common/security-standards.md). This file covers **Linux-specific** enforcement details.

---

## 1. Authentication & Authorization

- **G-AUTH-01**: Auth tokens MUST be re-requested when the token file is missing or corrupted. Never cache tokens in memory beyond a single request cycle.
- **G-AUTH-02**: Approval tokens MUST be decrypted using the master key utility (discover from workspace) — never store decrypted tokens on disk.
- **G-AUTH-03**: Resource ID changes MUST trigger re-validation with the server.
- **G-AUTH-04**: Empty or missing Resource ID / Customer ID MUST trigger re-initialization — never proceed with empty identifiers.

### Uninstall Protection

- **G-AUTH-05**: TOTP verification MUST have limited retry attempts (max 3). Never allow unlimited attempts.
- **G-AUTH-06**: Passphrase-based uninstall verification MUST be time-bound — validated against a server-issued timestamp.
- **G-AUTH-07**: IPC pipes used for TOTP transfer MUST be cleaned up after verification, including on failure paths.
- **G-AUTH-08**: Agent security settings (uninstall restriction level) MUST be loaded from the configuration file — never hardcoded to a permissive default.

---

## 2. Cryptography & Key Management

### Encryption Methods

| Method | Usage |
|--------|-------|
| **AES (CBC/GCM)** | Encrypt/decrypt data with salt key |
| **Install-time salt** | Message encryption, state tracking |
| **Master key** | Auth token decryption — loaded into protected memory |
| **GPG (OpenPGP)** | Upgrader binary decryption |
| **SHA-256 / MD5** | File checksum verification |
| **TOTP** | Time-based one-time passwords for uninstall protection |

### Guidelines

- **G-CRYPTO-01**: Use `crypto/rand` for ALL security-sensitive random number generation. `math/rand` is **forbidden** for keys, tokens, nonces, salts, and any security context. `math/rand` is acceptable only for non-security jitter (e.g., reconnect delay).
- **G-CRYPTO-02**: AES encryption MUST use unique IVs per encryption operation.
- **G-CRYPTO-03**: Master key MUST be loaded into protected memory (allocate, lock, protect) and freed after use. Never log or write master key to disk.
- **G-CRYPTO-04**: GPG private keys MUST have file permission `0600` and be owned by root.
- **G-CRYPTO-05**: MD5 MUST NOT be used as the sole integrity check for security-critical binaries. Prefer SHA-256. MD5 is acceptable only for non-security diff detection.
- **G-CRYPTO-06**: Passwords stored on disk MUST be AES-encrypted — never Base64-only or plaintext.
- **G-CRYPTO-07**: Install-time salt is a shared secret — if compromised, all dependent encryption is broken. Ensure the file storing it has `0600` permissions and consider periodic salt rotation.

### Certificate Management

| Certificate Type | Purpose |
|-----------------|---------|
| Root CA (self-signed/third-party/enterprise) | Server identity verification |
| Cloud Root CA | Cloud server verification |
| Client certificate (CSR-generated) | Mutual TLS authentication |
| OS subscription certificates | Package repository access (e.g., RHEL) |

- **G-CERT-01**: Certificate files MUST have permission `0600`, owned by root.
- **G-CERT-02**: Certificate roots MUST be initialized before server connection setup to prevent x509 verification errors.
- **G-CERT-03**: Certificate renewal MUST be checked at every refresh cycle.
- **G-CERT-04**: Never set `InsecureSkipVerify: true` in production TLS configurations.
- **G-CERT-05**: Certificate error codes MUST be reported to the server for admin visibility.

---

## 3. Transport Security (TLS/SSL)

### Connection Types

| Connection | Protocol | TLS | Client Auth |
|-----------|----------|-----|-------------|
| HTTP to server | HTTPS | Yes (root CA pool) | Auth token in header |
| HTTP to distribution server | HTTPS | Yes (root CA pool) | DS auth token |
| Notification channel (NS) | TCP + TLS wrap | TLS 1.2 | Optional client cert |
| Cloud WebSocket (DMS) | WSS | Yes (root CA pool) | Approval key |
| Proxy tunneling | HTTP CONNECT → TLS | Yes | Basic auth |

### Guidelines

- **G-TLS-01**: Minimum TLS version MUST be `tls.VersionTLS12`. Do NOT allow TLS 1.0 or 1.1.
- **G-TLS-02**: TLS cipher suites MUST exclude weak ciphers (RC4, 3DES, NULL). Use Go's default secure cipher suite selection unless there's a specific compatibility need.
- **G-TLS-03**: Server certificate verification MUST NOT be skipped (`InsecureSkipVerify` must be `false`).
- **G-TLS-04**: Root CA certificates MUST be loaded from the agent's trusted certificate files, not from the system's default pool alone.
- **G-TLS-05**: Proxy credentials MUST be transmitted only over TLS-encrypted tunnels.
- **G-TLS-06**: WebSocket connections MUST use `wss://` scheme only, never `ws://`.
- **G-TLS-07**: Sensitive parameters in connection URLs (keys, tokens) MUST NOT be logged in plaintext or exposed in process lists. Consider moving sensitive parameters to headers.

### Server Failover Security

- **G-TLS-08**: All failover server addresses MUST be validated against the same root CA. A compromised secondary address must not bypass TLS verification.
- **G-TLS-09**: Server address changes (migration detection) MUST trigger re-authentication.

---

## 4. Input Validation & Injection Prevention

> See also: [`common/security-standards.md` §1](../common/security-standards.md) for shared input validation principles (C-INPUT-*).

### Command Injection Vectors

| Input Source | Risk Level | Notes |
|-------------|------------|-------|
| Notification channel parameters | Medium–High | Must be validated before shell use |
| Cloud channel inner messages | High | Must apply same validation as other channels |
| CLI arguments (`os.Args`) | Medium | Minimal validation by default |
| Server-downloaded XML/JSON | Medium | Parsed but may not be deeply validated |
| Server-sent scripts | By Design | Highest-risk feature — governed by collection authorization |

### Guidelines

- **G-INPUT-01**: ALL external inputs passed to `os/exec` commands MUST be validated. Use **allowlist** validation (expected characters only), not blocklist.
- **G-INPUT-02**: Input validation MUST cover all shell metacharacters: `|`, `&`, `;`, `` ` ``, `$`, `(`, `)`, `{`, `}`, `<`, `>`, `\n`, `\r`, `\0`, `"`, `'`, `#`, `!`, `~`, `*`, `?`, `[`, `]`. A blocklist of just `[|&;\x60]` is insufficient.
- **G-INPUT-03**: All remote command channels MUST apply equal input validation. Server-side validation alone is insufficient (defense in depth).
- **G-INPUT-04**: File paths received from the server MUST be canonicalized (`filepath.Clean()` + `filepath.EvalSymlinks()`) and validated to be within expected directories. Prevent path traversal (`../`).
- **G-INPUT-05**: XML/JSON parsing MUST set size limits to prevent XML bomb / JSON decompression attacks.
- **G-INPUT-06**: All numeric inputs from server (port numbers, timeouts, IDs) MUST be bounds-checked after parsing.
- **G-INPUT-07**: Use `os/exec.Command(name, args...)` with argument arrays. NEVER concatenate strings into shell commands. Maintain this pattern for all command execution wrappers.
- **G-INPUT-08**: Configuration file names received from server MUST be validated against an allowlist of known names.

### Script Execution (Server-Sent Scripts)

Server-sent script execution is by design the highest-risk feature.

- **G-INPUT-09**: Script execution MUST be governed by collection-level authorization (valid collection ID, valid config ID, authenticated server source).
- **G-INPUT-10**: Script output MUST be size-limited before upload to prevent memory exhaustion.
- **G-INPUT-11**: Script exit codes MUST be validated against expected ranges.
- **G-INPUT-12**: Script execution timeout MUST be enforced to prevent runaway processes.

---

## 5. File System Security

### File Permission Model

| File Category | Required Permission | Rationale |
|--------------|-------------------|-----------|
| Agent binaries | `0700` | Execute only by root |
| Configuration files (JSON/XML) | `0600` | Read/write only by root |
| Log files | `0600` | Read/write only by root |
| GPG private keys | `0600` | Sensitive key material |
| Auth / approval token files | `0600` | Authentication tokens |
| Named pipes (IPC callback files) | `0622` | Root write, others read |
| Native UI handler binary | `0755` | Needs execution by display user |
| User service binary | `0755` | Executed by user service |
| Removal / maintenance scripts | `0700` | Execute only by root |

### Guidelines

- **G-FILE-01**: Every file creation MUST explicitly set permissions. Never rely on umask alone. Use the permission-aware file write utility (discover from workspace) for sensitive files.
- **G-FILE-02**: Agent directory MUST NOT be world-writable. Verify parent directory permissions during installation.
- **G-FILE-03**: Temporary files MUST be created using `os.CreateTemp()` or in a directory with `0700` permissions. Never use predictable names in `/tmp/`.
- **G-FILE-04**: Symlink attacks: Before writing to a file, verify it is not a symlink to a sensitive system file. Use `os.Lstat()` to check file type before `os.Open()`.
- **G-FILE-05**: Lock files MUST be cleaned up on process exit (via `defer`). Stale lock files MUST have a timeout/override mechanism.
- **G-FILE-06**: Log rotation MUST NOT create world-readable log files. Rotated logs inherit parent permissions.
- **G-FILE-07**: Operations that remove immutable file attributes (e.g., `chattr -i`) MUST only be performed on files within the agent directory. Validate the path before removing immutable attributes.
- **G-FILE-08**: User-accessible directories MUST have permissions fixed (`0700` for directory, `0600` for files) — apply consistently across all such directories.

### File Integrity

| Mechanism | Usage |
|-----------|-------|
| SHA-256 checksum | Binary verification during upgrade |
| Binary checksums JSON | Downloaded from server, validates all agent binaries |
| GPG signature | Upgrader binary authenticity |

- **G-FILE-09**: Binary integrity MUST be verified before execution via the integrity-check wrapper (discover from workspace). Direct command execution SHOULD only be used for OS system utilities.
- **G-FILE-10**: The binary checksums file MUST be downloaded fresh before each upgrade.
- **G-FILE-11**: Checksum verification SHOULD NOT be skippable via configuration flags. If a bypass exists for development, it MUST be restricted to development builds only.

---

## 6. Process Execution Security

### Command Execution Patterns

| Pattern | Security Level |
|---------|---------------|
| With integrity check | **Recommended** — validates binary hash before execution |
| Direct execution | Acceptable for OS system utilities only |
| Background execution | Same as direct, but harder to monitor |
| With timeout | Recommended for all external commands |

### Guidelines

- **G-PROC-01**: ALL agent binary executions MUST use the integrity-check wrapper (discover from workspace). Direct execution of agent binaries without hash verification is a security violation.
- **G-PROC-02**: External command execution MUST use absolute paths. Never rely on `PATH` environment variable. Example: `/usr/bin/systemctl` not `systemctl`.
- **G-PROC-03**: Command arguments MUST be passed as separate strings to `exec.Command()`, never concatenated into a single shell string.
- **G-PROC-04**: All external commands SHOULD have a timeout. Unbounded execution can cause agent hangs.
- **G-PROC-05**: Background processes MUST be tracked and killable. Maintain kill functions for each managed binary.
- **G-PROC-06**: Service stop flows MUST kill processes in a defined order to prevent orphaned child processes.
- **G-PROC-07**: When running commands as a specific user, validate the UID/GID before execution.

### CGroup Resource Limiting

- **G-PROC-08**: CGroup CPU limits MUST be applied to all long-running binaries before significant processing begins.
- **G-PROC-09**: CGroup cleanup MUST be in the `defer` block.
- **G-PROC-10**: CGroup limits prevent CPU exhaustion DoS — do NOT remove without an alternative resource limiting mechanism.

---

## 7. Secrets Management

> See also: [`common/security-standards.md` §3](../common/security-standards.md) for shared secrets management principles (C-SECRET-*).

### Secrets Inventory

| Secret Type | Storage Pattern |
|------------|----------------|
| Auth token | Encrypted file on disk |
| Approval token | Encrypted file, decrypted with master key in memory only |
| Master key | Loaded into protected memory, never written to disk |
| Install-time salt | Configuration file (must be `0600`) |
| Proxy password | AES-encrypted in configuration |
| GPG private key | File on disk (`0600`) |
| Cloud auth key | Derived from approval token, memory only |
| Client certificate private key | Generated locally, stored in cert file |

### Guidelines

- **G-SECRET-01**: NEVER log secrets. This includes: auth tokens, master key, proxy passwords (even encrypted), private keys, approval keys, cloud auth keys. Use `NoPrint` variants of file read functions (discover from workspace) for files containing secrets.
- **G-SECRET-02**: Secrets in memory MUST be zeroed after use. For memory allocated with the crypto allocator, use the corresponding free function. For Go strings/slices, overwrite with zeros before releasing.
- **G-SECRET-03**: The master key MUST use protected memory (lock + protect). Current architecture supports this — maintain the pattern.
- **G-SECRET-04**: Connection keys that appear in URLs MUST be masked in all log messages.
- **G-SECRET-05**: Proxy passwords MUST be decrypted only when needed for connection, then zeroed from memory.
- **G-SECRET-06**: The install-time salt stored in configuration is an encryption key for messages and state fields. Ensure the file has `0600` permissions.

---

## 8. Concurrency & Race Condition Safety

> See also: [coding-standards.md §Concurrency](coding-standards.md) for general goroutine patterns. This section covers **security-specific** concurrency concerns.

### Guidelines

- **G-CONC-01**: Every goroutine MUST have a bounded lifetime with a clear exit mechanism (context cancellation, channel signal, or timeout). Unbounded goroutines enable DoS.
- **G-CONC-02**: `WaitGroup.Wait()` MUST have a timeout wrapper to prevent permanent hangs. Use `select` with `time.After` alongside a done channel.
- **G-CONC-03**: Channel operations MUST NOT block indefinitely. Use `select` with `time.After()` or `context.Done()`.
- **G-CONC-04**: Buffered channels for goroutine coordination MUST have capacity matching the goroutine count. If goroutine count changes, update the buffer size.
- **G-CONC-05**: WebSocket write operations MUST acquire the write mutex. Never write to a shared connection without synchronization.
- **G-CONC-06**: File locking is for cross-process synchronization. Within a single process, use `sync.Mutex`. Do not mix mechanisms.
- **G-CONC-07**: Reconnection flags protected by mutex are correct. For simple boolean flags, consider `atomic.StoreInt32` where full mutual exclusion isn't needed.
- **G-CONC-08**: IPC callback handlers that spawn goroutines per message MUST be bounded or use a worker pool to prevent goroutine explosion from rapid callbacks.

---

## 9. Network Communication Security

> See also: [`common/security-standards.md` §5](../common/security-standards.md) for shared transport security principles (C-TLS-*).

### HTTP Communication

- **G-NET-01**: ALL HTTP responses MUST have their status codes validated. Do NOT assume 200 OK.
- **G-NET-02**: Response body MUST be read and closed (`defer resp.Body.Close()`). Unclosed response bodies cause connection leaks.
- **G-NET-03**: Download size MUST be bounded. Use `io.LimitReader()` for file downloads to prevent disk exhaustion.
- **G-NET-04**: HTTP redirects MUST NOT be followed blindly. Limit redirect count and validate redirect targets.
- **G-NET-05**: All server failover attempts MUST use the same TLS verification settings.
- **G-NET-06**: `If-Modified-Since` headers prevent unnecessary downloads but MUST NOT be relied upon for security — always re-validate checksums of security-critical files.

### WebSocket Communication

- **G-NET-07**: WebSocket message size MUST be limited via `conn.SetReadLimit()` to prevent memory exhaustion.
- **G-NET-08**: Liveness verification timeout values MUST NOT be configurable to arbitrarily large values.
- **G-NET-09**: Reconnect exponential backoff MUST be bounded with a maximum cap. Do NOT remove the cap.
- **G-NET-10**: Session IDs MUST be cleared on reconnect.

### TCP Notification Channel

- **G-NET-11**: Fixed-size message buffers — validate message completeness after read. Messages exceeding the buffer are truncated.
- **G-NET-12**: Channel message encryption using install-time salt provides confidentiality but NOT authentication. A compromised salt allows message injection.
- **G-NET-13**: Messages exposing identifiers (resource ID, etc.) MUST only be transmitted over encrypted channels.

---

## 10. Agent Lifecycle Security

### Installation

- **G-LIFE-01**: Settings files created during install MUST have `0600` permissions.
- **G-LIFE-02**: Certificate roots MUST be initialized before server info setup (see G-CERT-02).
- **G-LIFE-03**: File permissions MUST be set explicitly post-install via the permissions utility (discover from workspace).

### Uninstallation

- **G-LIFE-04**: Agent uninstallation MUST always follow the security verification flow. Bypassing the protection check is a critical vulnerability.
- **G-LIFE-05**: Uninstall delay mechanisms (e.g., 7-day waiting period) protect against transient server errors. Do NOT reduce the window without security review.
- **G-LIFE-06**: Imaged/cloned computer handling MUST clear all authentication material (tokens, certificates, resource ID) before re-registering.

### Upgrade

- **G-LIFE-07**: Upgrader binary MUST be verified via checksum AND GPG signature before execution.
- **G-LIFE-08**: The fallback from GPG-encrypted to plain tar reduces security — consider removing the plain tar fallback in future versions.
- **G-LIFE-09**: After upgrade failure, restored configuration files MUST be verified (checksum) to prevent tampering.
- **G-LIFE-10**: Lock file cleanup during upgrade MUST only delete files within the locks directory — validate the path.

---

## 11. Upgrade & Binary Integrity

### Integrity Verification Chain

```
Server → binary-checksums.json (SHA-256 per binary)
       → GPG-encrypted upgrader tar
       → Agent installer binary

Verification:
1. Download binary-checksums.json (force fresh)
2. Download GPG tar → verify checksum → extract → GPG decrypt
3. Download installer → verify checksum against checksums file
4. Execute installer (integrity-check wrapper validates hash)
```

- **G-INTEG-01**: The integrity-check wrapper MUST be used for ALL agent binary executions. It validates the binary hash against the checksums file before `exec`.
- **G-INTEG-02**: The binary checksums file MUST be downloaded over authenticated HTTPS and stored with `0600` permissions.
- **G-INTEG-03**: If the checksums file is corrupt or missing, the agent MUST NOT execute binaries with integrity checking — fail safely.
- **G-INTEG-04**: Checksum type SHOULD be SHA-256. MD5 and SHA-1 are acceptable only for non-security-critical integrity checks (e.g., diff detection).

---

## 12. IPC & Named Pipe Security

### Named Pipe Communication

| Pipe Type | Permission | Direction | Purpose |
|-----------|-----------|-----------|---------|
| Service callback pipe | `0622` | Write → service daemon | Reboot scheduling, process restart, collections, config dequeue |
| TOTP verification pipes | Per-verification | Bidirectional | TOTP code transfer during uninstall verification |
| Config progress pipes | Per-collection | Unidirectional | Deployment progress reporting |

### Guidelines

- **G-IPC-01**: Named pipe permissions MUST follow least privilege. `0622` allows any local user to write — evaluate restricting to `0600` with root-only access if feasible.
- **G-IPC-02**: Messages read from named pipes MUST be validated (JSON schema, expected fields, size limits). Reject unknown request types.
- **G-IPC-03**: Pipe file paths MUST be within the agent directory. Never accept pipe paths from external input.
- **G-IPC-04**: TOTP pipes MUST be cleaned up after use to prevent information leakage.
- **G-IPC-05**: Named pipe reads SHOULD have timeouts to prevent blocking forever on a pipe that's never written to.

### Service Callback Security

- **G-IPC-06**: The callback handler SHOULD validate message sender identity where possible (e.g., check `/proc/<pid>/exe` of the writing process via `SO_PEERCRED`).
- **G-IPC-07**: User ID parameters received via IPC MUST be validated as real system UIDs before creating directories or executing operations.
- **G-IPC-08**: Parameters split from IPC messages (e.g., policy types from whitespace-delimited strings) MUST be validated against known values, not treated as arbitrary strings.

---

## 13. Linux-Specific Hardening

### systemd Security

- **G-LINUX-01**: The systemd unit file SHOULD include security hardening directives. At minimum:
  ```ini
  [Service]
  ProtectSystem=strict
  ProtectHome=yes
  NoNewPrivileges=yes
  PrivateTmp=yes
  ProtectKernelTunables=yes
  ProtectKernelModules=yes
  ProtectControlGroups=yes
  RestrictSUIDSGID=yes
  RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
  ```
- **G-LINUX-02**: SysVInit handler scripts MUST have permission `0755`.
- **G-LINUX-03**: User services running per-user SHOULD NOT have root capabilities.

### Process Information Exposure

- **G-LINUX-04**: Sensitive information (keys, tokens) MUST NOT be passed as command-line arguments visible in `/proc/<pid>/cmdline`. Use environment variables, files, or pipes instead.
- **G-LINUX-05**: Agent log files should not be accessible to non-root users. Verify file permissions are `0600`.

### Package Manager Security

- **G-LINUX-06**: YUM/DNF repo files created by the agent MUST have `gpgcheck=1` enabled where possible.
- **G-LINUX-07**: Custom yum/dnf configuration files MUST NOT disable security features (`gpgcheck`, `sslverify`).
- **G-LINUX-08**: APT source list files MUST be owned by root with `0644` permissions.
- **G-LINUX-09**: Proxy credentials passed to package manager commands MUST NOT be logged in command output.

---

## 14. Logging & Audit Security

> See also: [`common/security-standards.md` §6](../common/security-standards.md) for shared logging principles (C-LOG-*).

- **G-LOG-01**: NEVER log: auth tokens, master keys, proxy passwords (even encrypted), private keys, TOTP codes, approval keys, connection keys. Use `NoPrint` variants (discover from workspace) for sensitive operations.
- **G-LOG-02**: HTTP access logs MUST mask authorization headers, cookie values, and query parameters containing tokens.
- **G-LOG-03**: Log files MUST have `0600` permissions (root-only readable).
- **G-LOG-04**: Log rotation MUST preserve file permissions. New log files inherit parent permissions.
- **G-LOG-05**: Access logs provide an audit trail for compliance — MUST NOT be disabled or truncated except by age-based rotation.
- **G-LOG-06**: Error messages in logs MUST NOT include stack traces that reveal internal implementation details.
- **G-LOG-07**: Log formatting functions SHOULD mask sensitive URL parameters (e.g., `key=***`).

---

## 15. Error Handling & Information Disclosure

> See also: [coding-standards.md §Error Handling](coding-standards.md) for general error handling patterns.

- **G-ERR-01**: Panic recovery MUST log panic details for debugging but MUST NOT expose them to external interfaces.
- **G-ERR-02**: Error messages sent to the server MUST use predefined error codes, not raw error strings that could leak system details.
- **G-ERR-03**: Never expose file system paths, usernames, or system details in error responses beyond what is necessary for diagnostics.
- **G-ERR-04**: HTTP error responses from the server MUST be validated — do not trust error message content from the server for security decisions.
- **G-ERR-05**: `os.Exit()` calls MUST be preceded by cleanup (`defer` blocks for unlock, end logging, etc.).

---

## 16. Dependency & Supply Chain Security

### External Dependencies

- **G-DEP-01**: All external dependencies MUST be pinned to specific versions. Never use floating version references.
- **G-DEP-02**: Run `go mod verify` (or equivalent integrity check) in CI/CD to detect tampered dependencies.
- **G-DEP-03**: Audit external dependencies for known CVEs quarterly. Use `govulncheck` or equivalent.
- **G-DEP-04**: Minimize external dependencies — prefer Go standard library where equivalent functionality exists.
- **G-DEP-05**: Monitor the maintenance status of critical dependencies (e.g., WebSocket libraries). Evaluate migration if a dependency enters maintenance-only mode.

### Build Security

- **G-DEP-06**: Agent binaries MUST be built with the Go version declared in the build configuration. Do NOT use outdated Go compilers with known vulnerabilities.
- **G-DEP-07**: Build with `-trimpath` flag to remove local filesystem paths from binaries.
- **G-DEP-08**: Enable `-race` detector in test builds to catch data races.
- **G-DEP-09**: Binary signing SHOULD be implemented for production builds beyond checksums.

---

## 17. Code Signing & Distribution

### Binary Encryption

All Linux agent binaries are encrypted with OpenPGP before distribution:
- OpenPGP encryption/decryption via dedicated module (discover from workspace)
- Binary integrity verified via checksum manifests
- Public key stored in repo; private key bundled with deployed agents for runtime decryption

| Aspect | Requirement |
|---|---|
| Binary integrity | OpenPGP-encrypted binaries with JSON checksum manifests |
| Package signing | RPM / DEB packages must be signed with the organization's GPG key |
| Repository signing | APT/YUM repository metadata must be signed |
| Checksum verification | SHA-256 checksums for all distributed artifacts |

### Go Build Hardening

```bash
# Production build — required flags
export CGO_ENABLED=0
export GO111MODULE=off

go build -trimpath \
    -tags="<PRODUCT> <ARCH> netgo" \
    -ldflags="-w -s" \
    -o <output_binary> \
    <EntryMain>.go
```

| Flag | Purpose |
|---|---|
| `-trimpath` | Strip absolute build paths from binaries (prevents path disclosure) |
| `-ldflags="-w -s"` | Strip DWARF debug info and symbol tables |
| `-tags="netgo"` | Pure Go networking (no cgo DNS, reduces attack surface) |
| `CGO_ENABLED=0` | Disable CGo entirely (no C dependencies) |

### C Component Security Compile Flags

These flags are mandatory for all C programs compiled as part of the agent:

```bash
gcc -static -Wall \
    -Werror=format-security \
    -Werror=implicit-function-declaration \
    -D_FORTIFY_SOURCE=2 -O2 \
    -fstack-protector-strong \
    -fPIE -pie \
    -Wl,-z,relro,-z,now \
    -Wl,-z,noexecstack \
    -o output_binary source.c
```

| Flag | Purpose |
|---|---|
| `-Wall` | Enable all warnings |
| `-Werror=format-security` | Treat format string vulnerabilities as errors |
| `-Werror=implicit-function-declaration` | Catch missing function declarations |
| `-D_FORTIFY_SOURCE=2` | Compile-time & runtime buffer overflow checks |
| `-fstack-protector-strong` | Stack canaries (buffer overflow detection) |
| `-fPIE` / `-pie` | Position Independent Executable (ASLR) |
| `-Wl,-z,relro,-z,now` | Full RELRO (read-only relocations) |
| `-Wl,-z,noexecstack` | Non-executable stack |
| `-static` | Static linking (no external shared library dependencies) |

---

## 18. Privilege Management

- Run services with the **minimum required user** — prefer a dedicated service account over `root` where feasible
- Drop privileges after initialization if `root` is needed only at startup
- Use Linux capabilities (`cap_net_bind_service`, etc.) instead of full `root` where possible
- Use `syscall.Setuid` / `syscall.Setgid` to drop privileges programmatically
- Use polkit for interactive privilege escalation (e.g., user-facing CLI tools)
- Confine services with SELinux or AppArmor profiles
- Audit all privilege escalation paths — document why `root` or capabilities are needed

---

## Guideline Reference Index

| Prefix | Section | Count |
|--------|---------|-------|
| G-AUTH | Authentication & Authorization | 8 |
| G-CRYPTO | Cryptography & Key Management | 7 |
| G-CERT | Certificate Management | 5 |
| G-TLS | Transport Security | 9 |
| G-INPUT | Input Validation | 12 |
| G-FILE | File System Security | 11 |
| G-PROC | Process Execution | 10 |
| G-SECRET | Secrets Management | 6 |
| G-CONC | Concurrency Safety | 8 |
| G-NET | Network Communication | 13 |
| G-LIFE | Agent Lifecycle | 10 |
| G-INTEG | Binary Integrity | 4 |
| G-IPC | IPC & Named Pipes | 8 |
| G-LINUX | Linux Hardening | 9 |
| G-LOG | Logging & Audit | 7 |
| G-ERR | Error Handling | 5 |
| G-DEP | Dependencies & Supply Chain | 9 |
| **Total** | | **141** |
