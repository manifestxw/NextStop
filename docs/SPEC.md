# SPEC.md: Jeeny Shared Ride

> Final feature definition. Wins over the pitch deck and brief on any conflict.

## 1. Business & Judging Angle (BRD)

**One line:** Schedule a Jeeny ride, open your empty seats, and split the fare with
up to 3 people going your way, all the same gender as you.

**Problem:** Daily commuters choose between unreliable, overcrowded buses and solo
rides they can't afford every day. Our first example is Irbid university students
(Irbid city → JUST: bus 0.60 JD but unreliable, solo ride 4–5 JD), but the feature
works for anyone, anywhere Jeeny operates.

**Value for riders:** door-to-door ride for a fraction of the solo price. Same-gender
rides make sharing a car with strangers feel safe.

**Value for Jeeny:**
- Each shared ride is one normal Jeeny trip, so Jeeny keeps its usual commission.
- Drivers earn a full fare (more with extra stops) for one trip.
- Wins price-sensitive users who take the bus today and never open Jeeny.
- Fills empty seats on trips that already happen.

**Why judges will care:** it fits Jeeny's existing app (scheduled rides, cash
payments, a gender field on every profile, outstanding-balance fees), it's
demoable live on several phones, and it opens a segment Jeeny doesn't serve today.

**Prepared answers for judge questions:**
- *Is fare splitting legal under LTRC rules?* Not verified. Our framing: one booking
  on one licensed Jeeny vehicle; riders split the cost among themselves. Jeeny's
  legal team would confirm before launch.
- *Why same gender only?* Safety and cultural comfort, especially for women. It's the
  main reason people would share a car with strangers.
- *Is the driver the same gender?* No. Any driver can accept, same as today.
- *What if the ride doesn't fill?* It goes with whoever joined; each pays a bigger
  share, still usually cheaper than riding solo.

## 2. Live Demo Script & Scope (PRD)

**Pitch:** 15 minutes. Suggested split: problem 2 min, live demo 5 min, business and
Jeeny fit 3 min, buffer and questions 5 min.

**Setup:** 3 phones on the same live URL, held up to judges.
- Phone A: **Lina** (host, female)
- Phone B: **Sara** (joiner, female)
- Phone C: **Omar** (driver)
- "Simulate rider" in the hidden demo menu adds fake riders.

**Demo flow (5 steps):**
1. **Lina schedules a shared ride.** Pickup in Irbid city, destination JUST, arrive by
   8:00. In the ride options list she picks the new **Shared** row, "from JOD 1.30".
   Her status sheet shows the seat row: 1 of 4 seats filled.
2. **Sara joins.** Her phone lists Lina's ride (same gender, fits her arrive-by time).
   She joins. Both phones update live: 2 of 4 seats, price per person drops.
3. **The ride fills.** Tap "simulate rider" twice. 4 of 4 seats, price drops again,
   progress bar moves to "Finding your driver", trip goes to drivers.
4. **Omar accepts.** Phone C shows the trip offer: all stops, total fare, 4 riders,
   cash. He accepts. Phones A and B instantly show driver, car and plate.
5. **Sara cancels.** She sees the 1 JD fee, which appears as an "Outstanding balance
   JOD 1.00" strip on her next booking screen. Lina's phone shows the seat reopened
   and her updated share. End on the trip summary: each rider pays their share in cash.

**Fallback:** a recorded video of this exact flow, ready to play if anything fails.

