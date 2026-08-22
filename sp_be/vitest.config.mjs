import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/globalSetup.mjs',
    globalTeardown: './test/globalTeardown.mjs',
    setupFiles: ['./test/setupFiles.mjs'],
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
