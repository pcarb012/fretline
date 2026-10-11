import { defineConfig } from 'vite';

export default defineConfig({
  build: { assetsInlineLimit: 0 },
  server: { port: 3939, strictPort: true },
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/logic/**'],
      reporter: ['text'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
