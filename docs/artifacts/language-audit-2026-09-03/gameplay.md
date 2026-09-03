# Gameplay and reference-screen language audit

Read-only source audit, 2026-09-03. No app source changed. Scope: all user-facing literals, template strings, JSX text, control labels, accessible labels, conditional branches, empty states and explanatory notes in the 18 files listed below. TypeScript AST extraction excluded source comments and retained original source line numbers; surrounding code and relevant engine rules were read where wording depended on behavior. These are source findings, not claims that every conditional state was rendered. The parent audit supplies the rendered-screen evidence and covers imported/shared copy producers.

## Overall finding

The app has a recognizable voice, but it is usually the voice of a solemn baseball essay. It repeatedly turns simple facts into little speeches: the book, the room, the chair, the desk, the season that means something. It also explains how the software was built directly to the player. Both patterns make the writing feel generated, even though many individual phrases are good.

The improvement is primarily subtraction. Keep baseball vocabulary and the occasional dry line. Give instructions, restrictions, numbers and button labels plainly. Save wit for a meaningful moment: a no-hitter, a title, a rival, a cold bench. Do not replace every long sentence with a new joke.

The existing best example is **“DON'T SAY IT”** during a no-hitter (`src/ui/screens/Manage.tsx:530`). It is short, situational and trusts the player. **“Play ball”** (`Today.tsx:276`), **“Give him the C”** (`Captain.tsx:146`) and **“Nobody left to beat.”** (`Postseason.tsx:555`) have the same qualities.

## Fix accuracy before voice

These are user-visible claims that can change a decision, not merely stylistic preferences.

| Priority | Source and exact current copy | Finding | Recommended treatment |
|---|---|---|---|
| High | `src/ui/screens/Standings.tsx:43`: “The standings reduced to what changes your next decision. The top six here play the tournament.” | The current field is eight. The first sentence is design rationale. | “The top 8 make the conference tournament.” Read the count from `CONF_FIELD`, rather than typing it into copy. |
| High | `src/ui/screens/Standings.tsx:78`: “The line that matters is sixth”; `:79`: “Six from this table play the conference tournament, and a regional is what the winner of that plays for.” | Both the entry cutoff and advancement rule are stale: eight enter and the top four tournament finishers advance. Verified in `src/engine/postseason.ts:566` and `:569`. | Title: “Top 8 advance.” Help: “The top 4 tournament finishers reach the regionals.” Display that rule once. |
| High | `src/ui/screens/Manage.tsx:815`: “One a game, and it has gone.” | A pitching change resets the visit. It is one per pitcher per outing, not one per game. Verified at `src/engine/liveGame.ts:412` and `src/engine/game.ts:2055`. | “Already visited this pitcher.” Available state: “Restore some confidence. One visit per pitcher.” |
| High | `src/ui/screens/Postseason.tsx:222`: “Best of ${len}, first to ${clincher(len)}. You lead it ${wins(userTeam)}-${wins(other)}.” | The sentence always says “lead,” including 0–0 and when behind. | “Best of 3. First to 2 wins.” Add a state-aware “You lead 1–0,” “Series tied 1–1,” or “You trail 0–1.” Omit a lead line at 0–0. |
| High | `src/ui/screens/Postseason.tsx:444`: “Double elimination. Two losses and it is winter.” | This appears on conference entry, but teams eliminated in the top four continue to a regional. The next sentence says that, contradicting the first. | “Double elimination. The top 4 finishers reach the regionals.” |
| High | `src/ui/screens/Postseason.tsx:533`: “Sixteen reach the showdown. Most of the country never sees it.” | Current national field and showdown are 20 teams (`src/engine/postseason.ts:601`, `:614`). | “Your national tournament run ends here.” If the number is useful, derive it from the bracket. |
| High | `src/ui/screens/SeasonReview.tsx:140`: “You made the College World Series. Four teams out of ninety six.” | The current `omaha` finish is every team in the 20-team national field. “Four” is stale. | “You reached the national tournament.” Use the same name as the bracket. |
| High | `src/ui/screens/SeasonReview.tsx:138`: “One game short in Omaha. It counts, and it stings.” | A runner-up can lose the best-of-three final 0–2, so “one game short” is not always true. `SERIES.final` is 3 at `src/engine/postseason.ts:556`. | “A title series to remember. One trophy missing.” Or the plainer “National runner-up.” |
| High | `src/ui/screens/DepthChart.tsx:159`: “✚ HURT — PICK HIS COVER” | The branch checks `!available`, which also includes redshirts and other absences; the label can falsely report injury. See `:127` and `src/engine/depthChart.ts:59`. | “UNAVAILABLE · CHOOSE REPLACEMENT,” or use the actual reason: “INJURED,” “RESTING,” “INELIGIBLE,” “REDSHIRT.” |
| High | `src/ui/screens/DepthChart.tsx:90`: “— the next man on the chart plays.”; `:248`: “The chart is what the game plays. When a man cannot go, the next name here takes his place and bats where he was batting.” | These promise automatic cover, while the UI separately asks the user to choose cover and the app can block advance for that decision. This is also tangled with the distinction between the depth chart and current lineup. | State the action needed in the active management mode: “Choose a replacement below.” Put a concise explanation of backup order in help. Verify behavior when implementing; do not repeat the current absolute claim. |
| High | `src/ui/screens/RosterMoves.tsx:308`: “The season has started. One appearance already burned this year.” | Selected from `dayIndex > 0`, without checking this player's appearances. The actual app restriction is preseason-only. | “Redshirts must be set before the season starts.” |
| Medium | `src/ui/screens/Rankings.tsx:122`: “You are ${mineAt + 1}th” | Produces 31th, 32th, 33th, etc. | “Your rank: #${mineAt + 1}.” |
| Medium | `src/ui/screens/Rankings.tsx:125`: “A projection off the rosters, nothing more. Once the games start counting the real table takes over.” | Projection includes prestige (75% roster strength, 25% prestige at `:50`) and remains active until roughly four games per team (`:41`). Early games already count. | “Early rankings use roster strength and prestige. RPI takes over after the opening games.” Label that phase “EARLY RANKINGS,” not “PRESEASON” after play begins. |
| Medium | `src/ui/screens/SeasonReview.tsx:288`: “RETURNING” | The value subtracts only seniors. Draft-eligible players counted here may also leave. | “ELIGIBLE TO RETURN,” or “POTENTIAL RETURNERS.” |
| Medium | `src/ui/screens/StrategyScreen.tsx:40`: “Twice the steals and twice the outs on the bases” | Current rule scales steal attempts by 2.2, not guaranteed outcomes (`src/engine/strategy.ts:60`). | “More steal attempts. More chances to get caught.” |
| Medium | `src/ui/screens/Captain.tsx:52`: “He is playing the best baseball of his life.” | Triggered by `mood(p) === 'buzzing'`, not career-best performance. | “He's in great spirits.” |
| Medium | `src/ui/screens/Captain.tsx:103`: “a captain the coach chose and the room did not is a different season from one they both wanted” | Strongly suggests a mechanical penalty for ignoring the recommendation. The reviewed captain/morale code uses the presence of an eligible captain to damp mood swings; it does not establish this separate consequence. | Keep the recommendation and the candidate's case. Delete the promised consequence unless a specific rule supports it. |

