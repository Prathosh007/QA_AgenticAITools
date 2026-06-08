component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_28";
payload = {
    "testcase_id":  "DC_NS_28",
    "description":  "Verify agent registry reflects port change",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "read_key",
                                              "key_name":  "PortNo",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\WOW6432NODE\\\\NSSTATUSDETAILS",
                                              "note":  "ns_port",
                                              "description":  "Read PortNo from agent registry and verify updated value"
                                          },
                           "operation_type":  "registry_operation"
                       }
                   ],
    "expected_result":  "PortNo registry value updated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
