# GOAT Operations Context Layer

> **Purpose:** This document is a comprehensive reference of all operation handlers available in the G.O.A.T (Generic Orchestrated Automated Testing) framework. Use it as a context layer when generating structured test cases — each test case maps to one or more operations with typed parameters.

---

## Test Case Output Structure

Every generated test case must produce JSON in this format:

```json
{
  "TC001": {
    "testcase_id": "TC001",
    "product_name": "ProductName",
    "reuse_installation": false,
    "operations": [
      {
        "operation_type": "<operation_type>",
        "parameters": {
          "action": "<action_name>",
          "<param1>": "<value1>",
          "<param2>": "<value2>"
        }
      }
    ],
    "expected_result": "Description of expected outcome"
  }
}
```

**Key rules:**

- `operation_type` must be one of the values listed in the Quick Reference table at the end.
- `action` specifies which sub-action to invoke within the handler (where applicable).
- Parameters marked **Required** must always be provided.
- Stored values (via `note` parameter) are referenced later with `${VARIABLE_NAME}`.
- Path variables like `server_home`, `agent_home`, `tool_home` are resolved automatically at runtime.

---

## Global Auto-Resolved Path Variables

| Variable | Description |
|----------|-------------|
| `server_home` | Server installation directory |
| `agent_home` | Agent installation directory |
| `ds_home` | Distribution Server home |
| `sgs_home` | Site Gateway Server home |
| `vmp_home` | Vulnerability Manager Plus home |
| `pmp_home` | Patch Manager Plus home |
| `msp_home` | MSP home |
| `mdm_home` | Mobile Device Manager home |
| `ss_home` | Summary Server home |
| `tool_home` | GOAT tool installed directory |

---

## Cross-Cutting: Wait / Retry Parameters

**Applies to ALL operations.** Add these to any operation's parameters to enable retry logic.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_wait_time` | `0` (no retry) | Maximum seconds to keep retrying the operation |
| `check_interval` | `0` (immediate) | Seconds between retry attempts |

**Guidelines:**

- Fast ops (file checks): `max_wait_time` 15–30s, `check_interval` 1–3s
- Medium ops (service starts): `max_wait_time` 60–180s, `check_interval` 5–10s
- Long ops (downloads, installs): `max_wait_time` 300–900s, `check_interval` 15–30s

---

## File Type Dispatcher: `file_folder_modification`

The `file_folder_modification` operation type auto-routes to the correct sub-handler by file extension:

| Extension | Handler |
|-----------|---------|
| `.properties`, `.ini`, `.conf`, `.key`, `.props`, `.prop` | Config File Handler |
| `.json` | JSON File Handler |
| `.xml` | XML File Handler |
| `.csv` | CSV File Handler |
| `.pdf` | PDF File Handler |
| `.xlsx` | XLSX File Handler |
| `.log` | Log File Handler (timestamp-aware ±5 min window) |
| `.conf`, `.config`, `.cfg` | Tried as key=value (Config File Handler) first, then Text File Handler as fallback |
| `.txt`, all others | Text File Handler |

> **Note:** For `.txt` files that contain timestamped logs, set `"log_file": "true"` to route through the Log File Handler instead of Text File Handler.

---

## 1. Archive Handler

**`operation_type`: `zip_operation`** — Manage 7z and zip archives.

### Actions

| Action | Description |
|--------|-------------|
| `extract` | Extract files from archive |
| `create` | Create a new archive |
| `list` | List archive contents |
| `add` | Add files to existing archive |
| `delete` | Delete files from archive |
| `zip_contains` | Assert file/folder exists in archive |
| `zip_not_contains` | Assert file/folder does NOT exist in archive |
| `update` | Update files inside archive |

### Parameters by Action

**`extract`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path to archive file |
| `target_dir` | No | Extraction directory (default: archive parent) |
| `files_to_extract` | No | Comma-separated list of files/folders |
| `file_to_extract` | No | Single file to extract |
| `password` | No | Password for encrypted archives |

**`create`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path for new archive |
| `source_path` | Yes | Source files/directory |
| `source_files` | No | Comma-separated specific files |
| `exclude_files` | No | Comma-separated files to exclude |

**`list`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path to archive |

**`add`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path to existing archive |
| `source_path` | Yes | Source files/directory |
| `source_files` | No | Comma-separated specific files |

**`delete`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path to archive |
| `file_to_delete` | Yes | Comma-separated files/folders to delete |
| `password` | No | Password for encrypted archives |

**`zip_contains` / `zip_not_contains`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path to archive |
| `file_path` | No | Path inside archive to check |
| `filename` | No | Filename to check |

**`update`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `archive_path` | Yes | Path to archive |
| `file_to_update` | Yes | Name of file/folder in archive |
| `source_path` | Yes | Path to new file/folder |

---

## 2. Batch File Executer

**`operation_type`: `run_bat`** — Execute Windows batch files.

### Actions

| Action | Description |
|--------|-------------|
| `execute` | Run a batch file |
| `execute_and_get_value` | Run and extract values from output |
| `execute_interactive` | Run with interactive prompt handling |

### Parameters by Action

**`execute`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `file_path` | Yes | — | Path to batch file |
| `args` | No | — | Command-line arguments |
| `working_dir` | No | — | Working directory |
| `timeout` | No | `1800` | Max seconds to wait |

**`execute_and_get_value`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `file_path` | Yes | — | Path to batch file |
| `args` | No | — | Arguments |
| `working_dir` | No | — | Working directory |
| `timeout` | No | `1800` | Max seconds |
| `output_search_text` | Yes | — | Text to verify in output |
| `output_value_pattern` | No | — | Regex to extract value |
| `note` | No | — | Key to store extracted value |

**`execute_interactive`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `file_path` | Yes | — | Path to batch file |
| `args` | No | — | Arguments |
| `working_dir` | No | — | Working directory |
| `timeout` | No | `1800` | Max seconds |
| `prompt_responses` | Yes | — | Semicolon-separated `prompt=response` pairs |
| `output_search_text` | No | — | Text to verify success |

---

## 3. Certificate File Operation

**`operation_type`: `certificate_operation`** — Manage certificates.

### Actions

| Action | Description |
|--------|-------------|
| `get_cert_value` | Extract values from a certificate |
| `export_certificate` | Export cert from Windows store |
| `remove_user_trusted_root_cert` | Remove cert from trust store |

### Parameters by Action

**`get_cert_value`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `cert_path` | Conditional | Path to cert file (required unless `system_cert_name` used) |
| `key_name` | Yes | Property: `subject`, `issuer`, `thumbprint`, `version`, `serialNumber`, `validFrom`, `validTo`, `signatureAlgorithm`, `signatureHashAlgorithm`, `publicKey`, `basicConstraints`, `subjectAlternativeName`, `subjectKeyIdentifier`, `authorityKeyIdentifier`, `keyUsage`, `enhancedKeyUsage`, or `"all"` |
| `expected_value` | No | Value to compare against |
| `system_cert_name` | No | Subject name to export from Windows store first |
| `export_path` | No | Export path (default: `tool_home/exported_cert/cert.cer`) |
| `delete_after_get_value` | No | `"true"` to delete exported cert after |
| `note` | No | Key to store value |

**`export_certificate`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `system_cert_name` | Yes | Certificate subject name in Windows store |
| `export_path` | No | Export file path (default: `tool_home/exported_cert/cert.cer`) |

**`remove_user_trusted_root_cert`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `thumbprint` | Yes | Certificate thumbprint |
| `store_name` | No | Store name (default: `"Root"`) |
| `store_location` | No | `"CurrentUser"` or `"LocalMachine"` (default: `"LocalMachine"`) |

---

## 4. Command Executor

**`operation_type`: `run_command`** — Execute system commands.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `command_to_run` | Yes | System command (must be whitelisted) |
| `command_type` | No | `"powershell"` or `"cmd"` |
| `exact_value` | No | Exact string to match in output |
| `value_to_search` | No | Line substring to locate before regex |
| `value` | No | Regex to extract value from output |
| `note` | No | Variable to store extracted value |

