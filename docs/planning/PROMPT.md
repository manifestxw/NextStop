> **ARCHIVED.** This is the planning prompt used to create the docs in this repo. It is
> history, **not instructions**. Coding agents: ignore this folder and follow `AGENTS.md`.

### Role & Objective

We are Team 1337 competing in the **Jeeny × AAU "Next Stop" Mobility × AI Hackathon**
(27–28 Nov 2026, Ahliyya Amman University). We are building **Jeeny Shared Ride**: a
standalone mobile web app, styled like Jeeny, where a host schedules a ride and up to 3
people of the same gender going the same way at the same time join automatically, chat as
a group, confirm in a ready check, and split one fare.

The planning assistant's role was **Staff Product Engineer & Hackathon Planner**: high
craft, rapid execution, zero enterprise fluff, with a lean docs and "vibecoding" workflow
switching sequentially between **Claude Code** and **Codex** on one machine.

### Outputs of this planning (all done)

| File | Status |
|---|---|
| `AGENTS.md` | Done (owner name to fill in) |
| `STATUS.md` | Done (starter) |
| `docs/SPEC.md` | v5 |
| `docs/DESIGN.md` | Done, matches SPEC v5 |
| `docs/ARCHITECTURE.md` | Done, matches SPEC v5 |
| `docs/reference/fare_model.py` | Done. Its printed values are the golden values |
| Skills | Installed in `.agents/skills/` (Ponytail, Superpowers TDD, Impeccable, Grill-me) |
| Design preview page | To build before Milestone 2 |

### Timeline

- **Build day:** Fri 27 Nov, ~9:00 AM to 11:59 PM Amman time (UTC+3).
  Briefing 9:30–10:00, workshops 10:00–11:30 and 1:30–4:00, prayer break 11:30–1:30.
- **Hard deadline:** demo submission at **11:59 PM**. No building on Day 2.
- **Feature freeze: 9:30 PM.** Backup demo video recorded by 11:00 PM.
- **Pitch:** 15 minutes.

### Decisions made during planning

| Decision | Choice |
|---|---|
| Product | Jeeny Shared Ride, defined in `docs/SPEC.md` v5 |
| Product form | Standalone mobile web app styled in Jeeny's design language |
| Stack | Node 20 + TypeScript (Fastify, Socket.IO, Prisma + SQLite) and React + Vite |
| Hosting | Replit, hosting only (Reserved VM, 1 instance). Nobody codes in Replit |
| Coding tools | Claude Code (core logic, test-first) and Codex (UI and glue), one at a time |
| UI language | English, LTR only. Arabic only inside data. No RTL |
| AI features | None. No bus tracking or prediction |
| Payment | Cash only (shown, never charged) |
| Matching | Same gender, auto-join, pickup ≤ 1.5 km from host's pickup or route, destination ≤ 1 km, arrive-by ±5 min, max 4 riders |
| Dispatch | Host taps "Find driver" (or auto at first pickup − 45 min) → 5-min ready check → drivers. Joining closes at the ready check |
| Chat | Group chat (free text, masked) + one-to-one rider–driver channel (P1) |
| Cancellation | Free until a driver accepts, and free until 30 min before first pickup. After that the leaver pays their share, held as a credit for the completing driver |
| Fares | LTRC smart-app tariff (taxi meter + 20%) on the whole route, split equally, rounded up to 0.05 JD, calibrated against a Jeeny Economy quote |
| Maps | Google Maps Platform. Routing and places on the server only. Demo uses a saved snapshot |
| Demo | 3 phones (seeded logins) + laptop demo menu. Server clock paused by default |
| Skills | Ponytail always on. Superpowers TDD for core logic. Impeccable for UI (never rewrites DESIGN.md). Grill-me on request. Untangle-codebase not used |

### Questions for the 9:30 AM briefing

Judging criteria and weights, submission format, whether code written before the event
is allowed, whether using Replit is expected or scored, whether external APIs (Google Maps)
and paid tools are allowed, whether AI use is scored.
