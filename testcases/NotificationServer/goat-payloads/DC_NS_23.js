component = $Server_Machine_IP;
testcaseId = "DC_NS_23";
payload = {
    "testcase_id":  "DC_NS_23",
    "description":  "Verify default port is 8027",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "netstat -ano | findstr 8027",
                                              "description":  "Verify NS listening on port 8027",
                                              "value_to_search":  "LISTENING",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "port":  "8027",
                                              "description":  "Verify NS process is bound to port 8027",
                                              "process_name":  "dcnotificationserver.exe",
                                              "expect":  "processrunning",
                                              "action":  "verify_process"
                                          },
                           "operation_type":  "task_manager"
                       }
                   ],
    "expected_result":  "NS listening on TCP 8027."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
