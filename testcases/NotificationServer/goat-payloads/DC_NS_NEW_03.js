component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_03";
payload = {
    "testcase_id":  "DC_NS_NEW_03",
    "description":  "Verify AES-256 decryption of agent payload",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "update",
                                              "description":  "Enable encryption in dcnsdbsettings.conf",
                                              "new_value":  "true",
                                              "filename":  "dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "key_to_update":  "ns.encEnable"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply encryption setting",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agent registers with encrypted payload",
                                              "max_wait_time":  "60",
                                              "value":  "REGISTER",
                                              "check_interval":  "5",
                                              "filename":  "dcnsclientaccess.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent registers; resourceID parsed correctly."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
