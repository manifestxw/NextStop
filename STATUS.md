# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1–T11, T13, T14, T17–T19, T25)
**Milestone:** M1 code done; only **T12** (deploy + 3 real phones) left · M2: T13 done
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- T1–T10: engine, store, domain, REST, every P0 screen + demo menu. T13: DESIGN polish.
- **T11:** Google + Snapshot sources, `npm run snapshot`, committed snapshot; seeds are Google Places.
- Real roads fit 4 only with a shared pickup: sims Rania @ Arabella, Dana @ University St (with Sara).
- Demo now: 5.35 solo → 3.10 → 2.20 → **1.70 ×4**; offer 6.71 / collect 6.80 / first pickup 7:20
  (Sara) / respond 7:05; late leave at **6:53** → 1.65 each; Omar 4.95 + 1.70 credit = 6.65.

## Verification
- `npm run check`: green, 147 tests. `demo-script.test.ts` replays SPEC §2.2 on the snapshot (stage
  numbers); golden tests stay on the fixed table (`test/fixtures/places.ts`). Key-leak check: ok.
- Every flow checked in headless Chromium at 390×844. Real phones: not yet (T12).
- **T14:** real Google map seen on localhost:3000: Paper (riders: own pickup + halo, destination only),
  Cockpit (driver: numbered pickups fit to view, "1·2" for a shared spot). Key rejection → marks panel.
- **T25:** demo menu autopilot ("Play next step", 7 steps, state-driven) for rehearsal and as a stage backup.
- **T19:** driver taps (picked up / dropped off → COMPLETED / no-show 5 min after the shown minute),
  driver cancel (≥15 min → redispatch, else canceled), "Book a solo ride", pickup-move banners, stale tab, offline flag.
- **T17/T18:** +1 (same stops/fare, one more seat, gender + seat + solo checks, late removal charged to the
  bringer), friend-code invites (banner, invite card with own pickup, every rule, expire at ready check).

- **T15 (server done, UI not started):** subscribe (demo card, last4 only), weekly/semester planning, cancel ≥12 h →
  replacement, replacements, 12 h placement in the tick, 20% per subscriber + RideSync credit to driver. 140 server tests.

## Next task
- **Resume here:** T16 Uni plans UI (entry card, plan picker/week grid, demo card sheet, My plan, discount display,
  demo-menu "Place planned rides") on `api` → `/api/plans/*`. Seed Huda's semester plan (SPEC §2.6) not done yet.
- **T12 (owner/CC):** deploy to Replit (Reserved VM, Node 22 if offered), set Secrets from `.env`
  (incl. `GOOGLE_SERVER_KEY`, `VITE_GOOGLE_BROWSER_KEY` at build time), open `/?as=lina|sara|omar&pin=…`
  on 3 phones over a hotspot, run §2.2 (owner: later). CC now: P1 T15/T16 Uni plans, then T20.

## Blocked / waiting
- O2 Replit (T12); new hotspot IP → add it to the browser-key referrers. O3 Jeeny screenshots → CALIBRATION. O4 commission + AI scoring at the briefing.
- **Keys were pasted in chat:** restrict the server key to Routes + Places; rotate both after the event.
- [verify] JUST semester dates; zone/k-means/plan numbers are guesses; pitch deck numbers → §2.3.

## Decisions (this session)
- Owner: Google's places for seeds (CC = Aydoun mall); 4 riders via shared pickup.
- No-show waits count from the shown minute. Deploy (T12) after P1: owner's call.
- Node 20 EOL but locked; `npm audit`: 4 highs in Prisma 6 CLI; storage-only Member `pos`, Ride `cancelReason`.
