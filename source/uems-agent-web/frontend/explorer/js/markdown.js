// ── Markdown renderer setup ───────────────────────────────────
// Configures marked.js with a custom code block renderer that
// injects copy buttons and syntax highlighting.

import { escapeHtmlForCode, escapeHtml } from './utils.js';

export function setupMarked() {
  marked.use({
    breaks: true,
    renderer: {
      code(text, lang) {
        const safeText = text || '';
        if (!safeText.trim()) { return ''; }

        // marked passes HTML-escaped text — unescape before highlighting
        const unescaped = safeText
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        const language = (lang || 'plaintext').trim(); //No I18N
        const highlighted = hljs.getLanguage(language)
          ? hljs.highlight(unescaped, { language }).value
          : escapeHtmlForCode(unescaped);

        const encodedRaw  = encodeURIComponent(unescaped);
        const copyBtn = `<button class="copy-code-btn" data-code="${encodedRaw}" title="Copy code"><span class="material-symbols-rounded">content_copy</span></button>`; //No I18N
        return `<div class="code-block-wrapper">${copyBtn}<pre><code class="hljs language-${escapeHtmlForCode(language)}">${highlighted}</code></pre></div>`; //No I18N
      }
    }
  });
}
