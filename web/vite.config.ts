import { defineConfig } from 'vitest/config';

export default defineConfig({
  // VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY live in the repo root (.env, .env.local)
  envDir: '..',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
