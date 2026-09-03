# Language audit: career, recruiting, offseason, program, and news screens

Audit date: 2026-09-03. Source audit only; application source was not changed. All 14 assigned files were read, including conditional states, dialogs, empty states, controls, and accessible labels. Examples below quote rendered source text, with whitespace normalized. Braced values in proposed copy are runtime values, not invented game facts. Imported/generated prose is mapped at the end so the overall audit can cover it separately. Comments, CSS, internal keys, and unused strings are excluded from visible-copy findings.

## Overall assessment

The voice already has a recognizable baseball setting. The problem is that almost every interaction is narrated by the same solemn columnist. Short, good lines routinely acquire a second sentence explaining the first, then a third sentence explaining what the player should feel about it. The result is wordy, repetitive, and oddly judgmental. There is room for dry humor, but the first improvement should be subtraction.

Use a capable, slightly wry assistant coach for interface copy. Use a beat writer for The Wire and a distinct person for each interview/press answer. Controls should say what happens. A consequence should be explicit. An empty state should describe the state and, when useful, give one next step. A joke should be short enough that it does not compete with either.

The app repeatedly uses `chair`, `desk`, `board`, `book`, `man`, and `call` for several different things. That gives the voice atmosphere but blurs actions and destinations. Keep a few established baseball phrases—“In the mix,” “Hot seat,” “Signed and sealed” when something was signed—and name the rest plainly.

## Fix accuracy before polishing the voice

These are source-backed copy/behavior conflicts. They need a decision about the intended rule, not just a nicer sentence.

| Priority | Evidence | Finding and recommendation |
| --- | --- | --- |
| High | `src/ui/screens/CoachPoints.tsx:56`; `src/state/store.ts:2245`, `:2647`, `:2673`, `:2966` | “They do not carry over” conflicts with the state implementation. Advancing clears the refund ledger, while new season awards are added to existing `coach.skillPoints`; the only other mutations spend or refund points. For current behavior: “{n} points available. Unspent points carry over.” Retain the separate rule that allocations become final when this step ends. |
| High | `src/ui/screens/Portal.tsx:95`, `:237`; `src/state/store.ts:156`, `:2343`, `:3468`, `:3503` | Portal copy claims spending reduces the recruiting budget and the remainder carries forward. `boardBudget` reads draft spending only. Portal spending is local and is discarded when leaving the portal. For current behavior: “{n} points for this transfer window.” Remove the shared-budget warning. If a shared pool is intended, implement it before making the claim again. |
| High | `src/ui/screens/Board.tsx:1204`; `src/engine/recruiting.ts:399` | Unreachable-prospect text always says “he is not” from your state. An in-state player can still be unreachable after the one-star pipeline bonus. Render the actual minimum and actual pipeline status instead of a fixed explanation. |
| High | `src/ui/screens/Draft.tsx:646` | “GONE” means a draft chance of at least 70%; “SAFE” means less than 12%; “LIKELY” begins at 35%. These are chances, not outcomes. Use an explicit percentage, or “High chance,” “Moderate chance,” “Low chance,” and “Long shot.” A 35% chance should not be called “Likely.” |
| High | `src/ui/screens/SigningDay.tsx:180`, `:295` | “Every recruit” renders only `signed.slice(0, 60)`. It excludes unsigned players and signed players after the first 60. Rename the tab “Top signings,” show “Top {shown} of {signedCount},” or actually provide every recruit. |
| Medium | `src/ui/screens/NewGame.tsx:182`, `:387` | Offer archetype tags use generated roster strength, but their explanatory paragraphs branch on static school quality. The tag and description can disagree. Both should use the same measured roster gap, with copy chosen from the same archetype value. |
| Medium | `src/ui/screens/Board.tsx:875`; `src/engine/progression.ts:377`, `:387`, `:531` | Walk-ons are described as exactly “thirteen points below” program level. Generation uses quality minus 13 plus randomness, then player-generation logic. Do not promise an exact visible overall. “Walk-ons fill the gaps for one season” is enough in the main flow; any rating explanation should say approximately and name its actual reference. |
| Medium | `src/ui/screens/Board.tsx:1352`; `src/ui/screens/Board.tsx:604`; `src/engine/economy.ts:164` | “Nothing narrows them but the skill itself” overlooks that the skill passed into reports includes staff bonuses. Use “Better recruiting skill—including your staff's bonus—tightens these ranges.” The report bands may also be clipped at rating limits, so avoid implying every displayed band is exactly the nominal width. |
| Medium | `src/ui/screens/Board.tsx:1404` | “The only way to find out is to spend on him” implies recruiting spend uncovers information. Reports are based on recruiting skill, not points spent. Use “No other schools have spent points on him yet.” |
| Medium | `src/ui/screens/Portal.tsx:115`, `:145`; `src/engine/portal.ts:86`, `:101`, `:119` | A departure is not a guaranteed verdict that the player broke a promise; entry includes a probability based on mood and playing-time gaps, and one stated reason is simply a fresh start. Likewise, an empty list does not prove promises were kept. Keep the factual cost rule and the individual reason; remove moral judgments. |
| Medium | `src/ui/screens/Program.tsx:511`; `src/engine/program.ts:1792`; `src/state/store.ts:2958` | “A new deal on the table” suggests an offer waiting for a decision. The extension has already been applied. Use “Contract extended: {n} years remaining.” |
| Medium | `src/ui/screens/SigningDay.tsx:197` | The zero-signings branch reads “Signed and sealed.” Use “No signings this year.” Keep “Signed and sealed” for a real completed class. |
| Medium | `src/ui/screens/SigningDay.tsx:352`, `src/ui/screens/Board.tsx:872` | No projected walk-ons does not establish that the whole roster consists of players the user recruited, especially with an inherited roster or transfers. Use “Every roster spot is covered. No walk-ons needed.” |
| Medium | `src/ui/screens/RecordBook.tsx:45`, `:92` | Copy calls adjusted NCAA baselines “the real ones” and asserts that real career records are four times a season record and “would never be beaten.” Separate an authentic source record from the game's adjusted target; remove the unqualified historical/general claims. The screen itself says targets are adjusted. |
| Medium | `src/ui/screens/Program.tsx:971`, `:990` | Career results fall back to raw `r.finish`, while this local map omits `national`, which exists in the postseason model. Use the shared display-label map so an internal value cannot become player-facing copy. |

## NewGame.tsx

