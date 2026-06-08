component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_12";
payload = {
    "testcase_id":  "DC_NS_NEW_12",
    "description":  "Verify abnormal client disconnect frees context",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "description":  "Force-kill agent process to simulate abnormal disconnect",
                                              "process_name":  "dcagentservice.exe",
                                              "action":  "kill_process"
                                          },
                           "operation_type":  "task_manager"
                       },
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify disconnect entry in access log after abnormal termination",
                                              "max_wait_time":  "30",
                                              "value":  "disconnect",
                                              "check_interval":  "3",
                                              "filename":  "dcnsclientaccess.log",
                                              "file_path":  "server_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "RemoveClientFromHashAndMemory invoked; FreeUpMemory called; dead agent removed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
