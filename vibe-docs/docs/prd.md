# PRD: Event Manager

_Last updated: 2026-10-18_

## Problem
Small event teams (student associations, university departments, volunteer crews) plan
events in scattered spreadsheets and chats. They need one place for the team roster, task
board, sponsors, schedule, budget and the many people involved (speakers, guests, workshops,
meetings) — without sending sensitive data to a SaaS or paying for seats.

This app runs locally: one Node process, one SQLite file, and a browser. An operator can
back up the whole thing to a single zip.

## Target users
- **Admin / event lead** — creates events, manages people, permissions, finances and backups.
- **Team member (viewer / custom)** — reads or edits only the tabs and events they are given.
- **Workflow specialist (assignee)** — does not browse events; signs in to a personal task list.

## Goal / success criteria
- An admin can create an event, add a team, tasks, sponsors and a timeline in under 10 minutes.
- A viewer can open only their assigned events and only the granted tabs (read-only unless granted write).
- A backup zip can be restored into a fresh install and every event, row, relation and attachment is usable.
- Existing data from the previous schema (root `events.db`) opens with no manual migration.

## MVP features (in scope)
| # | Feature | Short description | Priority |
|---|---------|-------------------|----------|
| 1 | Events | Create/edit/delete events with date, venue, status, description, critical info | Must |
| 2 | Team | Members with role, section, section head, ID, phone, photo, notes | Must |
| 3 | Tasks | Kanban-style status columns, importance, due date, member assignment, assignee users | Must |
| 4 | Sponsors | Contact details, contribution type (money / in-kind / services), amount, status | Must |
| 5 | Timeline | Dated milestones, prep and deadlines with done state | Must |
| 6 | Design | Venues/locations and per-location plans | Should |
| 7 | Speakers | Speaker bios, topics, invite status | Should |
| 8 | Workshops | Schedule, host, capacity, status | Should |
| 9 | Adventures | Optional activities with cost, capacity, schedule | Should |
| 10 | Shows | Show schedule, segments, equipment checklist, optional venue link | Should |
| 11 | Meetings | Agenda, attendees pulled from team/speakers/guests/participants, outcomes | Should |
| 12 | Participants / Guests | External people and teams; invitation and attendance status | Should |
| 13 | Finances | Income/expense transactions in toman, optional receipt attachment, budget sync | Must |
| 14 | Budget | Planned income/expense by category, funding source, actuals and variance | Must |
| 15 | Files | Per-event attachments up to 50 MB each | Must |
| 16 | Roles & permissions | Admin, viewer (read-only), custom (per-tab view/write), assignee (task list only) | Must |
| 17 | Per-event modules | Admin enables/disables tabs per event | Should |
| 18 | Bootstrap / export / backup | One-time legacy DB adoption, JSON export, zip backup + restore | Must |
| 19 | Bilingual UI | English and Persian (RTL), persisted language choice | Should |
| 20 | My tasks | Assignee-only list across events | Must |

## Out of scope (do NOT build)
- Multi-tenant hosting, public sign-up, email/SMS notifications.
- Realtime collaboration, websockets, presence or conflict-free editing.
- Calendar sync, payment processing, accounting integrations.
- Native mobile apps.
- Cloud file storage or external object storage.

## Key user flows
1. **First run:** start server → default admin seeded → log in → change password → create event.
2. **Event setup:** create event → enable modules → add team and sections → add tasks and assignees.
3. **Money:** add budget lines → add transactions (category auto-creates a budget line) → compare planned vs actual.
4. **Scoped access:** admin adds a viewer/custom user → selects event access and tab levels → user sees only those tabs.
5. **Assignee:** admin assigns a task to an assignee user → assignee logs in and sees `/api/my-tasks` results.
6. **Backup:** admin downloads zip → restores on another install → new copies are created with `_restored_<timestamp>` names and attachments work.
7. **Upgrade:** old install with root `events.db` → start new version → old data is imported once, previous empty DB is kept as a backup file.

## Constraints
- Tech: Node.js >= 22.13, built-in `node:sqlite`, no build step, no network dependency at runtime.
- Hosting: laptop or a single Docker container with a persistent `data/` volume.
- Privacy: data stays in `data/`; backups are user-controlled files. Passwords use scrypt.
- Localization: all UI strings must exist in English and Persian.

## Open questions
- Should imported users (from a backup) automatically get event access mapped to restored events? (owner: maintainer)
- Do we need per-tab permissions for the Overview tab, or is event metadata always visible to granted users? (owner: maintainer)
- Should JSON export include attachments as base64, or stay metadata-only? (owner: maintainer)
