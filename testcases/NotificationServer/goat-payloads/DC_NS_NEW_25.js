component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_25";
payload = {
    "testcase_id":  "DC_NS_NEW_25",
    "description":  "Verify LIVE_LIST returns full contact-time list",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify LIVE_LIST entry in nsrequestlog",
                                              "value":  "LIVE_LIST",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Returned list matches GetContactTimeListinNS(); count = gv_regClientCnt."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
