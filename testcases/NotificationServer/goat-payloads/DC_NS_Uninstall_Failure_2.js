component = $Server_Machine_IP;
testcaseId = "DC_NS_Uninstall_Failure_2";
payload = {
    "testcase_id":  "DC_NS_Uninstall_Failure_2",
    "description":  "Re-run DC_NS_14 in port-change context",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//PortNo",
                                              "description":  "Verify ns-status-details.xml reflects new port after port change",
                                              "file_path":  "server_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "ns-status-details.xml correctly updated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
