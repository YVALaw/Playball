# Program and staff clarity update

Based on the supplied `Playball-main (8).zip`.

## Program

- Direct entry cards for Staff, Facilities, Budget, and Network.
- Compact prestige, season record, and job security summary.
- Board, Watchlist, and Hall of Fame grouped under Your career.
- Budget details stay on Budget; other management screens have a small available-funds strip.
- Direct destinations participate in the existing navigation and scroll-restoration system.

## Staff

- Each role shows coach name, overall rating, two skill meters, ongoing focus, and project status.
- Filled roles open on Work. Profile & contract holds skills, actual contributions, annual wage, renewal/replacement/release, and recent role results.
- Focus buttons show their purpose and mark the selected choice with both a check and the school accent.
- Project setup: choose a skill, explicitly select a player, then review gain, success chance, and weeks before starting. Searchable player choices show success chances for the selected skill.
- Recruiting projects use a state dropdown and the same work panel. Network carries its chosen state into that panel instead of duplicating start controls.
- Active projects show progress, weeks left, target, success chance, and earned focus weeks. Facility and calendar pauses have explicit labels.
- Facility unlock links close the coach profile before opening the correct building.
- Project cancellation requires a second confirming tap. Replacement and release keep confirmation.
- Candidate details use contribution tiles and expandable fit details; hiring still shows annual wage and remaining budget.
- Corrected the obsolete group-training/+1-to-+2 explanation to match this build's single-player +2/+3 projects. Existing group projects retain their saved behavior and are identified as group projects.
- Shortened staff onboarding and updated tour routing for direct Program destinations.

## Presentation

Uses existing paper surfaces, square borders, condensed headings, mono labels, school accent, and light/dark theme tokens. Controls and status blocks use fewer sentences and larger key values. No new Screen help buttons.

## Verification

190 distinct tests passed across Program, staff projects, staff contracts, store, guided tour, economy, and theme contrast suites. Includes a new regression for the direct Program routes in the guided tour.

The source-only bundle compiled 173 modules, treating the missing Radix icons/Capacitor packages and Vite public-asset paths as external. This is not a production build.

Full build/typecheck and visual verification remain incomplete: this environment lacks `@radix-ui/react-icons` and `@capacitor/core`; the existing Capacitor callback consequently also lacks its inferred type. The final typecheck found no additional errors beyond that dependency baseline. The cloud browser blocked the local preview with `ERR_BLOCKED_BY_CLIENT`. Android device layout and touch behavior have not been visually verified here.

The complete source project is included. Dependencies, build products, temporary validation files, and the local dependency symlink are excluded. Existing gameplay, saves, test shortcuts, assets, and unrelated screens were preserved.
