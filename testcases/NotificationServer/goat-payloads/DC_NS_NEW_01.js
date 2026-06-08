component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_NEW_01";
payload = {
    "testcase_id":  "DC_NS_NEW_01",
    "description":  "Verify TLS-enabled NS accepts agent over SSL handshake",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "update",
                                              "description":  "Set ns.tlsEnable = true in dcnsdbsettings.conf",
                                              "new_value":  "true",
                                              "filename":  "dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "key_to_update":  "ns.tlsEnable"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply TLS setting",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify TLS-enabled banner in NS log",
                                              "value":  "TLS enabled",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agent registers over TLS",
                                              "max_wait_time":  "60",
                                              "value":  "REGISTER",
                                              "check_interval":  "5",
                                              "filename":  "dcnsclientaccess.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "TLS handshake succeeds; agent registers."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
