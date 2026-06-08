component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_26";
payload = {
    "testcase_id":  "DC_NS_NEW_26",
    "description":  "Verify ns.wanTimeout applies to WAN agents",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "update",
                                              "description":  "Set WAN timeout to 60s",
                                              "new_value":  "60",
                                              "filename":  "dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "key_to_update":  "ns.wanTimeout"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply WAN timeout",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify timeout applied for WAN agent",
                                              "max_wait_time":  "90",
                                              "value":  "timeout",
                                              "check_interval":  "5",
                                              "filename":  "nsrequestlog.txt",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Failure surfaced after exactly the WAN timeout."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
