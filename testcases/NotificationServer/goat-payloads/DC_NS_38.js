component = $Server_Machine_IP;
testcaseId = "DC_NS_38";
payload = {
    "testcase_id":  "DC_NS_38",
    "description":  "Verify WoL task wakes the agent",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify WoL task entry in nsrequestlog",
                                              "value":  "WoL",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent powers on."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
