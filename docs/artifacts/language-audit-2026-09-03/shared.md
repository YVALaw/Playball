# Shared copy, tutorials, notifications, settings and saves

Read-only audit of the current working source, September 3, 2026 UTC (September 2 locally). No production copy has been changed. Quoted source text is verbatim; ellipses mark omitted text. Braces in proposals describe values to insert, not newly implemented functionality.

The repeated problem is a narrator who cannot leave a useful sentence alone. Instructions acquire a moral, ordinary state changes acquire a speech, and error messages explain the software. Keep the facts, costs and next action; put personality into occasional reactions.

## Fix meaning before polishing tone

| Source | Finding | Recommendation |
|---|---|---|
| `src/ui/App.tsx:267` | Every failed load is described as a version mismatch. The same paragraph points to the obsolete `PROGRAM · SAVES` route and guarantees recovery in the originating build. `loadSlot` catches more than version errors (`src/state/store.ts:5221`). | Classify failures. For an unknown cause: **Couldn't open this dynasty.** For a confirmed newer schema: **This save needs a newer version of Playball.** Give a working recovery action; don't require a new dynasty to reach existing saves. |
| `src/ui/App.tsx:740`, `src/state/store.ts:2747` | Simulation failures use the save-error channel, so **NOT SAVED · TAP TO TRY AGAIN** can appear for a failed simulation. Tapping runs `saveNow`, not the failed simulation. | Give simulation failure its own message and action: **The season simulation stopped. Try again.** Only offer that action when it actually restarts the simulation safely. |
| `src/ui/Needs.tsx:309` | **Nothing stops until they are dealt with, but a week goes past either way.** is both hard to parse and inconsistent with the blocking needs used by Today. | **Handle the required items before playing or simulating.** Mark each required item with text, not just a red number. Keep optional items optional. |
| `src/ui/Needs.tsx:109` | **Nothing you say here is wrong.** implies press answers have no stakes, although answers affect culture alignment. | **The press is waiting for your answer.** Explain any mechanical effect once in press help, accurately. |
| `src/ui/tutorials.ts:72` | Says top six reach June; current tournament takes eight. The postseason tutorial already says eight (`:111`). | **Finish in your conference's top eight to qualify for its tournament.** Keep the actual advancing counts in one shared rules source. |
| `src/ui/tutorials.ts:165` | **Fifty points a week** is obsolete: `boardBudget` uses prestige and draft spending. **Points carry over** conflates cumulative interest with unspent weekly allocation. | **Spend this week's points on recruits. Interest builds across the three weeks; unused weekly points don't carry over.** `advanceRecruitingWeek` adds interest and resets weekly spending (`src/state/store.ts:2123`, `:2130`). |
| `src/ui/tutorials.ts:98` | Says bench, bullpen and mound actions each **spends a man for the night**. A mound visit does not substitute a player. | Separate substitution and visit rules. **Replaced players can't return. A mound visit leaves your pitcher in the game.** |
| `src/ui/tutorials.ts:65` | **fewest errors just means nobody hits it to you** is an unjustified claim. | **Check plays above average alongside errors; chances matter too.** |
| `src/ui/screens/Saves.tsx:353` | **There is no second copy of this dynasty** is asserted without checking for other copies. | **Delete this save permanently? This can't be undone.** Identify the selected save. |
| `src/ui/BigMoment.tsx:32` | A regional title says **The national twenty is set** even though other regional series may still be unresolved. | **You're going to nationals.** Reserve a claim about the completed field for the point at which it is actually set. |
| `src/ui/screens/Settings.tsx:320`, `src/state/depth.ts:136` | **Arrives with a later game.** makes an unclear feature-delivery promise. | Remove the unavailable option from ordinary play settings, or use **Not available yet.** if showing planned features is intentional. |

## Settings and saves: functional language

These screens should be the quietest in the app. Their labels already do much of the work. `Settings.Row` renders `note ?? blurb`, so those two props are alternatives, not duplicate visible paragraphs.

