# Generated language and authored dialogue audit

Audit date: September 3, 2026. Scope: every TypeScript file in `src/engine` and `src/data`. This is an audit and proposed editorial direction; app source is unchanged. Source references below are repository-relative and refer to the audited working tree.

## Finding

The app has a recognizable voice, but it gives nearly everyone the same voice: an older, unusually literary coach who speaks in verdicts. Reporters, scouts, directors, tooltips, institutional descriptions, and career updates all use “the room,” “the chair,” “the men,” “nobody,” and a second sentence explaining why the first sentence matters. That consistency is what makes the writing feel generated. Much of it is already short; cutting word counts alone will not solve it.

The better direction is a college baseball game with dry humor, specific baseball language, ordinary American speech, and room for characters to sound different. Preserve genuinely good lines. Put the wit in selected headlines, interview answers, and flavor descriptions; make effects, status, and consequences direct.

Highest priorities here:

1. Remove explanatory punchlines and generic life lessons from reports and updates.
2. Rewrite generated claims that the underlying event does not establish. A funny but inaccurate recap breaks trust.
3. Separate speech from UI: coaches can bluff; an effect description should not.
4. Rewrite the recurring template families, not just one screenshot's examples.
5. Make American baseball terminology consistent: program, defense, center field, locker room, fired, two weeks. The scattered British diction makes this particular setting feel imitated.

## Voice by speaker

| Speaker/surface | Intended voice | Good model | Avoid |
|---|---|---|---|
| UI and mechanical effects | Brief, exact, neutral | “Fewer throwing errors.” | “Throws fewer of them away.” |
| Wire reporter | Score first; one dry observation when earned | “Three games. No souvenirs for {loser}.” | Explaining what a rivalry, ranking, or good performance means |
| Athletic director | Direct expectations; school-specific patience | “We need {n} wins and a tournament bid.” | Speaking about the board in the third person when the board is the speaker; omniscient “the room” |
| Scout | Concrete shorthand; qualified judgment | “Polished. Not much room left to grow.” | Invented visits, biography, universal praise, grand predictions |
| Player/recruit | Personal, less polished, concrete wants | “Who's coming back next year?” | A 19-year-old sounding like the obituary writer |
| Coach answer | Distinct playable attitudes | “Me, mostly. Write that down.” | Four equally polished aphorisms in every question |
| Career/hall narrator | Let achievements carry the weight | “Called up to the majors.” | “Everything before this was the road here.” |
| School flavor | Specific place and personality | “Four coaches in fifty years. They liked three of them.” | 96 versions of “Nobody X. Everybody Y.” |

Use contractions in speech. Do not make every character sarcastic. For each four-answer question, a useful mix is one practical answer, one personal answer, one tough answer, and one cocky or funny answer, preserving the existing choice's intent and rewards.

## Complete file coverage

The review inspected parsed string/template literals, excluding comments/import paths/internal enum IDs from the copy inventory, then read relevant generators and conditions. Comments contain a great deal of prose but are not evidence of visible app wording. “Keep” means reviewed and no voice rewrite needed; it does not imply a gameplay or statistical correctness review.

| File | Visible language reviewed | Disposition |
|---|---|---|
| `src/data/interview.ts` | All 80 setups, 80 questions, 320 answers | Keep decision content; revise sentence rhythm, repeated formulas, dated diction, and unclear scenarios. Full scenario coverage below. |
| `src/data/pressers.ts` | All 20 setups, 20 questions, 80 answers | High-priority rewrite; delete unnecessary stage directions, preserve choice attitudes, remove unsupported event facts. All 20 cases below. |
| `src/data/cultures.ts` | All 96 motto/description pairs; 8 culture labels | Keep specific humor, reduce absolute claims and repeated industrial/literary formulas. Full 96-item disposition below. |
| `src/data/badges.ts` | All 21 coach badge names and flavor lines; effect metadata also inspected | Rewrite displayed flavor. Effect metadata is not displayed; see catalog below. |
| `src/data/schools.ts` | School/conference/nickname/location identifiers and all 8 conference blurbs | Names retained; blurbs need more varied cadence. |
| `src/data/names.ts` | Generated name parts | Keep proper names; no prose to rewrite. |
| `src/engine/achievements.ts` | All 10 names, conditions, and generated feat summaries | Mostly keep; shorten conditions and replace “your men”/“country” with explicit labels where needed. |
| `src/engine/badges.ts` | All 23 player badge names/notes; family labels | Keep names; make effects precise, remove ambiguous “them/it” and guarantees. |
| `src/engine/calibration.ts` | Calibration labels and two fixture team names | Developer/simulation output, not the shipped player journey. Keep; do not count as app prose. |
| `src/engine/captains.ts` | Rules and IDs only | No authored visible prose. Captain messages live in callers. |
| `src/engine/depthChart.ts` | Position-fit labels, including “his own” | Keep technical ratings; consider “Natural” for “his own” when it appears alone. |
| `src/engine/doubleElim.ts` | Round/bracket labels | Keep; rename “Championship · the reset” to “Championship · deciding game.” |
| `src/engine/draft.ts` | 4 retention pitch labels, 4 pitch texts, 4 notes, 17 player pull hints | Rewrite explanatory scaffolding and artificial biography; preserve ambiguity of hints and strength of promises. |
| `src/engine/economy.ts` | 3 staff roles/effects, facility labels, money formatting | Keep labels/formatting; rewrite effect descriptions. |
| `src/engine/eligibility.ts` | Rules/state IDs only | No authored visible prose. Eligibility notices live in callers. |
| `src/engine/engines.ts` | Engine IDs/configuration only | No authored visible prose. |
| `src/engine/game.ts` | All play-by-play branches, box-score labels, inning formatting | Mostly excellent functional copy; fix fabricated direction, awkward RBI shorthand, repeated run narration. |
| `src/engine/habits.ts` | Habit IDs/rules only | No authored visible prose. |
| `src/engine/hall.ts` | Award labels and career-stat summaries | Keep; compact and factual. |
| `src/engine/inbox.ts` | 8 category labels; persistence/normalization | Rename opaque “THE BOOK”/“THE HALL”; message bodies are supplied elsewhere. |
| `src/engine/injury.ts` | 7 injury descriptions and 5 duration branches | Keep diagnoses; use American duration wording; keep medical status plain. |
| `src/engine/interviewResult.ts` | Selection/settlement rules only | No authored visible prose; don't mistake extensive comments for app copy. |
| `src/engine/legacy.ts` | Highlight memories and all pro-career outcome branches | Keep baseball achievements; remove mournful editorial endings. |
| `src/engine/liveGame.ts` | All tactical choices, helper text, unavailable reasons, substitution log text | Mostly keep; clarify guarantees and unavailable actions. |
| `src/engine/morale.ts` | Four role expectations | Keep/shorten; lower two are currently vague. |
| `src/engine/pitch.ts` | Pitch resolution IDs | No authored visible prose. |
| `src/engine/pitches.ts` | Pitch names/abbreviations | Keep standard baseball labels. |
| `src/engine/pitchModel.ts` | Count formatter | Keep. |
| `src/engine/players.ts` | Names; internal invariant errors | Proper names retained; no app narrative. |
| `src/engine/portal.ts` | Three departure-reason branches | Shorten; preserve whether a promise was broken. |
| `src/engine/positions.ts` | Position-fit labels | Keep; “out of his depth” → “Poor fit” if this is a functional fit indicator. |
| `src/engine/postseason.ts` | Round names, finish descriptions, awards, award citation templates | Mostly keep; clarify abstract reputation and unsupported “wire to wire.” |
| `src/engine/press.ts` | Trigger/settlement rules only | No authored visible prose; important constraint on presser claims. |
| `src/engine/program.ts` | Job reach, goals, board briefs/outcomes, skill effects, reputation, offers | High-priority rewrite; vague institutions and chair metaphors recur here. |
| `src/engine/progression.ts` | Progression/departure rules/IDs only | No authored visible prose; notices live in callers. |
| `src/engine/ratings.ts` | Ratings/IDs and internal invariant errors | Keep; no narrative pool. |
| `src/engine/records.ts` | Record category labels, reference notes, generated record lines | Keep factual labels, reduce editorial note; verify provenance separately before changing source claims. |
| `src/engine/recruiting.ts` | 5 priority labels/descriptions, 37 ceiling hints, 16 development hints | High-priority pool rewrite; preserve scouting uncertainty. |
| `src/engine/redshirt.ts` | Rules/IDs only | No authored visible prose. |
| `src/engine/rivals.ts` | Career record summaries, “no head coaching record” | Keep, “First head coaching job” where the context permits. |
| `src/engine/rng.ts` | Randomness implementation | No copy. |
| `src/engine/scouting.ts` | Standard stat labels and formatted values | Keep. Scouting prose is in recruiting, not this module. |
| `src/engine/season.ts` | Series labels, stats/record formatting, internal errors | Keep labels and statistical notation; avoid counting IDs as copy. |
| `src/engine/strategy.ts` | Four strategy descriptions and names | Shorten, retain each tradeoff. |
| `src/engine/tendencies.ts` | All 9 paired tendencies: 18 labels/descriptions | Keep characteristic names; replace vague prose with explicit upside/downside. |
| `src/engine/traits.ts` | Rule composition only | No copy. |
| `src/engine/types.ts` | Types and internal exhaustive-match error | No product narrative. |
| `src/engine/wire.ts` | All result, sweep, streak, ranking, race, transfer, record and leader variants | Highest-priority generated prose rewrite; see each family below. |
| `src/engine/workload.ts` | Rules/IDs only | No copy. |
| `src/engine/world.ts` | Four series-stakes branches | Light trim; otherwise keep. |

## Wire: every story family

Each row covers the named generator family including its alternate headlines. `{...}` in proposed copy means the existing value, not new data. Original column quotes exact source text or exact source fragments; `${...}` retains source-template syntax.

