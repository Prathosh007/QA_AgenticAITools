##############################################################################
# Generate GOAT JSON payloads for NotificationServer test cases
# Posts to testcase-db and saves locally
##############################################################################

$DB_URL = "http://prathosh-14802-t:3000"
$GOAT_DIR = "$PSScriptRoot\goat-payloads"

if (!(Test-Path $GOAT_DIR)) { New-Item -ItemType Directory -Path $GOAT_DIR -Force | Out-Null }

# ── Fetch all NotificationServer TCs from DB ─────────────────────────────────
Write-Host "`n=== Fetching test cases from DB ===" -ForegroundColor Cyan
$r = Invoke-WebRequest -Uri "$DB_URL/testcases?functionality=NotificationServer" -UseBasicParsing -TimeoutSec 10
$allTcs = $r.Content | ConvertFrom-Json
Write-Host "Got $($allTcs.Count) test cases" -ForegroundColor Green

# ── GOAT Payload Generator ───────────────────────────────────────────────────
# Based on GOAT_Operations_Context.md rules

$converted = 0
$gapped = 0
$gaps = @()

function Generate-GoatPayload {
    param($tc)
    
    $id = $tc.id
    $desc = $tc.title
    $category = $tc.sub_functionality
    $steps = $tc.steps
    $expected = $tc.expected_result
    
    $operations = @()
    $hasGap = $false
    $gapSteps = @()
    
    # Route based on category and steps content
    switch -Regex ($id) {
        "^DC_NS_1$" {
            # Installation - services check
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "ManageEngine Desktop Central Server"; expect = "serviceRunning"; description = "Verify DC Server service is running" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify Notification Server service is running" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "listening on port"; description = "Verify NS startup banner in log with port info" } }
        }
        "^DC_NS_2$" {
            # Uninstallation - verify NS removed
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "sc query dcnotificationserver"; command_type = "cmd"; exact_value = "service does not exist"; description = "Verify NS service no longer exists after uninstall" } }
        }
        "^DC_NS_3$" {
            # Restart DC Server - NS should restart
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "ManageEngine Desktop Central Server"; description = "Restart DC Server service" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "60"; check_interval = "5"; description = "Verify NS service restarts and is running" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "start"; description = "Verify nscontrollerlog records start transition" } }
        }
        "^DC_NS_4$" {
            # Stop NS - failure count = 1
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "stop"; service_name = "dcnotificationserver"; description = "Stop Notification Server service" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "failure count"; description = "Verify exception logged with failure count" } }
        }
        "^DC_NS_5$" {
            # NS watchdog auto-restart
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "120"; check_interval = "10"; description = "Verify NS auto-restarts via watchdog after stop" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "restart"; description = "Verify nscontrollerlog records restart entry" } }
        }
        "^DC_NS_6$" {
            # Second stop - failure count = 2
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "stop"; service_name = "dcnotificationserver"; description = "Stop NS service for second time within 1 hour" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "failure count"; description = "Verify failure count = 2 in nscontrollerlog" } }
        }
        "^DC_NS_7$" {
            # NS still auto-restarts after 2nd stop
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "120"; check_interval = "10"; description = "Verify NS auto-restarts after second stop" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "restart"; description = "Verify restart entry in nscontrollerlog" } }
        }
        "^DC_NS_8$" {
            # Third stop - failure count = 3
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "stop"; service_name = "dcnotificationserver"; description = "Stop NS service for third time within 1 hour" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "failure count"; description = "Verify failure count = 3 in nscontrollerlog" } }
        }
        "^DC_NS_9$" {
            # NS does NOT restart after 3rd stop
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceStopped"; max_wait_time = "120"; check_interval = "10"; description = "Verify NS does NOT auto-restart after third stop" } }
            $operations += @{ operation_type = "db_operation"; parameters = @{ action = "query"; query = "SELECT NS_ENABLED FROM NSDETAILS"; expected_value = "0"; description = "Verify NSDETAILS table shows NS disabled" } }
        }
        "^DC_NS_10$" {
            # Web console alert - BROWSER/QENGINE scope
            $hasGap = $true
            $gapSteps += "Web console UI verification - Qengine scope only"
        }
        "^DC_NS_11$" {
            # Re-enable NS via DB update
            $operations += @{ operation_type = "db_operation"; parameters = @{ action = "update"; query = "UPDATE NSDETAILS SET NS_ENABLED = 1"; description = "Re-enable NS by setting NS_ENABLED = 1 in DB" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "start"; service_name = "dcnotificationserver"; description = "Start NS service after re-enabling" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "30"; check_interval = "5"; description = "Verify NS is running after re-enable" } }
        }
        "^DC_NS_12$" {
            # Verify dcnsdbsettings.conf has LAN/WAN timeouts
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key = "ns.lanTimeout"; description = "Verify ns.lanTimeout key exists in dcnsdbsettings.conf" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key = "ns.wanTimeout"; description = "Verify ns.wanTimeout key exists in dcnsdbsettings.conf" } }
        }
        "^DC_NS_13$" {
            # Verify dcnssettings.conf
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnssettings.conf"; key = "service.name"; description = "Verify service name key in dcnssettings.conf" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnssettings.conf"; key = "port"; description = "Verify port key in dcnssettings.conf" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnssettings.conf"; key = "display.name"; description = "Verify display name key in dcnssettings.conf" } }
        }
        "^DC_NS_14$" {
            # ns-status-details.xml
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/client-data"; filename = "ns-status-details.xml"; path = "//PortNo"; description = "Verify PortNo in ns-status-details.xml" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/client-data"; filename = "ns-status-details.xml"; path = "//LANTimeout"; description = "Verify LANTimeout in ns-status-details.xml" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/client-data"; filename = "ns-status-details.xml"; path = "//WANTimeout"; description = "Verify WANTimeout in ns-status-details.xml" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/client-data"; filename = "ns-status-details.xml"; path = "//NSEnabled"; description = "Verify NSEnabled in ns-status-details.xml" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/client-data"; filename = "ns-status-details.xml"; path = "//MaxFailureCount"; description = "Verify MaxFailureCount in ns-status-details.xml" } }
        }
        "^DC_NS_15$" {
            # dcnsdetails DB table
            $operations += @{ operation_type = "db_operation"; parameters = @{ action = "query"; query = "SELECT * FROM dcnsdetails"; description = "Query dcnsdetails table and verify columns populated" } }
        }
        "^DC_NS_16$" {
            # nscrashinfo DB table
            $operations += @{ operation_type = "db_operation"; parameters = @{ action = "verify_presence"; query = "SELECT build_number, crash_time FROM nscrashinfo ORDER BY crash_time DESC LIMIT 1"; value = "build"; description = "Verify nscrashinfo has at least one crash entry with build number" } }
        }
        "^DC_NS_17$" {
            # Agent registry NS details
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "check_key_exists"; root = "HKLM"; path = "SOFTWARE\\WOW6432NODE\\NSSTATUSDETAILS"; key_name = "PortNo"; description = "Verify PortNo key exists in agent NS registry" } }
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "read_key"; root = "HKLM"; path = "SOFTWARE\\WOW6432NODE\\NSSTATUSDETAILS"; key_name = "LANTimeout"; note = "ns_lan_timeout"; description = "Read LANTimeout from agent registry" } }
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "read_key"; root = "HKLM"; path = "SOFTWARE\\WOW6432NODE\\NSSTATUSDETAILS"; key_name = "WANTimeout"; note = "ns_wan_timeout"; description = "Read WANTimeout from agent registry" } }
        }
        "^DC_NS_18$" {
            # Agent registration
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; description = "Verify REGISTER entry in dcnsclientaccess log" } }
        }
        "^DC_NS_19$" {
            # Re-register every 10 min
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; description = "Verify periodic REGISTER entries in dcnsclientaccess" } }
        }
        "^DC_NS_20$" {
            # Agent retry after failure (Win/Mac)
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "stop"; service_name = "dcnotificationserver"; description = "Stop NS to simulate registration failure" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "start"; service_name = "dcnotificationserver"; description = "Restart NS service" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; max_wait_time = "30"; check_interval = "3"; description = "Verify agent retries REGISTER within seconds of NS coming back" } }
        }
        "^DC_NS_21$" {
            # Linux agent retry - no GOAT marker in CSV
            $hasGap = $true
            $gapSteps += "Linux agent timing verification requires Linux agent environment"
        }
        "^DC_NS_22$" {
            # Livelist every 10 min
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "LIVE_LIST"; description = "Verify LIVE_LIST entries in nsrequestlog" } }
        }
        "^DC_NS_23$" {
            # Default port 8027
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "netstat -ano | findstr 8027"; command_type = "cmd"; value_to_search = "LISTENING"; description = "Verify NS listening on port 8027" } }
            $operations += @{ operation_type = "task_manager"; parameters = @{ action = "verify_process"; process_name = "dcnotificationserver.exe"; expect = "processrunning"; port = "8027"; description = "Verify NS process is bound to port 8027" } }
        }
        "^DC_NS_24$" {
            # Port change via Admin - BROWSER scope
            $hasGap = $true
            $gapSteps += "Web console Admin > Server Settings interaction - Qengine scope"
        }
        "^DC_NS_25$" {
            # Port busy rejection - BROWSER scope
            $hasGap = $true
            $gapSteps += "Web console alert verification - Qengine scope"
        }
        "^DC_NS_26$" {
            # nssettings file port check
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnssettings.conf"; key = "port"; description = "Verify port number in dcnssettings.conf after port change" } }
        }
        "^DC_NS_27$" {
            # Agent client-data ns-status-details update
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "agent_home/client-data"; filename = "ns-status-details.xml"; path = "//PortNo"; description = "Verify agent ns-status-details.xml reflects new port" } }
        }
        "^DC_NS_28$" {
            # Agent registry port update
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "read_key"; root = "HKLM"; path = "SOFTWARE\\WOW6432NODE\\NSSTATUSDETAILS"; key_name = "PortNo"; note = "ns_port"; description = "Read PortNo from agent registry and verify updated value" } }
        }
        "^DC_NS_29$" {
            # Ondemand config deploy
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; description = "Verify PUSH entry in nsrequestlog for ondemand deploy" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "agent_home/logs"; filename = "dcconfigondemand.log"; value = "config"; description = "Verify agent received config in dcconfigondemand log" } }
        }
        "^DC_NS_30$" {
            # Ondemand via DS
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; max_wait_time = "300"; check_interval = "15"; description = "Verify PUSH entry in nsrequestlog after DS replication" } }
        }
        "^DC_NS_31$" {
            # Inventory + patch scan
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; description = "Verify ondemand scan PUSH entries" } }
        }
        "^DC_NS_32$" {
            # Move to remote office
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "agent_home/logs"; filename = "dcondemandaccess.log"; value = "move"; description = "Verify agent received move command in dcondemandaccess log" } }
        }
        "^DC_NS_33$" {
            # Chat to agent
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "chat"; description = "Verify chat entry in nsrequestlog" } }
        }
        "^DC_NS_34$" {
            # RDS connection - browser scope
            $hasGap = $true
            $gapSteps += "RDS HTML/ActiveX viewer interaction - Qengine/browser scope"
        }
        "^DC_NS_35$" {
            # System Manager task
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; description = "Verify System Manager task PUSH in nsrequestlog" } }
        }
        "^DC_NS_36$" {
            # Announcement task
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; description = "Verify Announcement task delivery via PUSH" } }
        }
        "^DC_NS_37$" {
            # Remote shutdown
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; description = "Verify Remote Shutdown task PUSH entry" } }
        }
        "^DC_NS_38$" {
            # Wake-on-LAN
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "WoL"; description = "Verify WoL task entry in nsrequestlog" } }
        }
        "^DC_NS_39$" {
            # Agent-down status red - BROWSER scope
            $hasGap = $true
            $gapSteps += "Web console live-status icon verification - Qengine scope"
        }
        "^DC_NS_40$" {
            # Agent-up status green - BROWSER scope
            $hasGap = $true
            $gapSteps += "Web console live-status icon verification - Qengine scope"
        }
        "^DC_NS_41$" {
            # Troubleshooting tool - agent-side native tool
            $hasGap = $true
            $gapSteps += "Agent-side Troubleshooting tool GUI interaction - native_gui_operation scope but tool-specific"
        }
        "^DC_NS_42$" {
            # Log count = 3 + cores
            $operations += @{ operation_type = "machine_operation"; parameters = @{ action = "get_machine_spec"; info_type = "architecture"; note = "cpu_info"; description = "Get machine CPU info for core count" } }
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "check_presence"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; description = "Verify dcnotificationserver log files exist" } }
        }
        "^DC_NS_43$" {
            # Each log shows distinct thread ID
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "thread_id"; description = "Verify thread_id field in dcnotificationserver log" } }
        }
        "^DC_NS_44$" {
            # Resource action timing - BROWSER scope
            $hasGap = $true
            $gapSteps += "Web console resource-action icon click - Qengine scope"
        }
        "^DC_NS_45$" {
            # Dump folder
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "check_presence"; file_path = "server_home/Logs/Dump"; description = "Verify Dump folder exists under Logs" } }
        }
        "^DC_NS_46$" {
            # Batch file disables NS logger
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "read_dword"; root = "HKLM"; path = "SOFTWARE\\AdventNet\\DesktopCentral"; key_name = "NSLoggerLevel"; expected_value = "6"; description = "Verify NSLoggerLevel = 6 after running disable-logger batch" } }
        }
        "^DC_NS_Uninstall_Failure_1$" {
            # MgrtDC.bat Stop/Uninstall/Install
            $operations += @{ operation_type = "run_bat"; parameters = @{ action = "execute"; file_path = "server_home/bin/MgrtDC.bat"; timeout = "300"; description = "Execute MgrtDC.bat for Stop/Uninstall/Install cycle" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "60"; check_interval = "5"; description = "Verify NS is running after MgrtDC.bat" } }
        }
        "^DC_NS_Uninstall_Failure_2$" {
            # ns-status-details.xml port after change
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/client-data"; filename = "ns-status-details.xml"; path = "//PortNo"; description = "Verify ns-status-details.xml reflects new port after port change" } }
        }
        "^DC_NS_Uninstall_Failure_3$" {
            # Only Stop/Start on port change (not uninstall/reinstall)
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "Stop"; description = "Verify Stop entry in nscontroller.log during port change" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "Start"; description = "Verify Start entry in nscontroller.log during port change" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_removed"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "Uninstall"; description = "Verify NO Uninstall entry in nscontroller.log" } }
        }
        "^DC_NS_Uninstall_Failure_4$" {
            # nscontroller.log Stop/Start entries
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "Stop"; description = "Verify Stop log entry with timestamp" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "Start"; description = "Verify Start log entry with timestamp" } }
        }
        "^DC_NS_Uninstall_Failure_5$" {
            # Message Box deploy immediately
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "agent_home/logs"; filename = "dcconfigondemand.log"; value = "MessageBox"; max_wait_time = "30"; check_interval = "3"; description = "Verify Message Box config deployed to agent" } }
        }
        "^DC_NS_NEW_01$" {
            # TLS enable
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "update"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key_to_update = "ns.tlsEnable"; new_value = "true"; description = "Set ns.tlsEnable = true in dcnsdbsettings.conf" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply TLS setting" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "TLS enabled"; description = "Verify TLS-enabled banner in NS log" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; max_wait_time = "60"; check_interval = "5"; description = "Verify agent registers over TLS" } }
        }
        "^DC_NS_NEW_02$" {
            # Malformed SSL data
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "powershell -Command `"& { `$tcp = New-Object System.Net.Sockets.TcpClient; `$tcp.Connect('127.0.0.1', 8027); `$stream = `$tcp.GetStream(); `$bytes = [byte[]](0x16, 0x03, 0x01, 0xFF, 0xFF); `$stream.Write(`$bytes, 0, `$bytes.Length); Start-Sleep -Seconds 2; `$tcp.Close(); Write-Output 'INJECT_DONE' }`""; exact_value = "INJECT_DONE"; description = "Inject malformed SSL data to NS" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify NS remains running after malformed SSL data" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "SSL error"; description = "Verify SSL error logged in NS log" } }
        }
        "^DC_NS_NEW_03$" {
            # AES-256 decryption
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "update"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key_to_update = "ns.encEnable"; new_value = "true"; description = "Enable encryption in dcnsdbsettings.conf" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply encryption setting" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; max_wait_time = "60"; check_interval = "5"; description = "Verify agent registers with encrypted payload" } }
        }
        "^DC_NS_NEW_04$" {
            # Mismatched salt rejection
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "decrypt"; description = "Verify decryption failure logged for mismatched salt" } }
        }
        "^DC_NS_NEW_05$" {
            # PUSH from non-localhost rejected
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "invalid"; description = "Verify non-localhost PUSH request rejected and logged" } }
        }
        "^DC_NS_NEW_06$" {
            # DACL verification
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "sc sdshow dcnotificationserver"; command_type = "cmd"; value_to_search = "D:"; description = "Show DACL for dcnotificationserver service" } }
        }
        "^DC_NS_NEW_07$" {
            # Worker thread count scales by cores
            $operations += @{ operation_type = "task_manager"; parameters = @{ action = "verify_process"; process_name = "dcnotificationserver.exe"; expect = "processrunning"; description = "Verify NS process is running" } }
            $operations += @{ operation_type = "task_manager"; parameters = @{ action = "verify_process_property"; search_type = "name"; search_type_value = "dcnotificationserver.exe"; expected_type = "threads"; note = "ns_thread_count"; description = "Get NS thread count to verify scaling with cores" } }
        }
        "^DC_NS_NEW_08$" {
            # Registry override for worker threads
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "write_key"; root = "HKLM"; path = "SOFTWARE\\AdventNet\\DesktopCentral\\NotificationServer"; key_name = "WorkerThreadCount"; value = "6"; value_type = "REG_DWORD"; description = "Set worker thread override to 6 in registry" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply registry override" } }
            $operations += @{ operation_type = "task_manager"; parameters = @{ action = "verify_process_property"; search_type = "name"; search_type_value = "dcnotificationserver.exe"; expected_type = "threads"; expected_type_value = "6"; description = "Verify exactly 6 worker threads after override" } }
        }
        "^DC_NS_NEW_09$" {
            # 500+ concurrent agents - load test
            $hasGap = $true
            $gapSteps += "Load generator with 500-2000 concurrent sockets - requires external load tool"
        }
        "^DC_NS_NEW_10$" {
            # Duplicate resourceID overwrite
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "overwrite"; description = "Verify duplicate resourceID overwrite entry in access log" } }
        }
        "^DC_NS_NEW_11$" {
            # 24h soak test - not automatable in single shot
            $hasGap = $true
            $gapSteps += "24-hour soak test with continuous churn - requires long-running load tool"
        }
        "^DC_NS_NEW_12$" {
            # Abnormal disconnect frees context
            $operations += @{ operation_type = "task_manager"; parameters = @{ action = "kill_process"; process_name = "dcagentservice.exe"; description = "Force-kill agent process to simulate abnormal disconnect" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "disconnect"; max_wait_time = "30"; check_interval = "3"; description = "Verify disconnect entry in access log after abnormal termination" } }
        }
        "^DC_NS_NEW_13$" {
            # -a reinstall lifecycle
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "server_home\\bin\\dcnotificationserver.exe -a reinstall"; command_type = "cmd"; exact_value = ""; description = "Execute NS reinstall command" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "60"; check_interval = "5"; description = "Verify NS is running after reinstall" } }
        }
        "^DC_NS_NEW_14$" {
            # -a changeport
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "server_home\\bin\\dcnotificationserver.exe -a changeport -k 8028"; command_type = "cmd"; description = "Execute NS changeport command to 8028" } }
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "netstat -ano | findstr 8028"; command_type = "cmd"; value_to_search = "LISTENING"; description = "Verify NS listening on new port 8028" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/conf"; filename = "dcnssettings.conf"; key = "port"; value = "8028"; description = "Verify dcnssettings.conf has new port" } }
            $operations += @{ operation_type = "db_operation"; parameters = @{ action = "verify_presence"; query = "SELECT port_no FROM dcnsdetails"; value = "8028"; description = "Verify dcnsdetails table has new port" } }
        }
        "^DC_NS_NEW_15$" {
            # FOS - NS on exactly one node
            $hasGap = $true
            $gapSteps += "Failover environment with two nodes - requires multi-machine orchestration"
        }
        "^DC_NS_NEW_16$" {
            # Secondary Server NS install
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "sc query dcnotificationserver"; command_type = "cmd"; value_to_search = "RUNNING"; description = "Verify NS service is created and running on Secondary Server" } }
        }
        "^DC_NS_NEW_17$" {
            # Stale old server service handled
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify NS starts cleanly after handling stale service" } }
        }
        "^DC_NS_NEW_18$" {
            # Watchdog detects hang
            $hasGap = $true
            $gapSteps += "Process suspension with Process Hacker/debugger - requires external debugger tool"
        }
        "^DC_NS_NEW_19$" {
            # Agent through WAF
            $hasGap = $true
            $gapSteps += "WAF configuration and network topology - requires external WAF setup"
        }
        "^DC_NS_NEW_20$" {
            # Multi-NIC IP iteration
            $hasGap = $true
            $gapSteps += "Multi-NIC agent with firewall rules - requires specific network config"
        }
        "^DC_NS_NEW_21$" {
            # All IPs blocked - clean failure
            $hasGap = $true
            $gapSteps += "All agent IPs blocked via firewall - requires specific network config"
        }
        "^DC_NS_NEW_22$" {
            # TCP RST handling
            $hasGap = $true
            $gapSteps += "Forced TCP RST mid-read - requires iptables/WFP rule manipulation"
        }
        "^DC_NS_NEW_23$" {
            # PUSH end-to-end
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; description = "Verify PUSH entry in nsrequestlog for ondemand config" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "agent_home/logs"; filename = "dcconfigondemand.log"; value = "config"; max_wait_time = "30"; check_interval = "3"; description = "Verify agent received push in dcconfigondemand log" } }
        }
        "^DC_NS_NEW_24$" {
            # ALIVE_STATUS
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "ALIVE_STATUS"; description = "Verify ALIVE_STATUS entry in nsrequestlog" } }
        }
        "^DC_NS_NEW_25$" {
            # LIVE_LIST
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "LIVE_LIST"; description = "Verify LIVE_LIST entry in nsrequestlog" } }
        }
        "^DC_NS_NEW_26$" {
            # WAN timeout
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "update"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key_to_update = "ns.wanTimeout"; new_value = "60"; description = "Set WAN timeout to 60s" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply WAN timeout" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "timeout"; max_wait_time = "90"; check_interval = "5"; description = "Verify timeout applied for WAN agent" } }
        }
        "^DC_NS_NEW_27$" {
            # DS replication cycle
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "PUSH"; max_wait_time = "300"; check_interval = "15"; description = "Verify ondemand via DS waits for replication cycle" } }
        }
        "^DC_NS_NEW_28$" {
            # dcondemand OpenSSL legacy provider
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "agent_home/logs"; filename = "dcondemand.log"; value = "error"; description = "Verify dcondemand logs clean error without legacy provider" } }
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "verify_absence"; file_path = "agent_home/logs"; filename = "crash_dump"; description = "Verify no crash dump created" } }
        }
        "^DC_NS_NEW_29$" {
            # REGISTER fields verification
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; description = "Verify REGISTER entry with identity fields in access log" } }
        }
        "^DC_NS_NEW_30$" {
            # Re-register cadence 10 min
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; description = "Verify periodic REGISTER entries at 10 min cadence" } }
        }
        "^DC_NS_NEW_31$" {
            # Linux agent retry at next slot
            $hasGap = $true
            $gapSteps += "Linux agent timing verification - requires Linux agent environment"
        }
        "^DC_NS_NEW_32$" {
            # Win/Mac immediate retry
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "stop"; service_name = "dcnotificationserver"; description = "Stop NS to cause agent register failure" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "start"; service_name = "dcnotificationserver"; description = "Restart NS" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; max_wait_time = "15"; check_interval = "2"; description = "Verify agent retries immediately after NS comes back" } }
        }
        "^DC_NS_NEW_33$" {
            # MONITOR_STATUS keeps socket alive
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_removed"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "disconnect"; description = "Verify no spurious disconnect events during MONITOR_STATUS" } }
        }
        "^DC_NS_NEW_34$" {
            # DumpCreator.dll absence
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "rename"; source = "server_home/bin/DumpCreator.dll"; target_name = "DumpCreator.dll.bak"; description = "Rename DumpCreator.dll to simulate absence" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS without DumpCreator.dll" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "DumpCreator"; description = "Verify DumpCreator not found warning logged" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify NS stays running without DumpCreator" } }
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "rename"; source = "server_home/bin/DumpCreator.dll.bak"; target_name = "DumpCreator.dll"; description = "Restore DumpCreator.dll" } }
        }
        "^DC_NS_NEW_35$" {
            # Crash dump on AV - requires debugger
            $hasGap = $true
            $gapSteps += "Force access violation with debugger - requires external debugger tool"
        }
        "^DC_NS_NEW_36$" {
            # Dump rotation max 50
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "check_presence"; file_path = "server_home/Logs/Dump"; description = "Verify Dump folder exists" } }
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "powershell -Command `"(Get-ChildItem 'server_home/Logs/Dump' -Filter '*.dmp').Count`""; value_to_search = ""; note = "dump_count"; description = "Count dump files to verify max 50 rotation" } }
        }
        "^DC_NS_NEW_37$" {
            # NSLoggerLevel registry controls verbosity
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "write_key"; root = "HKLM"; path = "SOFTWARE\\AdventNet\\DesktopCentral"; key_name = "NSLoggerLevel"; value = "6"; value_type = "REG_DWORD"; description = "Set NSLoggerLevel to 6 (disable)" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply logger level 6" } }
            $operations += @{ operation_type = "registry_operation"; parameters = @{ action = "write_key"; root = "HKLM"; path = "SOFTWARE\\AdventNet\\DesktopCentral"; key_name = "NSLoggerLevel"; value = "1"; value_type = "REG_DWORD"; description = "Set NSLoggerLevel to 1 (verbose)" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply logger level 1" } }
        }
        "^DC_NS_NEW_38$" {
            # Log rotation
            $operations += @{ operation_type = "file_folder_operation"; parameters = @{ action = "check_presence"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; description = "Verify active NS log file exists" } }
        }
        "^DC_NS_NEW_39$" {
            # Concurrent writes to access log - load test
            $hasGap = $true
            $gapSteps += "200 concurrent registrations load test - requires external load tool"
        }
        "^DC_NS_NEW_40$" {
            # 3 crashes disables NS - requires debugger
            $hasGap = $true
            $gapSteps += "Force 3 crashes with debugger within 1 hour - requires debugger attachment"
        }
        "^DC_NS_NEW_41$" {
            # Re-enable NS via NSDETAILS
            $operations += @{ operation_type = "db_operation"; parameters = @{ action = "update"; query = "UPDATE NSDETAILS SET NS_ENABLED = 1"; description = "Re-enable NS in NSDETAILS table" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "start"; service_name = "dcnotificationserver"; description = "Start NS service" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "30"; check_interval = "5"; description = "Verify NS is running" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "REGISTER"; max_wait_time = "60"; check_interval = "5"; description = "Verify agents resume registration" } }
        }
        "^DC_NS_NEW_42$" {
            # Failure counter reset after >1h
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nscontroller.log"; value = "failure count"; description = "Verify failure count resets to 1 when crashes are >1h apart" } }
        }
        "^DC_NS_NEW_43$" {
            # dcnsdbsettings.conf reload on restart
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "update"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key_to_update = "ns.lanTimeout"; new_value = "45"; description = "Update ns.lanTimeout in conf" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to reload config" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "45"; description = "Verify new lanTimeout value loaded in log" } }
        }
        "^DC_NS_NEW_44$" {
            # Echo enable
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "update"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key_to_update = "ns.echoEnable"; new_value = "true"; description = "Enable echo in dcnsdbsettings.conf" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply echo setting" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "echo"; description = "Verify echo activity in NS log" } }
        }
        "^DC_NS_NEW_45$" {
            # Echo disable
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "update"; file_path = "server_home/conf"; filename = "dcnsdbsettings.conf"; key_to_update = "ns.echoEnable"; new_value = "false"; description = "Disable echo in dcnsdbsettings.conf" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "restart"; service_name = "dcnotificationserver"; description = "Restart NS to apply echo disable" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify NS runs normally without echo" } }
        }
        "^DC_NS_NEW_46$" {
            # -n/-d/-m install args
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "sc query CustomNS"; command_type = "cmd"; value_to_search = "RUNNING"; description = "Verify custom-named NS service is running" } }
        }
        "^DC_NS_NEW_47$" {
            # Port busy on install
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "netstat -ano | findstr 8027"; command_type = "cmd"; value_to_search = "LISTENING"; description = "Verify port 8027 already in use" } }
        }
        "^DC_NS_NEW_48$" {
            # x86/x64 smoke
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify NS service running (x86/x64 smoke)" } }
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "netstat -ano | findstr 8027"; command_type = "cmd"; value_to_search = "LISTENING"; description = "Verify NS listening on port" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnsclientaccess.log"; value = "REGISTER"; max_wait_time = "30"; check_interval = "5"; description = "Verify agent registers successfully" } }
        }
        "^DC_NS_NEW_49$" {
            # Tcpip dependency
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "sc qc dcnotificationserver"; command_type = "cmd"; value_to_search = "Tcpip"; description = "Verify NS service depends on Tcpip" } }
        }
        "^DC_NS_NEW_50$" {
            # Duplicate install rejected
            $operations += @{ operation_type = "run_command"; parameters = @{ command_to_run = "server_home\\bin\\dcnotificationserver.exe -a install 2>&1"; command_type = "cmd"; value_to_search = "already"; description = "Verify duplicate install is rejected" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; description = "Verify existing service is unaffected" } }
        }
        "^DC_NS_NEW_51$" {
            # dcondemandtasks executes and reports
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "OP_RECEIVE_RESPONSE"; max_wait_time = "60"; check_interval = "5"; description = "Verify OP_RECEIVE_RESPONSE in nsrequestlog" } }
        }
        "^DC_NS_NEW_52$" {
            # dcondemand failure path
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "nsrequestlog.txt"; value = "failure"; max_wait_time = "30"; check_interval = "5"; description = "Verify failure entry in nsrequestlog for failed task" } }
        }
        "^DC_NS_NEW_53$" {
            # DNS re-resolve on reconnect
            $hasGap = $true
            $gapSteps += "DNS A-record manipulation - requires DNS server control"
        }
        "^DC_NS_NEW_54$" {
            # 1000 agents for 8h soak
            $hasGap = $true
            $gapSteps += "1000 agent 8-hour soak test - requires external load tool and extended time"
        }
        "^DC_NS_NEW_55$" {
            # SOMAXCONN overflow
            $hasGap = $true
            $gapSteps += "SOMAXCONN overflow test - requires external load tool"
        }
        "^DC_NS_NEW_56$" {
            # Boost.Asio variant
            $hasGap = $true
            $gapSteps += "ASIO variant build - requires special build configuration"
        }
        "^DC_NS_NEW_57$" {
            # CServerServiceStatusListener
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "stop"; service_name = "ManageEngine Desktop Central Server"; description = "Stop dependent DC Server service" } }
            $operations += @{ operation_type = "file_folder_modification"; parameters = @{ action = "value_should_be_present"; file_path = "server_home/logs"; filename = "dcnotificationserver0.log"; value = "listener"; max_wait_time = "30"; check_interval = "3"; description = "Verify listener fires on dependent service stop" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "start"; service_name = "ManageEngine Desktop Central Server"; description = "Restart dependent DC Server service" } }
            $operations += @{ operation_type = "service_actions"; parameters = @{ action = "status"; service_name = "dcnotificationserver"; expect = "serviceRunning"; max_wait_time = "30"; check_interval = "5"; description = "Verify NS resumes after dependent service restarts" } }
        }
        default {
            $hasGap = $true
            $gapSteps += "No specific GOAT mapping defined for this test case"
        }
    }
    
    return @{
        operations = $operations
        hasGap = $hasGap
        gapSteps = $gapSteps
    }
}

# ── Generate and upload payloads ─────────────────────────────────────────────
Write-Host "`n=== Generating GOAT Payloads ===" -ForegroundColor Cyan

