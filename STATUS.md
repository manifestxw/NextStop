# STATUS.md
> Overwrite on every handoff. Max 40 lines. Git keeps the history.

**Updated:** Fri 27 Nov · **By:** Claude Code (docs: RideSync v8)
**Milestone:** M0 setup → next: M1 walking skeleton
**Deployed URL:** none yet · **Build stamp:** none

## Just shipped
- SPEC v8: **Uni plans** (§3.19, P1). Weekly (3–5 rides, 1 replacement) and semester
  (2–5 rides/week, replacements 5% min 1). Rides placed into synced rides 12 h ahead.
  20% off per subscriber on campus rides; RideSync credits the driver. Demo card only.
- `fare_model.py` extended to v8 (zones, gender modes, +1, Uni plans, k-means). v5 output
  byte-identical; new golden values in SPEC §4.7.1; `test_fare_model.py` 19 tests green.
- v6–v7: RideSync rebrand, zones, gender toggle, friends, k-means spots, DESIGN app tours.

## Verification
- `cd docs/reference && python3 -m unittest`: 19 OK. `python3 fare_model.py`: ~12 s.
- `npm run check`: unavailable until the npm workspace is scaffolded.
- Works on 3 phones (deployed): no

## Next task
- Board: `docs/TASKS.md`. Next CC task: **T1** (scaffold), then T2, T3.
- Next CX task: **T5** once T2 is done. Owner: O1–O4 now, in parallel.

## Blocked / waiting
- [verify] Replit VM, Google keys, Jeeny Comfort quote, airport fees, commission rate.
- Commission rate: ask at the briefing; on stage say "usual commission", no number.
- Teammate: screenshot Jeeny Economy + Comfort CC → JUST (normal + ~7:30 AM) → CALIBRATION, COMFORT.
- [verify] JUST semester dates. Plan prices kept at 2.00 / 1.60 (owner).
- Zone, k-means and plan numbers are first guesses. Owner to tune.
- Pitch deck: rebrand + friends, demand spots, Uni plans slides (SPEC §7.3).

## Decisions (this session)
- Code before the event: allowed (owner, 27 Nov). Owner in AGENTS.md: Laith.
- Seeded subscriber is Huda (new, AM → JUST Mon–Thu); Noor stays the spare sim rider.
- Owner: uni ride = campus endpoint, no ID check; cancel cutoff 12 h; demo card; 20% per rider.
- Placement runs at the 12 h cutoff (same moment cancels stop counting), fullest ride first.
- Semester replacements round down (min 1). No fee refunds. Airport not plannable.
- Unplaceable planned ride returns a free replacement. Discount never changes others' shares.
