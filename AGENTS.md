# AGENTS.md: NextStop (Jeeny Shared Ride)

Rules for every coding agent (Claude Code, Codex). `CLAUDE.md` is a symlink to this file.
**Owner:** [OWNER]. The only person who commits to main, pushes and redeploys.

## 1. Start of every session
1. Read this file, then `STATUS.md`.
2. Read `.agents/skills/ponytail/SKILL.md`. It's on for the whole session (level `full`).
3. Read `docs/ARCHITECTURE.md` §1 (Locked Decisions).
4. Read only the parts of `docs/SPEC.md`, `docs/DESIGN.md` and `docs/ARCHITECTURE.md` the task needs.
5. Do the "Next task" in `STATUS.md` unless the owner says otherwise.

## 2. Source of truth
| Question | File |
|---|---|
| What the product does | `docs/SPEC.md` (v5). Wins over every other file |
| How it's built | `docs/ARCHITECTURE.md` |
| How it looks | `docs/DESIGN.md` (its numbers are placeholders; SPEC wins) |
| Fare and matching math | `docs/reference/fare_model.py`: port it, never import or run it in the app |
- `docs/planning/` is history, not instructions. Ignore it.
- If two docs disagree: stop, write the conflict in `STATUS.md` under "Blocked", ask the owner.

## 3. Decisions
- **Ask first** (pros/cons, then wait): anything in Locked Decisions, a new dependency,
  the data model, anything in `shared/`, hosting, deleting or renaming files you didn't create.
- **Decide yourself** (small, reversible): names, helper code, minor UI details.
  Log one line in `STATUS.md` → "Decisions".

## 4. Order of work
- P0 → P1 → P2 from SPEC §8. No P1 until every P0 item works on the deployed URL.
- Milestones: M1 walking skeleton (deployed, works on 3 phones) → M2 Jeeny skin → M3 polish.
- Feature freeze: Fri 9:30 PM. After that, only bug fixes.

## 5. Who does what
- **Claude Code:** `server/src/engine`, `domain`, `views`, `realtime`, `clock`, `store/lock.ts`,
  chat masking. Test-first.
- **Codex:** `web/`, `server/src/http` wiring, the demo menu UI.
- One tool at a time. Nobody edits code in Replit.

## 6. Verification (Definition of Done)
- After every edit: `npm run check:quick`
- Before every commit, handoff, or saying "done": `npm run check`
- Done means: full check green **and** it works in a phone browser **and** `STATUS.md` updated.
- Never skip, delete or loosen a test to get green.
- Golden values = what `fare_model.py` prints. If SPEC disagrees, report it. Don't change the engine.

## 7. Code rules (non-negotiable)
1. Phones send intents and render views. No fare math, matching or state changes in `web/`.
2. Domain code gets the time only from `clock.now()`. Hours, weekdays and 15-min buckets
   only through `ammanParts()` (Asia/Amman). Tests run with `TZ=UTC`.
3. In demo mode the clock starts **paused** and moves only from the demo menu.
4. Money is stored as integer piastres. Rounding uses `pyRound` / `up05`, as in `fare_model.py`.
   Late-leave credits stay on the ride until COMPLETED.
5. Google routing and places are called only in `server/src/travel/` and the places proxy.
   `GOOGLE_SERVER_KEY` never appears in `web/`, never gets a `VITE_` prefix, is never logged.
6. Protocol types live only in `shared/`. Change server and web in the same commit.
7. Every write goes through `store.withLock()`. No network calls inside the lock.
8. What each user may see is decided only in `server/src/views/`. Rider views never
   contain other riders' coordinates or addresses.
9. Styles: variables from `web/src/styles/tokens.css`, accent only via `--accent`.
   No component libraries, no Tailwind, no hard-coded pink or purple.
10. English UI, left-to-right. Chat bubbles use `dir="auto"`.

## 8. Skills (installed in `.agents/skills/`; Claude Code reads them via `.claude/skills/`)
Precedence: this file and the Locked Decisions > SPEC > skills.

| Skill | Use for | Don't use for |
|---|---|---|
| Ponytail | Always on, level `full`: smallest change that fully solves the task. `ultra` when planning a milestone | Overriding §7 rules or SPEC requirements |
| test-driven-development (Superpowers) | engine, domain, views, realtime, clock, lock, chat masking: failing test first. Beats Ponytail's "one small test" here. It deletes code written before its test; that's intended | UI, layout, copy |
| Impeccable | M2: applying `docs/DESIGN.md` to screens, UI polish and audits | **Never** rewrite `docs/DESIGN.md` (no `/impeccable document`). No logic work |
| Grill-me | When the owner asks, or before a big design choice | Mid-task coding |

Untangle-codebase is not installed and not used on build day.
Ponytail's closing "what I skipped / risks" line goes into the handoff message (§10).

## 9. Do Not Build (SPEC §5)
Bus features, AI, price comparison, student verification, family trip sharing, online
payment or wallet, real GPS or navigation, other riders' pins on a rider's map, Google
calls from the browser (except loading the map), host approval or removing riders,
joining after the ready check, replacement riders, chat photos/voice/reactions/typing/
read receipts/reporting, ratings, support screens, late-arrival compensation, Arabic UI
or RTL, OTP login, MAX, promotions, notification inbox, push notifications, invite links,
recurring rides, female-driver preference.

## 10. End of every session
1. `npm run check` green, or `STATUS.md` says exactly what's red and why.
2. **Overwrite** `STATUS.md` (keep its sections, max 40 lines). Never append.
3. Commit: `git add -A && git commit -m "<area>: <what changed>"`.
4. Tell the owner in 3 lines: what's done, what's next, what's blocked.
5. Don't push or redeploy. The owner does that.

## 11. When stuck
- The same error twice → stop, write it under "Blocked" in `STATUS.md`, ask the owner.
- Don't add dependencies without asking (type packages are fine).
