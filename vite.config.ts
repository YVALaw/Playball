import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind every interface, not just loopback, so a phone on the same wifi can
    // reach the dev server. This is how the app gets tested on the device it is
    // actually being built for, well before Capacitor is involved.
    host: true,
  },
  // Capacitor loads the build from the filesystem, so assets must be relative.
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
