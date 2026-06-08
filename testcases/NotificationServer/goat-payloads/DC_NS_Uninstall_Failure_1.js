component = $Server_Machine_IP;
testcaseId = "DC_NS_Uninstall_Failure_1";
payload = {
    "testcase_id":  "DC_NS_Uninstall_Failure_1",
    "description":  "Verify NS Stop, Uninstall, Install via MgrtDC.bat",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "description":  "Execute MgrtDC.bat for Stop/Uninstall/Install cycle",
                                              "timeout":  "300",
                                              "file_path":  "server_home/bin/MgrtDC.bat",
                                              "action":  "execute"
                                          },
                           "operation_type":  "run_bat"
                       },
                       {
                           "parameters":  {
                                              "action":  "status",
                                              "description":  "Verify NS is running after MgrtDC.bat",
                                              "service_name":  "dcnotificationserver",
                                              "max_wait_time":  "60",
                                              "check_interval":  "5",
                                              "expect":  "serviceRunning"
                                          },
                           "operation_type":  "service_actions"
                       }
                   ],
    "expected_result":  "All three operations succeed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
