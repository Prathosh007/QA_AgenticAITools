component = $Server_Machine_IP;
testcaseId = "DC_NS_37";
payload = {
    "testcase_id":  "DC_NS_37",
    "description":  "Verify Remote shutdown task",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify Remote Shutdown task PUSH entry",
                                              "value":  "PUSH",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent machine shuts down."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
