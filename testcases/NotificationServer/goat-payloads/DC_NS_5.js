component = $Server_Machine_IP;
testcaseId = "DC_NS_5";
payload = {
    "testcase_id":  "DC_NS_5",
    "description":  "Verify NS watchdog auto-restarts NS",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS auto-restarts via watchdog after stop",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "120",
                                              "check_interval":  "10",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify nscontrollerlog records restart entry",
                                              "value":  "restart",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "NS service restarts automatically."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
