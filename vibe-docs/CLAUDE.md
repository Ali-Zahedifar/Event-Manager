# Event Manager

A local-first web app for planning events: one SQLite file, a Node HTTP server and a
no-build browser UI. Admins manage every event; viewers, custom users and assignees get
scoped access. Data never leaves the machine unless the operator copies the database or
a backup zip.

## Read first
- `docs/prd.md` — what we're building, scope, and what is OUT of scope
- `docs/architecture.md` — how the system is structured and where code lives
- `docs/decisions.md` — why things are the way they are (don't undo these without asking)
- `docs/status.md` — current state and next step
- `tasks/current.md` — the task for this session

## Commands
```
install:  npm install
dev:      npm start            (same as production; no watcher)
test:     npm test             (node --test)
lint:     — (no linter configured; run node --check on edited JS files)
build:    — (no build step)
run:      start.bat on Windows, or docker compose up --build
```

## Rules (always follow)
1. Work only on what `tasks/current.md` asks. Don't add features outside `docs/prd.md` scope.
2. For anything non-trivial: propose a short plan and wait for approval before editing files.
3. Never declare a task done until `npm test` passes. Report the exact result.
4. Follow the conventions below. Match existing code style; don't refactor unrelated code.
5. If something is unclear or conflicts with the docs, ask. Don't guess.
6. Never touch: `data/`, `events.db*`, `node_modules/`, `.freebuff/`, or user backup files.
   Never commit passwords, session tokens, or personal data from `data/`.
7. When you finish a task, update `docs/status.md`. If you made a design choice, add it to
   `docs/decisions.md`. If you fixed a bug, record it in `docs/bugs.md`.

## Database compatibility (critical)
- The app must keep opening existing databases. Schema changes go through
  `CREATE TABLE IF NOT EXISTS` plus `ensureColumn()` in `db.js`; never rewrite or drop
  a table in place without a migration that preserves data.
- Old builds stored `events.db` next to `server.js`. `db.js` adopts that file once when
  `data/db/events.db` has no events (see D-003). Keep this path working.
- Money is stored in toman (not millions). The one-time conversion flags live in the
  `meta` table (`money_scale_v1`, `sponsor_money_v1`); do not run them twice.
- Backups must restore into a database with the current schema; `importEvents()` remaps
  every row id rather than reusing exported ids.

## Conventions
- Language: Node.js >= 22.13 (built-in `node:sqlite`, CommonJS), vanilla ES2020 browser JS.
  No frontend framework and no bundler.
- Folder layout: see `docs/architecture.md`. `server.js` = HTTP/API; `db.js` = schema and
  data access; `public/` = UI; `test/` = `node:test` integration tests.
- Naming: camelCase for JS functions/variables, snake_case for database columns and JSON
  fields, kebab-case for CSS classes, `renderX()` for tab renderers, `xFormModal()` for forms.
- Errors: server returns `{ error: "message" }` with the right HTTP status; client `request()`
  throws an `Error`, and UI handlers surface a toast. Never swallow write errors silently.
- Permissions: check on the server with `canWrite(user, eventId, tab)`; hide/disable controls
  on the client with `canAccess()` / `canWriteTab()`. Client checks are UX, not security.
- i18n: every new user-facing string goes into both `en` and `fa` in `public/js/i18n.js`
  (use `t('key')`). Don't hardcode English in renderers.
- Commits: small, one logical change each, imperative message.

## Definition of done
- [ ] Behaviour matches the task requirements
- [ ] Tests added or updated and `npm test` passes
- [ ] Legacy database still opens and data is intact
- [ ] No unrelated files changed
- [ ] `docs/status.md` updated (and `docs/decisions.md` / `docs/bugs.md` if relevant)
