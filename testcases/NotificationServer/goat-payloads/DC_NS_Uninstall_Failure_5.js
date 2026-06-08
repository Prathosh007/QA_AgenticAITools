component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_Uninstall_Failure_5";
payload = {
    "testcase_id":  "DC_NS_Uninstall_Failure_5",
    "description":  "Verify Message Box configuration deploys immediately",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "action":  "value_should_be_present",
                                              "description":  "Verify Message Box config deployed to agent",
                                              "max_wait_time":  "30",
                                              "value":  "MessageBox",
                                              "check_interval":  "3",
                                              "filename":  "dcconfigondemand.log",
                                              "file_path":  "agent_home/logs"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Deployed immediately on agent."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
