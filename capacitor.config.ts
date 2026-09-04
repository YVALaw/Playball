/*
  capacitor.config.ts
  Stage 18 — the native shell.

  Capacitor serves the built bundle from inside the APK rather than over a
  network, so `webDir` points at what `npm run build` already produces and
  nothing about the app's own build changes. The game was written
  mobile-first against a real WebView all along; this stage is the wrapper,
  not a port.

  `appId` is permanent once the app is on a store listing — it is the
  package name Android identifies the install by, and it cannot be changed
  afterwards without shipping a different app. Named here so the decision is
  visible rather than buried in a generated file.
*/
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playball.dynasty',
  appName: 'Playball',
  webDir: 'dist',
  android: {
    /*
      The game is its own world: no link handling, no deep links, and the
      WebView never navigates off the bundle. Anything that did would be a
      bug rather than a feature.
    */
    allowMixedContent: false,
  },
  server: {
    /*
      androidScheme https, so the WebView origin is a secure context. The
      app stores a career in IndexedDB, and browsers reserve some storage
      APIs for secure origins — an http scheme quietly costs the save
      system its footing.
    */
    androidScheme: 'https',
  },
};

export default config;
