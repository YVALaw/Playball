# Program visual rework

Based on the supplied Playball v0.8.0 project, `Playball-main (10).zip`.

## What changed

| Area | Updated experience |
| --- | --- |
| Overview | School crest and identity, regular-season record, conference position, prestige, and one priority attention card. The full team card opens the board's team mandates. Staff, Facilities, Budget, Network, History, and Alumni are direct destinations. The duplicate head coach link is removed; the header profile link remains. |
| History | Trophy shelf, all-time record, winningest season, six-season win-percentage trend, coaching-era markers, championship emphasis, and an All seasons / Highlights filter. Conference details and player honors expand inside each season. |
| Alumni | Portrait cards grouped by final college year, name search, Everyone / Drafted / Honored filters, college career highlights, and saved Hall of Fame, national-record, award, and draft badges. The list and hub count merge departure notes, school career rows, and Hall plaques, including older saves without departure notes. Current roster and portal players are excluded, and entries are deduplicated by player ID. Year groups initially show their players. |
| Alumni profiles | One identity card contains the portrait, school years, Hall of Fame status and induction year, and college career totals. Overview, College seasons, and Honors separate the career story, season statistics, and recognition. The overview shows a compact latest honor and draft row where saved; Signature moments, Life after college, and Player background start folded in one disclosure group. Honors contains the saved Hall citation, awards, and national records. Two-way players have both career totals and one combined batting/pitching entry per season. Hall-only archives show explicit empty states where statistics or departure notes are unavailable. |
| Staff | Distinct, deterministic coach portraits; role, specialty, and strongest skill; current focus; named project target and progress; contract alerts. Full rating bars live in Abilities. |
| Staff profiles | Work, Abilities, and Contract are separate tabs. Current projects lead the Work view and show the target, progress, potential gain, timing, and success chance. Recent results stay with work. Hiring, replacing, renewing, and releasing remain connected to the existing store actions. |
| Facilities | Cutaway drawings show a batter and machine in the hitting barn, a mound, target and monitor in the pitching lab, and lockers, a bench and a recruiting board in the clubhouse. Labels wrap, tile columns adapt to available width and text size, and the blueprint uses the correct theme text color. Level indicators, benefit comparisons, expandable levels, and cost confirmation remain. |
| Network | State tiles grouped by Playball's existing recruiting regions, active-pipeline cues, a selected-state strength meter, signing history, and coordinator work. A selected state carries through to project setup. Scouting information is available in an expandable section. |
| Global styling | Shape rules now target actual components instead of every section or class containing “card.” Cards use a 10px radius, standalone controls 8px, and dialogs 14px. Joined rows keep straight internal dividers and rounded outer edges. Segmented controls use 4px inset spacing and 6px inner corners; navigation buttons have gaps and selected backgrounds. Stat strips share one outline, and spaced Settings cards no longer sit inside a clipped, shadowed wrapper. Circular portraits and indicators retain their shape. |
| Attention | The Program prompt and regular-season/postseason navigation use the same attention rules: board updates, ending staff contracts, new achievements, and new national records. The dot clears when no outstanding item remains. |

## Preserved behavior

The simulation engine and team data are byte-for-byte unchanged. Recruiting and development formulas, staff/project mechanics, contract rules, budgets, and postseason logic are unchanged. No runtime or development dependencies were added to the project manifests. The only edit in `src/state/store.ts` extends the navigation type with `history` and `alumni`.

The testing shortcut source is unchanged: SIM THE SEASON and the Pascagoula Tech testing setup retain the original build gating. This is the complete source project, including the original Android project; it is not a newly generated APK.

The redesign derives display information from saved data. Historical jersey numbers and detailed positions are not manufactured when the archive does not contain them. School career years and all-college career totals are labeled separately. Record-holder badges refer to the existing national record book.

## Validation

- TypeScript checking and production build: passed.
- Targeted regression checks: 30 passed across archive summaries, archive/attention fixes, back navigation, and generated stylesheet preservation.
- DOM interaction checks: 19 passed with real store actions and mocked disk persistence. Coverage includes the prior Program flows, one Hall identity, navigation to all saved honors and records, combined two-way season rows, Hall-only empty states, and switching back to a live player profile.
- The earlier complete regression run passed 89 files / 1,524 existing tests, with 3 archive tests passing separately. That complete suite was not rerun for this presentation-only refinement. See `PROGRAM-VALIDATION.txt` for the verification record.

The browser preview remains unavailable after `ERR_BLOCKED_BY_CLIENT`. The unchanged facility SVGs were rendered and inspected during the previous pass. The DOM harness does not measure pixel layout or native touch behavior. Full-screen screenshots, light/dark visual inspection, small-screen overflow, and larger-text layout remain unverified. Styling uses the existing theme/text-size tokens, responsive rules, 44px minimum segmented/context controls, keyboard focus styles, and the existing reduced-motion behavior.

The production build retains existing warnings about large bundles and `/assets/club/generic-player.png`; the new screens use the application's SVG portraits and SVG facility drawings.

## Run locally

```sh
npm ci
npm run dev
```

The existing Vite configuration serves development on port 5174. For verification:

```sh
npm run typecheck
npm test
npm run build
```
