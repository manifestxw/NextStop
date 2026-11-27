# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1 scaffold, T2 contract, T3 engine)
**Milestone:** M1 walking skeleton (T1–T3 of T12 done)
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- **T1:** npm workspaces, root scripts (`dev`, `check`, `test` with TZ=UTC, `build`, `start`),
  ESLint 9, Vitest 4, TS 5.9.3, React 18.3.1, Vite 7, Fastify 5, Socket.IO 4.8, Prisma 6.19.3.
  Server `/api/health` + SPA serving; web hello page. Prisma schema from ARCH §4.1.
- **T2:** `shared/` views, zod request schemas (`req.*`), error codes + messages, socket events.
- **T3:** engine port of `fare_model.py`: `pyRound`/`up05`, `ammanParts`, tariff, geo, fare,
  plan (itertools order), zones/categories/seats/rule 1, matching rules 1–2 and 4–11, leave.
  Fixed-table source in `server/src/travel/fixed.ts` (pure `fixedMatrix`, `anchorRoute`).

## Verification
- `npm run check`: green. 57 tests: all SPEC §4.7 golden values + §4.7.1 (zones, gender modes,
  Comfort, +1), the 3 model unit tests, every matching rule's reject path. Tests take ~2.5 s.
- `npm start` and `npm run dev` work (T1). Works on 3 phones: not yet (T12).

## Next task
- Board: `docs/TASKS.md`. Next CC: **T4** (TravelProvider wrappers, clock, store, seed).
- **CX: T5 is unblocked.** Import types from `@nextstop/shared`, schemas as `req.*`.

## Blocked / waiting
- Owner: O1 Google keys, O2 Replit (needed by T11, T12). O3 Jeeny screenshots. O4 commission.
- [verify] JUST semester dates. Zone, k-means, plan numbers are first guesses.
- Pitch deck: rebrand + friends, demand spots, Uni plans slides (SPEC §7.3).

## Decisions (this session)
- Node 20 is end-of-life (Apr 2026) but locked; `engines` is `>=20.19`. Owner: use Node 22 on Replit if offered.
- npm 12 blocks install scripts: `allowScripts` approves Prisma + esbuild only. Vite pinned once at root.
- `npm audit`: 4 highs in the Prisma 6 CLI config loader; fix needs Prisma 7 (locked to 6).
- Engine times are epoch microseconds and emulate Python timedelta's µs rounding (exact parity).
- `TimedMatrix` lives in `engine/types.ts`; T4's TravelProvider builds one per evaluation.
- CALIBRATION is a constant 1.00 for now; T4 wires env `CALIBRATION` (comment in constants.ts).
- Not yet tested: rules 7–9 reject paths, "not cheaper than solo"; added when T6 needs them.
