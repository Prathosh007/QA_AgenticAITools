component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_37";
payload = {
    "testcase_id":  "DC_NS_NEW_37",
    "description":  "Verify NSLoggerLevel registry value controls verbosity",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "write_key",
                                              "key_name":  "NSLoggerLevel",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\AdventNet\\\\DesktopCentral",
                                              "value_type":  "REG_DWORD",
                                              "value":  "6",
                                              "description":  "Set NSLoggerLevel to 6 (disable)"
                                          },
                           "operation_type":  "registry_operation"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply logger level 6",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "write_key",
                                              "key_name":  "NSLoggerLevel",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\AdventNet\\\\DesktopCentral",
                                              "value_type":  "REG_DWORD",
                                              "value":  "1",
                                              "description":  "Set NSLoggerLevel to 1 (verbose)"
                                          },
                           "operation_type":  "registry_operation"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply logger level 1",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "At 6 logs are minimal; at 1 logs are verbose."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
