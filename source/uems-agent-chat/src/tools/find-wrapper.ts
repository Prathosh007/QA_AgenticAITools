/**
 * Tool: uems_find_wrapper
 * Find Agent-Utils wrappers for a given capability (networking, file ops, etc.).
 */

import * as vscode from 'vscode';
import { searchRepos } from '../core/search-engine';
import { resolveRepoPaths, jsonResult, truncate } from './helpers';
import { lookupRepoPlatform } from '../core/repo-registry';

interface FindWrapperInput {
  capability: string;
  repo?: string;
  platform?: string;
}

type Platform = 'mac' | 'linux' | 'windows' | 'cross-platform';

/**
 * Known capability → search keyword mapping per platform.
 * Agents can pass free-form text too; these are accelerators.
 */
const PLATFORM_CAPABILITY_KEYWORDS: Record<Platform, Record<string, string[]>> = {
  mac: {
    'networking':     ['URLSession', 'HTTPRequest', 'NetworkManager', 'APIClient', 'ZCNetworkManager'],
    'file':           ['FileManager', 'FileHandler', 'FileOps', 'writeToFile', 'readFromFile'],
    'process':        ['Process', 'ProcessLauncher', 'NSTask', 'launchProcess', 'executeCommand'],
    'logging':        ['Logger', 'ZCLogger', 'LogManager', 'logMessage', 'AgentLogger'],
    'secure-storage': ['Keychain', 'SecureStorage', 'SecItem', 'credential', 'SecureDefaults'],
    'xpc':            ['NSXPCConnection', 'NSXPCInterface', 'NSXPCListener', 'XPCService', 'xpc_connection'],
    'data-parsing':   ['JSONDecoder', 'JSONEncoder', 'XMLParser', 'PropertyListDecoder', 'Codable'],
    'crypto':         ['SecKey', 'CommonCrypto', 'CryptoKit', 'encrypt', 'decrypt', 'signature'],
  },
  linux: {
    'networking':     ['http.Client', 'http.Get', 'http.Post', 'net.Dial', 'HTTPClient'],
    'file':           ['os.Open', 'os.Create', 'ioutil', 'filepath', 'os.ReadFile', 'os.WriteFile'],
    'process':        ['exec.Command', 'os.StartProcess', 'syscall.Exec'],
    'logging':        ['log.Logger', 'log.Print', 'zap.Logger', 'logrus', 'slog'],
    'secure-storage': ['keyring', 'secretservice', 'credential', 'SecureStore'],
    'dbus':           ['godbus', 'dbus.SystemBus', 'dbus.SessionBus', 'dbus.Object'],
    'data-parsing':   ['json.Marshal', 'json.Unmarshal', 'xml.Marshal', 'encoding'],
    'crypto':         ['crypto/aes', 'crypto/rsa', 'crypto/sha256', 'crypto/tls', 'encrypt', 'decrypt'],
  },
  windows: {
    'networking':     ['WinHttp', 'InternetOpen', 'HttpSendRequest', 'IXMLHTTPRequest', 'HttpClient'],
    'file':           ['CreateFile', 'ReadFile', 'WriteFile', 'FileStream', 'File.Open'],
    'process':        ['CreateProcess', 'ShellExecute', 'Process.Start', 'WMI'],
    'logging':        ['EventLog', 'ReportEvent', 'OutputDebugString', 'ILogger', 'NLog'],
    'secure-storage': ['CryptProtectData', 'CredWrite', 'DPAPI', 'SecureString', 'ProtectedData'],
    'registry':       ['RegOpenKeyEx', 'RegSetValueEx', 'Registry.GetValue', 'RegistryKey'],
    'com':            ['CoCreateInstance', 'IUnknown', 'IDispatch', 'CLSID', 'COM_INTERFACE'],
    'data-parsing':   ['JsonConvert', 'XmlDocument', 'nlohmann::json', 'rapidjson', 'tinyxml'],
    'crypto':         ['CryptEncrypt', 'BCrypt', 'NCrypt', 'AesCryptoServiceProvider', 'RSACryptoServiceProvider'],
  },
  'cross-platform': {
    'networking':     ['URLSession', 'HTTPRequest', 'NetworkManager', 'http.Client', 'http.Get', 'net.Dial'],
    'file':           ['FileManager', 'FileOps', 'os.Open', 'os.Create', 'filepath', 'readFromFile'],
    'process':        ['Process', 'ProcessLauncher', 'exec.Command', 'launchProcess'],
    'logging':        ['Logger', 'ZCLogger', 'LogManager', 'log.Logger', 'AgentLogger'],
    'secure-storage': ['Keychain', 'SecureStorage', 'keyring', 'credential'],
    'data-parsing':   ['JSONDecoder', 'JSONEncoder', 'json.Marshal', 'json.Unmarshal', 'XMLParser'],
    'crypto':         ['SecKey', 'CommonCrypto', 'CryptoKit', 'crypto/aes', 'encrypt', 'decrypt'],
  },
};

export class FindWrapperTool implements vscode.LanguageModelTool<FindWrapperInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FindWrapperInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    void token;
    const { capability, repo: repoInput, platform: platformInput } = options.input;
    const platform = (platformInput as Platform) || 'mac';

    // Default wrapper repo varies by platform
    const defaultWrapperRepo: Record<string, string> = {
      mac: 'agent-utils',
      linux: 'dc_native',
      windows: 'uems_agent_utils',
    };
    const repo = repoInput || defaultWrapperRepo[platform] || 'agent-utils';

    // Resolve target repo
    const repoPaths = resolveRepoPaths([repo]);
    if (repoPaths.length === 0) {
      return jsonResult({ error: `Repo '${repo}' not found in workspace folders. Clone it first.` });
    }

    // Build search query from known keywords + the raw capability string
    const platformKeywords = PLATFORM_CAPABILITY_KEYWORDS[platform] ?? PLATFORM_CAPABILITY_KEYWORDS.mac;
    const keywords = platformKeywords[capability.toLowerCase()] ?? [];
    const searchTerms = [...keywords, capability];
    const query = searchTerms.join('|');

    const filePatterns: Record<Platform, string> = {
      mac: '*.{swift,h,m,mm}',
      linux: '*.go',
      windows: '*.{c,cpp,h,hpp,cs}',
      'cross-platform': '*.{swift,h,m,mm,go,c,cpp}',
    };

    const result = await searchRepos({
      query,
      repoPaths: repoPaths,
      filePattern: filePatterns[platform] ?? filePatterns.mac,
      maxResults: 100,
      isRegex: true,
    });

    // Group by file → compact "line:text" strings, max 5 per file
    const byFile: Record<string, string[]> = {};
    for (const match of result.matches) {
      if (!byFile[match.file]) { byFile[match.file] = []; }
      if (byFile[match.file].length < 5) {
        byFile[match.file].push(`${match.line}:${truncate(match.text.trim(), 100)}`);
      }
    }

    return jsonResult({
      capability,
      repo,
      platform: lookupRepoPlatform(repo) ?? platform,
      fileCount: Object.keys(byFile).length,
      files: byFile,
    });
  }
}