Coverage: all five steps, the coach summary, appearance and state controls, mode cards and system chips, interview wrapper, philosophy chips, offer list, offer detail, signing gate, and accessible labels. Good foundations: “Meet the coach,” “Somebody else,” “Programs that called,” “Win it all,” “Back,” “Continue,” and the actual coach fields. The mode-card `bullets` at lines 725–736 are never rendered and are not a current UX-copy issue.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/NewGame.tsx:388` — “The name is bigger than the team. Expectations will not wait for the roster to catch up.” | The first sentence works; the second is a generic pronouncement. | “Big name. Rebuild roster. Impatient board.” Use only when supported by the archetype; otherwise “A big name with a roster to rebuild.” |
| `src/ui/screens/NewGame.tsx:390` — “Better than its reputation right now. This roster is a window, and windows close.” | The window slogan is the most AI-like part; it also implies an expiring age window that this branch does not measure. | “The roster's better than the reputation. Make a name for them.” |
| `src/ui/screens/NewGame.tsx:392` — “They have been good for a long time and they intend to stay that way.” | Flat, broad, and unnecessarily formal. | “Winning is expected here.” |
| `src/ui/screens/NewGame.tsx:393` — “Nothing here yet. Whatever gets built, you build it.” | Dismisses the school and repeats the rebuilding concept. | “Room to build. Plenty of it.” |
| `src/ui/screens/NewGame.tsx:419` — “THE MANDATE” | A little bureaucratic, and different from ordinary “goals” language. | “THE JOB” for the pitch; “BOARD GOALS” for the actual objectives. Use the same objective term in Program. |
| `src/ui/screens/NewGame.tsx:421` — “Rivalry: {school}, three times a year.” | Predicts a fixed meeting count, including future seasons. | “Rival: {school}.” If a guaranteed scheduled series is important, show “Three-game rivalry series” only when the schedule confirms it. |
| `src/ui/screens/NewGame.tsx:436` — “THEY WANT {needs} · YOU ARE {prestige}” | Neither number is named. | “COACH PRESTIGE: {prestige} / {needs} REQUIRED.” |
| `src/ui/screens/NewGame.tsx:445` — “Look at other jobs” | More words than the action needs. | “Other offers.” |
| `src/ui/screens/NewGame.tsx:512`, `:751` — “Desk”; “HOW MUCH REACHES YOU”; “Set your desk” | A metaphor stands in for the actual mode decision. | Step “Control”; title “How hands-on?”; remove the redundant kicker. |
| `src/ui/screens/NewGame.tsx:545` — “HOW YOU PLAY” | Destination is the control/delegation step, not playing style; the latter is a separate later step. | “CHOOSE YOUR ROLE” or “CONTINUE.” Prefer a consistent next-step label system. |
| `src/ui/screens/NewGame.tsx:605`, `:658` — “How he shows up”; “WHERE HE IS FROM” | The interface abruptly switches from addressing the player to describing him. | “Your look”; “HOME STATE.” |
| `src/ui/screens/NewGame.tsx:625` — “HAIR COLOUR” | British spelling in a US college-baseball app. | “HAIR COLOR.” Apply one locale consistently. |
| `src/ui/screens/NewGame.tsx:722`, `:723` — “Full career”; “Every decision is yours.” | “Full” makes the other mode sound incomplete; “every” overstates available control. | “Hands-on”; “Run the lineup, bullpen, and offseason.” Let the existing chips supply the full scope. |
| `src/ui/screens/NewGame.tsx:731`, `:732` — “Casual”; “Your staff handles the routine. You handle the season.” | Attractive rhythm but tells the player little about what changes. | “With staff help”; “Your staff runs the lineup and bullpen. You make the big calls.” Keep the dynamic chips directly below. |
| `src/ui/screens/NewGame.tsx:782` — “ON YOUR DESK” | The player is choosing responsibilities. | “YOU HANDLE.” “YOUR STAFF HANDLES” already works. |
| `src/ui/screens/NewGame.tsx:816`, `:821` — “FIND A JOB”; “THE BENCH YOU RUN”; “Set your plan” | The action leads to existing offers; the kicker adds another metaphor. | Button “SEE YOUR OFFERS”; title “Your game plan”; remove kicker. |
| `src/ui/screens/NewGame.tsx:955` — “{total} QUESTIONS · {current}” | The order is unconventional and takes work to decode. | “QUESTION {current} OF {total}.” |
| `src/ui/screens/NewGame.tsx:887` — `aria-label={colour}` | A hex color is not a useful spoken label for appearance choices. | Pass human labels such as “Black hair” or a numbered, descriptively named skin-tone option. Keep selected state programmatic. |

## JobSearch.tsx and JobMarket.tsx

Coverage: fired-career wrapper, career metrics, zero-offer branches, watched jobs, offer list, two-tap acceptance, and departure warning. Keep “Out of a job,” career record/title metrics, “Accept offer,” and a clear warning before taking a job. The fired wrapper itself is concise and does not need a joke added.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/JobSearch.tsx:50`, `:51` — “TITLES / NATIONAL”; “CONFERENCE / RINGS” | The same metric changes grammatical structure between two adjacent tiles. | “NATIONAL TITLES”; “CONFERENCE TITLES.” Remove the duplicate notes if space is tight. |
| `src/ui/screens/JobMarket.tsx:53`, `:54` — “{n} OPEN CHAIRS”; “The market” | Chair metaphor obscures an already clear job screen. | “{n} OFFERS”; “Job offers.” |
| `src/ui/screens/JobMarket.tsx:55` — “Every offer changes prestige, expectations, pipeline, and the shape of your next season.” | Generic inventory of systems; does not help compare a particular offer. | Remove. Put the specific contract and board goal on each offer. |
| `src/ui/screens/JobMarket.tsx:62` — “Nobody is calling” | Good dry voice, slightly stiff without contraction. | “Phone's quiet.” Keep it as the headline only, followed by useful state text. |
| `src/ui/screens/JobMarket.tsx:65` — “No program will have you at {prestige}. Prestige is what opens the board, and yours is too low.” | Insulting and circular. Offers can depend on more than one displayed number. | “No offers at your current prestige ({prestige}).” Only state that as the cause if hiring logic confirms it. The fired state also needs a real available next action; do not invent “win more games” if the player cannot coach. |
| `src/ui/screens/JobMarket.tsx:67` — “Offers arrive at the June board meeting, and they follow your record. Track a chair and your agent flags it the year it can be won.” | Prolonged metaphor and unnatural “won” phrasing. | “New offers arrive in June. Track a job to hear when it opens.” |
| `src/ui/screens/JobMarket.tsx:92` — “Confirm — leave for good” | “For good” implies the school can never be revisited. It is also wrong framing for an already-fired coach. | “SIGN WITH {school}.” If employed, put “This ends your current contract” beside confirmation. If unemployed, omit that consequence. |
| `src/ui/screens/JobMarket.tsx:100` — “YOUR CAREER PATH”; “Chairs you watch” | More metaphors for a saved list. | “WATCHED JOBS.” One heading is enough. |
| `src/ui/screens/JobMarket.tsx:119`, `:120` — “Taking a job is for keeps”; “Your contract here ends the moment you sign there. The roster, the class you signed, and the promises you made all stay behind.” | Necessary consequence buried in dramatic prose, displayed even when fired. | Employed: “Signing ends your current contract. Your roster and recruits stay at {currentSchool}.” Omit for the unemployed state. |

## Board.tsx

