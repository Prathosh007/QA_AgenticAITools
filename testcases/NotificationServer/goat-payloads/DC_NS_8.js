component = $Server_Machine_IP;
testcaseId = "DC_NS_8";
payload = {
    "testcase_id":  "DC_NS_8",
    "description":  "Verify third stop sets failure count = 3",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Stop NS service for third time within 1 hour",
                                              "action":  "stop"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify failure count = 3 in nscontrollerlog",
                                              "value":  "failure count",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Failure count = 3."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
