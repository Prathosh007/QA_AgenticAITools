component = $Server_Machine_IP;
testcaseId = "DC_NS_Uninstall_Failure_3";
payload = {
    "testcase_id":  "DC_NS_Uninstall_Failure_3",
    "description":  "Verify only NS Stop/Start happens on port change (not uninstall/reinstall)",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify Stop entry in nscontroller.log during port change",
                                              "value":  "Stop",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify Start entry in nscontroller.log during port change",
                                              "value":  "Start",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "nscontroller.log",
                                              "description":  "Verify NO Uninstall entry in nscontroller.log",
                                              "value":  "Uninstall",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_removed"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Only Stop + Start performed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
