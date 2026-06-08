component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-ZIPINSTALL-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-ZIPINSTALL-002",
  "description": "Zip install with missing UEMSAgent.mst in extracted folder",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Installers\\\\ZipExtract",
        "filename": "UEMSAgent.mst",
        "description": "Confirm MST is missing"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "C:\\\\Installers\\\\ZipExtract\\\\setup.bat",
        "timeout": 60,
        "description": "Run setup.bat with missing MST"
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
