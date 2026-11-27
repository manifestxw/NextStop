import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

// Local dev reads the repo-root .env. Deploys use Replit Secrets (real env vars) instead.
try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* no .env */ }

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();
await app.listen({ port, host: '0.0.0.0' });
console.log(`RideSync server on :${port}`);
