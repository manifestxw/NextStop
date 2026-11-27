import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';
import { sun } from './fixtures/places.js';

describe('config (env → typed, validated)', () => {
  it('has demo defaults', () => {
    const c = parseConfig({});
    expect(c).toMatchObject({ port: 3000, travelSource: 'snapshot', clockStartPaused: true, calibration: 1, demoPin: '1337' });
    expect(c.demoStartUs).toBe(sun(6, 10));
    expect(c.googleServerKey).toBeUndefined();
  });
  it('reads overrides', () => {
    const c = parseConfig({ PORT: '8080', CLOCK_START_PAUSED: 'false', CALIBRATION: '1.05', TRAVEL_SOURCE: 'fixed', GOOGLE_SERVER_KEY: 'k' });
    expect(c).toMatchObject({ port: 8080, clockStartPaused: false, calibration: 1.05, travelSource: 'fixed', googleServerKey: 'k' });
  });
  it('rejects nonsense instead of running with it', () => {
    expect(() => parseConfig({ CALIBRATION: 'abc' })).toThrow();
    expect(() => parseConfig({ TRAVEL_SOURCE: 'bing' })).toThrow();
    expect(() => parseConfig({ DEMO_START: '2026-11-29T06:10:00' })).toThrow();   // needs an offset
  });
});