**Whitelisted commands:** `whoami`, `systeminfo`, `netstat -an`, `ipconfig /all`, `dir C:\Windows`, `ls -la /tmp`, `echo Hello, World!`, `type config.txt` (admin-expandable).

---

## 5. Communication Operation

**`operation_type`: `communication_operation`** — Proxy, traffic capture, and network validation.

### Global Parameters (all actions)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | Action to perform |
| `description` | No | Human-readable step description |
| `continueOnFailure` | No | Continue on error (default: `false`) |
| `timeout` | No | Timeout in seconds |

### Actions (19)

| Action | Description |
|--------|-------------|
| `start_proxy` | Start mitmproxy instance |
| `stop_proxy` | Stop running proxy |
| `install_certificate` | Install/remove proxy CA cert |
| `load_client_cert` | Load client TLS certificate |
| `patch_registry` | Patch/restore registry for proxy |
| `configure_proxy` | Enable/disable system proxy |
| `run_command` | Run shell command |
| `manage_service` | Start/stop/restart services |
| `wait_for_request` | Wait for specific HTTP request |
| `wait_for_interrupt` | Block until Ctrl+C (recording mode) |
| `load_traffic` | Load captured traffic from file |
| `validate_request` | Validate captured HTTP request |
| `validate_response` | Validate captured HTTP response |
| `assert_request_count` | Assert number of matching requests |
| `assert_request_order` | Assert request ordering |
| `capture_traffic` | Save traffic to file |
| `clear_captures` | Clear captured traffic |
| `modify_response` | Inject/override responses |
| `block_request` | Block or delay requests |

### Parameters by Action

**`start_proxy`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `listenHost` | No | `"127.0.0.1"` | Listen IP |
| `listenPort` | Yes | `8080` | Listen port |
| `mode` | No | `""` | `""`, `reverse:https://host:port`, `upstream:http://proxy:port` |
| `sslInsecure` | No | `false` | Skip upstream SSL verification |
| `autoLoadCert` | No | `false` | Auto-load agent client cert |
| `liveCaptureFile` | No | `"Reports/live-capture.json"` | Live traffic output |

**`stop_proxy`** — No specific parameters.

**`install_certificate`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `certAction` | Yes | `"install"` or `"remove"` |
| `certPath` | No | Path to cert file (default: auto-detect) |

**`load_client_cert`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `clientKeyPath` | No | UEMS vault `key.pem` | Client private key path |
| `clientCertPath` | No | UEMS vault `client.pem` | Client certificate path |

**`patch_registry`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `registryKey` | Yes | Full registry key path |
| `registryAction` | Yes | `"patch"` or `"restore"` |
| `oldValues` | Yes (patch) | List of strings to find |
| `newValues` | Yes (patch) | List of replacement strings |

**`configure_proxy`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `proxyAction` | Yes | — | `"enable"` or `"disable"` |
| `proxyHost` | No | `"127.0.0.1"` | Proxy host |
| `proxyPort` | No | `8080` | Proxy port |
| `bypassList` | No | `""` | Comma-separated bypass list |

**`run_command`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `commandLine` | Yes | — | Shell command |
| `workingDir` | No | current dir | Working directory |
| `timeout` | No | `60` | Timeout in seconds |

**`manage_service`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `serviceName` | Yes | Service name |
| `serviceAction` | Yes | `"start"`, `"stop"`, `"restart"`, `"status"`, `"find"` |

**`wait_for_request`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `urlPattern` | Yes | — | Regex to match URL |
| `method` | No | `""` (any) | HTTP method |
| `timeout` | No | `60` | Timeout seconds |
| `captureFile` | No | `""` | Path to live capture file |

**`wait_for_interrupt`** — No specific parameters (recording mode, blocks until Ctrl+C).

**`load_traffic`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `captureFile` | Yes | Path to JSON traffic capture file |

**`validate_request`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `urlPattern` | Yes | — | Regex to match URL |
| `method` | No | `""` | HTTP method |
| `headerName` | No | `""` | Header to check |
| `expectedValue` | No | `""` | Expected value |
| `bodyPattern` | No | `""` | Pattern in request body |
| `validationType` | No | `"contains"` | `contains`, `exact`, `startswith`, `endswith`, `regex`, `notempty`, `isempty` |
| `caseSensitive` | No | `false` | Case-sensitive matching |

**`validate_response`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `urlPattern` | Yes | — | Regex to match URL |
| `method` | No | `""` | HTTP method |
| `expectedStatus` | No | `0` (skip) | Expected HTTP status |
| `headerName` | No | `""` | Response header to check |
| `expectedValue` | No | `""` | Expected header value |
| `bodyPattern` | No | `""` | Pattern in response body |
| `validationType` | No | `"contains"` | Validation mode |
| `caseSensitive` | No | `false` | Case-sensitive |

**`assert_request_count`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `urlPattern` | Yes | — | Regex to match URL |
| `method` | No | `""` | HTTP method filter |
| `expectedCount` | No | `-1` (skip) | Exact count |
| `minCount` | No | `0` | Minimum count |
| `maxCount` | No | `0` | Maximum count |

**`assert_request_order`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `expectedOrder` | Yes | Ordered list of URL regex patterns (min 2) |

**`capture_traffic`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `captureFile` | No | `"Reports/traffic-capture.json"` | Output file path |

**`clear_captures`** — No specific parameters.

**`modify_response`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `urlPattern` | Yes | — | Regex to match URL |
| `method` | No | `""` | HTTP method filter |
| `injectStatus` | No | `0` | Override status code |
| `injectBody` | No | `""` | Override response body |
| `injectHeaders` | No | `{}` | Headers to add/override |
| `persistent` | No | `false` | Apply to all future matches |

**`block_request`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `urlPattern` | Yes | — | Regex to match URL |
| `method` | No | `""` | HTTP method filter |
| `blockAction` | No | `"block"` | `"block"` or `"delay"` |
| `delayMs` | No | `0` | Delay milliseconds (for delay mode) |
| `persistent` | No | `false` | Apply to all future matches |

---

## 6. Config File Handler

**`operation_type`: `file_folder_modification`** — For `.properties`, `.ini`, `.conf`, `.key`, `.props`, `.prop` files.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify key has specific value |
| `value_should_be_removed` | Verify key/value absent |
| `update` | Update or add key-value pair |
| `replace` | Replace key name (preserve value) |
| `delete` | Remove key-value pair |

### Parameters by Action

**`value_should_be_present`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | Config filename |
| `key` | Yes | Key to check |
| `value` | No | Expected value (omit to just retrieve) |
| `note` | No | Key to store found value |

**`value_should_be_removed`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | Config filename |
| `key` | Yes | Key to check for absence |
| `value` | No | Specific value to ensure absent |

**`update`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path or full path |
| `filename` | No | Config filename |
| `key_to_update` | Yes | Key to update |
| `new_value` | Yes | New value |
| `section` | No | INI section heading |

**`replace`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | Config filename |
| `key_to_replace` | Yes | Original key |
| `new_key` | Yes | New key name |

**`delete`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | Config filename |
| `key_to_delete` | Yes | Key to remove |

---

## 7. CSV File Handler

**`operation_type`: `file_folder_modification`** — For `.csv` files.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify value exists in CSV |
| `value_should_be_removed` | Verify value absent from CSV |

### Parameters (both actions)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to CSV file |
| `value` | Yes | Value to search for |

---

## 8. Database Operation Handler

**`operation_type`: `db_operation`** — Execute SQL queries, manage database services, and verify data.

### Connection Modes

**Flow 1: Product Database (Default)** — Auto-detects connection from `conf/database_params.conf`. No connection parameters needed.

**Flow 2: Remote Database** — Set `"remote_db_connection": "true"` and provide connection parameters.

| Parameter | Required (Remote) | Default | Description |
|-----------|:-----------------:|---------|-------------|
| `remote_db_connection` | Yes | — | Must be `"true"` for remote mode |
| `host` | Yes | — | Database server hostname/IP |
| `password` | Yes | — | Database password |
| `db_type` | No | `"postgresql"` | `postgresql`, `mysql`, `mssql`, `oracle` |
| `port` | No | `"8028"` | Database port |
| `db_name` | No | `"desktopcentral"` | Database name |
| `username` | No | `"medc"` | Database username |

