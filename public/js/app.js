/* ---------- global error surface ---------- */
window.addEventListener('unhandledrejection', (e) => {
  const m = e?.reason?.message || e?.reason || t('something.wrong');
  console.error(e?.reason);
  toast(m);
});
window.addEventListener('error', (e) => {
  console.error(e.error);
  toast(e.message || t('something.wrong'));
});

/* ---------- utilities ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function icon(name, size = 16) {
  const p = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    idcard: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M6 15c.6-1.2 1.3-2 2-2s1.4.8 2 2M14 9h4M14 13h4M14 15h3"/>',
    alert: '<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z"/>',
    paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    star: '<path d="M11.5 3.4a1 1 0 0 1 2 0l1.6 4.9a1 1 0 0 0 .95.7h5.1a1 1 0 0 1 .6 1.8l-4.2 3.1a1 1 0 0 0-.35 1.1l1.6 4.9a1 1 0 0 1-1.55 1.12L13.9 19a1 1 0 0 0-1.17 0l-4.2 3.07A1 1 0 0 1 7 21l1.6-4.9a1 1 0 0 0-.35-1.1L4 11.9a1 1 0 0 1 .6-1.8h5.1a1 1 0 0 0 .95-.7Z"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    trendingUp: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6"/>',
    trendingDown: '<path d="M22 17 13.5 8.5 8.5 13.5 2 7M16 17h6v-6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p[name] || p.flag}</svg>`;
}

function fmtDate(d) {
  if (!d) return '';
  const date = d.length > 10 ? new Date(d) : new Date(d + 'T00:00:00');
  if (isNaN(date)) return d;
  return date.toLocaleDateString(LANG === 'fa' ? 'fa-IR' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleString(LANG === 'fa' ? 'fa-IR' : undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function initials(name) {
  return String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarHTML(m, size) {
  if (m.photo) return `<img class="avatar${size ? ' avatar-' + size : ''}" src="${m.photo}" alt="" />`;
  return `<span class="avatar${size ? ' avatar-' + size : ''}">${esc(initials(m.name))}</span>`;
}

/* ---------- language switcher ---------- */
function langToggleHTML() {
  const next = LANG === 'fa' ? 'English' : 'فارسی';
  return `<button class="btn btn-sm" id="lang-toggle" title="${esc(t('lang.title'))}">${icon('globe', 14)} ${next}</button>`;
}

function setupLangToggle() {
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    setLang(LANG === 'fa' ? 'en' : 'fa');
    navigate();
  });
}

/* ---------- modal helpers ---------- */
function openModal(html, { lg = false, onOpen } = {}) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal${lg ? ' lg' : ''}">
      <div style="display:flex;justify-content:flex-end;margin-bottom:-14px;">
        <button class="btn btn-ghost btn-icon modal-close" data-close aria-label="${esc(t('close'))}">${icon('x', 18)}</button>
      </div>
      ${html}
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeModal();
  });
  root.appendChild(overlay);
  if (onOpen) onOpen(overlay);
  return overlay;
}

function closeModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
}

