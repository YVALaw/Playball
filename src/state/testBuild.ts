// testBuild.ts
// Whether this build carries the testing shortcuts.
//
// The three development aids this flag once carried — SIM THE SEASON on
// Today, Pascagoula Tech guaranteed on the rookie desk, five 99-rated men on
// its roster — were removed on September 8 2026 (docs/TESTING_SHORTCUTS.md).
// What is left is one reader: the Settings button that stands in for the god
// mode purchase, so the entitlement can be exercised without a real Play
// transaction. The decision is made once, at build time:
//
//   - the dev server (`npm run dev`, `npm run preview` of a dev build) has it;
//   - `npm run build` and `npm run apk` do not — the define is `false` and the
//     branch is dead code the bundler drops;
//   - `npm run apk:test` builds a test APK that has it (VITE_TEST_SHORTCUTS=1);
//   - Vitest never has it, so fresh-world assertions stay honest;
//   - tsx scripts (sim.ts, the probes) never see the define and read false.

declare const __TEST_SHORTCUTS__: boolean | undefined;

const underVitest = typeof process !== 'undefined' && Boolean(process.env?.['VITEST']);

export const TEST_SHORTCUTS: boolean =
  !underVitest && typeof __TEST_SHORTCUTS__ !== 'undefined' && __TEST_SHORTCUTS__ === true;
