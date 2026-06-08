component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_23";
payload = {
    "testcase_id":  "DC_NS_NEW_23",
    "description":  "Verify PUSH end-to-end: server -\u003e NS -\u003e clientList",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify PUSH entry in nsrequestlog for ondemand config",
                                              "value":  "PUSH",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify agent received push in dcconfigondemand log",
                                              "max_wait_time":  "30",
                                              "value":  "config",
                                              "check_interval":  "3",
                                              "filename":  "dcconfigondemand.log",
                                              "file_path":  "agent_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "All agents receive the push within configured LAN/WAN timeout."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
