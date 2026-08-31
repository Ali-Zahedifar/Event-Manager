/* ---------- auth.js — loaded before app.js ---------- */
let AUTH_USER = null;

async function authMe() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location = '/login'; return false; }
    AUTH_USER = await res.json();
    return true;
  } catch { window.location = '/login'; return false; }
}

function isAdmin() { return AUTH_USER && AUTH_USER.role === 'admin'; }
function isViewer() { return AUTH_USER && AUTH_USER.role === 'viewer'; }
function isAssignee() { return AUTH_USER && AUTH_USER.role === 'assignee'; }

function canAccessEvent(eventId) {
  if (!AUTH_USER) return false;
  if (AUTH_USER.role === 'admin') return true;
  if (AUTH_USER.role === 'assignee') return false;
  return (AUTH_USER.eventIds || []).map(Number).includes(Number(eventId));
}

// Viewer: see assigned events; tabs filtered by permissions (empty = all).
// Custom: see assigned events, only checked tabs.
// Assignee: no event access at all.
function canAccess(tab, eventId) {
  if (!AUTH_USER) return false;
  if (AUTH_USER.role === 'admin') return true;
  if (AUTH_USER.role === 'assignee') return false;
  if (!canAccessEvent(eventId)) return false;
  if (AUTH_USER.role === 'viewer') {
    try {
      const perms = JSON.parse(AUTH_USER.permissions || '[]');
      return perms.length === 0 || perms.includes(tab);
    } catch { return true; }
  }
  try { return JSON.parse(AUTH_USER.permissions || '[]').includes(tab); } catch { return false; }
}

function canWriteTab(tab, eventId) {
  if (!AUTH_USER) return false;
  if (AUTH_USER.role === 'admin') return true;
  if (AUTH_USER.role === 'viewer') return false;
  if (AUTH_USER.role === 'assignee') return false;
  try { return canAccessEvent(eventId) && JSON.parse(AUTH_USER.permissions || '[]').includes(tab); } catch { return false; }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location = '/login';
}
