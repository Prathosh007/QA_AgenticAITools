const db = require('better-sqlite3')('./testcases.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
const r = db.prepare('DELETE FROM goat_payloads WHERE tc_id IS NULL').run();
console.log('Deleted null rows:', r.changes);
db.close();
