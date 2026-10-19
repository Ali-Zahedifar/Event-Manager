# Bugs

Process: **reproduce → hypothesis → agreed fix → verify → close**. The audit on 2026-10-18
was requested as a single “fix any bugs you find” task, so the fixes below were applied in
that session and verified with tests or a running server.

## Fixed in 2026-10-18 audit

### BUG-001: Every non-admin API request returned “Admin only”
- **Status:** Fixed · **Severity:** Blocker
- **What happens:** A viewer/custom/assignee can log in, but the dashboard, event page and
  `/api/my-tasks` all fail with `403 Admin only`.
- **Cause:** `handleApi()` called `handleAdminExport()` and `handleAdminBackup()` before any
  route matching. Each began with `requireAdmin()`, so a non-admin was rejected on every path.
- **Fix:** Only call admin handlers for `pathname.startsWith('/api/admin/')`.
- **Verified by:** `test/api.test.js` — viewer `GET /api/events` is 200; assignee `GET /api/my-tasks` returns the task.

### BUG-002: Meetings always showed zero attendees
- **Status:** Fixed · **Severity:** Major
- **What happens:** Attendees saved in the meeting form disappear from the meeting card.
- **Cause:** `getEvent()` queried `meeting_attendees WHERE meeting_id = mt.meeting_id`; meetings
  have `id`, not `meeting_id`, so the query was always empty (and a stray column name).
- **Fix:** Use `mt.id`.
- **Verified by:** `test/api.test.js` asserts the attendee is returned after creation.

### BUG-003: Restore crashed and could not rebuild relations
- **Status:** Fixed · **Severity:** Blocker
- **What happens:** Uploading any non-empty backup returns 500. Even if it succeeded, rows would
  reference exported ids and duplicate `event_id`.
- **Cause:** `copyTable()` used every exported column (including `event_id` and old ids) and
  appended `event_id` again. Task members/show segments used the wrong foreign key values.
- **Fix:** Rewrote `importEvents()` with explicit column lists and old→new id maps for members,
  tasks, design locations, shows and meetings; recreate `task_members` and attendees with mapped ids.
- **Verified by:** `test/api.test.js` restores a full event and checks members, task members,
  show segments, location link, meeting attendee and attachment.

### BUG-004: Backup stored files in the wrong place; restore did not restore attachments
- **Status:** Fixed · **Severity:** Major
- **Cause:** `archive.directory(FILES_ROOT, false, 'files/')` passed `'files/'` as the third
  “data” argument (archiver v7 signature is `directory(dirpath, destpath)`), so entries were not
  under `files/`. Restore also wrote entries to their original paths while rows had no
  `stored_path` (it is scrubbed from JSON).
- **Fix:** Use `archive.directory(FILES_ROOT, 'files')`. On restore, map the zip’s old event id
  to the new one, write into `data/files/<newEventId>/`, create a fresh `files` row, and block
  path traversal.
- **Verified by:** `test/api.test.js` downloads the restored attachment and compares its contents.

### BUG-005: Restored users could never log in; admins were demoted
- **Status:** Fixed · **Severity:** Major
- **Cause:** `importUsers()` hashed `changeme123` with SHA-256 while `authenticateUser()` uses
  scrypt, and mapped `admin` to `custom`.
- **Fix:** Use `hashPassword('changeme123', salt)` and preserve the exported role.
- **Verified by:** Restore test (users already exist, so skipped) + manual review; documented in D-009.

### BUG-006: Edit/delete on Shows and Meetings did nothing
- **Status:** Fixed · **Severity:** Major
- **Cause:** `editByType()` and `delByType()` had no `shows`/`meetings` branches, although the
  cards emitted edit/delete buttons.
- **Fix:** Add both branches; refetch the event and re-render the tab.
- **Verified by:** Manual UI check; code path covered by the event aggregate test.

### BUG-007: Changing budget type threw an error
- **Status:** Fixed · **Severity:** Major
- **Cause:** The change handler declared `const t = typeSel.value`, shadowing the translation
  function used in the same callback (`t('bud.cat.' + k)`).
- **Fix:** Rename the local to `type`.
- **Verified by:** `node --check` and manual modal check.

### BUG-008: After a successful restore, the page threw `renderTabs is not defined`
- **Status:** Fixed · **Severity:** Major
- **Cause:** `restoreBackupModal()` called a function that does not exist.
- **Fix:** Re-render with `renderEvent()`.
- **Verified by:** Manual restore flow in the running app.

