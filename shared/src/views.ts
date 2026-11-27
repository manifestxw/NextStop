// What the server sends to phones (ARCH §9.3). Views are full snapshots, never deltas.
// Money is in JOD with 2 decimals (`…Jod`); times are ISO strings with the +03:00 offset.
// Privacy lives on the server (`server/src/views/`); these shapes only carry what each viewer may see.

export type Iso = string;
export type Gender = 'F' | 'M';
export type Role = 'rider' | 'driver';
export type Category = 'economy' | 'comfort' | 'airport';
export type GenderMode = 'same' | 'mixed';
export type RideState = 'OPEN' | 'READY_CHECK' | 'DISPATCHED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type TravelSource = 'snapshot' | 'google' | 'fixed';

export interface LatLng { lat: number; lng: number }
export interface ClockView { nowIso: Iso; paused: boolean }
export interface BuildStamp { hash: string; builtAt: Iso }

export interface Health {
  ok: boolean;
  buildStamp: BuildStamp | null;
  clock?: ClockView;        // from T4
  source?: TravelSource;    // from T4
}

/** A place the viewer is allowed to see exactly (their own pickup/destination, or a driver's stops). */
export interface PlaceView extends LatLng { key?: string; name: string; area: string }

export interface BannerView { id: string; text: string; tone: 'info' | 'warn' | 'danger'; at: Iso }

export interface ChatMessageView {
  id: string; rideId: string; seq: number;
  channel: 'group' | `driver:${string}`;
  kind: 'user' | 'system';
  fromUserId?: string; fromFirstName?: string;
  text: string;             // already masked
  at: Iso;
}

/** One seat in a seat meter. Other riders appear only as first name + initials. */
export interface SeatView {
  initials: string; firstName: string;
  isMe: boolean; isHost: boolean;
  guestOf?: string;         // +1 (SPEC §3.17 A): the bringer's first name
  ready?: 'READY' | 'WAITING' | 'LEFT';   // during the ready check
}

// ---------- Quote, search ----------

export interface CategoryQuote {
  category: Category;
  available: boolean;       // Airport only when the destination is the airport
  maxRiders: number;
  soloJod: number;          // "If nobody joins"
  fromJod: number;          // estimate at max riders
  estimates: { riders: number; eachJod: number }[];
  beReadyBy: Iso;
  zoneKm: { pickup: number; dest: number };
  uniTrip: boolean;         // SPEC §3.19: own pickup or destination at a campus
}
export interface QuoteView { categories: CategoryQuote[] }

/** A ride in "Rides going your way". Area names only, never coordinates. */
export interface MatchCard {
  rideId: string;
  hostFirstName: string;
  category: Category; genderMode: GenderMode; gender: Gender;
  seats: { initials: string; isGuest: boolean }[];
  seatsLeft: number;
  pickupArea: string; destArea: string;
  effectiveArriveBy: Iso;
  myPickupAt: Iso;          // "Pickup ~7:21 AM"
  eachJod: number;          // real recomputed share if you join
  myPaysJod: number;        // after a Uni plan discount, else = eachJod
}

// ---------- Rider ----------

export interface RiderSummary {
  destArea: string; arrivedAt: Iso;
  paidJod: number; riders: number; savedJod: number;
  outstandingJod: number;
  leftLate?: { chargedJod: number };
}

