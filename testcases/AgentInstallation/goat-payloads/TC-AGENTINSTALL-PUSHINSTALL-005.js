component = $DS_Machine_IP;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-005";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-005",
  "description": "Push install fails when all three methods are disabled",
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
        "expect": "serviceStopped",
        "max_wait_time": 300,
        "check_interval": 15,
        "description": "Verify agent NOT installed (all methods disabled)"
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
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom.exe.bak",
        "target_name": "remcom.exe",
        "description": "TEARDOWN: Restore remcom"
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
  "expected_result": "Push fails — all methods disabled. Agent NOT installed. Console shows failure status."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
