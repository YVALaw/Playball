# Testing shortcuts

Three aids exist for exercising June and the offseason without playing
fifty dates first. They are for the reporter's testing, never for a
player's phone, and since September 7 2026 the decision is made once, at
build time.

- **SIM THE SEASON** on Today (`src/ui/screens/Today.tsx`, the TEST BUILD
  strip): simulates the remaining regular season in one press.
- **Pascagoula Tech (PSC)** is guaranteed among the five rookie job offers
  (`src/ui/screens/NewGame.tsx`).
- PSC starts each new career with **five 99-rated players**: the first three
  hitters and first two starters (`store.start` in `src/state/store.ts`).

## The gate

One constant, `TEST_SHORTCUTS` in `src/state/testBuild.ts`, read by all
three sites. It is defined by `vite.config.ts` (`__TEST_SHORTCUTS__`) and,
where it is false, the branches are dead code the bundler drops whole.

| Build | Shortcuts |
|---|---|
| `npm run dev`, `npm run preview` of a dev build | in |
| `npm run build`, `npm run apk` (the store build) | out |
| `npm run apk:test` (`VITE_TEST_SHORTCUTS=1`) | in — a test APK for the emulator |
| Vitest | never, so fresh-world assertions stay honest |
| `tsx` scripts (sim.ts, the probes) | never |

The same flag gates the Settings UNLOCK button that stands in for the god
mode purchase until Play Billing arrives (stage 19). A store build shows the
entitlement's state and no way to flip it.

Nothing is deleted before release. Stage 19 ships by building with
`npm run apk`, never `apk:test`. The one caveat: SIM THE SEASON *also*
exists inside god mode's calendar sheet, by design, and ships to players
there.

Gone for good, not on this list: **Hans Hood**, the 20-overall / 99-potential
third baseman once injected into every recruiting class. `ensureHoodHans` was
removed in the September 4 audit pass and has not come back.