### Actions (11)

| Action | Description | Remote DB |
|--------|-------------|:---------:|
| `start` | Start database server | No |
| `stop` | Stop database server | No |
| `restart` | Restart database server | No |
| `check_connection` | Check database connectivity | Yes |
| `query` | Execute SQL SELECT and optionally store/verify results | Yes |
| `update` | Execute SQL UPDATE statement | Yes |
| `insert` | Execute SQL INSERT statement | Yes |
| `delete` | Execute SQL DELETE statement | Yes |
| `get_values` | Retrieve first value (first row, first column) | Yes |
| `verify_presence` | Verify a value exists in query results | Yes |
| `verify_absence` | Verify a value does NOT exist in query results | Yes |

### Parameters by Action

**`start` / `stop` / `restart`** — No parameters required (product DB only).

**`check_connection`** — No specific parameters (uses auto-detected or remote connection).

**`query`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | Yes | SQL SELECT query |
| `expected_value` | No | Value to compare against first cell of first row |
| `note` | No | Key to store first cell value |

**`update` / `insert` / `delete`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | Yes | SQL statement to execute |

**`get_values`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | Yes | SQL query to execute |
| `note` | No | Key to store retrieved value |

**`verify_presence`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | Yes | SQL query to execute |
| `value` | Yes | Value to verify exists in results |

**`verify_absence`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | Yes | SQL query to execute |
| `value` | Yes | Value to verify does NOT exist |

---

## 9. EXE Install Operation

**`operation_type`: `exe_install`** — Install software via executable installer.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `product_name` | Yes | Product key matching `product-setup.json` |
| `url` | Yes | URL to download installer |
| `installer_name` | No | Installer filename (derived from URL) |
| `install_path` | No | Installation path (auto-generated) |
| `setup_name` | No | Setup name used by installer |
| `base_dir` | No | Base directory (default: GOAT home) |
| `download_dir` | No | Download directory (default: `../../downloads`) |
| `scripts_dir` | No | AutoIT scripts dir (default: `../AutoIT/scripts`) |
| `autoit_dir` | No | AutoIT exe dir (default: `../AutoIT`) |
| `logs_dir` | No | Log dir (default: `../log/autoit`) |

**Product config:** `product_package/conf/product-setup.json` with `serviceName`, `displayName`, `uninstallScript`, `scriptFile`, `setupName`, `depended_product[]`, `registry_code`.

---

## 10. File Download

**`operation_type`: `download_file`** — Download files from URL.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `url` | Yes | — | Download URL |
| `target_path` | No | tool downloads folder | Target directory |
| `filename` | No | extracted from URL | Custom filename |
| `overwrite` | No | `"true"` | Overwrite existing file |

Features: Resumable downloads, 5 automatic retries, progress tracking, SSL support.

---

## 11. File Folder Operation

**`operation_type`: `file_folder_operation`** — File system CRUD and permissions.

### Actions (16)

| Action | Description |
|--------|-------------|
| `create` | Create file or folder |
| `copy` | Copy file/folder |
| `move` | Move file/folder |
| `delete` | Delete file/folder |
| `rename` | Rename file/folder |
| `check_presence` | Assert file/folder exists |
| `verify_absence` | Assert file/folder does NOT exist |
| `get_size` | Get file/folder size |
| `check_size` | Verify file/folder size |
| `check_last_modified` | Check modification time |
| `check_permission` | Verify permissions |
| `add_permission` | Add permissions |
| `set_permission` | Set permissions (replaces existing) |
| `remove_permission` | Remove permissions |
| `set_share_permission` | Set Windows share permissions |
| `remove_share_permission` | Remove Windows share |

### Parameters by Action

**`create`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `file_path` | Yes | — | Path for new file/folder |
| `type` | Yes | — | `"file"` or `"folder"` |
| `size` | No | `0` | Size in MB (files only) |
| `delete_if_exists` | No | `false` | Delete existing before create |

**`copy`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `source` | Yes | — | Source path |
| `target` | Yes | — | Target path |
| `overwrite` | No | `false` | Replace existing |

**`move`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `source` | Yes | — | Source path |
| `target` | Yes | — | Target path |
| `overwrite` | No | `false` | Replace existing |

**`delete`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to delete |

**`rename`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `source` | Yes | Source path |
| `target_name` | Yes | New name (not full path) |

**`check_presence`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | No | Filename to check |

**`verify_absence`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | No | Filename to verify absent |

**`get_size` / `check_size`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | File/folder path |
| `expected_size` | No | Expected size in MB |
| `note` | No | Key to store size |

**`check_last_modified`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | File/folder path |
| `expected_time` | Yes | Epoch ms or `"dd-MM-yyyy HH:mm"` |
| `comparison` | No | `"before"` or `"after"` |
| `note` | No | Key to store modification time |

**`check_permission`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `path` | Yes | File/folder path |
| `permissions` | Yes | `"r"`, `"w"`, `"x"`, or combination |
| `user` | Yes | Username |

**`add_permission`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `path` | Yes | File/folder path |
| `permissions` | Yes | `R`, `W`, `X`, `RWX` |
| `user` | Yes | Comma-separated usernames |

**`set_permission`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `path` | Yes | — | File/folder path |
| `permissions` | Yes | — | `"r"`, `"w"`, `"x"` combination |
| `user` | Yes | — | Username |
| `enable_inheritance` | No | `false` | Enable permission inheritance |

**`remove_permission`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `path` | Yes | — | File/folder path |
| `permissions` | Yes | — | `"r"`, `"w"`, `"x"` combination |
| `user` | Yes | — | Username |
| `recursive` | No | `false` | Apply recursively |
| `disable_inheritance` | No | — | Disable inheritance (Windows) |

**`set_share_permission`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `path` | Yes | — | Folder path |
| `share_name` | Yes | — | Windows share name |
| `permissions` | Yes | — | `"read"`, `"change"`, or `"full"` |
| `user` | Yes | — | Comma-separated usernames |
| `remove_existing` | No | `"false"` | Remove existing share first |

**`remove_share_permission`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `share_name` | Yes | Windows share name |
| `user` | No | Usernames (omit to remove entire share) |

---

## 12. Machine Operations

**`operation_type`: `machine_operation`** — System-level operations.

### Actions

| Action | Description |
|--------|-------------|
| `get_machine_spec` | Retrieve system information |
| `restart` | Restart machine |
| `rename` | Change computer name |
| `change_domain` | Change domain / join workgroup |
| `change_datetime` | Change system date/time |
| `change_timezone` | Change timezone |

### Parameters by Action

**`get_machine_spec`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `info_type` | Yes | See values below |
| `note` | Yes | Key to store value |

**`info_type` values:** `computer name`, `domain name`, `fqdn`, `os name`, `os version`, `architecture`, `time zone`, `language`, `logged user`, `mac address`, `service tag`, `admin$ share`, `bios mode`, `bios version`, `current time`, `day light saving time`, `is day light saving`, `local ip address`, `last ip address list`, `local domain type`, `local language`, `local machine uuid`, `local operating system`, `local service pack`, `local time zone offset`, `machine type`, `standard time`, `system spec name`, `tpm status`, `tpm version`, `utc offset`, `utc time`, `os full name`, `os last bootup time`, `os install date`, `identifying number`, `wmi service`, `av guid name`

**`restart`** — No parameters.

**`rename`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `new_name` | Yes | New computer name |

