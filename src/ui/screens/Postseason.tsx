// Postseason.tsx
// June, in three championships.
//
// CONFERENCE: eight of twelve into a double elimination, top four finishers
// advance, the champion hangs a banner. REGIONALS: sixteen best-of-three
// championship series crossing neighbouring conferences, sixteen banners.
// NATIONAL: those sixteen champions plus four protected or at-large bids,
// twenty in all — split into two ten-team double eliminations whose bottom
// four apiece play their way in, and the two bracket champions play a
// best-of-three for the country.
//
// The screen's rules, all reported from testing: the explanatory card is
// gone and the brackets own the room it ate; winners and losers are two
// views under a toggle rather than one giant map; every bracket card wears
// its school's colour; and the action button is pinned to the frame so it
// sits in the same place whatever tab is up.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDynasty, useUserTeam, type NationalProgress } from '../../state/store.js';
import { FloatingAction } from '../Sticky.js';
import { Modal } from '../Modal.js';
import { IdCardIcon } from '@radix-ui/react-icons';
import { ModuleIntro, Segmented } from '../components/Kit.js';
import { Lineup } from './Lineup.js';
import { Crest } from '../Crest.js';
import { era, injuryClock } from '../../engine/season.js';
import type { SeasonState } from '../../engine/season.js';
import type { Hitter } from '../../engine/types.js';
import { available } from '../../engine/depthChart.js';
import { handles } from '../../state/depth.js';
import { whyOut } from '../Needs.js';
import { DoubleElimMap, type DECols } from '../DoubleElimMap.js';
import { BoxScoreSheet } from './Schedule.js';
import { teamColour } from '../Avatar.js';
import {
  conferenceField, liveSeries, nextGameFor, hostOfGame, roundName, clincher,
  regionOf, REGIONS, CONF_FIELD, CONF_ADVANCE, NATIONAL_BIDS,
} from '../../engine/postseason.js';
import type {
  Series, SeriesBracket, RegionalSeries, ConferenceTournament, TournamentResult,
} from '../../engine/postseason.js';
import {
  liveSlotFor, slotName, nextRoundName,
  type DoubleElim, type DESlot,
} from '../../engine/doubleElim.js';
import { FirstVisit } from '../Tutorial.js';

type JuneTab = 'next' | 'bracket';
type NatHalf = 'A' | 'B';

/*
  The tabs remember themselves across an unmount — managing a game covers
  this screen, and coming back to a different tab than you left reads as the
  screen forgetting you. Module scope on purpose: session-long, never saved,
  exactly the lifetime a view preference deserves.

  These replaced the winners/losers toggles in the redesign the reporter
  settled in the sorting session (`06` §U): "instead of having two tabs
  called winners and losers... a next game and bracket tabs." The bracket
  draws both halves of a double elimination stacked — one map — so nobody
  ever has to remember which side they are on; the only half-toggle left is
  the national's A/B, because those genuinely are two separate rooms.
*/
let juneTabMemo: JuneTab = 'next';
let natHalfMemo: NatHalf | null = null;

