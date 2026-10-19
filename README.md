# Event Manager

A local-first web app for planning events. It runs on your machine: one Node process, one
SQLite database, no account with a cloud service, no internet required at runtime.

## Features

Each event has its own workspace with these tabs (admins can switch modules off per event):

- **Overview** — date, location, status, description and critical notes.
- **Team** — members with role, section, section head, ID number, phone, photo and notes.
- **Tasks** — To do / In progress / Done columns, importance, due dates, team members and
  assignee users (assignees get a personal task list).
- **Timeline** — milestones, preparation steps and deadlines with a done state.
- **Design** — locations and per-location plans.
- **Speakers, Workshops, Adventures** — programme participants and optional activities.
- **Shows** — schedule, segments, equipment checklist and an optional design location.
- **Meetings** — agenda, attendees (from team/speakers/guests/participants) and outcomes.
- **Participants / Guests** — external people and teams with invite/attendance status.
- **Sponsors** — contact details and money / in-kind / services contributions.
- **Finances** — income and expenses in toman, optional receipt attachment.
- **Budget** — planned amounts by category, funding source, actuals and variance.
- **Files** — per-event attachments (up to 50 MB each), stored on disk.

Other features:

- **Roles:** admin, viewer (read-only), custom (view/edit per tab) and workflow specialist
  (task list only). Access can be limited per event.
- **Bilingual:** English and Persian (RTL), remembered between visits.
- **Backups:** download a zip containing the data and attachments; restore it to create
  copies of the events.
- **Upgrades:** a database from an older version (root `events.db`) is imported automatically
  once on first start.

## Requirements

- **Node.js 22.13 or newer** (Node 24 recommended; it uses the built-in `node:sqlite`).
- No other services. `npm install` installs two zip libraries used only for backups.

## How to run

**Option A (easiest, Windows):** double-click `start.bat`

**Option B:** in a terminal

```
npm install
npm start
```

Then open http://localhost:3000

**Docker:**

```
docker compose up --build
```

The first account is seeded as `admin` / `admin123` unless `ADMIN_USER` and `ADMIN_PASS`
are set. **Change the password after the first login** (top bar → Change password).

## Where is my data?

```
data/db/events.db      # all structured data (SQLite, WAL mode)
data/files/<eventId>/  # uploaded attachments
```

To move or back up the app, copy the whole `data/` folder — or use **Admin → Backup**, which
produces one zip with the data and attachments. The database and files are excluded from Git.

`DATA_DIR` can point somewhere else (for example a mounted volume). If `/main` is writable
(as on some deployment hosts), the app uses `/main/eventmanager` automatically.

### Upgrading from an old version

Older versions stored the database as `events.db` next to `server.js`. If the active
`data/db/events.db` has no events, the app imports that file once on startup, keeps the
previous empty database as `data/db/events.db.pre-legacy-<timestamp>`, and logs the migration.
The old `events.db` is left untouched.

## Tests

```
npm test
```

The suite starts the real server against temporary databases and covers roles/permissions,
event entities, backup → restore (including attachments) and the legacy-database migration.
See [vibe-docs/docs/testing.md](vibe-docs/docs/testing.md) for the manual checklist.

## Project structure

```
server.js       HTTP server + REST API + static files
db.js           SQLite schema, migrations, queries, export/import/backup
public/         Frontend (HTML + CSS + JS, no build step)
data/           Your database and attachments (created on first run)
test/           Integration and migration tests (node:test)
vibe-docs/      Product and engineering documentation
start.bat       Double-click launcher for Windows
```

## Documentation

- [Project docs index](vibe-docs/README.md)
- [Agent/developer entry point](vibe-docs/CLAUDE.md)
- [Architecture](vibe-docs/docs/architecture.md) ·
  [Decisions](vibe-docs/docs/decisions.md) ·
  [Status](vibe-docs/docs/status.md) ·
  [Bugs](vibe-docs/docs/bugs.md)