function confirmDialog(title, message, onOk, okLabel) {
  openModal(`
    <h3>${esc(title)}</h3>
    <p style="color:var(--muted);font-size:14px;margin-bottom:6px;">${esc(message)}</p>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-danger" data-ok>${esc(okLabel || t('delete'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        overlay.querySelector('[data-ok]').addEventListener('click', () => {
          closeModal();
          onOk();
        });
      },
    }
  );
}

/* ---------- photo compression ---------- */
function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const max = 600;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          const s = max / Math.max(w, h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function photoField(state) {
  const wrap = document.createElement('div');
  wrap.className = 'photo-field';
  const previewEl = document.createElement('span');
  previewEl.className = 'photo-preview';
  previewEl.style.display = 'flex';
  previewEl.style.alignItems = 'center';
  previewEl.style.justifyContent = 'center';
  wrap.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
      <button type="button" class="btn btn-sm" data-pick>${icon('image', 14)} ${esc(t('upload.photo'))}</button>
      <button type="button" class="photo-remove hidden" data-remove>${esc(t('remove.photo'))}</button>
      <input type="file" accept="image/*" class="hidden" data-file />
    </div>`;
  wrap.prepend(previewEl);
  const removeBtn = wrap.querySelector('[data-remove]');
  const fileInput = wrap.querySelector('[data-file]');
  const renderPreview = (dataUrl) => {
    previewEl.innerHTML = dataUrl
      ? `<img src="${dataUrl}" alt="photo" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
      : icon('image', 24);
  };
  const apply = (dataUrl) => {
    state.photo = dataUrl;
    renderPreview(dataUrl);
    removeBtn.classList.toggle('hidden', !dataUrl);
  };
  renderPreview(state.photo);
  wrap.querySelector('[data-pick]').addEventListener('click', () => fileInput.click());
  removeBtn.addEventListener('click', () => apply(null));
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    const dataUrl = await compressPhoto(f);
    if (dataUrl) { apply(dataUrl); toast(t('photo.added')); }
    fileInput.value = '';
  });
  return wrap;
}

/* ---------- router ---------- */
function navigate() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/event\/(\d+)(?:\/(\w+))?/);
  if (m && isAssignee()) { location.hash = '#/'; return; }
  if (m) renderEventPage(Number(m[1]), m[2] || 'overview');
  else {
    if (isAssignee()) renderMyTasks();
    else renderDashboard();
  }
}
window.addEventListener('hashchange', navigate);

function appShell(title) {
  return `
    <div class="topbar">
      <div class="brand">
        <div class="brand-logo">${icon('calendar', 20)}</div>
        <div>
          <h1>${esc(t('app.name'))}</h1>
          <small>${esc(title)}</small>
        </div>
      </div>
      <div class="topbar-actions">
        ${isAdmin() ? `<button class="btn btn-sm" id="users-btn">${icon('users', 14)} ${esc(t('users'))}</button>` : ''}
        <button class="btn btn-sm" id="pw-btn">${esc(t('change.password'))}</button>
        <button class="btn btn-sm" id="logout-btn">${esc(t('logout'))}</button>
        ${langToggleHTML()}
      </div>
    </div>`;
}

/* ---------- my tasks (assignee view) ---------- */
async function renderMyTasks() {
  document.getElementById('app').innerHTML = appShell(t('my.tasks'));
  setupLangToggle();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const pwBtn = document.getElementById('pw-btn');
  if (pwBtn) pwBtn.addEventListener('click', changePasswordModal);

  const root = document.getElementById('app');
  root.insertAdjacentHTML('beforeend', `<div id="my-tasks-body"><div class="loading">${esc(t('loading'))}</div></div>`);

  let tasks = [];
  try { tasks = await api.myTasks(); } catch (e) { /* empty */ }

  const body = document.getElementById('my-tasks-body');
  if (!tasks.length) {
    body.innerHTML = `<div class="empty"><div class="big">📋</div><h3>${esc(t('no.tasks.assigned'))}</h3><p>${esc(t('no.tasks.assigned.sub'))}</p></div>`;
    return;
  }
  body.innerHTML = `
    <div class="my-tasks-wrap">
      <table class="data-table">
        <thead><tr>
          <th>${esc(t('f.eventname'))}</th>
          <th>${esc(t('f.title'))}</th>
          <th>${esc(t('task.members'))}</th>
          <th>${esc(t('f.status'))}</th>
          <th>${esc(t('f.importance'))}</th>
          <th>${esc(t('f.due'))}</th>
        </tr></thead>
        <tbody>
          ${tasks.map((task) => `
            <tr>
              <td>${esc(task.event_name)}${task.event_date ? `<div class="table-sub">${esc(fmtDate(task.event_date))}</div>` : ''}</td>
              <td>${esc(task.title)}${task.description ? `<div class="table-sub">${esc(task.description)}</div>` : ''}</td>
              <td>${task.members && task.members.length ? `<div class="my-tasks-members">${task.members.map((mm) => `<span class="assignee">${mm.photo ? `<img class="avatar-mini" src="${mm.photo}" alt="">` : `<span class="avatar-mini">${esc(initials(mm.name))}</span>`} ${esc(mm.name)}</span>`).join('')}</div>` : esc(t('task.no.assignees'))}</td>
              <td>${esc(t(task.status === 'in_progress' ? 'col.in_progress' : task.status === 'done' ? 'col.done' : 'col.todo'))}</td>
              <td><span class="badge imp-${esc(task.importance)}">${esc(t('imp.' + task.importance))}</span></td>
              <td>${task.due_date ? esc(fmtDate(task.due_date)) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ---------- dashboard ---------- */
let allEvents = [];

async function renderDashboard() {
  document.getElementById('app').innerHTML = appShell(t('app.tagline'));
  const actions = document.querySelector('.topbar-actions');
  if (isAdmin()) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.innerHTML = `${icon('plus', 15)} ${esc(t('new.event'))}`;
    btn.addEventListener('click', () => eventFormModal());
    actions.appendChild(btn);
  }
  setupLangToggle();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const usersBtn = document.getElementById('users-btn');
  if (usersBtn) usersBtn.addEventListener('click', usersModal);
  const pwBtn = document.getElementById('pw-btn');
  if (pwBtn) pwBtn.addEventListener('click', changePasswordModal);

  const root = document.getElementById('app');
  root.insertAdjacentHTML('beforeend', `
    <div class="search-row">
      <input class="search-input" id="search" type="text" placeholder="${esc(t('search.events'))}" />
    </div>
    <div class="stats-row">
      <div class="card stat"><div class="num" id="st-events">0</div><div class="lbl">${esc(t('stat.events'))}</div></div>
      <div class="card stat"><div class="num" id="st-members">0</div><div class="lbl">${esc(t('stat.members'))}</div></div>
      <div class="card stat"><div class="num" id="st-tasks">0</div><div class="lbl">${esc(t('stat.tasks'))}</div></div>
      <div class="card stat"><div class="num" id="st-sponsors">0</div><div class="lbl">${esc(t('stat.sponsors'))}</div></div>
    </div>
    <div id="events-grid" class="grid-events"></div>`);

  const search = document.getElementById('search');
  search.addEventListener('input', () => drawEvents(search.value));

  const res = await api.events();
  allEvents = res;
  drawEvents('');
}

function eventColor(e) {
  const colors = ['#3b82f6', '#8b5cf6', '#0d9488', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777'];
  let h = 0;
  for (const ch of String(e.name)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return colors[h % colors.length];
}

function drawEvents(q) {
  const ql = (q || '').toLowerCase().trim();
  const list = allEvents.filter((e) => !ql || e.name.toLowerCase().includes(ql) || (e.location || '').toLowerCase().includes(ql));

  document.getElementById('st-events').textContent = allEvents.length;
  document.getElementById('st-members').textContent = allEvents.reduce((a, e) => a + (e.memberCount || 0), 0);
  document.getElementById('st-tasks').textContent = allEvents.reduce((a, e) => a + (e.taskCount || 0), 0);
  document.getElementById('st-sponsors').textContent = allEvents.reduce((a, e) => a + (e.sponsorCount || 0), 0);

  const grid = document.getElementById('events-grid');
  if (!list.length) {
    const none = !allEvents.length;
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1;">
        <div class="big">📅</div>
        <h3>${esc(t(none ? 'no.events' : 'no.matching'))}</h3>
        <p>${esc(t(none ? 'no.events.sub' : 'no.matching.sub'))}</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((e) => {
    const pct = e.taskCount ? Math.round((e.taskDone / e.taskCount) * 100) : 0;
    return `
      <div class="card event-card" data-id="${e.id}">
        <div class="bar" style="background:${eventColor(e)}"></div>
        <span class="status-badge status-${esc(e.status)}">${esc(t('status.' + e.status))}</span>
        <h3>${esc(e.name)}</h3>
        <div class="meta">
          ${e.date ? `<span>${icon('calendar', 14)} ${esc(fmtDate(e.date))}</span>` : ''}
          ${e.location ? `<span>${icon('pin', 14)} ${esc(e.location)}</span>` : ''}
        </div>
        ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ''}
        <div class="event-stats">
          <div>${icon('users', 13)} <b>${e.memberCount || 0}</b>&nbsp;${esc(t('team.short'))}</div>
          <div>${icon('list', 13)} <b>${e.taskCount || 0}</b>&nbsp;${esc(t('tasks.short'))}</div>
          <div>${icon('gift', 13)} <b>${e.sponsorCount || 0}</b>&nbsp;${esc(t('sponsors.short'))}</div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.event-card').forEach((el) => {
    el.addEventListener('click', () => {
      location.hash = '#/event/' + el.dataset.id;
    });
  });
}

/* ---------- event page ---------- */
const TABS = [
  ['overview', 'tab.overview', 'spark'],
  ['team', 'tab.team', 'users'],
  ['tasks', 'tab.tasks', 'list'],
  ['finances', 'tab.finances', 'banknote'],
  ['participants', 'tab.participants', 'userPlus'],
  ['guests', 'tab.guests', 'star'],
  ['sponsors', 'tab.sponsors', 'gift'],
  ['timeline', 'tab.timeline', 'clock'],
  ['files', 'tab.files', 'paperclip'],
];

let currentEvent = null;
let currentTab = 'overview';

async function renderEventPage(id, tab) {
  currentTab = TABS.some((t2) => t2[0] === tab) ? tab : 'overview';
  try {
    currentEvent = await api.event(id);
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="empty"><div class="big">😕</div><h3>${esc(t('event.notfound'))}</h3></div>`;
    return;
  }
  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <button class="back-link" id="back-btn">${icon('back', 16)} ${esc(t('all.events'))}</button>
      <div class="topbar-actions">
        ${isAdmin() ? `<button class="btn btn-sm" id="users-btn">${icon('users', 14)} ${esc(t('users'))}</button>` : ''}
        <button class="btn btn-sm" id="pw-btn">${esc(t('change.password'))}</button>
        <button class="btn btn-sm" id="logout-btn">${esc(t('logout'))}</button>
        ${langToggleHTML()}
      </div>
    </div>
    <div class="event-header">
      <div class="event-title-block">
        <h2 id="ev-title">…</h2>
        <div class="sub" id="ev-sub"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn" id="edit-event-btn">${icon('pencil', 14)} ${esc(t('edit'))}</button>
        <button class="btn btn-danger" id="del-event-btn">${icon('trash', 14)} ${esc(t('delete'))}</button>
      </div>
    </div>
    <div class="tabs">
      ${TABS.filter(([k]) => canAccess(k, currentEvent.id)).map(([k, label, ic]) => `<button class="tab ${k === currentTab ? 'active' : ''}" data-tab="${k}">${icon(ic, 15)} ${esc(t(label))}</button>`).join('')}
    </div>
    <div id="tab-body"><div class="loading">${esc(t('loading'))}</div></div>`;

  document.getElementById('back-btn').addEventListener('click', () => (location.hash = '#/'));
  document.querySelectorAll('.tab').forEach((t2) =>
    t2.addEventListener('click', () => {
      location.hash = `#/event/${id}/${t2.dataset.tab}`;
    })
  );
  setupLangToggle();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const usersBtn = document.getElementById('users-btn');
  if (usersBtn) usersBtn.addEventListener('click', usersModal);
  const pwBtn = document.getElementById('pw-btn');
  if (pwBtn) pwBtn.addEventListener('click', changePasswordModal);

  if (!isAdmin()) {
    document.getElementById('edit-event-btn').style.display = 'none';
    document.getElementById('del-event-btn').style.display = 'none';
  }
  document.getElementById('edit-event-btn').addEventListener('click', () => eventFormModal(currentEvent));
  document.getElementById('del-event-btn').addEventListener('click', () =>
    confirmDialog(t('delete.event'), t('delete.event.msg', { name: currentEvent.name }), async () => {
      await api.deleteEvent(id);
      toast(t('event.deleted'));
      location.hash = '#/';
    })
  );

  renderEvent();
}

function renderEvent() {
  const ev = currentEvent;
  document.getElementById('ev-title').textContent = ev.name;
  const sub = [];
  if (ev.date) sub.push(`<span>${icon('calendar', 14)} ${esc(fmtDate(ev.date))}</span>`);
  if (ev.location) sub.push(`<span>${icon('pin', 14)} ${esc(ev.location)}</span>`);
  sub.push(`<span class="status-badge status-${esc(ev.status)}">${esc(t('status.' + ev.status))}</span>`);
  document.getElementById('ev-sub').innerHTML = sub.join('');

  const body = document.getElementById('tab-body');
  const renderers = { overview: renderOverview, team: renderTeam, tasks: renderTasks, sponsors: renderSponsors, timeline: renderTimeline, files: renderFiles, finances: renderFinances, participants: renderParticipants, guests: renderGuests };
  body.innerHTML = `<div class="loading">${esc(t('loading'))}</div>`;
  renderers[currentTab]();
}

/* ---------- overview ---------- */
function renderOverview() {
  const ev = currentEvent;
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('ov.details'))}</h3>
      <button class="btn btn-sm" id="ov-edit">${icon('pencil', 13)} ${esc(t('edit'))}</button>
    </div>
    <div class="info-grid">
      <div class="card info-item"><div class="lbl">${esc(t('ov.date'))}</div><div class="val">${ev.date ? esc(fmtDate(ev.date)) : `<span style="color:var(--muted)">${esc(t('not.set'))}</span>`}</div></div>
      <div class="card info-item"><div class="lbl">${esc(t('ov.location'))}</div><div class="val">${ev.location ? esc(ev.location) : `<span style="color:var(--muted)">${esc(t('not.set'))}</span>`}</div></div>
      <div class="card info-item"><div class="lbl">${esc(t('ov.status'))}</div><div class="val"><span class="status-badge status-${esc(ev.status)}">${esc(t('status.' + ev.status))}</span></div></div>
      <div class="card info-item"><div class="lbl">${esc(t('ov.description'))}</div><div class="val">${ev.description ? esc(ev.description) : `<span style="color:var(--muted)">${esc(t('not.set'))}</span>`}</div></div>
    </div>
    <div class="section-head" style="margin-top:26px;">
      <h3>${esc(t('critical'))}</h3>
      <button class="btn btn-sm" id="ov-edit-critical">${icon('pencil', 13)} ${esc(t('edit'))}</button>
    </div>
    <div class="critical-box">
      <div class="lbl">${icon('alert', 15)} ${esc(t('critical.note'))}</div>
      <div class="val" id="critical-val">${ev.critical_info ? esc(ev.critical_info) : `<em style="color:#a8913f">${esc(t('critical.empty'))}</em>`}</div>
    </div>`;

  document.getElementById('ov-edit').addEventListener('click', () => eventFormModal(ev));
  document.getElementById('ov-edit-critical').addEventListener('click', () => {
    openModal(`
      <h3>${esc(t('critical'))}</h3>
      <div class="field"><label>${esc(t('critical.ta'))}</label><textarea id="critical-ta" style="min-height:140px;">${esc(ev.critical_info || '')}</textarea></div>
      <div class="modal-actions"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn btn-primary" id="save-critical">${esc(t('save'))}</button></div>`);
    document.getElementById('save-critical').addEventListener('click', async () => {
      const val = document.getElementById('critical-ta').value;
      currentEvent = await api.updateEvent(ev.id, { critical_info: val });
      toast(t('saved'));
      closeModal();
      renderEvent();
    });
  });
}

