// Environment → typed config (ARCH §11). Invalid values stop the server at boot instead of misbehaving later.
import { z } from 'zod';
import { fromIso } from './clock/amman.js';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('file:../../data/app.db'),   // relative to server/prisma/schema.prisma
  TRAVEL_SOURCE: z.enum(['snapshot', 'google', 'fixed']).default('snapshot'),
  DEMO_START: z.iso.datetime({ offset: true }).default('2026-11-29T06:10:00+03:00'),
  CLOCK_START_PAUSED: z.enum(['true', 'false']).default('true'),
  CALIBRATION: z.coerce.number().min(0.5).max(2).default(1),
  GOOGLE_SERVER_KEY: z.string().min(1).optional(),              // server only; never logged
  DEMO_PIN: z.string().min(4).default('1337'),
});

export function parseConfig(env: Record<string, string | undefined>) {
  // `KEY=` in .env means "not set".
  const e = Env.parse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== '')));
  return {
    port: e.PORT, databaseUrl: e.DATABASE_URL, travelSource: e.TRAVEL_SOURCE,
    demoStartUs: fromIso(e.DEMO_START), clockStartPaused: e.CLOCK_START_PAUSED === 'true',
    calibration: e.CALIBRATION, googleServerKey: e.GOOGLE_SERVER_KEY, demoPin: e.DEMO_PIN,
  };
}
export type Config = ReturnType<typeof parseConfig>;
