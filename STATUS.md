# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1–T4, T6, T10)
**Milestone:** M1 walking skeleton (T1–T4, T6, T10 of T12 done)
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- T1 scaffold · T2 `shared/` contract · T3 engine port (golden-exact) · T4 store, clock, travel, seed.
- **T6:** domain + commands for every P0 action: signup, demo login, quote, search, create, join
  (rules 1–12, version check + 1 retry), leave (free/late, credits, host hand-off, last rider
  cancels + reverses charges), find driver, ready check (manual, auto at −45, sim auto-Ready after
  3 s real time), dispatch + expiry, accept (fare lock), reject, group chat (masked), complete trip
  + summaries, demo clock (stepped fast-forward), simulate rider, reset, settings.
  Views (`server/src/views/`) decide all visibility; Socket.IO pushes per-user views on connect and after commits.
- **T10:** `server/test/demo-script.test.ts` replays SPEC §2.2 steps 1–6 with every §2.3 number.

## Verification
- `npm run check`: green, 111 tests. Includes the demo script, state machine rows, late-leave
  reversal, last-seat race, join vs ready check race, privacy (no other rider's address/coords), realtime auth.
- `npm start` boots: health, Socket.IO handshake, scheduler ticking. Phones: not yet (T12).

## Next task
- **CX: T5, then T7** (route→command map is in TASKS.md T7), T8, T9. CC next: **T11** once O1 lands, else T14 prep.

## Blocked / waiting
- Owner: O1 Google keys, O2 Replit (needed by T11, T12). O3 Jeeny screenshots. O4 commission.
- [verify] JUST semester dates. Zone, k-means, plan numbers are first guesses.

## Decisions (this session)
- Node 20 EOL but locked (`engines >=20.19`); use Node 22 on Replit if offered. npm 12 `allowScripts`.
- `npm audit`: 4 highs in the Prisma 6 CLI (fix needs Prisma 7). Engine times are µs, Python-exact.
- Prisma Member has a storage-only `pos` column. Repo gained `listRidesByDriver`. `locked.order` maps matrix points.
- Commands live in one module (`commands/index.ts`), not one file each: shared prepare/commit/retry helpers.
- Shortcuts: `chat.unread` = 0 (client counts), demo dispatch offers every seeded driver, a +1's
  late charge rides on the member, Google places use their name as the area (P1), chat purge after 24 h not built.
- Late leaver sees the ride again only as the summary; a free leaver never sees it again.
