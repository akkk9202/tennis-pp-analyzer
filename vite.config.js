import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Change this to match your GitHub repo name
// e.g. if your repo is akkk9202/tennis-pp-analyzer, use '/tennis-pp-analyzer/'
const BASE = process.env.VITE_BASE_URL || '/tennis-pp-analyzer/';

export default defineConfig({
  plugins: [react()],
  base: BASE,
});
