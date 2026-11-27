"""
fare_model.py: reference model for SPEC.md v8.
Lives at docs/reference/fare_model.py. It is a SPEC, not app code: port it, don't import it.
Golden values = what this file prints. If SPEC.md disagrees, SPEC.md gets fixed.

Covers:
  - LTRC smart-app tariff + CALIBRATION (SPEC §4.1, §4.1.1, §4.4)
  - Fixed-table distances and traffic curve (§4.2.3, §4.3)
  - Stop-order score: fare in piastres + trip minutes + 0.01 x total in-car minutes (§3.6)
  - First pickup and effective arrive-by (§3.6, rule 7)
  - Matching rules 1, 2 and 4-11 (§3.5) for the demo scenario
  - Free and late leave with frozen pickup times (§3.6, §3.10, §4.5)
  - v6: categories + sync zones (§3.16), gender modes and the toggle (rule 1)
  - v7: +1 seats in the split (§3.17 A), k-means demand spots + sample history (§3.18)
  - v8: Uni plans: uni-trip test, 20% discount, replacements, 12 h cancel, placement (§3.19)
Not covered: rule 3 (ride state), rule 12, state machines, ready check, dispatch, chat,
credits paid at completion, Google/Snapshot sources, friend-code invites (plain joins),
Airport fares (no QAIA in the fixed table; only its zone and rules are modelled).

Times here are naive datetimes meaning Amman local time. The app must derive hours and
weekdays through ammanParts() (ARCHITECTURE §6, trap 5).

Run:  python fare_model.py
Note: plan() brute-forces stop orders; a 4-rider plan takes a few seconds in Python.
"""
import math, itertools, datetime as dt

# ---------- Constants (SPEC §3.5, §3.10, §4) ----------
CALIBRATION = 1.00          # §4.1.1. Golden values always use 1.00
MAX_RIDERS = 4
ARRIVE_WINDOW_MIN = 5       # rule 4: joiner arrive-by within ±5 min of host
PICKUP_RADIUS_KM = 1.5      # rule 5: pickup near host pickup or anchor route
DEST_RADIUS_KM = 1.0        # rule 6
BUFFER = 5                  # rule 7: drop by effective arrive-by - 5 min
EARLY_MAX = 25              # rule 7: never dropped > 25 min before own arrive-by
PICKUP_SHIFT_MAX = 15       # rule 9
MIN_LEAD_TO_JOIN = 45       # rule 11: new first pickup >= now + 45 min
LATE_LEAVE_MIN = 30         # §3.10: < 30 min before first pickup = late leave

# ---------- Locations (approx coords, fixed table only) ----------
LOC = {
    'CC':   ('Irbid City Center',  32.5568, 35.8469),
    'HS':   ('Al-Hashmi Street',   32.5520, 35.8640),
    'US':   ('University Street',  32.5440, 35.8570),
    'YU':   ('Yarmouk University', 32.5366, 35.8556),
    'AM':   ('Arabella Mall',      32.5290, 35.8660),
    'JUST': ('JUST',               32.47889, 35.98500),
}
EXIT = (32.5200, 35.8900)   # Irbid -> Ramtha road exit node
CIRC_URBAN, CIRC_HW = 1.35, 1.15
V_URBAN, V_HW = 30.0, 70.0  # free-flow km/h

def pt(k): return (LOC[k][1], LOC[k][2])

def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(d))

def leg_km(a, b):
    """Returns (urban_km, highway_km) for place keys a -> b."""
    if a == b: return (0.0, 0.0)
    if 'JUST' in (a, b):
        o = b if a == 'JUST' else a
        return (round(hav(pt(o), EXIT)*CIRC_URBAN, 1), round(hav(EXIT, pt('JUST'))*CIRC_HW, 1))
    return (round(hav(pt(a), pt(b))*CIRC_URBAN, 1), 0.0)

# ---------- Geometry for rules 5 and 6 ----------
def _xy_km(p, ref):
    kx = 111.32 * math.cos(math.radians(ref[0])); ky = 110.57
    return ((p[1]-ref[1])*kx, (p[0]-ref[0])*ky)

def dist_point_segment_km(p, a, b):
    P, A, B = _xy_km(p, a), (0.0, 0.0), _xy_km(b, a)
    dx, dy = B[0]-A[0], B[1]-A[1]
    L2 = dx*dx + dy*dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((P[0]-A[0])*dx + (P[1]-A[1])*dy) / L2))
    cx, cy = A[0] + t*dx, A[1] + t*dy
    return math.hypot(P[0]-cx, P[1]-cy)

def dist_point_polyline_km(p, line):
    return min(dist_point_segment_km(p, line[i], line[i+1]) for i in range(len(line)-1))

def anchor_route(p_key, d_key):
    """Fixed-table anchor route (§4.2.3): via the exit node for trips to/from JUST."""
    if 'JUST' in (p_key, d_key):
        return [pt(p_key), EXIT, pt(d_key)]
    return [pt(p_key), pt(d_key)]

