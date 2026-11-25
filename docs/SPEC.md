# SPEC.md: Jeeny Shared Ride (v2)

> Final feature definition. Wins over the pitch deck and brief on any conflict.
> **All numbers in this file are canonical.** They come from the fare, time and supply
> model in §4. If another doc (including DESIGN.md example text) shows a different
> number, this file wins. See §6 for the DESIGN.md text that must change.
> `[verify]` = assumption a teammate must check before the pitch. It does not block building.

## 0. What changed from v1
- Fares now follow Jordan's **regulated 2026 smart-app tariff** (taxi meter × 1.2). Solo
  Irbid City Center → JUST at 7:15 AM ≈ **JOD 7.85**, not 4–5. Shared with 4 ≈ **JOD 2.30 each**.
- One canonical demo scenario with exact numbers (§2.3). All v1 example numbers removed.
- Matching rule 3 fixed: replacement riders can join after a cancellation.
- Detour rule changed from "+10 min" to "+10 min or +40%, whichever is larger". The old
  rule fails the 4th rider in our own demo (host +11.7 min).
- Added: pickup times, ride and rider state machines, no-show, driver cancel, rounding
  rule, cancellation money flow, privacy on the matching card, "Book Economy" fallback.
- Cancellation fee only applies within 2 hours of the first pickup.
- Demo ends on recovery (a replacement fills the seat), not on a price increase.

## 1. Business & Judging Angle (BRD)

**One line:** Schedule a Jeeny ride, open your empty seats, and split one regulated fare
with up to 3 people going your way, all the same gender as you.

**Problem:** Daily commuters choose between unreliable, overcrowded buses and solo rides
they can't afford every day. First example: Irbid students commuting to JUST (27,114
students, 2019; JUST is ~20 km east of Irbid). Bus ≈ JOD 0.60 `[verify]`. Solo Jeeny ride
≈ JOD 7.85 at morning peak. The feature works anywhere Jeeny operates.

**Positioning (important):** JOD 2.30 is about 4× the bus. Don't pitch "as cheap as the
bus". Pitch **door-to-door, on time (arrive-by guarantee), safe (same gender), for 70% less
than riding solo**. LTRC is piloting new public bus routes linking Irbid, Zarqa and
Jerash (July 2026). Shared Ride complements better buses. It does not depend on buses staying bad.

**Value (computed in §4.7):**
| For | Number |
|---|---|
| Riders | JOD 7.85 solo → JOD 2.30 shared (−71%) |
| Drivers | +JOD 0.97 net per trip (+16%). Same per hour including the empty return (~JOD 4.0/h net) |
| Jeeny | ~JOD 1.81 commission per shared trip from riders who pay Jeeny JOD 0 today (bus users) `[verify 20% commission]` |

Each shared ride is **one normal Jeeny booking on one licensed vehicle with one regulated
fare**. Jeeny keeps its usual commission.

**Why judges will care:** it fits Jeeny's existing app (scheduled rides, cash, the gender
field on profiles, outstanding-balance fees). It demos live on several phones. It opens a
segment Jeeny doesn't serve today.

**Prepared answers for judge questions:**
- *Is fare splitting legal?* The trip is charged at the normal regulated smart-app tariff
  (taxi meter + 20%) as one booking. Riders split that one fare among themselves. We
  **never** sell per-seat fares, because that's a separate licensed category (shared
  "service" taxis). Jeeny legal confirms before launch.
- *Why same gender only?* Safety and cultural comfort, especially for women. It's the
  main reason people would share a car with strangers. Precedent: Uber's Women Preferences.
- *What stops a man from signing up as female?* Gender is fixed after signup and tied to
  the verified Jeeny account. The driver sees rider names at pickup. One report suspends
  the account. ID verification is on the roadmap.
- *Is the driver the same gender?* No. Any driver can accept, same as today. A female-driver
  preference is a natural next step.
- *What if the ride doesn't fill?* It goes with whoever joined. Each pays a bigger share.
  Before booking, the host already sees "If nobody joins: JOD 7.85".
- *Doesn't this cannibalize solo rides?* The worst case is 4 solo riders worth JOD 5.70 in
  commission becoming one JOD 1.81 trip. We target the bus segment (scheduled, ≥ 60 min
  ahead, commute routes), where today's revenue is zero.
