component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_42";
payload = {
    "testcase_id":  "DC_NS_NEW_42",
    "description":  "Verify failure counter resets when crashes are \u003e1h apart",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify failure count resets to 1 when crashes are \u003e1h apart",
                                              "value":  "failure count",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Counter resets to 1 on the second crash; does not reach 3-strike threshold."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
