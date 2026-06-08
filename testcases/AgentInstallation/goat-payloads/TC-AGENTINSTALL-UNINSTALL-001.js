component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-UNINSTALL-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-UNINSTALL-001",
  "description": "Uninstall agent via Control Panel GUI with OTP",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "EnterText",
        "automationId": "SearchEditBox",
        "text": "UEMS-Agent",
        "description": "Type UEMS-Agent in Apps search box"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "DoubleClick",
        "automationId": "ListViewSubItem-0",
        "description": "Double-click ManageEngine UEMS - Agent entry"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "Wait",
        "automationId": "UninstallBtn",
        "timeout": 30,
        "description": "Wait for Uninstall button"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ClickButton",
        "automationId": "UninstallBtn",
        "description": "Click Uninstall button"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "Wait",
        "automationId": "SuccessUninstall",
        "timeout": 420,
        "description": "Wait for uninstall completion (up to 7 min)"
      }
    },
    {
      "operation_type": "native_gui_operation",
      "parameters": {
        "action": "ReadText",
        "automationId": "SuccessUninstall",
        "expectedValue": "Agent successfully uninstalled",
        "validationType": "contains",
        "description": "Verify completion text"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify service stopped/removed"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify install directory removed"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "check_key_not_exists",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "description": "Verify registry keys removed"
      }
    }
  ],
  "expected_result": "Uninstall completes. Agent service stopped/removed. Install directory removed. Registry keys removed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
