component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_18";
payload = {
    "testcase_id":  "DC_NS_18",
    "description":  "Verify new agent registers with required identity fields",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnsclientaccess.log",
                                              "description":  "Verify REGISTER entry in dcnsclientaccess log",
                                              "value":  "REGISTER",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent appears in NS registration log with all three fields."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
