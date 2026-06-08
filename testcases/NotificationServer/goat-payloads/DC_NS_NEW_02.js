component = $Server_Machine_IP;
testcaseId = "DC_NS_NEW_02";
payload = {
    "testcase_id":  "DC_NS_NEW_02",
    "description":  "Verify malformed/corrupted SSL data does not hang NS",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "command_to_run":  "powershell -Command \"\u0026 { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect(\u0027127.0.0.1\u0027, 8027); $stream = $tcp.GetStream(); $bytes = [byte[]](0x16, 0x03, 0x01, 0xFF, 0xFF); $stream.Write($bytes, 0, $bytes.Length); Start-Sleep -Seconds 2; $tcp.Close(); Write-Output \u0027INJECT_DONE\u0027 }\"",
                                              "description":  "Inject malformed SSL data to NS",
                                              "exact_value":  "INJECT_DONE"
                                          },
                           "operation_type":  "run_command"
                       },
                       {
                           "parameters":  {
                                              "service_name":  "dcnotificationserver",
                                              "expect":  "serviceRunning",
                                              "description":  "Verify NS remains running after malformed SSL data",
                                              "action":  "status"
                                          },
                           "operation_type":  "service_actions"
                       },
                       {
                           "parameters":  {
                                              "filename":  "dcnotificationserver0.log",
                                              "description":  "Verify SSL error logged in NS log",
                                              "value":  "SSL error",
                                              "file_path":  "server_home/logs",
                                              "action":  "value_should_be_present"
                                          },
                           "operation_type":  "file_folder_modification"
                       }
                   ],
    "expected_result":  "NS logs the SSL error and closes the offending socket; remains responsive."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
