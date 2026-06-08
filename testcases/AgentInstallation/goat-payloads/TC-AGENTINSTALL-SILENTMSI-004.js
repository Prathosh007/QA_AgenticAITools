component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTMSI-004";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTMSI-004",
  "description": "Silent MSI install without administrator privileges",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "msiexec /i \"UEMSAgent.msi\" /qn TRANSFORMS=\"UEMSAgent.mst\" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual /lv \"Agentinstalllog.txt\"",
        "command_type": "cmd",
        "description": "Run msiexec as standard user"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify agent NOT installed"
      }
    }
  ],
  "expected_result": "msiexec fails with permissions error. Agent NOT installed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
