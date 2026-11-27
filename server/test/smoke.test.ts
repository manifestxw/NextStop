import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('scaffold', () => {
  it('runs tests in UTC, so time-zone bugs fail everywhere (AGENTS §7.2)', () => {
    expect(process.env.TZ).toBe('UTC');
    expect(new Date(0).getTimezoneOffset()).toBe(0);
  });

  it('serves /api/health and a JSON 404 for unknown API paths', async () => {
    const app = buildApp();
    const health = await app.inject({ url: '/api/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().ok).toBe(true);
    const missing = await app.inject({ url: '/api/nope' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ code: 'NOT_FOUND' });
  });
});
