// Error responses (ARCH §7.1). `message` is the user-facing text; the client shows it as is.
import type { DemoView, MatchCard, QuoteView, View } from './views.js';

export const ERROR_MESSAGES = {
  RIDE_FULL: 'This ride just filled up',
  RIDE_CLOSED: 'This ride just closed',
  RIDE_GONE: 'This ride is no longer available',
  NOT_ELIGIBLE: "You can't join this ride",             // server replaces it with the failing rule's reason
  TOO_SOON: 'Too soon to sync. Book a solo ride instead.',
  ALREADY_IN_RIDE: 'You already have a ride at this time',
  OFFER_TAKEN: 'Another driver accepted this ride',
  LATE_CONFIRM_REQUIRED: '',                              // client opens the late-leave sheet with chargeJod
  ILLEGAL_STATE: 'Something went wrong. Try again.',
  NO_SEAT_FOR_FRIEND: 'No seat for a friend',
  NO_SUCH_CODE: 'No account with that code',
  NOT_TEST_CARD: 'Demo only: use a test card.',
  NO_REPLACEMENTS: 'No replacements left',
  USE_LEAVE: '',                                          // under 12 h: client opens the leave sheet
} as const;

export type ConflictCode = keyof typeof ERROR_MESSAGES;

export interface OkResponse<V = View> { ok: true; view: V }
/** 409: a domain conflict. */
export interface ConflictResponse { code: ConflictCode; message: string; chargeJod?: number }
/** 401: bad token or old epoch. The client clears its token. */
export interface LoggedOutResponse { code: 'LOGGED_OUT' }
/** 422: the body failed validation. */
export interface InvalidResponse { code: 'INVALID'; issues: { path: string; message: string }[] }
/** 404 for unknown API paths. */
export interface NotFoundResponse { code: 'NOT_FOUND' }
/** 403: a demo call without the right X-Demo-Pin header. */
export interface BadPinResponse { code: 'BAD_PIN' }

export type ErrorResponse = ConflictResponse | LoggedOutResponse | InvalidResponse | NotFoundResponse | BadPinResponse;

// Commands that don't return the caller's view (ARCH §7.1).
export interface QuoteResponse { ok: true; quote: QuoteView }
export interface SearchResponse { ok: true; cards: MatchCard[] }
export interface DemoResponse { ok: true; demo: DemoView }

export interface AuthResponse { token: string; epoch: number; view: View }   // signup, demo login
