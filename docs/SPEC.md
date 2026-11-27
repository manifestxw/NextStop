# SPEC.md: RideSync (v8)

> Final feature definition. Wins over the pitch deck and brief on any conflict.
> **Rules and formulas in this file are canonical.** Distances, travel times and routes
> come from Google Maps (§4.2). Demo numbers in §1, §2.2 and §2.3 come from the saved demo
> snapshot (§4.2.2, generated 27 Nov 2026) and are asserted by `server/test/demo-script.test.ts`.
> **Golden values (§4.7) are whatever `docs/reference/fare_model.py` prints.** If this file
> and the model disagree on a number, the model wins and this file gets fixed.
> `[verify]` = assumption a teammate must check before the pitch. It does not block building.

## 0. What changed

**v8.1 (real data, 27 Nov):** seed places are Google Places; demo numbers regenerated from the
snapshot (Aydoun → JUST is 14 km, ~18 min). With real roads only 4 riders fit if two share a
pickup, so the simulated riders are now Rania at Arabella Mall and Dana at University Street
(with Sara). Shares: 5.35 solo → 1.70 with 4 riders.

**v8 (Uni plans):**
- **Uni plans** (§3.19, P1): a **weekly** plan (3–5 rides that week) and a **semester**
  plan (2–5 rides every week). Rides are planned up front and grouped into synced rides
  12 h before each one, which fills cars before anyone searches.
- **20% off uni rides for subscribers**, each rider on their own; others in the car pay
  normally. RideSync pays the difference to the driver, so the fare and driver pay don't change.
- **Replacements:** cancel ≥ 12 h ahead and, under your limit, plan another ride instead.
- Plan fee paid with a **demo card** (test numbers only, nothing charged).

**v7 (friends + driver demand):**
- **Bring a friend** (§3.17): add a **+1** who rides with you (no account needed), or
  **invite** a friend's RideSync account with their friend code. Friends pay their own share.
- **Demand spots for drivers** (§3.18, P2): k-means clustering of historical pickups
  points an idle driver to the nearest busy pickup area. Demo uses seeded sample history.
  This is the app's one AI/ML feature (§7.2 resolved).

**v6 (RideSync):**
- Product is now **RideSync**: its own brand and app, powered by Jeeny's licensed drivers,
  the smart-app tariff and Jeeny's commission (§1). New design language in DESIGN.md.
- Three ride **categories**: Economy, Comfort, Airport (§3.16), each with its own seats,
  price and **sync zone**.
- Sync zones scale with trip length instead of a fixed 1.5 km / 1.0 km (§3.16, rules 5–6).
  For the CC → JUST demo route the Economy zone is still 1.5 km / 1.0 km, so every golden
  value is unchanged.
- Same-gender matching is a **toggle** ("Same gender only"), on by default (rule 1).
- Entry point: trip screen → category → "Find rides" → matching list → "Start your own sync" (§3.4).

**v5 (review fixes):**
- Pickup times shown after the ready check never change. If a rider leaves and the driver
  would be early, the driver waits, and that wait isn't billed (§3.6).
- Late-leave money is held as a credit on the ride and paid to the driver who **completes**
  the trip. If the ride is canceled, the leaver's charge is reversed (§3.10).
- Stop order uses the reference model's single score (§3.6).
- Riders' maps show only their own pickup and the destination (§3.14).
- Tapping Shared opens the matching list first; hosting is "Start your own shared ride" (§3.4; renamed in v6).
- Trip summary screen (§3.15) and a demo "Complete trip" button (§2.5).
- P0 now includes: simulated riders auto-answering the ready check, chat masking, the
  "Complete trip" button, the trip summary and seeded logins (§8).
- Demo clock is paused by default and only the demo menu moves it (§2.1).
- Golden values match the model: late-leave fare 8.86, Rain trip 59 min, Friday row removed.
- Wording fixes: concurrency, 60 min (creating) vs 45 min (joining), chat history (last 100),
  route interface with stops, pitch claims, what "offline" means.

**v4:** distance-based matching, auto-join, group chat + driver channel, ready check,
joining closes at the ready check, late leaver pays their own share.
**v3:** Google Maps TravelProvider, calibration against Jeeny, build priorities.
**v2:** smart-app tariff, canonical demo numbers, detour rule, state machines.

## 1. Business & Judging Angle (BRD)

**One line:** RideSync: schedule a ride (Economy, Comfort or Airport), and people going
the same way at the same time join automatically and split one fare. Riders can keep it
same-gender with one toggle. Runs on Jeeny's drivers.

