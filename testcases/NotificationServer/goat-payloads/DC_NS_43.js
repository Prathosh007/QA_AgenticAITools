component = $Server_Machine_IP;
testcaseId = "DC_NS_43";
payload = {
    "testcase_id":  "DC_NS_43",
    "description":  "Verify each log shows a distinct thread ID",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify thread_id field in dcnotificationserver log",
                                              "value":  "thread_id",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Each log file shows a different thread ID."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
