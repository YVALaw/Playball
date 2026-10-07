// Postseason.tsx
// June, in three championships.
//
// CONFERENCE: eight of twelve into a double elimination, the top four
// finishers go on. REGIONALS: sixteen best-of-3 series crossing neighbouring
// conferences. NATIONAL: those sixteen champions plus four teams guaranteed a
// place or picked for the field, twenty in all, split into two double
// eliminations whose champions play a best of 3 for the country.
//
// The screen names the stage and its format in one sentence, shows where June
// is on a three-step rail, and has two views: your next game (or, once you are
// out, the games worth watching) and the bracket. The one action for this
// moment sits pinned at the bottom with a note saying how much it plays.
//
// One word for each idea, everywhere: the winners side and the elimination
// side, the deciding game, the national tournament, guaranteed a place and
// picked for the national field.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useDynasty, useUserTeam, type NationalProgress } from '../../state/store.js';
import { useBackLayer } from '../useBackLayer.js';
import { Modal } from '../Modal.js';
import { Lineup } from './Lineup.js';
import { Crest } from '../Crest.js';
import { ConferenceBanner, hasBanner } from '../ConferenceBanner.js';
import { currentDay, era, injuryClock, startableSlot } from '../../engine/season.js';
import type { SeasonState, BoxScore } from '../../engine/season.js';
import type { Hitter } from '../../engine/types.js';
import { available } from '../../engine/depthChart.js';
import { handles } from '../../state/depth.js';
import { DoubleElimMap, type DECols } from '../DoubleElimMap.js';
import { BoxScoreSheet } from './Schedule.js';
import {
  conferenceField, liveSeries, nextGameFor, hostOfGame, clincher,
  regionOf, REGIONS, CONF_FIELD, CONF_ADVANCE, NATIONAL_BIDS, protectedTopFour, splitShowdown, nationalBidReason,
  type NationalBidReason,
} from '../../engine/postseason.js';
import type {
  Series, SeriesBracket, RegionalSeries, ConferenceTournament, TournamentResult, BracketGame,
} from '../../engine/postseason.js';
import {
  liveSlotFor, slotName,
  type DoubleElim, type DESlot,
} from '../../engine/doubleElim.js';
import { FirstVisit } from '../Tutorial.js';
import {
  ActionBar, BracketMatch, Button, Callout, Card, cx, GameCard, Icon, Marquee, PhaseRail, SectionHeader,
  SegmentedControl, StatusBadge, Tag, type BracketTeam,
} from '../components/ui/index.js';
import { conferenceName, ordinal, plural, recordText, roundWords, sentence } from '../words.js';

type JuneTab = 'next' | 'bracket';
type NatHalf = 'A' | 'B';

/*
  The tabs remember themselves across an unmount — managing a game covers
  this screen, and coming back to a different tab than you left reads as the
  screen forgetting you. Module scope on purpose: session-long, never saved.
*/
let juneTabMemo: JuneTab = 'next';
let natHalfMemo: NatHalf | null = null;

/** How you got into the national tournament, in the postseason's own words. */
const BID_TITLE: Record<NationalBidReason, string> = {
  regionalChampion: 'Regional champions',
  protected: 'Guaranteed a place',
  atLarge: 'Picked for the national field',
};
const BID_TEXT: Record<NationalBidReason, string> = {
  regionalChampion: 'Winning your regional put you in the national tournament.',
  protected: 'A top-four regular-season ranking guarantees a place in the national tournament, even after a regional loss.',
  atLarge: 'Your regular-season ranking earned one of the places left after the regional champions and the top four.',
};

