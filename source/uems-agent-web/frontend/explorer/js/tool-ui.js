// ── Tool call UI helpers ──────────────────────────────────────
// All DOM manipulation for displaying in-progress and completed
// tool calls lives here.  No business logic.

import { escapeHtml, truncateStr } from './utils.js';

// ── Group container (created once per message) ────────────────

/** Find or create the .tool-group wrapper inside a message's contentEl. */
export function getOrCreateToolGroup(contentEl) {
  let group = contentEl.querySelector('.tool-group'); //No I18N
  if (group) return group;

  group = document.createElement('div');
  group.className = 'tool-group expanded';
  group.innerHTML = `
    <div class="tool-group-header">
      <span class="material-symbols-rounded tool-group-icon">pending</span>
      <span class="tool-group-label">Running tools\u2026</span>
      <span class="material-symbols-rounded tool-group-chevron">expand_more</span>
    </div>
    <div class="tool-group-body"></div>`;

  const textArea = contentEl.querySelector('.streaming-text'); //No I18N
  if (textArea) contentEl.insertBefore(group, textArea);
  else          contentEl.appendChild(group);
  return group;
}

/** Recalculate and update the tool group header label/icon. */
export function updateToolGroupHeader(contentEl) {
  const group = contentEl.querySelector('.tool-group'); //No I18N
  if (!group) return;

  const count    = group.querySelectorAll('.tool-call-container').length; //No I18N
  const doneCount = group.querySelectorAll('.tool-status-badge.completed').length; //No I18N
  const allDone  = count > 0 && doneCount === count;

  const label = group.querySelector('.tool-group-label'); //No I18N
  const icon  = group.querySelector('.tool-group-icon'); //No I18N

  if (allDone) {
    label.textContent = count === 1 ? 'Used 1 tool' : `Used ${count} tools`; //No I18N
    icon.textContent  = 'check'; //No I18N
    group.classList.add('done'); //No I18N
    group.classList.remove('expanded'); //No I18N
  } else {
    label.textContent = count === 1 ? 'Running 1 tool\u2026' : `Running ${count} tools\u2026`; //No I18N
    icon.textContent  = 'pending'; //No I18N
    group.classList.remove('done'); //No I18N
  }
}

// ── Individual tool call ──────────────────────────────────────

/** Append a pending tool call row to the group and return its element. */
export function appendToolCallUI(contentEl, name, argsStr) {
  let parsedArgs = '{}';
  try { parsedArgs = JSON.stringify(JSON.parse(argsStr), null, 2); } catch (_e) { parsedArgs = argsStr || '{}'; }

  const group  = getOrCreateToolGroup(contentEl);
  const body   = group.querySelector('.tool-group-body'); //No I18N
  const wrapper = document.createElement('div');
  wrapper.className   = 'tool-call-container';
  wrapper.dataset.tool = name;
  wrapper.innerHTML = `
    <div class="tool-call-header">
      <div class="tool-status-badge"><span class="tool-status-dot"></span></div>
      <div class="tool-name-text">${escapeHtml(name)}</div>
      <div class="tool-expand-icon"><span class="material-symbols-rounded">expand_more</span></div>
    </div>
    <div class="tool-call-body">
      <div class="tool-section">
        <div class="tool-section-label">Parameters</div>
        <div class="tool-section-content"><pre>${escapeHtml(parsedArgs)}</pre></div>
      </div>
    </div>`;

  body.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/** Mark a tool call as completed and append the result. */
export function completeToolCallUI(tcEl, output) {
  if (!tcEl) return;

  const badge = tcEl.querySelector('.tool-status-badge'); //No I18N
  badge.classList.add('completed'); //No I18N
  badge.innerHTML = '<span class="material-symbols-rounded" style="font-size:14px;">check</span>';

  const body = tcEl.querySelector('.tool-call-body'); //No I18N
  body.insertAdjacentHTML(
    'beforeend', //No I18N
    `<div class="tool-section">
      <div class="tool-section-label">Result</div>
      <div class="tool-section-content"><pre>${escapeHtml(truncateStr(output, 4000))}</pre></div>
    </div>`
  );

  tcEl.classList.remove('expanded'); //No I18N
  const contentEl = tcEl.closest('.message-content'); //No I18N
  if (contentEl) updateToolGroupHeader(contentEl);
}

// ── Static rendering (for history restore) ───────────────────

export function renderToolGroupStatic(toolCalls) {
  const allDone = toolCalls.every((tc) => tc.result);
  const icon  = allDone ? 'check' : 'pending'; //No I18N
  const label = toolCalls.length === 1 ? 'Used 1 tool' : `Used ${toolCalls.length} tools`; //No I18N
  const doneClass = allDone ? ' done' : ''; //No I18N

  const itemsHtml = toolCalls.map(renderToolCallStatic).join('');

  return `
    <div class="tool-group${doneClass}">
      <div class="tool-group-header">
        <span class="material-symbols-rounded tool-group-icon">${icon}</span>
        <span class="tool-group-label">${label}</span>
        <span class="material-symbols-rounded tool-group-chevron">expand_more</span>
      </div>
      <div class="tool-group-body">${itemsHtml}</div>
    </div>`;
}

function renderToolCallStatic(tc) {
  let args;
  try { args = JSON.stringify(JSON.parse(tc.arguments), null, 2); } catch (_e) { args = tc.arguments || '{}'; }

  const statusClass = tc.result ? 'completed' : ''; //No I18N
  const statusIcon  = tc.result
    ? '<span class="material-symbols-rounded" style="font-size:14px;">check</span>'
    : '<span class="tool-status-dot"></span>';

  const resultHtml = tc.result
    ? `<div class="tool-section">
        <div class="tool-section-label">Result</div>
        <div class="tool-section-content"><pre>${escapeHtml(tc.result)}</pre></div>
      </div>`
    : '';

  return `
    <div class="tool-call-container">
      <div class="tool-call-header">
        <div class="tool-status-badge ${statusClass}">${statusIcon}</div>
        <div class="tool-name-text">${escapeHtml(tc.name)}</div>
        <div class="tool-expand-icon"><span class="material-symbols-rounded">expand_more</span></div>
      </div>
      <div class="tool-call-body">
        <div class="tool-section">
          <div class="tool-section-label">Parameters</div>
          <div class="tool-section-content"><pre>${escapeHtml(args)}</pre></div>
        </div>
        ${resultHtml}
      </div>
    </div>`;
}

// ── Event binding ─────────────────────────────────────────────

/** Wire expand/collapse toggles for tool groups and individual calls. */
export function bindToolCallToggles(chatContainer) {
  if (chatContainer._toolToggleBound) return;
  chatContainer.addEventListener('click', (e) => {
    const groupHdr = e.target.closest('.tool-group-header'); //No I18N
    if (groupHdr) { groupHdr.closest('.tool-group').classList.toggle('expanded'); return; } //No I18N

    const hdr = e.target.closest('.tool-call-header'); //No I18N
    if (hdr) hdr.closest('.tool-call-container').classList.toggle('expanded'); //No I18N
  });
  chatContainer._toolToggleBound = true;
}

// ── Scroll (local helper used by tool UI) ─────────────────────

function scrollToBottom() {
  const chatContainer = document.getElementById('chat-container');
  chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
}
