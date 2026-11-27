// Request bodies, validated with zod on the server at the trust boundary (ARCH §7.1).
// The client uses the same schemas to build bodies; the server never trusts them further.
import { z } from 'zod';

export const Gender = z.enum(['F', 'M']);
export const Role = z.enum(['rider', 'driver']);
export const Category = z.enum(['economy', 'comfort', 'airport']);
export const IsoTime = z.iso.datetime({ offset: true });

/** Jordan's bounding box (ARCH §15): places outside it are rejected. */
const JORDAN = { minLat: 29.1, maxLat: 33.4, minLng: 34.9, maxLng: 39.4 };

/** A seed place by key (P0 quick-pick chips), or a Google place from the places proxy (P1).
 *  The server resolves the area name itself, so a client can't spoof what others see. */
export const PlaceRef = z.union([
  z.object({ key: z.string().min(1).max(20) }).strict(),
  z.object({
    placeId: z.string().min(1).max(300),
    name: z.string().trim().min(1).max(120),
    lat: z.number().min(JORDAN.minLat).max(JORDAN.maxLat),
    lng: z.number().min(JORDAN.minLng).max(JORDAN.maxLng),
  }).strict(),
]);

const FirstName = z.string().trim().min(1).max(30);

export const SignupBody = z.object({ firstName: FirstName, gender: Gender, role: Role }).strict();
export const DemoLoginBody = z.object({ as: z.enum(['lina', 'sara', 'omar']) }).strict();

export const QuoteBody = z.object({ pickup: PlaceRef, dest: PlaceRef, arriveBy: IsoTime }).strict();
export const TripBody = QuoteBody.extend({ category: Category, sameGenderOnly: z.boolean() }).strict();
export const SearchBody = TripBody;
export const CreateRideBody = TripBody;
export const JoinBody = TripBody.extend({ inviteId: z.string().min(1).optional() }).strict();

export const LeaveBody = z.object({ acceptCharge: z.boolean().optional() }).strict();
export const ReadyBody = z.object({ answer: z.enum(['READY', 'CANCEL']) }).strict();
export const ChatBody = z.object({
  channel: z.union([z.literal('group'), z.templateLiteral(['driver:', z.string().min(1)])]),
  text: z.string().trim().min(1).max(300),
}).strict();

// ---------- P1: friends (SPEC §3.17) ----------
export const GuestBody = z.object({ firstName: FirstName, gender: Gender }).strict();
export const GuestRemoveBody = LeaveBody;
export const InviteBody = z.object({ friendCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/) }).strict();

// ---------- P1: Uni plans (SPEC §3.19) ----------
const PlanCategory = z.enum(['economy', 'comfort']);   // Airport isn't a uni ride
export const PlannedTripBody = TripBody.extend({ category: PlanCategory }).strict();
export const PlanPatternItem = z.object({
  weekday: z.number().int().min(0).max(6),             // 0 = Sunday
  arriveByTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pickup: PlaceRef, dest: PlaceRef, category: PlanCategory, sameGenderOnly: z.boolean(),
}).strict();
/** Demo card only. The server accepts test numbers and keeps nothing but the last 4 digits. */
export const DemoCard = z.object({
  number: z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\d{12,19}$/)),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  cvc: z.string().regex(/^\d{3,4}$/),
}).strict();
export const SubscribeBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('weekly'), trips: z.array(PlannedTripBody).min(3).max(5), card: DemoCard }).strict(),
  z.object({ kind: z.literal('semester'), pattern: z.array(PlanPatternItem).min(2).max(5), card: DemoCard }).strict(),
]);
export const ReplacementBody = z.object({ trip: PlannedTripBody }).strict();

// ---------- Demo menu (PIN in the X-Demo-Pin header) ----------
export const DemoClockBody = z.union([
  z.object({ advanceMin: z.number().int().min(1).max(24 * 60) }).strict(),
  z.object({ jumpTo: IsoTime }).strict(),
  z.object({ next: z.literal(true) }).strict(),
  z.object({ paused: z.boolean() }).strict(),
]);
export const DemoRideBody = z.object({ rideId: z.string().min(1) }).strict();   // simulate-rider, complete-trip
export const DemoSettingsBody = z.object({
  source: z.enum(['snapshot', 'google', 'fixed']),
  traffic: z.enum(['normal', 'heavy', 'jam']),
  weather: z.enum(['clear', 'rain']),
  driversNearby: z.union([z.literal(2), z.literal(8), z.literal(20)]),
  simAutoReady: z.boolean(),
}).partial().strict();
export const DriverPositionBody = z.object({ driverId: z.string().min(1), placeKey: z.string().min(1) }).strict();

export type PlaceRef = z.infer<typeof PlaceRef>;
export type SignupBody = z.infer<typeof SignupBody>;
export type DemoLoginBody = z.infer<typeof DemoLoginBody>;
export type QuoteBody = z.infer<typeof QuoteBody>;
export type TripBody = z.infer<typeof TripBody>;
export type JoinBody = z.infer<typeof JoinBody>;
export type LeaveBody = z.infer<typeof LeaveBody>;
export type ReadyBody = z.infer<typeof ReadyBody>;
export type ChatBody = z.infer<typeof ChatBody>;
export type GuestBody = z.infer<typeof GuestBody>;
export type InviteBody = z.infer<typeof InviteBody>;
export type PlannedTripBody = z.infer<typeof PlannedTripBody>;
export type PlanPatternItem = z.infer<typeof PlanPatternItem>;
export type SubscribeBody = z.infer<typeof SubscribeBody>;
export type ReplacementBody = z.infer<typeof ReplacementBody>;
export type DemoClockBody = z.infer<typeof DemoClockBody>;
export type DemoRideBody = z.infer<typeof DemoRideBody>;
export type DemoSettingsBody = z.infer<typeof DemoSettingsBody>;
export type DriverPositionBody = z.infer<typeof DriverPositionBody>;
