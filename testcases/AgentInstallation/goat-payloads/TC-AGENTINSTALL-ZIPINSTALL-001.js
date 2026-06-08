component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-ZIPINSTALL-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-ZIPINSTALL-001",
  "description": "Fresh agent installation via setup.bat from extracted zip",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Installers\\\\ZipExtract",
        "filename": "setup.bat",
        "description": "Verify setup.bat exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Installers\\\\ZipExtract",
        "filename": "UEMSAgent.msi",
        "description": "Verify UEMSAgent.msi exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Installers\\\\ZipExtract",
        "filename": "UEMSAgent.mst",
        "description": "Verify UEMSAgent.mst exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Installers\\\\ZipExtract",
        "filename": "DMRootCA-Server.crt",
        "description": "Verify server cert exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Installers\\\\ZipExtract",
        "filename": "DMRootCA.crt",
        "description": "Verify CA cert exists"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "C:\\\\Installers\\\\ZipExtract\\\\setup.bat",
        "timeout": 120,
        "description": "Run setup.bat from extracted zip"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Verify agent service RUNNING"
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
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin",
        "description": "Verify bin dir"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\conf",
        "description": "Verify conf dir"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\logs",
        "description": "Verify logs dir"
      }
    }
  ],
  "expected_result": "setup.bat completes. Agent service RUNNING. Registry populated. All subdirectories present."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
