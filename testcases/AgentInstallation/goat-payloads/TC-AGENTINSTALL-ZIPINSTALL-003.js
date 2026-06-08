component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-ZIPINSTALL-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-ZIPINSTALL-003",
  "description": "Zip install from corrupt zip archive",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "zip_operation",
      "parameters": {
        "action": "extract",
        "archive_path": "C:\\\\Installers\\\\corrupted_Agent.zip",
        "target_dir": "C:\\\\Installers\\\\CorruptExtract",
        "description": "Attempt to extract corrupt zip"
      }
    }
  ],
  "expected_result": "Extraction fails with corrupt archive error. Files not fully extracted."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
