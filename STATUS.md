# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1–T10)
**Milestone:** M1 walking skeleton (T1–T10 done; T11 snapshot + T12 deploy left)
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- T1 scaffold · T2 contract · T3 engine (golden-exact) · T4 store/clock/travel/seed · T10 demo-script test.
- **T6:** domain + commands for every P0 action: signup, demo login, quote, search, create, join
  (rules 1–12, version check + 1 retry), leave (free/late, credits, host hand-off, last rider
  cancels + reverses charges), find driver, ready check (manual, auto at −45, sim auto-Ready after
  3 s real time), dispatch + expiry, accept (fare lock), reject, group chat (masked), complete trip
  + summaries, demo clock (stepped fast-forward), simulate rider, reset, settings.
  Views (`server/src/views/`) decide all visibility; Socket.IO pushes per-user views on connect and after commits.
- **T7** (owner moved it to CC): REST routes for every P0 command + banners seen; 409/401/403/422 mapping.
- **T5** (owner moved it to CC): web shell: api/socket/session (`acceptView`), `?as=` login, tokens 1:1.
- **T8/T9** (owner moved them to CC): every P0 screen. Rider: signup, home + trip (chips, time, gender
  switch, category tiles with quotes), matching list, host setup (ladder, zone), status (stage track,
  Sync Pass, seat meter, chat card), ready check sheet (countdown ring), leave sheets (free/late),
  group chat, summary. Driver (Cockpit): idle + offers, offer, active trip, summary. Demo menu (PIN).

## Verification
- `npm run check`: green, 124 tests (server, shared, web).
- Headless Chromium (390×844) screenshots of every screen through the full §2.2 demo, incl. real taps
  (pick place → Find rides → Start your own sync → Confirm; Sara: search → Join → Leave sheet). Numbers match §2.3.
- Fixed from that: `?as=` login lost to the signup redirect (now logs in before first render), error boundary.

## Next task
- **T11** (snapshot) needs O1 keys in `.env`. **T12** (deploy + 3 real phones) needs O2 Replit.
- Not built yet: Google map (T14; a marks panel stands in), time wheels (native time input), M2 polish (T13).

## Blocked / waiting
- Owner: O1 Google keys, O2 Replit (needed by T11, T12). O3 Jeeny screenshots. O4 commission.
- [verify] JUST semester dates. Zone, k-means, plan numbers are first guesses.

## Decisions (this session)
- Node 20 EOL but locked (use Node 22 on Replit if offered). `npm audit`: 4 highs in the Prisma 6 CLI.
- Storage-only Member `pos`; repo `listRidesByDriver`; `locked.order`. Commands in one module (`commands/index.ts`).
- Shortcuts: unread counted on the phone; demo offers go to every seeded driver; no 24 h chat purge.
