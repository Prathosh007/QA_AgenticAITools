component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTMSI-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTMSI-002",
  "description": "Silent MSI install with missing UEMSAgent.mst transform",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "msiexec /i \"UEMSAgent.msi\" /qn TRANSFORMS=\"UEMSAgent.mst\" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual SERVER_ROOT_CRT=\"%cd%\\DMRootCA-Server.crt\" DS_ROOT_CRT=\"%cd%\\DMRootCA.crt\" /lv \"Agentinstalllog.txt\"",
        "command_type": "cmd",
        "description": "Run MSI install with missing MST transform"
      }
    },
    {
      "operation_type": "file_folder_modification",
      "parameters": {
        "action": "value_should_be_present",
        "file_path": ".\\\\Agentinstalllog.txt",
        "value": "Error applying transforms",
        "description": "Verify install log contains transform error"
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
  "expected_result": "Installation fails with Error applying transforms. Agent service NOT installed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
