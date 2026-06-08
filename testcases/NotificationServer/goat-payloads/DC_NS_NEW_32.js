component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_NEW_32";
payload = {
    "testcase_id":  "DC_NS_NEW_32",
    "description":  "Verify Windows/Mac agent retries IMMEDIATELY on failure",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Stop NS to cause agent register failure",
                                              "action":  "stop"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS",
                                              "action":  "start"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agent retries immediately after NS comes back",
                                              "max_wait_time":  "15",
                                              "value":  "REGISTER",
                                              "check_interval":  "2",
                                              "filename":  "dcnsclientaccess.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent retries within seconds of NS coming up."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
