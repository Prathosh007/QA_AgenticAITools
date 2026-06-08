component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_52";
payload = {
    "testcase_id":  "DC_NS_NEW_52",
    "description":  "Verify dcondemand failure path is clean",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify failure entry in nsrequestlog for failed task",
                                              "max_wait_time":  "30",
                                              "value":  "failure",
                                              "check_interval":  "5",
                                              "filename":  "nsrequestlog.txt",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Failure surfaced; task marked failed; no resource leak."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
