component = $Server_Machine_IP;
testcaseId = "DC_NS_Uninstall_Failure_4";
payload = {
    "testcase_id":  "DC_NS_Uninstall_Failure_4",
    "description":  "Verify nscontroller.log captures Stop/Start log entries",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify Stop log entry with timestamp",
                                              "value":  "Stop",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify Start log entry with timestamp",
                                              "value":  "Start",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Entries present."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