## Voice rules for this scope

1. **One job per line.** An intro identifies the screen; a note explains a rule; a button names its action. Avoid asking all three to repeat the same thing.
2. **Use direct nouns.** “Scouting report,” “game log,” “career stats,” “morale,” “coach” and “budget” resolve things that “book,” “room,” “chair,” “desk” and “ledger” obscure.
3. **Contractions are welcome.** “He's,” “you've,” “isn't” and “can't” make the existing voice less ceremonious. They do not need to appear in every sentence.
4. **Instruction before flavor.** If a player cannot proceed, say what they need to do. If a choice costs money, show cost and duration. If a choice changes eligibility, show the restriction.
5. **Flavor belongs to the state.** A no-hitter earns “Don't say it.” An ordinary filter result does not need a three-part gag. Celebrations can have a little more room than routine pages.
6. **Preserve optional explanations that answer real questions.** Statistical definitions in the Player detail drawer are an appropriate use of help; permanent paragraphs about autosave storage are not.
7. **No author commentary.** Remove “the engine,” “the game keeps,” “gated,” save-migration details and explanations of why a feature was designed this way from normal product flows.
8. **Use one American baseball vocabulary.** Program, honors, recognize. The code currently mixes “programme,” “honours,” and “recognise” with “program,” “organized,” and US college baseball terminology.
9. **Centralize rule-bearing copy.** Tournament counts, report durations, visit limits and redshirt cutoffs should come from the same rule definitions as the feature.

## Screen-by-screen recommendations

In the following tables, quoted source text is verbatim with whitespace normalized. `${...}` denotes the actual source template expression; `[name]`, `[count]` and similar notation in proposed text are placeholders. “Remove” means remove the displayed note, not the underlying feature. Unlisted standard baseball abbreviations and factual data labels were reviewed and can remain.

### Today — moderate rewrite, retain the game-day core

Coverage: headlines; resumed game; matchup/series/rivalry state; required-decision hold; actions; off day; simulation progress; regular-season conclusion; postseason verdict; team pulse.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Today.tsx:176` | “The regular season is done.” | “Regular season: in the books.” Optional flavor; the existing line is also clear enough to keep. |
| `:177` | “A game is waiting on you.” | “Game in progress.” A state label works better than anthropomorphizing a saved game. |
| `:217` | “YOU LEFT THIS ONE ON THE FIELD” | Remove. “GAME IN PROGRESS” already explains the card and avoids mild blame. |
| `:221`, `:222` | “Let them finish”; “Pick it up” | “Sim the rest”; “Resume game.” Match these across Today and Postseason. The actions have materially different consequences. |
| `:256` | “The first chapter under your watch.” | “Your first rivalry game.” The score establishes the rivalry without a novel metaphor. |
| `:264` | “A decision is waiting on you below. Nothing moves until it is dealt with.” | “Resolve the decision below to play.” Plural: “Resolve [count] decisions below to play.” Better still, link to the specific decision. |
| `:298` | “Bullpen work and situational defense.” | Optional flavor, but it reads as a report of training that took place. If no such scheduled activity exists, “A day to catch your breath.” Or simply omit under “OFF DAY.” |
| `:304` | “Advance” | “Next day.” A clearer action label. |
| `:352`, `:353`, `:355` | “THE REGULAR SEASON IS IN THE BOOKS”; “June is here”; “and now the games that get remembered. Every jersey in the country is washed for this.” | Keep “June is here.” Replace the body with “[W]–[L]. Time for tournament baseball.” Delete the laundry sentence and repeated regular-season heading. |
| `:402`, `:403` | “CLUB PULSE”; “This week” | The metrics are season-to-date, not weekly. Use “SEASON SO FAR” and remove “This week.” |
| `:461` | “Nobody can take this one away.” | Fine as a one-time title celebration. Do not repeat alongside multiple other title speeches. |

Keep “First pitch is next,” “No game today,” “Set lineup,” “Play ball,” “Sim game,” “Sim week,” record/streak lines, series scores and “SIMULATING / DAY [x] / [total].” These are clear and have enough personality already.

### Manage — keep the live voice; trim the tools

Coverage: no-game state; inning/outs; no-hitter flag; matchup labels; pitch count/confidence; generated play-by-play container; decision controls/tooltips; final recording; manager tools; substitution sheets; base-state sentences. Generated tactic labels and play-by-play producers require the separate engine audit.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Manage.tsx:440` | “Take the dugout and call every plate appearance of your next game.” | “Your next game. Your calls.” Or remove; “Manage next game” is sufficient. |
| `:530` | “DON'T SAY IT” | Keep. This is the target voice: an earned baseball joke, three words, no explanation. |
| `:589`, `:599` | “AT BAT · YOURS”; “AT BAT · THEIRS”; “PITCHING · YOURS”; “PITCHING · THEIRS” | Consider team abbreviations in place of “YOURS/THEIRS.” Otherwise keep; these aid orientation. |
| `:608` | “CONF” | “CONFIDENCE,” or an accessible expansion. Elsewhere CONF means conference. |
| `:686`, `:690` | “Record it and the day moves on.”; “Record the game” | “Save result & continue.” Remove the explanatory sentence. Check available width; “Continue” can work with the consequence next to it. |
| `:718` | “Make the next move” | Remove beneath “MANAGER TOOLS.” Generic and redundant. |
| `:737`, `:738` | “Watch it play”; “The bench coach calls it and you watch the field.” | “Watch game” / “The bench coach takes over.” This distinction is useful because watching is reversible. |
| `:743`, `:744` | “Take the dugout back”; “Stop him. The next call is yours again.” | “Take over” / remove the body. |
| `:754` | “Hand him the clipboard for good. Keep it for the blowouts.” | “Finish this game now.” State the actual effect of “Sim the rest.” |
| `:772` | “The game keeps. PLAY BALL picks it up where you left it.” | “Resume this game from your desk.” Avoid save guarantees beyond verified persistence behavior. |
| `:815`, `:816` | “One a game, and it has gone.”; “Settle him down. It buys back a little of what he has lost.” | “Already visited this pitcher.” / “Restore some confidence. One visit per pitcher.” Name confidence so players do not infer fatigue recovery. |
| `:966` | “Nobody left.” | Keep; the sheet title provides the context. |

Keep “YOUR CALL,” “PLAY-BY-PLAY,” “Go to the bullpen,” “Pinch hit for [name],” “The bench is empty,” available-player counts, “Close manager tools,” and the base-state phrases (“bases loaded, two away”). They are compact and functional.

### Lineup — shorten instructions without hiding the two-tap interaction

