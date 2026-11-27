// `npm run seed:reset`: wipe every table and reload data/seed.json (epoch + 1, clock paused at DEMO_START).
// Stop the server first: a running server keeps its in-memory clock. On stage, use the demo menu's Reset.
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { parseConfig } from '../src/config.js';
import { createPrismaStore } from '../src/store/prismaRepo.js';
import { resetToSeed } from '../src/store/seed.js';

try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* no .env */ }
const cfg = parseConfig(process.env);
process.env.DATABASE_URL = cfg.databaseUrl;
const store = createPrismaStore(new PrismaClient());
const epoch = await store.withLock((r) => resetToSeed(r, cfg));
await store.close();
console.log(`database reset to seed, epoch ${epoch}`);
