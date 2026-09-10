# Playball — streamlined tutorial and staff update

Updated from the attached `Playball-tutorial-and-gameplay-fixes(1).zip`.
This ZIP contains the full project and preserves the fixes in that build.

## What changed

- **Tutorial:** One short explanation and one action per card. Related tips were combined where possible. Card headings, explanations, and actions fell from about 2,283 words to 1,010 (56% fewer). First-visit tips account for 1,421 → 616 words; guided tour cards account for 862 → 394. Progress, Skip step, End tour, replay, reduced motion, and the dark spotlight remain.
- **Screen help:** Removed the button globally, its styling, and references to reopening it. Automatic first-visit tips remain. Tutorials can be replayed from Settings → Display.
- **Recruiting promises:** Two-way opportunity appears only for actual two-way players. The screen, action validation, and rival recruiting now share the same eligibility list.
- **Settings:** Removed the two bottom Device/Career summary blocks and simplified the introductory line. Actual settings remain accessible in their existing categories.
- **Home:** Removed the large status headline, including “First pitch is next,” and its streak subtitle. Kept the small date and a compact ranking/conference line. Reduced the gap before Tonight, bringing Needs your eye higher on the page. Removed the Home board strip. Visibility still depends on screen height, text size, and any game warnings.
- **Staff hiring:** Replaced the horizontal candidate deck with a two-column grid. Tap a coach to see their skills, practical effects, annual wage, and budget after hiring. Over-budget candidates can still be inspected. Replacements name the outgoing coach and warn if their project will end; replacing requires confirmation. The current coach is excluded from their own replacement market.
- **Staff variety:** Every new market offers a developer, a game specialist, and an all-rounder, with specialties rotating across price bands. Recruiting coordinators offer network, recruiting, and balanced specialties. Hitting and pitching coaches show skills relevant to their roles. Saved hired coaches retain their attributes; candidate names, rating-based wages, and IDs remain deterministic.
- **Coordinator depth:** Relationship skill now determines the familiarity a coordinator brings to their state; recruiting skill determines their recruiting contribution. Familiarity stays below the threshold for an established pipeline. Earned pipelines and the home-state minimum still take priority. This changes the computed familiarity of existing coordinators too, without rewriting their saved attributes.
- **Recruiting network:** Replaced free-text filtering with a dropdown of known states, including an All known states option. Coordinator assignment continues to offer the full state dropdown.
- **Tour integration:** The hiring spotlight follows the grid into the candidate modal. Keyboard navigation avoids competing focus traps.

## Verification

100 tests passed across:

- Guided tour: 18
- Economy: 19
- Staff projects: 21
- Prior follow-up regressions: 8
- Recruiting priorities: 8
- Recruiting expansion: 11
- New staff variety and promise eligibility regressions: 5
- Season, save, and tutorial integration: 10

Typechecking the updated project and the attached baseline produced the same
36 diagnostics, with no new diagnostics. The environment lacks the declared
`@radix-ui/react-icons` and `@capacitor/core` packages, so a full build and visual
verification could not be completed. Dependencies and their lockfile were not
changed or substituted.

The archive preserves all original files, includes the new dialog and regression
tests, and excludes local dependencies and temporary verification files.
