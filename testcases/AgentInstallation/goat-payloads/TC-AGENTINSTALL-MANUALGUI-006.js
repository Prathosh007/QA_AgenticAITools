component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-MANUALGUI-006";
payload = {
  "testcase_id": "TC-AGENTINSTALL-MANUALGUI-006",
  "description": "Manual GUI install on Windows Server 2019",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "timeout": 10,
        "description": "Launch agent installer on Windows Server 2019"
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
        "description": "Verify completion text"
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
        "description": "Verify agent service RUNNING on Server 2019"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify ServerName"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify install directory"
      }
    }
  ],
  "expected_result": "Installation completes on Windows Server 2019. Agent service RUNNING. Registry keys populated."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
