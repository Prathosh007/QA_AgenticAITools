component = $DS_Machine_IP;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-003",
  "description": "Push install via WMI only (force method isolation)",
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
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom.exe",
        "target_name": "remcom.exe.bak",
        "description": "Disable remcom"
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
        "description": "Wait for agent service after WMI push"
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
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom.exe.bak",
        "target_name": "remcom.exe",
        "description": "TEARDOWN: Restore remcom"
      }
    }
  ],
  "expected_result": "Push via WMI succeeds. Agent RUNNING. All files restored."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
