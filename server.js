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

function setSessionCookie(res, token) {
  const cookie = 'session=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=' + (7 * 24 * 60 * 60);
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    res.setHeader('Set-Cookie', Array.isArray(existing) ? existing.concat([cookie]) : [existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
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

function canWrite(user, eventId, tab) {
  if (user.role === 'admin') return true;
  if (user.role === 'viewer') return false;
  if (user.role === 'assignee') return false;
  if (!dbm.userCanAccessEvent(user.id, eventId)) return false;
  try { return JSON.parse(user.permissions).includes(tab); } catch { return false; }
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
  participants: 'participants',
  guests: 'guests',
};

// Returns { ok, params } — params: { eventId?, memberId?, taskId?, sponsorId?, itemId? }
function parsePath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const params = {};
  if (parts[0] !== 'api') return null;
  if (parts.length < 2 || parts[1] !== 'events') return null;

  const map = { members: 'memberId', tasks: 'taskId', sponsors: 'sponsorId', timeline: 'itemId', files: 'fileId', finances: 'financeId', participants: 'participantId', guests: 'guestId' };
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
    const body = await readBody(req);
    const user = dbm.authenticateUser(String(body.username || ''), String(body.password || ''));
    if (!user) return sendError(res, 401, 'Invalid username or password');
    const token = dbm.createSession(user.id);
    setSessionCookie(res, token);
    return sendJson(res, 200, { ok: true, user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions } });
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = parseCookies(req).session;
    if (token) dbm.deleteSession(token);
    clearSessionCookie(res);
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
  const { eventId, memberId, taskId, sponsorId, itemId, fileId, financeId, participantId, guestId } = parsed.params;

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
      const ev = dbm.getEvent(eventId);
      return sendJson(res, 200, ev.files || []);
    }
    if (method === 'POST' && !fileId) {
      if (!canWrite(user, eventId, 'files')) return sendError(res, 403, 'No permission');
      const saved = saveUploadedFile(eventId, await readBody(req));
      return saved ? sendJson(res, 201, saved) : sendError(res, 400, 'Invalid file');
    }
    if (fileId) {
      const f = dbm.getFile(eventId, fileId);
      if (!f) return notFound(res);
      if (method === 'GET') return sendFileDownload(res, f);
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
  let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (!err.code || err.code === 'ENOENT') {
        // Try .html extension (e.g. /login -> login.html)
        const htmlPath = pathname + '.html';
        const htmlFile = path.join(PUBLIC_DIR, htmlPath);
        if (fs.existsSync(htmlFile)) {
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
      return sendError(res, 500, err.message);
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  console.log('[REQ]', req.method, pathname);
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (e) {
    sendError(res, 400, e.message);
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
