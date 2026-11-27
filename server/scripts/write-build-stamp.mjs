// Writes server/dist/build.json = { hash, builtAt }, shown by /api/health and the demo menu.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// A git checkout knows its commit; a zip (git archive) carries it in BUILD_COMMIT instead.
let hash = 'unknown';
try { hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {
  if (existsSync('BUILD_COMMIT')) hash = readFileSync('BUILD_COMMIT', 'utf8').trim() || hash;
}
mkdirSync('server/dist', { recursive: true });
writeFileSync('server/dist/build.json', JSON.stringify({ hash, builtAt: new Date().toISOString() }));
console.log(`build stamp: ${hash}`);