/* ---------- team ---------- */
function groupSections(members) {
  const map = new Map();
  for (const m of members) {
    const key = (m.section || '').trim() || '__default__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return [...map.entries()];
}

function renderTeam() {
  const ev = currentEvent;
  const members = ev.members || [];
  const groups = groupSections(members);
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('team.count', { n: members.length }))}</h3>
      <button class="btn btn-sm btn-primary" id="add-member">${icon('plus', 14)} ${esc(t('add.member'))}</button>
    </div>
    ${
      members.length
        ? groups.map(([key, list]) => {
            const label = key === '__default__' ? t('sec.default') : key;
            const heads = list.filter((m) => m.section_head);
            return `
            <div class="team-section">
              <div class="team-section-head">
                <h4>${icon('users', 15)} ${esc(label)}</h4>
                <span class="sec-count">${esc(t('sec.members', { n: list.length }))}</span>
                ${heads.length ? `<span class="sec-heads">${icon('spark', 13)} ${esc(t('sec.heads', { name: heads.map((h) => h.name).join(', ') }))}</span>` : ''}
              </div>
              <div class="member-grid">
                ${list.map(memberCard).join('')}
              </div>
            </div>`;
          }).join('')
        : emptyBlock('👥', t('no.members'), t('no.members.sub'))
    }`;

  if (canWriteTab('team', currentEvent.id)) document.getElementById('add-member').addEventListener('click', () => memberFormModal());
  else { const b = document.getElementById('add-member'); if (b) b.style.display = 'none'; }
  bindRowActions('.member-card', 'member-actions');
}

function memberCard(m) {
  return `
    <div class="card member-card" data-type="member" data-id="${m.id}">
      ${avatarHTML(m, '')}
      <div class="member-info">
        <div class="name">
          ${esc(m.name)}
          ${m.section_head ? `<span class="tag tag-head" title="${esc(t('sec.head'))}">${icon('spark', 10)} ${esc(t('sec.head'))}</span>` : ''}
        </div>
        ${m.role ? `<div class="role">${esc(m.role)}</div>` : ''}
        ${m.section ? `<div class="sec-tag">${icon('users', 12)} ${esc(m.section)}</div>` : ''}
        <div class="detail">
          ${m.id_number ? `<span>${icon('idcard', 13)} ${esc(m.id_number)}</span>` : ''}
          ${m.phone ? `<span>${icon('phone', 13)} ${esc(m.phone)}</span>` : ''}
          ${m.notes ? `<span style="color:var(--muted)">${esc(m.notes)}</span>` : ''}
        </div>
      </div>
      <div class="member-actions">
        <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function memberFormModal(member) {
  const m = member || { name: '', role: '', id_number: '', phone: '', notes: '', photo: '', section: '', section_head: false };
  const state = { photo: m.photo || '' };
  openModal(`
    <h3>${esc(t(member ? 'member.edit' : 'member.add'))}</h3>
    <div class="field" style="margin-bottom:12px;"><label>${esc(t('f.name'))}</label><input id="m-name" value="${esc(m.name)}" placeholder="${esc(t('ph.name'))}" /></div>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.role'))}</label><input id="m-role" value="${esc(m.role)}" placeholder="${esc(t('ph.role'))}" /></div>
      <div class="field"><label>${esc(t('f.section'))}</label><input id="m-section" value="${esc(m.section)}" placeholder="${esc(t('ph.section'))}" list="section-list" /></div>
      <div class="field"><label>${esc(t('f.idnum'))}</label><input id="m-idnum" value="${esc(m.id_number)}" placeholder="${esc(t('ph.idnum'))}" /></div>
      <div class="field"><label>${esc(t('f.phone'))}</label><input id="m-phone" value="${esc(m.phone)}" placeholder="${esc(t('ph.phone'))}" /></div>
      <div class="field full" style="display:flex;align-items:center;gap:10px;background:#f1f3f8;border:1px solid var(--border);border-radius:9px;padding:10px 12px;">
        <input id="m-head" type="checkbox" style="width:18px;height:18px;accent-color:var(--accent);" ${m.section_head ? 'checked' : ''} />
        <label for="m-head" style="margin:0;cursor:pointer;">${icon('spark', 14)} ${esc(t('f.sectionhead'))}</label>
      </div>
      <div class="field full"><label>${esc(t('f.photo'))}</label><div id="m-photo"></div></div>
      <div class="field full"><label>${esc(t('f.notes'))}</label><textarea id="m-notes">${esc(m.notes)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="m-save">${esc(t(member ? 'save.changes' : 'member.add'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        const sections = [...new Set((currentEvent.members || []).map((x) => (x.section || '').trim()).filter(Boolean))];
        if (sections.length) {
          const dl = document.createElement('datalist');
          dl.id = 'section-list';
          sections.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s;
            dl.appendChild(opt);
          });
          document.body.appendChild(dl);
        }
        overlay.querySelector('#m-photo').appendChild(photoField(state));
        overlay.querySelector('#m-save').addEventListener('click', async () => {
          const body = {
            name: document.getElementById('m-name').value,
            role: document.getElementById('m-role').value,
            section: document.getElementById('m-section').value,
            id_number: document.getElementById('m-idnum').value,
            phone: document.getElementById('m-phone').value,
            notes: document.getElementById('m-notes').value,
            photo: state.photo,
            section_head: document.getElementById('m-head').checked,
          };
          if (!body.name.trim()) return toast(t('name.req'));
          if (member) await api.updateMember(currentEvent.id, member.id, body);
          else await api.addMember(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(member ? t('member.updated') : t('member.added'));
          closeModal();
          renderTeam();
        });
      },
    }
  );
}

/* ---------- tasks ---------- */
const TASK_COLS = [
  ['todo', 'col.todo', '#94a3b8'],
  ['in_progress', 'col.in_progress', '#3b82f6'],
  ['done', 'col.done', '#16a34a'],
];
const IMPORTANCE = ['low', 'medium', 'high', 'critical'];

function renderTasks() {
  const ev = currentEvent;
  const tasks = ev.tasks || [];
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('tasks.count', { n: tasks.length }))}</h3>
      <button class="btn btn-sm btn-primary" id="add-task">${icon('plus', 14)} ${esc(t('new.task'))}</button>
    </div>
    <div class="task-layout">
      ${TASK_COLS.map(([key, label, color]) => {
        const list = tasks.filter((t2) => t2.status === key);
        return `
          <div>
            <div class="task-col-head">
              <span><span class="dot" style="background:${color}"></span>${esc(t(label))}</span>
              <span class="count">${list.length}</span>
            </div>
            ${list.length ? list.map((t2) => taskCard(t2)).join('') : `<div style="color:var(--muted);font-size:13px;text-align:center;padding:18px 0;border:1.5px dashed var(--border);border-radius:10px;">${esc(t('empty'))}</div>`}
          </div>`;
      }).join('')}
    </div>`;

  if (canWriteTab('tasks', currentEvent.id)) document.getElementById('add-task').addEventListener('click', () => taskFormModal());
  else { const b = document.getElementById('add-task'); if (b) b.style.display = 'none'; }
  bindRowActions('.task-card', 'task-actions');
  document.querySelectorAll('.task-card [data-status]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const id = sel.closest('.task-card').dataset.id;
      const task = currentEvent.tasks.find((x) => String(x.id) === id);
      await api.updateTask(currentEvent.id, task.id, { ...task, status: sel.value, memberIds: task.memberIds });
      currentEvent = await api.event(currentEvent.id);
      toast(t('status.updated'));
      renderTasks();
    });
  });
}