**`change_domain`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domain` | Conditional | Domain to join |
| `workgroup` | Conditional | Workgroup to join |
| `user` | Yes | Username with join permissions |
| `password` | Yes | Password |
| `do_restart` | No | `"true"` / `"false"` |

**`change_datetime`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `date` | Yes | Format: `dd-MM-yyyy` |
| `time` | Yes | Format: `HH:mm:ss` |

**`change_timezone`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `timezone_id` | Yes | e.g. `"Eastern Standard Time"` |

---

## 13. GUI Operations

**`operation_type`: `gui_operation`** — Java Swing GUI automation.

### Common Parameters

| Parameter | Description |
|-----------|-------------|
| `app_type` | App type: `SGS`, `BACKUP`, `PPM`, `DB_MIGRATION` |
| `component_id` | Component's Swing name/ID |
| `component_text` | Component display text (fallback) |
| `invoke_in_thread` | Run in parallel thread |
| `component_reference_name` | Store component ref (`Dialog`, `Popup`) |
| `root_component` | Operate inside stored component |
| `product_name` | Product name for service resolution |
| `waitFor` | Wait seconds after operation |
| `server_home` | Server home path |

### Actions (15)

| Action | Key Parameters |
|--------|---------------|
| `click_button` | `blind_search`, `component_text` |
| `enter_text` | `text_to_enter` |
| `select_checkbox` | `select_state` (optional bool) |
| `select_dropdown` | `select_option` |
| `get_text` | — |
| `verify_text` | `expected_text`, `blind_search` |
| `wait_for` | `type` (`PROGRESS_BAR`, `COMPONENT_VISIBILITY`, `COMPONENT_RENDER`, `COMPONENT_UNRENDER`, `WINDOW`), `expected_value`, `timeout_s` (default: 60), `verify_interval_s` (default: 10) |
| `detect_dialog` | `dialog_title` |
| `get_current_window` | `window_title` |
| `select_tab` | `tab_title` |
| `is_showing` | `component_id` |
| `select_radio_button` | `radio_text` |
| `clear_text_field` | — |
| `file_chooser` | `file_name_text`, `button_text`, `base_dialog` |
| `list_component` | — (prints component tree) |

---

## 14. Native GUI Operation

**`operation_type`: `native_gui_operation`** — Windows native GUI automation (FlaUI).

### Common Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | Action to perform |
| `automationId` | Conditional | Element AutomationId (preferred) |
| `name` | Conditional | Element display name (fallback) |
| `text` | Conditional | Text for input/select |
| `timeout` | No | Wait timeout (default: 30) |
| `expectedValue` | No | Expected text value |
| `continueOnFailure` | No | Continue on failure (default: false) |
| `takeScreenshotOnFailure` | No | Screenshot on failure (default: true) |
| `matchPartial` | No | Partial name match (default: false) |
| `description` | No | Step description |
| `target_app_exe` | No | Path to app executable |

### Actions (13)

| Action | Description | Key Extra Parameters |
|--------|-------------|---------------------|
| `ClickButton` | Click a button | — |
| `Click` | Generic click | — |
| `DoubleClick` | Double-click | — |
| `RightClick` | Right-click | — |
| `EnterText` | Enter text | `text` (required) |
| `Wait` | Wait for element | `timeout`, `matchPartial` |
| `ReadText` | Read + validate text | `expectedValue`, `validationType` |
| `Screenshot` | Capture screenshot | `filePath` (required) |
| `Select` | Select dropdown item | `text` (required) |
| `Toggle` | Toggle checkbox | `checked` (required, bool) |
| `ReadGrid` | Read/validate grid | `columnValidations` or `keyValuePairs` + `keyColumn` + `valueColumn`, `validationType` |
| `close_all` | Close all instances | `processName` (required) |
| `VerifyNotPresent` | Assert element does NOT appear within timeout | `automationId` (required), `timeout` (required) |

**Validation types:** `exact`, `contains`, `startsWith`, `endsWith`, `regex`, `oneOf`, `notEmpty`, `isEmpty`, `numericEquals`, `numericLessThan`, `numericGreaterThan`, `numericBetween`, `isNumeric`, `length`, `minLength`, `maxLength`, `isDate`, `isUrl`, `isEmail`

---

## 15. Install / Revert PPM

**`operation_type`: `ppm_upgrade`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL of PPM file to download |

**`operation_type`: `revert_ppm`** — No parameters. Auto-identifies most recent PPM from history.

---

## 16. JAR Operation

**`operation_type`: `jar_operation`** — Manage JAR files.

### Actions (10)

| Action | Description |
|--------|-------------|
| `get_manifest` | Get manifest info |
| `get_version` | Extract version |
| `check_version` | Verify version |
| `find_class` | Find class in JAR |
| `create` | Create new JAR |
| `add` | Add files to JAR |
| `update_manifest` | Update manifest attributes |
| `sign` | Check if signed |
| `extract` | Extract entire JAR |
| `extract_file` | Extract specific file |

### Parameters by Action

**`get_manifest`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |

Returns: `has_manifest`, `manifest_entries`, `manifest_content`, `main_class`, `implementation_title`, `implementation_version`, `implementation_vendor`, `created_by`

**`get_version`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |
| `note` | No | Variable to store version |

**`check_version`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `jar_path` | Yes | — | Path to JAR |
| `expected_version` | No | — | Expected version |
| `version_attribute` | No | `"Bundle-Version"` | Manifest attribute |
| `comparison_type` | No | `"exact"` | `"exact"`, `"minimum"`, `"contains"` |

**`find_class`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |
| `class_name` | Yes | Class name to find |

**`create`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path for new JAR |
| `source_dir` | Yes | Source directory |
| `manifest_path` | No | Manifest file path |

**`add`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `jar_path` | Yes | — | Path to JAR |
| `files` | Yes | — | Comma-separated files |
| `base_dir` | Yes | — | Base directory |
| `overwrite` | No | `false` | Overwrite existing |

**`update_manifest`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |
| `attributes` | Yes | Comma-separated `key:value` pairs |
| `manifest_path` | No | Manifest file path |

**`sign`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |

**`extract`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |
| `output_dir` | No | Output directory |

**`extract_file`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `jar_path` | Yes | Path to JAR |
| `package_path` | Yes | Path inside JAR |
| `output_path` | Yes | Output file path |

---

## 17. JSON File Handler

**`operation_type`: `file_folder_modification`** — For `.json` files.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify JSON path value |
| `value_should_be_removed` | Verify JSON path/value absent |
| `create` | Create new JSON file |
| `write` | Write/merge content |
| `update` | Update value at path |
| `remove` | Remove property |
| `replace` | Rename a key in a JSON object (preserves value) |

### Parameters by Action

**`value_should_be_present`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | JSON filename |
| `path` | Yes | Dot-notation path (e.g. `user.name`, `users[0].address`) |
| `value` | No | Expected value |
| `note` | No | Key to store found value |

**`value_should_be_removed`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | JSON filename |
| `path` | Yes | JSON path |
| `value` | No | Value to check absent |

**`create`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Directory path |
| `filename` | Yes | JSON filename |
| `content` | No | Initial JSON content |
| `overwrite` | No | `"true"` to overwrite |

**`write`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to JSON file |
| `content` | Yes | JSON content |
| `path` | No | Target JSON path |
| `merge_mode` | No | `"append"` to add without replacing |
| `backup` | No | `"true"` to backup first |

**`update`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to JSON file |
| `path` | Yes | JSON path to update |
| `new_value` | Yes | New value |
| `backup` | No | `"true"` to backup first |

**`remove`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to JSON file |
| `path` | No | Parent object path |
| `key_name` | Yes | Key to remove |
| `backup` | No | `"true"` to backup first |

**`replace`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to JSON file |
| `path` | No | JSON path to parent object containing the key (defaults to root) |
| `key_to_replace` | Yes | Current key name to rename |
| `new_key` | Yes | New key name |

---

## 18. PDF File Handler

**`operation_type`: `file_folder_modification`** — For `.pdf` files.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify text/pattern in PDF |
| `value_should_be_removed` | Verify text/pattern absent |

### Parameters by Action

**`value_should_be_present`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to PDF |
| `exact_value` | Conditional | Exact text (mutually exclusive with `value`) |
| `value` | Conditional | Regex pattern (mutually exclusive with `exact_value`) |
| `key` | No | Key text to narrow search |
| `note` | No | Key to store found value |

**`value_should_be_removed`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to PDF |
| `exact_value` | Conditional | Exact text |
| `value` | Conditional | Regex pattern |
| `key` | No | Key text to narrow search |

---

## 19. Registry Operation

**`operation_type`: `registry_operation`** — Windows Registry operations.

### Actions (15)

| Action | Description |
|--------|-------------|
| `add_key` | Create registry key |
| `write_key` | Write value to key |
| `read_key` | Read value (auto-detect type) |
| `read_string` | Read REG_SZ value |
| `read_dword` | Read 32-bit integer |
| `read_qword` | Read 64-bit integer |
| `delete_value` | Remove single value |
| `delete_key` | Remove entire key |
| `check_key_exists` | Check key exists | `root` (required), `path` (required), `key_name` (optional) |
| `check_key_not_exists` | Assert key does NOT exist | `root` (required), `path` (required), `key_name` (optional) |
| `check_value_exists` | Check value exists |
| `check_value_not_exist` | Assert value does NOT exist |
| `list_subkeys` | List child keys |
| `list_values` | List all values |
| `get_value_type` | Get value data type |

### Common Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | Action to perform |
| `root` | Yes | `HKLM`, `HKCU`, `HKCR`, `HKU`, `HKCC` |
| `path` | Yes | Key path (e.g. `Software\\MyApp`) |
| `key_name` | Conditional | Value name (for value-level actions) |
| `value` | Conditional | Data to write |
| `value_type` | Conditional | `REG_SZ`, `REG_DWORD`, `REG_QWORD`, `REG_BINARY`, `REG_MULTI_SZ`, `REG_EXPAND_SZ` |
| `expected_value` | No | Expected value to compare against operation output (marks FAILED if mismatch) |
| `delete_if_exists` | No | `true` to delete key before creating (for `add_key`/`write_key`, makes tests re-runnable) |
| `wow_mode` | No | `BuildType` (default), `x86`, `x64`, `Both` |
| `description` | No | Step description |
| `continueOnFailure` | No | Continue on error (default: false) |

---

## 20. Service Management

**`operation_type`: `service_actions`** — Windows service control.

### Actions (9)

| Action | Description |
|--------|-------------|
| `start` | Start service |
| `stop` | Stop service |
| `restart` | Restart service |
| `status` | Check service status |
| `set_startup` | Change startup type |
| `set_description` | Set description |
| `get_description` | Get description |
| `get_startup` | Get startup type |
| `get_logon` | Get logon account |

### Parameters by Action

**`start` / `stop` / `restart`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `service_name` | Yes | Service name |

**`status`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `service_name` | Yes | Service name |
| `expect` | No | `"serviceRunning"` or `"serviceStopped"` |
| `note` | No | Variable to store status |

Status values: `RUNNING`, `STOPPED`, `START_PENDING`, `STOP_PENDING`, `TRANSITIONAL`, `UNKNOWN`

**`set_startup`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `service_name` | Yes | Service name |
| `startup_type` | Yes | `"auto"`, `"demand"`, `"disabled"`, `"delayed-auto"` |

**`set_description`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `service_name` | Yes | Service name |
| `description` | No | Description text |

**`get_description` / `get_startup` / `get_logon`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `service_name` | Yes | Service name |
| `note` | No | Variable to store value |

`get_startup` returns: `AUTO`, `DELAYED-AUTO`, `DEMAND`, `DISABLED`, `BOOT`, `SYSTEM`, `UNKNOWN`

---

## 21. Task Manager

**`operation_type`: `task_manager`** — Process management.

### Actions

| Action | Description |
|--------|-------------|
| `verify_process` | Check if process is running |
| `kill_process` | Terminate process |
| `verify_process_property` | Verify/extract process properties |

### Parameters by Action

**`verify_process`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `process_name` | Conditional | — | Process name (one of `process_name`/`process_path` required) |
| `process_path` | No | — | Path to process exe |
| `expect` | No | `"processrunning"` | `"processrunning"` or `"processnotrunning"` |
| `port` | No | — | Port to verify |

**`kill_process`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `process_name` | Conditional | Process name (one of `process_name`/`process_path` required) |
| `process_path` | No | Path to process exe |

**`verify_process_property`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `search_type` | Yes | — | `"pid"`, `"port"`, `"path"`, `"name"`, `"user"` |
| `search_type_value` | Yes | — | Search value |
| `expected_type` | Yes | — | `"pid"`, `"name"`, `"path"`, `"port"`, `"memory"`, `"threads"`, `"user"`, `"cpu"`, `"starttime"`, `"get_instance"` |
| `expected_type_value` | Conditional | — | Expected value (one of `expected_type_value`/`note` required) |
| `comparison_operator` | No | `"equal"` | `"greater_than"`, `"less_than"`, `"equal"` |
| `note` | Conditional | — | Variable to store value |

---

## 22. Text File Handler

**`operation_type`: `file_folder_modification`** — For `.txt`, `.conf`, `.cfg`, and unrecognized extensions.

### Actions (16)

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify text/regex exists in file |
| `value_should_be_removed` | Verify text/regex does NOT exist in file |
| `find_text` | Find lines matching text/regex |
| `count` | Count lines, words and characters |
| `read` | Read file content (optionally into a variable) |
| `write` | Overwrite file with new content |
| `append` | Append content to end of file |
| `insert_first` | Insert a new line at the beginning |
| `insert_last` | Insert a new line at the end |
| `insert_line` | Insert a line at a specific line number |
| `update_line` | Replace a specific line by line number |
| `replace` | Find and replace text/regex |
| `delete` | Delete matched text or whole matched line(s) |
| `delete_line` | Delete a line by line number |
| `remove_first_line` | Remove the first line |
| `remove_last_line` | Remove the last line |

### Common Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Full file path or directory path (combined with `filename`) |
| `filename` | No | File name when `file_path` is a directory |
| `note` | No | Variable to store extracted/matched/read text |
| `log_file` | No | Set `"true"` on a `.txt` file to route through Log File Handler for timestamp-aware search |

### Parameters by Action

**`value_should_be_present`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `value` | Conditional | Literal text to find (one of `value`/`regex` required) |
| `regex` | Conditional | Regex pattern to find |
| `note` | No | Variable to store matched text |

**`value_should_be_removed`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `value` | Conditional | Literal text to confirm absent (one of `value`/`regex` required) |
| `regex` | Conditional | Regex pattern to confirm absent |

**`find_text`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `value` | Conditional | Literal text to find (one of `value`/`regex` required) |
| `regex` | Conditional | Regex pattern to find |
| `note` | No | Variable to store matching lines |

**`count`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `note` | No | Variable to store line count |

**`read`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `limit` | No | Max number of lines to read |
| `note` | No | Variable to store content |

**`write`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `content` | Yes | New content for the file |
| `backup` | No | `"true"` to save existing file as `.bak` first |

**`append`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `content` | Yes | Content to append |

**`insert_first` / `insert_last`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `value` | Yes | Text to insert |

**`insert_line`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `line_number` | Yes | Position (1-based) |
| `new_content` | Yes | Text to insert |

**`update_line`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `line_number` | Yes | Target line (1-based) |
| `new_content` | Yes | Replacement text |

**`replace`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `value` | Conditional | Literal text to find (one of `value`/`regex` required) |
| `regex` | Conditional | Regex pattern to find |
| `new_value` | Yes | Replacement text |

**`delete`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `value` | Conditional | Literal text to delete (one of `value`/`regex` required) |
| `regex` | Conditional | Regex pattern to delete |
| `delete_line` | No | `"true"` to force whole-line deletion |

**`delete_line`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to file |
| `line_number` | Yes | Line to delete (1-based) |

**`remove_first_line` / `remove_last_line`** — No extra parameters beyond `file_path`.

### Escape Sequences

| Escape | Character |
|--------|----------|
| `\n` | Newline |
| `\t` | Tab |
| `\r` | Carriage return |
| `\\` | Literal backslash |

---

## 23. XLSX File Handler

**`operation_type`: `file_folder_modification`** — For `.xlsx` files.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify value in XLSX |
| `value_should_be_removed` | Verify value absent |

### Parameters (both actions)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to XLSX file |
| `value` | Yes | Value to search |

Searches all sheets, rows, and cells regardless of formatting.

---

## 24. XML File Handler

**`operation_type`: `file_folder_modification`** — For `.xml` files.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Verify value at XPath |
| `value_should_be_removed` | Verify value absent at XPath |

### Parameters by Action

**`value_should_be_present`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to XML file |
| `filename` | Yes | XML filename |
| `path` | Yes | XPath expression |
| `value` | No | Expected value |
| `note` | No | Key to store found value |

**`value_should_be_removed`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Path to XML file |
| `filename` | Yes | XML filename |
| `path` | Yes | XPath expression |
| `value` | No | Value that should not exist |

---

## 25. Uninstall Operation

**`operation_type`: `uninstall`** — Uninstall via AutoIT script.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `autoit_path` | Yes | Path to directory with `AutoIt3.exe` |
| `args` | Yes | Comma-separated arguments to AutoIT script |

Exit code `0` = success.

---

## 26. Temp Workaround Operation

**`operation_type`: `temp_workaround_operation`** — Temporary backup utilities (will be deprecated).

### Actions

| Action | Description |
|--------|-------------|
| `get_old_backup_by_time` | Find existing 7z by modification time |
| `get_backup_file_name` | Wait for new backup folder + 7z |

### Parameters by Action

**`get_old_backup_by_time`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `folder_to_search` | Yes | — | Folder with 7z files |
| `time_to_check_before` | No | `0` | Time window in minutes |
| `note` | No | — | Stores `<note>_path` and `<note>_name` |

**`get_backup_file_name`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `folder_to_search` | Yes | — | Folder with backup folders |
| `folder_timeout` | No | `300` | Max seconds to wait for folder |
| `zip_timeout` | No | `300` | Max seconds to wait for 7z |
| `check_interval` | No | `10` | Check interval seconds |
| `note` | No | — | Stores `<note>_path` and `<note>_name` |

---

## 27. MSSQL Migration

**`operation_type`: `mssql_migration`** — Migrate from PostgreSQL to MSSQL.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `sqlHost` | Yes | — | MSSQL server host |
| `sqlPort` | Yes | — | MSSQL server port |
| `sqlUserName` | Yes | — | MSSQL username |
| `sqlPassword` | Yes | — | MSSQL password |
| `dbName` | No | auto-generated | Database name |

---

## 28. VM Operations

**`operation_type`: `vm_operation`** — Manage Hyper-V virtual machines.

### Prerequisites

- Hyper-V must be enabled (auto-configured by `start_goat_server.bat`)
- Requires Administrator privileges
- First-time Hyper-V enable requires reboot

### Actions (14)

| Action | Description |
|--------|-------------|
| `create_vm` | Create a new VM and install Windows automatically |
| `start_vm` | Start a VM |
| `stop_vm` | Gracefully shut down a VM |
| `force_stop_vm` | Force shut down a VM |
| `restart_vm` | Restart a VM |
| `delete_vm` | Delete a VM |
| `create_snapshot` | Create a checkpoint/snapshot |
| `restore_snapshot` | Restore to a snapshot |
| `get_vm_status` | Get VM state (Running/Off/Paused/Saved) |
| `get_vm_ip` | Get VM's IP address |
| `login_user` | Switch to a different user session |
| `logoff_user` | Log off a user |
| `get_logged_in_user` | Get currently logged in user |
| `cleanup_environment` | Delete all project VMs and clean up |

### Parameters by Action

**`create_vm`**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `vm_name` | Yes | — | Name for the VM |
| `os` | Yes | — | Operating system to install |
| `language` | No | `english` | Windows language |
| `memory_mb` | No | `8192` | RAM in MB |
| `cpu_count` | No | `6` | Number of CPUs |
| `vhd_size_gb` | No | `60` | Disk size in GB |
| `generation` | No | `2` | Hyper-V generation (1 or 2) |
| `delete_if_exists` | No | `false` | Delete existing VM with same name |
| `iso_path` | No | — | Explicit ISO file path (skips auto-resolve) |
| `autounattend_path` | No | — | Explicit Autounattend.xml path (skips auto-generation) |
| `users` | No | — | Extra user accounts to create (max 5, JSON array) |

**Supported OS values:** `windows_server_2016`, `windows_server_2019`, `windows_server_2022`, `windows_server_2025`, `windows_10_pro`, `windows_11_pro`

**Supported languages:** `english`, `chinese_simplified`, `chinese_traditional`, `japanese`, `korean`, `french`, `german`, `spanish`, `portuguese_brazil`, `italian`, `dutch`, `polish`, `russian`, `thai`, `vietnamese`, and more.

**User groups:** `Administrators`, `Users` (default), `Guests`, `Power Users`, `Remote Desktop Users`, `Backup Operators`, `Network Configuration Operators`

**`start_vm` / `stop_vm` / `force_stop_vm` / `restart_vm` / `delete_vm` / `get_vm_status` / `get_vm_ip`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vm_name` | Yes | Name of the VM |

