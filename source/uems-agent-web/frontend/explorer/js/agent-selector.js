// ── Agent selector ─────────────────────────────────────────────
// Lets users pick which AI agent persona drives the chat:
//   - Testcase Generator (default) — generates & stores QA test cases
//   - GOAT JSON Converter — converts test cases to GOAT framework JSON
//
// Selected agent is stored in app.selectedAgent and sent via
// X-Agent-Name header to the Copilot proxy.

import { app } from './state.js';

const $ = (s) => document.querySelector(s);

// Available agents — id must match the .agent.md filename stem
const AGENTS = [
  {
    id: 'uems-agent-testcase-generator',
    name: 'Testcase Generator',
    icon: 'checklist',
    desc: 'Generate QA test cases and GOAT JSON payloads',
  },
  {
    id: 'uems-agent-goat-converter',
    name: 'GOAT JSON Converter',
    icon: 'data_object',
    desc: 'Convert existing test cases to GOAT framework JSON payloads',
  },
];

let agentBtn, agentLabel, agentDropdown, agentIcon;

function buildAgentDropdown() {
  agentDropdown.innerHTML = '';
  for (const a of AGENTS) {
    const btn = document.createElement('button');
    const sel = app.selectedAgent === a.id;
    btn.className = 'model-option' + (sel ? ' selected' : '');
    btn.dataset.agentId = a.id;
    btn.innerHTML = `
      <div class="model-option-info">
        <div class="model-option-name">
          <span class="material-symbols-rounded" style="font-size:18px;vertical-align:middle;margin-right:4px">${a.icon}</span>
          ${a.name}
        </div>
        <div class="model-option-desc">${a.desc}</div>
      </div>
      <span class="material-symbols-rounded model-option-check">check</span>
    `.trim();
    btn.addEventListener('click', () => selectAgent(a));
    agentDropdown.appendChild(btn);
  }
}

function selectAgent(agent) {
  app.selectedAgent = agent.id;
  agentLabel.textContent = agent.name;
  agentIcon.textContent = agent.icon;
  localStorage.setItem('selectedAgent', agent.id);

  agentDropdown.querySelectorAll('.model-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.agentId === agent.id);
  });
  agentDropdown.classList.add('hidden');

  // Notify UI to refresh greeting prompts when agent changes
  window.dispatchEvent(new CustomEvent('agent:changed', { detail: { id: agent.id, name: agent.name } })); //No I18N
}

export function getSelectedAgentName() {
  return app.selectedAgent || 'uems-agent-testcase-generator';
}

export function initAgentSelector() {
  const container = document.getElementById('agent-selector');
  if (!container) return;

  agentBtn      = container.querySelector('.agent-selector-btn');
  agentLabel    = container.querySelector('.agent-selector-label');
  agentIcon     = container.querySelector('.agent-icon');
  agentDropdown = container.querySelector('.agent-dropdown');

  // Restore saved selection
  const saved = localStorage.getItem('selectedAgent');
  const match = AGENTS.find(a => a.id === saved);
  if (match) {
    app.selectedAgent = match.id;
    agentLabel.textContent = match.name;
    agentIcon.textContent = match.icon;
  } else {
    app.selectedAgent = AGENTS[0].id;
  }

  buildAgentDropdown();

  // Toggle dropdown
  agentBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = agentDropdown.classList.contains('hidden');
    // Close model dropdown if open
    const modelDd = document.getElementById('model-dropdown');
    if (modelDd) modelDd.classList.add('hidden');
    agentDropdown.classList.toggle('hidden');
    if (isHidden) buildAgentDropdown(); // refresh check marks
  });

  // Close on outside click
  document.addEventListener('click', () => {
    agentDropdown.classList.add('hidden');
  });
}