Coverage: initial instructions, selected hitter/pitcher/bench states, feedback, autosave label, field rail, lineup/bench/rotation/bullpen, midweek note.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Lineup.tsx:200` | “Now tap the spot ${benchMan.name} takes in the nine.” | “Choose [name]'s batting spot.” |
| `:202` | “Tap a spot to swap the order — or a bench man to start him instead of ${order[picked]?.name ?? ''}.” | “Choose another starter to swap, or a bench player to replace [name].” Retain both distinct actions. |
| `:204` | “Now tap the day for ${team.team.rotation[pickedArm]?.name ?? ''} to take.” | “Choose [name]'s rotation slot.” |
| `:207` | “${manAtSpot.name} is batting ${atSpot + 1} at ${spot}.” | “[name] · batting [ordinal] · [position].” Do not make bare “batting 1” carry ordinal meaning. |
| `:208` | “Nobody in tonight's nine is at ${spot}.” | “No starter at [position].” |
| `:210`, `:242`, `:246` | “Order dealt. Tap two spots to fine-tune it.”; “Order dealt” | “Lineup set.” Keep the swap hint separate and show it only when needed. “Dealt” introduces a card-game metaphor into the baseball action. |
| `:219` | “Set the batting order, the field, and the rotation for tonight.” | Remove if instructions stay below. “Tonight” is also too specific when editing a standing rotation or on an off day. |
| `:257` | “Saved as you go” | Keep if it reflects successful saving; otherwise show actual save state. Friendly without performing a character. |
| `:337` | “THE BENCH” / “Everyone else” | Keep “Bench”; delete “Everyone else.” |
| `:378` | “ROTATION” / “Who takes the ball” | Either can work. Prefer “Rotation” when space is tight; the second line is optional flavor, not needed explanation. |
| `:410` | “Your Friday arm starts the opener of every conference series. The midweek starter takes all twelve non-conference games — [innings] innings so far.” | “Friday starts each conference opener. Midweek handles non-conference games.” Move into rotation help; show midweek innings with the pitcher. Avoid hardcoded “twelve” if scheduling can change. |
| `:419` | “THE BULLPEN” / “The rest of the staff” | Keep “Bullpen”; remove the second heading. |

Keep “Starting nine,” “Auto lineup,” “Tap two spots to swap them,” “[name] is in for [name],” “Field positions,” “Show who is at [position],” and conventional CON/POW/DEF/OVR labels with a glossary where already available.

### Depth Chart — make status and responsibility explicit

Coverage: positional fit scale; availability and starting status; page heading; absent-player notice; chart expander; academic status; reorder action; footer.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/DepthChart.tsx:28` | “HIS OWN” | “NATURAL POSITION.” The existing phrase requires interpretation. |
| `:29` | “COVERS” | “COMFORTABLE.” Shows suitability without implying the player is currently filling in. |
| `:30`, `:31` | “OUT OF HIS DEPTH”; “A STRETCH” | “POOR FIT”; “A STRETCH.” The latter is a useful, concise bit of personality; keep if the scale has clear ordering. |
| `:64` | “OUT · ${left} MORE ${left === 1 ? 'DAY' : 'DAYS'}” | “OUT · [count] DAYS LEFT.” Drop “more.” |
| `:67`, `:68` | “TONIGHT'S MAN HERE”; “IN THE NINE · ${at}” | “STARTING HERE”; “STARTING AT [position].” |
| `:77` | “THE DEPTH CHART · ${men.length} MEN” | “DEPTH CHART · [count] PLAYERS.” “Who plays where” can stay as the human headline. |
| `:90`, `:159`, `:248` | Automatic-cover statements and “HURT — PICK HIS COVER” | See accuracy fixes above. One concise instruction, with the actual absence reason, replaces the footer and contradictory warning. |
| `:214` | “GRADES” | “ACADEMIC WATCH.” Keep “FAILING” when that is the actual state. “GRADES” alone does not say whether there is a problem. |

Keep position abbreviations, “BENCH,” “UNAVAILABLE,” and “Move [name] up at [position]” as the accessible button label.

### Roster — mostly clear; remove generic product copy

Coverage: roster status abbreviations; list details; roster group filters; filter panel; empty result; depth/captain links; roster counts.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Roster.tsx:175` | “The current group, organized for quick staff decisions.” | Remove. It explains the design rather than the roster. |
| `:185` | “Chart” | “Depth chart.” Clear on its own. |
| `:245` | “Nobody fits that filter. Whole roster, no such man.” | “No players match. Try clearing a filter.” One useful sentence beats a repeated joke. |
| `:234` | “Any spot” | “Any position.” Match the filter label. |
| `:63`, `:68` | “R-S”; “ACAD” | Keep compact badges only with an accessible expansion or a discoverable glossary: “Redshirt” and “Academically ineligible.” Full words are preferable where space permits. |

Keep “Active roster,” “All / Hitters / Pitchers,” “Filter,” “Clear,” “Class year,” “Position,” “Any year,” “Depth chart,” “Name a captain,” player counts, and basic statistical details.

### Roster Moves — high-value rewrite; remove patronizing and behind-the-scenes language

Coverage: action tabs and status; rest, injury, delegation; academic conversations; permanent position changes; redshirt/removal states; disabled controls.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/RosterMoves.tsx:45` | “He is close to the line. A week could go either way.” | “At risk of academic suspension.” Be clear where a missed week is at stake. |
| `:49` | “He is short of eligible and will start missing weeks.” | “His grades put him at risk of missing games.” Preserve exact eligibility certainty from the rule. |
| `:194`–`:197` | “Room / School / Field / Season” | “Rest / Grades / Position / Eligibility.” These tabs currently make the user learn a second vocabulary. |
| `:207` | “He is already sitting”; “Give him three days” | “Resting”; “Rest for 3 days.” |
| `:211` | “He has played a great many days in a row. Take the miles out of his legs.” | “He's worn down. Three days off will help.” |
| `:212` | “Rest is for a man who needs it. His legs are fine.” | “He's rested and ready.” The current version scolds the player for checking. |
| `:227`, `:228` | “The trainer owns this one”; “[prognosis] Rest will not speed it up — the depth chart decides who covers him while he heals.” | “Injured” / “[prognosis] Choose his replacement on the depth chart.” Show the prognosis once, not again in the action and the note. Retain “Rest won't shorten recovery” only if confusion is observed. |
| `:235` | “You asked for a desk that does not decide who sits. Rest and redshirts are theirs; the lineup is still yours.” | “Your staff handles rest and redshirts.” This reads like the app arguing with its developer, not helping a player. |
| `:247` | “Have a word”; “No words left this season” | “Talk about grades”; “No talks left this season.” If “Have a word” is kept, use it as the sole flavor line beside a clear “Grades” tab. |
| `:250`, `:255`–`:259` | Academic explanation repeated in the action detail and the FieldNote | Display the current status once. Keep “[count] of [limit] talks left.” Put a current suspension date below it when relevant. |
| `:272` | “There is nowhere else he can stand.” | “No position changes available.” The current line sounds insulting and physically literal. |
| `:274` | “Move him from ${p.pos} to ${target} for good. He will learn the new spot over time.” | “Change his primary position from [old] to [new]. He'll need time to adjust.” Do not say irreversible if a later position change is possible. |
| `:275` | “Pick a spot below. This is permanent, not a lineup change.” | “Choose a new primary position.” Keep the persistent-change warning next to the actual commit button. |
| `:303`, `:305` | “Play him after all”; “Undo the preseason eligibility decision.” | “Remove redshirt” / “He'll be eligible to play this season.” |
| `:307`, `:308`, `:316`, `:317` | Multiple explanations of preseason-only redshirts and appearances | Consolidate to “Set redshirts before the season starts. [used] of [limit] used.” After the cutoff: “Redshirt decisions are closed for this season.” Do not claim the selected player has appeared based on date alone. |

