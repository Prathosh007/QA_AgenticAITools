component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_13";
payload = {
    "testcase_id":  "DC_NS_NEW_13",
    "description":  "Verify \u0027-a reinstall\u0027 does Stop -\u003e Uninstall -\u003e Install in order",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "server_home\\\\bin\\\\dcnotificationserver.exe -a reinstall",
                                              "description":  "Execute NS reinstall command",
                                              "exact_value":  "",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS is running after reinstall",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "60",
                                              "check_interval":  "5",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "Sequence Stop -\u003e Uninstall -\u003e Install; service ends in Running state."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