# ---------- Traffic (fixed table only, §4.3) ----------
ANCHORS = [(0,1.00,1.00),(5,1.00,1.00),(6,1.15,1.05),(7,1.55,1.20),(7.5,1.75,1.30),(8,1.75,1.30),
           (9,1.40,1.15),(11,1.30,1.10),(13,1.45,1.15),(14.5,1.60,1.20),(16,1.50,1.15),
           (18,1.45,1.15),(20,1.20,1.05),(22,1.05,1.00),(24,1.00,1.00)]
LEVEL = {'normal':1.0, 'heavy':1.2, 'jam':1.5}
WEATHER = {'clear':1.0, 'rain':1.15}

def base_factors(h):
    for (h0,u0,w0),(h1,u1,w1) in zip(ANCHORS, ANCHORS[1:]):
        if h0 <= h <= h1:
            f = (h-h0)/(h1-h0); return u0+(u1-u0)*f, w0+(w1-w0)*f
    return 1.0, 1.0

def factors(t, level='normal', weather='clear'):
    u, hw = base_factors(t.hour + t.minute/60 + t.second/3600)
    if t.weekday() in (4, 5):  # Python: Mon=0, so Fri=4, Sat=5. Half the congestion.
        u, hw = 1+(u-1)*0.5, 1+(hw-1)*0.5
    m = LEVEL[level]*WEATHER[weather]
    return u*m, hw*m

def leg_min(a, b, t, **kw):
    u, hw = leg_km(a, b); fu, fh = factors(t, **kw)
    return u/V_URBAN*60*fu + hw/V_HW*60*fh

def leg_free(a, b):
    u, hw = leg_km(a, b); return u/V_URBAN*60 + hw/V_HW*60

# ---------- Tariff (LTRC 2026, smart-app = taxi x1.2) ----------
DAY   = dict(flag=0.468, km=0.336, wait=0.0576)
NIGHT = dict(flag=0.480, km=0.396, wait=0.0679)
MIN_FARE = 1.00
DWELL_PICK, DWELL_DROP = 1.5, 0.5

def tariff(t): return NIGHT if t.hour < 6 else DAY

def up05(x): return math.ceil(round(x*100, 6)/5)*5/100

# ---------- Route evaluation ----------
def evaluate(stops, T0, price_factor=1.0, **kw):
    """stops: list of (kind 'P'/'D', rider_index, place_key). Drives continuously from T0.
    price_factor = the category's price (§3.16): Comfort 1.25, else 1.00.
    Returns arrival times, km, billed wait, fare and duration."""
    t = T0; km = 0.0; wait = 0.0; times = []; prev = None
    for kind, _, loc in stops:
        if prev is not None:
            m = leg_min(prev, loc, t, **kw); f = leg_free(prev, loc)
            u, hw = leg_km(prev, loc); km += u + hw
            wait += (m - f)
            t += dt.timedelta(minutes=m)
        times.append(t)
        d = DWELL_PICK if kind == 'P' else DWELL_DROP
        wait += d
        t += dt.timedelta(minutes=d)
        prev = loc
    tf = tariff(T0)
    fare = max(MIN_FARE, CALIBRATION * price_factor * (tf['flag'] + km*tf['km'] + wait*tf['wait']))
    return dict(times=times, km=round(km, 1), wait=wait, end=t, fare=round(fare, 2),
                dur=(t-T0).total_seconds()/60)

def latest_start(stops, deadline, **kw):
    """Latest whole-minute first pickup so the last drop-off is <= deadline (§3.6)."""
    def last_drop(T):
        ev = evaluate(stops, T, **kw)
        return ev, max(ev['times'][j] for j, (k, _, _) in enumerate(stops) if k == 'D')
    T0 = deadline - dt.timedelta(minutes=60)
    for _ in range(6):
        _, ld = last_drop(T0)
        T0 += deadline - ld
    T0 = T0.replace(second=0, microsecond=0) + dt.timedelta(minutes=1)
    for _ in range(40):
        _, ld = last_drop(T0)
        if ld <= deadline + dt.timedelta(seconds=1): return T0
        T0 -= dt.timedelta(minutes=1)
    return None

