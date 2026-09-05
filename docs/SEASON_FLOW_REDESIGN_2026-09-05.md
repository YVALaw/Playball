# Season Flow Redesign — 2026-09-05

This pass brings the front door, program archive, facilities, postseason, and the complete offseason sequence onto the same current Playball interaction language.

## Front door / creation carried forward
- Updated Start screen hierarchy and resume card.
- Coach creation uses card-based control/approach/interview choices.
- Offer modal uses the same animated overlay language as in-career decisions.

## Program
- Facilities keep the specialty-first model but now read as a three-stage development path rather than a purchase list.
- History remains Seasons / The Book / Alumni.
- The Book now opens one record room at a time (Single Game, Feats, Season, Career, Team, Coaching) instead of stacking every record group down one long page.
- Alumni/pro-career tracking remains surfaced in History.

## Postseason
- App frame gets a dedicated postseason visual mode.
- Conference / Regionals / National are explicit stage cards with CURRENT / COMPLETED / UP NEXT state.
- NEXT GAME / BRACKET is a two-room tournament navigation surface rather than a generic segmented control.
- Pregame card has stronger tournament hierarchy.
- Bracket maps use contained round columns and clearer user-team emphasis.
- Postseason lineup takeover animates in instead of cutting abruptly.
- Existing stage review and box-score behavior is preserved.

## Offseason roadmap
The seven-step flow is still:
1. Awards
2. Season review
3. Coach development
4. Draft
5. Portal
6. Recruiting
7. Class review / Signing Day

The old seven tiny circles were replaced by:
- a current-step command card,
- a horizontally scrollable roadmap,
- DONE / NOW / REVISIT / LOCKED states,
- past steps still tappable,
- future steps still visible but unavailable.

## Awards
- Ceremony cards read as event cards rather than list rows.
- Reveal surfaces, showpiece and skip control use the same visual system as the rest of the app.

## Season review
- Record/rank tiles, board objectives, season leaders, MVP and prestige movement are visually separated into deliberate review surfaces.

## Draft
- Roster holes are now a small needs grid.
- Departure/retention rows and retention sheets follow the same offseason card/sheet language.

## Portal
- The command center, budget state, retention candidates and incoming candidates now read as one two-sided decision room.

## Recruiting
- Recruiting rows, filter state, prospect details and pinned actions inherit the same offseason hierarchy without sacrificing dense scanning.

## Class review / Signing Day
- Final step is explicitly labeled CLASS REVIEW · SIGNING DAY.
- Class summary, rankings and top signings are separated into modern archive/decision surfaces.

## Motion
- Seasonal sheets share a consistent rise animation.
- Postseason lineup takeover animates horizontally into the tournament frame.
- Reduced-motion settings still disable the new transitions.

## Validation
- All 188 TypeScript/TSX source + test files parsed with zero syntax diagnostics using TypeScript 5.8.3.
- A full dependency-backed Vite/Vitest run still requires the project's npm dependency tree to be available in the runtime.
