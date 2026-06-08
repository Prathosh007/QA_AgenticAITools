component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_49";
payload = {
    "testcase_id":  "DC_NS_NEW_49",
    "description":  "Verify NS install enforces Tcpip dependency",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "sc qc dcnotificationserver",
                                              "description":  "Verify NS service depends on Tcpip",
                                              "value_to_search":  "Tcpip",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "Install either fails with a clear dependency error OR re-enables Tcpip and proceeds; dependency visible in service config."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
