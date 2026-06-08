component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_04";
payload = {
    "testcase_id":  "DC_NS_NEW_04",
    "description":  "Verify NS rejects payload encrypted with mismatched salt",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify decryption failure logged for mismatched salt",
                                              "value":  "decrypt",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "Decryption fails; agent not in regClientList; NS remains stable."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
