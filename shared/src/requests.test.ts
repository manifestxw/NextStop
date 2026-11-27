import { describe, expect, it } from 'vitest';
import { req, ERROR_MESSAGES } from './index.js';

const trip = { pickup: { key: 'CC' }, dest: { key: 'JUST' }, arriveBy: '2026-11-29T08:00:00+03:00' };
const card = { number: '4242 4242 4242 4242', expiry: '12/27', cvc: '123' };

describe('request schemas (trust boundary)', () => {
  it('accepts a seed-place trip and rejects places outside Jordan', () => {
    expect(req.TripBody.safeParse({ ...trip, category: 'economy', sameGenderOnly: true }).success).toBe(true);
    const cairo = { placeId: 'x', name: 'Cairo', lat: 30.04, lng: 31.24 };
    expect(req.QuoteBody.safeParse({ ...trip, pickup: cairo }).success).toBe(false);
  });

  it('rejects a client-supplied area name and unknown fields', () => {
    expect(req.PlaceRef.safeParse({ key: 'CC', area: 'Fake area' }).success).toBe(false);
    expect(req.SignupBody.safeParse({ firstName: 'Lina', gender: 'F', role: 'rider', admin: true }).success).toBe(false);
  });

  it('needs an offset on times (Amman local, never naive)', () => {
    expect(req.QuoteBody.safeParse({ ...trip, arriveBy: '2026-11-29T08:00:00' }).success).toBe(false);
  });

  it('limits chat to 300 characters and known channels', () => {
    expect(req.ChatBody.safeParse({ channel: 'group', text: 'x'.repeat(300) }).success).toBe(true);
    expect(req.ChatBody.safeParse({ channel: 'group', text: 'x'.repeat(301) }).success).toBe(false);
    expect(req.ChatBody.safeParse({ channel: 'driver:u1', text: 'hi' }).success).toBe(true);
    expect(req.ChatBody.safeParse({ channel: 'all', text: 'hi' }).success).toBe(false);
    expect(req.ChatBody.safeParse({ channel: 'group', text: '   ' }).success).toBe(false);
  });

  it('normalizes friend codes', () => {
    expect(req.InviteBody.parse({ friendCode: ' lina26 ' })).toEqual({ friendCode: 'LINA26' });
    expect(req.InviteBody.safeParse({ friendCode: 'LINA2' }).success).toBe(false);
  });

  it('enforces Uni plan sizes and no Airport in plans (SPEC §3.19)', () => {
    const pt = { ...trip, category: 'economy', sameGenderOnly: true };
    expect(req.SubscribeBody.safeParse({ kind: 'weekly', trips: [pt, pt, pt], card }).success).toBe(true);
    expect(req.SubscribeBody.safeParse({ kind: 'weekly', trips: [pt, pt], card }).success).toBe(false);
    expect(req.SubscribeBody.safeParse({ kind: 'weekly', trips: [pt, pt, { ...pt, category: 'airport' }], card }).success).toBe(false);
    const item = { weekday: 1, arriveByTime: '08:00', pickup: { key: 'AM' }, dest: { key: 'JUST' }, category: 'economy', sameGenderOnly: true };
    expect(req.SubscribeBody.safeParse({ kind: 'semester', pattern: [item, item], card }).success).toBe(true);
    expect(req.SubscribeBody.safeParse({ kind: 'semester', pattern: [item, { ...item, arriveByTime: '24:00' }], card }).success).toBe(false);
  });

  it('strips spaces from the demo card number and rejects letters', () => {
    const ok = req.DemoCard.parse(card);
    expect(ok.number).toBe('4242424242424242');
    expect(req.DemoCard.safeParse({ ...card, number: '4242 abcd' }).success).toBe(false);
  });

  it('accepts exactly one demo clock action', () => {
    expect(req.DemoClockBody.safeParse({ advanceMin: 5 }).success).toBe(true);
    expect(req.DemoClockBody.safeParse({ next: true }).success).toBe(true);
    expect(req.DemoClockBody.safeParse({ advanceMin: 5, paused: true }).success).toBe(false);
  });

  it('has a user-facing message for every conflict the client shows', () => {
    expect(ERROR_MESSAGES.TOO_SOON).toBe('Too soon to sync. Book a solo ride instead.');
  });
});