| Source | Current wording | Finding and proposed wording |
|---|---|---|
| `src/engine/wire.ts:125` | `The rivalry goes to ${name(winner)}, ${hi}-${lo}` | Keep factual lead. Alternate at 126 “own the argument for a year” overclaims annual rights from one game. Use “{winner} gets the last word, {hi}-{lo}” only as game-specific flavor. 127 “Bragging rights” is usable. |
| `src/engine/wire.ts:129` | `${wDef.school} and ${lDef.school} have played this game for ` + `longer than anybody can defend, and tonight it belonged to ` + `${wDef.nickname}.` | Forced joke plus unsupported history. Delete body, or “{winner} takes this round.” Do not invent rivalry age. |
| `src/engine/wire.ts:141` | `${abbr(winner)} stuns #${rpiRank.get(loser)} ${name(loser)}, ${hi}-${lo}` | Keep; 142 “go down at the hands of” → “falls to”; 143 “topple” works. For unranked variants 146–148, keep “takes down,” simplify “pull one off” to “upsets.” Use consistent singular grammar for school names and plural grammar for mascot names. |
| `src/engine/wire.ts:156` | `A win nobody priced: ${name(winner)} came in at ${recordOf(winner)}, ` + `and ${name(loser)} at ${recordOf(loser)} were the better side on paper.` | Betting idiom plus awkward explanation. “{winner} is now {record}; {loser} falls to {record}.” `recordOf` reads current records, so “came in at” is also wrong unless pregame records are passed. |
| `src/engine/wire.ts:168` | `${name(winner)} runs ${name(loser)} out of the yard, ${hi}-${lo}` | Keep as one colorful variant. 169 “bury … under … runs” and 170 “No contest” are also usable; punctuation/grammar cleanup only. |
| `src/engine/wire.ts:172` | `${hi} runs, ${an(margin)} ${margin}-run margin, and it was decided early.` | Final score does not establish when the game was decided. “{winner} wins by {margin}.” Prefer delete if headline already tells the score. |
| `src/engine/wire.ts:183` | `${name(winner)} outlast ${name(loser)} in ${g.innings}, ${hi}-${lo}` | Keep. At 184, `${g.innings} innings, one run` implies a one-run margin that the extras condition does not necessarily establish. Use “{innings} innings later: {winner} {hi}, {loser} {lo}.” 185 “win the staring contest” is a usable rare alternate. |
| `src/engine/wire.ts:187` | `Neither side led by more than a run when it mattered; ` | Game summary does not establish lead history. Delete. Keep 188's current-record fact as “{winner} improves to {record}.” |
| `src/engine/wire.ts:218` | `${name(first)} sweep ${name(other)}` | Keep all three sweep headlines. 222 “Three games, three wins — … stand at …” → “{winner} is now {record}.” Scoreboard tells the sweep; body can add record. |
| `src/engine/wire.ts:233` | `${name(t.index)} has won ${t.streak} straight` | Keep 233–237's factual streak variants. If # rank is specifically RPI, 238 “in the country” should be “in RPI” so it is not mistaken for a poll. |
| `src/engine/wire.ts:244` | `${name(t.index)} has dropped ${-t.streak} in a row` | Keep lead. 245 “The bottom keeps falling” → “{n} straight losses for {team}”; 246 “cannot find a win” is okay. 248 “the schedule is not getting kinder” is unsupported; use “{team} falls to {record}.” |
| `src/engine/wire.ts:259` | `${name(one.team.index)} holds the top RPI at ${one.team.w}-${one.team.l}` | “{team} leads the RPI at {W}-{L}.” Delete 260, `The country's best résumé by the numbers the committee reads.` It simply re-explains RPI with overconfidence. |
| `src/engine/wire.ts:277` | `${t.conference} is a coin flip: ${abbr(first.index)} and ${abbr(second.index)} are level` | Condition is close records, not guaranteed identical standings. “{conference} race tightens: {first} {cw}-{cl}, {second} {cw}-{cl}.” At 279, delete “every series now counts double,” which sounds like an actual scoring rule. |
| `src/engine/wire.ts:386` | `${r.school} are a ${r.to} program now` | “{school} joins {to}.” 387–388 → “{school} moves up from {from}; {downSchool} goes the other way.” Delete “Both leagues read differently for it.” |
| `src/engine/wire.ts:397` | `${st.school} lose their ${st.seat.toLowerCase()} to a head job` | “{name} leaves {school} for a head coaching job.” 398–399 → “{school} needs a new {seat}.” Delete “The seat behind the seat is open.” |
| `src/engine/wire.ts:434` | `${who} is chasing the book: ${value} ${word}, ${45 - gp} games left` | “{who} eyes the {word} record: {value}, {games} games left.” 435–436 → “Record: {record}, set by {holder} in {year}. Current pace: {pace}.” Do not imply a guaranteed finish. |
| `src/engine/wire.ts:488` | `${best.name} is hitting ${printed}` | Keep headline. 490 `Nobody with a qualified season is close` is not checked against second place. “Leads qualified hitters at {AVG}.” Optional actual HR/SB facts remain. |
| `src/engine/wire.ts:525` | `${hr.name} leads the country with ${hr.n} home runs` | Keep. 526 `The ${abbr(hr.team)} bat nobody wants to pitch to.` is generic and states opponents' minds. Delete or keep very rarely as obvious sports hyperbole. |
| `src/engine/wire.ts:532` | `${arm.name}'s ${arm.era.toFixed(2)} ERA is the best qualified mark going` | “{name} leads qualified pitchers with a {ERA} ERA.” 533 → “{K} strikeouts for {school}.” “hitters are running out of ideas” can be one optional playful variant, not standard filler. |
| `src/engine/wire.ts:562` | `${l.name} strikes out ${k}` | Keep. 563 `${l.line} — the kind of night a scout circles twice.` → just `{pitching line}`. The actual numbers are already the story. |

These are language safeguards, not a proposal to change simulation results. Prefer wording that fits the data already supplied rather than adding new rules just to support an embellished sentence.

## Recruiting: all 53 report lines

Priority labels at `src/engine/recruiting.ts:59`: “THE NAME” → “PROGRAM REPUTATION”; “PLAYING TIME,” “WINNING NOW,” “CLOSE TO HOME,” and “DEVELOPMENT” can stay. Descriptions at 67–71: “wants a respected program”; “wants to play as a freshman”; “wants a tournament run now”; “wants to stay near home”; “wants help reaching the draft.” The current “wants a coach who will make him a draft pick” is too certain.

The table is complete for `CEILING_LINES` and `DEVELOPMENT_LINES`. Proposed lines must retain the current overlapping `from`/`to` eligibility ranges. Do not make a hint uniquely identify a hidden grade, change the scouting game's uncertainty, or claim a current skill from a ceiling grade alone. Some low-ceiling lines already infer polish from potential; use them as judgments about future growth, not precise current-ability claims.

| Line | Exact current line | Proposal |
|---|---|---|
| 726 | He is close to the player he is going to be. | “Not expecting a big leap.” |
| 727 | Polished for his age. Whether there is any more is the question. | “May not have much more to give.” |
| 728 | Nobody came back from seeing him with a story to tell. | “Didn't stand out.” |
| 729 | Our area man likes him more than the rankings do. | “Our scout likes him.” Avoid unsupported relation to visible rank. |
| 730 | There is no one loud thing about him. He just plays. | “No standout tool.” Check this against actual ratings before keeping a tool claim; otherwise “A modest projection.” |
| 731 | He is going to have to earn every inch of it. | “No easy projection here.” |
| 732 | He would have to develop, but the frame is there. | “Something to work with.” Avoid physical claim not represented by the grade. |
| 733 | He plays hard, and that travels. | Keep as rare flavor only if effort is supported; otherwise “Worth another look.” |
| 734 | Two years of good coaching and we would know a lot more. | “Let's see what coaching does.” |
| 735 | The body is going to change. What happens after that, nobody can say. | “Too early to call.” |
| 736 | Nobody has watched him enough to be confident either way. | “Need another look.” |
| 737 | Coaches in the area think he can play at this level. | “Could play at this level.” |
| 738 | Late to the sport. Nobody is sure where his line goes. | “Hard to project.” Remove untracked biography. |
| 739 | The raw material is better than the results so far. | “Could outgrow the stat line.” |
| 740 | There is more here than the numbers say. | “More upside than the numbers suggest.” |
| 741 | He has a tool you could build something around. | “Enough here to build on.” |
| 742 | Every list has him somewhere. No two of them agree where. | “A tough one to rank.” |
| 743 | He would not be the first out of that county to surprise people. | “Could surprise people.” |
| 744 | Our man wrote 'interesting' and underlined it twice. | Keep. One specific, funny scout line works; do not repeat the underlining gag in wire recaps. |
| 745 | He is a better athlete than he is a baseball player, for now. | “Still figuring out the baseball part.” Only if rawness supports it; otherwise “Room to surprise us.” |
| 746 | Scouts keep finding reasons to go back and see him again. | “Worth the return trip.” |
| 747 | He has been the best player on every field he has been on. | “Easy to notice.” No invented career superlative. |
| 748 | Two programs offered him after one look. | “Wouldn't wait long to make an offer.” No fictional recruiting events. |
| 749 | The staff argued about him for an hour and got nowhere. | “Split the scouting room.” Keep the idea, cut invented stopwatch. |
| 750 | He does not look like a high school player out there. | “Looks beyond his years.” Ensure not used for a transfer if pool is reused. |
| 751 | If it ever comes together we will be glad we were early. | “If it clicks, we'll want him here.” |
| 752 | The upside is the reason he is on this list at all. | “The upside makes the case.” |
| 753 | Our cross-checker moved a trip to go and see him. | “Get the cross-checker out there.” Avoid invented action. |
| 754 | People who saw him in the summer have not stopped talking about it. | “A name worth remembering.” |
| 755 | There are people who believe he is the best in the state. | “Could be one of the best in the state.” Keep as scout opinion, not an actual rank. |
| 756 | There is talk he will be drafted out of high school. | “Pro upside.” Do not promise a separate draft event. |
| 757 | Every program in the country has been through his gym. | “Worth recruiting hard.” Baseball gym imagery and universal visits both feel wrong here. |
| 758 | The area men have run out of comparisons. | “Hard to find a ceiling.” |
| 759 | Nobody on this staff wants to be the one who passed. | Keep: “Nobody wants to be the scout who passed.” |
| 760 | People stop what they are doing to watch him. | “Stops a scouting conversation.” Optional flavor, not another ubiquitous superlative. |
| 761 | He has a chance to be something, and the room knows it. | “Big upside.” |
| 762 | Three head coaches have already been to his house. | “Send the head coach.” No invented visits. |
| 801 | There is not much left to teach him. | “Close to his finished game.” |
| 802 | He is as far along as anybody in this class. | “Well along in his development.” No unchecked class-wide claim. |
| 803 | Physically he is already where he needs to be. | “Not much development left.” Physical maturity is not the input. |
| 804 | What he does, he does properly. | “Most of the growth is behind him.” |
| 805 | He is closer to ready than most of the names around him. | “Close to his ceiling.” Does not promise starting ability. |
| 806 | He has things to clean up, the way they all do at that age. | “Still some cleanup work.” |
| 807 | The mechanics are ordinary. Nothing about them is broken. | “Some room to improve.” Mechanics are not assessed here. |
| 808 | There is honest work left in him, and a year to do it. | “Still room to grow.” No guaranteed timeline. |
| 809 | A winter in a weight room would tell you a lot. | “Development could change the picture.” |
| 810 | The best of him only shows up in flashes. | Keep: “Shows it in flashes.” |
| 811 | The distance between his good days and his bad ones is the story. | “Still putting it together.” |
| 812 | He is some way from the finished article. | “A long way from finished.” |
| 813 | Everything about him is still in front of him. | “Plenty of growth ahead.” |
| 814 | Right now he is an athlete playing baseball. | “Still learning his game.” |
| 815 | Whoever takes him is taking a project. | “A development project.” |
| 816 | He would need time before he helped anybody. | “Needs time to reach his ceiling.” Avoid equating rawness with inability to contribute now. |

