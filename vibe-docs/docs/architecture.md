# Architecture

_Last updated: 2026-10-18. Keep this in sync with the code; if they disagree, fix one of them._

## Overview
A single Node.js process serves the static UI and a JSON REST API. All state lives in one
SQLite database plus a per-event attachment folder. The browser is a small vanilla-JS SPA
(hash router) with no build step; it authenticates with an HttpOnly session cookie.

```
[Browser: public/ SPA] ──HTTP/JSON──> [server.js: routes + auth] ──> [db.js] ──> [data/db/events.db]
        │                                    │
        └── GET /files/:id download ─────────┴──> [data/files/<eventId>/...]
```

## Tech stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Vanilla JS + CSS | `public/`, hash router, no framework/bundler |
| Backend | Node.js `http` | CommonJS, no Express |
| Database | SQLite via `node:sqlite` | WAL mode, foreign keys on; Node >= 22.13 |
| Auth | Cookie sessions + scrypt | `sessions` table, 7-day expiry, SameSite=Strict |
| Files | Local filesystem | Uploads base64 in JSON, max 50 MB; metadata in `files` |
| Backup | `archiver` / `adm-zip` | Zip of events.json + users.json + files/ |
| Hosting | Local or Docker | `docker-compose.yml`, persistent `data/` volume |

## Folder structure
```
server.js            HTTP server, static files, REST routes, auth/CSRF guards
db.js                Schema creation/migrations, all SQL, export/import, backups
events.db            Legacy database from pre-data/ builds (auto-adopted once)
public/
  index.html         SPA shell
  login.html         Login page
  css/styles.css     All app styles (CSS-variable themes, RTL-aware)
  js/auth.js         Session bootstrap, role/permission helpers
  js/api.js          Fetch wrapper + endpoint map
  js/i18n.js         EN/FA dictionary and t()/setLang()
  js/login.js        Login page logic
  js/theme.js        Light/Dark palettes, custom palette, localStorage persistence
  js/app.js          Router, dashboard, 16 tab renderers, modals, admin UI
data/
  db/events.db       Active database (WAL/SHM alongside)
  files/<eventId>/   Attachments for that event
test/                node:test integration and migration tests
test-utils/          Test harness (spawn server on a free port)
vibe-docs/           Project documentation (this folder)
```

## Main components
- **`serveStatic`** — serves `public/`, maps `/login` to `login.html`, SPA fallback for
  extension-less routes, 404 for missing assets, path-traversal guard.
- **`handleApi`** — auth routes → user management → `/api/admin/*` → authenticated event routes.
- **`parsePath`** — turns `/api/events/:id/<resource>/<itemId>` into ids; unknown shapes 404.
- **`requireAuth` / `requireAdmin`** — session cookie → `sessions` table → user.
- **`canWrite(user, eventId, tab)`** — role, event access, enabled module and per-tab level.
- **`db.js`** — schema DDL, `ensureColumn` migrations, CRUD per entity, `getEvent()` aggregate.
- **`importEvents` / `restoreFromZip`** — id remapping for restored events, attachment copying.
- **Frontend router** — `#/` dashboard, `#/event/:id/:tab`; assignees are redirected to my tasks.

## Data model
| Entity | Key fields | Relations |
|--------|-----------|-----------|
| users | id, username, password_hash, salt, role, permissions (JSON) | → event_access, sessions, task_assignees |
| sessions | token, user_id, expires_at | belongs to users |
| event_access | user_id, event_id | M:N users ↔ events |
| events | id, name, date, location, status, critical_info, features (JSON) | has many of everything below |
| members | event_id, name, role, section, section_head, photo (data URL) | ↔ tasks via task_members |
| tasks | event_id, title, status, importance, due_date | ↔ members, ↔ users (assignees) |
| sponsors | event_id, contribution_type, contribution_amount, status | — |
| timeline_items | event_id, datetime, category, done | — |
| files | event_id, name, mime, size, stored_path | filesystem |
| transactions | event_id, type, title, amount (toman), category, file_* | → budget category |
| budget_items | event_id, type, category, amount, funding | — |
| design_locations / design_plans | event_id; plan → location | shows.location_id → locations |
| participants, guests, speakers | event_id + contact/status fields | meeting attendees reference them |
| workshops, adventures | event_id, schedule, capacity, cost, status | — |
| shows / show_segments | event_id; segments → show | location_id → design_locations |
| meetings / meeting_attendees | event_id; attendees → meeting, ref_type/ref_id | refs team/speakers/guests/participants |
| meta | key, value | migration flags (`money_scale_v1`, `sponsor_money_v1`, `legacy_import_v1`) |

Money is stored in **toman**, not millions. Old databases are converted once on boot.

## Data flow (typical write)
1. User edits a form in the SPA → `api.updateX()` → `fetch('/api/events/:id/...')`.
2. `server.js` checks the Origin header for state-changing methods, validates the session,
   checks event access + tab write permission + module enabled.
3. `db.js` validates ownership (`... WHERE id = ? AND event_id = ?`), writes, and returns the row.
4. The SPA refetches the whole event aggregate (`GET /api/events/:id`) and re-renders the tab.

## Auth & permissions
- Login rate limits: 10 attempts / 15 min per IP, 5 per account (`TRUST_PROXY=1` honors X-Forwarded-For).
- Passwords: `scrypt(password, salt, 64)`; constant-time comparison.
- Cookie: `session=<48-byte hex>; HttpOnly; Path=/; SameSite=Strict; Max-Age=7d` (+ `Secure` when TLS is detected).
- Roles:
  - `admin` — everything, including users, event create/delete, export/backup/restore.
  - `viewer` — assigned events, granted tabs read-only; legacy empty permissions = all tabs.
  - `custom` — assigned events, only tabs with a granted `view`/`write` level.
  - `assignee` — no event access; `/api/my-tasks` only.
- Permissions JSON is an object `{ "finances": "write", "tasks": "view" }`. Legacy arrays are
  still understood (viewer → view, custom → write).

## External integrations
- None at runtime. `archiver` creates backup zips; `adm-zip` reads them on restore.

## Configuration & secrets
- `PORT` (default 3000), `DATA_DIR` (default `./data`; `/main/eventmanager` if `/main` is writable),
  `ADMIN_USER`, `ADMIN_PASS` (seeded only when the users table is empty), `LEGACY_DB` (test override),
  `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
- No secrets are stored in the repo. The database and `data/files/` must not be committed.

## Rules of the architecture
- All SQL lives in `db.js`; route handlers never write SQL directly.
- Every child entity lookup includes `event_id` to prevent cross-event access.
- Schema changes must be additive migrations (`ensureColumn`) or new tables; never break old DBs.
- Client-side permission checks are cosmetic; the server is the source of truth.
- Backup restore must remap ids; never insert exported primary keys.
