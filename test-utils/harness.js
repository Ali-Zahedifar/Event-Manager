const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function startServer(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d.toString(); });
  child.stderr.on('data', (d) => { log += d.toString(); });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${log}`);
    try {
      const res = await fetch(base + '/login');
      if (res.ok) return { child, base, log: () => log, stopped: false };
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start in time:\n${log}`);
}

function tempDataDir(prefix = 'event-manager-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function stopServer(server) {
  const child = server && server.child;
  if (!child || server.stopped) return;
  // A process killed by a signal reports exitCode === null, so track it ourselves.
  server.stopped = true;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), 5000)),
  ]);
  if (timedOut) console.error('[test] server pid', child.pid, 'did not exit after kill');
}

// Windows keeps SQLite WAL files locked for a moment after exit; retry cleanup.
async function removeDir(dir) {
  for (let i = 0; i < 20; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      if (i === 19) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

async function login(base, username, password) {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`login ${username} failed (${res.status}): ${text}`);
  const cookie = (res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie')).split(';')[0];
  return { cookie, user: JSON.parse(text).user };
}

function client(base, cookie) {
  return async function request(method, apiPath, body) {
    const headers = { Origin: base, Cookie: cookie };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + apiPath, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}

module.exports = { ROOT, startServer, stopServer, removeDir, freePort, tempDataDir, login, client };