Keep “PLAYER ACTIONS,” “ACTIVE,” “HURT” when the player is actually injured, “REDSHIRT,” counts, real prognosis, “Change his position,” and explicit eligibility restrictions. This is a place for clarity, not jokes.

### Player — the largest concentration of overexplaining

Coverage: active player header and tabs; former-player variants; professional career; bio; hidden potential/badges; tools; repertoire; platoon; tendencies and scouting states; stat details; postseason stats; fielding; game log; live/archived career; no-player and no-history states.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Player.tsx:433` | “He has left the program. There is nothing left to scout and no current line to read — what the game keeps of him now is the record book.” | “His time here, on the record.” Or remove under “FORMER PLAYER”; the history tabs explain what remains. |
| `:508` | “The book adds a line every June. Most careers end quietly in the middle of the pyramid; his has not ended yet.” | “Still playing. His career updates each June.” Delete the unearned career obituary. |
| `:551`–`:561` | Long bio restates class, school, position, hands, fastball; “He is draft eligible in June, which is a decision that arrives whether you want it or not.” | Keep one compact bio if it adds context, and a separate “Draft eligible this June.” Remove “whether you want it or not.” Most bio facts already appear in the header or quick facts. |
| `:575` | “He plays for someone else. You can see what he has done and what he can do now — how much further he might go, and what he is good at that no box score shows, is your rival's problem to know.” | “Potential and badges are hidden for rival players.” Better as help attached to the hidden values, rather than a full-width permanent paragraph. |
| `:631` | “No badges yet. They come with what he does, and he has room for ${cap}.” | “No badges yet · [cap] slots.” An explanation of earning badges belongs in badge help. |
| `:118`–`:120` | “K/9”; “H/9”; “BB/9” used as 0–100 rating labels | Consider “Strikeout rating,” “Hit prevention,” “Control,” or append “rating.” On the Stats tab the same abbreviations mean actual rates. Do not let a 65 rating read as 65 strikeouts per nine. |
| `:708` | “What he is made of” | “Pitching ratings.” “Tools” remains good for hitters. |
| `:773`, `:774` | “The bar is how often, not how good”; “A man who throws sixty per cent four-seamers and a man who throws forty are different pitchers with the same three ratings. This is the same data the POWER ARM and JUNKBALLER readings come off.” | Label the bars “Pitch usage” and show percentages. Remove this whole explanatory panel. If help is needed: “How often he throws each pitch.” |
| `:799` | “Against each hand”; “What he allows” | “Platoon splits.” Keep the clear “PRODUCTION / ALLOWED” distinction, but check pitcher column labels: `:803` and `:808` print “VS RHP / VS LHP” for pitchers as well as hitters; pitcher outcomes normally need batter handedness labels. Verify helper semantics before changing. |
| `:855` | “Lefties and righties get the same man. The zeros are the reading, not a gap in it.” | “Equally effective against lefties and righties.” Delete the software-defense clause. |
| `:860`, `:861` | “He turns around”; “A switch hitter takes the platoon advantage against everybody, which is why both columns read the same.” | “Switch hitter” / “Gets the platoon advantage against either hand.” Put under split help if the “BOTH” badge already explains it. |
| `:867` | “Better against his own hand, which is rare and real. Do not bench him for the matchup.” | “Hits better against [lefties/righties].” Avoid making the player's selection for them. |
| `:904` | “You know him”; “${seen} of ${slots.length} read” | “Scouting complete”; “[seen] of [total] tendencies known.” |
| `:916`, `:921` | “Nothing unusual”; “He does the ordinary thing.” | Keep “No strong tendency,” with no repetitive explanatory subline. |
| `:916`, `:923` | “Still watching”; “${Math.round(progress * 100)}% of the way to a reading.” | “Still scouting” / “[percent]% scouted.” |
| `:916`, `:924` | “No book”; “The desk has not been paid for one.” | “Not scouted.” One state label is enough. |
| `:933`–`:936` | “You are reading a rival”; “The book on him, bought and paid for. It reads for the next stretch of games.” | “Scouting report active.” Show the real expiry date or remaining days if available. |
| `:936` | “Buy the book from PROGRAM ACTIONS on their college page. One report covers the whole roster.” | “Scout [school] from Program actions to reveal roster tendencies.” A direct link is preferable to a prose navigation route. |
| `:1042`, `:1043` | “No line yet”; “He has not appeared this season. The book opens on his first pitch.” | “No appearances this season.” Remove the body. The “first pitch” metaphor is also odd for a hitter. |
| `:1053`–`:1094` | Statistical definitions and numeric context in a detail drawer | Keep the optional drawer and most definitions. This is an appropriate place to explain unfamiliar statistics. Tighten “On-base percentage plus slugging percentage in one measure of production” to “On-base percentage + slugging percentage.” Review simplified definitions such as “SAVES: Leads protected through the end of a game” for exact scoring-rule fit; brevity should not create false definitions. |
| `:1191` | “IN JUNE” / “When it mattered” | “POSTSEASON.” The second heading dismisses the rest of the year and repeats the recurring dramatic beat. |
| `:1283` | “AMONG GLOVES” | “FIELDING RANK.” |
| `:1319` | “Plays above average is outs an average glove would not have made, errors already off. Read the gap to the league line, not the sign.” | In optional stat help: “Extra outs above the fielding baseline, minus errors. Compare with the league average shown here.” The exact baseline deserves a clear definition; do not hide it inside metaphor. |
| `:1351`, `:1353` | “Not your program”; “Game logs are kept only for your own men. Every other school keeps its season totals and nothing finer — tens of thousands of rows through every autosave is the alternative.” | “Game log unavailable” / “Game logs are available for your team only.” Delete all storage-cost justification. |
| `:1366`, `:1367` | “No appearances yet”; “His first game this season writes the first line here.” | Keep the heading; remove the body. |
| `:1388`, `:1389` | “This season only”; “Box scores cover the year in progress and are cleared at the roll. What survives it is the record book, on HISTORY.” | “Game logs cover the current season. Career totals are on History.” Prefer a “Career stats” link. Retain the data-retention fact without internal “roll” vocabulary. |
| `:1445`, `:1446` | “He has not been in a game. The book starts with his first one.”; “The season-by-season book is kept for your own program only — every school in the country would put tens of thousands of rows through each autosave.” | Own player: “No appearances yet.” Rival: “Season-by-season stats are available for your team only.” |
| `:1529`, `:1530` | “The top row is unfinished”; “This season goes into the book in June, with whatever it says on the last day.” | Remove. The live row already says “in progress.” |
| `:1653` | “He left before the book was keeping years, or he never played one.” | “No season stats are available.” Do not speculate about the player's career or expose migration history. |

Keep “Overview / Ratings / Stats / Games / History” unless renamed globally; “Starter,” “Reliever,” “Bats / Throws,” age/OVR/POT with clear meaning, conventional rating labels, “Signature moments,” inning notation help, “No seasons on record,” and “Tap a name on the roster.” The long bio and repeated notes should shrink before any useful statistics are removed.

### Strategy — explain the trade once, without coaching the user out of the choice

Coverage: all five strategy groups, every setting and detail, intro, cycle-control accessible label, footer.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/StrategyScreen.tsx:89` | “Set the situations your club should recognise without interrupting every inning. These are live from the next pitch, and every one of them gives something up — there is no column here that is simply better.” | “How your bench coach runs the game.” If timing needs stating, verify in-progress behavior and use one precise sentence. |
| `:26` | “How hard runners are sent for the extra base.” | “When to send runners for an extra base.” |
| `:28` | “Fewer extra bases, almost never thrown out” | “Fewer chances taken. Fewer outs on the bases.” Avoid “almost never” as a guarantee. |
| `:29` | “Takes what is there” | “Balanced risk.” The current phrase has character but says little about the setting. |
| `:30` | “More bases taken, and roughly twice as many runners retired” | “Push for extra bases. Risk more outs.” |
| `:36` | “Green light policy for anyone who reaches.” | “When runners can steal.” |
| `:38` | “Nobody runs. No steals, and none given away” | “No steal attempts.” |
| `:39` | “Your runners go when the matchup is right” | Keep. Concise, specific, natural. |
| `:40` | “Twice the steals and twice the outs on the bases” | “More steal attempts. More risk of getting caught.” |
| `:46`, `:49` | “Trading an out to move a runner, late and close.”; “Only the bottom of the order, only when a run decides it” | Keep the trade. Tighten rare setting to “Bottom of the order, late in close games.” |
| `:50` | “Moves runners, and costs you runs on balance. Bunting usually does” | “Bunt more often. Trade outs for a runner in scoring position.” Put expected-run teaching in optional help, not a scolding afterthought. |
| `:55` | “PITCHING HOOK” | “STARTER LEASH” if flavor is desired, or “PITCHING CHANGES.” Avoid cycling through different terms elsewhere. |
| `:58`, `:59`, `:60` | “Fresher arms on the mound, bullpen worked hard”; “Out when he is done”; “Bullpen stays rested, tired starters stay in” | Quick: “Pull starters earlier; use more bullpen.” Standard: “A balanced workload.” Patient: “Leave starters longer; save the bullpen.” |
| `:68` | “No opinion about who is batting, no exposure” | “Standard infield positioning.” |
| `:69` | “Shift only against slow pull hitters. The percentage play” | “Shift against slow pull hitters.” |
| `:70` | “Big against a pull heavy lineup, badly punished by one that runs” | “Shift against everyone. Better against pull hitters; vulnerable to speed.” |
| `:127`, `:128` | “Nothing here is free”; “An aggressive running game does take more bases and does run into more outs. A full shift is big against a pull-heavy lineup and badly punished by one that runs. The notes are the trade the engine actually makes.” | Remove the whole panel. It repeats the setting descriptions and ends in implementation commentary. |

