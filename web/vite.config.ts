import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy forwards /api/* to the API, so the browser sees a single origin
// (no CORS configuration needed).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