Coverage: all five main tabs; filter panel and all switches; every recruiting status; weekly recap branches; capped lists; roster gaps and covered spots; prospect header; Overview, Report, High school, and Schools tabs; reach/full-budget gates; offer buttons; report ranges and stats. Keep “In the mix,” “Leading,” “Way behind,” “Out of reach,” “Needs,” “Targets,” position abbreviations, “What he wants,” and clear point counts. Do not add jokes to repetitive rows or range labels.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/Board.tsx:176` — “NOBODY MATCHES · BACK TO THE BOARD” | Announces an empty result inside a navigation button. | Button “BACK TO RECRUITS”; state above “No matches. Try fewer filters.” |
| `src/ui/screens/Board.tsx:178` — “SHOW THE TOP {shown} OF {matches}” | “Top” can imply national rank although this list is sorted by stars × fit. | “SHOW {shown} MATCHES” with “{matches} total” nearby, or name it “Best fits.” |
| `src/ui/screens/Board.tsx:220`, `:808` — “NOBODY ON HIM”; “NOBODY IS ON HIM” | Understandable coach talk but inconsistent for one status/filter. | One form everywhere: “UNCONTESTED.” Optional note “No recruiting points spent.” |
| `src/ui/screens/Board.tsx:399` — “CLEAR EVERY FILTER” | Emphatic without benefit. | “CLEAR FILTERS.” |
| `src/ui/screens/Board.tsx:439`, `:440` — “SCHOLARSHIPS”; “BUDGET” | Bare budget does not identify points or period. | “SCHOLARSHIPS”; “WEEKLY POINTS.” |
| `src/ui/screens/Board.tsx:443` — “OF 5 · PROGRAM PULL” | Mixed units and metaphor after an already visible star count. | “PROGRAM PRESTIGE,” or remove this note. |
| `src/ui/screens/Board.tsx:495`, `:504` — “WEEK {n} IS OVER”; “Nobody committed to you this week.” | Longer than a repetitive weekly recap needs. | “WEEK {n} RECAP”; “No new commitments.” |
| `src/ui/screens/Board.tsx:509`, `:510` — “Nobody came off the board anywhere. Your budget is back to {weekly}.” / “{n} recruits signed elsewhere and are off the board. Your budget is back to {weekly}.” | Repeats the same outcome; long negative sentence. | “No signings elsewhere. {weekly} points available.” / “{n} signed elsewhere. {weekly} points available.” |
| `src/ui/screens/Board.tsx:529` — “Nobody on your board yet.” | “Board” is also the entire recruiting screen; the player is on Targets. | “No targets yet. Open a recruit and add points to start.” |
| `src/ui/screens/Board.tsx:530`, `:531` — “No commitments yet.” / “Nobody matches those filters.” / “Nobody available.” | First is good; other branches should describe their actual scopes. | Keep first. “No recruits match.” / “No recruits in reach.” Use the latter only for an empty reachable list, since locked recruits may still exist. |
| `src/ui/screens/Board.tsx:564` — “BACK TO THE TOP {ROW_CAP}” | Can sound like scrolling to the top instead of shrinking the list. | “SHOW FEWER.” |
| `src/ui/screens/Board.tsx:588` — “A program of yours can call a recruit one grade above it, and one more than that inside your own state. Build the program up and players like these start listening.” | Awkward wording, “grade” differs from stars, tutorial-length copy every visit. | “You can recruit up to one star above your program, or two stars above in {state}.” Better: show a computed “Your reach: {n}★ / {m}★ in-state.” |
| `src/ui/screens/Board.tsx:661` — “LOST HIM” | Implies competition even when a player merely signed elsewhere. | “SIGNED ELSEWHERE.” |
| `src/ui/screens/Board.tsx:814`, `:815` — “WITHIN MY REACH ONLY”; “Your {stars} program can call” | Redundant label and fragment. | “IN REACH”; optional “Recruits who'll consider {school}.” |
| `src/ui/screens/Board.tsx:872` — “Every spot is covered. Nobody walks on this year. The whole roster is men you went and got.” | Repetition and unsupported claim about who recruited the roster. | “Every spot is covered. No walk-ons needed.” |
| `src/ui/screens/Board.tsx:874` — “{n} walk-ons as it stands. Anything you do not sign gets filled by whoever turns up, thirteen points below your program's own level, and he is gone again the moment the season ends.” | Long, contemptuous, and falsely exact. | “{n} roster spots still open. Walk-ons fill any gaps for one season.” Rating detail belongs in optional help if necessary. |
| `src/ui/screens/Board.tsx:898`, `:902` — “{n} walk-ons unless you sign”; “SHOW ME →” | The sentence dangles; action omits what is shown. | “{n} spots to fill”; “FIND {position}.” |
| `src/ui/screens/Board.tsx:913`, `:929` — “YOUR CLASS COVERED”; “{n} spots the class fills” | Unnatural sentence fragments. | “FILLED BY THIS CLASS”; “{n} spots filled.” |
| `src/ui/screens/Board.tsx:1090`, `:1248` — “{spent} PTS A WEEK”; “YOUR WEEKLY OFFER” | Current allocation is shown like a standing recurring offer. Verify reset behavior; the store resets weekly spend. | “{spent} PTS THIS WEEK”; “THIS WEEK'S POINTS.” Preserve actual weekly-reapplication behavior in first-use help. |
| `src/ui/screens/Board.tsx:1165`, `:1170`, `:1319`, `:1324` — “not a final rating”; “report range” | Both repeat “Estimated” immediately above. | Remove these sublabels. Retain the range and one explanation in the Report tab. |
| `src/ui/screens/Board.tsx:1202` — “He will not take the call. A {stars} recruit hears out a {floor} program and up, one more rung down if he is from your own state, and he is not. Build the program up and players like him start listening.” | Long gate, incorrect in-state branch, mixed grade metaphor. | “Needs {effectiveFloor}★ program prestige. You're at {programStars}★.” If in-state: “Includes your home-state bonus.” |
| `src/ui/screens/Board.tsx:1239`, `:1240` — “Your class is full. Every scholarship is spoken for.” | Says the same thing twice. | “All {limit} scholarships are committed.” |
| `src/ui/screens/Board.tsx:1278` — “{left} left this week · min. prestige {stars} − 1 here” | Mechanical arithmetic is hard to parse while spending points. | “{left} points left this week.” Put the already-computed reach requirement with the reach status. |
| `src/ui/screens/Board.tsx:1303` — “K/9”; “H/9”; “BB/9” | These labels sit over 0–100 skill bands for stuff/movement/control, not actual per-nine statistics. | Use the game's canonical tool labels, e.g. “STUFF,” “MOVEMENT,” “CONTROL,” or explicitly add “RATING.” Coordinate with player-card labels. |
| `src/ui/screens/Board.tsx:1351`, `:1352` — “Estimates, not measurements”; “Your reports run {width} points wide at recruiting {skill}, and he is somewhere inside each band — not in the middle. Nothing narrows them but the skill itself.” | Oppositional title, unnecessary mathematical narration, staff omission. | “SCOUTING RANGE.” Help: “Ratings can fall anywhere in these ranges. Better recruiting skill, including staff bonuses, tightens them.” |
| `src/ui/screens/Board.tsx:1377`, `:1378` — “Read the competition”; “High school numbers, against high school pitching. Everybody's look absurd; what matters is whose look absurd for the right reasons.” | Vague advice, grammatical strain, and pitching-specific wording on pitcher reports too. | “HIGH SCHOOL STATS.” Optional note: “Strong numbers here don't guarantee college success.” Explain a concrete useful comparison if one exists; otherwise remove the note. |
| `src/ui/screens/Board.tsx:1403`, `:1404` — “Nobody has been to see him”; “That is an opportunity or a warning, and the only way to find out is to spend on him.” | Pretends absence of bids reveals scouting uncertainty, then gives an unsupported spend instruction. | “No schools pursuing him yet.” No second sentence. |

## Portal.tsx

Coverage: header, transfer-window budget, both modes, both empty states, player reasons, eligibility, prices, insufficient-budget state, arming/confirmed actions, and leaving-step consequence. Retention and recruiting-budget claims must be resolved first. Keep individual player reasons and “Eligible immediately” once per relevant player.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/Portal.tsx:57`, `:93` — “Both directions”; “Transfer room” | Two titles that avoid the familiar feature name. | One title: “Transfer portal.” |
| `src/ui/screens/Portal.tsx:76` — “{n} men are still in it. Leaving now lets them go.” | Pronouns and “in it” obscure a roster-loss consequence. | “{n} players will leave your roster when you continue.” |
| `src/ui/screens/Portal.tsx:95` — “Keep the promises that matter. The same points sign a class, so whatever is left here goes into recruiting with you.” | Moralizes, implies optional promise-keeping, and makes an unsupported shared-pool claim. | “Keep your players or bring in transfers.” Budget help must match the rule resolved above. |
| `src/ui/screens/Portal.tsx:102`, `:126` — “LEAVING YOU”; “Leaving you {n}” | Personal rejection phrasing; the state is still negotiable. | “WANT OUT”; tab “Your players {n}.” |
| `src/ui/screens/Portal.tsx:115` — “Keeping a man costs half again what taking one does. That is the price of a promise you did not keep.” | “Half again” is needlessly opaque; the second sentence assigns blame. | “Keeping a player costs 50% more than signing a comparable transfer.” Show actual rounded costs on the cards. |
| `src/ui/screens/Portal.tsx:134` — “Men with a foot out”; “Men you could have” | Strained phrasing. | “Players who want out”; “Available transfers.” |
| `src/ui/screens/Portal.tsx:142`, `:145` — “Nobody has put his name in”; “That is what keeping your word looks like.” | A quiet portal becomes a moral judgment. | “Nobody wants out.” Optional dry line: “Enjoy the quiet.” |
| `src/ui/screens/Portal.tsx:142`, `:146` — “Nobody worth having”; “The pool is thin this winter. Your points go to the class instead.” | An empty pool is treated as worthless players; “winter” conflicts with the June offseason framing. Last sentence is unsupported. | “No transfers available.” Remove the rest. |
| `src/ui/screens/Portal.tsx:178` — “WHY HE IS GOING”; “WHY HE IS HERE” | “Going” is premature for someone who can be retained. | “WHY HE WANTS OUT”; “WHY HE'S TRANSFERRING.” |
| `src/ui/screens/Portal.tsx:192` — “LEAVES YOU” | Can mean the player is departing. | “POINTS AFTER.” |
| `src/ui/screens/Portal.tsx:200` — “Card” | Generic destination. | “Player profile.” |
| `src/ui/screens/Portal.tsx:223`, `:225`, `:226` — “Confirm — spend {cost}”; “Talk him round · {cost}”; “Sign him · {cost}”; “Not enough left” | Varying units, British idiom, and vague disabled reason. | “KEEP HIM · {cost} PTS” / “SIGN HIM · {cost} PTS”; armed “CONFIRM · {cost} PTS”; disabled “NEED {shortfall} MORE PTS.” |
| `src/ui/screens/Portal.tsx:236`, `:237` — “The pool is shared”; “Every point spent here is a point the class does not get. Whatever survives the window goes into recruiting with you.” | Repeats the introduction and is unsupported by current spending logic. | Remove. If sharing is implemented, retain one factual note near the budget: “Draft, transfers, and recruiting share this budget.” Only if all three actually do. |

