component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_19";
payload = {
    "testcase_id":  "DC_NS_19",
    "description":  "Verify periodic re-registration every 10 minutes",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnsclientaccess.log",
                                              "description":  "Verify periodic REGISTER entries in dcnsclientaccess",
                                              "value":  "REGISTER",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "REGISTER appears roughly every 10 minutes."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
