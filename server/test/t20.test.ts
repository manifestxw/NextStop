// T20 (P1): driver route line, rider ↔ driver chat, places proxy.
import { describe, expect, it } from 'vitest';
import { makeHarness, trip, rider, driver } from './helpers.js';
import { ConflictError } from '../src/domain/errors.js';

async function accepted() {
  const h = await makeHarness({ stage: true });
  const laith = await h.login('laith'), saed = await h.login('saed'), yazeed = await h.login('yazeed');
  const rideId = rider(await h.cmd.createRide(laith, trip('CC'))).ride!.id;
  await h.cmd.join(saed, rideId, trip('US'));
  await h.cmd.findDriver(laith, rideId);
  await h.cmd.ready(laith, rideId, { answer: 'READY' });
  await h.cmd.ready(saed, rideId, { answer: 'READY' });
  return { ...h, laith, saed, yazeed, rideId };
}

describe('driver route line (SPEC §3.9, §3.14)', () => {
  it('the accepted driver gets the road route through the stops; riders never do', async () => {
    const { cmd, yazeed, saed, laith, rideId } = await accepted();
    await cmd.accept(yazeed, rideId);
    const route = driver(await cmd.me(yazeed)).trip!.route!;
    expect(route.length).toBeGreaterThan(20);                       // snapshot polylines, not 4 straight points
    expect(JSON.stringify(rider(await cmd.me(laith)))).not.toContain('"route"');
    await cmd.demo.clock({ jumpTo: '2026-11-29T06:53:00+03:00' });
    await cmd.leave(saed, rideId, { acceptCharge: true });
    expect(driver(await cmd.me(yazeed)).trip!.route!.length).toBeGreaterThan(20);   // recomputed without Saed's stops
  });
});

describe('driver chat (P1, SPEC §3.11)', () => {
  it('each rider has a private channel with the driver, only after accept', async () => {
    const { cmd, yazeed, saed, laith, rideId } = await accepted();
    await expect(cmd.chat(saed, rideId, { channel: 'driver:u-saed', text: 'hi' })).rejects.toBeInstanceOf(ConflictError);
    await cmd.accept(yazeed, rideId);
    await cmd.chat(saed, rideId, { channel: 'driver:u-saed', text: 'I am at the gate, call 0791234567' });
    await cmd.chat(yazeed, rideId, { channel: 'driver:u-saed', text: 'On my way' });
    expect(rider(await cmd.me(saed)).ride!.chat.driver!.map((m) => m.text)).toEqual(['I am at the gate, call •••', 'On my way']);
    expect(driver(await cmd.me(yazeed)).trip!.chats!['u-saed']!.length).toBe(2);
    expect(rider(await cmd.me(laith)).ride!.chat.driver).toEqual([]);
    await expect(cmd.chat(laith, rideId, { channel: 'driver:u-saed', text: 'snoop' })).rejects.toBeInstanceOf(ConflictError);
    expect(driver(await cmd.me(yazeed)).trip!.chats!['u-saed']!.length).toBe(2);
  });
});

describe('places proxy (P1)', () => {
  it('needs 2+ characters; without a server key only the seed places match (tests have no GOOGLE_SERVER_KEY)', async () => {
    const h = await makeHarness();
    const laith = await h.login('laith');
    expect(await h.cmd.places(laith, 'i')).toEqual([]);
    expect((await h.cmd.places(laith, 'irbid')).map((p) => p.key)).toEqual(['CC']);
    expect(await h.cmd.places(laith, 'Irbid hospital')).toEqual([]);
  });
});
