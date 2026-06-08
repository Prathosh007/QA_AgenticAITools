component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-MANUALGUI-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-MANUALGUI-001",
  "description": "Fresh manual GUI installation of agent via EXE wizard",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\..\\..\\Installers\\LocalOffice_Agent.exe",
        "timeout": 10,
        "description": "Launch the agent installer wizard EXE"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ReadText",
        "automationId": "3",
        "timeout": 30,
        "description": "Read the CAPTCHA text displayed on the captcha label",
        "note": "captcha_text"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "EnterText",
        "automationId": "6",
        "text": "${captcha_text}",
        "description": "Enter the CAPTCHA text into the input field"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "7",
        "description": "Click OK to validate CAPTCHA"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "Wait",
        "automationId": "2018",
        "timeout": 10,
        "description": "Wait for the Next button to appear"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "2018",
        "description": "Click Next (first Next — proceeds past info screen)"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "2018",
        "description": "Click Next (second Next — starts installation)"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "Wait",
        "automationId": "2023",
        "timeout": 30,
        "description": "Wait for completion status text to appear"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ReadText",
        "automationId": "2023",
        "expectedValue": "Installation Complete",
        "validationType": "contains",
        "description": "Verify completion text reads Installation Complete"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "2075",
        "description": "Click Close to exit the installer"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "description": "Verify agent service is RUNNING"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify ServerName registry key is populated"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin",
        "description": "Verify agent bin directory exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\conf",
        "description": "Verify agent conf directory exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\logs",
        "description": "Verify agent logs directory exists"
      }
    }
  ],
  "expected_result": "Installer wizard completes all steps. Completion text reads Installation Complete. Agent service is RUNNING. Registry ServerName populated. Install directories exist."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