- *Why would drivers take it?* More per trip, a guaranteed scheduled booking at peak, and
  the same per hour.
- *Traffic?* Pickup times and prices use a time-of-day traffic model (§4.3). In heavy
  traffic, pickups move earlier and the share rises a little (JOD 2.30 → 2.40).

## 2. Live Demo Script & Scope (PRD)

### 2.1 Setup
- Pitch: 15 minutes. Problem 2 min, live demo 5 min, business and Jeeny fit 3 min,
  buffer and questions 5 min.
- 3 phones on the same live URL: **Phone A Lina** (host, female), **Phone B Sara** (joiner,
  female), **Phone C Omar** (driver).
- **Screens mirrored** to the projector (scrcpy, AirPlay, or a laptop showing all 3 views).
  Judges can't read phones held up.
- **Own mobile hotspot** for all 3 phones. Don't rely on venue wifi.
- **One shared server-side demo clock.** Default start: Sun 29 Nov 2026, 6:10 AM (a
  workday). Fast-forward moves this clock for everyone.
- Fallback: a recorded video of this exact flow.

### 2.2 Demo flow (6 steps)
1. **Lina schedules a shared ride.** Irbid City Center → JUST, arrive by 8:00 AM. In ride
   options she picks **Shared**, "from JOD 2.35". She sees "If nobody joins: JOD 7.85" and
   "Be ready by 7:15 AM". Status: 1 of 4 seats.
2. **Sara joins.** Her list shows Lina's ride ("City Center area → JUST", "JOD 4.00 each if
   you join"). She joins. Both phones update live: 2 of 4 seats, JOD 4.00 each.
3. **The ride fills.** Tap "simulate rider" twice (Rania, then Dana): JOD 2.90, then JOD 2.30
   each. 4 of 4 seats. The progress bar moves to "Finding your driver". Lina's pickup
   moves to 7:02 AM.
4. **Omar accepts.** Phone C shows the offer: JOD 9.03, 4 riders, cash, collect JOD 9.20,
   21.4 km · ~54 min, scheduled 7:02 AM, respond by 6:47 AM. He accepts. Phones A and B
   show "Omar · White Hyundai Elantra · 12-34567".
5. **Sara cancels.** She sees the JOD 1.00 fee, which appears as "Outstanding balance JOD 1.00"
   on her next booking screen. Lina's phone shows the seat reopened. Her share is now JOD 2.65.
6. **Recovery.** Tap "simulate rider" (Noor, Arabella Mall). The seat refills and the share
   drops to **JOD 2.05 each**. Fast-forward. End on the trip summary: 4 riders × JOD 2.05
   cash, plus JOD 1.00 credited to Omar by Jeeny.

### 2.3 Canonical demo numbers
Demo date: Sun 29 Nov 2026. All riders' destination is JUST.

| Moment | Riders | Full fare | Each pays | Pickups (ready by) |
|---|---|---|---|---|
| 6:10 Lina creates | Lina | 7.81 | 7.85 | Lina 7:15 |
| 6:12 Sara joins | +Sara | 7.95 | 4.00 | Lina 7:12, Sara 7:21 |
| 6:14 sim Rania | +Rania | 8.67 | 2.90 | Lina 7:05, Rania 7:13, Sara 7:20 |
| 6:15 sim Dana → dispatched | +Dana | 9.03 | 2.30 | Lina 7:02, Rania 7:10, Sara 7:17, Dana 7:22 |
| 6:16 Omar accepts (locks) | 4 | 9.03 | 2.30 | same. Respond-by was 6:47 |
| 6:18 Sara leaves (fee 1.00) | 3 | 8.88 | 2.65 | Lina 7:04, Rania 7:12, Dana 7:22 |
| 6:19 sim Noor | +Noor | 9.01 | 2.05 | Lina 7:02, Rania 7:10, Dana 7:20, Noor 7:27 |

- All drop-offs at JUST between 7:53 and 7:55 AM (all arrive-bys are met with 5 min buffer).
- Host estimate table at creation: 1 rider 7.85 · 2 riders 4.15 · 3 riders 2.95 · 4 riders 2.35 (est.).
- Final cash to Omar: 4 × 2.05 = 8.20, plus 1.00 credit = 9.20 (fare 9.01, rounding remainder 0.19).
- Driver: **Omar**, White Hyundai Elantra, plate 12-34567, starts near Arabella Mall.

