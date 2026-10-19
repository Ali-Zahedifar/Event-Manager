# Status

_Update at the end of every session. This is the handoff note: someone with zero context should be able to continue from here._

**Last updated:** 2026-10-19 by Buffy (agent)

## Current phase
Phase 6: Documentation & hardening — **complete**. Phase 7 (next) not started. See `docs/plan.md`.

## Done recently
- Completed the `vibe-docs` set for this project (PRD, architecture, decisions, plan, bugs,
  testing, task, entry point) and linked it from the root README.
- Fixed the audit bugs in `docs/bugs.md` (non-admin 403, meeting attendees, restore id
  remapping, backup paths, restored-user hashing, shows/meetings actions, budget modal,
  restore re-render, read-only controls, missing icons/translations, static fallbacks).
- Added one-time adoption of the legacy root `events.db`, including WAL checkpoint, a kept
  backup of the previous empty DB and a `legacy_import_v1` flag.
- Added `npm test` with `node:test`: permission/entity/backup-restore integration tests and a
  legacy-schema migration test. Both pass on Windows with Node 24.
- Updated `README.md` with current features, data location, roles, backup and legacy upgrade notes.
- Finished the in-app theme support, now as **topbar controls** instead of a tab (D-012): a sun/moon
  button that flips Light <-> Dark and a theme button beside it that opens Light / Dark / Custom
  theme plus "Custom colors…" (the 22-colour palette editor, in a modal). The custom palette is
  `em-theme-custom` and the selected theme is `em-theme` in `localStorage`; the choice is applied
  before the first render and the palette has a reset action. Also fixed the broken `renderTeam()`
  insertion, removed the duplicated `fa`/`en` i18n keys that had collapsed Persian to a handful of
  translations, and replaced the hardcoded light-only `.btn:hover` colours with theme variables.

## In progress
- Nothing half-finished. The code is runnable (`npm start`).

## Next step
Run the manual smoke checklist in `docs/testing.md` in a browser (especially Persian/RTL,
read-only controls, shows/meetings edit-delete and a real restore), then start Phase 7:
map restored users to restored events and add attachments to JSON export.

## Known issues
- Restored users do not get `event_access` mapped (BUG-101).
- Task assignee links are not restored (BUG-102).
- JSON export has no attachment binaries (BUG-103).
- Orphaned attachment folders are not automatically cleaned (BUG-104).
- In Node 22, `node:sqlite` prints an experimental warning on boot (harmless; stable in newer Node).

## Things to be careful about
- **Never commit `data/`** or `events.db*`: they contain personal data and session tokens.
  `.gitignore` covers the active DB; add `data/db/events.db.pre-legacy-*` backups if they appear.
- Legacy adoption runs only when the active DB has **no events** and no flag. Deleting all
  events later will not re-import (the flag is set). Do not delete the `meta` flags.
- Money is in toman. Running the conversion migrations twice corrupts totals.
- Restore always creates **new** events with `_restored_<timestamp>` names; it never overwrites.
- The server rejects state-changing requests with a foreign `Origin`; tests must send `Origin`.
- Route order matters: `/api/admin/*` must be checked before the authenticated event routes,
  and must not call `requireAdmin` for unrelated paths (see D-010).

## Changelog
| Date | Change | Who |
|------|--------|-----|
| 2026-10-19 | Theme moved from a tab to topbar sun/moon + theme menu (D-012); i18n duplicate-key cleanup | Buffy |
| 2026-10-19 | Theme settings tab + persistent custom palette; i18n duplicate-key fix | Buffy |
| 2026-10-18 | Docs completed; bug audit fixes; legacy DB adoption; test suite | Buffy |
| 2026-10-18 | Data moved to `data/db` (legacy root DB now auto-imported) | Buffy |
| 2026-09-19 | Roles, per-tab permissions, finances/budget/design/shows/meetings modules | previous sessions |
| 2026-08-31 | Initial Event Manager app (events, team, tasks, sponsors, timeline) | previous sessions |
