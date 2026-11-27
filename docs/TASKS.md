# TASKS.md: build board

The shared to-do list. **Tools:** `CC` = Claude Code, `CX` = Codex, `OWN` = Laith (or a teammate).
SPEC §8 priorities and AGENTS.md rules apply. One tool edits the repo at a time.

## How to use (every session)
1. Read `AGENTS.md`, `STATUS.md`, then this file.
2. **Pick** the first `todo` task for your tool whose `needs` are all `done`.
   Nothing unblocked for you? Write "waiting on Tn" in STATUS.md and stop.
3. **Claim** it: change `todo` to `doing CC` (or `doing CX`) and save. Before starting
   work, read the SPEC/ARCHITECTURE/DESIGN sections the task names.
4. **Finish:** run `npm run check` (green, or STATUS says what's red), mark the task
   `done <short hash>`, overwrite STATUS.md, commit (AGENTS §10). Partly done? Leave it
   `doing` and write exactly where you stopped in STATUS → "Next task".
5. Found new work? Add a task at the end of the right section with the next free number.
   Don't reorder or delete other tasks.

## Owner (do these first, in parallel with T1–T3)
- [ ] **O1** `todo` OWN: Google Cloud: billing + budget alert, enable Routes, Places (New), Maps JS. Server key → `.env` `GOOGLE_SERVER_KEY`; browser key (Maps JS, `localhost` + `*.replit.app`) → `VITE_GOOGLE_BROWSER_KEY`. Test one `computeRoutes` call. (ARCH §15)
- [ ] **O2** `todo` OWN: Replit: confirm Reserved VM on the plan; import the GitHub repo. Else pick Render/Railway. (ARCH §11)
- [ ] **O3** `todo` OWN: Teammate screenshots Jeeny Economy + Comfort, CC → JUST, normal time + ~7:30 AM. (SPEC §4.1.1)
- [ ] **O4** `todo` OWN: At the briefing: Jeeny commission rate, whether AI is scored. Write answers in STATUS.

## M1: walking skeleton (P0)
- [x] **T1** `done 6747f75` CC: Scaffold npm workspaces `shared/ server/ web/` + root scripts (`dev`, `check:quick`, `check`, `build`, `start`; `seed:reset` lands with T4, `snapshot` with T11), `TZ=UTC` vitest, ESLint, `.gitignore`, `.env.example`, Prisma 6 pinned. needs: — (ARCH §3, §11)
- [x] **T2** `done dfe9698` CC: `shared/` contract: `views.ts`, `requests.ts` (zod), `errors.ts`, `events.ts` for every P0 endpoint, plus typed stubs for P1/P2 (plans, invites, guest, demand). **Contract freeze:** after this, changes need server + web in one commit. needs: T1 (ARCH §7.1, §9)
- [x] **T3** `done ccb131f` CC: Engine port, golden tests first: `pyRound`, `ammanParts`, tariff, geo, fare, plan, `zone.ts` (CATEGORY, zone, seats, gender_ok), matching, leave. Must match SPEC §4.7 + §4.7.1. needs: T1 (ARCH §6)
- [x] **T4** `done 5bd3e09` CC: TravelProvider Fixed + cached + select; clock (paused) + scheduler tick; Prisma schema; `store.withLock`; memoryRepo + prismaRepo contract test; `data/seed.json` (places, users, Omar, seeded logins, friend codes). needs: T3 (ARCH §4, §5, §8)
- [x] **T5** `done e85503e` CX→CC (owner, 27 Nov): Web skeleton: Vite + React + router, `tokens.css` from DESIGN §2–§4 (Paper/Cockpit, `data-category`), fonts, `net/api.ts`, `net/socket.ts`, Zustand session (viewSeq rules), `?as=` seeded login. needs: T2 (ARCH §10)
- [x] **T6** `done a824f6d` CC: Domain + commands (P0) (incl. stepped fast-forward + due events in the scheduler `onTick`; env CALIBRATION × category price as `priceFactor`): create, join, leave (free/late, credits), find-driver, ready check (+ sim auto-Ready), dispatch, accept, reject, complete trip, summary; chat with masking + system messages; `views/` with privacy tests; Socket.IO pushes. needs: T2, T4 (ARCH §7, §9, SPEC §3)
- [x] **T7** `done 34ae1c5` CX→CC (owner, 27 Nov): `http/routes.ts` for every P0 endpoint (+ demo PIN), auth, error mapping, `/api/health` with build stamp, static SPA serving. needs: T6 (ARCH §7.1, §11)
  - Wire to `createCommands()` (`server/src/commands/index.ts`, already built in `index.ts` as `commands`). 1:1 map:
    signup→`signup` · demo/login→`demoLogin` · me→`me` · quote→`quote` · search→`search` · POST rides→`createRide` ·
    join→`join` · leave→`leave` · find-driver→`findDriver` · ready→`ready` · chat→`chat` · offers accept/reject→`accept`/`reject` ·
    demo/clock→`demo.clock` · demo/simulate-rider→`demo.simulateRider` · demo/complete-trip→`demo.completeTrip` · demo/reset→`demo.reset` · demo/settings→`demo.settings`.
  - Validate bodies with `req.*` (422 on failure). Token from `Authorization: Bearer`. `ConflictError` → 409 `{code, message, ...extra}`,
    `LoggedOutError` → 401 `{code:'LOGGED_OUT'}`. Rider/driver commands return a `View` → `{ok:true, view}`; demo ones return `DemoView`.
    Fill `DemoView.buildStamp` from the build stamp. `chat.unread` is always 0: the client counts unread locally (shortcut).
- [x] **T8** `done 1322288` CX→CC (owner, 27 Nov): P0 rider screens: signup, home + trip screen (chips, gender switch, category tiles), matching list + card, host setup, status sheet (stage track, Sync Pass, seat meter), ready check sheet, leave sheets, group chat, trip summary. needs: T5 (can use mock views until T7). (DESIGN §5–§8, §12)
- [x] **T9** `done 1322288` CX→CC (owner, 27 Nov): P0 driver screens: idle home, trip offer, active trip, rider-left banner, driver summary; demo menu (clock, simulate rider, complete trip, reset, build stamp). needs: T5 (DESIGN §8, §12.2)
- [x] **T10** `done a824f6d` CC: Demo-script test replaying SPEC §2.2 steps 1–6 end to end (`server/test/demo-script.test.ts`). needs: T6
- [x] **T11** `done 2edde26` CC: Snapshot source + `npm run snapshot`; generate `data/demo_snapshot.json`; rerun the model on it; regenerate SPEC §2.2/§2.3/§1 and DESIGN numbers. needs: T4, O1 (SPEC §4.2.2)
- [ ] **T12** `todo` CX: Deploy to Replit (or fallback), verify build stamp, run the §2.2 demo on 3 phones over a hotspot. Fix mobile checks (ARCH §10). **M1 done when this passes.** needs: T7, T8, T9, T10, O2

## M2: RideSync skin (P0 polish)
- [x] **T13** `done 5f29d05` CX→CC (owner, 27 Nov; before T12 by owner choice): Impeccable pass against DESIGN.md: split-flap numbers, merge mark/loader, perforated Sync Pass, motion + reduced motion, contrast. needs: T12
- [x] **T14** `done 87bca96` CC (before T12 by owner choice): Google map wiring data: rider view own ring + destination only, driver stops; recheck privacy tests. needs: T12

## P1 (only after every P0 item works on the deployed URL)
- [ ] **T15** `todo` CC: Uni plans domain: subscribe (demo card validation, last4 only), planned trips, `place_bucket` in the scheduler, replacements, 12 h cancel, discount + RideSync credit at COMPLETED; `demo/place-planned`. needs: T12 (SPEC §3.19)
- [ ] **T16** `todo` CX: Uni plans UI: entry card, plan picker, week grid builder, demo card sheet, My plan, discount display. needs: T15 (DESIGN §8)
- [ ] **T17** `todo` CC: Friends domain: +1 add/remove (seats, late charge to bringer), friend-code invites, expiry at READY_CHECK. needs: T12 (SPEC §3.17)
- [ ] **T18** `todo` CX: Friends UI: friends card, add-friend sheet, invite sheet, invite card, profile code. needs: T17
- [ ] **T19** `todo` CC: Hardening: no-show, driver cancel + redispatch, "Book a solo ride", pickup-time banners, stale tab + reconnect, Google fallback. needs: T12
- [ ] **T20** `todo` CX: P1 UI: Places autocomplete, driver route line, driver chat, pickup/drop-off taps, "Map unavailable". needs: T19
- [ ] **T21** `todo` CC: Airport: QAIA seed place + snapshot pairs. needs: T11

## P2 (only if time remains before the 9:30 PM freeze)
- [ ] **T22** `todo` CC: Demand spots: `kmeans.ts` port (mulberry32), `data/demand_seed.json` from `sample_history`, `GET /api/driver/demand`, demo driver-position. needs: T12 (SPEC §3.18)
- [ ] **T23** `todo` CX: Demand map + best spot card. needs: T22
- [ ] **T24** `todo` CC: Traffic/weather/supply demo controls. needs: T12

## Added during the build
- [x] **T25** `done HASH` CC: Demo autopilot: "Play next step" in the demo menu runs SPEC §2.2 one step at a time as the seeded people (rehearsal + stage backup). Tested to the canonical numbers.

## Cut order if time runs out
P2 entirely → T16/T15 (pitch Uni plans from a slide) → T18/T17 → T21 → T20.