| Source | Current wording / excerpt | Proposed wording or treatment |
|---|---|---|
| `src/ui/screens/Settings.tsx:75` | **Text size, theme, the field, motion.** | **Text size, theme, field view and motion.** |
| `src/ui/screens/Settings.tsx:76` | **Bat, glove, crowd, haptics.** | **Game audio and vibration.** |
| `src/ui/screens/Settings.tsx:77` | **Full or casual, and what you handle.** | **Choose what you manage.** |
| `src/ui/screens/Settings.tsx:78` | **Name a save, load a career, start again.** | **Save, load or start a dynasty.** |
| `src/ui/screens/Settings.tsx:158` | **Display and sound belong to this device and follow you between dynasties. How you play belongs to this career and rides the save.** | **Display and sound apply to this browser. Play settings are saved with each dynasty.** The current browser product scopes storage to an origin; don't imply device-wide synchronization. |
| `src/ui/screens/Settings.tsx:168` | **Type and motion** | Remove the redundant heading; the screen is already **Display**. |
| `src/ui/screens/Settings.tsx:177` | **The field** | **Field view**. Keep **2D / 3D**. |
| `src/ui/screens/Settings.tsx:206` | **Teaching** | **Tutorials**. |
| `src/ui/screens/Settings.tsx:209` | **Explain the screens** | **Show tutorials**. |
| `src/ui/screens/Settings.tsx:212` | **Each screen says what it is for, once.** | **Show tips when you first visit a screen.** |
| `src/ui/screens/Settings.tsx:213` | **Nothing explains itself. Turn this back on and the reset below still works.** | **Tutorials are off.** |
| `src/ui/screens/Settings.tsx:241` | **The screens will teach again** / **Show the tutorials again** | **Tutorials reset** / **Reset tutorials**. |
| `src/ui/screens/Settings.tsx:246` | **Every screen explains itself once more on your next visit.** | **Show previously dismissed tips again.** |
| `src/ui/screens/Settings.tsx:257` | **The broadcast** | Remove the extra heading beneath **Sound**. |
| `src/ui/screens/Settings.tsx:262` | **The crack, the glove, and a crowd that knows the score.** | **Game sounds and crowd noise.** |
| `src/ui/screens/Settings.tsx:263` | **Silent. The game plays exactly the same way.** | **Game audio is off.** No need to explain that muting doesn't change the rules. |
| `src/ui/screens/Settings.tsx:268` | **Haptics** | **Vibration**. |
| `src/ui/screens/Settings.tsx:270` | **A light touch. The walk-off gets the only real buzz.** | **Vibrate during key plays.** Don't claim only walk-offs get strong vibration when other celebrations call it too. |
| `src/ui/screens/Settings.tsx:271` | **Off. Nothing hums.** | **Vibration is off.** |
| `src/ui/screens/Settings.tsx:290` | **The game always models everything ... This decides how much of it you are asked about.** | **Choose which decisions to make yourself and which to leave to your staff.** |
| `src/ui/screens/Settings.tsx:294`, `:297` | **Full control** / **Depth** | Use **Full control / Casual** consistently in setup and settings; label the choice **Play mode** to distinguish it from coaching philosophy. |
| `src/ui/screens/Settings.tsx:322` | **your choice, not the preset** | A small **Custom** label, if this distinction is necessary. |
| `src/ui/screens/Saves.tsx:197` | **as they stand right now ... filed under a name of your own and left alone from then on. Take one before anything you might want to come back from.** | **Save a copy of your dynasty to return to later.** Keep school, season and record as a separate summary. |
| `src/ui/screens/Saves.tsx:204` | School/year placeholder, but no explicit accessible input name | Add a visible and accessible **Save name** label; the placeholder may remain an example. |
| `src/ui/screens/Saves.tsx:264` | **The game writes your career down on its own as you play, so this list fills itself. Copies you take by hand appear here too.** | **No saves yet. Your dynasty saves automatically as you play.** Show a **New dynasty** action if relevant. |
| `src/ui/screens/Saves.tsx:298` | **Each screen introduces itself ... every screen teaches again ...** | **Replay the tutorials.** Better still, keep tutorial controls in Settings so this page only handles saves. |
| `src/ui/screens/Saves.tsx:309` | **THEY WILL SHOW AGAIN** | **TUTORIALS RESET**. |
| `src/ui/screens/Saves.tsx:324` | **A new world, a new job and a coach of your own ... the autosave belongs to whichever dynasty is being played.** | **Starting a new dynasty replaces the autosave. Save a copy to keep this career.** |
| `src/ui/screens/Saves.tsx:352` | Long explanation of recreating the autosave | **Delete the current autosave? Playing this dynasty again will create a new autosave.** |
| `src/ui/screens/Saves.tsx:355` | **KEEP IT / DELETE IT** | **Cancel / Delete save**. Plain, explicit destructive action. |
| `src/ui/screens/Saves.tsx:367` | **A new world is built from scratch and takes over the autosave.** | **Starting a new dynasty replaces your current autosave.** |
| `src/ui/screens/Saves.tsx:369` | **if you have not saved a copy of this career, it goes when the new one starts.** | **Save a copy of {school}, {year} before continuing if you want to keep it.** |
| `src/ui/screens/Saves.tsx:372` | **NOT YET / BUILD A NEW WORLD** | **Cancel / Start new dynasty**. |
| `src/ui/screens/Saves.tsx:417` | **AUTOSAVE · THE CAREER IN PROGRESS** | **AUTOSAVE**. |
| `src/ui/screens/Saves.tsx:445` | **THE CAREER BEING PLAYED · NEW DYNASTY REPLACES IT** | **Replaced when you start a new dynasty.** |

