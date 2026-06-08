component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_14";
payload = {
    "testcase_id":  "DC_NS_NEW_14",
    "description":  "Verify \u0027-a changeport\u0027 switches listen port without reinstall",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "server_home\\\\bin\\\\dcnotificationserver.exe -a changeport -k 8028",
                                              "description":  "Execute NS changeport command to 8028",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "command_to_run":  "netstat -ano | findstr 8028",
                                              "description":  "Verify NS listening on new port 8028",
                                              "value_to_search":  "LISTENING",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify dcnssettings.conf has new port",
                                              "key":  "port",
                                              "filename":  "dcnssettings.conf",
                                              "value":  "8028",
                                              "file_path":  "server_home/conf"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "query":  "SELECT port_no FROM dcnsdetails",
                                              "description":  "Verify dcnsdetails table has new port",
                                              "value":  "8028",
                                              "action":  "verify_presence"
                                          },
                           "operation_type":  "db_operation"
                       }
                   ],
    "expected_result":  "Service restarts; listens on new port; conf + DB updated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