function taskCard(task) {
  return `
    <div class="card task-card" data-id="${task.id}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <h4>${esc(task.title)}</h4>
        <span class="badge imp-${esc(task.importance)}">${esc(t('imp.' + task.importance))}</span>
      </div>
      ${task.description ? `<div class="desc">${esc(task.description)}</div>` : ''}
      ${task.due_date ? `<div class="due">${icon('clock', 13)} ${esc(t('due', { d: fmtDate(task.due_date) }))}</div>` : ''}
      ${task.members && task.members.length ? `
        <div class="assignees">
          ${task.members.map((mm) => `<span class="assignee">${mm.photo ? `<img class="avatar-mini" src="${mm.photo}" alt="">` : `<span class="avatar-mini">${esc(initials(mm.name))}</span>`} ${esc(mm.name)}</span>`).join('')}
        </div>` : ''}
      ${isAdmin() && task.assignees && task.assignees.length ? `
        <div class="assignees assigned-users">
          <span class="assigned-label">${icon('users', 12)} ${esc(t('task.assigned.to'))}:</span>
          ${task.assignees.map((au) => `<span class="assignee">${esc(au.username)}</span>`).join('')}
        </div>` : ''}
      <div class="task-actions">
        <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
      <select class="status-select" data-status>
        ${TASK_COLS.map(([k, l]) => `<option value="${k}" ${task.status === k ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}
      </select>
    </div>`;
}

function taskFormModal(task) {
  const d = task || { title: '', description: '', status: 'todo', importance: 'medium', due_date: '', memberIds: [], assigneeIds: [] };
  const members = currentEvent.members || [];
  openModal(`
    <h3>${esc(t(task ? 'task.edit' : 'task.new'))}</h3>
    <div class="field" style="margin-bottom:12px;"><label>${esc(t('f.title'))}</label><input id="t-title" value="${esc(d.title)}" placeholder="${esc(t('ph.title'))}" /></div>
    <div class="field" style="margin-bottom:12px;"><label>${esc(t('f.desc'))}</label><textarea id="t-desc">${esc(d.description)}</textarea></div>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.status'))}</label><select id="t-status">${TASK_COLS.map(([k, l]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(t('f.importance'))}</label><select id="t-importance">${IMPORTANCE.map((i) => `<option value="${i}" ${d.importance === i ? 'selected' : ''}>${esc(t('imp.' + i))}</option>`).join('')}</select></div>
      <div class="field full"><label>${esc(t('f.due'))}</label><input id="t-due" type="date" value="${esc(d.due_date)}" /></div>
      ${members.length ? `<div class="field full"><label>${esc(t('f.assign'))}</label><div id="t-members" style="display:flex;flex-wrap:wrap;gap:8px;"></div></div>` : ''}
      ${isAdmin() ? `<div class="field full"><label>${esc(t('f.assign.users'))}</label><div id="t-users" style="display:flex;flex-wrap:wrap;gap:8px;"></div></div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="t-save">${esc(t(task ? 'save.changes' : 'task.new'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        const box = overlay.querySelector('#t-members');
        if (box) {
          members.forEach((mm) => {
            const lab = document.createElement('label');
            lab.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#f1f3f8;border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:13px;font-weight:600;cursor:pointer;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = mm.id;
            cb.checked = (d.memberIds || []).includes(mm.id);
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(mm.name));
            box.appendChild(lab);
          });
        }
        const userBox = overlay.querySelector('#t-users');
        if (userBox) {
          api.assigneeUsers().then((users) => {
            if (!users.length) {
              const note = document.createElement('div');
              note.style.cssText = 'color:var(--muted);font-size:13px;';
              note.textContent = t('no.users.assigned');
              userBox.appendChild(note);
              return;
            }
            users.forEach((u) => {
              const lab = document.createElement('label');
              lab.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#f1f3f8;border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:13px;font-weight:600;cursor:pointer;';
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.value = u.id;
              cb.checked = (d.assigneeIds || []).includes(Number(u.id));
              lab.appendChild(cb);
              lab.appendChild(document.createTextNode(u.username));
              userBox.appendChild(lab);
            });
          }).catch(() => {});
        }
        overlay.querySelector('#t-save').addEventListener('click', async () => {
          const body = {
            title: document.getElementById('t-title').value,
            description: document.getElementById('t-desc').value,
            status: document.getElementById('t-status').value,
            importance: document.getElementById('t-importance').value,
            due_date: document.getElementById('t-due').value,
            memberIds: box ? [...box.querySelectorAll('input:checked')].map((c) => Number(c.value)) : [],
            assigneeIds: userBox ? [...userBox.querySelectorAll('input:checked')].map((c) => Number(c.value)) : [],
          };
          if (!body.title.trim()) return toast(t('title.req'));
          if (task) await api.updateTask(currentEvent.id, task.id, body);
          else await api.addTask(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(task ? t('task.updated') : t('task.added'));
          closeModal();
          renderTasks();
        });
      },
    }
  );
}

/* ---------- sponsors ---------- */
const CT_TYPES = ['money', 'in-kind', 'services'];
const SP_STATUS = ['contacted', 'confirmed', 'declined'];

function renderSponsors() {
  const ev = currentEvent;
  const sponsors = ev.sponsors || [];
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('sponsors.count', { n: sponsors.length }))}</h3>
      <button class="btn btn-sm btn-primary" id="add-sponsor">${icon('plus', 14)} ${esc(t('add.sponsor'))}</button>
    </div>
    <div class="sponsor-grid">
      ${sponsors.length ? sponsors.map(sponsorCard).join('') : emptyBlock('🤝', t('no.sponsors'), t('no.sponsors.sub'))}
    </div>`;

  if (canWriteTab('sponsors', currentEvent.id)) document.getElementById('add-sponsor').addEventListener('click', () => sponsorFormModal());
  else { const b = document.getElementById('add-sponsor'); if (b) b.style.display = 'none'; }
  bindRowActions('.sponsor-card', 'sponsor-actions');
}

function sponsorCard(s) {
  return `
    <div class="card sponsor-card" data-id="${s.id}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div>
          <h4>${esc(s.name)}</h4>
          ${s.company ? `<div class="company">${esc(s.company)}</div>` : ''}
        </div>
        <span class="status-badge status-${esc(s.status)}">${esc(t('sp.' + s.status))}</span>
      </div>
      <div class="detail">
        ${s.email ? `<span>${icon('idcard', 14)} ${esc(s.email)}</span>` : ''}
        ${s.phone ? `<span>${icon('phone', 14)} ${esc(s.phone)}</span>` : ''}
      </div>
      <div class="contribution">
        <span class="ct-type ct-${esc(s.contribution_type)}">${esc(t('ct.' + s.contribution_type))}</span>
        &nbsp; <b>${esc(s.contribution_amount || '—')}</b>
        ${s.description ? `<div style="margin-top:4px;color:var(--muted);font-size:12.5px;">${esc(s.description)}</div>` : ''}
      </div>
      ${s.notes ? `<div style="margin-top:8px;font-size:13px;color:var(--muted)">${icon('alert', 12)} ${esc(s.notes)}</div>` : ''}
      <div class="sponsor-actions">
        <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function sponsorFormModal(sponsor) {
  const s = sponsor || { name: '', company: '', email: '', phone: '', contribution_type: 'money', contribution_amount: '', description: '', status: 'confirmed', notes: '' };
  openModal(`
    <h3>${esc(t(sponsor ? 'sponsor.edit' : 'sponsor.add'))}</h3>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.contact'))}</label><input id="s-name" value="${esc(s.name)}" placeholder="${esc(t('ph.contact'))}" /></div>
      <div class="field"><label>${esc(t('f.company'))}</label><input id="s-company" value="${esc(s.company)}" placeholder="${esc(t('ph.company'))}" /></div>
      <div class="field"><label>${esc(t('f.email'))}</label><input id="s-email" value="${esc(s.email)}" placeholder="contact@example.com" /></div>
      <div class="field"><label>${esc(t('f.phone'))}</label><input id="s-phone" value="${esc(s.phone)}" placeholder="${esc(t('ph.phone'))}" /></div>
      <div class="field"><label>${esc(t('f.ct'))}</label><select id="s-ct">${CT_TYPES.map((ct) => `<option value="${ct}" ${s.contribution_type === ct ? 'selected' : ''}>${esc(t('ct.' + ct))}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(t('f.amount'))}</label><input id="s-amount" value="${esc(s.contribution_amount)}" placeholder="${esc(t('ph.amount'))}" /></div>
      <div class="field"><label>${esc(t('f.cstatus'))}</label><select id="s-status">${SP_STATUS.map((st) => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${esc(t('sp.' + st))}</option>`).join('')}</select></div>
      <div class="field"><label>${esc(t('f.cdesc'))}</label><input id="s-desc" value="${esc(s.description)}" placeholder="${esc(t('f.cdesc'))}" /></div>
      <div class="field full"><label>${esc(t('f.notes'))}</label><textarea id="s-notes">${esc(s.notes)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="s-save">${esc(t(sponsor ? 'save.changes' : 'sponsor.add'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        overlay.querySelector('#s-save').addEventListener('click', async () => {
          const body = {
            name: document.getElementById('s-name').value,
            company: document.getElementById('s-company').value,
            email: document.getElementById('s-email').value,
            phone: document.getElementById('s-phone').value,
            contribution_type: document.getElementById('s-ct').value,
            contribution_amount: document.getElementById('s-amount').value,
            status: document.getElementById('s-status').value,
            description: document.getElementById('s-desc').value,
            notes: document.getElementById('s-notes').value,
          };
          if (!body.name.trim()) return toast(t('name.req'));
          if (sponsor) await api.updateSponsor(currentEvent.id, sponsor.id, body);
          else await api.addSponsor(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(sponsor ? t('sponsor.updated') : t('sponsor.added'));
          closeModal();
          renderSponsors();
        });
      },
    }
  );
}

/* ---------- timeline ---------- */
const TL_CATS = ['milestone', 'prep', 'deadline'];

function dayDiff(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function tlDueBadge(item) {
  if (!item.datetime) return '';
  const diff = dayDiff(item.datetime);
  if (diff === null || item.done) return '';
  let cls, txt;
  if (diff < 0) {
    cls = 'overdue';
    txt = diff === -1 ? t('day.overdue') : t('days.overdue', { n: Math.abs(diff) });
  } else if (diff === 0) {
    cls = 'soon';
    txt = t('today');
  } else {
    cls = 'soon';
    txt = diff === 1 ? t('day.left') : t('days.left', { n: diff });
  }
  return `<span class="tl-badge ${cls}">${icon('clock', 11)} ${esc(txt)}</span>`;
}

function renderTimeline() {
  const ev = currentEvent;
  const items = ev.timeline || [];
  const sorted = [...items].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const done = sorted.filter((i) => i.done).length;
  const pct = sorted.length ? Math.round((done / sorted.length) * 100) : 0;
  const overdueCnt = sorted.filter((i) => !i.done && i.datetime && dayDiff(i.datetime) < 0).length;

  document.getElementById('tab-body').innerHTML = sorted.length ? `
    <div class="section-head">
      <h3>${esc(t('timeline.count', { n: sorted.length }))}</h3>
      <div class="tl-tools">
        ${overdueCnt ? `<span class="tl-badge overdue">${esc(t('overdue.count', { n: overdueCnt }))}</span>` : ''}
        <div class="tl-progress" title="${esc(t('done.count', { n: done, m: sorted.length }))}"><span style="width:${pct}%"></span></div>
        <span class="tl-count">${esc(t('done.count', { n: done, m: sorted.length }))}</span>
        <button class="btn btn-sm btn-primary" id="add-tl">${icon('plus', 14)} ${esc(t('add.entry'))}</button>
      </div>
    </div>
    <div class="timeline">
      ${sorted.map((i) => tlCard(i)).join('')}
    </div>`
    : `
    <div class="section-head">
      <h3>${esc(t('timeline.count', { n: 0 }))}</h3>
      <button class="btn btn-sm btn-primary" id="add-tl">${icon('plus', 14)} ${esc(t('add.entry'))}</button>
    </div>
    <div class="empty"><div class="big">🗓️</div><h3>${esc(t('no.tl'))}</h3><p>${esc(t('no.tl.sub'))}</p></div>`;

  if (canWriteTab('timeline', currentEvent.id)) document.getElementById('add-tl').addEventListener('click', () => tlFormModal());
  else { const b = document.getElementById('add-tl'); if (b) b.style.display = 'none'; }
  bindRowActions('.tl-item', 'tl-actions');
  document.querySelectorAll('.tl-item input[data-done]').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      const item = currentEvent.timeline.find((x) => String(x.id) === e.target.closest('.tl-item').dataset.id);
      await api.updateTimelineItem(currentEvent.id, item.id, { ...item, done: e.target.checked });
      currentEvent = await api.event(currentEvent.id);
      renderTimeline();
    });
  });
}