def plan(riders, extra_ok=None, early_max=EARLY_MAX, **kw):
    """riders: list of dict(name, gender, p, d, by). Tries every precedence-valid stop order.
    Effective arrive-by = earliest arrive-by of all riders (rules 4/7).
    Score (SPEC §3.6): fare in piastres + trip minutes + 0.01 x total in-car minutes. Lowest wins.
    extra_ok(result) -> bool lets callers enforce rules 8-9 per stop order."""
    n = len(riders)
    deadline = min(r['by'] for r in riders) - dt.timedelta(minutes=BUFFER)
    events = [('P', i) for i in range(n)] + [('D', i) for i in range(n)]
    best = None
    for perm in itertools.permutations(events):
        picked = set(); ok = True
        for k, i in perm:
            if k == 'P': picked.add(i)
            elif i not in picked: ok = False; break
        if not ok: continue
        stops = [(k, i, riders[i]['p'] if k == 'P' else riders[i]['d']) for k, i in perm]
        T0 = latest_start(stops, deadline, **kw)
        if T0 is None: continue
        ev = evaluate(stops, T0, **kw)
        pick = {i: ev['times'][j] for j, (k, i, _) in enumerate(stops) if k == 'P'}
        drop = {i: ev['times'][j] for j, (k, i, _) in enumerate(stops) if k == 'D'}
        if any(drop[i] < riders[i]['by'] - dt.timedelta(minutes=early_max) for i in drop):
            continue
        incar = {i: (drop[i] - pick[i]).total_seconds()/60 for i in pick}
        res = dict(stops=stops, T0=T0, fare=ev['fare'], km=ev['km'], dur=ev['dur'],
                   incar=incar, pick=pick, drop=drop)
        if extra_ok and not extra_ok(res): continue
        score = ev['fare']*100 + ev['dur'] + 0.01*sum(incar.values())
        if best is None or score < best[0]:
            best = (score, res)
    return None if best is None else best[1]

def solo(r, **kw): return plan([r], **kw)

def detour_cap(solo_incar, category='economy'):
    add, mult = CATEGORY[category]['detour']
    return max(solo_incar + add, solo_incar * mult)

# ---------- Categories and sync zones (SPEC §3.16) ----------
# pick/dest = (rate, floor_km, ceiling_km); detour = (add_min, multiplier)
CATEGORY = {
    'economy': dict(max_riders=4, price=1.00, pick=(0.075, 1.5, 4.0), dest=(0.05, 1.0, 2.5),
                    window=5, early=25, detour=(10, 1.40), A={1: 1.00, 2: 1.05, 3: 1.12, 4: 1.20}),
    'comfort': dict(max_riders=3, price=1.25, pick=(0.06, 1.0, 3.0), dest=(0.04, 0.75, 2.0),
                    window=5, early=25, detour=(8, 1.25), A={1: 1.00, 2: 1.04, 3: 1.08}),
    'airport': dict(max_riders=3, price=1.00, pick=(0.15, 3.0, 10.0), dest=(0.0, 1.0, 1.0),
                    window=20, early=45, detour=(15, 1.25), A={1: 1.00, 2: 1.05, 3: 1.10}),
}

def _clamp_zone(rate_floor_ceil, L):
    rate, lo, hi = rate_floor_ceil
    return round(min(hi, max(lo, rate * L)), 1)      # Python round = half-to-even (pyRound)

def zone(category, anchor_km):
    """(pickup_km, dest_km) for a ride, from the anchor route's road km. Fixed at creation."""
    c = CATEGORY[category]
    return _clamp_zone(c['pick'], anchor_km), _clamp_zone(c['dest'], anchor_km)

def seats(riders):
    """Seats used: each rider plus their +1 (SPEC §3.17 A). The share divisor."""
    return sum(2 if r.get('guest') else 1 for r in riders)

def gender_ok(ride, j):
    """Rule 1 (v6). 'same' ride: joiner (and their +1) must be the ride's gender; the
    joiner's toggle doesn't matter. 'mixed' ride: the joiner's toggle must be off."""
    if ride.get('gender_mode', 'same') == 'same':
        g = ride['riders'][0]['gender']
        return j['gender'] == g and (not j.get('guest') or j['guest']['gender'] == g)
    return not j.get('same_gender_only', True)

