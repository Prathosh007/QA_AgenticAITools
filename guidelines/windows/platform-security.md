# Windows Platform Security

> Windows-specific security controls for UEMS Windows Agent (C++ 17 / C# .NET 4.0). All guidelines use **W-** prefixed IDs for traceability.
>
> **Shared standards** (OWASP mapping, input validation, secrets management, privilege management principles) are in [`common/security-standards.md`](../common/security-standards.md). This file covers **Windows-specific** enforcement details.

---

## 1. Service & IPC Security

> See also: [`common/security-standards.md` §2](../common/security-standards.md) for shared authentication principles (C-AUTH-*).

Windows services and named pipes are the primary IPC mechanisms for Windows agents.

### Named Pipe Security

- **W-IPC-01**: Create pipes with explicit security descriptors — NEVER use `NULL` DACL.
- **W-IPC-02**: Validate client identity on **every** new connection using `GetNamedPipeClientProcessId` and `OpenProcessToken`.
- **W-IPC-03**: Impersonate clients only when necessary; revert immediately with `RevertToSelf`.
- **W-IPC-04**: Reject anonymous/unauthenticated connections.
- **W-IPC-05**: Handle pipe disconnection and error states gracefully.

### Caller Verification (Authenticode Signature)

```cpp
#include <windows.h>
#include <wintrust.h>
#include <softpub.h>
#include <mscat.h>

#pragma comment(lib, "wintrust.lib")
#pragma comment(lib, "crypt32.lib")

bool VerifyAuthenticodeSignature(const std::wstring& filePath) {
    WINTRUST_FILE_INFO fileInfo{};
    fileInfo.cbStruct = sizeof(WINTRUST_FILE_INFO);
    fileInfo.pcwszFilePath = filePath.c_str();

    GUID policyGuid = WINTRUST_ACTION_GENERIC_VERIFY_V2;

    WINTRUST_DATA trustData{};
    trustData.cbStruct = sizeof(WINTRUST_DATA);
    trustData.dwUIChoice = WTD_UI_NONE;
    trustData.fdwRevocationChecks = WTD_REVOKE_WHOLECHAIN;
    trustData.dwUnionChoice = WTD_CHOICE_FILE;
    trustData.pFile = &fileInfo;
    trustData.dwStateAction = WTD_STATEACTION_VERIFY;
    trustData.dwProvFlags = WTD_SAFER_FLAG;

    LONG result = ::WinVerifyTrust(
        static_cast<HWND>(INVALID_HANDLE_VALUE), &policyGuid, &trustData);

    // Clean up state
    trustData.dwStateAction = WTD_STATEACTION_CLOSE;
    ::WinVerifyTrust(
        static_cast<HWND>(INVALID_HANDLE_VALUE), &policyGuid, &trustData);

    return result == ERROR_SUCCESS;
}
```

### Process Identity Verification

```cpp
#include <windows.h>
#include <tlhelp32.h>
#include <sddl.h>

bool ValidateCallerIdentity(DWORD clientPid, const std::wstring& expectedSid) {
    HANDLE hProcess = ::OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, clientPid);
    if (!hProcess) return false;

    HANDLE hToken = nullptr;
    bool valid = false;

    if (::OpenProcessToken(hProcess, TOKEN_QUERY, &hToken)) {
        DWORD tokenInfoLen = 0;
        ::GetTokenInformation(hToken, TokenUser, nullptr, 0, &tokenInfoLen);

        std::vector<BYTE> buffer(tokenInfoLen);
        if (::GetTokenInformation(hToken, TokenUser, buffer.data(),
                                   tokenInfoLen, &tokenInfoLen)) {
            auto* tokenUser = reinterpret_cast<TOKEN_USER*>(buffer.data());
            LPWSTR sidString = nullptr;
            if (::ConvertSidToStringSidW(tokenUser->User.Sid, &sidString)) {
                valid = (expectedSid == sidString);
                ::LocalFree(sidString);
            }
        }
        ::CloseHandle(hToken);
    }
    ::CloseHandle(hProcess);
    return valid;
}
```

### IPC Design Rules

- **W-IPC-06**: Authenticode signature verification MUST be performed on all connecting binaries.
- **W-IPC-07**: Explicit security descriptors MUST be set on all named pipes and shared objects.
- **W-IPC-08**: Use overlapped I/O or I/O completion ports for scalable pipe servers.
- **W-IPC-09**: Input validation MUST be applied to all IPC message contents with size limits on buffers.
- **W-IPC-10**: Service SCM integration and graceful shutdown via control handler MUST be implemented.

---

## 2. Code Signing & Distribution

> See also: [`common/security-standards.md` §9](../common/security-standards.md) for shared integrity principles (C-INTEG-*).

| Aspect | Requirement |
|---|---|
| Authenticode certificate | All binaries signed with organization's EV or standard code signing cert |
| Timestamp | All signatures must include RFC 3161 timestamp |
| Catalog signing | Drivers and system components where required |
| SmartScreen | Binaries must pass Windows SmartScreen reputation checks |
| MSI / MSIX | Installer packages must be signed |

- **W-SIGN-01**: ALL binaries MUST be signed with the organization's Authenticode certificate.
- **W-SIGN-02**: ALL signatures MUST include an RFC 3161 timestamp for long-term validity.
- **W-SIGN-03**: Drivers and system components MUST use catalog-based signing where required.
- **W-SIGN-04**: Binaries MUST pass Windows SmartScreen reputation checks.
- **W-SIGN-05**: MSI / MSIX installer packages MUST be signed.

### Build Settings (Required)

#### C++ (Visual Studio / MSBuild)

```xml
<!-- .vcxproj properties -->
<PropertyGroup>
  <PlatformToolset>v143</PlatformToolset>
  <WindowsTargetPlatformVersion>10.0.20348.0</WindowsTargetPlatformVersion>
  <LanguageStandard>stdcpp17</LanguageStandard>
  <CharacterSet>Unicode</CharacterSet>
  <SpectreMitigation>Spectre</SpectreMitigation>
</PropertyGroup>
```

#### C# (.NET Framework 4.0)

```xml
<!-- .csproj properties -->
<PropertyGroup>
  <TargetFrameworkVersion>v4.0</TargetFrameworkVersion>
  <PlatformTarget>AnyCPU</PlatformTarget>
  <SignAssembly>true</SignAssembly>
  <AssemblyOriginatorKeyFile>UemsAgent.snk</AssemblyOriginatorKeyFile>
</PropertyGroup>
```

### Security Compile Flags

- **W-SIGN-06**: C++ builds MUST enable: `/GS`, `/DYNAMICBASE`, `/NXCOMPAT`, `/HIGHENTROPYVA` (x64), `/guard:cf`, `/Qspectre`, `/SDL`, `/analyze`.
- **W-SIGN-07**: C# assemblies MUST use strong naming for tamper protection.

| Flag | Purpose | C++ | C# |
|---|---|---|---|
| `/GS` | Buffer security check (stack canaries) | Yes | N/A (managed) |
| `/DYNAMICBASE` | ASLR | Yes | Yes (default) |
| `/NXCOMPAT` | DEP | Yes | Yes (default) |
| `/HIGHENTROPYVA` | High-entropy 64-bit ASLR | Yes (x64) | Yes (x64) |
| `/guard:cf` | Control Flow Guard | Yes | N/A |
| `/Qspectre` | Spectre variant 1 mitigation | Yes | N/A |
| `/SDL` | Additional SDL checks | Yes | N/A |
| `/analyze` | Static code analysis | Yes | N/A |
| Strong naming | Assembly tamper protection | N/A | Yes |

### Post-Build Signing

```bat
:: Sign executable with Authenticode + timestamp
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 ^
    /sha1 <CertThumbprint> "AgentCore.dll"

:: Verify signature
signtool verify /pa /v "AgentCore.dll"
```

---

## 3. Process Trust

> See also: [`common/security-standards.md` §7](../common/security-standards.md) for shared command execution principles (C-EXEC-*).

### DLL Loading Security

- **W-DLL-01**: Load ALL DLLs using **full absolute paths** — never rely on the default DLL search order (CWE-427).
- **W-DLL-02**: Never call `LoadLibraryW` with just a DLL name — always provide the full path or use restricted search flags.
- **W-DLL-03**: Call `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)` at process startup to remove CWD from the search order.
- **W-DLL-04**: Use `LoadLibraryExW` with `LOAD_LIBRARY_SEARCH_SYSTEM32` for system DLLs and `LOAD_LIBRARY_SEARCH_APPLICATION_DIR` for application DLLs.
- **W-DLL-05**: Validate Authenticode signatures on all **internal** DLLs before loading.
- **W-DLL-06**: Defend against DLL side-loading — ensure the application directory does not contain unexpected DLLs; use allowlists.
- **W-DLL-07**: For delay-loaded DLLs (`/DELAYLOAD`), apply the same full-path and signature validation rules.
- **W-DLL-08**: Ensure `SafeDllSearchMode` is enabled — do not disable it via registry.

```cpp
#include <windows.h>
#include <libloaderapi.h>

HMODULE SecureLoadLibrary(const std::wstring& dllFullPath, bool isInternalDll) {
    if (dllFullPath.empty()) {
        return nullptr;
    }

    // Validate signature for internal DLLs
    if (isInternalDll && !VerifyAuthenticodeSignature(dllFullPath)) {
        return nullptr;
    }

    HMODULE hModule = ::LoadLibraryExW(
        dllFullPath.c_str(),
        nullptr,
        LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);

    return hModule;
}

// Call once at process startup to harden the default DLL search order
void InitializeDllSearchOrder() {
    ::SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32);
}
```

### Parent / Child Process Execution

- **W-PROC-01**: Validate parent process identity and Authenticode signature at trust boundaries.
- **W-PROC-02**: Verify Authenticode signatures of child executables before launching.
- **W-PROC-03**: Use the Agent-Utils process execution wrapper where available (discover wrapper from workspace).
- **W-PROC-04**: Use restricted tokens / job objects to limit child process capabilities.
- **W-PROC-05**: Set `CREATE_NO_WINDOW` or appropriate creation flags for background processes.

```cpp
#include <windows.h>

bool LaunchValidatedProcess(const std::wstring& exePath, const std::wstring& commandLine) {
    if (!VerifyAuthenticodeSignature(exePath)) {
        return false;
    }

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};

    std::wstring cmdLine = commandLine;
    BOOL success = ::CreateProcessW(
        exePath.c_str(),
        cmdLine.data(),
        nullptr,          // process security attributes
        nullptr,          // thread security attributes
        FALSE,            // don't inherit handles
        CREATE_NO_WINDOW, // creation flags
        nullptr,          // inherit environment
        nullptr,          // inherit working directory
        &si, &pi);

    if (success) {
        ::CloseHandle(pi.hThread);
        ::CloseHandle(pi.hProcess);
    }
    return success != FALSE;
}
```

---

## 4. Privilege Management

> See also: [`common/security-standards.md` §10](../common/security-standards.md) for shared privilege principles (C-PRIV-*).

- **W-PRIV-01**: Prefer `LOCAL SERVICE` or `NETWORK SERVICE` over `LOCAL SYSTEM` for service accounts.
- **W-PRIV-02**: Use `AdjustTokenPrivileges` to disable unused privileges in the service token.
- **W-PRIV-03**: Use least-privilege security descriptors on all created objects (pipes, files, registry keys).
- **W-PRIV-04**: Use Windows Integrity Levels (Low, Medium, High) to isolate components.

---

## 5. Credential & Secure Storage

> See also: [`common/security-standards.md` §3](../common/security-standards.md) for shared secrets management principles (C-SECRET-*).

- **W-CRED-01**: Use the Agent-Utils secure storage wrapper where available (discover wrapper from workspace).
- **W-CRED-02**: Use **Windows Credential Manager** (`CredWriteW` / `CredReadW`) or **DPAPI** (`CryptProtectData` / `CryptUnprotectData`) for local secret storage.
- **W-CRED-03**: In C#, use `ProtectedData` (DPAPI wrapper) for encrypting secrets at rest.
- **W-CRED-04**: Use `SecureString` in C# for in-memory password handling.
- **W-CRED-05**: Use `SecureZeroMemory` (C++) or explicit `byte[]` zeroing (C#) for clearing sensitive buffers.
- **W-CRED-06**: Plan credential migration for agent upgrades.
- **W-CRED-07**: Define access control on registry keys / files containing encrypted credentials.

```cpp
#include <windows.h>
#include <dpapi.h>

#pragma comment(lib, "crypt32.lib")

std::vector<BYTE> ProtectData(const std::vector<BYTE>& plainData,
                               const std::wstring& description) {
    DATA_BLOB input{};
    input.cbData = static_cast<DWORD>(plainData.size());
    input.pbData = const_cast<BYTE*>(plainData.data());

    DATA_BLOB output{};
    if (!::CryptProtectData(&input, description.c_str(),
                             nullptr, nullptr, nullptr,
                             CRYPTPROTECT_LOCAL_MACHINE, &output)) {
        return {};
    }

    std::vector<BYTE> result(output.pbData, output.pbData + output.cbData);
    ::LocalFree(output.pbData);
    return result;
}
```

```csharp
using System;
using System.Security.Cryptography;
using System.Text;

public static byte[] ProtectData(string plainText)
{
    byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
    try
    {
        return ProtectedData.Protect(
            plainBytes, null, DataProtectionScope.LocalMachine);
    }
    finally
    {
        Array.Clear(plainBytes, 0, plainBytes.Length);
    }
}
```

---

## 6. Registry Security

- **W-REG-01**: Set explicit ACLs on all agent registry keys — do not rely on inherited permissions.
- **W-REG-02**: Use `KEY_READ` or `KEY_WRITE` (not `KEY_ALL_ACCESS`) when opening registry keys.
- **W-REG-03**: Validate all data read from the registry before use (type, size, range).
- **W-REG-04**: Store configuration under `HKLM\SOFTWARE\<Company>\<Product>` with restricted write access.
- **W-REG-05**: NEVER store secrets in plaintext registry values — use DPAPI-encrypted blobs.
- **W-REG-06**: In C#, use `Microsoft.Win32.Registry` with explicit `RegistryRights` when opening keys.

---

## 7. Network Security

> See also: [`common/security-standards.md` §5](../common/security-standards.md) for shared transport security principles (C-TLS-*).

- **W-NET-01**: Configure TLS via Schannel registry settings or `ServicePointManager.SecurityProtocol` in C#.
- **W-NET-02**: In C++, use `WinHTTP` or `WinINet` with `WINHTTP_FLAG_SECURE`.
- **W-NET-03**: In C#, use `HttpWebRequest` / `WebClient` with TLS enforcement (within .NET 4.0 constraints).
- **W-NET-04**: Set timeouts on all network operations to prevent resource exhaustion.

---

## Guideline Reference Index

| Prefix | Section | Count |
|--------|---------|-------|
| W-IPC | Service & IPC Security | 10 |
| W-SIGN | Code Signing & Distribution | 7 |
| W-DLL | DLL Loading Security | 8 |
| W-PROC | Process Trust | 5 |
| W-PRIV | Privilege Management | 4 |
| W-CRED | Credential & Secure Storage | 7 |
| W-REG | Registry Security | 6 |
| W-NET | Network Security | 4 |
| **Total** | | **51** |
