// Writes server/dist/build.json = { hash, builtAt }, shown by /api/health and the demo menu.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// A zip carries its commit in BUILD_COMMIT; that wins, because hosts like Replit make their own git history.
let hash = existsSync('BUILD_COMMIT') ? readFileSync('BUILD_COMMIT', 'utf8').trim() : '';
if (!hash) { try { hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { hash = 'unknown'; } }
mkdirSync('server/dist', { recursive: true });
writeFileSync('server/dist/build.json', JSON.stringify({ hash, builtAt: new Date().toISOString() }));
console.log(`build stamp: ${hash}`);
