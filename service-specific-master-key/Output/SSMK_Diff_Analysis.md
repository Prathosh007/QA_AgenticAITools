# Service Specific Master Key (SSMK) — Diff Analysis & Test Plan

**Generated:** 2026-06-04
**Mode:** Diff comparison (7 repositories)
**Feature:** Service Specific Master Key (SSMK) — replaces a single shared master key with per-service-module encryption keys plus a key-share / key-rotation / key-adaption protocol between Agent and Distribution Server (DS).

---

## 1. Repositories Analyzed

| # | Repository | Source (newer / SSMK branch) | Target (older release tag) | Files | Insertions | Deletions |
|---|------------|------------------------------|----------------------------|------:|-----------:|----------:|
| 1 | uems_agent_utils       | origin/SSMK_26.20.01              | UEMS_AGENT_UTILS_26.20.01            | 40 | 3,567  | 219    |
| 2 | uems_agent_framework   | origin/SSMK_26.20.01              | UEMS_AGENT_FRAMEWORK_26.20.01        | 12 | 387    | 134    |
| 3 | uems_ds                | origin/SSMK_26.20.01              | UEMS_DS_26.20.01                     | 7  | 559    | 128    |
| 4 | uems_server_native     | origin/SSMK_26.20.01              | UEMS_SERVER_NATIVE_26.20.01          | 6  | 957    | 3      |
| 5 | dc_native (Linux/Go)   | origin/SSMK_26.20.01              | DC_NATIVE_26.20.01                   | 51 | 10,724 | 3,660  |
| 6 | agent-utils (Mac)      | origin/service-specific-key-26.18 | UEMS_MAC_AGENT_UTILS_26.18.01        | 26 | 1,355  | 408    |
| 7 | framework-ops-suite (Mac) | origin/service-specific-key-26.20 | UEMS_MAC_AGENT_FRAMEWORK_26.20.01 | 72 | 5,925  | 5,686  |
|   | **TOTAL**              |                                   |                                      | **214** | **23,474** | **10,238** |

> All source branches add SSMK feature. The `framework-ops-suite` change-set also bundles a separate `dcondemand` revamp (WebSocket DMS client + modular Action routing).

---

## 2. Feature Summary — SSMK Architecture

Before SSMK: a single agent master key encrypted all stored secrets (cert private key, proxy creds, auth tokens).
After SSMK: every **service module** owns its own master key. Keys are negotiated/rotated with the DS via a **Key Share servlet**. All vault content (auth tokens, cert keys, proxy creds, module passwords) is re-encrypted under the per-module key.

### Service Module Enumeration (observed in code)
`AGENT_UTILS`, `FRAMEWORK`, `PATCH`, `INVENTORY`, `DCP`, `ACP`, `DMS`, `SOM`

### Key Lifecycle States
- **Active** — current encryption key
- **Adaption** — new key being adopted; both old + new accepted
- **Transition** — being renamed to Adaption
- **Rotated/Expired** — old key after rotation completes

### New / Major Components Introduced

| Repo | Component | Purpose |
|------|-----------|---------|
| uems_agent_utils | `UEMSAesChiperUtils/` (DLL) | New shared AES cipher with SSMK-aware helpers |
| uems_agent_utils | `dcutils/SSMKeyUtil.cpp` (+1070 LOC) | Core SSMK vault: key store, retrieval, rotation, fallback |
| uems_agent_utils | `dcagenthttp/httphandlerex.cpp` | Key Share servlet HTTP plumbing |
| uems_agent_utils | `dcutils_afw/agentfwutil.cpp` | Agent FW vault accessor + token migration |
| uems_agent_framework | `register/registerDll.cpp`, `cse/dcupgradeutil.cpp` | Register/upgrade SSMK-aware |
| uems_agent_framework | `upgrader/AgentUpgrader.cpp` | Upgrade-time key migration |
| uems_ds | `replication/processmastermetadata.cpp` (+451 LOC) | Replicate SSMK master metadata between DS nodes |
| uems_ds | `register/dcmagentreg.cpp` | DS-side SSMK during agent registration |
| uems_server_native | `ad_handler/SymNativeAesCipherUtils.cpp` (+624 LOC) | Server-side cipher utils mirroring SSMK |
| dc_native (Linux/Go) | `uemsdatavault/uemsdatavault.go` (+757), `vaultcrypto.go` (+1122) | New Go vault implementation |
| dc_native | `dcutils/ServiceMasterKeys.go` (+437) | Linux key share + per-module key cache |
| dc_native | `sqlite/sqlite.go` (+2295) | New SQLite store for vault data |
| dc_native | `dcutils/crypto/datavaultcrypto.go` (+220) | AES-GCM data-vault crypto |
| dc_native | `dcupgrader/DcUpgrader.go` (+304) | Linux upgrader: vault migration |
| agent-utils (Mac) | `UEMSCrypt/UEMSModuleCryptor.swift` | Per-module cryptor |
| agent-utils (Mac) | `dcutils/KeyShare.swift` | Key share / rotation client |
| agent-utils (Mac) | `dcutils/AuthPropsStore.swift`, `AuthPropsMigration.swift` | Auth token vault + migration |
| agent-utils (Mac) | `dcutils/ProxyCredentialMigration.swift` | Proxy creds → vault |
| framework-ops-suite (Mac) | SSMK adoption across dcagentservice, dcconfig | Agent surfaces use module cryptor |
| framework-ops-suite (Mac) | `dcondemand/` full revamp | (Bundled change) WebSocket DMS client, modular Actions |