## Draft: all pitches and hints

| Source | Exact current wording | Proposed wording |
|---|---|---|
| `src/engine/draft.ts:257` | Come back for a year and go higher than this. | “One more year. Let's improve your draft position.” Keep as a pitch, not an assurance of outcome. |
| 258 | The job is yours in the spring. No competition for it. | “Come back and the job is yours.” This is a strong role promise; don't weaken its meaning. |
| 259 | Stay and we win something before you leave. | “Come back. Let's win something.” |
| 260 | Stay for me, and for this place. You have my word. | “Stay with us. You have my word.” |
| 272 | Rests on how much of him is still to come, and on your TRAINING. | “Stronger with more growth potential and better Training.” |
| 273 | Rests on your depth chart at his spot. He can read it too. | “Stronger when his position is open.” Optional flavor: “He's seen the depth chart.” Use the actual credibility rule for final specificity. |
| 274 | Rests on the program’s standing and on who is coming back. | “Stronger with a respected program and a strong returning roster.” |
| 275 | Rests on your own name and how long you have sat in this chair. | “Stronger with coach reputation and time at this school.” |
| 465 | He asked, twice, whether you thought he could go higher. | “Think I could go higher next year?” |
| 466 | He wants a coach who will not let him stay the same. | “I still want to get better.” |
| 467 | He asked what you did with the last man who was where he is. | “How have guys like me done here?” |
| 468 | He is asking who else you are bringing in at his position. | “Who else are you bringing in at my position?” |
| 469 | He wants the ball, and he has not been shy about saying so. | “I want a bigger role.” Avoid ball/innings language if used for a hitter. |
| 470 | He asked what the depth chart looks like in April. | “What's the lineup looking like next spring?” Or role-neutral “Who's coming back next spring?” |
| 471 | He has sat behind somebody for three years and he is done with it. | “I don't want to sit.” Remove unsupported history. |
| 472 | He talked about June more than he talked about money. | “I want a shot in June.” |
| 473 | He wants to leave here having won something. | “I'd like to leave with a trophy.” |
| 474 | He asked who else is coming back next spring. | “Who's coming back next spring?” |
| 475 | He keeps coming back to what this place would look like on a résumé. | “I want a program people know.” |
| 476 | He wants to be somewhere people have heard of. | “I want to play somewhere that gets noticed.” |
| 477 | He is weighing the badge on the front of the shirt. | “What would playing here do for me?” Preserve the shared prestige/development signal. |
| 478 | His father drove four hours to sit in on the meeting. | “I'd like my family close.” |
| 479 | He has never lived more than an hour from that house. | “Being near home matters.” |
| 480 | He mentioned his mother twice in ten minutes. | “My family has an opinion on this, too.” Preserve the existing ambiguous proximity/prestige pool. |
| 481 | He wants a reason to stay that is not money. | “Give me a reason besides the money.” |

Changing narrator reports into quotes requires the presentation to clearly label them as player dialogue. If that is undesirable, use the same plain sentences in third person. Preserve `of` overlaps, deterministic selection, unlabeled order, and the number of clues; don't expose the correct negotiation choice.

## Functional copy: exact effects over attitude

| Source | Current | Proposal |
|---|---|---|
| `src/engine/economy.ts:75` | Stacks on your defense. Balls in play against you die a little more often. | “Improves your defense on balls in play.” |
| `src/engine/economy.ts:76` | Stacks on your offense. Your hitters take slightly better at-bats. | “Gives your hitters a small offensive boost.” |
| `src/engine/economy.ts:77` | Every hour on a recruit counts for more, and your reports run tighter. | “Improves recruiting and scouting accuracy.” |
| `src/engine/economy.ts:212` | What the school gave you | “Basic facilities.” Other three facility labels can stay. |
| `src/engine/program.ts:945` | Your hitters take slightly better at-bats, every game. | “Improves hitting.” |
| `src/engine/program.ts:946` | Balls in play against you become outs a little more often. | “Turns more balls in play into outs.” |
| `src/engine/program.ts:947` | Your returning players develop further between seasons. | “Improves offseason development.” |
| `src/engine/program.ts:951` | Every hour on a recruit counts for more, and your scouting reports run tighter. | “Improves recruiting and scouting accuracy.” |
| `src/engine/morale.ts:86` | expects to start | Keep. |
| `src/engine/morale.ts:87` | expects to play a good deal | “expects regular playing time” |
| `src/engine/morale.ts:88` | expects to be in the mix | “expects some playing time” |
| `src/engine/morale.ts:89` | is here to earn it | “has low playing-time expectations” in a mechanical row; flavor alone can stay elsewhere. |
| `src/engine/portal.ts:120` | He was told he would play. | “His playing-time promise wasn't met.” |
| `src/engine/portal.ts:121` | He was not happy here. | “Unhappy with his role.” Only if the reason covers role; otherwise “Unhappy here.” |
| `src/engine/portal.ts:122` | He wants a fresh start. | “Wants a fresh start.” |
| `src/engine/injury.ts:172` | out a fortnight or so | “out about two weeks” |
| `src/engine/injury.ts:170` | out for the season | Keep all other duration branches and diagnoses. No jokes needed in injury status. |
| `src/engine/inbox.ts:84` | THE BOARD / AN OFFER / THE DRAFT / THE CAROUSEL / THE HALL / THE BOOK / THE SEASON | “BOARD / JOB OFFER / DRAFT / COACHING CHANGES / HALL OF FAME / RECORD / SEASON.” ACHIEVEMENT can stay. |
| `src/engine/doubleElim.ts:233` | Championship · the reset | “Championship · deciding game.” Also appears at 389. |
| `src/engine/world.ts:158` | A win takes the series. | Keep, along with “The decider.” and “The salvage game.” At 160, “The sweep is on the table.” → “A win completes the sweep.” |
| `src/engine/strategy.ts:201` | His teams run, bunt and take the extra base, and get thrown out doing it. | “Runs, bunts, and extra bases—with more outs on the bases.” |
| `src/engine/strategy.ts:210` | Nobody runs into an out. He waits for the three-run inning and wears the quiet nights. | “Waits for the big inning. Fewer risks on the bases.” Avoid absolute “nobody.” |
| `src/engine/strategy.ts:219` | Fresh arms and a shifted infield. A one-run lead he expects to hold, on a tired bullpen. | “Uses fresh arms and defensive shifts. Leans heavily on the bullpen.” |
| `src/engine/strategy.ts:230` | No strong lean. Takes what the game offers and decides the rest one night at a time. | “Adjusts to the matchup.” |

### All 23 player badge notes

Keep the badge names: their personality is useful, their effects need not perform it again. Below are exact current notes from `src/engine/badges.ts`.

| Line | Current | Proposal |
|---|---|---|
| 140 | Better with a runner in scoring position | Keep. |
| 149 | Better from the seventh on with the game inside two runs | “Hits better from the 7th inning in games within two runs.” Confirm the exact inclusive score-gap threshold before wording the final number. |
| 155 | Better leading off an inning | Keep. |
| 166 | Harder to hit with men on base | “Harder to hit with runners on.” |
| 175 | Harder to hit protecting a lead of three or fewer from the eighth | “Harder to hit from the 8th while protecting a lead of 1–3 runs.” |
| 181 | Holds up the third time through an order | “More effective the third time through the order.” |
| 190 | Takes the extra base on a hit more often | Keep. |
| 196 | Steals a higher share of the bases he goes for | “Higher stolen-base success rate.” |
| 202 | Hits more home runs | Keep. |
| 208 | Runners take fewer chances on him, and behind the plate he throws them out | “Discourages extra bases; improves caught-stealing odds at catcher.” |
| 214 | Loses less off his stuff past his pitch count | “Loses less effectiveness past his pitch limit.” |
| 220 | Strikes out more of them | “Gets more strikeouts.” |
| 228 | Strikes out less often | Keep. |
| 238 | Boots fewer of the balls he gets to | “Fewer fielding errors.” |
| 244 | Throws fewer of them away | “Fewer throwing errors.” |
| 250 | Walks fewer of them | “Issues fewer walks.” |
| 256 | Keeps more of it on the ground, and out of the seats | “More ground balls. Fewer home runs allowed.” |
| 262 | The staff walks fewer men with him behind the plate | “Pitchers issue fewer walks with him catching.” |
| 270 | Develops faster between seasons | Keep. |
| 276 | Harder to hit with two out and men on | “Harder to hit with two outs and runners on.” |
| 282 | Better the third time he faces a pitcher in a game | Keep. |
| 288 | Better in a bracket game | “More effective in tournament games.” |
| 308 | Wears one, and gets pitched around rather than pitched inside | “Draws more walks and hit-by-pitches.” |

### All 18 tendency descriptions

Source: `src/engine/tendencies.ts`. Preserve both poles and their tradeoffs; do not upgrade a probabilistic behavior to “always” or “never.”

| Line | Exact current description | Proposal |
|---|---|---|
| 99 | Ambushes anything near the zone. Fewer walks, more damage when he connects | “Fewer walks, harder contact.” |
| 100 | Makes him throw it. More walks, and he gives up something on contact | “More walks, weaker contact.” |
| 106 | Swings at the first good one. Short at-bats, and a starter he lets off the hook | “Swings early. Shorter at-bats.” |
| 107 | Never offers at the first pitch. Long at-bats that run a pitch count up | “Takes the first pitch. Longer at-bats.” Use “more often” if implementation permits first-pitch swings. |
| 113 | Goes on his own. More bases taken and more outs on the paths | “Takes more bases—and more risks.” |
| 114 | Takes the base he is given and no more. Never runs into a throw | “Fewer attempts at the extra base.” |
| 120 | Everything to his side of the diamond. A shift is aimed at him | “Pulls the ball. Vulnerable to the shift.” |
| 121 | Hits it where it is pitched. A shift against him is a gift | “Uses the whole field. Handles the shift better.” |
| 127 | A different hitter with a man in scoring position, and an ordinary one otherwise | “Hits better with runners in scoring position; gives some back otherwise.” |
| 128 | Presses when it matters. His numbers come with the bases empty | “Hits worse with runners in scoring position; better otherwise.” |
| 134 | Comes right at them. Few walks, and the ball leaves the yard sometimes | “Fewer walks, more home runs allowed.” |
| 135 | Lives off the plate. Hard to square up, and he walks the park | “Harder contact is rarer. Walks are not.” Or neutral “Softer contact, more walks.” |
| 141 | Gets the ball and throws it. Goes deep, and shows a lineup the same look sooner | “Fewer pitches per batter; weaker on the third trip through.” Verify the actual pace interpretation before finalizing. |
| 142 | Takes his time. Burns through a pitch count, and wears better the third time round | “More pitches per batter; stronger on the third trip through.” |
| 148 | Fastball first, second and third. Strikeouts, and the odd one a long way | “More strikeouts, more home runs allowed.” |
| 149 | Spins and slows it. Ground balls and soft contact, and fewer swings and misses | “Softer contact and ground balls; fewer strikeouts.” |
| 155 | Finds another gear with men in scoring position, and coasts when nobody is on | “Stronger with runners in scoring position; weaker otherwise.” |
| 156 | Unravels once they are on. His good innings are the quiet ones | “Weaker with runners in scoring position; stronger otherwise.” |

