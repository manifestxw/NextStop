// Ride state machine (SPEC §3.3, ARCH §7.3) as plain functions on a ride copy. They never touch I/O:
// they mutate `ride`, push effects into `fx`, and the command layer persists both inside the lock.
import { ammanParts, fromIso, toIso } from '../clock/amman.js';
import { leave as engineLeave } from '../engine/leave.js';
import { US_PER_MIN } from '../engine/time.js';
import type { Plan, TimedMatrix, Us } from '../engine/types.js';
import { activeMembers, frozenEnginePlan, jod, piastres, seatsOf, toRidePlan } from './bridge.js';
import { system, type Effects } from './effects.js';
import { illegal } from './errors.js';
import type { Driver, Member, Place, Ride, User } from './types.js';

const MIN = US_PER_MIN;
export const firstPickupUs = (ride: Ride) => fromIso(ride.plan.firstPickup);
export const driverAssigned = (ride: Ride) => !!ride.driverUserId && (ride.state === 'ACCEPTED' || ride.state === 'IN_PROGRESS');
/** Late = a driver is assigned and it's under 30 min to the first pickup (SPEC §3.10). */
export const isLateNow = (ride: Ride, now: Us) => driverAssigned(ride) && (firstPickupUs(ride) - now) / MIN < 30;
const touchAll = (ride: Ride, fx: Effects) => {
  for (const m of ride.members) fx.touched.add(m.userId);
  if (ride.driverUserId) fx.touched.add(ride.driverUserId);
  for (const d of ride.dispatch?.offeredTo ?? []) fx.touched.add(d);
};

/** Apply a fresh engine plan to the active members (before the freeze): pickups and shares move. */
export function applyPlan(ride: Ride, p: Plan, members: Member[], shareP: number) {
  ride.plan = toRidePlan(p, members, shareP);
  members.forEach((m, i) => { m.shownPickup = toIso(p.pick[i]!); });
}

export function cancel(ride: Ride, now: Us, fx: Effects, why: 'no-driver' | 'everyone-left') {
  touchAll(ride, fx);
  ride.state = 'CANCELED';
  ride.closedAt = toIso(now);
  ride.version++;
  // Credits are paid to nobody; every late leaver's charge is reversed (SPEC §3.10).
  for (const m of ride.members) {
    for (const rec of [m.leave, m.guest?.leave]) {
      if (rec?.late && !rec.reversed) { fx.outstanding.push({ userId: m.userId, deltaP: -rec.chargedP }); rec.reversed = true; }
    }
  }
  if (why === 'no-driver') {
    for (const m of activeMembers(ride)) fx.banners.push({ userId: m.userId, text: 'No driver found. The ride was canceled, no fees.', tone: 'warn' });
  }
  if (ride.driverUserId) fx.banners.push({ userId: ride.driverUserId, text: 'The ride was canceled', tone: 'warn' });
}

export function startReadyCheck(ride: Ride, now: Us, realMs: number, by: 'host' | 'auto', hostName: string, fx: Effects) {
  if (ride.state !== 'OPEN') throw illegal('The ready check already started');
  touchAll(ride, fx);
  ride.state = 'READY_CHECK';
  ride.frozen = { at: toIso(now) };
  ride.readyCheck = { startedAt: toIso(now), startedRealMs: realMs, endsAt: toIso(now + 5 * MIN), startedBy: by };
  ride.version++;
  system(fx, ride.id, by === 'host' ? `${hostName} started the ready check` : 'The ready check started');
  system(fx, ride.id, 'Pickup times are now fixed');
}

/** READY_CHECK → DISPATCHED with the remaining riders (no answer = ready), or CANCELED if none remain. */
export function dispatch(ride: Ride, now: Us, drivers: Driver[], fx: Effects) {
  const active = activeMembers(ride);
  if (active.length === 0) return cancel(ride, now, fx, 'everyone-left');
  for (const m of active) if (!m.readyAnswer) { m.readyAnswer = 'READY'; m.state = 'READY'; }
  ride.state = 'DISPATCHED';
  // shortcut: demo mode offers to every seeded driver; live mode's "within 5 km of the first pickup" comes with real GPS.
  ride.dispatch = { at: toIso(now), expiresAt: toIso(firstPickupUs(ride) - 15 * MIN), offeredTo: drivers.filter((d) => !d.rejectedRideIds.includes(ride.id)).map((d) => d.userId) };
  ride.version++;
  touchAll(ride, fx);
}

export function answerReady(ride: Ride, userId: string, firstName: string, now: Us, drivers: Driver[], fx: Effects) {
  const m = activeMembers(ride).find((x) => x.userId === userId);
  if (!m || ride.state !== 'READY_CHECK') return;
  if (m.readyAnswer === 'READY') return;   // double tap
  m.readyAnswer = 'READY'; m.state = 'READY';
  ride.version++;
  touchAll(ride, fx);
  system(fx, ride.id, `${firstName} is ready`);
  if (activeMembers(ride).every((x) => x.readyAnswer === 'READY')) dispatch(ride, now, drivers, fx);
}

/** Before the freeze: the leaver goes, the rest re-plan (caller passes the new plan). Host passes on. */
export function leaveOpen(ride: Ride, userId: string, firstName: string, now: Us, fx: Effects,
  next: { plan: Plan; members: Member[]; shareP: number; anchor?: Ride['anchor'] } | null) {
  const m = ride.members.find((x) => x.userId === userId)!;
  touchAll(ride, fx);
  m.state = 'LEFT';
  m.leave = { at: toIso(now), late: false, chargedP: 0 };
  ride.version++;
  system(fx, ride.id, `${firstName} left`);
  if (!next) return cancel(ride, now, fx, 'everyone-left');
  if (ride.hostUserId === userId) { ride.hostUserId = next.members[0]!.userId; if (next.anchor) ride.anchor = next.anchor; }
  applyPlan(ride, next.plan, next.members, next.shareP);
}

