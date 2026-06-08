// ── Feedback FAB + Modal ──────────────────────────────────────
// Wires up the floating action button, the modal overlay,
// the close button and the submit button with API call.
// Exported as an ES module; auto-initialises when loaded directly.

function setSubmitState(btn, icon, label, disabled) {
  btn.disabled = disabled;
  btn.innerHTML = `<span class="material-symbols-rounded">${icon}</span> ${label}`; //No I18N
}

/**
 * Detect the logged-in user's name from Zoho session.
 * Fetches /auth/zoho/status which returns { name, email } when logged in.
 */
async function detectUserName() {
  try {
    const resp = await fetch('/auth/zoho/status', { credentials: 'include' }); //No I18N
    if (!resp.ok) { return ''; }
    const data = await resp.json();
    return data.name || data.email || '';
  } catch (_e) {
    return '';
  }
}

export function initFeedback() {
  const fab        = document.getElementById('feedback-fab');
  const overlay    = document.getElementById('feedback-overlay');
  const closeBtn   = document.getElementById('feedback-close');
  const submitBtn  = document.getElementById('feedback-submit');
  const nameEl     = document.getElementById('feedback-name');
  const categoryEl = document.getElementById('feedback-category');
  const textEl     = document.getElementById('feedback-text');

  if (!fab || !overlay) { return; }

  // ── Open / close ─────────────────────────────────────────────

  const openModal  = async () => {
    // Auto-fill name from Zoho login if the field is empty
    if (!nameEl.value.trim()) {
      const detected = await detectUserName();
      if (detected) { nameEl.value = detected; }
    }
    overlay.classList.remove('hidden'); //No I18N
  };
  const closeModal = () => overlay.classList.add('hidden'); //No I18N

  fab.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { closeModal(); } });

  // ── Submit ───────────────────────────────────────────────────

  submitBtn.addEventListener('click', async () => {
    const body = textEl.value.trim();
    if (!body) { textEl.focus(); return; }

    setSubmitState(submitBtn, 'hourglass_top', 'Sending...', true); //No I18N

    try {
      const res = await fetch('/api/feedback', { //No I18N
        method: 'POST', //No I18N
        headers: { 'Content-Type': 'application/json' }, //No I18N
        body: JSON.stringify({
          name:     nameEl.value.trim() || 'Anonymous', //No I18N
          category: categoryEl.value,
          feedback: body,
          page:     window.location.pathname
        })
      });

      if (!res.ok) { throw new Error('Failed'); } //No I18N

      textEl.value = '';
      setSubmitState(submitBtn, 'check_circle', 'Thank you!', true); //No I18N

      setTimeout(() => {
        closeModal();
        setSubmitState(submitBtn, 'send', 'Send Feedback', false); //No I18N
      }, 1500);
    } catch (_err) {
      setSubmitState(submitBtn, 'error', 'Failed — try again', false); //No I18N
      setTimeout(() => {
        setSubmitState(submitBtn, 'send', 'Send Feedback', false); //No I18N
      }, 2000);
    }
  });
}
