# Event Manager

A local-first event planning app (Node + SQLite + vanilla JS). Detailed docs live in
[`vibe-docs/`](vibe-docs/README.md); the full agent/developer rules are in
[`vibe-docs/CLAUDE.md`](vibe-docs/CLAUDE.md).

## Commands

```
npm start     # http://localhost:3000
npm test      # node --test (integration + legacy migration)
```

## Non-negotiables

- **Never break existing databases.** Schema changes are additive (`CREATE TABLE IF NOT
  EXISTS` + `ensureColumn` in `db.js`); never drop/recreate tables with user data.
- **Keep legacy compatibility.** Old installs used root `events.db`; `db.js` adopts it once
  when `data/db/events.db` is empty. See `vibe-docs/docs/decisions.md` D-003.
- **Money is stored in toman**, not millions; the one-time conversion flags in `meta` must
  never run twice.
- **Never touch or commit** `data/`, `events.db*`, `node_modules/`, `.freebuff/` or user backups.
- **Server is the source of truth for permissions.** Check `canWrite(user, eventId, tab)` on
  the server; client checks are UX only.
- **No new runtime dependencies** without a decision entry; the server uses Node built-ins.

## Before finishing

- Run `npm test` and report the result.
- Update `vibe-docs/docs/status.md`; log choices in `decisions.md` and bugs in `bugs.md`.
- Keep user-facing strings in both English and Persian (`public/js/i18n.js`).