# ---------- Matching (SPEC §3.5) ----------
def check_join(ride, j, now, **kw):
    """ride: dict(riders=[host, ...], first_shown={name: time}, share=float), optionally
    category ('economy'), gender_mode ('same'), zone ((pickup_km, dest_km); computed from the
    host's solo km when absent). j may carry category, same_gender_only, guest={name, gender}.
    Returns (ok, reason, plan, share)."""
    riders = ride['riders']; host = riders[0]
    cat_name = ride.get('category', 'economy'); cat = CATEGORY[cat_name]
    kw2 = dict(kw, price_factor=cat['price'])
    if not gender_ok(ride, j):                                  return (False, 'rule 1 gender', None, None)
    if j.get('category', 'economy') != cat_name:                return (False, 'rule 1 category', None, None)
    if seats(riders) + seats([j]) > cat['max_riders']:          return (False, 'rule 2 full', None, None)
    if abs((j['by'] - host['by']).total_seconds())/60 > cat['window']:
                                                                return (False, 'rule 4 arrive-by', None, None)
    z_pick, z_dest = ride.get('zone') or zone(cat_name, solo(host, **kw2)['km'])
    d_pick = min(hav(pt(j['p']), pt(host['p'])),
                 dist_point_polyline_km(pt(j['p']), anchor_route(host['p'], host['d'])))
    if d_pick > z_pick:                                         return (False, 'rule 5 pickup far', None, None)
    if hav(pt(j['d']), pt(host['d'])) > z_dest:                 return (False, 'rule 6 destination far', None, None)

    new = riders + [j]
    solo_incar = {i: solo(r, early_max=cat['early'], **kw2)['incar'][0] for i, r in enumerate(new)}
    def ok_8_9(res):
        if any(res['incar'][i] > detour_cap(solo_incar[i], cat_name) + 1e-9 for i in res['incar']):
            return False                                        # rule 8 detour cap
        for i, r in enumerate(riders):
            if (ride['first_shown'][r['name']] - res['pick'][i]).total_seconds()/60 > PICKUP_SHIFT_MAX:
                return False                                    # rule 9 pickup shift
        return True
    p = plan(new, extra_ok=ok_8_9, early_max=cat['early'], **kw2)
    if p is None:                                               return (False, 'rules 7-9 no valid stop order', None, None)
    share = up05(p['fare'] / seats(new))
    if share > ride['share'] + 1e-9:                            return (False, 'rule 10 share goes up', None, None)
    if share >= up05(solo(j, early_max=cat['early'], **kw2)['fare']):
                                                                return (False, 'rule 10 not cheaper than solo', None, None)
    if p['T0'] < now + dt.timedelta(minutes=MIN_LEAD_TO_JOIN):  return (False, 'rule 11 too late to join', None, None)
    return (True, 'ok', p, share)

# ---------- Leaving after the freeze (SPEC §3.6, §3.10, §4.5) ----------
def leave(p, leaver_idx, n_riders, locked_share, now, *, existing_credits=0.0,
          driver_assigned=True, **kw):
    """A rider leaves the current active plan after pickup times froze.
    - Pickup times shown to the other riders don't change: they stay p['pick'][i].
    - The fare is recomputed for the remaining stops in the same order, driving continuously
      from the same first pickup p['T0']. If the driver reaches a frozen pickup early, they
      wait; that wait is NOT billed (SPEC §3.6, §4.4).
    - Late leave: the leaver's current share becomes a credit held on the ride
      (paid to the completing driver at COMPLETED, reversed if the ride is CANCELED).
    existing_credits is the amount in JD held before this leave.
    n_riders counts seats (riders + their +1s, §3.17). A +1 leaving alone is modelled by the
    caller as a one-seat leave whose stops stay (same stops as the member who brought them).
    Returns (new_fare, new_share, incremental_charge, late, frozen_pickups).
    With no riders left, the caller cancels the ride and reverses previous charges."""
    if n_riders == 1:
        return 0.0, 0.0, 0.0, False, {}
    remaining = [s for s in p['stops'] if s[1] != leaver_idx]
    ev = evaluate(remaining, p['T0'], **kw)
    frozen = {i: t for i, t in p['pick'].items() if i != leaver_idx}
    n = n_riders - 1
    late = driver_assigned and (p['T0'] - now).total_seconds()/60 < LATE_LEAVE_MIN
    credit = locked_share if late else 0.0
    cash_due = max(0.0, ev['fare'] - existing_credits - credit)
    share = up05(cash_due / n)
    if late:
        share = min(locked_share, share)
    return ev['fare'], share, credit, late, frozen

# ---------- Uni plans (SPEC §3.19) ----------
CAMPUSES = ['JUST', 'YU']
UNI_RADIUS_KM = 1.0
UNI_PAYS = 0.80                 # subscriber pays 80% of their share on a uni ride
CANCEL_CUTOFF_H = 12            # >= 12 h before arrive-by: replacement possible; also placement time
WEEKLY_RIDES = (3, 5)           # rides in the one week
SEMESTER_RIDES_PER_WEEK = (2, 5)

def is_uni_trip(p_key, d_key):
    """The rider's OWN pickup or destination is within 1.0 km of a campus."""
    return any(hav(pt(k), pt(c)) <= UNI_RADIUS_KM for k in (p_key, d_key) for c in CAMPUSES)

def uni_paid(share):
    """What a subscriber pays on a uni ride. RideSync credits share - paid to the driver."""
    return up05(share * UNI_PAYS)

