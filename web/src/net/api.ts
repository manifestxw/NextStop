// REST commands (ARCH §7.1). 200 → apply the view; 409 → ApiError with the server's message;
// 401 → log out. No optimistic UI for joins, leaves or prices.
import type {
  AuthResponse, ConflictCode, DemoResponse, DemoView, MatchCard, OkResponse, QuoteResponse, QuoteView, SearchResponse, View, req,
} from '@nextstop/shared';
import type { z } from 'zod';
import { useSession } from '../state/session.js';

type In<T extends z.ZodType> = z.input<T>;

export class ApiError extends Error {
  constructor(public code: ConflictCode | 'LOGGED_OUT' | 'INVALID' | 'BAD_PIN' | 'NETWORK', message: string, public chargeJod?: number) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, pin?: string): Promise<T> {
  const { token } = useSession.getState();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (pin) headers['x-demo-pin'] = pin;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}) });
  } catch {
    throw new ApiError('NETWORK', 'No connection. Try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (res.ok) return json as T;
  if (res.status === 401) { useSession.getState().logout(); throw new ApiError('LOGGED_OUT', 'Please log in again.'); }
  throw new ApiError(json.code ?? 'ILLEGAL_STATE', json.message ?? 'Something went wrong. Try again.', json.chargeJod);
}

/** Commands that return the caller's view: apply it (if newer) and hand it back. */
async function withView(p: Promise<OkResponse>): Promise<View> {
  const { view } = await p;
  useSession.getState().setView(view);
  return view;
}

async function auth(p: Promise<AuthResponse>): Promise<View> {
  const r = await p;
  useSession.getState().login(r.token, r.view);
  return r.view;
}

const post = <T = OkResponse>(path: string, body?: unknown, pin?: string) => call<T>('POST', path, body, pin);

export const api = {
  signup: (b: In<typeof req.SignupBody>) => auth(post<AuthResponse>('/api/signup', b)),
  demoLogin: (as: In<typeof req.DemoLoginBody>['as'], pin: string) => auth(post<AuthResponse>('/api/demo/login', { as }, pin)),
  me: () => withView(call<OkResponse>('GET', '/api/me')),

  quote: async (b: In<typeof req.QuoteBody>): Promise<QuoteView> => (await post<QuoteResponse>('/api/quote', b)).quote,
  search: async (b: In<typeof req.SearchBody>): Promise<MatchCard[]> => (await post<SearchResponse>('/api/search', b)).cards,
  createRide: (b: In<typeof req.CreateRideBody>) => withView(post('/api/rides', b)),
  join: (rideId: string, b: In<typeof req.JoinBody>) => withView(post(`/api/rides/${rideId}/join`, b)),
  leave: (rideId: string, b: In<typeof req.LeaveBody> = {}) => withView(post(`/api/rides/${rideId}/leave`, b)),
  findDriver: (rideId: string) => withView(post(`/api/rides/${rideId}/find-driver`)),
  ready: (rideId: string, answer: In<typeof req.ReadyBody>['answer']) => withView(post(`/api/rides/${rideId}/ready`, { answer })),
  chat: (rideId: string, text: string) => withView(post(`/api/rides/${rideId}/chat`, { channel: 'group', text })),
  bannerSeen: (id: string) => withView(post(`/api/banners/${id}/seen`)),
  addGuest: (rideId: string, b: In<typeof req.GuestBody>) => withView(post(`/api/rides/${rideId}/guest`, b)),
  removeGuest: (rideId: string, acceptCharge = false) => withView(post(`/api/rides/${rideId}/guest/remove`, { acceptCharge })),
  invite: (rideId: string, friendCode: string) => withView(post(`/api/rides/${rideId}/invite`, { friendCode })),
  declineInvite: (inviteId: string) => withView(post(`/api/invites/${inviteId}/decline`)),
  accept: (rideId: string) => withView(post(`/api/offers/${rideId}/accept`)),
  reject: (rideId: string) => withView(post(`/api/offers/${rideId}/reject`)),
  stop: (rideId: string, stopId: string, action: 'picked-up' | 'dropped-off' | 'no-show') => withView(post(`/api/rides/${rideId}/stops/${stopId}/${action}`)),
  driverCancel: (rideId: string) => withView(post(`/api/rides/${rideId}/driver-cancel`)),

  demo: {
    view: async (pin: string): Promise<DemoView> => (await call<DemoResponse>('GET', '/api/demo', undefined, pin)).demo,
    clock: async (pin: string, b: In<typeof req.DemoClockBody>) => (await post<DemoResponse>('/api/demo/clock', b, pin)).demo,
    simulateRider: async (pin: string, rideId: string) => (await post<DemoResponse>('/api/demo/simulate-rider', { rideId }, pin)).demo,
    completeTrip: async (pin: string, rideId: string) => (await post<DemoResponse>('/api/demo/complete-trip', { rideId }, pin)).demo,
    reset: async (pin: string) => (await post<DemoResponse>('/api/demo/reset', {}, pin)).demo,
    autopilot: async (pin: string) => (await post<DemoResponse>('/api/demo/autopilot', {}, pin)).demo,
    settings: async (pin: string, b: In<typeof req.DemoSettingsBody>) => (await post<DemoResponse>('/api/demo/settings', b, pin)).demo,
  },
};
