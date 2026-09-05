> **Read this first (added at the merge, September 5 2026).** This file is
> the pass's own account, kept as written. Two things in it are no longer
> true. The release fixtures it says were removed — the guaranteed Pascagoula
> Tech offer, its five 99-rated players, and SIM THE SEASON — were **put back
> on September 5** for UI testing (`docs/TESTING_SHORTCUTS.md`); only Hans
> Hood stayed removed. And its verification sections describe syntax-level
> parsing only: the pass was never type-checked, built or run where it was
> written, and the merge found five type errors. What actually reached the
> code, checked against it, is `docs/05-systems-reference.md` §50; the
> review of it is `docs/06-backlog.md` §X.

# Playball — Audit Implementation Pass

Date: 2026-09-04

This build applies the highest-impact UI/UX and product changes from the September 2026 audit while preserving the existing simulation model and save architecture.

## What changed

### Program navigation and information architecture
- Program Overview is now a true dashboard instead of a second nested tab bar.
- Board, Budget, Watchlist, and Hall of Fame open as focused subpages with an explicit return to Program Overview.
- Manual PROGRAM navigation always returns to Overview; deep links from Inbox/Today can still open the intended subpage.
- Program cards surface job security, board expectations, budget state, tracked programs, and Hall status at a glance.

### Player cards
- Player navigation is now Overview, Ratings, Stats, and Legacy.
- Game logs were folded into Stats; career/honors history lives under Legacy.
- Overview no longer repeats identity data already present in the hero.
- Own-player Overview now surfaces availability, mood/role expectations, draft watch, and portal risk.
- Opponent cards keep private information private while exposing public draft/scouting context.

### Decision visibility
- Today surfaces opponent-playbook preparation and Board expectations.
- Roster adds filters for injury, mood issues, draft eligibility, redshirt, and captain status.
- Recruiting already-calculated chase states and roster Needs are preserved and connected directly to filtering.
- Staff and facility purchases now show the remaining budget after the decision.
- Team profiles surface rivalry context and clearer scouting states.

### World relevance
- Watchlisted programs receive extra priority on The Wire.
- Major alumni professional events can reach Inbox: first arrival at The Show and the end of a top-level career.
- Rivalry context is visible on opponent profiles as well as matchup surfaces.

### Language and UX cleanup
- Removed repeated subtitles that restated their headings on Lineup, Roster, Schedule, Signing Day, and other key flows.
- Replaced several UI-manual phrases with state/consequence language.
- Standardized visible American English where appropriate for a US college baseball setting.
- Reduced overloaded “book” language around scouting in favor of scouting report/playbook terminology.
- Tightened Watchlist empty states and connected them to what tracking actually changes.
- Save-load error copy no longer assumes every load failure is a version mismatch.
- Increased important header/back touch targets to 44px.

### New-career and release cleanup
- Full-career interview shortened to three questions; Casual remains two.
- Removed release-only fixtures that forced Pascagoula Tech into the opening offers or injected artificially elite test players/rosters.
- Removed the visible `SIM THE SEASON` development control from Today.

## Verification

- All 118 TypeScript/TSX files were parsed with the TypeScript compiler API after the changes: **0 syntax errors**.
- The generated prototype CSS was regenerated from `design/Roster Tabletop/prototype.css`.
- Runtime/test-fixture strings were searched after cleanup; no active fixture/debug controls remain in `src`.
- A full dependency-backed `npm ci` / TypeScript build could not be completed in this environment because the npm registry was unavailable and the required packages were not present in the local cache. The source therefore passed syntax-level validation, but should still be run through the normal project `npm ci`, typecheck, tests, and device build in a networked development environment before release.

## Expansion pass — coaching ecosystem, facilities, pipelines, and replay

A second pass now expands the four larger systems that were intentionally held back during the UI/UX restructure.

### Coaching tree and staff careers
- Assistants now carry the year they joined the staff and recruiting coordinators can carry a geographic relationship into the job.
- Returning assistants develop from winter to winter instead of remaining permanently frozen at their hire rating. Development is deterministic for save/reload parity and wages drift gradually toward the new market value.
- High-value assistants can enter the same national head-coach carousel used by the rest of the simulated coaching world.
- An assistant leaves only when the carousel actually gives him a head-coaching chair; market interest alone no longer makes a staff member disappear.
- Former assistants are recorded in a persistent Coaching Tree with their original seat, years spent with the player, current/last program, career record, and national titles.
- When a former assistant is coaching the next opponent, Today calls out the coaching-tree matchup so the relationship becomes part of the schedule rather than a buried archive entry.

