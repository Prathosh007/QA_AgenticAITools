component = $Server_Machine_IP;
testcaseId = "DC_NS_16";
payload = {
    "testcase_id":  "DC_NS_16",
    "description":  "Verify nscrashinfo records each NS crash",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "query":  "SELECT build_number, crash_time FROM nscrashinfo ORDER BY crash_time DESC LIMIT 1",
                                              "description":  "Verify nscrashinfo has at least one crash entry with build number",
                                              "value":  "build",
                                              "action":  "verify_presence"
                                          },
                           "operation_type":  "db_operation"
                       }
                   ],
    "expected_result":  "Build number and crash time recorded per crash."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
