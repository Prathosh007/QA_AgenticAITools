/**
 * UEMS Agent Explorer - entry point
 *
 * Intentionally thin: imports focused modules, wires DOM events, and boots.
 * All business logic lives in js/ sub-modules.
 */

import { setupMarked }            from './js/markdown.js';
import { app }                    from './js/state.js';
import { store }                  from './js/store.js';
import { applyTheme, cycleTheme } from './js/theme.js';
import { showLogin, logout }      from './js/auth.js';
import { renderSidebar, closeAnyContextMenu } from './js/sidebar.js';
import { renderMessages, bindCodeCopyButtons } from './js/messages.js';
import { bindFollowUpChips }      from './js/suggestions.js';
import { sendMessage }            from './js/chat-standalone.js';
import { sendMessageBridge }      from './js/chat-bridge.js';
import { exportAsMarkdown, exportAsJSON } from './js/export.js';
import { initFeedback }               from '../js/feedback.js';
import { initFileUpload }         from './js/file-upload.js';
import { initModelSelector, loadModels, formatModelName } from './js/model-selector.js';
import { initAgentSelector }  from './js/agent-selector.js';
import { hideLoadingScreen }      from './js/utils.js';

// ── Markdown setup ────────────────────────────────────────────
setupMarked();


// ── DOM refs ──────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);

const chatContainer  = $('#chat-container');
const statusBar      = $('#status-bar');
const statusText     = $('#status-text');
const chatInput      = $('#chat-input');
const btnSend        = $('#btn-send');
const btnStop        = $('#btn-stop');
const btnNewChat     = $('#btn-new-chat');
const btnReset       = $('#btn-reset');
const btnLogout      = $('#btn-logout');
const btnTheme       = $('#btn-theme');
const btnUserMenu    = $('#btn-user-menu');
const userMenu       = $('#user-menu');
const headerBrand    = $('#header-brand');
const sidebarToggle  = $('#sidebar-toggle');
const sidebarNav     = $('#sidebar-nav');
const chatTitle      = $('#chat-title');

// ── Dispatch send to the right mode ──────────────────────────

function dispatchSend() {
  const args = [chatContainer, chatInput, statusBar, statusText, btnSend, chatTitle, sidebarNav, refreshSidebar];
  if (app.bridgeMode) sendMessageBridge(...args);
  else                sendMessage(...args);
}

// ── Sidebar helpers ───────────────────────────────────────────

function refreshSidebar() {
  renderSidebar(
    sidebarNav,
    (id) => switchConversation(id),
    (id, title) => { store.rename(id, title); chatTitle.textContent = title; refreshSidebar(); },
    (id) => deleteConversation(id)
  );
}

function switchConversation(convId) {
  const conv = store.get(convId);
  if (!conv) return;
  app.currentConvId     = convId;
  chatTitle.textContent = conv.title;
  refreshSidebar();
  renderMessages(chatContainer, conv, (prompt) => {
    chatInput.value = prompt;
    chatInput.focus();
    dispatchSend();
  });
  bindFollowUpChips(chatContainer);
  chatInput.focus();
}

function startNewChat() {
  const conv = store.create();
  app.currentConvId     = conv.id;
  chatTitle.textContent = 'New Chat'; //No I18N
  refreshSidebar();
  renderMessages(chatContainer, conv, (prompt) => {
    chatInput.value = prompt;
    chatInput.focus();
    dispatchSend();
  });
  chatInput.focus();
}

function deleteConversation(convId) {
  if (!confirm('Delete this conversation?')) return;
  const conv = store.get(convId);
  if (conv?.bridgeSessionId && app.bridgeMode) {
    fetch(`/chat/${conv.bridgeSessionId}`, { method: 'DELETE' }).catch(() => {}); //No I18N
  }
  store.remove(convId);
  refreshSidebar();
  if (convId === app.currentConvId) {
    if (store.conversations.length > 0) switchConversation(store.conversations[0].id);
    else startNewChat();
  }
}

// ── Show app after login ──────────────────────────────────────

function showApp() {
  hideLoadingScreen();
  $('#login-screen').classList.add('hidden'); //No I18N
  $('#app').classList.remove('hidden'); //No I18N
  updateUserUI();
  refreshSidebar();

  if (store.conversations.length > 0) {
    const sorted = [...store.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    switchConversation(sorted[0].id);
  } else {
    startNewChat();
  }
}

function updateUserUI() {
  const nameEl        = $('#user-menu-name');
  const imgEl         = $('#user-avatar-img');
  const placeholderEl = $('#avatar-placeholder');
  if (app.user) {
    nameEl.textContent = app.user.login;
    if (app.user.avatar_url) {
      imgEl.src              = app.user.avatar_url;
      imgEl.alt              = app.user.login;
      imgEl.style.display    = 'block';
      placeholderEl.style.display = 'none';
    }
  }
}

// ── Input auto-resize ─────────────────────────────────────────

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
});

