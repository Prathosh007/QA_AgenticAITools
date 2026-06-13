// ── Message rendering ─────────────────────────────────────────
// Builds and updates DOM for user and assistant messages.
// No side-effects beyond the DOM.

import { app }                          from './state.js';
import { escapeHtml, renderMarkdown, formatFileSize } from './utils.js';
import { renderToolGroupStatic, bindToolCallToggles } from './tool-ui.js';
import { SUGGESTION_PROMPTS, TESTCASE_PROMPTS } from './suggestions.js';
import { renderTestcaseWizard } from './testcase-wizard.js';

// ── Public API ────────────────────────────────────────────────

export function renderMessages(chatContainer, conv, onSuggestionClick, chatInput) {
  if (!conv.messages || conv.messages.length === 0) {
    renderEmptyState(chatContainer, onSuggestionClick, chatInput);
    return;
  }

  chatContainer.className = 'chat-container';
  const items = conv.messages.map((msg) => {
    if (msg.role === 'user')      return renderUserMessage(msg.content);
    if (msg.role === 'assistant') return renderAssistantMessage(msg.content, msg.toolCalls, msg.renderedHtml);
    return '';
  }).join('');

  chatContainer.innerHTML = '<div class="messages-list">' + items + '</div>';
  bindCodeCopyButtons(chatContainer);
  bindAttachmentActions(chatContainer);
  bindToolCallToggles(chatContainer);
  scrollToBottom(chatContainer);
}

export function renderUserMessage(content) {
  const avatarHtml = app.user?.avatar_url
    ? `<img src="${escapeHtml(app.user.avatar_url)}" alt="ME" style="width:100%;height:100%;object-fit:cover;">`
    : 'ME'; //No I18N

  // Parse <attached-file> blocks and separate them from plain text
  const attachments = [];
  const textOnly = content.replace(
    /<attached-file\s+name="([^"]*)"\s+size="([^"]*)">([\s\S]*?)<\/attached-file>/g,
    (_match, name, size, fileContent) => {
      attachments.push({ name, size: parseInt(size, 10) || 0, content: fileContent.trim() });
      return '';
    }
  ).trim();

  let innerHtml = '';
  if (attachments.length > 0) {
    innerHtml += '<div class="msg-attachments">';
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i];
      const sizeLabel = formatFileSize(a.size);
      const ext = a.name.includes('.') ? a.name.split('.').pop().toLowerCase() : '';
      // Store content in a data attribute (base64-encoded to avoid HTML issues)
      const encodedContent = btoa(unescape(encodeURIComponent(a.content)));
      innerHtml += `
        <div class="msg-attachment-card" data-file-index="${i}" data-file-name="${escapeHtml(a.name)}" data-file-content="${encodedContent}">
          <span class="material-symbols-rounded msg-attachment-icon">${fileIconForExt(ext)}</span>
          <div class="msg-attachment-info">
            <span class="msg-attachment-name">${escapeHtml(a.name)}</span>
            <span class="msg-attachment-size">${sizeLabel}</span>
          </div>
          <div class="msg-attachment-actions">
            <button type="button" class="msg-attachment-btn msg-attachment-view" title="View">` + //No I18N
              `<span class="material-symbols-rounded">visibility</span>
            </button>
            <button type="button" class="msg-attachment-btn msg-attachment-download" title="Download">` + //No I18N
              `<span class="material-symbols-rounded">download</span>
            </button>
          </div>
        </div>`;
    }
    innerHtml += '</div>';
  }
  if (textOnly) {
    innerHtml += escapeHtml(textOnly);
  }

  return `
    <div class="message-item user">
      <div class="message-avatar">${avatarHtml}</div>
      <div class="message-content">${innerHtml}</div>
    </div>`;
}

function fileIconForExt(ext) {
  const codeExts = new Set(['js','ts','go','py','c','cpp','h','m','swift','cs','sh','bat','ps1','html','css','sql']); //No I18N
  const dataExts = new Set(['json','yaml','yml','xml','csv','toml','ini','conf','cfg']); //No I18N
  if (codeExts.has(ext)) return 'code'; //No I18N
  if (dataExts.has(ext)) return 'data_object'; //No I18N
  if (ext === 'md') return 'description'; //No I18N
  if (ext === 'log') return 'receipt_long'; //No I18N
  if (ext === 'diff' || ext === 'patch') return 'difference'; //No I18N
  return 'description'; //No I18N
}

export function renderAssistantMessage(content, toolCalls, renderedHtml) {
  let html = '<div class="message-item assistant">';
  html += '<div class="message-avatar"><span class="material-symbols-rounded">auto_awesome</span></div>';
  html += '<div class="message-content">';

  if (renderedHtml) {
    html += renderedHtml;
    html += '</div></div>';
    return html;
  }

  if (toolCalls?.length > 0) html += renderToolGroupStatic(toolCalls);
  if (content)               html += renderMarkdown(content);

  html += '</div></div>';
  return html;
}

