component = $Server_Machine_IP;
testcaseId = "DC_NS_45";
payload = {
    "testcase_id":  "DC_NS_45",
    "description":  "Verify Dump folder is created and stores NS crash info",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "description":  "Verify Dump folder exists under Logs",
                                              "file_path":  "server_home/Logs/Dump",
                                              "action":  "check_presence"
                                          },
                           "operation_type":  "file_folder_operation"
                       }
                   ],
    "expected_result":  "Dump folder present."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
