component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_29";
payload = {
    "testcase_id":  "DC_NS_29",
    "description":  "Verify ondemand configuration deploys immediately",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "nsrequestlog.txt",
                                              "description":  "Verify PUSH entry in nsrequestlog for ondemand deploy",
                                              "value":  "PUSH",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcconfigondemand.log",
                                              "description":  "Verify agent received config in dcconfigondemand log",
                                              "value":  "config",
                                              "file_path":  "agent_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Configuration applied within seconds."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
