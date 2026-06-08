component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTMSI-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTMSI-001",
  "description": "Fresh silent MSI installation via msiexec command",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "msiexec /i \"UEMSAgent.msi\" /qn TRANSFORMS=\"UEMSAgent.mst\" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual SERVER_ROOT_CRT=\"%cd%\\DMRootCA-Server.crt\" DS_ROOT_CRT=\"%cd%\\DMRootCA.crt\" /lv \"Agentinstalllog.txt\"",
        "command_type": "cmd",
        "description": "Run MSI silent install via msiexec"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "msiexec.exe",
        "expect": "processnotrunning",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Wait for msiexec to complete"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": ".",
        "filename": "Agentinstalllog.txt",
        "description": "Verify install log created"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
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
        "description": "Verify ServerName registry"
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
  "expected_result": "MSI installs silently. Log created. Agent service RUNNING. Registry populated. Install directory present."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
