<!-- audience: ai-agents -->
<!-- doc-type: workflow -->
<!-- project: dcnotificationserver -->
<!-- last-updated: 2026-04-02 -->

# Workflows — dcnotificationserver

> 🎯 **Audience:** AI coding agents
> **Scope:** dcnotificationserver (IOCP-based notification server Windows service)
> **Read when:** Debugging or extending runtime behavior of dcnotificationserver

Runtime workflow documentation for the IOCP notification server.

## Table of Contents

1. [Service Lifecycle](#1-service-lifecycle)
2. [Client Connection Flow](#2-client-connection-flow)
3. [IOCP I/O Processing](#3-iocp-io-processing)
4. [Timer-Based Log Management](#4-timer-based-log-management)

---

## 1. Service Lifecycle

**Files:** `src/DCNotificationServer.cpp`, `src/dcnotificationservice.cpp`

### Flow

```
_tmain(argc, argv)
   │
   ├── GetNotifyServerDir() → gv_notifyServerDir
   ├── GetNSLoggerLevelFromRegistry() → gv_LoggerLevel
   ├── RotateNSLogs() / RotateNotifyServerLog()
   ├── StartNSLoggingEngines()
   │
   ├── ProcessInputArgs(argc, argv)
   │      │
   │      ├── -a install  → InstallSCMService() → DoUpdateSvcDacl()
   │      ├── -a uninstall → StopSCMService() → UnInstallSCMService()
   │      ├── -a start    → StartSCMService()
   │      ├── -a stop     → StopSCMService()
   │      ├── -a reinstall → Stop → Uninstall → Install
   │      ├── -a changeport → ChangeServicePort()
   │      └── (no action)  → StartServiceCtrlDispatcher(lpServiceStartTable)
   │                              │
   │                              └── ServiceMain()
   │
   └── ServiceMain()
          │
          ├── RegisterServiceCtrlHandlerEx(HandlerEx)
          ├── LoadNSDBConfSettings() → TLS, encryption, cipher config
          ├── CreateTimerQueue() → gv_hTimerQueue
          ├── LoggerThread via CreateThread()
          ├── CServerServiceStatusListener::Initialize() + Start()
          ├── StartServerInThread() or StartServer()
          │      │
          │      ├── Initialize()
          │      │     ├── GetNoOfProcessors() → worker thread count
          │      │     ├── InitializeCriticalSection(gv_csClientRegisteration)
          │      │     ├── WSAStartup()
          │      │     └── InitializeIOCP()
          │      │
          │      ├── WSASocket(WSA_FLAG_OVERLAPPED)
          │      ├── bind() → listen(SOMAXCONN)
          │      ├── WSACreateEvent() + WSAEventSelect(FD_ACCEPT)
          │      └── AcceptThread via CreateThread()
          │
          ├── WaitForSingleObject(hStopEvent, INFINITE)
          │
          └── StopRunningService() → cleanup
```

### Key Rules

- Service name/display name/description are configurable via `-n`, `-d`, `-m` args
- Port is set via `-k <port>` (default: 8027)
- DACL permissions updated for `serviceLogOnUserGroup` via `-u` arg on install
- `hStopEvent` signals `ServiceMain` to exit; set by `HandlerEx` on `SERVICE_CONTROL_STOP`
- Critical sections `gv_csServiceCtrl` and `gv_csAccessLog` must be deleted on exit

---

## 2. Client Connection Flow

**Files:** `src/dcnotifcationserverutil.cpp`, `src/datamanipulation.cpp`

### Flow

```
AcceptThread (dedicated thread on listen socket)
   │
   ├── WSAWaitForMultipleEvents(gv_hAcceptEvent)
   ├── accept() → new client SOCKET
   ├── CreateIoCompletionPort(clientSocket, gv_hIOCompletionPort)
   │       (associates socket with IOCP)
   ├── Allocate pClientInfo context
   └── ReceiveClientEvents(pCtInfo) → WSARecv() [posts first async read]
          │
          └── IOCP worker picks up completion
                 │
                 ├── ValidateAndRegisterNSClients(pCtInfo)
                 │      │
                 │      ├── Parse: format=REGISTER → 
                 │      │     ├── Extract resourceID, contact times
                 │      │     ├── RegisterNSClients(pCtInfo)
                 │      │     │     ├── EnterCriticalSection(gv_csClientRegisteration)
                 │      │     │     ├── regClientList.insert(resourceID, nsctInfo)
                 │      │     │     │     └── If duplicate: overwrite, mark old as force-disconnect
                 │      │     │     └── LeaveCriticalSection
                 │      │     ├── NSClientRegisterationAccessLog()
                 │      │     └── ReceiveClientEvents() [wait for next data]
                 │      │
                 │      ├── Parse: format=PUSH →
                 │      │     ├── CheckValidRequest() [localhost only]
                 │      │     ├── Extract clientList, reqData, encStatus
                 │      │     └── CreatePushList() → InitiateOndemandTasks()
                 │      │           └── WSASend() to target client
                 │      │
                 │      ├── Parse: format=LIVE_LIST →
                 │      │     └── SendDataToCentralServer(GetContactTimeListinNS())
                 │      │
                 │      ├── Parse: format=ALIVE_STATUS →
                 │      │     └── SendDataToCentralServer(GetLiveStatusForResourceId())
                 │      │
                 │      └── Parse: MONITOR_STATUS → keep socket alive
                 │
                 └── Disconnect:
                       └── RemoveClientFromHashAndMemory(pCtInfo) → FreeUpMemory()
```

### Key Rules

- `gv_csClientRegisteration` guards all `regClientList` access
- Push requests validated via `CheckValidRequest()` — only localhost (loopback) accepted
- Encryption: if `gv_isEncEnabled`, data is AES-256 decrypted using `gv_salt`
- Duplicate resource IDs overwrite existing entry; old context freed
- `gv_regClientCnt` updated after every register/remove

---

## 3. IOCP I/O Processing

**Files:** `src/dcnotifcationserverutil.cpp`, `src/datamanipulation.cpp`

### Flow

```
InitializeIOCP()
   ├── CreateIoCompletionPort(INVALID_HANDLE_VALUE) → gv_hIOCompletionPort
   └── for (0..gv_workerThreads):
         CreateThread(WorkerThread)

WorkerThread (loops forever)
   │
   ├── GetQueuedCompletionStatus(gv_hIOCompletionPort, &dwBytesTransfered, ...)
   │      │
   │      ├── dwBytesTransfered == 0 → client disconnected
   │      │     └── RemoveClientFromHashAndMemory(pCtInfo)
   │      │
   │      └── dwBytesTransfered > 0
   │            │
   │            ├── pCtInfo->GetOpMode()
   │            │     │
   │            │     ├── OP_READ → data received from client
   │            │     │     └── ValidateAndRegisterNSClients(pCtInfo)
   │            │     │
   │            │     ├── OP_RECEIVE_RESPONSE → push response from client
   │            │     │     └── SendStatusToCentralServer(SUCCESS)
   │            │     │
   │            │     └── OP_PROCESS_END → cleanup
   │            │
   │            └── Error path:
   │                  └── RemoveClientFromHashAndMemory(pCtInfo)
   │
   └── Loop back to GetQueuedCompletionStatus()
```

### Key Rules

- Worker thread count = `WORKER_THREADS_PER_PROCESSOR * noOfProcessors` (capped at 16 cores)
- Registry override via `GetWorkerThreadCountFromRegistry()`
- Each client socket associated with IOCP via `CreateIoCompletionPort(clientSocket, ...)`
- `WSARecv()` / `WSASend()` are overlapped; completions arrive at worker threads
- `OP_READ`, `OP_RECEIVE_RESPONSE`, `OP_PROCESS_END` drive the state machine

---

## 4. Timer-Based Log Management

**Files:** `src/DCNotificationServer.cpp`, `src/dcnotificationservice.cpp`

### Flow

```
ServiceMain()
   │
   ├── CreateTimerQueue() → gv_hTimerQueue
   ├── CreateThread(LoggerThread, gv_hTimerQueue)
   │      │
   │      └── LoggerThread()
   │            ├── CreateTimerQueueTimer(gv_hLoggerTimer)
   │            │     callback: periodic log rotation
   │            └── WaitForSingleObject(hStopEvent)
   │
   └── On startup (before ServiceMain):
         ├── RotateNSLogs() → move logs to temp folder
         ├── RotateNotifyServerLog() → rotate dcnsclientaccess log
         └── DeleteExtraDCNSLogs(pattern, max_size)
              └── Keep only LIM_N0_OF_DUMP_FILES (50) dump files
```

### Key Rules

- Log rotation runs on startup and periodically via timer queue
- `gv_csAccessLog` critical section protects access log file writes
- DumpCreator module loaded if `gv_NSEnableDumpModule` is enabled
- `RotateDumpLogFiles()` enforces max dump file count
- Logging level controlled by `gv_LoggerLevel` from registry

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Static architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Threading model | [`../THREADING_MODEL.md`](../THREADING_MODEL.md) |
| Memory ownership | [`../MEMORY_OWNERSHIP.md`](../MEMORY_OWNERSHIP.md) |
| Build instructions | [`../../ai-agents/BUILD_GUIDE.md`](../../ai-agents/BUILD_GUIDE.md) |

*Last Updated: 2026-04-02*
