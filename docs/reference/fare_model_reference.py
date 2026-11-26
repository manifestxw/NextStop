import math, itertools, datetime as dt

# ---------- Locations (approx coords, verify pins) ----------
LOC = {
 'CC':  ('Irbid City Center',   32.5568, 35.8469),
 'HS':  ('Al-Hashmi Street',    32.5520, 35.8640),
 'US':  ('University Street',   32.5440, 35.8570),
 'YU':  ('Yarmouk University',  32.5366, 35.8556),
 'AM':  ('Arabella Mall',       32.5290, 35.8660),
 'JUST':('JUST',                32.47889, 35.98500),
}
EXIT = (32.5200, 35.8900)   # Irbid -> Ramtha road exit node
CIRC_URBAN, CIRC_HW = 1.35, 1.15
V_URBAN, V_HW = 30.0, 70.0  # free-flow km/h

def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(d))

def xy(k): return (LOC[k][1], LOC[k][2])

def leg_km(a, b):
    """returns (urban_km, highway_km)"""
    if a == b: return (0.0, 0.0)
    if 'JUST' in (a, b):
        o = b if a == 'JUST' else a
        return (round(hav(xy(o), EXIT)*CIRC_URBAN, 1), round(hav(EXIT, xy('JUST'))*CIRC_HW, 1))
    return (round(hav(xy(a), xy(b))*CIRC_URBAN, 1), 0.0)

# ---------- Traffic ----------
# weekday (Sun-Thu) anchor points: hour -> (urban, highway); linear between anchors
ANCHORS = [(0,1.00,1.00),(5,1.00,1.00),(6,1.15,1.05),(7,1.55,1.20),(7.5,1.75,1.30),(8,1.75,1.30),
           (9,1.40,1.15),(11,1.30,1.10),(13,1.45,1.15),(14.5,1.60,1.20),(16,1.50,1.15),
           (18,1.45,1.15),(20,1.20,1.05),(22,1.05,1.00),(24,1.00,1.00)]
LEVEL = {'normal':1.0, 'heavy':1.2, 'jam':1.5}
WEATHER = {'clear':1.0, 'rain':1.15}
def base_factors(h):
    for (h0,u0,w0),(h1,u1,w1) in zip(ANCHORS, ANCHORS[1:]):
        if h0 <= h <= h1:
            f=(h-h0)/(h1-h0); return u0+(u1-u0)*f, w0+(w1-w0)*f
    return 1.0,1.0
def factors(t, level='normal', weather='clear'):
    u, hw = base_factors(t.hour + t.minute/60 + t.second/3600)
    if t.weekday() in (4,5):  # Fri, Sat: half the congestion
        u, hw = 1+(u-1)*0.5, 1+(hw-1)*0.5
    m = LEVEL[level]*WEATHER[weather]
    return u*m, hw*m

def leg_min(a, b, t, **kw):
    u, hw = leg_km(a, b)
    fu, fh = factors(t, **kw)
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
    """stops: list of (kind, rider, loc). returns dict with times etc."""
    t = T0; km = 0.0; wait = 0.0; free = 0.0; times = []; prev = None
    for kind, r, loc in stops:
        if prev is not None:
            m = leg_min(prev, loc, t, **kw); f = leg_free(prev, loc)
            u, hw = leg_km(prev, loc); km += u+hw
            wait += (m-f); free += f
            t += dt.timedelta(minutes=m)
        times.append(t)
        d = DWELL_PICK if kind == 'P' else DWELL_DROP
        wait += d
        t += dt.timedelta(minutes=d)
        prev = loc
    tf = tariff(T0)
    fare = max(MIN_FARE, tf['flag'] + km*tf['km'] + wait*tf['wait'])
    return dict(times=times, km=round(km,1), wait=wait, end=t, fare=round(fare,2),
                dur=(t-T0).total_seconds()/60)

BUFFER = 5  # minutes slack before arrive-by
EARLY_MAX = 25  # never drop a rider more than 25 min before their arrive-by

def detour_cap(solo_incar):
    return max(solo_incar + 10, solo_incar*1.4)

