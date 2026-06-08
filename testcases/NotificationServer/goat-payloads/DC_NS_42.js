component = $Server_Machine_IP;
testcaseId = "DC_NS_42";
payload = {
    "testcase_id":  "DC_NS_42",
    "description":  "Verify dcnotificationserver log count = 3 + cores",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "info_type":  "architecture",
                                              "description":  "Get machine CPU info for core count",
                                              "note":  "cpu_info",
                                              "action":  "get_machine_spec"
                                          },
                           "operation_type":  "machine_operation"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify dcnotificationserver log files exist",
                                              "file_path":  "server_home/logs",
                                              "action":  "check_presence"
                                          },
                           "operation_type":  "file_folder_operation"
                       }
                   ],
    "expected_result":  "Number of logs = 3 + number of cores."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