### BUG-009: Existing users saw an empty app after upgrading
- **Status:** Fixed · **Severity:** Blocker (data appears lost)
- **Cause:** Databases moved from root `events.db` to `data/db/events.db`; no migration existed.
- **Fix:** One-time legacy adoption (`VACUUM INTO`, previous empty target renamed, `legacy_import_v1` flag).
- **Verified by:** `test/legacy.test.js` imports an old schema, converts money, and confirms a
  second boot does not import twice.

### BUG-010: Admin menu icon showed the fallback flag
- **Status:** Fixed · **Severity:** Minor
- **Cause:** `icon('settings')` was never added to the icon map.
- **Fix:** Add a gear path.

### BUG-011: Read-only users could attempt writes
- **Status:** Fixed · **Severity:** Minor
- **What happens:** Viewers could change a task status select or open Overview edit buttons,
  then receive a 403 toast (and a visually inconsistent control).
- **Fix:** Disable task status selects when `canWriteTab('tasks')` is false; show Overview edit
  buttons only for admins (the API only allows admins to edit event metadata).

### BUG-012: A user with no granted tabs still saw event Overview
- **Status:** Fixed · **Severity:** Minor
- **Cause:** `fallbackTab()` returned `'overview'` when `visibleTabs()` was empty.
- **Fix:** Return `null` and show the “No access” empty state; modules modal falls back safely.

### BUG-013: Missing translations and language choice not shared
- **Status:** Fixed · **Severity:** Minor
- **Cause:** `fin.category`, `notes`, `unit.toman`, `f.duration`, `min.short`, `err.save`,
  `save.changes`, three show types and some Persian keys were missing; the login page stored
  the language under `evm_lang` while the app used `em-lang`.
- **Fix:** Added EN/FA keys and unified the storage key.

### BUG-014: Static handling masked server errors and missing assets
- **Status:** Fixed · **Severity:** Minor
- **Cause:** Any read error (`!err.code || …`) fell back to `index.html`, and missing `.js`/`.css`
  returned HTML with 200.
- **Fix:** Only `ENOENT` triggers fallbacks; missing files with an extension return 404.

## Fixed in 2026-10-19 theme work

### BUG-105: Theme update broke `app.js` and Persian translations
- **Status:** Fixed · **Severity:** Blocker
- **What happens:** The Settings tab never rendered and the event page threw a `SyntaxError`
  on load (`renderTeam` contained two `:` branches). Persian users saw raw keys or English
  because the dictionary ended with duplicate `fa:` objects.
- **Cause:** The theme section was pasted into the middle of `renderTeam()`'s ternary, using
  undefined helpers (`el()`, `THEME_VARS`). The theme translations were added as extra `fa:`
  keys in the same object literal instead of into the existing `fa` dictionary; in JavaScript
  the last duplicate wins, so only the theme-only block survived.
- **Fix:** Removed the stray branch, added a real renderer for the theme UI, and merged the theme
  strings into the single `fa` object (510 en / 510 fa keys). Follow-up: the renderer is now the
  topbar sun/moon + theme menu and the `settings` tab is gone (D-012).
- **Related:** the same duplicate-key pattern hid four more keys (`save` and `cancel` in both
  languages, plus one extra `theme.pick`/`theme.reset` pair) — all duplicates were removed, so
  `i18n.js` now has zero repeated keys (510 en / 510 fa).
- **Verified by:** `node --check` on the three scripts, `npm test`, and a browser smoke test of
  Light/Dark/Custom, colour editing, reset, reload persistence and a restricted viewer.

## Open / known

### BUG-101: Restored users lose event access
- **Status:** Open · **Severity:** Minor
- **What happens:** Users are restored with roles, but `event_access` rows are not remapped.
- **Next step:** Decide whether to grant restored users access to restored copies of their events.

### BUG-102: Task assignee links are not restored
- **Status:** Open · **Severity:** Minor
- **What happens:** `task_assignees` is not exported/imported, so assignees must be re-added.
- **Next step:** Export usernames per task and map them after user import.

### BUG-103: JSON export contains no attachments
- **Status:** Open · **Severity:** Minor
- **What happens:** `exportEvent`/`exportAll` include file metadata only; binaries are only in the zip backup.

### BUG-104: Orphaned attachment directories are not cleaned
- **Status:** Open · **Severity:** Minor
- **What happens:** A failed transaction after writing a file, or a deleted event whose file
  removal callback fails, can leave files under `data/files/`. Add a maintenance check.
