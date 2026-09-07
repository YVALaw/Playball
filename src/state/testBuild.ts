// testBuild.ts
// Whether this build carries the testing shortcuts.
//
// Three aids exist for exercising June and the offseason without playing
// fifty dates first: SIM THE SEASON on Today, Pascagoula Tech guaranteed on
// the rookie desk, and five 99-rated men on its roster (docs/TESTING_SHORTCUTS.md).
// They are for the reporter's testing, never for a player's phone, so the
// decision is made once, at build time, and every site reads it here:
//
//   - the dev server (`npm run dev`, `npm run preview` of a dev build) has them;
//   - `npm run build` and `npm run apk` do not — the define is `false` and the
//     branches are dead code the bundler drops;
//   - `npm run apk:test` builds a test APK that has them (VITE_TEST_SHORTCUTS=1);
//   - Vitest never has them, so fresh-world assertions stay honest;
//   - tsx scripts (sim.ts, the probes) never see the define and read false.

declare const __TEST_SHORTCUTS__: boolean | undefined;

const underVitest = typeof process !== 'undefined' && Boolean(process.env?.['VITEST']);

export const TEST_SHORTCUTS: boolean =
  !underVitest && typeof __TEST_SHORTCUTS__ !== 'undefined' && __TEST_SHORTCUTS__ === true;