## Board, jobs, goals, and reputation

The goal labels in `program.ts:449–527` are mostly clear. Keep the explicit numerical targets. “Win {n}, ahead of schedule” → “Win {n} games”; “Reach the national showdown” needs the same final-round term used by the bracket screen. “Conference cellar” is a good occasional sports phrase, but goals can just say “Avoid last place.”

| Source | Exact current wording | Proposal |
|---|---|---|
| `src/engine/program.ts:104` | Out of reach. They hire proven names, and nobody knows yours yet. | “Build your reputation before applying here.” |
| 106 | They want a coach with a record. Win somewhere smaller first. | “They want a proven head coach.” |
| 107 | Close. One good season somewhere and they would take the call. | “You're close to their usual hiring range.” Do not promise exactly one season. |
| 656 | `Win the conference and go deep. ${targetWins} wins on the way there.` | “Target: {n} wins, a conference title, and a deep tournament run.” Preserve which parts are actual goals versus broad board flavor. |
| 657 | `Top three, and push on into June. ${targetWins} wins is the floor.` | “Target: {n} wins, top three in the conference, and a tournament run.” |
| 658 | `A winning season, and push for a bid. The board wants ${targetWins}.` | “Target: {n} wins and a shot at a tournament bid.” |
| 659 | `Stay respectable while you reload. ${targetWins} wins keeps the room calm.` | “Target: {n} wins while you rebuild.” |
| 660 | `Bring players on. ${targetWins} wins would be real progress.` | “Develop the roster. Aim for {n} wins.” |
| 664 | Anything short of a deep run will be read as a wasted year. | “They expect a deep tournament run.” |
| 665 | They expect to be playing in June, not watching. | Keep as one pointed AD line. |
| 666 | Nobody is demanding a title. They do want to stop being an easy game. | “Make them work for the win.” Use a plainer “They want a competitive team” if shown as instruction. |
| 667 | They understand the roster. Their patience is not unlimited. | “You have time to rebuild, but they expect progress.” |
| 668 | Freshmen improving matters more here than the final record. | “Player development comes first.” |
| 1463 | Has not coached a game. | “First season ahead.” |
| 1464 | Early. Nothing has been decided yet. | “Still building a résumé.” |
| 1465 | A long time in the job, and nothing yet that settles it. | “A long career. Still chasing the big one.” |
| 1466 | Four programmes and counting. Somebody always needs a coach. | “Four programs and counting.” Keep the dry humor by leaving it alone. |
| 1467 | Takes the jobs nobody else will, and has done it twice. | “A repeat rebuild specialist.” |
| 1468 | Has been at one place long enough that the place is partly his. | “Part of the furniture at this school.” Occasional flavor; the tenure number should remain visible. |
| 1469 | Left a programme considerably better than he found it. | “Left the program stronger.” |
| 1470 | Keeps reaching June. Has never won it, and is thought of well anyway. | “A regular in June. Still chasing a title.” |
| 1471 | Has been close enough to touch it more than once. | “More than one near miss.” Rename “Nearly man” to “Always close” or “Contender,” depending on tier intent. |
| 1472 | Three regional banners. The last game is the only one left. | “Three regional titles. Still chasing the national title.” |
| 1473 | Won the country. | “National champion.” |
| 1474 | Won it three times. People plan around him. | “Three national titles. Everybody has the date circled.” Only as flavor; no fake schedule event. |
| 1475 | Three titles and a career long enough that nobody remembers the start. | “Three titles. A career for the record book.” |
| 1809 | ` ${badRun === 2 ? 'Twice in a row now' : `${badRun} years running`}, and it is being noticed outside this room.` | “That's {n} disappointing seasons in a row.” Keep exact basis of `badRun`; avoid vague outside reaction. |
| 1813 | The board has seen enough. You are relieved of your duties. | “The board has fired you.” Or notice title “You're out.” with body “Your contract has been terminated.” Be direct about actual outcome. |
| 1815 | Your contract expires and the board has chosen not to renew it. | “The board won't renew your contract.” |
| 1817 | `The board is delighted and has torn up your deal — ${coach.contractLength} more years.` | “Contract renewed for {n} years.” “Torn up” can sound like cancellation. |
| 1819 | The board is delighted. Nobody expected this. | “You've exceeded the board's expectations.” |
| 1821 | The board is satisfied. Do it again. | Keep; one direct, terse instruction works. |
| 1823 | `The board expected more. ${contractYears} year${contractYears === 1 ? '' : 's'} left to convince them.${run}` | “Below expectations. {n} year(s) left on your contract.{run}” |
| 1824 | `The board is not happy. Your seat is warm.${run}` | “Your job is at risk.{run}” A “Hot seat” status label can carry the idiom. |
| 1905 | A step up. They think you are ready. | Keep, with “you're.” |
| 1907 | A job at your level, with a board that will be patient. | “A familiar level, with time to build.” |
| 1908 | A rebuild. They will give you time because nobody else wants it. | “A rebuild. The empty trophy case comes with some patience.” Optional flavor; retain actual expectations elsewhere. |
| 2067 | They have a chair and they would like it filled. | “They're hiring.” |
| 2072 | They think you will build what they have rather than replace it. | “They like your player-development approach.” |
| 2073 | They heard what you said about arms and liked it. | “They want a pitching-first coach.” |
| 2074 | They want somebody who counts outs, and you sounded like one. | “They like your focus on defense.” |
| 2075 | They are not interested in a two-one win and neither, they think, are you. | “They want offense. You sound like a fit.” |
| 2076 | They are looking for somebody who intends to stay. | “They want a coach who'll stay.” |
| 2077 | They want a closer, and they think that is what you are. | “They like your recruiting pitch.” “Closer” otherwise sounds like a pitcher. |
| 2078 | They want somebody who will treat the place the way it expects. | “They value tradition.” |
| 2079 | They are in a hurry, and so, apparently, are you. | “They want to win now. So do you.” |
| 2083 | They are not in a rush, and they will tell you so twice. | “They'll give you time to build.” |
| 2084 | They expect a great deal and are not embarrassed about it. | “The expectations are high.” |
| 2085 | Nobody established will take this, which is your opening. | “A tough job, and a chance to get started.” |
| 2086 | They have a chair and they think you might do. | “They're interested.” |

## Play-by-play, legacy, records, awards

| Source | Exact current wording | Finding and proposal |
|---|---|---|
| `src/engine/game.ts:684` | `[intentional] ${batter.name} is walked on purpose.` | “{batter} is intentionally walked.” |
| `src/engine/game.ts:921` | `${cnt} ${batter.name} singles${scored.length ? `, ${scored.length} in` : ''}. (${hand})` | Keep action; “, {n} run(s) score” reads naturally. Same change for doubles at 926. |
| `src/engine/game.ts:936` | `${cnt} ${batter.name} HOMERS to deep left${scored.length > 1 ? `, ${scored.length} run shot` : ''}. (${hand})` | Every homer says deep left. Use “{batter} homers!” unless direction is actually recorded; append “A {n}-run shot.” Directional accuracy matters more than manufacturing extra variety. |
| `src/engine/game.ts:1706` | lifts a sacrifice fly, run scores. | “hits a sacrifice fly.” The separate runner-scored line already reports the run. Review equivalent doubled narration at 1719. |
| `src/engine/game.ts:1800` | bunts the lead runner into a force out. | “bunts; the lead runner is forced out.” |
| `src/engine/game.ts:1935` | `   ${runner.name} steals ${word}.` | Keep, as with strikeouts, outs, errors, substitutions and box-score labels. Not every routine play needs a punchline. |
| `src/engine/liveGame.ts:158` | a ball in the air brings him home | “try for a sacrifice fly” or “look for a ball he can tag on.” Existing helper sounds guaranteed. |
| `src/engine/liveGame.ts:159` | shorten up; he scores on a base hit | “shorten up and try to drive him in” |
| `src/engine/liveGame.ts:191` | only home is left, and nobody steals home | “Stealing home isn't available.” This is a game restriction, not a baseball fact. |
| `src/engine/liveGame.ts:200` | sink it, get two | “look for a ground ball.” The helper also appears when a double play is not assured. |
| `src/engine/legacy.ts:111` | `A no-hitter against ${meta.vs}. Nine innings, nobody hit.` | “A nine-inning no-hitter against {opponent}.” |
| `src/engine/legacy.ts:175` | Signed on with an independent club for a summer, then hung them up. | “One summer in independent ball, then retirement.” |
| `src/engine/legacy.ts:176` | The baseball ended in June. The degree did not. | “Finished his college career.” Do not imply graduation unless known. |
| `src/engine/legacy.ts:197` | Released in the spring. It ends that quickly for most. | “Released in the spring.” Delete commentary on everyone else's careers. |
| `src/engine/legacy.ts:198` | `Released after ${age} seasons. Further than most ever get.` | “Released after {n} seasons.” |
| `src/engine/legacy.ts:210` | Called up. Everything before this was the road here. | “Called up to the majors.” This is already a big moment. |
| `src/engine/legacy.ts:219` | An All-Star summer. The kind of year a program frames. | “Named an All-Star.” |
| `src/engine/legacy.ts:211` | `Moved up to ${LEVELS[level]!.toLowerCase().replace('-a', '-A')}.` | Keep promotion facts and 221–222 season-at-level branches. Preserve existing capitalization of A/AA/AAA rather than over-styling. |
| `src/engine/legacy.ts:96` | `Went ${l.h} for ${l.ab} against ${meta.vs}.` | Keep all specific game memories at 96–117; they work because they say what happened. |
| `src/engine/records.ts:118` | A 45-game season cannot hold 58. This one is here to be admired. | “Historical reference: 58 games; above the regular-season schedule length.” Check how postseason games count before saying impossible. |
| `src/engine/records.ts:333` | real mark 48 in 75 games; sources give 48 or 45 | This is unresolved research prose in user copy. Keep the normalized value and provenance concept; verify the actual reference separately before publishing a precise factual replacement. |
| `src/engine/postseason.ts:1158` | `${bestGap.toFixed(1)} wins above what that roster was worth` | “{n} wins above the roster's projection.” |
| `src/engine/postseason.ts:1196` | `national champions, and only the No. ${rank} name in the country` | “National champion with the No. {rank} program by prestige.” Use the underlying ranking's actual name. |
| `src/engine/postseason.ts:1258` | `outscored the country by ${margin.toFixed(1)} runs a game, wire to wire` | “Led the country with a +{n} run differential per game.” Use the actual scope calculated; don't claim continuous first place unless tracked. Same issue in league version at 1259. |
| `src/engine/achievements.ts:75` | Go through league play without losing a game. | “Go undefeated in conference play.” |
| `src/engine/achievements.ts:95` | Take a one star program to five without leaving. | “Take one program from 1 star to 5.” |
| `src/engine/achievements.ts:99` | Have one of your men taken first overall in the draft. | “Coach a No. 1 draft pick.” |
| `src/engine/achievements.ts:299` | `${f.conference}, region and country` | “Conference, regional, and national titles.” Preserve the achievement's exact required trophies. |