**Real vs mocked:**
| Real (built) | Mocked |
|---|---|
| Accounts with gender | Phone/OTP login (simple name + gender signup) |
| Creating, joining, leaving rides | Fare calculation (simple formula, not Jeeny's pricing) |
| Gender + arrive-by matching rules | Travel times (estimated, not live traffic) |
| Live sync across phones | Driver GPS / car moving on the map |
| Driver accept/reject flow | Payment (cash shown, nothing charged) |
| Fare split and cancellation fee math | Extra riders ("simulate rider") |

**Demo controls (hidden menu):** fast-forward time, simulate rider, reset everything to
the seeded starting state in one tap.

**Seed data:** real Irbid locations (Irbid city center, University Street, Al-Hashmi
Street, Yarmouk University, JUST, Arabella Mall). Realistic Jordanian names. Fares
tuned so Irbid city → JUST ≈ 5 JD for the full car.

## 3. Feature Behavior & Edge Cases (SRS)

### Roles
- **Host:** creates the shared ride. Counts as a rider.
- **Joiner:** joins an existing shared ride.
- **Driver:** receives and accepts the trip.

### Signup
- Name and gender (male/female). Gender is set once and can't be changed.

### Creating a ride (host)
- Entry point: a **Shared** row in the normal ride options list.
- Host sets pickup, drop-off and arrive-by time.
- Can be scheduled from 30 minutes to 24 hours ahead.
- Max 4 riders including the host.
- Host sees the estimated full fare and the price per person at 2, 3 and 4 riders.

### Finding and joining (joiner)
A ride appears in a rider's matching list only if ALL are true:
1. Same gender as everyone already in the ride.
2. The ride has a free seat.
3. The ride hasn't been sent to drivers yet.
4. After adding the joiner's pickup and drop-off, every rider (including the joiner)
   still arrives by their own arrive-by time.
5. No existing rider's trip gets more than 10 minutes longer than when they joined.

**"Late"** means arriving after your own arrive-by time.
Each rider is picked up at their own pickup point and dropped at their own drop-off.
Stop order is chosen to satisfy everyone's arrive-by time.

### Fare
- Full fare = estimated normal Jeeny fare for the whole route including all stops.
- Price per person = full fare ÷ number of riders, rounded to 0.05 JD.
- Prices update live on every rider's phone when someone joins or leaves.
- The price is an estimate until the driver accepts, then it locks.
- Cash only. Each rider pays their own share to the driver.

### Dispatch to drivers
- The trip goes to drivers when all 4 seats fill, OR 30 minutes before the first
  pickup, whichever comes first.
- Sent with fewer than 4 riders: each pays a bigger share (full fare ÷ riders).
- The offer stays open until a driver accepts, up to 15 minutes before the first
  pickup. Drivers can accept or reject.
- No driver by then: all riders are notified, the ride is canceled, no fees.
- Any driver can accept, regardless of gender.

### Cancellation
- Before a driver accepts: any rider can leave for free.
- After a driver accepts: leaving costs **1 JD**.
  - Shown to the canceller as "Outstanding balance JOD 1.00" on their next booking
    (Jeeny's existing mechanism).
  - The 1 JD is split equally among the remaining riders as a discount on their share.
  - The seat reopens for a replacement until 15 minutes before the first pickup.
  - No replacement: remaining shares go up (full fare ÷ fewer riders, minus the fee discount).
- Host leaves: the ride continues. The earliest joiner becomes the new host.
- Last rider leaves: ride canceled, driver notified.

### Edge cases
| Case | Behavior |
|---|---|
| Two people take the last seat at the same moment | First one wins. Second sees "This ride just filled up" |
| Rider of a different gender | Ride never shown in their list |
| Only the host remains at dispatch | Host is told they'll pay the full solo fare and can cancel for free |
| Rider already in another ride at the same time | Can't join a second one |
| Arrive-by in the past or under 30 min away | Not allowed, error shown |
| Driver rejects | Offer goes to other drivers. Riders keep seeing "Finding your driver" |
| Phone loses connection | Shows "Reconnecting", then catches up to the latest state |
| Rider opens an expired or canceled ride link | Shows "This ride is no longer available" |

## Do Not Build
- Bus tracking, bus predictions, or any AI features
- Price comparison screen
- Student verification or university email checks
- Live trip sharing with family
- Online payment, wallet, or cards
- Real GPS tracking or live driver movement
- Ratings, chat, or support screens
- Arabic UI or RTL layout
- Real phone/OTP login
- MAX subscription, promotions, notifications inbox