### 2.4 Real vs mocked
| Real (built) | Mocked |
|---|---|
| Accounts with gender | Phone/OTP login (name + gender signup) |
| Creating, joining, leaving rides | Distances (fixed matrix, §4.2) |
| Matching rules (§3.5) | Travel times (time-of-day traffic profile, §4.3) |
| Live sync across phones | Driver GPS, car moving on the map |
| Driver accept, reject, cancel | Payment (cash shown, nothing charged) |
| Fare (regulated formula), split, fee math | Extra riders ("simulate rider") |
| Stop order and pickup times | Driver supply ("drivers nearby" setting) |

### 2.5 Demo controls (hidden menu)
- **P0:** fast-forward clock (+5 min, jump to the next event), simulate rider, one-tap
  reset to the seeded state (also logs out all phones and clears balances).
- **P1:** traffic level (Normal / Heavy / Jam), weather (Clear / Rain).
- **P2:** drivers nearby (2 / 8 / 20). This changes dispatch lead time and driver ETA.
- Note: keep traffic on Normal during the demo. In Jam, joins after the 2nd rider are rejected
  (first pickup too soon, rule 8).

### 2.6 Seed data
| Key | Place (approx. pin `[verify]`) | Lat, Lng |
|---|---|---|
| CC | Irbid City Center | 32.5568, 35.8469 |
| HS | Al-Hashmi Street | 32.5520, 35.8640 |
| US | University Street | 32.5440, 35.8570 |
| YU | Yarmouk University | 32.5366, 35.8556 |
| AM | Arabella Mall | 32.5290, 35.8660 |
| JUST | JUST | 32.4789, 35.9850 |

| Rider | Gender | Pickup | Arrive by |
|---|---|---|---|
| Lina (host) | F | CC | 8:00 AM |
| Sara | F | US | 8:00 AM |
| Rania (sim) | F | HS | 8:15 AM |
| Dana (sim) | F | YU | 8:00 AM |
| Noor (sim, replacement) | F | AM | 8:00 AM |
| Male seed riders (for gender filtering) | M | any | any |

Simulated riders are taken in this order and must pass every matching rule. If one fails,
the next valid seed rider is used. "Simulate rider" never fails silently.

## 3. Feature Behavior & Edge Cases (SRS)

### 3.1 Roles
- **Host:** creates the ride and counts as a rider. "Host" is a **label only**, with no extra
  powers. If the host leaves, the label passes to the earliest remaining joiner.
- **Joiner:** joins an existing ride.
- **Driver:** receives and accepts the trip. Any gender.

### 3.2 Signup
- Name and gender (male/female). Gender is set once and can't be changed.
- One-line consent: "Your first name and pickup area are shown to riders in your ride."

### 3.3 State machines
**Ride:** `OPEN → DISPATCHED → ACCEPTED → IN_PROGRESS → COMPLETED`, and `CANCELED` from any
state before `IN_PROGRESS`.
| From | To | Trigger |
|---|---|---|
| OPEN | DISPATCHED | 4 riders, or clock reaches first pickup − lead time (§3.8) |
| DISPATCHED | ACCEPTED | A driver accepts (fare locks) |
| DISPATCHED | CANCELED | No driver by first pickup − 15 min, or the last rider leaves |
| ACCEPTED | DISPATCHED | The driver cancels and it's still ≥ 15 min before first pickup |
| ACCEPTED | CANCELED | The driver cancels < 15 min before first pickup, or the last rider leaves |
| ACCEPTED | IN_PROGRESS | First pickup done |
| IN_PROGRESS | COMPLETED | Last drop-off done |

**Rider in ride:** `JOINED → PICKED_UP → DROPPED_OFF`. Also `JOINED → LEFT` (free or fee) and
`JOINED → NO_SHOW`.

### 3.4 Creating a ride (host)
- Entry point: a **Shared** row in the normal ride options list, priced "from JOD x"
  (the 4-rider estimate, §4.5).
- The host sets pickup, drop-off and arrive-by. Demo: pick from the seeded places only.
- The **first pickup** must be 60 min to 24 h from now. If the arrive-by is too soon:
  "Too soon for a shared ride. Book Economy instead."
