import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./server/test/setup.js'],
    include: ['server/**/*.test.js'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 15000,
  },
});
