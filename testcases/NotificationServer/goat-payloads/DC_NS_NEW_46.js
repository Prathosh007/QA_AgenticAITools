component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_46";
payload = {
    "testcase_id":  "DC_NS_NEW_46",
    "description":  "Verify -n / -d / -m install args",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "sc query CustomNS",
                                              "description":  "Verify custom-named NS service is running",
                                              "value_to_search":  "RUNNING",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "Service shows custom name / display / description."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
