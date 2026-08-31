# Event Manager

A simple, local web app to plan and manage events. Run it on your laptop, open it in your browser, and all data stays on your machine.

## Features

Per event you can manage:

- **Overview** — event details and a *critical information* section for important notes.
- **Team** — members with name, role, ID number, phone, photo and notes.
- **Tasks** — status (To do / In progress / Done), importance (Low / Medium / High / Critical), due dates, and appointment of team members.
- **Sponsors** — contact info, contribution type (money / in-kind / services), amount, status and notes.
- **Timeline** — a dated schedule with milestone / prep / deadline entries that can be marked done.

## Requirements

- Windows with **Node.js 22.13+** (LTS recommended). Install from https://nodejs.org
- No other dependencies. No internet needed to run the app.

## How to run

**Option A (easiest):** double-click `start.bat`

**Option B:** in a terminal run

```
node server.js
```

Then open http://localhost:3000

## Where is my data?

Everything is stored in a single SQLite database file: **`events.db`** (next to `server.js`).

To back up or move your data, just copy that one file.

## Restoring after moving

Place `events.db` back in the project folder and start the app — everything reappears.

## Project structure

```
server.js       HTTP server + REST API (Node built-ins only)
db.js           SQLite database schema and queries
public/         Frontend (HTML + CSS + JS, no build step)
start.bat       Double-click launcher
events.db       Your data (created on first run)
```
