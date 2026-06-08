component = $Server_Machine_IP;
testcaseId = "DC_NS_14";
payload = {
    "testcase_id":  "DC_NS_14",
    "description":  "Verify ns-status-details.xml exposes runtime NS details",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//PortNo",
                                              "description":  "Verify PortNo in ns-status-details.xml",
                                              "file_path":  "server_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//LANTimeout",
                                              "description":  "Verify LANTimeout in ns-status-details.xml",
                                              "file_path":  "server_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//WANTimeout",
                                              "description":  "Verify WANTimeout in ns-status-details.xml",
                                              "file_path":  "server_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//NSEnabled",
                                              "description":  "Verify NSEnabled in ns-status-details.xml",
                                              "file_path":  "server_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//MaxFailureCount",
                                              "description":  "Verify MaxFailureCount in ns-status-details.xml",
                                              "file_path":  "server_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "All five fields populated and consistent with conf."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
