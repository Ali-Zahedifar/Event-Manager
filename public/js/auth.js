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

// Permission model: per-tab level ("view" | "write"; write implies view).
// Stored as JSON object: { "finances": "write", "tasks": "view" }.
// Legacy arrays ([ "finances" ]) are still understood: viewer -> view, custom -> write.
function permMap() {
  if (!AUTH_USER) return {};
  let raw;
  try { raw = JSON.parse(AUTH_USER.permissions || '[]'); } catch { return {}; }
  if (!raw || typeof raw !== 'object') return {};
  const map = {};
  if (Array.isArray(raw)) {
    raw.forEach((tab) => { map[String(tab)] = AUTH_USER.role === 'viewer' ? 'view' : 'write'; });
  } else {
    for (const [tab, v] of Object.entries(raw)) {
      if (v === 'write' || (v && v.write)) map[tab] = 'write';
      else if (v === 'view' || (v && v.can) || (v && v.view)) map[tab] = 'view';
    }
  }
  return map;
}

// Legacy viewer with an empty permissions array sees all tabs (read-only).
function viewerAllTabs() {
  if (!AUTH_USER || AUTH_USER.role !== 'viewer') return false;
  let raw;
  try { raw = JSON.parse(AUTH_USER.permissions || '[]'); } catch { return false; }
  return Array.isArray(raw) && raw.length === 0;
}

// Viewer: see assigned events; tabs filtered by permissions (legacy empty = all).
// Custom: see assigned events, only tabs with a granted level.
// Assignee: no event access at all.
function canAccess(tab, eventId) {
  if (!AUTH_USER) return false;
  if (AUTH_USER.role === 'admin') return true;
  if (AUTH_USER.role === 'assignee') return false;
  if (!canAccessEvent(eventId)) return false;
  if (AUTH_USER.role === 'viewer' && viewerAllTabs()) return true;
  return permMap()[tab] == null ? false : true;
}

function canWriteTab(tab, eventId) {
  if (!AUTH_USER) return false;
  if (AUTH_USER.role === 'admin') return true;
  if (AUTH_USER.role === 'viewer') return false;
  if (AUTH_USER.role === 'assignee') return false;
  if (!canAccessEvent(eventId)) return false;
  return permMap()[tab] === 'write';
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location = '/login';
}
