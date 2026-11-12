import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the backend in dev so the browser sees one origin.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
