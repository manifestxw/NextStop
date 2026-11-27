# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1 scaffold)
**Milestone:** M1 walking skeleton (T1 of T12 done)
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- **T1:** npm workspaces `shared/ server/ web/`, root scripts `dev`, `typecheck`,
  `check:quick`, `check`, `test` (TZ=UTC), `build`, `start`. ESLint 9 flat config, Vitest 4,
  TS 5.9.3, React 18.3.1, Vite 7, Fastify 5, Socket.IO 4.8, Prisma 6.19.3 (exact).
- Server: `/api/health` (build stamp), static SPA + client-route fallback, JSON 404 for `/api/*`.
  Web: hello page that calls `/api/health`. Prisma schema copied from ARCH §4.1.
- `.env.example`, `.gitignore`, key-leak check, build stamp, `data/.gitkeep`.

## Verification
- `npm run check`: green (typecheck, build, eslint, 2 tests, key-leak skipped: no key yet).
- `npm start` (prod path): db push created the SQLite DB, health + SPA fallback ok.
- `npm run dev`: Vite :5173 proxies `/api` to the server :3000. Works on 3 phones: not yet (T12).

## Next task
- Board: `docs/TASKS.md`. Next CC: **T2** (shared contract), then T3 (engine port).
- Next CX: **T5** after T2. Owner: O1–O4 in parallel.

## Blocked / waiting
- Owner: O1 Google keys, O2 Replit (needed by T11, T12). O3 Jeeny screenshots. O4 commission.
- [verify] JUST semester dates. Zone, k-means, plan numbers are first guesses.
- Pitch deck: rebrand + friends, demand spots, Uni plans slides (SPEC §7.3).

## Decisions (this session)
- Node 20 is end-of-life (Apr 2026) but locked; `engines` is `>=20.19`. Owner: use Node 22 on Replit if offered.
- npm 12 blocks install scripts: `allowScripts` in package.json approves Prisma + esbuild only.
- Vite pinned once at the root (^7) so Vitest and the web app share one copy.
- `npm audit`: 4 highs remain, all in the Prisma 6 CLI's config loader; fix needs Prisma 7 (locked to 6).
- Build stamp script is `server/scripts/write-build-stamp.mjs` (no tsx needed at build).
