component = $Server_Machine_IP;
testcaseId = "DC_NS_4";
payload = {
    "testcase_id":  "DC_NS_4",
    "description":  "Verify first stop is recorded with failure count = 1",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Stop Notification Server service",
                                              "action":  "stop"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify exception logged with failure count",
                                              "value":  "failure count",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Exception logged. Failure count = 1."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