function tlCard(item) {
  const overdue = !item.done && item.datetime && dayDiff(item.datetime) < 0;
  return `
    <div class="tl-item ${item.done ? 'done' : ''}${overdue ? ' overdue' : ''}" data-id="${item.id}">
      <div class="tl-card">
        <div class="tl-body">
          <h4>
            <span class="badge ct-${esc(item.category)}">${esc(t('tl.' + item.category))}</span>
            ${esc(item.title)}
          </h4>
          ${item.description ? `<div class="desc">${esc(item.description)}</div>` : ''}
          <div class="tl-meta">
            ${item.datetime ? `<span class="tl-date">${icon('clock', 12)} ${esc(fmtDateTime(item.datetime))}</span>` : ''}
            ${tlDueBadge(item)}
          </div>
        </div>
        <div class="tl-check" title="${esc(t('mark.done'))}">
          <input type="checkbox" data-done ${item.done ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--green);cursor:pointer;">
        </div>
        <div class="tl-actions">
          <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
          <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
        </div>
      </div>
    </div>`;
}

function tlFormModal(item) {
  const d = item || { title: '', description: '', datetime: '', category: 'milestone' };
  openModal(`
    <h3>${esc(t(item ? 'tl.edit' : 'tl.add'))}</h3>
    <div class="field" style="margin-bottom:12px;"><label>${esc(t('f.title'))}</label><input id="tl-title" value="${esc(d.title)}" placeholder="${esc(t('ph.tl'))}" /></div>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.datetime'))}</label><input id="tl-datetime" type="datetime-local" value="${esc((d.datetime || '').slice(0, 16))}" /></div>
      <div class="field"><label>${esc(t('f.category'))}</label><select id="tl-cat">${TL_CATS.map((c) => `<option value="${c}" ${d.category === c ? 'selected' : ''}>${esc(t('tl.' + c))}</option>`).join('')}</select></div>
      <div class="field full"><label>${esc(t('f.desc'))}</label><textarea id="tl-desc">${esc(d.description)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="tl-save">${esc(t(item ? 'save.changes' : 'tl.add'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        overlay.querySelector('#tl-save').addEventListener('click', async () => {
          const body = {
            title: document.getElementById('tl-title').value,
            description: document.getElementById('tl-desc').value,
            datetime: document.getElementById('tl-datetime').value,
            category: document.getElementById('tl-cat').value,
          };
          if (!body.title.trim()) return toast(t('title.req'));
          if (item) await api.updateTimelineItem(currentEvent.id, item.id, body);
          else await api.addTimelineItem(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(item ? t('tl.updated') : t('tl.added'));
          closeModal();
          renderTimeline();
        });
      },
    }
  );
}

/* ---------- files ---------- */
function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function renderFiles() {
  const ev = currentEvent;
  const files = ev.files || [];
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('files.count', { n: files.length }))}</h3>
      <button class="btn btn-sm btn-primary" id="upload-file">${icon('plus', 14)} ${esc(t('upload.file'))}</button>
      <input type="file" id="file-input" class="hidden" multiple />
    </div>
    ${
      files.length
        ? `<div class="file-list">${files.map(fileCard).join('')}</div>`
        : emptyBlock('📁', t('no.files'), t('no.files.sub'))
    }`;

  const btn = document.getElementById('upload-file');
  const input = document.getElementById('file-input');
  if (!canWriteTab('files', currentEvent.id)) {
    btn.style.display = 'none';
  } else {
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const list = [...input.files];
      input.value = '';
      if (!list.length) return;
      btn.disabled = true;
      btn.innerHTML = `${icon('plus', 14)} ${esc(t('file.uploading'))}`;
      try {
        for (const f of list) {
          if (f.size > 50 * 1024 * 1024) { toast(t('file.too.large')); continue; }
          const data = await readAsBase64(f);
          await api.addFile(currentEvent.id, { name: f.name, mime: f.type, data });
        }
        currentEvent = await api.event(currentEvent.id);
        toast(t('file.uploaded'));
        renderFiles();
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${icon('plus', 14)} ${esc(t('upload.file'))}`;
      }
    });
  }
  bindRowActions('.file-card', 'file-actions');
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileCard(f) {
  return `
    <div class="card file-card" data-id="${f.id}">
      <div class="file-ic">${icon('folder', 20)}</div>
      <div class="file-info">
        <div class="file-name">${esc(f.name)}</div>
        <div class="file-meta">${esc(fmtBytes(f.size))} · ${esc(fmtDateTime(f.created_at))}</div>
      </div>
      <div class="file-actions">
        <a class="btn btn-sm" href="${esc(api.downloadUrl(currentEvent.id, f.id))}" download>${icon('download', 14)} ${esc(t('download'))}</a>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

/* ---------- finances ---------- */
function fmtMoney(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat(LANG === 'fa' ? 'fa-IR' : undefined, { maximumFractionDigits: 2 }).format(v);
}

function renderFinances() {
  const ev = currentEvent;
  const tx = ev.finances || [];
  const income = tx.filter((x) => x.type === 'income').reduce((a, x) => a + Number(x.amount), 0);
  const expense = tx.filter((x) => x.type === 'expense').reduce((a, x) => a + Number(x.amount), 0);
  const balance = income - expense;
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('fin.count', { n: tx.length }))}</h3>
      <button class="btn btn-sm btn-primary" id="add-fin">${icon('plus', 14)} ${esc(t('add.transaction'))}</button>
    </div>
    <div class="fin-summary">
      <div class="card stat fin-income"><div class="num">+${esc(fmtMoney(income))}</div><div class="lbl">${icon('trendingUp', 13)} ${esc(t('fin.income'))}</div></div>
      <div class="card stat fin-expense"><div class="num">-${esc(fmtMoney(expense))}</div><div class="lbl">${icon('trendingDown', 13)} ${esc(t('fin.expense'))}</div></div>
      <div class="card stat ${balance >= 0 ? 'fin-bal-pos' : 'fin-bal-neg'}"><div class="num">${balance >= 0 ? '+' : '-'}${esc(fmtMoney(Math.abs(balance)))}</div><div class="lbl">${icon('banknote', 13)} ${esc(t('fin.balance'))}</div></div>
    </div>
    ${tx.length ? `<div class="fin-list">${tx.map(financeCard).join('')}</div>` : emptyBlock('💰', t('no.fin'), t('no.fin.sub'))}`;

  if (canWriteTab('finances', currentEvent.id)) document.getElementById('add-fin').addEventListener('click', () => financeFormModal());
  else { const b = document.getElementById('add-fin'); if (b) b.style.display = 'none'; }
  bindRowActions('.fin-card', 'fin-actions');
}

function financeCard(f) {
  const inc = f.type === 'income';
  return `
    <div class="card fin-card" data-id="${f.id}">
      <div class="fin-ic ${inc ? 'ic-in' : 'ic-out'}">${icon(inc ? 'trendingUp' : 'trendingDown', 18)}</div>
      <div class="fin-info">
        <div class="fin-title">
          ${esc(f.title)}
          <span class="fin-type ${inc ? 'ft-in' : 'ft-out'}">${esc(t(inc ? 'fin.income2' : 'fin.expense2'))}</span>
        </div>
        <div class="fin-meta">
          ${f.category ? `<span>${icon('folder', 12)} ${esc(f.category)}</span>` : ''}
          ${f.date ? `<span>${icon('calendar', 12)} ${esc(fmtDate(f.date))}</span>` : ''}
        </div>
        ${f.notes ? `<div class="desc">${esc(f.notes)}</div>` : ''}
      </div>
      <div class="fin-amount ${inc ? 'am-in' : 'am-out'}">${inc ? '+' : '-'}${esc(fmtMoney(f.amount))}</div>
      <div class="fin-actions">
        <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function financeFormModal(item) {
  const f = item || { type: 'expense', title: '', amount: '', category: '', date: '', notes: '' };
  openModal(`
    <h3>${esc(t(item ? 'fin.edit' : 'fin.add'))}</h3>
    <div class="form-grid">
      <div class="field"><label>${esc(t('fin.type'))}</label><select id="f-type">
        <option value="expense" ${f.type === 'expense' ? 'selected' : ''}>${esc(t('fin.expense2'))}</option>
        <option value="income" ${f.type === 'income' ? 'selected' : ''}>${esc(t('fin.income2'))}</option>
      </select></div>
      <div class="field"><label>${esc(t('fin.amount'))} *</label><input id="f-amount" type="number" step="any" value="${esc(f.amount)}" placeholder="0" /></div>
      <div class="field"><label>${esc(t('f.title'))}</label><input id="f-title" value="${esc(f.title)}" placeholder="${esc(t('ph.fintitle'))}" /></div>
      <div class="field"><label>${esc(t('f.category'))}</label><input id="f-category" value="${esc(f.category)}" placeholder="${esc(t('ph.fincat'))}" list="fin-cat-list" /></div>
      <div class="field full"><label>${esc(t('f.date'))}</label><input id="f-date" type="date" value="${esc(f.date)}" /></div>
      <div class="field full"><label>${esc(t('f.notes'))}</label><textarea id="f-notes">${esc(f.notes)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="f-save">${esc(t(item ? 'save.changes' : 'fin.add'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        const cats = [...new Set((currentEvent.finances || []).map((x) => x.category).filter(Boolean))];
        if (cats.length) {
          const dl = document.createElement('datalist');
          dl.id = 'fin-cat-list';
          cats.forEach((c) => { const o = document.createElement('option'); o.value = c; dl.appendChild(o); });
          document.body.appendChild(dl);
        }
        overlay.querySelector('#f-save').addEventListener('click', async () => {
          const body = {
            type: document.getElementById('f-type').value,
            title: document.getElementById('f-title').value,
            amount: document.getElementById('f-amount').value,
            category: document.getElementById('f-category').value,
            date: document.getElementById('f-date').value,
            notes: document.getElementById('f-notes').value,
          };
          if (!body.title.trim() || body.amount === '') return toast(t('fin.req'));
          if (item) await api.updateFinance(currentEvent.id, item.id, body);
          else await api.addFinance(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(item ? t('fin.updated') : t('fin.added'));
          closeModal();
          renderFinances();
        });
      },
    }
  );
}

/* ---------- participants ---------- */
function renderParticipants() {
  const ev = currentEvent;
  const list = ev.participants || [];
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('part.count', { n: list.length }))}</h3>
      <button class="btn btn-sm btn-primary" id="add-part">${icon('plus', 14)} ${esc(t('add.participant'))}</button>
    </div>
    <div class="member-grid">
      ${list.length ? list.map(participantCard).join('') : emptyBlock('🧑‍🤝‍🧑', t('no.participants'), t('no.participants.sub'))}
    </div>`;

  if (canWriteTab('participants', currentEvent.id)) document.getElementById('add-part').addEventListener('click', () => participantFormModal());
  else { const b = document.getElementById('add-part'); if (b) b.style.display = 'none'; }
  bindRowActions('.member-card', 'member-actions');
}

function participantCard(p) {
  return `
    <div class="card member-card" data-type="participant" data-id="${p.id}">
      <span class="avatar">${esc(initials(p.name))}</span>
      <div class="member-info">
        <div class="name">${esc(p.name)} <span class="tag pt-${esc(p.type)}">${esc(t('part.type.' + p.type))}</span></div>
        ${p.organization ? `<div class="role">${icon('users', 12)} ${esc(p.organization)}</div>` : ''}
        <div class="detail">
          ${p.contact ? `<span>${icon('phone', 13)} ${esc(p.contact)}</span>` : ''}
          ${p.notes ? `<span style="color:var(--muted)">${esc(p.notes)}</span>` : ''}
        </div>
      </div>
      <div class="member-actions">
        <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function participantFormModal(item) {
  const p = item || { type: 'person', name: '', organization: '', contact: '', notes: '' };
  openModal(`
    <h3>${esc(t(item ? 'part.edit' : 'part.add'))}</h3>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.type'))}</label><select id="p-type">
        <option value="person" ${p.type === 'person' ? 'selected' : ''}>${esc(t('part.type.person'))}</option>
        <option value="team" ${p.type === 'team' ? 'selected' : ''}>${esc(t('part.type.team'))}</option>
      </select></div>
      <div class="field"><label>${esc(t('f.name'))}</label><input id="p-name" value="${esc(p.name)}" placeholder="${esc(t('ph.name'))}" /></div>
      <div class="field full"><label>${esc(t('f.organization'))}</label><input id="p-org" value="${esc(p.organization)}" placeholder="${esc(t('ph.company'))}" /></div>
      <div class="field full"><label>${esc(t('f.contactinfo'))}</label><input id="p-contact" value="${esc(p.contact)}" placeholder="${esc(t('ph.phone'))}" /></div>
      <div class="field full"><label>${esc(t('f.notes'))}</label><textarea id="p-notes">${esc(p.notes)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="p-save">${esc(t(item ? 'save.changes' : 'part.add'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        overlay.querySelector('#p-save').addEventListener('click', async () => {
          const body = {
            type: document.getElementById('p-type').value,
            name: document.getElementById('p-name').value,
            organization: document.getElementById('p-org').value,
            contact: document.getElementById('p-contact').value,
            notes: document.getElementById('p-notes').value,
          };
          if (!body.name.trim()) return toast(t('name.req'));
          if (item) await api.updateParticipant(currentEvent.id, item.id, body);
          else await api.addParticipant(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(item ? t('part.updated') : t('part.added'));
          closeModal();
          renderParticipants();
        });
      },
    }
  );
}

/* ---------- guests ---------- */
const G_STATUS = ['invited', 'confirmed', 'declined', 'attended'];

function renderGuests() {
  const ev = currentEvent;
  const list = ev.guests || [];
  const seats = list.reduce((a, g) => a + Number(g.guests_count || 1), 0);
  document.getElementById('tab-body').innerHTML = `
    <div class="section-head">
      <h3>${esc(t('guests.count', { n: list.length }))}</h3>
      <div style="display:flex;gap:10px;align-items:center;">
        ${list.length ? `<span class="sec-count">${esc(t('guests.total', { n: seats }))}</span>` : ''}
        <button class="btn btn-sm btn-primary" id="add-guest">${icon('plus', 14)} ${esc(t('add.guest'))}</button>
      </div>
    </div>
    <div class="member-grid">
      ${list.length ? list.map(guestCard).join('') : emptyBlock('🎉', t('no.guests'), t('no.guests.sub'))}
    </div>`;

  if (canWriteTab('guests', currentEvent.id)) document.getElementById('add-guest').addEventListener('click', () => guestFormModal());
  else { const b = document.getElementById('add-guest'); if (b) b.style.display = 'none'; }
  bindRowActions('.member-card', 'member-actions');
}

function guestCard(g) {
  return `
    <div class="card member-card" data-type="guest" data-id="${g.id}">
      <span class="avatar">${esc(initials(g.name))}</span>
      <div class="member-info">
        <div class="name">
          ${esc(g.name)}
          ${Number(g.guests_count) > 1 ? `<span class="tag tag-seats">×${Number(g.guests_count)}</span>` : ''}
        </div>
        <div><span class="status-badge status-${esc(g.status)}">${esc(t('g.' + g.status))}</span></div>
        <div class="detail">
          ${g.contact ? `<span>${icon('phone', 13)} ${esc(g.contact)}</span>` : ''}
          ${g.notes ? `<span style="color:var(--muted)">${esc(g.notes)}</span>` : ''}
        </div>
      </div>
      <div class="member-actions">
        <button class="btn btn-ghost btn-icon" data-act="edit" title="${esc(t('edit'))}">${icon('pencil', 14)}</button>
        <button class="btn btn-ghost btn-icon" data-act="del" title="${esc(t('delete'))}" style="color:var(--red)">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function guestFormModal(item) {
  const g = item || { name: '', contact: '', status: 'invited', guests_count: 1, notes: '' };
  openModal(`
    <h3>${esc(t(item ? 'guest.edit' : 'guest.add'))}</h3>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.name'))}</label><input id="g-name" value="${esc(g.name)}" placeholder="${esc(t('ph.name'))}" /></div>
      <div class="field"><label>${esc(t('f.gstatus'))}</label><select id="g-status">${G_STATUS.map((s) => `<option value="${s}" ${g.status === s ? 'selected' : ''}>${esc(t('g.' + s))}</option>`).join('')}</select></div>
      <div class="field full"><label>${esc(t('f.contact'))}</label><input id="g-contact" value="${esc(g.contact)}" placeholder="${esc(t('ph.phone'))}" /></div>
      <div class="field full"><label>${esc(t('f.guests_count'))}</label><input id="g-count" type="number" min="1" step="1" value="${esc(g.guests_count)}" /></div>
      <div class="field full"><label>${esc(t('f.notes'))}</label><textarea id="g-notes">${esc(g.notes)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="g-save">${esc(t(item ? 'save.changes' : 'guest.add'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        overlay.querySelector('#g-save').addEventListener('click', async () => {
          const body = {
            name: document.getElementById('g-name').value,
            contact: document.getElementById('g-contact').value,
            status: document.getElementById('g-status').value,
            guests_count: document.getElementById('g-count').value,
            notes: document.getElementById('g-notes').value,
          };
          if (!body.name.trim()) return toast(t('name.req'));
          if (item) await api.updateGuest(currentEvent.id, item.id, body);
          else await api.addGuest(currentEvent.id, body);
          currentEvent = await api.event(currentEvent.id);
          toast(item ? t('guest.updated') : t('guest.added'));
          closeModal();
          renderGuests();
        });
      },
    }
  );
}

/* ---------- event form ---------- */
const EV_STATUS = ['upcoming', 'ongoing', 'completed', 'draft'];

function eventFormModal(ev) {
  const e = ev || { name: '', date: '', location: '', status: 'upcoming', description: '' };
  openModal(`
    <h3>${esc(t(ev ? 'edit.event.title' : 'new.event.title'))}</h3>
    <div class="field" style="margin-bottom:12px;"><label>${esc(t('f.eventname'))}</label><input id="e-name" value="${esc(e.name)}" placeholder="${esc(t('ph.eventname'))}" /></div>
    <div class="form-grid">
      <div class="field"><label>${esc(t('f.date'))}</label><input id="e-date" type="date" value="${esc(e.date)}" /></div>
      <div class="field"><label>${esc(t('f.status'))}</label><select id="e-status">${EV_STATUS.map((s) => `<option value="${s}" ${e.status === s ? 'selected' : ''}>${esc(t('status.' + s))}</option>`).join('')}</select></div>
      <div class="field full"><label>${esc(t('f.location'))}</label><input id="e-location" value="${esc(e.location)}" placeholder="${esc(t('ph.location'))}" /></div>
      <div class="field full"><label>${esc(t('f.desc'))}</label><textarea id="e-desc">${esc(e.description)}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-close>${esc(t('cancel'))}</button>
      <button class="btn btn-primary" id="e-save">${esc(t(ev ? 'save.changes' : 'create.event'))}</button>
    </div>`,
    {
      onOpen(overlay) {
        overlay.querySelector('#e-save').addEventListener('click', async () => {
          const body = {
            name: document.getElementById('e-name').value,
            date: document.getElementById('e-date').value,
            location: document.getElementById('e-location').value,
            status: document.getElementById('e-status').value,
            description: document.getElementById('e-desc').value,
          };
          if (!body.name.trim()) return toast(t('event.name.req'));
          try {
            if (ev) {
              const updated = await api.updateEvent(ev.id, body);
              if (!updated) throw new Error('no data');
              currentEvent = updated;
              toast(t('event.updated'));
              closeModal();
              renderEvent();
            } else {
              const created = await api.createEvent(body);
              if (!created || created.id == null) throw new Error('no data');
              toast(t('event.created'));
              closeModal();
              location.hash = '#/event/' + created.id;
            }
          } catch (e) {
            toast(t('event.save.failed') + (e && e.message ? ': ' + e.message : ''));
          }
        });
      },
    }
  );
}

/* ---------- shared ---------- */
function emptyBlock(emoji, title, sub) {
  return `
    <div class="empty" style="grid-column:1/-1;padding:40px;">
      <div class="big">${emoji}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(sub)}</p>
    </div>`;
}

function bindRowActions(selector, actionsClass) {
  const writable = canWriteTab(currentTab, currentEvent.id);
  document.querySelectorAll(selector).forEach((card) => {
    const id = Number(card.dataset.id);
    const type = card.dataset.type;
    card.querySelectorAll('[data-act]').forEach((btn) => {
      const act = btn.dataset.act;
      if ((act === 'edit' || act === 'del') && !writable) {
        btn.remove();
        return;
      }
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (act === 'edit') {
          if (type === 'member') {
            const m = currentEvent.members.find((x) => x.id === id);
            memberFormModal(m);
          } else {
            editByType(id);
          }
        } else if (act === 'del') {
          confirmDialog(t('confirm.delete'), t('confirm.delete.msg'), () => delByType(id), t('delete'));
        }
      });
    });
  });
}

function editByType(id) {
  const tab = currentTab;
  if (tab === 'tasks') {
    const task = currentEvent.tasks.find((x) => x.id === id);
    if (task) taskFormModal(task);
  } else if (tab === 'sponsors') {
    const s = currentEvent.sponsors.find((x) => x.id === id);
    if (s) sponsorFormModal(s);
  } else if (tab === 'timeline') {
    const tl = currentEvent.timeline.find((x) => x.id === id);
    if (tl) tlFormModal(tl);
  } else if (tab === 'finances') {
    const f = currentEvent.finances.find((x) => x.id === id);
    if (f) financeFormModal(f);
  } else if (tab === 'participants') {
    const p = currentEvent.participants.find((x) => x.id === id);
    if (p) participantFormModal(p);
  } else if (tab === 'guests') {
    const g = currentEvent.guests.find((x) => x.id === id);
    if (g) guestFormModal(g);
  }
}

async function delByType(id) {
  const tab = currentTab;
  const evId = currentEvent.id;
  if (tab === 'tasks') {
    currentEvent = await api.deleteTask(evId, id) ? (await api.event(evId)) : currentEvent;
    renderTasks();
  } else if (tab === 'sponsors') {
    currentEvent = await api.deleteSponsor(evId, id) ? (await api.event(evId)) : currentEvent;
    renderSponsors();
  } else if (tab === 'timeline') {
    currentEvent = await api.deleteTimelineItem(evId, id) ? (await api.event(evId)) : currentEvent;
    renderTimeline();
  } else if (tab === 'files') {
    currentEvent = await api.deleteFile(evId, id) ? (await api.event(evId)) : currentEvent;
    renderFiles();
  } else if (tab === 'finances') {
    currentEvent = await api.deleteFinance(evId, id) ? (await api.event(evId)) : currentEvent;
    renderFinances();
  } else if (tab === 'participants') {
    currentEvent = await api.deleteParticipant(evId, id) ? (await api.event(evId)) : currentEvent;
    renderParticipants();
  } else if (tab === 'guests') {
    currentEvent = await api.deleteGuest(evId, id) ? (await api.event(evId)) : currentEvent;
    renderGuests();
  } else if (tab === 'team') {
    currentEvent = await api.deleteMember(evId, id) ? (await api.event(evId)) : currentEvent;
    renderTeam();
  }
  toast(t('deleted'));
}

/* ---------- users management modal (admin only) ---------- */
const ALL_TABS = [
  ['overview', 'tab.overview'],
  ['team', 'tab.team'],
  ['tasks', 'tab.tasks'],
  ['finances', 'tab.finances'],
  ['participants', 'tab.participants'],
  ['guests', 'tab.guests'],
  ['sponsors', 'tab.sponsors'],
  ['timeline', 'tab.timeline'],
  ['files', 'tab.files'],
];

async function usersModal() {
  const users = await request('GET', '/api/users');
  const rows = users.map((u) => {
    const roleLabel = u.role === 'admin' ? t('role.admin') : u.role === 'viewer' ? t('role.viewer') : u.role === 'assignee' ? t('role.assignee') : t('role.custom');
    let permLabel = '-';
    if (u.role === 'custom' || u.role === 'viewer') {
      try { permLabel = JSON.parse(u.permissions || '[]').join(', '); } catch { permLabel = '-'; }
    }
    const evLabel = u.role === 'admin' ? t('all') : (u.role === 'assignee' ? '-' : String((u.eventIds || []).length));
    return '<tr data-uid="' + u.id + '">'
      + '<td>' + esc(u.username) + '</td>'
      + '<td>' + esc(roleLabel) + '</td>'
      + '<td>' + esc(evLabel) + '</td>'
      + '<td>' + esc(permLabel) + '</td>'
      + '<td class="actions">'
      + '<button class="icon-btn edit" data-act="edit-user" data-uid="' + u.id + '">' + icon('pencil', 14) + '</button>'
      + '<button class="icon-btn delete" data-act="del-user" data-uid="' + u.id + '">' + icon('trash', 14) + '</button>'
      + '</td></tr>';
  }).join('');

  openModal(
    '<h3>' + esc(t('users')) + '</h3>'
    + '<div class="section-head"><button class="btn btn-sm btn-primary" id="modal-add-user">'
    + icon('plus', 14) + ' ' + esc(t('add.user')) + '</button></div>'
    + '<table class="data-table"><thead><tr><th>' + esc(t('username')) + '</th><th>' + esc(t('role'))
    + '</th><th>' + esc(t('events')) + '</th><th>' + esc(t('permissions')) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>',
    { onOpen(overlay) {
      overlay.querySelector('#modal-add-user').addEventListener('click', () => userFormModal(null));
      overlay.querySelectorAll('[data-act="edit-user"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const u = users.find((x) => x.id === Number(btn.dataset.uid));
          if (u) userFormModal(u);
        });
      });
      overlay.querySelectorAll('[data-act="del-user"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uid = Number(btn.dataset.uid);
          confirmDialog(t('confirm.delete'), t('confirm.delete.msg'), async () => {
            await request('DELETE', '/api/users/' + uid);
            toast(t('user.deleted'));
            closeModal();
            usersModal();
          }, t('delete'));
        });
      });
    } }
  );
}

