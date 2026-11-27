// What a driver may see (ARCH §9.3): offered rides' stops without coordinates; after accepting, every
// stop with coordinates, shares and totals. Never the group chat.
import type { ChatMessageView, DriverOffer, DriverStop, DriverTripView, DriverView } from '@nextstop/shared';
import { fromIso } from '../clock/amman.js';
import type { Clock } from '../clock/clock.js';
import { activeMembers, cashDueP, jod, seatsOf, uniCreditP } from '../domain/bridge.js';
import type { SummaryRecord } from '../domain/rides.js';
import type { Driver, Ride, User } from '../domain/types.js';
import type { Repo } from '../store/repo.js';
import { bannerView, chatView, clockView } from './common.js';

const DAY_US = 24 * 3_600_000_000;

async function stopsOf(repo: Repo, ride: Ride, withPlaces: boolean): Promise<DriverStop[]> {
  const active = activeMembers(ride);
  const out: DriverStop[] = [];
  for (const s of ride.plan.stops) {
    const m = active.find((x) => x.userId === s.userId);
    if (!m) continue;
    const u = await repo.getUser(s.userId);
    out.push({
      id: s.id, kind: s.kind, firstName: u?.firstName ?? '?',
      ...(m.guest && !m.guest.leave ? { guestFirstName: m.guest.firstName } : {}),
      shortAddress: s.place.name, at: s.at, done: s.done,
      ...(s.kind === 'P' ? { shareJod: jod(ride.plan.shareP), cashDueJod: jod(cashDueP(m, ride.plan.shareP)), uniCreditJod: jod(uniCreditP(m, ride.plan.shareP)) } : {}),
      ...(withPlaces ? { place: { lat: s.place.lat, lng: s.place.lng } } : {}),
    });
  }
  return out;
}

const collectP = (ride: Ride) => activeMembers(ride).reduce((n, m) => n + cashDueP(m, ride.plan.shareP), 0);
const uniP = (ride: Ride) => activeMembers(ride).reduce((n, m) => n + uniCreditP(m, ride.plan.shareP), 0);

export async function driverView(repo: Repo, user: User, driver: Driver, clock: Clock, epoch: number): Promise<DriverView> {
  const now = clock.now();
  const rides = await repo.listActiveRides();
  const mine = rides.find((r) => r.driverUserId === user.id && (r.state === 'ACCEPTED' || r.state === 'IN_PROGRESS'));
  const offers: DriverOffer[] = [];
  if (!mine) {
    for (const r of rides.filter((x) => x.state === 'DISPATCHED' && x.dispatch?.offeredTo.includes(user.id) && !driver.rejectedRideIds.includes(x.id))) {
      offers.push({
        rideId: r.id, category: r.category, genderMode: r.genderMode, firstPickupAt: r.plan.firstPickup, respondBy: r.dispatch!.expiresAt,
        fareJod: r.plan.fareJod, riders: activeMembers(r).reduce((n, m) => n + seatsOf(m), 0), collectJod: jod(collectP(r)),
        km: r.plan.km, min: r.plan.durMin, stops: await stopsOf(repo, r, false),
      });
    }
  }
  let trip: DriverTripView | undefined;
  const t = mine ?? (await repo.listRidesByDriver(user.id))
    .filter((r) => r.state === 'COMPLETED' && r.closedAt && now - fromIso(r.closedAt) < DAY_US)
    .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))[0];
  if (t) {
    const summary = t.summary as SummaryRecord | undefined;
    trip = {
      rideId: t.id, state: t.state, category: t.category,
      riders: activeMembers(t).reduce((n, m) => n + seatsOf(m), 0) || (summary?.riders.reduce((n, r) => n + r.seats, 0) ?? 0),
      fareJod: t.plan.fareJod, collectJod: jod(summary ? summary.totalP - summary.creditP - (summary.uniCreditP ?? 0) : collectP(t)),
      creditJod: jod(t.creditsP), uniCreditJod: jod(summary?.uniCreditP ?? uniP(t)), stops: await stopsOf(repo, t, true),
      ...(mine && t.plan.route ? { route: t.plan.route } : {}),
      chats: await chatsFor(repo, t),
      ...(summary ? { summary: {
        riders: summary.riders.map((r) => ({ firstName: r.firstName, cashJod: jod(r.cashP) })),
        creditJod: jod(summary.creditP), uniCreditJod: jod(summary.uniCreditP ?? 0), totalJod: jod(summary.totalP),
      } } : {}),
    };
  }
  return {
    role: 'driver', epoch, viewSeq: user.viewSeq,
    me: { id: user.id, firstName: user.firstName, car: driver.car, plate: driver.plate },
    offers, ...(trip ? { trip } : {}),
    banners: (await repo.listUnseenBanners(user.id)).map(bannerView),
    clock: clockView(clock),
  };
}

/** The driver's private thread with each rider in the trip (P1). */
async function chatsFor(repo: Repo, ride: Ride): Promise<Record<string, ChatMessageView[]>> {
  const users = new Map<string, User>();
  for (const id of [...ride.members.map((m) => m.userId), ride.driverUserId ?? '']) { const u = id && await repo.getUser(id); if (u) users.set(u.id, u); }
  const out: Record<string, ChatMessageView[]> = {};
  for (const m of ride.members) out[m.userId] = (await repo.listMessages(ride.id, `driver:${m.userId}`, 100)).map((x) => chatView(x, users));
  return out;
}
