component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_20";
payload = {
    "testcase_id":  "DC_NS_20",
    "description":  "Verify Windows/Mac agent retries immediately after register failure",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Stop NS to simulate registration failure",
                                              "action":  "stop"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS service",
                                              "action":  "start"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agent retries REGISTER within seconds of NS coming back",
                                              "max_wait_time":  "30",
                                              "value":  "REGISTER",
                                              "check_interval":  "3",
                                              "filename":  "dcnsclientaccess.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent retries within seconds of NS coming back up."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
