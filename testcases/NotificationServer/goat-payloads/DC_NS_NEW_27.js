component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_27";
payload = {
    "testcase_id":  "DC_NS_NEW_27",
    "description":  "Verify ondemand via DS waits until next DS replication cycle",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify ondemand via DS waits for replication cycle",
                                              "max_wait_time":  "300",
                                              "value":  "PUSH",
                                              "check_interval":  "15",
                                              "filename":  "nsrequestlog.txt",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Arrival = next cycle + epsilon; nsrequestlog records DS handoff."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
