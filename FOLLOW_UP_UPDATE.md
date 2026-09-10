# Playball — tutorial and gameplay fixes

This is the complete updated project. It includes the tutorial improvements from the first ZIP and the follow-up fixes below.

## What changed

- **Two-way promises:** The transfer portal uses actual batting and pitching appearances. Missing records are not treated as proof of a broken promise. Genuinely unfulfilled promises still affect transfer risk and have a clear departure reason.
- **Consistent season judgment:** Morale and promises are judged once per season, including after a portal recovery on reload. Completed promises expire before the next season. The keep-position promise still lasts two seasons.
- **Promise cards:** Recruiting buttons explain the requirement and duration before a promise is made. Player profiles show participation and review progress. Redshirt and position-change actions identify a conflicting promise before the player acts.
- **Postseason:** Regional champions, protected bids, and at-large bids have distinct explanations. Tournament elimination and season elimination have separate messages. Qualification and exit information remain readable after dismissing the announcement.
- **Bracket navigation:** The heading matches the stage being viewed. Players can return to the current stage or use Find my team. Following reacts to a new matchup, centers both scroll directions, and pauses during manual browsing. Reduced-motion settings are respected. Keyboard activation no longer scrolls the page when opening a game with Space.
- **Recruiting forecasts:** Preview and week-end settlement share the same pitch and interest calculations, including facilities, staff, coordinator focus, and zero-effort plans. The card shows total RP, current and projected interest, and time remaining. It explains that interest is not a guaranteed commitment.
- **Staff projects:** Players can inspect the training group, expected gain, focus bonus, and duration before starting. The group is chosen when the project starts. Completing a project records actual before-and-after results in Staff and the inbox.
- **Sustained focus:** A project earns its focus bonus only when the directive matched for at least 60% of its weeks. Switching on the final week no longer grants the whole bonus. Existing saves without weekly history use their saved focus for elapsed weeks.
- **Pipeline choices:** Maintenance takes fewer weeks than building or deepening, with a smaller strength gain. Project activity is recorded separately from player signings.
- **Project calendar and staffing:** New work must fit the remaining recruiting weeks. Existing work pauses when its facility or coach is unavailable. Arm-care protection requires an employed coach, a working facility, and an active recruiting calendar. Projects do not transfer to a replacement assistant or to a different school's roster and network.
- **Network:** Coordinator contacts are included. All known markets can be searched or expanded beyond the first eight. Cards distinguish familiarity from an active pipeline and identify home, coordinator, and earned relationships. Assignments respect the same staff-control setting in both screens and store actions.
- **Inbox:** Opening a message marks only that message read. Mark all as read is an explicit action.
- **Other writing:** Corrected scholarship-full recovery instructions, the empty portal message, staff focus descriptions, facility project timing, budget labels, and absolute claims in positioning choices.

The existing tournament format, simulation shortcuts, Pascagoula Tech setup, package versions, and dependency lockfile are retained. This ZIP contains source files, not a compiled store release.

## Verification

- 319 distinct tests passed across the available focused suites, including postseason simulation, portal behavior, recruiting, economy, architecture, tutorial progression, and save/rollover regressions.
- New regressions cover fulfilled and broken two-way promises, portal reconstruction on reload, once-per-season morale judgment, promise expiry, exact recruiting forecasts with staff and facilities, fixed project recipients, sustained focus, shorter maintenance, missing-staff/facility behavior, delegation, and saved project results.
- TypeScript reports no diagnostics beyond those already present in this workspace's dependency setup.
- Full typecheck/build remains blocked here by unavailable `@radix-ui/react-icons` and `@capacitor/core`, plus the resulting existing inferred-type diagnostic in App.tsx. Two additional suites (recruiting.test.ts and saves.test.ts) could not collect because they import the missing icon package.
- Browser preview was blocked, so mobile layout, dark/light themes, touch scrolling, and transitions have not been visually verified in this environment.
- Save schema is now 6. Existing saves migrate on read; project fields are optional and backfilled. A schema-5 cached portal is recognized as having already settled morale.

## Files

All source and existing project assets are included. Dependencies, temporary test output, and local preview files are excluded. `TUTORIAL_UPDATE.md` describes the earlier tutorial-only stage; this file describes the subsequent gameplay and interface changes.
