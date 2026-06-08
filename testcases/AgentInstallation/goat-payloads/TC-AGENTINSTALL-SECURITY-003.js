component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SECURITY-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SECURITY-003",
  "description": "Verify agent certificates are installed correctly",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "filename": "DMRootCA-Server.crt",
        "description": "Verify DMRootCA-Server.crt present"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "filename": "DMRootCA.crt",
        "description": "Verify DMRootCA.crt present"
      }
    },
    {
      "operation_type": "certificate_operation",
      "parameters": {
        "action": "get_cert_value",
        "cert_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\DMRootCA-Server.crt",
        "key_name": "subject",
        "description": "Read server cert subject"
      }
    }
  ],
  "expected_result": "Both certificate files exist. Certificate subjects match expected UEMS CA values."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
