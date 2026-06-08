component = $Server_Machine_IP;
testcaseId = "DC_NS_11";
payload = {
    "testcase_id":  "DC_NS_11",
    "description":  "Verify operator can re-enable NS",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "query":  "UPDATE NSDETAILS SET NS_ENABLED = 1",
                                              "description":  "Re-enable NS by setting NS_ENABLED = 1 in DB",
                                              "action":  "update"
                                          },
                           "operation_type":  "db_operation"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Start NS service after re-enabling",
                                              "action":  "start"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS is running after re-enable",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "30",
                                              "check_interval":  "5",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "NS functions normally; agents register again."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
