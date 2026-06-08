// ── Zoho OAuth — home page auth check + login/logout ─────────────
// Checks /auth/zoho/status on page load.
// If not logged in, shows the login overlay and hides main content.
// On login: redirects to /auth/zoho/login (server handles the OAuth redirect).
// On logout: POSTs to /auth/zoho/logout then reloads.

export function initZohoAuth() {
  const screen    = document.getElementById('zoho-login-screen');
  const mainWrap  = document.getElementById('home-main');
  const loginBtn  = document.getElementById('zoho-login-btn');
  const errorBox  = document.getElementById('zoho-error-box');
  const userPill  = document.getElementById('home-user-pill');
  const userName  = document.getElementById('home-user-name');
  const userAvatar = document.getElementById('home-user-avatar');
  const logoutBtn = document.getElementById('home-logout-btn');

  // ── Check session ──────────────────────────────────────────────

  fetch('/auth/zoho/status', { credentials: 'include' }) //No I18N
    .then((r) => r.json())
    .then((data) => {
      // Zoho not configured on this server — skip auth overlay entirely
      if (!data.configured) {
        showApp({});
        return;
      }
      if (data.isLoggedIn) {
        showApp(data);
      } else {
        const urlError = new URLSearchParams(window.location.search).get('error'); //No I18N
        showLogin(urlError ? friendlyError(urlError) : null);
      }
    })
    .catch(() => showLogin(null));

  // ── Login click ────────────────────────────────────────────────

  loginBtn.addEventListener('click', () => {
    loginBtn.disabled = true;
    loginBtn.innerHTML = `<span class="zoho-spinner"></span>Redirecting to Zoho…`; //No I18N
    window.location.href = '/auth/zoho/login'; //No I18N
  });

  // ── Logout click ───────────────────────────────────────────────

  logoutBtn.addEventListener('click', async () => {
    await fetch('/auth/zoho/logout', { method: 'POST', credentials: 'include' }); //No I18N
    window.location.reload();
  });

  // ── Helpers ────────────────────────────────────────────────────

  function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen'); //No I18N
    if (loader) {
      loader.style.opacity = '0'; //No I18N
      setTimeout(() => loader.remove(), 300);
    }
  }

  function showApp(user) {
    hideLoadingScreen();
    screen.classList.add('hidden'); //No I18N

    // After login, redirect to the page the user originally requested
    const savedRedirect = sessionStorage.getItem('zoho_login_redirect'); //No I18N
    if (savedRedirect) {
      sessionStorage.removeItem('zoho_login_redirect'); //No I18N
      window.location.href = savedRedirect;
      return;
    }

    // Don't un-hide home-main on /docs/* routes — docs.js owns that page
    if (!window.location.pathname.startsWith('/docs/')) { //No I18N
      mainWrap.classList.remove('hidden');
    }
    if (userPill) {
      userPill.classList.remove('hidden');
      if (userName) { userName.textContent = user.name || user.email; }
      if (userAvatar && user.avatar) {
        userAvatar.src = user.avatar;
        userAvatar.alt = user.name || 'User'; //No I18N
      }
    }
    // Clean ?error= from URL without reload
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  function showLogin(errorMsg) {
    hideLoadingScreen();
    mainWrap.classList.add('hidden');
    screen.classList.remove('hidden');
    screen.style.opacity = '1';

    // Save the original path so we can redirect back after Zoho login
    const params = new URLSearchParams(window.location.search);
    const loginTarget = params.get('login_required'); //No I18N
    if (loginTarget && loginTarget !== '/' && loginTarget !== '/index.html') { //No I18N
      sessionStorage.setItem('zoho_login_redirect', loginTarget); //No I18N
    }

    if (errorMsg && errorBox) {
      errorBox.textContent = errorMsg;
      errorBox.classList.remove('hidden');
    }
  }

  function friendlyError(code) {
    const map = {
      access_denied:          'Access denied. Your account is not authorised to access this tool.', //No I18N
      no_code:                'OAuth authorisation failed — no code received.', //No I18N
      token_exchange_failed:  'Could not exchange authorisation code. Please try again.', //No I18N
      no_id_token:            'Authentication response was incomplete. Please try again.', //No I18N
      id_token_invalid:       'Could not verify your identity. Please try again.', //No I18N
      invalid_email:          'Your account email could not be verified.', //No I18N
      session_failed:         'Session creation failed. Please try again.' //No I18N
    };
    return map[code] || 'Authentication failed. Please try again.'; //No I18N
  }
}
