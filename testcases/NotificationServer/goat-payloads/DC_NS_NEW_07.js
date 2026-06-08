component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_07";
payload = {
    "testcase_id":  "DC_NS_NEW_07",
    "description":  "Verify worker thread count scales by core count (capped at 16)",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "description":  "Verify NS process is running",
                                              "process_name":  "dcnotificationserver.exe",
                                              "expect":  "processrunning",
                                              "action":  "verify_process"
                                          },
                           "operation_type":  "task_manager"
                       },
                       {
                           "parameters":  {
                                              "action":  "verify_process_property",
                                              "description":  "Get NS thread count to verify scaling with cores",
                                              "search_type_value":  "dcnotificationserver.exe",
                                              "expected_type":  "threads",
                                              "note":  "ns_thread_count",
                                              "search_type":  "name"
                                          },
                           "operation_type":  "task_manager"
                       }
                   ],
    "expected_result":  "Worker threads = WORKER_THREADS_PER_PROCESSOR * cores; capped at the architectural max of 16."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