- Max 4 riders including the host. `[open decision §7.1]`
- The host sees: estimated price per person at 1, 2, 3 and 4 riders, "If nobody joins:
  JOD 7.85", and "Be ready by 7:15 AM".

### 3.5 Finding and joining (joiner)
The joiner opens Shared, enters pickup, drop-off and arrive-by, and sees a list of matching
rides. Zero matches: "No rides yet. Start one" (they become a host with the same inputs).

A ride appears only if **ALL** are true:
1. Same gender as everyone in the ride. Male riders share with male riders the same way.
2. A free seat.
3. Ride is `OPEN`, **or** `ACCEPTED` with a seat reopened by a cancellation and ≥ 15 min
   before first pickup. In the accepted case the new route must also be ≤ 10 min longer
   than the accepted route.
4. With the joiner added, every rider is dropped by their arrive-by − 5 min, and no
   one is dropped more than 25 min before their arrive-by.
5. **Detour cap:** each rider's in-car time ≤ max(solo + 10 min, solo × 1.4). In-car time
   runs from arrival at your pickup to arrival at your drop-off. "Solo" is that rider's own
   solo trip under the same traffic conditions.
6. No existing rider's pickup moves more than 15 min earlier than the first pickup time
   they were shown.
7. No existing rider's share goes up, and the joiner's share is below their own solo fare.
8. The new first pickup is ≥ now + lead time + 5 min (so joining never triggers instant dispatch).
9. The joiner has no other active ride within ±15 min of this ride's time window.

The card shows: host first name, mini seat row, seats left, **pickup area and destination
area only**, arrive-by, "JOD x each if you join" (the real recomputed share) and "Pickup ~7:21 AM".

### 3.6 Stop order and pickup times
- Every rider has their own pickup and drop-off. Stop order is the order with the lowest
  full fare (then shortest duration) where each pickup comes before that rider's drop-off
  and rules 4–6 hold. Max 8 stops, so brute force is fine.
- The first pickup is the latest whole minute that satisfies everyone's arrive-by.
- Each rider sees "Be ready by h:mm AM". If it moves more than 3 min, the rider gets an
  in-app banner.
- The driver waits up to 5 min after a scheduled pickup time (see no-show, §3.10).

### 3.7 Fare (formula in §4.4)
- Full fare = regulated smart-app tariff for the **whole route including all stops**.
- Price per person = (full fare − fee credits) ÷ riders, **rounded up** to 0.05 JD. The
  driver keeps the rounding remainder (max 0.19).
- Prices update live on every phone when someone joins or leaves, or traffic changes.
- **Lock:** when a driver accepts, the traffic factors and tariff freeze. After that the
  full fare changes only if stops change (a leave, join or no-show).
- Cash only. Each rider pays their own share to the driver at drop-off.

### 3.8 Dispatch to drivers
- The trip goes to drivers when all 4 seats fill, or at first pickup − **lead time**,
  whichever comes first. Joining closes at dispatch.
- Lead time (P0: always 30 min. P1: supply-aware, §4.6): ≥ 10 drivers nearby → 30 min ·
  5–9 → 45 min · ≤ 4 → 60 min. With ≤ 2 drivers nearby, the host sees "Few drivers nearby"
  at creation.
- The offer goes to eligible nearby drivers. **First accept wins.** It stays open until
  first pickup − 15 min. A driver who rejects doesn't get it again. Riders keep seeing
  "Finding your driver".
- **No driver by then:** the ride is canceled, no fees. Each rider sees "No driver found" and
  a **"Book Economy now"** button prefilled with their trip and solo estimate.
- **Only the host remains at dispatch:** the ride continues at the solo price (already shown
  at creation). The host can cancel free until a driver accepts.

### 3.9 Driver
- The offer sheet shows: "Shared Ride", scheduled time, full fare, rider count, cash,
  **total cash to collect**, stops in order (first name + short address), km · min, and
  respond-by.
- The stop list shows each rider's share. At each stop the driver taps "Picked up Lina" or
  "Dropped off Lina · collected JOD 2.05".
- Only the driver and the rider themselves see exact pickup addresses.
- Driver cancels after accepting: back to `DISPATCHED` if ≥ 15 min before first pickup,
  otherwise canceled with no rider fees and the "Book Economy now" button.

