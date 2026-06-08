component = $Server_Machine_IP;
testcaseId = "DC_NS_6";
payload = {
    "testcase_id":  "DC_NS_6",
    "description":  "Verify second stop within 1h sets failure count = 2",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Stop NS service for second time within 1 hour",
                                              "action":  "stop"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify failure count = 2 in nscontrollerlog",
                                              "value":  "failure count",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Failure count = 2 (or 1 if the previous stoppage was more than an hour ago)."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