def plan(riders, **kw):
    """riders: list of dict(name, p, d, by). brute-force stop orders."""
    best = None
    n = len(riders)
    events = [('P',i) for i in range(n)] + [('D',i) for i in range(n)]
    seen = set()
    for perm in itertools.permutations(events):
        ok = True; picked = set()
        for k,i in perm:
            if k=='P': picked.add(i)
            elif i not in picked: ok=False; break
        if not ok or perm[0][0] != 'P': continue
        stops = [(k, i, riders[i]['p'] if k=='P' else riders[i]['d']) for k,i in perm]
        key = tuple((k,s) for k,_,s in stops) + tuple(perm)
        # fixed-point for T0 (latest feasible first pickup)
        T0 = min(r['by'] for r in riders) - dt.timedelta(minutes=60)
        for _ in range(6):
            ev = evaluate(stops, T0, **kw)
            slack = min((riders[i]['by'] - dt.timedelta(minutes=BUFFER)) - ev['times'][j]
                        for j,(k,i,_) in enumerate(stops) if k=='D')
            T0 = T0 + slack
        def feasible(T):
            e = evaluate(stops, T, **kw)
            return e, all(e['times'][j] <= riders[i]['by'] - dt.timedelta(minutes=BUFFER) + dt.timedelta(seconds=1)
                       for j,(k,i,_) in enumerate(stops) if k=='D')
        T0 = T0.replace(second=0, microsecond=0) + dt.timedelta(minutes=1)
        for _ in range(40):
            ev, feas = feasible(T0)
            if feas: break
            T0 -= dt.timedelta(minutes=1)
        if not feas: continue
        if any(ev['times'][j] < riders[i]['by'] - dt.timedelta(minutes=EARLY_MAX)
               for j,(k,i,_) in enumerate(stops) if k=='D'):
            continue
        # in-car time per rider
        incar = {}
        for j,(k,i,_) in enumerate(stops):
            incar.setdefault(i, {})[k] = ev['times'][j]
        ic = {i:(v['D']-v['P']).total_seconds()/60 for i,v in incar.items()}
        score = ev['fare']*100 + ev['dur'] + 0.01*sum(ic.values())
        if best is None or score < best[0]:
            best = (score, stops, T0, ev, ic)
    if best is None: return None
    _, stops, T0, ev, ic = best
    pick = {i: ev['times'][j] for j,(k,i,_) in enumerate(stops) if k=='P'}
    drop = {i: ev['times'][j] for j,(k,i,_) in enumerate(stops) if k=='D'}
    return dict(stops=stops, T0=T0, fare=ev['fare'], km=ev['km'], dur=ev['dur'],
                incar=ic, pick=pick, drop=drop, wait=ev['wait'])

def solo(r, **kw): return plan([r], **kw)
def fmt(t): return t.strftime('%H:%M')

# ---------- Demo scenario (reproduces SPEC.md §2.3 / §4.7) ----------
if __name__ == '__main__':
    D = dt.datetime(2026, 11, 29)  # Sunday, workday
    by = lambda h, m: D.replace(hour=h, minute=m)
    R = {'Lina': dict(name='Lina', p='CC', d='JUST', by=by(8, 0)),
         'Sara': dict(name='Sara', p='US', d='JUST', by=by(8, 0)),
         'Rania': dict(name='Rania', p='HS', d='JUST', by=by(8, 15)),
         'Dana': dict(name='Dana', p='YU', d='JUST', by=by(8, 0)),
         'Noor': dict(name='Noor', p='AM', d='JUST', by=by(8, 0))}
    for names, fee in [(['Lina'], 0), (['Lina', 'Sara'], 0), (['Lina', 'Sara', 'Rania'], 0),
                       (['Lina', 'Sara', 'Rania', 'Dana'], 0), (['Lina', 'Rania', 'Dana'], 1.0),
                       (['Lina', 'Rania', 'Dana', 'Noor'], 1.0)]:
        p = plan([R[n] for n in names])
        share = up05((p['fare'] - fee) / len(names))
        picks = ', '.join(f"{n} {fmt(p['pick'][i])}" for i, n in enumerate(names))
        print(f"{'+'.join(names):28} fare {p['fare']:.2f}  each {share:.2f}  km {p['km']}  {p['dur']:.0f} min  | {picks}")
