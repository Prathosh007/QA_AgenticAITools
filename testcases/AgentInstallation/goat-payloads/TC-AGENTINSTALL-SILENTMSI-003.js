component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTMSI-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTMSI-003",
  "description": "Silent MSI install with missing certificate files",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "msiexec /i \"UEMSAgent.msi\" /qn TRANSFORMS=\"UEMSAgent.mst\" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual SERVER_ROOT_CRT=\"%cd%\\DMRootCA-Server.crt\" DS_ROOT_CRT=\"%cd%\\DMRootCA.crt\" /lv \"Agentinstalllog.txt\"",
        "command_type": "cmd",
        "description": "Run MSI install with missing cert files"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": ".",
        "filename": "Agentinstalllog.txt",
        "description": "Check install log created"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify agent service state — may not be running due to cert failure"
      }
    }
  ],
  "expected_result": "Installation may fail or agent communication fails. Cert validation errors in log."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
