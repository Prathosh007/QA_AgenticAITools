component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_45";
payload = {
    "testcase_id":  "DC_NS_NEW_45",
    "description":  "Verify ns.echoEnable=false disables echo without side-effects",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "update",
                                              "description":  "Disable echo in dcnsdbsettings.conf",
                                              "new_value":  "false",
                                              "filename":  "dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "key_to_update":  "ns.echoEnable"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply echo disable",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify NS runs normally without echo",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "No echo traffic; register / PUSH / livelist still work normally."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