Keep **Save a copy**, **Load**, **Saving…**, **Reading…**, **just now**, **Text size**, **Theme**, **Motion**, and the ordinary size choices. They are clear already.

## Errors and recovery

| Source | Current wording / excerpt | Proposed treatment |
|---|---|---|
| `src/ui/App.tsx:333` | **Save is unreadable** | **Couldn't open this dynasty.** |
| `src/ui/App.tsx:337` | **The dynasty on this device points at a program that is not in the world any more. Start a new one to carry on.** | **This save is missing its team data.** Offer another save when recovery navigation is available. Don't suggest the coach simply carry on after losing a career. |
| `src/ui/App.tsx:361`, `:365` | **Cannot reach your saves** + guessed browser causes | **Can't access your saves.** Then **Try again. If it keeps happening, check that site storage is allowed for Playball.** Put secondary troubleshooting in expandable help. |
| `src/ui/App.tsx:372` | **You can play anyway — nothing will be saved between sessions.** | **You can play, but progress will be lost when this page closes.** |
| `src/ui/App.tsx:385` | **PLAY WITHOUT SAVING** | Keep. The consequence is explicit. |
| `src/ui/App.tsx:396` | **BUILDING THE LEAGUE…** | Fine during actual world creation. Use **Loading your dynasty…** during loading; the same generic message should not describe every boot operation. |
| `src/ui/App.tsx:740` | **NOT SAVED · TAP TO TRY AGAIN** | **Save failed. Tap to retry.** Keep it visible until saving succeeds. |
| `src/ui/App.tsx:747` | **The last write to this device did not complete.** | **Your latest progress hasn't been saved.** |
| `src/ui/screens/Saves.tsx:151`, `:155` | **This browser will not let the game store anything** + 49-word explanation | **Saving is unavailable.** / **Your current progress will be lost if you close this page.** Then a working **Retry** action. |
| `src/ui/screens/Saves.tsx:164`, `:171` | **The last save did not go through** / **It is not on disk.** | **Save failed. Your latest progress is still open, but hasn't been saved.** |
| `src/ui/screens/Saves.tsx:177`, `:178` | **A save would not open** + assumed version explanation | **Couldn't load this save.** Use a specific explanation only when the cause is known. |
| `src/state/store.ts:5199`, `:5223`, `:5438`, `:5457` | Raw exception messages can reach user-facing notices | Map error categories to a short message and a real next step. Preserve diagnostics in optional technical details. |
| `src/state/persistence.ts:301`, `:542` | **the browser did not open local storage within four seconds**; schema/build numbers | Translate at the UI boundary to **Can't access your saves** or **This save needs a newer version of Playball**, as appropriate. |
| `src/state/simClient.ts:43`, `:44`, `src/state/simWorker.ts:44` | **the simulation worker crashed**, **unreadable message**, **a schedule that cannot finish** | **The simulation stopped.** Keep diagnostic details separately, and don't route to a save-only retry. |
| `src/state/seasonCodec.ts:40` | **this generator cannot be serialized: it has no state()** | Technical diagnostic, not product prose. If surfaced through a save error, use the save-failure message. |
| `src/ui/screens/Placeholder.tsx:10`, `:23` | **Transfer portal, both directions. Not built.** / **Not built yet.** | Fallback only; the portal exists. Use **This screen isn't available.** and a working return action; don't expose a raw route ID. |

