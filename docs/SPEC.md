# SPEC.md: Jeeny Shared Ride (v4)

> Final feature definition. Wins over the pitch deck and brief on any conflict.
> **Fare rules and formulas in this file are canonical.** Distances, travel times and
> routes come from Google Maps (§4.2). The demo numbers in §2.2, §2.3 and §6 are
> regenerated once from the saved demo snapshot (§4.2.2). Until then they are
> placeholders computed from the fixed table. The §4.7 golden values always use the
> fixed table and never change.
> `[verify]` = assumption a teammate must check before the pitch. It does not block building.

## 0. What changed

**v4:**
- **Matching is now distance-based.** A joiner matches if their pickup is within 1.5 km of
  the host's pickup or the host's route, their destination is within 1 km of the host's
  destination, and their arrive-by is within ±5 min of the host's (§3.5).
- **Auto-join.** No approval. The host can't remove anyone.
- **Group chat** for riders (free text, phone numbers masked). The driver has a separate
  one-to-one channel with each rider (§3.11).
- **Ready check replaces automatic dispatch.** The host taps "Find driver", or it starts
  automatically 45 min before the first pickup. Riders have 5 min to confirm or cancel;
  no answer counts as ready. Then the ride goes to drivers (§3.8).
- **Joining closes when the ready check starts.** No late joins and no replacement riders.
- **Cancellation:** free until a driver accepts, and free after that until 30 min before
  the first pickup. In the last 30 min the canceller pays **their own share** (§3.10).
- Pickup times freeze when the ready check starts.
- Demo script rewritten (§2.2). Rania's seed arrive-by is now 8:05.

**v3:** Google Maps TravelProvider (Google / Snapshot / Fixed table), calibration against
a Jeeny Economy quote, build priorities, reference implementation scope.

**v2:** regulated 2026 smart-app tariff, canonical demo numbers, detour rule
max(+10 min, +40%), state machines, no-show, driver cancel, rounding rule, privacy on the
matching card, "Book Economy" fallback.

## 1. Business & Judging Angle (BRD)

**One line:** Schedule a Jeeny ride, and people of your gender going the same way at the
same time join automatically and split one regulated fare, up to 4 riders per car.

**Problem:** Daily commuters choose between unreliable, overcrowded buses and solo rides
they can't afford every day. First example: Irbid students commuting to JUST (27,114
students, 2019; JUST is ~20 km east of Irbid). Bus ≈ JOD 0.60 `[verify]`. Solo Jeeny ride
≈ JOD 7.85 at morning peak. The feature works anywhere Jeeny operates.

**Positioning (important):** JOD 2.30 is about 4× the bus. Don't pitch "as cheap as the
bus". Pitch **door-to-door, on time (arrive-by guarantee), safe (same gender), for 70% less
than riding solo**. LTRC is piloting new public bus routes linking Irbid, Zarqa and
Jerash (July 2026). Shared Ride complements better buses. It does not depend on buses staying bad.

**Value (computed in §4.7, recheck after the snapshot):**
| For | Number |
|---|---|
| Riders | JOD 7.85 solo → JOD 2.30 shared (−71%) |
| Drivers | +JOD 0.97 net per trip (+16%). Same per hour including the empty return (~JOD 4.0/h net) |
| Jeeny | ~JOD 1.81 commission per shared trip from riders who pay Jeeny JOD 0 today (bus users) `[verify 20% commission]` |

Each shared ride is **one normal Jeeny booking on one licensed vehicle with one regulated
fare**. Jeeny keeps its usual commission.

**Why judges will care:** it fits Jeeny's existing app (scheduled rides, cash, the gender
field on profiles, outstanding-balance fees). It demos live on several phones, including
group chat and a ready check. It opens a segment Jeeny doesn't serve today. Prices use real
road distances and traffic and are calibrated to Jeeny's own Economy price.

**Prepared answers for judge questions:**
- *Is fare splitting legal?* The trip is charged at the normal regulated smart-app tariff
  (taxi meter + 20%) as one booking. Riders split that one fare among themselves. We
  **never** sell per-seat fares, because that's a separate licensed category (shared
  "service" taxis). Jeeny legal confirms before launch.
- *Where do your prices come from?* Real Google road distances and traffic, the LTRC
  smart-app tariff, and a calibration against a real Jeeny Economy quote on this route.
- *Why same gender only?* Safety and cultural comfort, especially for women. It's the
  main reason people would share a car with strangers. Precedent: Uber's Women Preferences.
- *What if someone joins that I'm not comfortable with?* Riders talk in the group chat,
  and anyone can leave for free until 30 min before pickup. The host can't kick people,
  so nobody gets excluded for reasons other than the matching rules.
- *What stops a man from signing up as female?* Gender is fixed after signup and tied to
  the verified Jeeny account. The driver sees rider names at pickup. One report suspends
  the account. ID verification is on the roadmap.
