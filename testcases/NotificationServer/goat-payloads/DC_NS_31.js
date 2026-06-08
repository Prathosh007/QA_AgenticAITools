component = $Server_Machine_IP;
testcaseId = "DC_NS_31";
payload = {
    "testcase_id":  "DC_NS_31",
    "description":  "Verify ondemand inventory and patch scan succeed",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify ondemand scan PUSH entries",
                                              "value":  "PUSH",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Both scans complete."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