**`create_snapshot`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vm_name` | Yes | Name of the VM |
| `snapshot_name` | Yes | Name for the snapshot |

**`restore_snapshot`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vm_name` | Yes | Name of the VM |
| `snapshot_name` | Yes | Name of the snapshot to restore |

**`login_user`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vm_name` | Yes | Name of the VM |
| `username` | Yes | Username to log in as |
| `password` | Yes | Password for the user |

**`logoff_user`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vm_name` | Yes | Name of the VM |
| `username` | Yes | Admin username for PowerShell Direct connection |
| `password` | Yes | Admin password for PowerShell Direct connection |
| `target_user` | No | User to log off (all users if omitted) |

**`get_logged_in_user`**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vm_name` | Yes | Name of the VM |
| `username` | Yes | Admin username for PowerShell Direct connection |
| `password` | Yes | Admin password for PowerShell Direct connection |

**`cleanup_environment`** — No parameters. Deletes all VMs created by GOAT in this project.

---

## 29. Log File Handler

**`operation_type`: `file_folder_modification`** — Timestamp-aware searching for `.log` files.

### Overview

The Log File Handler provides timestamp-aware value checking for log files. It searches for values only within a **±5 minute window** of the current time, ensuring you match entries from the current test execution — not stale entries from previous runs.

For `.txt` files that contain timestamped logs, set `"log_file": "true"` to route through this handler.

### When Used

| File Type | Handler Used |
|-----------|--------------|
| `.log` files | Log File Handler (automatic) |
| `.txt` files with `"log_file": "true"` | Log File Handler |

### Supported Timestamp Formats (9)

| # | Format Example | Used By |
|---|----------------|---------|
| 1 | `[12:30:45:123]\|[04-21-2026]` | GOAT Framework |
| 2 | `[12:30:45:123][04-21-2026]` | serverout.log, catalina.log |
| 3 | `[2026-04-21 12:30:45.123456]` | dcnotificationserver.log |
| 4 | `[2026-04-21T12:30:45.123+0530]` | gc.log (ISO 8601) |
| 5 | `21-Apr-2026 12:30:45 PM` | silentupdation.log |
| 6 | `[Mon Apr 21 12:30:45 IST 2026]` | PostAPILog.txt |
| 7 | `[4-21-2026 - 12:30:45]` | Installer.log |
| 8 | `21/Apr/2026:12:30:45` | nginx access.log |
| 9 | `Apr 21 12:30:45:` | syslog, invokeBrowser.log |

If no recognized timestamp is found, falls back to plain text matching.

### Actions

| Action | Description |
|--------|-------------|
| `value_should_be_present` | Check if a value exists in log entries within ±5 minutes |
| `value_should_be_removed` | Verify a value does NOT exist in recent log entries |

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `value_should_be_present` or `value_should_be_removed` |
| `file_path` | Yes | Full path to the log file or directory |
| `filename` | No | Log file name (when `file_path` is directory) |
| `value` | Yes | Text to search for in log entries |
| `regex` | No | Regex to extract a specific value from matched line |
| `note` | No | Variable to store extracted value (use with `regex`) |
| `log_file` | No | Set `"true"` for `.txt` files to treat as logs |

---

## Quick Reference: All `operation_type` Values

| `operation_type` | Handler | # Actions |
|-----------------|---------|-----------|
| `zip_operation` | Archive Handler | 8 |
| `run_bat` | Batch File Executer | 3 |
| `certificate_operation` | Certificate File Operation | 3 |
| `run_command` | Command Executor | 1 |
| `communication_operation` | Communication Operation | 19 |
| `file_folder_modification` | File Content Handler (auto-dispatched by extension) | varies |
| `db_operation` | Database Operation | 11 |
| `exe_install` | EXE Install | 1 |
| `download_file` | File Download | 1 |
| `file_folder_operation` | File/Folder CRUD & Permissions | 16 |
| `machine_operation` | Machine Operations | 6 |
| `gui_operation` | Java Swing GUI Automation | 15 |
| `native_gui_operation` | Windows Native GUI (FlaUI) | 14 |
| `ppm_upgrade` | PPM Upgrade | 1 |
| `revert_ppm` | PPM Revert | 1 |
| `jar_operation` | JAR Operations | 10 |
| `registry_operation` | Windows Registry | 15 |
| `service_actions` | Service Management | 9 |
| `task_manager` | Task/Process Manager | 3 |
| `uninstall` | Uninstall Operation | 1 |
| `temp_workaround_operation` | Temp Workaround (deprecated) | 2 |
| `mssql_migration` | MSSQL Migration | 1 |
| `vm_operation` | VM Operations (Hyper-V) | 14 |

**Total: 23 operation types, ~156 actions**

---

## GOAT API Endpoints (for programmatic execution)

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/execute` | POST | `testId` (query, required) + JSON body | Execute test case from JSON |
| `/api/execute/{id}` | POST | `id` (path), `testId` (query) | Execute specific test case by ID |
| `/api/testcases/status` | GET | `testId`, `testcaseId` (both required) | Check test case execution status |
| `/api/testcases/getValue` | GET | `key` (required) | Retrieve a saved note value by key |

