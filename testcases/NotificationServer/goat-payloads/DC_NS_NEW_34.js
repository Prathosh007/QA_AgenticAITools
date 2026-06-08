component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_34";
payload = {
    "testcase_id":  "DC_NS_NEW_34",
    "description":  "Verify DumpCreator.dll absence is detected and logged",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "description":  "Rename DumpCreator.dll to simulate absence",
                                              "source":  "server_home/bin/DumpCreator.dll",
                                              "action":  "rename",
                                              "target_name":  "DumpCreator.dll.bak"
                                          },
                           "operation_type":  "file_folder_operation"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "description":  "Restart NS without DumpCreator.dll",
                                              "action":  "restart"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify DumpCreator not found warning logged",
                                              "value":  "DumpCreator",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify NS stays running without DumpCreator",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "description":  "Restore DumpCreator.dll",
                                              "source":  "server_home/bin/DumpCreator.dll.bak",
                                              "action":  "rename",
                                              "target_name":  "DumpCreator.dll"
                                          },
                           "operation_type":  "file_folder_operation"
                       }
                   ],
    "expected_result":  "Warning logged; NS continues without crash-dump support; does not abort startup."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