export interface RiderRideView {
  id: string; state: RideState; isHost: boolean;
  category: Category; genderMode: GenderMode;
  zoneKm: { pickup: number; dest: number };
  seats: SeatView[]; seatsLeft: number;
  shareJod: number; soloJod: number;
  myCashDueJod: number;     // what I pay the driver: my share, after any Uni plan discount
  uniDiscountJod?: number;  // SPEC §3.19, e.g. 0.45
  beReadyBy: Iso; effectiveArriveBy: Iso;
  myPickup: PlaceView; myDest: PlaceView;
  myStop: { index: number; of: number };          // "Pickup 2 of 3"
  driver?: { firstName: string; car: string; plate: string };
  readyCheck?: { endsAt: Iso; startedByFirstName: string; answers: { firstName: string; status: 'READY' | 'WAITING' | 'LEFT' }[] };
  findDriverAutoAt: Iso;
  leave: { free: boolean; chargeJod: number };    // what "Leave ride" would cost right now
  myGuest?: { firstName: string };                // P1
  pendingInvites?: { firstName: string }[];       // P1
  chat: { group: ChatMessageView[]; driver?: ChatMessageView[]; unread: number };
  summary?: RiderSummary;
}

export interface InviteView { id: string; fromFirstName: string; destArea: string; arriveBy: Iso; category: Category }

export interface PlanView {
  kind: 'weekly' | 'semester'; end: Iso; replacementsLeft: number;
  card: { last4: string };
  trips: { id: string; arriveBy: Iso; pickupArea: string; destArea: string; state: 'PLANNED' | 'PLACED' | 'CANCELED' | 'UNPLACEABLE'; rideId?: string }[];
}

export interface RiderView {
  role: 'rider'; epoch: number; viewSeq: number;
  me: { id: string; firstName: string; gender: Gender; sameGenderOnly: boolean; friendCode: string; outstandingJod: number };
  ride?: RiderRideView;
  invites: InviteView[];    // P1
  plan?: PlanView;          // P1
  banners: BannerView[];
  clock: ClockView;
}

// ---------- Driver ----------

export interface DriverStop {
  id: string; kind: 'P' | 'D';
  firstName: string; guestFirstName?: string;     // "Lina +1"
  shortAddress: string;
  at: Iso;
  shareJod?: number;        // pickups: share per seat
  cashDueJod?: number;      // pickups: cash this stop pays (seats, after discounts)
  uniCreditJod?: number;    // pickups: paid by RideSync at completion
  done: boolean;
  place?: LatLng;           // only after accept
}

export interface DriverOffer {
  rideId: string; category: Category; genderMode: GenderMode;
  firstPickupAt: Iso; respondBy: Iso;
  fareJod: number; riders: number; collectJod: number;
  km: number; min: number;
  stops: DriverStop[];
}

export interface DriverSummary {
  riders: { firstName: string; cashJod: number }[];
  creditJod: number; uniCreditJod: number; totalJod: number;
}

export interface DriverTripView {
  rideId: string; state: RideState; category: Category;
  riders: number; fareJod: number;
  collectJod: number; creditJod: number; uniCreditJod: number;
  stops: DriverStop[];
  route?: LatLng[];         // P1
  chats?: Record<string, ChatMessageView[]>;     // P1, keyed by rider id
  summary?: DriverSummary;
}

export interface DemandSpotView {
  center: LatLng; area: string; points: number;
  radiusKm: number; perHour: number; km: number; min: number;
}
export interface DemandView { spots: DemandSpotView[]; bestIndex: number | null; inside: boolean; sample: boolean }

export interface DriverView {
  role: 'driver'; epoch: number; viewSeq: number;
  me: { id: string; firstName: string; car: string; plate: string };
  offers: DriverOffer[];
  trip?: DriverTripView;
  demand?: DemandView;      // P2
  banners: BannerView[];
  clock: ClockView;
}

export type View = RiderView | DriverView;

// ---------- Demo menu ----------

export interface DemoSettings {
  source: TravelSource; offlineFallbackActive: boolean;
  traffic: 'normal' | 'heavy' | 'jam'; weather: 'clear' | 'rain';
  driversNearby: 2 | 8 | 20; simAutoReady: boolean;
}
export interface DemoView {
  buildStamp: BuildStamp | null; clock: ClockView; settings: DemoSettings;
  rides: { id: string; state: RideState; hostFirstName: string; riders: number; firstPickupAt: Iso }[];
}
