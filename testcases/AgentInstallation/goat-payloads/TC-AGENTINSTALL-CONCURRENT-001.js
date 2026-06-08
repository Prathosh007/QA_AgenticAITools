component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-CONCURRENT-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-CONCURRENT-001",
  "description": "Run two installer instances simultaneously",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "start /b agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe /silent",
        "command_type": "cmd",
        "description": "Launch first silent installer"
      }
    },
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "start /b agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe /silent",
        "command_type": "cmd",
        "description": "Launch second silent installer immediately"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "msiexec.exe",
        "expect": "processnotrunning",
        "max_wait_time": 180,
        "check_interval": 10,
        "description": "Wait for both installers to finish"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "description": "Verify single agent installation"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify single registry set"
      }
    }
  ],
  "expected_result": "Only one installation succeeds — MSI mutex prevents concurrent installs. Agent service RUNNING."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
