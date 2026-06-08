component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-ZIPINSTALL-004";
payload = {
  "testcase_id": "TC-AGENTINSTALL-ZIPINSTALL-004",
  "description": "Zip install using silent EXE from extracted contents",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "C:\\\\Installers\\\\ZipExtract\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Run silent EXE from extracted zip"
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
        "description": "Verify agent RUNNING"
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
    }
  ],
  "expected_result": "Silent install from zip succeeds. Agent service RUNNING. Registry populated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
