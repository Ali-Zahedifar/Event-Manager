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

  CREATE INDEX IF NOT EXISTS idx_members_event   ON members(event_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_event     ON tasks(event_id);
  CREATE INDEX IF NOT EXISTS idx_sponsors_event  ON sponsors(event_id);
  CREATE INDEX IF NOT EXISTS idx_timeline_event  ON timeline_items(event_id);
  CREATE INDEX IF NOT EXISTS idx_files_event     ON files(event_id);
  CREATE INDEX IF NOT EXISTS idx_finances_event  ON transactions(event_id);
  CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
  CREATE INDEX IF NOT EXISTS idx_guests_event    ON guests(event_id);

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
  if (hashPassword(password, u.salt) !== u.password_hash) return null;
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

function getEvent(id) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return null;
  const members = db.prepare('SELECT * FROM members WHERE event_id = ? ORDER BY id').all(id);
  const sponsors = db.prepare('SELECT * FROM sponsors WHERE event_id = ? ORDER BY id').all(id);
  const timeline = db.prepare('SELECT * FROM timeline_items WHERE event_id = ? ORDER BY datetime, id').all(id);
  const files = db.prepare('SELECT * FROM files WHERE event_id = ? ORDER BY id').all(id);
  const finances = db.prepare('SELECT * FROM transactions WHERE event_id = ? ORDER BY date DESC, id DESC').all(id);
  const participants = db.prepare('SELECT * FROM participants WHERE event_id = ? ORDER BY id').all(id);
  const guests = db.prepare('SELECT * FROM guests WHERE event_id = ? ORDER BY id').all(id);

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

  return { ...ev, members, tasks, sponsors, timeline, files, finances, participants, guests };
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
    `INSERT INTO events (name, description, date, location, critical_info, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const r = info.run(
    String(data.name ?? 'Untitled event').trim() || 'Untitled event',
    String(data.description ?? ''),
    String(data.date ?? ''),
    String(data.location ?? ''),
    String(data.critical_info ?? ''),
    String(data.status ?? 'upcoming'),
    now()
  );
  return getEvent(Number(r.lastInsertRowid));
}

function updateEvent(id, data) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return null;
  db.prepare(
    `UPDATE events SET name = ?, description = ?, date = ?, location = ?, critical_info = ?, status = ? WHERE id = ?`
  ).run(
    String(data.name ?? ev.name),
    String(data.description ?? ev.description),
    String(data.date ?? ev.date),
    String(data.location ?? ev.location),
    String(data.critical_info ?? ev.critical_info),
    String(data.status ?? ev.status),
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
function createFinance(eventId, data) {
  const r = db.prepare(
    `INSERT INTO transactions (event_id, type, title, amount, category, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    String(data.type === 'income' ? 'income' : 'expense'),
    String(data.title ?? '').trim() || 'Untitled',
    Number(data.amount) || 0,
    String(data.category ?? ''),
    String(data.date ?? ''),
    String(data.notes ?? ''),
    now()
  );
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(r.lastInsertRowid));
}

function updateFinance(eventId, financeId, data) {
  const f = db.prepare('SELECT * FROM transactions WHERE id = ? AND event_id = ?').get(financeId, eventId);
  if (!f) return null;
  db.prepare(
    `UPDATE transactions SET type = ?, title = ?, amount = ?, category = ?, date = ?, notes = ? WHERE id = ?`
  ).run(
    String(data.type === 'income' ? 'income' : 'expense'),
    String(data.title ?? f.title),
    Number(data.amount ?? f.amount) || 0,
    String(data.category ?? f.category),
    String(data.date ?? f.date),
    String(data.notes ?? f.notes),
    financeId
  );
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(financeId);
}

function deleteFinance(eventId, financeId) {
  const f = db.prepare('SELECT * FROM transactions WHERE id = ? AND event_id = ?').get(financeId, eventId);
  if (!f) return false;
  db.prepare('DELETE FROM transactions WHERE id = ?').run(financeId);
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

module.exports = {
  db,
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
  createParticipant,
  updateParticipant,
  deleteParticipant,
  createGuest,
  updateGuest,
  deleteGuest,
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
};
