component = $Server_Machine_IP;
testcaseId = "DC_NS_30";
payload = {
    "testcase_id":  "DC_NS_30",
    "description":  "Verify ondemand via DS deploys after DS replication",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify PUSH entry in nsrequestlog after DS replication",
                                              "max_wait_time":  "300",
                                              "value":  "PUSH",
                                              "check_interval":  "15",
                                              "filename":  "nsrequestlog.txt",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Config arrives after the next DS replication cycle."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
