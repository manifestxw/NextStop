import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Health } from '@nextstop/shared';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// Same layout in dev (src/) and prod (dist/): both sit one level under server/.
const PUBLIC_DIR = here('../public');
const STAMP_FILE = here('../dist/build.json');

function readStamp(): Health['buildStamp'] {
  try { return JSON.parse(readFileSync(STAMP_FILE, 'utf8')); } catch { return null; }
}

export function buildApp() {
  const app = Fastify({ logger: false });
  const buildStamp = readStamp();

  app.get('/api/health', async (): Promise<Health> => ({ ok: true, buildStamp }));

  if (existsSync(PUBLIC_DIR)) app.register(fastifyStatic, { root: PUBLIC_DIR });

  // Unknown API paths are a JSON 404; every other path serves the SPA (client-side routes).
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || !existsSync(PUBLIC_DIR)) {
      return reply.code(404).send({ code: 'NOT_FOUND' });
    }
    return reply.sendFile('index.html');
  });
  return app;
}