### 3.10 Cancellation, no-show and money flow
- **Free leave:** before a driver accepts, or more than 2 h before the first pickup.
- **Fee leave:** after a driver accepts and within 2 h of the first pickup: **JOD 1.00**.
  - The canceller sees "Outstanding balance JOD 1.00" on their next booking (Jeeny's
    existing mechanism).
  - **Money flow:** remaining riders' shares = (new full fare − 1.00) ÷ remaining riders.
    Jeeny credits the 1.00 to the driver's in-app balance and recovers it from the
    canceller's next trip. So the driver always receives ≥ the full fare.
  - The new full fare is recalculated without the canceller's stops (it usually drops).
  - The seat reopens for a replacement (§3.5 rule 3). A replacement also benefits from the
    fee credit.
  - If a leave raises any remaining rider's share above their own solo fare, that rider can
    leave free.
- **No-show:** after waiting 5 min the driver taps "No-show". That rider is charged JOD 1.00,
  same flow as a fee leave, and the trip continues.
- **Host leaves:** the ride continues and the host label passes on.
- **Last rider leaves:** the ride is canceled and the driver is notified.

### 3.11 Notifications
In-app only: a banner or sheet shown live or on the next open. No push, no inbox.

### 3.12 Edge cases
| Case | Behavior |
|---|---|
| Two people take the last seat at the same moment | First commit wins. The second sees "This ride just filled up" |
| A join and a dispatch happen at the same moment | Dispatch wins. The joiner sees "This ride just closed" |
| Rider of a different gender | The ride never appears in their list |
| Rider already in a ride in the same time window | Can't join a second one |
| First pickup would be under 60 min away, or arrive-by is in the past | Not allowed, error shown |
| Driver rejects | The offer stays with the other drivers |
| Driver cancels | §3.9 |
| Phone loses connection | Shows "Reconnecting", then catches up to the latest state |
| Opens a ride that's canceled, completed or expired (stale tab) | "This ride is no longer available" |
| Traffic change before accept moves a pickup more than 15 min earlier | That rider can leave free |

## 4. Fare, Time & Supply Model
A reference implementation produced every number in this file. Any implementation with
these constants must reproduce the §4.7 golden values within ±0.01 JD and ±1 min.

### 4.1 Tariff (LTRC, effective 11 May 2026)
Smart apps charge the yellow-taxi tariff + 20% (taxi day 0.39 flag-fall + 0.28/km).
| | Flag-fall | Per km | Waiting per min |
|---|---|---|---|
| Day | JOD 0.468 | JOD 0.336 | JOD 0.0576 |
| Night (00:00–06:00 `[verify hours]`) | JOD 0.480 | JOD 0.396 | JOD 0.0679 |
- Tariff is chosen by the first-pickup time. Minimum fare JOD 1.00 `[verify]`.

### 4.2 Distances
- Road km = straight-line (haversine) distance × circuity: **urban 1.35**, **highway 1.15**.
- Any trip to or from JUST = urban leg to the Irbid–Ramtha road exit node
  (32.5200, 35.8900) + highway leg exit → JUST (11.5 km).
- Same place = 0 km (stops still take dwell time).

| km | CC | HS | US | YU | AM | JUST |
|---|---|---|---|---|---|---|
| **CC** | 0 | 2.3 | 2.3 | 3.2 | 4.8 | 19.3 |
| **HS** | 2.3 | 0 | 1.5 | 2.5 | 3.5 | 17.3 |
| **US** | 2.3 | 1.5 | 0 | 1.1 | 2.5 | 17.0 |
| **YU** | 3.2 | 2.5 | 1.1 | 0 | 1.7 | 16.5 |
| **AM** | 4.8 | 3.5 | 2.5 | 1.7 | 0 | 14.8 |
| **JUST** | 19.3 | 17.3 | 17.0 | 16.5 | 14.8 | 0 |

The urban part of each JUST leg: CC 7.8 · HS 5.8 · US 5.5 · YU 5.0 · AM 3.3 (+11.5 highway).
`[verify]` one real Google Maps or Jeeny quote for CC → JUST. If it's off, fix the
distances, never the tariff.

### 4.3 Travel time and traffic
- Free-flow speed: **urban 30 km/h**, **highway 70 km/h**.
- Leg time = urban km / 30 × 60 × urban factor + highway km / 70 × 60 × highway factor,
  using the factor at the **leg's start time**.
