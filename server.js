const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const dbm = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Same resolution as db.js: DATA_DIR env > /main/eventmanager (deployment disk) > ./data
function resolveDataRoot() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  try {
    fs.accessSync('/main', fs.constants.W_OK);
    return '/main/eventmanager';
  } catch {}
  return path.join(__dirname, 'data');
}
const FILES_DIR = path.join(resolveDataRoot(), 'files');
const MAX_BODY = 70 * 1024 * 1024;
const MAX_FILE = 50 * 1024 * 1024;

// --- Login rate limiting (in-memory, resets on restart) ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 10;
const LOGIN_MAX_PER_ACCOUNT = 5;
const loginFails = new Map();

function rateCheck(key, max) {
  const now = Date.now();
  let e = loginFails.get(key);
  if (!e || now - e.windowStart > LOGIN_WINDOW_MS) {
    e = { count: 0, windowStart: now };
    loginFails.set(key, e);
  }
  e.count++;
  return e.count <= max;
}

function rateClear(key) {
  loginFails.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of loginFails) {
    if (now - e.windowStart > LOGIN_WINDOW_MS) loginFails.delete(k);
  }
}, 60 * 1000).unref();

function clientIp(req) {
  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function isSecure(req) {
  if (process.env.COOKIE_SECURE === '1' || process.env.COOKIE_SECURE === 'true') return true;
  if (req.socket && req.socket.encrypted) return true;
  if ((process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') &&
      String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https') return true;
  return false;
}

// Defense-in-depth CSRF check (SameSite=Strict is the primary control).
function originAllowed(hostHeader, origin) {
  let o;
  try { o = new URL(origin); } catch { return false; }
  const oh = o.host.toLowerCase();
  const hostOnly = oh.includes(':') ? oh.split(':')[0] : oh;
  if (hostOnly === 'localhost' || hostOnly === '127.0.0.1' || hostOnly === '::1') return true;
  const h = String(hostHeader || '').split(':')[0].toLowerCase();
  return h === hostOnly;
}

function methodChangesState(method) {
  return method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}

function safeStaticPath(pathname) {
  const root = path.resolve(PUBLIC_DIR);
  const candidate = path.resolve(root, '.' + path.sep + String(pathname || '').replace(/^[/\\]+/, ''));
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function idOf(params, key) {
  const v = params[key];
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// --- Cookie & Auth helpers ---
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach((c) => {
    const idx = c.indexOf('=');
    if (idx > 0) {
      const key = c.slice(0, idx).trim();
      const val = decodeURIComponent(c.slice(idx + 1).trim());
      cookies[key] = val;
    }
  });
  return cookies;
}

function setSessionCookie(res, token, secure) {
  const cookie = 'session=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=' + (7 * 24 * 60 * 60) + (secure ? '; Secure' : '');
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    res.setHeader('Set-Cookie', Array.isArray(existing) ? existing.concat([cookie]) : [existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}

function clearSessionCookie(res, secure) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0' + (secure ? '; Secure' : ''));
}

async function requireAuth(req, res) {
  const token = parseCookies(req).session;
  if (!token) { sendError(res, 401, 'Not authenticated'); return null; }
  const result = dbm.getSession(token);
  if (!result) { sendError(res, 401, 'Session expired'); return null; }
  return result.user;
}

async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') { sendError(res, 403, 'Admin only'); return null; }
  return user;
}

// Per-tab permission level map: { tab: "view" | "write" }. Legacy arrays -> custom: write.
function tabPerms(user) {
  let raw;
  try { raw = JSON.parse(user.permissions || '[]'); } catch { return {}; }
  if (!raw || typeof raw !== 'object') return {};
  const map = {};
  if (Array.isArray(raw)) {
    raw.forEach((tab) => { map[String(tab)] = 'write'; });
  } else {
    for (const [tab, v] of Object.entries(raw)) {
      if (v === 'write' || (v && v.write)) map[tab] = 'write';
      else if (v === 'view' || (v && v.can)) map[tab] = 'view';
    }
  }
  return map;
}

function canWrite(user, eventId, tab) {
  if (user.role === 'admin') return true;
  if (user.role === 'viewer') return false;
  if (user.role === 'assignee') return false;
  if (!dbm.userCanAccessEvent(user.id, eventId)) return false;
  return tabPerms(user)[tab] === 'write';
}

function canAccessEvent(user, eventId) {
  if (user.role === 'admin') return true;
  return dbm.userCanAccessEvent(user.id, eventId);
}

// --- Tab name map for permission checks ---
const TAB_MAP = {
  members: 'team',
  tasks: 'tasks',
  sponsors: 'sponsors',
  timeline: 'timeline',
  files: 'files',
  finances: 'finances',
  budget: 'budget',
  participants: 'participants',
  guests: 'guests',
};

// Returns { ok, params } — params: { eventId?, memberId?, taskId?, sponsorId?, itemId? }
function parsePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const params = {};
  if (parts[0] !== 'api') return null;
  if (parts.length < 2 || parts[1] !== 'events') return null;

  const map = { members: 'memberId', tasks: 'taskId', sponsors: 'sponsorId', timeline: 'itemId', files: 'fileId', finances: 'financeId', budget: 'budgetId', participants: 'participantId', guests: 'guestId' };
  if (parts.length === 2) {
    params.eventId = null;
    params.tail = [];
    return { ok: true, params };
  }

  params.eventId = idOf(parts, 2);
  if (!params.eventId) return { ok: false };

  const rest = parts.slice(3);
  const key = map[rest[0]];
  if (key && rest.length > 1) {
    params[key] = idOf(rest, 1);
    if (!params[key]) return { ok: false };
  }
  params.tail = rest;
  return { ok: true, params };
}

function notFound(res) {
  sendError(res, 404, 'Not found');
}

function safeFileName(name) {
  const base = path.basename(String(name || 'file').replace(/[\\/]/g, '_')).replace(/[^\w.\- ()]/g, '_').trim() || 'file';
  return base.slice(0, 120);
}

function saveUploadedFile(eventId, body) {
  const name = safeFileName(body.name);
  const mime = String(body.mime || 'application/octet-stream');
  if (typeof body.data !== 'string' || !body.data) return null;
  let buf;
  try { buf = Buffer.from(body.data, 'base64'); } catch (e) { return null; }
  if (!buf.length || buf.length > MAX_FILE) return null;
  const evDir = path.join(FILES_DIR, String(eventId));
  fs.mkdirSync(evDir, { recursive: true });
  const stored_path = path.join(evDir, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`);
  fs.writeFileSync(stored_path, buf);
  return dbm.createFile(eventId, { name, mime, size: buf.length, stored_path });
}

function sendFileDownload(res, f) {
  fs.readFile(f.stored_path, (err, data) => {
    if (err) return notFound(res);
    res.writeHead(200, {
      'Content-Type': f.mime || 'application/octet-stream',
      'Content-Length': data.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

// --- Auth routes ---
async function handleAuth(req, res, pathname, method) {
  if (pathname === '/api/auth/login' && method === 'POST') {
    const ip = clientIp(req);
    if (!rateCheck('ip:' + ip, LOGIN_MAX_PER_IP)) {
      console.log('[AUTH] Login rate-limited (IP):', ip);
      return sendError(res, 429, 'Too many login attempts. Try again later.');
    }
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    if (!rateCheck('ip:' + ip + '|u:' + username, LOGIN_MAX_PER_ACCOUNT)) {
      console.log('[AUTH] Login rate-limited (account):', username, 'from', ip);
      return sendError(res, 429, 'Too many login attempts. Try again later.');
    }
    const user = dbm.authenticateUser(username, String(body.password || ''));
    if (!user) {
      console.log('[AUTH] Failed login:', username, 'from', ip);
      return sendError(res, 401, 'Invalid username or password');
    }
    rateClear('ip:' + ip);
    rateClear('ip:' + ip + '|u:' + username);
    const token = dbm.createSession(user.id);
    setSessionCookie(res, token, isSecure(req));
    return sendJson(res, 200, { ok: true, user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions } });
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = parseCookies(req).session;
    if (token) dbm.deleteSession(token);
    clearSessionCookie(res, isSecure(req));
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = await requireAuth(req, res);
    if (!user) return;
    return sendJson(res, 200, { id: user.id, username: user.username, role: user.role, permissions: user.permissions, eventIds: user.eventIds });
  }
  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    const cur = String(body.current || '');
    const neu = String(body.new || '');
    if (!neu) return sendError(res, 400, 'New password required');
    const result = dbm.changePassword(user.id, cur, neu);
    if (result.error === 'current') return sendError(res, 401, 'Current password incorrect');
    if (result.error) return sendError(res, 400, 'Could not change password');
    return sendJson(res, 200, { ok: true });
  }
  return null;
}

// --- User management routes (admin only) ---
async function handleUsers(req, res, pathname, method) {
  if (pathname === '/api/users' && method === 'GET') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    return sendJson(res, 200, dbm.listUsers());
  }
  if (pathname === '/api/users' && method === 'POST') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readBody(req);
    const user = dbm.createUser(body);
    if (!user) return sendError(res, 400, 'Username and password required');
    return sendJson(res, 201, user);
  }
  const userMatch = pathname.match(/^\/api\/users\/(\d+)\/?$/);
  if (userMatch && method === 'PUT') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = Number(userMatch[1]);
    const body = await readBody(req);
    const user = dbm.updateUser(id, body);
    if (!user) return sendError(res, 404, 'User not found');
    return sendJson(res, 200, user);
  }
  if (userMatch && method === 'DELETE') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = Number(userMatch[1]);
    if (id === admin.id) return sendError(res, 400, 'Cannot delete your own account');
    if (!dbm.deleteUser(id)) return sendError(res, 404, 'User not found');
    return sendJson(res, 200, { ok: true });
  }
  return null;
}

async function handleApi(req, res, pathname) {
  const method = req.method;

  // Auth routes (public)
  if (pathname.startsWith('/api/auth/')) {
    const result = await handleAuth(req, res, pathname, method);
    if (result !== null) return;
    return notFound(res);
  }

  // User management routes (admin)
  if (pathname.startsWith('/api/users')) {
    const result = await handleUsers(req, res, pathname, method);
    if (result !== null) return;
    return notFound(res);
  }

  // All remaining /api/ routes require authentication
  const user = await requireAuth(req, res);
  if (!user) return;

  // /api/my-tasks (assignee users)
  if (pathname === '/api/my-tasks' && method === 'GET') {
    if (user.role !== 'assignee') return sendJson(res, 200, []);
    return sendJson(res, 200, dbm.getMyTasks(user.id));
  }

  // /api/assignee-users (admin only — for task form user assignment)
  if (pathname === '/api/assignee-users' && method === 'GET') {
    if (user.role !== 'admin') return sendJson(res, 200, []);
    return sendJson(res, 200, dbm.getAssigneeUsers());
  }

  const parsed = parsePath(pathname);
  if (!parsed || !parsed.ok) return notFound(res);
  const { eventId, memberId, taskId, sponsorId, itemId, fileId, financeId, budgetId, participantId, guestId } = parsed.params;

  if (pathname === '/api/events' || pathname === '/api/events/') {
    if (method === 'GET') {
      if (user.role === 'admin') return sendJson(res, 200, dbm.listEvents());
      const ids = dbm.getEventAccess(user.id);
      return sendJson(res, 200, dbm.listEvents().filter((e) => ids.includes(e.id)));
    }
    if (method === 'POST') {
      if (user.role !== 'admin') return sendError(res, 403, 'Only admins can create events');
      const body = await readBody(req);
      return sendJson(res, 201, dbm.createEvent(body));
    }
    return sendError(res, 405, 'Method not allowed');
  }

  const evMatch = pathname.match(/^\/api\/events\/(\d+)\/?$/);
  if (evMatch) {
    if (method === 'GET') {
      if (!canAccessEvent(user, eventId)) return sendError(res, 403, 'No access');
      const ev = dbm.getEvent(eventId);
      return ev ? sendJson(res, 200, ev) : notFound(res);
    }
    if (method === 'PUT') {
      if (user.role !== 'admin') return sendError(res, 403, 'Only admins can edit events');
      if (!dbm.eventExists(eventId)) return notFound(res);
      const body = await readBody(req);
      return sendJson(res, 200, dbm.updateEvent(eventId, body));
    }
    if (method === 'DELETE') {
      if (user.role !== 'admin') return sendError(res, 403, 'Only admins can delete events');
      if (!dbm.deleteEvent(eventId)) return notFound(res);
      fs.rm(path.join(FILES_DIR, String(eventId)), { recursive: true, force: true }, () => {});
      return sendJson(res, 200, { ok: true });
    }
    return sendError(res, 405, 'Method not allowed');
  }

  if (!dbm.eventExists(eventId)) return notFound(res);

  // /api/events/:id/members
  if (parsed.params.tail && parsed.params.tail[0] === 'members') {
    if (method === 'POST' && !memberId) {
      if (!canWrite(user, eventId, 'team')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createMember(eventId, await readBody(req)));
    }
    if (memberId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'team')) return sendError(res, 403, 'No permission');
        const m = dbm.updateMember(eventId, memberId, await readBody(req));
        return m ? sendJson(res, 200, m) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'team')) return sendError(res, 403, 'No permission');
        return dbm.deleteMember(eventId, memberId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/tasks
  if (parsed.params.tail && parsed.params.tail[0] === 'tasks') {
    if (method === 'POST' && !taskId) {
      if (!canWrite(user, eventId, 'tasks')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createTask(eventId, await readBody(req)));
    }
    if (taskId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'tasks')) return sendError(res, 403, 'No permission');
        const t = dbm.updateTask(eventId, taskId, await readBody(req));
        return t ? sendJson(res, 200, t) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'tasks')) return sendError(res, 403, 'No permission');
        return dbm.deleteTask(eventId, taskId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/sponsors
  if (parsed.params.tail && parsed.params.tail[0] === 'sponsors') {
    if (method === 'POST' && !sponsorId) {
      if (!canWrite(user, eventId, 'sponsors')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createSponsor(eventId, await readBody(req)));
    }
    if (sponsorId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'sponsors')) return sendError(res, 403, 'No permission');
        const s = dbm.updateSponsor(eventId, sponsorId, await readBody(req));
        return s ? sendJson(res, 200, s) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'sponsors')) return sendError(res, 403, 'No permission');
        return dbm.deleteSponsor(eventId, sponsorId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/timeline
  if (parsed.params.tail && parsed.params.tail[0] === 'timeline') {
    if (method === 'POST' && !itemId) {
      if (!canWrite(user, eventId, 'timeline')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createTimelineItem(eventId, await readBody(req)));
    }
    if (itemId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'timeline')) return sendError(res, 403, 'No permission');
        const t = dbm.updateTimelineItem(eventId, itemId, await readBody(req));
        return t ? sendJson(res, 200, t) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'timeline')) return sendError(res, 403, 'No permission');
        return dbm.deleteTimelineItem(eventId, itemId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/files
  if (parsed.params.tail && parsed.params.tail[0] === 'files') {
    if (method === 'GET' && !fileId) {
      if (!canAccessEvent(user, eventId)) return sendError(res, 403, 'No access');
      const ev = dbm.getEvent(eventId);
      return sendJson(res, 200, ev.files || []);
    }
    if (method === 'POST' && !fileId) {
      if (!canWrite(user, eventId, 'files')) return sendError(res, 403, 'No permission');
      const saved = saveUploadedFile(eventId, await readBody(req));
      return saved ? sendJson(res, 201, dbm.scrubFile(saved)) : sendError(res, 400, 'Invalid file');
    }
    if (fileId) {
      const f = dbm.getFile(eventId, fileId);
      if (!f) return notFound(res);
      if (method === 'GET') {
        if (!canAccessEvent(user, eventId)) return sendError(res, 403, 'No access');
        return sendFileDownload(res, f);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'files')) return sendError(res, 403, 'No permission');
        dbm.deleteFile(eventId, fileId);
        fs.unlink(f.stored_path, () => {});
        return sendJson(res, 200, { ok: true });
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/finances
  if (parsed.params.tail && parsed.params.tail[0] === 'finances') {
    if (method === 'POST' && !financeId) {
      if (!canWrite(user, eventId, 'finances')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createFinance(eventId, await readBody(req)));
    }
    if (financeId) {
      if (method === 'GET' && parsed.params.tail[2] === 'download') {
        if (!canAccessEvent(user, eventId)) return sendError(res, 403, 'No access');
        const f = dbm.getFinance(eventId, financeId);
        if (!f || !f.file_path) return notFound(res);
        return sendFileDownload(res, { stored_path: f.file_path, mime: f.file_mime, name: f.file_name });
      }
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'finances')) return sendError(res, 403, 'No permission');
        const t = dbm.updateFinance(eventId, financeId, await readBody(req));
        return t ? sendJson(res, 200, t) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'finances')) return sendError(res, 403, 'No permission');
        return dbm.deleteFinance(eventId, financeId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/budget
  if (parsed.params.tail && parsed.params.tail[0] === 'budget') {
    if (method === 'POST' && !budgetId) {
      if (!canWrite(user, eventId, 'budget')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createBudgetItem(eventId, await readBody(req)));
    }
    if (budgetId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'budget')) return sendError(res, 403, 'No permission');
        const b = dbm.updateBudgetItem(eventId, budgetId, await readBody(req));
        return b ? sendJson(res, 200, b) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'budget')) return sendError(res, 403, 'No permission');
        return dbm.deleteBudgetItem(eventId, budgetId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/participants
  if (parsed.params.tail && parsed.params.tail[0] === 'participants') {
    if (method === 'POST' && !participantId) {
      if (!canWrite(user, eventId, 'participants')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createParticipant(eventId, await readBody(req)));
    }
    if (participantId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'participants')) return sendError(res, 403, 'No permission');
        const p = dbm.updateParticipant(eventId, participantId, await readBody(req));
        return p ? sendJson(res, 200, p) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'participants')) return sendError(res, 403, 'No permission');
        return dbm.deleteParticipant(eventId, participantId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  // /api/events/:id/guests
  if (parsed.params.tail && parsed.params.tail[0] === 'guests') {
    if (method === 'POST' && !guestId) {
      if (!canWrite(user, eventId, 'guests')) return sendError(res, 403, 'No permission');
      return sendJson(res, 201, dbm.createGuest(eventId, await readBody(req)));
    }
    if (guestId) {
      if (method === 'PUT') {
        if (!canWrite(user, eventId, 'guests')) return sendError(res, 403, 'No permission');
        const g = dbm.updateGuest(eventId, guestId, await readBody(req));
        return g ? sendJson(res, 200, g) : notFound(res);
      }
      if (method === 'DELETE') {
        if (!canWrite(user, eventId, 'guests')) return sendError(res, 403, 'No permission');
        return dbm.deleteGuest(eventId, guestId) ? sendJson(res, 200, { ok: true }) : notFound(res);
      }
    }
    return sendError(res, 405, 'Method not allowed');
  }

  return notFound(res);
}

function serveStatic(req, res, pathname) {
  if (pathname === '/' || pathname === '') {
    return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, html) => {
      if (e) return sendError(res, 500, 'Server error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
  }
  const filePath = safeStaticPath(pathname);
  if (!filePath) return notFound(res);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (!err.code || err.code === 'ENOENT') {
        // Try .html extension (e.g. /login -> login.html)
        const htmlFile = safeStaticPath(pathname + '.html');
        if (htmlFile && fs.existsSync(htmlFile)) {
          fs.readFile(htmlFile, (e2, html) => {
            if (e2) return sendError(res, 404, 'Not found');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
          });
          return;
        }
        // SPA fallback -> index.html
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
          if (e2) return sendError(res, 404, 'Not found');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        });
        return;
      }
      return sendError(res, 500, 'Server error');
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname;
  try { pathname = decodeURIComponent(parsedUrl.pathname); } catch (e) { return sendError(res, 400, 'Bad request'); }
  console.log('[REQ]', req.method, pathname);
  securityHeaders(res);
  try {
    if (pathname.startsWith('/api/')) {
      if (methodChangesState(req.method)) {
        const origin = req.headers.origin;
        if (origin && !originAllowed(req.headers.host, origin)) {
          console.log('[SEC] Cross-origin state change blocked:', origin);
          return sendError(res, 403, 'Cross-origin request blocked');
        }
      }
      await handleApi(req, res, pathname);
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (e) {
    console.error('[ERR]', e);
    sendError(res, 400, 'Bad request');
  }
});

server.listen(PORT, () => {
  console.log('Event Manager running at http://localhost:' + PORT);
  console.log('Data stored in: ' + path.join(__dirname, 'data', 'db', 'events.db'));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  dbm.db.close();
  server.close(() => process.exit(0));
});