Keep standard setting names (Patient, Balanced, Aggressive; Never, Selective, Constant; Never, Rare, Often; Quick, Standard, Patient; Straight up, Situational, Full shift), the group labels where already clear, and the accessible cycle label. Do not let “witty” erase tradeoffs.

### Captain — the right place for clubhouse voice, but one paragraph is enough

Coverage: candidate case text, mood variants, current/no captain, eligibility empty state, team suggestion, eligible list, appointment/removal controls.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Captain.tsx:75` | “A captain does not make anybody better. He is the reason a bad April does not become a bad year — and who you pick is a decision the room will read either way.” | “Your captain steadies the clubhouse through the highs and lows.” Describes the supported mood effect and avoids invented guarantees. |
| `:85` | “A freshman never leads a room, and neither does a man without one of the three badges that say he can. Recruit for it, or wait for somebody to earn one.” | “Captains must be sophomores or older and hold a leadership badge.” Name/link the eligible badges in help. This is a game rule, not a universal claim about freshmen. |
| `:102`, `:103` | “The room would pick ${suggested.name}”; long explanation of whether the coach agrees | “The clubhouse pick: [name].” Keep the concrete class/badge evidence; delete the speech about different seasons. |
| `:50`, `:52` | “He is unhappy, which the room will hear.”; “He is playing the best baseball of his life.” | “He's unhappy.” / “He's in great spirits.” Mood is not a guarantee about teammates or performance. |
| `:111` | “One man”; “${men.length} men” | “[count] candidates.” |
| `:146` | “He has it”; “Give him the C” | “Captain”; keep “Give him the C.” |
| `:157` | “TAKE THE C OFF” | “Remove captain.” Or keep if paired with the clear “Captain” status. |

Keep “[name] wears the C,” “Nobody wears the C,” “Nobody is ready,” the badge names, and the C symbol. The badge-and-class rule should stay visible because it explains why a favorite player is missing from the list.

### Team Card — remove the largest remaining layer of product narration

Coverage: no team; overview and comparison; all program actions; scouting/payment/duration states; culture; head-to-head; roster/results tabs; approaches and reactions; coach dossier and empty state.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/TeamCard.tsx:93` | “Tap a team in the conference table or the national rankings.” | “Choose a team from Standings, Rankings or Colleges.” Keep only if this empty state is reachable. |
| `:160`–`:164` | “[school] has the stronger profile today.”; “Dead level on profile today.”; “Prestige decides whose calls get answered.” | State the compared metric: “[school] has more prestige.” / “Even on prestige.” Delete the sweeping claim that prestige alone decides responses. |
| `:225` | “Keep a useful read on the wider college game.” | Remove under “PROGRAM ACTIONS.” Generic product prose. |
| `:232`, `:233` | “Saved to the watchlist on your program tab.”; “Keep it in view as the season changes.” | “On your watchlist.” / remove the pre-action body. “Track program” is sufficient. |
| `:240` | “This program's profile beside your own.” | “Compare prestige and record.” Or remove beneath a clear compare action. |
| `:251`–`:259` | “Your staff scouts them”; “Book bought”; “Every report arrives as part of the wage bill.”; “Their tendencies read for the next ${SCOUT_DAYS} days.”; “Buy the book: every tendency on their roster, readable on each card.”; “The ledger cannot carry it this year.” | “Scouted by staff”; “Report active”; “Included with staff scouting”; “Reveals roster tendencies for [days] days”; “Not enough budget.” Keep the price beside “Scout program.” |
| `:265`–`:268` | “Track job path”; “When this chair calls you, the market stars it.”; “Note interest without applying for a job that is not open.” | “Watch for jobs” / “Highlights this school in the job market.” Make clear this is tracking, not an application, only where that distinction is needed. |
| `:411`, `:412` | “they count fast”; “they will wait”; “a winning season”; “Omaha or nothing” | “Short leash”; “Room to build”; retain “A winning season” and “Omaha or nothing” if the bracket name stays Omaha. This is a good place for a little personality. |
| `:420` | “This is your program. Everything here is your own season.” | Remove. Own-team context should be clear from the header. |
| `:575` | “Tap a name for his card. You can see what a rival has done and what he can do now. How much further he might go is his coach's to know.” | “Tap a player for ratings and stats.” Move potential-visibility explanation to the hidden field, not every roster. |
| `:682` | “They have not played a game yet this season.” | “No games played yet.” |
| `:733` | “Your own games carry a full box score. Open one from the SCHEDULE screen.” | “Open Schedule for full box scores.” Prefer a link. |
| `:734` | “Scores only. The game keeps full box scores for your program alone, so there are no batting or pitching lines to open here.” | “Full box scores are available for your team only.” |
| `:851` | “They would take the call. Expect them at the carousel.” | “They're interested. Check the offseason job market.” Do not promise an offer unless the state guarantees one. |
| `:852`, `:853` | “You have written to them this season.”; “Three letters a season. You have sent yours.” | “Already contacted this season.” / “All 3 contacts used this season.” |
| `:873`, `:874` | “Somebody talked. Your own board has heard about it.”; “Nothing came back.” | “Word got back to your board.” / “No reply.” The event itself supplies the drama. |
| `:899` | “Three a season, and never the same school twice. Word can get back.” | “Contact up to 3 schools per season. Your board might hear about it.” Keep both limit and risk. |
| `:934`–`:937` | “Safe. The board is not counting.”; “Settled, but a bad year would be noticed.”; “Under pressure. Another one like this and they will look.”; “On the way out. His name is already on somebody's list.” | “Secure”; “Stable”; “Under pressure”; “Job at risk.” Do not imply a dismissal or job search has already happened from a pressure score. |
| `:942`, `:956`, `:961` | “THE PROGRAMME”; “BEFORE THEY COUNT”; “WHAT CLEARS THE BAR” | “THE PROGRAM”; “BOARD PATIENCE”; “EXPECTATIONS.” |
| `:967`, `:995` | “IN THE CHAIR”; “WHAT HE IS GOOD AT” / “Where his points went” | “HEAD COACH”; “Coaching strengths.” Points allocation is not needed to understand the public scouting card. |
| `:1010` | “The chair is empty, or this programme predates the coaching carousel in your save.” | “No coach information available.” Delete save-migration speculation. |
| `:1015`, `:1016` | “This is scouting, not a leak”; “Everything here is what the country already publishes about a programme — its reputation, its record, and the man in the chair. What his players can actually do stays on their own cards, gated the way it always was.” | Remove the whole note. None of it helps the player make a choice, and “gated” is internal implementation vocabulary. |

