component = $Server_Machine_IP;
testcaseId = "DC_NS_35";
payload = {
    "testcase_id":  "DC_NS_35",
    "description":  "Verify System Manager task on agent",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify System Manager task PUSH in nsrequestlog",
                                              "value":  "PUSH",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Task executes successfully."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
