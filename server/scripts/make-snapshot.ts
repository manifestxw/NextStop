// `npm run snapshot` (SPEC §4.2.2): call Google once for all seed places — a 6×6 traffic matrix per 15-min
// bucket Sun 06:00–08:30, plus the road polyline for every ordered pair — and save data/demo_snapshot.json.
// Needs GOOGLE_SERVER_KEY in .env. About 41 Google calls. Commit the JSON.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromIso } from '../src/clock/amman.js';
import { parseConfig } from '../src/config.js';
import { loadSeed } from '../src/store/seed.js';
import { googleProvider } from '../src/travel/google.js';
import { SNAPSHOT_FILE, type Snapshot } from '../src/travel/snapshot.js';

try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); } catch { /* env vars only */ }
const cfg = parseConfig(process.env);
if (!cfg.googleServerKey) { console.error('GOOGLE_SERVER_KEY is not set'); process.exit(1); }

const google = googleProvider(cfg.googleServerKey);
const places = loadSeed().places.map((p) => ({ key: p.key!, lat: p.lat, lng: p.lng }));
const day = new Date(cfg.demoStartUs / 1000 + 3 * 3_600_000).toISOString().slice(0, 10);   // demo date in Amman
const at = (hhmm: string) => fromIso(`${day}T${hhmm}:00+03:00`);
const buckets: Snapshot['buckets'] = {};

for (let m = 6 * 60; m <= 8 * 60 + 30; m += 15) {
  const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const spec = await google.getMatrix(places, at(hhmm));
  if (spec.kind !== 'cells') throw new Error('expected cells');
  buckets[hhmm] = {};
  places.forEach((a, i) => places.forEach((b, j) => { if (i !== j) buckets[hhmm]![`${a.key}>${b.key}`] = spec.cells[i]![j]!; }));
  console.log(`bucket ${hhmm}: CC>JUST ${buckets[hhmm]!['CC>JUST']!.km} km, ${buckets[hhmm]!['CC>JUST']!.minTraffic.toFixed(1)} min`);
}

const routes: Snapshot['routes'] = {};
for (const a of places) for (const b of places) {
  if (a.key === b.key) continue;
  routes[`${a.key}>${b.key}`] = await google.getRoute([a, b], at('07:00'));
}
console.log(`routes: ${Object.keys(routes).length} pairs, CC>JUST ${routes['CC>JUST']!.length} points`);

const snap: Snapshot = { generatedAt: new Date().toISOString(), date: day, places, buckets, routes };
writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap) + '\n');
console.log(`wrote ${SNAPSHOT_FILE}`);