Keep Overview/Roster/Results, clear season numbers, Head to head, actual upcoming-match information, school/nickname/conference/prestige, “Track program,” “Compare with your club,” costs, dates, “Write to them,” and short fact-based coach tenure/record summaries. Consider globally replacing “Dossier” with “Scouting” only if it does not become confused with purchased player-tendency reports.

### Stats — protect useful definitions; remove duplicate setup

Coverage: no games; all scopes; fielding metrics; list empty states; all leader headings; both fielding explanations.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Stats.tsx:65` | “Leaderboards fill in once the season starts.” | Optional. “No games played” is sufficient by itself; the existing sentence is clear if retained. |
| `:89` | “League leaders, your own club, postseason lines, and the glove work behind them.” | Remove. The scope tabs immediately list these choices. |
| `:107`, `:109` | “GLOVES RANKED”; “THE BAR” | “QUALIFIED FIELDERS”; “MIN. CHANCES.” |
| `:120` | “Nothing has been hit at anybody yet.” | “No fielding chances recorded.” The current line is a strained joke for an ordinary empty state. |
| `:123`, `:124` | “Zero is not average”; “+/100 is the outs he made that an average glove would not have, per hundred balls hit at him, errors already deducted. The league sits at [rate].” | Label the metric directly. Put “Extra outs per 100 chances, minus errors” in an info drawer; show “League average: [rate]” beside the value. Keep the interpretation, not the permanent paragraph. |
| `:133` | “STRIKEOUTS” / “SWING AND MISS” | Keep “Strikeouts”; remove the kicker. Called strikeouts are not swings and misses. |
| `:136`, `:137` | Second “Zero is not average” note: “An error is a play nobody made…” | Remove the duplication. Use the same fielding help everywhere; an aphorism is not a definition. |
| `:152` | “Nobody has qualified yet.” | “No qualified players yet.” If useful, give the relevant threshold rather than leaving the player to guess. |

Keep National / My team / Postseason / Fielding, statistical names and numerical rows. The rank and rate explanation is worth keeping as on-demand help because this is a nonstandard metric.

### Standings — replace stale rules, otherwise mostly keep

Coverage: title/intro; table labels and row details; qualification footer; row navigation.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Standings.tsx:43` | “The standings reduced to what changes your next decision. The top six here play the tournament.” | “The top 8 make the conference tournament.” Use the shared rule count. |
| `:78`, `:79` | “The line that matters is sixth”; long field-size/advancement/navigation footer | Delete the footer after fixing the rule above. If the next stage must be explained: “Top 4 tournament finishers advance to regionals.” The national program/conference count adds nothing to this table. |

Keep “[conference] race,” TEAM/CONF/GB, overall record, run difference and tappable teams. A proper GB definition belongs in help, not a permanent paragraph. A visible qualification cutoff would communicate the rule better than repeated prose, but is a design recommendation, not part of this read-only audit.

### Schedule — clear subject, redundant instructions

Coverage: active/completed headings; all matchup/result labels; metrics; next-up state; box-score guidance; box-score sheet labels.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Schedule.tsx:67`, `:68` | “The year, in full” / “The road ahead”; “Every series, result and box score in one season view.” | Use “[year] schedule.” Delete the product-description sentence. “The road ahead” is mildly misleading because this view also includes completed games. |
| `:113` | “SERIES VIEW” / “[year] schedule” | Remove duplicate heading when the page title already says schedule. |
| `:153`, `:154` | “Every played game keeps its book”; “Tap a final to open the full box score — both sides, batting and pitching, with every name in it tappable. A game still to come opens the program you are playing.” | One first-use hint: “Tap a result for the box score, or an opponent to scout them.” Do not repeat on every visit. |

Keep “conference series,” “midweek,” “next up,” W/L, dates, vs/at, score labels, “BOX SCORE,” innings, “Close,” “Away” and “Home.” The game table is already the explanation.

### Rankings — remove invented atmosphere and use honest phase labels

Coverage: projection/regular ranking phases; Top 25/full table; data headers/details; own-team out-of-top25 note; navigation help.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Rankings.tsx:75` | “PRESEASON · PROJECTED” | “EARLY RANKINGS” once games have started; retain “PRESEASON” only before the first game. |
| `:77` | “Form, strength of schedule, and the country's changing baseball temperature.” | Remove. “Baseball temperature” is atmosphere without meaning; it also implies a form component not established by RPI. |
| `:122` | “You are ${mineAt + 1}th” | “Your rank: #[rank].” |
| `:123` | “Nobody remembers the poll” | “Early projection.” The current line tells the player the screen is unimportant. |
| `:125` | “A projection off the rosters, nothing more. Once the games start counting the real table takes over.” | “Based on roster strength and prestige. RPI follows after the opening games.” |
| `:127` | “Outside the twenty five. Switch to the full table to see the company you are keeping.” | “Outside the Top 25. View all teams.” Link the action if possible. |
| `:128` | “Every row opens that program: its roster, its season, and how you have done against it.” | Remove, or first-use “Tap a team to scout them.” Repeated navigation explanations become clutter. |

