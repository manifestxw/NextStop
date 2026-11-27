// The storage contract (ARCH §4, §7.2). Domain code only sees `Repo`, inside `store.withLock`.
// memoryRepo (tests) and prismaRepo (app) pass the same contract test.
import type { Banner, ChatMessage, DemoState, Driver, Invite, PlannedTrip, Ride, Subscription, User } from '../domain/types.js';

export interface Repo {
  getUser(id: string): Promise<User | null>;
  getUserByToken(token: string): Promise<User | null>;
  getUserBySeedLogin(as: NonNullable<User['seedLogin']>): Promise<User | null>;
  getUserByFriendCode(code: string): Promise<User | null>;
  getUserByPhone(phone: string): Promise<User | null>;
  listUsers(): Promise<User[]>;
  putUser(u: User): Promise<void>;

  getDriver(userId: string): Promise<Driver | null>;
  listDrivers(): Promise<Driver[]>;
  putDriver(d: Driver): Promise<void>;

  getRide(id: string): Promise<Ride | null>;
  listActiveRides(): Promise<Ride[]>;            // state not COMPLETED/CANCELED
  listRidesForUser(userId: string): Promise<Ride[]>;   // any state, the user is (or was) a member
  listRidesByDriver(driverUserId: string): Promise<Ride[]>;   // any state
  putRide(r: Ride): Promise<void>;                // upsert ride + replace its members

  addMessage(m: Omit<ChatMessage, 'seq'>): Promise<ChatMessage>;   // assigns seq = last + 1 per ride
  listMessages(rideId: string, channel: ChatMessage['channel'], limit?: number): Promise<ChatMessage[]>;  // oldest first, last `limit` (100)
  deleteMessages(rideId: string): Promise<void>;

  addBanner(b: Banner): Promise<void>;
  listUnseenBanners(userId: string): Promise<Banner[]>;
  markBannerSeen(id: string): Promise<void>;

  putInvite(i: Invite): Promise<void>;           // one per (ride, invitee): a new invite replaces the old one
  getInvite(id: string): Promise<Invite | null>;
  listInvitesForUser(toUserId: string): Promise<Invite[]>;
  listInvitesForRide(rideId: string): Promise<Invite[]>;
  expireInvites(rideId: string): Promise<void>;   // PENDING → EXPIRED

  getSubscription(userId: string): Promise<Subscription | null>;   // the user's latest plan
  putSubscription(s: Subscription): Promise<void>;
  getPlannedTrip(id: string): Promise<PlannedTrip | null>;
  listPlannedTrips(userId: string): Promise<PlannedTrip[]>;        // by arriveBy
  listPlannedBefore(arriveByIso: string): Promise<PlannedTrip[]>;  // PLANNED, arriveBy ≤ the given time, by arriveBy
  putPlannedTrip(t: PlannedTrip): Promise<void>;

  getDemoState(): Promise<DemoState | null>;
  putDemoState(s: DemoState): Promise<void>;

  wipe(): Promise<void>;                          // demo reset: every table
}

export interface Store {
  /** The single global write lock: commits run one at a time, each in one transaction.
   *  A throw rolls the transaction back. No network calls inside `fn`. */
  withLock<T>(fn: (repo: Repo) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
