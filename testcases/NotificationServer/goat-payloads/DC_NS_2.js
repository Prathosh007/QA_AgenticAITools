component = $Server_Machine_IP;
testcaseId = "DC_NS_2";
payload = {
    "testcase_id":  "DC_NS_2",
    "description":  "Verify NS service is removed on DC server uninstall",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "sc query dcnotificationserver",
                                              "description":  "Verify NS service no longer exists after uninstall",
                                              "exact_value":  "service does not exist",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "NS service no longer exists. sc query returns \u0027service does not exist\u0027."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
