import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include:     ['test/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include:  ['src/utils/**', 'src/devProxy.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
