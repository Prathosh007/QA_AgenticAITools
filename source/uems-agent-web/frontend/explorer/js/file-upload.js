// ── File upload with PII confirmation ─────────────────────────
// Handles file selection, drag-and-drop, PII confirmation modal,
// attachment strip rendering, and pending file state.

import { app } from './state.js';
import { escapeHtml, formatFileSize } from './utils.js';

const MAX_FILE_SIZE = 512 * 1024; // 512 KB per file

let stagedFiles = []; // files waiting for PII confirmation

// ── DOM refs ──────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const btnAttach      = $('#btn-attach');
const fileInput      = $('#file-input');
const attachStrip    = $('#attachment-strip');
const piiOverlay     = $('#pii-overlay');
const piiConfirmCheck = $('#pii-confirm-check');
const piiConfirmBtn  = $('#pii-confirm');
const piiCancelBtn   = $('#pii-cancel');
const piiFileList    = $('#pii-file-list');
const omniboxWrapper = document.querySelector('.omnibox-wrapper'); //No I18N
const chatInput      = $('#chat-input');

// ── Helpers ───────────────────────────────────────────────────

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ── Attachment strip ──────────────────────────────────────────

function renderAttachmentStrip() {
  attachStrip.innerHTML = '';
  if (app.pendingFiles.length === 0) {
    attachStrip.classList.add('hidden'); //No I18N
    return;
  }
  attachStrip.classList.remove('hidden'); //No I18N
  for (let i = 0; i < app.pendingFiles.length; i++) {
    const f = app.pendingFiles[i];
    const chip = document.createElement('div');
    chip.className = 'attachment-chip'; //No I18N
    chip.innerHTML = `
      <span class="material-symbols-rounded attachment-chip-icon">description</span>
      <span class="attachment-chip-name">${escapeHtml(f.name)}</span>
      <span class="attachment-chip-size">${formatFileSize(f.size)}</span>
      <button type="button" class="attachment-chip-remove" data-index="${i}" title="Remove">` + //No I18N
        `<span class="material-symbols-rounded">close</span>
      </button>
    `.trim();
    chip.querySelector('.attachment-chip-remove').addEventListener('click', (e) => { //No I18N
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      app.pendingFiles.splice(idx, 1);
      renderAttachmentStrip();
    });
    attachStrip.appendChild(chip);
  }
}

// ── PII confirmation modal ────────────────────────────────────

function showPiiConfirmation(files) {
  piiFileList.innerHTML = '';
  for (const f of files) {
    const chip = document.createElement('span');
    chip.className = 'pii-file-chip'; //No I18N
    chip.innerHTML = `<span class="material-symbols-rounded">description</span> ${escapeHtml(f.name)} <span style="opacity:0.5">(${formatFileSize(f.size)})</span>`;
    piiFileList.appendChild(chip);
  }
  piiConfirmCheck.checked = false;
  piiConfirmBtn.disabled = true;
  piiOverlay.classList.remove('hidden'); //No I18N
}

function validateAndStage(files) {
  const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
  if (oversized.length > 0) {
    alert(`Files must be under 512 KB each. Too large: ${oversized.map(f => f.name).join(', ')}`); //No I18N
    return;
  }
  stagedFiles = files;
  showPiiConfirmation(files);
}

// ── Init — wire all events ────────────────────────────────────

export function initFileUpload() {
  btnAttach.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    fileInput.value = ''; // reset so same file can be re-selected
    if (files.length === 0) { return; }
    validateAndStage(files);
  });

  piiConfirmCheck.addEventListener('change', () => {
    piiConfirmBtn.disabled = !piiConfirmCheck.checked;
  });

  piiCancelBtn.addEventListener('click', () => {
    piiOverlay.classList.add('hidden'); //No I18N
    stagedFiles = [];
  });

  piiConfirmBtn.addEventListener('click', async () => {
    piiOverlay.classList.add('hidden'); //No I18N
    const files = stagedFiles;
    stagedFiles = [];

    for (const file of files) {
      try {
        const content = await readFileAsText(file);
        app.pendingFiles.push({ name: file.name, size: file.size, content });
      } catch (_e) {
        alert(`Could not read file: ${file.name}`);
      }
    }

    renderAttachmentStrip();
    chatInput.focus();
  });

  // Drag-and-drop onto the omnibox
  omniboxWrapper.addEventListener('dragover', (e) => { e.preventDefault(); omniboxWrapper.classList.add('drag-over'); }); //No I18N
  omniboxWrapper.addEventListener('dragleave', () => omniboxWrapper.classList.remove('drag-over')); //No I18N
  omniboxWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    omniboxWrapper.classList.remove('drag-over'); //No I18N
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) { return; }
    validateAndStage(files);
  });

  // Clear attachment strip when files are consumed by sendMessage
  window.addEventListener('files:cleared', () => renderAttachmentStrip());
}
