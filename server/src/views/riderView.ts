// What a rider may see (ARCH §9.3): their own pickup/destination exactly, everyone else as first name +
// initials. Never other members' coordinates or addresses, never the stop list or route line.
import type { PlaceView, RiderRideView, RiderView } from '@nextstop/shared';
import { fromIso, toIso } from '../clock/amman.js';
import type { Clock } from '../clock/clock.js';
import { activeMembers, cashDueP, jod, seatsOf, uniCreditP } from '../domain/bridge.js';
import { driverAssigned, firstPickupUs, isLateNow, readyLeadMin, type SummaryRecord } from '../domain/rides.js';
import { ACTIVE_STATES, type Place, type Ride, type User } from '../domain/types.js';
import { CATEGORY } from '../engine/zone.js';
import type { Repo } from '../store/repo.js';
import { bannerView, chatView, clockView, seatViews } from './common.js';

const DAY_US = 24 * 3_600_000_000;
export const placeView = (p: Place): PlaceView => ({ ...(p.key ? { key: p.key } : {}), name: p.name, area: p.area, lat: p.lat, lng: p.lng });

/** The ride this rider's screens show: their active ride, else their latest finished one (summary). */
export async function currentRideFor(repo: Repo, userId: string, nowUs: number): Promise<Ride | null> {
  const rides = await repo.listRidesForUser(userId);
  const visible = rides.filter((r) => {
    const m = r.members.find((x) => x.userId === userId)!;
    if (m.state === 'LEFT' && !m.leave?.late) return false;                 // a free leaver is out
    if (m.leave?.late) return r.state === 'COMPLETED';                      // a late leaver sees only the summary
    return true;
  });
  const active = visible.filter((r) => ACTIVE_STATES.includes(r.state));
  if (active.length) return active.sort((a, b) => a.plan.firstPickup.localeCompare(b.plan.firstPickup))[0]!;
  const recent = visible.filter((r) => r.closedAt && nowUs - fromIso(r.closedAt) < DAY_US);
  return recent.sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))[0] ?? null;
}

export async function riderView(repo: Repo, user: User, clock: Clock, epoch: number): Promise<RiderView> {
  const now = clock.now();
  const ride = await currentRideFor(repo, user.id, now);
  return {
    role: 'rider', epoch, viewSeq: user.viewSeq,
    me: { id: user.id, firstName: user.firstName, gender: user.gender, sameGenderOnly: user.sameGenderOnly, ...(user.phone ? { phone: user.phone } : {}),
      friendCode: user.friendCode, outstandingJod: jod(user.outstandingP) },
    ...(ride ? { ride: await rideView(repo, ride, user, now) } : {}),
    invites: await invitesFor(repo, user.id),
    ...(await planFor(repo, user.id, now)),
    banners: (await repo.listUnseenBanners(user.id)).map(bannerView),
    clock: clockView(clock),
  };
}

