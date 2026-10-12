import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // alphaTab (Guitar Pro import) is a large chunk, loaded only on the upload screen.
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
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