async function userFormModal(existing) {
  const isEdit = !!existing;
  const title = isEdit ? t('edit.user') : t('add.user');
  const perms = isEdit ? (function() { try { return JSON.parse(existing.permissions || '[]'); } catch { return []; } })() : [];
  const assigned = isEdit && existing.eventIds ? existing.eventIds.map(Number) : [];
  const initialRole = (existing && existing.role) || 'viewer';
  const showsEvents = (r) => r === 'viewer' || r === 'custom';
  const showsPerms = (r) => r === 'viewer' || r === 'custom';

  const events = await request('GET', '/api/events');

  let permChecks = ALL_TABS.map(([k, label]) => {
    const checked = perms.includes(k) ? 'checked' : '';
    return '<label class="perm-check"><input type="checkbox" value="' + k + '" ' + checked + '/> ' + esc(t(label)) + '</label>';
  }).join('');

  let eventChecks = events.map((e) => {
    const checked = assigned.includes(Number(e.id)) ? 'checked' : '';
    return '<label class="perm-check"><input type="checkbox" class="ev-cb" value="' + e.id + '" ' + checked + '/> ' + esc(e.name) + '</label>';
  }).join('');

  openModal(
    '<h3>' + esc(title) + '</h3>'
    + '<div class="form-stack">'
    + '<label>' + esc(t('username')) + '</label>'
    + '<input id="u-name" type="text" value="' + esc(existing ? existing.username : '') + '" ' + (isEdit ? 'disabled' : '') + '/>'
    + '<label>' + esc(t('password')) + (isEdit ? ' (' + esc(t('password.optional')) + ')' : '') + '</label>'
    + '<input id="u-pass" type="password" autocomplete="new-password" />'
    + '<label>' + esc(t('role')) + '</label>'
    + '<select id="u-role">'
    + '<option value="admin"' + (initialRole === 'admin' ? ' selected' : '') + '>' + esc(t('role.admin')) + '</option>'
    + '<option value="viewer"' + (initialRole === 'viewer' ? ' selected' : '') + '>' + esc(t('role.viewer')) + '</option>'
    + '<option value="custom"' + (initialRole === 'custom' ? ' selected' : '') + '>' + esc(t('role.custom')) + '</option>'
    + '<option value="assignee"' + (initialRole === 'assignee' ? ' selected' : '') + '>' + esc(t('role.assignee')) + '</option>'
    + '</select>'
    + '<div id="u-events-wrap" style="' + (showsEvents(initialRole) ? '' : 'display:none') + '">'
    + '<label>' + esc(t('events')) + '</label>'
    + '<div class="perm-grid">' + eventChecks + '</div>'
    + '</div>'
    + '<div id="u-perms-wrap" style="' + (showsPerms(initialRole) ? '' : 'display:none') + '">'
    + '<label>' + esc(t('permissions')) + '</label>'
    + '<div class="perm-grid">' + permChecks + '</div>'
    + '</div>'
    + '<button class="btn btn-primary" id="u-save">' + esc(t('save')) + '</button>'
    + '</div>',
    { onOpen(overlay) {
      const roleSel = overlay.querySelector('#u-role');
      const permWrap = overlay.querySelector('#u-perms-wrap');
      const eventsWrap = overlay.querySelector('#u-events-wrap');
      roleSel.addEventListener('change', () => {
        eventsWrap.style.display = showsEvents(roleSel.value) ? '' : 'none';
        permWrap.style.display = showsPerms(roleSel.value) ? '' : 'none';
      });
      overlay.querySelector('#u-save').addEventListener('click', async () => {
        const body = { role: roleSel.value };
        const pass = overlay.querySelector('#u-pass').value;
        if (pass) body.password = pass;
        if (roleSel.value === 'custom' || roleSel.value === 'viewer') {
          body.permissions = [...overlay.querySelectorAll('#u-perms-wrap input:checked')].map((c) => c.value);
        } else {
          body.permissions = [];
        }
        if (roleSel.value === 'admin' || roleSel.value === 'assignee') {
          body.eventIds = [];
        } else {
          body.eventIds = [...overlay.querySelectorAll('.ev-cb:checked')].map((c) => Number(c.value));
        }
        if (isEdit) {
          await request('PUT', '/api/users/' + existing.id, body);
          toast(t('user.updated'));
        } else {
          const uname = overlay.querySelector('#u-name').value.trim();
          if (!uname) return toast(t('name.req'));
          body.username = uname;
          if (!pass) return toast(t('password') + ' required');
          await request('POST', '/api/users', body);
          toast(t('user.added'));
        }
        closeModal();
        usersModal();
      });
    } }
  );
}

