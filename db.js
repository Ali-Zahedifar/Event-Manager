const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// Resolve where persistent data lives:
//   1. explicit override via DATA_DIR env
//   2. deployment host mounts the persistent disk at /main -> use /main/eventmanager
//   3. fallback to a local ./data directory (e.g. docker-compose bind mount)
function resolveDataRoot() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  try {
    fs.accessSync('/main', fs.constants.W_OK);
    return '/main/eventmanager';
  } catch {}
  return path.join(__dirname, 'data');
}

const DATA_ROOT = resolveDataRoot();
const DATA_DIR = path.join(DATA_ROOT, 'db');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'events.db');
const LEGACY_DB_PATH = process.env.LEGACY_DB ? path.resolve(process.env.LEGACY_DB) : path.join(__dirname, 'events.db');

// Inspect a SQLite file without creating it.
function inspectDbFile(file) {
  if (!fs.existsSync(file)) return { exists: false, events: 0, flagged: false };
  let conn;
  try {
    conn = new DatabaseSync(file);
    const hasEvents = !!conn.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'events'").get();
    const events = hasEvents ? conn.prepare('SELECT COUNT(*) AS c FROM events').get().c : 0;
    let flagged = false;
    try { flagged = !!conn.prepare("SELECT 1 FROM meta WHERE key = 'legacy_import_v1'").get(); } catch { /* no meta table */ }
    return { exists: true, events, flagged };
  } catch (e) {
    return { exists: true, events: 0, flagged: false, error: e.message };
  } finally {
    try { if (conn) conn.close(); } catch { /* ignore */ }
  }
}

// One-time adoption of a database created by the pre-data/ version of the app.
// Older builds kept events.db next to server.js; newer builds use data/db/events.db.
// We only adopt when the target is empty, and the old file is kept as a backup.
function adoptLegacyDatabase() {
  if (LEGACY_DB_PATH === DB_PATH) return false;
  const target = inspectDbFile(DB_PATH);
  const legacy = inspectDbFile(LEGACY_DB_PATH);
  if (target.flagged || target.events > 0 || legacy.events === 0) return false;

  const backupPath = `${DB_PATH}.pre-legacy-${Date.now()}`;
  let movedTarget = false;
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.renameSync(DB_PATH, backupPath);
      for (const ext of ['-wal', '-shm']) {
        if (fs.existsSync(DB_PATH + ext)) fs.renameSync(DB_PATH + ext, backupPath + ext);
      }
      movedTarget = true;
    }
    const src = new DatabaseSync(LEGACY_DB_PATH);
    try {
      // Fold any pending WAL pages into the main file before copying.
      src.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      src.exec(`VACUUM INTO '${DB_PATH.replace(/'/g, "''")}'`);
    } finally {
      src.close();
    }
    console.log(`[MIGRATE] Imported legacy database ${LEGACY_DB_PATH} -> ${DB_PATH}`);
    if (movedTarget) console.log(`[MIGRATE] Previous empty database kept at ${backupPath}`);
    return true;
  } catch (e) {
    console.error('[MIGRATE] Legacy database import failed:', e.message);
    if (movedTarget && !fs.existsSync(DB_PATH) && fs.existsSync(backupPath)) {
      try { fs.renameSync(backupPath, DB_PATH); } catch { /* ignore */ }
    }
    return false;
  }
}