---

## 3. Change Classification

| Repo | Logic | Refactor | Bug fix | Config/Constant | Dependency |
|------|------:|---------:|--------:|----------------:|-----------:|
| uems_agent_utils       | High | Med  | High | Med  | Med (new DLL refs) |
| uems_agent_framework   | Med  | Med  | High | Low  | Low |
| uems_ds                | High | Low  | Med  | Low  | Low |
| uems_server_native     | High | Low  | Low  | Low  | Low |
| dc_native (Linux/Go)   | High | High | High | Med  | High (new sqlite, vault) |
| agent-utils (Mac)      | High | High | High | Med  | Med |
| framework-ops-suite    | High | High | High | Med  | High (new DMS/WebSocket dep) |

### Notable Bug-Fix Commits (selected)
- `uems_agent_utils`: *Add fallback for dynamic key retrieval and decryption*; *Handle key share servlet rejection*; *Reset service keys' modified time in cleanup functions*; *Refactor keyShare response validation logic*
- `agent-utils` (Mac): *fix(KeyShare): handle missing existing timestamps for UUIDs*; *fix(keyshare): handle duplicate request auth reset*; *fix(KeyShare): change isKeyAtAdaptionStage type from Bool to String*; *Fix partial migration failure: per-token error handling*
- `dc_native`: *Linux: GCM fix issue 2*; *Linux: pkey store fix*; *Linux: Gen key fix*; *Linux: keyShareServlet fix*; *Linux: DB retrieve err fix and upgrader old file remove*; *Linux: protect mem alloc fix*; *Linux: DMS, https, sql inj fix*
- `framework-ops-suite`: *fix(WSTransport): reset read deadline on pong reception*; *fix(PowerActions): handle missing operation in shutdown*; *fix(DMSReconnectionStrategy)*; *catchup typos*

---

## 4. Risk Assessment

### High-Risk Areas

| Area | Why high risk | Affected repos |
|------|---------------|----------------|
| **Credential / key encryption** | Wrong key = permanent data loss; rollback impossible if vault corrupted | All 7 |
| **Key share servlet handshake** | Network race, server rejection, partial response | uems_agent_utils, dc_native, agent-utils, uems_ds |
| **Upgrade migration (master key → SSMK)** | One-shot migration; failure leaves agent unable to decrypt | uems_agent_framework, dc_native, agent-utils, framework-ops-suite |
| **Vault corruption / partial writes** | SQLite + plist + registry writes under crash | dc_native (sqlite), agent-utils (plist), uems_agent_utils (registry) |
| **AES-GCM IV/Nonce handling** | Reuse → catastrophic confidentiality break | dc_native (`vaultcrypto.go`), uems_agent_utils (`AesCipherUtil.cpp`), uems_server_native |
| **DS-side master metadata replication** | Race when 2 DS nodes rotate keys; replication gap | uems_ds |
| **Backward compatibility** | Old agents talking to SSMK DS, or new agents to old DS | uems_ds, uems_agent_utils, dc_native |
| **dcondemand WebSocket transport** (Mac) | Reconnect storms, pong/heartbeat bugs, action dispatch crashes | framework-ops-suite |
| **Proxy credential migration** | Network outage during migration → silent proxy auth failure | uems_agent_utils, agent-utils, dc_native |
| **Cert/CSR signing under approval key** | CSR uses new approval key path; misconfig breaks registration | agent-utils, dc_native |

### Detected Risk Patterns (from diff inspection)
1. New large C++/Go files (1k+ LOC) without preexisting unit-test scaffolding (`SSMKeyUtil.cpp`, `uemsdatavault.go`, `sqlite.go`) → high latent-bug risk.
2. Multiple "Revert / Reapply" commits on the SSMK key update path → indicates instability prior to release tag.
3. Several "fix" commits explicitly handle null/empty cases retro-actively (`handle missing existing timestamps`, `add fallback for dynamic key retrieval`) → suggests other null-paths may remain.
4. AES-GCM implementations added in multiple repos in parallel → high chance of inconsistent IV size or AAD handling between Agent and Server.
5. Mac code mixes Swift String/Bool type changes (`isKeyAtAdaptionStage Bool → String`) → JSON parsing tolerance must be retested.
6. DS replication adds 451 LOC of metadata merge logic → conflict resolution edge cases.

### Backward-Compatibility / Breaking Concerns
- Vault schema change: SQLite-based vault on Linux replaces previous file-based store → downgrade is **not supported**; cleanup of `old_file_remove` must succeed.
- Auth-token format on Mac changed to include UUID timestamps → older agent rolls forward fine but downgrade loses tokens.
- Module cryptor enum (`SOM` → `FRAMEWORK`) shift for Credential Manager decryption → any persisted secret encrypted under SOM key must be migrated; if not migrated user re-enters credentials.

