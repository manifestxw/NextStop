import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { fromIso } from './clock/amman.js';
import { createClock } from './clock/clock.js';
import { createScheduler } from './clock/scheduler.js';
import { createCommands } from './commands/index.js';
import { parseConfig } from './config.js';
import { registerRoutes } from './http/routes.js';
import { attachRealtime } from './realtime/io.js';
import { createPrismaStore } from './store/prismaRepo.js';
import { seedIfEmpty } from './store/seed.js';
import { configureGoogle } from './travel/select.js';
import { clockView } from './views/common.js';

// Local dev reads the repo-root .env. Deploys use Replit Secrets (real env vars) instead.
try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* no .env */ }

const cfg = parseConfig(process.env);
process.env.DATABASE_URL = cfg.databaseUrl;   // Prisma reads it from the env
const store = createPrismaStore(new PrismaClient());
configureGoogle(cfg.googleServerKey);   // live source (P1) only; the demo uses the snapshot

if (await store.withLock((r) => seedIfEmpty(r, cfg))) console.log('seeded an empty database');
const demo = (await store.withLock((r) => r.getDemoState()))!;
const clock = createClock({ startUs: fromIso(demo.nowIso), paused: demo.paused });

const app = buildApp({ clock, source: async () => (await store.withLock((r) => r.getDemoState()))!.settings.source });
const rt = attachRealtime(app.server, store);
const commands = createCommands({ store, clock, cfg, publisher: rt.publisher, realNowMs: () => Date.now() });
rt.setOnConnect((userId) => commands.pushView(userId));
registerRoutes(app, commands, cfg);

createScheduler({ tick: commands.tick }).start();
setInterval(() => rt.publisher.clock(clockView(clock)), 30_000);   // countdown resync (ARCH §9.2)
await app.listen({ port: cfg.port, host: '0.0.0.0' });
console.log(`RideSync server on :${cfg.port} · demo clock ${demo.nowIso}${demo.paused ? ' (paused)' : ''}`);