const LEGACY_ADOPTED = adoptLegacyDatabase();

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT '',
    date          TEXT DEFAULT '',
    location      TEXT DEFAULT '',
    critical_info TEXT DEFAULT '',
    status        TEXT DEFAULT 'upcoming',
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    role       TEXT DEFAULT '',
    id_number  TEXT DEFAULT '',
    phone      TEXT DEFAULT '',
    photo      TEXT DEFAULT '',
    notes      TEXT DEFAULT '',
    section    TEXT DEFAULT '',
    section_head INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'todo',
    importance  TEXT NOT NULL DEFAULT 'medium',
    due_date    TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS task_members (
    task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS sponsors (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id            INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    company             TEXT DEFAULT '',
    email               TEXT DEFAULT '',
    phone               TEXT DEFAULT '',
    contribution_type   TEXT DEFAULT 'money',
    contribution_amount TEXT DEFAULT '',
    description         TEXT DEFAULT '',
    status              TEXT DEFAULT 'confirmed',
    notes               TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS timeline_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    datetime    TEXT DEFAULT '',
    category    TEXT DEFAULT 'milestone',
    done        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    size        INTEGER NOT NULL DEFAULT 0,
    mime        TEXT DEFAULT '',
    stored_path TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'expense',
    title       TEXT NOT NULL,
    amount      REAL NOT NULL DEFAULT 0,
    category    TEXT DEFAULT '',
    date        TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budget_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'expense',
    category    TEXT DEFAULT '',
    amount      REAL NOT NULL DEFAULT 0,
    notes       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS design_locations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    address    TEXT DEFAULT '',
    notes      TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS design_plans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    location_id  INTEGER NOT NULL REFERENCES design_locations(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    scenario     TEXT DEFAULT '',
    description  TEXT DEFAULT '',
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS participants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'person',
    name        TEXT NOT NULL,
    organization TEXT DEFAULT '',
    contact     TEXT DEFAULT '',
    notes       TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS guests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    contact     TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'invited',
    guests_count INTEGER NOT NULL DEFAULT 1,
    notes       TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS speakers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    title      TEXT DEFAULT '',
    organization TEXT DEFAULT '',
    topic      TEXT DEFAULT '',
    contact    TEXT DEFAULT '',
    bio        TEXT DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'invited',
    notes      TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workshops (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    host        TEXT DEFAULT '',
    description TEXT DEFAULT '',
    date        TEXT DEFAULT '',
    time_start  TEXT DEFAULT '',
    time_end    TEXT DEFAULT '',
    location    TEXT DEFAULT '',
    capacity    INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'planned',
    notes       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS adventures (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'activity',
    description TEXT DEFAULT '',
    date        TEXT DEFAULT '',
    time_start  TEXT DEFAULT '',
    time_end    TEXT DEFAULT '',
    location    TEXT DEFAULT '',
    cost        REAL NOT NULL DEFAULT 0,
    capacity    INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'planned',
    notes       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shows (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'live',
    description TEXT DEFAULT '',
    date        TEXT DEFAULT '',
    time_start  TEXT DEFAULT '',
    time_end    TEXT DEFAULT '',
    duration    INTEGER NOT NULL DEFAULT 0,
    location_id INTEGER REFERENCES design_locations(id) ON DELETE SET NULL,
    venue       TEXT DEFAULT '',
    host        TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'planned',
    cost        REAL NOT NULL DEFAULT 0,
    equipment   TEXT DEFAULT '[]',
    notes       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS show_segments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id     INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    name        TEXT NOT NULL,
    duration    INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    date        TEXT DEFAULT '',
    time_start  TEXT DEFAULT '',
    time_end    TEXT DEFAULT '',
    location    TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'planned',
    agenda      TEXT DEFAULT '[]',
    outcome     TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meeting_attendees (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ref_type   TEXT NOT NULL,
    ref_id     INTEGER NOT NULL DEFAULT 0,
    label      TEXT DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'invited'
  );

  CREATE INDEX IF NOT EXISTS idx_members_event   ON members(event_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_event     ON tasks(event_id);
  CREATE INDEX IF NOT EXISTS idx_sponsors_event  ON sponsors(event_id);
  CREATE INDEX IF NOT EXISTS idx_timeline_event  ON timeline_items(event_id);
  CREATE INDEX IF NOT EXISTS idx_files_event     ON files(event_id);
  CREATE INDEX IF NOT EXISTS idx_finances_event  ON transactions(event_id);
  CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
  CREATE INDEX IF NOT EXISTS idx_guests_event    ON guests(event_id);
  CREATE INDEX IF NOT EXISTS idx_speakers_event  ON speakers(event_id);
  CREATE INDEX IF NOT EXISTS idx_workshops_event ON workshops(event_id);
  CREATE INDEX IF NOT EXISTS idx_adventures_event ON adventures(event_id);
  CREATE INDEX IF NOT EXISTS idx_shows_event         ON shows(event_id);
  CREATE INDEX IF NOT EXISTS idx_show_segments_show  ON show_segments(show_id);
  CREATE INDEX IF NOT EXISTS idx_meetings_event      ON meetings(event_id);
  CREATE INDEX IF NOT EXISTS idx_meeting_attendees_event ON meeting_attendees(event_id);

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer',
    permissions   TEXT DEFAULT '[]',
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_access (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, event_id)
  );

  CREATE TABLE IF NOT EXISTS task_assignees (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
  );
`);

// Migrate pre-existing databases that were created before the section columns existed.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
ensureColumn('members', 'section', "TEXT DEFAULT ''");
ensureColumn('members', 'section_head', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('transactions', 'file_name', "TEXT DEFAULT ''");
ensureColumn('transactions', 'file_mime', "TEXT DEFAULT ''");
ensureColumn('transactions', 'file_size', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('transactions', 'file_path', "TEXT DEFAULT ''");
ensureColumn('budget_items', 'funding', "TEXT NOT NULL DEFAULT 'cash'");
ensureColumn('events', 'features', "TEXT DEFAULT '[]'");

// Remember that the legacy database was adopted so deleting every event later
// does not trigger another import on the next boot.
if (LEGACY_ADOPTED) {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('legacy_import_v1', '1');
}

// One-time currency migration: existing amounts are stored in units of "million
// tooman" (1 unit = 1,000,000 tooman). On first boot after this version they are
// converted to plain tooman and a meta flag prevents the conversion from rerunning.
const MONEY_SCALE_FLAG = 'money_scale_v1';
if (db.prepare('SELECT value FROM meta WHERE key = ?').get(MONEY_SCALE_FLAG) === undefined) {
  db.exec('BEGIN');
  try {
    db.exec('UPDATE transactions SET amount = amount * 1000000 WHERE amount <> 0');
    db.exec('UPDATE budget_items SET amount = amount * 1000000 WHERE amount <> 0');
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(MONEY_SCALE_FLAG, '1000000');
    db.exec('COMMIT');
    console.log('[MIGRATE] Currency converted: million tooman -> tooman (x1,000,000)');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// One-time sponsor unit migration: monetary sponsor contributions were previously
// entered in units of "million tooman". Numeric-looking money values are converted
// to plain tooman (x1,000,000). In-kind/services amounts (free text) are untouched.
const SPONSOR_MONEY_FLAG = 'sponsor_money_v1';
if (db.prepare('SELECT value FROM meta WHERE key = ?').get(SPONSOR_MONEY_FLAG) === undefined) {
  db.exec('BEGIN');
  try {
    db.exec(`UPDATE sponsors
             SET contribution_amount = CAST(CAST(CAST(contribution_amount AS REAL) * 1000000 AS INTEGER) AS TEXT)
             WHERE contribution_type = 'money'
               AND contribution_amount <> ''
               AND contribution_amount NOT GLOB '*[^0-9.]*'
               AND contribution_amount <> '.' AND contribution_amount <> ''`);
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(SPONSOR_MONEY_FLAG, '1');
    db.exec('COMMIT');
    console.log('[MIGRATE] Sponsor money converted: million tooman -> tooman (x1,000,000)');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- file storage helpers ----------
const FILES_ROOT = path.join(DATA_ROOT, 'files');
const MAX_FILE = 50 * 1024 * 1024;
const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
  '.zip': 'application/zip', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function safeFileName(name) {
  const base = path.basename(String(name || 'file').replace(/[\\/]/g, '_')).replace(/[^\w.\- ()]/g, '_').trim() || 'file';
  return base.slice(0, 120);
}

function saveFileBytes(eventId, fileData) {
  if (!fileData || typeof fileData.data !== 'string' || !fileData.data) return null;
  let buf;
  try { buf = Buffer.from(fileData.data, 'base64'); } catch (e) { return null; }
  if (!buf.length || buf.length > MAX_FILE) return null;
  const name = safeFileName(fileData.name);
  const mime = String(fileData.mime || 'application/octet-stream');
  const evDir = path.join(FILES_ROOT, String(eventId));
  fs.mkdirSync(evDir, { recursive: true });
  const storedPath = path.join(evDir, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`);
  fs.writeFileSync(storedPath, buf);
  return { path: storedPath, name, mime, size: buf.length };
}

function deleteStoredFile(p) {
  if (p) fs.unlink(p, () => {});
}

// Strip server-side paths before returning rows to clients.
function scrubFile(f) {
  if (!f) return f;
  const cleaned = { ...f };
  delete cleaned.stored_path;
  return cleaned;
}

function scrubFinance(f) {
  if (!f) return f;
  const cleaned = { ...f };
  delete cleaned.file_path;
  return cleaned;
}

// ---------- auth helpers ----------
function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// seed default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const salt = makeSalt();
  db.prepare('INSERT INTO users (username, password_hash, salt, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(adminUser, hashPassword(adminPass, salt), salt, 'admin', '[]', now());
  console.log(`[AUTH] Seeded default admin user: ${adminUser}`);
}

// ---------- users ----------
function createUser(data) {
  const username = String(data.username ?? '').trim();
  const password = String(data.password ?? '');
  if (!username || !password) return null;
  const salt = makeSalt();
  const r = db.prepare('INSERT INTO users (username, password_hash, salt, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(username, hashPassword(password, salt), salt, String(data.role ?? 'viewer'), JSON.stringify(data.permissions ?? []), now());
  const id = Number(r.lastInsertRowid);
  setEventAccess(id, Array.isArray(data.eventIds) ? data.eventIds : []);
  return { id, username, role: String(data.role ?? 'viewer'), permissions: JSON.stringify(data.permissions ?? []), created_at: now(), eventIds: Array.isArray(data.eventIds) ? data.eventIds.map(Number) : [] };
}

function getUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

function getUserById(id) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role, permissions: u.permissions, created_at: u.created_at, eventIds: getEventAccess(u.id) };
}

function listUsers() {
  const users = db.prepare('SELECT id, username, role, permissions, created_at FROM users ORDER BY id').all();
  for (const u of users) {
    u.eventIds = getEventAccess(u.id);
  }
  return users;
}

function updateUser(id, data) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return null;
  const role = data.role !== undefined ? String(data.role) : u.role;
  const permissions = data.permissions !== undefined ? JSON.stringify(data.permissions) : u.permissions;
  let sql = 'UPDATE users SET role = ?, permissions = ?';
  const params = [role, permissions];
  if (data.password) {
    const salt = makeSalt();
    sql += ', password_hash = ?, salt = ?';
    params.push(hashPassword(data.password, salt), salt);
  }
  sql += ' WHERE id = ?';
  params.push(id);
  db.prepare(sql).run(...params);
  if (data.eventIds !== undefined) setEventAccess(id, Array.isArray(data.eventIds) ? data.eventIds : []);
  return getUserById(id);
}

function deleteUser(id) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return false;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return true;
}

function authenticateUser(username, password) {
  const u = getUser(username);
  if (!u) return null;
  const actual = Buffer.from(hashPassword(password, u.salt), 'hex');
  const expected = Buffer.from(u.password_hash, 'hex');
  const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (!ok) return null;
  return { id: u.id, username: u.username, role: u.role, permissions: u.permissions };
}

// ---------- event access (per-user, per-event) ----------
function getEventAccess(userId) {
  const rows = db.prepare('SELECT event_id FROM event_access WHERE user_id = ?').all(userId);
  return rows.map((r) => Number(r.event_id));
}

function userCanAccessEvent(userId, eventId) {
  const row = db.prepare('SELECT 1 FROM event_access WHERE user_id = ? AND event_id = ?').get(userId, eventId);
  return !!row;
}

function setEventAccess(userId, eventIds) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM event_access WHERE user_id = ?').run(userId);
    const stmt = db.prepare('INSERT OR IGNORE INTO event_access (user_id, event_id) VALUES (?, ?)');
    for (const eid of eventIds) {
      if (eid === null || eid === undefined || eid === '') continue;
      stmt.run(userId, Number(eid));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- sessions ----------
function createSession(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!s) return null;
  if (new Date(s.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
    return null;
  }
  const user = getUserById(s.user_id);
  if (!user) return null;
  return { user, session: s };
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Change own password: verifies current password, then updates.
function changePassword(id, currentPassword, newPassword) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return { error: 'not_found' };
  if (hashPassword(currentPassword, u.salt) !== u.password_hash) return { error: 'current' };
  const salt = makeSalt();
  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
    .run(hashPassword(newPassword, salt), salt, id);
  return { ok: true };
}

function now() {
  return new Date().toISOString();
}

function row(r) {
  if (!r) return null;
  return { ...r };
}

function parseJsonList(raw) {
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function normJsonList(list, mapFn) {
  if (!Array.isArray(list)) return [];
  return list.map((it) => mapFn(it)).filter((x) => x !== null);
}

function getEvent(id) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return null;
  const members = db.prepare('SELECT * FROM members WHERE event_id = ? ORDER BY id').all(id);
  const sponsors = db.prepare('SELECT * FROM sponsors WHERE event_id = ? ORDER BY id').all(id);
  const timeline = db.prepare('SELECT * FROM timeline_items WHERE event_id = ? ORDER BY datetime, id').all(id);
  const files = db.prepare('SELECT * FROM files WHERE event_id = ? ORDER BY id').all(id);
  const finances = db.prepare('SELECT * FROM transactions WHERE event_id = ? ORDER BY date DESC, id DESC').all(id);
  const budgetItems = db.prepare('SELECT * FROM budget_items WHERE event_id = ? ORDER BY type, id').all(id);
  const designLocations = db.prepare('SELECT * FROM design_locations WHERE event_id = ? ORDER BY id').all(id);
  const designPlans = db.prepare('SELECT * FROM design_plans WHERE event_id = ? ORDER BY id').all(id);
  const participants = db.prepare('SELECT * FROM participants WHERE event_id = ? ORDER BY id').all(id);
  const guests = db.prepare('SELECT * FROM guests WHERE event_id = ? ORDER BY id').all(id);
  const speakers = db.prepare('SELECT * FROM speakers WHERE event_id = ? ORDER BY id').all(id);
  const workshops = db.prepare('SELECT * FROM workshops WHERE event_id = ? ORDER BY id').all(id);
  const adventures = db.prepare('SELECT * FROM adventures WHERE event_id = ? ORDER BY id').all(id);
  const shows = db.prepare('SELECT * FROM shows WHERE event_id = ? ORDER BY id').all(id);
  for (const sh of shows) {
    sh.segments = db.prepare('SELECT * FROM show_segments WHERE show_id = ? ORDER BY position, id').all(sh.id);
    sh.equipment = parseJsonList(sh.equipment);
  }
  const meetings = db.prepare('SELECT * FROM meetings WHERE event_id = ? ORDER BY id').all(id);
  for (const mt of meetings) {
    mt.agenda = parseJsonList(mt.agenda);
    mt.attendees = db.prepare('SELECT * FROM meeting_attendees WHERE meeting_id = ? ORDER BY id').all(mt.id);
  }

  const tasks = db.prepare('SELECT * FROM tasks WHERE event_id = ? ORDER BY id').all(id);
  const taskMemberStmt = db.prepare(
    `SELECT m.id, m.name, m.role, m.photo FROM members m
     JOIN task_members tm ON tm.member_id = m.id
     WHERE tm.task_id = ? ORDER BY m.name`
  );
  const taskAssigneeStmt = db.prepare(
    `SELECT u.id, u.username FROM users u
     JOIN task_assignees ta ON ta.user_id = u.id
     WHERE ta.task_id = ? ORDER BY u.username`
  );
  for (const t of tasks) {
    t.memberIds = db.prepare('SELECT member_id FROM task_members WHERE task_id = ?').all(t.id).map((x) => x.member_id);
    t.members = taskMemberStmt.all(t.id);
    t.assigneeIds = db.prepare('SELECT user_id FROM task_assignees WHERE task_id = ?').all(t.id).map((x) => x.user_id);
    t.assignees = taskAssigneeStmt.all(t.id);
  }

  return { ...ev, features: parseFeatures(ev.features), members, tasks, sponsors, timeline, files: files.map(scrubFile), finances: finances.map(scrubFinance), budget: budgetItems, design: { locations: designLocations, plans: designPlans }, participants, guests, speakers, workshops, adventures, shows, meetings };
}

function parseFeatures(raw) {
  try { const f = JSON.parse(raw || '[]'); return Array.isArray(f) ? f : []; } catch { return []; }
}

// Event-level module switch: empty list = all modules enabled.
// Returns true for any tab when features is empty; otherwise only listed tabs.
function featureEnabled(eventId, tab) {
  if (!tab || tab === 'overview') return true;
  const ev = db.prepare('SELECT features FROM events WHERE id = ?').get(eventId);
  if (!ev) return false;
  const features = parseFeatures(ev.features);
  if (!features.length) return true;
  return features.includes(String(tab));
}

function listEvents() {
  const events = db.prepare('SELECT * FROM events ORDER BY COALESCE(date, datetime(created_at)) DESC, id DESC').all();
  for (const ev of events) {
    ev.memberCount = db.prepare('SELECT COUNT(*) AS c FROM members WHERE event_id = ?').get(ev.id).c;
    ev.taskCount = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE event_id = ?').get(ev.id).c;
    ev.taskDone = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE event_id = ? AND status = 'done'").get(ev.id).c;
    ev.sponsorCount = db.prepare('SELECT COUNT(*) AS c FROM sponsors WHERE event_id = ?').get(ev.id).c;
  }
  return events;
}

function createEvent(data) {
  const info = db.prepare(
    `INSERT INTO events (name, description, date, location, critical_info, status, features, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const r = info.run(
    String(data.name ?? 'Untitled event').trim() || 'Untitled event',
    String(data.description ?? ''),
    String(data.date ?? ''),
    String(data.location ?? ''),
    String(data.critical_info ?? ''),
    String(data.status ?? 'upcoming'),
    JSON.stringify(Array.isArray(data.features) ? data.features.map(String) : []),
    now()
  );
  return getEvent(Number(r.lastInsertRowid));
}

function updateEvent(id, data) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return null;
  db.prepare(
    `UPDATE events SET name = ?, description = ?, date = ?, location = ?, critical_info = ?, status = ?, features = ? WHERE id = ?`
  ).run(
    String(data.name ?? ev.name),
    String(data.description ?? ev.description),
    String(data.date ?? ev.date),
    String(data.location ?? ev.location),
    String(data.critical_info ?? ev.critical_info),
    String(data.status ?? ev.status),
    JSON.stringify((data.features === undefined ? parseFeatures(ev.features) : (Array.isArray(data.features) ? data.features : [])).map(String)),
    id
  );
  return getEvent(id);
}

function deleteEvent(id) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return false;
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
  return true;
}

function eventExists(id) {
  return !!db.prepare('SELECT 1 FROM events WHERE id = ?').get(id);
}

// ---------- members ----------
function createMember(eventId, data) {
  const r = db.prepare(
    `INSERT INTO members (event_id, name, role, id_number, phone, photo, notes, section, section_head) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Unnamed',
    String(data.role ?? ''),
    String(data.id_number ?? ''),
    String(data.phone ?? ''),
    String(data.photo ?? ''),
    String(data.notes ?? ''),
    String(data.section ?? ''),
    data.section_head ? 1 : 0
  );
  return db.prepare('SELECT * FROM members WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateMember(eventId, memberId, data) {
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND event_id = ?').get(memberId, eventId);
  if (!m) return null;
  db.prepare(
    `UPDATE members SET name = ?, role = ?, id_number = ?, phone = ?, photo = ?, notes = ?, section = ?, section_head = ? WHERE id = ?`
  ).run(
    String(data.name ?? m.name),
    String(data.role ?? m.role),
    String(data.id_number ?? m.id_number),
    String(data.phone ?? m.phone),
    String(data.photo ?? m.photo),
    String(data.notes ?? m.notes),
    String(data.section ?? m.section),
    data.section_head === undefined ? m.section_head : (data.section_head ? 1 : 0),
    memberId
  );
  return db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
}

function deleteMember(eventId, memberId) {
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND event_id = ?').get(memberId, eventId);
  if (!m) return false;
  db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
  return true;
}

// ---------- tasks ----------
function createTask(eventId, data) {
  const r = db.prepare(
    `INSERT INTO tasks (event_id, title, description, status, importance, due_date) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.title ?? '').trim() || 'Untitled task',
    String(data.description ?? ''),
    String(data.status ?? 'todo'),
    String(data.importance ?? 'medium'),
    String(data.due_date ?? '')
  );
  const taskId = Number(r.lastInsertRowid);
  setTaskMembers(taskId, data.memberIds);
  setTaskAssignees(taskId, data.assigneeIds);
  return getTask(eventId, taskId);
}

function getTask(eventId, taskId) {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND event_id = ?').get(taskId, eventId);
  if (!t) return null;
  t.memberIds = db.prepare('SELECT member_id FROM task_members WHERE task_id = ?').all(taskId).map((x) => x.member_id);
  t.members = db.prepare(
    `SELECT m.id, m.name, m.role, m.photo FROM members m
     JOIN task_members tm ON tm.member_id = m.id
     WHERE tm.task_id = ? ORDER BY m.name`
  ).all(taskId);
  t.assigneeIds = db.prepare('SELECT user_id FROM task_assignees WHERE task_id = ?').all(taskId).map((x) => x.user_id);
  t.assignees = db.prepare(
    `SELECT u.id, u.username FROM users u
     JOIN task_assignees ta ON ta.user_id = u.id
     WHERE ta.task_id = ? ORDER BY u.username`
  ).all(taskId);
  return t;
}

function setTaskMembers(taskId, memberIds) {
  db.prepare('DELETE FROM task_members WHERE task_id = ?').run(taskId);
  const ins = db.prepare('INSERT OR IGNORE INTO task_members (task_id, member_id) VALUES (?, ?)');
  const list = Array.isArray(memberIds) ? memberIds.map((x) => Number(x)).filter((x) => x > 0) : [];
  for (const mid of list) ins.run(taskId, mid);
}

function setTaskAssignees(taskId, userIds) {
  db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId);
  const ins = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)');
  const list = Array.isArray(userIds) ? userIds.map((x) => Number(x)).filter((x) => x > 0) : [];
  for (const uid of list) ins.run(taskId, uid);
}

function getMyTasks(userId) {
  const rows = db.prepare(
    `SELECT t.*, e.name as event_name, e.date as event_date, e.status as event_status, e.id as event_id
     FROM tasks t
     JOIN events e ON e.id = t.event_id
     JOIN task_assignees ta ON ta.task_id = t.id
     WHERE ta.user_id = ?
     ORDER BY e.date DESC, t.id`
  ).all(userId);
  const assigneeStmt = db.prepare(
    `SELECT u.id, u.username FROM users u
     JOIN task_assignees ta ON ta.user_id = u.id
     WHERE ta.task_id = ? ORDER BY u.username`
  );
  const memberStmt = db.prepare(
    `SELECT m.id, m.name, m.role, m.photo FROM members m
     JOIN task_members tm ON tm.member_id = m.id
     WHERE tm.task_id = ? ORDER BY m.name`
  );
  for (const t of rows) {
    t.assignees = assigneeStmt.all(t.id);
    t.members = memberStmt.all(t.id);
  }
  return rows;
}

function getAssigneeUsers() {
  return db.prepare("SELECT id, username FROM users WHERE role = 'assignee' ORDER BY username").all();
}

function updateTask(eventId, taskId, data) {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND event_id = ?').get(taskId, eventId);
  if (!t) return null;
  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, status = ?, importance = ?, due_date = ? WHERE id = ?`
  ).run(
    String(data.title ?? t.title),
    String(data.description ?? t.description),
    String(data.status ?? t.status),
    String(data.importance ?? t.importance),
    String(data.due_date ?? t.due_date),
    taskId
  );
  if (data.memberIds !== undefined) setTaskMembers(taskId, data.memberIds);
  if (data.assigneeIds !== undefined) setTaskAssignees(taskId, data.assigneeIds);
  return getTask(eventId, taskId);
}

function deleteTask(eventId, taskId) {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND event_id = ?').get(taskId, eventId);
  if (!t) return false;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  return true;
}

// ---------- sponsors ----------
function createSponsor(eventId, data) {
  const r = db.prepare(
    `INSERT INTO sponsors (event_id, name, company, email, phone, contribution_type, contribution_amount, description, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Unnamed sponsor',
    String(data.company ?? ''),
    String(data.email ?? ''),
    String(data.phone ?? ''),
    String(data.contribution_type ?? 'money'),
    String(data.contribution_amount ?? ''),
    String(data.description ?? ''),
    String(data.status ?? 'confirmed'),
    String(data.notes ?? '')
  );
  return db.prepare('SELECT * FROM sponsors WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateSponsor(eventId, sponsorId, data) {
  const s = db.prepare('SELECT * FROM sponsors WHERE id = ? AND event_id = ?').get(sponsorId, eventId);
  if (!s) return null;
  db.prepare(
    `UPDATE sponsors SET name = ?, company = ?, email = ?, phone = ?, contribution_type = ?, contribution_amount = ?, description = ?, status = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.name ?? s.name),
    String(data.company ?? s.company),
    String(data.email ?? s.email),
    String(data.phone ?? s.phone),
    String(data.contribution_type ?? s.contribution_type),
    String(data.contribution_amount ?? s.contribution_amount),
    String(data.description ?? s.description),
    String(data.status ?? s.status),
    String(data.notes ?? s.notes),
    sponsorId
  );
  return db.prepare('SELECT * FROM sponsors WHERE id = ?').get(sponsorId);
}

function deleteSponsor(eventId, sponsorId) {
  const s = db.prepare('SELECT * FROM sponsors WHERE id = ? AND event_id = ?').get(sponsorId, eventId);
  if (!s) return false;
  db.prepare('DELETE FROM sponsors WHERE id = ?').run(sponsorId);
  return true;
}

// ---------- timeline ----------
function createTimelineItem(eventId, data) {
  const r = db.prepare(
    `INSERT INTO timeline_items (event_id, title, description, datetime, category, done) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.title ?? '').trim() || 'Untitled',
    String(data.description ?? ''),
    String(data.datetime ?? ''),
    String(data.category ?? 'milestone'),
    data.done ? 1 : 0
  );
  return db.prepare('SELECT * FROM timeline_items WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateTimelineItem(eventId, itemId, data) {
  const t = db.prepare('SELECT * FROM timeline_items WHERE id = ? AND event_id = ?').get(itemId, eventId);
  if (!t) return null;
  db.prepare(
    `UPDATE timeline_items SET title = ?, description = ?, datetime = ?, category = ?, done = ? WHERE id = ?`
  ).run(
    String(data.title ?? t.title),
    String(data.description ?? t.description),
    String(data.datetime ?? t.datetime),
    String(data.category ?? t.category),
    data.done === undefined ? t.done : data.done ? 1 : 0,
    itemId
  );
  return db.prepare('SELECT * FROM timeline_items WHERE id = ?').get(itemId);
}

function deleteTimelineItem(eventId, itemId) {
  const t = db.prepare('SELECT * FROM timeline_items WHERE id = ? AND event_id = ?').get(itemId, eventId);
  if (!t) return false;
  db.prepare('DELETE FROM timeline_items WHERE id = ?').run(itemId);
  return true;
}

// ---------- files ----------
function createFile(eventId, data) {
  const r = db.prepare(
    `INSERT INTO files (event_id, name, size, mime, stored_path, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? 'file'),
    Number(data.size) || 0,
    String(data.mime ?? 'application/octet-stream'),
    String(data.stored_path ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM files WHERE id = ?').get(Number(r.lastInsertRowid));
}

function getFile(eventId, fileId) {
  return db.prepare('SELECT * FROM files WHERE id = ? AND event_id = ?').get(fileId, eventId) || null;
}

function deleteFile(eventId, fileId) {
  const f = db.prepare('SELECT * FROM files WHERE id = ? AND event_id = ?').get(fileId, eventId);
  if (!f) return false;
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
  return f;
}

// ---------- finances ----------
// Keep the budget in sync: a transaction category that has no budget line for the
// same event+type is auto-created in the budget as a 0-amount line. The budget UI
// groups these under "Undefined categories".
function syncBudgetCategory(eventId, type, category) {
  const cat = String(category ?? '').trim();
  if (!cat) return null;
  const exists = db.prepare(
    `SELECT COUNT(*) AS c FROM budget_items WHERE event_id = ? AND type = ? AND LOWER(category) = LOWER(?)`
  ).get(eventId, type, cat).c;
  if (exists) return null;
  const last = db.prepare(
    `INSERT INTO budget_items (event_id, type, category, amount, notes, created_at) VALUES (?, ?, ?, 0, '', ?)`
  ).run(eventId, type, cat, now());
  return Number(last.lastInsertRowid);
}

function createFinance(eventId, data) {
  const saved = data.file ? saveFileBytes(eventId, data.file) : null;
  const type = String(data.type === 'income' ? 'income' : 'expense');
  const category = String(data.category ?? '');
  const r = db.prepare(
    `INSERT INTO transactions (event_id, type, title, amount, category, date, notes, file_name, file_mime, file_size, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    type,
    String(data.title ?? '').trim() || 'Untitled',
    Number(data.amount) || 0,
    category,
    String(data.date ?? ''),
    String(data.notes ?? ''),
    saved ? saved.name : '',
    saved ? saved.mime : '',
    saved ? saved.size : 0,
    saved ? saved.path : '',
    now()
  );
  syncBudgetCategory(eventId, type, category);
  return scrubFinance(db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(r.lastInsertRowid)));
}

function getFinance(eventId, financeId) {
  return db.prepare('SELECT * FROM transactions WHERE id = ? AND event_id = ?').get(financeId, eventId) || null;
}

function updateFinance(eventId, financeId, data) {
  const f = db.prepare('SELECT * FROM transactions WHERE id = ? AND event_id = ?').get(financeId, eventId);
  if (!f) return null;
  const type = String(data.type === 'income' ? 'income' : 'expense');
  const category = String(data.category ?? f.category);
  let file_name = f.file_name, file_mime = f.file_mime, file_size = f.file_size, file_path = f.file_path;
  if (data.file_remove) {
    if (f.file_path) deleteStoredFile(f.file_path);
    file_name = ''; file_mime = ''; file_size = 0; file_path = '';
  } else if (data.file) {
    const saved = saveFileBytes(eventId, data.file);
    if (saved) {
      if (f.file_path) deleteStoredFile(f.file_path);
      file_name = saved.name; file_mime = saved.mime; file_size = saved.size; file_path = saved.path;
    }
  }
  db.prepare(
    `UPDATE transactions SET type = ?, title = ?, amount = ?, category = ?, date = ?, notes = ?, file_name = ?, file_mime = ?, file_size = ?, file_path = ? WHERE id = ?`
  ).run(
    type,
    String(data.title ?? f.title),
    Number(data.amount ?? f.amount) || 0,
    category,
    String(data.date ?? f.date),
    String(data.notes ?? f.notes),
    file_name,
    file_mime,
    file_size,
    file_path,
    financeId
  );
  syncBudgetCategory(eventId, type, category);
  return scrubFinance(db.prepare('SELECT * FROM transactions WHERE id = ?').get(financeId));
}

function deleteFinance(eventId, financeId) {
  const f = db.prepare('SELECT * FROM transactions WHERE id = ? AND event_id = ?').get(financeId, eventId);
  if (!f) return false;
  if (f.file_path) deleteStoredFile(f.file_path);
  db.prepare('DELETE FROM transactions WHERE id = ?').run(financeId);
  return true;
}

// ---------- budget ----------
function createBudgetItem(eventId, data) {
  const funding = ['cash', 'sponsor', 'other'].includes(String(data.funding)) ? String(data.funding) : 'cash';
  const r = db.prepare(
    `INSERT INTO budget_items (event_id, type, category, amount, notes, funding, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.type === 'income' ? 'income' : 'expense'),
    String(data.category ?? '').trim(),
    Number(data.amount) || 0,
    String(data.notes ?? ''),
    funding,
    now()
  );
  return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateBudgetItem(eventId, itemId, data) {
  const b = db.prepare('SELECT * FROM budget_items WHERE id = ? AND event_id = ?').get(itemId, eventId);
  if (!b) return null;
  const funding = ['cash', 'sponsor', 'other'].includes(String(data.funding)) ? String(data.funding) : b.funding;
  db.prepare(
    `UPDATE budget_items SET type = ?, category = ?, amount = ?, notes = ?, funding = ? WHERE id = ?`
  ).run(
    String(data.type === 'income' ? 'income' : 'expense'),
    String(data.category ?? b.category),
    Number(data.amount ?? b.amount) || 0,
    String(data.notes ?? b.notes),
    funding,
    itemId
  );
  return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(itemId);
}

function deleteBudgetItem(eventId, itemId) {
  const b = db.prepare('SELECT * FROM budget_items WHERE id = ? AND event_id = ?').get(itemId, eventId);
  if (!b) return false;
  db.prepare('DELETE FROM budget_items WHERE id = ?').run(itemId);
  return true;
}

// ---------- design ----------
function createDesignLocation(eventId, data) {
  const r = db.prepare(
    `INSERT INTO design_locations (event_id, name, address, notes, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Untitled',
    String(data.address ?? ''),
    String(data.notes ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM design_locations WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateDesignLocation(eventId, locId, data) {
  const loc = db.prepare('SELECT * FROM design_locations WHERE id = ? AND event_id = ?').get(locId, eventId);
  if (!loc) return null;
  db.prepare('UPDATE design_locations SET name = ?, address = ?, notes = ? WHERE id = ?').run(
    String(data.name ?? loc.name),
    String(data.address ?? loc.address),
    String(data.notes ?? loc.notes),
    locId
  );
  return db.prepare('SELECT * FROM design_locations WHERE id = ?').get(locId);
}

function deleteDesignLocation(eventId, locId) {
  const loc = db.prepare('SELECT * FROM design_locations WHERE id = ? AND event_id = ?').get(locId, eventId);
  if (!loc) return false;
  db.prepare('DELETE FROM design_locations WHERE id = ?').run(locId);
  return true;
}

function createDesignPlan(eventId, data) {
  const locId = Number(data.location_id) || null;
  if (!locId || !db.prepare('SELECT 1 FROM design_locations WHERE id = ? AND event_id = ?').get(locId, eventId)) return null;
  const r = db.prepare(
    `INSERT INTO design_plans (event_id, location_id, title, scenario, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    locId,
    String(data.title ?? '').trim() || 'Untitled',
    String(data.scenario ?? ''),
    String(data.description ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM design_plans WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateDesignPlan(eventId, planId, data) {
  const plan = db.prepare('SELECT * FROM design_plans WHERE id = ? AND event_id = ?').get(planId, eventId);
  if (!plan) return null;
  let locId = Number(data.location_id) || plan.location_id;
  if (locId !== plan.location_id && !db.prepare('SELECT 1 FROM design_locations WHERE id = ? AND event_id = ?').get(locId, eventId)) {
    locId = plan.location_id;
  }
  db.prepare('UPDATE design_plans SET location_id = ?, title = ?, scenario = ?, description = ? WHERE id = ?').run(
    locId,
    String(data.title ?? plan.title),
    String(data.scenario ?? plan.scenario),
    String(data.description ?? plan.description),
    planId
  );
  return db.prepare('SELECT * FROM design_plans WHERE id = ?').get(planId);
}

function deleteDesignPlan(eventId, planId) {
  const plan = db.prepare('SELECT * FROM design_plans WHERE id = ? AND event_id = ?').get(planId, eventId);
  if (!plan) return false;
  db.prepare('DELETE FROM design_plans WHERE id = ?').run(planId);
  return true;
}

// ---------- participants ----------
function createParticipant(eventId, data) {
  const r = db.prepare(
    `INSERT INTO participants (event_id, type, name, organization, contact, notes) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.type === 'team' ? 'team' : 'person'),
    String(data.name ?? '').trim() || 'Unnamed',
    String(data.organization ?? ''),
    String(data.contact ?? ''),
    String(data.notes ?? '')
  );
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateParticipant(eventId, participantId, data) {
  const p = db.prepare('SELECT * FROM participants WHERE id = ? AND event_id = ?').get(participantId, eventId);
  if (!p) return null;
  db.prepare(
    `UPDATE participants SET type = ?, name = ?, organization = ?, contact = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.type === 'team' ? 'team' : 'person'),
    String(data.name ?? p.name),
    String(data.organization ?? p.organization),
    String(data.contact ?? p.contact),
    String(data.notes ?? p.notes),
    participantId
  );
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId);
}

function deleteParticipant(eventId, participantId) {
  const p = db.prepare('SELECT * FROM participants WHERE id = ? AND event_id = ?').get(participantId, eventId);
  if (!p) return false;
  db.prepare('DELETE FROM participants WHERE id = ?').run(participantId);
  return true;
}

// ---------- guests ----------
function createGuest(eventId, data) {
  const r = db.prepare(
    `INSERT INTO guests (event_id, name, contact, status, guests_count, notes) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Unnamed',
    String(data.contact ?? ''),
    String(data.status ?? 'invited'),
    Math.max(1, Number(data.guests_count) || 1),
    String(data.notes ?? '')
  );
  return db.prepare('SELECT * FROM guests WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateGuest(eventId, guestId, data) {
  const g = db.prepare('SELECT * FROM guests WHERE id = ? AND event_id = ?').get(guestId, eventId);
  if (!g) return null;
  db.prepare(
    `UPDATE guests SET name = ?, contact = ?, status = ?, guests_count = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.name ?? g.name),
    String(data.contact ?? g.contact),
    String(data.status ?? g.status),
    Math.max(1, Number(data.guests_count ?? g.guests_count) || 1),
    String(data.notes ?? g.notes),
    guestId
  );
  return db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId);
}

function deleteGuest(eventId, guestId) {
  const g = db.prepare('SELECT * FROM guests WHERE id = ? AND event_id = ?').get(guestId, eventId);
  if (!g) return false;
  db.prepare('DELETE FROM guests WHERE id = ?').run(guestId);
  return true;
}

// ---------- speakers ----------
function createSpeaker(eventId, data) {
  const r = db.prepare(
    `INSERT INTO speakers (event_id, name, title, organization, topic, contact, bio, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Unnamed',
    String(data.title ?? ''),
    String(data.organization ?? ''),
    String(data.topic ?? ''),
    String(data.contact ?? ''),
    String(data.bio ?? ''),
    String(data.status ?? 'invited'),
    String(data.notes ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM speakers WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateSpeaker(eventId, speakerId, data) {
  const s = db.prepare('SELECT * FROM speakers WHERE id = ? AND event_id = ?').get(speakerId, eventId);
  if (!s) return null;
  db.prepare(
    `UPDATE speakers SET name = ?, title = ?, organization = ?, topic = ?, contact = ?, bio = ?, status = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.name ?? s.name),
    String(data.title ?? s.title),
    String(data.organization ?? s.organization),
    String(data.topic ?? s.topic),
    String(data.contact ?? s.contact),
    String(data.bio ?? s.bio),
    String(data.status ?? s.status),
    String(data.notes ?? s.notes),
    speakerId
  );
  return db.prepare('SELECT * FROM speakers WHERE id = ?').get(speakerId);
}

function deleteSpeaker(eventId, speakerId) {
  const s = db.prepare('SELECT * FROM speakers WHERE id = ? AND event_id = ?').get(speakerId, eventId);
  if (!s) return false;
  db.prepare('DELETE FROM speakers WHERE id = ?').run(speakerId);
  return true;
}

// ---------- workshops ----------
function createWorkshop(eventId, data) {
  const r = db.prepare(
    `INSERT INTO workshops (event_id, title, host, description, date, time_start, time_end, location, capacity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.title ?? '').trim() || 'Untitled workshop',
    String(data.host ?? ''),
    String(data.description ?? ''),
    String(data.date ?? ''),
    String(data.time_start ?? ''),
    String(data.time_end ?? ''),
    String(data.location ?? ''),
    Math.max(0, Number(data.capacity) || 0),
    String(data.status ?? 'planned'),
    String(data.notes ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM workshops WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateWorkshop(eventId, workshopId, data) {
  const w = db.prepare('SELECT * FROM workshops WHERE id = ? AND event_id = ?').get(workshopId, eventId);
  if (!w) return null;
  db.prepare(
    `UPDATE workshops SET title = ?, host = ?, description = ?, date = ?, time_start = ?, time_end = ?, location = ?, capacity = ?, status = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.title ?? w.title),
    String(data.host ?? w.host),
    String(data.description ?? w.description),
    String(data.date ?? w.date),
    String(data.time_start ?? w.time_start),
    String(data.time_end ?? w.time_end),
    String(data.location ?? w.location),
    Math.max(0, Number(data.capacity ?? w.capacity) || 0),
    String(data.status ?? w.status),
    String(data.notes ?? w.notes),
    workshopId
  );
  return db.prepare('SELECT * FROM workshops WHERE id = ?').get(workshopId);
}

function deleteWorkshop(eventId, workshopId) {
  const w = db.prepare('SELECT * FROM workshops WHERE id = ? AND event_id = ?').get(workshopId, eventId);
  if (!w) return false;
  db.prepare('DELETE FROM workshops WHERE id = ?').run(workshopId);
  return true;
}

// ---------- adventures (mini events) ----------
function createAdventure(eventId, data) {
  const r = db.prepare(
    `INSERT INTO adventures (event_id, name, type, description, date, time_start, time_end, location, cost, capacity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Untitled adventure',
    String(data.type ?? 'activity'),
    String(data.description ?? ''),
    String(data.date ?? ''),
    String(data.time_start ?? ''),
    String(data.time_end ?? ''),
    String(data.location ?? ''),
    Math.max(0, Number(data.cost) || 0),
    Math.max(0, Number(data.capacity) || 0),
    String(data.status ?? 'planned'),
    String(data.notes ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM adventures WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateAdventure(eventId, adventureId, data) {
  const a = db.prepare('SELECT * FROM adventures WHERE id = ? AND event_id = ?').get(adventureId, eventId);
  if (!a) return null;
  db.prepare(
    `UPDATE adventures SET name = ?, type = ?, description = ?, date = ?, time_start = ?, time_end = ?, location = ?, cost = ?, capacity = ?, status = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.name ?? a.name),
    String(data.type ?? a.type),
    String(data.description ?? a.description),
    String(data.date ?? a.date),
    String(data.time_start ?? a.time_start),
    String(data.time_end ?? a.time_end),
    String(data.location ?? a.location),
    Math.max(0, Number(data.cost ?? a.cost) || 0),
    Math.max(0, Number(data.capacity ?? a.capacity) || 0),
    String(data.status ?? a.status),
    String(data.notes ?? a.notes),
    adventureId
  );
  return db.prepare('SELECT * FROM adventures WHERE id = ?').get(adventureId);
}

function deleteAdventure(eventId, adventureId) {
  const a = db.prepare('SELECT * FROM adventures WHERE id = ? AND event_id = ?').get(adventureId, eventId);
  if (!a) return false;
  db.prepare('DELETE FROM adventures WHERE id = ?').run(adventureId);
  return true;
}

// ---------- shows ----------
function normShowEquipment(list) {
  return normJsonList(list, (it) => ({ label: String((it && it.label) || '').slice(0, 500), done: it && it.done ? 1 : 0 }));
}

function syncShowSegments(showId, segments) {
  db.prepare('DELETE FROM show_segments WHERE show_id = ?').run(showId);
  if (!Array.isArray(segments)) return;
  const ins = db.prepare('INSERT INTO show_segments (show_id, position, name, duration, description) VALUES (?, ?, ?, ?, ?)');
  segments.forEach((sg, i) => {
    ins.run(showId, i, String((sg && sg.name) || 'Segment').slice(0, 300), Math.max(0, Number(sg && sg.duration) || 0), String((sg && sg.description) || '').slice(0, 2000));
  });
}

function getShowFull(showId) {
  const sh = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
  if (!sh) return null;
  sh.segments = db.prepare('SELECT * FROM show_segments WHERE show_id = ? ORDER BY position, id').all(showId);
  sh.equipment = parseJsonList(sh.equipment);
  return sh;
}

function createShow(eventId, data) {
  const r = db.prepare(
    `INSERT INTO shows (event_id, name, type, description, date, time_start, time_end, duration, location_id, venue, host, status, cost, equipment, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.name ?? '').trim() || 'Untitled show',
    String(data.type ?? 'live'),
    String(data.description ?? ''),
    String(data.date ?? ''),
    String(data.time_start ?? ''),
    String(data.time_end ?? ''),
    Math.max(0, Number(data.duration) || 0),
    Number(data.location_id) || null,
    String(data.venue ?? ''),
    String(data.host ?? ''),
    String(data.status ?? 'planned'),
    Math.max(0, Number(data.cost) || 0),
    JSON.stringify(normShowEquipment(data.equipment)),
    String(data.notes ?? ''),
    now()
  );
  const showId = Number(r.lastInsertRowid);
  syncShowSegments(showId, data.segments);
  return getShowFull(showId);
}

function updateShow(eventId, showId, data) {
  const sh = db.prepare('SELECT * FROM shows WHERE id = ? AND event_id = ?').get(showId, eventId);
  if (!sh) return null;
  db.prepare(
    `UPDATE shows SET name = ?, type = ?, description = ?, date = ?, time_start = ?, time_end = ?, duration = ?, location_id = ?, venue = ?, host = ?, status = ?, cost = ?, equipment = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.name ?? sh.name),
    String(data.type ?? sh.type),
    String(data.description ?? sh.description),
    String(data.date ?? sh.date),
    String(data.time_start ?? sh.time_start),
    String(data.time_end ?? sh.time_end),
    Math.max(0, Number(data.duration ?? sh.duration) || 0),
    data.location_id === undefined ? sh.location_id : (Number(data.location_id) || null),
    String(data.venue ?? sh.venue),
    String(data.host ?? sh.host),
    String(data.status ?? sh.status),
    Math.max(0, Number(data.cost ?? sh.cost) || 0),
    data.equipment === undefined ? sh.equipment : JSON.stringify(normShowEquipment(data.equipment)),
    String(data.notes ?? sh.notes),
    showId
  );
  if (data.segments !== undefined) syncShowSegments(showId, data.segments);
  return getShowFull(showId);
}

function deleteShow(eventId, showId) {
  const sh = db.prepare('SELECT * FROM shows WHERE id = ? AND event_id = ?').get(showId, eventId);
  if (!sh) return false;
  db.prepare('DELETE FROM shows WHERE id = ?').run(showId);
  return true;
}

// ---------- meetings ----------
function normAgenda(list) {
  return normJsonList(list, (it) => ({ text: String((it && it.text) || '').slice(0, 500), done: it && it.done ? 1 : 0 }));
}

function syncMeetingAttendees(meetingId, eventId, attendees) {
  db.prepare('DELETE FROM meeting_attendees WHERE meeting_id = ?').run(meetingId);
  if (!Array.isArray(attendees)) return;
  const ins = db.prepare('INSERT INTO meeting_attendees (meeting_id, event_id, ref_type, ref_id, label, status) VALUES (?, ?, ?, ?, ?, ?)');
  for (const a of attendees) {
    if (!a) continue;
    ins.run(meetingId, eventId, String(a.ref_type || 'participant'), Math.max(0, Number(a.ref_id) || 0), String(a.label ?? '').slice(0, 300), String(a.status ?? 'invited'));
  }
}

function getMeetingFull(meetingId) {
  const m = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!m) return null;
  m.agenda = parseJsonList(m.agenda);
  m.attendees = db.prepare('SELECT * FROM meeting_attendees WHERE meeting_id = ? ORDER BY id').all(meetingId);
  return m;
}

