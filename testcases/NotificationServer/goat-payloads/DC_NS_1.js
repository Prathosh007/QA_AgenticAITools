component = $Server_Machine_IP;
testcaseId = "DC_NS_1";
payload = {
    "testcase_id":  "DC_NS_1",
    "description":  "Verify NS service installs alongside DC server on all supported OS",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "ManageEngine Desktop Central Server",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify DC Server service is running",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify Notification Server service is running",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify NS startup banner in log with port info",
                                              "value":  "listening on port",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "All three services - DC server, Apache, Notification server - are in Running state."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
