# Testing

## How to run
```
all tests:     npm test
single file:   node --test test/api.test.js
legacy only:   node --test test/legacy.test.js
syntax check:  node --check server.js && node --check db.js
coverage:      — (not configured)
```
Rule: no task is “done” until the relevant tests pass. When fixing a bug, add a test that fails before the fix and passes after.

The tests spawn the real server on a free loopback port with a temporary `DATA_DIR` and
`LEGACY_DB` override, then use `fetch` with the session cookie. They do not touch `data/`
or the repository’s `events.db`.

## Test strategy
- **Integration (`test/api.test.js`):** admin event creation across every major entity,
  permission enforcement for viewer/assignee, meeting attendees, backup zip → restore →
  attachment download.
- **Migration (`test/legacy.test.js`):** create a pre-`data/` schema, fill it with an event,
  members, task assignment, sponsor, transaction and budget line; start the app; verify data,
  column migrations and money conversion; restart and verify the legacy file is imported once.
- **Manual:** visual checks for tabs, RTL/Persian, modals and read-only states (below).

## Test cases by feature

### Auth & roles
| ID | Case | Type | Status |
|----|------|------|--------|
| T-001 | Default admin can log in | auto | [x] |
| T-002 | Viewer can list and open an assigned event | auto | [x] |
| T-003 | Viewer write attempt returns 403 | auto | [x] |
| T-004 | Viewer cannot list users | auto | [x] |
| T-005 | Assignee sees only `/api/my-tasks` results | auto | [x] |
| T-006 | Login rate limit after repeated failures | manual | [ ] |
| T-007 | Logout clears the session cookie | manual | [ ] |

### Events & entities
| ID | Case | Type | Status |
|----|------|------|--------|
| T-010 | Create event with metadata | auto | [x] |
| T-011 | Add member, task and task-member link | auto | [x] |
| T-012 | Add design location and link a show to it | auto | [x] |
| T-013 | Save meeting attendee and read it back | auto | [x] |
| T-014 | Upload an attachment and list it | auto | [x] |
| T-015 | Per-event module toggle hides a tab | manual | [ ] |
| T-016 | Read-only user sees no edit/delete controls | manual | [ ] |

### Backup / restore / legacy
| ID | Case | Type | Status |
|----|------|------|--------|
| T-020 | Backup returns a non-empty zip | auto | [x] |
| T-021 | Restore creates one new event with suffix | auto | [x] |
| T-022 | Restored task/member, show/location, meeting/attendee links are remapped | auto | [x] |
| T-023 | Restored attachment downloads with original content | auto | [x] |
| T-024 | Old root `events.db` is adopted with data intact | auto | [x] |
| T-025 | Money values are converted once (toman) | auto | [x] |
| T-026 | Restart does not import the legacy file twice | auto | [x] |
| T-027 | Deleting all events does not re-import legacy data | manual | [ ] |

### UI / i18n
| ID | Case | Type | Status |
|----|------|------|--------|
| T-030 | English/Persian toggle persists between login and app | manual | [ ] |
| T-031 | Persian layout is RTL and labels are translated | manual | [ ] |
| T-032 | Show/meeting edit and delete work from the cards | manual | [ ] |
| T-033 | Budget modal type switch updates categories without error | manual | [ ] |
| T-034 | Empty states render for a new event | manual | [ ] |

## Manual smoke checklist (after a UI change)
1. Start `npm start`, open http://localhost:3000.
2. Log in as admin → create an event → open every enabled tab → add one item in each of Team,
   Tasks, Timeline, Sponsors, Finances, Budget, Files, Shows and Meetings.
3. Edit and delete a show and a meeting; confirm the list refreshes.
4. Add a budget line, change its type in the modal, save.
5. Create a viewer with `team: view`, log in as them: event opens, no add/edit buttons,
   task status selects disabled.
6. Create an assignee, assign a task, log in: “My tasks” lists it.
7. Download a backup, restore it, open the restored copy, download an attachment.
8. Switch to Persian, reload, log out and back in; language stays Persian.

## Edge cases to always check
- Empty input / empty state; very long names and notes; multi-line notes.
- A user with no event access or no granted tabs.
- Deleting a design location that a show referenced (`ON DELETE SET NULL`).
- Uploading a file over 50 MB (rejected) and an empty/invalid upload.
- Restore of a zip with a missing `events.json` (400/500 with a clear message).
- Old database with missing columns; old database with WAL pages.
- Windows: temp DB cleanup after tests (WAL file lock).

## Pre-release checklist
- [ ] `npm test` passes
- [ ] Manual smoke checklist done
- [ ] No open Blocker or Major bugs in `docs/bugs.md`
- [ ] Existing `data/db/events.db` (if present) still opens with data intact
- [ ] `docs/status.md` updated
