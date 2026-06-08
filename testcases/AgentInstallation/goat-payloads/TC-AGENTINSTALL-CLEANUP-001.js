component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-CLEANUP-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-CLEANUP-001",
  "description": "Verify complete cleanup after uninstall — no leftover files or registry",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify install directory removed"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "check_key_not_exists",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "description": "Verify DCAgent registry removed"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "check_key_not_exists",
        "root": "HKLM",
        "path": "SYSTEM\\\\CurrentControlSet\\\\Services\\\\DCAgent",
        "description": "Verify Services\\\\DCAgent registry removed"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "DCAgentService.exe",
        "expect": "processnotrunning",
        "description": "Verify no running process"
      }
    }
  ],
  "expected_result": "Install directory fully removed. All registry keys removed. No running processes."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
