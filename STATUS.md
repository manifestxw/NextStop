# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1–T11, T13, T14, T17–T19, T25)
**Milestone:** M1 code done; only **T12** (deploy + 3 real phones) left · M2: T13 done
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- T1–T11, T13: engine, store, domain, REST, every P0 screen, demo menu, snapshot (Google places), polish.
- Real roads fit 4 only with a shared pickup: sims Rania @ Arabella, Dana @ University St (with Sara).
- Demo now: 5.35 solo → 3.10 → 2.20 → **1.70 ×4**; offer 6.71 / collect 6.80 / first pickup 7:20
  (Sara) / respond 7:05; late leave at **6:53** → 1.65 each; Omar 4.95 + 1.70 credit = 6.65.

## Verification
- `npm run check`: green, 190 tests. `demo-script.test.ts` replays SPEC §2.2 on the snapshot (stage
  numbers); golden tests on the fixed table. Every flow checked in headless Chromium. Phones: T12.
- **T14, T17–T19/T25:** Google map, friends, driver taps, no-show, driver cancel, solo fallback; autopilot.
- **T15/T16:** Uni plans end to end: picker, week grid, demo card (test numbers, last4 only), My plan (states,
  cancel ≥12 h → replacement, plan a replacement), 12 h placement, 20% per subscriber + RideSync credit. Huda seeded.
- **T20/T21:** driver route line, rider ↔ driver chat (private per rider), live place search (server proxy);
  Airport place + snapshot pairs (existing cells untouched).
- **T22–T24 (P2):** k-means demand spots + best-spot card; demo traffic/weather/drivers; supply-aware ready check.
- **T26–T31 (owner):** autopilot log; place picker + pins; invites; in-car lock; phone OTP, profile, calling; PWA.

## Next task
- **T12 (owner): deploy on Replit.** Import the GitHub repo; `.replit` sets Node 22, build `npm ci --include=dev && npm run build`,
  run `npm start`, port 3000→80, Reserved VM. Secrets: `GOOGLE_SERVER_KEY`, `VITE_GOOGLE_BROWSER_KEY`, `DEMO_PIN` (not 1337).
  Then open `https://<app>.replit.app/?as=lina&pin=<PIN>` etc. on 3 phones. Board done; CC next: owner's DESIGN changes.

## Blocked / waiting
- O2 Replit (T12); new hotspot IP → add it to the browser-key referrers. O3 Jeeny screenshots → CALIBRATION. O4 commission + AI scoring at the briefing.
- **Keys were pasted in chat:** restrict the server key to Routes + Places; rotate both after the event.
- [verify] JUST semester dates; zone/k-means/plan numbers are guesses; pitch deck numbers → §2.3.

## Decisions (this session)
- Owner: Google's places for seeds (CC = Aydoun mall); 4 riders via shared pickup.
- No-show waits count from the shown minute. Default 20 drivers nearby (keeps −45). Deploy: owner, later.
- Node 20 EOL but locked; `npm audit`: 4 highs in Prisma 6 CLI; storage-only Member `pos`, Ride `cancelReason`.
- User.phone (+962…, plain indexed column; one per account in code) + lastName (own screens only). OTP state in memory. DECLINED invites. Public area of a searched/pinned place is set by the server.
- Noor + Huda get seed logins. Pins: street address (Geocoding API, owner enabled it), else nearest place. No "use my location" (SPEC §5).