## SigningDay.tsx

Coverage: all three tabs, national/class metrics, no-signings state, rankings cap, national signings cap, true-rating/report comparison, signed prospect modal, walk-on group and modal. Keep “Signing day,” “Your class,” “Rankings,” “Signed with,” and the clear transition “Start next season.”

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/SigningDay.tsx:169`, `:170` — “CLASS POINTS / NATIONAL”; “NATIONALLY / OF 96” | “National” duplicates two tiles without explaining points. | “CLASS SCORE”; “CLASS RANK.” Put the star-squared scoring rule in optional help if needed. |
| `src/ui/screens/SigningDay.tsx:180` — “Every recruit” | Only the top 60 signed prospects are rendered. | “Top signings,” plus “Showing {shown} of {signedCount} signed recruits.” |
| `src/ui/screens/SigningDay.tsx:197` — “Signed and sealed” when `myRank` is zero | A nice line in the wrong state. | “No signings this year.” Use “Signed and sealed” only with a nonempty class. |
| `src/ui/screens/SigningDay.tsx:200`, `:208`, `:210` — “Nobody signed. Every hole gets a walk-on…” followed by “An empty class” and another almost identical explanation | The player gets the same bad-news lecture twice. | One empty state: “No signings. Walk-ons will fill the {n} open spots.” Use actual projected gaps; do not imply walk-ons if there are none. |
| `src/ui/screens/SigningDay.tsx:201` — “{n} of them at four stars or better.” | “Them” depends on nearby layout; wordy compared with the stat. | “{n} four- or five-star recruits.” |
| `src/ui/screens/SigningDay.tsx:351`, `:352` — “Every hole is covered”; “Nobody walks on this year. The whole roster is men you went and got.” | Repeats the gap outcome and takes credit for inherited players. | “Every spot is filled. No walk-ons needed.” |
| `src/ui/screens/SigningDay.tsx:73`, `:76`, `:524` — “HIGH END”; “LOW END”; “YOUR REPORT HAD HIM” | The end-of-range labels do not say they refer to ceiling, rather than overall. | “HIGH-END CEILING” / “LOW-END CEILING”; “SCOUTING ESTIMATE.” Retain the numeric/grade comparison. |
| `src/ui/screens/SigningDay.tsx:648` — “TURNED UP AT” | Adds dismissive attitude to a neutral player fact. | “JOINS.” |
| `src/ui/screens/SigningDay.tsx:655` — “Nobody offered him anything and nobody had to. He fills a spot your class left open, and he is off the roster again next June whatever he does with it.” | Long, mean toward the player, and overexplains the game rule. | “Walk-on. Fills an open spot for one season and leaves next June.” |

## Draft.tsx

Coverage: preseason draft-risk view, all four offseason tabs, roster-hole summary, empty lists, national rounds, departing/graduating/walk-on labels, retention dialog, offer controls, result branches, and continue consequence. Keep “The phone calls,” “Your case,” “Make the case,” “Staying,” and “Back to the list.” This is a good place for character in the player's quotes, not for the interface to lecture the coach.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/Draft.tsx:42`, `:44` — “KEEP”; “BOARD” | Tab meanings are vague. | “Bring back”; “Draft board.” |
| `src/ui/screens/Draft.tsx:113`, `:116` — “YOU LOST”; “TALKED ROUND” | Personal loss framing, awkward British idiom. | “DEPARTURES”; “RETURNING.” |
| `src/ui/screens/Draft.tsx:135` — “{n} men are still waiting on an answer. Leaving now signs them.” | Critical consequence is ambiguous: signed by the player's school or by pro clubs? | “{n} players will sign pro contracts if you continue.” |
| `src/ui/screens/Draft.tsx:160` — “THE HOLES THIS LEAVES” | Needlessly indirect. | “ROSTER NEEDS.” |
| `src/ui/screens/Draft.tsx:185` — “Nobody left. A whole roster returns, which almost never happens.” | Unsupported commentary about rarity and an extra sentence. | “Everyone's back.” |
| `src/ui/screens/Draft.tsx:193`, `:481` — “Nobody here.” beneath “Nobody” | Duplicate, context-free empty state. | For this tab: “No undrafted graduates.” Give `Rows` a contextual headline instead of hardcoding “Nobody.” |
| `src/ui/screens/Draft.tsx:229` — “No club took a man of yours who still has eligibility.” | Overworked phrasing. | “None of your returning players were drafted.” |
| `src/ui/screens/Draft.tsx:237` — “{left} OF {pool} RETENTION LEFT” | Does not identify units. | “{left} / {pool} POINTS LEFT.” |
| `src/ui/screens/Draft.tsx:270` — “SIGNED”; “OPEN CALL” | Signed by whom? “Open call” often means a tryout. | “SIGNED PRO”; “UNDECIDED.” |
| `src/ui/screens/Draft.tsx:346` — “WHAT A ROUND {round} MAN WANTS” | Sounds unlike ordinary speech and fails to name the number. | “RETURN TARGET: {needs}.” Supporting label “Round {round} pick” is already on the card. |
| `src/ui/screens/Draft.tsx:410` — “SHAKE HIS HAND AND LET HIM GO” | A long sentence on a consequential button. | “LET HIM GO PRO.” Put any farewell personality in the resulting message. |
| `src/ui/screens/Draft.tsx:419` — “HE IS COMING BACK”; “HE SIGNED” | Stiff and ambiguous second branch. | “HE'S COMING BACK”; “HE'S GOING PRO.” |
| `src/ui/screens/Draft.tsx:424` — “You did not make a case, and he did not need one to make up his mind.” | Scolds the player for choosing a valid action. | “He's signed his pro contract.” |
| `src/ui/screens/Draft.tsx:427` — “You made the case on {pitch} and put {offered} behind it. It was worth {made} against the {needed} a round {round} man wanted.” | Numeric result hidden in prose; units are unclear. | “{pitch}: {offered} points spent. Your pitch scored {made}; he needed {needed}.” Keep spent points and persuasion score distinct. |
| `src/ui/screens/Draft.tsx:434` — “He comes back a year older, a year better, and with no leverage at all next June. That is the bet you just made on his behalf.” | Narrator moralizes and makes broad claims about future improvement and leverage. | “One more year in your uniform.” If a future eligibility/retention restriction is real, show its exact rule separately. |
| `src/ui/screens/Draft.tsx:435` — “Not enough, and the money is spent.” | The interface spends points, not displayed money. | “He chose the pros. The {offered} points are spent.” |
| `src/ui/screens/Draft.tsx:515` — “No club took anybody. That has never happened.” | An empty-state branch cannot establish a historical first. | “No players drafted.” |
| `src/ui/screens/Draft.tsx:541`, `:543` — “CAREER OVER”; “YEAR UP” | Graduating does not mean a baseball career is necessarily over; both labels are vague. | “GRADUATED”; “WALK-ON TERM ENDED.” |
| `src/ui/screens/Draft.tsx:599` — “TO RECRUITING” | This fallback action invokes `nextPhase('draft')`, whose next phase is Portal. | “TO THE PORTAL,” consistent with the main Draft action, if this fallback can be reached. |
| `src/ui/screens/Draft.tsx:605`, `:606` — “ELIGIBLE / EXPOSED”; “LIKELY GONE / PROJECTED” | Loaded language and labels at odds with probability thresholds. | “DRAFT ELIGIBLE”; “AT RISK.” Show or explain the actual probability. |
| `src/ui/screens/Draft.tsx:646` — “GONE”; “LIKELY”; “POSSIBLE”; “SAFE” | Certain-sounding labels for probabilities; “Likely” starts below 50%. | “{chance}% draft chance” is clearest. If bands are retained, use neutral chance bands. |

