import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { fromIso } from './clock/amman.js';
import { createClock } from './clock/clock.js';
import { createScheduler } from './clock/scheduler.js';
import { parseConfig } from './config.js';
import { createPrismaStore } from './store/prismaRepo.js';
import { seedIfEmpty } from './store/seed.js';

// Local dev reads the repo-root .env. Deploys use Replit Secrets (real env vars) instead.
try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* no .env */ }

const cfg = parseConfig(process.env);
process.env.DATABASE_URL = cfg.databaseUrl;   // Prisma reads it from the env
const store = createPrismaStore(new PrismaClient());

if (await store.withLock((r) => seedIfEmpty(r, cfg))) console.log('seeded an empty database');
const demo = (await store.withLock((r) => r.getDemoState()))!;
const clock = createClock({ startUs: fromIso(demo.nowIso), paused: demo.paused });
const source = demo.settings.source;   // T7: the demo menu's source switch updates this

createScheduler({ store, clock }).start();
await buildApp({ clock, source: () => source }).listen({ port: cfg.port, host: '0.0.0.0' });
console.log(`RideSync server on :${cfg.port} · demo clock ${demo.nowIso}${demo.paused ? ' (paused)' : ''}`);