## Press conferences: all 20 scenarios

The 20 four-answer sets were reviewed in full. Keep the existence and attitudes of all choices. First remove the narrator's redundant setup whenever the event heading and question already establish the scene. Rewrite around the current trigger, which supplies no exact age, month, streak length, roster count, opponent history, or preparation timeline to these static strings.

| Source/set | Exact setup or problem line | Direction and sample rewrite |
|---|---|---|
| `src/data/pressers.ts:104`, bigwin-credit | You have just beaten a program that has never lost to you. | Trigger only establishes a big win. Setup: “A big win, and the cameras are on.” Ask can stay. Answers: “The players. I mostly watched.” / “Everybody had a hand in it.” / “The staff had us ready.” / “Me, mostly. Write that down.” Remove invented three-week scouting claim. |
| 116, bigwin-upset | Somebody has used the word upset four times in two minutes. | Delete setup or “They keep calling it an upset.” Keep “Was it one?” Natural answers: “On paper.” / “Sure. They're a good team.” / “Ask me in a month.” / “No. Quote me.” Preserve boast versus restraint. |
| 128, bigwin-meaning | The room would like to know what it means for the rest of it. | Delete setup. “Does this change your season?” stands alone. 131 “There are forty games left” → “We've got plenty left to do.” 132 “what the ceiling looks like” → “It shows the freshmen we can play with them.” Keep bus-leaves line, with contraction. |
| 144, badloss-what | You have lost to a team you were expected to beat comfortably. | “A loss you were favored to avoid.” Or omit setup. 148 “Tuesday in April” → “We got beat. It happens.” 150 “I am not going to narrate it for you” → “You saw it.” |
| 156, badloss-blame | He asks whether anybody in particular let you down. | Delete duplicate setup. “Anyone you want to name?” can stay. 159 → “No. You know I don't do that.” 160 → “All of us. Start with me.” 162 nine-days-running claim → “The schedule hasn't helped.” Only retain workload excuse as coach opinion, not stated fact. |
| 168, badloss-lineup | The obvious follow-up, asked without any relish. | Delete. Ask remains clear. 171 → “No. I'm sticking with them.” 172 → “A few guys deserve a look.” 173's “broken/loud” aphorism should be rare; “Not over one loss.” retains the thought. 174 can stay. |
| 184, losing-room | Four in a row, and somebody asks how the room is holding up. | “The losses are piling up.” Use actual count only if supplied. 187 → “Badly. I'd worry if they weren't.” 188 → “They're fine. I'm the one losing sleep.” 189 → “Practice was good this morning.” 190 “dressing room” → “locker room.” |
| 196, losing-job | The question everybody waited for somebody else to ask. | Delete. “Worried about your job?” feels like a real reporter. 199 → “I'm worried about the next game.” 200 → “Ask the athletic director.” 201 → “We're all one bad month from a rumor.” 202 can stay with contractions. |
| 212, winning-how-good | Six straight, and the room has started using large words. | “The win streak has people talking.” Do not hardcode six. 215 → “Good enough to keep winning. We'll see.” 216 → “Better than I expected.” 217 keep; 218 → “Ask our opponents.” |
| 224, winning-omaha | Somebody says the word Omaha out loud and then waits. | Delete; ask “Is this an Omaha team?” directly. 227 → “We haven't earned a bid yet.” Only if actually unqualified. 228 → “That's the goal.” 229 → “Ask me when we've got a bid.” 230 “Book your room now and thank me later” is a good cocky option; keep. |
| 240, exit-seniors | It ended an hour ago and the seniors are still in there. | “Your season is over.” 243 → “That's between us.” 244 → “Thank you. They gave us a lot.” Avoid every senior necessarily spending four years. 245 → “Not much helps tonight.” 246 keep as hard-driving response. |
| 252, exit-season | He asks you to sum up a season while you are in the tunnel. | Delete. 255 → “Ask me in two weeks.” 256 → “I know what needs fixing.” 257 → “They gave us everything.” 258 → “Not good enough.” |
| 268, trophy-credit | There is a trophy on the table and a lot of people in the room. | “There's a trophy on the table.” 271 → “The guys who helped build this.” 272 → “The seniors.” 273 “The staff. Nobody photographs them.” is excellent; keep. 274 predecessor joke also works as the sole sly answer. |
| 280, trophy-again | The second question, thirty seconds after the first. | Delete; this is a separately selected question and need not be second. 283 → “Can I enjoy this one first?” 284 keep. 285 → “We've built a team that can.” Remove assumed three-year tenure. 286 keep. |
| 296, signing-ranking | Somebody has the national ranking of your class on a phone. | “Your class ranking is out.” 299 → “I've watched them play. That's my number.” Better plain option: “I like the players we signed.” 300 → “Let's rank them in three years.” 301 → “We got the guys we wanted.” 302 keep as cocky answer. |
| 308, signing-miss | A recruit everybody expected here has signed somewhere else. | `signingDay` does not itself establish a specific missed recruit. Either use only with a proven miss or ask “Did you get everyone you wanted?” without narrating a miss. 311 “He picked another place. That is allowed.” works when there is a real miss; contract “That's.” 312 shorten to “We finished second. That doesn't get a signature.” 313 keep. 314 → “We'll see him in June.” Still a boast, not narrator fact. |
| 324, caught-letter | It is out that you wrote to another program. He has the letter. | “Your interest in another job is public.” Do not invent possession of a physical letter. 327 → “I contacted them. I'm still coaching here.” 328 → “Coaches take calls. Mine made the paper.” 329 “correspondence” → “job talks.” 330 keep. |
| 336, caught-players | The harder version of the same question, and a fair one. | Delete. 339 → “They heard it from me first.” Only choose if describing the coach's claim, not a tracked event. 340 → “I'm their coach until that changes.” 341 → “Nothing. We have a game to play.” Avoid asserted age. 342 → “Everybody looks at another job sometime.” |
| 352, draft-push | A man you tried to keep has signed professionally. | “A player you tried to keep has signed a pro deal.” 355 keep. 356 → “I pushed. I thought he had more to gain here.” Remove nineteen. 357 → “Not at that price.” 358 selfish answer should remain selfish: “He owed us another year.” Do not sanitize the character choice. |
| 364, draft-replace | He was your best player and the room knows what that costs. | Trigger doesn't guarantee “best.” “You've lost a player to the draft.” Ask can stay. 367 → “You don't replace him overnight.” 368 keep if a freshman is a plausible answer; it is a coach's speculation. 369 → “That's why we recruit.” 370 → “Ask me when I'm less annoyed.” |

## Interview: all 80 scenarios

All 480 displayed strings were reviewed. Unlike press conferences, these are hypothetical scenarios, so invented game situations and backstories can be legitimate. Preserve each answer's strategy, loyalty, risk, and ethical character, along with all skill/lean/badge/grant mappings. Do not turn four different choices into synonymous nice answers.

The repeated issue across the bank is the cadence “X. That is what X is for,” “Nobody X,” “a man,” “the room,” “and I mean it,” “which is…,” followed by the narrator's explanation of the joke. Use the brief answer first; remove the justification unless it distinguishes the choice. Keep a small number of strong lines exactly because they work.