Keep “Top 25,” “NATIONAL · RPI,” “All [count],” PROGRAM/W-L/RPI, and team ranking rows. Consider “National rankings” over “The country” where the title must stand alone.

### Colleges — light trim

Coverage: directory heading; search placeholder/accessible label; conference filter; counts; results; empty state.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Colleges.tsx:67` | “Search any program in the country and open its complete card — roster, season, and how you have done against it.” | Remove. “College programs,” the search field and conference filter already establish the task. Optional short line: “Find your next rival.” |
| `:101` | “Try another name, or clear the conference filter.” | Keep. This is useful recovery guidance tied to the actual filters. |

Keep “College programs,” “Search programs,” “Conference,” “All,” program/conference counts, and “No program found.” This screen does not need more wit.

### Postseason — preserve excitement; cut exposition and stale rules

Coverage: stage entry; title-game setup; stage/champion cards; every elimination/advancement branch; game/simulation actions; resumed game; navigation rail; current position; next game; bracket/series labels; draw/loading states; trophy headers.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Postseason.tsx:205`, `:206` | “You arrived unbeaten. Win one and it is yours.”; “You came through the losers bracket. You must win this one AND the next.” | “One win from the title.” / “Win twice to take the title.” Check the reset-final state: after the lower-bracket winner has already won one final, only one remains, so copy must derive wins needed rather than only whether this team has a loss. |
| `:222` | Always-leading series line | Use actual lead/tie/trail state; see accuracy table. |
| `:290`, `:292`, `:293` | “Champions of the country”; “Everything this season was for.”; “Somebody else takes it home this year.” | “National champions.” Show a title-specific line only when it adds something beyond the trophy and name. Opponent victory: “[school] wins the national title.” |
| `:301`, `:302`, `:303` | “REGIONAL CHAMPIONS”; “A regional banner”; “On to the national tournament.” | Keep “Regional champions” plus “Next stop: nationals.” Remove the middle restatement. |
| `:310`–`:312` | “[conference] CHAMPIONS”; “Conference champions”; “The league is yours.” | Keep one title and, optionally, “The league is yours.” Three layers repeat one result. |
| `:444` | “Double elimination. Two losses and it is winter.” | “Double elimination. Top 4 advance.” The original is also factually wrong for the conference progression. |
| `:453` | “A third of the league goes home in May.” | Optional flavor, but “[school] finished outside the top [count]” already conveys why the season ended. Delete to avoid rubbing in an ordinary outcome. |
| `:477`, `:478` | “Third in the league”; “Fourth in the league” | “3rd in the conference tournament”; “4th in the conference tournament.” Avoid confusing tournament finish with regular-season standings. |
| `:483`, `:484` | “[school] are out of the [conference] tournament.”; “But the top four travel. A regional championship series is next.” | “Regional berth secured.” / “Finished [place] in the conference tournament.” Lead with what happens next rather than making the player first read “out.” |
| `:493`, `:494` | “[school] fall${where} of the [conference] tournament.”; “Winter is for getting the bats loud again.” | “[school]'s conference tournament run ends [round].” / “Time to build next year's club.” Fix the malformed “fall … of” construction. The season ends in spring; winter is not the immediate next state. |
| `:501`, `:504` | “Protected”; “The regular season already bought the national field. You travel anyway.” | “National berth secured.” / “Your protected bid keeps you in.” Gives the outcome before the reason. |
| `:514` | “One series from the national field. Close enough to sting.” | Fine for a rare elimination beat if it accurately reflects the route. Do not add another consolation paragraph beneath it. |
| `:524` | “Second best in the country, and it still feels like this.” | “National runner-up.” Optional flavor: “One trophy missing.” Do not tell the player how they feel. |
| `:533` | “Sixteen reach the showdown. Most of the country never sees it.” | “Your national tournament run ends here.” Current count is 20. |
| `:544` | “[school] take the [conference]. Gas up the bus.” | Keep. A specific baseball-season transition with one small joke. |
| `:550` | “[school] win the region, and a seat at the national table.” | “[school] wins the regional. Next stop: nationals.” Replace the repeated “seat/table” metaphor. |
| `:555` | “[school] win it all. Nobody left to beat.” | Keep. This is the right amount of celebration. |
| `:580`, `:582`, `:612`, `:615` | “PLAY THIS GAME”; “SIMULATE THIS GAME”; “SIM TO MY NEXT GAME”; “SIM TO THE END OF THE TOURNAMENT” | “Play game”; “Sim game”; “Sim to my next game”; “Sim tournament.” For the last action, preserve its scope in confirmation/help if the button alone is ambiguous. |
| `:639`, `:640`, `:643`, `:653`, `:674`, `:675` | “PLAY THE SHOWDOWN”; “PLAY THE CHAMPIONSHIP”; “CONTINUE”; “LET'S GO”; “ON TO THE REGIONAL”; “SEE THE REST OF IT” | Normalize progression actions around destination: “Open nationals,” “Open championship,” “Next stage,” “View bracket.” Keep “Let's go” for the first genuine tournament entry only if the destination is visibly obvious. |
| `:803`, `:804` | “RUN ENDED”; “STILL ALIVE”; “FIND US” | Keep. Short and contextual. “Find my team” is clearer if the button appears without the nearby team label. |
| `:866`, `:876` | “PICK IT UP”; “LET THEM FINISH” | “Resume game”; “Sim the rest.” Match Today. |
| `:1050` | “Game [n] of [len] · you [wins]-[wins] · first to [clincher]” | “Game [n] · [actual series state].” Put best-of length on the nearby format label once. |
| `:1381`, `:1443` | “The field is being announced.”; “Waiting on the field to be drawn.” | “Drawing the bracket…” if loading. If it is a pre-stage placeholder, “Bracket available after regionals.” A loading sentence should not be used for a state that requires an action. |

Keep stage names, best-of and double-elimination labels, winners/losers bracket labels, national championship title, game counts, seeds, matchups, “Set the lineup,” and “The two bracket champions meet here.” Retain explicit advancement rules even when removing decoration.

### Awards — a little ceremony works; shorten the framing