function createMeeting(eventId, data) {
  const r = db.prepare(
    `INSERT INTO meetings (event_id, title, description, date, time_start, time_end, location, status, agenda, outcome, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.title ?? '').trim() || 'Untitled meeting',
    String(data.description ?? ''),
    String(data.date ?? ''),
    String(data.time_start ?? ''),
    String(data.time_end ?? ''),
    String(data.location ?? ''),
    String(data.status ?? 'planned'),
    JSON.stringify(normAgenda(data.agenda)),
    String(data.outcome ?? ''),
    String(data.notes ?? ''),
    now()
  );
  const meetingId = Number(r.lastInsertRowid);
  syncMeetingAttendees(meetingId, eventId, data.attendees);
  return getMeetingFull(meetingId);
}

function updateMeeting(eventId, meetingId, data) {
  const m = db.prepare('SELECT * FROM meetings WHERE id = ? AND event_id = ?').get(meetingId, eventId);
  if (!m) return null;
  db.prepare(
    `UPDATE meetings SET title = ?, description = ?, date = ?, time_start = ?, time_end = ?, location = ?, status = ?, agenda = ?, outcome = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.title ?? m.title),
    String(data.description ?? m.description),
    String(data.date ?? m.date),
    String(data.time_start ?? m.time_start),
    String(data.time_end ?? m.time_end),
    String(data.location ?? m.location),
    String(data.status ?? m.status),
    data.agenda === undefined ? m.agenda : JSON.stringify(normAgenda(data.agenda)),
    String(data.outcome ?? m.outcome),
    String(data.notes ?? m.notes),
    meetingId
  );
  if (data.attendees !== undefined) syncMeetingAttendees(meetingId, eventId, data.attendees);
  return getMeetingFull(meetingId);
}