| Setup line | Scenario | Disposition and concrete change |
|---|---|---|
| 95 | Ninth, down one | Keep clear baseball setup. 99 “Bunt him over. A run is a run.” → “Bunt him over.” 105 → “Let my best hitter hit.” 111 → “Pinch-run first.” 117's eighth-inning wisecrack can stay. |
| 126 | Ready recruit versus project | “Ready now or a two-year project. You can sign one.” 130 “judged on Junes” → “I need wins now.” 136 → “The project. I like the upside.” Keep the fourth answer's defiance of the premise if intentional. |
| 157 | Senior now fourth choice | “A three-year starter has slipped to fourth on the depth chart.” 161 → “He starts. He's earned a senior season.” 167 → “He sits. He hears it from me first.” 173 “The lineup is not a reward for service” is good but use sparingly. |
| 188 | Pitcher at 89 pitches | Keep setup; numeric “89 pitches” scans faster. 192 “The number is the number” → “He's at his limit. Pull him.” 204 → “I check on him at the mound.” 210 keep dry “He was out at eighty.” |
| 219 | One facility/scouting investment | Keep. 229 “Arms are the only thing I cannot manufacture” → “The mound. We need better pitching.” 241 → “Put it into the players we have.” |
| 250 | Four losses, quiet dugout | Ask “What do you say?” 254 → “It's on me. We'll fix it.” 260 → “Nothing. They know.” 266 punitive option can remain punitive, simpler “We run.” 272 → “I talk to a few guys privately.” |
| 281 | Bigger school calls best bat | Keep. 285 → “Here's your role. Your decision.” 291 → “Take the opportunity.” 297 → “I've already called his replacement.” 303 → “Find out the offer. Beat it.” |
| 312 | Uneven firing standards | Replace “sacked” with “fired”; use “the previous coach” rather than “the man before.” Keep 322 “somebody upstairs liked one” as the wry option. 328 → “I'll be judged on my own record.” |
| 343 | Steal down three | Keep. 346 → “No. We need runners.” 347 → “Send him.” 348 → “Depends on the catcher.” 349 → “He's got the green light.” |
| 354 | Walk-on beats freshman | Keep setup. 357 “The fall is what the fall is for” → “The walk-on. He earned it.” Distinguish 359 with “I explain it to the freshman.” |
| 365 | Curfew before regional | Keep scenario. 368 → “Both sit. Same rule for everybody.” 369 → “Both play. We handle it Monday.” Keep punitive intent only if intended, without ornamental cruelty. |
| 376 | Academic eligibility | “Your best pitcher is one failed exam from ineligibility.” 381 → “With the recruiter who missed this.” 382 → “Get him help tonight.” |
| 387 | Rivalry or seeding | Keep. Ask “When do you start your ace?” 391 → “Sunday. Protect the seed.” Other three choices distinct; contract speech. |
| 398 | Crowd boos freshman | Keep. 401 → “He stays. I make the lineup.” 403 → “I back him publicly.” 404 tough response can stay. |
| 409 | Donor nephew | Keep: strong, specific comic scenario. 412 jacket/bus answer is worth retaining. 413 → “I tell the donor no.” 415 remains the cynical option. |
| 420 | Why this job | “One last question.” Or remove setup. Keep 423–426's distinct motivations, with contractions; “You knew that” can be cut. |
| 431 | Pitchout at 2–1 | Make starting count explicit rather than “a pitchout makes it three and one.” Keep strategic choices; 437 → “Yes. And I'd call it again.” |
| 442 | Errors by best defender | Keep. 445 → “Extra ground balls.” 446 → “A day off. His hands are fine.” 447 → “Let him play through it.” 448 → “Check his positioning first.” |
| 453 | Cleanup hitter slump | Keep. 456 “the order is not a mood ring” is a good single joke; contract it. 457 → “Sixth for a week.” 459 keep video joke if 456 is toned down; avoid every choice being a bit. |
| 464 | Doubleheader one rested arm | Keep. 467 → “Game one. Bank a win.” 468 → “Game two. I'm not conceding it.” 469/470 retain distinct plans, trim final explanations. |
| 475 | Shortstop hates shift | Eleven-year habit on a college player is odd. “Your shortstop hates the shift. The chart says use it.” 478 “He can hate it from the correct side of the bag” is excellent; preserve as the funny choice. |
| 486 | Catcher four years/SS two | Keep. 489 → “The catcher. Four years of stability.” 490 → “The shortstop. Two years can change a program.” 491 keep rule-bending answer. |
| 497 | Playing through injury | Clarify whether playing costs three more weeks of recovery. 501 autonomy answer remains distinct; remove rhetorical explanation “he knows the trade.” |
| 508 | Reporter asks about job | Keep. Remove repeated “That…” start: 511 “I'd be worried if I weren't paying attention.” 512 “I'm worried about Friday.” 513 “Ask the AD.” 514 “The players haven't quit. Neither have I.” |
| 519 | Assistant gets head job | “Head coaching offer,” not “head job.” 522 → “Take it.” 523 → “Stay a year. I'll help you find a better one.” 524 “I'd rather you stayed. That's not advice” is a good human admission. |
| 530 | Freshman best in October | Delete “The room is watching.” Keep four batting-order choices and enough reasons to distinguish them. 535 “High enough to matter, low enough to breathe” → “Seventh. Ease him in.” |
| 541 | Leading by 11 | Keep scenario. “traveled,” “3–0.” 547 → “My pitcher needs the work.” Preserve whether coach keeps competing or empties bench. |
| 552 | Rain approaching | Keep scenario, but make inning/official-game assumptions explicit if needed. 556 “nought-nought” → “0–0.” 557 slow-play option remains cynical; no extra “it will be worth it” needed. |
| 563 | Two portal departures | Keep. 566 → “The bench player. I never gave him a chance.” 568 → “Neither. I've got two calls to make.” |
| 574 | Predecessor at games | Keep. These are already specific human reactions. Contract 579 “I'll put him to work”; leave banner line alone. |
| 585 | Speed versus OBP leadoff | Keep. “You cannot steal first” is familiar baseball language, fine once. Avoid making every other answer equally aphoristic. |
| 596 | Eleven-hour bus ride | Keep strong scene. 600 “Eleven hours is a gift” → “Video. We have the time.” 602 “Ever. To anyone.” is an overperformed tag; “No complaining about the bus.” |
| 607 | Catcher helps arms, can't hit | Keep. 610 → “Yes. He makes the pitching staff better.” 613 → “Yes. His defense is worth it.” Preserve distinction from fixing his bat. |
| 618 | Two-way freshman | Keep. 621 → “Both, with firm workload limits.” 623 “Bats last longer than elbows” is good once. |
| 629 | Captain choice | “Both, and the quiet one…” at 634 references no established second player. Rewrite setup to name the two candidates or make this answer “Name a second captain to work with him.” 633 roster-number/letter line → “No captain. They can lead without a title.” |
| 640 | Surgery or regional | Keep hard choice. 643 fifteen-year career prediction → “Surgery. Protect his future.” 644 → “Surgery. He can blame me.” Other opinions retain their different stance. |
| 651 | Recruit's mother asks graduation | Keep. 655 “a number on it” is unclear → “Show her his development plan.” 656 “the other three” lacks a referent → “A visit they won't get at the other schools.” |
| 662 | Father emails about innings | Keep. 665 → “The player, privately.” 666 → “His father. Once.” 667 → “Both together.” 668 “I answer with innings” → “Neither. Playing time isn't negotiated by email.” |
| 673 | 14–2, Omaha talk | Keep. 677 → “It's sixteen games.” 679 → “Let the fans talk. Remind the players we're not done.” |
| 684 | Field or assistant | Keep. 688 “A man can fix more than a groundskeeper can” is awkward/dismissive → “The assistant. We need another coach.” |
| 695 | New uniforms | “What does the team wear?”; program/recognize spelling. Keep old/new/home-away/player-vote alternatives; already human. |
| 706 | JUCO bat, flawed swing | Keep. 709 → “Yes. Two good years matter.” 712 → “No. I want someone for four years.” |
| 717 | Gave up nine, who pitches | Keep. 720 → “A freshman who needs the work.” 721 “I want this over” is good and human. 723 intentionally competitive answer can stay. |
| 728 | Class ranked 40th | Keep. 731 → “Recruits care, so I have to.” 732 → “No. It measures who else wanted them.” 734 → “Ask me in four years.” |
| 739 | Winning but worried | “Six wins in a row. The team feels flat.” 742 → “Shake up practice.” 743 → “Leave a winning team alone.” 744 keep; 745 → “Give them a day off.” |
| 750 | Bad umpire call | Keep. 753 “I go…” is opaque → “I'm out of the dugout.” 755 → “A quiet word between innings.” 756 → “I go before one of my players does.” |
| 761 | Junior drafted | Keep. 765 guaranteed doubled money is coach bluster; if intentionally dishonest, keep attitude but “Stay. I think you can go higher.” 766 → “I'd tell him what I'd tell my son.” 767 is a strong honest-conflict line. |
| 772 | Seed depends on other game | Keep. 775 → “No phones. Play our game.” 777 → “I know. I'll manage accordingly.” 778 → “No score updates, even for me.” |
| 783 | Long-serving assistant passed over | Keep. 786 → “Keep his role. Ask for his advice publicly.” 787/788 preserve pitching/recruiting use; 789 → “Bring my own staff. Tell him on day one.” |
| 794 | Senior and freshman tied | Keep. 797/798 shorten to “The senior. He's earned the tie-break.” / “The freshman. Bet on the upside.” 799 platoon joke fine. 800 needs clarify rewarding response to benching → “See who handles sitting better.” |
| 805 | 62–73 in third year | Keep. “offense,” “program.” 808 → “Nothing yet. The plan needs time.” 811 → “Ask the board what they expect.” |
| 816 | First practice | “First practice. A roster you didn't recruit.” 820 → “Learn every name before we start.” 822 → “We run.” Cut explanation that it is unsubtle. |
| 827 | Tired bullpen | Keep excellent “all lying” setup as an occasional joke. 831 “The one who is lying least convincingly” → “Whoever's lying least convincingly.” Other options remain direct. |
| 838 | Small crowd while winning | Keep. 843 “Four hundred people came to watch baseball” is a good humane reply; preserve. 844 → “I'll visit every school in the county.” |
| 849 | Bench senior never complains | Keep. 852 → “A Senior Day start.” 854 → “He's had what he earned.” 855 → “Tell the team what he's meant to us.” |
| 860 | Grad student sends charts | “Two were right” is hard to interpret for spray charts. “A grad student keeps sending useful scouting charts.” 865 → “Ask about the misses, too.” Retain skepticism without inventing two unmentioned wrong predictions. |
| 871 | Young coach | Keep age-gated scenario. 875 → “I bring it up once. Then we move on.” 876–878 distinct good answers; contract them. |
| 883 | Older coach | Keep age gate. 887 “I've been wrong more times. I remember them” works. 890 room-sound aphorism → “I recognize a team that's in trouble.” |
| 895 | Extreme heat | Clarify temperature: “96°F at first pitch, 91°F at the last.” Otherwise it reads like velocity. 899 → “Nothing. We're used to it.” 900 keep shorter/earlier practices; remove July if season doesn't cover it. |
| 907 | Cold weather | Keep climate gate. “Defense.” 914 “aware of how that sounds” is meta-commentary; “Toughness. We're going to need it.” |
| 919 | Intentional walk | Keep. The “winning run” answer 924 assumes ninth inning/score not stated; include those in the hypothetical setup or rewrite to “No. Don't give them another runner.” |
| 930 | Strikeout-prone hitter, runner on | Keep tactical question. Shorten mirrored 934/935 while preserving risk: “Let him hit. He'll catch up.” / “Nothing extra. Keep it simple.” |
| 941 | Redshirt tradeoff | Explicitly ask about redshirting: “Use him for 30 innings now, or save a year of eligibility?” 947 → “Redshirt him. Keep the long-term plan in front of him.” |
| 952 | Move shortstop to center | “center field”; keep concrete methods. 957 → “I tell him he's an outfielder.” 958 scout-persuasion answer works. |
| 963 | 4–11, no obvious problem | Keep. 967 “Fifteen games is fifteen games” → “Stay the course.” 968 → “Talk to the players one at a time.” |
| 974 | Star is poor teammate | “Absent” could mean skips practices; clarify “keeps to himself” if meant emotionally disengaged. 978 → “He hits. That's enough for now.” Keep distinct captain/senior interventions. |
| 985 | Deciding vote | Missing what the vote is about. Add a concrete conference-policy subject without changing stakes, or name it as “A conference vote…” 991 → “Abstain.” Cut commentary that abstaining is a decision. |
| 996 | Pitching recruit wants written plan | Keep. 1000 → “A three-year development plan.” 1001 → “His path to the draft.” 1002 → “I don't make written promises.” |
| 1007 | Opposing pitcher hits players | Keep conflict and distinguish retaliatory choices; no need to make all responses admirable. 1010 → “Get between them. Keep my players in the game.” 1011/1012 shorter but equally clear about retaliation. |
| 1018 | Homesick freshman | Keep empathetic scene. 1022 “Nothing fixes homesick…” overgeneralizes → “Give him a role. Help him feel needed.” 1023 → “Check in regularly. Talk about home.” 1024 → “Give him some space.” |
| 1029 | Rival poaches assistant | Keep. 1032 → “Tell the board to match it.” 1034 → “Help him go. I've got replacements in mind.” 1035 “I am not joking” → delete; the offer already communicates seriousness. |
| 1040 | Extras, first baseman pitching | Keep. 1043 → “Sell out to win it now.” 1044 → “Same plan as the first inning.” 1045 → “Protect his arm.” 1046 → “Use everybody left.” |
| 1051 | Summer ball | Keep. 1054 “Four hundred at-bats is four hundred at-bats” → “Go. He needs the at-bats.” 1056 → “Go. I'll check in every Sunday.” |
| 1062 | Who hits ninth | Keep. 1067 → “The shortstop. Treat him as a second leadoff hitter.” Other choices are clear; mostly contract. |
| 1073 | Alumni hour every week | Keep. 1076 → “Yes. It's their program too.” 1078 → “Four evenings a year. They get my full attention.” |
| 1084 | Opponent has signs | Keep. 1087 wrong-sign trick is good specific humor. 1088 → “Change them quietly.” 1089 → “Confront them.” 1090 stays permissive. |
| 1095 | Three catchers costs bat | Clarify roster/lineup tradeoff in setup: “Carrying a third catcher leaves you short a bench bat.” Choices remain keep cover/teach another/risk it/rest pair. |
| 1106 | End of season speech | Keep. 1109 → “Thank the seniors by name.” 1110 → “Lay out next year's plan.” 1111 → “Keep it short. They're hurting.” 1112 “it was mine/next year will not be” is unclear → “Own the season. Promise better.” |
| 1117 | Senior returns, freshman sits | Keep. 1121 → “No. I promised the freshman a real role.” 1123 → “Yes. I want to win now.” Preserve the prior promise. |
| 1128 | Loss keeps coach awake | Setup → “A loss that's going to keep you up.” 1131 car line works. 1132 → “The team, tomorrow. Then move on.” 1133 → “The team, tonight. Start with my mistakes.” 1134 video line works. |

