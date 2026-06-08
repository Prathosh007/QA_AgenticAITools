component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_48";
payload = {
    "testcase_id":  "DC_NS_NEW_48",
    "description":  "Verify x86 and x64 NS pass full smoke",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify NS service running (x86/x64 smoke)",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "command_to_run":  "netstat -ano | findstr 8027",
                                              "description":  "Verify NS listening on port",
                                              "value_to_search":  "LISTENING",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agent registers successfully",
                                              "max_wait_time":  "30",
                                              "value":  "REGISTER",
                                              "check_interval":  "5",
                                              "filename":  "dcnsclientaccess.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Both builds pass identical smoke results."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
