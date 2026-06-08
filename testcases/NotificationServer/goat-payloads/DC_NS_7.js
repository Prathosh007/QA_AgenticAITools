component = $Server_Machine_IP;
testcaseId = "DC_NS_7";
payload = {
    "testcase_id":  "DC_NS_7",
    "description":  "Verify NS still auto-restarts after second stop",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS auto-restarts after second stop",
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
                                              "description":  "Verify restart entry in nscontrollerlog",
                                              "value":  "restart",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "NS service restarts."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
