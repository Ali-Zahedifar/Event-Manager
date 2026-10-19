# Event Manager — project docs

Documentation for the local Event Manager app. The code lives at the repository root;
this folder explains what it does, how it is built, and how to change it safely.

## Start here

| File | Purpose |
|------|---------|
| [CLAUDE.md](../vibe-docs/CLAUDE.md) | Commands, rules and conventions for agents/developers |
| [docs/prd.md](docs/prd.md) | What the product is, who it is for, scope |
| [docs/architecture.md](docs/architecture.md) | Stack, folder map, data model, request flow |
| [docs/decisions.md](docs/decisions.md) | Why the important choices were made |
| [docs/plan.md](docs/plan.md) | Phased implementation checklist |
| [docs/status.md](docs/status.md) | Current state and next step |
| [docs/bugs.md](docs/bugs.md) | Bugs found, fixes and verification |
| [docs/testing.md](docs/testing.md) | Test commands, coverage and manual checks |
| [tasks/current.md](tasks/current.md) | The scoped task for the current session |

## Quick start

```bash
npm install
npm start            # http://localhost:3000
npm test             # integration + migration tests
```

The first account is seeded as `admin` / `admin123` unless `ADMIN_USER` and
`ADMIN_PASS` are set. Change the password after the first login.

## Keeping docs current

- `docs/status.md` is the handoff note: update it at the end of every session.
- Add a decision to `docs/decisions.md` when a choice will be hard to reverse.
- Log a bug in `docs/bugs.md` before fixing it; record how it was verified.
- Tests prove behavior; update `docs/testing.md` when coverage changes.