- Weekday (Sun–Thu) congestion factors. Interpolate linearly between anchors:

| Hour | 0–5 | 6 | 7 | 7:30–8 | 9 | 11 | 13 | 14:30 | 16 | 18 | 20 | 22 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Urban | 1.00 | 1.15 | 1.55 | **1.75** | 1.40 | 1.30 | 1.45 | 1.60 | 1.50 | 1.45 | 1.20 | 1.05 | 1.00 |
| Highway | 1.00 | 1.05 | 1.20 | **1.30** | 1.15 | 1.10 | 1.15 | 1.20 | 1.15 | 1.15 | 1.05 | 1.00 | 1.00 |

- Fri/Sat: factor = 1 + (weekday factor − 1) × 0.5.
- Demo multipliers on both factors: traffic Normal 1.0 · Heavy 1.2 · Jam 1.5. Weather Clear 1.0 · Rain 1.15.
- Dwell: 1.5 min per pickup, 0.5 min per drop-off.
- The profile is a mock tuned for Irbid's morning university rush. `[verify]` with a teammate's
  real commute times.

### 4.4 Fare formula
```
full_fare = max(MIN_FARE, flag + km_total × per_km + wait_min × per_min)
wait_min  = Σ legs (actual_min − free_flow_min) + Σ dwell_min
```
- Congestion delay is billed at the waiting rate, as a meter does when the car is slow.
  This is a slightly conservative (high) estimate.

### 4.5 Split and estimates
- `share = ceil_to_0.05((full_fare − fee_credits) / riders)`
- Host estimates before anyone joins: `ceil_to_0.05(solo_fare × A[k] / k)`, with detour
  allowance A = {1: 1.00, 2: 1.05, 3: 1.12, 4: 1.20}. "From JOD x" = the k = 4 value.
  Estimates are tuned to be slightly above the real share, so riders are never surprised upward.

### 4.6 Driver supply (P1/P2)
- Acceptance probability per offered driver p = 0.35 `[verify]`. The pool refreshes every
  15 min as drivers finish trips or come online.
- `P(no driver) = (1 − p)^(N × W / 15)`, where N = drivers within 5 km and W = lead − 15 min.

| Drivers nearby | Lead 30 | Lead 45 | Lead 60 | Chosen lead |
|---|---|---|---|---|
| 1 | 65% | 42% | 28% | 60 + warning |
| 2 | 42% | 18% | 7.5% | 60 + warning |
| 3 | 28% | 7.5% | 2.1% | 60 |
| 5 | 12% | 1.3% | 0.2% | 45 |
| 8 | 3.2% | 0.1% | 0% | 45 |
| 10 | 1.3% | 0% | 0% | 30 |
| 20 | 0% | 0% | 0% | 30 |

- Driver ETA (for "Driver on the way"): nearest-driver distance = 0.5 / √(N / 78.5 km²) ×
  1.35, at urban speed × current factor, + 1 min. At 7:30 AM: N = 2 → 16 min · 5 → 10 · 10 → 8 · 20 → 6.

### 4.7 Golden values (use as unit tests)
**Solo, Irbid City Center → JUST, Sunday:**
| Arrive by | First pickup | Trip | Km | Full fare | Rounded |
|---|---|---|---|---|---|
| 03:00 (night tariff) | 02:28 | 27 min | 19.3 | 8.26 | 8.30 |
| 07:30 | 06:48 | 37 min | 19.3 | 7.60 | 7.60 |
| 08:00 | 07:15 | 40 min | 19.3 | 7.81 | 7.85 |
| 11:00 | 10:21 | 34 min | 19.3 | 7.43 | 7.45 |
| 15:00 | 14:17 | 38 min | 19.3 | 7.70 | 7.70 |
| 22:00 | 21:26 | 29 min | 19.3 | 7.16 | 7.20 |

**Solo fare per seeded rider (arrive-bys from §2.6):** Lina 7.85 · Sara 6.90 · Rania 7.10 · Dana 6.70 · Noor 6.05.