**Problem:** Daily commuters choose between unreliable, overcrowded buses and solo rides
they can't afford every day. First example: Irbid students commuting to JUST (27,114
students, 2019; JUST is ~20 km east of Irbid). Bus ≈ JOD 0.60 `[verify]`. Solo Jeeny ride
≈ JOD 5.35 at morning peak (smart-app tariff on Google's road data). RideSync works anywhere Jeeny operates.

**Positioning (important):** JOD 1.70 is about 3× the bus. Don't pitch "as cheap as the
bus". Pitch **door-to-door, planned to arrive 5 min before your arrive-by, same gender if
you want it, about 70% less than riding solo**. LTRC is piloting new public bus routes linking Irbid,
Zarqa and Jerash (July 2026). RideSync complements better buses. It doesn't depend on
buses staying bad.

**Value (computed in §4.7, recheck after the snapshot):**
| For | Number |
|---|---|
| Riders | JOD 5.35 solo → JOD 1.70 shared (−68%) |
| Drivers | +JOD 1.11 net per trip (JOD 5.37 vs 4.26, +26%) for a 35-min trip instead of 29 `[recheck per hour]` |
| Jeeny | ~JOD 1.34 commission per shared trip from riders who pay Jeeny JOD 0 today (bus users) `[verify 20% commission]` |

**RideSync and Jeeny:** RideSync is its own app and brand. Each synced ride is **one normal
Jeeny booking on one licensed vehicle with one fare**, dispatched to Jeeny's drivers.
Jeeny keeps its usual commission. Rider accounts, outstanding balances and cash collection
run on Jeeny's existing rails.

**Why judges will care:** it plugs into what Jeeny already runs (scheduled rides, cash,
the gender field on profiles, outstanding-balance fees, Economy/Comfort tiers, airport trips). It demos live on several phones, including
group chat and a ready check. It opens a segment Jeeny doesn't serve today. Prices use real
road distances and traffic, the smart-app tariff, and a calibration to Jeeny's own Economy price.

**Prepared answers for judge questions:**
- *Is fare splitting legal?* The trip is priced with the LTRC smart-app tariff (taxi meter
  + 20%) as one booking. Riders split that one fare among themselves. We **never** sell
  per-seat fares, because that's a separate licensed category (shared "service" taxis).
  Jeeny legal confirms before launch.
- *Where do your prices come from?* Real Google road distances and traffic, the LTRC
  smart-app tariff, and a calibration against a real Jeeny Economy quote on this route.
  The waiting-time rate is our estimate.
- *What if traffic makes the ride late?* Pickup times come from traffic-aware travel times
  and are planned so everyone arrives 5 min before their arrive-by. It's a plan, not a
  guarantee. Delay alerts and a credit for late arrivals are roadmap items.
- *Why is same-gender a toggle?* It's on by default: safety and cultural comfort, especially
  for women, is the main reason people would share a car with strangers (precedent: Uber's
  Women Preferences). Riders who don't mind turn it off and get more matches. Nobody with
  the toggle on is ever matched into a mixed ride.
- *Why do zones differ by category?* A 1.5 km zone works inside a city. On a 110 km
  airport run nobody else lives that close to your route, so the zone grows with trip length
  and is widest for Airport (§3.16).
- *What if someone joins that I'm not comfortable with?* Riders talk in the group chat,
  and anyone can leave for free until 30 min before pickup. The host can't kick people,
  so nobody gets excluded for reasons other than the matching rules.
- *What stops a man from signing up as female?* Gender is fixed after signup and tied to
  the verified account. The driver sees rider names at pickup. One report suspends
  the account. ID verification is on the roadmap.
- *Is the driver the same gender?* No. Any driver can accept, same as today. A female-driver
  preference is a natural next step.
- *What if someone cancels at the last minute?* In the last 30 min they pay their own share,
  so the others aren't punished. Their shares usually go down.
- *What if the ride doesn't fill?* It goes with whoever joined. Each pays a bigger share.
  Before booking, the host already sees "If nobody joins: JOD 5.35".
- *Doesn't this cannibalize solo rides?* The worst case is 4 solo riders worth JOD 4.57 in
  commission becoming one JOD 1.34 trip. We target the bus segment (scheduled, ≥ 60 min
  ahead, commute routes), where today's revenue is zero.
- *Why would drivers take it?* More per trip, a guaranteed scheduled booking at peak, and
  the same per hour.

## 2. Live Demo Script & Scope (PRD)

### 2.1 Setup
- Pitch: 15 minutes. Problem 2 min, live demo 5 min, business and Jeeny fit 3 min,
  buffer and questions 5 min.
- 3 phones on the same live URL, logged in with seeded accounts (§2.6):
  **Phone A Lina** (host, female), **Phone B Sara** (joiner, female), **Phone C Omar** (driver).
  A laptop runs the hidden demo menu.
- **Screens mirrored** to the projector (scrcpy, AirPlay, or a laptop showing all 3 views).
- **Own mobile hotspot** for all 3 phones and the laptop. The phones need internet for the
  map and the server. Don't rely on venue wifi.
- **One server-side demo clock, paused by default.** It starts at Sun 29 Nov 2026, 6:10 AM
  (a workday) and moves only when the demo menu moves it.
- **Data source: Snapshot** (§4.2.2). No Google routing calls on stage.
- Fallback: a recorded video of this exact flow.

### 2.2 Demo flow (6 steps)
Numbers are placeholders until regenerated from the snapshot (§4.2.2). With the clock
paused, steps 1–4 all happen at demo time 6:10. Only step 5 needs a clock jump.
1. **Lina creates a ride.** Irbid City Center → JUST, arrive by 8:00 AM, places picked
   from quick-pick chips. "Same gender only" stays on. She picks **Economy** ("from
   JOD 1.60"), taps **Find rides**, sees no matching rides, and taps **Start your own sync**.
   She sees "If nobody joins: JOD 5.35", "Be ready by 7:36 AM" and "Sync zone · 1.5 km",
   and confirms. Status: 1 of 4 seats. The group chat opens.
2. **Sara joins.** She enters University Street → JUST, arrive by 8:00, keeps Economy and
   "Same gender only", and taps **Find rides**. Lina's ride appears (badge "Women only") ("City Center area → JUST", "JOD 3.10 each if you join", pickup ~7:26). She taps
   Join and is in instantly. Both phones update live: 2 of 4 seats, JOD 3.10 each. Chat shows
   "Sara joined" and Sara types "Hi! I'm near University Street".
3. **The ride fills and Lina finds a driver.** Tap "simulate rider" twice (Rania, then Dana).
   Rania (Arabella) then Dana (University Street, with Sara) join and each posts a chat line. 4 of 4, JOD 1.70 each. Lina taps **Find driver**.
   A ready check appears on every phone. The simulated riders answer Ready within a few
   seconds. Lina and Sara each tap **I’m ready**, then the ride goes to drivers.
4. **Omar accepts.** Phone C shows the offer: JOD 6.71, 4 riders, cash, collect JOD 6.80,
   17.2 km · ~35 min, first pickup 7:20 AM (Sara, then Dana, Rania, Lina), respond by 7:05 AM, every stop with its pickup
   time. He accepts. Phones A and B show "Omar · White Hyundai Elantra · 12-34567".
5. **Late cancellation.** Jump the clock to 6:53 (27 min before the first pickup). Sara taps
   Leave ride and sees "You'll pay your share: JOD 1.70". She confirms; it shows as
   "Outstanding balance JOD 1.70" on her next booking. Lina's share **drops** to JOD 1.65.
   Pickup times don't change. Omar's stop list drops Sara's stops, with the banner
   "Sara canceled. Collect JOD 4.95 cash · JOD 1.70 credit at trip end".
6. **Trip summary.** The operator taps **Complete trip**. Every phone shows the summary:
   3 riders × JOD 1.65 cash. Omar: JOD 4.95 cash + JOD 1.70 credit = JOD 6.65.

### 2.3 Canonical demo numbers
From the snapshot (§4.2.2) with the Google seed places, exactly what `demo-script.test.ts`
asserts. Times are demo-clock times; with the clock paused, rows 1–7 all run at 6:10.
All destinations are JUST.

| Moment | Riders | Full fare | Each pays | Pickups (ready by) |
|---|---|---|---|---|
| Lina creates | Lina | 5.32 | 5.35 | Lina 7:36 |
| Sara joins | +Sara | 6.18 | 3.10 | Sara 7:26, Lina 7:34 |
| Sim Rania joins | +Rania | 6.59 | 2.20 | Sara 7:22, Rania 7:29, Lina 7:33 |
| Sim Dana joins | +Dana | 6.71 | 1.70 | Sara 7:20, Dana 7:21, Rania 7:29, Lina 7:33 |
| Lina taps Find driver | 4 | 6.71 | 1.70 | **Pickup times freeze** |
| Ready check done → dispatched | 4 | 6.71 | 1.70 | same. Respond-by 7:05 |
| Omar accepts (fare locks) | 4 | 6.71 | 1.70 | same. Collect 6.80. 17.2 km · ~35 min |
| 6:53 Sara leaves late (charged 1.70, held as credit) | 3 | 6.59 | 1.65 | Dana 7:21, Rania 7:29, Lina 7:33 (unchanged) |
| Complete trip | 3 | 6.59 | 1.65 | Omar: 4.95 cash + 1.70 credit = 6.65 (remainder 0.06) |

- Drop-offs at JUST 7:52–7:54 AM (Lina arrives 7:52).
- Host estimates at creation: 1 rider 5.35 · 2 riders 2.80 · 3 riders 2.00 · 4 riders 1.60 ("from JOD 1.60").
- Lina's summary: paid 1.65, saved 3.70 vs solo. Solo fares: Lina 5.35 · Sara 6.00 · Rania 5.50 · Dana 6.00.
- Driver: **Omar**, White Hyundai Elantra, plate 12-34567.
- Every join passes all §3.5 rules, incl. rule 11: first pickup 7:20 ≥ 6:10 + 45 min.
- Auto ready check would start at 6:35 (first pickup − 45); in the script Lina starts it at 6:10.
- After regenerating the snapshot, rerun the test, then update this section, §1 and §2.2 from it.

### 2.4 Real vs mocked
| Real (built) | Mocked |
|---|---|
| Accounts with gender, "Same gender only" toggle | Phone/OTP login (name + gender signup, seeded demo logins) |
| Creating and auto-joining rides, leaving | Driver GPS, car moving on the map |
| Matching rules (§3.5) incl. category sync zones (§3.16) | Payment (cash shown, nothing charged) |
| Live sync across phones | Extra riders ("simulate rider"), their chat lines and Ready answers |
| Group chat (P0) and driver channel (P1) | Driver supply ("drivers nearby" setting) |
| Ready check and dispatch | Trip progress in the demo ("Complete trip" button) |
| Uni plans: planning, 12 h batch, 20% subscriber discount, replacements (P1) | Plan payment (demo card, test numbers only, nothing charged) |
| Bring a friend: +1 and friend-code invites (P1) | Pickup history before launch (seeded sample data, labeled as sample) |
| Demand spots: k-means on pickup history (P2) | Driver location (driver's home base, or set from the demo menu) |
| Driver accept, reject | |
| Fare (smart-app tariff, calibrated), split, late-leave math | |
| Stop order and pickup times | |
| Distances, routes, traffic-aware times (Google, via the saved snapshot) | |
| Map display (Google Maps, needs internet) | |

### 2.5 Demo controls (hidden menu, PIN required)
- **P0:**
  - Clock: paused by default. +5 min, jump to time, jump to the next event, pause/resume.
  - Simulate rider: the next valid seed rider joins and posts their chat line.
  - Simulated riders auto-answer the ready check (on by default).
  - **Complete trip:** marks every remaining stop done and opens the trip summary on all phones.
  - Reset to the seeded state (also logs out all phones, clears chats and balances).
  - Seeded logins for the 3 phones (§2.6).
  - Shows the build stamp (git hash) and server health.
- **P1:** data source switch: Snapshot (default) / Live Google / Fixed table. If a live
  Google call fails, the app falls back to the fixed table and shows "offline estimates"
  in the demo menu only.
- **P2:** traffic level (Normal / Heavy / Jam), weather (Clear / Rain), drivers nearby (2 / 8 / 20),
  driver location (pick a seed place) for demand spots.
- **P1:** "Place tomorrow's planned rides now" (runs the §3.19 placement early for the demo
  without moving the clock).

### 2.6 Seed data
Seed places are Google Places (resolved 27 Nov; owner chose Google's places over our
estimates). `data/seed.json` stores each `place_id`, name, Google coordinates and area name.
The fixed-table approximations stay only for the §4.7 golden tests.

| Key | Place | Area name (shown to others) | Google Lat, Lng (seed.json) | Fixed table only |
|---|---|---|---|---|
| CC | Irbid City Center (mall, Aydoun) | City Center area | 32.53575, 35.86534 | 32.5568, 35.8469 |
| HS | Al-Hashmi Street | Al-Hashmi area | 32.55759, 35.86503 | 32.5520, 35.8640 |
| US | University Street | University Street area | 32.53770, 35.85201 | 32.5440, 35.8570 |
| YU | Yarmouk University | Yarmouk area | 32.53518, 35.85669 | 32.5366, 35.8556 |
| AM | Arabella Mall | Arabella area | 32.53841, 35.86214 | 32.5290, 35.8660 |
| JUST | Jordan University of Science and Technology | JUST | 32.49500, 35.99117 | 32.4789, 35.9850 |

| QAIA (P1) | Queen Alia International Airport | Queen Alia Airport | 31.7225, 35.9932 |

In the demo, these appear as quick-pick chips above the search field. QAIA is only needed
for Airport rides (P1). It has no fixed-table row; Airport rides need the Snapshot or
Google source.

| Rider | Gender | Pickup | Arrive by | Chat line when joining (sim only) |
|---|---|---|---|---|
| Lina (host) | F | CC | 8:00 AM | — |
| Sara | F | US | 8:00 AM | — (typed live) |
| Rania (sim) | F | AM | 8:05 AM | "Hi everyone 👋" |
| Dana (sim) | F | US (same pickup as Sara) | 8:00 AM | "I'll be at the main gate" |
| Noor (sim, spare) | F | YU | 8:00 AM | "Hello!" |
| Male seed riders (for gender filtering) | M | any | any | — |

All seed riders book Economy with "Same gender only" on.

**Uni plans** (P1): campuses = JUST and Yarmouk University (YU). Semester dates
`[verify with the JUST calendar]`; demo: 1 Nov 2026 – 31 Jan 2027. Seed **Huda** (F, not a sim rider) has a
semester plan (4 rides/week, AM → JUST **Mon–Thu**, arrive by 8:00 AM). Her plan has no
Sunday ride, so nothing is pre-placed into the Sunday demo and Lina still sees an empty list.
Noor stays the spare simulated rider with no plan. Lina, Sara, Rania and
Dana have no plan, so the §2.3 numbers don't change.

**Friend codes** (P1): every account has a fixed 6-character code. Seeds: Lina `LINA26`,
Sara `SARA26`, Noor `NOOR26`.

**Sample pickup history** (P2, §3.18): `data/demand_seed.json`, 1,320 synthetic pickups
over the 4 weeks ending Sat 28 Nov 2026, from `sample_history()` in `fare_model.py`
(mulberry32 PRNG, seed 2026), so every run gives the same clusters. Sun–Thu 60/day (60% in
6:30–8:30 AM), Fri/Sat 15/day, around the Irbid seed places. Omar's home base:
Irbid City Center.

**Seeded demo logins** (P0): `/?as=lina`, `/?as=sara`, `/?as=omar`, each with the demo PIN.
Opening the link logs that phone in as that account, so nobody signs up on stage.

Distance to the real CC → JUST road (snapshot polyline; Economy zone 1.5 km, §3.16): AM 0.40 ·
YU 0.81 · US 1.27 km pass; **HS 2.31 km is outside**, so Al-Hashmi can't join this ride (it's a
male-rider/other-ride seed only). Fixed table (golden tests only): HS 0.8 · US 0.3 · YU 1.0 · AM 0.9 km.
Simulated riders are taken in this order and must pass every matching rule. If one fails,
the next valid seed rider is used. "Simulate rider" never fails silently.

## 3. Feature Behavior & Edge Cases (SRS)

### 3.1 Roles
- **Host:** creates the ride and counts as a rider. The host's pickup, destination, route
  and arrive-by are the **anchor** for matching. The host's only extra power is the
  "Find driver" button. The host can't remove riders. If the host leaves, the host label,
  the anchor and the button pass to the earliest remaining joiner.
- **Joiner:** joins an existing ride.
- **Driver:** receives and accepts the trip. Any gender.

### 3.2 Signup
- Name and gender (male/female). Gender is set once and can't be changed. It's needed
  for the "Same gender only" toggle (rule 1), even when a rider never turns it on.
- One-line consent: "Your first name and pickup area are shown to riders in your ride,
  and you can chat with them."
- Demo: seeded logins skip signup (§2.6).

### 3.3 State machines
**Ride:** `OPEN → READY_CHECK → DISPATCHED → ACCEPTED → IN_PROGRESS → COMPLETED`, and
`CANCELED` from any state before `IN_PROGRESS`.
| From | To | Trigger |
|---|---|---|
| OPEN | READY_CHECK | Host taps "Find driver", or clock reaches first pickup − 45 min |
| READY_CHECK | DISPATCHED | All riders answered, or 5 min passed (no answer = ready), and ≥ 1 rider remains |
| READY_CHECK | CANCELED | Every rider canceled |
| DISPATCHED | ACCEPTED | A driver accepts (fare locks) |
| DISPATCHED | CANCELED | No driver by first pickup − 15 min, or the last rider leaves |
| ACCEPTED | DISPATCHED | The driver cancels and it's still ≥ 15 min before first pickup |
| ACCEPTED | CANCELED | The driver cancels < 15 min before first pickup, or the last rider leaves |
| ACCEPTED | IN_PROGRESS | First pickup done |
| IN_PROGRESS | COMPLETED | Last drop-off done |
| ACCEPTED / IN_PROGRESS | COMPLETED | Demo only: "Complete trip" marks every remaining stop done |

**Rider in ride:** `JOINED → READY → PICKED_UP → DROPPED_OFF`. Also `JOINED/READY → LEFT`
(free or late) and `READY → NO_SHOW`.

### 3.4 Entry point and creating a ride
- The rider sets pickup, destination and arrive-by. P0: quick-pick chips for the seed
  places. P1: Google Places autocomplete as well.
- **"Same gender only"** toggle on the trip screen, **on by default**, remembered per
  account. It applies to the next search, create or join (rule 1).
- **Category tiles:** Economy, Comfort, Airport (§3.16), each priced "from JOD x" (the
  full-car estimate, §4.5). Picking Airport sets the destination to Queen Alia Airport.
  A destination at the airport always means Airport.
- **Find rides** opens **Rides going your way**: the matching list for that pickup,
  destination, arrive-by, category and toggle (§3.5).
- At the bottom of the list, and as its empty state: **Start your own sync**. Only this
  opens host setup.
- Host setup shows: estimated price per person for 1 rider up to the category's max,
  "If nobody joins: JOD 5.35", "Be ready by 7:36 AM", the ride's sync zone
  ("Sync zone · 1.5 km"), and the toggle (editable).
- **Creating** a ride requires the first pickup to be 60 min to 24 h from now. Otherwise:
  "Too soon to sync. Book a solo ride instead." (Joining uses rule 11's 45 min.)
- Creating a ride also requires the rule 12 availability check on the proposed solo plan.
- Max riders including the host: per category (§3.16). Economy 4 `[open decision §7.1]`,
  Comfort 3, Airport 3.
- The ride stores its **category**, **gender mode** (`same` if the host's toggle was on,
  else `mixed`) and **sync zone** at creation. None of them change later, including when
  the host leaves.
- The host's route (pickup → destination) is fetched once and stored as the ride's
  **anchor route** for matching, with its length in road km (L, used for the zone).

### 3.5 Finding and joining (joiner)
The joiner sees matching rides (§3.4). Tapping **Join** adds them instantly (auto-join).
No approval.

A ride appears only if **ALL** are true:
1. **Gender:** if the ride is `same`, the joiner's gender equals the ride's gender
   (the joiner's toggle doesn't matter). If the ride is `mixed`, the joiner's toggle is off.
   So a rider with the toggle on only ever sees same-gender rides of their own gender.
   **Category:** the ride's category equals the joiner's category.
2. **Seat:** a free seat (category max, §3.16). A +1 (§3.17) takes a seat. A rider joining
   with a +1 needs two free seats.
3. **State:** the ride is `OPEN`. Joining closes when the ready check starts.
4. **Arrive-by:** the joiner's arrive-by is within the category's window (Economy and
   Comfort **±5 min**, Airport **±20 min**) of the host's arrive-by.
   The ride's effective arrive-by is the **earliest** arrive-by of all riders.
5. **Pickup in the sync zone:** the joiner's pickup is within the ride's **pickup zone**
   (§3.16; 1.5 km for the demo route) straight-line of the host's pickup **or** of any
   point on the anchor route.
6. **Destination:** the joiner's destination is within the ride's **destination zone**
   (§3.16; 1.0 km for the demo route) straight-line of the host's destination.
7. **On time:** with the joiner added, every rider is dropped by the effective
   arrive-by − 5 min, and no one is dropped more than the category's early limit
   (Economy and Comfort 25 min, Airport 45 min) before their own arrive-by.
8. **Detour cap:** each rider's in-car time ≤ the category's cap (§3.16; Economy
   max(solo + 10 min, solo × 1.4)). In-car time
   runs from arrival at your pickup to arrival at your drop-off. "Solo" is that rider's own
   solo trip under the same traffic conditions and data source.
9. **Pickup shift:** no existing rider's pickup moves more than 15 min earlier than the
   first pickup time they were shown.
10. **Price:** no existing rider's share goes up, and the joiner's share is below their
    own solo fare.
11. **Timing:** the new first pickup is ≥ now + 45 min (otherwise the automatic ready
    check would already have started).
12. **One ride at a time:** on create and join, compare the candidate plan with each rider’s other active
    bookings, including those of existing riders whose times change on a join. A booking runs from
    the ride’s first pickup through its final drop-off. Require at least 15 min between the end
    of one ride and the start of the next. Exactly 15 min is allowed. Exclude this ride, closed
    rides, and bookings the rider left or finished. Recheck under the commit lock.

The card shows: host first name, gender badge ("Women only", "Men only" or "Mixed"),
mini seat row, seats left, **pickup area and destination area only**, effective arrive-by, "JOD x each if you join" (the real recomputed share) and
"Pickup ~7:26 AM".

All matching runs **on the server**, never on the phones. Distances for rules 5 and 6 are
straight-line (haversine), point-to-polyline for the route.

### 3.6 Stop order and pickup times
- Every rider has their own pickup and drop-off. Every candidate stop order (each pickup
  before that rider's drop-off) gets a score:
  **score = full fare in piastres + trip minutes + 0.01 × total in-car minutes.**
  The lowest score wins among orders that satisfy rules 7–9. (1 piastre and 1 minute weigh
  the same. This is exactly what the reference model does.) Max 8 stops, so brute force is fine.
- Stop orders are computed locally from **one** travel matrix per ride (§4.2). Never
  request distances per stop order.
- The first pickup is the latest whole minute that satisfies the effective arrive-by.
- Each rider sees "Be ready by h:mm AM". Before the ready check, if it moves more than
  3 min, the rider gets an in-app banner and a system message in the chat.
- **Frozen at the ready check:** every rider's shown pickup time is final. If a rider
  leaves later and the driver would reach a pickup early, the driver waits until the shown
  time. **That wait isn't billed:** the fare is recalculated for the remaining stops in the
  same order, starting from the same first pickup time.
- The driver waits up to 5 min after a shown pickup time before a no-show (§3.10).

### 3.7 Fare (formula in §4.4)
- Full fare = smart-app tariff formula for the **whole route including all stops**,
  × CALIBRATION (§4.1.1).
- Price per person = (full fare − credits) ÷ riders, **rounded up** to 0.05 JD. The
  driver keeps the rounding remainder (max 0.19). Credits come from late leaves and
  no-shows (§3.10).
- Prices update live on every phone when someone joins or leaves.
- **Lock:** when a driver accepts, the travel matrix, traffic and tariff freeze. After that
  the full fare changes only if stops are removed (a leave or no-show).
- Cash only. Each rider pays their own share to the driver at drop-off.

### 3.8 Ready check and dispatch
- **Start:** the host taps **Find driver** at any time while the ride is `OPEN`, or it starts
  automatically at **first pickup − 45 min**.
- **When it starts:** joining closes, pickup times freeze, and every rider (including the
  host) sees a "Ready?" sheet with a 5-min countdown and two buttons: **I'm ready** and
  **Cancel ride for me**.
  - Cancel during the ready check is always free, including after answering Ready.
  - No answer after 5 min counts as **Ready**.
  - The chat shows "Lina started the ready check" and each answer.
  - Demo: simulated riders answer Ready a few seconds after it starts (P0, §2.5).
- **End:** when all riders have answered or 5 min have passed, the ride goes to drivers
  (`DISPATCHED`) with the remaining riders.
- **Drivers only see the ride once it's dispatched**, with the final riders, stops and
  pickup times.
- The offer goes to eligible drivers (live: within 5 km of the first pickup; demo mode: all
  seeded drivers). **First accept wins.** It stays open until first pickup − 15 min. A
  driver who rejects doesn't get it again. Riders see "Finding your driver".
- **No driver by then:** the ride is canceled, no fees. Each rider sees "No driver found" and
  a **"Book a solo ride"** button (hands off to a solo Jeeny booking, mocked) prefilled with their trip and solo estimate.
- **Only the host remains:** the ride continues at the solo price (already shown at
  creation). The host can cancel free until a driver accepts.

### 3.9 Driver
- The offer sheet shows: the category ("Economy"), the gender badge, first pickup time, full fare, rider count, cash,
  **total cash to collect**, stops in order (first name + short address + pickup time),
  km · min, and respond-by.
- After accepting, the driver sees every stop on the map with the route line (§3.14).
- The stop list shows each rider's share. At each stop the driver taps "Picked up Lina" or
  "Dropped off Lina · collected JOD 1.65" (P1; the demo uses "Complete trip").
- When a rider leaves after accept, the driver's stop list, route and cash total update
  live with a banner: "Sara canceled. Collect JOD 4.95 cash · JOD 1.70 credit at trip end".
- A rider with a +1 is one stop with two shares ("Lina +1 · JOD 3.40", collected as 2 × 1.70).
- Only the driver and the rider themselves see exact pickup addresses.
- Driver cancels after accepting: back to `DISPATCHED` if ≥ 15 min before first pickup,
  otherwise canceled with no rider fees and the "Book a solo ride" button. Any credit stays
  on the ride and goes to whichever driver completes it.

### 3.10 Cancellation, no-show and money flow
- **Free leave:**
  - while no driver is currently assigned, including ready check and redispatch, or
  - after a driver accepts, if it's **≥ 30 min** before the first pickup.
  - Remove the leaver’s stops and apply §4.5 to the new fare using all credits already held.
  - If a free leave raises any remaining rider's share above their own solo fare, that
    rider can also leave free.
- **Late leave:** while a driver is assigned and **< 30 min** before the first pickup.
  - The leaver is charged **their current share**, shown as "Outstanding balance JOD x"
    on their next booking (Jeeny's existing mechanism, shown in RideSync).
  - RideSync holds that amount as a **credit on the ride**. The driver who completes the trip
    receives it with the trip. If the ride is canceled before completion, nobody receives
    it and the leaver's outstanding balance is reversed.
  - Remaining shares = (new full fare − credits) ÷ remaining riders. They usually go
    **down**, and they never go up (if the formula gives a higher share, keep the old share).
  - The completing driver always receives ≥ the new full fare (cash + credit).
- **No-show:** after waiting 5 min past the shown pickup time, the driver taps "No-show" (P1).
  Same money flow as a late leave, and the trip continues.
- **No replacements:** a seat that empties after the ready check stays empty.
- **Host leaves:** the ride continues, and the host label and button pass on (§3.1).
- **Last rider leaves:** cancel before calculating a share, reverse held charges, and notify the assigned driver.

### 3.11 Chat
**Group chat (riders only, P0):**
- Opens for a rider when they join. Shows the **last 100 messages** of the ride's chat.
- Free text, max 300 characters per message. Phone numbers (7+ digits, with or without
  spaces or dashes) and links are masked as "•••" before they're stored (P0).
- Shows first names and avatars (initials) only.
- System messages: "Sara joined", "Sara left", "Lina started the ready check",
  "Dana is ready", "Omar is your driver", pickup time changes.
- Read-only after the ride is `COMPLETED` or `CANCELED`. Deleted 24 h later.

**Driver channel (P1):**
- After a driver accepts, each rider has a separate one-to-one chat with the driver.
  Same masking and limits. Riders can't see each other's driver chats.

**Out of scope:** photos, voice, reactions, typing indicators, read receipts, reporting.

### 3.12 Notifications
In-app only: a banner or sheet shown live or on the next open. Friend invites (§3.17) use this too. Unread chat count on the
ride status screen. No push, no inbox.

### 3.13 Edge cases
| Case | Behavior |
|---|---|
| Two people take the last seat at the same moment | Whichever commits first wins. The second sees "This ride just filled up" |
| A join and the ready check start at the same moment | Whichever commits first wins. If the ready check committed first, the joiner sees "This ride just closed" |
| Host taps Find driver while alone | Allowed. Ready check with just the host, then dispatch at the solo price |
| Rider answers Cancel in the ready check | Free leave. Remaining shares recalculated before dispatch |
| Everyone cancels in the ready check | Ride canceled, no fees |
| Rider of a different gender, `same` ride | The ride never appears in their list |
| Rider with the toggle on, `mixed` ride | The ride never appears, even if everyone in it is their gender |
| Rider with the toggle off | Sees `mixed` rides and `same` rides of their own gender |
| Host turns the toggle off after others joined | Not possible. Gender mode is fixed at creation |
| Rider picks Economy, ride is Comfort | Never matched. Categories don't mix |
| Destination is the airport but category isn't Airport | Category switches to Airport before search |
| Adding a +1 to a `same` ride with a different gender | Not allowed: "This ride is women only" |
| Adding a +1 when the ride is full or the ready check has started | Not allowed: "No seat for a friend" / "This ride just closed" |
| Rider with a +1 leaves | The +1 leaves too. Late leave charges both shares to the rider |
| Invitee opens an invite after the ready check started | "This ride is no longer taking riders" |
| Invitee fails a matching rule (zone, gender, timing…) | Join refused with the rule's reason. The invite stays until the ride closes |
| Unknown friend code | "No account with that code" |
| Subscriber cancels a planned ride ≥ 12 h ahead, under the limit | Ride removed, one replacement to plan in the plan period |
| Same, over the limit | Ride removed, no replacement ("No replacements left") |
| Subscriber cancels < 12 h ahead | Normal leave (§3.10). No replacement, limit unchanged |
| Planned ride can't be placed | Notice + a free replacement (limit unchanged) |
| Non-subscriber joins a placed ride | Normal join. Pays the full share; the subscribers keep their 20% |
| Subscriber's ride isn't a uni ride (e.g. Irbid → Arabella) | Not plannable; normal rides get no discount |
| Card number isn't a test number | "Demo only: use a test card." Nothing stored |
| Rider already in a ride in the same time window | Can't join a second one |
| **Creating** a ride with first pickup under 60 min away, or arrive-by in the past | Not allowed, error shown |
| Driver rejects | The offer stays with the other drivers |
| Driver cancels after a late leave | At least 15 min before pickup: redispatch with credit held. Under 15 min: cancel and reverse charges |
| Ride canceled after a late leave | Credit paid to nobody. The leaver's outstanding balance is reversed |
| Phone loses connection | Shows "Reconnecting", then catches up (including missed chat messages, up to 100) |
| Opens a ride that's canceled, completed or expired (stale tab) | "This ride is no longer available" |
| Message contains a phone number or link | Masked before it's stored or shown |
| Google call fails or times out (live source) | Fall back to the fixed table for that evaluation. Never block the user |
| The map can't load (no internet) | P1: show "Map unavailable" in place of the map. Every sheet keeps working |
| Place search returns a place outside Jordan | Not selectable (search restricted to Jordan) |

### 3.14 Privacy on maps and screens
- **Riders** see on the map only **their own pickup** (pink pin) and **the destination**
  (purple pin), plus their position in the order ("Pickup 2 of 3"). Never other riders'
  pins, exact addresses or the full route line.
- **Other riders** appear only as first names and initials (seat row, chat).
- **The driver** (after dispatch) sees every stop as a numbered pin, the route line, and
  each rider's short address and share.
- **Matching cards** show area names only (§2.6).

### 3.15 Trip summary (P0)
Shown on every phone when the ride completes. Chat becomes read-only.
- **Rider:** "To JUST · arrived 7:52 AM", "You paid JOD 1.65 cash", "3 riders synced this
  ride", "You saved JOD 3.70 vs riding solo", and "Outstanding balance JOD x" if any.
- **Leaver (late):** "You left this ride · JOD 1.70 added to your next ride".
- **Driver:** riders and the cash each paid, credit from RideSync, total ("JOD 4.95 cash +
  JOD 1.70 credit = JOD 6.65").

### 3.16 Categories and sync zones
A **sync zone** is how far from the host's trip a joiner may be picked up (rule 5) and
dropped off (rule 6). A fixed 1–2 km works for short city trips but finds nobody on long
ones, so each zone grows with **L = the anchor route's road km** (host pickup → destination,
§3.4), between a floor and a ceiling. The zone is computed once at creation, rounded to
0.1 km, and stored on the ride.

`zone(L) = clamp(rate × L, floor, ceiling)`

| | Economy | Comfort | Airport |
|---|---|---|---|
| For | Everyday commutes | Fewer riders, less detour, nicer car | Trips to Queen Alia Airport |
| Max riders | 4 `[open decision §7.1]` | 3 (back seat only) | 3 (one large bag + one carry-on each) |
| Price (full fare) | §4.4 | §4.4 × COMFORT 1.25 `[verify]` | §4.4 `[verify airport fees]` |
| Pickup zone (rule 5) | 0.075 × L, 1.5–4.0 km | 0.06 × L, 1.0–3.0 km | 0.15 × L, 3.0–10.0 km |
| Destination zone (rule 6) | 0.05 × L, 1.0–2.5 km | 0.04 × L, 0.75–2.0 km | 1.0 km (same terminal) |
| Arrive-by window (rule 4) | ±5 min | ±5 min | ±20 min |
| Early drop limit (rule 7) | 25 min | 25 min | 45 min |
| Detour cap (rule 8) | max(solo + 10, solo × 1.4) | max(solo + 8, solo × 1.25) | max(solo + 15, solo × 1.25) |
| Detour allowance A[k] (§4.5) | 1.00 · 1.05 · 1.12 · 1.20 | 1.00 · 1.04 · 1.08 | 1.00 · 1.05 · 1.10 |

Examples (pickup zone): CC → JUST (19.3 km) Economy **1.5 km** (the floor, same as v5) ·
Irbid → Amman (~85 km) Economy 4.0 km · Amman → airport (~35 km) Airport 5.2 km ·
Irbid → airport (~110 km) Airport 10.0 km.

- Every other rule, the fare formula (§4.4), the ready check, leaves and money flow are the
  same for all categories.
- **Airport** is to the airport only. Pickups at the airport (flight delays) are roadmap.
- The zone numbers are a starting point, not research. Tune them after the first week of
  real search data; the numbers live in one table in `engine/constants.ts`.

### 3.17 Bring a friend (P1)
Two ways, both only while the ride is `OPEN` (before the ready check). Any rider can use
them, host or joiner. **Friends pay their own share.**

**A. +1 (friend rides with you)**
- On the status screen: **"Add a friend"** → first name + gender → confirm. No account.
- The +1 shares **your pickup and drop-off**: no extra stops, the route and stop times
  don't change. They take one seat and pay one share in cash to the driver.
- Max one +1 per rider. Rules that still apply: seat (rule 2), gender mode (if the ride is
  `same`, the +1 must be that gender), and the +1's share is below your solo fare.
  Adding a +1 lowers everyone's share (same fare, one more seat).
- You answer the ready check for both. Others see the +1 as a seat with their initials and
  "with Lina". The +1 isn't in the group chat.
- **Leaving:** you can remove your +1, or leave together. Same free/late rules (§3.10) per
  seat. A +1 has no account, so **late-leave charges for the +1 go on your outstanding balance**.
- **Host leaves:** host passes to the earliest remaining rider, never to a +1. The +1
  leaves with the host.

**B. Invite a friend's account**
- On the status screen: **"Invite a friend"** → enter their **friend code** (shown on
  every profile). No links, no contacts import, no friends list.
- The friend sees an in-app invite next time they open the app (§3.12): "Lina invited you ·
  To JUST · arrive by 8:00 AM · Economy". Tapping it opens the trip screen with destination,
  arrive-by and category filled in. They set their own pickup and tap **Join**.
- The join runs **every §3.5 rule** (zone, gender mode and their toggle, timing, detour,
  price, rule 12). An invite never reserves a seat or bypasses a rule.
- The friend is then a normal rider: own pickup, own share, own leave rules, group chat.
- The invite expires when the ride leaves `OPEN`. One pending invite per friend per ride.
- The chat shows "Lina added a friend (Maya)" and "Noor joined (invited by Lina)".

### 3.18 Demand spots for drivers (P2, k-means)
Tells an **idle** driver where the nearest busy pickup area will be in the coming hour, so
they wait there instead of cruising: less empty driving, less traffic, faster pickups.
It's advice only. Offers still follow §3.8.

- **Data:** pickup points (lat, lng, time). Sources: the sample history (§2.6) plus every
  real pickup when its ride is `COMPLETED`.
- **Window:** points from the same day type (Sun–Thu or Fri/Sat) whose time of day falls
  between now and now + 60 min (`ammanParts`).
- **Clustering:** k-means on local km coordinates (origin: Irbid City Center). k = min(5, ⌊n / 5⌋).
  k-means++ start with the **mulberry32** PRNG (seed 2026) so Python and TypeScript give
  identical results; ties go to the lower cluster index. Iterate until no point changes cluster, max
  50 rounds. Recompute once per 15-min bucket.
- **Drop** clusters under 5 points (noise, and so no cluster can point at one person's home).
- **Each spot:** center, area name (nearest seed place's area), radius (80th-percentile
  distance of its points), and expected pickups per hour (points ÷ weeks of history).
- **Recommendation:** the spot nearest the driver's location (home base, or set from the
  demo menu; no real GPS). Distance is straight-line km × 1.35 (road factor); time is that
  at 30 km/h × the urban traffic factor now (§4.3). If two spots' distances differ by under 0.5 km, the busier one wins.
  If the driver is already inside a spot's radius: "You're in a busy area. Stay close."
- **Driver sees:** spots as soft circles on the map (never individual points), the
  recommended one highlighted, and a card: "Best spot near you · University Street area ·
  2.1 km · ~6 min · ~9 pickups/hour until 8:00 AM". Other spots listed under it.
- Not built: navigation to the spot, balancing many drivers across spots, demand
  prediction beyond the history. Roadmap.
- **Pitch framing:** "k-means clustering on pickup history". Say the demo history is sample data.

### 3.19 Uni plans (P1)
Subscriptions for university commuters. Planning rides in advance lets the server build
full cars before anyone searches, and the discount gives students a reason to commit.

**A uni ride** is a synced ride where the rider's **own** pickup or destination is within
1.0 km of a listed campus (§2.6). No student ID check: anyone can subscribe; the plans are
marketed to students. The discount applies only to uni rides, never to other trips.

**Plans** (prices are placeholders `[verify]`):
| | Weekly | Semester |
|---|---|---|
| Rides | 3–5 rides in one week (Sun–Sat) | 2–5 rides **every** week, same pattern, until the semester ends |
| Price | JOD 2.00 per week | JOD 1.60 per week × weeks left |
| Replacements | 1 per week | 5% of all planned rides, rounded down, minimum 1 (e.g. 4/week × 13 weeks = 52 rides → 2) |
| Renewal | None. Buy the next week | None |

- **Planning:** when subscribing, the rider picks each ride: day, direction (to or from
  campus), arrive-by, pickup, destination, category (Economy or Comfort; Airport isn't a uni
  ride) and the "Same gender only" toggle. Semester plans pick a weekly pattern that repeats.
  Every planned ride must be ≥ 12 h away when it's planned.
- **Payment:** "Pay with card" opens a **demo card** form. It accepts only published test
  numbers (e.g. 4242 4242 4242 4242), any future expiry, any CVC. Anything else:
  "Demo only: use a test card." Nothing is charged or stored except "Demo card •••• 4242".
- **Placement (12 h before):** at arrive-by − 12 h, the server places each planned ride
  (scheduler, 15-min buckets). For the planned rides in one bucket, in order of first pickup:
  1. Join the OPEN ride with the most riders that passes every §3.5 rule.
  2. Otherwise host a new ride (§3.4 rules except the 60-min/24-h window, which is always met here).
  Later planned rides in the same bucket can join the rides just made. Result: one notice
  per rider, "Tomorrow · Be ready by 7:20 AM · 3 of 4 synced". Placed rides are normal
  OPEN rides: anyone can still join until the ready check.
- **If a planned ride can't be placed** (rule 12 or no valid plan): "We couldn't plan
  Tuesday's ride" and it returns as a replacement (doesn't use the limit).
- **Cancelling:**
  - **≥ 12 h before** (before placement): the ride is removed. Under the limit, the
    rider gets a **replacement**: plan another ride inside the plan period (same week for
    weekly, before the semester ends). Over the limit: the ride is gone, no replacement.
  - **< 12 h before** (already placed): normal leave rules (§3.10, free or late). No
    replacement, and it doesn't use the limit.
  - No refunds of the plan fee in any case.
- **Discount:** only subscribers, each on their own share. The ride's shares are computed
  as usual (§4.5). A subscriber on a uni ride pays `ceil_to_0.05(share × 0.80)`. RideSync
  pays the difference to the driver at `COMPLETED`, with the other credits. If the ride is
  canceled, nothing is paid. Rule 10 and all money rules use the undiscounted share.
  A late leave charges the subscriber their discounted share.
- Cards and summaries show it: "JOD 1.40 · −20% Uni plan" (share 1.70), and the driver's
  summary lists "Uni plan credit from RideSync · JOD 0.30".
- **Business check:** at the demo's 1.70 share the discount is 0.30 per ride, so 4 rides a week cost
  RideSync ~1.20, covered by the JOD 2.00 weekly fee. Recheck after the commission answer.

## 4. Fare, Time & Supply Model
`docs/reference/fare_model.py` (§4.9) produced the numbers in this file. Any
implementation with these constants and the fixed table source must reproduce what it
prints within ±0.01 JD and ±1 min.

### 4.1 Tariff (LTRC, effective 11 May 2026)
Smart apps charge the yellow-taxi tariff + 20% (taxi day 0.39 flag-fall + 0.28/km;
night 0.40 flag-fall + 0.33/km).
| | Flag-fall | Per km | Waiting per min |
|---|---|---|---|
| Day | JOD 0.468 | JOD 0.336 | JOD 0.0576 `[verify]` |
| Night (00:00–06:00 `[verify hours]`) | JOD 0.480 | JOD 0.396 | JOD 0.0679 `[verify]` |
- Tariff is chosen by the first-pickup time. Minimum fare JOD 1.00 `[verify]`.
- Confirmed by LTRC sources: flag-fall and per-km values, and the 20% smart-app premium.
  Not confirmed: waiting rate, night hours, minimum fare. Don't claim these on stage.

### 4.1.1 Calibration against Jeeny
- `full_fare = CALIBRATION × tariff_formula(...)`. Default `CALIBRATION = 1.00`.
- Economy and Airport are priced against Jeeny's **Economy** tier, Comfort against
  Jeeny's **Comfort** tier (that quote sets COMFORT, §3.16; default 1.25 `[verify]`).
- To set it, a teammate opens Jeeny (no booking needed), sets Irbid City Center → JUST,
  and screenshots the **Economy** price, once at a normal time and once at ~7:30 AM.
- `CALIBRATION = Jeeny Economy quote ÷ our formula for the same route and time`,
  using Google's km and minutes for that route. Round to 2 decimals.
- If it's between 0.90 and 1.10, keep 1.00 and say "matches the smart-app tariff".
  Otherwise use the factor and say "calibrated to Jeeny's live Economy price".
- Reference point (different route, from our screenshots): a real Irbid quote showed
  Ecolite 5.55, Economy 6.21, Taxi 5.91. Economy is ~5% above Taxi.
- The §4.7 golden values always use CALIBRATION = 1.00.

### 4.2 Distances, travel times and routes (TravelProvider)
All km, minutes and route shapes come from one server-side interface:

```
getMatrix(points[], departureTime) → for every pair (a, b):
  km, minutes_with_traffic, minutes_free_flow
getRoute(points[], departureTime) → polyline (list of lat/lng points)
  points = the ordered stops; the first and last are the endpoints, the rest are stops in between
```

The rules engine never calls Google directly.

#### 4.2.1 Google source (live)
- **Matrix:** one Google route-matrix request per ride evaluation, covering every
  pickup and drop-off point in that ride (max 8 points = 64 pairs). Stop orders are then
  computed locally. Never call Google per stop order.
- **Route:** one route request when a ride is created (anchor route: host pickup →
  destination), and one whenever the stop order changes (the driver's route line, P1).
- **Traffic:** request traffic-aware durations for the departure time. Use Google's
  traffic duration as `minutes_with_traffic` and its no-traffic (static) duration as
  `minutes_free_flow`. Check the exact field names in the current Google docs.
- **Departure time:** the ride's estimated first pickup (arrive-by − 60 min for the
  first call). All legs in one ride use that single departure time (trips are under ~1 h).
- **Future dates:** Google only predicts traffic for future times. Map the demo clock to
  the next real date with the **same weekday and time** before calling Google.
- **Places:** Google Places search for pickup and destination goes through the server
  (`GET /api/places`), restricted to Jordan and biased to Irbid.
- **Map:** Google Maps JavaScript API in the browser, styled to match DESIGN.md.
- **Cache:** key = (rounded coordinates, 15-min time bucket).
- **Keys:** the **server key** (routes, matrix, places) lives in `.env` and never reaches
  the browser. The **browser key** is for the Maps JavaScript API only, restricted to our
  domain. Set a billing budget alert. Check current pricing and free usage limits before Friday.

#### 4.2.2 Snapshot source (demo)
- A script calls Google once for all seed places (all pairs, plus the CC → JUST anchor
  route) at the demo time (Sunday 6:00–8:30 AM, in 15-min buckets) and saves the results
  to `data/demo_snapshot.json`.
- Demo mode reads only this file for distances and times. No Google routing calls.
- After generating the snapshot, rerun the reference model with it and **regenerate §2.2,
  §2.3 and the §1 value table, and the example numbers in DESIGN.md.** Re-check the §2.6
  route distances. Commit the snapshot.

#### 4.2.3 Fixed table source (tests and fallback)
- Road km = straight-line (haversine) distance × circuity: **urban 1.35**, **highway 1.15**.
- Any trip to or from JUST = urban leg to the Irbid–Ramtha road exit node
  (32.5200, 35.8900) + highway leg exit → JUST (11.5 km).
- Route polyline (for rule 5) = straight segments pickup → exit node → JUST, or
  pickup → destination for trips that don't involve JUST.
- Same place = 0 km (stops still take dwell time).
- Used by the §4.7 unit tests and as the automatic fallback if Google fails.

| km | CC | HS | US | YU | AM | JUST |
|---|---|---|---|---|---|---|
| **CC** | 0 | 2.3 | 2.3 | 3.2 | 4.8 | 19.3 |
| **HS** | 2.3 | 0 | 1.5 | 2.5 | 3.5 | 17.3 |
| **US** | 2.3 | 1.5 | 0 | 1.1 | 2.5 | 17.0 |
| **YU** | 3.2 | 2.5 | 1.1 | 0 | 1.7 | 16.5 |
| **AM** | 4.8 | 3.5 | 2.5 | 1.7 | 0 | 14.8 |
| **JUST** | 19.3 | 17.3 | 17.0 | 16.5 | 14.8 | 0 |

The urban part of each JUST leg: CC 7.8 · HS 5.8 · US 5.5 · YU 5.0 · AM 3.3 (+11.5 highway).

### 4.3 Traffic curve (fixed table source only)
The Google and Snapshot sources use Google's traffic-aware durations instead.
- Free-flow speed: **urban 30 km/h**, **highway 70 km/h**.
- Leg time = urban km / 30 × 60 × urban factor + highway km / 70 × 60 × highway factor,
  using the factor at the **leg's start time** (Amman local time).
- Weekday (Sun–Thu) congestion factors. Interpolate linearly between anchors:

| Hour | 0–5 | 6 | 7 | 7:30–8 | 9 | 11 | 13 | 14:30 | 16 | 18 | 20 | 22 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Urban | 1.00 | 1.15 | 1.55 | **1.75** | 1.40 | 1.30 | 1.45 | 1.60 | 1.50 | 1.45 | 1.20 | 1.05 | 1.00 |
| Highway | 1.00 | 1.05 | 1.20 | **1.30** | 1.15 | 1.10 | 1.15 | 1.20 | 1.15 | 1.15 | 1.05 | 1.00 | 1.00 |

- Fri/Sat: factor = 1 + (weekday factor − 1) × 0.5.

**Applies to all sources:**
- Dwell: 1.5 min per pickup, 0.5 min per drop-off.
- Demo multipliers (P2): traffic Normal 1.0 · Heavy 1.2 · Jam 1.5. Weather Clear 1.0 ·
  Rain 1.15. For the fixed table they multiply the factors. For Google and Snapshot they
  multiply the traffic delay (`minutes_with_traffic − minutes_free_flow`).

### 4.4 Fare formula
```
full_fare = max(MIN_FARE, CALIBRATION × (flag + km_total × per_km + wait_min × per_min))
wait_min  = Σ legs (minutes_with_traffic − minutes_free_flow) + Σ dwell_min
```
- Congestion delay is billed at the waiting rate, as a meter does when the car is slow.
- Waiting caused by frozen pickup times after a leave is **not** billed (§3.6).

### 4.5 Split and estimates
- For a nonempty ride, add the current charge (zero for a free leave) to all previously held credits.
  `share = ceil_to_0.05(max(0, full_fare − total_credits) / remaining_seats)`, where
  seats = riders + their +1s (§3.17). Every seat pays the same share.
- Uni plan subscribers on a uni ride pay `ceil_to_0.05(share × 0.80)`; RideSync credits the
  difference to the driver at completion (§3.19). All other math uses the undiscounted share.
- After a late leave or no-show, cap this result at the previous share. With zero riders, cancel under §3.10.
- Host estimates before anyone joins: `ceil_to_0.05(solo_fare × A[k] / k)` for k = 1 up to
  the category's max riders, with the category's detour allowance A (§3.16; Economy
  A = {1: 1.00, 2: 1.05, 3: 1.12, 4: 1.20}). "From JOD x" = the value at the category's max.

### 4.6 Driver supply (P2)
- Acceptance probability per offered driver p = 0.35 `[verify]`. The pool refreshes every
  15 min.
- `P(no driver) = (1 − p)^(N × W / 15)`, where N = drivers within 5 km and W = time the
  offer stays open (dispatch time → first pickup − 15 min).
- The automatic ready check starts earlier when few drivers are nearby:
  ≥ 10 drivers → first pickup − 45 min · 5–9 → − 60 min · ≤ 4 → − 75 min, with a
  "Few drivers nearby" note for the host at ≤ 2.
- Driver ETA (for "Driver on the way"): nearest-driver distance = 0.5 / √(N / 78.5 km²) ×
  1.35, at urban speed × current factor, + 1 min.

### 4.7 Golden values (unit tests)
These test the **fare engine with the fixed table source** and CALIBRATION = 1.00. They
never change when Google data changes. **Source of truth: what `fare_model.py` prints.**
The test fixture uses Rania's old arrive-by (8:15); the demo seed uses 8:05, which produces
the same 4-rider plan.

**Solo, Irbid City Center → JUST, Sunday:**
| Arrive by | First pickup | Trip | Km | Full fare | Rounded |
|---|---|---|---|---|---|
| 03:00 (night tariff) | 02:28 | 27 min | 19.3 | 8.26 | 8.30 |
| 07:30 | 06:48 | 37 min | 19.3 | 7.60 | 7.60 |
| 08:00 | 07:15 | 40 min | 19.3 | 7.81 | 7.85 |
| 11:00 | 10:21 | 34 min | 19.3 | 7.43 | 7.45 |
| 15:00 | 14:17 | 38 min | 19.3 | 7.70 | 7.70 |
| 22:00 | 21:26 | 29 min | 19.3 | 7.16 | 7.20 |

**Solo fare per seeded rider (fixture arrive-bys):** Lina 7.85 · Sara 6.90 · Rania 7.10 · Dana 6.70 · Noor 6.05.

**Full 4-rider fixture (Lina, Sara, Rania, Dana) by condition:**
| Condition | First pickup | Trip | Full fare | Each |
|---|---|---|---|---|
| Normal | 7:02 | 54 min | 9.03 | 2.30 |
| Heavy | 6:54 | 61 min | 9.49 | 2.40 |
| Jam | 6:42 | 72 min | 10.12 | 2.55 |
| Rain | 6:56 | 59 min | 9.38 | 2.35 |
Normal route: CC → HS → US → YU → JUST, 21.4 km.

**Demo joins (seed, Rania 8:05):** 7.81/7.85 → 7.95/4.00 → 8.67/2.90 → 9.03/2.30.
Host estimates: 7.85 · 4.15 · 2.95 · 2.35.

**Leave math (demo ride after accept, Sara leaves, 3 riders, frozen order and first pickup):**
| Case | New full fare | Formula | Each | Pickups |
|---|---|---|---|---|
| Free leave at 6:20 | 8.86 | 8.86 / 3 | 3.00 | Lina 7:02, Rania 7:10, Dana 7:22 |
| Late leave at 6:35 (credit 2.30) | 8.86 | min(2.30, (8.86 − 2.30) / 3) | 2.20 | same |
Late leave totals: 3 × 2.20 = 6.60 cash + 2.30 credit = 8.90 (remainder 0.04).

**Detour check (demo ride, in-car time vs cap):** Lina 51.5 vs cap 55.7 · Rania 43.8 vs
48.5 · Sara 36.9 vs 46.0 · Dana 32.7 vs 43.8.

**Distance to the CC → JUST fixed route (rule 5, Economy zone for L = 19.3 km = 1.5 km;
destination zone 1.0 km):** HS 0.8 · US 0.3 ·
YU 1.0 · AM 0.9 km. All pass.

**Driver economics (demo ride vs Lina solo; 14 min empty drive in, 40 min empty return,
20% commission `[verify]`):**
| | Full fare | Driver net | Total time | Net per hour |
|---|---|---|---|---|
| Solo | 7.81 | 6.25 | 95 min | 3.96 |
| Shared ×4 | 9.03 | 7.22 | 108 min | 4.02 |
- Jeeny commission: shared trip 1.81 vs 5.70 if all 4 had booked solo (solo fares total 28.48).

### 4.7.1 Golden values v6–v8 (what `fare_model.py` prints after the v5 block)
- **Zones:** Economy L 19.3 → (1.5, 1.0) · L 85 → (4.0, 2.5) · Comfort L 19.3 → (1.2, 0.8) ·
  Airport L 35 → (5.2, 1.0) · L 110 → (10.0, 1.0).
- **Comfort CC → JUST 8:00:** solo fare 9.76, each 9.80, estimates 9.80 · 5.10 · 3.55.
  Sara joins: fare 9.94, each 5.00.
- **+1:** Lina + Sara 7.95 / 4.00; Sara adds Maya → same fare 7.95, 3 seats, each 2.65.
- **Uni:** share 2.30 → pays 1.85 (credit 0.45); 4.00 → 3.20. Semester replacements:
  26 rides → 1 · 40 → 2 · 52 → 2 · 65 → 3 · 80 → 4. Cancel 12:00 h before → replacement;
  11:59 h → normal leave.
- **Placement**, Mon 8:00 bucket run Sun 20:00, trips Huda AM · Maya US · Salma HS · Reem CC ·
  Lama YU: Reem, Salma, Maya, Lama → one ride (fare 9.03, each 2.30, subscribers pay 1.85,
  first pickup 7:02); Huda → her own ride (6.01 / 6.05; Arabella can't join a full car).
- **Demand spots**, sample history (1,320 points), Sun 6:30, driver at City Center:
  City Center 94 pts · University Street 97 · Al-Hashmi 71 · Yarmouk 100 · Arabella 37.
  Best: City Center area, driver inside → "Stay close". mulberry32(1) first value
  0.6270739405881613 (port check).

### 4.8 Assumptions to verify (owner: non-coding teammates, before the pitch)
1. **Jeeny Economy quote** for Irbid City Center → JUST, normal time and ~7:30 AM
   (sets CALIBRATION, §4.1.1).
2. **Google Cloud project** with billing, server key and restricted browser key, before Friday.
3. Bus fare and typical bus time Irbid → JUST.
4. Waiting rate, night tariff hours and minimum fare.
5. Jeeny's commission rate. Ask at the briefing or say "usual commission".
6. ~~Seed places resolve to the right Google place~~ Done 27 Nov: owner chose Google's places.
   Still worth a look on a map: CC resolved to the Irbid City Center mall in Aydoun.
7. A rough count of Irbid-based JUST commuters, if available. Don't invent it.
8. Jeeny **Comfort** quote on the same route (sets COMFORT), and any airport fee or
   surcharge for Queen Alia trips.
9. QAIA resolves to the departures terminal in Google Places.

### 4.9 Reference implementation
- `docs/reference/fare_model.py` is a **spec**, not app code. Port it, don't import it.
- It covers: tariff, CALIBRATION, the fixed table and traffic curve, the stop-order score,
  first pickup time, matching rules 1, 2 and 4–11, and free and late leave with frozen
  pickup times.
- It does **not** cover: rule 3 (ride state), rule 12, state machines, the ready check,
  dispatch, chat, credits paid at completion, or the Google/Snapshot sources.
- **v8:** it also covers categories and zones (§3.16), gender modes (rule 1), +1 seats
  (§3.17 A), Uni plans (§3.19: uni trips, discount, replacements, 12 h cancel, placement)
  and demand spots (§3.18: sample history, k-means, nearest spot). The v5 output is
  unchanged; the new values are in §4.7.1. Still not covered: friend-code invites (a plain
  join), Airport fares (no QAIA in the fixed table) and everything listed above.
- `test_fare_model.py` checks the new rules (19 tests). Run: `cd docs/reference && python3 -m unittest`.
- To regenerate demo numbers, feed it the snapshot's km and minutes instead of the fixed table.

## 5. Do Not Build
- Bus tracking, bus predictions, or any AI features other than driver demand spots (§3.18)
- Price comparison screen
- Student verification or university email checks (uni rides are defined by campus location, §3.19)
- Live trip sharing with family (adding a friend to the ride, §3.17, is allowed)
- Online payment, wallet, or real cards (credits and balances are displayed numbers only;
  the only card form is the demo card for Uni plans, §3.19)
- Real GPS tracking, live driver movement, or turn-by-turn navigation
- Other riders' pins, addresses or the full route on a rider's map
- Google route, matrix or places calls from the browser (server only; the browser loads the map only)
- Host approval of joiners, or the host removing riders
- Joining after the ready check starts, or replacement riders
- Chat extras: photos, voice, reactions, typing indicators, read receipts, reporting
- Ratings, support or report screens
- Late-arrival compensation or guarantees
- Arabic UI or RTL layout
- Real phone/OTP login
- MAX subscription or promotions (Uni plans, §3.19, are the only plans and discount), notifications inbox, push notifications
- Invite-by-link (friend codes only), contacts import or a friends list, recurring rides
  outside Uni plans,
  female-driver preference (roadmap slide only)
- More than one +1 per rider; navigation to demand spots; multi-driver spot balancing
- Real card payments, a payment provider SDK, refunds, auto-renewal, student ID checks,
  discounts on non-uni rides, Airport rides in a plan
- Categories beyond Economy, Comfort and Airport; pickups at the airport; mixing categories
  in one ride; changing a ride's gender mode after creation

## 6. DESIGN.md
DESIGN.md is RideSync's own design language ("Converge"), up to date with v8.1. Its example
numbers match the §2.3 snapshot values (27 Nov). After a new snapshot, update them from §2.3: the Economy tile "from" price, seat row share, matching card share and
pickup time, trip offer (fare, collect, km · min, first pickup, respond-by, per-stop times),
late-cancel amount, driver totals and the trip summary amounts.

## 7. Open decisions (team must choose, not blocking the build)
1. **Front seat (Economy only):** with 4 riders, one sits in front next to a driver of any
   gender. Locally, women often prefer the back seat. Comfort and Airport already cap at 3.
   Options for Economy: (a) keep max 4, (b) max 3 when the ride is `same` and female.
   Demo is unaffected either way.
2. **AI scoring (resolved v7):** the one AI/ML feature is k-means demand spots for
   drivers (§3.18, P2). Matching stays rules-based. If P2 isn't built in time, show it as
   a slide and say so.
3. **Deck alignment (must do before the pitch):** slides 2, 3, 5 and 8 still show
   JOD 1.25 shared and 4–5 JD solo. Replace them with the regenerated §2.3 numbers.
   Slide 8 also claims the shared ride is cheaper than "taxi + bus (2.10)", which is no
   longer true. Reposition it as door-to-door, planned to arrive on time, same gender,
   ~70% less than solo. Remove the AI/bus slides (6, 7) and the "Verified students" and
   "Family sharing" badges. Add group chat and the ready check to the solution slide.
   Rebrand every slide to RideSync and the new design language; add the three categories
   and the "Same gender only" toggle. Add a Uni plans slide (weekly/semester, 20% off,
   cars filled 12 h ahead).

## 8. Build Priorities
Build all P0 before starting any P1. P2 only if time remains before feature freeze (9:30 PM).

| P0: demo path | P1: hardening | P2: extras |
|---|---|---|
| Signup (name + gender) + seeded demo logins + "Same gender only" toggle (rule 1, both modes) | Google Places autocomplete (P0 uses seed chips) | Traffic / weather controls |
| Trip screen → category tiles → matching list → "Start your own sync" → host setup with estimates and zone | Route line on the driver's map | Supply-aware ready check time (§4.6) |
| Matching list + auto-join (all §3.5 rules, §3.16 table for all 3 categories) | Driver one-to-one chat | "Drivers nearby" control |
| Live sync across 3 phones | No-show, driver cancel | Live Google source in demo |
| Group chat with masking and system messages | "Book a solo ride" fallback | Driver ETA model |
| Stop order, pickup times (frozen at ready check), fare split | Pickup-time banners | |
| Find driver + ready check (manual and automatic) | Driver pickup/drop-off taps | |
| Simulated riders auto-answer the ready check | Data source switch + auto fallback | |
| Dispatch, driver offer, accept, reject | Stale-tab and reconnect handling | |
| Free and late leave, credit held on the ride | "Map unavailable" fallback | |
| Snapshot TravelProvider + Fixed table | Live search updates on the matching list | Demand spots: k-means + sample history + driver card (§3.18) |
| Google map: own pins for riders, all stops for the driver | Airport seed place (QAIA) + its snapshot pairs | Driver location control (demo) |
| Demo menu: clock (paused), simulate rider, Complete trip, reset, build stamp | Bring a friend: +1 (§3.17 A) | |
| Trip summary screen | Bring a friend: friend-code invite (§3.17 B) | |
| | Uni plans: subscribe + demo card + planning (§3.19) | |
| | Uni plans: 12 h placement, replacements, 20% discount + RideSync credit | |

Sources: LTRC 2026 smart-app tariff (Jordan News / Al Mamlaka, 11 May 2026; jo.motory.com,
12 May 2026; Petra, 3 Feb 2026). JUST location and enrollment (Wikipedia, JUST site). LTRC
Irbid/Zarqa/Jerash pilot routes (Petra, 22 Jul 2026). Jeeny quotes from team screenshots.
