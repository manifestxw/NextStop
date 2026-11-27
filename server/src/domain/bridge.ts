// Engine ↔ domain: build engine inputs from stored members, and stored plans from engine results.
// Point layout: member k in `order` has pickup at index 2k and destination at 2k + 1.
import { fromIso, toIso } from '../clock/amman.js';
import { CATEGORY } from '../engine/zone.js';
import type { LatLng, Plan, RiderIn, Stop as EngineStop, Us } from '../engine/types.js';
import type { Config } from '../config.js';
import type { Member, Ride, RidePlan, User } from './types.js';

export const ACTIVE_MEMBER: Member['state'][] = ['JOINED', 'READY', 'PICKED_UP'];
export const activeMembers = (ride: Pick<Ride, 'members'>) => ride.members.filter((m) => ACTIVE_MEMBER.includes(m.state));
export const seatsOf = (m: Pick<Member, 'guest'>) => (m.guest && !m.guest.leave ? 2 : 1);

export const points = (members: Pick<Member, 'pickup' | 'dest'>[]): LatLng[] =>
  members.flatMap((m) => [{ lat: m.pickup.lat, lng: m.pickup.lng }, { lat: m.dest.lat, lng: m.dest.lng }]);

export const priceFactor = (cfg: Config, ride: Pick<Ride, 'category'>) => cfg.calibration * CATEGORY[ride.category].price;

export function riderIn(m: Pick<Member, 'userId' | 'arriveBy' | 'guest'>, order: string[], user: User, ride: Pick<Ride, 'category'>): RiderIn {
  const k = order.indexOf(m.userId);
  return {
    id: m.userId, gender: user.gender, p: 2 * k, d: 2 * k + 1, by: fromIso(m.arriveBy),
    category: ride.category, sameGenderOnly: user.sameGenderOnly,
    ...(m.guest && !m.guest.leave ? { guest: { gender: m.guest.gender } } : {}),
  };
}

/** Engine plan → stored plan. `members` are in the engine's rider order. */
export function toRidePlan(p: Plan, members: Member[], shareP: number): RidePlan {
  const inCarMin: Record<string, number> = {};
  for (const [i, v] of Object.entries(p.incar)) inCarMin[members[+i]!.userId] = v;
  return {
    stops: p.stops.map((s) => {
      const m = members[s.rider]!;
      return { id: `${s.kind}-${m.userId}`, kind: s.kind, userId: m.userId, place: s.kind === 'P' ? m.pickup : m.dest,
        at: toIso((s.kind === 'P' ? p.pick : p.drop)[s.rider]!), done: false };
    }),
    firstPickup: toIso(p.T0), km: p.km, durMin: p.dur, fareJod: p.fare, shareP, inCarMin,
  };
}

/** Stored (frozen) plan → engine plan over the active members, for leave() with unchanged pickups. */
export function frozenEnginePlan(ride: Ride, active: Member[], order: string[]): Pick<Plan, 'stops' | 'T0' | 'pick'> {
  const idx = (u: string) => active.findIndex((m) => m.userId === u);
  const stops: EngineStop[] = ride.plan.stops
    .filter((s) => idx(s.userId) >= 0)
    .map((s) => ({ kind: s.kind, rider: idx(s.userId), at: 2 * order.indexOf(s.userId) + (s.kind === 'D' ? 1 : 0) }));
  const pick: Record<number, Us> = {};
  active.forEach((m, i) => { pick[i] = fromIso(m.shownPickup); });
  return { stops, T0: fromIso(ride.plan.firstPickup), pick };
}

export const lastDropUs = (plan: RidePlan): Us => Math.max(...plan.stops.filter((s) => s.kind === 'D').map((s) => fromIso(s.at)));
export const jod = (p: number) => Math.round(p) / 100;
export const piastres = (j: number) => Math.round(j * 100);
