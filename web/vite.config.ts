import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths: the page runs under any sub path (GitHub Pages: /oiliversum/).
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
