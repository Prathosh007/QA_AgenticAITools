component = $LocalOffice_WinAgent1;
testcaseId = "DC_NS_27";
payload = {
    "testcase_id":  "DC_NS_27",
    "description":  "Verify agent client-data ns-status-details.xml updated",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "ns-status-details.xml",
                                              "path":  "//PortNo",
                                              "description":  "Verify agent ns-status-details.xml reflects new port",
                                              "file_path":  "agent_home/client-data",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "ns-status-details.xml updated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
