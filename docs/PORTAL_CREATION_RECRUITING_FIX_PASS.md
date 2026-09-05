# Portal / Creation / Recruiting Fix Pass — 2026-09-05

## Coach creation
- Removed the large Randomize control from Build the Coach.
- Added a Main menu back action to step 1 using the same setup-header navigation language as later steps.
- Tightened small-screen layout so the portrait, name, age, home-state and appearance controls do not compete for width.

## Portal player card hardening
- Player profiles now resolve players who are temporarily between rosters in the transfer portal.
- Incoming portal players are associated with their source program while the profile is open.
- This removes an invalid-player overlay state that was a plausible contributor to the reported intermittent navigation jump during the offseason.

## Portal signing dialog
- Review Signing now uses a centered dialog within the app frame.
- Symmetric phone gutters, constrained max width and viewport-aware max height were added.
- Short-height devices move the card slightly upward while keeping equal horizontal margins.

## Recruiting filters
- Replaced the legacy inline filter form with a dedicated recruiting filter room.
- Position and star filters use consistent decision grids.
- Geography uses a compact program-context card.
- Pipeline / untouched / in-reach filters use modern toggle cards with clear active states.
- The filter header reports how many filter groups are currently active.

## Validation
- All 118 TS/TSX source files parse with zero TypeScript syntax diagnostics.
- A full dependency-backed build still requires the project's npm dependencies.
