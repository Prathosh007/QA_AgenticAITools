component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTEXE-006";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTEXE-006",
  "description": "Silent EXE install on Windows Server 2019",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Silent install on Windows Server 2019"
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
        "description": "Verify agent service RUNNING"
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
        "description": "Verify install directory"
      }
    }
  ],
  "expected_result": "Silent install succeeds on Windows Server 2019. Agent service RUNNING."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