- *Is the driver the same gender?* No. Any driver can accept, same as today. A female-driver
  preference is a natural next step.
- *What if someone cancels at the last minute?* In the last 30 min they pay their own share,
  so the others aren't punished. Their shares usually go down.
- *What if the ride doesn't fill?* It goes with whoever joined. Each pays a bigger share.
  Before booking, the host already sees "If nobody joins: JOD 7.85".
- *Doesn't this cannibalize solo rides?* The worst case is 4 solo riders worth JOD 5.70 in
  commission becoming one JOD 1.81 trip. We target the bus segment (scheduled, ≥ 60 min
  ahead, commute routes), where today's revenue is zero.
- *Why would drivers take it?* More per trip, a guaranteed scheduled booking at peak, and
  the same per hour.

## 2. Live Demo Script & Scope (PRD)

### 2.1 Setup
- Pitch: 15 minutes. Problem 2 min, live demo 5 min, business and Jeeny fit 3 min,
  buffer and questions 5 min.
- 3 phones on the same live URL: **Phone A Lina** (host, female), **Phone B Sara** (joiner,
  female), **Phone C Omar** (driver).
- **Screens mirrored** to the projector (scrcpy, AirPlay, or a laptop showing all 3 views).
- **Own mobile hotspot** for all 3 phones. Don't rely on venue wifi.
- **One shared server-side demo clock.** Default start: Sun 29 Nov 2026, 6:10 AM (a
  workday). Fast-forward moves this clock for everyone.
- **Data source in the demo: Snapshot** (§4.2.2). No live Google calls on stage.
- Fallback: a recorded video of this exact flow.

### 2.2 Demo flow (6 steps)
Numbers are placeholders until regenerated from the snapshot (§4.2.2).
1. **Lina creates a shared ride (6:10).** Irbid City Center → JUST, arrive by 8:00 AM, picked
   from quick-pick chips. She picks **Shared**, "from JOD 2.35", sees "If nobody joins:
   JOD 7.85" and "Be ready by 7:15 AM". Status: 1 of 4 seats. The group chat opens.
2. **Sara joins (6:12).** She searches University Street → JUST, arrive by 8:00. Lina's ride
   appears ("City Center area → JUST", "JOD 4.00 each if you join"). She taps Join and is
   in instantly. Both phones update live: 2 of 4 seats, JOD 4.00 each. Chat shows
   "Sara joined" and Sara types "Hi! I'm near University Street".
3. **The ride fills and Lina finds a driver (6:14–6:16).** Tap "simulate rider" twice
   (Rania, then Dana). They join and post a short chat message each. 4 of 4, JOD 2.30 each.
   Lina taps **Find driver**. A ready check appears on every phone with a 5-min countdown.
   Sara taps Ready, simulated riders answer Ready, and the ride goes to drivers.
4. **Omar accepts (6:17).** Phone C shows the offer: JOD 9.03, 4 riders, cash, collect
   JOD 9.20, 21.4 km · ~54 min, first pickup 7:02 AM, respond by 6:47 AM, all stops with
   pickup times. He accepts. Phones A and B show "Omar · White Hyundai Elantra · 12-34567".
5. **Late cancellation (6:35).** Fast-forward to 6:35 (27 min before the first pickup).
   Sara cancels. She sees "Late cancellation: you'll pay your share, JOD 2.30", shown as
   "Outstanding balance JOD 2.30" on her next booking. Lina's share **drops** to JOD 2.20.
   Omar's stop list and route update live without Sara's stop.
6. **Trip summary.** Fast-forward to the end. Summary: 3 riders × JOD 2.20 cash, plus
   JOD 2.30 credited to Omar by Jeeny.

### 2.3 Canonical demo numbers
Placeholders from the fixed table. **Regenerate from the snapshot (§4.2.2) and replace.**
Demo date: Sun 29 Nov 2026. All destinations are JUST.

| Moment | Riders | Full fare | Each pays | Pickups (ready by) |
|---|---|---|---|---|
| 6:10 Lina creates | Lina | 7.81 | 7.85 | Lina 7:15 |
| 6:12 Sara joins | +Sara | 7.95 | 4.00 | Lina 7:12, Sara 7:21 |
| 6:14 sim Rania | +Rania | 8.67 | 2.90 | Lina 7:05, Rania 7:13, Sara 7:20 |
| 6:15 sim Dana | +Dana | 9.03 | 2.30 | Lina 7:02, Rania 7:10, Sara 7:17, Dana 7:22 |
| 6:15 Lina taps Find driver | 4 | 9.03 | 2.30 | **Pickup times freeze** |
| 6:16 Ready check done → dispatched | 4 | 9.03 | 2.30 | same. Respond-by 6:47 |
| 6:17 Omar accepts (fare locks) | 4 | 9.03 | 2.30 | same |
| 6:35 Sara leaves late (pays 2.30) | 3 | 8.88 | 2.20 | Lina 7:02, Rania 7:10, Dana 7:22 |

