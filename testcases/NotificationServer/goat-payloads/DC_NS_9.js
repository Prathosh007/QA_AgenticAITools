component = $Server_Machine_IP;
testcaseId = "DC_NS_9";
payload = {
    "testcase_id":  "DC_NS_9",
    "description":  "Verify NS does NOT auto-restart after third stop",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS does NOT auto-restart after third stop",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "120",
                                              "check_interval":  "10",
                                              "expect":  "serviceStopped"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "query":  "SELECT NS_ENABLED FROM NSDETAILS",
                                              "description":  "Verify NSDETAILS table shows NS disabled",
                                              "action":  "query",
                                              "expected_value":  "0"
                                          },
                           "operation_type":  "db_operation"
                       }
                   ],
    "expected_result":  "NS service does NOT restart."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