Shortening must not remove the autosave replacement warning, permanent deletion warning, or the warning about playing without saving. No baseball jokes in these states.

## Dashboard needs and celebrations

| Source | Current wording / excerpt | Proposed wording or treatment |
|---|---|---|
| `src/ui/Needs.tsx:276` | **Needs your eye** | **Needs you** or **To do**. One stable name. |
| `src/ui/Needs.tsx:152` | **Batting {n} in tonight's nine ... Nobody is moved for you — swap him out on the lineup.** | **Batting {n} · {reason}. Replace him before the next game.** |
| `src/ui/Needs.tsx:173`, `:174` | **is fit again** / **Your call, but make it on the lineup.** | **{Name} is cleared to play.** / **He's available for your lineup.** |
| `src/ui/Needs.tsx:195` | **The chart covers him while he heals.** | Keep the injury and return estimate; explain a replacement only when one is actually assigned. |
| `src/ui/Needs.tsx:215`, `:217` | **Nobody wears the C** / **3 men in this room have the makeup for it. A captain stops a bad month becoming a bad year.** | **Pick a captain.** / **{n} players are eligible.** Optional help: **Captains steady morale swings.** |
| `src/ui/Needs.tsx:241`, `:243` | **is failing** / **Short of where he needs to be, and one bad week from missing a series.** | **{Name}'s grades need attention.** / **He's at risk of missing games. Talk to him before the next game.** Respect the actual blocking state. |
| `src/ui/Needs.tsx:245` | **He works it out or he sits.** | **No academic talks left this season. He's still at risk of missing games.** |
| `src/ui/Needs.tsx:111`, `:155`, `:197`, `:221` | **GO IN / THE LINEUP / HIS CARD / NAME ONE** | These `cta` fields are currently not rendered by `NeedsYou`. If reused, choose **Answer press / Edit lineup / View player / Pick captain**. Don't count them as visible buttons today. |
| `src/ui/BigMoment.tsx:23` | **THE SHOWDOWN IS YOURS** | **HEADED TO THE FINAL**. Names the achievement. |
| `src/ui/BigMoment.tsx:29` | **wins it in the last at-bat.** | **wins it!** The name and score already carry the event. |
| `src/ui/BigMoment.tsx:30` | **ends it. There was no next at-bat.** | **walks it off.** Enough when the opponent's name is shown. |
| `src/ui/BigMoment.tsx:31` | **The banner goes up in your building.** | **Make room for a banner.** Small, earned flourish. |
| `src/ui/BigMoment.tsx:33` | **Two teams left in the country. Yours is one.** | Keep or shorten to **One series from the title.** This moment can carry a little drama. |
| `src/ui/BigMoment.tsx:34` | **Everything the program is for, and it happened this June.** | **You did it, coach.** Let the title and trophy do the rest. |
| `src/ui/BigMoment.tsx:35` | **The last series of the year went the other way.** | **That one hurts.** The visible runner-up label explains the result. |
| `src/ui/BigMoment.tsx:39`, `:40`, `:41` | **TAKE THE TROPHY / WALK IT OFF / CARRY IT HOME** | **Take the trophy** can stay. Use **Continue** after a loss; don't force the player to perform a pun. |
| `src/ui/Chrome.tsx:45` | **{name} club card** | Accessible name **View {name} team**. Match the action and ordinary terminology. |
| `src/ui/CoachPortrait.tsx:40` | **TASH** | **Mustache**. **Clean-shaven** is clearer than **CLEAN**; **Full beard** is clearer than **FULL**. |
| `src/ui/components/Kit.tsx:143` | **Nothing here** | Keep as a last-resort fallback only; callers should supply a meaningful empty state such as **No games yet**. |

