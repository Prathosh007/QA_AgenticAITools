# Mac Coding Standards

> Swift 5 / Objective-C standards for UEMS Mac Agent development.

---

## Language Policy

- **Swift 5** is the primary language for all new code (hard requirement)
- `SWIFT_VERSION` must be set in project settings / xcconfig
- **Objective-C** requires explicit justification (legacy interop, specific framework needs)
- Never mix Classic/Modern patterns within a single file

## Style Guides

| Language | Authoritative Reference |
|---|---|
| Swift | [Google Swift Style Guide](https://google.github.io/swift/) |
| Objective-C | [Google Objective-C Style Guide](https://google.github.io/styleguide/objcguide.html) |

**Tooling:** `swiftlint`, `swiftformat`

---

## Naming Conventions

### Swift
- **Types** (classes, structs, enums, protocols): `UpperCamelCase` — `MyFeatureManager`, `ServiceProtocol`
- **Functions, methods, properties, variables, constants**: `lowerCamelCase` — `performAction()`, `isConnected`
- **Enum cases**: `lowerCamelCase` — `.invalidInput`
- **Global constants**: `lowerCamelCase` — `let defaultTimeout = 30`
- **Acronyms**: Treat as words — `httpUrl` not `hTTPURL`, `XpcService` not `XPCService`
- **Booleans**: Read as assertions — `isEmpty`, `hasContent`, `isEnabled`
- **Factory methods**: `make` prefix — `makeIterator()`
- **Protocols (capability)**: `-able`, `-ible`, `-ing` — `Equatable`, `ProgressReporting`
- **Protocols (identity)**: Noun — `Collection`

### Objective-C
- **Classes**: Prefix + `UpperCamelCase` — `AGTServiceManager`
- **Methods**: `lowerCamelCase` with descriptive parameter labels
- **Properties**: `lowerCamelCase`
- **Constants**: Prefix + `k` + `CamelCase` — `kAGTDefaultTimeout`
- **Enums**: Prefix + `CamelCase` — `AGTConnectionState`
- **Macros**: `ALL_CAPS_WITH_UNDERSCORES`
- **Categories**: `ClassName+Extension` — `NSString+AGTValidation`

---

## Code Organization

- One primary type per file; filename matches the type name
- Group related files in logical directories
- Use `// MARK: -` sections:
  ```swift
  // MARK: - Properties
  // MARK: - Initialization
  // MARK: - Public Methods
  // MARK: - Private Methods
  // MARK: - Protocol Conformance
  ```
- Extensions for protocol conformance in separate `// MARK:` sections or files
- Feature data in dedicated file/table (don't mix unrelated data)

---

## Architecture Patterns

### Protocol-Oriented Design
- Use protocols to define interfaces
- Prefer composition over inheritance
- Use protocol extensions for default implementations
- Use value types (`struct`, `enum`) where appropriate

### XPC Service Pattern (macOS IPC)
```swift
// 1. Define protocol with @objc
@objc protocol MyServiceProtocol {
    func performAction(withParam param: String, reply: @escaping (Bool, Error?) -> Void)
}

// 2. Implement NSXPCListenerDelegate
class MyServiceDelegate: NSObject, NSXPCListenerDelegate {
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard validateConnection(connection) else {
            // Log using Agent-Utils logging wrapper (discover class name from workspace)
            // e.g., logger.log(level: .error, category: "XPC", message: "Connection validation failed")
            return false
        }
        connection.exportedInterface = NSXPCInterface(with: MyServiceProtocol.self)
        connection.exportedObject = MyService()
        connection.invalidationHandler = { /* handle */ }
        connection.interruptionHandler = { /* handle */ }
        connection.resume()
        return true
    }
}
```

### Concurrency
- Use `DispatchQueue` appropriately (main, global, custom serial/concurrent)
- Use `OperationQueue` for complex dependency chains
- Use `async/await` and structured concurrency (Swift 5.5+)
- **Never block the main thread**
- Handle race conditions with proper synchronization
- Isolate heavy operations from service main loop
- Implement backpressure mechanisms for producers/consumers

---

## Error Handling

```swift
enum MyFeatureError: Error {
    case invalidInput(String)
    case networkFailure(Error)
    case unauthorizedAccess
    case unknown
}

func performOperation() throws {
    guard validateInput() else {
        throw MyFeatureError.invalidInput("Input validation failed")
    }
    do {
        try performNetworkRequest()
    } catch {
        // Log using Agent-Utils logging wrapper (discover class name from workspace)
        // e.g., logger.log(level: .error, category: "MyFeature", message: "Network request failed", error: error)
        throw MyFeatureError.networkFailure(error)
    }
}
```

### Rules
- Handle **all** error returns — never skip or swallow
- Provide meaningful error messages
- Propagate errors appropriately
- Use `do-try-catch`, `Result` type
- Implement retry logic where appropriate
- **Fail securely** — default deny
- Don't leak sensitive information in error messages

---

## Memory Management (ARC)

- Avoid retain cycles: `[weak self]` or `[unowned self]` in closures
- Remove observers in `deinit`
- Use `weak` for delegate references
- Clear secrets from memory after use

```swift
class MyManager {
    private var completionHandler: (() -> Void)?

    func setupObserver() {
        NotificationCenter.default.addObserver(
            forName: .myNotification, object: nil, queue: nil
        ) { [weak self] notification in
            self?.handleNotification(notification)
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
```

### Profiling Requirements
- Run Instruments (Allocations, Leaks, Time Profiler) before delivery
- Verify no memory leaks
- Profile CPU usage for long-running operations
- Check memory footprint
- Test on both Intel (x86_64) and Apple Silicon (arm64)

---

## OS / Hardware Compatibility

| Dimension | Requirement |
|---|---|
| macOS versions | 12 (Monterey), 13 (Ventura), 14 (Sonoma), 15 (Sequoia) |
| Architectures | Intel (x86_64) **and** Apple Silicon (arm64) — Universal 2 binary |
| New APIs | `#available` / `@available` checks with fallback behavior |

---

## Objective-C Interop (When Required)

- Modern ObjC: nullability annotations, lightweight generics
- Proper ARC memory management
- Bridge safely to Swift: `NS_SWIFT_NAME`, `NS_REFINED_FOR_SWIFT`
- Follow naming conventions (prefixes, clarity)

---

## Documentation

### Method-Level Comments (Mandatory)

**Every method/function must have a documentation comment** explaining:
- **What** it does (one-line summary)
- **Parameters** (each parameter's purpose)
- **Returns** (what is returned and when)
- **Throws** (what errors can be thrown and under what conditions)
- **Security notes** (if the method handles sensitive data, trust boundaries, or privileged operations)

Use Swift's `///` doc comments (or `/** */` in Objective-C):

```swift
/// Validates the incoming XPC connection against the expected code signing identity.
///
/// Checks the connection's audit token and verifies the caller's code signature
/// matches the expected team identifier and signing requirements. Rejects
/// connections that fail any validation step.
///
/// - Parameter connection: The incoming XPC connection to validate.
/// - Returns: `true` if the connection passes all security checks; `false` otherwise.
/// - Note: Security — this is a trust boundary. All callers must be validated
///   before any exported interface is exposed.
func validateConnection(_ connection: NSXPCConnection) -> Bool { ... }
```

```swift
/// Fetches the latest policy configuration from the server.
///
/// Sends an authenticated request to the management server, parses the
/// response, and persists the updated policy to local secure storage.
/// Falls back to the cached policy if the network request fails.
///
/// - Parameters:
///   - endpoint: The server endpoint URL to fetch the policy from.
///   - timeout: Maximum time in seconds to wait for a response. Defaults to 30.
/// - Returns: The parsed `PolicyConfiguration`, or `nil` if both fetch and cache fail.
/// - Throws: `PolicyError.unauthorized` if the auth token is expired or invalid.
/// - Throws: `PolicyError.invalidResponse` if the server response cannot be parsed.
func fetchPolicy(from endpoint: URL, timeout: TimeInterval = 30) throws -> PolicyConfiguration? { ... }
```

**Objective-C example:**
```objc
/**
 * Registers the agent with the management server using the provided enrollment token.
 *
 * Validates the token format, establishes a secure connection to the server,
 * and completes the enrollment handshake. Stores the resulting agent certificate
 * in the secure storage wrapper upon success.
 *
 * @param enrollmentToken The one-time enrollment token provided by the admin.
 * @param completion Called on completion with the registration result or error.
 *                   Always called on the main queue.
 *
 * @note Security — the enrollment token is cleared from memory after use.
 */
- (void)registerWithToken:(NSString *)enrollmentToken
               completion:(void (^)(BOOL success, NSError * _Nullable error))completion;
```

### Rules
- **Every** public method/function must have a doc comment — no exceptions
- **Every** private method must have at least a one-line `///` summary
- Internal/complex logic must have inline `//` comments explaining **why**, not what
- Document non-obvious side effects (state changes, notifications posted, files written)
- Document threading/concurrency expectations (e.g., "Must be called on main thread")
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

- Externalize user-visible strings: `NSLocalizedString` / `.strings` files
- Proper formatting/plurals handling
- No hard-coded user-facing strings
