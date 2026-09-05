# Playball interaction design

This is the UI rulebook for management surfaces. It exists to stop every new mechanic from becoming another stacked list.

## 1. Three kinds of screen

### Data surfaces
Use tables, compact rows, filters, and scanning patterns when the player is **reading a set**.

Examples: roster, standings, schedule, rankings, results, award lists.

A list is correct here. Do not turn every row into a large card.

### Decision surfaces
Use a command-center composition when the player is **choosing something with consequences**.

Examples: budget, staff hiring, facilities, coach development, portal decisions, draft retention, program actions, player management, strategy, job offers.

Every important decision should expose, in this order:

1. **State** — what is true now.
2. **Context** — why this decision exists.
3. **Tradeoff** — what improves and what is given up.
4. **Consequence** — what remains after the action.
5. **Action** — a specific verb, not a generic “Continue” or icon-only control.

If the screen only shows a title and a stack of buttons, it is not finished.

### Narrative surfaces
Use a focused event card, inbox letter, modal, or review when the player is **being told what happened**.

Examples: board reviews, job calls, draft outcomes, major alumni events, postseason transitions.

Lead with the result. Supporting detail comes second. Do not make a narrative modal explain navigation.

## 2. Money decisions

Never show only a price.

Show:
- cost,
- current available amount,
- amount remaining after purchase,
- the mechanical effect,
- what the player may no longer be able to afford when that is meaningful.

Budget is a planning workspace, not a ledger dump.

## 3. Profile actions

Profile actions use an explicit **Manage / Decisions** launcher and a bottom decision sheet.

The sheet begins with the person/program's current state before actions appear. Actions are grouped by purpose rather than dumped into one list.

Do not use a sliders/settings icon to mean “actions.” Icon-only launchers are shortcuts, not primary affordances.

## 4. Scouting and opponent playbooks

Scouting is a four-step loop:

**Public snapshot → report value → purchase → counterplan**

Before spending, show public information and what the report unlocks. After spending, show the actual reads before asking the player to configure tactics. An opponent playbook should always retain the opponent context on the Strategy screen.

## 5. Copy hierarchy

- **Kicker:** context.
- **Title:** what this is.
- **Body:** why it matters or information the player cannot infer.
- **Meta:** cost, duration, remaining amount, status, or consequence.

Delete a subtitle if removing it loses no information.

Do not write UI manuals into persistent copy (“tap X,” “go to Settings,” “use the action button”) when the interface can expose the destination itself.

## 6. Action labels

Prefer **verb + object**:

- Scout program
- Build playbook
- Invest +1
- Hire coach
- Upgrade facility
- Open dossier
- Take the job

Avoid generic labels when the consequence matters:

- Actions
- Go
- Do it
- View
- Continue

“Continue” is acceptable only when the destination is obvious and no decision is being made.

## 7. Delegated careers

Delegation changes **who makes the decision**, not whether the system exists.

A staff-managed feature should still expose the result and allow the player to understand what the staff did. Never route a player to a control whose underlying state was never created because the staff handled it.

## 8. Visual hierarchy

One screen gets one dominant decision area. Secondary information supports it.

Use:
- large command-center blocks for the primary resource/state,
- 2-up cards for meaningful alternatives,
- compact rows for inventories and histories,
- bottom sheets for contextual profile decisions,
- explicit selected states for strategy/options.

Do not stack five unrelated full-width panels simply because they share a parent screen.

## 9. Irreversible decisions

A confirmation must repeat the **consequence**, not merely ask “Are you sure?”

Examples:
- accepting a job says what comes with you and what stays behind,
- deleting a save says what is lost,
- spending a shared offseason pool shows what remains,
- changing captaincy names who loses the role.

## 10. Final review question

For every screen ask:

> What decision is this helping the coach make?

If it is not a decision screen, ask:

> What information or story is this helping the coach understand quickly?

If neither answer is clear, merge, remove, or redesign the surface.

## 11. Contextual shortcuts

Shortcuts should remove navigation, not add another hidden route to memorize.

- Long-press may be used as a fast secondary gesture when a normal visible route still exists.
- A contextual shortcut should land on the information needed for the current decision. In Lineup, holding a player opens **Stats**, not the generic profile landing page.
- Never make long-press the only way to reach important information.
- A tap gesture and a hold gesture must not both fire for the same press.

## 12. Stable geometry

A state change inside a decision surface should not make the rest of the phone jump.

Reserve space for:
- selection guidance,
- success confirmations,
- validation feedback,
- temporary status changes.

Prefer replacing content inside a fixed region over inserting a new block above the thing the player is manipulating. Lineup selection is the canonical example: choosing a player changes the message, not the vertical position of the batting order.

## 13. Dynamic collections are libraries, not permanent tabs

Do not turn user-created or world-created entities into an ever-growing tab bar.

Good permanent tabs represent a small, fixed information architecture. Dynamic sets such as opponent playbooks should use:
- a current-selection control,
- a library/picker sheet,
- search/filter later if the collection becomes large.

The top of Strategy therefore remains stable even if the coach scouts twenty schools.

## 14. Team color discipline

School colors express identity; they do not own structural readability.

Use school color for:
- accent borders,
- small markers,
- crest context,
- selected identity details.

Use semantic app surfaces (`--panel`, `--paper`, `--field`) behind body copy and decision text. Never assume a dynamic team color is dark enough to carry white text. This rule applies to profiles, scouting dialogs, postseason cards, and every modal that may inherit a school's accent.

## 15. Decision decks

When several peer alternatives compete for one slot or one pool of money, prefer a horizontal snap deck over a long vertical wall.

Examples:
- assistant candidates for one coaching seat,
- facility specialties.

The current choice stays anchored; alternatives move. This preserves hierarchy and makes comparison feel intentional rather than like scrolling through settings.

Do not use a horizontal deck for data that is primarily scanned across many rows (rosters, rankings, schedules).

## 16. Motion and navigation

The app chrome should feel anchored while content changes beneath it.

- Keep the header, context navigation, and bottom navigation visually stationary.
- Animate only the incoming content surface.
- Reset the destination scroll position before paint, not after the new screen appears.
- Keep transitions short and directional-neutral unless navigation semantics genuinely require direction.
- Respect reduced-motion settings and avoid stacking CSS entry animation on top of the View Transition API.

A transition is successful when the player notices continuity, not animation.

## 17. Delegation states

Do not use persistent copy that tells the player to go find a setting elsewhere.

When a feature is delegated, show:
- who currently owns the decision,
- what the player can still inspect,
- disabled or read-only actions where appropriate.

Delegation should look like a state of the current system, not documentation for another screen.