## CoachPoints.tsx

Coverage: points remaining, carryover statement, reversible allocation statement, continue action, all skills, maxed and +/- controls, and accessible refund labels. Keep the obvious +1/−1 controls and “Maxed.” Do not turn a simple allocation screen into a motivational speech.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/CoachPoints.tsx:35` — “Coach” | Does not identify the task. | “Improve your coach” or “Coach skills.” |
| `src/ui/screens/CoachPoints.tsx:38` — “CONTINUE · {n} UNSPENT” | Does not say what happens to unspent points; current warning is inaccurate. | “TO THE DRAFT.” Nearby “{n} points saved for later” if current carryover behavior is intended. |
| `src/ui/screens/CoachPoints.tsx:56` — “points to spend. They do not carry over. A coach who never improves gets left behind.” | Wrong carryover claim plus patronizing filler. | For current behavior: “points available. Unspent points carry over.” |
| `src/ui/screens/CoachPoints.tsx:57` — “Nothing left to spend this year.” | Slightly gloomy for a completed task. | “All points spent.” |
| `src/ui/screens/CoachPoints.tsx:69` — “{n} points put on this year can still come off. Once you continue, they are his.” | Unclear physical metaphor and unexplained pronoun switch. | “You can reassign these {n} points until you continue.” |
| `src/ui/screens/CoachPoints.tsx:70` — “Anything you put on can come back off until you leave this step.” | Same rule, unnecessarily colloquial. | “You can undo changes until you continue.” |
| `src/ui/screens/CoachPoints.tsx:116` — “Take a point back off {skill}” | Awkward spoken label. | “Refund one point from {skill}.” |

## Program.tsx

Coverage: main program header, all reachable sheets (Mandate, Budget, Watchlist, Hall, and separate Coach view), staff and facilities automation states, hiring/affordability controls, scouting spending, board review/extension/job offer states, goals/security, coach overview and all subtabs, skills, trophies/achievements, year-by-year empty and populated states, Hall empty and populated states, career tables, accessible labels, and shared result labels. The unused `TabStrip` and other unused helpers are not counted as current visible copy.

Keep short domain labels: “Prestige,” “Budget,” “Vacant,” “Hire,” “Trophy case,” “Achievements,” “Year by year,” “Inducted,” “Still holds,” “Hot seat,” and the actual objective labels. Much of the extra `FieldNote`/`Note` prose can go without losing a single decision.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/Program.tsx:150` — “Prestige, the board's expectation, the people shaping the program, and the names that stayed.” | A poetic table of contents immediately before tabs. | Remove. |
| `src/ui/screens/Program.tsx:161`, `:163`, `:164` — “Mandate”; “Watch”; “Hall” | Truncates destinations into ambiguous nouns. | “Board goals”; “Watchlist”; “Hall of Fame” where width allows. |
| `src/ui/screens/Program.tsx:251` — “THE STAFF”; “Three seats” | The title repeats the number of obvious staff slots. | “Your staff.” |
| `src/ui/screens/Program.tsx:254`, `:255` — “Your athletic director runs the staff”; “Seats are kept filled with the best man the budget carries. Take the job back from settings whenever you like.” | Long passive explanation; says “best” without expressing budget/allocation constraints. | “Your AD handles hiring. Change this in Settings.” Optional actual detail in help. |
| `src/ui/screens/Program.tsx:279` — “LET HIM GO” | An employment action should be distinct from releasing a player. | “FIRE ASSISTANT.” Include actual wage/refund consequence if the UI requires it. |
| `src/ui/screens/Program.tsx:297`, `:334` — “Too dear” | British expression, unclear to some US players. | “NOT ENOUGH BUDGET” or “NEED {amount} MORE.” |
| `src/ui/screens/Program.tsx:309`, `:310` — “Your athletic director spends the budget”; “The next rung is bought when the money is there.” | Broad claim about all spending for a facilities-only setting; ladder metaphor. | “Your AD upgrades facilities when you can afford it.” |
| `src/ui/screens/Program.tsx:318` — “Worth {n} points of training, and a better tour.” | Numeric effect mixed with unexplained atmosphere. | “+{n} training. Improves your recruiting pitch.” |
| `src/ui/screens/Program.tsx:319` — “What the school gave you. The recruits notice.” | Vague implication, offers no decision help. | “Basic facilities.” Or remove if the facility name already says this. |
| `src/ui/screens/Program.tsx:323` — “Next: {level} — {cost}, once. Development and the recruiting pitch both read it.” | “Read it” leaks the implementation model into the world. | “Next: {level} · {cost} once. Better development and recruiting.” |
| `src/ui/screens/Program.tsx:325` — “Nothing left to build. This is the lab everybody tours.” | Stock superlative; “lab” may not fit the actual facility. | “Facilities maxed out.” Optional flavor: “The recruits will notice.” |
| `src/ui/screens/Program.tsx:338` — “THE SCOUTING DESK”; “No books bought”; “{n} books this year” | The product otherwise calls these reports. | “SCOUTING REPORTS”; “{n} bought this year.” |
| `src/ui/screens/Program.tsx:341` — “Bought from PROGRAM ACTIONS on any college page. One report reads the whole roster's tendencies for a stretch of games — a habit no budget survives, which is the decision.” | Too many jobs in one note; “which is the decision” is developer rationale, and duration is imprecise. | “Buy a report from Program actions on a school page. It reveals roster tendencies for {actualDuration} games.” Put the verified duration in the copy, not “a stretch.” Delete the spending lecture. |
| `src/ui/screens/Program.tsx:375`, `:376` — “{n} programs worth tracking” | The interface adds a judgment to a list the user chose. | “{n} programs saved.” |
| `src/ui/screens/Program.tsx:380` — “Open a program to compare it, read its roster, or follow a possible career path.” | Explains basic clicking every visit. | Remove; rows already open profiles. |
| `src/ui/screens/Program.tsx:381`, `:387`, `:388` — “Use PROGRAM ACTIONS on any college profile to save it here”; “The board is clean”; “Watched colleges live here instead of disappearing when a profile closes.” | Two empty-state blocks plus implementation-flavored explanation. | One state: “No programs saved. Add one from Program actions on its profile.” |
| `src/ui/screens/Program.tsx:511` — “A new deal on the table.” | Extension already applied. | “Contract extended: {n} years left.” |
| `src/ui/screens/Program.tsx:523` — “UNDERSTOOD” | Stiff acknowledgment button. | “GOT IT.” |
| `src/ui/screens/Program.tsx:539`, `:542` — “A program wants to talk”; “Open the job market to read the offers before anything is signed.” | Good headline, overly defensive instruction. | Headline “{n} job offer(s).” Button/row hint “View offers.” |
| `src/ui/screens/Program.tsx:557` — “THE MANDATE · {enum}” | Raw enum display gives `BUILD` here versus `REBUILD` in setup; `CHAMPIONSHIP` versus `WIN IT ALL`. | Reuse one label map across setup, board review, and program objectives. |
| `src/ui/screens/Program.tsx:581` — “Year {n} at the job.” | Awkward phrasing. | “Year {n} at {school}.” |
| `src/ui/screens/Program.tsx:611`–`:614` — “Your hitters take slightly better at-bats, every game”; “Balls in play against you become outs a little more often”; “Your returning players develop further between seasons”; “Every hour on a recruit counts for more, and your scouting reports run tighter.” | Mostly useful, but inconsistent with the point-based recruiting currency and too padded when stacked. | “Better at-bats”; “More balls in play become outs”; “More offseason development”; “More interest per point. Tighter scouting ranges.” Use one shared skill-description source with CoachPoints. |
| `src/ui/screens/Program.tsx:724` — “What the rest of the country thinks of you. It decides whose call you get. The program's own prestige is a different number, and it stays with the school.” | Four ideas needed only once, phrased as a lecture. | “Your reputation affects job offers and travels with you.” Put the program/coach distinction in first-use help. |
| `src/ui/screens/Program.tsx:765` — “What he carries between programs. It sets five controls the first day he arrives, and every one of them is yours to change on the strategy screen.” | Developer setup explanation, pronoun drift. | “Your default game plan. Change it in Strategy.” |
| `src/ui/screens/Program.tsx:777` — “FOUR SKILLS” | The count is not the point. | “COACH SKILLS.” |
| `src/ui/screens/Program.tsx:800` — “Points are spent on the coach step of the offseason, where they can still be taken back before the step closes.” | Passive and lengthy. | “Spend points in the offseason's Coach step. Changes stay editable until you continue.” |
| `src/ui/screens/Program.tsx:801` — “Points arrive at the board meeting each June, three for a season and more for silverware, and are spent on the coach step.” | The important three-point rule is buried; “silverware” is not the app's usual American term. | “Earn 3 points each June, plus bonuses for trophies. Spend them in the Coach step.” |
| `src/ui/screens/Program.tsx:893` — “Earned once and kept for ever, wherever you coach next. Records are the other half of the book, and those exist to be broken.” | First clause contains the useful rule; second is a generic inspirational contrast. | “Achievements stay with your coach.” |
| `src/ui/screens/Program.tsx:923` — “No seasons on the record yet. The first one goes in at the June board meeting.” | Can be a little more direct. | “Your first season goes on the record in June.” |
| `src/ui/screens/Program.tsx:982` — “Your career, wherever it was coached. Each school's own history, including the years you were somewhere else, is on its HISTORY screen.” | Repeats a distinction already made elsewhere. | “For a school's record, open History.” Make that a link if helpful, otherwise remove. |
| `src/ui/screens/Program.tsx:1105`, `:1119`, `:1120` — “Nobody in it yet”; “It meets in June”; “Finished careers only. Nobody goes in until he has left.” | Three euphemistic sentences about one empty Hall. | “No inductees yet. Retired players are considered each June.” Use “players who have left college baseball” if that is the precise eligibility rule; leaving this school alone is insufficient. |
| `src/ui/screens/Program.tsx:1146` — “CAREER LEADERS · NOT INDUCTIONS”; “Your record men” | Interface negates a possible misunderstanding at length. | “CAREER LEADERS.” Retain this as a separate section from Hall inductees. |
| `src/ui/screens/Program.tsx:1150`, `:1170` — “No hitter has finished a season for you yet”; “No pitcher has finished a season for you yet.” | Fine factual empty states, slightly long. | “Batting records start after your first season”; “Pitching records start after your first season.” |
| `src/ui/screens/Program.tsx:1187` — “Your own rosters only. The country's records live in the record book.” | Useful scope, but redundant navigation prose. | “Players you've coached.” Optional link “National record book.” |
| `src/ui/screens/Program.tsx:1417` — “YOUR SEAT” | “Hot seat” is an established good phrase, but the metric should be named. | “JOB SECURITY.” Keep state “HOT SEAT.” |

