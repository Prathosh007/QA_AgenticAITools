<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: dcnotificationserver -->
<!-- last-updated: 2026-04-02 -->

# Architecture — dcnotificationserver

> 🎯 **Audience:** AI coding agents
> **Scope:** dcnotificationserver
> **Skip if:** Not working on dcnotificationserver

IOCP-based Windows service that handles push notifications to registered endpoint clients.

## Project Overview

| Property | Value |
|----------|-------|
| **Purpose** | Push notification server for registered endpoint agents using I/O Completion Ports |
| **Type** | exe (Windows service) |
| **Architecture** | x86 and x64 (separate solutions) |
| **Solution** | `UEMS_server_native.sln` (x86), `UEMS_server_native64.sln` (x64) |
| **Directory** | `native/dcnotificationserver/` |

## Module Table

| Directory / File | Language | Responsibility |
|-----------------|----------|---------------|
| `src/DCNotificationServer.cpp` | C++ | Main entry (`_tmain`), service lifecycle, SCM registration, arg processing |
| `src/dcnotificationservice.cpp` | C++ | SCM service install/uninstall/start/stop (`InstallSCMService`, `StopSCMService`, `UnInstallSCMService`) |
| `src/EchoServe.cpp` | C++ | Echo/heartbeat handling for client connectivity checks |
| `src/iooperations.cpp` | C++ | IOCP I/O read/write operations on client sockets |
| `src/datamanipulation.cpp` | C++ | Data parsing and notification message construction |
| `src/sslDataManipulation.cpp` | C++ | TLS/SSL encrypted data handling |
| `src/loggerutil.cpp` | C++ | Logging utility functions |
| `src/BoostLogger.cpp` | C++ | Boost-based file logging engine |
| `src/serverservicestatuslistener.cpp` | C++ | Monitors dependent server service status |
| `src/ASIOserver.cpp` | C++ | Boost.Asio server implementation |
| `src/ASIOserverTcp.cpp` | C++ | Boost.Asio TCP server implementation |
| `src/io_context_pool.cpp` | C++ | I/O context pool management |
| `include/dcnotificationserver.h` | C++ | Master header — defines, externs, function prototypes |

## Data Flow

| Step | Component | Action | Thread |
|------|-----------|--------|--------|
| 1 | `_tmain` | Initializes logging, DumpCreator, parses args, dispatches to SCM or service action | Main |
| 2 | `ServiceMain` | Registers service control handler, starts IOCP listener | Main |
| 3 | Accept thread | Accepts incoming client connections on port (`gv_dcNsPortNo`, default 8027) | Accept |
| 4 | IOCP workers | Process I/O completions — read notifications, write responses | Worker pool |
| 5 | Timer queue | Periodic tasks — echo checks, log rotation, client health monitoring | Timer |
| 6 | `LoadNSDBConfSettings` | Reads `dcnsdbsettings.conf` for timeouts, echo, TLS, cipher settings | Main |

## Entry Points

- **`_tmain()`** in `DCNotificationServer.cpp` — parses `-k <port>`, `-a <action>`, service name args
- **Service actions:** `install`, `uninstall`, `start`, `stop`, `reinstall`, `changeport`
- **`ServiceMain()`** — called by SCM via `StartServiceCtrlDispatcher`

## Threading Model

| Thread | Purpose | Synchronization |
|--------|---------|-----------------|
| Main | Service registration, initialization | — |
| Accept thread (`gv_hAcceptThread`) | Listens for new client connections | `gv_csAcceptConnection` critical section |
| Worker threads (`gv_phWorkerThreads`) | IOCP completions | `gv_hIOCompletionPort` |
| Timer queue (`gv_hTimerQueue`) | Periodic echo/health checks | Timer callbacks |
| Logger thread (`hLoggerThread`) | Asynchronous log writing | — |

## Critical Sections

| Variable | Protects |
|----------|----------|
| `gv_csAccessLog` | Client access log file writes |
| `gv_csServiceCtrl` | Service control state transitions |
| `gv_csClientRegisteration` | `regClientList` — registered client list |
| `gv_acceptConnection` | Accept socket operations |

## Key Globals

| Variable | Type | Purpose |
|----------|------|---------|
| `gv_dcNsPortNo` | `u_short` | Listen port (default 8027) |
| `gv_hIOCompletionPort` | `HANDLE` | IOCP handle |
| `gv_sListenSocket` | `SOCKET` | Server listen socket |
| `regClientList` | `REGISTERED_LIST` | Registered client tracking |
| `gv_isTLSenabled` | `bool` | TLS mode flag |
| `gv_isEncEnabled` | `bool` | Encryption enabled flag |

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| DumpCreator.dll | Internal | Crash dump creation on exceptions |
| Boost (logger) | External | File-based logging via `CBoostLogger` |
| OpenSSL / Poco | External | TLS/SSL encryption and crypto (`ECPocoCryptHandler`) |
| Winsock2 | System | TCP socket communication |
| iphlpapi | System | Network adapter queries |

## Known Issues / Gotchas

- Builds in **both x86 and x64** — changes must be tested in both solutions.
- `DumpCreator.dll` path is constructed at runtime — must exist at `<serverDir>\bin\DumpCreator.dll`.
- Service depends on `Tcpip` service (set in `InstallSCMService`).
- Configuration loaded from `../conf/dcnsdbsettings.conf` — relative path from binary location.
- `gv_csClientRegisteration` must be held when modifying `regClientList` — race conditions possible.
- Echo/TLS/cipher settings are runtime-configurable via conf file keys (`ns.echoEnable`, `ns.tlsEnable`, etc.).

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Repo architecture | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Threading model | [`../THREADING_MODEL.md`](../THREADING_MODEL.md) |
| Memory ownership | [`../MEMORY_OWNERSHIP.md`](../MEMORY_OWNERSHIP.md) |
| File locations | [`../../ai-agents/CODEBASE_MAP.md`](../../ai-agents/CODEBASE_MAP.md) |

*Last Updated: 2026-04-02*
