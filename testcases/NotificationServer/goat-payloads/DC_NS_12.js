component = $Server_Machine_IP;
testcaseId = "DC_NS_12";
payload = {
    "testcase_id":  "DC_NS_12",
    "description":  "Verify dcnsdbsettings.conf has LAN/WAN timeouts",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnsdbsettings.conf",
                                              "key":  "ns.lanTimeout",
                                              "description":  "Verify ns.lanTimeout key exists in dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnsdbsettings.conf",
                                              "key":  "ns.wanTimeout",
                                              "description":  "Verify ns.wanTimeout key exists in dcnsdbsettings.conf",
                                              "file_path":  "server_home/conf",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "File contains LAN timeout and WAN timeout entries."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
