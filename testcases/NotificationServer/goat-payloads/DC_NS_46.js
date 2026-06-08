component = $Server_Machine_IP;
testcaseId = "DC_NS_46";
payload = {
    "testcase_id":  "DC_NS_46",
    "description":  "Verify batch file disables NS logger",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "read_dword",
                                              "key_name":  "NSLoggerLevel",
                                              "expected_value":  "6",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\AdventNet\\\\DesktopCentral",
                                              "description":  "Verify NSLoggerLevel = 6 after running disable-logger batch"
                                          },
                           "operation_type":  "registry_operation"
                       }
                   ],
    "expected_result":  "NSLoggerLevel = 6; logging stops."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