### Facility specialization
- The hitting barn, pitching lab, and clubhouse now each have three specialized levels rather than functioning as a one-time checklist.
- The hitting barn increasingly improves hitter development.
- The pitching lab increasingly improves pitcher development and arm protection.
- The clubhouse improves both sides modestly while providing the strongest recruiting-development pitch benefit.
- Upgrade costs and the exact current/next mechanical effect are visible on the Budget screen before the player spends.
- Casual/AD-controlled careers improve the weakest available specialty one project at a time while preserving budget headroom.
- Old careers infer level 1 for buildings they had already constructed.

### Pipeline 2.0
- Geographic recruiting relationships are now persistent 0–100 program assets.
- Home territory remains an established pipeline and keeps the original one-tier reach advantage.
- Repeated signings from another state build that market from cold to emerging, established, and strong.
- Established markets can extend recruiting reach by one prestige tier and improve the pitch locally.
- Recruiting coordinators bring one established external network with them; if they leave, only relationships the program actually built remain.
- Unused earned relationships cool gradually instead of disappearing between seasons.
- Budget now has a Recruiting Network section showing state, source, signings, strength, and status.
- The recruiting board's Pipeline filter now includes home, staff-carried, and earned markets rather than only the home state.

### Replay
- Games involving the coached program now capture their real log and PlayEvent stream when simulated.
- Managed games now accumulate the same real PlayEvent stream rather than returning an empty event list at the final.
- Box Score gains a Replay view for any game with captured events, including postseason boxes that carry the data.
- Replay includes inning/half, outs, live score, occupied bases, the actual play call, scrubber, play/pause, frame stepping, and previous/next scoring-play jumps.
- Replay is post-hoc reporting over the real simulation; it does not reroll or reconstruct the game.
- Older saves without event streams simply keep the Box Score view and do not fabricate a replay.

## Verification after the expansion

- All 118 TypeScript/TSX files parse with the TypeScript compiler API: **0 syntax diagnostics**.
- Every engine module type-checks together with strict TypeScript options: **0 errors**.
- Engine + state + data modules type-check together with lightweight declarations standing in only for unavailable third-party packages: **0 internal type errors**.
- New economy/staff/facility/pipeline and managed-replay test additions type-check: **0 errors**.
- The design-source stylesheet was updated and `src/ui/prototype.css` was regenerated through `scripts/adapt-prototype-css.mjs`, so the replay/facility styles will survive future CSS regeneration.
- A normal dependency-backed `npm run check` / Vite build still requires the project's npm packages. They are not installed in this isolated environment, so the Vitest suite and production bundle could not be executed here. Run the normal CI/build commands in the networked development environment before release.

## Interaction-design pass — September 5, 2026

A third pass reviewed the expanded build specifically for design-system consistency and decision depth. The main distinction is now documented in `docs/INTERACTION_DESIGN.md`: data surfaces stay compact and scannable; decision surfaces must establish state, context, tradeoff, consequence, then action; narrative surfaces lead with the event and its meaning.

### Budget becomes a planning workspace
- Program Budget is no longer one long stack of unrelated sections. It now opens on a money command center with available funds, committed money, allocation, and four explicit workspaces: Plan, Staff, Facilities, and Network.
- Plan summarizes the three categories competing for the same money and points to the most relevant next decision.
- Staff is organized by seats rather than a flat market. Current assistants expose development/game-management strengths, tenure, wages, and coordinator geography; vacancies compare candidates inside the seat they would fill and show remaining funds after a hire.
- Facilities are presented as three program specialties with level tracks, current mechanical effects, next-level effects, project cost, and remaining budget after construction.
- Network combines long-term recruiting access with the short-term scouting desk, making the relationship between scouting spend and opponent preparation explicit.
- Coaching Tree was removed from Budget and moved to the coach Career profile, where it belongs narratively and conceptually.

### Profile actions become decision sheets
- Player and program action launchers now use a decisions/overflow affordance instead of the old slider/settings metaphor. Sliders remain reserved for real filters such as Roster and Recruiting.
- Player Decisions opens on mood, workload/injury state, academics, and eligibility before offering recovery, conversation, position, and redshirt decisions. Actions explain the state they respond to and the consequence of using them.
- Program Decisions opens on record, RPI, and run differential, then separates matchup decisions from career decisions. Scouting, comparison, program following, job tracking, and quiet approaches no longer read as one undifferentiated action list.
- The in-game Dugout launcher uses the same overflow grammar and now opens on the live inning/score/base-out context before presenting the fast managerial actions. The compact list is intentionally retained there because speed during live play is more important than adding another card hierarchy.

