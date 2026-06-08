component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_51";
payload = {
    "testcase_id":  "DC_NS_NEW_51",
    "description":  "Verify dcondemandtasks executes task and reports result",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify OP_RECEIVE_RESPONSE in nsrequestlog",
                                              "max_wait_time":  "60",
                                              "value":  "OP_RECEIVE_RESPONSE",
                                              "check_interval":  "5",
                                              "filename":  "nsrequestlog.txt",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Task runs; result returned via OP_RECEIVE_RESPONSE; server marks complete."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
