import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: ['src/main.jsx'],
    },
  },
});
