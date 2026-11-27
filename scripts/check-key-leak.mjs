// Fails if the Google server key's value appears anywhere in the built SPA (ARCH §15).
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

try { process.loadEnvFile('.env'); } catch { /* no .env: rely on the environment */ }
const key = process.env.GOOGLE_SERVER_KEY;
const dir = 'server/public';
if (!key) { console.log('key-leak check: GOOGLE_SERVER_KEY not set, skipped'); process.exit(0); }
if (!existsSync(dir)) { console.log('key-leak check: no server/public yet, skipped'); process.exit(0); }

const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? files(p) : [p];
});
const leaks = files(dir).filter((f) => readFileSync(f, 'latin1').includes(key));
if (leaks.length) { console.error('SERVER KEY LEAKED INTO:', leaks.join(', ')); process.exit(1); }
console.log(`key-leak check: ok (${dir})`);
