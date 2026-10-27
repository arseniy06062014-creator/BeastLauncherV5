import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built index.html works when loaded via file:// in Electron
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
