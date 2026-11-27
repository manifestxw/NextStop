// Stored domain records (ARCH §4). Times are ISO strings with +03:00; money is integer piastres (`…P`).
import type { Category, DemoSettings, Gender, GenderMode, RideState, Role } from '@nextstop/shared';
import type { LatLng } from '../engine/types.js';
import type { MatrixSpec } from '../travel/provider.js';

export type MemberState = 'JOINED' | 'READY' | 'PICKED_UP' | 'DROPPED_OFF' | 'LEFT' | 'NO_SHOW';

/** `area` = the coarse label other riders see ("City Center area"), SPEC §2.6. */
export interface Place { key?: string; placeId?: string; name: string; area: string; lat: number; lng: number }

export interface User {
  id: string; token: string; epoch: number;       // epoch bumps on reset → logs everyone out
  role: Role; firstName: string; gender: Gender;  // gender immutable after signup
  sameGenderOnly: boolean; friendCode: string;
  viewSeq: number; outstandingP: number;
  isSim: boolean; seedLogin?: 'lina' | 'sara' | 'omar';
  createdAt: string;
}

export interface Driver {
  userId: string; car: string; plate: string; base: Place;
  position?: Place;                               // demo-set location (P2)
  creditBalanceP: number;                         // credits from COMPLETED rides only
  rejectedRideIds: string[];
}

export interface LeaveRecord { at: string; late: boolean; chargedP: number; reversed?: boolean }

export interface Member {
  userId: string; pickup: Place; dest: Place; arriveBy: string;
  joinedAt: string; state: MemberState;
  firstShownPickup: string;                       // rule 9 baseline
  shownPickup: string;                            // "Be ready by"; final once ride.frozen is set
  soloFareP: number; soloInCarMin: number;        // rule 8 and 10 baselines
  readyAnswer?: 'READY' | 'CANCEL';
  guest?: { firstName: string; gender: Gender; leave?: LeaveRecord };   // +1, SPEC §3.17 A
  invitedBy?: string;
  uniDiscount?: boolean; plannedTripId?: string;  // SPEC §3.19
  leave?: LeaveRecord;
}

export interface Stop { id: string; kind: 'P' | 'D'; userId: string; place: Place; at: string; done: boolean }

export interface RidePlan {
  stops: Stop[]; firstPickup: string; km: number; durMin: number;
  fareJod: number;                                // full fare, 2 dp, from the engine
  shareP: number;
  inCarMin: Record<string, number>;
}

export interface Ride {
  id: string; version: number;                    // bumps on every mutation (ARCH §7.2)
  state: RideState; hostUserId: string; gender: Gender;
  category: Category; genderMode: GenderMode;
  zone: { pickupKm: number; destKm: number };
  anchor: { pickup: Place; dest: Place; arriveBy: string; route: LatLng[]; km: number };
  members: Member[];                              // includes LEFT/NO_SHOW for history
  plan: RidePlan;
  frozen?: { at: string };
  locked?: { at: string; matrix: MatrixSpec; tariff: 'DAY' | 'NIGHT' };
  creditsP: number;
  readyCheck?: { startedAt: string; startedRealMs: number; endsAt: string; startedBy: 'host' | 'auto' };
  dispatch?: { at: string; expiresAt: string; offeredTo: string[] };
  driverUserId?: string;
  summary?: unknown;                              // written at COMPLETED (T6)
  createdAt: string; closedAt?: string;
}

export interface ChatMessage {
  id: string; rideId: string; seq: number;
  channel: 'group' | `driver:${string}`;
  kind: 'user' | 'system'; fromUserId?: string;
  text: string;                                   // already masked
  at: string;
}

export interface Banner { id: string; userId: string; text: string; tone: 'info' | 'warn' | 'danger'; at: string; seen: boolean }

export interface DemoState { epoch: number; nowIso: string; paused: boolean; settings: DemoSettings }

export const ACTIVE_STATES: RideState[] = ['OPEN', 'READY_CHECK', 'DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'];
