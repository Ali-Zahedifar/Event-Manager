# Implementation Plan

_Derived from `docs/prd.md`. Tick boxes as work is **verified** (tests passing), not just written._

Legend: `[ ]` todo · `[~]` in progress · `[x]` done and verified

## Phase 1: Project setup
- [x] Initialize repo and project scaffold (Node server + static UI)
- [x] Add `start.bat`, Dockerfile and docker-compose
- [x] Add `package.json` start script and Node engine requirement
- [x] Add `npm test` using the built-in test runner
- **Exit criteria:** app starts, `npm test` runs clean

## Phase 2: Data layer
- [x] Define SQLite schema (events, people, tasks, money, shows, meetings, users, sessions)
- [x] Add additive migrations (`ensureColumn`) and money conversion flags in `meta`
- [x] One-time adoption of the legacy root `events.db`
- [x] CRUD for every entity with `event_id` scoping
- [x] Export/import with id remapping and zip backup/restore
- **Exit criteria:** old database opens with data intact; backup round-trip restores relations and attachments

## Phase 3: Core backend
- [x] REST routes for all entities and admin export/backup/restore
- [x] Cookie sessions, scrypt passwords, login rate limiting, CSRF Origin check
- [x] Roles and per-tab permissions enforced server-side
- [x] Per-event feature modules
- [x] Attachment upload/download with size limit
- **Exit criteria:** viewer/custom/assignee/admin all get correct access; verified by `test/api.test.js`

## Phase 4: Frontend
- [x] Dashboard, search, event cards and stats
- [x] Event page with tab rail and 16 tabs
- [x] Forms/modals for every entity, destructive-action confirmation
- [x] Admin users, modules, export/backup/restore UI
- [x] Bilingual EN/FA with RTL support
- [x] Read-only UI for view-only permissions
- **Exit criteria:** all tabs render and edit correctly by hand

## Phase 5: Integration & polish
- [x] End-to-end flows from `docs/prd.md`
- [x] Empty states, loading states, toasts and error surface
- [x] Backup/restore end-to-end test including files
- [x] Legacy database migration test
- [x] Audit against the PRD and log gaps
- **Exit criteria:** all MVP features pass `docs/testing.md`

## Phase 6: Documentation & hardening (2026-10-18)
- [x] Complete `vibe-docs` (PRD, architecture, decisions, plan, status, bugs, testing, task)
- [x] Fix bugs found in the audit (see `docs/bugs.md`)
- [x] Add regression tests for permissions, meetings, backup/restore, legacy DB
- [x] Update root README with current behavior and data location
- **Exit criteria:** docs match code; `npm test` passes

## Phase 7: Next (not started)
- [ ] Map restored users to restored events (or document a guided flow)
- [ ] Export/import attachments in JSON exports
- [ ] Deep-linkable item modals and keyboard shortcuts
- [ ] Browser smoke test in CI (Playwright optional)
- **Exit criteria:** restore leaves users ready to log in; UI regressions caught automatically

## Parking lot (not in MVP)
- Public read-only share links.
- Calendar (.ics) export and email invitations.
- Drag-and-drop Kanban and reorderable sections.
- Attachment deduplication and orphan cleanup.
- Audit log for admin actions.
- Custom fields per event.