- All drop-offs at JUST between 7:53 and 7:55 AM.
- Host estimate table at creation: 1 rider 7.85 · 2 riders 4.15 · 3 riders 2.95 · 4 riders 2.35 (est.).
- Final: 3 × 2.20 = 6.60 cash, plus 2.30 credit = 8.90 to Omar (fare 8.88, remainder 0.02).
- Driver: **Omar**, White Hyundai Elantra, plate 12-34567, starts near Arabella Mall.
- After regenerating, check that every join still passes all §3.5 rules, especially rule 8
  (Dana's join at 6:15 needs first pickup ≥ 7:00). If one fails, start the demo clock
  earlier (e.g. 6:00) rather than changing rules.

### 2.4 Real vs mocked
| Real (built) | Mocked |
|---|---|
| Accounts with gender | Phone/OTP login (name + gender signup) |
| Creating and auto-joining rides, leaving | Driver GPS, car moving on the map |
| Matching rules (§3.5) incl. distance to route | Payment (cash shown, nothing charged) |
| Live sync across phones | Extra riders ("simulate rider") and their chat messages |
| Group chat and driver channel | Driver supply ("drivers nearby" setting) |
| Ready check and dispatch | |
| Driver accept, reject, cancel | |
| Fare (regulated formula, calibrated), split, fee math | |
| Stop order and pickup times | |
| Place search, distances, routes, traffic-aware times (Google Maps) | |
| Map display with pins and route line (Google Maps) | |

During the live demo, distances, times and routes come from the **saved demo snapshot**.

### 2.5 Demo controls (hidden menu)
- **P0:** fast-forward clock (+5 min, jump to time, jump to the next event), simulate rider
  (joins and posts one chat message), one-tap reset to the seeded state (also logs out all
  phones, clears chats and balances).
- **P1:** simulated riders auto-answer the ready check (default: Ready).
- **P1:** data source switch: Snapshot (default in demo) / Live Google / Fixed table.
  If a live Google call fails, the app falls back to Fixed table automatically and shows a
  small "offline estimates" label in the demo menu only.
- **P2:** traffic level (Normal / Heavy / Jam), weather (Clear / Rain).
- **P2:** drivers nearby (2 / 8 / 20).

### 2.6 Seed data
Seed places are real Google Places. Store each one's Google `place_id`, name and exact
coordinates. The approximate coordinates below are only for the fixed table source.

| Key | Place | Approx. Lat, Lng (fixed table only) |
|---|---|---|
| CC | Irbid City Center | 32.5568, 35.8469 |
| HS | Al-Hashmi Street | 32.5520, 35.8640 |
| US | University Street | 32.5440, 35.8570 |
| YU | Yarmouk University | 32.5366, 35.8556 |
| AM | Arabella Mall | 32.5290, 35.8660 |
| JUST | Jordan University of Science and Technology | 32.4789, 35.9850 |

In the demo, these appear as quick-pick chips above the search field.

| Rider | Gender | Pickup | Arrive by | Chat line when joining (sim only) |
|---|---|---|---|---|
| Lina (host) | F | CC | 8:00 AM | — |
| Sara | F | US | 8:00 AM | — (typed live) |
| Rania (sim) | F | HS | 8:05 AM | "Hi everyone 👋" |
| Dana (sim) | F | YU | 8:00 AM | "I'll be at the main gate" |
| Noor (sim, spare) | F | AM | 8:00 AM | "Hello!" |
| Male seed riders (for gender filtering) | M | any | any | — |

All seed pickups are within 1.5 km of the CC → JUST route (fixed table check: HS 0.8 km,
US 0.3 km, YU 1.0 km, AM 0.9 km) `[verify with snapshot route]`.
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
- Name and gender (male/female). Gender is set once and can't be changed.
- One-line consent: "Your first name and pickup area are shown to riders in your ride,
  and you can chat with them."

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

**Rider in ride:** `JOINED → READY → PICKED_UP → DROPPED_OFF`. Also `JOINED/READY → LEFT`
(free or late) and `READY → NO_SHOW`.

### 3.4 Creating a ride (host)
- Entry point: a **Shared** row in the normal ride options list, priced "from JOD x"
  (the 4-rider estimate, §4.5).
- The host sets pickup, destination and arrive-by. P0: quick-pick chips for the seed places.
  P1: Google Places autocomplete as well.
- The **first pickup** must be 60 min to 24 h from now. If the arrive-by is too soon:
  "Too soon for a shared ride. Book Economy instead."
- Max 4 riders including the host. `[open decision §7.1]`
- The host sees: estimated price per person at 1, 2, 3 and 4 riders, "If nobody joins:
  JOD 7.85", and "Be ready by 7:15 AM".
- The host's route (pickup → destination) is fetched once and stored as the ride's
  **anchor route** for matching.

### 3.5 Finding and joining (joiner)
The joiner opens Shared, enters pickup, destination and arrive-by, and sees a list of
matching rides. Zero matches: "No rides yet. Start one" (they become a host with the same inputs).
Tapping **Join** adds them instantly (auto-join). No approval.

A ride appears only if **ALL** are true:
1. **Gender:** same gender as everyone in the ride.
2. **Seat:** a free seat (max 4 riders).
3. **State:** the ride is `OPEN`. Joining closes when the ready check starts.
4. **Arrive-by:** the joiner's arrive-by is within **±5 min** of the host's arrive-by.
   The ride's effective arrive-by is the **earliest** arrive-by of all riders.
5. **Pickup near the path:** the joiner's pickup is within **1.5 km** (straight-line) of
   the host's pickup **or** of any point on the anchor route.
6. **Destination:** the joiner's destination is within **1.0 km** (straight-line) of the
   host's destination.
7. **On time:** with the joiner added, every rider is dropped by the effective
   arrive-by − 5 min, and no one is dropped more than 25 min before their own arrive-by.
8. **Detour cap:** each rider's in-car time ≤ max(solo + 10 min, solo × 1.4). In-car time
   runs from arrival at your pickup to arrival at your drop-off. "Solo" is that rider's own
   solo trip under the same traffic conditions and data source.
9. **Pickup shift:** no existing rider's pickup moves more than 15 min earlier than the
   first pickup time they were shown.
10. **Price:** no existing rider's share goes up, and the joiner's share is below their
    own solo fare.
11. **Timing:** the new first pickup is ≥ now + 45 min (otherwise the automatic ready
    check would already have started).
12. **One ride at a time:** the joiner has no other active ride within ±15 min of this
    ride's time window.

The card shows: host first name, mini seat row, seats left, **pickup area and destination
area only**, effective arrive-by, "JOD x each if you join" (the real recomputed share) and
"Pickup ~7:21 AM".

All matching runs **on the server**, never on the phones. Distances for rules 5 and 6 are
straight-line (haversine), point-to-polyline for the route.

### 3.6 Stop order and pickup times
- Every rider has their own pickup and drop-off. Stop order is the order with the lowest
  full fare (then shortest duration) where each pickup comes before that rider's drop-off
  and rules 7–9 hold. Max 8 stops, so brute force is fine.
- Stop orders are computed locally from **one** travel matrix per ride (§4.2). Never
  request distances per stop order.
- The first pickup is the latest whole minute that satisfies the effective arrive-by.
- Each rider sees "Be ready by h:mm AM". If it moves more than 3 min, the rider gets an
  in-app banner and a system message in the chat.
- **Pickup times freeze when the ready check starts.** After that, removing a rider only
  removes their stops. Everyone else's pickup times stay the same.
- The driver waits up to 5 min after a scheduled pickup time (see no-show, §3.10).

### 3.7 Fare (formula in §4.4)
- Full fare = calibrated regulated smart-app tariff for the **whole route including all stops**.
- Price per person = (full fare − credits) ÷ riders, **rounded up** to 0.05 JD. The
  driver keeps the rounding remainder (max 0.19). Credits come from late cancellations
  and no-shows (§3.10).
- Prices update live on every phone when someone joins or leaves.
- **Lock:** when a driver accepts, the travel matrix, traffic and tariff freeze. After that
  the full fare changes only if stops are removed (a leave or no-show).
- Cash only. Each rider pays their own share to the driver at drop-off.

### 3.8 Ready check and dispatch
- **Start:** the host taps **Find driver** at any time while the ride is `OPEN`, or it starts
  automatically at **first pickup − 45 min**.
- **When it starts:** joining closes, pickup times freeze, and every rider (including the
  host) sees a "Ready?" sheet with a 5-min countdown and two buttons: **Ready** and
  **Cancel ride for me**.
  - Cancel during the ready check is always free.
  - No answer after 5 min counts as **Ready**.
  - The chat shows "Lina started the ready check" and each answer.
- **End:** when all riders have answered or 5 min have passed, the ride goes to drivers
  (`DISPATCHED`) with the remaining riders.
- **Drivers only see the ride once it's dispatched**, with the final riders, stops and
  pickup times.
- The offer goes to eligible nearby drivers. **First accept wins.** It stays open until
  first pickup − 15 min. A driver who rejects doesn't get it again. Riders see
  "Finding your driver".
- **No driver by then:** the ride is canceled, no fees. Each rider sees "No driver found" and
  a **"Book Economy now"** button prefilled with their trip and solo estimate.
- **Only the host remains:** the ride continues at the solo price (already shown at
  creation). The host can cancel free until a driver accepts.

### 3.9 Driver
- The offer sheet shows: "Shared Ride", first pickup time, full fare, rider count, cash,
  **total cash to collect**, stops in order (first name + short address + pickup time),
  km · min, and respond-by.
- The stop list shows each rider's share. At each stop the driver taps "Picked up Lina" or
  "Dropped off Lina · collected JOD 2.20".
- When a rider leaves after accept, the driver's stop list, route and cash total update
  live with a banner: "Sara canceled. New total: collect JOD 6.60 + JOD 2.30 credit".
- Only the driver and the rider themselves see exact pickup addresses.
- Driver cancels after accepting: back to `DISPATCHED` if ≥ 15 min before first pickup,
  otherwise canceled with no rider fees and the "Book Economy now" button.

### 3.10 Cancellation, no-show and money flow
- **Free leave:**
  - any time before a driver accepts (including during the ready check), or
  - after a driver accepts, if it's **≥ 30 min** before the first pickup.
  - The new full fare is recalculated without the leaver's stops. Remaining shares =
    new full fare ÷ remaining riders (they usually go up).
  - If a free leave raises any remaining rider's share above their own solo fare, that
    rider can also leave free.
- **Late leave:** after a driver accepts and **< 30 min** before the first pickup.
  - The leaver is charged **their current share**, shown as "Outstanding balance JOD x"
    on their next booking (Jeeny's existing mechanism).
  - Jeeny credits that amount to the driver's in-app balance and recovers it from the
    leaver's next trip.
  - Remaining shares = (new full fare − credit) ÷ remaining riders. They usually go
    **down**, and they never go up (if the formula gives a higher share, keep the old share).
  - The driver always receives ≥ the new full fare.
- **No-show:** after waiting 5 min the driver taps "No-show". Same money flow as a late
  leave, and the trip continues.
- **No replacements:** a seat that empties after the ready check stays empty.
- **Host leaves:** the ride continues, and the host label and button pass on (§3.1).
- **Last rider leaves:** the ride is canceled and the driver is notified.

### 3.11 Chat
**Group chat (riders only):**
- Opens for a rider when they join. Shows all messages since the ride was created.
- Free text, max 300 characters per message. Phone numbers (7+ digits in a row, with or
  without spaces or dashes) and links are masked as "•••" before sending.
- Shows first names and avatars (initials) only.
- System messages: "Sara joined", "Sara left", "Lina started the ready check",
  "Dana is ready", "Omar is your driver", pickup time changes.
- Read-only after the ride is `COMPLETED` or `CANCELED`. Deleted 24 h later.

**Driver channel:**
- After a driver accepts, each rider has a separate one-to-one chat with the driver.
  Same masking and limits. Riders can't see each other's driver chats.

**Out of scope:** photos, voice, reactions, typing indicators, read receipts, reporting.

### 3.12 Notifications
In-app only: a banner or sheet shown live or on the next open. Unread chat count on the
ride status screen. No push, no inbox.

### 3.13 Edge cases
| Case | Behavior |
|---|---|
| Two people take the last seat at the same moment | First commit wins. The second sees "This ride just filled up" |
| A join and the ready check start at the same moment | Ready check wins. The joiner sees "This ride just closed" |
| Host taps Find driver while alone | Allowed. Ready check with just the host, then dispatch at the solo price |
| Rider answers Cancel in the ready check | Free leave. Remaining shares recalculated before dispatch |
| Everyone cancels in the ready check | Ride canceled, no fees |
| Rider of a different gender | The ride never appears in their list |
| Rider already in a ride in the same time window | Can't join a second one |
| First pickup would be under 60 min away, or arrive-by is in the past | Not allowed, error shown |
| Driver rejects | The offer stays with the other drivers |
| Driver cancels | §3.9 |
| Phone loses connection | Shows "Reconnecting", then catches up (including missed chat messages) |
| Opens a ride that's canceled, completed or expired (stale tab) | "This ride is no longer available" |
| Message contains a phone number | Masked before it's stored or shown |
| Google call fails or times out (live source) | Fall back to the fixed table for that evaluation. Never block the user |
| Place search returns a place outside Jordan | Not selectable (autocomplete restricted to Jordan) |

## 4. Fare, Time & Supply Model
A reference implementation (§4.9) produced the numbers in this file. Any implementation
with these constants and the fixed table source must reproduce the §4.7 golden values
within ±0.01 JD and ±1 min.

### 4.1 Tariff (LTRC, effective 11 May 2026)
Smart apps charge the yellow-taxi tariff + 20% (taxi day 0.39 flag-fall + 0.28/km;
night 0.40 flag-fall + 0.33/km).
| | Flag-fall | Per km | Waiting per min |
|---|---|---|---|
| Day | JOD 0.468 | JOD 0.336 | JOD 0.0576 `[verify]` |
| Night (00:00–06:00 `[verify hours]`) | JOD 0.480 | JOD 0.396 | JOD 0.0679 `[verify]` |
- Tariff is chosen by the first-pickup time. Minimum fare JOD 1.00 `[verify]`.
- Confirmed by LTRC sources: flag-fall and per-km values, and the 20% smart-app premium.
  Not confirmed: waiting rate, night hours, minimum fare.

### 4.1.1 Calibration against Jeeny
- `full_fare = CALIBRATION × regulated_formula(...)`. Default `CALIBRATION = 1.00`.
- Shared Ride is priced against Jeeny's **Economy** tier.
- To set it, a teammate opens Jeeny (no booking needed), sets Irbid City Center → JUST,
  and screenshots the **Economy** price, once at a normal time and once at ~7:30 AM.
- `CALIBRATION = Jeeny Economy quote ÷ our formula for the same route and time`,
  using Google's km and minutes for that route. Round to 2 decimals.
- If it's between 0.90 and 1.10, keep 1.00 and say "matches the regulated tariff".
  Otherwise use the factor and say "calibrated to Jeeny's live Economy price".
- Reference point (different route, from our screenshots): a real Irbid quote showed
  Ecolite 5.55, Economy 6.21, Taxi 5.91. Economy is ~5% above Taxi.
- The §4.7 golden values always use CALIBRATION = 1.00.

### 4.2 Distances, travel times and routes (TravelProvider)
All km, minutes and route shapes come from one server-side interface:

```
getMatrix(points[], departureTime) → for every pair (a, b):
  km, minutes_with_traffic, minutes_free_flow
getRoute(a, b, departureTime) → polyline (list of lat/lng points)
```

The rules engine never calls Google directly.

#### 4.2.1 Google source (live)
- **Matrix:** one Google route-matrix request per ride evaluation, covering every
  pickup and drop-off point in that ride (max 8 points = 64 pairs). Stop orders are then
  computed locally. Never call Google per stop order.
- **Route:** one route request when a ride is created (the anchor route, §3.4), and one
  whenever the stop order changes (for the map line, P1).
- **Traffic:** request traffic-aware durations for the departure time. Use Google's
  traffic duration as `minutes_with_traffic` and its no-traffic (static) duration as
  `minutes_free_flow`. Check the exact field names in the current Google docs.
- **Departure time:** use the ride's estimated first pickup (arrive-by − 60 min for the
  first call). All legs in one ride use that single departure time (trips are under ~1 h).
- **Future dates:** Google only predicts traffic for future times. Map the demo clock to
  the next real date with the **same weekday and time** before calling Google.
- **Places:** Google Places autocomplete for pickup and destination, restricted to Jordan
  and biased to Irbid.
- **Map:** Google Maps for display, styled to match DESIGN.md (muted gray). P0: pins only.
  P1: route line.
- **Cache:** key = (rounded coordinates, 15-min time bucket).
- **Keys:** the server key (routes/matrix) lives in `.env` and never reaches the browser.
  The browser key (map + autocomplete) is restricted to our domain. Set a billing
  budget alert. Check current pricing and free usage limits before Friday.

#### 4.2.2 Snapshot source (demo)
- A script calls Google once for all seed places (all pairs, plus the CC → JUST anchor
  route) at the demo time (Sunday 6:00–8:30 AM, in 15-min buckets) and saves the results
  to `data/demo_snapshot.json`.
- Demo mode reads only this file. No network needed.
- After generating the snapshot, rerun the reference model with it and **regenerate the
  §2.2 numbers, the §2.3 table, the §1 value table and the §6 DESIGN.md text.** Re-check
  the §2.6 route distances. Commit the snapshot.

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
  using the factor at the **leg's start time**.
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

### 4.5 Split and estimates
- `share = ceil_to_0.05((full_fare − credits) / riders)`
- After a late leave or no-show: `new_share = min(old_share, ceil_to_0.05((new_full_fare − credits) / riders))`
- Host estimates before anyone joins: `ceil_to_0.05(solo_fare × A[k] / k)`, with detour
  allowance A = {1: 1.00, 2: 1.05, 3: 1.12, 4: 1.20}. "From JOD x" = the k = 4 value.

### 4.6 Driver supply (P2)
- Acceptance probability per offered driver p = 0.35 `[verify]`. The pool refreshes every
  15 min.
- `P(no driver) = (1 − p)^(N × W / 15)`, where N = drivers within 5 km and W = time the
  offer stays open (dispatch time → first pickup − 15 min).
- P2 only: the automatic ready check starts earlier when few drivers are nearby:
  ≥ 10 drivers → first pickup − 45 min · 5–9 → − 60 min · ≤ 4 → − 75 min, with a
  "Few drivers nearby" note for the host at ≤ 2.
- Driver ETA (for "Driver on the way"): nearest-driver distance = 0.5 / √(N / 78.5 km²) ×
  1.35, at urban speed × current factor, + 1 min.

### 4.7 Golden values (use as unit tests)
These values test the **fare engine with the fixed table source** and CALIBRATION = 1.00.
They never change when Google data changes. The test fixture uses Rania's old arrive-by
(8:15); the demo seed uses 8:05, which produces the same 4-rider plan.

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

**Full 4-rider demo ride (Lina, Sara, Rania, Dana) by condition:**
| Condition | First pickup | Trip | Full fare | Each | Lina solo |
|---|---|---|---|---|---|
| Normal (demo) | 7:02 | 54 min | 9.03 | 2.30 | 7.81 |
| Heavy | 6:54 | 61 min | 9.49 | 2.40 | 8.18 |
| Jam | 6:42 | 72 min | 10.12 | 2.55 | 8.72 |
| Rain | 6:56 | 60 min | 9.38 | 2.35 | 8.09 |
| Same times, Friday | 7:09 | 46 min | 8.60 | 2.15 | 7.46 |
Normal route: CC → HS → US → YU → JUST, 21.4 km.

**Leave math (demo ride after accept, Sara leaves, 3 riders, new full fare 8.88):**
| Case | Formula | Each |
|---|---|---|
| Free leave (≥ 30 min before pickup) | 8.88 / 3 | 3.00 |
| Late leave (< 30 min, credit 2.30) | min(2.30, (8.88 − 2.30) / 3) | 2.20 |

**Detour check (demo ride, in-car time vs cap):** Lina 51.5 vs cap 55.7 · Rania 43.8 vs
48.5 · Sara 36.9 vs 46.0 · Dana 32.7 vs 43.8.
Solo in-car baselines: Lina 39.8 · Sara 32.9 · Rania 34.6 · Dana 31.3 · Noor 25.9 min.

**Distance to the CC → JUST fixed route (rule 5, threshold 1.5 km):** HS 0.8 · US 0.3 ·
YU 1.0 · AM 0.9 km. All pass.

**Driver economics (demo ride vs Lina solo; 14 min empty drive in, 40 min empty return,
20% commission `[verify]`):**
| | Full fare | Driver net | Total time | Net per hour |
|---|---|---|---|---|
| Solo | 7.81 | 6.25 | 95 min | 3.96 |
| Shared ×4 | 9.03 | 7.22 | 108 min | 4.02 |
- Jeeny commission: shared trip 1.81 vs 5.70 if all 4 had booked solo (solo fares total 28.48).

### 4.8 Assumptions to verify (owner: non-coding teammates, before the pitch)
1. **Jeeny Economy quote** for Irbid City Center → JUST, normal time and ~7:30 AM
   (sets CALIBRATION, §4.1.1).
2. **Google Cloud project** with billing, server key and restricted browser key, before Friday.
3. Bus fare and typical bus time Irbid → JUST.
4. Waiting rate, night tariff hours and minimum fare.
5. Jeeny's commission rate. Ask at the briefing or say "usual commission".
6. Seed places resolve to the right Google place (especially Al-Hashmi Street and Arabella Mall),
   and all seed pickups are within 1.5 km of the real CC → JUST route.
7. A rough count of Irbid-based JUST commuters, if available. Don't invent it.

### 4.9 Reference implementation
- `docs/reference/fare_model.py` is a **spec**, not app code. Port it, don't import it.
- It covers: tariff, fare formula, travel times (fixed table source), stop-order search,
  first pickup time, and the arrive-by checks (rule 7).
- It does **not** cover: rules 4–6 and 8–12 (arrive-by window, distance to route,
  destination radius, detour cap, pickup shift, price, timing), state machines, the ready
  check, chat, CALIBRATION, late-leave math, or the Google/Snapshot sources.
  **§3.5 is the source of truth for matching.**
- To regenerate demo numbers, feed it the snapshot's km and minutes instead of the fixed table.

## 5. Do Not Build
- Bus tracking, bus predictions, or any AI features
- Price comparison screen
- Student verification or university email checks
- Live trip sharing with family
- Online payment, wallet, or cards (credits and balances are displayed numbers only)
- Real GPS tracking, live driver movement, or turn-by-turn navigation
- Google route or matrix calls from the browser (server only)
- Host approval of joiners, or the host removing riders
- Joining after the ready check starts, or replacement riders
- Chat extras: photos, voice, reactions, typing indicators, read receipts, reporting
- Ratings, support or report screens
- Arabic UI or RTL layout
- Real phone/OTP login
- MAX subscription, promotions, notifications inbox, push notifications
- Invite-by-link, recurring rides, female-driver preference (roadmap slide only)

## 6. Required changes in DESIGN.md
Placeholder values until regenerated from the snapshot (§4.2.2).
| Where | Old | New |
|---|---|---|
| Ride option row | "from JOD 1.30" | "from JOD 2.35" |
| Seat row | "2 of 4 seats filled · JOD 3.10 each" | "2 of 4 seats filled · JOD 4.00 each" |
| Matching card | "Arrives by 7:55", "JOD 1.65 each", full addresses | "Arrives by 8:00", "JOD 4.00 each if you join", **area names only** ("City Center area"), "Pickup ~7:21 AM", button "Join" |
| Trip offer | "JOD 6.20", "Scheduled · 7:20 AM", "12.4 km · ~28 min", "Respond by 6:50 AM" | "JOD 9.03" + "Collect JOD 9.20", "First pickup · 7:02 AM", "21.4 km · ~54 min", "Respond by 6:47 AM", pickup time per stop |
| Location card | (none) | Add row "Be ready by 7:02 AM" |
| Driver stops list | name + address | + each rider's share, "Picked up" / "Dropped off · collected" actions |
| Search screen | (none) | Quick-pick chips for seed places above "Where to?" |
| Status sheet stages | Waiting for riders / Finding your driver / Driver on the way | Waiting for riders / **Ready check** / Finding your driver → Driver on the way (4 stages: use a 4-segment progress bar) |

**New components to design in Jeeny's style:**
- **Group chat screen:** nav header with ride title ("To JUST · 8:00") and seat row; message
  bubbles (own = accent-soft background, others = gray-100, radius 16, sender first name
  13/500 gray-500 above); centered gray system messages 13/400; input bar with 1px
  gray-200 top border, rounded field (radius 20) and accent send button.
- **Chat entry on the status sheet:** a white info card "Group chat" with last message
  preview and an unread count badge.
- **Ready check sheet:** bottom sheet with title "Ready to find a driver?", countdown
  "4:32" in accent 32/700, rider list with status (Ready ✓ in success, Waiting in gray-500),
  buttons "Cancel ride for me" (secondary) and "I'm ready" (primary), and the note
  "No answer = ready".
- **Find driver button:** primary button on the host's status sheet while `OPEN`, with
  helper text "Starts automatically at 6:17 AM".
- **Late-cancel confirmation:** sheet with "You'll pay your share: JOD 2.30" in danger
  color, explanation line, buttons "Keep my seat" (primary) and "Cancel anyway" (secondary, danger text).

## 7. Open decisions (team must choose, not blocking the build)
1. **Front seat:** with 4 women and a male driver, one rider sits in front. Locally, women
   often prefer the back seat. Options: (a) keep max 4, (b) host toggle "Back seats only"
   = max 3. Demo is unaffected either way.
2. **AI scoring:** the event is "Mobility × AI" and AI is locked out. Ask at the 9:30
   briefing whether AI is scored. Honest framing if asked: "traffic-aware, route-based
   matching", rules-based and not called AI.
3. **Deck alignment (must do before the pitch):** slides 2, 3, 5 and 8 still show
   JOD 1.25 shared and 4–5 JD solo. Replace them with the regenerated §2.3 numbers.
   Slide 8 also claims the shared ride is cheaper than "taxi + bus (2.10)", which is no
   longer true. Reposition it as door-to-door, on time, safe, ~70% less than solo.
   Remove the AI/bus slides (6, 7) and the "Verified students" and "Family sharing" badges.
   Add group chat and the ready check to the solution slide.

## 8. Build Priorities
Build all P0 before starting any P1. P2 only if time remains before feature freeze (9:30 PM).

| P0: demo path | P1: hardening | P2: extras |
|---|---|---|
| Signup (name + gender) | Google Places autocomplete (P0 uses seed chips) | Traffic / weather controls |
| Shared row, create ride, host estimates, anchor route | Route line on the map | Supply-aware ready check time (§4.6) |
| Matching list + auto-join (all §3.5 rules) | Driver one-to-one chat | "Drivers nearby" control |
| Live sync across 3 phones | Phone number masking in chat | Live Google source in demo |
| Group chat (free text, system messages) | No-show, driver cancel | Driver ETA model |
| Stop order, pickup times, fare split | "Book Economy now" fallback | |
| Find driver + ready check (manual and automatic) | Pickup-time banners | |
| Dispatch, driver offer, accept, reject | Driver pickup/drop-off taps | |
| Free and late leave with money flow | Simulated riders auto-answer ready check | |
| Snapshot TravelProvider + Fixed table | Data source switch + auto fallback | |
| Google map display with pins | Stale-tab and reconnect handling | |
| Demo menu: clock, simulate rider (+ chat line), reset | | |

Sources: LTRC 2026 smart-app tariff (Jordan News / Al Mamlaka, 11 May 2026; jo.motory.com,
12 May 2026; Petra, 3 Feb 2026). JUST location and enrollment (Wikipedia, JUST site). LTRC
Irbid/Zarqa/Jerash pilot routes (Petra, 22 Jul 2026). Jeeny quotes from team screenshots.
