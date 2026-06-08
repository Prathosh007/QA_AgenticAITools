component = $Server_Machine_IP;
testcaseId = "DC_NS_13";
payload = {
    "testcase_id":  "DC_NS_13",
    "description":  "Verify dcnssettings.conf has service name, port, and display name",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnssettings.conf",
                                              "key":  "service.name",
                                              "description":  "Verify service name key in dcnssettings.conf",
                                              "file_path":  "server_home/conf",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnssettings.conf",
                                              "key":  "port",
                                              "description":  "Verify port key in dcnssettings.conf",
                                              "file_path":  "server_home/conf",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnssettings.conf",
                                              "key":  "display.name",
                                              "description":  "Verify display name key in dcnssettings.conf",
                                              "file_path":  "server_home/conf",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Contains service name, port, and display name."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
