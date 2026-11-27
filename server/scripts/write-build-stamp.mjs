// Writes server/dist/build.json = { hash, builtAt }, shown by /api/health and the demo menu.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

let hash = 'unknown';
try { hash = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* not a git checkout */ }
mkdirSync('server/dist', { recursive: true });
writeFileSync('server/dist/build.json', JSON.stringify({ hash, builtAt: new Date().toISOString() }));
console.log(`build stamp: ${hash}`);
