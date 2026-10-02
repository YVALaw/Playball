# Playball UI handoff

Open any `.dc.html` in a browser (keep `support.js`, `pb-icons.js` and `assets/` next to them). Colours, type and spacing come from `src/ui/design/tokens.css` and `components.css`. Only the Light/Dark switch remains as a tweak.

## Recruiting.dc.html
- **Filter (visual rework, same filters as Board.tsx `Filters`).** Under the view chips: a "Filter" / "Filters on" pill with a count, followed by removable pills for each active filter and "Clear all".
- **Filter sheet:** eyebrow "N filters on" and title "Filter prospects".
  - Position: a 5×2 button grid, one pick.
  - Stars: five tiles (5 to 1), pick any.
  - Home state: a styled select, "Anywhere" plus every state, yours marked.
  - More filters: three switch rows with one-line explanations (Pipeline states only, Nobody recruiting him yet, In reach only).
  - Footer: "Clear all" and "Show N prospects".
- Empty state with "Clear filters". The list header shows "Best fit first".
- The sheet and board variants are still in Tweaks (defaults: A · One-page plan, Race rows).

## Roster and Player.dc.html (variant A)
- **Roster:** three counters on top (injured, draft risk, unhappy) that also filter the list. Players are grouped by position group, with potential beside the rating, status chips on the row, and a coloured left edge on anyone flagged.
- **Player card:** a header with rating and potential; four colour-coded "At a glance" tiles (availability, mood, draft, transfer risk); a promise tracker bar with the target marked; then drill-in rows (Ratings, This season, Badges, Positions, Career). Ratings shows the room to his potential as a striped extension and the league average as a tick.


## Staff and Facilities.dc.html (variant A)
- **Staff:** a "How a coach helps" diagram (focus + project → match them); a "Needs you" list (idle coach, expiring contract, open seat); a card for every seat showing focus, project and week progress, wage and contract. A vacant seat is a dashed card with "See candidates".
- **Coach sheet:** rating, wage and contract strip; Work / Skills and contract tabs; focus chips with an explanation; the project builder (what, then who, ranked by chance it works) and a footer that says whether the project matches the focus.
- **Facilities:** a stacked budget bar; each building is a row with an L0–L3 ladder, the next cost and whether you can afford it. Tapping a row expands a now-vs-next table and a build button that needs two taps.
- **Budget tab:** left this season, wages/buildings/left breakdown, and "What the rest can buy", cheapest first, each marked within budget or how far short.

All numbers are placeholder data.

## Season Start.dc.html (A · Terms step; B · Contract in Tweaks)
- A full-screen step: How the winter went → What they expect → What is at stake. Sign is pinned at the bottom and stays locked until all three parts are read. "Push back" has one chance.
- Copy rewritten throughout. Targets are labelled Must hit (judged at your review) and Extra credit (each one builds trust).

## Draft.dc.html (A · Decision cards + sheet; Before/After phase in Tweaks)
- Three tabs, as in Draft.tsx:
  - **Waiting on you:** decision cards (drafted in, usual price, if he signs).
  - **Leaving:** the positions you are now short at, then everyone who left, with badges.
  - **Draft board:** by round with yours marked, plus Not drafted.
- The "Before the draft" phase is the DraftOdds screen: Seniors / Eligible / At risk, then Eligible for the draft (likely / could / outside chance / should stay) and Leaving anyway.
- The pitch sheet no longer shows Strong / Fair / Weak. Each pitch shows its line and "Works when" instead.
- Copy rewritten: Make your pitch, Back it with points, Make the offer, Let him sign, plus the result lines.