Coverage: pre-award state; card reveal; coach-of-year descriptions; award/first-team sections; program summary; skip/reveal-all control; next-screen note.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/Awards.tsx:34` | “Nobody got more out of less. The roster said no; the record said yes.” | “Made an underdog look like a contender.” One idea instead of two polished antitheses. |
| `:35` | “The trophy went home to a school that had no business holding it.” | “Brought an unlikely title home.” Avoid sounding as though the winner did not deserve it. |
| `:36` | “The biggest one-year climb in the country, same school, same players.” | “The country's biggest turnaround.” “Same players” is not established by a year-over-year improvement award in a roster-turnover game. |
| `:37` | “Won the league and outscored everybody doing it, start to finish.” | “Won the conference in convincing fashion.” Preserve the more precise statistical claim only if the award criterion actually proves it. |
| `:109` | “Awards are handed out when the regular season is over.” | “Awards arrive after the regular season.” The original is acceptable; this is a minor trim. |
| `:197`, `:215` | “HONOURS” | “HONORS.” Match the US setting. |
| `:231` | “SKIP THE CEREMONY — TURN EVERYTHING” | “Reveal all.” The current wording is long and mechanically obscure. |
| `:235` | “THE WINNERS” / “Who took what” | Use “The winners.” The second title adds little. |
| `:287`, `:288` | “The room is not over”; “Season review is next. Tap any winner or first-team man to read his card before you move on.” | Remove the heading. “Next: season review.” Only show “Tap a player for details” as a first-use hint if needed. |

Keep “Awards night,” “Tap to reveal,” “Coach of the Year,” “All-conference,” “The first team,” award names, winners and program totals. Awards can feel like an occasion without the narrator explaining the occasion.

### Season Review — stop overstating; let the season's actual results carry it

Coverage: result banners for every finish; earned coach badges; record/national/conference summaries; runs/average/ERA; team leaders; seniors/draft/returners; prestige change; continue action. Imported badge lines and `review.message` are covered by the copy-producer audit.

| Location | Current | Recommendation |
|---|---|---|
| `src/ui/screens/SeasonReview.tsx:135` | “[school] win it all. Nothing you do to a program moves it further.” | “[school] wins it all. Hang the banner.” One short earned celebration. |
| `:138`, `:140` | “One game short in Omaha. It counts, and it stings.”; “You made the College World Series. Four teams out of ninety six.” | Fix the incorrect claims first. “National runner-up.” / “You reached the national tournament.” |
| `:144` | “Won the conference tournament and the automatic bid that comes with it.” | “Conference tournament champions.” If the bid matters, specify its destination: regional, not an implied direct national berth. |
| `:157` | “Thirty two programs got that far. Your run ended in yours.” | “Your season ended in the regional series.” The count is currently correct, but the sentence does not need it and the repeated “your/yours” is awkward. |
| `:161` | “Best record in the conference over the games that count for seeding.” | “Finished first in conference play.” |
| `:191` | “THEY HAVE STARTED SAYING” | “NEW REPUTATION,” or use only the earned badge's name. Avoid another anonymous narrator. |
| `:256` | “BY THE NUMBERS” / “Season ledger” | “Season stats.” One heading. |
| `:260` | “RUN DIFFERENCE” | “RUN DIFF.” Match Today, Schedule and Team Card, or use full “Run differential” everywhere. |
| `:268` | “WHO CARRIED IT” / “Season leaders” | Keep “Season leaders.” “Who carried it” is optional once, but the double heading repeats the idea. |
| `:284` | “NEXT FEBRUARY” / “Roster outlook” | “Next year's roster.” |
| `:288`, `:291`, `:292` | “RETURNING”; “No seniors leave automatically.”; “[count] more can hear their name in the draft.” | “ELIGIBLE TO RETURN”; “No graduating seniors”; “[count] underclassmen are draft eligible.” Do not promise those players will return. |
| `:306`, `:308`, `:312` | “WAS” / “THE SEASON” / “NOW” | “Before” / “Change” / “Now.” “The season” is not a precise label for a numeric delta. |

Keep “National champions,” “National runners up” with one globally chosen singular/plural style, record and rank tiles, “TEAM MVP,” “DRAFT WATCH,” “PROGRAM PRESTIGE,” and simple “Continue.”

## Coverage ledger

| File | Disposition |
|---|---|
| `src/ui/screens/Today.tsx` | All local display branches reviewed. Keep most game-day labels; trim waiting, intro, weekly and season-ending narration. Imported `seriesStake` and `FINISH_LABEL` must be covered globally. |
| `src/ui/screens/Manage.tsx` | All local live/empty/final/tool/substitution copy reviewed. Keep live baseball voice. Fix visit limit. Generated play-by-play and tactic tooltip producers are external. |
| `src/ui/screens/Lineup.tsx` | All editor-state and success copy reviewed. Simplify selection language; reduce duplicate headings and persistent help. |
| `src/ui/screens/DepthChart.tsx` | Fit/status scales, unavailable branches, controls and footer reviewed. Fix injury labeling and reconcile auto-cover claims. |
| `src/ui/screens/Roster.tsx` | All filter, empty, label and link text reviewed. Mostly keep. |
| `src/ui/screens/RosterMoves.tsx` | All action areas, disabled/selected variants and notes reviewed. Rewrite status/action prose; keep restrictions explicit. External prognosis/morale producers are separate. |
| `src/ui/screens/Player.tsx` | All tabs, former-player/pro variants, help drawers, empty states and conditional local text reviewed. Highest deletion opportunity. Badge/repertoire/tendency/pro-career producer strings are external. |
| `src/ui/screens/StrategyScreen.tsx` | Every setting description and group, intro and footer reviewed. Keep choices; simplify trade descriptions and delete duplicate footer. |
| `src/ui/screens/Captain.tsx` | All candidate, mood, eligibility, recommendation and action copy reviewed. Shorten; correct unsupported effects. |
| `src/ui/screens/TeamCard.tsx` | All tabs, actions, tracking/scouting/approach states, culture/coach local labels and empty states reviewed. Remove narration and internal implementation explanations. Culture and coach-skill names are external. |
| `src/ui/screens/Stats.tsx` | All scopes, metric headings, notes and empties reviewed. Keep definitions on demand; trim static narration. |
| `src/ui/screens/Standings.tsx` | Entire small screen reviewed. Urgent qualification-rule correction; otherwise largely good. |
| `src/ui/screens/Schedule.tsx` | All schedule/result/box-score local copy reviewed. Keep tables; trim header/footer repetitions. |
| `src/ui/screens/Rankings.tsx` | Both phase branches, scopes, rank notes and table copy reviewed. Correct phase description/ordinal; remove temperature metaphor. |
| `src/ui/screens/Colleges.tsx` | Entire small screen reviewed. Light intro trim; filters and recovery guidance are good. |
| `src/ui/screens/Postseason.tsx` | All local progression, modal, title, knockout, trophy, bracket, loading and command branches reviewed. Several stale/incorrect rules and unconditional state claims; preserve short earned celebration. |
| `src/ui/screens/Awards.tsx` | All ceremony, reveal, summary, fallback and coach award local copy reviewed. Light-to-moderate trim; short celebration remains. |
| `src/ui/screens/SeasonReview.tsx` | All local finish variants, leaders, roster outlook and prestige labels reviewed. Fix field size/runner-up/returning claims; trim rhetoric. External messages are separate. |

## Suggested implementation order

1. Correct qualification, advancement, mound-visit, injury, series-lead, redshirt, rank and draft-return wording.
2. Remove product/implementation commentary and duplicate notes from Player, Team Card, Strategy and Roster Moves. These changes will produce the largest improvement without inventing new prose.
3. Apply one compact naming system to actions and states: Resume game, Sim the rest, Scouting report, Career stats, Grades, Position, Eligibility, National tournament.
4. Rewrite repeated empty states and selected/disabled action text. Every state should answer “what happened?” and, only when needed, “what can I do?”
5. Keep a handful of earned baseball lines and review them together. Avoid repeating the same cadence, metaphor or consolation in adjacent cards.
6. Verify the actual screens at small widths and the conditional states named above. Check that shorter copy still explains costs, deadlines and irreversible consequences. This audit proposes wording; it does not change mechanics or perform source edits.
