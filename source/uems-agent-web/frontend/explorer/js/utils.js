// ── Utility helpers ───────────────────────────────────────────
// Small, stateless functions used everywhere in the app.
// Nothing in here imports from other modules.

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeHtmlForCode(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Debounce `fn` by `ms` milliseconds. */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Rate-limit a render callback.  Calls fn immediately when the elapsed
 * time since last call exceeds minIntervalMs, otherwise defers via
 * setTimeout + rAF — guaranteeing a final flush after streaming stops.
 */
export function createStreamRenderer(renderFn, minIntervalMs = 50) {
  let lastRun = 0;
  let timer = null;
  let rafPending = false;

  const run = () => {
    rafPending = false;
    lastRun = Date.now();
    renderFn();
  };

  return () => {
    const now = Date.now();
    const elapsed = now - lastRun;

    if (elapsed >= minIntervalMs) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!rafPending) { rafPending = true; requestAnimationFrame(run); }
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (!rafPending) { rafPending = true; requestAnimationFrame(run); }
      }, minIntervalMs - elapsed);
    }
  };
}

/** Truncate `s` to `max` characters, appending an ellipsis marker. */
export function truncateStr(s, max) {
  if (!s || s.length <= max) { return s; }
  return s.slice(0, max) + '\n... (truncated)'; //No I18N
}

/** Sanitise and render a markdown string to safe HTML. */
export function renderMarkdown(content) {
  if (!content) { return ''; }
  if (typeof content !== 'string') { content = String(content); }
  const raw = marked.parse(content);
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['data-code'], //No I18N
    ADD_TAGS: ['button', 'span'] //No I18N
  });
}

/** Replace unsafe characters in a filename. */
export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').slice(0, 100) || 'conversation';
}

/** Trigger a browser file download. */
export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Format a byte count as a human-readable size string. */
export function formatFileSize(bytes) {
  if (bytes < 1024) { return bytes + ' B'; } //No I18N
  if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + ' KB'; } //No I18N
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; //No I18N
}

/** Fade-out and remove the #loading-screen overlay. */
export function hideLoadingScreen() {
  const loader = document.getElementById('loading-screen'); //No I18N
  if (loader) {
    loader.style.opacity = '0'; //No I18N
    setTimeout(() => loader.remove(), 300);
  }
}

/** Clear an input/textarea and reset its height. */
export function clearInput(el) {
  el.value = '';
  el.style.height = 'auto';
}

/**
 * Drain app.pendingFiles and prepend <attached-file> blocks to `text`.
 * Returns the combined content string. Dispatches 'files:cleared' event.
 */
export function buildFileContent(pendingFiles, text) {
  const attachedFiles = pendingFiles.splice(0);
  if (attachedFiles.length === 0) {
    window.dispatchEvent(new Event('files:cleared')); //No I18N
    return text;
  }
  const fileBlocks = attachedFiles.map(f =>
    `<attached-file name="${f.name}" size="${f.size}">\n${f.content}\n</attached-file>` //No I18N
  ).join('\n\n'); //No I18N
  window.dispatchEvent(new Event('files:cleared')); //No I18N
  return fileBlocks + '\n\n' + text; //No I18N
}