## Store-generated notifications

These are actual display strings from the state layer, not comments. Headlines should report the event; bodies should add a consequence or useful detail. Navigation belongs in the card action, not a sentence about where another screen lives.

| Source | Current wording / excerpt | Proposed wording or treatment |
|---|---|---|
| `src/state/store.ts:1430` | **The board is delighted / satisfied / expected more / not happy** | Use short consistent grades such as **Exceeded expectations / Met expectations / Below expectations / Well below expectations**. Let the AD's note carry character. |
| `src/state/store.ts:1470` | **{school} sack {coach}** | **{school} fires {coach}**. Adopt American baseball English consistently. |
| `src/state/store.ts:1484` | **Outside your conference. The full picture is on the rankings table.** | **{n} more coaching changes nationwide.** Give the card a relevant destination. |
| `src/state/store.ts:1559` | **Six in a row / Ten straight** | Keep. Short, specific and natural. |
| `src/state/store.ts:1561` | **Five straight defeats / Nine straight defeats** | **Five straight losses / Nine straight losses**. |
| `src/state/store.ts:1685` | **He is short of where he needs to be in the classroom and misses the week. Whoever is next on the depth chart plays.** | **Out this week because of grades.** Add replacement guidance that matches manual versus staff control. |
| `src/state/store.ts:1707`, `:1709` | **About {days} days. Nobody is moved for you — choose his cover on the chart.** | **Out about {days} days. Choose a replacement in your lineup.** Branch for staff-controlled careers; don't point a manual lineup fix at the wrong screen. |
| `src/state/store.ts:1739`, `:1740` | **is fit again** / **He does not walk back into the nine on his own ...** | **{Name} is cleared to play. Add him back to your lineup when you're ready.** |
| `src/state/store.ts:1774` | **It is in the book under your program now.** | Delete. The record title and detail already tell the story. |
| `src/state/store.ts:1794` | **{run} straight wins. The country's tables are on the season tab.** | **{run} straight wins. Keep it rolling.** Make standings the action if useful. |
| `src/state/store.ts:1795` | **{run} in a row the wrong way. The schedule says where it went.** | **{run} straight losses.** A player on a losing streak doesn't need an instruction disguised as a wisecrack. |
| `src/state/store.ts:1809`, `:1810` | **Number one in the country** / RPI result | Prefer **No. 1 in RPI** so the headline names the ranking. Keep record and rank. |
| `src/state/store.ts:1839`, `:1840` | **Halfway, and the board is watching** / lengthy pace comparison | **Midseason check-in** / **{record}. On pace for {projected} wins; the board wants {target}.** |
| `src/state/store.ts:2153` | **{name}, the number one recruit in the country, is coming here.** | **The nation's No. 1 recruit, {name}, committed.** |
| `src/state/store.ts:2429`, `:2432` | **men go into the hall** / **The plaques are on the program page, under HALL OF FAME.** | **{n} Hall of Fame inductees**. Keep names and achievements; link to the hall without narrating the menu. |
| `src/state/store.ts:2571` | **{name} went first overall. Nobody in the country was taken ahead of one of yours.** | **{name} went No. 1 overall.** The second sentence only defines the first. |
| `src/state/store.ts:2580`, `:2581` | **of your men drafted** / long explanation of the next step and budget | **{n} players drafted.** / **Try to bring them back before leaving the draft. Talks use recruiting points.** Preserve the nonrefundable cost beside the actual choice. |
| `src/state/store.ts:2603` | **One of your men picked something up** | **New player badge** / **{n} new player badges**. Avoid a headline that could mean an injury or illness. |
| `src/state/store.ts:2605` | **Earned from what they did last spring, or worked on over the winter.** | Remove the generic explanation; show which badge each player earned. |
| `src/state/store.ts:2984` | **Coaches around the country notice a pattern where they forgive an accident ...** | **{n} seasons below expectations. Coach prestige −{penalty}, in addition to this season's result.** |
| `src/state/store.ts:3048` | **The seat is open, and the market has names.** | **You need a new {role}.** |
| `src/state/store.ts:3146` | **the board said yes before the phone was down ... Somebody goes the other way.** | **You're joining {conference}. {school} moves to {other conference}.** Keep a short celebratory headline when the user is promoted. |
| `src/state/store.ts:3277` | **You wrote to them. They would like to talk.** | **They want to interview you.** |
| `src/state/store.ts:3306` | **Your agent flagged it. The chair can be won.** | **Your agent thinks you've got a shot.** |
| `src/state/store.ts:3393` | **{school} want to talk to you** | **Interview request: {school}**. |
| `src/state/store.ts:3477` | **He was in the portal and he is not any more.** | **He's withdrawn from the transfer portal.** |
| `src/state/store.ts:3511` | **From {school}. He is eligible immediately.** | **Transfers from {school}. Eligible immediately.** Keep the eligibility fact. |
| `src/state/store.ts:3532` | **He is on top of it again — {lift} to the good.** | **Academic standing +{lift}. {n} talks left this season.** An increase does not guarantee the player is now academically safe. |
| `src/state/store.ts:3551` | **He will not make anybody happy; he will stop a bad month becoming a bad year.** | **He's wearing the C.** If instructional detail is needed: **Captains steady morale swings.** No guarantee of fixing a season. |
| `src/state/store.ts:3632` | **He will be a step behind there for a season or two, and then he will not.** | **He's learning {position}. Expect a temporary fielding penalty.** Show a precise adaptation duration only if the state supplies it. |
| `src/state/store.ts:3743` | **They moved him on to hire you ... in the chair.** | **You replace {coach}, who went {record}.** |
| `src/state/store.ts:3752` | **The job you left did not stay open long.** | Delete if the headline already names the replacement. |
| `src/state/store.ts:4465` | Long explanation of elimination with advancement | **Eliminated from {stage}. You're still through to {next stage}.** Keep the qualification distinction; being eliminated need not end the season. |
| `src/state/store.ts:4478`, `:4518`, `:4542`, `:4592` | **Still alive / The season is over / tournament champions / regional champions / National champions** | Keep clear result labels. Use one tournament vocabulary across every screen. |
| `src/state/store.ts:4571`, `:4596` | **Through the showdown bracket / Runners-up in the country** | **Through to the national final / National runners-up**. |