---

## Agent Corrections & Migration Rules

> **Purpose:** This section is consumed by the `@goat` VS Code Copilot Chat agent. It contains rules to correct recurring LLM mistakes during test-case-to-JSON conversion. The agent reads this section at runtime and applies these rules **before and after** generating output.
>
> **How to add corrections:** When you notice the agent making a mistake, add a new entry below. The agent will pick it up on the next invocation — no code changes needed.

---

### Deprecated Operation Type Aliases

These old `operation_type` values were used in GOAT v1. They are **no longer valid**. The agent MUST map them to the correct current types.

| Old Type (DO NOT USE) | Correct Type | Correct Action | Notes |
|---|---|---|---|
| `check_presence` | `file_folder_operation` | `check_presence` | Was standalone in v1, now an action under file_folder_operation |
| `verify_absence` | `file_folder_operation` | `verify_absence` | Was standalone in v1, now an action under file_folder_operation |
| `value_should_be_present` | `file_folder_modification` | `value_should_be_present` | Auto-dispatched by file extension |
| `value_should_be_removed` | `file_folder_modification` | `value_should_be_removed` | Auto-dispatched by file extension |
| `file_edit` | `file_folder_modification` | `update` | Use appropriate action: update, replace, delete, etc. |
| `database_actions` | `db_operation` | `query` | Renamed in v2 |
| `service_operation` | `service_actions` | *(keep existing)* | LLM commonly hallucinates this name; correct type is `service_actions` |

