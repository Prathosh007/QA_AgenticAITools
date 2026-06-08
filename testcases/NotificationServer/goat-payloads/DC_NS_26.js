component = $Server_Machine_IP;
testcaseId = "DC_NS_26";
payload = {
    "testcase_id":  "DC_NS_26",
    "description":  "Verify nssettings file reflects port change",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnssettings.conf",
                                              "key":  "port",
                                              "description":  "Verify port number in dcnssettings.conf after port change",
                                              "file_path":  "server_home/conf",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Port number updated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