**Full 4-rider demo ride (Lina, Sara, Rania, Dana) by condition:**
| Condition | First pickup | Trip | Full fare | Each | Lina solo |
|---|---|---|---|---|---|
| Normal (demo) | 7:02 | 54 min | 9.03 | 2.30 | 7.81 |
| Heavy | 6:54 | 61 min | 9.49 | 2.40 | 8.18 |
| Jam | 6:42 | 72 min | 10.12 | 2.55 | 8.72 |
| Rain | 6:56 | 60 min | 9.38 | 2.35 | 8.09 |
| Same times, Friday | 7:09 | 46 min | 8.60 | 2.15 | 7.46 |
Normal route: CC → HS → US → YU → JUST, 21.4 km.

**Detour check (demo ride, in-car time vs cap):** Lina 51.5 vs cap 55.7 (old +10 rule:
49.8 ✗) · Rania 43.8 vs 48.5 · Sara 36.9 vs 46.0 · Dana 32.7 vs 43.8.
Solo in-car baselines: Lina 39.8 · Sara 32.9 · Rania 34.6 · Dana 31.3 · Noor 25.9 min.

**Driver economics (demo ride vs Lina solo; 14 min empty drive in, 40 min empty return,
20% commission `[verify]`):**
| | Full fare | Driver net | Total time | Net per hour |
|---|---|---|---|---|
| Solo | 7.81 | 6.25 | 95 min | 3.96 |
| Shared ×4 | 9.03 | 7.22 | 108 min | 4.02 |
- Jeeny commission: shared trip 1.81 vs 5.70 if all 4 had booked solo (solo fares total 28.48).

### 4.8 Assumptions to verify (owner: non-coding teammates, before the pitch)
1. One real Jeeny quote screenshot for Irbid City Center → JUST at a morning time (checks distance and tariff).
2. Bus fare and typical bus time Irbid → JUST.
3. Night tariff hours and current minimum fare.
4. Jeeny's commission rate. Ask at the briefing or say "usual commission".
5. Seed pin coordinates (§2.6), especially Al-Hashmi Street and Arabella Mall.
6. A rough count of Irbid-based JUST commuters, if available. Don't invent it.

## 5. Do Not Build
- Bus tracking, bus predictions, or any AI features
- Price comparison screen
- Student verification or university email checks
- Live trip sharing with family
- Online payment, wallet, or cards (the driver's in-app credit is a displayed number only)
- Real GPS tracking, live driver movement, or a routing API
- Ratings, chat, support or report screens
- Arabic UI or RTL layout
- Real phone/OTP login
- MAX subscription, promotions, notifications inbox, push notifications
- Invite-by-link, recurring rides, female-driver preference (roadmap slide only)

## 6. Required changes in DESIGN.md (example text only)
| Where | Old | New |
|---|---|---|
| Ride option row | "from JOD 1.30" | "from JOD 2.35" |
| Seat row | "2 of 4 seats filled · JOD 3.10 each" | "2 of 4 seats filled · JOD 4.00 each" |
| Matching card | "Arrives by 7:55", "JOD 1.65 each", full addresses | "Arrives by 8:00", "JOD 4.00 each if you join", **area names only** ("City Center area"), "Pickup ~7:21 AM" |
| Trip offer | "JOD 6.20", "Scheduled · 7:20 AM", "12.4 km · ~28 min", "Respond by 6:50 AM" | "JOD 9.03" + "Collect JOD 9.20", "Scheduled · 7:02 AM", "21.4 km · ~54 min", "Respond by 6:47 AM" |
| Location card | (none) | Add row "Be ready by 7:02 AM" |
| Driver stops list | name + address | + each rider's share, "Picked up" / "Dropped off · collected" actions |

## 7. Open decisions (team must choose, not blocking the build)
1. **Front seat:** with 4 women and a male driver, one rider sits in front. Locally, women
   often prefer the back seat. Options: (a) keep max 4, (b) host toggle "Back seats only"
   = max 3. Demo is unaffected either way.
2. **AI scoring:** the event is "Mobility × AI" and AI is locked out. Ask at the 9:30
   briefing whether AI is scored. Honest framing if asked: "traffic-aware, supply-aware
   scheduling", rules-based and not called AI.
3. **Fee window:** 2 hours before first pickup (current) vs. any time after accept (v1).

Sources: LTRC 2026 smart-app tariff (jo.motory.com, 12 May 2026; Al Mamlaka; Petra, 3 Feb
2026). JUST location and enrollment (Wikipedia, JUST site). LTRC Irbid/Zarqa/Jerash pilot
routes (Petra, 22 Jul 2026).