// ── Send events ───────────────────────────────────────────────

btnSend.addEventListener('click', dispatchSend);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dispatchSend(); }
});

// Suggestion chip click (dispatched by suggestions.js)
window.addEventListener('chat:send-prompt', dispatchSend);

// Agent changed — refresh greeting prompts if chat is empty
window.addEventListener('agent:changed', () => {
  const conv = store.get(app.currentConvId);
  if (!conv || conv.messages.length === 0) {
    renderMessages(chatContainer, conv || { messages: [] }, (prompt) => {
      chatInput.value = prompt;
      chatInput.focus();
      dispatchSend();
    });
  }
});

btnStop.addEventListener('click', () => {
  app.abortController?.abort();
  app.abortController = null;
});

// ── Navigation ────────────────────────────────────────────────

btnNewChat.addEventListener('click', startNewChat);
btnReset.addEventListener('click', startNewChat);
headerBrand.addEventListener('click', startNewChat);

// ── Auth events ───────────────────────────────────────────────

window.addEventListener('auth:logged-in', () => {
  showApp();
  loadModels(); // fetch models now that auth is available
});

btnLogout.addEventListener('click', async () => {
  userMenu.classList.add('hidden'); //No I18N
  await logout();
});

// ── User menu ─────────────────────────────────────────────────

btnUserMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  userMenu.classList.toggle('hidden'); //No I18N
});

document.addEventListener('click', () => {
  userMenu.classList.add('hidden'); //No I18N
  closeAnyContextMenu();
});

// ── Theme ─────────────────────────────────────────────────────

btnTheme.addEventListener('click', cycleTheme);

// ── Sidebar toggle persistence ────────────────────────────────

sidebarToggle.addEventListener('change', () => {
  localStorage.setItem('sidebar_open', sidebarToggle.checked); //No I18N
});

// ── Export ────────────────────────────────────────────────────

$('#btn-export-md')?.addEventListener('click',   () => { exportAsMarkdown(); userMenu.classList.add('hidden'); });
$('#btn-export-json')?.addEventListener('click', () => { exportAsJSON();     userMenu.classList.add('hidden'); });

// ── Keyboard shortcut ─────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === '/') { e.preventDefault(); chatInput.focus(); }
});

// ── Init ──────────────────────────────────────────────────────

async function init() {
  applyTheme(app.theme);
  store.load();
  initFeedback();
  initFileUpload();
  initModelSelector();
  initAgentSelector();

  if (localStorage.getItem('sidebar_open') !== 'false') sidebarToggle.checked = true; //No I18N

  // Detect server mode
  try {
    const modeResp = await fetch('/api/mode', { signal: AbortSignal.timeout(2000) }); //No I18N
    if (modeResp.ok) {
      const modeData    = await modeResp.json();
      app.bridgeMode    = modeData.mode === 'bridge'; //No I18N
      app.standaloneMode = modeData.mode === 'standalone'; //No I18N
      app.llmProvider   = modeData.provider || 'copilot'; //No I18N
      console.log(`[UEMS] mode=${modeData.mode} provider=${app.llmProvider}`);
    }
  } catch (_e) {
    app.bridgeMode = app.standaloneMode = false;
  }

  const providerSuffix = app.llmProvider !== 'copilot' ? ` (${app.llmProvider})` : ''; //No I18N
  document.title = app.bridgeMode
    ? 'UEMS Agent Explorer \u2014 Bridge' //No I18N
    : app.standaloneMode
      ? `UEMS Agent Explorer \u2014 Standalone${providerSuffix}`
      : 'UEMS Agent Explorer'; //No I18N

  // Fetch tunable server config
  try {
    const cfgResp = await fetch('/api/config', { signal: AbortSignal.timeout(2000) }); //No I18N
    if (cfgResp.ok) Object.assign(app.config, await cfgResp.json());
  } catch (_e) { /* use defaults */ }

  // Set initial model label from config (will be updated after loadModels)
  $('#model-label').textContent = formatModelName(app.config.chatModel);

  // Check session
  try {
    const resp = await fetch('/auth/status', { credentials: 'include' }); //No I18N
    const data = await resp.json();
    if (data.isLoggedIn) {
      app.isLoggedIn = true;
      app.user       = { login: data.login, avatar_url: data.avatar_url };
      showApp();
      // Load models after auth so Copilot API calls have valid cookies
      await loadModels();
    } else {
      showLogin();
    }
  } catch (_e) {
    showLogin();
  }
}

init();
