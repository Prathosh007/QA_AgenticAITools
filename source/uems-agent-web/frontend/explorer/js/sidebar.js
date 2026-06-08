// ── Sidebar rendering + conversation management UI ────────────
// Renders the conversation list, context menu, rename dialog
// and delete confirmation.  Calls back into store + app
// via the injected callbacks to stay decoupled.

import { store }          from './store.js';
import { app }            from './state.js';
import { escapeHtml }     from './utils.js';

// ── Sidebar render ────────────────────────────────────────────

export function renderSidebar(sidebarNav, onSelect, onRename, onDelete) {
  const groups = store.grouped();
  let html = '';

  for (const [label, convs] of Object.entries(groups)) {
    if (convs.length === 0) continue;
    html += `<div class="sidebar-section-title">${label}</div>`;
    for (const conv of convs) {
      const active = conv.id === app.currentConvId ? 'active' : ''; //No I18N
      html += `<div class="conversation-item" data-id="${conv.id}"><button class="conversation-link ${active}" data-id="${conv.id}"><span>${escapeHtml(conv.title)}</span></button><button class="conversation-menu-btn" data-id="${conv.id}" title="More options"><span class="material-symbols-rounded">more_vert</span></button></div>`; //No I18N
    }
  }

  if (!html) {
    html = '<div style="padding:20px 12px; color:var(--text-secondary); font-size:13px;">No conversations yet</div>';
  }

  sidebarNav.innerHTML = html;

  sidebarNav.querySelectorAll('.conversation-link').forEach((el) => { //No I18N
    el.addEventListener('click', () => onSelect(el.dataset.id));
  });
  sidebarNav.querySelectorAll('.conversation-menu-btn').forEach((el) => { //No I18N
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showConvContextMenu(e, el.dataset.id, sidebarNav, onRename, onDelete);
    });
  });
}

// ── Conversation context menu ─────────────────────────────────

function showConvContextMenu(e, convId, sidebarNav, onRename, onDelete) {
  closeAnyContextMenu();

  const menu = document.createElement('div');
  menu.className = 'conv-context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top  = e.clientY + 'px';
  menu.innerHTML = `<button class="popover-menu-item" data-action="rename"><span class="material-symbols-rounded">edit</span><span>Rename</span></button><div class="popover-menu-divider"></div><button class="popover-menu-item delete" data-action="delete"><span class="material-symbols-rounded">delete</span><span>Delete</span></button>`; //No I18N

  menu.addEventListener('click', (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset.action; //No I18N
    if (action === 'rename') showRenameDialog(convId, sidebarNav, onRename); //No I18N
    if (action === 'delete') onDelete(convId); //No I18N
    closeAnyContextMenu();
  });

  document.body.appendChild(menu);
}

export function closeAnyContextMenu() {
  document.querySelectorAll('.conv-context-menu').forEach((m) => m.remove()); //No I18N
}

// ── Rename dialog ─────────────────────────────────────────────

function showRenameDialog(convId, sidebarNav, onRename) {
  const conv = store.get(convId);
  if (!conv) return;

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `<div class="dialog-box"><h3>Rename Conversation</h3><input class="dialog-input" value="${escapeHtml(conv.title)}" autofocus><div class="dialog-actions"><button class="btn-cancel">Cancel</button><button class="btn-save">Save</button></div></div>`; //No I18N

  const close = () => overlay.remove();
  const save  = () => {
    const val = overlay.querySelector('.dialog-input').value.trim(); //No I18N
    if (val) onRename(convId, val);
    close();
  };

  overlay.querySelector('.btn-cancel').addEventListener('click', close); //No I18N
  overlay.querySelector('.btn-save').addEventListener('click', save); //No I18N
  overlay.querySelector('.dialog-input').addEventListener('keydown', (e) => { //No I18N
    if (e.key === 'Enter')  save();
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
  overlay.querySelector('.dialog-input').select(); //No I18N
}
