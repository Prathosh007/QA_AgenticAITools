# Linux Coding Standards

> Go standards for UEMS Linux Agent development.

---

## Language Policy

- **Go** is the primary and required language for all new code
- Go version is declared in the build configuration — all code must compile under that version
- Build model: **GOPATH** with `GO111MODULE=off` — dependencies are vendored and extracted at build time
- **CGo** is disabled by default (`CGO_ENABLED=0`) for pure Go builds; enabled only where native UI or GTK integration is required
- **C** requires explicit justification (low-level syscall, hardware, kernel interface)
- Shell scripts are used for build orchestration, installation, and service management only — never for agent logic

## Style Guides

| Language | Authoritative Reference |
|---|---|
| Go | [Effective Go](https://go.dev/doc/effective_go), [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments), [Go Style Guide](https://google.github.io/styleguide/go/) |
| C (CGo) | [CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard) / project conventions |

**Tooling:** `gofmt`, `goimports`, `go vet` — run before every commit. `cppcheck` for C/C++ static analysis (via CI pipeline).

---

## Naming Conventions

### Go
- **Packages**: short, lowercase, single-word — `dcutils`, `crypto`, `logger`, `errors`; no underscores or mixedCase. All agent modules use the `dc` prefix — `dcconfig`, `dcinventory`, `dcpatchscan`, `dcservice`
- **Exported types** (structs, interfaces): `UpperCamelCase` — `ServerInfo`, `HttpConnection`, `AESEncryptor`
- **Unexported identifiers**: `lowerCamelCase` — `parseConfig`, `isRunning`
- **Struct fields (exported)**: `M_` prefix for exported fields — `M_dcServerName`, `M_basicAuthDetails`
- **Struct fields (unexported)**: `m_` prefix for unexported fields — `m_settings`, `m_protocol`, `m_client`
- **Constants**: `ALL_CAPS_WITH_UNDERSCORES` — `PROTOCOL_HTTP`, `IS_TRUE`, `ERROR_CODE_NIL`, `BLOCK_SIZE`, `CONTENT_TYPE_JSON`
- **Errors**: Custom `errors.Error` struct with int codes — `DefaultError(err)`, `CustomError(msg, code)`, `CommandExitError(status)`
- **Booleans**: Read as assertions — `isEnabled`, `hasContent`, `isEmpty`
- **Acronyms**: All caps within identifiers — `HTTPClient`, `ID`, `URL`
- **Test functions**: `Test` prefix + function name — `TestParseConfig`, `TestPolicyManager_Fetch`
- **Receivers**: Use `this` as the receiver name — `func (this *AESEncryptor) Initialize(...)`
- **File naming**: PascalCase for Go files — `DcServiceMain.go`, `HttpSender.go`, `Certificate.go`, `ProcessHandler.go`
- **Platform-specific files**: Platform suffix — `logger_linux.go`, `ProcessHandler_darwin.go`, `FileHandler_windows.go`

### CGo (when justified)
- Follow CERT C naming standards
- Prefix C types/functions exposed to Go with package context
- Keep CGo boundary code minimal

---

## Code Organization

- One package per directory; directory name matches package name
- Keep packages focused and small — one responsibility each
- All agent modules use the `dc` prefix — `dcconfig`, `dcinventory`, `dcservice`
- Utility suffixes: `*Utils.go`, `*Helper.go`, `*Handler.go`, `*Constants.go`
- Main executable entry points: `*Main.go` files
- Platform-specific files: `_linux.go`, `_darwin.go`, `_windows.go` suffix
- Test files: `_test.go` suffix, located in a separate GOPATH test directory
- Use organized comment sections:
  ```go
  // =============================================================================
  // Public API
  // =============================================================================

  // =============================================================================
  // Internal helpers
  // =============================================================================
  ```
- Feature data in dedicated file/store (don't mix unrelated data)

### Import Patterns

Internal packages use GOPATH-relative import paths:
```go
import (
    "dcutils/logger"
    "dcutils/errors"
    "dcutils/http"
    "dcutils/crypto"
    "dcutils/agentdetails"
    "dcutils/productdetails"
)
```

---

## Architecture Patterns

### Singleton / Global State Pattern

The codebase uses singleton-accessor patterns for shared services:

```go
// Logger access — singleton pattern used throughout
// Use dcutils logger (discover exact accessor from workspace)
logger.GetCommonLogger().Println("processing request")
logger.GetCommonLogger().Errorln("operation failed")
logger.GetCommonLogger().DebugPrintln("debug info")
```

### Receiver-Based OOP Pattern

All structs use `this` as the receiver and expose methods via receiver functions:

```go
type HttpConnection struct {
    m_settings  HttpSettings
    m_proxy     HttpProxy
    m_protocol  string
    m_client    *http.Client
    m_transport *http.Transport
}

func (this *HttpConnection) InitSettings(serverInfoPtr *agentdetails.ServerInfo, serverOrDs int) {
    // Initialize HTTP connection settings
}

func (this *HttpConnection) SendRequest(url string) (*http.Response, error) {
    // Send HTTP request
}
```

### Multi-Format Serialization

Structs support JSON, XML, and Plist serialization via struct tags:

```go
type ServerInfo struct {
    M_dcServerName string `json:"servername" xml:"server_fqdn,attr" plist:"SERVERNAME"`
    M_value1       string `json:"value1" plist:"Authtoken"`
}
```

### Service Daemon Pattern

Entry points follow the `*Main.go` pattern with initialization:

```go
package main

import (
    "os"
    // Use dcutils logger and agent utilities — discover exact import paths from workspace
)

var SERVICE_LOGGER *logger.Logger

func main() {
    dcutils.InitializeAgentSettings()
    SERVICE_LOGGER = logger.StartLoggingToFile(...)
    // Initialize agent components
    // Start main processing loop
}
```

### D-Bus / Unix Socket IPC Pattern
```go
// D-Bus is used for Linux system integration (via github.com/godbus/dbus)
// Used for user-level command execution and XDG_RUNTIME_DIR access

// Define service interface
type AgentService interface {
    FetchPolicy(ctx context.Context, policyID string) (*Policy, error)
    ApplyConfig(ctx context.Context, config *Config) error
}

// Server-side: validate caller before processing
func (s *server) handleRequest(ctx context.Context, req *Request) (*Response, error) {
    if err := s.validateCaller(ctx); err != nil {
        // Log using dcutils logger (discover exact accessor from workspace)
        return nil, fmt.Errorf("caller validation failed: %w", err)
    }
    return s.process(ctx, req)
}
```

### Build Tags & Product Variants

The build system uses Go build tags to select product-specific code at compile time:

```go
//go:build DC || UEMS || PMP || RAP
// +build DC UEMS PMP RAP
```

| Product Tag | Description |
|---|---|
| `DC` | Desktop Central on-premise |
| `UEMS` | ManageEngine UEMS on-premise |
| `PMP` | Patch Manager Plus on-premise |
| `RAP` | Remote Access Plus on-premise |
| `*_OD_DEV` | OnDemand Development |
| `*_OD_PROD` | OnDemand Production |
| `*_OD_BOTH` | Both OnDemand environments |
| `*_ALL` | All variants (meta-tag) |

Architecture tags: `AMD`, `AMD32`, `AMD64`, `ARM`, `ARM32`, `ARM64`

Build command pattern:
```bash
GOARCH=amd64 go build -trimpath \
    -tags="<PRODUCT> <ARCH> netgo" \
    -ldflags="-w -s" \
    -o <output_binary> \
    <EntryMain>.go
```

### Concurrency

> Security-specific concurrency rules (bounded lifetimes, DoS prevention, mutex requirements) are in [platform-security.md §8](platform-security.md).

- Use goroutines for concurrent work — always with `context.Context` for cancellation
- Use channels for communication between goroutines
- Use `sync.Mutex` / `sync.RWMutex` for shared state protection
- Use `sync.WaitGroup` for goroutine lifecycle management
- Use `errgroup.Group` for concurrent tasks with error propagation
- **Never leak goroutines** — every goroutine must have a clear exit path
- Handle race conditions — run `go test -race` regularly
- Use `context.WithTimeout` / `context.WithDeadline` for bounded operations
- Implement backpressure with buffered channels or semaphores

---

## Error Handling

The codebase uses a custom error system with integer error codes (`dcutils/errors`).

### Custom Error Type

```go
package errors

type Error struct {
    Message string
    Code    int
}

func DefaultError(defaultErr error) Error
func CustomError(errMsg string, errCode int) Error
func CommandExitError(exitStatus string) Error
```

### Error Code Ranges

| Range | Category | Examples |
|---|---|---|
| `-4` | Panic | `ERROR_CODE_PANIC` |
| `-3` | File not found | `ERROR_CODE_FILE_NOT_FOUND` |
| `-2` | Command exit status | `ERROR_CODE_COMMAND_EXIT_STATUS` |
| `-1` | Default error | `ERROR_CODE_DEFAULT` |
| `0` | No error (nil) | `ERROR_CODE_NIL` |
| `100+` | Service errors | Service-specific failures |
| `200+` | HTTP errors | HTTP communication failures |
| `300+` | Process errors | Process execution failures |
| `500+` | Patch errors | Patch scanning failures |
| `1000+` | Process/FS errors | Filesystem/process failures |
| `1600+` | Agent errors | Agent-specific failures |

### Error Handling Rules

> Security-specific error handling (information disclosure, error codes to server) is in [platform-security.md §15](platform-security.md).

- Handle **all** errors — never use `_` to discard errors unless explicitly justified
- Use `fmt.Errorf("context: %w", err)` to wrap errors with context
- Use `errors.Is` / `errors.As` for error inspection
- Use sentinel errors (`var Err... = errors.New(...)`) for known conditions
- Use custom error types for rich error information
- Return errors; don't panic — `panic` is for truly unrecoverable programming errors only
- **Fail securely** — default deny
- Don't leak sensitive information in error messages
- Close resources with `defer` immediately after successful open

---

## Memory & Resource Management

### Go (GC-managed)

> Secrets clearing and protected memory patterns are in [platform-security.md §7](platform-security.md).

- Use `defer` for resource cleanup (files, connections, locks, response bodies)
- Close `io.ReadCloser` (e.g., `resp.Body`) with `defer` immediately after nil-check
- Avoid unnecessary allocations in hot paths — reuse buffers with `sync.Pool`
- Be aware of slice/map capacity — pre-allocate when size is known
- Clear secrets from memory after use — overwrite byte slices, use `crypto/subtle.ConstantTimeCompare`
- Watch for goroutine leaks — every goroutine must terminate
- Profile with `pprof` — heap, goroutine, CPU profiles

```go
func processFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	// Process file...
	return nil
}

// Secure memory clearing for secrets
func clearSecret(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
```

### CGo Memory (when used)
- Memory allocated by C code must be freed by C code — never by Go's GC
- Use `C.free` for `C.malloc` allocations
- Pin Go memory passed to C with `runtime.Pinner` (Go 1.21+) or careful lifetime management
- Never let C code hold references to Go-managed memory beyond the CGo call

### Profiling Requirements
- Run `pprof` (heap, CPU, goroutine profiles) before delivery
- Run `go test -race` to detect race conditions
- Use `valgrind` for CGo / C code if applicable
- Use `go tool trace` for latency-sensitive code paths
- Verify no goroutine leaks — goroutine count should remain stable under load
- Test on all supported architectures (x86_64 and arm64 at minimum)

---

## Build System

### Build Infrastructure

Linux builds are orchestrated through Docker containers for cross-architecture reproducibility. Builds target multiple architectures: x86 (32-bit legacy), x86_64, ARM32 (ARMv7), and ARM64 (AArch64).

### Build Commands

```bash
# Standard Go agent build
export GO111MODULE=off
export CGO_ENABLED=0
export GOPATH="<go_agent_path>:<linux_agent_path>"

GOARCH=amd64 go build -trimpath \
    -tags="<PRODUCT> <ARCH> netgo" \
    -ldflags="-w -s" \
    -o <output_binary> \
    <EntryMain>.go
```

### C Program Compilation (Hardened)

```bash
gcc -static -Wall \
    -Werror=format-security \
    -Werror=implicit-function-declaration \
    -D_FORTIFY_SOURCE=2 -O2 \
    -fstack-protector-strong \
    -o <output_binary> <source>.c
```

### Testing

```bash
# Unit tests with product and architecture build tags
go test -v -tags="<PRODUCT> <ARCH> netgo" -ldflags "-w -s" ./...
```

- Tests use `go test -v` with product and architecture build tags
- Cross-compiled architecture builds may skip unit tests when binaries can't execute on the build host
- Tests must pass with non-zero exit code to fail the build

### CI/CD Pipeline (GitLab CI)

- **Static analysis**: `cppcheck` for C/C++ code on protected branches
- **Full scan mode**: Entire codebase analysis
- **Incremental mode**: Changed files only (via `git diff`)
- Analysis results stored as CI artifacts

---

## Third-Party Dependencies

All dependencies are vendored as archives and extracted at build time (no runtime package managers):

| Library | Purpose |
|---|---|
| `github.com/godbus/dbus` | Linux D-Bus system integration |
| `github.com/gorilla/websocket` | WebSocket protocol support |
| `github.com/mxk/go-flowrate` | Bandwidth/rate limiting |
| `github.com/knqyf263/go-deb-version` | Debian package version parsing |
| `github.com/knqyf263/go-rpm-version` | RPM package version parsing |
| `github.com/DHowett/go-plist` | macOS plist parsing (cross-platform) |
| `github.com/paulrosania/go-charset` | Character set conversion |
| `github.com/expr-lang/expr` | Expression language evaluation |
| `golang.org/x/crypto` | Cryptography (OpenPGP, TLS) |

---

## OS / Hardware Compatibility

| Dimension | Requirement |
|---|---|
| Distributions | Ubuntu LTS (20.04, 22.04, 24.04), RHEL/CentOS (7, 8, 9), Debian (11, 12), SLES (15), openSUSE, Fedora, Arch |
| Package managers | APT (Debian/Ubuntu), YUM/DNF (RHEL/CentOS/Fedora), Zypper (openSUSE/SLES), Pacman (Arch) |
| Architectures | x86 (32-bit legacy), x86_64 (primary), ARM32/ARMv7, ARM64/AArch64 |
| Go version | As declared in build configuration — ensure CI matches |
| Init system | systemd (primary), SysVinit fallback where required |
| New APIs | Runtime checks for OS/kernel features with fallback behavior |

---

## CGo Interop (When Justified)

```go
/*
#cgo LDFLAGS: -ldl
#include <dlfcn.h>
#include <stdlib.h>
*/
import "C"

import (
	"fmt"
	"unsafe"
)

// LoadLibrary loads a shared library using a full absolute path.
// Security — always use full paths; never rely on LD_LIBRARY_PATH.
func LoadLibrary(fullPath string) (unsafe.Pointer, error) {
	cPath := C.CString(fullPath)
	defer C.free(unsafe.Pointer(cPath))

	handle := C.dlopen(cPath, C.RTLD_LAZY)
	if handle == nil {
		return nil, fmt.Errorf("dlopen %s: %s", fullPath, C.GoString(C.dlerror()))
	}
	return handle, nil
}
```

### Rules
- Isolate CGo in dedicated packages — do not scatter `import "C"` across the codebase
- Document why CGo is needed (must be justified — no pure-Go alternative)
- Use full paths for `dlopen` / shared library loading
- Handle C errors immediately and convert to Go errors
- Free all C-allocated memory explicitly
- Test CGo code on all target architectures

---

## Documentation

### Function-Level Comments (Mandatory)

**Every exported function/method must have a Go doc comment** (line starting with `// FunctionName ...`):
- **What** it does (first sentence is the summary)
- **Parameters** (each parameter's purpose — described in prose, not tags)
- **Returns** (what is returned and error conditions)
- **Security notes** (if the function handles sensitive data, trust boundaries, or privileged operations)

```go
// ValidatePeerCredentials checks the Unix socket peer credentials to verify
// the caller is running as the expected system user. Returns an error if the
// peer UID does not match the expected UID or if credentials cannot be retrieved.
//
// Security — this is a trust boundary. All IPC callers must be validated
// before any privileged operation is performed.
func ValidatePeerCredentials(conn net.Conn, expectedUID uint32) error {
	// ...
}
```

```go
// FetchPolicy retrieves the latest policy configuration from the management server.
// It sends an authenticated HTTPS request, parses the JSON response, and persists
// the updated policy to the local encrypted store. Falls back to the cached policy
// if the network request fails.
//
// The endpoint URL must be a valid HTTPS URL. Timeout defaults to 30 seconds if zero.
// Returns ErrUnauthorized if the auth token is expired or invalid.
// Returns ErrNetworkFailure if the server is unreachable after retries.
func FetchPolicy(ctx context.Context, endpoint string, timeout time.Duration) (*Policy, error) {
	// ...
}
```

### Rules
- **Every** exported function/type/const/var must have a doc comment — `golint` enforces this
- **Every** unexported function should have at least a one-line `//` summary
- Internal/complex logic must have inline `//` comments explaining **why**, not what
- Document non-obvious side effects (file writes, signals sent, goroutines spawned)
- Document concurrency expectations (e.g., "safe for concurrent use", "must hold mu")
- Keep documentation synchronized with code — stale docs are worse than no docs
- Document security assumptions at trust boundaries

### General Documentation
- Document all public APIs (parameters, return values, errors)
- Explain complex algorithms with inline comments
- Document security assumptions
- Add examples in `_test.go` files (`func ExampleFetchPolicy()`)
- Keep documentation synchronized with code

---

## Localization

- Externalize user-visible strings using `gettext`, i18n packages, or string tables
- Proper formatting/plurals handling
- No hard-coded user-facing strings in source code
- Use UTF-8 encoding throughout
