// What a rider may see (ARCH §9.3): their own pickup/destination exactly, everyone else as first name +
// initials. Never other members' coordinates or addresses, never the stop list or route line.
import type { PlaceView, RiderRideView, RiderView } from '@nextstop/shared';
import { fromIso, toIso } from '../clock/amman.js';
import type { Clock } from '../clock/clock.js';
import { activeMembers, jod, seatsOf } from '../domain/bridge.js';
import { driverAssigned, firstPickupUs, isLateNow, type SummaryRecord } from '../domain/rides.js';
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
    me: { id: user.id, firstName: user.firstName, gender: user.gender, sameGenderOnly: user.sameGenderOnly,
      friendCode: user.friendCode, outstandingJod: jod(user.outstandingP) },
    ...(ride ? { ride: await rideView(repo, ride, user, now) } : {}),
    invites: [],
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
  const group = await repo.listMessages(ride.id, 'group', 100);
  const summary = ride.summary as SummaryRecord | undefined;
  const mySeats = summary?.riders.find((r) => r.userId === me.id);
  return {
    id: ride.id, state: ride.state, isHost: ride.hostUserId === me.id,
    category: ride.category, genderMode: ride.genderMode,
    zoneKm: { pickup: ride.zone.pickupKm, dest: ride.zone.destKm },
    seats: seatViews(ride, me.id, users), seatsLeft: Math.max(0, CATEGORY[ride.category].maxRiders - seatsUsed),
    shareJod: jod(ride.plan.shareP), soloJod: jod(mine.soloFareP), myCashDueJod: jod(ride.plan.shareP * seatsOf(mine)),
    beReadyBy: mine.shownPickup,
    effectiveArriveBy: active.map((m) => m.arriveBy).sort()[0] ?? mine.arriveBy,
    myPickup: placeView(mine.pickup), myDest: placeView(mine.dest),
    myStop: { index: pickups.findIndex((s) => s.userId === me.id) + 1, of: pickups.length },
    ...(driver && driverUser ? { driver: { firstName: driverUser.firstName, car: driver.car, plate: driver.plate } } : {}),
    ...(ride.state === 'READY_CHECK' && ride.readyCheck ? { readyCheck: {
      endsAt: ride.readyCheck.endsAt,
      startedByFirstName: ride.readyCheck.startedBy === 'host' ? (users.get(ride.hostUserId)?.firstName ?? '') : 'RideSync',
      answers: ride.members.filter((m) => m.state !== 'NO_SHOW').map((m) => ({
        firstName: users.get(m.userId)?.firstName ?? '?',
        status: m.state === 'LEFT' ? 'LEFT' as const : m.readyAnswer === 'READY' ? 'READY' as const : 'WAITING' as const })),
    } } : {}),
    findDriverAutoAt: toIso(firstPickupUs(ride) - 45 * 60_000_000),
    leave: { free: !late, chargeJod: late ? jod(ride.plan.shareP * seatsOf(mine)) : 0 },
    chat: { group: group.map((m) => chatView(m, users)), unread: 0 },
    ...(ride.cancelReason ? { cancelReason: ride.cancelReason } : {}),
    ...(summary ? { summary: {
      destArea: summary.destArea[me.id] ?? mine.dest.area, arrivedAt: summary.arrivedAt[me.id] ?? ride.closedAt!,
      paidJod: jod(mySeats?.cashP ?? 0), riders: summary.riders.reduce((n, r) => n + r.seats, 0),
      savedJod: mySeats ? jod(mine.soloFareP - ride.plan.shareP) : 0,
      outstandingJod: jod(me.outstandingP),
      ...(mine.leave?.late ? { leftLate: { chargedJod: jod(mine.leave.chargedP) } } : {}),
    } } : {}),
  };
}
