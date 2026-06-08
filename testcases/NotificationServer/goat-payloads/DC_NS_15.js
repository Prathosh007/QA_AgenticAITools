component = $Server_Machine_IP;
testcaseId = "DC_NS_15";
payload = {
    "testcase_id":  "DC_NS_15",
    "description":  "Verify dcnsdetails DB table mirrors runtime config",
    "reuse_installation":  false,
    "operations":  [
                       {
                           "parameters":  {
                                              "query":  "SELECT * FROM dcnsdetails",
                                              "description":  "Query dcnsdetails table and verify columns populated",
                                              "action":  "query"
                                          },
                           "operation_type":  "db_operation"
                       }
                   ],
    "expected_result":  "Row present with all four columns populated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