## PressRoom.tsx

Coverage: every trigger label, setup/question wrapper, answer buttons, matching-identity marker, silent option, and footer. Actual interview prose comes from `data/pressers.ts`. Keep “Sounds like you”; it is short and immediately meaningful. Keep character in answers, not in explanations beneath them.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/PressRoom.tsx:26`, `:27` — “DURING A BAD RUN”; “DURING A GOOD RUN” | Generic rather than the triggering event. | “LOSING STREAK”; “WINNING STREAK.” |
| `src/ui/screens/PressRoom.tsx:29`, `:31`, `:32` — “THE TROPHY”; “THE LETTER”; “HE SIGNED” | Labels require the player to decode vague props/pronouns. | “TITLE WON”; a factual event-specific label such as “JOB SEARCH LEAK” only if that is the caught-looking event; “DRAFT DEPARTURE.” Prefer actual event context. |
| `src/ui/screens/PressRoom.tsx:120` — “SAY NOTHING” | Clear but missing an obvious press-room phrase. | “NO COMMENT.” Good location for familiar, natural personality. |
| `src/ui/screens/PressRoom.tsx:126` — “No answer here is wrong. What you say moves your name, and your name is what recruits and other programs hear before they hear anything else.” | Reassurance removes stakes, followed by vague explanation. | First-use only: “Your answers shape your reputation.” If particular answers have concrete effects, expose those accurately rather than saying none is wrong. Remove footer on repeat visits. |

## Inbox.tsx

Coverage: header, empty state, year grouping, item count, read/new state, generated title/body display, and links. Actual event prose is generated in the store and engine. Basic card presentation needs little rewriting.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/Inbox.tsx:110` — “WHAT HAPPENED TO YOU”; “The inbox” | Passive and ominous for an ordinary news inbox. | “Inbox.” Remove kicker, or use “PROGRAM NEWS.” |
| `src/ui/screens/Inbox.tsx:120` — “Nothing yet. A run of wins, a record one of your men has taken, the board at the halfway mark, and then everything June brings — the verdict, the draft, the hall, and every coaching change in your conference.” | Feature catalogue as an empty state; 40+ words of names without an action. | “All quiet. Team news will land here.” |
| `src/ui/screens/Inbox.tsx:131` — “CARD / CARDS” | Describes the UI component rather than its content. | “UPDATE / UPDATES” or “MESSAGE / MESSAGES,” chosen to match generated content. |
| `src/ui/screens/Inbox.tsx:171` — “NEW” | Clear standard label. | Keep. Do not add personality here. |

