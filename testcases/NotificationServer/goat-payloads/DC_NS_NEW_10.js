component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_10";
payload = {
    "testcase_id":  "DC_NS_NEW_10",
    "description":  "Verify duplicate resourceID overwrites and frees old context",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnsclientaccess.log",
                                              "description":  "Verify duplicate resourceID overwrite entry in access log",
                                              "value":  "overwrite",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "New context replaces old; old socket force-disconnected and freed; handle count returns to baseline."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