## All 22 tutorial pages

Reviewed all 16 tutorial entries and their screen mounts. These are replacement drafts, not instructions to stack 22 more cards on the app. Prefer one short first-visit hint per screen; put tournament format, scouting nuance and advanced strategy behind a clearly named help control. Keep required costs and irreversible consequences beside the action even when tutorials are off.

| Page and source | Existing excerpt | Proposed complete short copy |
|---|---|---|
| Today 1, `src/ui/tutorials.ts:20` | **while you sip your coffee** | **Play ball to manage the game. Sim game or Sim week lets your staff handle it.** |
| Today 2, `:26` | **Nobody ever lost a game by knowing too much.** | **Check the probable starters here. Tap the opponent for their roster and results.** |
| Wire, `:34` | **Every word in here actually happened, which is more than most papers can say.** | **Scores, streaks and big performances from around the country.** Stories aren't interactive; don't tell players to tap them. Avoid claiming all 96 programs play every night. |
| Roster, `:42` | **OVR is what a man is, POT is what he might become if the baseball gods are kind.** | **OVR is current ability. POT is potential. Tap a player for ratings, stats and eligibility.** Do not imply every junior automatically leaves. |
| Lineup 1, `:50` | **The engine reads this card straight, so it counts tonight.** | **Tap two players to swap them, or use Auto lineup. Changes apply to the next game.** |
| Lineup 2, `:56` | **Keep the pen rested and it will keep you employed.** | **Set your weekend starters and midweek arm here. Keep the pen rested and it will keep you employed.** One earned joke, with the control instruction separate. |
| Stats, `:64` | **Plays above average is the honest number.** | **Compare your players with the national leaders. Fielding includes errors and plays above average.** Explain metric definitions in column help. |
| Schedule, `:72` | **Finish top six ... Finish seventh and you get very good at golf.** | **45 games. Finish in your conference's top eight to qualify for its tournament.** Take the rest of the format out of this card. |
| Program, `:80` | **Clear it and they extend you. Miss it and the seat gets warm.** | **Track the board's goals and your job security here.** Avoid promising an automatic extension from completing a checklist. |
| Coach, `:88` | **which phones ring ... wherever the road goes** | **Your record, skills and achievements follow you between jobs. More prestige opens more doors.** |
| Manage 1, `:96` | **SWING AWAY never hurt anybody ... spends a man for the night** | **Call plays below the game log. Open Manager tools for substitutions, pitching changes and mound visits.** Put re-entry rules in the substitution dialog. |
| Manage 2, `:103` | **the ball goes where it went ... save it for the blowouts** | **Sim the rest finishes this game without more decisions from you.** The live field animation doesn't need prose explaining that it depicts the play. |
| Postseason 1, `:111` | **Three championships, stacked.** | **Eight teams enter each conference tournament. It's double elimination. The top four finishers advance to regionals.** |
| Postseason 2, `:118` | **Regionals and the big dance** + full format paragraph | In **Tournament format** help: **Regionals are best-of-three. Sixteen regional winners join protected and at-large teams in the 20-team national field. Two double-elimination brackets send their winners to a best-of-three final.** Current code creates two ten-team brackets, not a separate knockout round reducing 20 to 16 (`src/engine/postseason.ts:806`). Protected teams already qualified through regionals are deduplicated, with at-large teams filling remaining places (`:739`). |
| Postseason 3, `:125` | **The toggle is your friend** | **Winners bracket: no losses. Losers bracket: one loss.** Put the protected-bid rule in format help; explain that a conference loss can coexist with an onward bid. |
| Awards, `:133` | **the coach who squeezed the most out of the least** | **This season's award winners. Tap a player to see his numbers.** Don't invent a coach-award criterion here. |
| Review, `:141` | **Every number on this page is a door** | **Your season, the board's verdict and your updated prestige.** Show links as links instead of explaining them metaphorically. |
| Coach points, `:149` | **Once you leave this step the ink dries.** | **Spend points to improve your coaching skills. You can undo spending until you leave this step.** Don't say unspent points expire unless the rules are changed to do that. |
| Draft, `:157` | **The pros came shopping ... Sweet-talking isn't free.** | **The pros came shopping. You can try to keep eligible players, but every pitch costs recruiting points—even if they leave.** Keep specific cost and departure-on-continue warning by the decision. |
| Recruiting 1, `:165` | **Fifty points a week ... Points carry over** | **Spend this week's points on recruits. Interest builds across the three weeks; unused weekly points don't carry over. End the week when you're ready.** |
| Recruiting 2, `:171` | **scout's guess, not gospel ... pick up the phone a rung earlier** | **Ratings are estimates. Recruiting skill narrows the ranges, and in-state recruits are easier to reach.** Distinguish coach home state from program state based on `inPipeline`'s actual call; currently pursuing uses the program's state. |
| Signing, `:179` | **what you actually bought ... vanish like a September call-up** | **Meet your new class. Walk-ons fill the remaining roster spots for one season.** |

