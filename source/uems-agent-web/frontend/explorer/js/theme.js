// ── Theme management ──────────────────────────────────────────

import { app } from './state.js';

export function applyTheme(theme) {
  app.theme = theme;
  localStorage.setItem('theme', theme); //No I18N

  let effective = theme;
  if (theme === 'auto') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; //No I18N
  }
  document.body.setAttribute('data-theme', effective);

  const hljsDark  = document.getElementById('hljs-dark');
  const hljsLight = document.getElementById('hljs-light');
  if (hljsDark && hljsLight) {
    hljsDark.disabled  = effective !== 'dark'; //No I18N
    hljsLight.disabled = effective === 'dark'; //No I18N
  }

  const icon = document.querySelector('#btn-theme .material-symbols-rounded'); //No I18N
  if (icon) {
    if (theme === 'dark') { icon.textContent = 'dark_mode'; }
    else if (theme === 'light') { icon.textContent = 'light_mode'; }
    else { icon.textContent = 'desktop_windows'; } //No I18N
  }
}

const THEME_CYCLE = { dark: 'light', light: 'auto', auto: 'dark' }; //No I18N

export function cycleTheme() {
  applyTheme(THEME_CYCLE[app.theme] || 'dark');
}