/* ---------- change own password ---------- */
function changePasswordModal() {
  openModal(
    '<h3>' + esc(t('change.password')) + '</h3>'
    + '<div class="form-stack">'
    + '<label>' + esc(t('current.password')) + '</label>'
    + '<input id="pw-current" type="password" autocomplete="current-password" />'
    + '<label>' + esc(t('new.password')) + '</label>'
    + '<input id="pw-new" type="password" autocomplete="new-password" />'
    + '<label>' + esc(t('confirm.password')) + '</label>'
    + '<input id="pw-confirm" type="password" autocomplete="new-password" />'
    + '<button class="btn btn-primary" id="pw-save">' + esc(t('save')) + '</button>'
    + '</div>',
    { onOpen(overlay) {
      overlay.querySelector('#pw-save').addEventListener('click', async () => {
        const current = overlay.querySelector('#pw-current').value;
        const neu = overlay.querySelector('#pw-new').value;
        const confirm = overlay.querySelector('#pw-confirm').value;
        if (!current) return toast(t('current.password.req'));
        if (!neu) return toast(t('new.password.req'));
        if (neu !== confirm) return toast(t('password.mismatch'));
        try {
          await request('POST', '/api/auth/change-password', { current, new: neu });
          toast(t('password.changed'));
          closeModal();
        } catch (e) {
          toast(e.message || t('current.password.incorrect'));
        }
      });
    } }
  );
}

/* ---------- boot ---------- */
(async () => {
  const ok = await authMe();
  if (ok) navigate();
})();