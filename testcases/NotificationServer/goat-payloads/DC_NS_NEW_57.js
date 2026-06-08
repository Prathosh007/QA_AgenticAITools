component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_57";
payload = {
    "testcase_id":  "DC_NS_NEW_57",
    "description":  "Verify CServerServiceStatusListener reacts to dependent stop",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "ManageEngine Desktop Central Server",
                                              "description":  "Stop dependent DC Server service",
                                              "action":  "stop"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify listener fires on dependent service stop",
                                              "max_wait_time":  "30",
                                              "value":  "listener",
                                              "check_interval":  "3",
                                              "filename":  "dcnotificationserver0.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "ManageEngine Desktop Central Server",
                                              "description":  "Restart dependent DC Server service",
                                              "action":  "start"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS resumes after dependent service restarts",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "30",
                                              "check_interval":  "5",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "Listener fires; NS logs the dependency change and reacts; resumes on restart."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
