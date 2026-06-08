// ── Conversation export (Markdown + JSON) ─────────────────────

import { store }               from './store.js';
import { app }                 from './state.js';
import { sanitizeFilename, downloadFile } from './utils.js';

export function exportAsMarkdown() {
  const conv = store.get(app.currentConvId);
  if (!conv || conv.messages.length === 0) { return; }

  let md = `# ${conv.title}\n\n`;
  md += `*Exported: ${new Date().toISOString()}*\n\n---\n\n`;

  for (const msg of conv.messages) {
    if (msg.role === 'user') {
      md += `## User\n\n${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      md += '## Assistant\n\n'; //No I18N
      for (const tc of msg.toolCalls || []) {
        md += `<details>\n<summary>Tool: ${tc.name}</summary>\n\n`;
        md += '**Parameters:**\n```json\n' + tc.arguments + '\n```\n\n'; //No I18N
        if (tc.result) { md += '**Result:**\n```\n' + tc.result + '\n```\n'; } //No I18N
        md += '</details>\n\n'; //No I18N
      }
      if (msg.content) { md += msg.content + '\n\n'; } //No I18N
    }
    md += '---\n\n'; //No I18N
  }

  downloadFile(`${sanitizeFilename(conv.title)}.md`, md, 'text/markdown'); //No I18N
}

export function exportAsJSON() {
  const conv = store.get(app.currentConvId);
  if (!conv || conv.messages.length === 0) { return; }

  const data = {
    title:     conv.title,
    id:        conv.id,
    createdAt: new Date(conv.createdAt).toISOString(),
    updatedAt: new Date(conv.updatedAt).toISOString(),
    exportedAt: new Date().toISOString(),
    messages:  conv.messages
  };

  downloadFile(`${sanitizeFilename(conv.title)}.json`, JSON.stringify(data, null, 2), 'application/json'); //No I18N
}
