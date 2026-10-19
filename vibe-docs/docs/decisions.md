# Decisions Log

Newest first. One entry per meaningful choice. Don't reverse a decision here without adding a new entry that supersedes it.

### D-012: Theme controls live in the topbar, not in an event tab
- **Date:** 2026-10-19
- **Status:** Accepted (supersedes the placement part of D-011; the storage decision stands)
- **Context:** D-011 put the theme picker in a `settings` event tab. A theme is not event data, so
  the tab sat oddly in a rail of event modules: it was hidden until an event was opened, it needed a
  permission bypass, and a user looking for a light/dark switch did not find it there.
- **Decision:** The topbar carries two controls for every role on every page: a sun/moon icon button
  that flips Light <-> Dark in one click, and a theme button beside it that shows the current theme
  name and opens a menu with Light / Dark / Custom theme plus "Custom colors…". The palette editor
  (the 22 colour variables) moved into a modal opened from that menu, and the `settings` tab is gone.
  The button icon shows the mode in use and its title says what clicking does; `themeMode()` and
  `toggleLightDark()` in `theme.js` are the only theme-state helpers.
- **Alternatives considered:** Keep the tab and add a topbar shortcut (two places to maintain and to
  translate); a topbar toggle with no menu (no route to the custom palette).
- **Consequences:** Themes are reachable from the dashboard, the assignee "my tasks" page and the
  event page without opening an event, and no tab bypasses permissions. The theme menu is anchored
  with `inset-inline-end` and the dropdown items use `text-align: start` so it works in both
  directions. Editing or resetting a custom colour also selects the Custom theme.

### D-011: Themes are local per-browser preferences, not event data
- **Date:** 2026-10-19
- **Status:** Accepted (superseded in placement by D-012)
- **Context:** The UI needs light/dark plus a free-form palette. Users share one SQLite file, so a
  theme stored server-side would fight between users and would leak a personal preference into
  backups and restores.
- **Decision:** `public/js/theme.js` keeps the built-in Light/Dark palettes and exactly one custom
  palette. The selected theme is `em-theme` and the custom colours are `em-theme-custom` in
  `localStorage`; `applyTheme()` runs before the first render in `app.js`. The Settings tab is a
  client-only tab shown to anyone who can open the event (it bypasses per-tab permissions and
  module flags) and the palette editor only exposes the 22 colour variables, never shadows.
- **Alternatives considered:** Store the theme per user in the database (needs a schema change and
  loses the choice when the browser profile differs); CSS `prefers-color-scheme` only (no editor).
- **Consequences:** No server change and no database risk. Clearing browser storage resets the
  theme; the custom palette starts from the Dark palette until edited.

### D-010: Scope admin handlers by path, not by running them first
- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** `handleApi` called `handleAdminExport()` and `handleAdminBackup()` for every
  request. Both started with `requireAdmin()`, so any non-admin request got `403 Admin only`
  before reaching `/api/events` or `/api/my-tasks`.
- **Decision:** Only call those handlers when `pathname.startsWith('/api/admin/')`; unknown
  admin paths 404 after the admin check.
- **Alternatives considered:** Make the handlers return `null` for non-matching paths before
  the auth check (fragile: every new admin helper must repeat the ordering rule).
- **Consequences:** Viewer/custom/assignee roles work; new `/api/admin/*` routes must stay
  under that prefix.

### D-009: Restored users keep roles but get a temporary password
- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** Backups include `users.json`. Password hashes are deliberately not portable
  across installs, and restored accounts must be usable.
- **Decision:** Imported users are created with role/permissions preserved and the password
  `changeme123` (scrypt-hashed), skipped if the username already exists. Event access is not
  mapped (event ids change).
- **Alternatives considered:** Import hashes verbatim (couples backup to salt/hash scheme);
  skip users (admins lose accounts after a disaster restore).
- **Consequences:** Operators must tell restored users to change passwords; access must be
  re-granted after a restore.

### D-008: Integration tests with `node:test`, no test framework
- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** The project uses only Node built-ins on the server; adding Jest/Vitest would
  add a large dependency for two suites.
- **Decision:** `npm test` runs `node --test`. Tests spawn the real server on a free port with
  a temporary `DATA_DIR` and exercise HTTP endpoints with cookies.
- **Alternatives considered:** Unit-test `db.js` in-process (fast but misses routing/auth);
  Playwright (heavy, no browser dependency wanted).
- **Consequences:** Tests cover routing, permissions, backup/restore and migrations; UI is
  still verified manually. The harness must wait for the process to exit before deleting temp dirs on Windows.

