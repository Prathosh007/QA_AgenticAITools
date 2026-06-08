component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_17";
payload = {
    "testcase_id":  "DC_NS_17",
    "description":  "Verify NS details written to agent registry",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\WOW6432NODE\\\\NSSTATUSDETAILS",
                                              "description":  "Verify PortNo key exists in agent NS registry",
                                              "key_name":  "PortNo",
                                              "action":  "check_key_exists"
                                          },
                           "operation_type":  "registry_operation"
                       },
                       {
                           "parameters":  {
                                              "action":  "read_key",
                                              "key_name":  "LANTimeout",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\WOW6432NODE\\\\NSSTATUSDETAILS",
                                              "note":  "ns_lan_timeout",
                                              "description":  "Read LANTimeout from agent registry"
                                          },
                           "operation_type":  "registry_operation"
                       },
                       {
                           "parameters":  {
                                              "action":  "read_key",
                                              "key_name":  "WANTimeout",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\WOW6432NODE\\\\NSSTATUSDETAILS",
                                              "note":  "ns_wan_timeout",
                                              "description":  "Read WANTimeout from agent registry"
                                          },
                           "operation_type":  "registry_operation"
                       }
                   ],
    "expected_result":  "All three keys present with values that match server config."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