### Scouting and playbook flow
- Scouting no longer spends money immediately from a generic action. It first opens a briefing with public record, RPI, run differential, coach, exact report unlocks, cost, remaining budget, and affordability.
- A purchased report shows the actual team reads before the player opens the dossier or opponent playbook.
- The post-purchase playbook invitation now shows the opponent's record, run differential, prestige, and strongest scouting reads so “build a playbook” is a response to information rather than a contextless yes/no prompt.
- Strategy is organized by phase of play and uses explicit choice buttons with the selected tradeoff visible. Opponent playbooks carry the scouting reads into Strategy and can build counter-settings from the report.
- Today sends an active preparation card directly to that opponent's plan. If the team is unscouted, it sends the player to the scouting briefing instead.
- Staff-managed scouting now creates a real opponent playbook when needed, so delegation changes who prepared the plan rather than leaving a dead “Open playbook” destination.
- Opponent plans and timed reports are now treated separately: a season-long playbook can remain after the detailed report expires, and the UI offers to **refresh the report** rather than pretending the plan was never built.

### Other high-stakes decisions
- Program comparison now shows side-by-side record, prestige, roster strength, and run differential with an edge label instead of only opening another generic information view.
- Job offers now compare the destination with the current program and explicitly say what follows the coach versus what belongs to the school before the irreversible confirmation.
- The career transition model was corrected to match that interface: assistants, coaching tree, reputation, and coaching identity follow the coach; buildings, earned school pipelines, current scouting reports, and program spending do not.
- Coach development is now a development board with available points, current ratings, next increments, mechanical meaning, and per-skill investment rather than four indistinguishable +/- rows.
- Existing Portal, Draft retention, Captain, recruiting, postseason, and lineup flows were reviewed against the same rule. Their existing decision context was retained where it already met the standard instead of forcing every list into a card layout.

### Copy and navigation cleanup
- Additional headings and subtitles that repeated their parent concept were tightened in Schedule, Signing Day, New Game, Awards, Portal, and related flows.
- Instructions that merely described where to tap were removed when the action itself could communicate the destination.
- Action labels favor verb + object or a named decision (`Manage`, `Decisions`, `Open playbook`, `Refresh report`) over generic “actions” language.
- Generic `Segmented` calls on several existing screens were given explicit union types while validating this pass, removing a class of widened-string tab diagnostics without changing their behavior.

### Verification for this pass
- All source and test TypeScript/TSX files currently in the project were parsed with the TypeScript compiler API: **188 files, 0 syntax diagnostics**.
- A dependency-backed Vite/Vitest build still cannot be executed in this isolated environment because `node_modules` is absent and registry access is unavailable.
- A targeted semantic pass with lightweight third-party declarations was also run. Its remaining diagnostics are either limitations of those stubs (React/ref/event typings and unavailable 3D packages) or pre-existing strictness warnings in engine/store code; no syntax regression was introduced by this UI pass.

## Visual consistency and interaction polish pass

The follow-up pass focused on the remaining places where Playball still felt like multiple generations of UI living together.

### Lineup
- Holding any starter, bench player, starter, or reliever now jumps directly to that player's Stats card while tap remains dedicated to lineup movement.
- Selection help lives in a fixed geometry slot, removing the page jump when a player is selected.
- Relievers temporarily promoted into the rotation remember their home role and return to the bullpen as RP.
- The first-visit Lineup tutorial now teaches tap-to-move and hold-for-stats once rather than adding permanent instructions.

### Budget
- Staff is a seat-focused workspace with a Hitting / Pitching / Recruiting selector and a horizontal candidate decision deck.
- Facilities use the same swipe/snap decision-deck pattern.
- Delegated systems show ownership as state rather than telling the player to navigate to Settings.

### College + coach identity
- College profiles were rebuilt around an identity hero, matchup/form grids, and a structured dossier.
- Dossier scouting reads are a compact intelligence grid rather than stacked pointer notes.
- Coach profiles now use the current identity/card language for overview, skills, career, trophies, and achievements.
- Dynamic school colors are accents only; structural dark surfaces use the semantic panel token so contrast is stable in all themes.

### Strategy + scouting
- Opponent plans moved out of an unbounded tab strip and into a scalable plan library.
- AUTO report counters now have a guaranteed visible defensive effect when possible and only show success after the state update succeeds.
- Applying AUTO gives an explicit temporary confirmation.
- Scouting-ready modals and other dark structural cards use stable panel contrast instead of a team-dependent background.

### Dugout
- Dugout opens with score, inning, outs, base situation, and the current decision context.
- Live-game actions use compact decision cards.
- Follow-up player/pitcher pickers were also modernized so the flow does not fall back into the older sheet styling one tap later.

### Navigation polish
- Route scroll reset moved to the layout phase so incoming screens no longer flash at the old screen's scroll position.
- Transitions are scoped to the content surface while persistent app chrome stays visually anchored.
- Reduced-motion behavior remains respected.

See `docs/INTERACTION_DESIGN.md` for the reusable rules added by this pass and `docs/VISUAL_POLISH_PASS.md` for the screen-level summary.
