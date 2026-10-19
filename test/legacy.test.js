const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stopServer, removeDir, tempDataDir, login, client } = require('../test-utils/harness');

function createLegacyDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT DEFAULT '',
      location TEXT DEFAULT '',
      critical_info TEXT DEFAULT '',
      status TEXT DEFAULT 'upcoming',
      created_at TEXT NOT NULL
    );
    CREATE TABLE members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      id_number TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      importance TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT DEFAULT ''
    );
    CREATE TABLE task_members (
      task_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, member_id)
    );
    CREATE TABLE sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      company TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      contribution_type TEXT DEFAULT 'money',
      contribution_amount TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'confirmed',
      notes TEXT DEFAULT ''
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT '',
      date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      category TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  db.prepare(`INSERT INTO events (id, name, description, date, location, critical_info, status, created_at)
              VALUES (7, 'Legacy Fest', 'Old data', '2026-01-15', 'Old Hall', 'Keep me', 'upcoming', '2025-01-01T00:00:00.000Z')`).run();
  db.prepare("INSERT INTO members (id, event_id, name, role) VALUES (1, 7, 'Old Member', 'Lead')").run();
  db.prepare("INSERT INTO members (id, event_id, name, role) VALUES (2, 7, 'Second Member', 'Crew')").run();
  db.prepare("INSERT INTO tasks (id, event_id, title, status) VALUES (3, 7, 'Old task', 'todo')").run();
  db.prepare('INSERT INTO task_members (task_id, member_id) VALUES (3, 2)').run();
  db.prepare("INSERT INTO sponsors (event_id, name, contribution_type, contribution_amount) VALUES (7, 'Old Sponsor', 'money', '40')").run();
  db.prepare("INSERT INTO transactions (event_id, type, title, amount, category, created_at) VALUES (7, 'expense', 'Venue', 2.5, 'venue', '2025-01-02T00:00:00.000Z')").run();
  db.prepare("INSERT INTO budget_items (event_id, type, category, amount, created_at) VALUES (7, 'expense', 'venue', 3, '2025-01-02T00:00:00.000Z')").run();
  db.close();
}

test('legacy events.db is adopted once and migrated in place', async (t) => {
  const tmp = tempDataDir('event-manager-legacy-');
  const dataDir = path.join(tmp, 'data');
  const legacyFile = path.join(tmp, 'legacy', 'events.db');
  createLegacyDatabase(legacyFile);

  const env = { DATA_DIR: dataDir, LEGACY_DB: legacyFile, ADMIN_USER: 'admin', ADMIN_PASS: 'admin123' };
  let server = await startServer(env);
  t.after(async () => {
    await stopServer(server);
    await removeDir(tmp);
  });

  try {
    const admin = await login(server.base, 'admin', 'admin123');
    const asAdmin = client(server.base, admin.cookie);

    let res = await asAdmin('GET', '/api/events');
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1, JSON.stringify(res.data));
    assert.equal(res.data[0].name, 'Legacy Fest');

    res = await asAdmin('GET', `/api/events/${res.data[0].id}`);
    assert.equal(res.status, 200);
    const ev = res.data;
    assert.equal(ev.critical_info, 'Keep me');
    assert.equal(ev.members.length, 2);
    assert.equal(ev.members[0].section, '');
    assert.equal(ev.tasks.length, 1);
    assert.deepEqual(ev.tasks[0].memberIds, [2]);

    // Old money was stored in million tooman and is converted on first boot.
    assert.equal(ev.finances.length, 1);
    assert.equal(ev.finances[0].amount, 2500000);
    assert.equal(ev.budget.length, 1);
    assert.equal(ev.budget[0].amount, 3000000);
    assert.equal(ev.sponsors[0].contribution_amount, '40000000');

    // A second boot must not import the legacy file again.
    await stopServer(server);
    server = await startServer(env);
    const admin2 = await login(server.base, 'admin', 'admin123');
    res = await client(server.base, admin2.cookie)('GET', '/api/events');
    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1, 'legacy data must not be imported twice');
  } finally {
    await stopServer(server);
  }
});
