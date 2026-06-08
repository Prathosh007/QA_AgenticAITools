component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_44";
payload = {
    "testcase_id":  "DC_NS_NEW_44",
    "description":  "Verify ns.echoEnable=true triggers periodic echo to clients",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "update",
                                              "description":  "Enable echo in dcnsdbsettings.conf",
                                              "new_value":  "true",
                                              "filename":  "dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "key_to_update":  "ns.echoEnable"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply echo setting",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify echo activity in NS log",
                                              "value":  "echo",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Echo packets sent periodically; missed echo eventually cleans up the client."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
