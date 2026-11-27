import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@nextstop/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)) },
  },
  test: { include: ['server/test/**/*.test.ts', 'shared/src/**/*.test.ts', 'web/src/**/*.test.ts'] },
});
