component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-UPGRADE-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-UPGRADE-001",
  "description": "Install newer agent version over existing older version",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "AgentVersion",
        "note": "old_version",
        "description": "Record current agent version before upgrade"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\NewLocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Install newer version silently"
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
        "description": "Verify service RUNNING after upgrade"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "AgentVersion",
        "note": "new_version",
        "description": "Read new agent version"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify server config preserved"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerPort",
        "description": "Verify port preserved"
      }
    }
  ],
  "expected_result": "Upgrade completes. Service RUNNING. Version updated. Server configuration preserved."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
