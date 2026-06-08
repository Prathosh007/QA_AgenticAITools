// ── App state ─────────────────────────────────────────────────
// Single source of truth for runtime state.  Mutated in-place
// by the modules that own each concern.

export const app = {
  isLoggedIn: false,
  user: null,
  currentConvId: null,
  isStreaming: false,
  abortController: null,
  pendingFiles: [],      // files staged for the next message [{name, size, content}]
  theme: localStorage.getItem('theme') || 'dark', //No I18N
  bridgeMode: false,     // VS Code HTTP bridge handles the full chat loop
  standaloneMode: false, // server provides Copilot API proxy + local tools
  llmProvider: 'copilot', //No I18N
  selectedAgent: localStorage.getItem('selectedAgent') || 'uems-agent-explorer', //No I18N
  config: {
    toolOutputLimit: 8000,
    contextTokenLimit: 120000,
    chatModel: 'claude-sonnet-4.6', //No I18N
    suggestModel: 'gpt-4.1', //No I18N
    editorVersion: 'vscode/1.96.0', //No I18N
    pluginVersion: 'copilot-chat/0.23.2' //No I18N
  }
};
