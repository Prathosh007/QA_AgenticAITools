component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-MANUALGUI-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-MANUALGUI-002",
  "description": "Manual GUI install with invalid CAPTCHA entry",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "timeout": 10,
        "description": "Launch the agent installer wizard"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ReadText",
        "automationId": "3",
        "timeout": 30,
        "description": "Read the CAPTCHA text",
        "note": "captcha_text"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "EnterText",
        "automationId": "6",
        "text": "WRONGCAPTCHA",
        "description": "Enter an incorrect CAPTCHA value"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "7",
        "description": "Click OK to validate invalid CAPTCHA"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "VerifyNotPresent",
        "automationId": "2018",
        "timeout": 10,
        "description": "Verify Next button does NOT appear — installer stays on CAPTCHA screen"
      }
    }
  ],
  "expected_result": "Error message displayed for invalid CAPTCHA. Installer remains on CAPTCHA screen. Next button does not appear."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