export function Postseason() {
  const [modal, setModal] = useState<'in' | 'out' | 'title' | null>(null);
  const [showLineup, setShowLineup] = useState(false);
  /*
    A nav tap stands the takeovers down. June renders this component in place
    for the whole month, so the lineup card and a stage under review would
    otherwise survive a tap on the bottom bar and keep covering it.
  */
  const navEpoch = useDynasty((st) => st.navEpoch);
  const epochSeen = useRef(navEpoch);
  useEffect(() => {
    if (epochSeen.current === navEpoch) return;
    epochSeen.current = navEpoch;
    setShowLineup(false);
    setReviewing(null);
  }, [navEpoch]);
  // The box being read, not the day it was played on: a June day holds
  // several games, so the day alone could never name one.
  const [openBox, setOpenBox] = useState<BoxScore | null>(null);
  const [findTeam, setFindTeam] = useState(0);
  const [followTeam, setFollowTeam] = useState(true);
  /*
    Which stage is on screen, which is not always the stage being played: a
    coach who won the conference and went on can still look back at it. Null
    means "follow the tournament".
  */
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [juneTab, setJuneTab0] = useState<JuneTab>(juneTabMemo);
  /*
    A beat on the pinned button. `simBracket` is synchronous, so without it a
    spectator's simulation is instant and reads as if nothing was played.
  */
  const [beat, setBeat] = useState<string | null>(null);
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (beatTimer.current) clearTimeout(beatTimer.current); }, []);
  const withBeat = (label: string, run: () => void) => (): void => {
    if (beat !== null) return;
    setBeat(label.startsWith('Sim') ? 'Simulating…' : 'Playing it out…');
    beatTimer.current = setTimeout(() => { beatTimer.current = null; setBeat(null); run(); }, 700);
  };
  // The June lineup card and a stage under review are layers the back
  // gesture peels, like every sheet.
  useBackLayer(showLineup, () => setShowLineup(false));
  useBackLayer(reviewing !== null, () => setReviewing(null));
  const setJuneTab = (v: JuneTab): void => { juneTabMemo = v; setJuneTab0(v); };
  // Null until the reader picks one; the default is whichever half is yours.
  const [natHalf, setNatHalf0] = useState<NatHalf | null>(natHalfMemo);
  const setNatHalf = (v: NatHalf): void => { natHalfMemo = v; setNatHalf0(v); };

  const season = useDynasty((s) => s.season);
  const bracket = useDynasty((s) => s.bracket);
  const myBracket = useDynasty((s) => s.myBracket);
  const sideShow = useDynasty((s) => s.sideShow);
  const pendingGame = useDynasty((s) => s.pendingGame);
  // A game starting (its anchor still writing) or one waiting to be picked
  // back up holds both June buttons, as the store does (M59, M95).
  const gameHeld = useDynasty((s) => s.liveStarting || s.pendingGame !== null);
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
    Two different questions. `reported` is "there is an elimination this year
    that has not been shown", true whether or not it ended the season. And
    `knockedOut` is "your June is over", which an advancing exit is not.
  */
  const reported = knockout !== null && knockout.year === year;
  const knockedOut = reported && !knockout!.advanced;
  const iAmOut = myBracket
    ? myBracket.state.eliminated.includes(userTeam)
    : knockedOut;
  const stageKey = bracket?.stage ?? '';

  const stillIn = myBracket !== null && !knockedOut;
  const [notHere, setNotHere] = useState(false);
  const mySeed = season && team
    ? conferenceField(season, team.conference).field.indexOf(userTeam) + 1
    : 0;
  const inTheField = mySeed > 0;
  // Spectating also covers a program that never made the conference field:
  // it never sees a dead "your next game" room, at any stage.
  const spectatorMode = iAmOut
    || (!inTheField && (bracket?.stage === 'conference' || myBracket === null));
  useEffect(() => {
    if (spectatorMode) setJuneTab('next');
  }, [spectatorMode]);
  const introKey = `${year}:in:${stageKey}`;
  // No exit card for the national final: the runner-up takeover owns that beat.
  const outKey = reported && knockout && knockout.kind !== 'final'
    ? `${year}:out:${knockout.kind}` : '';

  const nat = bracket?.national ?? null;
  const stagePlayed = bracket
    ? (bracket.stage === 'conference' ? bracket.cups.length >= 8
      : bracket.stage === 'regional' ? bracket.regionals.length >= 16
      : nat !== null && nat.final !== null)
    : false;
  const wonConference = bracket?.cups.some((c) => c.champion === userTeam) ?? false;
  const wonRegional = bracket?.regionals.some((r) => r.champion === userTeam) ?? false;
  const settledCup = bracket?.cups.find((c) => c.conference === team?.conference);
  const settledChamp = settledCup && settledCup.champion !== null
    ? season?.teams[settledCup.champion]?.def.school ?? null
    : null;

  /*
    A title game, announced before it is played, once. It says who, what is
    at stake and what winning takes; the champion card takes over once it is
    decided.
  */
  const titleGame = (() => {
    if (!myBracket || iAmOut || !season || !team || !bracket) return null;
    if (myBracket.format === 'double') {
      const slot = liveSlotFor(myBracket.state, userTeam);
      if (!slot || slot.side !== 'F' || slot.a === null || slot.b === null) return null;
      const other = slot.a === userTeam ? slot.b : slot.a;
      const losses = myBracket.state.losses.get(userTeam) ?? 0;
      const where = bracket.stage === 'conference' ? `${conferenceName(team.conference)} championship`
        : 'Bracket championship';
      return {
        key: `${year}:title:${stageKey}:${slot.round}`,
        kicker: `${year} · ${where}`,
        title: `${team.def.school} vs ${(season.teams[other]?.def.school ?? '?')}`,
        lines: [slot.round === 1
          ? 'The deciding game: one game, and the winner takes the title.'
          : losses === 0
            ? 'You arrived unbeaten. Win once and the title is yours.'
            : 'You came through the elimination side. Win this one and the deciding game after it.'],
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
    const mine = wins(userTeam);
    const theirs = wins(other);
    const standing = mine === theirs
      ? (mine === 0 ? '' : ` Level at ${recordText(mine, theirs)}.`)
      : mine > theirs ? ` You lead ${recordText(mine, theirs)}.` : ` You trail ${recordText(mine, theirs)}.`;
    return {
      key: `${year}:title:${myBracket.kind}`,
      kicker: isFinal ? `${year} · National championship` : `${year} · Regional championship`,
      title: `${team.def.school} vs ${(season.teams[other]?.def.school ?? '?')}`,
      lines: [`Best of ${len}: first to ${clincher(len)} wins.${standing}`],
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

  const rung = bracket?.stage === 'conference' ? 0
    : bracket?.stage === 'regional' ? 1 : 2;
  const shown = reviewing ?? rung;
  // Whether your program is in the tournament being looked at, which is a
  // different question from whether it is still alive in its own.
  const inShownStage = shown === 0
    ? inTheField
    : shown === 1
      ? (bracket?.regionals ?? []).some((r) => r.seeds.includes(userTeam))
      : (bracket?.national?.field.seeds.includes(userTeam) ?? false);
  useEffect(() => { setNotHere(false); }, [shown, juneTab, natHalf]);

  /*
    Your game, brought into view: the page scrolls to it, and so does the
    bracket's sideways track. Paused the moment the reader scrolls themselves.
  */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lookingAt = `${juneTab}:${natHalf ?? ''}`;
  const activeSlot = myBracket?.format === 'double' ? liveSlotFor(myBracket.state, userTeam) : null;
  const activeSeries = myBracket?.format === 'series' ? liveSeries(myBracket.state, userTeam) : null;
  const matchupKey = activeSlot ? `${activeSlot.side}:${activeSlot.round}:${activeSlot.slot}:${activeSlot.a}:${activeSlot.b}`
    : activeSeries ? `${activeSeries.round}:${activeSeries.a}:${activeSeries.b}:${activeSeries.games.length}` : 'settled';
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !followTeam) return;
    const all = scroller.querySelectorAll<HTMLElement>('[data-you]');
    const you = scroller.querySelector<HTMLElement>('[data-you-live]') ?? all[all.length - 1];
    if (!you) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.motion === 'reduced';
    const sr = scroller.getBoundingClientRect();
    const yr = you.getBoundingClientRect();
    const moves: { el: HTMLElement; axis: 'scrollTop' | 'scrollLeft'; from: number; to: number }[] = [];
    if (yr.top < sr.top || yr.bottom > sr.bottom) {
      const to = scroller.scrollTop + yr.top + yr.height / 2 - sr.top - sr.height / 2;
      moves.push({ el: scroller, axis: 'scrollTop', from: scroller.scrollTop, to: Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, to)) });
    }
    const map = you.closest<HTMLElement>('.pb-bracket');
    if (map) {
      const mr = map.getBoundingClientRect();
      if (yr.left < mr.left || yr.right > mr.right) {
        const to = map.scrollLeft + yr.left + yr.width / 2 - mr.left - mr.width / 2;
        moves.push({ el: map, axis: 'scrollLeft', from: map.scrollLeft, to: Math.max(0, Math.min(map.scrollWidth - map.clientWidth, to)) });
      }
    }
    if (!moves.length) return;
    if (reduce || document.hidden) { moves.forEach((m) => { m.el[m.axis] = m.to; }); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / 260);
      const eased = 1 - (1 - t) ** 3;
      moves.forEach((m) => { m.el[m.axis] = m.from + (m.to - m.from) * eased; });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lookingAt, shown, matchupKey, findTeam, followTeam]);

  if (!season || !team || !bracket) return null;

  // Any played game opens its box. A bracket game carries its lines with it;
  // the day-keyed store is the fallback for a save written before that.
  const openGame = (g: BracketGame | null | undefined): void => {
    if (!g) return;
    if (g.box) { setOpenBox(g.box); return; }
    const day = g.day;
    if (day === undefined || !season.boxScores?.[day]) return;
    setOpenBox(season.boxScores[day]);
  };
  const openSlot = (slot: DESlot): void => openGame(slot.game);

  const name = (i: number): string => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';
  const conf = conferenceName(team.conference);

  /*
    The trophy this stage has handed out, if it has: the stage's champion,
    yours or a rival's. A rival's is reported; only yours is your banner.
  */
  const crown: Crown | null = (() => {
    if (bracket.stage === 'national') {
      const champ = nat?.final?.champion;
      if (champ === undefined) return null;
      return {
        team: champ, rung: 2,
        kicker: `${year} national champions`,
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
        kicker: `${year} regional champions`,
        line: 'On to the national tournament.',
      };
    }
    const mineCup = bracket.cups.find((c) => c.champion === userTeam);
    if (!mineCup) return null;
    return {
      team: userTeam, rung: 0,
      kicker: `${year} ${conferenceName(mineCup.conference)} champions`,
      line: 'The conference is yours.',
    };
  })();

  const nationalBid = nat ? nationalBidReason(nat.field, userTeam) : null;
  const stageTitle = shown === 0 ? `${conf} tournament`
    : shown === 1 ? 'Regionals' : 'National tournament';
  const formatLine = shown === 0
    ? `Double elimination: a team is out after its second loss. The top ${CONF_ADVANCE} go on to the regionals.`
    : shown === 1
      ? 'Best of 3: first to 2 wins. The regional champions go on to the national tournament.'
      : `${NATIONAL_BIDS} teams in two double-elimination brackets. The two bracket champions play a best of 3 for the national title.`;

  const qualified = inTheField
    ? {
        good: true,
        title: `You are the ${ordinal(mySeed)} seed`,
        lines: [`Finish in the top ${CONF_ADVANCE} of the ${conf} tournament and you play a regional.`],
      }
    : {
        good: false,
        title: 'Season over',
        lines: [
          `${team.def.school} finished outside the top ${CONF_FIELD}, who make the tournament.`,
          'Follow the rest of June from here, then get ready for next season.',
        ],
      };

  /*
    Where the year stopped, or didn't. Out of a tournament is not always out
    of June: second place in a conference goes to a regional, and a top-four
    team is guaranteed a national place whatever its regional does. Kept
    short: these cards are read at the loudest moment of a season.
  */
  const howFar = (() => {
    const kind = knockout?.kind ?? 'conference';
    // The store writes the round in lower case ("losers round 3"); the screen
    // says it in the postseason's own words ("elimination round 3").
    const round = knockout?.label?.replace(/^the\s+/i, '') ?? '';
    const where = round ? ` in the ${roundWords(sentence(round)).toLowerCase()}` : '';
    const place = knockout?.placing ?? 0;

    if (kind === 'conference' && knockout?.advanced) {
      const finished = place === 2 ? 'Runners-up' : place === 3 ? 'Third in the conference' : 'Fourth in the conference';
      return {
        good: true,
        title: finished,
        lines: [
          `${team.def.school} are out of the ${conf} tournament.`,
          `The top ${CONF_ADVANCE} go on. Next is a regional: best of 3, first to 2 wins.`,
        ],
      };
    }
    if (kind === 'conference') {
      const bid = knockout?.bid ?? 'none';
      if (bid === 'secure') return {
        good: true,
        title: 'Guaranteed a place',
        lines: [
          `${team.def.school} go out${where} of the ${conf} tournament.`,
          'Your regular season already guaranteed a place in the national tournament. This does not change it.',
        ],
      };
      if (bid === 'awaiting') return {
        good: true,
        title: 'Waiting to be picked',
        lines: [
          `${team.def.school} go out${where} of the ${conf} tournament.`,
          'The national field is picked after the regionals, and your ranking is inside the numbers. Nothing is settled yet.',
        ],
      };
      return {
        good: false,
        title: 'Season over',
        lines: [
          `${team.def.school} go out${where} of the ${conf} tournament.`,
          'Your postseason is over. Follow the rest of June, then get ready for next season.',
        ],
      };
    }
    if (kind === 'regional' && knockout?.advanced) {
      const guaranteed = protectedTopFour(season).includes(userTeam);
      return {
        good: true,
        title: guaranteed ? 'Guaranteed a place' : 'Picked for the national field',
        lines: [
          `${team.def.school} lose the regional championship series.`,
          guaranteed
            ? 'Your top-four regular-season ranking guarantees a place in the national tournament.'
            : 'Your regular-season ranking earns one of the places left after the regional champions and the top four.',
        ],
      };
    }
    if (kind === 'regional') {
      return {
        good: false,
        title: 'Out at the regional',
        lines: [
          `${team.def.school} lose the regional championship series.`,
          'You were not picked for the national field. Follow the rest of June, then get ready for next season.',
        ],
      };
    }
    if (kind === 'final') {
      return {
        good: false,
        title: 'Runners-up',
        lines: [
          `${team.def.school} lose the national championship series.`,
          'Second best in the country, and it still feels like this.',
        ],
      };
    }
    return {
      good: false,
      title: 'Out of the national tournament',
      lines: [
        `${team.def.school} take a second loss${where}.`,
        `${NATIONAL_BIDS} teams reach the national tournament. Most of the country never does.`,
      ],
    };
  })();

  /*
    The June injury hold: a man hurt in May is still hurt tonight, and the
    bracket fields the lineup as written, so a hurt starter holds the game
    until the coach moves him. Only for a coach who sets his own lineup.
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
  const LIVE_NAME = ['the conference tournament', 'the regionals', 'the national tournament'];
  // One line, on the bar: the card's own note names him too.
  const holdLine = hurtNine.length === 1 ? `${hurtNine[0]!.name} cannot play.` : `${hurtNine.length} players cannot play.`;
  const action: {
    label: string;
    run: () => void;
    /** Why the button is holding, or how much it plays. */
    note?: string;
    secondary?: { label: string; onClick: () => void } | null;
    /** No beat: the press opens something rather than playing anything. */
    instant?: boolean;
  } = reviewing !== null
    // Looking back at a finished tournament: the one useful thing to do is go
    // back to where the season actually is.
    ? {
        label: `Back to ${LIVE_NAME[rung] ?? 'the tournament'}`,
        run: () => setReviewing(null),
        instant: true,
      }
    : due
    ? (hurtNine.length > 0
      ? {
          label: 'Fix the lineup',
          run: () => setShowLineup(true),
          instant: true,
          note: holdLine,
        }
      : {
          label: 'Play this game',
          run: manage,
          instant: true,
          secondary: { label: 'Sim this game', onClick: () => sim('game') },
        })
    : myBracket
      ? {
          // Your next game is the primary; the round is the secondary. Once
          // you are out, the pair becomes the rest of this tournament and the
          // round.
          // Short enough for one line each: the notes under them say the rest.
          // "Simulate to the Pacific Coast championship" ran to three.
          label: iAmOut ? 'Sim to the final' : 'Sim to my game',
          run: () => sim(iAmOut ? 'rest' : 'mine'),
          // One line each, for a bar that keeps one height.
          note: iAmOut ? 'Plays the rest of the tournament.' : 'Plays every game before yours.',
          // One short line whatever the round is called: "Sim the elimination
          // round 1" wrapped and made the bar a line taller (2026-09-24).
          secondary: {
            label: 'Sim this round',
            onClick: () => sim('round'),
          },
        }
      : stagePlayed
        ? {
            label: bracket.stage === 'conference'
              ? (wonConference ? 'On to the regionals' : 'See the regionals')
              : bracket.stage === 'regional'
                ? (wonRegional ? 'On to the national tournament' : 'See the national tournament')
                : 'End the season',
            run: advance,
          }
        : bracket.stage === 'national'
          ? {
              label: (!nat?.bracketA || !nat.bracketB) ? 'Play the brackets' : 'Play the championship',
              run: advance,
            }
          // A spectator's tier, not yet played.
          : {
              label: bracket.stage === 'conference' ? 'Play the tournaments' : 'Play the regionals',
              run: advance,
            };

  const findMine = (): void => {
    const halves = splitShowdown(nat?.field.seeds ?? []);
    const half = halves.bracketA.includes(userTeam) ? 'A' : halves.bracketB.includes(userTeam) ? 'B' : null;
    if (shown === 2 && half) setNatHalf(half);
    // It says so when you are not in the tournament on screen.
    setNotHere(!inShownStage);
    setFollowTeam(true);
    setFindTeam((n) => n + 1);
  };

  // Your next game's card, or the stage just decided.
  const showNext = reviewing === null && !spectatorMode && juneTab === 'next';
  const decidedCard = showNext && myBracket === null && stagePlayed;
  const nextCard = showNext && !(myBracket === null && stagePlayed);
  /*
    The moment's buttons, made once and shown in one place: on the card when
    there is one (your next game, or the stage just decided), and on a bar
    over the nav when there is not (the bracket, games to watch, a stage looked
    back on). They lived on the bar alone, a big block over the nav that left
    the card too little room, so the card was read by scrolling past it
    (2026-09-26, "that big gray thing with the buttons").
  */
  const buttons = (
    <>
      {action.secondary && (
        <Button
          variant="secondary"
          disabled={beat !== null || gameHeld}
          onClick={withBeat(action.secondary.label, action.secondary.onClick)}
        >{action.secondary.label}</Button>
      )}
      <Button
        variant="primary"
        disabled={beat !== null || (gameHeld && reviewing === null)}
        onClick={action.instant ? action.run : withBeat(action.label, action.run)}
      >{beat ?? action.label}</Button>
    </>
  );
  // The conference's banner says the tournament's name better than a line of
  // type, the way Standings uses it; the other stages have none.
  const bannerTitle = shown === 0 && hasBanner(team.conference);

  return (
    <>
      {modal === 'in' && (
        <Modal
          kicker={`${year} postseason`}
          title={qualified.title}
          lines={qualified.lines}
          tone={qualified.good ? 'win' : 'clay'}
          action={qualified.good ? 'Let’s go' : 'Follow the rest of June'}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'out' && (
        <Modal
          kicker={howFar.good ? `${year} · Still alive` : `${year} · Season over`}
          title={howFar.title}
          lines={howFar.lines}
          // Advancing is not winning: green is only for a trophy.
          tone={howFar.good ? 'ink' : 'clay'}
          action={howFar.good
            ? (knockout?.kind === 'conference' ? 'On to the regional' : 'On to the national tournament')
            : 'Follow the rest of June'}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'title' && titleGame && (
        <Modal
          kicker={titleGame.kicker}
          title={titleGame.title}
          lines={titleGame.lines}
          tone="ink"
          action="Take the field"
          // Lands on the live stage and your next game, where the game is.
          onClose={() => {
            setReviewing(null);
            setJuneTab('next');
            setModal(null);
          }}
        />
      )}

      {openBox !== null && (
        <BoxScoreSheet box={openBox} season={season} onClose={() => setOpenBox(null)} />
      )}

      {showLineup && (
        <div className="pb-fulloverlay" role="dialog" aria-modal="true" aria-label="Your lineup for June">
          <div className="pb-overlaybar">
            <span className="pb-overlaybar__title">Your lineup for June</span>
            <span className="pb-overlaybar__trailing">
              <Button size="sm" variant="primary" icon="check" onClick={() => setShowLineup(false)}>Done</Button>
            </span>
          </div>
          <div className="pb-fulloverlay__scroll"><Lineup /></div>
        </div>
      )}

      <div className="pb-june">
        <div
          ref={scrollerRef}
          className="pb-june__scroll"
          onWheel={() => setFollowTeam(false)}
          onTouchMove={() => setFollowTeam(false)}
        >
          <main className="pb-page">
            <FirstVisit id="postseason" />
            <Marquee
              className="pb-june__head"
              eyebrow={`${year} postseason${bannerTitle ? ' · Conference tournament' : ''}${reviewing !== null ? ' · Looking back' : ''}`}
              title={bannerTitle ? <ConferenceBanner id={team.conference} height={44} /> : stageTitle}
            />
            <PhaseRail
              label="Postseason stages"
              steps={['Conference', 'Regionals', 'National'].map((label, i) => ({
                label,
                state: i < rung ? 'done' as const : i === rung ? 'current' as const : 'upcoming' as const,
                onClick: i <= rung && i !== shown ? () => setReviewing(i === rung ? null : i) : undefined,
              }))}
            />

            {reviewing === null && (
              <SegmentedControl<JuneTab>
                label="Postseason view"
                value={juneTab}
                onChange={setJuneTab}
                options={[
                  { value: 'next', label: spectatorMode ? 'Games to watch' : 'Your next game' },
                  { value: 'bracket', label: 'Bracket' },
                ]}
              />
            )}

            {(reviewing !== null || juneTab === 'bracket') && (
              <div className="pb-june__tools">
                {reviewing !== null && (
                  <Button size="sm" variant="secondary" icon="arrow-left" onClick={() => setReviewing(null)}>
                    Back to the current stage
                  </Button>
                )}
                <Button size="sm" variant="quiet" icon="crosshair" onClick={findMine}>Find my team</Button>
                {/* Never empty, so the row cannot change height under a thumb. */}
                <span className="pb-text-muted" aria-live="polite">
                  {notHere
                    ? `${team.def.school} did not reach this one.`
                    : !followTeam ? 'Following paused while you browse.' : ' '}
                </span>
              </div>
            )}

            {reviewing === null && shown === 2 && nationalBid && !knockedOut && (
              <Callout tone="positive" title={BID_TITLE[nationalBid]}>{BID_TEXT[nationalBid]}</Callout>
            )}

            {crown && (
              <CrownCard crown={crown} mine={crown.team === userTeam} school={name(crown.team)} abbr={abbr(crown.team)} />
            )}

            {pendingGame && (
              <Card
                eyebrow="Game in progress"
                title="You left this one on the field"
                footer={(
                  <div className="pb-buttons-2">
                    <Button variant="secondary" onClick={() => void resumeGame(false)}>Let them finish</Button>
                    <Button variant="primary" icon="play" onClick={() => void resumeGame(true)}>Pick it up</Button>
                  </div>
                )}
              >
                <p className="pb-text">{pendingGame.line}</p>
              </Card>
            )}

            {reviewing === null && spectatorMode && juneTab === 'next' && (
              <ImportantGames
                bracket={bracket}
                myBracket={myBracket}
                sideShow={sideShow}
                conference={team.conference}
                name={name}
                abbr={abbr}
                onOpen={openGame}
              />
            )}

            {/* Between stages, standing here still alive means you won the one
                just finished, or are waiting on the next: say which. */}
            {decidedCard && (
              <Card
                className="pb-june__decided"
                eyebrow="Your next game"
                footer={<div className="pb-buttons-2">{buttons}</div>}
                title={bracket.stage === 'conference'
                  ? (wonConference ? 'Conference champions' : 'The conference is decided')
                  : bracket.stage === 'regional'
                    ? (wonRegional ? 'Regional champions' : 'The regionals are decided')
                    : 'This stage is decided'}
              >
                {bracket.stage === 'conference' && !wonConference && settledCup ? (
                  <ConferenceFinals cup={settledCup} name={name} abbr={abbr} onOpen={openGame} />
                ) : (
                  <p className="pb-text">
                    {bracket.stage === 'conference'
                      ? (wonConference
                        ? 'The tournament is yours. The regionals are drawn next.'
                        : `${settledChamp ?? 'Another team'} won the ${conf} tournament.`)
                      : bracket.stage === 'regional'
                        ? (wonRegional
                          ? 'The regional is yours. The national field is picked next.'
                          : 'Every regional is decided.')
                        : 'Every game in this stage is played.'}
                  </p>
                )}
              </Card>
            )}
            {nextCard && (
              <NextGame
                myBracket={myBracket}
                userTeam={userTeam}
                season={season}
                me={team}
                name={name}
                abbr={abbr}
                hurtNine={hurtNine}
                onLineup={() => setShowLineup(true)}
                actions={buttons}
              />
            )}

            {(reviewing !== null || juneTab === 'bracket') && (
              <div className="pb-stack" key={`${shown}:${lookingAt}`}>
                {shown === 0 && (
                  <ConferenceStage
                    cups={bracket.cups}
                    mine={myBracket?.kind === 'conference' && myBracket.format === 'double'
                      ? myBracket.state : null}
                    myConference={team.conference}
                    name={name}
                    abbr={abbr}
                    userTeam={userTeam}
                    onOpen={openSlot}
                  />
                )}
                {shown === 1 && (
                  <RegionalStage
                    regionals={bracket.regionals}
                    onOpen={openGame}
                    mine={myBracket?.kind === 'regional' && myBracket.format === 'series'
                      ? { state: myBracket.state, meta: myBracket.meta ?? null }
                      : null}
                    myRegion={regionOf(team.conference)}
                    name={name}
                    abbr={abbr}
                    userTeam={userTeam}
                  />
                )}
                {shown === 2 && (
                  <NationalStage
                    nat={nat}
                    onOpenGame={openGame}
                    myBracket={myBracket}
                    sideShow={sideShow}
                    half={natHalf ?? (myBracket?.kind === 'national' && myBracket.format === 'double'
                      ? (myBracket.half ?? 'A') : 'A')}
                    onHalf={setNatHalf}
                    name={name}
                    abbr={abbr}
                    userTeam={userTeam}
                    onOpen={openSlot}
                  />
                )}
              </div>
            )}
          </main>
        </div>

        {/* Only where no card holds the buttons, and light: the buttons on the
            page's own ground, not a raised block. Its note line is kept even
            when empty, so the buttons never jump when one comes and goes. */}
        {!decidedCard && !nextCard && (
          <ActionBar className="pb-june__bar" note={action.note ?? ''}>{buttons}</ActionBar>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Games to watch — once your season is over
// ---------------------------------------------------------------------------

interface SpotlightGame {
  key: string;
  kicker: string;
  title: string;
  a: number | null;
  b: number | null;
  game: BracketGame | null;
  note: string;
}

/** The deciding game if it exists, otherwise the first championship game. */
function spotlightFinal(slots: readonly DESlot[] | undefined): DESlot | null {
  if (!slots || slots.length === 0) return null;
  return [...slots].reverse().find(
    (slot) => slot.game === null && slot.a !== null && slot.b !== null,
  ) ?? [...slots].reverse().find((slot) => slot.game !== null)
    ?? [...slots].reverse().find((slot) => slot.a !== null || slot.b !== null)
    ?? slots[0] ?? null;
}

function gameSpotlight(
  key: string, kicker: string, title: string,
  a: number | null, b: number | null, game: BracketGame | null, note: string,
): SpotlightGame {
  return { key, kicker, title, a, b, game, note };
}

/**
 * When your team is done, June becomes something to follow rather than a dead
 * bracket: the championship of the stage being played, then the national title
 * as soon as its finalists exist. The full bracket is one tab over.
 */
function ImportantGames(
  { bracket, myBracket, sideShow, conference, name, abbr, onOpen }:
  {
    bracket: NonNullable<ReturnType<typeof useDynasty.getState>['bracket']>;
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    sideShow: ReturnType<typeof useDynasty.getState>['sideShow'];
    conference: string;
    name: (i: number) => string;
    abbr: (i: number) => string;
    onOpen: (g: BracketGame | null | undefined) => void;
  },
) {
  const games: SpotlightGame[] = [];
  const conf = conferenceName(conference);
  const set = (a: number | null | undefined, b: number | null | undefined): boolean =>
    a !== null && a !== undefined && b !== null && b !== undefined;

  if (bracket.stage === 'conference') {
    const cup = bracket.cups.find((c) => c.conference === conference);
    const live = myBracket?.kind === 'conference' && myBracket.format === 'double'
      ? spotlightFinal(myBracket.state.final) : null;
    const settled = spotlightFinal(cup?.de?.final);
    const slot = live ?? settled;
    games.push(gameSpotlight(
      'conference-title', 'Conference tournament', `${conf} championship`,
      slot?.a ?? null, slot?.b ?? null, slot?.game ?? null,
      slot?.game
        ? `${name(slot.game.winner)} won the championship game.`
        : set(slot?.a, slot?.b) ? 'The championship game is set.'
          : 'The bracket is still deciding who reaches the championship.',
    ));
  } else if (bracket.stage === 'regional') {
    const region = regionOf(conference);
    const local = bracket.regionals.filter((r) => r.region === region);
    const pool = local.length > 0 ? local : bracket.regionals;
    for (const r of pool.slice(-3)) {
      const last = r.games[r.games.length - 1] ?? null;
      games.push(gameSpotlight(
        `regional-${r.region}-${r.seeds.join('-')}`,
        'Regionals', `${r.name} regional`,
        r.seeds[0] ?? null, r.seeds[1] ?? null, last,
        last ? `${name(r.champion)} won the regional and go on.` : 'This regional series is still being decided.',
      ));
    }
    if (games.length === 0) {
      games.push(gameSpotlight(
        'regional-forming', 'Regionals', 'Regional championships', null, null, null,
        'The conference tournaments are filling the regional field now.',
      ));
    }
  } else {
    const nat = bracket.national;
    const final = nat?.final ?? null;
    if (final) {
      const last = final.games[final.games.length - 1] ?? null;
      games.push(gameSpotlight(
        'national-title', 'National tournament', 'National championship',
        final.seeds[0] ?? null, final.seeds[1] ?? null, last,
        `National champions: ${name(final.champion)}.`,
      ));
    } else {
      const champA = nat?.bracketA?.champion ?? null;
      const champB = nat?.bracketB?.champion ?? null;
      if (champA !== null && champB !== null) {
        games.push(gameSpotlight(
          'national-title-forming', 'National tournament', 'National championship',
          champA, champB, null,
          'Both bracket champions are set. The championship series is next.',
        ));
      }
      const half = (which: 'A' | 'B'): SpotlightGame | null => {
        const result = which === 'A' ? nat?.bracketA : nat?.bracketB;
        if (result) {
          const slot = spotlightFinal(result.final);
          return gameSpotlight(
            `national-${which}`, `National bracket ${which}`, `Bracket ${which} championship`,
            slot?.a ?? result.placings?.[0] ?? null, slot?.b ?? result.placings?.[1] ?? null,
            slot?.game ?? null,
            `Bracket ${which} champions: ${name(result.champion)}.`,
          );
        }
        const state = myBracket?.kind === 'national' && myBracket.format === 'double'
          && myBracket.half === which ? myBracket.state
          : sideShow?.half === which ? sideShow.state : null;
        if (!state) return null;
        const slot = spotlightFinal(state.final);
        return gameSpotlight(
          `national-${which}`, `National bracket ${which}`, `Bracket ${which} championship`,
          slot?.a ?? null, slot?.b ?? null, slot?.game ?? null,
          slot?.game ? `${name(slot.game.winner)} won this championship game.`
            : set(slot?.a, slot?.b) ? 'The bracket championship is set.'
              : 'This bracket is still deciding its finalists.',
        );
      };
      for (const which of ['A', 'B'] as const) {
        const item = half(which);
        if (item && !games.some((g) => g.key === item.key)) games.push(item);
      }
    }
  }

  const side = (t: number | null, runs: number | undefined, winner: number | undefined): BracketTeam => ({
    abbr: t !== null ? abbr(t) : '',
    name: t !== null ? name(t) : 'To be decided',
    score: runs,
    winner: winner !== undefined && t === winner,
    out: winner !== undefined && t !== null && t !== winner,
  });

  return (
    <section className="pb-stack">
      <SectionHeader
        title="Games to watch"
      />
      {games.slice(0, 3).map((item) => {
        const away = item.game?.away ?? item.a;
        const home = item.game?.home ?? item.b;
        const winner = item.game?.winner;
        const state = item.game ? 'Final' : away !== null && home !== null ? 'Set' : 'Still forming';
        return (
          <Card
            key={item.key}
            eyebrow={item.kicker}
            title={item.title}
            trailing={<StatusBadge tone={item.game ? 'neutral' : 'info'} icon={false}>{state}</StatusBadge>}
          >
            <BracketMatch
              teams={[
                side(away, item.game?.awayRuns, winner),
                side(home, item.game?.homeRuns, winner),
              ]}
              onClick={item.game ? () => onOpen(item.game) : undefined}
            />
            <p className="pb-text-muted">{item.note}</p>
          </Card>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Your next game
// ---------------------------------------------------------------------------

/**
 * The game in front of you: both teams with their tournament records, the
 * probable starters (picked the way the engine will pick them), what a loss
 * would mean, and Play or Simulate. A hurt starter in the lineup turns Play
 * into Fix the lineup.
 */
function NextGame(
  { myBracket, userTeam, season, me, name, abbr, hurtNine, onLineup, actions }:
  {
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    userTeam: number;
    season: SeasonState;
    me: { def: { abbr: string; school: string }; conference: string };
    name: (i: number) => string;
    abbr: (i: number) => string;
    hurtNine: Hitter[];
    onLineup: () => void;
    /** The night's buttons: Sim and Play, or what stands in for them. */
    actions: ReactNode;
  },
) {
  /*
    One shape, whatever the night is (2026-09-24): the matchup, the two
    starters, the night's buttons and one line of what a loss means, the same
    height always, so dropping to the elimination side never resizes it.

    The buttons are back in the card (2026-09-26). They had moved to a bar
    pinned over the nav, and with the header above, the card no longer fitted
    between them: "it looks awful now having that big gray thing with the
    buttons and having to scroll down to the box to be able to see it". The
    header shrank instead (the banner is the title, no step count), so the
    whole card, buttons included, sits above the nav on a phone.
  */
  let opp: number | null = null;
  let home = false;
  let format = '';
  let when: string | null = null;
  let loss: string | null = null;

  if (myBracket && myBracket.format === 'series') {
    const next = nextGameFor(myBracket.state, userTeam);
    const sr = liveSeries(myBracket.state, userTeam);
    const len = myBracket.state.lengths[sr?.round ?? 0] ?? 3;
    format = `Best of ${len}`;
    if (next && sr) {
      const host = hostOfGame(sr, sr.games.length);
      opp = next.a === userTeam ? next.b : next.a;
      home = host === userTeam;
      const wins = (t: number): number => sr.games.filter((g) => g.winner === t).length;
      const mine = wins(userTeam);
      const theirs = wins(opp);
      const need = clincher(len) - theirs;
      when = `Game ${sr.games.length + 1} of ${len} · ${mine === theirs ? `level at ${recordText(mine, theirs)}` : mine > theirs ? `you lead ${recordText(mine, theirs)}` : `you trail ${recordText(mine, theirs)}`}`;
      loss = need <= 1 ? 'A loss ends the series' : `First to ${clincher(len)} wins takes the series`;
    }
  } else if (myBracket) {
    format = 'Double elimination';
    const slot = liveSlotFor(myBracket.state, userTeam);
    const losses = myBracket.state.losses.get(userTeam) ?? 0;
    if (slot && slot.a !== null && slot.b !== null) {
      const host = slot.side === 'F' ? slot.a : (slot.aSeed <= slot.bSeed ? slot.a : slot.b);
      opp = slot.a === userTeam ? slot.b : slot.a;
      home = host === userTeam;
      when = roundWords(slotName(slot));
      loss = slot.side === 'F'
        ? (slot.round === 1 ? 'The winner takes the title'
          : losses === 0 ? 'Win and the title is yours'
            : 'Win this and the deciding game')
        : losses === 0 ? 'A loss drops you to the elimination side' : 'Elimination side: a loss ends your run';
    }
  }

  const tournamentRecord = (t: number): string => {
    if (!myBracket) return recordText(0, 0);
    if (myBracket.format === 'series') {
      const series = liveSeries(myBracket.state, t);
      if (!series) return recordText(0, 0);
      const w = series.games.filter((g) => g.winner === t).length;
      return recordText(w, series.games.length - w);
    }
    const state = myBracket.state;
    let w = 0;
    let l = 0;
    for (const slot of [...state.winners.flat(), ...state.losers.flat(), ...state.final]) {
      if (slot.winner === null || slot.winner === undefined) continue;
      if (slot.a !== t && slot.b !== t) continue;
      if (slot.winner === t) w += 1; else l += 1;
    }
    return recordText(w, l);
  };

  // The probable starters: each side's own appearances, walked forward past
  // an arm that cannot take the ball.
  const used = (side: number): number =>
    ((myBracket?.state as { appearances?: Map<number, number> } | undefined)?.appearances?.get(side) ?? 0) % 3;
  // The name on its line and the ERA under it: side by side, a full name cut
  // the ERA off on a phone. Every starter has the second line, so the card
  // keeps its height.
  const armFor = (side: number): { value: string; note: string } => {
    const rec = season.teams[side];
    // The calendar day, which outings are written on; in June the schedule
    // index has stopped and every arm read as owed rest (M57).
    const at = rec ? startableSlot(season, rec.team, used(side), currentDay(season), injuryClock(season)) : 0;
    const arm = rec?.team.rotation[at] ?? rec?.team.rotation[0];
    if (!arm) return { value: '—', note: '—' };
    const line = season.pitching.get(arm.id);
    return { value: arm.name, note: line && line.outs >= 9 ? `${era(line).toFixed(2)} ERA` : 'No ERA yet' };
  };
  const none = { value: '—', note: '—' };

  const recLabel = myBracket?.format === 'series' ? 'In this series' : 'In this tournament';
  const us = {
    abbr: me.def.abbr,
    name: me.def.school,
    record: <>{tournamentRecord(userTeam)}<small>{recLabel}</small></>,
    you: true,
  };
  // Between rounds the other side is TBD, with a record line of its own so the
  // card keeps its height.
  const them = opp === null
    ? { abbr: 'TBD', name: 'TBD', record: <>—<small>{recLabel}</small></> }
    : { abbr: abbr(opp), name: name(opp), record: <>{tournamentRecord(opp)}<small>{recLabel}</small></> };
  const plan = opp !== null && !!season.playbooks?.[abbr(opp)];
  const held = opp !== null && hurtNine.length > 0;
  const note = held
    ? (hurtNine.length === 1 ? `${hurtNine[0]!.name} cannot play` : `${hurtNine.length} players cannot play`)
    : opp === null ? 'Waiting on your opponent' : loss ?? format;

  // The format rides the head's line, after the round, so the head's right
  // end is free for the lineup: one line, whatever the round is called.
  const kind = plan ? `${format} · Plan on` : format;
  return (
    <GameCard
      className="pb-game--june"
      label="Your next game"
      when={<>{when ?? 'Your next game'}{kind && <span className="pb-game__format"> · {kind}</span>}</>}
      headAction={(
        <Button variant="quiet" size="sm" icon="id-card" className="pb-game__lineup" onClick={onLineup}>Lineup</Button>
      )}
      away={home ? them : us}
      home={home ? us : them}
      facts={[
        { label: 'Your starter', ...(opp === null ? none : armFor(userTeam)) },
        { label: 'Their starter', ...(opp === null ? none : armFor(opp)) },
      ]}
      actions={actions}
    >
      <div className={`pb-inlinerow ${held ? 'is-warning' : 'is-info'}`}>
        <Icon name={held ? 'alert' : 'info'} size={16} />
        <span className="pb-inlinerow__text">{note}</span>
      </div>
    </GameCard>
  );
}

/**
 * How a conference tournament you are no longer in finished: the championship
 * game (and the deciding game, when there was one) and the elimination final
 * before it, each with both teams and the score. Asked for 2026-09-24 in place
 * of a sentence naming the winner.
 */
function ConferenceFinals(
  { cup, name, abbr, onOpen }:
  {
    cup: ConferenceTournament;
    name: (i: number) => string;
    abbr: (i: number) => string;
    onOpen: (g: BracketGame | null | undefined) => void;
  },
) {
  const rows: { key: string; round: string; game: BracketGame }[] = [];
  const add = (slots: readonly DESlot[] | undefined): void => {
    for (const slot of slots ?? []) {
      if (slot.game) rows.push({ key: `${slot.side}-${slot.round}-${slot.slot}`, round: roundWords(slotName(slot)), game: slot.game });
    }
  };
  add(cup.de?.losers[cup.de.losers.length - 1]);
  add(cup.de?.final);
  if (rows.length === 0) {
    for (const g of cup.games.slice(-2)) rows.push({ key: `${g.day}-${g.home}-${g.away}`, round: g.round, game: g });
  }
  const side = (t: number, runs: number, winner: number): BracketTeam => ({
    abbr: abbr(t), name: name(t), score: runs, winner: t === winner, out: t !== winner,
  });
  return (
    <div className="pb-stack">
      {rows.map((r) => (
        <div key={r.key} className="pb-stack">
          <span className="pb-eyebrow">{r.round}</span>
          <BracketMatch
            teams={[side(r.game.away, r.game.awayRuns, r.game.winner), side(r.game.home, r.game.homeRuns, r.game.winner)]}
            onClick={() => onOpen(r.game)}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The brackets
// ---------------------------------------------------------------------------

/**
 * One double elimination, both sides: the winners side on top, where every
 * team starts, and the elimination side under it, where a first loss sends
 * you. Your drop is said in words between them.
 */
function OneMap(
  { de, name, abbr, userTeam, onOpen, mine }:
  {
    de: DECols;
    name: (i: number) => string;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen?: (s: DESlot) => void;
    /** Whether your team plays in this bracket. */
    mine: boolean;
  },
) {
  const dropped = mine && de.losers.some((r) => r.some((sl) => sl.a === userTeam || sl.b === userTeam));
  return (
    <>
      <SectionHeader level={3} title="Winners side" description="One loss drops a team below" />
      <DoubleElimMap de={de} view="winners" name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
      {dropped && (
        <Callout tone="warning" title="You dropped to the elimination side">One more loss ends your run.</Callout>
      )}
      <SectionHeader level={3} title="Elimination side" description="A second loss ends it" />
      <DoubleElimMap de={de} view="losers" name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} showFinal={false} />
    </>
  );
}

function ConferenceStage(
  { cups, mine, myConference, name, abbr, userTeam, onOpen }:
  {
    cups: ConferenceTournament[];
    mine: DoubleElim | null;
    myConference: string;
    name: (i: number) => string;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen: (s: DESlot) => void;
  },
) {
  const [openConf, setOpenConf] = useState<string | null>(null);
  // Yours first, live or finished; then the rest of the country.
  const myCup = cups.find((c) => c.conference === myConference);
  const myDe: DECols | null = mine
    ? { winners: mine.winners, losers: mine.losers, final: mine.final }
    : myCup?.de ? myCup.de as DECols : null;
  const others = cups.filter((c) => c.conference !== myConference && c.de);

  return (
    <>
      <section className="pb-stack">
        <SectionHeader title={`${conferenceName(myConference)} tournament`} />
        {myDe
          ? <OneMap de={myDe} name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} mine={!!mine || myCup?.de !== undefined} />
          : <p className="pb-text-muted">The bracket is drawn when the tournament starts.</p>}
      </section>
      {others.length > 0 && (
        <section className="pb-stack">
          <SectionHeader title="Other conferences" count={others.length} />
          {others.map((c) => {
            const on = openConf === c.conference;
            return (
              <Card
                key={c.conference}
                title={`${conferenceName(c.conference)} tournament`}
                trailing={c.champion !== null
                  ? <StatusBadge tone="neutral" icon="star-filled">{name(c.champion)}</StatusBadge>
                  : <StatusBadge tone="info" icon={false}>In progress</StatusBadge>}
              >
                <Button
                  variant="quiet"
                  size="sm"
                  iconAfter={on ? 'chevron-down' : 'chevron-right'}
                  aria-expanded={on}
                  onClick={() => setOpenConf(on ? null : c.conference)}
                >{on ? 'Hide the bracket' : 'Show the bracket'}</Button>
                {on && (
                  <DoubleElimMap de={c.de as DECols} view="winners" name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
                )}
              </Card>
            );
          })}
        </section>
      )}
    </>
  );
}

function RegionalStage(
  { regionals, mine, myRegion, name, abbr, userTeam, onOpen }:
  {
    regionals: RegionalSeries[];
    onOpen: (g: BracketGame) => void;
    mine: {
      state: SeriesBracket;
      meta: { region: string; name: string; aLabel: string; bLabel: string } | null;
    } | null;
    myRegion: string;
    name: (i: number) => string;
    abbr: (i: number) => string;
    userTeam: number;
  },
) {
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
        const mineHere = mine && (mine.meta?.region ?? myRegion) === region.id ? mine : null;
        if (list.length === 0 && !mineHere) return null;
        return (
          <section key={region.id} className="pb-stack">
            <SectionHeader
              title={`${region.name} regionals`}
              description={region.id === myRegion ? 'Your region · best of 3' : 'Best of 3'}
            />
            {mineHere && (
              <LiveSeriesCard state={mineHere.state} name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
            )}
            {list.map((r, i) => (
              <SeriesResultCard key={i} r={r} name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
            ))}
          </section>
        );
      })}
    </>
  );
}

/** The games of a series, each a door to its box score. */
function SeriesGames(
  { games, name, onOpen }:
  { games: readonly BracketGame[]; name: (i: number) => string; onOpen?: (g: BracketGame) => void },
) {
  if (!onOpen || games.length === 0) return null;
  return (
    <div className="pb-series-games">
      {games.map((g, i) => {
        const hi = Math.max(g.homeRuns, g.awayRuns);
        const lo = Math.min(g.homeRuns, g.awayRuns);
        return (
          <Button key={i} size="sm" variant="quiet" iconAfter="chevron-right" onClick={() => onOpen(g)}>
            Game {i + 1}: {name(g.winner)} won {hi}–{lo}
          </Button>
        );
      })}
    </div>
  );
}

/** Both teams of a series, their wins as the score. */
function seriesTeams(
  a: number, b: number, winsOf: (t: number) => number, champion: number | null,
  name: (i: number) => string, abbr: (i: number) => string, userTeam: number,
): BracketTeam[] {
  const side = (t: number): BracketTeam => ({
    abbr: abbr(t), name: name(t), score: winsOf(t),
    winner: champion === t, out: champion !== null && champion !== t, you: t === userTeam,
  });
  return [side(a), side(b)];
}

/** A finished (or simulated) series, as a card. */
function SeriesResultCard(
  { r, name, abbr, userTeam, onOpen }:
  {
    r: RegionalSeries | TournamentResult;
    name: (i: number) => string; abbr: (i: number) => string; userTeam: number;
    onOpen?: (g: BracketGame) => void;
  },
) {
  const a = r.seeds[0]; const b = r.seeds[1];
  if (a === undefined || b === undefined) return null;
  const winsOf = (t: number): number => r.games.filter(
    (g) => (g.homeRuns > g.awayRuns ? g.home : g.away) === t,
  ).length;
  const mine = a === userTeam || b === userTeam;
  return (
    <div {...(mine ? { 'data-you': '' } : {})} className="pb-stack">
      <BracketMatch
        status="Final · games won"
        teams={seriesTeams(a, b, winsOf, r.champion, name, abbr, userTeam)}
      />
      <SeriesGames games={r.games} name={name} onOpen={onOpen} />
    </div>
  );
}

/** Your live series, game by game. */
function LiveSeriesCard(
  { state, name, abbr, userTeam, onOpen }:
  {
    state: SeriesBracket;
    name: (i: number) => string; abbr: (i: number) => string; userTeam: number;
    onOpen?: (g: BracketGame) => void;
  },
) {
  const s: Series | undefined = state.rounds[0]?.[0];
  if (!s || s.a === null || s.b === null) return null;
  const wins = (t: number): number => s.games.filter((g) => g.winner === t).length;
  const len = state.lengths[0] ?? 3;
  return (
    <div data-you="" data-you-live="" className="pb-stack">
      <BracketMatch
        status={`Best of ${len} · ${s.winner === null ? `game ${s.games.length + 1} next` : 'final'} · games won`}
        live={s.winner === null}
        teams={seriesTeams(s.a, s.b, wins, s.winner, name, abbr, userTeam)}
      />
      <SeriesGames games={s.games} name={name} onOpen={onOpen} />
    </div>
  );
}

function NationalStage(
  { nat, myBracket, sideShow, half, onHalf, name, abbr, userTeam, onOpen, onOpenGame }:
  {
    nat: NationalProgress | null;
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    sideShow: ReturnType<typeof useDynasty.getState>['sideShow'];
    half: NatHalf;
    onHalf: (h: NatHalf) => void;
    name: (i: number) => string;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen: (s: DESlot) => void;
    onOpenGame?: (g: BracketGame) => void;
  },
) {
  if (!nat) return <p className="pb-text-muted">The national field is being drawn.</p>;

  // Each half is the one you are playing, the one being played beside it, or
  // a finished result, and its header says which.
  const halfOf = (which: NatHalf): { de: DECols; tag: string; tone: 'info' | 'neutral' } | null => {
    if (myBracket?.kind === 'national' && myBracket.format === 'double' && myBracket.half === which) {
      const s = myBracket.state;
      return { de: { winners: s.winners, losers: s.losers, final: s.final }, tag: 'Your bracket · being played', tone: 'info' };
    }
    if (sideShow && sideShow.half === which) {
      const s = sideShow.state;
      return { de: { winners: s.winners, losers: s.losers, final: s.final }, tag: 'Being played', tone: 'info' };
    }
    const r = which === 'A' ? nat.bracketA : nat.bracketB;
    return r ? { de: { winners: r.winners, losers: r.losers, final: r.final }, tag: 'Final', tone: 'neutral' } : null;
  };
  const shownHalf = halfOf(half);
  const iPlayHere = myBracket?.kind === 'national' && myBracket.format === 'double' && myBracket.half === half;

  return (
    <>
      <section className="pb-stack">
        <SectionHeader title="National championship" description="Best of 3" />
        {myBracket?.kind === 'final' && myBracket.format === 'series' ? (
          <LiveSeriesCard state={myBracket.state} name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpenGame} />
        ) : nat.final ? (
          <SeriesResultCard r={nat.final} name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpenGame} />
        ) : (
          <p className="pb-text-muted">Waiting on both brackets.</p>
        )}
      </section>

      <SegmentedControl<NatHalf>
        label="National bracket"
        value={half}
        onChange={onHalf}
        options={[{ value: 'A', label: 'Bracket A' }, { value: 'B', label: 'Bracket B' }]}
      />

      <section className="pb-stack">
        <div className="pb-june__halfhead">
          <SectionHeader title={`National bracket ${half}`} />
          {shownHalf && <StatusBadge tone={shownHalf.tone} icon={false}>{shownHalf.tag}</StatusBadge>}
        </div>
        {shownHalf
          ? <OneMap de={shownHalf.de} name={name} abbr={abbr} userTeam={userTeam} onOpen={onOpen} mine={iPlayHere} />
          : <p className="pb-text-muted">This bracket is being drawn.</p>}
      </section>
    </>
  );
}

/** A decided trophy: which one, who took it, and whose banner it is. */
export interface Crown {
  team: number;
  /** 0 conference, 1 regional, 2 the country. */
  rung: 0 | 1 | 2;
  kicker: string;
  line: string;
}

/**
 * The champion, at the top of the stage where it cannot be missed. The same
 * fact at three sizes; and only your own title is called your banner.
 */
function CrownCard(
  { crown, mine, school, abbr }:
  { crown: Crown; mine: boolean; school: string; abbr: string },
) {
  return (
    <div role="group" className={cx('pb-crown', `pb-crown--${crown.rung}`, mine && 'is-mine')} aria-label={`${crown.kicker}: ${school}`}>
      <Crest abbr={abbr} size={crown.rung === 2 ? 64 : 52} />
      <span className="pb-crown__text">
        <span className="pb-eyebrow">{crown.kicker}</span>
        <strong className="pb-crown__school">{school}</strong>
        <span className="pb-crown__line">{crown.line}</span>
        {mine && <span className="pb-crown__tags"><Tag tone="positive">Your banner</Tag></span>}
      </span>
    </div>
  );
}