/** After the freeze: same stop order and first pickup, pickups never move; late leavers pay their share. */
export function leaveFrozen(ride: Ride, userId: string, firstName: string, now: Us, m: TimedMatrix, order: string[],
  priceFactor: number, fx: Effects, drivers: Driver[]) {
  const active = activeMembers(ride);
  const idx = active.findIndex((x) => x.userId === userId);
  const leaver = active[idx]!;
  const nSeats = active.reduce((n, x) => n + seatsOf(x), 0);
  touchAll(ride, fx);
  const late = isLateNow(ride, now);
  const seatsLeaving = seatsOf(leaver);
  // A +1 leaves with the member: both seats go, and a late charge covers both (SPEC §3.17 A).
  // The engine charges one share itself, so the +1's share is passed as an extra held credit.
  const extraCredit = late ? jod(ride.plan.shareP) * (seatsLeaving - 1) : 0;
  const r = engineLeave(m, frozenEnginePlan(ride, active, order), idx, nSeats - (seatsLeaving - 1), jod(ride.plan.shareP), now,
    { existingCredits: jod(ride.creditsP) + extraCredit, driverAssigned: driverAssigned(ride), priceFactor });
  leaver.state = 'LEFT';
  const chargedP = late ? ride.plan.shareP * seatsLeaving : 0;
  leaver.leave = { at: toIso(now), late, chargedP };
  ride.version++;
  system(fx, ride.id, `${firstName} left`);
  if (nSeats - seatsLeaving <= 0) {
    if (late) { fx.outstanding.push({ userId, deltaP: chargedP }); ride.creditsP += chargedP; }
    return cancel(ride, now, fx, 'everyone-left');   // the cancel reverses that charge again
  }
  if (late) { fx.outstanding.push({ userId, deltaP: chargedP }); ride.creditsP += chargedP; }
  ride.plan = { ...ride.plan, stops: ride.plan.stops.filter((s) => s.userId !== userId), fareJod: r.fare, shareP: piastres(r.share) };
  if (ride.hostUserId === userId) ride.hostUserId = activeMembers(ride)[0]!.userId;
  if (ride.driverUserId) {
    const cash = jod(ride.plan.shareP * activeMembers(ride).reduce((n, x) => n + seatsOf(x), 0));
    fx.banners.push({ userId: ride.driverUserId, tone: 'danger',
      text: `${firstName} canceled. Collect JOD ${cash.toFixed(2)} cash · JOD ${jod(ride.creditsP).toFixed(2)} credit at trip end` });
  }
  if (ride.state === 'READY_CHECK' && activeMembers(ride).every((x) => x.readyAnswer === 'READY')) dispatch(ride, now, drivers, fx);
}

export function accept(ride: Ride, driver: Driver, driverName: string, now: Us, matrix: NonNullable<Ride['locked']>['matrix'], order: string[], fx: Effects) {
  ride.state = 'ACCEPTED';
  ride.driverUserId = driver.userId;
  ride.locked = { at: toIso(now), matrix, order, tariff: ammanParts(fromIso(ride.plan.firstPickup)).hour < 6 ? 'NIGHT' : 'DAY' };
  ride.version++;
  touchAll(ride, fx);
  system(fx, ride.id, `${driverName} is your driver`);
}

export interface SummaryRecord {
  arrivedAt: Record<string, string>; destArea: Record<string, string>;
  riders: { userId: string; firstName: string; cashP: number; seats: number }[];
  creditP: number; totalP: number;
}

/** Demo "Complete trip" (and the last drop-off, P1): COMPLETED, credits paid to the driver, summary written. */
export function complete(ride: Ride, now: Us, users: Map<string, User>, fx: Effects) {
  if (ride.state !== 'ACCEPTED' && ride.state !== 'IN_PROGRESS') throw illegal('Only an accepted ride can be completed');
  const active = activeMembers(ride);
  for (const s of ride.plan.stops) s.done = true;
  for (const m of active) m.state = 'DROPPED_OFF';
  ride.state = 'COMPLETED';
  ride.closedAt = toIso(now);
  ride.version++;
  fx.driverCredit.push({ userId: ride.driverUserId!, deltaP: ride.creditsP });
  const drop = (u: string) => ride.plan.stops.find((s) => s.kind === 'D' && s.userId === u)?.at ?? ride.plan.firstPickup;
  const riders = active.map((m) => ({ userId: m.userId, firstName: users.get(m.userId)!.firstName, cashP: ride.plan.shareP * seatsOf(m), seats: seatsOf(m) }));
  const summary: SummaryRecord = {
    arrivedAt: Object.fromEntries(ride.members.map((m) => [m.userId, drop(m.userId)])),
    destArea: Object.fromEntries(ride.members.map((m) => [m.userId, m.dest.area])),
    riders, creditP: ride.creditsP, totalP: riders.reduce((a, r) => a + r.cashP, 0) + ride.creditsP,
  };
  ride.summary = summary;
  touchAll(ride, fx);
}

export const newMember = (userId: string, pickup: Place, dest: Place, arriveBy: string, now: Us, soloFareP: number, soloInCarMin: number): Member => ({
  userId, pickup, dest, arriveBy, joinedAt: toIso(now), state: 'JOINED',
  firstShownPickup: '', shownPickup: '', soloFareP, soloInCarMin,
});
