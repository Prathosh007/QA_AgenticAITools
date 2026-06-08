# Internal Agent Engineering Checklist

> Shared across all platforms. Each item is evaluated as **Pass / Fail / Not verifiable / NA**.

---

## A) Internal Dependencies & Reuse

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| A1  | Use shared utilities first (Agent-Utils) — avoid direct platform APIs | Diff calls platform APIs that have known wrappers | Inconsistent behavior, security regressions, duplicated logic |
| A2  | No duplicate methods/helpers — search Agent-Utils first | New utility/helper functions added | Fragmentation, divergent behavior, maintenance burden |
| A3  | Use approved Agent-Utils wrappers over legacy utilities | Adding/changing logging or parsing | Inconsistent logging policy, parsing correctness issues |
| A4  | Restrict direct debug/console logging | Adding/changing logging statements | Noisy logs, privacy leakage, inconsistent formatting |

## B) Language & Style Requirements

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| B1  | Compiles under project's declared language version | Adding/editing source files or build settings | Build breaks, incompatibility |
| B2  | Prefer primary language for new code (platform-specific) | New functionality introduced | Maintenance burden, inconsistent codebase |
| B3  | Style guide compliance | Adding/editing source files | Crashes, interop bugs, readability issues |

## C) Build, Hardening, Signing & Governance

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| C1  | Security compile flags for new targets (PIE, stack canaries, ARC/equivalent, hardened runtime) | New target/executable introduced | Weaker exploit mitigations |
| C2  | New executables signed (codesign/equivalent, notarization) | New binary/executable added | Tampering risk, deployment failures |
| C3  | Child process signature check before execution | Feature launches/spawns child processes | Execution of untrusted binaries |
| C4  | Parent process signature/identity validation | Component invoked by parent process | Spoofing, unauthorized invocation |

## D) OS / Hardware Compatibility

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| D1  | Verified on required OS versions | Any functional change | Runtime failures on untested OS variants |
| D2  | Verified on supported architectures | Binaries, system interactions, performance code | Arch-specific bugs, performance regressions |
| D3  | New platform APIs guarded with availability checks | New APIs introduced | Crashes due to missing symbols on older OS |

## E) Performance, Memory & Stability

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| E1  | Memory/resource leak testing | Long-running code, allocations, handles | Slow degradation, crashes |
| E2  | CPU usage verified under expected workloads | Background work, loops, crypto, monitoring | Battery drain, throttling |
| E3  | Heavy operations isolated from service main loop | New process calls or heavy work in callbacks | Service hangs/crashes |

## F) Upgrade, Migration & Backward Compatibility

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| F1  | Agent upgrade cases verified | Changes to persistent data, config, protocol, startup | Bricked installs, lost configuration |
| F2  | Old config/data migrated if schema changed | New/changed persistent schemas | Data loss, crashes after upgrade |

## G) Data Formats, Replication, MSP & Cloud

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| G1  | Data formats verified for sync/replication | Adding/changing schemas for replication/sync | Replication break, data divergence |
| G2  | MSP and Cloud cases verified | Feature interacts with cloud, policy distribution, enrollment | Customer-impacting outages, policy drift |

## H) Logging, Privacy & Troubleshooting

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| H1  | Sensitive data hidden in logs (PII redaction) | Any logging added/changed or new data handled | Data exposure, compliance violations |
| H2  | Compatible with agent troubleshooting tool | Changes to diagnostics, status, log formats | Support inability to diagnose issues |

## I) Localization

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| I1  | User-visible strings externalized | User-visible strings/UI added or changed | Poor UX, non-English breakage |

## J) Security Controls & Input Handling

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| J1  | Privilege separation (entitlements, IPC, sandbox) | Feature requires elevated privileges | Privilege escalation |
| J2  | Input sanitization (all sources) | Accepting external inputs | Injection, path traversal, command execution |
| J3  | Sensitive info stored securely (Vault/equivalent) | Storing tokens, credentials, secrets, PII | Credential theft, compliance issues |
| J4  | External commands use full paths (not PATH) | Executing shell commands, invoking tools | PATH manipulation attacks |

## K) Storage & Persistence

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| K1  | Separate storage for feature data | New persistent state introduced | Data corruption, difficult migrations |
| K2  | Storage durability and concurrency safety | Any persistence involved | Corruption, race conditions |

## L) IPC & Service Communication

| ID  | Item | When Applicable | Risk if Violated |
|-----|------|-----------------|------------------|
| L1  | IPC authentication and authorization | Adding/modifying IPC mechanisms | Unauthorized access, spoofing |
| L2  | IPC error handling (graceful degradation) | IPC used for critical operations | Hangs, cascading failures |

## M) Verification-Only Governance

| ID  | Item | NA When |
|-----|------|---------|
| M1  | New app/target governance | No new target/app introduced |
| M2  | New executable governance | No new executable introduced |
| M3  | New data format governance | No new replication data format |
| M4  | Platform-specific items | Not applicable to current platform |
