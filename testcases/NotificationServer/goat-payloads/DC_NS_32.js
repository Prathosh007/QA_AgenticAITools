component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_32";
payload = {
    "testcase_id":  "DC_NS_32",
    "description":  "Verify \u0027Move to remote office\u0027 via Scope of Management",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcondemandaccess.log",
                                              "description":  "Verify agent received move command in dcondemandaccess log",
                                              "value":  "move",
                                              "file_path":  "agent_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Agent is moved successfully."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
