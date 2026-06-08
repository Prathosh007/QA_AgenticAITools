component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-001",
  "description": "Automatic push installation — verify agent on target after server push",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 300,
        "check_interval": 10,
        "description": "Wait for agent service to start after push install (timeout 300s)"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify ServerName"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify install directory"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "DCAgentService.exe",
        "expect": "processrunning",
        "description": "Verify DCAgentService.exe running"
      }
    }
  ],
  "expected_result": "Agent installs via push. Service RUNNING. Registry populated. Install directory present. Process running."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
