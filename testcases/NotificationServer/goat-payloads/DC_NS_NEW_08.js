component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_08";
payload = {
    "testcase_id":  "DC_NS_NEW_08",
    "description":  "Verify GetWorkerThreadCountFromRegistry overrides default",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "write_key",
                                              "key_name":  "WorkerThreadCount",
                                              "root":  "HKLM",
                                              "path":  "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\NotificationServer",
                                              "value_type":  "REG_DWORD",
                                              "value":  "6",
                                              "description":  "Set worker thread override to 6 in registry"
                                          },
                           "operation_type":  "registry_operation"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS to apply registry override",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "verify_process_property",
                                              "description":  "Verify exactly 6 worker threads after override",
                                              "search_type_value":  "dcnotificationserver.exe",
                                              "expected_type_value":  "6",
                                              "expected_type":  "threads",
                                              "search_type":  "name"
                                          },
                           "operation_type":  "task_manager"
                       }
                   ],
    "expected_result":  "Exactly 6 worker threads spawned; log records the override."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
