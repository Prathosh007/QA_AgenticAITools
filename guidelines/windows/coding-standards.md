# Windows Coding Standards

> C++ 17 with Windows SDK Version 10.0.20348.0 / C# (.NET 4.0) for UEMS Windows Agent Development.

---

## Language Policy

- **C++ 17** is the primary language for native agent components (services, drivers, core engine)
- **C# (.NET Framework 4.0)** is used for managed components (UI, tooling, management utilities)
- C++ standard: ISO C++17 (`/std:c++17` compiler flag)
- Windows SDK Version: **10.0.20348.0**
- Platform Toolset: **v143** (Visual Studio 2022) or as required by project
- Do not mix C and C++ idioms within a single file — use C++ constructs consistently
- C++/CLI interop requires explicit justification (prefer COM or P/Invoke for managed↔native boundary)

## Style Guides

| Language | Authoritative Reference |
|---|---|
| C++ | [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines), [C++ Coding Guidelines](https://google.github.io/styleguide/cppguide.html) |
| C# | [Microsoft C# Coding Conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions) |

**Tooling:** `clang-tidy`, `clang-format` (C++, C#); Visual Studio Analysis

---

## Naming Conventions

### C++
- **Classes / Structs / Enums**: `PascalCase` — `PolicyManager`, `ServiceConfig`
- **Functions / Methods**: `PascalCase` — `InitializeService()`, `ValidateInput()`
- **Local variables**: `camelCase` — `bufferSize`, `isConnected`
- **Member variables**: `m_` prefix + `camelCase` — `m_serviceHandle`, `m_isRunning`
- **Static member variables**: `s_` prefix + `camelCase` — `s_instance`
- **Global constants**: `g_` prefix + `PascalCase` — `g_DefaultTimeout`, `g_MaxRetryCount` or `gv_` prefix + `PascalCase`
- **Macros**: `ALL_CAPS_WITH_UNDERSCORES` — `UEMS_AGENT_VERSION`
- **Enum values**: `PascalCase` — `enum class ConnectionState { Connected, Disconnected, Pending }`
- **Namespaces**: `lowercase` — `uems::agent`, `uems::policy`
- **Booleans**: Read as assertions — `isEnabled`, `hasContent`, `isEmpty`
- **Pointer parameters**: Use descriptive names, no Hungarian notation — `buffer` not `lpBuffer`
- **Template parameters**: `PascalCase` with `T` prefix or descriptive name — `TValue`, `TCallback`

### C# (.NET 4.0)
- **Classes / Structs / Enums / Interfaces**: `PascalCase` — `PolicyManager`, `IServiceHandler`
- **Interfaces**: `I` prefix + `PascalCase` — `IConfigProvider`, `IAgentService`
- **Public methods / Properties**: `PascalCase` — `InitializeService()`, `IsConnected`
- **Private fields**: `_` prefix + `camelCase` — `_serviceHandle`, `_isRunning`
- **Local variables / Parameters**: `camelCase` — `bufferSize`, `retryCount`
- **Constants**: `PascalCase` — `DefaultTimeout`, `MaxRetryCount`
- **Enum values**: `PascalCase` — `ConnectionState.Connected`
- **Namespaces**: `PascalCase` dot-separated — `Uems.Agent.Policy`
- **Events**: `PascalCase` with verb/noun — `ConnectionEstablished`, `PolicyChanged`
- **Async methods**: `Async` suffix — `FetchPolicyAsync()`

---

## Code Organization

### C++
- Use `#pragma once` for header include guards
- Group related files in logical directories
- Header file ordering: system headers → Windows SDK headers → third-party headers → internal dependencies header (For internal repo dependencies header should be followed by repo name) → project headers (separated by blank lines)
- Use forward declarations in headers where possible to reduce compile-time dependencies
- Use organized comment sections:
  ```cpp
  // ============================================================================
  // Public Methods
  // ============================================================================

  // ============================================================================
  // Private Methods
  // ============================================================================
  ```
- Feature data in dedicated file/table (don't mix unrelated data)

### C#
- One primary type per file; filename matches the type name (`PolicyManager.cs`)
- Use `#region` / `#endregion` sparingly — prefer small, focused classes
- Group related files by feature in project folders
- Namespace matches folder structure
- Order members: fields → constructors → properties → public methods → private methods

---

## Architecture Patterns

### Interface-Driven Design
- Use abstract base classes (C++) or interfaces (C#) to define contracts
- Prefer composition over inheritance
- Use dependency injection where practical
- Use value types and RAII (C++) / `using` statements (C#) for resource management

### Windows Service Pattern (IPC / Services)
```cpp
#include <windows.h>

// Service entry point
class AgentService {
public:
    static void WINAPI ServiceMain(DWORD argc, LPWSTR* argv);
    static void WINAPI ServiceCtrlHandler(DWORD controlCode);

    bool Initialize();
    void Run();
    void Stop();

private:
    SERVICE_STATUS        m_serviceStatus{};
    SERVICE_STATUS_HANDLE m_statusHandle = nullptr;
    HANDLE                m_stopEvent = nullptr;

    void ReportStatus(DWORD currentState, DWORD exitCode, DWORD waitHint);
};

void WINAPI AgentService::ServiceCtrlHandler(DWORD controlCode) {
    switch (controlCode) {
        case SERVICE_CONTROL_STOP:
        case SERVICE_CONTROL_SHUTDOWN:
            // Log using Agent-Utils logging wrapper (discover class name from workspace)
            ReportStatus(SERVICE_STOP_PENDING, NO_ERROR, 0);
            SetEvent(m_stopEvent);
            break;
        case SERVICE_CONTROL_INTERROGATE:
            break;
        default:
            break;
    }
}
```

### COM Interop Pattern (Native ↔ Managed Boundary)
```cpp
// Define COM interface for cross-boundary communication
#include <objbase.h>

// {GUID} — generate unique GUID per interface
MIDL_INTERFACE("00000000-0000-0000-0000-000000000000")
IAgentCallback : public IUnknown {
    virtual HRESULT STDMETHODCALLTYPE OnPolicyUpdate(
        /* [in] */ BSTR policyData) = 0;
    virtual HRESULT STDMETHODCALLTYPE OnStatusChange(
        /* [in] */ DWORD statusCode) = 0;
};
```

### C# Service Component
```csharp
using System;
using System.ServiceProcess;

/// <summary>
/// Managed service component for UEMS Windows Agent.
/// </summary>
public class AgentManagedService : ServiceBase
{
    private readonly IAgentEngine _engine;

    public AgentManagedService(IAgentEngine engine)
    {
        _engine = engine ?? throw new ArgumentNullException(nameof(engine));
        ServiceName = "UEMSAgent";
    }

    protected override void OnStart(string[] args)
    {
        // Log using Agent-Utils logging wrapper (discover class name from workspace)
        _engine.Initialize();
        _engine.Start();
    }

    protected override void OnStop()
    {
        _engine.Stop();
    }
}
```

### Concurrency

#### C++
- Use `std::thread`, `std::mutex`, `std::lock_guard`, `std::unique_lock` for thread safety
- Use `std::atomic` for lock-free shared counters and flags
- Use Windows thread pool (`CreateThreadpoolWork`, `SubmitThreadpoolWork`) for scalable async work
- Use `CRITICAL_SECTION` when Windows-specific synchronization is required
- **Never block the main service thread**
- Handle race conditions with proper synchronization primitives
- Use RAII wrappers for synchronization objects
- Implement backpressure mechanisms for producers/consumers

#### C#
- Use `lock` keyword for simple synchronization
- Use `Thread`, `ThreadPool`, or `BackgroundWorker` (within .NET 4.0 constraints)
- Use `ManualResetEvent` / `AutoResetEvent` for signaling
- **Never block the UI thread** in managed UI components
- Use `delegate.BeginInvoke` / `EndInvoke` for asynchronous delegate calls
- Use thread-safe collections from `System.Collections.Concurrent` where available

---

## Error Handling

### C++
```cpp
#include <stdexcept>
#include <system_error>
#include <windows.h>

enum class AgentError {
    InvalidInput,
    NetworkFailure,
    UnauthorizedAccess,
    ServiceUnavailable
};

/// Performs the policy fetch operation.
/// Throws std::runtime_error on failure.
void PerformOperation() {
    if (!ValidateInput()) {
        // Log using Agent-Utils logging wrapper (discover class name from workspace)
        throw std::invalid_argument("Input validation failed");
    }

    HRESULT hr = PerformNetworkRequest();
    if (FAILED(hr)) {
        // Log using Agent-Utils logging wrapper
        throw std::system_error(
            hr, std::system_category(), "Network request failed");
    }
}

/// Wrapper for Win32 API calls — checks GetLastError() on failure.
void SecureDeleteFile(const std::wstring& filePath) {
    if (!::DeleteFileW(filePath.c_str())) {
        DWORD err = ::GetLastError();
        // Log using Agent-Utils logging wrapper
        throw std::system_error(
            static_cast<int>(err), std::system_category(), "DeleteFile failed");
    }
}
```

### C#
```csharp
using System;

/// <summary>Custom exception for agent policy operations.</summary>
public class PolicyException : Exception
{
    public PolicyErrorCode ErrorCode { get; }

    public PolicyException(PolicyErrorCode code, string message)
        : base(message)
    {
        ErrorCode = code;
    }

    public PolicyException(PolicyErrorCode code, string message, Exception inner)
        : base(message, inner)
    {
        ErrorCode = code;
    }
}

public void PerformOperation()
{
    if (!ValidateInput())
    {
        // Log using Agent-Utils logging wrapper
        throw new PolicyException(
            PolicyErrorCode.InvalidInput, "Input validation failed");
    }

    try
    {
        PerformNetworkRequest();
    }
    catch (Exception ex)
    {
        // Log using Agent-Utils logging wrapper
        throw new PolicyException(
            PolicyErrorCode.NetworkFailure, "Network request failed", ex);
    }
}
```

### Rules
- Handle **all** error returns — never skip or swallow `HRESULT`, `GetLastError()`, or exceptions
- Check **every** Win32 API return value; wrap with consistent error-reporting patterns
- Provide meaningful error messages
- Propagate errors appropriately — do not catch and silently discard
- Use C++ exceptions for exceptional conditions; use `HRESULT` / error codes for expected failures at API boundaries
- Use structured exception handling (`__try` / `__except`) only for SEH-level crashes, never for flow control
- Implement retry logic where appropriate (network, transient OS errors)
- **Fail securely** — default deny
- Don't leak sensitive information in error messages or log output

---

## Memory Management

### C++ (Manual / RAII)
- Use **RAII** for all resource management — smart pointers, handle wrappers, lock guards
- Use `std::unique_ptr` for exclusive ownership; `std::shared_ptr` only when shared ownership is genuinely required
- Use `std::make_unique` / `std::make_shared` to create smart pointers
- Wrap Win32 handles in RAII classes (e.g., custom deleters with `std::unique_ptr`)
- Zero-fill and securely clear buffers containing secrets before freeing (`SecureZeroMemory`)
- Never use raw `new` / `delete` in application code — use smart pointers or containers
- Avoid `malloc` / `free` — prefer C++ allocators and containers

```cpp
#include <memory>
#include <windows.h>

// RAII wrapper for Win32 HANDLE
struct HandleDeleter {
    void operator()(HANDLE h) const {
        if (h && h != INVALID_HANDLE_VALUE) {
            ::CloseHandle(h);
        }
    }
};
using UniqueHandle = std::unique_ptr<void, HandleDeleter>;

// Usage
void PerformFileOperation(const std::wstring& path) {
    UniqueHandle fileHandle(::CreateFileW(
        path.c_str(), GENERIC_READ, FILE_SHARE_READ,
        nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr));

    if (!fileHandle || fileHandle.get() == INVALID_HANDLE_VALUE) {
        throw std::system_error(
            static_cast<int>(::GetLastError()),
            std::system_category(), "CreateFile failed");
    }
    // Handle is automatically closed when UniqueHandle goes out of scope
}

// Secure memory clearing
void ClearSensitiveBuffer(void* buffer, size_t size) {
    ::SecureZeroMemory(buffer, size);
}
```

### C# (.NET 4.0)
- Use `using` statements / `IDisposable` for all unmanaged resources
- Use `SafeHandle` or `CriticalHandle` for Win32 handle wrappers via P/Invoke
- Clear secrets from memory after use — overwrite `byte[]` arrays, use `SecureString` for passwords
- Avoid finalizers unless wrapping unmanaged resources with no `SafeHandle` available
- Be cautious with large object heap allocations (>85 KB)

```csharp
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

/// <summary>
/// Safe wrapper for a native agent handle.
/// </summary>
internal class SafeAgentHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    private SafeAgentHandle() : base(true) { }

    protected override bool ReleaseHandle()
    {
        return NativeMethods.CloseAgentHandle(handle);
    }
}

// Usage with using statement
using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read))
{
    // Read operations — stream is disposed automatically
}
```

### Profiling Requirements
- Run Visual Studio Diagnostics Tools (Memory Usage, CPU Usage) before delivery
- Use Application Verifier for heap corruption and handle leak detection
- Verify no memory or handle leaks
- Profile CPU usage for long-running operations
- Check working set / private bytes footprint
- Test on both x86 and x64 architectures

---

## OS / Hardware Compatibility

| Dimension | Requirement |
|---|---|
| Windows versions | Windows 7 and above workstation OS version, Windows Server 2008R2 and above server OS version |
| Architectures | x86 (32-bit) **and** x64 (64-bit) |
| Windows SDK | 10.0.20348.0 |
| C++ Standard | C++17 (`/std:c++17`) |
| .NET Framework | 4.0 (C# components) |
| Runtime | Visual C++ Redistributable (matching platform toolset version) |
| New APIs | Runtime version checks via `IsWindowsVersionOrGreater()` or `VerifyVersionInfoW()` with fallback behavior |
| New APIs | Introduced API should support in mentioned Windows version and implemented with maximum safe and security. |

---

## C++ / C# Interop (When Required)

### P/Invoke (C# calling native C++ DLLs)
```csharp
using System.Runtime.InteropServices;

internal static class NativeMethods
{
    private const string AgentCoreDll = "AgentCore.dll";

    /// <summary>Initializes the native agent engine.</summary>
    /// <param name="configPath">Path to the configuration file.</param>
    /// <returns>True if initialization succeeded.</returns>
    [DllImport(AgentCoreDll, CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool InitializeEngine(string configPath);

    /// <summary>Shuts down the native agent engine.</summary>
    [DllImport(AgentCoreDll, SetLastError = true)]
    internal static extern void ShutdownEngine();

    /// <summary>Closes a native agent handle.</summary>
    [DllImport(AgentCoreDll, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool CloseAgentHandle(IntPtr handle);
}
```

### COM Interop
- Define interfaces with proper GUIDs and IDL when crossing native↔managed boundaries
- Use `[ComVisible(true)]` and `[Guid("...")]` in C# for COM-exposed types
- Register/unregister COM objects properly during install/uninstall
- Use `Marshal.ReleaseComObject` to release COM references deterministically in C#

### Rules
- Always specify `CharSet = CharSet.Unicode` for string marshaling (avoid ANSI)
- Use `SetLastError = true` when the native function calls `SetLastError`
- Wrap all P/Invoke calls with proper error checking (`Marshal.GetLastWin32Error()`)
- Keep interop declarations in a dedicated `NativeMethods` class (internal, static)
- Test interop on both x86 and x64

---

## Documentation

### Method-Level Comments (Mandatory)

**Every method/function must have a documentation comment** explaining:
- **What** it does (one-line summary)
- **Parameters** (each parameter's purpose)
- **Returns** (what is returned and when)
- **Errors** (what errors / exceptions can occur and under what conditions)
- **Security notes** (if the method handles sensitive data, trust boundaries, or privileged operations)

### C++ (Doxygen-style)
```cpp
/**
 * @brief Validates the caller's process identity against the expected code signing certificate.
 *
 * Retrieves the digital signature of the calling process and verifies it matches
 * the expected UEMS signing certificate thumbprint. Rejects callers that fail
 * any validation step.
 *
 * @param processId  The PID of the calling process to validate.
 * @return true if the caller passes all security checks; false otherwise.
 *
 * @note Security — this is a trust boundary. All callers must be validated
 *       before any privileged operation is performed.
 */
bool ValidateCallerIdentity(DWORD processId);
```

```cpp
/**
 * @brief Fetches the latest policy configuration from the management server.
 *
 * Sends an authenticated HTTPS request to the management server, parses the
 * JSON response, and persists the updated policy to the local secure store.
 * Falls back to the cached policy if the network request fails.
 *
 * @param endpoint   The server endpoint URL to fetch the policy from.
 * @param timeoutMs  Maximum time in milliseconds to wait for a response. Defaults to 30000.
 * @return The parsed PolicyConfig, or std::nullopt if both fetch and cache fail.
 * @throws std::runtime_error if the auth token is expired or invalid.
 * @throws std::system_error if a network-level error occurs.
 */
std::optional<PolicyConfig> FetchPolicy(
    const std::wstring& endpoint, DWORD timeoutMs = 30000);
```

### C# (XML doc comments)
```csharp
/// <summary>
/// Registers the agent with the management server using the provided enrollment token.
/// </summary>
/// <remarks>
/// Validates the token format, establishes a secure connection to the server,
/// and completes the enrollment handshake. Stores the resulting agent certificate
/// in the Windows certificate store upon success.
/// <para>Security — the enrollment token is cleared from memory after use.</para>
/// </remarks>
/// <param name="enrollmentToken">The one-time enrollment token provided by the admin.</param>
/// <returns>True if registration succeeded; false otherwise.</returns>
/// <exception cref="PolicyException">
/// Thrown when the server rejects the enrollment token or a network error occurs.
/// </exception>
public bool Register(string enrollmentToken);
```

### Rules
- **Every** public method/function must have a doc comment — no exceptions
- **Every** private method must have at least a one-line `///` (C#) or `/** @brief */` (C++) summary
- Internal/complex logic must have inline `//` comments explaining **why**, not what
- Document non-obvious side effects (state changes, registry writes, files written, events signaled)
- Document threading/concurrency expectations (e.g., "Must be called from the service main thread")
- Keep documentation synchronized with code — stale docs are worse than no docs
- Document security assumptions at trust boundaries

### General Documentation
- Document all public APIs (parameters, return values, errors)
- Explain complex algorithms with inline comments
- Document security assumptions
- Add examples for non-obvious usage
- Keep documentation synchronized with code

---

## Localization

- Externalize user-visible strings into resource files (`.rc` string tables for C++, `.resx` files for C#)
- Use `LoadStringW` (C++) or `ResourceManager` (C#) to retrieve localized strings
- Proper formatting/plurals handling
- No hard-coded user-facing strings in source code
- Use Unicode (`wchar_t` / `std::wstring` in C++, `string` in C#) throughout
