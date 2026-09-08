# Testing shortcuts

Three aids once existed for exercising June and the offseason without
playing fifty dates first. **All three were removed on September 8 2026.**
They were built for the reporter, they were gated so a store build dropped
them whole, and they are now gone from the source as well:

- **SIM THE SEASON** on Today (the TEST BUILD strip) — removed. A season is
  played, not skipped. SIM WEEK on the Board is the fast route that ships.
- **Pascagoula Tech (PSC)** guaranteed among the five rookie job offers —
  removed. The opening market is drawn the same way for everyone.
- **Five 99-rated players** on PSC at career start — removed. No program
  begins with authored men.

The `.test-shortcuts` strip went with them (`src/ui/prototype-frame.css`).

## What the gate still does

One constant, `TEST_SHORTCUTS` in `src/state/testBuild.ts`, defined by
`vite.config.ts` (`__TEST_SHORTCUTS__`). It now has exactly one reader: the
Settings UNLOCK button that stands in for the god mode purchase, so god mode
can be exercised on a test build without a real Play transaction. A store
build shows the entitlement's state and no way to flip it.

| Build | Free god-mode unlock |
|---|---|
| `npm run dev`, `npm run preview` of a dev build | in |
| `npm run build`, `npm run apk` (the store build) | out |
| `npm run apk:test` (`VITE_TEST_SHORTCUTS=1`) | in — a test APK for the emulator |
| Vitest | never, so fresh-world assertions stay honest |
| `tsx` scripts (sim.ts, the probes) | never |

The one thing that survives and ships: SIM THE SEASON also exists inside god
mode's calendar sheet. That is a god-mode power a player has paid for, not a
development aid, and it stays.

Gone for good, and never on this list again: **Hans Hood**, the 20-overall /
99-potential third baseman once injected into every recruiting class.
`ensureHoodHans` was removed in the September 4 audit pass.
