component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_NEW_30";
payload = {
    "testcase_id":  "DC_NS_NEW_30",
    "description":  "Verify re-register cadence is 10 min +/- 30s",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnsclientaccess.log",
                                              "description":  "Verify periodic REGISTER entries at 10 min cadence",
                                              "value":  "REGISTER",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "All inter-arrival intervals within +/- 30s of 10 minutes."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
