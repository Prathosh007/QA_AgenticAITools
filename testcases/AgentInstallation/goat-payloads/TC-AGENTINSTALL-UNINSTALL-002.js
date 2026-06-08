component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-UNINSTALL-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-UNINSTALL-002",
  "description": "Silent uninstall via command line",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\DCAgent.exe",
        "args": "/uninstall /s",
        "timeout": 120,
        "description": "Run silent uninstall"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "DCAgent.exe",
        "expect": "processnotrunning",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Wait for DCAgent.exe to finish"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify service removed"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify directory removed"
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
    }
  ],
  "expected_result": "Silent uninstall completes. Service removed. Directory removed. Registry removed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