### D-007: Backups remap ids instead of restoring primary keys
- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** The previous restore copied exported rows with their ids and appended
  `event_id` a second time; it failed on the first non-empty table and could not map
  relationships.
- **Decision:** `importEvents()` inserts rows table-by-table, tracks old→new maps for members,
  tasks, locations, shows and meetings, and rewrites foreign keys. `restoreFromZip()` copies
  each attachment into `data/files/<newEventId>/` and creates a fresh `files` row.
- **Alternatives considered:** Reuse old ids (collides with existing data); restore into a
  separate database (cannot merge).
- **Consequences:** Restore always creates new events named `<name>_restored_<timestamp>`;
  task assignees are not restored (they reference users) and JSON export remains metadata-only.

### D-006: Money is stored in toman with one-time conversion flags
- **Date:** 2026-09-01 (initial money model), flags retained
- **Status:** Accepted
- **Context:** Early builds stored amounts in “million toman”. Changing the unit silently would
  corrupt existing budgets.
- **Decision:** Store plain toman. On first boot after the change, multiply transactions,
  budget items and numeric money sponsors by 1,000,000 and record `money_scale_v1` /
  `sponsor_money_v1` in `meta`.
- **Alternatives considered:** Keep millions (confusing in forms and summaries); convert in the
  UI only (data stays ambiguous).
- **Consequences:** Never delete the meta flags; migrations must run exactly once.

### D-005: Per-event feature flags for tabs
- **Date:** 2026-09-10
- **Status:** Accepted
- **Context:** Not every event needs shows, meetings, budget, etc.
- **Decision:** `events.features` is a JSON array of enabled tab keys; empty means all enabled.
  `featureEnabled(eventId, tab)` is checked by `canWrite` and mirrored by `featureOn()` in the UI.
- **Alternatives considered:** Global settings (per-event needs differ); hiding only in the UI
  (server must enforce).
- **Consequences:** A tab disabled after data exists hides it but preserves the rows.

### D-004: Permissions are per-tab levels stored as JSON
- **Date:** 2026-09-05
- **Status:** Accepted
- **Context:** Viewers needed read-only access while some users needed write access to a
  subset of tabs.
- **Decision:** `users.permissions` holds `{ tab: "view" | "write" }`; write implies view.
  Legacy array permissions are still parsed (viewer → view, custom → write) and a viewer
  with an empty array sees all tabs read-only.
- **Alternatives considered:** Role-only access (too coarse); separate permission table (more
  schema for a small app).
- **Consequences:** Server and client share the same parsing rules; keep them in sync.

### D-003: Adopt the old root database once
- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** Older builds stored `events.db` next to `server.js`; current builds use
  `data/db/events.db`. After the move, an existing install appeared empty.
- **Decision:** On boot, if the target DB has no events and no `legacy_import_v1` flag, and a
  root `events.db` has events, checkpoint its WAL and `VACUUM INTO` a new target. Rename the
  previous empty target to `events.db.pre-legacy-<timestamp>` instead of deleting it, and set
  the flag so a later “delete all events” does not import again.
- **Alternatives considered:** Leave migration manual (users think data is lost); copy only
  the `.db` file (loses WAL pages); import rows through SQL (slower, more failure modes).
- **Consequences:** One-time import is automatic and reversible; `LEGACY_DB` allows tests to
  point elsewhere. The legacy file is left untouched.

### D-002: No frontend framework and no build step
- **Date:** 2026-08-31
- **Status:** Accepted
- **Context:** The app must run offline on a laptop with `node server.js` and be trivially editable.
- **Decision:** Plain HTML/CSS/JS with template strings, hash routing and a small `api` wrapper.
- **Alternatives considered:** React/Vite (build step and dependency churn); server-rendered
  templates (harder interactive Kanban/modals).
- **Consequences:** Fast startup, but renderers are large (`public/js/app.js`) and must escape
  user content with `esc()`.

### D-001: Local-first SQLite
- **Date:** 2026-08-31
- **Status:** Accepted
- **Context:** Event data is personal and should not require a hosted database.
- **Decision:** One SQLite file in `data/db/events.db` using the built-in `node:sqlite` driver,
  WAL mode and foreign keys. Attachments live in `data/files/`.
- **Alternatives considered:** Postgres (operational burden); JSON files (no transactions or
  relations); better-sqlite3 (native dependency).
- **Consequences:** Zero external services; backups are file copies/zips. Node >= 22.13 is
  required, and SQLite access is synchronous (fine at this scale).
