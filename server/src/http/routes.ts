// REST commands (ARCH §7.1): one POST per user action; the response is the result.
// Validation with the shared zod schemas (422), Bearer token (401), demo PIN (403), conflicts (409).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { req as schema } from '@nextstop/shared';
import { ZodError, type z } from 'zod';
import type { Commands } from '../commands/index.js';
import type { Config } from '../config.js';
import { ConflictError, LoggedOutError } from '../domain/errors.js';
import { readStamp } from '../app.js';

class BadPinError extends Error {}

const token = (r: FastifyRequest) => {
  const h = r.headers.authorization ?? '';
  if (!h.startsWith('Bearer ')) throw new LoggedOutError();
  return h.slice(7);
};
const body = <T extends z.ZodType>(s: T, r: FastifyRequest): z.output<T> => s.parse(r.body ?? {});
const id = (r: FastifyRequest) => (r.params as { id: string }).id;

export function registerRoutes(app: FastifyInstance, cmd: Commands, cfg: Config) {
  const pin = (r: FastifyRequest) => { if (r.headers['x-demo-pin'] !== cfg.demoPin) throw new BadPinError(); };
  const view = async (v: Promise<unknown>) => ({ ok: true, view: await v });
  const demo = async (v: Promise<object>) => ({ ok: true, demo: { ...(await v), buildStamp: readStamp() } });

  app.setErrorHandler((err, _r, reply: FastifyReply) => {
    if (err instanceof ConflictError) return reply.code(409).send({ code: err.code, message: err.message, ...err.extra });
    if (err instanceof LoggedOutError) return reply.code(401).send({ code: 'LOGGED_OUT' });
    if (err instanceof BadPinError) return reply.code(403).send({ code: 'BAD_PIN' });
    if (err instanceof ZodError) {
      return reply.code(422).send({ code: 'INVALID', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    if ((err as { statusCode?: number }).statusCode === 400) {   // malformed JSON
      return reply.code(422).send({ code: 'INVALID', issues: [{ path: '', message: 'Malformed JSON body' }] });
    }
    console.error(err);
    return reply.code(500).send({ code: 'ILLEGAL_STATE', message: 'Something went wrong. Try again.' });
  });

  // auth
  app.post('/api/signup', async (r) => cmd.signup(body(schema.SignupBody, r)));
  app.post('/api/demo/login', async (r) => { pin(r); return cmd.demoLogin(body(schema.DemoLoginBody, r)); });
  app.get('/api/me', async (r) => view(cmd.me(token(r))));

  // rider
  app.get('/api/places', async (r) => ({ ok: true, places: await cmd.places(token(r), String((r.query as { q?: string }).q ?? '')) }));
  app.get('/api/places/at', async (r) => {
    const q = r.query as { lat?: string; lng?: string };
    const lat = Number(q.lat), lng = Number(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ConflictError('NOT_ELIGIBLE', 'Pick a place on the map');
    return { ok: true, place: await cmd.placeAt(token(r), lat, lng) };
  });
  app.post('/api/quote', async (r) => ({ ok: true, quote: await cmd.quote(token(r), body(schema.QuoteBody, r)) }));
  app.post('/api/search', async (r) => ({ ok: true, cards: await cmd.search(token(r), body(schema.SearchBody, r)) }));
  app.post('/api/rides', async (r) => view(cmd.createRide(token(r), body(schema.CreateRideBody, r))));
  app.post('/api/rides/:id/join', async (r) => view(cmd.join(token(r), id(r), body(schema.JoinBody, r))));
  app.post('/api/rides/:id/leave', async (r) => view(cmd.leave(token(r), id(r), body(schema.LeaveBody, r))));
  app.post('/api/rides/:id/find-driver', async (r) => view(cmd.findDriver(token(r), id(r))));
  app.post('/api/rides/:id/ready', async (r) => view(cmd.ready(token(r), id(r), body(schema.ReadyBody, r))));
  app.post('/api/rides/:id/chat', async (r) => view(cmd.chat(token(r), id(r), body(schema.ChatBody, r))));
  app.post('/api/rides/:id/guest', async (r) => view(cmd.addGuest(token(r), id(r), body(schema.GuestBody, r))));
  app.post('/api/rides/:id/guest/remove', async (r) => view(cmd.removeGuest(token(r), id(r), body(schema.GuestRemoveBody, r))));
  app.post('/api/rides/:id/invite', async (r) => view(cmd.invite(token(r), id(r), body(schema.InviteBody, r))));
  app.post('/api/invites/:id/decline', async (r) => view(cmd.declineInvite(token(r), id(r))));
  app.post('/api/invites/:id/preview', async (r) => ({ ok: true, preview: await cmd.previewInvite(token(r), id(r), body(schema.InviteAcceptBody, r)) }));
  app.post('/api/invites/:id/accept', async (r) => view(cmd.acceptInvite(token(r), id(r), body(schema.InviteAcceptBody, r))));
  app.get('/api/friends/:id', async (r) => ({ ok: true, friend: await cmd.lookupCode(token(r), id(r)) }));
  app.post('/api/plans/subscribe', async (r) => view(cmd.subscribe(token(r), body(schema.SubscribeBody, r))));
  app.post('/api/plans/trips/:id/cancel', async (r) => view(cmd.cancelPlanned(token(r), id(r))));
  app.post('/api/plans/trips', async (r) => view(cmd.planReplacement(token(r), body(schema.ReplacementBody, r))));
  app.post('/api/banners/:id/seen', async (r) => view(cmd.bannerSeen(token(r), id(r))));

  // driver
  app.post('/api/offers/:id/accept', async (r) => view(cmd.accept(token(r), id(r))));
  app.post('/api/rides/:id/stops/:stopId/:action', async (r) => {
    const { stopId, action } = r.params as { stopId: string; action: string };
    if (action !== 'picked-up' && action !== 'dropped-off' && action !== 'no-show') throw new ZodError([{ code: 'custom', path: ['action'], message: 'Unknown stop action', input: action }]);
    return view(cmd.stop(token(r), id(r), stopId, action));
  });
  app.post('/api/rides/:id/driver-cancel', async (r) => view(cmd.driverCancel(token(r), id(r))));
  app.post('/api/offers/:id/reject', async (r) => view(cmd.reject(token(r), id(r))));

  // demo menu (PIN)
  app.get('/api/demo', async (r) => { pin(r); return demo(cmd.demo.view()); });
  app.post('/api/demo/clock', async (r) => { pin(r); return demo(cmd.demo.clock(body(schema.DemoClockBody, r))); });
  app.post('/api/demo/simulate-rider', async (r) => { pin(r); return demo(cmd.demo.simulateRider(body(schema.DemoRideBody, r))); });
  app.post('/api/demo/complete-trip', async (r) => { pin(r); return demo(cmd.demo.completeTrip(body(schema.DemoRideBody, r))); });
  app.post('/api/demo/reset', async (r) => { pin(r); return demo(cmd.demo.reset()); });
  app.post('/api/demo/driver-position', async (r) => { pin(r); return demo(cmd.demo.driverPosition(body(schema.DriverPositionBody, r))); });
  app.post('/api/demo/place-planned', async (r) => { pin(r); return demo(cmd.demo.placePlanned()); });
  app.post('/api/demo/autopilot', async (r) => { pin(r); return demo(cmd.demo.autopilot()); });
  app.post('/api/demo/settings', async (r) => { pin(r); return demo(cmd.demo.settings(body(schema.DemoSettingsBody, r))); });
}
