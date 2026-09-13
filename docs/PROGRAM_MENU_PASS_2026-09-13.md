# The program menu, reorganised — 2026-09-13

An outside pass (`Playball-program-visual-rework.zip`) reworked the program
menu and its rooms. The instruction on receiving it was specific: take the
organisation and how it is presented, refuse the rounded boxes, keep our style.

So this took the information architecture and left the skin. Every new surface
is written into `src/ui/program.css` under our own class names; the incoming
`program-redesign.css` and its `.program-redesign` wrapper are not in the tree.
That file was 347 lines, of which roughly 195 were a second declaration of a
rule `program.css` already had — 41 `border-radius` values off a
`--program-radius: 10px`, a `--legacy-gold` literal duplicating the `--gold`
token we already ship, a drop shadow, and about sixty lines whose only job was
to outrank our own type scale by one class of specificity.

## What moved

| Room | What changed |
| --- | --- |
| Hub | Opens on the school: the same crest hero every college profile already wears, with `regularRecord` (the number the Board reads), the live conference position and job security beneath it. One attention card replaces three scattered signals, ranked so at most one thing is red. A legacy group puts History and Alumni on the hub. The four management tiles keep their identity and gain live subtitles and three facility level meters. The head coach gets a row with his face. |
| History | A shelf: the all-time regular-season record, labelled; the winningest season; six seasons of win percentage as bars. Coaching eras become one divider per run. The conference record — never shown before — the coach and the honors fold behind a summary that still counts them. Chips instead of a kicker that had to choose between saying SEASON and saying CHAMPION. |
| Alumni | A name search, an Everyone / Drafted / Honored filter, Hall of Fame and national-record chips, and the college career each man had *here* — read from `season.careers`, which the archive has been keeping and the card never printed. |
| Alumnus card | Identity header with status chips, the career totals he never had, the Hall of Fame plaque and the records he still holds, a next-chapter headline with the year-by-year timeline folded under it, and both halves of a two-way career instead of one. |
| Facilities | The upgrade is a two-press `Confirmable` naming the cost and what is left after it. A now-versus-next benefit table answers the panel's actual question. The level timeline and the blurb move below the decision and open on demand. |
| Network | The state list becomes a map of the game's own eight recruiting regions; clicking a state selects it *and* arms the coordinator's next assignment. A detail card carries the strength meter with both gates marked. The coordinator gets a strip with his project's progress on it. |
| Staff | The roster card names the man the project is about and its coach's specialty, and colours an ending contract. The active project leads with its subject; a POTENTIAL GAIN tile says what the work is worth. Recent results move beside the panel that starts the next one. |

## What was refused, and why

- **The rounded boxes.** Asked for by name. Everything new is square: `1px solid
  var(--line)` on `var(--paper)`, with a 3px left rule for emphasis. Four
  surfaces this pass reworked and that were still on the old rounded layer —
  the season card, the alumni card, the facility tiles and the blueprint — were
  squared to match, with their drop shadows, since a square edge does not carry
  elevation.
- **`--legacy-gold`.** An invented colour with a hand-rolled dark-mode pair.
  `--clay` is the accent, and it follows the school.
- **Coach portraits.** `StaffFace` hashes a face the engine never assigned an
  assistant — `Assistant` has no `look` field — and it displaced the GlobeIcon
  that is how the recruiting seat reads at a glance. The head coach, who does
  store a look, keeps his portrait.
- **A third profile tab.** Splitting Abilities from Contract puts a tap between
  the two halves of the renew-or-replace decision.
- **One "strongest skill" number** in place of two rating bars. A 70/30 coach
  and a 30/70 coach both read 70, and that difference is the whole hire.
- **Embedding History inside a program sheet.** HISTORY is already a screen
  beside OVERVIEW in the strip. The hub's doors aim it (`historySheet`) and hand
  it over, so there is one record book, one back gesture, and a strip that still
  says where you are.

## Three defects the pass found

- **A live crash.** `Alumni` declared a `useMemo` and a `useState` below its
  empty-state early return, so the first June a player left campus while the
  sheet was open, the hook count went 3 → 5 and React threw the screen away.
- **An unactionable red card.** Their expiring-contract signal reads
  `until <= year`, which is true for the whole of a contract's final season,
  while Renew is gated on the offseason. Taken as written the hub would have
  burned red for a season pointing at a room where nothing could be done. Gated
  on `phase !== null`.
- **A promise the card could not keep.** Their POTENTIAL GAIN range advertised
  the focus bonus after it had become arithmetically unreachable — the engine
  needs `alignedWeeks >= ceil(weeksTotal * 0.6)` — so the card contradicted the
  FOCUS WEEKS tile beside it. The high end is now gated on reachability, and the
  fold says why when it drops.

## Engine

Untouched. `src/engine` is byte-identical to what it was; the only state change
is a new `historySheet` field in the store, which is UI navigation. Two display
helpers moved into `src/ui/ProgramBits.tsx` so History, Program and the player
card read one implementation each: `collegeSummary` (a pure fold over archived
`CareerYear` rows, returning an em dash rather than a zero when a rate has no
denominator) and `marksHeldBy` (which now keeps the `feat` group — perfect
games, no-hitters and complete-game shutouts used to fall out of the Hall of
Fame plaque's record list silently).

## Verified

TypeScript clean. 1,524 existing tests pass, plus seven new ones covering the
two helpers. Driven in the running app at 375×812 on a fresh career: the hub,
History, Alumni, an alumnus card, the staff room, a coach profile with a live
project, the facilities panel through a two-press build, and the network map in
both known-states and explore modes.
