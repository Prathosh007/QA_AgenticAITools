component = $Server_Machine_IP;
testcaseId = "DC_NS_3";
payload = {
    "testcase_id":  "DC_NS_3",
    "description":  "Verify NS service restarts when DC server restarts",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "ManageEngine Desktop Central Server",
                                              "description":  "Restart DC Server service",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS service restarts and is running",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "60",
                                              "check_interval":  "5",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify nscontrollerlog records start transition",
                                              "value":  "start",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "NS service restarts and is in Running state after DC server restart."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