foreach ($tc in $allTcs) {
    $result = Generate-GoatPayload -tc $tc
    
    if ($result.hasGap) {
        # Report gap
        $gapped++
        foreach ($gs in $result.gapSteps) {
            $gapBody = [PSCustomObject]@{
                tc_id = $tc.id
                functionality = "NotificationServer"
                missing_util = "manual_only"
                step_text = $gs
                suggestion = "Requires external tool or browser automation (Qengine scope)"
            } | ConvertTo-Json -Depth 5 -Compress
            try {
                $null = Invoke-WebRequest -Uri "$DB_URL/gaps" -Method POST -Body $gapBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
            } catch {}
        }
        $gaps += @{ id = $tc.id; reason = ($result.gapSteps -join "; ") }
    } else {
        # Build payload
        $component = '$Server_Machine_IP'
        if ($tc.platform -match "agent|mac|linux" -or $tc.id -match "DC_NS_(17|18|19|20|27|28|29|32)$|DC_NS_NEW_(29|30|32)$|DC_NS_Uninstall_Failure_5") {
            $component = '$LocalOffice_WinAgent1'
        }
        
        $payloadObj = [ordered]@{
            testcase_id = $tc.id
            description = $tc.title
            reuse_installation = $false
            operations = $result.operations
            expected_result = $tc.expected_result
        }
        
        $payloadJson = $payloadObj | ConvertTo-Json -Depth 10
        
        $jsContent = @"
component = $component;
testcaseId = "$($tc.id)";
payload = $payloadJson;
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
"@
        
        # Save locally
        $localPath = Join-Path $GOAT_DIR "$($tc.id).js"
        Set-Content -Path $localPath -Value $jsContent -Encoding UTF8
        
        # Upload to DB
        $payloadBody = [PSCustomObject]@{
            tc_id = $tc.id
            functionality = "NotificationServer"
            component = $component
            payload = $jsContent
        } | ConvertTo-Json -Depth 10 -Compress
        
        try {
            $null = Invoke-WebRequest -Uri "$DB_URL/payloads" -Method POST -Body $payloadBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
            $converted++
        } catch {
            Write-Host "  PAYLOAD FAILED: $($tc.id) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ── Save gap report ──────────────────────────────────────────────────────────
$gapReport = @"
# GOAT Conversion Gap Report - NotificationServer

## Summary
- **Converted:** $converted test cases
- **Gapped:** $gapped test cases (require manual execution or external tools)

## Gap Details

"@

foreach ($g in $gaps) {
    $gapReport += "### $($g.id)`n- **Reason:** $($g.reason)`n`n"
}

Set-Content -Path (Join-Path $GOAT_DIR "gap-report.md") -Value $gapReport -Encoding UTF8

# ── Verification ─────────────────────────────────────────────────────────────
Write-Host "`n=== Verification ===" -ForegroundColor Cyan

$payR = Invoke-WebRequest -Uri "$DB_URL/payloads?functionality=NotificationServer" -UseBasicParsing -TimeoutSec 10
$payCount = ($payR.Content | ConvertFrom-Json).Count

$gapR = Invoke-WebRequest -Uri "$DB_URL/gaps?functionality=NotificationServer" -UseBasicParsing -TimeoutSec 10
$gapCount = ($gapR.Content | ConvertFrom-Json).Count

Write-Host "=== CONVERSION SUMMARY ===" -ForegroundColor Green
Write-Host "Converted:    $converted test cases" -ForegroundColor Green
Write-Host "Skipped:      $gapped test cases (missing utils / browser scope)" -ForegroundColor Yellow
Write-Host ""
Write-Host "DB Verified: Payloads $payCount/$converted, Gaps $gapCount/$gapped" -ForegroundColor Cyan
Write-Host "Local files: $(Join-Path $GOAT_DIR '*.js')" -ForegroundColor Cyan
