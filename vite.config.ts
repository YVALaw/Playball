import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 5174, not 5173, and the reason is storage rather than taste. See the
    // `preview` block below: 5173 belongs to the frozen build now, because a
    // save cannot follow you across a port. The dev server gets the next one.
    port: 5174,
    // Bind every interface, not just loopback, so a phone on the same wifi can
    // reach the dev server. This is how the app gets tested on the device it is
    // actually being built for, well before Capacitor is involved.
    host: true,
  },
  /**
   * A build you can play while the code underneath you changes.
   *
   * The dev server hot-reloads on every save, which is right while building and
   * wrong while testing: a dynasty five seasons deep does not want the page
   * swapped out because somebody touched a comment in another file. `vite
   * preview` serves the built bundle in `dist` and watches nothing, so a
   * testing session survives any amount of work happening beside it and only
   * changes when the build is deliberately run again.
   *
   * It serves on 5173 — the dev server's traditional port — deliberately. Saves
   * live in IndexedDB, and IndexedDB is scoped to an origin, which includes the
   * port. A dynasty played at `http://10.0.0.40:5173` is simply not present at
   * `http://10.0.0.40:4173`; the app there is working perfectly and showing you
   * an empty new-dynasty screen, which reads exactly like a broken build. There
   * is no export/import to carry a save across, so the only way the frozen
   * build opens the career you already have is to serve it from the same
   * origin that career was created at. Hence: frozen on 5173, dev on 5174.
   */
  preview: {
    port: 5173,
    host: true,
  },
  // Capacitor loads the build from the filesystem, so assets must be relative.
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
