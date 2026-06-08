component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_41";
payload = {
    "testcase_id":  "DC_NS_NEW_41",
    "description":  "Verify operator can re-enable NS by updating NSDETAILS",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "query":  "UPDATE NSDETAILS SET NS_ENABLED = 1",
                                              "description":  "Re-enable NS in NSDETAILS table",
                                              "action":  "update"
                                          },
                           "operation_type":  "db_operation"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Start NS service",
                                              "action":  "start"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS is running",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "30",
                                              "check_interval":  "5",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agents resume registration",
                                              "max_wait_time":  "60",
                                              "value":  "REGISTER",
                                              "check_interval":  "5",
                                              "filename":  "nsrequestlog.txt",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "NS resumes accepting connections; smoke test passes."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
