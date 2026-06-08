component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_05";
payload = {
    "testcase_id":  "DC_NS_NEW_05",
    "description":  "Verify NS rejects PUSH request from non-localhost source",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify non-localhost PUSH request rejected and logged",
                                              "value":  "invalid",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Request rejected; no propagation to clients; log records invalid source."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