function deleteMeeting(eventId, meetingId) {
  const m = db.prepare('SELECT * FROM meetings WHERE id = ? AND event_id = ?').get(meetingId, eventId);
  if (!m) return false;
  db.prepare('DELETE FROM meetings WHERE id = ?').run(meetingId);
  return true;
}

function exportEvent(eventId) {
  const ev = getEvent(eventId);
  if (!ev) return null;
  return {
    event: ev,
    meta: { exportedAt: new Date().toISOString(), version: '1.0', eventId }
  };
}

function exportAllEvents() {
  const events = listEvents();
  const all = [];
  for (const ev of events) {
    all.push(exportEvent(ev.id));
  }
  return { events: all, meta: { exportedAt: new Date().toISOString(), version: '1.0', eventCount: all.length } };
}

function exportUsers() {
  const users = db.prepare('SELECT id, username, role, permissions, created_at FROM users ORDER BY id').all();
  for (const u of users) {
    u.eventIds = getEventAccess(u.id);
  }
  return users;
}

function insertImported(table, data) {
  const cols = Object.keys(data);
  const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
  const info = stmt.run(...cols.map((c) => data[c] ?? ''));
  return Number(info.lastInsertRowid);
}

// Import exported events while remapping every row id. Foreign keys (task members,
// meeting attendees, show locations, ...) point at the newly created rows, and the
// attachments are restored separately from the zip by restoreFromZip().
function importEvents(data, mode = 'new') {
  const imported = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = `_restored_${timestamp}`;

  for (const exp of data.events || []) {
    const ev = (exp && exp.event) || exp;
    if (!ev || !ev.name) continue;

    const eventFields = {
      name: ev.name,
      description: ev.description,
      date: ev.date,
      location: ev.location,
      critical_info: ev.critical_info,
      status: ev.status,
      features: Array.isArray(ev.features) ? ev.features : [],
    };

    let newEventId;
    if (mode === 'replace') {
      deleteEvent(ev.id);
      newEventId = createEvent(eventFields).id;
    } else if (mode === 'merge') {
      const existing = db.prepare('SELECT id FROM events WHERE name = ?').get(ev.name);
      if (existing) {
        newEventId = existing.id;
        updateEvent(newEventId, eventFields);
      } else {
        newEventId = createEvent(eventFields).id;
      }
    } else {
      newEventId = createEvent({ ...eventFields, name: `${ev.name}${suffix}` }).id;
    }
    if (!newEventId) continue;

    // People / sources are imported first so meeting attendees can be remapped.
    const participantMap = new Map();
    for (const p of ev.participants || []) {
      const id = insertImported('participants', {
        event_id: newEventId, type: p.type, name: p.name, organization: p.organization,
        contact: p.contact, notes: p.notes,
      });
      participantMap.set(Number(p.id), id);
    }

    const guestMap = new Map();
    for (const g of ev.guests || []) {
      const id = insertImported('guests', {
        event_id: newEventId, name: g.name, contact: g.contact, status: g.status,
        guests_count: Math.max(1, Number(g.guests_count) || 1), notes: g.notes,
      });
      guestMap.set(Number(g.id), id);
    }

    const speakerMap = new Map();
    for (const s of ev.speakers || []) {
      const id = insertImported('speakers', {
        event_id: newEventId, name: s.name, title: s.title, organization: s.organization,
        topic: s.topic, contact: s.contact, bio: s.bio, status: s.status, notes: s.notes,
        created_at: s.created_at || now(),
      });
      speakerMap.set(Number(s.id), id);
    }

    const memberMap = new Map();
    for (const m of ev.members || []) {
      const id = insertImported('members', {
        event_id: newEventId, name: m.name, role: m.role, id_number: m.id_number,
        phone: m.phone, photo: m.photo, notes: m.notes, section: m.section,
        section_head: m.section_head ? 1 : 0,
      });
      memberMap.set(Number(m.id), id);
    }

    const taskMap = new Map();
    for (const task of ev.tasks || []) {
      const id = insertImported('tasks', {
        event_id: newEventId, title: task.title, description: task.description,
        status: task.status, importance: task.importance, due_date: task.due_date,
      });
      taskMap.set(Number(task.id), id);

      const memberIds = Array.isArray(task.memberIds) ? task.memberIds : [];
      for (const oldMemberId of memberIds) {
        const newMemberId = memberMap.get(Number(oldMemberId));
        if (newMemberId) {
          db.prepare('INSERT OR IGNORE INTO task_members (task_id, member_id) VALUES (?, ?)').run(id, newMemberId);
        }
      }
    }

    for (const s of ev.sponsors || []) {
      insertImported('sponsors', {
        event_id: newEventId, name: s.name, company: s.company, email: s.email, phone: s.phone,
        contribution_type: s.contribution_type, contribution_amount: s.contribution_amount,
        description: s.description, status: s.status, notes: s.notes,
      });
    }

    for (const item of ev.timeline || []) {
      insertImported('timeline_items', {
        event_id: newEventId, title: item.title, description: item.description,
        datetime: item.datetime, category: item.category, done: item.done ? 1 : 0,
      });
    }

    // Files rows are recreated by restoreFromZip() because stored_path must be
    // rewritten to the new event folder.
    for (const f of ev.finances || []) {
      insertImported('transactions', {
        event_id: newEventId, type: f.type, title: f.title, amount: Number(f.amount) || 0,
        category: f.category, date: f.date, notes: f.notes, file_name: f.file_name,
        file_mime: f.file_mime, file_size: Number(f.file_size) || 0, file_path: '',
        created_at: f.created_at || now(),
      });
    }

    for (const b of ev.budget || []) {
      insertImported('budget_items', {
        event_id: newEventId, type: b.type, category: b.category,
        amount: Number(b.amount) || 0, notes: b.notes, funding: b.funding,
        created_at: b.created_at || now(),
      });
    }

    const locationMap = new Map();
    for (const loc of (ev.design && ev.design.locations) || []) {
      const id = insertImported('design_locations', {
        event_id: newEventId, name: loc.name, address: loc.address, notes: loc.notes,
        created_at: loc.created_at || now(),
      });
      locationMap.set(Number(loc.id), id);
    }

    for (const plan of (ev.design && ev.design.plans) || []) {
      const newLocationId = locationMap.get(Number(plan.location_id));
      if (!newLocationId) continue;
      insertImported('design_plans', {
        event_id: newEventId, location_id: newLocationId, title: plan.title,
        scenario: plan.scenario, description: plan.description,
        created_at: plan.created_at || now(),
      });
    }

    for (const w of ev.workshops || []) {
      insertImported('workshops', {
        event_id: newEventId, title: w.title, host: w.host, description: w.description,
        date: w.date, time_start: w.time_start, time_end: w.time_end, location: w.location,
        capacity: Math.max(0, Number(w.capacity) || 0), status: w.status, notes: w.notes,
        created_at: w.created_at || now(),
      });
    }

    for (const a of ev.adventures || []) {
      insertImported('adventures', {
        event_id: newEventId, name: a.name, type: a.type, description: a.description,
        date: a.date, time_start: a.time_start, time_end: a.time_end, location: a.location,
        cost: Math.max(0, Number(a.cost) || 0), capacity: Math.max(0, Number(a.capacity) || 0),
        status: a.status, notes: a.notes, created_at: a.created_at || now(),
      });
    }

    for (const sh of ev.shows || []) {
      const showId = insertImported('shows', {
        event_id: newEventId, name: sh.name, type: sh.type, description: sh.description,
        date: sh.date, time_start: sh.time_start, time_end: sh.time_end,
        duration: Math.max(0, Number(sh.duration) || 0),
        location_id: locationMap.get(Number(sh.location_id)) || null,
        venue: sh.venue, host: sh.host, status: sh.status,
        cost: Math.max(0, Number(sh.cost) || 0),
        equipment: JSON.stringify(Array.isArray(sh.equipment) ? sh.equipment : []),
        notes: sh.notes, created_at: sh.created_at || now(),
      });
      (sh.segments || []).forEach((seg, i) => {
        insertImported('show_segments', {
          show_id: showId, position: i, name: seg.name,
          duration: Math.max(0, Number(seg.duration) || 0), description: seg.description,
        });
      });
    }

    for (const mt of ev.meetings || []) {
      const meetingId = insertImported('meetings', {
        event_id: newEventId, title: mt.title, description: mt.description, date: mt.date,
        time_start: mt.time_start, time_end: mt.time_end, location: mt.location,
        status: mt.status, agenda: JSON.stringify(Array.isArray(mt.agenda) ? mt.agenda : []),
        outcome: mt.outcome, notes: mt.notes, created_at: mt.created_at || now(),
      });
      for (const a of mt.attendees || []) {
        const map = a.ref_type === 'member' ? memberMap
          : a.ref_type === 'speaker' ? speakerMap
          : a.ref_type === 'guest' ? guestMap
          : a.ref_type === 'participant' ? participantMap
          : null;
        const oldRef = Number(a.ref_id);
        insertImported('meeting_attendees', {
          meeting_id: meetingId, event_id: newEventId, ref_type: a.ref_type,
          ref_id: (map && map.get(oldRef)) || oldRef || 0,
          label: a.label, status: a.status,
        });
      }
    }

    imported.push({ oldId: ev.id, newId: newEventId, name: ev.name });
  }
  return imported;
}

