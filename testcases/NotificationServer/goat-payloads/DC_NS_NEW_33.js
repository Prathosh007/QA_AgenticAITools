component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_33";
payload = {
    "testcase_id":  "DC_NS_NEW_33",
    "description":  "Verify MONITOR_STATUS keeps socket alive without re-registration",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify no spurious disconnect events during MONITOR_STATUS",
                                              "value":  "disconnect",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_removed"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Socket stays open; regClientList retains entry."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