## Repetition rules for the implementation pass

- A summary should add a fact the title does not already contain. If it cannot, remove it.
- One memorable line per moment is enough. Let neighboring lines be plain.
- Keep routine event text stable; vary the actual story, not randomly chosen decorative synonyms.
- Avoid ungrounded superlatives: “nobody,” “every,” “never,” “the best,” and “always” need either real supporting state or unmistakable character opinion.
- Display actual consequences and conditions clearly. Put how-it-works detail in an optional explanation when the user needs it, not in every result message.
- Keep dynamic facts dynamic. Do not freeze a player's age, a roster size, date, tenure, record, or return timeline in a reusable template.
- Don't change dialogue's rewards, scenario eligibility, scouting overlaps, thresholds, or deterministic choices during a copy pass.
- Test rendered full messages and alternate branches, not only individual strings. Grammar must hold for school versus mascot names, singular/plural counts, pitcher versus hitter, and every ending condition.


## School cultures: all 96 dispositions

These are fictional institutional flavor, so an invented founding story is permissible. The concern is repetition and claims that contradict the evolving dynasty (a permanent “never ranked” line after a ranking, or a four-hour recruiting radius beside a distant roster). Keep lore as lore; avoid describing current performance in immutable flavor. Culture edge, patience and ambition are unchanged. Names generally stay; localize “Ironside defence” to “Ironside defense.” The eight edge labels stay, with DEFENCE → DEFENSE.

| Source line / school | Current name and exact creed | Disposition / proposed creed |
|---|---|---|
| 94 / BAY | **Omaha or nothing** — Two men have been sacked here with winning records. | Rewrite: “Two coaches have been fired here with winning records.” |
| 95 / MOB | **The old navy** — They will tell you about 1974 before they tell you where your office is. | Rewrite: “Your office tour starts with a story about 1974.” |
| 96 / DLT | **Arms first** — Sign a bat and the pitching coach will want a word. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 97 / THB | **The long game** — Nobody here has ever been in a hurry, including the board. | Rewrite: “The board believes in taking its time.” |
| 98 / GLP | **Storm baseball** — Swing hard. The wind off the water does the rest. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 99 / PSC | **The forge** — Nobody arrives finished. Everybody leaves better or leaves early. | Rewrite: “Development comes first. Bring a project.” |
| 100 / LKC | **Drill deep** — They sign men nobody scouted and are quietly smug about it. | Rewrite: “They enjoy signing the players everyone else missed.” |
| 101 / BIL | **The short porch** — The fence is close and the philosophy is closer. | Rewrite: “Short fence. Big swings.” |
| 102 / ATF | **Basin time** — The water takes its time. So does the board. | Rewrite: “A patient board by slow water.” |
| 103 / PTA | **Dock work** — Nobody here is above carrying something. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 104 / HTB | **Cut and stack** — Four years, a degree, and a hard nine innings. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 105 / SEL | **Anvil work** — They have never bought a player and do not intend to start. | Rewrite: “They prefer developing talent to chasing stars.” |
| 108 / PIE | **The standard** — A regional is a disappointment they are too polite to name. | Rewrite: “A regional trophy barely earns a shelf.” |
| 109 / CHS | **The admiralty** — Blazers in the stands and a century of minutes in a cabinet. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 110 / TAM | **Star power** — They want the best kid in Florida and they usually get him. | Rewrite: “The best recruit in Florida is usually their first call.” |
| 111 / NEU | **Grind it out** — They will forgive a loss. They will not forgive a lazy one. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 112 / ASH | **The high road** — Thin air, long practices, and a genuine belief that it matters. | Rewrite: “Thin air. Long practices.” |
| 113 / SAV | **River arms** — They would rather have three arms than one bat. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 114 / JAX | **Hold fast** — Men who leave early are spoken about carefully and not warmly. | Rewrite: “Leave early and expect a cool reception.” |
| 115 / OKE | **Swamp rules** — They find them where nobody else is looking. | Rewrite: “Good scouts. Mud on the tires.” |
| 116 / CPF | **Take what you can** — Steal a base, steal a game, steal somebody else’s recruit. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 117 / ALT | **Strike first** — A quiet place that plays aggressive baseball. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 118 / SNB | **Run it out** — Legs, wind, and a groundskeeper who cuts the grass short. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 119 / OCL | **The nursery** — Half the coaches in the country took their first job here. | Rewrite: “A good place for a first coaching job.” |
| 122 / RID | **West coast standard** — A trophy case, and a list of everyone who failed to add to it. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 123 / BRK | **The archive** — Every banner has a man who hung it, and they know all their names. | Rewrite: “Ask about a banner. Clear your afternoon.” |
| 124 / MBT | **By the numbers** — They will ask about your defensive alignment before your record. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 125 / PIN | **First in** — They would rather try something and be wrong than be late. | Rewrite: “Try it before everyone else does.” |
| 126 / CAL | **Dig for it** — Nothing here has ever come up easy and they prefer it that way. | Rewrite: “Nothing comes easy here. They like it that way.” |
| 127 / OAK | **The quiet school** — Good grades, good gloves, and no fuss about either. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 128 / VER | **Let it fly** — The ball carries here, and so does the philosophy. | Rewrite: “The ball carries. Swing accordingly.” |
| 129 / SUT | **Ride for the brand** — Four years, or do not bother knocking. | Rewrite: “Come ready to stay four years.” |
| 130 / CSC | **Mill work** — Rain, reps, and a bullpen that throws all winter. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 131 / SLS | **Grow your own** — They have not signed a rated recruit in eleven years. On purpose. | Rewrite: “They would rather develop a player than win a recruiting ranking.” |
| 132 / KLM | **Set the line** — Patient, quiet, and unusually good at stealing a game. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 133 / MOJ | **Desert legs** — If it is on the ground, somebody here is already running. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 136 / PLT | **Break the ground** — Founded by men who dug it out, and they never stop saying so. | Rewrite: “Founded by miners. It will come up.” |
| 137 / OZK | **Hold the hill** — Four coaches in fifty years. They liked three of them. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 138 / WIC | **Swing at everything** — The wind blows out, and forty years of baseball is built on it. | Rewrite: “The wind blows out. The hitters have noticed.” |
| 139 / LWR | **Find the vein** — Scouting is the whole religion here. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 140 / KEA | **The honest yard** — They want it played properly and will tell you when it was not. | Rewrite: “Play it right. The stands will let you know.” |
| 141 / CDR | **Arms and winter** — Six months indoors makes pitchers. They have the record to prove it. | Rewrite: “Long winters. A lot of work for the pitching staff.” |
| 142 / DUB | **Run the river** — They gamble. It has cost them, and they keep doing it. | Rewrite: “They keep gambling, even after the bill comes due.” |
| 143 / SLN | **Harvest work** — One crop a year, and everybody is expected to be there for it. | Rewrite: “Sign here. Stay awhile.” |
| 144 / CHK | **Move them along** — Bunt, run, take the extra base, go home. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 145 / RDO | **Thresh it out** — They keep the ones who last the winter. | Rewrite: “They value players who stick around.” |
| 146 / MRL | **Steady hands** — Never ranked, and never a losing decade. | Rewrite: “Steady baseball. Modest expectations.” |
| 147 / SDL | **The junction** — Men pass through on the way somewhere. Both directions. | Rewrite: “A useful stop on the way up—or back.” |
| 150 / SON | **Hunt in packs** — Nine men, one plan, and no room for a passenger. | Rewrite: “Nine players, one defensive plan.” |
| 151 / TUC | **Never stand still** — First to third on anything. They will not apologise for an out. | Rewrite: “They take the extra base and live with the outs.” |
| 152 / RGV | **The pipeline** — Every man on the roster is from within four hours of here. | Rewrite: “Their recruiting starts close to home.” |
| 153 / ALB | **High heat** — Thin air, hard throwers, and a staff that likes both. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 154 / LCR | **Raise a little dust** — Nobody expects anything here, which is exactly how they like it. | Rewrite: “Low expectations leave plenty of room.” |
| 155 / ELP | **Pull the load** — Long bus rides, and no complaining about them. | Rewrite: “Long bus rides. Pack accordingly.” |
| 156 / YUM | **All summer** — They play more baseball in a year than anybody in the country. | Rewrite: “If there is daylight, there is practice.” |
| 157 / NGL | **Small and mean** — Nobody wants to come here in May, and they know it. | Rewrite: “Small school. Annoying road trip.” |
| 158 / MOA | **The wall** — Deep fences, deep counts, deep patience. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 159 / PAH | **Dig in** — No winning season since 1998, and the stands are still full. | Rewrite: “The fans have been more reliable than the record.” |
| 160 / GAL | **Light and quick** — Speed is cheaper than power, and they made a philosophy of it. | Rewrite: “They build with speed on a small budget.” |
| 161 / CSG | **Stand still and grow** — Nothing happens fast here. That is the entire pitch. | Rewrite: “Give the players time to grow.” |
| 164 / ERI | **Carry the load** — Big rosters, long seasons, and no interest in shortcuts. | Rewrite: “A full roster and plenty of work.” |
| 165 / SAG | **Ironside defence** — They will lose two-one and call it a good night out. | Rewrite: “A 2–1 game is their kind of evening.” |
| 166 / FVL | **Pour and set** — Take the raw thing, heat it, and see what it becomes. | Rewrite: “Raw recruits welcome. Work starts Monday.” |
| 167 / TOL | **Clear sight** — They keep more numbers than anybody, and read all of them. | Rewrite: “Bring your numbers. They brought theirs.” |
| 168 / SUP | **Through the ice** — Nothing about being here is easy, starting with February. | Rewrite: “February will test the commitment.” |
| 169 / MRQ | **The long way out** — They recruit places nobody else will drive to. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 170 / HUR | **Pull together** — One oar out of time and the whole thing turns. | Rewrite: “Defense works when everyone is in position.” |
| 171 / ATB | **Into the wind** — Cold, loud, and unreasonably hard to beat at home. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 172 / MSK | **Shifting ground** — Nobody plays one position here for four years. | Rewrite: “Expect to learn another position.” |
| 173 / KNK | **Work the current** — Small ball, small budget, small complaints. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 174 / SDY | **The long winter** — They judge a coach on his fourth year, not his first. | Rewrite: “They give a rebuild time.” |
| 175 / WBS | **Hammer and heat** — Nobody is recruited here. Everybody is made here. | Rewrite: “They build hitters here.” |
| 178 / TET | **The high ground** — Altitude, attitude, and a fence nobody clears cheaply. | Rewrite: “High altitude. A fence that still makes you earn it.” |
| 179 / SIL | **Hardrock** — They mine. They do not shop. | Rewrite: “They like finding talent before it gets expensive.” |
| 180 / WAS | **Clean mechanics** — The pitching lab keeps better hours than the library. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 181 / LAR | **Run the plain** — Nobody outruns them and nobody outlasts them. | Rewrite: “Fast legs. Long practices.” |
| 182 / DUR | **The rim** — Quiet, remote, and deeply suspicious of anybody in a hurry. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 183 / BIT | **Bite first** — A small school that plays like it has just been insulted. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 184 / POC | **Stay put** — Men graduate here. All four years, every time. | Rewrite: “They recruit players who plan to graduate here.” |
| 185 / GRJ | **One-run games** — They have lost more of them than anybody, and learned from it. | Rewrite: “They have opinions about one-run games.” |
| 186 / BUT | **Dig and hold** — A century of hard work, and no apologies for the record. | Rewrite: “A mining town with a long baseball memory.” |
| 187 / CDA | **Slow water** — They will give a coach six years. They will also notice all six. | Rewrite: “Patient, but paying attention.” |
| 188 / RWL | **Wind and dust** — The hardest place in the country to win, and they know it. | Rewrite: “A hard place to win. A good place to prove something.” |
| 189 / SLD | **Climb something** — Nobody has ever expected anything, so anything is a triumph. | Rewrite: “Win a little and people will notice.” |
| 192 / HUD | **The watch** — Old school, old money, and a very long memory. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |
| 193 / NWP | **The long voyage** — They have waited forty years and are prepared to wait longer. | Rewrite: “They have waited a long time for a winner.” |
| 194 / BRS | **Rivet and beam** — Defence first, and they will say it twice. | Rewrite: “Defense first. Then more defense.” |
| 195 / ALG | **Down the seam** — Hard hours, no shortcuts, and a suspicion of anybody polished. | Rewrite: “They like a player with work left to do.” |
| 196 / PRT | **Keep the light** — Somebody has done this job for a century without any fuss. | Rewrite: “They value coaches who stay.” |
| 197 / NSH | **The second shift** — They take the men who were passed over, and work them. | Rewrite: “A second chance for overlooked recruits.” |
| 198 / SCR | **Break it down** — They rebuild swings from nothing. Some of them survive it. | Rewrite: “They are not afraid to rebuild a swing.” |
| 199 / BGR | **North of everything** — The bus rides are the recruiting pitch. They are honest about it. | Rewrite: “Remote school. Close team.” |
| 200 / UTC | **Steady fall** — Nothing dramatic has happened here, and nothing is expected to. | Rewrite: “Quiet baseball. Manageable expectations.” |
| 201 / PTS | **Burn long** — Hard, slow and hot. Ask anybody who played here. | Rewrite: “Long practices. Plenty of swings.” |
| 202 / CHC | **Thread by thread** — They build a roster the way they built the town. Slowly. | Rewrite: “They build slowly and expect you to stay for it.” |
| 203 / PSA | **The bottom rung** — Every coach here is on the way up or on the way out. Both are welcome. | Keep. Specific flavor with enough character; reduce repetition by simplifying neighboring entries. |