async function rideView(repo: Repo, ride: Ride, me: User, now: number): Promise<RiderRideView> {
  const users = new Map<string, User>();
  for (const m of ride.members) { const u = await repo.getUser(m.userId); if (u) users.set(u.id, u); }
  const mine = ride.members.find((m) => m.userId === me.id)!;
  const active = activeMembers(ride);
  const pickups = ride.plan.stops.filter((s) => s.kind === 'P');
  const seatsUsed = active.reduce((n, m) => n + seatsOf(m), 0);
  const driver = driverAssigned(ride) || ride.state === 'COMPLETED' ? await repo.getDriver(ride.driverUserId ?? '') : null;
  const driverUser = driver ? await repo.getUser(driver.userId) : null;
  const late = isLateNow(ride, now);
  const drivers = (await repo.getDemoState())?.settings.driversNearby ?? 20;
  const group = await repo.listMessages(ride.id, 'group', 100);
  const summary = ride.summary as SummaryRecord | undefined;
  const mySeats = summary?.riders.find((r) => r.userId === me.id);
  return {
    id: ride.id, state: ride.state, isHost: ride.hostUserId === me.id,
    category: ride.category, genderMode: ride.genderMode,
    zoneKm: { pickup: ride.zone.pickupKm, dest: ride.zone.destKm },
    seats: seatViews(ride, me.id, users), seatsLeft: Math.max(0, CATEGORY[ride.category].maxRiders - seatsUsed),
    shareJod: jod(ride.plan.shareP), soloJod: jod(mine.soloFareP), myCashDueJod: jod(cashDueP(mine, ride.plan.shareP)),
    ...(uniCreditP(mine, ride.plan.shareP) > 0 ? { uniDiscountJod: jod(uniCreditP(mine, ride.plan.shareP)) } : {}),
    beReadyBy: mine.shownPickup,
    effectiveArriveBy: active.map((m) => m.arriveBy).sort()[0] ?? mine.arriveBy,
    myPickup: placeView(mine.pickup), myDest: placeView(mine.dest),
    myStop: { index: pickups.findIndex((s) => s.userId === me.id) + 1, of: pickups.length },
    ...(driver && driverUser ? { driver: { firstName: driverUser.firstName, car: driver.car, plate: driver.plate,
      ...(driverAssigned(ride) && driverUser.phone ? { phone: driverUser.phone } : {}) } } : {}),   // call the driver: while assigned only
    ...(ride.state === 'READY_CHECK' && ride.readyCheck ? { readyCheck: {
      endsAt: ride.readyCheck.endsAt,
      startedByFirstName: ride.readyCheck.startedBy === 'host' ? (users.get(ride.hostUserId)?.firstName ?? '') : 'RideSync',
      answers: ride.members.filter((m) => m.state !== 'NO_SHOW').map((m) => ({
        firstName: users.get(m.userId)?.firstName ?? '?',
        status: m.state === 'LEFT' ? 'LEFT' as const : m.readyAnswer === 'READY' ? 'READY' as const : 'WAITING' as const })),
    } } : {}),
    findDriverAutoAt: toIso(firstPickupUs(ride) - readyLeadMin(drivers) * 60_000_000),
    ...(ride.hostUserId === me.id && ride.state === 'OPEN' && drivers <= 2 ? { fewDrivers: true } : {}),
    leave: { free: !late, chargeJod: late ? jod(cashDueP(mine, ride.plan.shareP)) : 0, canLeave: mine.state !== 'PICKED_UP' },
    ...(mine.state === 'PICKED_UP' ? { onBoard: true } : {}),
    chat: { group: group.map((m) => chatView(m, users)), unread: 0,
      ...(ride.driverUserId ? { driver: (await repo.listMessages(ride.id, `driver:${me.id}`, 100)).map((m) => chatView(m, users)) } : {}) },
    ...(ride.cancelReason ? { cancelReason: ride.cancelReason } : {}),
    ...(mine.guest && !mine.guest.leave ? { myGuest: { firstName: mine.guest.firstName } } : {}),
    sentInvites: await Promise.all((await repo.listInvitesForRide(ride.id))
      .filter((i) => i.fromUserId === me.id).sort((a, b) => a.at.localeCompare(b.at))
      .map(async (i) => ({ id: i.id, firstName: (await repo.getUser(i.toUserId))?.firstName ?? '?',
        state: ({ PENDING: 'waiting', USED: 'joined', DECLINED: 'declined', EXPIRED: 'expired' } as const)[i.state] }))),
    ...(summary ? { summary: {
      destArea: summary.destArea[me.id] ?? mine.dest.area, arrivedAt: summary.arrivedAt[me.id] ?? ride.closedAt!,
      paidJod: jod(mySeats?.cashP ?? 0), riders: summary.riders.reduce((n, r) => n + r.seats, 0),
      savedJod: mySeats ? jod(mine.soloFareP - cashDueP({ uniDiscount: mine.uniDiscount }, ride.plan.shareP)) : 0,
      outstandingJod: jod(me.outstandingP),
      ...(mine.leave?.late ? { leftLate: { chargedJod: jod(mine.leave.chargedP) } } : {}),
    } } : {}),
  };
}

/** Pending invites to this rider for rides still taking riders (SPEC §3.17 B). */
async function invitesFor(repo: Repo, userId: string): Promise<RiderView['invites']> {
  const out: RiderView['invites'] = [];
  for (const i of await repo.listInvitesForUser(userId)) {
    if (i.state !== 'PENDING') continue;
    const ride = await repo.getRide(i.rideId);
    if (!ride || ride.state !== 'OPEN') continue;
    out.push({
      id: i.id, rideId: ride.id, fromFirstName: (await repo.getUser(i.fromUserId))?.firstName ?? 'A friend',
      destArea: ride.anchor.dest.area, ...(ride.anchor.dest.key ? { destKey: ride.anchor.dest.key } : {}),
      arriveBy: activeMembers(ride).map((m) => m.arriveBy).sort()[0] ?? ride.anchor.arriveBy, category: ride.category,
      hostFirstName: (await repo.getUser(ride.hostUserId))?.firstName ?? '?', pickupArea: ride.anchor.pickup.area,
      riders: activeMembers(ride).reduce((n, m) => n + seatsOf(m), 0), genderMode: ride.genderMode,
      seatsLeft: CATEGORY[ride.category].maxRiders - activeMembers(ride).reduce((n, m) => n + seatsOf(m), 0),
    });
  }
  return out;
}

/** The rider's current Uni plan, with every planned ride (SPEC §3.19). */
async function planFor(repo: Repo, userId: string, nowUs: number): Promise<{ plan?: RiderView['plan'] }> {
  const sub = await repo.getSubscription(userId);
  if (!sub || fromIso(sub.end) < nowUs) return {};
  const trips = (await repo.listPlannedTrips(userId)).filter((t) => t.subscriptionId === sub.id);
  return { plan: {
    kind: sub.kind, end: sub.end, replacementsLeft: sub.replacementsLeft, replacementCredits: sub.replacementCredits, card: { last4: sub.card.last4 },
    trips: trips.map((t) => ({ id: t.id, arriveBy: t.arriveBy, pickupArea: t.pickup.area, destArea: t.dest.area, state: t.state, ...(t.rideId ? { rideId: t.rideId } : {}) })),
  } };
}
