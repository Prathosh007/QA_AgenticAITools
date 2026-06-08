const http = require("http");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "testcases.db");

// ── Schema ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS test_cases (
  id                TEXT PRIMARY KEY,
  functionality     TEXT NOT NULL,
  sub_functionality TEXT,
  title             TEXT,
  category          TEXT,
  priority          TEXT,
  status            TEXT DEFAULT 'active',
  version           INTEGER DEFAULT 1,
  platform          TEXT,
  steps             TEXT,
  expected_result   TEXT,
  support_files     TEXT,
  issue_id          TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS goat_payloads (
  tc_id         TEXT PRIMARY KEY,
  functionality TEXT,
  component     TEXT,
  payload       TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS gap_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tc_id        TEXT,
  functionality TEXT,
  missing_util TEXT,
  step_text    TEXT,
  suggestion   TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS execution_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tc_id         TEXT,
  run_at        TEXT DEFAULT (datetime('now')),
  status        TEXT,
  actual_output TEXT,
  notes         TEXT
);
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

function parseJSON(s) { try { return JSON.parse(s); } catch { return []; } }
function toJSON(v)    { return v == null ? "[]" : JSON.stringify(v); }

// ── Route handlers ────────────────────────────────────────────────────────────
const routes = {

  // Health
  "GET /health": (_req, res) => send(res, 200, { status: "ok" }),

  // Config
  "GET /config": (_req, res) => {
    const cfgPath = path.join(__dirname, "..", "..", "testcases", "db-config.json");
    let cfg = {};
    if (fs.existsSync(cfgPath)) {
      try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch {}
    }
    send(res, 200, cfg);
  },

  // ── Test Cases ──────────────────────────────────────────────────────────────
  "GET /testcases": (req, res) => {
    const q = new URL(req.url, "http://x").searchParams;
    let sql = `SELECT * FROM test_cases WHERE 1=1`;
    const args = [];
    if (q.get("functionality")) { sql += ` AND functionality=?`; args.push(q.get("functionality")); }
    if (q.get("status"))        { sql += ` AND status=?`;        args.push(q.get("status")); }
    sql += ` ORDER BY id`;
    const rows = db.prepare(sql).all(...args).map(r => ({
      ...r, steps: parseJSON(r.steps), support_files: parseJSON(r.support_files)
    }));
    send(res, 200, rows);
  },

  "POST /testcases": async (req, res) => {
    const tc = await readBody(req);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO test_cases
        (id,functionality,sub_functionality,title,category,priority,status,version,platform,steps,expected_result,support_files,issue_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        functionality=excluded.functionality, sub_functionality=excluded.sub_functionality,
        title=excluded.title, category=excluded.category, priority=excluded.priority,
        status=excluded.status, version=test_cases.version+1, platform=excluded.platform,
        steps=excluded.steps, expected_result=excluded.expected_result,
        support_files=excluded.support_files, issue_id=excluded.issue_id, updated_at=excluded.updated_at
    `).run(
      tc.id, tc.functionality, tc.sub_functionality, tc.title, tc.category, tc.priority,
      tc.status || "active", tc.version || 1, tc.platform,
      toJSON(tc.steps), tc.expected_result, toJSON(tc.support_files), tc.issue_id, now, now
    );
    send(res, 201, { ...tc, created_at: now, updated_at: now });
  },

  "GET /testcases/:id": (req, res, params) => {
    const row = db.prepare("SELECT * FROM test_cases WHERE id=?").get(params.id);
    if (!row) return send(res, 404, { error: "not found" });
    send(res, 200, { ...row, steps: parseJSON(row.steps), support_files: parseJSON(row.support_files) });
  },

  "PUT /testcases/:id": async (req, res, params) => {
    const tc = await readBody(req);
    const now = new Date().toISOString();
    const info = db.prepare(`
      UPDATE test_cases SET
        functionality=?,sub_functionality=?,title=?,category=?,priority=?,status=?,
        version=version+1,platform=?,steps=?,expected_result=?,support_files=?,issue_id=?,updated_at=?
      WHERE id=?
    `).run(
      tc.functionality, tc.sub_functionality, tc.title, tc.category, tc.priority,
      tc.status, tc.platform, toJSON(tc.steps), tc.expected_result, toJSON(tc.support_files),
      tc.issue_id, now, params.id
    );
    if (info.changes === 0) return send(res, 404, { error: "not found" });
    send(res, 200, { updated: params.id });
  },

  "DELETE /testcases/:id": (req, res, params) => {
    const now = new Date().toISOString();
    const info = db.prepare("UPDATE test_cases SET status='deprecated',updated_at=? WHERE id=?")
      .run(now, params.id);
    if (info.changes === 0) return send(res, 404, { error: "not found" });
    res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
    res.end();
  },

  // Bulk-delete ALL test cases + payloads + gaps for a functionality (hard delete)
  "DELETE /functionality/:name": (_req, res, params) => {
    const fn = params.name;
    const tcDel  = db.prepare("DELETE FROM test_cases    WHERE functionality=?").run(fn);
    const payDel = db.prepare("DELETE FROM goat_payloads WHERE functionality=?").run(fn);
    const gapDel = db.prepare("DELETE FROM gap_reports   WHERE functionality=?").run(fn);
    send(res, 200, { functionality: fn, deleted_tcs: tcDel.changes, deleted_payloads: payDel.changes, deleted_gaps: gapDel.changes });
  },

  // Delete only payloads for a functionality (keeps TCs + gaps; forces re-conversion)
  "DELETE /payloads/functionality/:name": (_req, res, params) => {
    const fn = params.name;
    const info = db.prepare("DELETE FROM goat_payloads WHERE functionality=?").run(fn);
    send(res, 200, { functionality: fn, deleted_payloads: info.changes });
  },

  // Delete only gap reports for a functionality (allows gap re-population after GOAT update)
  "DELETE /gaps/functionality/:name": (_req, res, params) => {
    const fn = params.name;
    const info = db.prepare("DELETE FROM gap_reports WHERE functionality=?").run(fn);
    send(res, 200, { functionality: fn, deleted_gaps: info.changes });
  },

  // Delete stale gap records — gaps for TCs that now have a GOAT payload (already converted)
  "DELETE /gaps/stale": (_req, res) => {
    const info = db.prepare(
      "DELETE FROM gap_reports WHERE tc_id IN (SELECT tc_id FROM goat_payloads WHERE tc_id IS NOT NULL)"
    ).run();
    send(res, 200, { deleted_stale: info.changes });
  },

  // ── Payloads ────────────────────────────────────────────────────────────────
  "GET /payloads": (req, res) => {
    const q = new URL(req.url, "http://x").searchParams;
    let sql = "SELECT * FROM goat_payloads WHERE tc_id IS NOT NULL AND tc_id != ''";
    const args = [];
    if (q.get("functionality")) { sql += " AND functionality=?"; args.push(q.get("functionality")); }
    sql += " ORDER BY tc_id";
    send(res, 200, db.prepare(sql).all(...args));
  },

  "POST /payloads": async (req, res) => {
    const p = await readBody(req);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO goat_payloads (tc_id,functionality,component,payload,created_at,updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(tc_id) DO UPDATE SET
        functionality=excluded.functionality, component=excluded.component,
        payload=excluded.payload, updated_at=excluded.updated_at
    `).run(p.tc_id, p.functionality, p.component, p.payload, now, now);
    send(res, 201, { ...p, created_at: now, updated_at: now });
  },

  "GET /payloads/:tcId": (req, res, params) => {
    const row = db.prepare("SELECT * FROM goat_payloads WHERE tc_id=?").get(params.tcId);
    if (!row) return send(res, 404, { error: "not found" });
    send(res, 200, row);
  },

  "DELETE /payloads/nulls": (_req, res) => {
    const info = db.prepare("DELETE FROM goat_payloads WHERE tc_id IS NULL").run();
    send(res, 200, { deleted: info.changes });
  },

  "PUT /payloads/:tcId": async (req, res, params) => {
    const p = await readBody(req);
    const now = new Date().toISOString();
    const info = db.prepare("UPDATE goat_payloads SET component=?,payload=?,updated_at=? WHERE tc_id=?")
      .run(p.component, p.payload, now, params.tcId);
    if (info.changes === 0) return send(res, 404, { error: "not found" });
    send(res, 200, { updated: params.tcId });
  },

  "DELETE /payloads/:tcId": (_req, res, params) => {
    const info = db.prepare("DELETE FROM goat_payloads WHERE tc_id=?").run(params.tcId);
    if (info.changes === 0) return send(res, 404, { error: "not found" });
    send(res, 200, { deleted: params.tcId });
  },

  // ── Gaps ────────────────────────────────────────────────────────────────────
  "GET /gaps": (req, res) => {
    const q = new URL(req.url, "http://x").searchParams;
    let sql = "SELECT * FROM gap_reports WHERE 1=1";
    const args = [];
    if (q.get("functionality")) { sql += " AND functionality=?"; args.push(q.get("functionality")); }
    sql += " ORDER BY created_at DESC";
    send(res, 200, db.prepare(sql).all(...args));
  },

  "POST /gaps": async (req, res) => {
    const g = await readBody(req);
    const info = db.prepare(
      "INSERT INTO gap_reports (tc_id,functionality,missing_util,step_text,suggestion) VALUES (?,?,?,?,?)"
    ).run(g.tc_id, g.functionality, g.missing_util, g.step_text, g.suggestion);
    send(res, 201, { ...g, id: info.lastInsertRowid });
  },

  // ── Results ─────────────────────────────────────────────────────────────────
  "GET /results/:tcId": (req, res, params) => {
    send(res, 200, db.prepare(
      "SELECT * FROM execution_results WHERE tc_id=? ORDER BY run_at DESC"
    ).all(params.tcId));
  },

  "POST /results": async (req, res) => {
    const r = await readBody(req);
    const info = db.prepare(
      "INSERT INTO execution_results (tc_id,status,actual_output,notes) VALUES (?,?,?,?)"
    ).run(r.tc_id, r.status, r.actual_output, r.notes);
    send(res, 201, { ...r, id: info.lastInsertRowid });
  },

  // ── CSV Export ──────────────────────────────────────────────────────────────
  "GET /export/csv": (req, res) => {
    const q   = new URL(req.url, "http://x").searchParams;
    const args = [];
    let sql = "SELECT tc.*, CASE WHEN gp.tc_id IS NOT NULL THEN 'yes' ELSE 'no' END AS goat_converted FROM test_cases tc LEFT JOIN goat_payloads gp ON gp.tc_id = tc.id WHERE 1=1";
    if (q.get("functionality")) { sql += " AND tc.functionality=?"; args.push(q.get("functionality")); }
    if (q.get("status"))        { sql += " AND tc.status=?";         args.push(q.get("status")); }
    sql += " ORDER BY tc.id";
    const rows = db.prepare(sql).all(...args);

    const COLS = ["id","functionality","sub_functionality","title","category","priority","status","version","platform","steps","expected_result","support_files","goat_converted","created_at","updated_at","issue_id"];
    const esc  = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const fmtSteps = v => {
      if (!v) return "";
      try {
        const arr = typeof v === "string" ? JSON.parse(v) : v;
        if (Array.isArray(arr)) return arr.join("\n");
      } catch {}
      return String(v);
    };
    const fmtSupportFiles = v => {
      if (!v) return "";
      try {
        const arr = typeof v === "string" ? JSON.parse(v) : v;
        if (Array.isArray(arr)) return arr.join("\n");
      } catch {}
      return String(v);
    };
    const lines = [COLS.join(",")];
    for (const r of rows) lines.push(COLS.map(c => {
      if (c === "steps") return esc(fmtSteps(r[c]));
      if (c === "support_files") return esc(fmtSupportFiles(r[c]));
      return esc(r[c]);
    }).join(","));
    const csv = lines.join("\r\n");

    const fn = q.get("functionality") ? `${q.get("functionality")}_testcases.csv` : "testcases.csv";
    res.writeHead(200, {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fn}"`,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(csv);
  },

  // ── Viewer HTML ─────────────────────────────────────────────────────────────
  "GET /view": (_req, res) => {
    const viewerPath = path.join(__dirname, "viewer.html");
    if (!fs.existsSync(viewerPath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("viewer.html not found");
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(fs.readFileSync(viewerPath));
  },

  // ── Stats ───────────────────────────────────────────────────────────────────
  "GET /stats": (_req, res) => {
    const total    = db.prepare("SELECT COUNT(*) as n FROM test_cases WHERE status='active'").get().n;
    const converted= db.prepare("SELECT COUNT(*) as n FROM goat_payloads WHERE tc_id IS NOT NULL AND tc_id != ''").get().n;
    const gaps     = db.prepare("SELECT COUNT(*) as n FROM gap_reports").get().n;
    const byFunc   = db.prepare("SELECT functionality, COUNT(*) as n FROM test_cases WHERE status='active' GROUP BY functionality ORDER BY functionality").all();
    const byPrio   = db.prepare("SELECT priority, COUNT(*) as n FROM test_cases WHERE status='active' GROUP BY priority").all();
    const byCat    = db.prepare("SELECT category, COUNT(*) as n FROM test_cases WHERE status='active' GROUP BY category").all();
    send(res, 200, { total, converted, gaps, by_functionality: byFunc, by_priority: byPrio, by_category: byCat });
  },
};

// ── Router ────────────────────────────────────────────────────────────────────
function matchRoute(method, pathname) {
  const candidates = [];
  for (const key of Object.keys(routes)) {
    const [m, pattern] = key.split(" ");
    if (m !== method) continue;
    const patParts = pattern.split("/");
    const urlParts = pathname.split("/");
    if (patParts.length !== urlParts.length) continue;
    const params = {};
    let paramCount = 0;
    const match = patParts.every((p, i) => {
      if (p.startsWith(":")) { params[p.slice(1)] = urlParts[i]; paramCount++; return true; }
      return p === urlParts[i];
    });
    if (match) candidates.push({ handler: routes[key], params, paramCount });
  }
  // Prefer literal (fewer params) over parameterized routes
  candidates.sort((a, b) => a.paramCount - b.paramCount);
  return candidates[0] || null;
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const pathname = new URL(req.url, "http://x").pathname.replace(/\/$/, "") || "/";
  const route = matchRoute(req.method, pathname);

  if (!route) return send(res, 404, { error: `${req.method} ${pathname} not found` });

  try {
    await route.handler(req, res, route.params);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`testcase-db running on http://localhost:${PORT}`);
  console.log(`DB file: ${DB_PATH}`);
});
