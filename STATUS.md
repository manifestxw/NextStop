# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (T1–T11, T13, T14, T25)
**Milestone:** M1 code done; only **T12** (deploy + 3 real phones) left · M2: T13 done
**Deployed URL:** none yet · **Build stamp:** see `/api/health`

## Just shipped
- T1–T10: scaffold, contract, golden-exact engine, store/clock/travel, domain + commands, REST,
  web shell, every P0 rider/driver screen + demo menu. T13: DESIGN polish (icons, split-flap, motion, contrast).
- **T11:** Google keys tested (Routes, Matrix, Places). Google + Snapshot sources, `npm run snapshot`
  (41 calls), committed `data/demo_snapshot.json`. Seed places are Google Places (owner's choice).
- Real roads fill only 4 riders with a shared pickup: sims are now Rania @ Arabella, Dana @ University
  St (with Sara); Noor @ Yarmouk spare. SPEC §1/§2.2/§2.3/§2.6 + DESIGN numbers regenerated.
- Demo now: 5.35 solo → 3.10 → 2.20 → **1.70 ×4**; offer 6.71 / collect 6.80 / first pickup 7:20
  (Sara) / respond 7:05; late leave at **6:53** → 1.65 each; Omar 4.95 + 1.70 credit = 6.65.

## Verification
- `npm run check`: green, 130 tests. `demo-script.test.ts` replays SPEC §2.2 on the snapshot (stage
  numbers); golden tests stay on the fixed table (`test/fixtures/places.ts`). Key-leak check: ok.
- Booted on the snapshot; headless Chromium shows the new numbers. Real phones: not yet (T12).
- **T14:** real Google map seen on localhost:3000: Paper (riders: own pickup + halo, destination only),
  Cockpit (driver: numbered pickups fit to view, "1·2" for a shared spot). Key rejection → marks panel.
- **T25:** demo menu autopilot ("Play next step", 7 steps, state-driven) for rehearsal and as a stage backup.

## Next task
- **T12 (owner/CC):** deploy to Replit (Reserved VM, Node 22 if offered), set Secrets from `.env`
  (incl. `GOOGLE_SERVER_KEY`, `VITE_GOOGLE_BROWSER_KEY` at build time), open `/?as=lina|sara|omar&pin=…`
  on 3 phones over a hotspot, run §2.2. Then P1: T19, T17, T15 (and T20 route line).

## Blocked / waiting
- Browser-key referrers set by owner (localhost:3000, 10.100.3.63:3000, *.replit.app). New hotspot IP → add it.
- O2 Replit (T12). O3 Jeeny screenshots → CALIBRATION. O4 commission + AI scoring at the briefing.
- **Keys were pasted in chat:** restrict the server key to Routes + Places; rotate both after the event.
- [verify] JUST semester dates. Zone/k-means/plan numbers are first guesses. Pitch deck numbers → §2.3.

## Decisions (this session)
- Owner: Google's places for seeds (CC = Irbid City Center mall, Aydoun); 4 riders via shared pickup.
- Live Google source: 2.5 s timeout → fixed table (logged); "offline estimates" demo flag still P1.
- Node 20 EOL but locked; `npm audit`: 4 highs in Prisma 6 CLI; Member `pos` column.
