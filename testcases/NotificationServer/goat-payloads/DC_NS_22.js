component = $Server_Machine_IP;
testcaseId = "DC_NS_22";
payload = {
    "testcase_id":  "DC_NS_22",
    "description":  "Verify livelist is sent to DC server every 10 min",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify LIVE_LIST entries in nsrequestlog",
                                              "value":  "LIVE_LIST",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "LIVE_LIST sent every 10 minutes."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