## Wire.tsx

Coverage: all news-category labels, edition/date/count masthead, user-program marker, empty state, lead story, around-the-country articles, short briefs, and byline. The Wire is where the existing newspaper flavor belongs. Most wrapper text is already concise. Actual article headlines and detail are generated upstream.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/Wire.tsx:123`, `:132`, `:180`, `:191`, `:226` — “THE COUNTRY'S GAME”; “The Wire”; “BY THE {conference} DESK”; “AROUND THE COUNTRY”; “IN BRIEF” | These support one coherent newspaper fiction and do not explain the interface. | Keep. This is the right home for “desk.” |
| `src/ui/screens/Wire.tsx:141` — “ONE ITEM”; “{n} ITEMS” | Mechanical vocabulary inside a newspaper. | “1 STORY”; “{n} STORIES.” |
| `src/ui/screens/Wire.tsx:154` — “Nothing on the wire yet. Play some games and the country will start making noise.” | Better than most empty states; second half is slightly stock. | “No games, no headlines. Play ball.” Or keep the original if this becomes one of the few expressive empty states. |
| `src/ui/screens/Wire.tsx:241` — `{item.text}.` | Always appends a period, even if generated text later includes terminal punctuation. | Normalize headline punctuation upstream or append only when needed. This is a copy-system QA rule, not a reason to rewrite every headline. |

## History.tsx

Coverage: both tabs, headers, school-history explanation, empty archive, legacy-save note, aggregate trophies, season table, coach labels, awards, and legend. Keep the clean year/record/conference/finish table and the ability to tell which coach owned a season. The repeated distinction between career and school history should become one short scope label.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/History.tsx:59`, `:70` — “The Book” | Competes with school history and the Hall for the same metaphor. | “Record book.” |
| `src/ui/screens/History.tsx:61` — “Every season {school} has finished, whoever was coaching it. Take another job and this page keeps showing the years the school played while you were somewhere else.” | Long explanation of data ownership and a confusing promise about a page that follows the current user team. | “{school}, season by season.” Optional scope: “All coaches included.” |
| `src/ui/screens/History.tsx:62` — “The all-time marks across all ninety-six programs, seeded with the real NCAA ones so there is history to chase from the first game of the first season.” | “Seeded” is implementation language; adjusted baselines are called real; repeats the child RecordBook intro. | Remove this text and let RecordBook present one accurate introduction. |
| `src/ui/screens/History.tsx:103` — “The school writes a season into its book every June. Careers begun before the book existed start it with their next finished year.” | Migration/release history is exposed to every new player. | “Your first season is added in June.” Show a separate legacy-save explanation only when the save actually needs it. |
| `src/ui/screens/History.tsx:221` — “★ marks a conference tournament title, which carries an automatic bid to the national field however the regular season went. This is the school's book. Your own career, wherever it was coached, is on your coach profile.” | A legend turns into a tournament tutorial and another career-history explanation. | “★ Conference tournament champion.” Optional link “Your coaching career.” Put tournament qualification rules in tournament help. |

## RecordBook.tsx

Coverage: all six groups, qualification notes, NCAA/source labels, adjusted-baseline introduction, empty records, retired/frozen detail, tie rule, career-aggregation explanation, fielding exclusion, value formatting, and player links. This is the largest concentrated example of implementation rationale being presented as game copy. Readers came to see records; give them the records, with the exact qualification rules available on demand.

