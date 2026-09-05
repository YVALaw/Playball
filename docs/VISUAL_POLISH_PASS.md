# Visual and interaction polish pass

This pass brings the remaining older Playball surfaces into the same interaction language as the newer management screens.

## Lineup

- Long-press opens the selected player's **Stats** directly from starters, bench, rotation, and bullpen.
- Injured bench players remain inspectable even when they cannot be inserted into the lineup.
- Hold and tap are mutually exclusive so reading a player never accidentally moves him.
- Selection feedback occupies a fixed-height slot; choosing a player no longer pushes the batting order down.
- Temporary rotation assignments preserve a pitcher's home role, so a reliever returns to the bullpen as RP rather than inheriting SP permanently.

## Today

- Tonight matchup labels constrain both sides correctly on narrow phones; long school names truncate instead of overflowing outside the card.

## Budget

- Staff is organized by coaching **seat**, not as one vertical candidate inventory.
- The selected seat anchors the page while candidates form a horizontal snap decision deck.
- Facilities use the same peer-alternative deck pattern.
- Delegated staffing/facilities use compact state banners instead of persistent “go to Settings” instructions.

## College profile + dossier

- Rebuilt as an identity-first profile rather than an older panel/stat stack.
- Team color is used as an accent rather than body-text color.
- Overview uses concise identity, matchup, and form grids.
- Dossier uses a structured intelligence grid instead of a chain of pointer notes.
- Coach information, public data, and scouting reads each have a clear visual layer.

## Coach profile

- New identity hero, career metrics, facts grid, skill cards, career blocks, trophy case, and achievement grid.
- School colors accent career stops without becoming text colors.

## Strategy

- Dynamic opponent playbooks no longer become permanent tabs.
- Strategy has two stable top-level states: Standing Plan and the selected Opponent Plan.
- Saved opponent plans live in a dedicated library sheet that can scale to many schools.
- AUTO counters change a defensive dimension as well as handedness-dependent values, eliminating common no-op cases.
- AUTO shows an explicit temporary success state after applying counters.

## Scouting

- Scouting-ready dialogs use a stable structural dark surface instead of a dynamic team-color background.
- Report-ready wording focuses on what was learned and what to do with it.
- The same semantic-surface rule was extended to older structural dark cards throughout the app.

## Dugout

- Rebuilt the open manager tray around live game context: inning, score, outs, base situation, and decision purpose.
- Manager actions use compact two-column decision cards so the live-game surface stays fast.

## Navigation and motion

- Scroll reset now occurs before paint, preventing the incoming screen from flashing at the previous screen's scroll position.
- Content gets the transition; persistent app chrome stays anchored.
- Entry motion is short and disabled when View Transitions or reduced motion already handle the change.

## Surfaces intentionally kept dense

Rosters, results, schedules, standings, rankings, and award lists remain compact. Their job is scanning, so converting every row into a large card would reduce usability rather than modernize it.