---

### Common Mistakes

<!-- 
  Add entries in this format:
  
  ### CM-001: Short Title
  **Problem:** Description of what the LLM gets wrong.
  **Correction:** What it should do instead.
  **Example (wrong):** `{ "operation_type": "wrong_value" }`
  **Example (correct):** `{ "operation_type": "correct_value", "parameters": { "action": "correct_action" } }`
-->

### CM-001: File content checks must use file_folder_modification, not file_folder_operation
**Problem:** LLM uses `file_folder_operation` when checking/verifying values inside files (e.g., "verify db.port=5432 in server.properties").
**Correction:** Use `file_folder_modification` with `action: "value_should_be_present"`. The `file_folder_operation` type is ONLY for file system operations (create, copy, move, delete, rename, permissions, size). Content checks go through `file_folder_modification` which auto-routes by file extension.

### CM-002: Missing action parameter for multi-action operation types
**Problem:** LLM omits the `action` parameter for operation types that have multiple sub-actions (e.g., `file_folder_operation` without specifying `copy`, `move`, `delete`, etc.).
**Correction:** Always include `"action"` in the parameters object for: `zip_operation`, `run_bat`, `certificate_operation`, `file_folder_modification`, `file_folder_operation`, `machine_operation`, `gui_operation`, `native_gui_operation`, `jar_operation`, `registry_operation`, `service_actions`, `task_manager`, `communication_operation`.

### CM-003: Using server_home as a string instead of a variable
**Problem:** LLM hardcodes paths like `"C:\\Program Files\\Product\\conf"` instead of using path variables.
**Correction:** Always use `server_home`, `agent_home`, `tool_home` and other auto-resolved path variables. Write `"server_home/conf"` not absolute paths.

### CM-004: OR/AND conditions — use `run_command` with shell conditional operators
**Problem:** GOAT has no conditional branching. When the test case says "check dsnginx.exe **or** dsnginxc.exe is running", generating two `task_manager` operations with `continueOnFailure: true` still records individual FAILED status for whichever process is not running, causing the overall test case to FAIL.
**Correction:** When a prompt contains OR conditions ("A or B") or AND conditions ("A and B must both be true") that cannot be expressed as a single parameter value, use a single `run_command` with `command_type: "cmd"` and shell conditional operators (`&&` for AND, `||` for OR). This lets the shell evaluate the condition and return a single pass/fail result.
**Important:** Do NOT overuse `run_command`. When a step has no OR/AND condition and a dedicated operation type exists (e.g., `task_manager`, `registry_operation`, `file_folder_operation`), always prefer the dedicated operation. Only fall back to `run_command` when conditional logic is required and the dedicated operation cannot express it.
**Example (wrong — two operations, both record individual pass/fail):**
```json
{ "operation_type": "task_manager", "parameters": { "action": "verify_process", "process_name": "dsnginx.exe", "expect": "processrunning", "continueOnFailure": true } },
{ "operation_type": "task_manager", "parameters": { "action": "verify_process", "process_name": "dsnginxc.exe", "expect": "processrunning", "continueOnFailure": true } }
```
**Example (correct — single run_command with OR logic):**
```json
{ "operation_type": "run_command", "parameters": { "command_type": "cmd", "command_to_run": "tasklist /FI \"IMAGENAME eq dsnginx.exe\" | find /I \"dsnginx.exe\" >nul && echo NGINX_FOUND || tasklist /FI \"IMAGENAME eq dsnginxc.exe\" | find /I \"dsnginxc.exe\" >nul && echo NGINX_FOUND || echo NGINX_NOT_FOUND", "exact_value": "NGINX_FOUND", "description": "Check dsnginx.exe OR dsnginxc.exe is running" } }
```
**Example (AND condition — both processes must be running):**
```json
{ "operation_type": "run_command", "parameters": { "command_type": "cmd", "command_to_run": "tasklist /FI \"IMAGENAME eq processA.exe\" | find /I \"processA.exe\" >nul && tasklist /FI \"IMAGENAME eq processB.exe\" | find /I \"processB.exe\" >nul && echo BOTH_FOUND || echo NOT_BOTH_FOUND", "exact_value": "BOTH_FOUND", "description": "Check processA.exe AND processB.exe are both running" } }
```

