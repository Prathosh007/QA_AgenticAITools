// ── Auth — login, logout, session polling ─────────────────────

import { app }         from './state.js';
import { escapeHtml, hideLoadingScreen } from './utils.js';

// ── Auth error helpers ────────────────────────────────────────

export function isAuthError(status) {
  return status === 401 || status === 403;
}

export function handleAuthExpiry() {
  app.isLoggedIn     = false;
  app.user           = null;
  app.isStreaming    = false;
  app.abortController = null;

  const btnSend  = document.getElementById('btn-send');
  const statusBar = document.getElementById('status-bar');
  if (btnSend) { btnSend.disabled = false; }
  if (statusBar) { statusBar.classList.add('hidden'); } //No I18N
  showLogin();
}

// ── Login screen ──────────────────────────────────────────────

export function showLogin() {
  // Hide the loading overlay if still visible
  hideLoadingScreen();

  document.getElementById('login-screen').classList.remove('hidden'); //No I18N
  document.getElementById('app').classList.add('hidden'); //No I18N
  document.getElementById('login-error').classList.add('hidden'); //No I18N

  const authContent = document.getElementById('auth-content');
  authContent.innerHTML = '<button id="btn-login" class="primary-btn">Login with GitHub</button>'; //No I18N
  document.getElementById('btn-login').addEventListener('click', startLogin);
}

function showLoginError(msg) {
  const loginError = document.getElementById('login-error');
  loginError.textContent = msg;
  loginError.classList.remove('hidden'); //No I18N
}

// ── Device Flow ───────────────────────────────────────────────

export async function startLogin() {
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  document.getElementById('login-error').classList.add('hidden'); //No I18N

  try {
    const resp = await fetch('/auth/initiate', { method: 'POST', credentials: 'include' }); //No I18N
    const data = await resp.json();

    // Prefer verification_uri_complete (code pre-filled) so users don't type OTP
    const authURL = data.verification_uri_complete || data.verification_uri;

    const authContent = document.getElementById('auth-content');
    authContent.innerHTML =
      `<div class="verification-flow">` + //No I18N
        `<p class="auth-heading">Your device code</p>` + //No I18N
        `<div class="code-card">` + //No I18N
          `<div class="user-code">${escapeHtml(data.user_code)}</div>` + //No I18N
          `<button class="copy-code-inline" id="btn-copy-code" type="button" title="Copy code">` + //No I18N
            `<span class="material-symbols-rounded">content_copy</span></button>` + //No I18N
        `</div>` +
        `<p class="auth-hint">Code copied to clipboard</p>` + //No I18N
        `<a href="${escapeHtml(authURL)}" target="_blank" class="verify-link-btn" id="btn-open-github">` + //No I18N
          `<span class="material-symbols-rounded">open_in_new</span>Continue to GitHub</a>` + //No I18N
        `<p class="auth-steps-hint">` + //No I18N
          `Paste the code on GitHub if asked, then click <strong>Authorize</strong>.<br>` +
          `You'll be logged in automatically.</p>` + //No I18N
        `<p class="status-msg hidden" id="login-status">` + //No I18N
          `<span class="material-symbols-rounded spin">progress_activity</span> Waiting for authorization…</p>` + //No I18N
      `</div>`;

    // Auto-copy code to clipboard
    try { await navigator.clipboard.writeText(data.user_code); } catch (_) { /* clipboard may be blocked */ }

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(data.user_code);
    });

    // Start polling only after user clicks the GitHub link
    document.getElementById('btn-open-github').addEventListener('click', () => {
      const status = document.getElementById('login-status');
      if (status) { status.classList.remove('hidden'); } //No I18N
      pollAuth(data.device_code, data.interval || 5);
    });
  } catch (err) {
    showLoginError('Failed to start login: ' + err.message); //No I18N
  }
}

async function pollAuth(deviceCode, interval) {
  const statusEl  = document.getElementById('login-status');

  const poll = async () => {
    try {
      const resp = await fetch('/auth/poll', { //No I18N
        method: 'POST', //No I18N
        headers: { 'Content-Type': 'application/json' }, //No I18N
        body: JSON.stringify({ device_code: deviceCode }),
        credentials: 'include' //No I18N
      });
      const data = await resp.json();

      if (data.success) {
        if (statusEl) { statusEl.innerHTML = '<span class="material-symbols-rounded">check_circle</span> Authorized — logging you in…'; } //No I18N
        const statusResp = await fetch('/auth/status', { credentials: 'include' }); //No I18N
        const statusData = await statusResp.json();
        app.isLoggedIn = true;
        app.user       = { login: statusData.login, avatar_url: statusData.avatar_url };
        // Notify main module via custom event so auth.js stays decoupled from chat.js
        window.dispatchEvent(new CustomEvent('auth:logged-in')); //No I18N
        return;
      }

      if (data.status === 'pending') {
        setTimeout(poll, interval * 1000);
        return;
      }

      showLoginError(data.error || 'Authentication failed'); //No I18N
    } catch (err) {
      showLoginError('Polling failed: ' + err.message); //No I18N
    }
  };

  setTimeout(poll, interval * 1000);
}

// ── Logout ────────────────────────────────────────────────────

export async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' }); //No I18N
  app.isLoggedIn = false;
  app.user       = null;
  app.currentConvId = null;
  showLogin();
}
