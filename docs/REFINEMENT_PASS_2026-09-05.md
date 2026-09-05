# Playball refinement pass — 2026-09-05

This pass addresses interaction regressions and the remaining visual seams found after the larger design-system overhaul.

## Lineup

- Long press now gives immediate visual feedback instead of feeling like a dead touch: the held row compresses subtly, gains a side accent and fills a timed progress rail for the 450ms hold.
- A completed hold gives a tiny supported-device haptic and opens the player directly on Stats.
- The player-card overlay deals in with a short compositor-only transition so the jump from the lineup to Stats is not a hard cut.
- Pitcher rotation/bullpen swaps now preserve a pitcher's natural staff role. An RP can borrow an SP label while in the rotation and returns to RP when he goes back to the bullpen.
- Older saves containing the former corrupted `SP in bullpen / no homeRole` state self-heal the next time that arm participates in the swap.
- Regression tests reproduce both the exact reported RP -> rotation -> bullpen sequence and the legacy-save corruption shape.

## Today / Tonight

The matchup no longer tries to fit a crest, record and pitcher name into each half of one narrow phone row.

- Row 1: crests + records + VS/AT.
- Row 2: two fixed probable-pitcher cells.
- Long school/matchup labels and pitcher names are width-constrained with ellipsis rather than allowed to escape the card.
- Probable pitchers are tappable and open directly on Stats.

## Budget

### Staff

Candidate hiring now has a true primary CTA (`Hire`, `Replace`, budget-short state) instead of an inline text affordance.

### Facilities

Facilities are no longer presented as another purchase list or horizontal catalog. The screen now behaves like a program-development blueprint:

1. Choose one of three specialty tiles (Bat / Arm / Club).
2. Inspect one focused facility.
3. See all three progression levels together.
4. Compare current effect, next effect, cost and post-project budget.
5. Commit through a clear Build/Upgrade CTA.

## Program History

History is now one consistent archive with three rooms:

- **Seasons** — yearbook cards with finish, record, conference result, final ranking and honors.
- **The Book** — grouped modern record cards rather than the previous mixed inline table treatment.
- **Alumni** — drafted/departed players and their professional path.

The existing professional-career simulation remains intact. Drafted players can progress through Rookie Ball, Single-A, Double-A, Triple-A and **The Show**, with call-ups, notable seasons, releases and retirement. The durable alumni note is now enough to reopen a former player's card years later, so the pro timeline no longer becomes inaccessible when his live college career row is gone.

## Coach navigation + profile

- The account dropdown no longer contains a redundant `Coach profile` menu row.
- The coach identity/photo row itself is the profile button.
- The remaining menu is Inbox + Settings.
- The coach hero portrait now bleeds/fades into the identity copy rather than ending on a hard crop line; career/here metrics form one footer across the composition.

## College profile

The persistent Decisions launcher now reserves its own bottom footprint. All dossier/results/profile content can scroll above it instead of being physically hidden behind the launcher.

## Dugout

The open Dugout command tray is constrained to explicit left/right phone gutters. Decision buttons have safe internal padding and long labels wrap inside the control rather than reading as edge overflow.

## Ballpark readability

Every animated player marker now owns a neutral ground halo in addition to the existing uniform rim:

- dark outer ring
- warm light inner ring

The halo moves with the player and does not use team colors, so at least one edge remains readable on grass, dirt and against any school palette. This avoids weakening team identity just to solve field contrast.

## Validation

- All TypeScript/TSX source and test files parse cleanly (188 files, zero syntax diagnostics).
- A dedicated pitching-staff regression test was added for the reported role-swap path and legacy-save recovery.
- Full dependency-backed Vite/Vitest execution remains unavailable in this isolated environment because the project's npm dependencies are not installed here.