// ── Usage bar ─────────────────────────────────────────────────

export function appendUsageBar(contentEl, thisMsg, session) {
  if (!thisMsg) return;

  const parts = [`${thisMsg.requests} request${thisMsg.requests !== 1 ? 's' : ''}`]; //No I18N
  if (thisMsg.toolCalls > 0) {
    parts.push(`${thisMsg.toolCalls} tool call${thisMsg.toolCalls !== 1 ? 's' : ''}`);
  }

  const sessionHtml = session
    ? ` \u00b7 Session total: ${session.requests} request${session.requests !== 1 ? 's' : ''}` //No I18N
    : '';

  const bar = document.createElement('div');
  bar.className = 'usage-bar';
  bar.innerHTML = `<span class="material-symbols-rounded usage-icon">token</span> ${parts.join(' \u00b7 ')}${sessionHtml}`; //No I18N
  contentEl.appendChild(bar);
}

// ── Code copy buttons ─────────────────────────────────────────

export function bindCodeCopyButtons(chatContainer) {
  chatContainer.querySelectorAll('.copy-code-btn').forEach((btn) => { //No I18N
    btn.addEventListener('click', async () => {
      const encoded = btn.dataset.code;
      if (!encoded) return;
      try {
        await navigator.clipboard.writeText(decodeURIComponent(encoded));
        const icon = btn.querySelector('.material-symbols-rounded'); //No I18N
        icon.textContent = 'check'; //No I18N
        btn.classList.add('copied'); //No I18N
        setTimeout(() => {
          icon.textContent = 'content_copy'; //No I18N
          btn.classList.remove('copied'); //No I18N
        }, 2000);
      } catch (_e) { /* ignore */ }
    });
  });
}

// ── Attachment view / download buttons ────────────────────────

export function bindAttachmentActions(chatContainer) {
  chatContainer.querySelectorAll('.msg-attachment-card').forEach((card) => { //No I18N
    const fileName = card.dataset.fileName;
    const encoded  = card.dataset.fileContent;
    if (!encoded) return;

    const decodeContent = () => decodeURIComponent(escape(atob(encoded)));

    card.querySelector('.msg-attachment-view')?.addEventListener('click', (e) => { //No I18N
      e.stopPropagation();
      const content = decodeContent();
      // Open in a new window as preformatted text
      const win = window.open('', '_blank'); //No I18N
      if (win) {
        win.document.title = fileName;
        const pre = win.document.createElement('pre');
        pre.style.cssText = 'margin:16px;white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:13px;'; //No I18N
        pre.textContent = content;
        win.document.body.style.cssText = 'margin:0;background:#1e1e2e;color:#cdd6f4;'; //No I18N
        win.document.body.appendChild(pre);
      }
    });

    card.querySelector('.msg-attachment-download')?.addEventListener('click', (e) => { //No I18N
      e.stopPropagation();
      const content = decodeContent();
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); //No I18N
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });
}

// ── Shared DOM helpers (used by chat-standalone + chat-bridge) ─

export function ensureMessagesListExists(chatContainer) {
  if (chatContainer.classList.contains('is-empty')) {
    chatContainer.className = 'chat-container';
    chatContainer.innerHTML = '<div class="messages-list"></div>';
  }
}

export function appendUserMessageToDOM(chatContainer, content) {
  const listEl = chatContainer.querySelector('.messages-list'); //No I18N
  listEl.insertAdjacentHTML('beforeend', renderUserMessage(content)); //No I18N
  bindAttachmentActions(chatContainer);
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
}

// ── Private helpers ───────────────────────────────────────────

function renderEmptyState(chatContainer, onSuggestionClick, chatInput) {
  const name = app.user?.login || 'there'; //No I18N
  const isTestcaseAgent = app.selectedAgent === 'uems-agent-testcase-generator';

  if (isTestcaseAgent) {
    // Render the structured wizard form for test case inputs
    const inputEl = chatInput || document.getElementById('chat-input');
    renderTestcaseWizard(chatContainer, name, inputEl);
    return;
  }

  chatContainer.className = 'chat-container is-empty';
  const chipsHtml = SUGGESTION_PROMPTS
    .map((s) => `<button class="suggestion-chip" data-prompt="${escapeHtml(s.prompt)}"><span class="material-symbols-rounded suggestion-icon">${s.icon}</span><span class="suggestion-text">${escapeHtml(s.prompt)}</span></button>`) //No I18N
    .join('');

  chatContainer.innerHTML = `
    <div class="greeting-container">
      <h1 class="greeting-text">Hello, ${escapeHtml(name)}. How can I help you today?</h1>
      <div class="suggestions-container">${chipsHtml}</div>
    </div>`;

  chatContainer.querySelectorAll('.suggestion-chip').forEach((btn) => { //No I18N
    btn.addEventListener('click', () => onSuggestionClick(btn.dataset.prompt));
  });
}

function scrollToBottom(chatContainer) {
  chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
}
