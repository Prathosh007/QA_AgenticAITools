component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_16";
payload = {
    "testcase_id":  "DC_NS_NEW_16",
    "description":  "Verify NS service is created on Secondary Server during install",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "sc query dcnotificationserver",
                                              "description":  "Verify NS service is created and running on Secondary Server",
                                              "value_to_search":  "RUNNING",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "NS service present and Running."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