## Coach badges: all 21 visible flavor lines

Source: `src/data/badges.ts`. The `effect` strings are internal metadata: the source explicitly says they are not printed, and the audit found no `.effect` UI consumer. Do not include those strings in a tally of visible explanatory text, or silently expose them as promises without verifying the mechanic. Names and `line` values are the displayed copy.

| Source line | Badge and exact flavor | Disposition / proposal |
|---|---|---|
| 72 | **Players’ coach** — They would run through a wall, and occasionally do. | Keep. A good physical joke in a short flavor line. |
| 77 | **Hard-nosed** — Nobody has ever described a practice here as pleasant. | “Nobody looks forward to conditioning.” |
| 82 | **Developer** — He would rather build one than buy one. | “Give him a project.” |
| 87 | **The closer** — He gets the kid who was going somewhere else. | Keep; the recruiting context makes the title clear. |
| 92 | **Gambler** — He sends the runner. He has always sent the runner. | “He sends the runner.” Delete the explanatory repeat. |
| 97 | **Grinder** — His teams are never comfortable and never finished. | “A one-run game is his idea of relaxing.” Flavor only; avoid a guarantee. |
| 102 | **The keeper** — Men who sign for him tend to graduate for him. | “He likes seeing his recruits on Senior Day.” |
| 107 | **Traditionalist** — He knows what the programme did in 1974 and why it mattered. | “Ask him about the old uniforms. Cancel your next meeting.” |
| 112 | **Arms man** — He will take the pitcher every time, and has. | “Another pitcher? Always room.” |
| 117 | **By the book** — He has a number for everything and does not move off it. | “The pitch count is written in ink.” |
| 122 | **Swing away** — He has never asked a man to shorten up in his life. | “Green lights up and down the order.” |
| 129 | **Never a night off** — He has managed every game he was allowed to manage. | “He wears out the dugout steps.” |
| 134 | **The pen** — He is out of that dugout before the second walk. | Keep. Specific baseball behavior, clean comic timing. |
| 139 | **Small ball** — Bunt, run, take the extra base, go home. | Keep. Concrete and rhythmic. |
| 144 | **Plays the kids** — Freshmen get innings here, and everybody knows it. | “Freshmen get a real chance here.” |
| 149 | **Four-year man** — Almost nobody leaves early, and it is not an accident. | “He recruits for the long stay.” |
| 154 | **Reads the room** — He knows what every programme in the country is doing. | “He knows what the other dugout is up to.” Consider title “Has the scouting report” if broader news expertise is not real. |
| 159 | **Never dead** — His teams have won too many games they had no business in. | “Do not leave his games early.” |
| 164 | **Travels well** — The bus does not bother him and it does not bother them. | “Same team, different bus ride.” |
| 169 | **More than he had** — Every roster he has been given finished above where it started. | “He gets more out of a roster.” Consider title “Overachiever.” |
| 174 | **The persuader** — Men who were leaving have a coffee with him and stay. | “A player comes in to say goodbye. Leaves with second thoughts.” |

## Conference blurbs: all eight

Proper school names, nicknames, locations, names in `data/names.ts`, and standard stat abbreviations are retained. No broad rename is needed. Conference flavor currently repeats the three-item list followed by a portentous finish. Vary the structure; avoid frozen rankings framed as current facts.

| Source | Exact current blurb | Proposal |
|---|---|---|
| src/data/schools.ts:147 | The best baseball in the country. Hot, loud, and unforgiving. | “Hot weather. Loud crowds. Very little patience for losing.” |
| src/data/schools.ts:168 | Old money, old rivalries, and a fanbase that expects Omaha. | “The alumni remember every rivalry game. Especially the losses.” |
| src/data/schools.ts:189 | Warm weather, big crowds, and pitching that travels in June. | “Warm weather and a lot of good arms.” |
| src/data/schools.ts:210 | Wind, dirt, and small towns that take the local nine seriously. | “Small towns. Baseball is the evening plan.” |
| src/data/schools.ts:231 | Dry air, thin pitching, and scores that get out of hand. | “The air is dry. The scoring rarely is.” |
| src/data/schools.ts:252 | Snow in March, doubleheaders in May, nothing handed to anyone. | “Wait out March. Make up the games in May.” |
| src/data/schools.ts:273 | Altitude, long bus rides, and the thinnest budgets in the country. | “Long bus rides on short budgets.” |
| src/data/schools.ts:294 | The coldest league in the country. Wins here are earned twice. | “Bring a jacket. Then another one.” |

## Cross-checks passed to the main audit

- **Coach points:** `CoachPoints.tsx:56` says points do not carry over. `src/state/store.ts:2966` adds new points to existing `coach.skillPoints`; `nextPhase` at 2245 clears `spentThisStep`, not the balance. This is a misleading rule explanation, not just a tone issue. Fix copy to describe retained points unless the product explicitly chooses a rule change.
- **Portal pool:** `Portal.tsx:95` and 237 say portal spending reduces recruiting points and leftovers carry forward. `src/state/store.ts:156` calculates recruiting budget from prestige and draft spending only; exiting the portal at 2342 clears portal state without carrying its spending. Remove the shared-pool claim under current behavior.
- **Visibility:** engine comments and internal badge-effect metadata were read for interpretation, not counted as player-facing prose. Game logs, wire bodies, record notes, award citations, and the static dialogue pools were reviewed even when not visible in the initial screen.
