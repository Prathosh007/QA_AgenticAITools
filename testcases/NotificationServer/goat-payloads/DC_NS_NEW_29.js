component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_NEW_29";
payload = {
    "testcase_id":  "DC_NS_NEW_29",
    "description":  "Verify REGISTER carries resourceID, domain name, remote office, computer name",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnsclientaccess.log",
                                              "description":  "Verify REGISTER entry with identity fields in access log",
                                              "value":  "REGISTER",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "All four fields present and correct."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
