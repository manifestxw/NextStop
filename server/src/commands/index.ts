// One function per user action (ARCH §7). Each: auth → prepare (reads + travel data, OUTSIDE the lock)
// → commit (inside store.withLock: re-read, version check, pure rules, write) → publish views after the lock.
// HTTP (T7) maps ConflictError → 409, LoggedOutError → 401, zod failures → 422.
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { normalizePhone } from '../domain/phone.js';
import type { AuthResponse, CategoryQuote, ChatMessageView, DemoView, MatchCard, QuoteView, View, req } from '@nextstop/shared';
import type { z } from 'zod';
import { ammanParts, fromIso, toIso } from '../clock/amman.js';
import type { Clock } from '../clock/clock.js';
import type { Config } from '../config.js';
import { ACTIVE_MEMBER, activeMembers, cashDueP, jod, lastDropUs, piastres, points, riderIn, seatsOf } from '../domain/bridge.js';
import { maskChat } from '../domain/chat.js';
import { applyEffects, newEffects, system, type Effects } from '../domain/effects.js';
import { ConflictError, LoggedOutError, illegal } from '../domain/errors.js';
import * as rides from '../domain/rides.js';
import { ACTIVE_STATES, type Member, type PlannedTrip, type Place, type Ride, type Subscription, type User } from '../domain/types.js';
import { checkJoin, type RideIn } from '../engine/matching.js';
import { plan, solo } from '../engine/plan.js';
import { hav } from '../engine/geo.js';
import { up05 } from '../engine/pyRound.js';
import { floorMinute, US_PER_MIN } from '../engine/time.js';
import type { Plan, Us } from '../engine/types.js';
import { CATEGORY, zone } from '../engine/zone.js';
import { cancelOutcome, isTestCard, replacementsFor, SEMESTER_WEEK_PRICE_P, UNI_RADIUS_KM, uniPaid, WEEKLY_PRICE_P } from '../engine/uni.js';
import { planDates, SEMESTER_END } from '../domain/plans.js';
import type { Publisher } from '../realtime/publisher.js';
import { SIM_ORDER, simShouldAnswer } from '../sim/simRiders.js';
import type { Repo, Store } from '../store/repo.js';
import { loadSeed, resetToSeed } from '../store/seed.js';
import { selectProvider, travelOffline } from '../travel/select.js';
import { nearestPlace, reverseGeocode, searchPlaces } from '../travel/google.js';
import { areaFor, pinName } from '../travel/places.js';
import { CASTS, describeRide, scriptFor, type Scenario } from './script.js';

export interface PlaceResult { key?: string; placeId: string; name: string; address: string; area: string; lat: number; lng: number }
import { toTimed, type MatrixSpec } from '../travel/provider.js';
import { chatView, clockView } from '../views/common.js';
import { driverView } from '../views/driverView.js';
import { placeView, riderView } from '../views/riderView.js';

export interface Ctx {
  store: Store; clock: Clock; cfg: Config; publisher: Publisher; realNowMs: () => number;
  places?: Place[];   // seed places; tests pass the fixed-table points so golden numbers don't depend on seed.json
}

type Body<T extends z.ZodType> = z.input<T>;
interface Trip { pickup: Place; dest: Place; arriveBy: string; by: Us; category: Ride['category']; sameGenderOnly: boolean }

const MIN = US_PER_MIN, HOUR = 60 * MIN;
const RETRY = Symbol('retry');
const isAirport = (p: Place) => p.key === 'QAIA' || /queen alia/i.test(p.name);
const CAMPUSES = ['JUST', 'YU'];

/** Engine reason → the user-facing message (SPEC §3.5). Rule 2 is its own code. */
function ruleError(reason: string): ConflictError {
  if (reason === 'rule 2 full') return new ConflictError('RIDE_FULL');
  const msg: Record<string, string> = {
    'rule 1 gender': "This ride isn't available to you",
    'rule 1 category': 'This ride is a different category',
    'rule 4 arrive-by': "Your arrive-by time is too far from this ride's",
    'rule 5 pickup far': "Your pickup is outside this ride's sync zone",
    'rule 6 destination far': "Your destination is too far from this ride's",
    'rules 7-9 no valid stop order': "This ride can't fit your trip on time",
    'rule 10 share goes up': "Joining would raise the others' shares",
    'rule 10 not cheaper than solo': 'Your share would be higher than riding solo',
    'rule 11 too late to join': 'Too late to join this ride',
  };
  return new ConflictError('NOT_ELIGIBLE', msg[reason] ?? reason);
}

const lastDrop = (p: Plan) => Math.max(...Object.values(p.drop));

