// ── Follow-up suggestion chips ────────────────────────────────
// Shows contextual follow-up prompts below each assistant reply.
// Uses an LLM call for quality suggestions, falling back to
// simple regex heuristics while the async call is in-flight.

import { app }          from './state.js';
import { store }        from './store.js';
import { escapeHtml }   from './utils.js';

// ── Seed prompts shown on empty chat ─────────────────────────

export const SUGGESTION_PROMPTS = [
  { icon: 'search',        prompt: 'Search for networking related wrappers in UEMS repos' }, //No I18N
  { icon: 'account_tree',  prompt: 'Show the dependency graph for uems-mac-agent-setup' }, //No I18N
  { icon: 'list_alt',      prompt: 'List all components in the agent-utils Mac Repository' }, //No I18N
  { icon: 'bug_report',    prompt: 'Trace the workflow and analyze logs for 403 errors' }, //No I18N
];

// ── Testcase Generator agent prompts ─────────────────────────

export const TESTCASE_PROMPTS = [
  { icon: 'checklist',     prompt: 'Generate test cases for Agent Installation functionality' }, //No I18N
  { icon: 'difference',    prompt: 'Generate diff comparison test cases between feature_win_agent_26.05 and main' }, //No I18N
  { icon: 'sync',          prompt: 'Reconvert all GOAT JSON for AgentInstallation (re-read GOAT_Operations_Context.md)' }, //No I18N
  { icon: 'data_object',   prompt: 'Convert test cases to GOAT JSON for AgentInstallation' }, //No I18N
];

// ── Public: append suggestions after a response ───────────────

export function appendFollowUpSuggestions(contentEl, responseText, convId) {
  if (!responseText || responseText.length < 30) return;

  const saveRenderedHtml = () => {
    if (!convId) return;
    const conv = store.get(convId);
    if (!conv?.messages.length) return;
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg.role === 'assistant') { //No I18N
      lastMsg.renderedHtml = contentEl.innerHTML;
      store.save();
    }
  };

  const container = document.createElement('div');
  container.className = 'followup-suggestions';
  contentEl.appendChild(container);

  renderFollowUpChips(container, generateFollowUpsRegex(responseText));
  saveRenderedHtml();

  generateFollowUpsLLM(responseText)
    .then((llmSuggestions) => {
      if (llmSuggestions?.length > 0) {
        container.innerHTML = '';
        renderFollowUpChips(container, llmSuggestions);
        saveRenderedHtml();
      }
    })
    .catch(() => { /* keep regex suggestions */ });
}

export function renderFollowUpChips(container, suggestions) {
  container.innerHTML = suggestions
    .map((s) => `<button class="followup-chip" data-prompt="${escapeHtml(s)}"><span class="material-symbols-rounded followup-icon">arrow_forward</span><span>${escapeHtml(s)}</span></button>`) //No I18N
    .join('');
  bindFollowUpChipsIn(container);
}

export function bindFollowUpChips(chatContainer) {
  chatContainer.querySelectorAll('.followup-suggestions').forEach((c) => bindFollowUpChipsIn(c)); //No I18N
}

// ── Private helpers ───────────────────────────────────────────

function bindFollowUpChipsIn(container) {
  container.querySelectorAll('.followup-chip').forEach((btn) => { //No I18N
    btn.addEventListener('click', () => {
      const chatInput = document.getElementById('chat-input');
      chatInput.value = btn.dataset.prompt;
      chatInput.focus();
      document.querySelectorAll('.followup-suggestions').forEach((el) => el.remove()); //No I18N
      // Dispatch so main.js can route to the correct send function
      window.dispatchEvent(new CustomEvent('chat:send-prompt')); //No I18N
    });
  });
}

/** LLM-powered follow-up suggestions (async). */
async function generateFollowUpsLLM(responseText) {
  const controller = new AbortController();
  const timeoutMs  = app.llmProvider === 'ollama' ? 30000 : 10000; //No I18N
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (app.bridgeMode) {
      const resp = await fetch('/api/suggest', { //No I18N
        method: 'POST', //No I18N
        headers: { 'Content-Type': 'application/json' }, //No I18N
        body: JSON.stringify({ text: responseText.slice(0, 2000) }),
        signal: controller.signal,
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.suggestions || [];
    } else {
      const resp = await fetch('/copilot/chat/completions', { //No I18N
        method: 'POST', //No I18N
        headers: {
          'Content-Type': 'application/json', //No I18N
          'Editor-Version': app.config.editorVersion, //No I18N
          'Editor-Plugin-Version': app.config.pluginVersion, //No I18N
        },
        credentials: 'include', //No I18N
        body: JSON.stringify({
          model: app.config.suggestModel,
          messages: [{
            role: 'user', //No I18N
            content: `Based on this assistant response, suggest exactly 3 short follow-up questions the user might want to ask next. The questions should be specific and relevant to the UEMS native agent codebase context. Return ONLY a JSON array of 3 strings, no other text.\n\nResponse:\n${responseText.slice(0, 2000)}`,
          }],
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || '';
      const match = content.match(/\[\s*"[\s\S]*?"\s*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string').slice(0, 3);
      }
      return [];
    }
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Regex-based fallback suggestions derived from response text. */
function generateFollowUpsRegex(text) {
  const lower = text.toLowerCase();
  const suggestions = [];

  const componentMatch = text.match(/(?:component|module|wrapper|library)[:\s]+[`"']?([\w-]+)/i);
  const repoMatch      = text.match(/(?:repo(?:sitory)?|project)[:\s]+[`"']?([\w-]+)/i);
  const productMatch   = text.match(/(?:product)[:\s]+[`"']?([\w-]+)/i);

  if (componentMatch) {
    suggestions.push(`Show the dependency graph for ${componentMatch[1]}`);
    suggestions.push(`Search for usages of ${componentMatch[1]} across repos`);
  }
  if (repoMatch && suggestions.length < 3)    suggestions.push(`List all components in ${repoMatch[1]}`);
  if (productMatch && suggestions.length < 3) suggestions.push(`List all components in the ${productMatch[1]} product`);

  if (lower.includes('dependency') && lower.includes('graph') && suggestions.length < 3) suggestions.push('Show the reverse dependency graph');
  if (lower.includes('wrapper') && suggestions.length < 3)                               suggestions.push('Find similar wrappers in other repos');
  if ((lower.includes('build') || lower.includes('tag')) && suggestions.length < 3)      suggestions.push('Validate the latest build tag');
  if (lower.includes('component') && suggestions.length < 3)                             suggestions.push('Search for related wrappers');

  if (suggestions.length < 2)                                  suggestions.push('Tell me more about this');
  if (suggestions.length < 3 && lower.includes('error'))       suggestions.push('How can I fix this?');

  return suggestions.slice(0, 3);
}
