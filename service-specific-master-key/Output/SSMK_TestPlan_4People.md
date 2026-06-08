# SSMK QA — 4-Person Test Split Plan

**Goal:** Cover all 478 test cases (132 new + 346 existing) across 4 testers with **minimum overlap**, **maximum parallelism**, and **clean ownership boundaries** so every functional area has one accountable person.

---

## Splitting Strategy

We split by **platform + functional layer** (not by test-case count alone), because:
1. Each tester needs an actual lab environment (Win endpoint, Mac endpoint, Linux endpoint, DS server). Spinning these up dominates time — minimize swaps.
2. SSMK has tight Agent ↔ DS coupling — pairing a platform owner with the DS owner saves communication round-trips.
3. Cross-platform E2E and regression should land late and on one owner to avoid double-debugging environment problems.

---

## Assignments

### Tester A — Windows Agent + DS
**Owns:** uems_agent_utils, uems_agent_framework, uems_ds, uems_server_native, existing Win/DS CSV
**Lab:** 2× Windows endpoints, 2× DS servers (for replication tests)

| Set | Count |
|-----|-----:|
| New TCs (uems_agent_utils)      | 24 |
| New TCs (uems_agent_framework)  | 9  |
| New TCs (uems_ds)               | 6  |
| New TCs (uems_server_native)    | 4  |
| Build/config TCs                | 3  |
| Existing Win/DS CSV TCs         | 154 |
| **Tester A total**              | **200** |

**Key risk areas to focus on:**
- KeyShare servlet (TC-SSMK-KEYSHARE-*)
- DS-DS replication (TC-SSMK-DSREPL-*)
- Upgrade migration (TC-SSMK-UPGRADE-*)

---

### Tester B — Linux Agent (dc_native)
**Owns:** dc_native (Linux/Go), Linux CSV
**Lab:** 2× Linux endpoints (one with SELinux enforcing), 1× DS

| Set | Count |
|-----|-----:|
| New TCs (dc_native)             | 27 |
| Existing Linux CSV TCs          | 105 |
| **Tester B total**              | **132** |

**Key risk areas to focus on:**
- SQLite vault locking and corruption recovery (TC-SSMK-LIN-VAULT-*)
- AES-GCM nonce uniqueness soak (TC-SSMK-LIN-VAULT-003)
- Linux upgrader old-file removal (TC-SSMK-LIN-UPGRADE-*)

---

### Tester C — Mac Agent
**Owns:** agent-utils (Mac), framework-ops-suite (Mac), Mac CSV
**Lab:** 2× Mac endpoints (Intel + Apple Silicon recommended), 1× DS

| Set | Count |
|-----|-----:|
| New TCs (agent-utils — SSMK)    | 20 |
| New TCs (framework-ops-suite — SSMK + DMS revamp) | 16 |
| Existing Mac CSV TCs            | 87 |
| **Tester C total**              | **123** |

**Key risk areas to focus on:**
- KeyShare type/optional handling (TC-SSMK-MAC-KS-*)
- ProxyCredentialMigration plist cleanup (TC-SSMK-MAC-PROXY-*)
- DMS WebSocket transport — reconnect + pong (TC-SSMK-MAC-DMS-*)

---

### Tester D — Cross-Platform / Integration / Regression / Security
**Owns:** cross-cutting TCs, E2E, perf, security audit, regression triage across all platforms
**Lab:** mixed fleet (1 Win + 1 Mac + 1 Linux + 2 DS); access to all environments above

| Set | Count |
|-----|-----:|
| Cross-cutting TCs               | 21 |
| Regression TCs                  | 5  |
| Build/config (cross-platform)   | 1  |
| Helps Tester A,B,C on triage    | —  |
| **Tester D total (own load)**   | **27** + on-call triage |

**Key responsibilities:**
- Compatibility matrix (new agent ↔ old DS, old agent ↔ new DS) — TC-SSMK-INT-AGENTDS-002 / -003
- Fleet-wide rotation E2E — TC-SSMK-INT-AGENTDS-004 / -005
- Perf and security audit suites
- Final pre-release sign-off and bug-bash facilitation

---

## Workload Balance Summary

| Tester | New TCs | Existing TCs | Total | % of all |
|--------|--------:|-------------:|------:|--------:|
| A — Windows + DS     | 46  | 154 | 200 | 41.8% |
| B — Linux            | 27  | 105 | 132 | 27.6% |
| C — Mac              | 36  | 87  | 123 | 25.7% |
| D — Cross + Regression | 27 | 0  | 27  |  5.6% (+ triage) |
| **Total**            | **136** | **346** | **482** | 100% |

> Total slightly differs from 478 due to the build/config TCs counted for A's setup focus and Tester D's optional support on Tester A's queue.

---

## Suggested Schedule (5 working days)

### Day 1 — Environment setup + smoke
- Each tester provisions lab; runs **TC-SSMK-INT-AGENTDS-001** (E2E smoke) on their platform.
- Tester D stands up the mixed-fleet lab + DS pair.
- Blocker bar: smoke must pass before deep testing on Day 2.

### Day 2 — Happy-path + Functional
- All testers run "Functional" + "Happy" categories on their queues (priority P1).
- Tester D starts compatibility matrix (TC-SSMK-INT-AGENTDS-002 / -003).

### Day 3 — Failure / Retry / Security
- All testers run Failure/Retry/Negative/Security TCs.
- Tester D runs security audit (TC-SSMK-SEC-AUDIT-*).

### Day 4 — Edge / Concurrency / Upgrade
- A: Upgrade + DS replication races.
- B: SQLite locking soak + Linux upgrade race.
- C: DMS reconnect storms + adaption-mid-action.
- D: Fleet-wide rotation + perf (TC-SSMK-PERF-*).

### Day 5 — Regression + Cleanup + Triage
- Each tester reruns their failing TCs after fixes.
- Tester D runs cross-platform regression sweep + sign-off.
- All testers run Cleanup/Uninstall TCs last (machines reused after).

---

## Daily Standup (15 min)

| Item | Format |
|------|--------|
| Done yesterday | TC IDs passed / failed |
| Today's TC IDs | Concrete list, no "I'll start testing X" |
| Blockers | env / build / DS issue |
| Cross-team asks | (e.g., A → D: need DS-B for replication) |

---

## Defect Triage Protocol

1. **Sev-1 (blocker)** — file in bug tracker with TC ID + repro + log path; ping owning developer same day.
2. **Sev-2 (high)** — file with TC ID; assigned to dev within 24 h.
3. **Sev-3 (medium / cosmetic)** — file with TC ID; batched weekly.

For every new sev-1, **Tester D adds a regression TC** in the next sprint's TC pool so it's caught in future runs.

---

## Parallelism Gotchas

- **DS rotation tests block one another.** Tester A coordinates a rotation-window calendar so B and C don't get unexpected key changes during their key-share negative tests.
- **Mac/Linux/Win endpoints sharing one DS:** stagger registrations and use distinct hostnames to prevent collisions in `dcmagentreg` table.
- **Fleet-wide rotation (Tester D)** must be scheduled outside other testers' active sessions, or D must work with a dedicated DS pair.

---

## Definition of Done (per tester)

- Every owned TC has a result: **Pass / Fail / Blocked / Not-Applicable** (NA needs a one-line reason).
- Every Fail has a linked defect ID.
- All P1 TCs are Pass before sign-off.
- A `tester-<X>-summary.md` filed in `Output/` with results + observations.
