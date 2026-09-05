# Testing shortcuts

Temporary development aids restored on September 5, 2026 for rapid UI validation.

- **SIM THE SEASON** on Today (`src/ui/screens/Today.tsx`, the TEST BUILD
  strip): simulates the remaining regular season in one press.
- **Pascagoula Tech (PSC)** is guaranteed among the five rookie job offers
  (`src/ui/screens/NewGame.tsx`).
- PSC starts each new non-Vitest career with **five 99-rated players**: the
  first three hitters and first two starters (`store.start` in
  `src/state/store.ts`).

All three are marked `TESTING ONLY` in code and are intentionally test-only.
They leave together in stage 19 (ship), before any store build.

Gone for good, not on this list: **Hans Hood**, the 20-overall / 99-potential
third baseman once injected into every recruiting class. `ensureHoodHans` was
removed in the September 4 audit pass and has not come back.