export function Postseason() {
  const [modal, setModal] = useState<'in' | 'out' | 'title' | null>(null);
  const [showLineup, setShowLineup] = useState(false);
  /*
    A nav tap stands the takeovers down.

    June renders this component in place for the whole month, so the lineup
    card and a stage review — full-screen overlays held in local state —
    survive a tap on JUNE in the bottom bar: the store changes tab and
    screen, the render tree comes back identical, and the card is still
    covering it. Reported from the phone: "if you tap set up lineup during
    the postseason and then try to go back to the Home Screen it won't let
    you — you go to any other first." The store counts nav taps now, and a
    new count closes whatever is standing.
  */
  const navEpoch = useDynasty((st) => st.navEpoch);
  const epochSeen = useRef(navEpoch);
  useEffect(() => {
    if (epochSeen.current === navEpoch) return;
    epochSeen.current = navEpoch;
    setShowLineup(false);
    setReviewing(null);
  }, [navEpoch]);
  /*
    A bracket game, opened.

    Box scores are stored only for the user's own program, so this is honest
    about what it can offer: a slot whose day has a box shows the whole game,
    and everything else stays a score. Storing every line for ninety-six
    programs would put tens of thousands of rows in a save to serve a screen
    almost nobody opens for a game they were not in.
  */
  const [openDay, setOpenDay] = useState<number | null>(null);
  /*
    Which stage is on screen, which is not always the stage being played.

    Reported: won the conference, went on to the regionals, and wanted to look
    back at the conference bracket. There was no way to. June had exactly one
    view -- whatever was live -- and the two tournaments already decided simply
    stopped existing, which is a strange thing for a screen whose whole subject
    is what happened in June.

    Null means "follow the tournament", so the common case needs no state and a
    stage advancing under you still moves the screen with it.
  */
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [juneTab, setJuneTab0] = useState<JuneTab>(juneTabMemo);
  const setJuneTab = (v: JuneTab): void => { juneTabMemo = v; setJuneTab0(v); };
  // Null until the reader picks one; the default is whichever half is yours.
  const [natHalf, setNatHalf0] = useState<NatHalf | null>(natHalfMemo);
  const setNatHalf = (v: NatHalf): void => { natHalfMemo = v; setNatHalf0(v); };

  const season = useDynasty((s) => s.season);
  const bracket = useDynasty((s) => s.bracket);
  const myBracket = useDynasty((s) => s.myBracket);
  const sideShow = useDynasty((s) => s.sideShow);
  const pendingGame = useDynasty((s) => s.pendingGame);
  const resumeGame = useDynasty((s) => s.resumeGame);
  const advance = useDynasty((s) => s.advanceBracket);
  const manage = useDynasty((s) => s.manageBracketGame);
  const sim = useDynasty((s) => s.simBracket);
  const openStage = useDynasty((s) => s.openStage);
  const userTeam = useDynasty((s) => s.userTeam);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();
  const knockout = useDynasty((s) => s.knockout);
  const seen = useDynasty((s) => s.postseasonSeen);
  const depth = useDynasty((s) => s.depth);
  const markSeen = useDynasty((s) => s.markPostseasonSeen);
  const version = useDynasty((s) => s.version);
  void version;

  // Opening a stage is not a decision, so it is not a press.
  useEffect(() => { openStage(); }, [openStage, bracket?.stage, version]);

  /*
    The screen goes where you are.

    Losing in the winners bracket moves you to the losers side, and the screen
    used to stay looking at the half you had just left -- so the most important
    thing that had happened to you all week was somewhere you had to go and
    find. Reported as wanting the view to move, smoothly, so you can see where
    you now are.

    It follows rather than jumps: the toggle is a real control and somebody who
    has deliberately gone to look at the other half should be left there. So
    this only fires when the side you are *playing on* changes, which is once a
    tournament at most, and the map fades in under it -- which it now actually
    does. This comment described the fade for weeks before one existed.
  */
  /*
    The follow-the-side effect lived here — losing in the winners bracket
    used to move the VIEW to the losers side for you. The one-map redesign
    made it meaningless: both sides are on screen, stacked, with your drop
    marked between them. What elimination does move is the tab — a knocked
    out team has no next game, so the pregame show yields to the bracket.
  */
  const nowOut = myBracket ? myBracket.state.eliminated.includes(userTeam) : false;
  useEffect(() => {
    if (nowOut) setJuneTab('bracket');
  }, [nowOut]);

  /*
    Two different questions, and conflating them was half the bug.

    `reported` is "there is an elimination this year that has not been shown" —
    true whether or not it ended the season, because losing a conference final
    and going on to a regional is still news. `knockedOut` is "your June is
    over", which an advancing exit is not. The screen used to ask the first and
    act on the second, so a team that advanced spent the rest of the postseason
    being treated as finished.
  */

  const reported = knockout !== null && knockout.year === year;
  const knockedOut = reported && !knockout!.advanced;
  const iAmOut = myBracket
    ? myBracket.state.eliminated.includes(userTeam)
    : knockedOut;
  const stageKey = bracket?.stage ?? '';

  const stillIn = myBracket !== null && !knockedOut;
  const mySeed = season && team
    ? conferenceField(season, team.conference).field.indexOf(userTeam) + 1
    : 0;
  const inTheField = mySeed > 0;
  const introKey = `${year}:in:${stageKey}`;
  // No out card for the national final: the runner-up takeover from
  // closeMyBracket already owns that beat, and "select better which one
  // stays" is the instruction this whole cull answers.
  const outKey = reported && knockout && knockout.kind !== 'final'
    ? `${year}:out:${knockout.kind}` : '';

  /** Whether the tier on screen is finished, and whether you won something. */
  const nat = bracket?.national ?? null;
  const stagePlayed = bracket
    ? (bracket.stage === 'conference' ? bracket.cups.length >= 8
      : bracket.stage === 'regional' ? bracket.regionals.length >= 16
      : nat !== null && nat.final !== null)
    : false;
  const wonConference = bracket?.cups.some((c) => c.champion === userTeam) ?? false;
  const wonRegional = bracket?.regionals.some((r) => r.champion === userTeam) ?? false;
  const wonTitle = nat?.final?.champion === userTeam;

  /*
    A title game, announced before it is played.

    Reported as wanting a modal when a competition's championship is on, rather
    than the game being one more card inside a bracket. It is the same surface
    as the trophy card by design — the request was for one thing that changes
    state, not two things to dismiss — so this says who, what is at stake and
    what winning takes, and the crown card above takes over once it is decided.

    Fires once per title game and never again, keyed like every other card June
    raises. A modal that reappeared every time you came back to the bracket
    would be a modal you learn to tap through without reading.
  */
  const titleGame = (() => {
    if (!myBracket || iAmOut || !season || !team || !bracket) return null;
    const stake = (extra: string): string[] => [extra];
    if (myBracket.format === 'double') {
      const slot = liveSlotFor(myBracket.state, userTeam);
      if (!slot || slot.side !== 'F' || slot.a === null || slot.b === null) return null;
      const other = slot.a === userTeam ? slot.b : slot.a;
      const losses = myBracket.state.losses.get(userTeam) ?? 0;
      const where = bracket.stage === 'conference' ? `${team.conference} championship`
        : 'Bracket championship';
      return {
        key: `${year}:title:${stageKey}:${slot.round}`,
        kicker: `${year} · ${where.toUpperCase()}`,
        title: `${team.def.school} v ${(season.teams[other]?.def.school ?? '?')}`,
        lines: stake(losses === 0
          ? 'You arrived unbeaten. Win one and it is yours.'
          : 'You came through the losers bracket. You must win this one AND the next.'),
      };
    }
    if (myBracket.kind !== 'regional' && myBracket.kind !== 'final') return null;
    const s = liveSeries(myBracket.state, userTeam);
    const next = nextGameFor(myBracket.state, userTeam);
    if (!s || !next) return null;
    const other = next.a === userTeam ? next.b : next.a;
    const len = myBracket.state.lengths[s.round] ?? 3;
    const wins = (t: number): number => s.games.filter((g) => g.winner === t).length;
    const isFinal = myBracket.kind === 'final';
    return {
      key: `${year}:title:${myBracket.kind}`,
      kicker: isFinal ? `${year} · NATIONAL CHAMPIONSHIP` : `${year} · REGIONAL CHAMPIONSHIP`,
      title: `${team.def.school} v ${(season.teams[other]?.def.school ?? '?')}`,
      lines: stake((() => {
        const mine = wins(userTeam);
        const theirs = wins(other);
        const standing = mine === theirs
          ? (mine === 0 ? '' : ` Level at ${mine}-${theirs}.`)
          : mine > theirs ? ` You lead it ${mine}-${theirs}.` : ` You trail it ${mine}-${theirs}.`;
        return `Best of ${len}, first to ${clincher(len)}.${standing}`;
      })()),
    };
  })();

  useEffect(() => {
    if (!bracket) return;
    if (outKey && !seen.includes(outKey)) {
      markSeen(outKey);
      setModal('out');
      return;
    }
    if (stageKey === 'conference' && (inTheField ? stillIn : true)
      && !seen.includes(introKey)) {
      markSeen(introKey);
      setModal('in');
      return;
    }
    // Last, because a trophy and an exit both outrank the game in front of you.
    if (titleGame && !seen.includes(titleGame.key)) {
      markSeen(titleGame.key);
      setModal('title');
    }
  }, [bracket, stageKey, outKey, introKey, seen, markSeen, stillIn, inTheField,
    titleGame]);

  if (!season || !team || !bracket) return null;

  /*
    Opening a bracket game.

    A slot carries the day its game was played, and box scores are filed by
    day — so the lookup is exact rather than a search, and it simply finds
    nothing for a game between two programs that are not yours. Nothing is a
    perfectly good answer here: the score is already on the card.
  */
  const openSlot = (slot: DESlot): void => {
    const day = slot.game?.day;
    if (day === undefined) return;
    if (!season.boxScores?.[day]) return;
    setOpenDay(day);
  };

  const name = (i: number): string => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';

  /*
    The trophy this stage has already handed out, if it has.

    Deliberately the *stage's* champion rather than only the user's: somebody
    else winning the country is still the biggest thing that happened, and the
    old screen's answer to it was a stripe at the foot of the page. A rival's
    title is a quiet card and yours is a loud one, which is the difference
    between reporting the news and celebrating.
  */
  const crown: Crown | null = (() => {
    if (!bracket) return null;
    if (bracket.stage === 'national') {
      const champ = nat?.final?.champion;
      if (champ === undefined) return null;
      return {
        team: champ, rung: 2,
        kicker: `${year} NATIONAL CHAMPIONS`,
        title: 'Champions of the country',
        line: champ === userTeam
          ? 'Everything this season was for.'
          : 'Somebody else takes it home this year.',
      };
    }
    if (bracket.stage === 'regional') {
      const mineRegional = bracket.regionals.find((r) => r.champion === userTeam);
      if (!mineRegional) return null;
      return {
        team: userTeam, rung: 1,
        kicker: `${year} REGIONAL CHAMPIONS`,
        title: 'A regional banner',
        line: 'On to the national tournament.',
      };
    }
    const mineCup = bracket.cups.find((c) => c.champion === userTeam);
    if (!mineCup) return null;
    return {
      team: userTeam, rung: 0,
      kicker: `${year} ${mineCup.conference} CHAMPIONS`,
      title: 'Conference champions',
      line: 'The league is yours.',
    };
  })();

  const rung = bracket.stage === 'conference' ? 0
    : bracket.stage === 'regional' ? 1 : 2;
  const shown = reviewing ?? rung;

  /*
    keepYouCentred: after the map is swapped, put your own team back under the
    reader's eyes.

    Reported twice. The first answer was a fade, and it was still wrong -- "it
    just disappears and appears somewhere else" -- because the animation was
    never the whole problem. The winners map and the losers map are different
    heights and your team sits at a different depth in each, so a swap that
    keeps the scroll offset lands you at whatever happens to be at that pixel.
    Fading it in only made the wrong place arrive politely.

    So the box carrying your team is marked in the DOM (see DoubleElimMap's
    `youAnchor`) and the scroller is nudged until it is in the middle. Measured
    with rects rather than `offsetTop`, which is relative to whichever ancestor
    happens to be positioned, and scrolled with `scrollBy` on the scroller
    itself so no ancestor is dragged along with it.

    Runs on the side you are *looking at* rather than the side you are playing
    on, because a reader who taps the toggle deliberately wants centring just as
    much as one the bracket moved by itself.
  */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // The stage on the screen, not the stage the tournament is on -- the rail
  // lets you walk back to a finished one, and centring is just as owed there.
  const lookingAt = `${juneTab}:${natHalf ?? ''}`;
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    let frame = 0;
    {
      /*
        Measured in a layout effect, which is the whole reason this is not a
        `useEffect` with a `requestAnimationFrame` inside it.

        That is what it was, and it could not run: rAF does not fire in a tab
        that is not compositing, so the measurement never happened and the map
        stayed where it was. Layout is already committed by the time this runs,
        so the rects are correct without waiting for a frame -- rAF is now only
        used to *animate*, which is the one job it is allowed to fail at.
      */
      /*
        Which of your boxes, which is the whole question.

        Reported after the first version landed: "it didn't take me to where my
        team was in the bracket, which is the main thing." Correct -- and the
        centring was working. You appear in a slot for *every round you play*,
        so `querySelector` was faithfully finding the first one and centring on
        the game you played on Tuesday.

        Where you *are* is the game that has not been decided yet. Failing that
        -- your run is over, or the half on screen is one you have finished --
        the last box you appear in is the furthest you got, which is the thing
        worth looking at.
      */
      const live = scroller.querySelector('[data-you-live]');
      const all = scroller.querySelectorAll('[data-you]');
      const you = live ?? all[all.length - 1] ?? null;
      if (!you) return undefined;
      const sr = scroller.getBoundingClientRect();
      const yr = you.getBoundingClientRect();
      /*
        Leave it alone if you can already see it.

        This started as "move if the box is more than a nudge off centre", which
        is the wrong question twice over. It fights a reader who has deliberately
        scrolled somewhere -- the box is off centre, so it drags the page back --
        and it also means the only time the view follows you is when the toggle
        moves, so simulating a round and watching your live game shift down the
        map left you looking at the wrong part of the bracket.

        Asking whether the box is *visible* fixes both. Off screen, you get
        taken to it; on screen, nothing happens however far off centre it sits.
        That makes it safe to run on every bracket change rather than only on a
        view swap.
      */
      if (yr.top >= sr.top && yr.bottom <= sr.bottom) return undefined;
      const delta = (yr.top + yr.height / 2) - (sr.top + sr.height / 2);

      const reduce = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const from = scroller.scrollTop;
      const to = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, from + delta));
      // Nobody is watching a hidden tab, and its rAF will not fire anyway.
      if (reduce || document.hidden) { scroller.scrollTop = to; return undefined; }

      /*
        Tweened here rather than handed to `behavior: 'smooth'`.

        Measured in the preview browser: `scrollBy({ top, behavior: 'smooth' })`
        moved nothing at all, while the same call without `behavior` moved
        exactly as asked -- so the smooth path fails *silently*, which is the
        worst way for a scroll to fail. Any device that does not implement it
        would land back on the original report, a map that "just disappears and
        appears somewhere else", with nothing in the code looking wrong.

        Two hundred and sixty milliseconds, to match the swap animation running
        over the top of it, on the same curve.
      */
      const START = performance.now();
      const DUR = 260;
      const ease = (t: number): number => (t < 0.5
        ? 4 * t * t * t
        : 1 - ((-2 * t + 2) ** 3) / 2);
      const step = (now: number): void => {
        const t = Math.min(1, (now - START) / DUR);
        scroller.scrollTop = from + (to - from) * ease(t);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    return () => cancelAnimationFrame(frame);
  }, [lookingAt, shown, version]);

  const stageTitle = rung === 0 ? `${team.conference} tournament`
    : rung === 1 ? 'The regionals' : 'The national tournament';

  const qualified = inTheField
    ? {
        good: true,
        title: `${ordinal(mySeed)} seed`,
        lines: [
          `Double elimination — a loss drops you, it does not end you.`,
          `Finish top ${CONF_ADVANCE} and you play a regional.`,
        ],
      }
    : {
        good: false,
        title: 'Season over',
        lines: [
          `${team.def.school} finished outside the top ${CONF_FIELD}.`,
          'A third of the league goes home in May.',
        ],
      };

  /*
    Where the year stopped — or didn't.

    Reported from testing: *"we won the first and lost the second and got
    knocked out."* He had, of that tournament, and the card told him his
    season was over. It was not: second place in a conference tournament goes
    to a regional, and a protected top-four seed reaches the national field
    whatever its regional does. `knockout.advanced` is the store's answer to
    that, worked out at the moment of elimination.

    Kept short on purpose. These cards are read at the loudest moment in a
    season and a paragraph is not read at all.
  */
  const howFar = (() => {
    const kind = knockout?.kind ?? 'conference';
    const where = knockout?.label ? ` in the ${knockout.label}` : '';
    const place = knockout?.placing ?? 0;

    if (kind === 'conference' && knockout?.advanced) {
      const finished = place === 2 ? 'Runners up'
        : place === 3 ? 'Third in the league'
        : 'Fourth in the league';
      return {
        good: true,
        title: finished,
        lines: [
          `${team.def.school} are out of the ${team.conference} tournament.`,
          'But the top four travel. A regional championship series is next.',
        ],
      };
    }
    if (kind === 'conference') {
      return {
        good: false,
        title: 'Out in May',
        lines: [
          `${team.def.school} fall${where} of the ${team.conference} tournament.`,
          'Winter is for getting the bats loud again.',
        ],
      };
    }
    if (kind === 'regional' && knockout?.advanced) {
      return {
        good: true,
        title: 'Protected',
        lines: [
          `${team.def.school} lose the regional championship series.`,
          'The regular season already bought the national field. You travel anyway.',
        ],
      };
    }
    if (kind === 'regional') {
      return {
        good: false,
        title: 'Out at the regional',
        lines: [
          `${team.def.school} lose the regional championship series.`,
          'One series from the national field. Close enough to sting.',
        ],
      };
    }
    if (kind === 'final') {
      return {
        good: false,
        title: 'Runners up',
        lines: [
          `${team.def.school} lose the national championship series.`,
          'Second best in the country, and it still feels like this.',
        ],
      };
    }
    return {
      good: false,
      title: 'Out of the showdown',
      lines: [
        `${team.def.school} take a second loss${where}.`,
        `${NATIONAL_BIDS} reach the showdown. Most of the country never sees it.`,
      ],
    };
  })();


  /*
    The June injury hold — the regular season's rule, kept through the
    tournaments. Reported: "I never get a warning during tournaments, I think
    injuries are not working during tournaments." Half of that is the engine
    (nobody gets hurt IN June — the rolls are staged work, see the backlog);
    this is the other half: a man hurt in May is still hurt tonight, the
    bracket fields the card exactly as written, and nothing here said a word.
    Full careers only, the same rule as NEEDS YOU — the coach who writes the
    card is the one the game waits for.
  */
  const hurtNine = (handles(depth, 'lineups') || handles(depth, 'depthChart'))
    ? team.team.lineup.filter((m) => !available(m, injuryClock(season)))
    : [];

  /** What the pinned button does right now. */
  const due = myBracket
    ? (myBracket.format === 'series'
      ? nextGameFor(myBracket.state, userTeam) !== null
      : liveSlotFor(myBracket.state, userTeam) !== null)
    : false;
  const LIVE_NAME = ['THE CONFERENCE', 'THE REGIONALS', 'THE NATIONAL'];
  const action: {
    label: string;
    run: () => void;
    /** The red line under the button, when the card is holding it. */
    note?: string;
    secondary?: { label: string; onClick: () => void } | null;
  } = reviewing !== null
    // Looking back at a finished tournament. The one thing the button can
    // usefully do is put you back where the season actually is -- advancing
    // the live stage from a screen showing a different one is how somebody
    // plays a round they never saw.
    ? {
        label: `BACK TO ${LIVE_NAME[rung] ?? 'THE TOURNAMENT'}`,
        run: () => setReviewing(null),
      }
    : due
    ? (hurtNine.length > 0
      // Held, exactly the way END WEEK holds: the game will field this card
      // as written, so a hurt man in the nine stops the night until the
      // coach moves him. FIX THE LINEUP opens the same card the YourNext
      // panel does; nothing is moved for you.
      ? {
          label: 'FIX THE LINEUP',
          run: () => setShowLineup(true),
          note: hurtNine.length === 1
            ? `${hurtNine[0]!.name} is in your nine and cannot play — ${whyOut(hurtNine[0]!, injuryClock(season))}. Nobody is moved for you.`
            : `${hurtNine.length} men in your nine cannot play. Nobody is moved for you.`,
        }
      : {
          label: 'PLAY THIS GAME',
          run: manage,
          secondary: { label: 'SIMULATE THIS GAME', onClick: () => sim('game') },
        })
    : myBracket
      ? {
          /*
            The button says which round it is about to play.

            Reported: it said PLAY THE NEXT GAMES and then played the play-in
            and the opening round together, so it was vague about a thing it
            was also wrong about. The engine steps one round now, and the
            button reads that round's own name — the same string the bracket
            column and the log use, so the three cannot drift.
          */
          /*
            Your next game is the primary; the round is the secondary.

            Round by round is honest and is kept, but it is not what anybody
            wants when four of the next five rounds have nothing of theirs in
            them. Asked for directly and asked for as the primary, which is the
            right way round: the reason to be on this screen is your own team.

            Once you are out there is no next game of yours, so the pair
            becomes the round and the whole tournament instead.
          */
          label: iAmOut
            ? (() => {
                const round = myBracket.format === 'double'
                  ? nextRoundName(myBracket.state) : null;
                return round ? `SEE THE ${round.toUpperCase()}` : 'SEE THE NEXT GAMES';
              })()
            : 'SIM TO MY NEXT GAME',
          run: () => sim(iAmOut ? 'round' : 'mine'),
          secondary: iAmOut
            ? { label: 'SIM TO THE END OF THE TOURNAMENT', onClick: () => sim('rest') }
            : {
                label: (() => {
                  const round = myBracket.format === 'double'
                    ? nextRoundName(myBracket.state) : null;
                  return round ? `SIM THE ${round.toUpperCase()}` : 'SIM THE NEXT ROUND';
                })(),
                onClick: () => sim('round'),
              },
        }
      : stagePlayed
        ? {
            label: bracket.stage === 'conference'
              ? (wonConference ? 'ON TO THE REGIONALS' : 'SEE THE REGIONALS')
              : bracket.stage === 'regional'
                ? (wonRegional ? 'ON TO THE NATIONALS' : 'SEE THE NATIONALS')
                : 'END THE SEASON',
            run: advance,
          }
        // The national stage names its own next step, because "CONTINUE" over
        // four different things is how a player ends up looking at a finished
        // tournament wondering when it was played.
        : bracket.stage === 'national'
          ? {
              label: (!nat?.bracketA || !nat.bracketB) ? 'PLAY THE SHOWDOWN'
                : 'PLAY THE CHAMPIONSHIP',
              run: advance,
            }
          : { label: 'CONTINUE', run: advance };

  return (
    <>
      {modal === 'in' && (
        <Modal
          kicker={`${year} POSTSEASON`}
          title={qualified.title}
          lines={qualified.lines}
          tone={qualified.good ? 'win' : 'clay'}
          action={qualified.good ? "LET'S GO" : 'SEE THE REST OF IT'}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'out' && (
        <Modal
          kicker={howFar.good ? `${year} · STILL ALIVE` : `${year} · SEASON OVER`}
          title={howFar.title}
          lines={howFar.lines}
          /*
            Advancing is not winning, and the card must not say it is.

            Reported: finishing runners up in the conference showed a green
            card, and green is what this app uses for a win -- so the screen
            congratulated a team on losing its final. Three states, three
            colours: green only for a trophy, clay for a season that is over,
            and the neutral one for the middle case this card actually
            describes, which is "you lost, and you are still alive".
          */
          tone={howFar.good ? 'ink' : 'clay'}
          action={howFar.good
            ? (knockout?.kind === 'conference' ? 'ON TO THE REGIONAL' : 'ON TO THE NATIONALS')
            : 'SEE THE REST OF IT'}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'title' && titleGame && (
        <Modal
          kicker={titleGame.kicker}
          title={titleGame.title}
          lines={titleGame.lines}
          tone="ink"
          action="TAKE THE FIELD"
          /*
            The button does what it says.

            Reported: "I reached the national final through the winners bracket
            and the screen didn't navigate to where the game was happening --
            the championship bracket is at the very bottom." TAKE THE FIELD only
            closed the card, so it dropped you wherever you happened to be
            standing, which after a week of tapping through brackets is usually
            a stage you were reading rather than the one you are playing.

            Closing it now also puts the page back on the live stage and on the
            half you are actually in. YOUR NEXT GAME sits at the top of that
            view, so the thing the card just announced is the first thing under
            it rather than a scroll away.
          */
          onClose={() => {
            setReviewing(null);
            // The card just announced the game; TAKE THE FIELD lands on it.
            setJuneTab('next');
            setModal(null);
          }}
        />
      )}

      {/* A bracket game, opened. Same sheet the schedule uses, because a
          postseason box score is a box score. */}
      {openDay !== null && season.boxScores?.[openDay] && (
        <BoxScoreSheet
          box={season.boxScores[openDay]}
          season={season}
          onClose={() => setOpenDay(null)}
        />
      )}

      {showLineup && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'var(--field)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            flex: 'none', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '10px 14px',
            borderBottom: '2px solid var(--ink)', background: 'var(--field)',
          }}>
            <div className="label">POSTSEASON · YOUR CARD</div>
            <button
              onClick={() => setShowLineup(false)}
              className="tap"
              style={{
                padding: '8px 14px', minHeight: 36,
                background: 'var(--band)', border: '1px solid var(--ink)',
                color: 'var(--cream)', font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
              }}
            >DONE</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <Lineup />
          </div>
        </div>
      )}

      {/*
        The frame: pinned header (title + stage nav + secondary toggle),
        scrolling brackets, and the action button OUTSIDE the scroller so it
        holds its position whatever tab is up and however long its content is.
      */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <FirstVisit id="postseason" />
        <div style={{ flex: 'none', background: 'var(--field)' }}>
          <div className="postseason-head">
            <ModuleIntro
              kicker={`${year} POSTSEASON · STAGE ${rung + 1} OF 3`}
              title={stageTitle}
            />
          </div>

          <StageRail at={rung} shown={shown} onGo={(i) => setReviewing(i === rung ? null : i)} />

          {/* The stage's two rooms. Reviewing an older stage or being out of
              June both mean there is no next game, so the toggle only shows
              while the question it answers exists. */}
          {reviewing === null && !iAmOut && (
            <SubToggle
              options={[['next', 'NEXT GAME'], ['bracket', 'BRACKET']]}
              at={juneTab}
              onGo={(v) => setJuneTab(v as JuneTab)}
            />
          )}
        </div>

        <div ref={scrollerRef} className="postseason-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ padding: '8px 0 10px' }}>
            {/*
              Who won, at the top, where it cannot be missed.

              Reported plainly: the national champion sat at the foot of the
              page behind two full brackets, and *"I didn't even know it was
              down there"*. A champion is the loudest thing that happens in a
              season and it was reading as a footnote.

              It is the same card the takeover shows, kept rather than spent:
              the moment fires once, and then this stays for the rest of June so
              it can be read again.
            */}
            {crown && (
              <div style={{ padding: '0 14px', marginBottom: 8 }}>
                <CrownCard
                  crown={crown}
                  mine={crown.team === userTeam}
                  school={name(crown.team)}
                  abbr={abbr(crown.team)}
                />
              </div>
            )}
            {/*
              A bracket game a phone call took away.

              The same offer the dashboard makes, because June has its own
              frame and the dashboard is not in it — and a postseason game is
              the one you least want to lose.
            */}
            {pendingGame && (
              <div style={{ padding: '0 14px', marginBottom: 8 }}>
                <div className="rise-in" style={{
                  border: '1px solid var(--clay)', borderLeft: '5px solid var(--clay)',
                  background: 'var(--paper)',
                }}>
                  <div style={{ padding: '5px 11px', background: 'var(--clay)' }}>
                    <span style={{
                      font: "600 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.18em',
                      color: 'var(--cream)',
                    }}>GAME IN PROGRESS</span>
                  </div>
                  <div style={{ padding: '10px 12px 11px' }}>
                    <div style={{
                      font: "800 calc(16px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
                    }}>{pendingGame.line}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                      <button
                        onClick={() => void resumeGame(true)}
                        className="tap"
                        style={{
                          flex: 1, padding: '11px 8px', minHeight: 42,
                          background: 'var(--clay)', border: '1px solid var(--clay)',
                          color: 'var(--cream)', font: "700 calc(10px * var(--ts)) var(--mono)",
                          letterSpacing: '.1em',
                        }}
                      >PICK IT UP</button>
                      <button
                        onClick={() => void resumeGame(false)}
                        className="tap"
                        style={{
                          flex: 1, padding: '11px 8px', minHeight: 42,
                          background: 'transparent', border: '1px solid rgba(var(--ink-rgb), .4)',
                          color: 'var(--ink)', font: "700 calc(10px * var(--ts)) var(--mono)",
                          letterSpacing: '.1em',
                        }}
                      >LET THEM FINISH</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/*
              Between stages the pregame has nothing to stage and used to say
              "the round is still being played" under a CHAMPIONS banner —
              reported from the phone: "I won the conference finals and the
              next game box said the round was still being played but the
              conference had already ended." Standing here un-eliminated with
              the stage played means you WON it, so the card says that, and
              points at the same button that moves the June along.
            */}
            {reviewing === null && !iAmOut && juneTab === 'next'
              && myBracket === null && stagePlayed && (
              <section className="pregame-show is-waiting">
                <div className="pregame-kicker">
                  <small>YOUR NEXT GAME</small>
                  <span>{bracket.stage === 'conference' ? 'CONFERENCE — WON'
                    : bracket.stage === 'regional' ? 'REGIONAL — WON' : 'JUNE'}</span>
                </div>
                <p className="pregame-sub">
                  {bracket.stage === 'conference'
                    ? (wonConference
                      ? 'The tournament is yours. The regionals form from the sixteen conference winners — the button below moves June along.'
                      : 'This stage is settled. The button below moves June along.')
                    : bracket.stage === 'regional'
                      ? (wonRegional
                        ? 'The regional is yours. The national field is next — the button below moves June along.'
                        : 'This stage is settled. The button below moves June along.')
                      : 'This stage is settled. The button below moves June along.'}
                </p>
              </section>
            )}
            {reviewing === null && !iAmOut && juneTab === 'next'
              && !(myBracket === null && stagePlayed) && (
              <PregameShow
                myBracket={myBracket}
                userTeam={userTeam}
                season={season}
                me={team}
                name={name}
                abbr={abbr}
                hurtNine={hurtNine}
                onLineup={() => setShowLineup(true)}
                onPlay={manage}
                onSim={() => sim('game')}
              />
            )}

            {/*
              The brackets, arriving rather than appearing.

              This wrapper once swapped between the winners and losers halves
              — the "quite wild" jump report, and the fade that answered it.
              The one-map redesign retired the swap (both halves are always
              on screen, stacked), so the key is the stage and the national's
              A/B room now, and the fade only plays when one of those
              genuinely changes. Off under `prefers-reduced-motion` with
              everything else.
            */}
            {(reviewing !== null || iAmOut || juneTab === 'bracket') && (
            <div
              className="swap-back"
              key={`${shown}:${lookingAt}`}
            >
            {shown === 0 && (
              <ConferenceStage
                cups={bracket.cups}
                mine={myBracket?.kind === 'conference' && myBracket.format === 'double'
                  ? myBracket.state : null}
                myConference={team.conference}
                abbr={abbr}
                userTeam={userTeam}
                onOpen={openSlot}
              />
            )}

            {shown === 1 && (
              <RegionalStage
                regionals={bracket.regionals}
                mine={myBracket?.kind === 'regional' && myBracket.format === 'series'
                  ? {
                      state: myBracket.state,
                      meta: myBracket.meta ?? null,
                    }
                  : null}
                myRegion={regionOf(team.conference)}
                season={season}
                abbr={abbr}
                userTeam={userTeam}
              />
            )}

            {shown === 2 && (
              <NationalStage
                nat={nat}
                myBracket={myBracket}
                sideShow={sideShow}
                half={natHalf ?? (myBracket?.kind === 'national' && myBracket.format === 'double'
                  ? (myBracket.half ?? 'A') : 'A')}
                onHalf={setNatHalf}
                abbr={abbr}
                userTeam={userTeam}
                onOpen={openSlot}
              />
            )}
            </div>
            )}
          </div>
        </div>

        {/* Pinned to the frame, not the scroll — except while the pregame
            show has the game: PLAY and SIM moved onto that card by decision
            ("PLAY / SIM move onto the card itself"), and a second pair of
            the same buttons underneath it is noise. Every other state keeps
            the bar: between rounds it simulates to your next game, out or
            reviewing it advances the tournament. */}
        {!(reviewing === null && !iAmOut && juneTab === 'next' && due) && (
        <div style={{
          flex: 'none', padding: '0 14px',
          background: 'var(--field)', borderTop: '1px solid var(--faint)',
        }}>
          <FloatingAction
            label={action.label}
            onClick={action.run}
            note={action.note}
            secondary={action.secondary ?? null}
          />
        </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Header furniture
// ---------------------------------------------------------------------------

/** Where you are in June. The blurbs are gone; the tutorial teaches instead. */
function StageRail(
  { at, shown, onGo }: { at: number; shown: number; onGo: (i: number) => void },
) {
  const STAGES: Array<[string, string]> = [
    ['Conference', 'Double elimination · top four advance'],
    ['Regionals', 'Best of three · sixteen sites'],
    ['National', 'Two brackets · a championship series'],
  ];
  return (
    <section className="postseason-stage-rail" aria-label="Postseason stages">
      {STAGES.map(([name, note], i) => {
        // A tournament already played can be gone back to; one that has not
        // happened yet cannot, because there is nothing behind it.
        const reachable = i <= at;
        return (
          <button
            className={`${i === shown ? 'active' : ''} ${i < at ? 'done' : ''}`}
            key={name}
            type="button"
            disabled={!reachable}
            onClick={() => onGo(i)}
          >
            <span>{i + 1}</span>
            <strong>{name}</strong>
            <small>{note}</small>
          </button>
        );
      })}
    </section>
  );
}

/** The winners/losers (and opening) toggle, in the app's own clothes. */
function SubToggle(
  { options, at, onGo }:
  { options: [string, string][]; at: string; onGo: (v: string) => void },
) {
  return (
    <div className="postseason-view-toggle">
      <Segmented
        label="Bracket half"
        value={at}
        onChange={onGo}
        options={options.map(([v, label]) => ({
          value: v,
          label: label.charAt(0) + label.slice(1).toLowerCase(),
        }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your next game
// ---------------------------------------------------------------------------

/** What you are due to play, and the door to your lineup. */
/**
 * The full pregame show — the NEXT GAME tab's whole reason to exist.
 *
 * The reporter's design, decided at the batch's door: "the red box... be the
 * main one and make it bigger and better looking to give it a feel of
 * importance now that we are in the tournament stages", and then "the full
 * matchup card... PLAY / SIM move onto the card itself." Crests, the probable
 * arms picked exactly the way the engine will pick them (appearances modulo
 * three — the same arithmetic playSeriesGame uses), the stake said in words,
 * and the two buttons that act on it. The injury hold moves here with them:
 * a hurt man in the nine turns PLAY into FIX THE LINEUP, same as the pinned
 * bar it inherited the job from.
 */
function PregameShow(
  { myBracket, userTeam, season, me, name, abbr, hurtNine, onLineup, onPlay, onSim }:
  {
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    userTeam: number;
    season: SeasonState;
    me: { def: { abbr: string; school: string }; conference: string };
    name: (i: number) => string;
    abbr: (i: number) => string;
    hurtNine: Hitter[];
    onLineup: () => void;
    onPlay: () => void;
    onSim: () => void;
  },
) {
  // Who tonight is against, and what it is worth — or null between rounds.
  let opp: number | null = null;
  let home = false;
  let formatLabel = '';
  let sub: string | null = null;
  let stake: { line: string; tone: 'win' | 'alert' | 'dim' } | null = null;

  if (myBracket && myBracket.format === 'series') {
    formatLabel = 'BEST OF THREE';
    const next = nextGameFor(myBracket.state, userTeam);
    const sr = liveSeries(myBracket.state, userTeam);
    if (next && sr) {
      const host = hostOfGame(sr, sr.games.length);
      opp = next.a === userTeam ? next.b : next.a;
      home = host === userTeam;
      const wins = (t: number): number => sr.games.filter((g) => g.winner === t).length;
      const len = myBracket.state.lengths[sr.round] ?? 3;
      const mine = wins(userTeam);
      const theirs = wins(opp);
      const need = clincher(len);
      sub = `Game ${sr.games.length + 1} of ${len} · you ${mine}-${theirs} · first to ${need}`;
      stake = mine === need - 1 && theirs === need - 1
        ? { line: 'Winner takes the series. Loser goes home.', tone: 'alert' }
        : mine === need - 1
          ? { line: 'Win tonight and the series is yours.', tone: 'win' }
          : theirs === need - 1
            ? { line: 'Lose tonight and it is over.', tone: 'alert' }
            : null;
    }
  } else if (myBracket) {
    formatLabel = 'DOUBLE ELIMINATION';
    const slot = liveSlotFor(myBracket.state, userTeam);
    if (slot && slot.a !== null && slot.b !== null) {
      const host = slot.side === 'F' ? slot.a
        : (slot.aSeed <= slot.bSeed ? slot.a : slot.b);
      opp = slot.a === userTeam ? slot.b : slot.a;
      home = host === userTeam;
      const losses = myBracket.state.losses.get(userTeam) ?? 0;
      if (slot.side === 'F') {
        sub = 'Championship';
        stake = losses === 0
          ? { line: 'You arrived unbeaten. Win one and it is yours.', tone: 'win' }
          : { line: 'You must win this one AND the next.', tone: 'alert' };
      } else {
        sub = slotName(slot);
        stake = losses === 0
          ? { line: 'Unbeaten. A loss drops you to the losers bracket, not out.', tone: 'dim' }
          : { line: 'One loss already. Lose again and the run ends here.', tone: 'alert' };
      }
    }
  }

  // Between rounds: nothing to stage yet. The pinned bar below simulates to
  // your next game; the card only has to say the round is still forming.
  if (opp === null) {
    return (
      <section className="pregame-show is-waiting">
        <div className="pregame-kicker">
          <small>YOUR NEXT GAME</small>
          <span>{formatLabel || 'JUNE'}</span>
        </div>
        <p className="pregame-sub">
          The round is still being played. Your next game forms when it
          finishes — the button below takes you straight to it.
        </p>
      </section>
    );
  }

  // The probable arms, the way the engine will pick them: appearances mod 3.
  const used = (side: number): number =>
    ((myBracket!.state as { appearances?: Map<number, number> }).appearances?.get(side) ?? 0) % 3;
  const armFor = (side: number): string => {
    const rec = season.teams[side];
    const arm = rec?.team.rotation[used(side)] ?? rec?.team.rotation[0];
    if (!arm) return '—';
    const line = season.pitching.get(arm.id);
    const e = line && line.outs >= 9 ? ` · ${era(line).toFixed(2)}` : '';
    const parts = arm.name.split(' ');
    const short = parts.length > 1 ? `${parts[0]![0]}. ${parts.slice(1).join(' ')}` : arm.name;
    return `${short}${e}`;
  };

  const held = hurtNine.length > 0;

  return (
    <section className="pregame-show">
      <div className="pregame-kicker">
        <small>YOUR NEXT GAME</small>
        <span>{formatLabel}</span>
      </div>

      <div className="pregame-match">
        <div className="pregame-side">
          <Crest abbr={me.def.abbr} size={54} />
          <strong style={{ color: teamColour(me.def.abbr) }}>{me.def.school}</strong>
          <em>{armFor(userTeam)}</em>
        </div>
        <div className="pregame-vs">{home ? 'VS' : 'AT'}</div>
        <div className="pregame-side">
          <Crest abbr={abbr(opp)} size={54} />
          <strong style={{ color: teamColour(abbr(opp)) }}>{name(opp)}</strong>
          <em>{armFor(opp)}</em>
        </div>
      </div>

      {sub && <p className="pregame-sub">{sub}</p>}
      {stake && (
        <p className={`pregame-stake tone-${stake.tone}`}>{stake.line}</p>
      )}

      {held ? (
        <>
          <p className="pregame-hold">
            {hurtNine.length === 1
              ? `${hurtNine[0]!.name} is in your nine and cannot play — ${whyOut(hurtNine[0]!, injuryClock(season))}. Nobody is moved for you.`
              : `${hurtNine.length} men in your nine cannot play. Nobody is moved for you.`}
          </p>
          <button className="primary-command tap" type="button" onClick={onLineup}>
            FIX THE LINEUP
          </button>
        </>
      ) : (
        <>
          <button className="primary-command tap" type="button" onClick={onPlay}>
            PLAY THIS GAME
          </button>
          <button className="secondary-command tap" type="button" onClick={onSim}>
            SIMULATE THIS GAME
          </button>
        </>
      )}
      <button className="pregame-lineup tap" type="button" onClick={onLineup}>
        <IdCardIcon /> Set the lineup
      </button>
    </section>
  );
}

/**
 * One double elimination as ONE map: the winners road, the drop marked in
 * your colour, and the losers road under it. The stacked layout is what let
 * the winners/losers toggle retire — see the redesign note at the top.
 */
function OneMap(
  { de, abbr, userTeam, onOpen, mineAbbr }:
  {
    de: DECols;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen?: (s: DESlot) => void;
    /** Set when the user's team plays in this bracket — paints the drop. */
    mineAbbr: string | null;
  },
) {
  // He dropped if he appears anywhere on the losers side.
  const dropped = mineAbbr !== null && de.losers.some((r) =>
    r.some((sl) => sl.a === userTeam || sl.b === userTeam));
  return (
    <>
      <DoubleElimMap de={de} view="winners" abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
      <div
        className={`drop-strip${dropped ? ' is-you' : ''}`}
        style={dropped && mineAbbr ? { ['--team' as string]: teamColour(mineAbbr) } : undefined}
      >
        {dropped
          ? `▼ ${mineAbbr} dropped here — one more loss ends the run`
          : '▼ a loss above drops a team into the bracket below'}
      </div>
      <DoubleElimMap
        de={de} view="losers" abbr={abbr} userTeam={userTeam} onOpen={onOpen}
        showFinal={false}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Stage bodies
// ---------------------------------------------------------------------------

function ConferenceStage(
  { cups, mine, myConference, abbr, userTeam, onOpen }:
  {
    cups: ConferenceTournament[];
    mine: DoubleElim | null;
    myConference: string;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen: (s: DESlot) => void;
  },
) {
  // Yours first, live or finished; then the rest of the country.
  const rows: { conference: string; de: DECols; you: boolean }[] = [];
  if (mine) {
    rows.push({
      conference: myConference, you: true,
      de: { winners: mine.winners, losers: mine.losers, final: mine.final },
    });
  }
  for (const c of [...cups].sort((a, b) =>
    (a.conference === myConference ? -1 : 0) - (b.conference === myConference ? -1 : 0))) {
    if (!c.de) continue;
    rows.push({
      conference: c.conference,
      you: c.conference === myConference,
      de: c.de as DECols,
    });
  }

  return (
    <>
      {rows.map((r) => (
        <div key={r.conference} style={{ marginBottom: 10 }}>
          <div style={{
            margin: '0 14px 4px', paddingBottom: 3,
            borderBottom: '2px solid var(--ink)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label" style={{ color: r.you ? 'var(--you)' : 'var(--ink)' }}>
              {r.conference}{r.you ? ' · YOU' : ''}
            </span>
          </div>
          {/* Your tournament is ONE map — both halves, the drop marked.
              The other eleven leagues get the winners road and the final:
              their losers brackets are reading material, and eleven more
              stacked maps would bury yours. Tap into a cup's games as
              always; the seeds and scores carry the story. */}
          {r.you
            ? <OneMap de={r.de} abbr={abbr} userTeam={userTeam} onOpen={onOpen}
                mineAbbr={abbr(userTeam)} />
            : <DoubleElimMap de={r.de} view="winners" abbr={abbr}
                userTeam={userTeam} onOpen={onOpen} />}
        </div>
      ))}
    </>
  );
}

function RegionalStage(
  { regionals, mine, myRegion, season, abbr, userTeam }:
  {
    regionals: RegionalSeries[];
    mine: {
      state: SeriesBracket;
      meta: { region: string; name: string; aLabel: string; bLabel: string } | null;
    } | null;
    myRegion: string;
    season: { teams: ReadonlyArray<{ def: { abbr: string } }> };
    abbr: (i: number) => string;
    userTeam: number;
  },
) {
  void season;
  const byRegion = new Map<string, RegionalSeries[]>();
  for (const r of regionals) {
    byRegion.set(r.region, [...(byRegion.get(r.region) ?? []), r]);
  }
  const order = [...REGIONS].sort((a, b) =>
    (a.id === myRegion ? -1 : 0) - (b.id === myRegion ? -1 : 0));

  return (
    <>
      {order.map((region) => {
        const list = byRegion.get(region.id) ?? [];
        const mineHere = mine && (mine.meta?.region ?? myRegion) === region.id
          ? mine : null;
        if (list.length === 0 && !mineHere) return null;
        return (
          <div key={region.id} style={{ padding: '0 14px', marginBottom: 12 }}>
            <div style={{
              paddingBottom: 3, marginBottom: 6, borderBottom: '2px solid var(--ink)',
            }}>
              <span className="label" style={{
                color: region.id === myRegion ? 'var(--you)' : 'var(--ink)',
              }}>
                {region.name.toUpperCase()} REGIONAL
                {region.id === myRegion ? ' · YOU' : ''}
              </span>
            </div>
            {mineHere && (
              <LiveSeriesCard
                state={mineHere.state}
                aLabel={mineHere.meta?.aLabel ?? ''}
                bLabel={mineHere.meta?.bLabel ?? ''}
                abbr={abbr}
                userTeam={userTeam}
              />
            )}
            {list.map((r, i) => (
              <SeriesResultCard key={i} r={r} abbr={abbr} userTeam={userTeam} />
            ))}
          </div>
        );
      })}
    </>
  );
}

/** A finished (or simulated) best-of-three, as a card. */
function SeriesResultCard(
  { r, abbr, userTeam, tag }:
  { r: RegionalSeries | (TournamentResult & { aLabel?: string; bLabel?: string });
    abbr: (i: number) => string; userTeam: number; tag?: string },
) {
  const a = r.seeds[0]; const b = r.seeds[1];
  if (a === undefined || b === undefined) return null;
  const winsOf = (t: number): number => r.games.filter(
    (g) => (g.homeRuns > g.awayRuns ? g.home : g.away) === t,
  ).length;
  const mine = a === userTeam || b === userTeam;
  return (
    <div
      {...(mine ? { 'data-you': '' } : {})}
      style={{
        marginBottom: 6,
        border: mine ? '1.5px solid var(--you)' : '1px solid var(--faint)',
        background: 'var(--paper)',
      }}>
      {tag && (
        <div style={{
          padding: '3px 9px', background: 'var(--band)',
          font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--cream)',
        }}>{tag}</div>
      )}
      <TeamLine
        team={a} label={(r as RegionalSeries).aLabel} wins={winsOf(a)}
        champion={r.champion === a} abbr={abbr} userTeam={userTeam} top
      />
      <TeamLine
        team={b} label={(r as RegionalSeries).bLabel} wins={winsOf(b)}
        champion={r.champion === b} abbr={abbr} userTeam={userTeam}
      />
    </div>
  );
}

/** A matchup that exists and has not been played. Both names, no scores. */
function PendingSeriesCard(
  { a, b, aLabel, bLabel, abbr, userTeam }:
  {
    a: number; b: number; aLabel: string; bLabel: string;
    abbr: (i: number) => string; userTeam: number;
  },
) {
  const mine = a === userTeam || b === userTeam;
  return (
    <div
      {...(mine ? { 'data-you': '', 'data-you-live': '' } : {})}
      style={{
        marginBottom: 6,
        border: mine ? '1.5px solid var(--you)' : '1px solid var(--faint)',
        background: 'var(--paper)',
      }}>
      <div style={{
        padding: '3px 9px', background: 'var(--field)',
        borderBottom: '1px solid var(--hairline)',
        font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--dim)',
      }}>BEST OF 3 · NOT PLAYED</div>
      <TeamLine team={a} label={aLabel} wins={0} champion={false}
        abbr={abbr} userTeam={userTeam} top />
      <TeamLine team={b} label={bLabel} wins={0} champion={false}
        abbr={abbr} userTeam={userTeam} />
    </div>
  );
}

/** The user's live series, game by game. */
function LiveSeriesCard(
  { state, aLabel, bLabel, abbr, userTeam }:
  {
    state: SeriesBracket; aLabel: string; bLabel: string;
    abbr: (i: number) => string; userTeam: number;
  },
) {
  const s: Series | undefined = state.rounds[0]?.[0];
  if (!s || s.a === null || s.b === null) return null;
  const wins = (t: number): number => s.games.filter((g) => g.winner === t).length;
  const len = state.lengths[0] ?? 3;
  return (
    <div style={{
      marginBottom: 6, border: '1.5px solid var(--clay)', background: 'var(--paper)',
    }}>
      <div style={{
        padding: '3px 9px', background: 'var(--clay)',
        font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--cream)',
      }}>
        BEST OF {len} · {s.winner === null
          ? `GAME ${s.games.length + 1}`
          : 'FINAL'}
      </div>
      <TeamLine
        team={s.a} label={aLabel} wins={wins(s.a)}
        champion={s.winner === s.a} abbr={abbr} userTeam={userTeam} top
      />
      <TeamLine
        team={s.b} label={bLabel} wins={wins(s.b)}
        champion={s.winner === s.b} abbr={abbr} userTeam={userTeam}
      />
    </div>
  );
}

function TeamLine(
  { team, label, wins, champion, abbr, userTeam, top }:
  {
    team: number; label?: string; wins: number; champion: boolean;
    abbr: (i: number) => string; userTeam: number; top?: boolean;
  },
) {
  const tint = teamColour(abbr(team));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 9px',
      borderBottom: top ? '1px solid var(--hairline)' : 'none',
      borderLeft: `3px solid ${tint}`,
      background: champion ? `${tint}1c` : 'transparent',
    }}>
      <span style={{
        flex: 'none', font: `${champion ? 700 : 600} calc(12px * var(--ts)) var(--mono)`,
        color: tint, letterSpacing: '.04em',
      }}>
        {abbr(team)}{team === userTeam ? ' ★' : ''}
      </span>
      {label && (
        <span style={{
          font: "400 calc(8.5px * var(--ts)) var(--mono)", color: 'var(--dim)', letterSpacing: '.06em',
        }}>{label}</span>
      )}
      <span style={{ flex: 1 }} />
      {champion && (
        <span style={{
          font: "700 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: tint,
        }}>CHAMPIONS</span>
      )}
      <span style={{
        font: `${champion ? 800 : 600} calc(14px * var(--ts)) var(--display)`,
        minWidth: 14, textAlign: 'right',
      }}>{wins}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The national stage
// ---------------------------------------------------------------------------

function NationalStage(
  { nat, myBracket, sideShow, half, onHalf, abbr, userTeam, onOpen }:
  {
    nat: NationalProgress | null;
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    sideShow: ReturnType<typeof useDynasty.getState>['sideShow'];
    /** Which of the two rooms is on screen. */
    half: NatHalf;
    onHalf: (h: NatHalf) => void;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen: (s: DESlot) => void;
  },
) {
  if (!nat) {
    return (
      <div style={{
        padding: '20px 14px', textAlign: 'center',
        font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
      }}>The field is being announced.</div>
    );
  }
  const seeds = nat.field.seeds;


  /*
    The showdown: two eight-team double eliminations, then the championship.

    Each half is one of three things and the header says which: the one you
    are playing, the one being played beside it, or a finished result. Before
    this, a live bracket sat next to a finished one with nothing to
    distinguish them, which is what read as "everything is already played".
  */
  const halfOf = (which: 'A' | 'B'): { de: DECols; tag: string; tone: string } | null => {
    if (myBracket?.kind === 'national' && myBracket.format === 'double'
      && myBracket.half === which) {
      const s = myBracket.state;
      return {
        de: { winners: s.winners, losers: s.losers, final: s.final },
        tag: 'YOUR BRACKET · LIVE', tone: 'var(--clay)',
      };
    }
    if (sideShow && sideShow.half === which) {
      const s = sideShow.state;
      return {
        de: { winners: s.winners, losers: s.losers, final: s.final },
        tag: 'LIVE', tone: 'var(--ink)',
      };
    }
    const r = which === 'A' ? nat.bracketA : nat.bracketB;
    return r
      ? {
          de: { winners: r.winners, losers: r.losers, final: r.final },
          tag: 'FINAL', tone: 'var(--dim)',
        }
      : null;
  };

  const shownHalf = halfOf(half);
  const iPlayHere = myBracket?.kind === 'national' && myBracket.format === 'double'
    && myBracket.half === half;

  return (
    <>
      {/* The championship first — "final pinned above", from the batch's
          door. It is where the whole month is pointed; the rooms it is fed
          from sit under it, one at a time. */}
      <div style={{ padding: '0 14px', marginBottom: 10 }}>
        <div style={{
          paddingBottom: 3, marginBottom: 6, borderBottom: '2px solid var(--ink)',
        }}>
          <span className="label">NATIONAL CHAMPIONSHIP · BEST OF 3</span>
        </div>
        {myBracket?.kind === 'final' && myBracket.format === 'series' ? (
          <LiveSeriesCard
            state={myBracket.state}
            aLabel="BRACKET A" bLabel="BRACKET B"
            abbr={abbr} userTeam={userTeam}
          />
        ) : nat.final ? (
          <SeriesResultCard
            r={{ ...nat.final, aLabel: 'BRACKET A', bLabel: 'BRACKET B' }}
            abbr={abbr} userTeam={userTeam}
          />
        ) : (
          <div style={{
            padding: '8px 0', font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
          }}>The two bracket champions meet here.</div>
        )}
      </div>

      {/* The two rooms, one at a time — the halves genuinely are separate
          tournaments, which is why this toggle survived the redesign that
          retired winners/losers everywhere else. */}
      <SubToggle
        options={[['A', 'BRACKET A'], ['B', 'BRACKET B']]}
        at={half}
        onGo={(v) => onHalf(v as NatHalf)}
      />

      <div style={{ marginBottom: 10 }}>
        <div style={{
          margin: '0 14px 4px', paddingBottom: 3, borderBottom: '2px solid var(--ink)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <span className="label">NATIONAL BRACKET {half}</span>
          {shownHalf && (
            <span style={{
              font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em',
              color: shownHalf.tone,
            }}>{shownHalf.tag}</span>
          )}
        </div>
        {shownHalf
          ? <OneMap
              de={shownHalf.de} abbr={abbr} userTeam={userTeam} onOpen={onOpen}
              mineAbbr={iPlayHere ? abbr(userTeam) : null}
            />
          : (
            <div style={{
              padding: '10px 14px', font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
            }}>Waiting on the field to be drawn.</div>
          )}
      </div>
    </>
  );
}

const ordinal = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

/** A decided trophy: which one, who took it, and how loudly to say so. */
export interface Crown {
  team: number;
  /** 0 conference, 1 regional, 2 the country. Drives every size below. */
  rung: 0 | 1 | 2;
  kicker: string;
  title: string;
  line: string;
}

/**
 * The trophy card, at three intensities.
 *
 * One component rather than three, because a conference banner and a national
 * title are the same fact at different volumes, and the escalation is itself
 * information: a player who has seen the conference card knows immediately,
 * without reading a word, that the national one is bigger. Three separate
 * components would have drifted into three different designs and lost that.
 *
 * The loudest it goes is still type and colour. Sound, animation and a
 * full-screen celebration are the broadcast stage's job and are deliberately
 * not faked here with a bigger font.
 */
function CrownCard(
  { crown, mine, school, abbr }:
  { crown: Crown; mine: boolean; school: string; abbr: string },
) {
  const big = crown.rung === 2;
  const mid = crown.rung === 1;
  /*
    A trophy per trophy.

    Every championship card used to be the same muted green, and it was
    reported reading as a *loss* -- which is fair, because the green is the
    quiet one in this palette and nothing about it says "you won the thing".
    Worse, all three tournaments looked identical, so the card could not tell
    you what you had won without being read.

    Bronze, silver, gold. It is the one colour language nobody has to be
    taught, it escalates in exactly the direction the tournaments do, and all
    three are far enough from clay that none of them can be mistaken for the
    colour this app uses for a loss. Rivals stay navy: somebody else's trophy
    is news, not a trophy.
  */
  const ground = mine
    ? (big ? 'var(--gold)' : mid ? 'var(--silver)' : 'var(--bronze)')
    : 'var(--navy)';
  return (
    <div
      className="rise-in"
      style={{
        border: `1px solid ${ground}`,
        borderLeft: `${big ? 7 : mid ? 5 : 4}px solid ${ground}`,
        background: 'var(--paper)',
      }}
    >
      <div style={{ padding: '5px 11px', background: ground }}>
        <span style={{
          font: `600 calc(${big ? 9 : 8.5}px * var(--ts)) var(--mono)`,
          letterSpacing: '.18em', color: 'var(--cream)',
        }}>{crown.kicker}</span>
      </div>
      <div style={{ padding: big ? '14px 12px 15px' : '10px 12px 11px' }}>
        <div style={{
          font: `800 calc(${big ? 30 : mid ? 22 : 18}px * var(--ts))/0.95 var(--display)`,
          textTransform: 'uppercase', color: ground,
        }}>{school}</div>
        <div style={{
          marginTop: big ? 5 : 3,
          font: `700 calc(${big ? 13 : 11}px * var(--ts))/1.2 var(--display)`,
          letterSpacing: '.04em', textTransform: 'uppercase',
        }}>{crown.title}</div>
        <div style={{
          marginTop: 4, font: "400 calc(11px * var(--ts))/1.4 var(--body)",
          color: 'var(--dim)',
        }}>{crown.line}</div>
        <div style={{
          marginTop: 7, font: "500 calc(9px * var(--ts)) var(--mono)",
          letterSpacing: '.16em', color: 'var(--faint)',
        }}>{abbr}</div>
      </div>
    </div>
  );
}