---

## 5. Test Plan Overview

- **New test cases generated (this run):** see `SSMK_New_TestCases.csv` → **132 TCs**
- **Existing test cases (already in CSVs):** 346 (Linux 105 + Mac 87 + Win/DS 154)
- **Combined coverage target:** **478 TCs**

### New TCs by Module
| Module | Count |
|--------|-----:|
| dc_native (Linux/Go)        | 27 |
| uems_agent_utils (Win)      | 24 |
| cross-cutting / E2E         | 21 |
| agent-utils (Mac)           | 20 |
| framework-ops-suite (Mac)   | 16 |
| uems_agent_framework (Win)  | 9  |
| uems_ds (Win DS)            | 6  |
| regression                  | 5  |
| uems_server_native          | 4  |
| **Total**                   | **132** |

### Category Distribution of NEW TCs

| Category | Count |
|----------|-----:|
| Success / Happy Path                       | 18 |
| Failure / Error Handling                   | 16 |
| Retry / Recovery                           | 10 |
| Edge Cases                                 | 12 |
| Negative Cases                             | 12 |
| Concurrency / Race                         | 6  |
| State Transition (key Active/Adaption)     | 8  |
| Timing / Timeout                           | 5  |
| Resource Exhaustion                        | 4  |
| Security / Permission                      | 8  |
| Integration (Agent ↔ DS, DS ↔ DS)          | 8  |
| Upgrade / Migration                        | 9  |
| Cleanup / Uninstall                        | 3  |
| Cross-Environment (OP / Cloud / OS)        | 4  |
| E2E                                        | 4  |
| Rare / Unlikely (crash mid-rotate)         | 3  |
| **Total**                                  | **120** |

---

## 6. Potential Bugs / Logic Issues to Verify

| # | Area | Concern | Test reference |
|---|------|---------|----------------|
| B1 | `uems_agent_utils/SSMKeyUtil.cpp` | "Reset modified time in cleanup" came late — verify no key reuse after rotate-then-restart | TC-SSMK-KEYROT-002 |
| B2 | `uems_agent_utils/httphandlerex.cpp` | Key Share servlet rejection — verify agent does not loop infinitely after 401/403 | TC-SSMK-KEYSHARE-006 |
| B3 | `dc_native/vaultcrypto.go` | AES-GCM nonce derivation under concurrent writes — verify no nonce reuse with same key | TC-SSMK-VAULT-014 |
| B4 | `dc_native/uemsdatavault.go` | SQLite "database is locked" under parallel reads — verify retry behavior | TC-SSMK-VAULT-010 |
| B5 | `dc_native/DcUpgrader.go` | Old-file removal during upgrade — verify rollback if vault open fails post-upgrade | TC-SSMK-UPGRADE-005 |
| B6 | `agent-utils/KeyShare.swift` | Optional `isKeyAtAdaptionStage` — verify both "true"/"false" string and missing | TC-SSMK-MAC-KS-003 |
| B7 | `agent-utils/AuthPropsMigration.swift` | Per-token failure isolation — verify a single bad token doesn't abort other migrations | TC-SSMK-MAC-MIG-004 |
| B8 | `agent-utils/ProxyCredentialMigration.swift` | Plist remnant cleanup — verify no leftover plaintext after migration | TC-SSMK-MAC-PROXY-002 |
| B9 | `framework-ops-suite/WSTransport.swift` | Read deadline reset on pong — verify socket doesn't time out during long idle | TC-SSMK-MAC-DMS-005 |
| B10 | `uems_ds/processmastermetadata.cpp` | DS-DS replication: 2 DS nodes rotate same module — verify deterministic conflict resolution | TC-SSMK-DS-REPL-003 |
| B11 | `uems_server_native/SymNativeAesCipherUtils.cpp` | Server-side cipher compat with agent — verify decrypt of agent-encrypted blob | TC-SSMK-SERVER-002 |
| B12 | `uems_agent_framework/AgentUpgrader.cpp` | JSONStatusUtil — verify status reporting when migration fails | TC-SSMK-UPGRADE-008 |

---

## 7. Recommendations

1. **Pin SSMK feature flag rollout per service module** to allow per-module rollback if a vault decrypt regression appears.
2. **Add explicit AES-GCM nonce-reuse detection telemetry** (counter on derive-from-key collision) for the first release window.
3. **Long-run soak (≥ 72 h)** on Linux Go agent for SQLite vault locking and key-share polling — most diffs are net-new code without production miles.
4. **Bidirectional compat matrix mandatory**: Old agent ↔ new DS, new agent ↔ old DS, new agent ↔ new DS, mixed-DS replication. Each cell needs at least registration, status-update, and one ondemand action verified.
5. **Mac dcondemand** revamp should get its **own** test-pass independent of SSMK (different risk class).
6. Run the existing 346 TCs **first** as a regression baseline before promoting the new 120 TCs.
