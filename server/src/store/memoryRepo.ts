// In-memory Repo for domain tests. Same contract as prismaRepo; rollback = restore a snapshot.
import { ACTIVE_STATES, type Banner, type ChatMessage, type DemoState, type Driver, type Ride, type User } from '../domain/types.js';
import { createLock } from './lock.js';
import type { Repo, Store } from './repo.js';

interface State {
  users: Map<string, User>; drivers: Map<string, Driver>; rides: Map<string, Ride>;
  messages: ChatMessage[]; banners: Banner[]; demo: DemoState | null;
}
const empty = (): State => ({ users: new Map(), drivers: new Map(), rides: new Map(), messages: [], banners: [], demo: null });
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
