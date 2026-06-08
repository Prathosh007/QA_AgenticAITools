package tools

import (
	"context"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

var platformCapabilityKeywords = map[string]map[string][]string{
	"mac": {
		"networking":     {"URLSession", "HTTPRequest", "NetworkManager", "APIClient", "ZCNetworkManager"},
		"file":           {"FileManager", "FileHandler", "FileOps", "writeToFile", "readFromFile"},
		"process":        {"Process", "ProcessLauncher", "NSTask", "launchProcess", "executeCommand"},
		"logging":        {"Logger", "ZCLogger", "LogManager", "logMessage", "AgentLogger"},
		"secure-storage": {"Keychain", "SecureStorage", "SecItem", "credential", "SecureDefaults"},
		"xpc":            {"NSXPCConnection", "NSXPCInterface", "NSXPCListener", "XPCService", "xpc_connection"},
		"data-parsing":   {"JSONDecoder", "JSONEncoder", "XMLParser", "PropertyListDecoder", "Codable"},
		"crypto":         {"SecKey", "CommonCrypto", "CryptoKit", "encrypt", "decrypt", "signature"},
	},
	"linux": {
		"networking":     {"http.Client", "http.Get", "http.Post", "net.Dial", "HTTPClient"},
		"file":           {"os.Open", "os.Create", "ioutil", "filepath", "os.ReadFile", "os.WriteFile"},
		"process":        {"exec.Command", "os.StartProcess", "syscall.Exec"},
		"logging":        {"log.Logger", "log.Print", "zap.Logger", "logrus", "slog"},
		"secure-storage": {"keyring", "secretservice", "credential", "SecureStore"},
		"dbus":           {"godbus", "dbus.SystemBus", "dbus.SessionBus", "dbus.Object"},
		"data-parsing":   {"json.Marshal", "json.Unmarshal", "xml.Marshal", "encoding"},
		"crypto":         {"crypto/aes", "crypto/rsa", "crypto/sha256", "crypto/tls", "encrypt", "decrypt"},
	},
	"windows": {
		"networking":     {"WinHttp", "InternetOpen", "HttpSendRequest", "IXMLHTTPRequest", "HttpClient"},
		"file":           {"CreateFile", "ReadFile", "WriteFile", "FileStream", "File.Open"},
		"process":        {"CreateProcess", "ShellExecute", "Process.Start", "WMI"},
		"logging":        {"EventLog", "ReportEvent", "OutputDebugString", "ILogger", "NLog"},
		"secure-storage": {"CryptProtectData", "CredWrite", "DPAPI", "SecureString", "ProtectedData"},
		"registry":       {"RegOpenKeyEx", "RegSetValueEx", "Registry.GetValue", "RegistryKey"},
		"com":            {"CoCreateInstance", "IUnknown", "IDispatch", "CLSID", "COM_INTERFACE"},
		"data-parsing":   {"JsonConvert", "XmlDocument", "nlohmann::json", "rapidjson", "tinyxml"},
		"crypto":         {"CryptEncrypt", "BCrypt", "NCrypt", "AesCryptoServiceProvider", "RSACryptoServiceProvider"},
	},
	"cross-platform": {
		"networking":     {"URLSession", "HTTPRequest", "NetworkManager", "http.Client", "http.Get", "net.Dial"},
		"file":           {"FileManager", "FileOps", "os.Open", "os.Create", "filepath", "readFromFile"},
		"process":        {"Process", "ProcessLauncher", "exec.Command", "launchProcess"},
		"logging":        {"Logger", "ZCLogger", "LogManager", "log.Logger", "AgentLogger"},
		"secure-storage": {"Keychain", "SecureStorage", "keyring", "credential"},
		"data-parsing":   {"JSONDecoder", "JSONEncoder", "json.Marshal", "json.Unmarshal", "XMLParser"},
		"crypto":         {"SecKey", "CommonCrypto", "CryptoKit", "crypto/aes", "encrypt", "decrypt"},
	},
}

type findWrapperInput struct {
	Capability string `json:"capability" jsonschema:"Capability to search for (networking file process logging etc.)"`
	Repo       string `json:"repo,omitempty" jsonschema:"Repo name (default: agent-utils)"`
	Platform   string `json:"platform,omitempty" jsonschema:"Platform: mac linux windows"`
}

func registerFindWrapper(s *mcp.Server) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "uems_agent_find_wrapper",
		Description: "Find Agent-Utils wrappers for a given capability such as networking, file operations, process launching, logging, secure storage, XPC, or crypto. Use this before writing code that touches system APIs to check if a wrapper already exists.",
	}, func(_ context.Context, _ *mcp.CallToolRequest, input findWrapperInput) (*mcp.CallToolResult, any, error) {
		if input.Platform == "" {
			input.Platform = "mac"
		}
		if input.Repo == "" {
			switch input.Platform {
			case "linux":
				input.Repo = "dc_native"
			case "windows":
				input.Repo = "uems_agent_utils"
			default:
				input.Repo = "agent-utils"
			}
		}

		rp := resolveRepoPath(input.Repo)
		if rp == "" {
			return errorResult(fmt.Sprintf("Repo %q not found. Clone it first.", input.Repo)), nil, nil
		}

		keywords := platformCapabilityKeywords[input.Platform]
		if keywords == nil {
			keywords = platformCapabilityKeywords["mac"]
		}
		terms := keywords[strings.ToLower(input.Capability)]
		searchTerms := append(terms, input.Capability)
		query := strings.Join(searchTerms, "|")

		matches, _ := rgSearch(query, []string{rp}, filePatternForPlatform(input.Platform), 100, true)

		byFile := map[string][]string{}
		for _, m := range matches {
			entries := byFile[m.File]
			if len(entries) < 5 {
				byFile[m.File] = append(entries, fmt.Sprintf("%d:%s", m.Line, m.Text))
			}
		}

		// Resolve platform from registry if not explicitly provided
		resolvedPlatform := input.Platform
		for platform, platformRepos := range registry {
			if _, ok := platformRepos[input.Repo]; ok {
				resolvedPlatform = platform
				break
			}
		}

		return jsonResponse(map[string]interface{}{
			"capability": input.Capability,
			"repo":       input.Repo,
			"platform":   resolvedPlatform,
			"fileCount":  len(byFile),
			"files":      byFile,
		}), nil, nil
	})
}