| Source and current copy | Problem | Proposed copy/action |
| --- | --- | --- |
| `src/ui/screens/RecordBook.tsx:28` — “One afternoon, anywhere in the country.” | Harmless flavor, but not every game needs to be an afternoon. | “One game. One place in the book.” Or remove; “Single game” already explains scope. |
| `src/ui/screens/RecordBook.tsx:32` — “Not records. One no-hitter is not more than another. The number is how many the country has seen, and the name is the last man to do it.” | Explains a distinction through contradiction and philosophical narration. | “Total recorded, with the most recent player listed.” Better still: label columns “TOTAL” and “LATEST.” |
| `src/ui/screens/RecordBook.tsx:37` — “Rate marks need the same qualifying minimum the national leaderboards use: two plate appearances a game to be batting, one inning a game to be pitching.” | Valuable rule, awkward phrasing. | “Minimums: 2 PA per team game for batting; 1 IP per team game for pitching.” Place behind “Qualification rules,” preserving the actual denominator. |
| `src/ui/screens/RecordBook.tsx:43` — “Four years at most, and the men who left after two are in here with the men who stayed. Rate marks need two qualifying seasons behind them. Nothing is seeded: the real career records are four times a single-season mark and would never be beaten, so every row here was set in this world.” | Long, defensive design rationale, unsupported general assertions. | “Career records start with your dynasty. Rate records require two qualifying seasons.” Remove the rest. |
| `src/ui/screens/RecordBook.tsx:48` — “Programs, not players.” | Redundant oppositional note. | Remove. Heading “TEAM RECORDS” is sufficient. |
| `src/ui/screens/RecordBook.tsx:51` — “Every head coach in the country, yours among them. They are hired, judged and moved on the same terms you are.” | AI-parity claim does not help read coaching records and need not be true in every rule. | “All head coaches.” Or remove beneath “COACHING RECORDS.” |
| `src/ui/screens/RecordBook.tsx:91` — “Every program in the country, for as long as this dynasty has run.” | Fine scope idea, too much prose before the longer explanation. | “Records from all 96 programs.” |
| `src/ui/screens/RecordBook.tsx:92` — “Marks tagged NCAA are the real ones, corrected for the league you are chasing them in — most were set with aluminium bats — and each sits where a great season here beats it about once in a generation. What the man actually did is printed under his name, and no row asks for more than that.” | Confuses original records with adjusted game targets; includes balancing rationale and an unsupported frequency promise. | “NCAA-inspired targets are adjusted for this league. Original records appear below the holder's name.” Rename the tag “NCAA BASELINE” or “ADJUSTED NCAA” to make the distinction visible in each row. |
| `src/ui/screens/RecordBook.tsx:115` — “A mark has to be beaten. Equalling one leaves it where it is.” | Valid game rule, twice stated. | “Ties don't replace the record holder.” |
| `src/ui/screens/RecordBook.tsx:118` — “Career marks are taken across the whole country, the same as the rest of the book. What is kept for them is a running total per man rather than every season of every roster — a career record wants the total, and the total is final the day he leaves.” | Data-storage design masquerading as a gameplay explanation. | Remove. If useful in help: “Career totals include every school a player represented.” Verify transfer aggregation before adding that claim. |
| `src/ui/screens/RecordBook.tsx:123` — “There are no career fielding records, for the reason there are no season ones: the ranking statistic is plays above what an average glove on his own team would have made, which does not mean the same thing in two different rows.” | Technical exclusion nobody asked about dominates the footer. | Remove from the main page. Optional help: “Fielding ratings aren't comparable across teams, so they don't have national season or career records.” |
| `src/ui/screens/RecordBook.tsx:208` — “Not set. Whoever does it first takes it.” | Repeated twice in every empty row. | “Unclaimed.” Good place for one small amount of personality. |

## Cross-screen consistency rules

1. Use points for recruiting, retention, and coach skill currencies; use dollars/budget for staff/facilities/scouting spending. Do not call points “money” in outcomes unless the game explicitly presents them that way.
2. Use “program” for the baseball program and “school” for the institution; do not rotate through school/college/chair/desk simply for variety.
3. Use “Coach prestige” and “Program prestige” whenever their numeric distinction matters. Do not label unlabeled numbers “they want / you are.”
4. Choose US English: color, aluminum, offense, defense; “talk him into staying” rather than “talk him round”; “too expensive” rather than “too dear”; “trophies” rather than “silverware.” Character dialogue can differ when intentional.
5. Use contractions in human-facing prose. Keep headers, facts, accessibility labels, and actions precise. Do not mechanically inject contractions into names, formal quotes, or statistics.
6. Rename navigation consistently: Job offers, Transfer portal, Board goals, Watchlist, Hall of Fame, Record book. Flavor belongs in a headline or a quoted person, not every navigation noun.
7. Keep player-perspective copy in second person. “Your coach” and “your players” are clearer than repeatedly switching between “you,” “he,” “a man,” and “they.”
8. Remove redundant kicker/title/body combinations. One title + one necessary sentence is enough for most empty states. Populate the screen with useful content, not an explanation of the tabs directly underneath.
9. Put changing facts in the sentence: which school, which player, how many points, what next step, what is lost, and whether a value is a chance. Never add unsupported certainty for a punchline.
10. Keep quoted voices distinct. A recruit, board member, reporter, and interface should not all deliver the same three-sentence maxim.

## Coverage boundary and generated-copy handoff

This document covers the screen-owned text above. Rendering dependencies that must be included elsewhere in the full audit:

| Screen | Imported/runtime language sources |
| --- | --- |
| NewGame | `src/engine/program.ts` (expectations, gate note, offer pitch, skill labels); `src/engine/strategy.ts` (philosophy names/blurbs and controls); `src/state/depth.ts` (system labels); `src/ui/CoachPortrait.tsx` (appearance options); `src/data/interview.ts` (all questions/answers); `src/data/cultures.ts` (culture names/creeds/labels); school/conference/name data. |
| JobSearch / JobMarket | Offer `pitch` generated upstream; school/conference names. |
| Board | `src/engine/recruiting.ts` (priorities, blurbs, scouting hints, ranges); `src/engine/scouting.ts` (high-school statistic labels); `src/engine/pitch.ts`; `src/ui/Tutorial.tsx` / tutorial data; player/team names. |
| Portal | `src/engine/portal.ts` (departure reasons); `src/engine/morale.ts` (mood labels); player/team names. |
| SigningDay | Recruiting priorities, high-school stat lines, potential grades, tutorial copy. |
| Draft | `src/engine/draft.ts` (retention hints, cases, dependence notes, pitch labels); tutorial copy; player/team names. |
| CoachPoints | `src/engine/program.ts` (skill labels and blurbs); tutorial copy. |
| Program | Program expectations/reviews/objectives/standing titles; `src/engine/economy.ts` (staff labels/notes, facilities, costs); strategy; achievements; Hall plaque text; records; postseason finish labels; tutorial copy. |
| PressRoom | `src/data/pressers.ts` (setup, question, answers), with resulting news/state messages generated upstream. |
| Inbox | `src/engine/inbox.ts` labels and `src/state/store.ts` producers for every generated title/body. The UI passes these through. |
| Wire | `src/engine/wire.ts` headlines/details and tutorial copy; format helpers for dates. |
| History | `src/engine/postseason.ts` finish labels, generated award titles, school names. |
| RecordBook | `src/engine/records.ts` labels, holder/source detail, frozen notes, baselines; value formatters. |

Recommended rollout for this scope: fix the factual conflicts first; cut repeated instructions and narrator commentary second; apply the terminology map third; then make dialogue/news more specific and funny. Treat the proposed rewrites as a draft for the chosen voice, not a mandate to add a joke to every cell.