function importUsers(users) {
  const results = { created: 0, skipped: 0 };
  for (const u of users || []) {
    if (!u || !u.username) continue;
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
    if (exists) { results.skipped++; continue; }
    const salt = makeSalt();
    // Restored accounts get a known temporary password; admins should change it.
    const hash = hashPassword('changeme123', salt);
    db.prepare('INSERT INTO users (username, password_hash, salt, role, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(u.username, hash, salt, String(u.role || 'viewer'), u.permissions || '[]', u.created_at || now());
    results.created++;
  }
  return results;
}

function backupToZip() {
  const archiver = require('archiver');
  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks = [];

  archive.on('data', chunk => chunks.push(chunk));

  const exportData = exportAllEvents();
  archive.append(JSON.stringify(exportData, null, 2), { name: 'events.json' });

  const users = exportUsers();
  archive.append(JSON.stringify(users, null, 2), { name: 'users.json' });

  const FILES_ROOT = path.join(DATA_ROOT, 'files');
  if (fs.existsSync(FILES_ROOT)) {
    archive.directory(FILES_ROOT, 'files');
  }

  return new Promise((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    archive.finalize();
  });
}

async function restoreFromZip(zipBuffer) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const eventsEntry = entries.find(e => e.entryName === 'events.json');
  const usersEntry = entries.find(e => e.entryName === 'users.json');
  if (!eventsEntry) throw new Error('Invalid backup: missing events.json');

  const exportData = JSON.parse(eventsEntry.getData().toString('utf8'));
  const imported = importEvents(exportData, 'new');

  if (usersEntry) {
    const users = JSON.parse(usersEntry.getData().toString('utf8'));
    importUsers(users);
  }

  const filesByOldEvent = new Map();
  for (const exp of exportData.events || []) {
    const ev = exp && exp.event;
    if (ev) filesByOldEvent.set(Number(ev.id), ev.files || []);
  }

  const FILES_ROOT = path.resolve(DATA_ROOT, 'files');
  fs.mkdirSync(FILES_ROOT, { recursive: true });
  const idMap = new Map(imported.map((x) => [Number(x.oldId), Number(x.newId)]));
  const mimeFor = (name) => MIME_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName.replace(/\\/g, '/');
    if (!entryName.startsWith('files/')) continue;
    const rest = entryName.slice('files/'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) continue;
    const oldEventId = Number(rest.slice(0, slash));
    const newEventId = idMap.get(oldEventId);
    if (!newEventId) continue;

    const base = safeFileName(path.basename(rest.slice(slash + 1)));
    const destDir = path.join(FILES_ROOT, String(newEventId));
    const destPath = path.resolve(destDir, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}`);
    // Never allow a crafted zip entry to escape the data/files directory.
    if (!destPath.startsWith(FILES_ROOT + path.sep)) continue;

    const data = entry.getData();
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(destPath, data);

    const meta = (filesByOldEvent.get(oldEventId) || []).find((f) => base.endsWith(safeFileName(f.name))) || {};
    createFile(newEventId, {
      name: meta.name || base,
      mime: meta.mime || mimeFor(base),
      size: data.length,
      stored_path: destPath,
    });
  }

  return { importedEvents: imported.length };
}

module.exports = {
  db,
  dbPath: DB_PATH,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  eventExists,
  createMember,
  updateMember,
  deleteMember,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  createTimelineItem,
  updateTimelineItem,
  deleteTimelineItem,
  createFile,
  getFile,
  deleteFile,
  createFinance,
  updateFinance,
  deleteFinance,
  getFinance,
  scrubFile,
  scrubFinance,
  saveFileBytes,
  deleteStoredFile,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  createDesignLocation,
  updateDesignLocation,
  deleteDesignLocation,
  createDesignPlan,
  updateDesignPlan,
  deleteDesignPlan,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  createGuest,
  updateGuest,
  deleteGuest,
  createSpeaker,
  updateSpeaker,
  deleteSpeaker,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  createAdventure,
  updateAdventure,
  deleteAdventure,
  createShow,
  updateShow,
  deleteShow,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  featureEnabled,
  createUser,
  getUser,
  getUserById,
  listUsers,
  updateUser,
  deleteUser,
  authenticateUser,
  getEventAccess,
  userCanAccessEvent,
  setEventAccess,
  createSession,
  getSession,
  deleteSession,
  changePassword,
  setTaskAssignees,
  getMyTasks,
  getAssigneeUsers,
  exportEvent,
  exportAllEvents,
  importEvents,
  backupToZip,
  restoreFromZip,
};
