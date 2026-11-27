// In-memory Repo for domain tests. Same contract as prismaRepo; rollback = restore a snapshot.
import { ACTIVE_STATES, type Banner, type ChatMessage, type DemoState, type Driver, type Invite, type PlannedTrip, type Ride, type Subscription, type User } from '../domain/types.js';
import { createLock } from './lock.js';
import type { Repo, Store } from './repo.js';

interface State {
  users: Map<string, User>; drivers: Map<string, Driver>; rides: Map<string, Ride>;
  messages: ChatMessage[]; banners: Banner[]; invites: Invite[]; subs: Subscription[]; planned: PlannedTrip[]; demo: DemoState | null;
}
const empty = (): State => ({ users: new Map(), drivers: new Map(), rides: new Map(), messages: [], banners: [], invites: [], subs: [], planned: [], demo: null });
const c = structuredClone;   // never hand out or keep references that could change outside the lock

export function createMemoryStore(): Store {
  let s = empty();
  const lock = createLock();
  const repo: Repo = {
    getUser: async (id) => c(s.users.get(id) ?? null),
    getUserByToken: async (t) => c([...s.users.values()].find((u) => u.token === t) ?? null),
    getUserBySeedLogin: async (as) => c([...s.users.values()].find((u) => u.seedLogin === as) ?? null),
    getUserByFriendCode: async (code) => c([...s.users.values()].find((u) => u.friendCode === code) ?? null),
    listUsers: async () => c([...s.users.values()]),
    putUser: async (u) => { s.users.set(u.id, c(u)); },
    getDriver: async (id) => c(s.drivers.get(id) ?? null),
    listDrivers: async () => c([...s.drivers.values()]),
    putDriver: async (d) => { s.drivers.set(d.userId, c(d)); },
    getRide: async (id) => c(s.rides.get(id) ?? null),
    listActiveRides: async () => c([...s.rides.values()].filter((r) => ACTIVE_STATES.includes(r.state))),
    listRidesForUser: async (uid) => c([...s.rides.values()].filter((r) => r.members.some((m) => m.userId === uid))),
    listRidesByDriver: async (did) => c([...s.rides.values()].filter((r) => r.driverUserId === did)),
    putRide: async (r) => { s.rides.set(r.id, c(r)); },
    addMessage: async (m) => {
      const seq = Math.max(0, ...s.messages.filter((x) => x.rideId === m.rideId).map((x) => x.seq)) + 1;
      const msg = { ...c(m), seq };
      s.messages.push(msg);
      return c(msg);
    },
    listMessages: async (rideId, channel, limit = 100) =>
      c(s.messages.filter((m) => m.rideId === rideId && m.channel === channel).sort((a, b) => a.seq - b.seq).slice(-limit)),
    deleteMessages: async (rideId) => { s.messages = s.messages.filter((m) => m.rideId !== rideId); },
    addBanner: async (b) => { s.banners.push(c(b)); },
    listUnseenBanners: async (uid) => c(s.banners.filter((b) => b.userId === uid && !b.seen)),
    markBannerSeen: async (id) => { for (const b of s.banners) if (b.id === id) b.seen = true; },
    putInvite: async (i) => { s.invites = s.invites.filter((x) => x.id !== i.id && !(x.rideId === i.rideId && x.toUserId === i.toUserId)); s.invites.push(c(i)); },
    getInvite: async (id) => c(s.invites.find((x) => x.id === id) ?? null),
    listInvitesForUser: async (uid) => c(s.invites.filter((x) => x.toUserId === uid)),
    listInvitesForRide: async (rid) => c(s.invites.filter((x) => x.rideId === rid)),
    expireInvites: async (rid) => { for (const x of s.invites) if (x.rideId === rid && x.state === 'PENDING') x.state = 'EXPIRED'; },
    getSubscription: async (uid) => c(s.subs.filter((x) => x.userId === uid).sort((a, b) => b.start.localeCompare(a.start))[0] ?? null),
    putSubscription: async (x) => { s.subs = s.subs.filter((y) => y.id !== x.id); s.subs.push(c(x)); },
    getPlannedTrip: async (id) => c(s.planned.find((x) => x.id === id) ?? null),
    listPlannedTrips: async (uid) => c(s.planned.filter((x) => x.userId === uid).sort((a, b) => a.arriveBy.localeCompare(b.arriveBy))),
    listPlannedBefore: async (iso) => c(s.planned.filter((x) => x.state === 'PLANNED' && x.arriveBy <= iso).sort((a, b) => a.arriveBy.localeCompare(b.arriveBy))),
    putPlannedTrip: async (x) => { s.planned = s.planned.filter((y) => y.id !== x.id); s.planned.push(c(x)); },
    getDemoState: async () => c(s.demo),
    putDemoState: async (d) => { s.demo = c(d); },
    wipe: async () => { s = empty(); },
  };
  return {
    withLock: (fn) => lock(async () => {
      const backup = c(s);
      try { return await fn(repo); } catch (e) { s = backup; throw e; }
    }),
    close: async () => undefined,
  };
}
