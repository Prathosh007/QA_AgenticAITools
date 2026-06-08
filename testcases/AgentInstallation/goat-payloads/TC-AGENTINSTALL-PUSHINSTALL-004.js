component = $DS_Machine_IP;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-004";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-004",
  "description": "Push install via Remcom only (force method isolation)",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\UEMSRemoteInstaller.exe",
        "target_name": "UEMSRemoteInstaller.exe.bak",
        "description": "Disable UEMSRemoteInstaller"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "stop",
        "service_name": "winmgmt",
        "description": "Stop WMI"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 300,
        "check_interval": 10,
        "description": "Wait for agent service after Remcom push"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "start",
        "service_name": "winmgmt",
        "description": "TEARDOWN: Start WMI"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\UEMSRemoteInstaller.exe.bak",
        "target_name": "UEMSRemoteInstaller.exe",
        "description": "TEARDOWN: Restore UEMSRemoteInstaller"
      }
    }
  ],
  "expected_result": "Push via Remcom succeeds. Agent RUNNING. WMI and files restored."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
