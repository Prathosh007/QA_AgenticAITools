component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_50";
payload = {
    "testcase_id":  "DC_NS_NEW_50",
    "description":  "Verify second \u0027-a install\u0027 is rejected cleanly",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "server_home\\\\bin\\\\dcnotificationserver.exe -a install 2\u003e\u00261",
                                              "description":  "Verify duplicate install is rejected",
                                              "value_to_search":  "already",
                                              "command_type":  "cmd"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify existing service is unaffected",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "Installer reports \u0027already installed\u0027; existing service is not corrupted; no orphan service entry."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
