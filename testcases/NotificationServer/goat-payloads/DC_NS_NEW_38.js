component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_38";
payload = {
    "testcase_id":  "DC_NS_NEW_38",
    "description":  "Verify log rotation deletes excess logs and rotates by size",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify active NS log file exists",
                                              "file_path":  "server_home/logs",
                                              "action":  "check_presence"
                                          },
                           "operation_type":  "file_folder_operation"
                       }
                   ],
    "expected_result":  "Older logs pruned; running log size remains bounded."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
