# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Thu 26 Nov · **By:** Codex (planning and reference model)
**Milestone:** M0 setup → next: M1 walking skeleton
**Deployed URL:** none yet · **Build stamp:** none

## Just shipped
- Docs: SPEC v5, DESIGN, ARCHITECTURE (React + Node/TS), AGENTS, fare_model.py
- Skills installed in `.agents/skills/`: ponytail, test-driven-development, impeccable, grill-me
- Aligned the demo, booking overlap, cancellation, restart and skill instructions.

## Verification
- Reference model printed the §4.7 fixture and demo values. Three cancellation regression tests passed.
- `npm run check`: unavailable until the npm workspace is scaffolded.
- Works on 3 phones (deployed): no

## Next task
1. Scaffold npm workspaces `shared/`, `server/`, `web/` per ARCHITECTURE §3, with root
   scripts from §11 (`dev`, `check:quick`, `check`, `build`, `start`). Tests run with `TZ=UTC`.
   Add `.gitignore` entries for `node_modules/`, `dist/`, `server/public/`, `data/app.db`.
2. Port `fare_model.py` → `server/src/engine/`, golden tests first (ARCHITECTURE §6).
   Start with `pyRound` and `ammanParts`. Tool: Claude Code + test-driven-development.
3. Deploy a "hello" build to Replit (Reserved VM) and open it on 3 phones over a hotspot.

## Blocked / waiting
- Is code written before the event allowed? Ask at the 9:30 briefing. Until then: docs only.
- [verify] Replit plan supports a Reserved VM deployment.
- [verify] Google Cloud billing + server key + browser key work.
- Owner name in AGENTS.md is still `[OWNER]`.

## Decisions (this session)
- Leaving during redispatch is free. Create and join require a 15-minute gap between bookings.
- Stack: React + Vite, Node 20 + TS, Fastify, Socket.IO, Prisma + SQLite.
- Replit: hosting only. Demo clock paused by default.