Keep **Skip**, **Next**, **Got it**, and accessible tutorial names. Rename **FIRST TIME HERE** to **QUICK TIP** so resetting a tutorial doesn't greet a returning player as a first-timer. Reducing reading load must include optional help, not just making an unavoidable card slightly shorter.

## Coverage ledger for this scope

| Files | Disposition |
|---|---|
| `src/ui/App.tsx` | Navigation, loading, load/save failures, overlays and menu copy reviewed; rewrites above. |
| `src/ui/Needs.tsx`, `BigMoment.tsx`, `Tutorial.tsx`, `tutorials.ts` | All authored user text and branches reviewed. Unrendered `cta` values distinguished from visible text. |
| `src/ui/screens/Settings.tsx`, `Saves.tsx`, `Placeholder.tsx` | All labels, hints, notices, confirmations, empty/loading states and fallback text reviewed. |
| `src/ui/Chrome.tsx`, `CoachPortrait.tsx`, `components/Kit.tsx` | Accessible labels, appearance options and shared empty state reviewed. |
| `src/ui/DoubleElimMap.tsx`, `LineScore.tsx`, `Modal.tsx`, `Overlay.tsx`, `PlayerName.tsx`, `StepRail.tsx`, `Sticky.tsx`, `format.ts`, `replay.ts` | Standard baseball labels, dates, supplied content and accessible navigation. Keep, while applying shared tournament naming. No additional narrative rewrite. |
| `src/ui/Avatar.tsx`, `Crest.tsx`, `Diamond.tsx`, `Diamond3D.tsx`, `accent.ts`, `celebrate.ts`, `sound.ts` | Scanned; visual/audio implementation, imported data, event identifiers or technical strings rather than additional authored prose. |
| `src/state/store.ts` | All extracted literals/templates scanned; displayed navigation, notifications and failure paths reviewed above. Source comments excluded. |
| `src/state/depth.ts` | All 15 system labels and both control-state blurbs reviewed. Keep literal role/feature names, trim metaphors: **Set the lineup / Staff sets the lineup**, **Choose starters and relievers / Pitching coach handles pitching**, **Spend coaching points / Staff spends your points**, **Handle draft talks / Staff handles draft talks**, **Recruit players / Staff recruits players**, **Call mound visits / Pitching coach calls visits**, **Scout opponents / Staff scouts opponents**, **Answer the press / Staff answers the press**, **Hire assistants / Athletic director hires assistants**, **Pick a captain / Team picks a captain**, **Choose redshirts / Staff chooses redshirts**, **Set the depth chart / Staff sets the depth chart**, **Manage transfers / Staff manages transfers**, **Manage facilities and budget / Athletic director manages the budget**. Pitch calling is currently unavailable; don't promise future delivery timing. Verify each delegation description against actual automation when implementing. |
| `src/state/devicePrefs.ts` | Text-size labels are clear. Other strings are preference keys and implementation details. |
| `src/state/persistence.ts`, `seasonCodec.ts`, `simClient.ts`, `simWorker.ts` | Internal errors audited through their user-visible consumers. See recovery recommendations. |
| `src/state/liveJournal.ts`, `world.ts` | No independent narrative copy; technical state and adapters. |
| `src/main.tsx`, `index.html`, `src/ui/*.css`, `public/` | Entry point/title, generated CSS text and public assets checked. **Playball** is fine. CSS generated content is decorative; public audio assets/credits add no authored on-screen instructions to this browser product. |

Accessible copy is part of the voice pass: keep functional names for controls even when nearby headlines are playful. The captured setup exposes color swatches as hex codes, and the save-name field lacks an explicit accessible name. Use meaningful color names and a proper **Save name** label. This is a copy/label finding, not a claim of a full accessibility audit.
