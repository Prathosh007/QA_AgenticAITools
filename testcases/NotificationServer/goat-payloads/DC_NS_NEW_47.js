component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_47";
payload = {
    "testcase_id":  "DC_NS_NEW_47",
    "description":  "Verify install fails gracefully when 8027 is busy",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "netstat -ano | findstr 8027",
                                              "description":  "Verify port 8027 already in use",
                                              "value_to_search":  "LISTENING",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "Installer surfaces clear \u0027port already in use\u0027 error; Web console alert matches."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