def replacements(kind, planned_total):
    """Weekly: 1. Semester: 5% of planned rides, rounded down, minimum 1 (integer math)."""
    return 1 if kind == 'weekly' else max(1, planned_total // 20)

def valid_plan_size(kind, rides_per_week):
    lo, hi = WEEKLY_RIDES if kind == 'weekly' else SEMESTER_RIDES_PER_WEEK
    return lo <= rides_per_week <= hi

def cancel_planned(minutes_before, replacements_left):
    """Cancel a planned ride. >= 12 h before: removed, replacement if any left.
    < 12 h: already placed, use the normal leave (§3.10). Returns (outcome, replacements_left)."""
    if minutes_before >= CANCEL_CUTOFF_H * 60:
        if replacements_left > 0:
            return ('replacement', replacements_left - 1)
        return ('gone', 0)
    return ('use_leave', replacements_left)

def new_ride(host, category='economy', gender_mode=None, **kw):
    """Host creates a ride (solo plan). gender_mode defaults from the host's toggle."""
    cat = CATEGORY[category]
    s1 = solo(host, early_max=cat['early'], price_factor=cat['price'], **kw)
    if s1 is None: return None
    if gender_mode is None:
        gender_mode = 'same' if host.get('same_gender_only', True) else 'mixed'
    return dict(riders=[host], first_shown={host['name']: s1['T0']}, share=up05(s1['fare'] / seats([host])),
                category=category, gender_mode=gender_mode, zone=zone(category, s1['km']), plan=s1)

def place_bucket(trips, open_rides, now, **kw):
    """Placement at the 12 h cutoff for one 15-min bucket (SPEC §3.19).
    trips: rider dicts (with category), in any order. Sorted by solo first pickup, then name.
    Each joins the OPEN ride with the most seats used that passes every rule (ties: earlier
    ride in the list), else hosts a new ride that later trips can join.
    Returns (rides, placement) where placement[name] = ride index, or None if unplaceable."""
    rides = list(open_rides); placement = {}
    def first_pickup(r):
        s1 = solo(r, price_factor=CATEGORY[r.get('category', 'economy')]['price'], **kw)
        return s1['T0'] if s1 else dt.datetime.max
    for r in sorted(trips, key=lambda r: (first_pickup(r), r['name'])):
        best = None
        for idx, ride in enumerate(rides):
            ok, _, p2, share = check_join(ride, r, now, **kw)
            if ok and (best is None or seats(ride['riders']) > seats(rides[best[0]]['riders'])):
                best = (idx, p2, share)
        if best:
            idx, p2, share = best; ride = rides[idx]
            ride['riders'].append(r); ride['share'] = share; ride['plan'] = p2
            for i, m in enumerate(ride['riders']):
                ride['first_shown'].setdefault(m['name'], p2['pick'][i])
            placement[r['name']] = idx
        else:
            ride = new_ride(r, r.get('category', 'economy'), **kw)
            if ride is None:
                placement[r['name']] = None; continue
            rides.append(ride); placement[r['name']] = len(rides) - 1
    return rides, placement

# ---------- Demand spots: k-means (SPEC §3.18) ----------
# mulberry32: tiny portable PRNG. The TS port must give identical numbers:
#   a = a + 0x6D2B79F5 | 0; t = Math.imul(a ^ a >>> 15, 1 | a);
#   t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296
M32 = 0xFFFFFFFF
def mulberry32(seed):
    a = seed & M32
    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = ((a ^ (a >> 15)) * (a | 1)) & M32
        t = ((t + (((t ^ (t >> 7)) * (t | 61)) & M32)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return rnd

DEMAND_REF = (32.5568, 35.8469)     # projection origin for local km (Irbid City Center)
DEMAND_SEED = 2026
SPOT_K_MAX, SPOT_MIN_POINTS, SPOT_WINDOW_MIN, SPOT_MAX_ITER = 5, 5, 60, 50
TIE_KM = 0.5
AREA = {'CC': 'City Center area', 'HS': 'Al-Hashmi area', 'US': 'University Street area',
        'YU': 'Yarmouk area', 'AM': 'Arabella area', 'JUST': 'JUST'}

def from_xy_km(xy, ref=DEMAND_REF):
    kx = 111.32 * math.cos(math.radians(ref[0])); ky = 110.57
    return (ref[0] + xy[1]/ky, ref[1] + xy[0]/kx)

def is_weekend(t): return t.weekday() in (4, 5)      # Fri/Sat (Python Mon=0)

def sample_history(seed=DEMAND_SEED, weeks=4, last_day=dt.datetime(2026, 11, 28)):
    """Synthetic pickups (lat, lng, time) for the demo. Sun-Thu 60/day (60% in 6:30-8:30),
    Fri/Sat 15/day, spread 6:00-22:00. Around the Irbid seed places, sigma 0.4 km.
    Deterministic: same seed -> same points (TS port uses the same PRNG and order of draws)."""
    rnd = mulberry32(seed)
    hot = [('US', 0.30), ('YU', 0.25), ('CC', 0.20), ('HS', 0.15), ('AM', 0.10)]
    def gauss():
        u1 = max(rnd(), 1e-12); u2 = rnd()
        return math.sqrt(-2*math.log(u1)) * math.cos(2*math.pi*u2)
    pts = []
    for d in range(weeks*7 - 1, -1, -1):
        day = (last_day - dt.timedelta(days=d)).replace(hour=0, minute=0)
        n = 15 if is_weekend(day) else 60
        for _ in range(n):
            r = rnd(); acc = 0.0; key = hot[-1][0]
            for k, w in hot:
                acc += w
                if r < acc: key = k; break
            if not is_weekend(day) and rnd() < 0.60:
                minute = 390 + int(rnd() * 120)          # 6:30-8:29
            else:
                minute = 360 + int(rnd() * 960)          # 6:00-21:59
            base = _xy_km(pt(key), DEMAND_REF)
            lat, lng = from_xy_km((base[0] + 0.4*gauss(), base[1] + 0.4*gauss()))
            pts.append((lat, lng, day + dt.timedelta(minutes=minute)))
    return pts

def kmeans(xy, k, seed=DEMAND_SEED, max_iter=SPOT_MAX_ITER):
    """k-means++ start (mulberry32), then Lloyd until no point changes cluster or max_iter.
    Ties go to the lower cluster index. Returns (centers, assignment)."""
    rnd = mulberry32(seed); n = len(xy)
    d2 = lambda a, b: (a[0]-b[0])**2 + (a[1]-b[1])**2
    centers = [xy[int(rnd() * n)]]
    while len(centers) < k:
        w = [min(d2(p, c) for c in centers) for p in xy]; tot = sum(w)
        if tot == 0: centers.append(xy[len(centers) % n]); continue
        r = rnd() * tot; acc = 0.0; pick = n - 1
        for i, wi in enumerate(w):
            acc += wi
            if acc >= r: pick = i; break
        centers.append(xy[pick])
    assign = [-1] * n
    for _ in range(max_iter):
        new = [min(range(k), key=lambda c: (d2(p, centers[c]), c)) for p in xy]
        if new == assign: break
        assign = new
        for c in range(k):
            mem = [xy[i] for i in range(n) if assign[i] == c]
            if mem: centers[c] = (sum(p[0] for p in mem)/len(mem), sum(p[1] for p in mem)/len(mem))
    return centers, assign

def demand_spots(points, driver_at, now, weeks=4):
    """SPEC §3.18. points: (lat, lng, time). Returns (spots, best, inside) where each spot is
    dict(center, area, points, radius_km, per_hour, km, min) sorted by km."""
    now_tod = now.hour*60 + now.minute
    win = [(la, lo) for la, lo, t in points
           if is_weekend(t) == is_weekend(now) and 0 <= (t.hour*60 + t.minute - now_tod) % 1440 < SPOT_WINDOW_MIN]
    k = min(SPOT_K_MAX, len(win) // SPOT_MIN_POINTS)
    if k == 0: return [], None, False
    xy = [_xy_km(p, DEMAND_REF) for p in win]
    centers, assign = kmeans(xy, k)
    uf = factors(now)[0]
    spots = []
    for c in range(k):
        mem = [xy[i] for i in range(len(xy)) if assign[i] == c]
        if len(mem) < SPOT_MIN_POINTS: continue
        dists = sorted(math.hypot(p[0]-centers[c][0], p[1]-centers[c][1]) for p in mem)
        center = from_xy_km(centers[c])
        area = AREA[min(AREA, key=lambda key: hav(center, pt(key)))]
        km = hav(driver_at, center) * CIRC_URBAN
        spots.append(dict(center=center, area=area, points=len(mem),
                          radius_km=dists[math.ceil(0.8*len(dists)) - 1],
                          per_hour=len(mem)/weeks, km=km, min=km/V_URBAN*60*uf,
                          straight_km=hav(driver_at, center)))
    spots.sort(key=lambda sp: (sp['km'], sp['area']))
    if not spots: return [], None, False
    best = spots[0]
    for sp in spots[1:]:
        if sp['km'] - spots[0]['km'] < TIE_KM and sp['points'] > best['points']: best = sp
    inside = best['straight_km'] <= best['radius_km']
    return spots, best, inside

def fmt(t): return t.strftime('%H:%M')

# ---------- Main ----------
if __name__ == '__main__':
    D = dt.datetime(2026, 11, 29)  # Sunday, workday (Amman local time)
    at = lambda h, m: D.replace(hour=h, minute=m)
    F = lambda name, p, by: dict(name=name, gender='F', p=p, d='JUST', by=by)

    print('=== §4.7 Golden: solo Irbid City Center -> JUST (Sunday) ===')
    for h, m in [(3, 0), (7, 30), (8, 0), (11, 0), (15, 0), (22, 0)]:
        s = solo(F('Lina', 'CC', at(h, m)))
        print(f"arrive {h:02d}:{m:02d}  pickup {fmt(s['T0'])}  trip {s['dur']:.0f} min  "
              f"km {s['km']}  fare {s['fare']:.2f}  rounded {up05(s['fare']):.2f}")

    # Test fixture (golden values): Rania arrive-by 8:15, as in v2/v3.
    FIX = [F('Lina', 'CC', at(8, 0)), F('Sara', 'US', at(8, 0)),
           F('Rania', 'HS', at(8, 15)), F('Dana', 'YU', at(8, 0))]
    print('\n=== §4.7 Golden: solo fare per seeded rider (fixture) ===')
    for r in FIX + [F('Noor', 'AM', at(8, 0))]:
        print(f"{r['name']:6} {up05(solo(r)['fare']):.2f}")

    print('\n=== §4.7 Golden: 4-rider fixture by condition ===')
    for label, kw in [('Normal', {}), ('Heavy', dict(level='heavy')), ('Jam', dict(level='jam')),
                      ('Rain', dict(weather='rain'))]:
        p = plan(FIX, **kw)
        print(f"{label:7} pickup {fmt(p['T0'])}  trip {p['dur']:.0f} min  fare {p['fare']:.2f}  "
              f"each {up05(p['fare']/4):.2f}  km {p['km']}")

    print('\n=== Rule 5: distance from seed pickups to the CC -> JUST anchor route ===')
    route = anchor_route('CC', 'JUST')
    for k in ['HS', 'US', 'YU', 'AM']:
        print(f"{k:4} {dist_point_polyline_km(pt(k), route):.1f} km")

    # ---- v5 demo scenario (SPEC §2.2 / §2.3). Clock paused at 6:10 for steps 1-4 ----
    print('\n=== v5 demo (SPEC §2.3) ===')
    lina, sara = F('Lina', 'CC', at(8, 0)), F('Sara', 'US', at(8, 0))
    rania, dana = F('Rania', 'HS', at(8, 5)), F('Dana', 'YU', at(8, 0))
    now = at(6, 10)

    p = solo(lina)
    ride = dict(riders=[lina], first_shown={'Lina': p['T0']}, share=up05(p['fare']))
    print(f"Lina creates       fare {p['fare']:.2f}  each {ride['share']:.2f}  pickup Lina {fmt(p['T0'])}")
    print('     host estimates: ' + ' · '.join(
        f"{k} riders {up05(p['fare']*a/k):.2f}" for k, a in [(1, 1.00), (2, 1.05), (3, 1.12), (4, 1.20)]))

    for j in [sara, rania, dana]:
        ok, reason, p2, share = check_join(ride, j, now)
        if not ok:
            print(f"{j['name']} REJECTED: {reason}"); continue
        ride['riders'].append(j); ride['share'] = share; p = p2
        ride['first_shown'][j['name']] = p['pick'][len(ride['riders'])-1]
        picks = ', '.join(f"{r['name']} {fmt(p['pick'][i])}" for i, r in enumerate(ride['riders']))
        print(f"{j['name']:6} joins       fare {p['fare']:.2f}  each {share:.2f}  "
              f"km {p['km']}  {p['dur']:.0f} min | {picks}")

    n = len(ride['riders'])
    locked = ride['share']
    names = [r['name'] for r in ride['riders']]
    print(f"Find driver -> pickups freeze. First pickup {fmt(p['T0'])}, "
          f"respond-by {fmt(p['T0'] - dt.timedelta(minutes=15))}")
    print(f"Omar accepts: fare {p['fare']:.2f}, collect {n*locked:.2f} ({n} x {locked:.2f})")

    sara_idx = names.index('Sara')
    fare3, share3, credit, late, frozen = leave(p, sara_idx, n, locked, at(6, 35))
    picks = ', '.join(f"{names[i]} {fmt(t)}" for i, t in sorted(frozen.items(), key=lambda x: x[1]))
    print(f"6:35 Sara leaves ({'LATE' if late else 'free'})  new fare {fare3:.2f}  each {share3:.2f}  "
          f"credit {credit:.2f} (held on the ride) | pickups unchanged: {picks}")
    print(f"Complete trip: Omar gets {(n-1)*share3:.2f} cash + {credit:.2f} credit = "
          f"{(n-1)*share3 + credit:.2f} (fare {fare3:.2f}, remainder {(n-1)*share3 + credit - fare3:.2f})")
    fare3f, share3f, _, _, _ = leave(p, sara_idx, n, locked, at(6, 20))
    print(f"(compare) free leave at 6:20: new fare {fare3f:.2f}  each {share3f:.2f}")

    # ---- v6-v8 extensions (SPEC §3.16-§3.19). Printed after the v5 block, which is unchanged ----
    print('\n=== v6 sync zones (SPEC §3.16): (pickup km, destination km) ===')
    for cat, L in [('economy', 19.3), ('economy', 85), ('comfort', 19.3), ('airport', 35), ('airport', 110)]:
        print(f"{cat:8} L {L:5}  zone {zone(cat, L)}")

    print('\n=== v6 rule 1 gender modes ===')
    male = dict(name='Omar2', gender='M', p='US', d='JUST', by=at(8, 0))
    base = lambda mode: dict(riders=[F('Lina', 'CC', at(8, 0))], first_shown={'Lina': at(7, 15)},
                             share=7.85, gender_mode=mode)
    for label, ride_mode, j in [('same ride, woman, toggle on ', 'same', F('Sara', 'US', at(8, 0))),
                                ('same ride, man, toggle off  ', 'same', dict(male, same_gender_only=False)),
                                ('mixed ride, woman, toggle on', 'mixed', F('Sara', 'US', at(8, 0))),
                                ('mixed ride, man, toggle off ', 'mixed', dict(male, same_gender_only=False))]:
        print(f"{label}  {'ok' if gender_ok(base(ride_mode), j) else 'blocked'}")

    print('\n=== v6 Comfort: same CC -> JUST at 8:00 (price x1.25) ===')
    rc = new_ride(F('Lina', 'CC', at(8, 0)), 'comfort')
    print(f"Comfort solo fare {rc['plan']['fare']:.2f}  each {rc['share']:.2f}  zone {rc['zone']}  "
          f"estimates " + ' · '.join(f"{k} {up05(rc['plan']['fare']*a/k):.2f}"
                                    for k, a in CATEGORY['comfort']['A'].items()))
    ok, reason, pc, sc = check_join(rc, dict(F('Sara', 'US', at(8, 0)), category='comfort'), now)
    print(f"Sara joins Comfort: {reason}" + (f"  fare {pc['fare']:.2f}  each {sc:.2f}" if ok else ''))

    print('\n=== v7 +1 (SPEC §3.17 A): Lina + Sara, then Sara adds a +1 (same stops) ===')
    r2 = new_ride(F('Lina', 'CC', at(8, 0)))
    ok, _, p2, sh2 = check_join(r2, F('Sara', 'US', at(8, 0)), now)
    r2['riders'].append(F('Sara', 'US', at(8, 0))); r2['share'] = sh2
    print(f"2 riders: fare {p2['fare']:.2f}  each {sh2:.2f}")
    r2['riders'][1]['guest'] = dict(name='Maya', gender='F')
    print(f"Sara +1 Maya: fare {p2['fare']:.2f} (no new stops)  each {up05(p2['fare']/seats(r2['riders'])):.2f}  "
          f"seats {seats(r2['riders'])}")

    print('\n=== v8 Uni plans (SPEC §3.19) ===')
    print(f"uni trip CC->JUST {is_uni_trip('CC', 'JUST')} · CC->AM {is_uni_trip('CC', 'AM')} · "
          f"YU->AM {is_uni_trip('YU', 'AM')}")
    print(f"discount: share 2.30 -> pays {uni_paid(2.30):.2f}, RideSync credit {2.30 - uni_paid(2.30):.2f} · "
          f"share 4.00 -> {uni_paid(4.00):.2f}")
    print('replacements: weekly ' + str(replacements('weekly', 4)) + ' · semester ' +
          ' · '.join(f"{n} rides -> {replacements('semester', n)}" for n in (26, 40, 52, 65, 80)))
    for mins, left in [(12*60, 1), (12*60 - 1, 1), (13*60, 0)]:
        print(f"cancel {mins//60}h{mins%60:02d} before, {left} left -> {cancel_planned(mins, left)}")
    mon = dt.datetime(2026, 11, 30)
    atm = lambda h, m: mon.replace(hour=h, minute=m)
    subs = [dict(name=nm, gender='F', p=pk, d='JUST', by=atm(8, 0), category='economy')
            for nm, pk in [('Huda', 'AM'), ('Maya', 'US'), ('Salma', 'HS'), ('Reem', 'CC'), ('Lama', 'YU')]]
    rides, placement = place_bucket(subs, [], atm(8, 0) - dt.timedelta(hours=12))
    print('placement Mon 8:00 bucket (run Sun 20:00): ' + ', '.join(f"{k}->ride {v}" for k, v in placement.items()))
    for i, rd in enumerate(rides):
        names_i = [m['name'] for m in rd['riders']]
        print(f"  ride {i}: {len(names_i)} riders {names_i}  fare {rd['plan']['fare']:.2f}  each {rd['share']:.2f}  "
              f"subscriber pays {uni_paid(rd['share']):.2f}  first pickup {fmt(rd['plan']['T0'])}")

    print('\n=== v7 demand spots (SPEC §3.18): sample history, Sun 6:30, driver at City Center ===')
    hist = sample_history()
    print(f"sample history: {len(hist)} points, first {hist[0][0]:.5f},{hist[0][1]:.5f} {hist[0][2]:%a %d %b %H:%M}")
    spots, best, inside = demand_spots(hist, pt('CC'), at(6, 30))
    for sp in spots:
        print(f"  {sp['area']:22} {sp['points']:3} pts  radius {sp['radius_km']:.2f} km  "
              f"{sp['per_hour']:.1f}/h  {sp['km']:.1f} km  ~{sp['min']:.0f} min")
    print(f"best: {best['area']} ({'inside, stay close' if inside else 'head there'})")
    spots2, best2, inside2 = demand_spots(hist, pt('AM'), dt.datetime(2026, 12, 4, 17, 0))
    print(f"Fri 17:00 from Arabella: {len(spots2)} spots, best {best2['area'] if best2 else None}")
