component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTMSI-005";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTMSI-005",
  "description": "Silent MSI install interrupted mid-way",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "start /b msiexec /i \"UEMSAgent.msi\" /qn TRANSFORMS=\"UEMSAgent.mst\" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual /lv \"Agentinstalllog.txt\"",
        "command_type": "cmd",
        "description": "Start MSI install in background"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "msiexec.exe",
        "expect": "processrunning",
        "max_wait_time": 15,
        "check_interval": 2,
        "description": "Wait for msiexec to start"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "kill_process",
        "process_name": "msiexec.exe",
        "description": "Kill msiexec mid-install"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "max_wait_time": 30,
        "check_interval": 3,
        "description": "Verify agent NOT running after interrupted install"
      }
    }
  ],
  "expected_result": "Installation rolls back. Agent service NOT running after interrupted install."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
