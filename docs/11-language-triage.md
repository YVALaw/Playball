# 11 · The language audit, triaged

**September 3 2026.** The reporter ran an independent language audit (vendored
whole at `docs/artifacts/language-audit-2026-09-03/` — four documents, ten
screenshots, a full string inventory) and handed it over with "I still want to
work more in the writing." This file is the triage: what was adopted, what was
adapted, what was declined and why, and the worklist that remains. The audit
ran against a slightly older tree — it cites the deleted press room and depth
chart, and several lines the September 2 batches had already fixed — so
**every claim was re-verified against current source before anything moved.**

The audit's own rollout advice is right and matches how this project already
works: *fix the factual conflicts first; cut repeated instructions second;
apply the terminology map third; make dialogue more specific and funny last.*

## Tier 1 — adopted whole: copy that contradicted the engine

All shipped September 3. Each fix now agrees with the rule it cites.

- **The field is eight.** `tutorials.ts` season entry said top six
  (`CONF_FIELD` is 8); the Standings header comment too. Fixed.
- **Recruiting points.** The tutorial's "Fifty points a week ... points carry
  over" was wrong twice: the budget is prestige-based (`boardBudget`) and
  unspent weekly points do NOT carry (interest does). Rewritten truthfully.
- **A mound visit substitutes nobody**, and it is one per PITCHER, not per
  game (`liveGame` resets `visitUsed` on a change). The manage tutorial and
  the visit button's spent-state both fixed.
- **Coach points DO carry over** (`rollYear` adds to the standing balance).
  `CoachPoints` claimed the opposite. Fixed.
- **The portal's budget is its own window** — `boardBudget` reads draft
  spending only, never portal spending. The "pool is shared" note claimed a
  link that does not exist. Rewritten: window money, separate pocket.
- **The title-game stake claimed a lead at 0-0 and while trailing.** Now
  state-aware: lead / trail / level / silent at 0-0.
- **"Two losses and it is winter"** on conference entry contradicted the very
  next sentence (top four travel). Fixed.
- **"Sixteen reach the showdown"** — the field is twenty; now derived from
  `NATIONAL_BIDS` so it cannot drift again.
- **The review's Omaha copy** said four teams; 'omaha' is the whole
  twenty-team field. And a runner-up can lose the final 0-2, so "one game
  short" is gone too.
- **The redshirt gate's reason** ("one appearance already burned") was
  invented — the rule is preseason-only. Now says so.
- **"You are 31th."** Fixed.
- **The preseason poll note** undersold itself — the projection is
  three-quarters roster, one-quarter prestige. Now says so.
- **"Twice the steals"** promised outcomes for a 2.2× attempt rate. Now
  attempts.
- **"Playing the best baseball of his life"** was the 'buzzing' mood, not a
  career fact. Now a mood.
- **The captain note promised a mechanical consequence** for overriding the
  room's pick that no code implements. Trimmed to the recommendation.
- **"Every recruit"** labels a top-sixty list. Now "Top signings."
- **Walk-ons "thirteen points below"** promised an exactness generation does
  not have. Softened.
- **"A new deal on the table"** described an extension already applied. Now
  "Extended — N years on the new deal."
- **"The national twenty is set"** on a regional title can be premature. Now
  the ticket, not the field.
- **Draft words**: LIKELY started at 35% and POSSIBLE at 12%. Now AT RISK /
  OUTSIDE SHOT; GONE and SAFE stay. The LIKELY GONE metric is AT RISK.
- **NEEDS YOU's footer** said "a week goes past either way" — false since the
  holds landed. Now: "The day holds until they are dealt with."

## Tier 2 — adopted: mechanics and accessibility

- QUESTION 1 OF 5 (was "5 QUESTIONS · 1").
- HAIR COLOR (US spelling on the visible label).
- Swatches speak ("Skin tone 3 of 6") instead of reading hex to a screen
  reader.
- UNDERSTOOD → GOT IT (one acknowledgment word everywhere).
- The fired job-market state stops insulting the coach it just fired.

## Tier 3 — adapted: where the audit wanted plain and the voice stays

The audit's tone chapter pushes many surfaces toward neutral product copy.
The reporter chose the opposite register at 15.5's door — a friendly, joking
assistant who teaches the game and signs the mail — and the audit itself
concedes the synthesis: *"put personality into occasional reactions."* So:

- **Tutorials keep their jokes; their facts got fixed.** "You get very good
  at golf" stays; "top six" did not.
- **The assistant's mail keeps "Coach —"** and the warmth. Facts first,
  personality riding along.
- **The Wire keeps the newspaper** — the audit agrees this is where "desk"
  belongs.
- **Errors and destructive states go plain** — adopted in principle, built in
  the worklist below. No jokes in a delete dialog. This was already house
  policy; the audit found real violations worth the sweep.

## Tier 4 — declined, with reasons

- **Flattening the settings voice** ("The crack, the glove, and a crowd that
  knows the score" → "Game sounds and crowd noise"): declined. The line says
  what the switch does and sounds like the game. Register was decided at the
  door; the audit's plainer draft is the fallback if the reporter's testing
  read disagrees.
- **"SHAKE HIS HAND AND LET HIM GO"** → "LET HIM GO PRO": declined. The long
  button is the moment. The audit's own best-examples list (DON'T SAY IT)
  argues for keeping it.
- **Renaming The Book / the annals vocabulary wholesale**: declined for now —
  the September 2 legend work already carries the decoding, and the
  vocabulary is load-bearing across headings, tutorials and the hall.
- **"All quiet. Team news will land here"** for the inbox empty state:
  superseded — the empty state was rewritten September 2 in the assistant's
  voice, which is the chosen direction.
- Anything citing the press room or the depth chart screen: moot — both are
  gone.

## The worklist — adopted, not yet built

Ordered; each is a bounded pass.

1. **Split the failure channels — DONE September 3.** `simError` is its
   own store channel; the banner reads THE SIM STOPPED · TAP TO RUN IT
   AGAIN and its tap re-runs the sim, which is safe because a failed run
   never replaced the season (the generation guard). The save banner is a
   save banner again.
2. **Classify load errors.** Every failed load reads as a version mismatch
   (`App.tsx:267` region); route unknown causes to "Couldn't open this
   dynasty" with a real recovery path, and keep the version story for
   confirmed schema gaps (`persistence.ts` already knows).
3. **The plain-error sweep.** `App.tsx` boot/storage states, `Saves.tsx`
   failure strings, worker messages surfacing raw. Short fact, real next
   step, diagnostics behind a fold.
4. **The terminology map** (audit's cross-screen rules): points vs dollars
   named consistently; program vs school; US spellings in visible copy;
   contractions in prose; one label per destination (Board goals, Watchlist,
   Hall of Fame, Record book, Transfer portal). Apply screen by screen with
   the same restraint as tier 3.
5. **Board/Portal/Draft label batch** — the audit's per-screen tables hold
   many good small renames (UNCONTESTED, SIGNED ELSEWHERE, POINTS AFTER,
   FIND {POS}, RETURN TARGET: {n}) that fit the voice; adopt the ones that
   name facts, skip the ones that flatten character.
6. **Empty-state subtraction batch** — one state, one sentence, one next
   step; several screens still stack two near-identical explanations
   (SigningDay's double lecture, Program's watchlist pair).
7. **Placeholder fallback** — "Not built" can label reachable fallbacks;
   route unknown screens to a return action instead.

The audit's `generated.md` (wire families, all 53 report lines, interview
scenarios, cultures) largely postdates its own capture — the report pools
were rewritten September 2 — but its repetition rules feed worklist item 4.
