component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-MANUALGUI-007";
payload = {
  "testcase_id": "TC-AGENTINSTALL-MANUALGUI-007",
  "description": "Manual GUI install when agent is already installed (re-install)",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "description": "Pre-check: verify agent is already installed and running"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "timeout": 10,
        "description": "Launch installer while agent is already installed"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ReadText",
        "automationId": "3",
        "timeout": 30,
        "note": "captcha_text",
        "description": "Read CAPTCHA"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "EnterText",
        "automationId": "6",
        "text": "${captcha_text}",
        "description": "Enter CAPTCHA"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "7",
        "description": "Click OK"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "Wait",
        "automationId": "2018",
        "timeout": 10,
        "description": "Wait for Next"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "2018",
        "description": "Click Next (1)"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "2018",
        "description": "Click Next (2)"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "Wait",
        "automationId": "2023",
        "timeout": 30,
        "description": "Wait for completion"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ReadText",
        "automationId": "2023",
        "expectedValue": "Installation Complete",
        "validationType": "contains",
        "description": "Verify completion or upgrade message"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "2075",
        "description": "Click Close"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "description": "Verify agent service still RUNNING after re-install"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify registry keys intact"
      }
    }
  ],
  "expected_result": "Installer handles existing agent. Agent service remains RUNNING. No duplicate services or registry entries."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