### CM-005: "Expect absent or value" — use `run_command` with `reg query` conditional
**Problem:** When the test says "read NginxStartUpFailure — expect absent or 0", generating two `registry_operation` steps (`check_value_exists` then `read_dword`, both with `continueOnFailure: true`) still records a FAILED result for the `read_dword` when the key is absent, causing the overall test case to FAIL. GOAT has no conditional branching to skip the second operation.
**Correction:** When a prompt says "expect absent or \<value\>" or "should not exist or be \<value\>", this is an OR condition — use a single `run_command` with `command_type: "cmd"` and `reg query` with shell conditional operators. The shell evaluates: absent → OK, present with expected value → OK, otherwise → FAIL.
**Example (wrong — two operations, read_dword fails when key is absent):**
```json
{ "operation_type": "registry_operation", "parameters": { "action": "check_value_exists", "root": "HKLM", "path": "...", "key_name": "NginxStartUpFailure", "continueOnFailure": true } },
{ "operation_type": "registry_operation", "parameters": { "action": "read_dword", "root": "HKLM", "path": "...", "key_name": "NginxStartUpFailure", "expected_value": "0", "continueOnFailure": true } }
```
**Example (correct — single run_command with OR logic):**
```json
{ "operation_type": "run_command", "parameters": { "command_type": "cmd", "command_to_run": "reg query \"HKLM\\SOFTWARE\\WOW6432Node\\AdventNet\\DesktopCentral\\DCDistributionServer\" /v NginxStartUpFailure >nul 2>&1 && (for /f \"tokens=3\" %a in ('reg query \"HKLM\\SOFTWARE\\WOW6432Node\\AdventNet\\DesktopCentral\\DCDistributionServer\" /v NginxStartUpFailure') do @if \"%a\"==\"0x0\" (echo NGINX_STARTUP_OK) else (echo NGINX_STARTUP_FAIL)) || echo NGINX_STARTUP_OK", "exact_value": "NGINX_STARTUP_OK", "description": "NginxStartUpFailure: absent → OK, present and 0x0 → OK, otherwise → FAIL" } }
```

### CM-006: Referenced values must be read and stored BEFORE they are used (dependency resolution)
**Problem:** When a test step says "TCP connect to DCDistributionServerSecurePort on 127.0.0.1", the LLM uses `${DCDistributionServerSecurePort}` in the command but NEVER generates a prior operation to read that value from the registry. The variable is unresolved at runtime.
**Correction:** Before generating operations, scan ALL steps for referenced values (registry keys, config properties, dynamic values). If a value is mentioned that is NOT a well-known auto-resolved path variable (`server_home`, `agent_home`, `tool_home`, etc.), then:
1. Generate a read operation (`registry_operation`, `file_folder_modification`, `db_operation`) with a `note` parameter to store it.
2. Use `${note_name}` in all subsequent operations.
**Example (wrong):** Using `${DCDistributionServerSecurePort}` without ever reading it.
**Example (correct):**
```json
{ "operation_type": "registry_operation", "parameters": { "action": "read_dword", "root": "HKLM", "path": "SOFTWARE\\WOW6432Node\\AdventNet\\DesktopCentral\\DCDistributionServer", "key_name": "DCDistributionServerSecurePort", "note": "dc_secure_port", "description": "Read secure port for later TCP check" } },
{ "operation_type": "run_command", "parameters": { "command_to_run": "powershell -Command \"$tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1', ${dc_secure_port}); Write-Output 'CONNECTION_SUCCESS'; $tcp.Close()\"", "exact_value": "CONNECTION_SUCCESS" } }
```

### CM-007: Wait/retry parameters must be used when prompt specifies time constraints
**Problem:** When a test says "verify process is NOT running within 30s" or "verify nginx starts within 60s", the LLM omits `max_wait_time` and `check_interval`, generating an instant check that cannot wait.
**Correction:** When the prompt includes time phrases ("within 30s", "within 60s", "wait up to"), ALWAYS add:
- `max_wait_time`: the number of seconds from the prompt
- `check_interval`: appropriate interval (file checks: 1–3s, service/process: 5–10s, downloads/installs: 15–30s)
**Example (wrong):**
```json
{ "operation_type": "task_manager", "parameters": { "action": "verify_process", "process_name": "dsnginx.exe", "expect": "processnotrunning" } }
```
**Example (correct):**
```json
{ "operation_type": "task_manager", "parameters": { "action": "verify_process", "process_name": "dsnginx.exe", "expect": "processnotrunning", "max_wait_time": "30", "check_interval": "3" } }
```

---

### Parameter Corrections

<!-- 
  Add entries in this format:
  
  ### PC-001: Short Title
  **Operation:** `operation_type` + `action`
  **Problem:** Description of parameter mistake.
  **Correction:** What to use instead.
-->

### PC-001: file_folder_operation delete uses file_path, not path
**Operation:** `file_folder_operation` + `delete`
**Problem:** LLM uses `"path"` as the parameter name.
**Correction:** The correct parameter is `"file_path"` for the delete action.

### PC-002: service_actions uses action parameter, not standalone action verbs
**Operation:** `service_actions`
**Problem:** LLM puts the service action (start/stop/restart) as the operation_type or omits the action parameter.
**Correction:** Use `"operation_type": "service_actions"` with `"parameters": { "action": "start", "service_name": "..." }`.

### PC-003: Action names must be EXACT — do not embellish or invent
**Operation:** ALL operation types with sub-actions
**Problem:** LLM invents action names like `"check_status"`, `"check_running"`, `"start_service"`, `"verify_file"`, `"check_presence_of"` that do not exist in the schema.
**Correction:** Use ONLY the exact action names from the schema:
- `service_actions`: valid actions are `start`, `stop`, `restart`, `status`, `set_startup`, `set_description`, `get_description`, `get_startup`, `get_logon` — NOT `check_status`, `check_running`, `start_service`.
- `task_manager`: valid actions are `verify_process`, `kill_process`, `verify_process_property` — NOT `check_running`, `is_running`, `get_process_info`.
- `file_folder_operation`: valid actions are `create`, `copy`, `move`, `delete`, `rename`, `check_presence`, `verify_absence`, `get_size`, `check_size`, `check_last_modified`, `check_permission`, `add_permission`, `set_permission`, `remove_permission`, `set_share_permission`, `remove_share_permission`.

### PC-004: Every operation MUST include a description parameter
**Operation:** ALL operations
**Problem:** LLM omits the `description` parameter, making generated test cases hard to read and maintain.
**Correction:** Every operation MUST include `"description": "..."` in its `parameters` object. The description should be a concise human-readable sentence explaining what this operation does (e.g., `"Verify DS service is running after start"`, `"Check server.key exists in dsnginx conf folder"`).
### PC-005: registry_operation check_key_not_exists — assert a registry key is absent
**Operation:** `registry_operation` + `check_key_not_exists`
**When to use:** When a test step says the registry key/value should NOT exist (e.g., after uninstall, after a cleanup operation, or to verify a key was never created).
**Parameters:** `root` (required), `path` (required), `key_name` (optional — omit to assert the entire key path is absent).
**Example (assert entire key is absent after uninstall):**
```json
{ "operation_type": "registry_operation", "parameters": { "action": "check_key_not_exists", "root": "HKLM", "path": "SOFTWARE\\AdventNet\\DesktopCentral\\DCAgent", "description": "Verify agent registry key is removed after uninstall" } }
```
**Example (assert a specific value is absent):**
```json
{ "operation_type": "registry_operation", "parameters": { "action": "check_key_not_exists", "root": "HKLM", "path": "SOFTWARE\\AdventNet\\DesktopCentral\\DCAgent\\SystemDetails", "key_name": "LocalMachineName", "description": "Verify LocalMachineName value does not exist" } }
```

### PC-006: native_gui_operation VerifyNotPresent — assert a UI element is NOT visible
**Operation:** `native_gui_operation` + `VerifyNotPresent`
**When to use:** When a test step verifies that a UI element (button, label, dialog, panel) does NOT appear — e.g., an error dialog should not be shown, or an install button should disappear after completion.
**Parameters:** `automationId` (required — the FlaUI automation ID of the element), `timeout` (required — seconds to wait before concluding the element is absent).
**Example (verify error dialog does not appear after install):**
```json
{ "operation_type": "native_gui_operation", "parameters": { "action": "VerifyNotPresent", "automationId": "ErrorDialog", "timeout": 10, "description": "Verify error dialog does not appear after installation completes" } }
```
**Example (verify uninstall button is gone after agent removal):**
```json
{ "operation_type": "native_gui_operation", "parameters": { "action": "VerifyNotPresent", "automationId": "UninstallButton", "timeout": 15, "description": "Verify uninstall button is no longer present after agent removal" } }
```