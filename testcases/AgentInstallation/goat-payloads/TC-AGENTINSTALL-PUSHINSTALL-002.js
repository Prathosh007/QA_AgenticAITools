component = $DS_Machine_IP;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-002",
  "description": "Push install via UEMSRemoteInstaller only (force method isolation)",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom.exe",
        "target_name": "remcom.exe.bak",
        "description": "Rename remcom.exe to disable it"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom64.exe",
        "target_name": "remcom64.exe.bak",
        "description": "Rename remcom64.exe to disable it"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "stop",
        "service_name": "winmgmt",
        "description": "Stop WMI service to disable WMI method"
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
        "description": "Wait for agent service after UEMSRemoteInstaller push"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "start",
        "service_name": "winmgmt",
        "description": "TEARDOWN: Restart WMI service"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom.exe.bak",
        "target_name": "remcom.exe",
        "description": "TEARDOWN: Restore remcom.exe"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "rename",
        "source": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\remcom64.exe.bak",
        "target_name": "remcom64.exe",
        "description": "TEARDOWN: Restore remcom64.exe"
      }
    }
  ],
  "expected_result": "Push install succeeds using only UEMSRemoteInstaller. Agent service RUNNING. Teardown restores all files/services."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
