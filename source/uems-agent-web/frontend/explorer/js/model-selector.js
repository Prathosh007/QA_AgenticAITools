// ── Model selector ────────────────────────────────────────────
// Fetches available models from /api/models (server-side filtering),
// populates the dropdown, and manages selection persistence.

import { app } from './state.js';

// ── DOM refs ──────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const modelSelector = $('#model-selector');
const btnModel      = $('#btn-model');
const modelLabel    = $('#model-label');
const modelDropdown = $('#model-dropdown');

let bestModelId = null; // server-configured default

// ── Helpers ───────────────────────────────────────────────────

/** Pretty-print model IDs like "claude-sonnet-4.6" → "Claude Sonnet 4.6". */
export function formatModelName(id) {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Gpt/g, 'GPT')
    .replace(/^O(\d)/, 'o$1');  // keep o4-mini lowercase 'o' //No I18N
}

// ── Dropdown UI ───────────────────────────────────────────────

function populateModelDropdown(models, defaultModel) {
  bestModelId = defaultModel;
  modelDropdown.innerHTML = '';

  // "Default" option — maps to the server-configured default
  const bestEntry = models.find(m => m.id === defaultModel);
  const bestBtn = document.createElement('button');
  bestBtn.className = 'model-option' + (app.selectedModelId === '__best__' ? ' selected' : ''); //No I18N
  bestBtn.dataset.modelId = '__best__'; //No I18N
  bestBtn.innerHTML = `
    <div class="model-option-info">
      <div class="model-option-name">Default <span class="model-best-badge">${bestEntry ? bestEntry.name : defaultModel}</span></div>
      <div class="model-option-desc">Server-configured default model</div>
    </div>
    <span class="material-symbols-rounded model-option-check">check</span>
  `.trim();
  bestBtn.addEventListener('click', () => selectModel('__best__', bestEntry ? bestEntry.name : defaultModel)); //No I18N
  modelDropdown.appendChild(bestBtn);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'model-dropdown-divider'; //No I18N
  modelDropdown.appendChild(divider);

  // Individual model options
  for (const m of models) {
    const btn = document.createElement('button');
    const isSelected = app.selectedModelId === m.id;
    btn.className = 'model-option' + (isSelected ? ' selected' : ''); //No I18N
    btn.dataset.modelId = m.id;
    btn.innerHTML = `
      <div class="model-option-info">
        <div class="model-option-name">${m.name}${m.id === defaultModel ? ' <span class="model-best-badge">Default</span>' : ''}</div>
        <div class="model-option-desc">${m.description || m.provider || m.id}</div>
      </div>
      <span class="material-symbols-rounded model-option-check">check</span>
    `.trim();
    btn.addEventListener('click', () => selectModel(m.id, m.name)); //No I18N
    modelDropdown.appendChild(btn);
  }
}

function selectModel(modelId, displayName) {
  app.selectedModelId = modelId;
  if (modelId === '__best__') { //No I18N
    app.config.chatModel = bestModelId;
    modelLabel.textContent = displayName + ' \u2022'; //No I18N
  } else {
    app.config.chatModel = modelId;
    modelLabel.textContent = displayName;
  }
  localStorage.setItem('selectedModel', modelId); //No I18N
  localStorage.setItem('selectedModelName', displayName); //No I18N

  modelDropdown.querySelectorAll('.model-option').forEach(el => { //No I18N
    el.classList.toggle('selected', el.dataset.modelId === modelId); //No I18N
  });

  modelDropdown.classList.add('hidden'); //No I18N
  modelSelector.classList.remove('open'); //No I18N
}

// ── Fetch & init ──────────────────────────────────────────────

export async function loadModels() {
  const defaultModel = app.config.chatModel;
  let models = [];

  // Single source: /api/models handles live Copilot API fetch + allowlist
  // filtering server-side, with static fallback if API is unreachable.
  try {
    const resp = await fetch('/api/models', { //No I18N
      credentials: 'include', //No I18N
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      models = (data.models || []).map(m => ({
        id: m.id,
        name: m.name || formatModelName(m.id),
        provider: m.provider || '',
        description: m.description || '',
      }));
    }
  } catch (_e) { /* use defaults */ }

  if (models.length === 0) return;

  // Restore previous selection from localStorage
  const savedModelId = localStorage.getItem('selectedModel'); //No I18N
  const savedModelName = localStorage.getItem('selectedModelName'); //No I18N
  if (savedModelId) {
    app.selectedModelId = savedModelId;
    if (savedModelId === '__best__') { //No I18N
      app.config.chatModel = defaultModel;
      const bestEntry = models.find(m => m.id === defaultModel);
      modelLabel.textContent = (bestEntry ? bestEntry.name : formatModelName(defaultModel)) + ' \u2022'; //No I18N
    } else if (models.some(m => m.id === savedModelId)) {
      app.config.chatModel = savedModelId;
      modelLabel.textContent = savedModelName || formatModelName(savedModelId);
    } else {
      app.selectedModelId = '__best__'; //No I18N
      app.config.chatModel = defaultModel;
      const bestEntry = models.find(m => m.id === defaultModel);
      modelLabel.textContent = (bestEntry ? bestEntry.name : formatModelName(defaultModel)) + ' \u2022'; //No I18N
    }
  } else {
    app.selectedModelId = '__best__'; //No I18N
    const bestEntry = models.find(m => m.id === defaultModel);
    modelLabel.textContent = (bestEntry ? bestEntry.name : formatModelName(defaultModel)) + ' \u2022'; //No I18N
  }

  populateModelDropdown(models, defaultModel);
}

/** Wire toggle events. Call once from app.js init. */
export function initModelSelector() {
  btnModel.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !modelDropdown.classList.contains('hidden'); //No I18N
    modelDropdown.classList.toggle('hidden'); //No I18N
    modelSelector.classList.toggle('open'); //No I18N
    if (!isOpen) {
      document.querySelector('#user-menu')?.classList.add('hidden'); //No I18N
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    modelDropdown.classList.add('hidden'); //No I18N
    modelSelector.classList.remove('open'); //No I18N
  });
}
