# Current Task

## Goal (completed 2026-10-18)
Integrate the new `vibe-docs` folder with the project, document the real system, fix the bugs
found in a full audit, and run the updated app **without breaking existing databases**.

## Context
- Plan reference: `docs/plan.md`, Phase 6
- Related docs: `docs/prd.md` (scope), `docs/architecture.md` (data flow), `docs/bugs.md` (findings)

## Requirements
- Documentation describes the actual app, commands and data model.
- Every bug found in the audit is fixed or logged as open with a clear next step.
- The old root `events.db` continues to work after the upgrade.
- The app starts and serves the UI.

## Files involved
- `db.js`, `server.js` — legacy adoption, migration, admin routing, backup/restore
- `public/js/app.js`, `public/js/i18n.js`, `public/js/login.js` — UI bugs and translations
- `test/api.test.js`, `test/legacy.test.js`, `test-utils/harness.js` — new tests
- `README.md`, `vibe-docs/**` — documentation

## Constraints
- Do not change or delete user data under `data/` or the legacy `events.db`.
- Keep schema changes additive; old databases must open.
- No new runtime dependencies.

## Acceptance criteria
- [x] `vibe-docs` contains no placeholders and matches the code
- [x] Legacy database is imported once and preserved
- [x] `npm test` passes (2 suites)
- [x] `npm start` serves the login page and the app
- [x] Bugs are recorded with cause/fix/verification in `docs/bugs.md`

## Next task (Phase 7)
**Goal:** make a restore leave users ready to work and include attachments in JSON export.

Acceptance criteria:
- [ ] Restored users are granted access to restored copies of the events they had access to
- [ ] Task assignees survive a backup/restore round-trip
- [ ] JSON export can include attachments (or clearly documents that it cannot)
- [ ] A test covers each restored relation
