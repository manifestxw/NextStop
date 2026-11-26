"""
fare_model.py: reference model for SPEC.md v5.
Lives at docs/reference/fare_model.py. It is a SPEC, not app code: port it, don't import it.
Golden values = what this file prints. If SPEC.md disagrees, SPEC.md gets fixed.

Covers:
  - LTRC smart-app tariff + CALIBRATION (SPEC §4.1, §4.1.1, §4.4)
  - Fixed-table distances and traffic curve (§4.2.3, §4.3)
  - Stop-order score: fare in piastres + trip minutes + 0.01 x total in-car minutes (§3.6)
  - First pickup and effective arrive-by (§3.6, rule 7)
  - Matching rules 1, 2 and 4-11 (§3.5) for the demo scenario
  - Free and late leave with frozen pickup times (§3.6, §3.10, §4.5)
Not covered: rule 3 (ride state), rule 12, state machines, ready check, dispatch, chat,
credits paid at completion, Google/Snapshot sources.

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
def evaluate(stops, T0, **kw):
    """stops: list of (kind 'P'/'D', rider_index, place_key). Drives continuously from T0.
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
    fare = max(MIN_FARE, CALIBRATION * (tf['flag'] + km*tf['km'] + wait*tf['wait']))
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

def plan(riders, extra_ok=None, **kw):
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
        if any(drop[i] < riders[i]['by'] - dt.timedelta(minutes=EARLY_MAX) for i in drop):
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

def detour_cap(solo_incar): return max(solo_incar + 10, solo_incar * 1.4)

# ---------- Matching (SPEC §3.5) ----------
def check_join(ride, j, now, **kw):
    """ride: dict(riders=[host, ...], first_shown={name: time}, share=float).
    Returns (ok, reason, plan, share)."""
    riders = ride['riders']; host = riders[0]
    if any(r['gender'] != j['gender'] for r in riders):        return (False, 'rule 1 gender', None, None)
    if len(riders) >= MAX_RIDERS:                               return (False, 'rule 2 full', None, None)
    if abs((j['by'] - host['by']).total_seconds())/60 > ARRIVE_WINDOW_MIN:
                                                                return (False, 'rule 4 arrive-by', None, None)
    d_pick = min(hav(pt(j['p']), pt(host['p'])),
                 dist_point_polyline_km(pt(j['p']), anchor_route(host['p'], host['d'])))
    if d_pick > PICKUP_RADIUS_KM:                               return (False, 'rule 5 pickup far', None, None)
    if hav(pt(j['d']), pt(host['d'])) > DEST_RADIUS_KM:         return (False, 'rule 6 destination far', None, None)

    new = riders + [j]
    solo_incar = {i: solo(r, **kw)['incar'][0] for i, r in enumerate(new)}
    def ok_8_9(res):
        if any(res['incar'][i] > detour_cap(solo_incar[i]) + 1e-9 for i in res['incar']):
            return False                                        # rule 8 detour cap
        for i, r in enumerate(riders):
            if (ride['first_shown'][r['name']] - res['pick'][i]).total_seconds()/60 > PICKUP_SHIFT_MAX:
                return False                                    # rule 9 pickup shift
        return True
    p = plan(new, extra_ok=ok_8_9, **kw)
    if p is None:                                               return (False, 'rules 7-9 no valid stop order', None, None)
    share = up05(p['fare'] / len(new))
    if share > ride['share'] + 1e-9:                            return (False, 'rule 10 share goes up', None, None)
    if share >= up05(solo(j, **kw)['fare']):                    return (False, 'rule 10 not cheaper than solo', None, None)
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
