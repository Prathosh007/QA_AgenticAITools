# Mac Platform Security

> macOS-specific security controls for UEMS Mac Agent (Swift / Objective-C). All guidelines use **M-** prefixed IDs for traceability.
>
> **Shared standards** (OWASP mapping, input validation, secrets management, privilege management principles) are in [`common/security-standards.md`](../common/security-standards.md). This file covers **macOS-specific** enforcement details.

---

## 1. XPC Security (IPC)

> See also: [`common/security-standards.md` §2](../common/security-standards.md) for shared authentication principles (C-AUTH-*).

XPC is the primary IPC mechanism for macOS agents. Every XPC service must implement:

### Connection Validation

- **M-XPC-01**: Validate audit tokens on **every** new connection.
- **M-XPC-02**: Check code signatures via `SecCode` APIs.
- **M-XPC-03**: Verify caller entitlements before accepting a connection.
- **M-XPC-04**: Reject anonymous/unverified connections.
- **M-XPC-05**: Handle connection interruption and invalidation gracefully.

### Code Signature Verification

```swift
import Security

func verifyProcessSignature(pid: pid_t, expectedTeamID: String) -> Bool {
    var code: SecCode?
    var staticCode: SecStaticCode?
    let pidAttr = [kSecGuestAttributePid: pid] as CFDictionary

    guard SecCodeCopyGuestWithAttributes(nil, pidAttr, [], &code) == errSecSuccess,
          let code = code else { return false }

    guard SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess,
          let staticCode = staticCode else { return false }

    guard SecStaticCodeCheckValidity(staticCode, [], nil) == errSecSuccess else { return false }

    var signingInfo: CFDictionary?
    guard SecCodeCopySigningInformation(staticCode, [], &signingInfo) == errSecSuccess,
          let info = signingInfo as? [String: Any],
          let teamID = info[kSecCodeInfoTeamIdentifier as String] as? String else { return false }

    return teamID == expectedTeamID
}
```

### Entitlement Verification

```swift
func verifyEntitlement(connection: NSXPCConnection, entitlement: String) -> Bool {
    let auditToken = connection.auditToken
    var code: SecCode?
    let tokenData = Data(bytes: &auditToken, count: MemoryLayout.size(ofValue: auditToken))
    let attr = [kSecGuestAttributeAudit: tokenData] as CFDictionary

    guard SecCodeCopyGuestWithAttributes(nil, attr, [], &code) == errSecSuccess,
          let code = code else { return false }

    var requirement: SecRequirement?
    let requirementString = "entitlement[\"\(entitlement)\"] exists" as CFString
    guard SecRequirementCreateWithString(requirementString, [], &requirement) == errSecSuccess,
          let requirement = requirement else { return false }

    return SecCodeCheckValidity(code, [], requirement) == errSecSuccess
}
```

### XPC Design Rules

- **M-XPC-06**: Input validation MUST be applied to all XPC message contents.
- **M-XPC-07**: Concurrency model (main queue vs background queue) MUST be explicitly documented per service.
- **M-XPC-08**: Service lifecycle management (installation, activation, shutdown, KeepAlive) MUST be handled.

---

## 2. Code Signing & Distribution

> See also: [`common/security-standards.md` §9](../common/security-standards.md) for shared integrity principles (C-INTEG-*).

| Aspect | Requirement |
|---|---|
| Developer ID | Specify signing identity requirements |
| Entitlements | List ALL required entitlements with justification |
| Hardened runtime | Required for all new targets |
| Notarization | Required for all distributed binaries |
| Gatekeeper | Must be compatible |

- **M-SIGN-01**: Every distributed binary MUST be code-signed with a valid Developer ID.
- **M-SIGN-02**: ALL required entitlements MUST be documented with justification.
- **M-SIGN-03**: Hardened Runtime MUST be enabled for all new targets.
- **M-SIGN-04**: Notarization MUST be completed for all distributed binaries.
- **M-SIGN-05**: Gatekeeper compatibility MUST be verified before release.

### Build Settings (Required)

```
SWIFT_VERSION = 5.0
MACOSX_DEPLOYMENT_TARGET = 12.0
ENABLE_HARDENED_RUNTIME = YES
CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = <TeamID>
```

### Security Compile Flags (Required for New Targets)

- **M-SIGN-06**: PIE (Position Independent Executable) — enabled by default.
- **M-SIGN-07**: Stack canaries — enabled by default.
- **M-SIGN-08**: ARC MUST be enabled.
- **M-SIGN-09**: Hardened Runtime MUST be enabled.
- **M-SIGN-10**: Secure Coding MUST be enabled (`NSSecureCoding`).

### Entitlements Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <!-- Each entitlement MUST have documented justification -->
</dict>
</plist>
```

---

## 3. Process Trust

> See also: [`common/security-standards.md` §7](../common/security-standards.md) for shared command execution principles (C-EXEC-*).

### Parent Process Validation

- **M-PROC-01**: Validate parent process identity via code signatures and team IDs where trust boundaries exist.
- **M-PROC-02**: Verify entitlements match expected caller profile.

### Child Process Execution

- **M-PROC-03**: Verify child process signatures before execution via `SecCode` APIs.
- **M-PROC-04**: Use the Agent-Utils process execution wrapper (not `Process` / `NSTask` directly — discover wrapper class name from workspace).

---

## 4. Privilege Management

> See also: [`common/security-standards.md` §10](../common/security-standards.md) for shared privilege principles (C-PRIV-*).

- **M-PRIV-01**: Use minimal required entitlements — each entitlement MUST have documented justification.
- **M-PRIV-02**: Implement privilege separation via XPC services.
- **M-PRIV-03**: Use Authorization Services for temporary privilege escalation requiring user consent.
- **M-PRIV-04**: Sandbox where possible using App Sandbox entitlements.

---

## 5. Keychain / Secure Storage

> See also: [`common/security-standards.md` §3](../common/security-standards.md) for shared secrets management principles (C-SECRET-*).

- **M-KEY-01**: Use the Agent-Utils secure storage wrapper for all sensitive data — not direct Keychain APIs (discover wrapper class name from workspace).
- **M-KEY-02**: Specify `kSecAttrAccessible` settings appropriate to the data.
- **M-KEY-03**: Plan keychain item migration for agent upgrades.
- **M-KEY-04**: Define keychain access groups if sharing across components.

---

## 6. Network Security

> See also: [`common/security-standards.md` §5](../common/security-standards.md) for shared transport security principles (C-TLS-*).

- **M-NET-01**: ATS (App Transport Security) compliance MUST be maintained — no ATS exceptions without documented justification.
- **M-NET-02**: Certificate pinning MUST be implemented where applicable.
- **M-NET-03**: Use the Agent-Utils networking wrapper (not `NSURLSession` directly — discover wrapper class name from workspace).

---

## Guideline Reference Index

| Prefix | Section | Count |
|--------|---------|-------|
| M-XPC | XPC Security (IPC) | 8 |
| M-SIGN | Code Signing & Distribution | 10 |
| M-PROC | Process Trust | 4 |
| M-PRIV | Privilege Management | 4 |
| M-KEY | Keychain / Secure Storage | 4 |
| M-NET | Network Security | 3 |
| **Total** | | **33** |
