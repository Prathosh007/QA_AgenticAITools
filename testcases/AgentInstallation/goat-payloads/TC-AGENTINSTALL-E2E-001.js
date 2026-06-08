component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-E2E-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-E2E-001",
  "description": "End-to-end: install, verify, and uninstall agent",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Silent install"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Verify service RUNNING"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify registry"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify install dir"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\DCAgent.exe",
        "args": "/uninstall /s",
        "timeout": 120,
        "description": "Silent uninstall"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Verify service removed"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "check_key_not_exists",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "description": "Verify registry removed"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify directory removed"
      }
    }
  ],
  "expected_result": "Full lifecycle: install > verify > uninstall succeeds. Machine returns to clean state."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
