component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_24";
payload = {
    "testcase_id":  "DC_NS_NEW_24",
    "description":  "Verify ALIVE_STATUS for a single resourceID",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify ALIVE_STATUS entry in nsrequestlog",
                                              "value":  "ALIVE_STATUS",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "NS returns correct status for each; UI green/red matches."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
