// ── Token estimation + context compaction helpers ─────────────
// Shared between sendMessage (standalone) only.
// Bridge mode runs the tool loop server-side, so it never needs these.

/**
 * Estimate the token count for an array of API messages.
 * Uses the GPT/Claude heuristic: ~1 token per 4 characters, plus 4
 * tokens of overhead per message.  Conservative on purpose — cheaper
 * than running a tokenizer.
 */
export function estimateTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += 4; // message overhead
    if (msg.content) total += Math.ceil(msg.content.length / 4);
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += 4;
        if (tc.function?.name)      total += Math.ceil(tc.function.name.length / 4);
        if (tc.function?.arguments) total += Math.ceil(tc.function.arguments.length / 4);
      }
    }
  }
  return total;
}

export function isContextOverflow(msg) {
  return msg.includes('model_max_prompt_tokens_exceeded') || //No I18N
    msg.includes('context_length_exceeded') || //No I18N
    msg.includes('maximum context length'); //No I18N
}

const PINNED_TOOL_NAMES = new Set([]);

/**
 * Return a new messages array with the oldest un-pinned tool call pair
 * removed, or null if nothing is removable.
 */
export function trimOldestToolCall(messages) {
  const idx = messages.findIndex(
    (m) => m.role === 'assistant' && m.tool_calls?.length > 0 && //No I18N
      m.tool_calls.some((tc) => !PINNED_TOOL_NAMES.has(tc.function?.name))
  );
  if (idx === -1) return null;

  const callIds = new Set(messages[idx].tool_calls.map((tc) => tc.id));
  return messages.filter((m, i) => {
    if (i === idx) return false;
    if (m.role === 'tool' && callIds.has(m.tool_call_id)) return false; //No I18N
    return true;
  });
}

/**
 * Build the API message array from the stored conversation.
 * Only user + assistant text messages are included; old tool call
 * history is omitted to keep context manageable.
 */
export function buildAPIMessages(conv) {
  return conv.messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.tool_calls) //No I18N
    .map((m) => ({ role: m.role, content: m.content || '' }));
}
