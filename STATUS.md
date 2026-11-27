# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1–T4)
**Milestone:** M1 walking skeleton (T1–T4 of T12 done)
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- **T1:** npm workspaces, root scripts (`dev`, `check`, `test` with TZ=UTC, `build`, `start`),
  ESLint 9, Vitest 4, TS 5.9.3, React 18.3.1, Vite 7, Fastify 5, Socket.IO 4.8, Prisma 6.19.3.
  Server `/api/health` + SPA serving; web hello page. Prisma schema from ARCH §4.1.
- **T2:** `shared/` views, zod request schemas (`req.*`), error codes + messages, socket events.
- **T3:** engine port of `fare_model.py`: `pyRound`/`up05`, `ammanParts`, tariff, geo, fare,
  plan (itertools order), zones/categories/seats/rule 1, matching rules 1–2 and 4–11, leave.
  Fixed-table source in `server/src/travel/fixed.ts` (pure `fixedMatrix`, `anchorRoute`).
- **T4:** TravelProvider (fixed + cache + select; serializable `MatrixSpec` for the fare lock),
  config (zod env), demo clock + scheduler tick (saves clock), `withLock` store with memoryRepo +
  prismaRepo, `data/seed.json` (places, 9 users incl. 2 male sims, Omar, friend codes), `seed:reset`.

## Verification
- `npm run check`: green, 87 tests (~4 s): golden values, rule rejects, store contract on both repos
  (rollback, last-seat race, chat seq), clock, config, seed, travel.
- `npm start` with no env: seeds once, restart resumes the saved paused clock. Phones: not yet (T12).

## Next task
- Board: `docs/TASKS.md`. Next CC: **T6** (domain + commands + views + Socket.IO), then T10.
- **CX: T5 is unblocked.** Import types from `@nextstop/shared`, schemas as `req.*`.

## Blocked / waiting
- Owner: O1 Google keys, O2 Replit (needed by T11, T12). O3 Jeeny screenshots. O4 commission.
- [verify] JUST semester dates. Zone, k-means, plan numbers are first guesses.
- Pitch deck: rebrand + friends, demand spots, Uni plans slides (SPEC §7.3).

## Decisions (this session)
- Node 20 EOL (Apr 2026) but locked; `engines` `>=20.19`; use Node 22 on Replit if offered. npm 12: `allowScripts` = Prisma + esbuild.
- `npm audit`: 4 highs in the Prisma 6 CLI (fix needs Prisma 7). Engine times are µs, Python-exact.
- Engine CALIBRATION stays 1.00; domain passes env CALIBRATION × category price as `priceFactor` (bit-identical).
- Not yet tested: rules 7–9 reject paths, "not cheaper than solo"; added when T6 needs them.
- Prisma Member has a storage-only `pos` column (member order; paused-clock joins share joinedAt).
- `select.ts` serves the fixed table for every source until T11. `npm start` defaults `DATABASE_URL`.
