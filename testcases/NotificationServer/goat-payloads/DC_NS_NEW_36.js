component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_36";
payload = {
    "testcase_id":  "DC_NS_NEW_36",
    "description":  "Verify dump rotation keeps at most 50 files",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "description":  "Verify Dump folder exists",
                                              "file_path":  "server_home/Logs/Dump",
                                              "action":  "check_presence"
                                          },
                           "operation_type":  "file_folder_operation"
                       },
                       {
                           "parameters":  {
                                              "command_to_run":  "powershell -Command \"(Get-ChildItem \u0027server_home/Logs/Dump\u0027 -Filter \u0027*.dmp\u0027).Count\"",
                                              "description":  "Count dump files to verify max 50 rotation",
                                              "note":  "dump_count",
                                              "value_to_search":  ""
                                          },
                           "operation_type":  "run_command"
                       }
                   ],
    "expected_result":  "Exactly 50 files remain; oldest deleted first."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
