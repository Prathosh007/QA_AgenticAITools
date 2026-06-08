component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_17";
payload = {
    "testcase_id":  "DC_NS_NEW_17",
    "description":  "Verify NS install handles stale old server service",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify NS starts cleanly after handling stale service",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "Stale service removed; NS installs and starts cleanly."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