export function createCommands(ctx: Ctx) {
  const { store, clock, cfg, publisher } = ctx;
  const seedPlaces = ctx.places ?? loadSeed().places;
  const campuses = seedPlaces.filter((p) => CAMPUSES.includes(p.key ?? ''));
  const pf = (category: Ride['category']) => cfg.calibration * CATEGORY[category].price;

  // ---------- plumbing ----------

  const demo = () => store.withLock(async (r) => (await r.getDemoState())!);

  async function auth(token: string, role?: User['role']): Promise<User> {
    const u = await store.withLock(async (r) => {
      const [user, d] = [await r.getUserByToken(token), await r.getDemoState()];
      return user && d && user.epoch === d.epoch ? user : null;
    });
    if (!u) throw new LoggedOutError();
    if (role && u.role !== role) throw illegal(`Only ${role}s can do that`);
    return u;
  }

  function resolvePlace(ref: Body<typeof req.PlaceRef>): Place {
    if ('key' in ref) {
      const p = seedPlaces.find((x) => x.key === ref.key);
      if (!p) throw new ConflictError('NOT_ELIGIBLE', 'Unknown place');
      return p;
    }
    // The area others see comes from the server: what it computed when it returned this place, else the nearest seed area.
    const k = knownPlaces.get(ref.placeId);
    const area = k && hav(k, ref) < 0.05 ? k.area : areaFor(ref, [], seedPlaces);
    return { placeId: ref.placeId, name: ref.name, area, lat: ref.lat, lng: ref.lng };
  }

  // Places this server returned from search or a pin (P1): placeId → public area. In memory, capped.
  const knownPlaces = new Map<string, { area: string; lat: number; lng: number }>();
  function remember<T extends { placeId: string; area: string; lat: number; lng: number }>(p: T): T {
    if (knownPlaces.size > 5000) knownPlaces.delete(knownPlaces.keys().next().value!);
    knownPlaces.set(p.placeId, { area: p.area, lat: p.lat, lng: p.lng });
    return p;
  }

  function tripOf(b: Body<typeof req.TripBody>): Trip {
    const dest = resolvePlace(b.dest);
    // A destination at the airport always means Airport (SPEC §3.4); Airport needs the airport.
    if (b.category === 'airport' && !isAirport(dest)) throw new ConflictError('NOT_ELIGIBLE', 'Airport rides go to Queen Alia Airport');
    return { pickup: resolvePlace(b.pickup), dest, arriveBy: toIso(fromIso(b.arriveBy)), by: fromIso(b.arriveBy),
      category: isAirport(dest) ? 'airport' : b.category, sameGenderOnly: b.sameGenderOnly };
  }

  async function fetchMatrix(members: Pick<Member, 'pickup' | 'dest'>[], departure: Us): Promise<MatrixSpec> {
    const s = (await demo()).settings;
    return selectProvider(s.source).getMatrix(points(members), departure, { level: s.traffic, weather: s.weather });
  }

  /** Road route through stops in order, for the driver's map (P1). Outside the lock: it may call Google. */
  async function routeThrough(stops: Ride['plan']['stops'], departure: Us) {
    const s = (await demo()).settings;
    const pts = stops.map((x) => ({ lat: x.place.lat, lng: x.place.lng }));
    return pts.length >= 2 ? selectProvider(s.source).getRoute(pts, departure) : undefined;
  }

  async function viewFor(repo: Repo, u: User, epoch: number): Promise<View> {
    if (u.role === 'driver') return driverView(repo, u, (await repo.getDriver(u.id))!, clock, epoch);
    return riderView(repo, u, clock, epoch);
  }

  /** Project fresh views (viewSeq + 1, inside the lock), push to everyone but the caller, return the caller's. */
  async function publish(ids: Iterable<string>, callerId?: string): Promise<View | undefined> {
    const views = await store.withLock(async (repo) => {
      const d = (await repo.getDemoState())!;
      const out: [string, View][] = [];
      for (const id of new Set(ids)) {
        const u = await repo.getUser(id);
        if (!u || u.epoch !== d.epoch || (u.isSim && !u.seedLogin && id !== callerId)) continue;   // sims have no phone (Noor can be opened on one)
        const next = { ...u, viewSeq: u.viewSeq + 1 };
        await repo.putUser(next);
        out.push([id, await viewFor(repo, next, d.epoch)]);
      }
      return out;
    });
    let mine: View | undefined;
    for (const [id, v] of views) { if (id === callerId) mine = v; else publisher.view(id, v); }
    return mine;
  }

  /** Run `fn` + its effects in one locked transaction, then push chat events and views. */
  async function commit(callerId: string | undefined, fn: (repo: Repo, fx: Effects) => Promise<void>): Promise<View> {
    const fx = newEffects();
    const chats: [string, ChatMessageView][] = [];
    await store.withLock(async (repo) => {
      await fn(repo, fx);
      await applyEffects(repo, fx, clock.now());
      for (const m of fx.created) {
        const ride = await repo.getRide(m.rideId);
        const users = new Map<string, User>();
        for (const x of ride?.members ?? []) { const u = await repo.getUser(x.userId); if (u) users.set(u.id, u); }
        const to = m.channel.startsWith('driver:') ? [m.channel.slice(7), ride?.driverUserId ?? ''] : (ride ? activeMembers(ride) : []).map((x) => x.userId);
        for (const id of to) if (id) chats.push([id, chatView(m, users)]);
      }
    });
    for (const [id, m] of chats) publisher.chat(id, m);
    // With a caller there is always a view; system commits (tick) ignore the result.
    return (await publish([...fx.touched, ...(callerId ? [callerId] : [])], callerId)) as View;
  }
  const myView = async (userId: string) => (await publish([userId], userId))!;

  const usersOf = async (repo: Repo, ids: string[]) => {
    const m = new Map<string, User>();
    for (const id of ids) { const u = await repo.getUser(id); if (u) m.set(id, u); }
    return m;
  };

  /** Rule 12: every affected rider keeps ≥ 15 min between this booking and their other active ones. */
  async function assertFree(repo: Repo, userIds: string[], start: Us, end: Us, excludeRideId?: string) {
    for (const u of userIds) {
      for (const r of await repo.listRidesForUser(u)) {
        if (r.id === excludeRideId || !ACTIVE_STATES.includes(r.state)) continue;
        const m = r.members.find((x) => x.userId === u);
        if (!m || !ACTIVE_MEMBER.includes(m.state)) continue;
        const s = fromIso(r.plan.firstPickup), e = lastDropUs(r.plan);
        if (!(e + 15 * MIN <= start || end + 15 * MIN <= s)) throw new ConflictError('ALREADY_IN_RIDE');
      }
    }
  }

  /** A subscriber on a uni ride (own pickup or destination at a campus) pays 80% (SPEC §3.19). */
  async function uniFor(repo: Repo, userId: string, t: Pick<Trip, 'pickup' | 'dest' | 'by'>): Promise<boolean> {
    const sub = await repo.getSubscription(userId);
    if (!sub || t.by > fromIso(sub.end) || clock.now() > fromIso(sub.end)) return false;
    return isUniTrip(t.pickup, t.dest);
  }
  const plannedFrom = (sub: Subscription, userId: string, x: Trip, isReplacement: boolean): PlannedTrip => ({
    id: randomUUID(), subscriptionId: sub.id, userId, pickup: x.pickup, dest: x.dest, arriveBy: x.arriveBy,
    category: x.category === 'comfort' ? 'comfort' : 'economy', sameGenderOnly: x.sameGenderOnly, state: 'PLANNED', isReplacement,
  });
  const isUniTrip = (a: Place, b: Place) => campuses.some((c) => hav(a, c) <= UNI_RADIUS_KM || hav(b, c) <= UNI_RADIUS_KM);

  const rideIn = (ride: Ride, active: Member[], order: string[], users: Map<string, User>): RideIn => ({
    riders: active.map((x) => riderIn(x, order, users.get(x.userId)!, ride)),
    firstShown: Object.fromEntries(active.map((x) => [x.userId, fromIso(x.firstShownPickup)])),
    share: jod(ride.plan.shareP), anchorRoute: ride.anchor.route, category: ride.category, genderMode: ride.genderMode,
    zone: [ride.zone.pickupKm, ride.zone.destKm],
  });

  // ---------- joining (shared by riders and "Simulate rider") ----------

  async function joinAs(user: User, rideId: string, t: Trip, inviteId?: string): Promise<View> {
    for (let attempt = 0; ; attempt++) {
      const snap = await store.withLock((r) => r.getRide(rideId));
      if (!snap || !ACTIVE_STATES.includes(snap.state)) throw new ConflictError('RIDE_GONE');
      if (activeMembers(snap).some((m) => m.userId === user.id)) return myView(user.id);   // double tap
      if (snap.state !== 'OPEN') throw new ConflictError('RIDE_CLOSED');
      const cand = rides.newMember(user.id, t.pickup, t.dest, t.arriveBy, clock.now(), 0, 0);
      const spec = await fetchMatrix([...activeMembers(snap), cand], fromIso(snap.plan.firstPickup));
      try {
        return await commit(user.id, async (repo, fx) => {
          const ride = await repo.getRide(rideId);
          if (!ride || !ACTIVE_STATES.includes(ride.state)) throw new ConflictError('RIDE_GONE');
          if (ride.version !== snap.version) throw RETRY;
          if (ride.state !== 'OPEN') throw new ConflictError('RIDE_CLOSED');
          const active = activeMembers(ride);
          const order = [...active.map((x) => x.userId), user.id];
          const users = await usersOf(repo, order);
          const me = { ...users.get(user.id)!, sameGenderOnly: t.sameGenderOnly };
          const m = toTimed(spec);
          const jIn = riderIn(cand, order, me, { category: t.category });
          const res = checkJoin(m, rideIn(ride, active, order, users), jIn, clock.now(), cfg.calibration);
          if (!res.ok) throw ruleError(res.reason);
          const s = solo(m, jIn, { earlyMax: CATEGORY[ride.category].early, priceFactor: pf(ride.category) })!;
          cand.soloFareP = piastres(up05(s.fare));
          cand.soloInCarMin = s.incar[0]!;
          cand.uniDiscount = (await uniFor(repo, user.id, t)) || undefined;
          const members = [...active, cand];
          await assertFree(repo, order, res.plan!.T0, lastDrop(res.plan!), ride.id);
          ride.members.push(cand);
          rides.applyPlan(ride, res.plan!, members, piastres(res.share!), fx);
          cand.firstShownPickup = cand.shownPickup;
          ride.version++;
          const inv = inviteId ? await repo.getInvite(inviteId) : null;
          if (inv && inv.toUserId === user.id && inv.rideId === ride.id && inv.state === 'PENDING') {
            await repo.putInvite({ ...inv, state: 'USED' });
            cand.invitedBy = inv.fromUserId;
            const from = (await repo.getUser(inv.fromUserId))?.firstName ?? 'a friend';
            system(fx, ride.id, `${user.firstName} joined (invited by ${from})`);
          } else system(fx, ride.id, `${user.firstName} joined`);
          for (const x of ride.members) fx.touched.add(x.userId);
          await repo.putRide(ride);
          await repo.putUser({ ...me, viewSeq: users.get(user.id)!.viewSeq });
        });
      } catch (e) {
        if (e === RETRY && attempt === 0) continue;
        if (e === RETRY) throw new ConflictError('RIDE_FULL');
        throw e;
      }
    }
  }

  /** What joining this ride would look like for this rider (search cards, invite previews). Read-only. */
  async function cardFor(user: User, ride: Ride, t: Trip): Promise<{ card: MatchCard } | { reason: string }> {
    const active = activeMembers(ride);
    const cand = rides.newMember(user.id, t.pickup, t.dest, t.arriveBy, clock.now(), 0, 0);
    const order = [...active.map((x) => x.userId), user.id];
    const users = await store.withLock((repo) => usersOf(repo, order));
    const me = { ...user, sameGenderOnly: t.sameGenderOnly };
    users.set(user.id, me);
    const m = toTimed(await fetchMatrix([...active, cand], fromIso(ride.plan.firstPickup)));
    const res = checkJoin(m, rideIn(ride, active, order, users), riderIn(cand, order, me, { category: t.category }), clock.now(), cfg.calibration);
    if (!res.ok) return { reason: res.reason };
    const seatsUsed = active.reduce((n, x) => n + seatsOf(x), 0);
    return { card: {
      rideId: ride.id, hostFirstName: users.get(ride.hostUserId)?.firstName ?? '?',
      category: ride.category, genderMode: ride.genderMode, gender: ride.gender,
      seats: active.flatMap((x) => {
        const s = { initials: (users.get(x.userId)?.firstName ?? '?')[0]!.toUpperCase(), isGuest: false };
        return x.guest && !x.guest.leave ? [s, { initials: x.guest.firstName[0]!.toUpperCase(), isGuest: true }] : [s];
      }),
      seatsLeft: CATEGORY[ride.category].maxRiders - seatsUsed,
      pickupArea: ride.anchor.pickup.area, destArea: ride.anchor.dest.area,
      effectiveArriveBy: [...active.map((x) => x.arriveBy), t.arriveBy].sort()[0]!,
      myPickupAt: toIso(res.plan!.pick[active.length]!), eachJod: res.share!,
      myPaysJod: (await store.withLock((repo) => uniFor(repo, user.id, t))) ? uniPaid(res.share!) : res.share!,
    } };
  }

  /** An invited friend's trip: their own pickup, the ride's destination, arrive-by and category (SPEC §3.17 B). */
  async function inviteTrip(user: User, inviteId: string, b: Body<typeof req.InviteAcceptBody>) {
    const { inv, ride } = await store.withLock(async (repo) => {
      const inv = await repo.getInvite(inviteId);
      return { inv, ride: inv ? await repo.getRide(inv.rideId) : null };
    });
    if (!inv || inv.toUserId !== user.id || inv.state !== 'PENDING' || !ride || ride.state !== 'OPEN') throw new ConflictError('RIDE_GONE');
    const arriveBy = activeMembers(ride).map((m) => m.arriveBy).sort()[0] ?? ride.anchor.arriveBy;
    const trip: Trip = { pickup: resolvePlace(b.pickup), dest: ride.anchor.dest, arriveBy, by: fromIso(arriveBy), category: ride.category, sameGenderOnly: b.sameGenderOnly };
    return { inv, ride, trip };
  }

  async function postChat(user: User, rideId: string, text: string) {
    return commit(user.id, async (repo, fx) => {
      const ride = await repo.getRide(rideId);
      if (!ride || !activeMembers(ride).some((m) => m.userId === user.id)) throw new ConflictError('RIDE_GONE');
      if (!ACTIVE_STATES.includes(ride.state)) throw illegal('This chat is closed');
      fx.messages.push({ rideId, channel: 'group', kind: 'user', fromUserId: user.id, text: maskChat(text.trim()) });
      for (const m of activeMembers(ride)) fx.touched.add(m.userId);
    });
  }

  /** Create a ride as this user (host). Used by riders and by Uni plan placement. Returns the new ride id. */
  async function createAs(user: User, t: Trip, { placement = false } = {}): Promise<{ view: View; rideId: string }> {
    const cand = rides.newMember(user.id, t.pickup, t.dest, t.arriveBy, clock.now(), 0, 0);
    const settings = (await demo()).settings;
    const provider = selectProvider(settings.source);
    const m = toTimed(await provider.getMatrix(points([cand]), t.by - HOUR, { level: settings.traffic, weather: settings.weather }));
    const cat = CATEGORY[t.category];
    const s = solo(m, riderIn(cand, [user.id], user, { category: t.category }), { earlyMax: cat.early, priceFactor: pf(t.category) });
    if (!s) throw new ConflictError('NOT_ELIGIBLE', "We couldn't plan this trip");
    const now = clock.now();
    if (s.T0 < now + HOUR) throw new ConflictError('TOO_SOON');
    // Placement skips the 24 h window (SPEC §3.19): planned rides are placed early on purpose.
    if (!placement && s.T0 > now + 24 * HOUR) throw new ConflictError('NOT_ELIGIBLE', 'Shared rides can be planned up to 24 hours ahead');
    const route = await provider.getRoute([t.pickup, t.dest], s.T0);
    const [zp, zd] = zone(t.category, s.km);
    let rideId = '';
    const view = await commit(user.id, async (repo, fx) => {
      await assertFree(repo, [user.id], s.T0, lastDrop(s));
      cand.soloFareP = piastres(up05(s.fare));
      cand.soloInCarMin = s.incar[0]!;
      const ride: Ride = {
        id: randomUUID(), version: 0, state: 'OPEN', hostUserId: user.id, gender: user.gender,
        category: t.category, genderMode: t.sameGenderOnly ? 'same' : 'mixed', zone: { pickupKm: zp, destKm: zd },
        anchor: { pickup: t.pickup, dest: t.dest, arriveBy: t.arriveBy, route, km: s.km },
        members: [cand], plan: { stops: [], firstPickup: '', km: 0, durMin: 0, fareJod: 0, shareP: 0, inCarMin: {} },
        creditsP: 0, createdAt: toIso(clock.now()),
      };
      rides.applyPlan(ride, s, [cand], cand.soloFareP);
      cand.firstShownPickup = cand.shownPickup;
      cand.uniDiscount = (await uniFor(repo, user.id, t)) || undefined;
      rideId = ride.id;
      await repo.putRide(ride);
      const fresh = (await repo.getUser(user.id))!;
      await repo.putUser({ ...fresh, sameGenderOnly: t.sameGenderOnly });
      fx.touched.add(user.id);
    });
    return { view, rideId };
  }

  // ---------- leaving ----------

  async function leaveAs(user: User, rideId: string, acceptCharge: boolean) {
    for (let attempt = 0; ; attempt++) {
      const snap = await store.withLock((r) => r.getRide(rideId));
      if (!snap || !ACTIVE_STATES.includes(snap.state)) throw new ConflictError('RIDE_GONE');
      if (!activeMembers(snap).some((m) => m.userId === user.id)) return myView(user.id);
      if (snap.members.some((m) => m.userId === user.id && m.state === 'PICKED_UP')) throw illegal("You're already in the car. The ride ends when you're dropped off.");
      const active = activeMembers(snap), rest = active.filter((m) => m.userId !== user.id);
      let spec: MatrixSpec | null = null, route: Ride['anchor']['route'] | null = null, order: string[];
      if (snap.state === 'OPEN') {
        order = rest.map((m) => m.userId);
        if (rest.length) spec = await fetchMatrix(rest, fromIso(snap.plan.firstPickup));
        if (rest.length && snap.hostUserId === user.id) {
          const s = (await demo()).settings;
          route = await selectProvider(s.source).getRoute([rest[0]!.pickup, rest[0]!.dest], fromIso(snap.plan.firstPickup));
        }
      } else {
        order = snap.locked?.order ?? active.map((m) => m.userId);
        spec = snap.locked?.matrix ?? await fetchMatrix(active, fromIso(snap.plan.firstPickup));
        if (snap.driverUserId) route = (await routeThrough(snap.plan.stops.filter((x) => x.userId !== user.id), fromIso(snap.plan.firstPickup))) ?? null;
      }
      try {
        return await commit(user.id, async (repo, fx) => {
          const ride = await repo.getRide(rideId);
          if (!ride || ride.version !== snap.version) throw RETRY;
          const now = clock.now();
          if (ride.state === 'OPEN') {
            if (!rest.length) {
              rides.leaveOpen(ride, user.id, user.firstName, now, fx, null);
              await repo.putRide(ride);
              return;
            }
            const m = toTimed(spec!);
            const users = await usersOf(repo, order);
            const restIn = rest.map((x) => riderIn(x, order, users.get(x.userId)!, ride));
            const opts = { earlyMax: CATEGORY[ride.category].early, priceFactor: pf(ride.category) };
            const p = plan(m, restIn, opts);
            if (!p) throw illegal("The remaining riders can't be planned");
            const seats = rest.reduce((n, x) => n + seatsOf(x), 0);
            const shareP = piastres(up05(Math.max(0, p.fare - jod(ride.creditsP)) / seats));
            const anchor = route ? { pickup: rest[0]!.pickup, dest: rest[0]!.dest, arriveBy: rest[0]!.arriveBy, route,
              km: solo(m, restIn[0]!, opts)!.km } : undefined;
            rides.leaveOpen(ride, user.id, user.firstName, now, fx, { plan: p, members: rest, shareP, anchor });
          } else {
            if (rides.isLateNow(ride, now) && !acceptCharge) {
              const mine = activeMembers(ride).find((x) => x.userId === user.id)!;
              throw new ConflictError('LATE_CONFIRM_REQUIRED', undefined, { chargeJod: jod(ride.plan.shareP * seatsOf(mine)) });
            }
            rides.leaveFrozen(ride, user.id, user.firstName, now, toTimed(spec!), order, pf(ride.category), fx, await repo.listDrivers());
            if (route && ride.driverUserId && ACTIVE_STATES.includes(ride.state)) ride.plan = { ...ride.plan, route };
          }
          await repo.putRide(ride);
        });
      } catch (e) {
        if (e === RETRY && attempt === 0) continue;
        if (e === RETRY) throw new ConflictError('RIDE_CLOSED');
        throw e;
      }
    }
  }

  // ---------- time: due events, sim Ready, stepped fast-forward ----------

  async function runDue(repo: Repo, fx: Effects, now: Us) {
    const d = (await repo.getDemoState())!;
    const drivers = await repo.listDrivers();
    for (const ride of await repo.listActiveRides()) {
      const before = ride.version;
      if (ride.state === 'OPEN' && now >= rides.firstPickupUs(ride) - rides.readyLeadMin(d.settings.driversNearby) * MIN) rides.startReadyCheck(ride, now, ctx.realNowMs(), 'auto', '', fx);
      if (ride.state === 'READY_CHECK' && d.settings.simAutoReady && simShouldAnswer(ride.readyCheck!.startedRealMs, ctx.realNowMs())) {
        for (const m of activeMembers(ride)) {
          const u = await repo.getUser(m.userId);
          if (u?.isSim && !m.readyAnswer) rides.answerReady(ride, u.id, u.firstName, now, drivers, fx);
        }
      }
      if (ride.state === 'READY_CHECK' && now >= fromIso(ride.readyCheck!.endsAt)) rides.dispatch(ride, now, drivers, fx);
      if (ride.state === 'DISPATCHED' && now >= fromIso(ride.dispatch!.expiresAt)) rides.cancel(ride, now, fx, 'no-driver');
      if (ride.version !== before) await repo.putRide(ride);
    }
    await repo.putDemoState({ ...d, nowIso: toIso(clock.now()), paused: clock.snapshot().paused });   // survives a restart
  }

  const tick = async () => {
    await commit(undefined, (repo, fx) => runDue(repo, fx, clock.now()));
    await placeDue(clock.now() + 12 * HOUR);   // Uni plans: rides are placed 12 h before arrive-by (SPEC §3.19)
  };

  /** Place every PLANNED trip arriving by `untilUs`: join the fullest ride that passes every rule, else host one.
   *  Runs outside the lock (each join/create takes it); a trip that can't be placed becomes a free replacement. */
  async function placeDue(untilUs: Us) {
    const due = await store.withLock((r) => r.listPlannedBefore(toIso(untilUs)));
    for (const pt of due) {
      const user = await store.withLock((r) => r.getUser(pt.userId));
      if (!user) continue;
      const t: Trip = { pickup: pt.pickup, dest: pt.dest, arriveBy: pt.arriveBy, by: fromIso(pt.arriveBy), category: pt.category, sameGenderOnly: pt.sameGenderOnly };
      const open = (await store.withLock((r) => r.listActiveRides()))
        .filter((r) => r.state === 'OPEN' && r.category === pt.category && !r.members.some((m) => m.userId === user.id))
        .sort((a, b) => activeMembers(b).length - activeMembers(a).length || a.createdAt.localeCompare(b.createdAt));
      let rideId: string | undefined;
      for (const r of open) {
        try { await joinAs(user, r.id, t); rideId = r.id; break; } catch (e) { if (!(e instanceof ConflictError)) throw e; }
      }
      if (!rideId) {
        try { rideId = (await createAs(user, t, { placement: true })).rideId; } catch (e) { if (!(e instanceof ConflictError)) throw e; }
      }
      await commit(undefined, async (repo, fx) => {
        const fresh = await repo.getPlannedTrip(pt.id);
        if (!fresh || fresh.state !== 'PLANNED') return;
        if (rideId) await repo.putPlannedTrip({ ...fresh, state: 'PLACED', rideId });
        else {
          await repo.putPlannedTrip({ ...fresh, state: 'UNPLACEABLE' });
          const sub = await repo.getSubscription(user.id);
          if (sub) await repo.putSubscription({ ...sub, replacementCredits: sub.replacementCredits + 1 });
          fx.banners.push({ userId: user.id, tone: 'warn', text: "We couldn't plan one of your rides. You have a free replacement." });
        }
        fx.touched.add(user.id);
      });
    }
  }

  function nextDueAt(list: Ride[], leadMin = 45): Us | null {
    const times = list.flatMap((r) =>
      r.state === 'OPEN' ? [rides.firstPickupUs(r) - leadMin * MIN]
        : r.state === 'READY_CHECK' ? [fromIso(r.readyCheck!.endsAt)]
          : r.state === 'DISPATCHED' ? [fromIso(r.dispatch!.expiresAt)] : []);
    return times.length ? Math.min(...times) : null;
  }

  /** Fast-forward in steps: apply each due event at its own time, in order (ARCH §8). */
  async function advanceTo(target: Us) {
    for (let i = 0; i < 200; i++) {
      const [list, d] = await store.withLock(async (r) => [await r.listActiveRides(), (await r.getDemoState())!] as const);
      const next = nextDueAt(list, rides.readyLeadMin(d.settings.driversNearby));
      if (next === null || next > target) break;
      if (next > clock.now()) clock.jump(next);
      await tick();
    }
    clock.jump(target);
    await tick();
  }

  async function demoView(): Promise<DemoView> {
    return store.withLock(async (repo) => {
      const d = (await repo.getDemoState())!;
      const list = [];
      for (const r of await repo.listActiveRides()) {
        list.push({ id: r.id, state: r.state, hostFirstName: (await repo.getUser(r.hostUserId))?.firstName ?? '?',
          riders: activeMembers(r).reduce((n, m) => n + seatsOf(m), 0), firstPickupAt: r.plan.firstPickup });
      }
      const settings = { ...d.settings, offlineFallbackActive: d.settings.offlineFallbackActive || travelOffline() };
      const mine = await linaRide(repo);
      const now = mine && ACTIVE_STATES.includes(mine.state) ? await describeRide(repo, mine, rides.readyLeadMin(d.settings.driversNearby)) : [];
      return { buildStamp: null, clock: clockView(clock), settings, rides: list, autopilot: await nextStep(repo), script: scriptFor(scenario), scenario, log: [...apLog], now,
        otps: [...otps].map(([phone, o]) => ({ phone, code: o.code, secondsLeft: Math.round((OTP_TTL_MS - (ctx.realNowMs() - o.sentMs)) / 1000) })).filter((o) => o.secondsLeft > 0) };
    });
  }

  // ---------- demo autopilot: the SPEC §2.2 script, one step per tap, read from the ride's state ----------

  // Phone sign-in (owner request). In memory: one VM, and a restart just means "send a new code".
  const OTP_RESEND_MS = 30_000, OTP_TTL_MS = 300_000, OTP_TRIES = 5, TICKET_TTL_MS = 600_000;
  const otps = new Map<string, { code: string; sentMs: number; tries: number }>();
  const tickets = new Map<string, { phone: string; atMs: number }>();

  const apLog: DemoView['log'] = [];   // what each autopilot tap did; in memory, cleared on reset
  let scenario: Scenario = 'men';       // which demo the autopilot plays: men-only (Laith) or women-only (Lina)

  async function linaRide(repo: Repo): Promise<Ride | null> {
    const laith = await repo.getUserBySeedLogin(CASTS[scenario].host);
    const rides = laith ? (await repo.listRidesForUser(laith.id)).filter((r) => r.hostUserId === laith.id || r.members[0]?.userId === laith.id) : [];
    return rides.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }

  async function nextStep(repo: Repo): Promise<DemoView['autopilot']> {
    const ride = await linaRide(repo);
    const step = (() => {
      if (!ride || ride.state === 'CANCELED') return 1;
      if (ride.state === 'COMPLETED') return 0;
      const riderId = `u-${CASTS[scenario].rider}`;   // seed ids are u-<login>
      const active = activeMembers(ride), saraIn = active.some((m) => m.userId === riderId);
      if (ride.state === 'OPEN') return !ride.members.some((m) => m.userId === riderId) ? 2 : active.length < 4 ? 3 : 4;
      if (ride.state === 'READY_CHECK' || ride.state === 'DISPATCHED') return 5;
      return saraIn ? 6 : 7;
    })();
    return step ? { step, label: scriptFor(scenario)[step - 1]!.title } : null;
  }

  async function newFriendCode(repo: Repo) {
    for (;;) {
      const code = randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().padEnd(6, '7').slice(0, 6);
      if (!(await repo.getUserByFriendCode(code))) return code;
    }
  }

  // ---------- the commands ----------

  const self = {
    tick,

    /** Push a fresh view to a user's sockets (on connect). */
    pushView: (userId: string) => publish([userId]),

    /** Send a sign-in code (demo: returned for the screen instead of texted). One per 30 s, valid 5 min, 5 tries. */
    async requestOtp(b: Body<typeof req.OtpRequestBody>) {
      const phone = normalizePhone(b.phone);
      if (!phone) throw new ConflictError('BAD_PHONE');
      const now = ctx.realNowMs(), prev = otps.get(phone);
      if (prev && now - prev.sentMs < OTP_RESEND_MS) throw new ConflictError('OTP_WAIT', `Wait ${Math.ceil((OTP_RESEND_MS - (now - prev.sentMs)) / 1000)} s before sending another code`);
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      otps.set(phone, { code, sentMs: now, tries: 0 });
      return { phone, demoCode: code, resendInSec: OTP_RESEND_MS / 1000, expiresInSec: OTP_TTL_MS / 1000 };
    },

    /** Check the code. A known number logs in; a new one gets a sign-up ticket (10 min, one use). */
    async verifyOtp(b: Body<typeof req.OtpVerifyBody>): Promise<AuthResponse | { ticket: string; phone: string }> {
      const phone = normalizePhone(b.phone);
      if (!phone) throw new ConflictError('BAD_PHONE');
      const now = ctx.realNowMs(), o = otps.get(phone);
      if (!o || now - o.sentMs > OTP_TTL_MS) { otps.delete(phone); throw new ConflictError('OTP_EXPIRED'); }
      if (o.code !== b.code) {
        if (++o.tries >= OTP_TRIES) { otps.delete(phone); throw new ConflictError('OTP_EXPIRED', 'Too many wrong codes. Send a new one.'); }
        throw new ConflictError('OTP_WRONG', `That code isn't right. ${OTP_TRIES - o.tries} tries left.`);
      }
      otps.delete(phone);
      const existing = await store.withLock(async (repo) => {
        const u = await repo.getUserByPhone(phone);
        if (!u) return null;
        const fresh = { ...u, token: randomBytes(16).toString('hex') };   // a new device: new token
        await repo.putUser(fresh);
        return fresh;
      });
      if (existing) return { token: existing.token, epoch: existing.epoch, view: await myView(existing.id) };
      const ticket = randomBytes(18).toString('base64url');
      tickets.set(ticket, { phone, atMs: now });
      return { ticket, phone };
    },

    /** Edit my profile (first and last name, same-gender default). Gender and phone stay fixed. */
    async updateProfile(token: string, b: Body<typeof req.ProfileBody>) {
      const user = await auth(token);
      return commit(user.id, async (repo) => {
        const u = (await repo.getUser(user.id))!;
        await repo.putUser({ ...u, ...(b.firstName ? { firstName: b.firstName.trim() } : {}), ...(b.lastName ? { lastName: b.lastName.trim() } : {}), ...(b.sameGenderOnly !== undefined ? { sameGenderOnly: b.sameGenderOnly } : {}) });
      });
    },

    /** Log out this device: the old token stops working everywhere. */
    async logout(token: string) {
      const user = await auth(token);
      await store.withLock(async (repo) => { const u = (await repo.getUser(user.id))!; await repo.putUser({ ...u, token: randomBytes(16).toString('hex') }); });
      return { ok: true as const };
    },

    async signup(b: Body<typeof req.SignupBody>): Promise<AuthResponse> {
      const t = tickets.get(b.ticket);
      tickets.delete(b.ticket);
      if (!t || ctx.realNowMs() - t.atMs > TICKET_TTL_MS) throw new ConflictError('OTP_EXPIRED', 'Verify your phone number again');
      const u = await store.withLock(async (repo) => {
        const d = (await repo.getDemoState())!;
        if (await repo.getUserByPhone(t.phone)) throw new ConflictError('BAD_PHONE', 'That number already has an account. Sign in instead.');
        const user: User = { id: randomUUID(), token: randomBytes(16).toString('hex'), epoch: d.epoch, role: b.role, phone: t.phone,
          firstName: b.firstName.trim(), lastName: b.lastName.trim(), gender: b.gender, sameGenderOnly: true, friendCode: await newFriendCode(repo),
          viewSeq: 0, outstandingP: 0, isSim: false, createdAt: toIso(clock.now()) };
        await repo.putUser(user);
        if (b.role === 'driver') {
          const base = seedPlaces.find((p) => p.key === 'CC')!;
          await repo.putDriver({ userId: user.id, car: 'Demo car', plate: '00-00000', base, creditBalanceP: 0, rejectedRideIds: [] });
        }
        return user;
      });
      return { token: u.token, epoch: u.epoch, view: await myView(u.id) };
    },

    /** Places search proxy (P1): server-side Google Places, Jordan only, biased to Irbid. No key or Google down → seed places. */
    async places(token: string, q: string): Promise<PlaceResult[]> {
      await auth(token, 'rider');
      const text = q.trim();
      if (text.length < 2) return [];
      const seeds = seedPlaces.filter((p) => p.key && `${p.name} ${p.area}`.toLowerCase().includes(text.toLowerCase()))
        .map((p) => ({ key: p.key!, placeId: `seed:${p.key}`, name: p.name, address: p.area, area: p.area, lat: p.lat, lng: p.lng }));
      if (!cfg.googleServerKey || text.length < 3) return seeds;
      try {
        const g = (await searchPlaces(cfg.googleServerKey, text))
          .map((p) => remember({ placeId: p.placeId, name: p.name, address: p.address, area: areaFor(p, p.parts, seedPlaces), lat: p.lat, lng: p.lng }));
        return [...seeds, ...g].slice(0, 8);
      } catch (e) { console.warn(`places: ${(e as Error).message}`); return seeds; }
    },

    /** A pin dropped on the map (P1): its name from the closest named place, and its public area. */
    async placeAt(token: string, lat: number, lng: number): Promise<PlaceResult> {
      await auth(token, 'rider');
      if (!(lat > 29.1 && lat < 33.4 && lng > 34.9 && lng < 39.4)) throw new ConflictError('NOT_ELIGIBLE', 'Pick a place in Jordan');
      const p = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
      // Street address first (Geocoding); then the closest named place (Places Nearby); then "Pinned location".
      const key = cfg.googleServerKey;
      const soft = <T>(x: Promise<T>) => x.catch((e: Error) => { console.warn(`places: ${e.message}`); return null; });
      const [street, near] = key ? await Promise.all([soft(reverseGeocode(key, p)), soft(nearestPlace(key, p))]) : [null, null];
      const area = areaFor(p, [...(near?.parts ?? []), ...(street?.parts ?? [])], seedPlaces);   // a neighbourhood from either
      if (street) return remember({ placeId: `pin:${p.lat},${p.lng}`, name: street.name, address: near ? `Near ${near.name}` : '', area, ...p });
      return remember({ placeId: `pin:${p.lat},${p.lng}`, name: pinName(near?.name), address: near?.address ?? '', area, ...p });
    },

    async demoLogin({ as }: Body<typeof req.DemoLoginBody>): Promise<AuthResponse> {
      const u = await store.withLock((r) => r.getUserBySeedLogin(as));
      if (!u) throw illegal('Unknown demo login');
      return { token: u.token, epoch: u.epoch, view: await myView(u.id) };
    },

    async me(token: string) { return myView((await auth(token)).id); },

    async quote(token: string, b: Body<typeof req.QuoteBody>): Promise<QuoteView> {
      await auth(token, 'rider');
      const pickup = resolvePlace(b.pickup), dest = resolvePlace(b.dest), by = fromIso(b.arriveBy);
      const cand = rides.newMember('q', pickup, dest, toIso(by), clock.now(), 0, 0);
      const m = toTimed(await fetchMatrix([cand], by - HOUR));
      const uniTrip = isUniTrip(pickup, dest);   // SPEC §3.19
      const categories: CategoryQuote[] = (['economy', 'comfort', 'airport'] as const).map((category) => {
        const cat = CATEGORY[category];
        const available = category === 'airport' ? isAirport(dest) : !isAirport(dest);
        const s = available ? solo(m, { id: 'q', gender: 'F', p: 0, d: 1, by }, { earlyMax: cat.early, priceFactor: pf(category) }) : null;
        const estimates = s ? Object.entries(cat.A).map(([k, a]) => ({ riders: +k, eachJod: up05(s.fare * a / +k) })) : [];
        const [zp, zd] = zone(category, s?.km ?? 0);
        return { category, available: !!s, maxRiders: cat.maxRiders, soloJod: s ? up05(s.fare) : 0,
          fromJod: estimates.at(-1)?.eachJod ?? 0, estimates, beReadyBy: s ? toIso(s.T0) : toIso(by),
          zoneKm: { pickup: zp, dest: zd }, uniTrip };
      });
      return { categories, pickup: placeView(pickup), dest: placeView(dest) };
    },

    async search(token: string, b: Body<typeof req.SearchBody>): Promise<MatchCard[]> {
      const user = await auth(token, 'rider');
      const t = tripOf(b);
      const open = (await store.withLock((r) => r.listActiveRides()))
        .filter((r) => r.state === 'OPEN' && !r.members.some((m) => m.userId === user.id && ACTIVE_MEMBER.includes(m.state)));
      const cards: MatchCard[] = [];
      for (const ride of open) {
        const r = await cardFor(user, ride, t);
        if ('card' in r) cards.push(r.card);
      }
      return cards.sort((a, b2) => a.eachJod - b2.eachJod);
    },

    async createRide(token: string, b: Body<typeof req.CreateRideBody>) {
      return (await createAs(await auth(token, 'rider'), tripOf(b))).view;
    },

    async join(token: string, rideId: string, b: Body<typeof req.JoinBody>) {
      return joinAs(await auth(token, 'rider'), rideId, tripOf(b), b.inviteId);
    },

    async leave(token: string, rideId: string, b: Body<typeof req.LeaveBody>) {
      return leaveAs(await auth(token, 'rider'), rideId, !!b.acceptCharge);
    },

    async findDriver(token: string, rideId: string) {
      const user = await auth(token, 'rider');
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || !ACTIVE_STATES.includes(ride.state)) throw new ConflictError('RIDE_GONE');
        if (ride.hostUserId !== user.id) throw illegal('Only the host can start the ready check');
        if (ride.state !== 'OPEN') return;   // already started: harmless double tap
        rides.startReadyCheck(ride, clock.now(), ctx.realNowMs(), 'host', user.firstName, fx);
        await repo.putRide(ride);
      });
    },

    async ready(token: string, rideId: string, b: Body<typeof req.ReadyBody>) {
      const user = await auth(token, 'rider');
      if (b.answer === 'CANCEL') return leaveAs(user, rideId, false);   // always free during the ready check
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride) throw new ConflictError('RIDE_GONE');
        if (ride.state !== 'READY_CHECK') return;
        rides.answerReady(ride, user.id, user.firstName, clock.now(), await repo.listDrivers(), fx);
        await repo.putRide(ride);
      });
    },

    async chat(token: string, rideId: string, b: Body<typeof req.ChatBody>) {
      const user = await auth(token);
      if (b.channel === 'group') return postChat(user, rideId, b.text);
      // Driver channel (P1): one private thread per rider with the accepted driver (SPEC §3.11).
      const riderId = b.channel.slice('driver:'.length);
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || !rides.driverAssigned(ride)) throw illegal('Driver chat opens when a driver accepts');
        const isRider = user.id === riderId && activeMembers(ride).some((m) => m.userId === riderId);
        const isDriver = user.id === ride.driverUserId && ride.members.some((m) => m.userId === riderId);
        if (!isRider && !isDriver) throw illegal('That chat is private');
        fx.messages.push({ rideId, channel: `driver:${riderId}`, kind: 'user', fromUserId: user.id, text: maskChat(b.text.trim()) });
        fx.touched.add(riderId); fx.touched.add(ride.driverUserId!);
      });
    },

    async accept(token: string, rideId: string) {
      const user = await auth(token, 'driver');
      for (let attempt = 0; ; attempt++) {
        const snap = await store.withLock((r) => r.getRide(rideId));
        const drv = await store.withLock((r) => r.getDriver(user.id));
        if (!snap || snap.state !== 'DISPATCHED' || !snap.dispatch?.offeredTo.includes(user.id) || drv!.rejectedRideIds.includes(rideId)) {
          throw new ConflictError('OFFER_TAKEN');
        }
        const order = activeMembers(snap).map((m) => m.userId);
        const spec = await fetchMatrix(activeMembers(snap), fromIso(snap.plan.firstPickup));
        const route = await routeThrough(snap.plan.stops, fromIso(snap.plan.firstPickup));
        try {
          return await commit(user.id, async (repo, fx) => {
            const ride = await repo.getRide(rideId);
            if (!ride || ride.state !== 'DISPATCHED') throw new ConflictError('OFFER_TAKEN');
            if (ride.version !== snap.version) throw RETRY;
            const busy = (await repo.listActiveRides()).some((r) => r.driverUserId === user.id && r.id !== rideId);
            if (busy) throw illegal('You already have a trip');
            rides.accept(ride, (await repo.getDriver(user.id))!, user.firstName, clock.now(), spec, order, fx, route);
            await repo.putRide(ride);
          });
        } catch (e) {
          if (e === RETRY && attempt === 0) continue;
          if (e === RETRY) throw new ConflictError('OFFER_TAKEN');
          throw e;
        }
      }
    },

    async bannerSeen(token: string, bannerId: string) {
      const user = await auth(token);
      return commit(user.id, async (repo) => {
        if ((await repo.listUnseenBanners(user.id)).some((x) => x.id === bannerId)) await repo.markBannerSeen(bannerId);
      });
    },

    // ---------- Uni plans (P1, SPEC §3.19) ----------

    async subscribe(token: string, b: Body<typeof req.SubscribeBody>) {
      const user = await auth(token, 'rider');
      const now = clock.now();
      const number = b.card.number.replace(/[\s-]/g, '');
      const [mm, yy] = b.card.expiry.split('/').map(Number);
      const nowParts = ammanParts(now);
      const expired = 2000 + yy! < nowParts.year || (2000 + yy! === nowParts.year && mm! < nowParts.month);
      if (!isTestCard(number) || expired) throw new ConflictError('NOT_TEST_CARD');
      const end = b.kind === 'weekly' ? toIso(now + 7 * 24 * HOUR) : SEMESTER_END;
      const trips: Trip[] = b.kind === 'weekly'
        ? b.trips.map((x) => tripOf(x))
        : planDates(b.pattern, now + 12 * HOUR, fromIso(SEMESTER_END)).map(({ index, arriveBy }) => {
          const it = b.pattern[index]!;
          return tripOf({ pickup: it.pickup, dest: it.dest, arriveBy, category: it.category, sameGenderOnly: it.sameGenderOnly });
        });
      for (const x of trips) {
        if (x.category === 'airport') throw new ConflictError('NOT_ELIGIBLE', "Airport rides aren't part of Uni plans");
        if (!isUniTrip(x.pickup, x.dest)) throw new ConflictError('NOT_ELIGIBLE', 'Uni plans cover rides to or from campus');
        if (x.by < now + 12 * HOUR) throw new ConflictError('NOT_ELIGIBLE', 'Plan each ride at least 12 hours ahead');
        if (x.by > fromIso(end)) throw new ConflictError('NOT_ELIGIBLE', 'A weekly plan covers the next 7 days');
      }
      if (trips.length === 0) throw new ConflictError('NOT_ELIGIBLE', 'No rides left in this semester for that pattern');
      const weeks = Math.ceil((fromIso(end) - now) / (7 * 24 * HOUR));
      return commit(user.id, async (repo, fx) => {
        const current = await repo.getSubscription(user.id);
        if (current && fromIso(current.end) >= now) throw new ConflictError('NOT_ELIGIBLE', 'You already have a Uni plan');
        const sub: Subscription = {
          id: randomUUID(), userId: user.id, kind: b.kind, start: toIso(now), end,
          pricePaidP: b.kind === 'weekly' ? WEEKLY_PRICE_P : SEMESTER_WEEK_PRICE_P * weeks,
          card: { brand: 'demo', last4: number.slice(-4) }, replacementsLeft: replacementsFor(b.kind, trips.length), replacementCredits: 0,
        };
        await repo.putSubscription(sub);
        for (const x of trips) await repo.putPlannedTrip(plannedFrom(sub, user.id, x, false));
        fx.touched.add(user.id);
      });
    },

    /** ≥ 12 h before: removed, plus a replacement while under the limit. < 12 h: it's placed, use the normal leave. */
    async cancelPlanned(token: string, tripId: string) {
      const user = await auth(token, 'rider');
      return commit(user.id, async (repo, fx) => {
        const pt = await repo.getPlannedTrip(tripId);
        const sub = await repo.getSubscription(user.id);
        if (!pt || pt.userId !== user.id || !sub) throw new ConflictError('RIDE_GONE');
        if (pt.state === 'CANCELED' || pt.state === 'UNPLACEABLE') return;
        const [outcome, left] = cancelOutcome((fromIso(pt.arriveBy) - clock.now()) / MIN, sub.replacementsLeft);
        if (outcome === 'use_leave' || pt.state === 'PLACED') throw new ConflictError('USE_LEAVE');
        await repo.putPlannedTrip({ ...pt, state: 'CANCELED' });
        if (outcome === 'replacement') await repo.putSubscription({ ...sub, replacementsLeft: left, replacementCredits: sub.replacementCredits + 1 });
        fx.touched.add(user.id);
      });
    },

    async planReplacement(token: string, b: Body<typeof req.ReplacementBody>) {
      const user = await auth(token, 'rider');
      const x = tripOf(b.trip);
      const now = clock.now();
      return commit(user.id, async (repo, fx) => {
        const sub = await repo.getSubscription(user.id);
        if (!sub || sub.replacementCredits <= 0) throw new ConflictError('NO_REPLACEMENTS');
        if (!isUniTrip(x.pickup, x.dest)) throw new ConflictError('NOT_ELIGIBLE', 'Uni plans cover rides to or from campus');
        if (x.by < now + 12 * HOUR || x.by > fromIso(sub.end)) throw new ConflictError('NOT_ELIGIBLE', 'Plan it at least 12 hours ahead and before your plan ends');
        await repo.putPlannedTrip(plannedFrom(sub, user.id, x, true));
        await repo.putSubscription({ ...sub, replacementCredits: sub.replacementCredits - 1 });
        fx.touched.add(user.id);
      });
    },

    // ---------- friends (P1, SPEC §3.17) ----------

    /** +1: a friend riding from my pickup to my destination. Same stops and fare, one more seat. */
    async addGuest(token: string, rideId: string, b: Body<typeof req.GuestBody>) {
      const user = await auth(token, 'rider');
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || !ACTIVE_STATES.includes(ride.state)) throw new ConflictError('RIDE_GONE');
        if (ride.state !== 'OPEN') throw new ConflictError('RIDE_CLOSED');
        const me = activeMembers(ride).find((m) => m.userId === user.id);
        if (!me) throw new ConflictError('RIDE_GONE');
        if (me.guest && !me.guest.leave) throw new ConflictError('NOT_ELIGIBLE', 'You already added a friend');
        const seats = activeMembers(ride).reduce((n, m) => n + seatsOf(m), 0);
        if (seats + 1 > CATEGORY[ride.category].maxRiders) throw new ConflictError('NO_SEAT_FOR_FRIEND');
        if (ride.genderMode === 'same' && b.gender !== ride.gender) throw new ConflictError('NOT_ELIGIBLE', `This ride is ${ride.gender === 'F' ? 'women' : 'men'} only`);
        const name = b.firstName.trim();
        me.guest = { firstName: name, gender: b.gender };
        const shareP = piastres(up05(Math.max(0, ride.plan.fareJod - jod(ride.creditsP)) / (seats + 1)));
        if (shareP >= me.soloFareP) throw new ConflictError('NOT_ELIGIBLE', "Your friend's share would be higher than riding solo");
        ride.plan = { ...ride.plan, shareP };
        ride.version++;
        system(fx, ride.id, `${user.firstName} added a friend (${name})`);
        for (const m of ride.members) fx.touched.add(m.userId);
        await repo.putRide(ride);
      });
    },

    /** Remove my +1: free while OPEN or ≥ 30 min out; late after that, charged to me (a +1 has no account). */
    async removeGuest(token: string, rideId: string, b: Body<typeof req.GuestRemoveBody>) {
      const user = await auth(token, 'rider');
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || !ACTIVE_STATES.includes(ride.state)) throw new ConflictError('RIDE_GONE');
        const me = activeMembers(ride).find((m) => m.userId === user.id);
        if (me?.state === 'PICKED_UP') throw illegal("You're already in the car");
        if (!me?.guest || me.guest.leave) return;   // nothing to remove (double tap)
        const now = clock.now();
        const late = rides.isLateNow(ride, now);
        if (late && !b.acceptCharge) throw new ConflictError('LATE_CONFIRM_REQUIRED', undefined, { chargeJod: jod(ride.plan.shareP) });
        const chargedP = late ? ride.plan.shareP : 0;
        me.guest.leave = { at: toIso(now), late, chargedP };
        if (late) { fx.outstanding.push({ userId: user.id, deltaP: chargedP }); ride.creditsP += chargedP; }
        const seats = activeMembers(ride).reduce((n, m) => n + seatsOf(m), 0);
        let shareP = piastres(up05(Math.max(0, ride.plan.fareJod - jod(ride.creditsP)) / seats));
        if (late) shareP = Math.min(shareP, ride.plan.shareP);   // a late leave never raises the others' shares
        ride.plan = { ...ride.plan, shareP };
        ride.version++;
        system(fx, ride.id, `${me.guest.firstName} (${user.firstName}'s friend) left`);
        if (ride.driverUserId && rides.driverAssigned(ride)) {
          fx.banners.push({ userId: ride.driverUserId, tone: 'danger',
            text: `${me.guest.firstName} canceled. Collect JOD ${jod(activeMembers(ride).reduce((n, m) => n + cashDueP(m, shareP), 0)).toFixed(2)} cash · JOD ${jod(ride.creditsP).toFixed(2)} credit at trip end` });
        }
        for (const m of ride.members) fx.touched.add(m.userId);
        await repo.putRide(ride);
      });
    },

    /** Invite a friend's account by friend code. They still join under every matching rule. */
    async invite(token: string, rideId: string, b: Body<typeof req.InviteBody>) {
      const user = await auth(token, 'rider');
      const code = b.friendCode.trim().toUpperCase();
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || !ACTIVE_STATES.includes(ride.state)) throw new ConflictError('RIDE_GONE');
        if (ride.state !== 'OPEN') throw new ConflictError('RIDE_CLOSED');
        if (!activeMembers(ride).some((m) => m.userId === user.id)) throw new ConflictError('RIDE_GONE');
        const friend = await repo.getUserByFriendCode(code);
        if (!friend || friend.role !== 'rider') throw new ConflictError('NO_SUCH_CODE');
        if (friend.id === user.id) throw new ConflictError('NOT_ELIGIBLE', "That's your own code");
        if (activeMembers(ride).some((m) => m.userId === friend.id)) throw new ConflictError('NOT_ELIGIBLE', `${friend.firstName} is already in this ride`);
        if (ride.genderMode === 'same' && friend.gender !== ride.gender) throw new ConflictError('NOT_ELIGIBLE', `This ride is ${ride.gender === 'F' ? 'women' : 'men'} only`);
        if (activeMembers(ride).reduce((n, m) => n + seatsOf(m), 0) >= CATEGORY[ride.category].maxRiders) throw new ConflictError('RIDE_FULL');
        await repo.putInvite({ id: randomUUID(), rideId, fromUserId: user.id, toUserId: friend.id, at: toIso(clock.now()), state: 'PENDING' });
        fx.banners.push({ userId: friend.id, tone: 'info', text: `${user.firstName} invited you to a ride to ${ride.anchor.dest.area}` });
        fx.touched.add(friend.id);
      });
    },

    /** Is this a rider's friend code? First name only (P1). */
    async lookupCode(token: string, raw: string) {
      const user = await auth(token, 'rider');
      const friend = await store.withLock((r) => r.getUserByFriendCode(raw.trim().toUpperCase()));
      if (!friend || friend.role !== 'rider') throw new ConflictError('NO_SUCH_CODE');
      if (friend.id === user.id) throw new ConflictError('NOT_ELIGIBLE', "That's your own code");
      return { firstName: friend.firstName };
    },

    /** What the invited friend would pay from this pickup, before joining. */
    async previewInvite(token: string, inviteId: string, b: Body<typeof req.InviteAcceptBody>) {
      const user = await auth(token, 'rider');
      const { ride, trip } = await inviteTrip(user, inviteId, b);
      const r = await cardFor(user, ride, trip);
      if ('reason' in r) throw ruleError(r.reason);
      return { eachJod: r.card.eachJod, myPaysJod: r.card.myPaysJod, myPickupAt: r.card.myPickupAt, riders: r.card.seats.length + 1 };
    },

    async acceptInvite(token: string, inviteId: string, b: Body<typeof req.InviteAcceptBody>) {
      const user = await auth(token, 'rider');
      const { inv, ride, trip } = await inviteTrip(user, inviteId, b);
      return joinAs(user, ride.id, trip, inv.id);
    },

    async declineInvite(token: string, inviteId: string) {
      const user = await auth(token, 'rider');
      return commit(user.id, async (repo, fx) => {
        const inv = await repo.getInvite(inviteId);
        if (inv && inv.toUserId === user.id && inv.state === 'PENDING') {
          await repo.putInvite({ ...inv, state: 'DECLINED' });
          fx.touched.add(inv.fromUserId);
        }
      });
    },

    /** Driver stop taps (P1): picked up, dropped off, or no-show (5 min after the shown pickup time). */
    async stop(token: string, rideId: string, stopId: string, action: 'picked-up' | 'dropped-off' | 'no-show') {
      const user = await auth(token, 'driver');
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || ride.driverUserId !== user.id || (ride.state !== 'ACCEPTED' && ride.state !== 'IN_PROGRESS')) throw illegal('This is not your active trip');
        const stop = ride.plan.stops.find((x) => x.id === stopId);
        const member = ride.members.find((m) => m.userId === stop?.userId);
        if (!stop || !member || stop.done) return;   // double tap
        const name = (await repo.getUser(member.userId))?.firstName ?? 'Rider';
        const now = clock.now();
        if (action === 'picked-up') {
          if (stop.kind !== 'P') throw illegal('That is a drop-off');
          rides.pickUp(ride, stop, fx);
        } else if (action === 'dropped-off') {
          if (stop.kind !== 'D') throw illegal('That is a pickup');
          if (member.state !== 'PICKED_UP') throw illegal(`Pick up ${name} first`);
          rides.dropOff(ride, stop, now, await usersOf(repo, ride.members.map((m) => m.userId)), fx);
        } else {
          if (stop.kind !== 'P' || member.state === 'PICKED_UP') throw illegal('No-show is only for a rider not picked up yet');
          // Count from the minute the rider was shown ("7:21"), not the hidden seconds of the planned arrival.
          if (now < floorMinute(fromIso(member.shownPickup)) + 5 * MIN) throw illegal('No-show is allowed 5 minutes after the pickup time');
          rides.leaveFrozen(ride, member.userId, name, now, toTimed(ride.locked!.matrix), ride.locked!.order, pf(ride.category), fx, await repo.listDrivers(), 'no-show');
        }
        await repo.putRide(ride);
      });
    },

    /** Driver cancels after accepting (P1, SPEC §3.9). */
    async driverCancel(token: string, rideId: string) {
      const user = await auth(token, 'driver');
      return commit(user.id, async (repo, fx) => {
        const ride = await repo.getRide(rideId);
        if (!ride || ride.driverUserId !== user.id || ride.state !== 'ACCEPTED') throw illegal('Only an accepted trip that has not started can be canceled');
        const d = (await repo.getDriver(user.id))!;
        await repo.putDriver({ ...d, rejectedRideIds: [...d.rejectedRideIds, rideId] });
        rides.driverCancel(ride, user.firstName, clock.now(), (await repo.listDrivers()).map((x) => (x.userId === d.userId ? { ...x, rejectedRideIds: [...x.rejectedRideIds, rideId] } : x)), fx);
        await repo.putRide(ride);
      });
    },

    async reject(token: string, rideId: string) {
      const user = await auth(token, 'driver');
      return commit(user.id, async (repo, fx) => {
        const d = (await repo.getDriver(user.id))!;
        if (!d.rejectedRideIds.includes(rideId)) await repo.putDriver({ ...d, rejectedRideIds: [...d.rejectedRideIds, rideId] });
        fx.touched.add(user.id);
      });
    },

    // ---------- demo menu (PIN checked by HTTP) ----------
    demo: {
      view: demoView,

      async clock(b: Body<typeof req.DemoClockBody>): Promise<DemoView> {
        if ('advanceMin' in b) await advanceTo(clock.now() + b.advanceMin * MIN);
        else if ('jumpTo' in b) {
          const t = fromIso(b.jumpTo);
          if (t > clock.now()) await advanceTo(t); else { clock.jump(t); await tick(); }
        } else if ('next' in b) {
          const [list, d] = await store.withLock(async (r) => [await r.listActiveRides(), (await r.getDemoState())!] as const);
          const n = nextDueAt(list, rides.readyLeadMin(d.settings.driversNearby));
          if (n !== null) await advanceTo(Math.max(n, clock.now()));
        } else { clock.setPaused(b.paused); await tick(); }
        publisher.clock(clockView(clock));
        return demoView();
      },

      async simulateRider(b: Body<typeof req.DemoRideBody> | string): Promise<DemoView> {
        const rideId = typeof b === 'string' ? b : b.rideId;
        const snap = await store.withLock((r) => r.getRide(rideId));
        if (!snap) throw new ConflictError('RIDE_GONE');
        const day = snap.anchor.arriveBy.slice(0, 10);
        const reasons: string[] = [];
        for (const sim of SIM_ORDER) {
          if (snap.members.some((m) => m.userId === sim.userId)) continue;
          const u = (await store.withLock((r) => r.getUser(sim.userId)))!;
          const t = tripOf({ pickup: { key: sim.pickupKey }, dest: { key: sim.destKey }, arriveBy: `${day}T${sim.arriveBy}:00+03:00`,
            category: snap.category, sameGenderOnly: true });
          try {
            await joinAs(u, rideId, t);
            await postChat(u, rideId, sim.chatLine);
            return demoView();
          } catch (e) {
            if (!(e instanceof ConflictError)) throw e;
            reasons.push(`${u.firstName}: ${e.message}`);
          }
        }
        throw new ConflictError('NOT_ELIGIBLE', reasons.length ? `No seed rider fits. ${reasons.join('; ')}` : 'No seed riders left');
      },

      async completeTrip(b: Body<typeof req.DemoRideBody> | string): Promise<DemoView> {
        const rideId = typeof b === 'string' ? b : b.rideId;
        await commit(undefined, async (repo, fx) => {
          const ride = await repo.getRide(rideId);
          if (!ride) throw new ConflictError('RIDE_GONE');
          rides.complete(ride, clock.now(), await usersOf(repo, ride.members.map((m) => m.userId)), fx);
          await repo.putRide(ride);
        });
        return demoView();
      },

      async reset(): Promise<DemoView> {
        await store.withLock((r) => resetToSeed(r, cfg));
        apLog.length = 0;
        clock.jump(cfg.demoStartUs);
        clock.setPaused(true);
        publisher.logout();
        return demoView();
      },

      /** Move a driver to a seed place, for demand spots (P2). */
      async driverPosition(b: Body<typeof req.DriverPositionBody>): Promise<DemoView> {
        const place = seedPlaces.find((p) => p.key === b.placeKey);
        if (!place) throw new ConflictError('NOT_ELIGIBLE', 'Unknown place');
        await commit(undefined, async (repo, fx) => {
          const d = await repo.getDriver(b.driverId);
          if (!d) throw new ConflictError('NOT_ELIGIBLE', 'Unknown driver');
          await repo.putDriver({ ...d, position: place });
          fx.touched.add(d.userId);
        });
        return demoView();
      },

      /** Place every planned ride arriving in the next 36 h now, without moving the clock (SPEC §2.5). */
      async placePlanned(): Promise<DemoView> {
        await placeDue(clock.now() + 36 * HOUR);
        return demoView();
      },

      /** Play the next script step as the seeded people, through the same commands their phones use. */
      async autopilot(): Promise<DemoView> {
        const next = await store.withLock(nextStep);
        if (!next) throw new ConflictError('NOT_ELIGIBLE', 'The demo script is done. Reset to run it again.');
        const [laith, saed, yazeed] = await store.withLock(async (r) =>
          Promise.all(([CASTS[scenario].host, CASTS[scenario].rider, 'yazeed'] as const).map(async (as) => (await r.getUserBySeedLogin(as))!.token)));
        const day = toIso(clock.now()).slice(0, 10);
        const trip = (key: string) => ({ pickup: { key }, dest: { key: 'JUST' }, arriveBy: `${day}T08:00:00+03:00`, category: 'economy' as const, sameGenderOnly: true });
        const ride = async () => (await store.withLock(linaRide))!;
        switch (next.step) {
          case 1: await self.createRide(laith!, trip('CC')); break;
          case 2: {
            const id = (await ride()).id;
            await self.join(saed!, id, trip('US'));
            await self.chat(saed!, id, { channel: 'group', text: "Hi! I'm near University Street" });
            break;
          }
          case 3: for (let i = 0; i < 3 && activeMembers(await ride()).length < 4; i++) await self.demo.simulateRider((await ride()).id); break;
          case 4: {
            const id = (await ride()).id;
            await self.findDriver(laith!, id);
            await self.ready(laith!, id, { answer: 'READY' });
            await self.ready(saed!, id, { answer: 'READY' });
            break;
          }
          case 5: {
            if ((await ride()).state === 'READY_CHECK') await tick();
            if ((await ride()).state === 'READY_CHECK') throw new ConflictError('NOT_ELIGIBLE', 'Waiting for the simulated riders to answer the ready check (about 3 s)');
            await self.accept(yazeed!, (await ride()).id);
            break;
          }
          case 6: {
            const r = await ride();
            const t = fromIso(r.plan.firstPickup) - 27 * MIN;   // the late-leave moment: 27 min before the first pickup
            if (t > clock.now()) await advanceTo(t);
            await self.leave(saed!, r.id, { acceptCharge: true });
            break;
          }
          case 7: await self.demo.completeTrip((await ride()).id); break;
        }
        const lines = await store.withLock(async (r) => { const x = await linaRide(r); return x ? describeRide(r, x, rides.readyLeadMin((await r.getDemoState())!.settings.driversNearby)) : []; });
        apLog.push({ step: next.step, title: next.label, at: toIso(clock.now()), lines });
        publisher.clock(clockView(clock));
        return demoView();
      },

      /** Pick which demo the autopilot plays (men-only or women-only). Only with no script ride running. */
      async scenario(b: Body<typeof req.DemoScenarioBody>): Promise<DemoView> {
        if (b.scenario !== scenario) {
          const running = await store.withLock(async (r) => { const x = await linaRide(r); return !!x && ACTIVE_STATES.includes(x.state); });
          if (running) throw new ConflictError('NOT_ELIGIBLE', 'A demo ride is running. Reset the demo first, then switch.');
          scenario = b.scenario;
          apLog.length = 0;
        }
        return demoView();
      },

      async settings(b: Body<typeof req.DemoSettingsBody>): Promise<DemoView> {
        await store.withLock(async (r) => { const d = (await r.getDemoState())!; await r.putDemoState({ ...d, settings: { ...d.settings, ...b } }); });
        return demoView();
      },
    },
  };
  return self;
}

export type Commands = ReturnType<typeof createCommands>;
