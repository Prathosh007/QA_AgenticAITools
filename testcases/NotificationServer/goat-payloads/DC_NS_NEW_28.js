component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_28";
payload = {
    "testcase_id":  "DC_NS_NEW_28",
    "description":  "Verify dcondemand survives legacy SSL context load attempt",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcondemand.log",
                                              "description":  "Verify dcondemand logs clean error without legacy provider",
                                              "value":  "error",
                                              "file_path":  "agent_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "crash_dump",
                                              "description":  "Verify no crash dump created",
                                              "file_path":  "agent_home/logs",
                                              "action":  "verify_absence"
                                          },
                           "operation_type":  "file_folder_operation"
                       }
                   ],
    "expected_result":  "dcondemand does not crash; falls back or logs explicit error."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
