// ── Conversation store (localStorage) ───────────────────────
// All persistence lives here.  Callers import `store` and call
// its methods; nothing outside this file touches localStorage
// for conversations.

const STORAGE_KEY = 'uems_conversations'; //No I18N

export const store = {
  conversations: [],

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      this.conversations = data ? JSON.parse(data) : [];
    } catch (_e) {
      this.conversations = [];
    }
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conversations));
  },

  create() {
    const conv = {
      id: crypto.randomUUID(),
      title: 'New Chat', //No I18N
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.conversations.unshift(conv);
    this.save();
    return conv;
  },

  get(id) {
    return this.conversations.find((c) => c.id === id) || null;
  },

  update(id, updates) {
    const conv = this.get(id);
    if (!conv) { return; }
    Object.assign(conv, updates, { updatedAt: Date.now() });
    this.save();
  },

  addMessage(id, msg) {
    const conv = this.get(id);
    if (!conv) { return; }
    conv.messages.push(msg);
    conv.updatedAt = Date.now();
    this.save();
  },

  rename(id, title) {
    this.update(id, { title });
  },

  remove(id) {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    this.save();
  },

  /** Group conversations by recency for sidebar date headers. */
  grouped() {
    const now = new Date();
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const weekAgo   = today - 7 * 86400000;
    const groups    = { Today: [], Yesterday: [], 'Previous 7 Days': [], Older: [] }; //No I18N

    const sorted = [...this.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    for (const conv of sorted) {
      const t = conv.updatedAt;
      if (t >= today) { groups.Today.push(conv); }
      else if (t >= yesterday) { groups.Yesterday.push(conv); }
      else if (t >= weekAgo) { groups['Previous 7 Days'].push(conv); } //No I18N
      else { groups.Older.push(conv); }
    }
    return groups;
  }
};
