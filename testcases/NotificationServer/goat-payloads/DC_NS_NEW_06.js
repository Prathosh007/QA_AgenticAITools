component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_06";
payload = {
    "testcase_id":  "DC_NS_NEW_06",
    "description":  "Verify DACL grants only the intended user group",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "sc sdshow dcnotificationserver",
                                              "description":  "Show DACL for dcnotificationserver service",
                                              "value_to_search":  "D:",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "Custom user group present; broad groups absent."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
