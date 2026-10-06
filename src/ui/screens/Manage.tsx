// Manage.tsx
// The manager's chair. Every plate appearance, all nine innings.
//
// You never swing a bat: you make the call and read what happened. One screen,
// nothing scrolls the park away: a slim score bar with the bases on the same
// line (tap it for the full line score), the park, the two men in the matchup,
// and every call, all at once. The dugout (pinch hitters, the bullpen, the
// mound) sits behind one button at the bottom, beside the bench coach, who
// calls the game until you take it back.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teamColour } from '../Avatar.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf } from '../../engine/ratings.js';
import { era, type BattingSeason, type PitchingSeason } from '../../engine/season.js';
import type { Arm } from '../../engine/types.js';
import { battingAverage } from '../../engine/season.js';
import { pct } from '../format.js';
import { blockingCardUp, useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import {
  buzz, crowdLeverage, crowdStart, crowdStop, crowdSwell, sfx,
} from '../sound.js';
import {
  ActionBar, BaseState, Button, Callout, ConfirmButton, FeedItem, Icon, LineScore, List, ListRow,
  PlayerRow, Sheet, Tag, baseStateText, cx, type FillTone,
} from '../components/ui/index.js';
import { POSITION_NAME, ordinal, plural } from '../words.js';

/**
 * The 3D field, loaded only when a game is actually being managed: three.js is
 * roughly 600KB and nothing else needs it. The 2D diamond is the fallback, a
 * complete working field, so a slow connection gets the game, not a spinner.
 */
import type { BallHit } from '../Diamond3D.js';
import { appliedStrategy, currentDay, injuryClock, recoveryGap } from '../../engine/season.js';
import { available as fitToPlay } from '../../engine/depthChart.js';
import { whyOut } from '../Needs.js';
import { usePark } from '../park.js';
import { Diamond } from '../Diamond.js';
import { Boundary } from '../Boundary.js';
import { readPrefs } from '../../state/devicePrefs.js';
import type { Hitter, PlayerId } from '../../engine/types.js';

/** The game PLAY BALL has been called for. */
let announcedGame: unknown = null;

type Modal = 'dugout' | 'log' | null;
type Pick = 'pinch' | 'pen' | null;

/** The engine's calls, in the words and hints the screen uses. */
const CALL_NAME: Record<string, string> = {
  'SWING AWAY': 'Swing away',
  'HIT AND RUN': 'Hit and run',
  'SAC BUNT': 'Sacrifice bunt',
  'BUNT FOR A HIT': 'Bunt for a hit',
  'PLAY FOR CONTACT': 'Play for contact',
  'STEAL SECOND': 'Steal second',
  'STEAL THIRD': 'Steal third',
  PITCH: 'Pitch',
  'PITCH FOR GROUND': 'Pitch for a ground ball',
  'PITCH AROUND': 'Pitch around him',
  'INFIELD IN': 'Infield in',
  'WALK HIM': 'Walk him',
};
const callName = (label: string): string => CALL_NAME[label] ?? label.charAt(0) + label.slice(1).toLowerCase();
const sentence = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export { cleanPlay } from '../format.js';
import { groupPlays, lastStep } from '../format.js';

export function Manage() {
  const live = useDynasty((s) => s.live);
  const meta = useDynasty((s) => s.liveMeta);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  // Whether the pen and the mound visits are yours tonight: in a casual career
  // they are delegated on purpose, so the controls come off rather than grey.
  // Read off the game, which fixed them at first pitch: the switch flipped
  // mid-game took the Bullpen button away from a game that still asked the
  // coach about every pitch (M34). The switch applies from the next game.
  const depth = useDynasty((s) => s.depth);
  const myPen = live ? !live.autoPitching : handles(depth, 'bullpen');
  const myVisits = live ? !live.autoVisits : handles(depth, 'moundVisits');
  const submitTactic = useDynasty((s) => s.submitTactic);
  const visitMound = useDynasty((s) => s.visitMound);
  const pinchHitFor = useDynasty((s) => s.pinchHitFor);
  const bringIn = useDynasty((s) => s.bringIn);
  const autoFinish = useDynasty((s) => s.autoFinish);
  const endManagedGame = useDynasty((s) => s.endManagedGame);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const bracket = useDynasty((s) => s.bracket);
  const go = useDynasty((s) => s.go);
  const saveNow = useDynasty((s) => s.saveNow);
  /*
    The dugout stays mounted under its pickers, covered (2026-09-30), so the
    back gesture peels the picker and finds the dugout's layer already there.
    Swapped out, the dugout remounted during the pop and its entry was lost.
    Any other change of sheet closes both; a pick does too.
  */
  const [sheets, setSheets] = useState<{ base: Modal; top: Pick }>({ base: null, top: null });
  const modal = sheets.base;
  const picker = sheets.top;
  const setModal = (base: Modal): void => setSheets({ base, top: null });
  const setPicker = (top: Pick): void => setSheets((s) => ({ ...s, top }));
  /*
    A back press a June game refuses (nav's guard bumps `cardNudge`): the way
    on shakes, Dugout or Record the game. Motion only; a card up answers for
    itself (PF, 2026-09-30).
  */
  const liveEl = useRef<HTMLDivElement | null>(null);
  const nudge = useDynasty((s) => s.cardNudge);
  const nudgedAt = useRef(nudge);
  useEffect(() => {
    if (nudge === nudgedAt.current) return;
    nudgedAt.current = nudge;
    const s = useDynasty.getState();
    if (s.bracket === null || s.live === null || blockingCardUp(s)) return;
    const el = liveEl.current?.querySelector<HTMLElement>('.pb-live__bar :is([data-guide="dugout"], [data-guide="record-game"])');
    if (!el) return;
    el.classList.remove('is-nudged');
    void el.offsetWidth;
    el.classList.add('is-nudged');
  }, [nudge]);
  const [scoreTick, setScoreTick] = useState(0);
  const [ball, setBall] = useState<BallHit | null>(null);
  /*
    The words a home run deserves, over the park: GRAND SLAM when three men
    were aboard to score ahead of him. Gone in two and a half seconds.
  */
  const [splash, setSplash] = useState<{ tick: number; text: string } | null>(null);
  // The 2D diamond, chosen in Settings; read once, on the way in.
  const [flatField] = useState(() => readPrefs().field === '2d');
  const userTeam = useDynasty((s) => s.userTeam);
  /** The pen arms the dugout cannot call on tonight, and why. */
  const restingPen = (): { id: string; name: string; note: string; rating: number; disabled: true }[] => {
    const mine = season?.teams[userTeam];
    if (!live || !season || !mine) return [];
    const ready = new Set(live.bullpenAvailable.map((p) => p.id));
    const used = new Set(live.bullpenUsed.map((p) => p.id));
    const day = currentDay(season);
    const clock = injuryClock(season);
    return mine.team.bullpen
      .filter((p) => !ready.has(p.id) && p.id !== live.pitcherNow.id)
      .map((p) => {
        const last = season.pitcherWorkload?.get(p.id);
        const ago = last ? day - last.day : 0;
        const back = last ? Math.max(1, recoveryGap(last.pitches) - ago) : 1;
        const note = used.has(p.id) ? 'Already pitched tonight'
          : !fitToPlay(p, clock) ? sentence(whyOut(p, clock))
            : last
              ? `Threw ${last.pitches} ${ago <= 1 ? 'last night' : `${ago} days ago`} · back in ${plural(back, 'day')}`
              : 'Not on tonight’s card';
        return { id: p.id, name: p.name, note, rating: overallOf(p), disabled: true as const };
      });
  };
  // The 3D park's chunk, or the patience for it. See `park.ts`.
  const { Park, patient } = usePark(!flatField);
  /*
    Which side is in the field, as the PARK shows it, which lags the scoreboard
    by however long the last play takes to finish: the shirts turn over once
    the play is dead, not mid-chase. Initialised from the game, because the
    screen mounts mid-game whenever the coach steps out and back.
  */
  const [shownHalf, setShownHalf] = useState<'top' | 'bottom'>(
    () => useDynasty.getState().live?.half ?? 'top',
  );
  const liveHalf = useDynasty((s) => s.live?.half);
  const changingSides = liveHalf !== undefined && liveHalf !== shownHalf;
  useEffect(() => {
    if (liveHalf === undefined || liveHalf === shownHalf) return undefined;
    const t = setTimeout(() => setShownHalf(liveHalf), ball !== null ? 2050 : 850);
    return () => clearTimeout(t);
  }, [liveHalf, shownHalf, ball?.tick]);
  const ballTick = useRef(0);
  const lastRuns = useRef(0);
  void version;

  /*
    One press is one call: two taps a heartbeat apart used to submit two plate
    appearances, the second on a situation the manager never saw.
  */
  const lastCall = useRef(0);
  const once = (fn: () => void) => (): void => {
    const now = Date.now();
    if (now - lastCall.current < 500) return;
    lastCall.current = now;
    fn();
  };

  useEffect(() => {
    if (!ball || ball.y <= 1) return undefined;
    setSplash({ tick: ball.tick, text: scoredRunners.length >= 4 ? 'Grand slam' : 'Home run' });
    const id = window.setTimeout(() => setSplash(null), 2600);
    return () => window.clearTimeout(id);
  }, [ball?.tick]);

  // Follow the ball. A play with no contact clears the field rather than
  // leaving the last hit sitting there as if it were still live.
  const contact = live?.lastPlay.find((e) => e.kind === 'contact' && e.landing);
  const landing = contact?.landing;
  const battedBall = contact?.battedBall;
  const wasOut = !!live?.lastPlay.some((e) => e.kind === 'out');
  useEffect(() => {
    if (!landing || !battedBall) { setBall(null); return; }
    ballTick.current += 1;
    setBall({
      x: landing.x, y: landing.y, kind: battedBall,
      hit: !wasOut,
      caught: wasOut && battedBall !== 'ground',
      loose: (contact as { errored?: boolean } | undefined)?.errored === true,
      tick: ballTick.current,
    });
  }, [landing?.x, landing?.y, battedBall, wasOut, live?.playSeq]);

  /* A replay re-keys the same ball: nothing touches the engine. */
  const lastHit = useRef<BallHit | null>(null);
  useEffect(() => { if (ball) lastHit.current = ball; }, [ball]);
  const replay = (): void => {
    const hit = lastHit.current;
    if (!hit) return;
    ballTick.current += 1;
    setBall({ ...hit, tick: ballTick.current });
  };

  /*
    The calls sleep while the play is on the field, so nobody calls the next
    plate appearance over an animation they have not watched.
  */
  const [playing, setPlaying] = useState(false);

  /*
    The bench coach. He calls the same default the screen highlights, so it
    changes no outcome at the plate, and he keeps calling until you press Take
    over: handing the game back at every runner in scoring position made him a
    coach for one play. While he has it, your pitching changes and mound
    visits are his too (see `setBenchCoach`), so nobody comes back to a starter
    at a hundred and forty pitches.
  */
  const [auto, setAuto] = useState<null | 'watch'>(null);
  const setBenchCoach = useDynasty((s) => s.setBenchCoach);
  const coachOn = (): void => { setAuto('watch'); setBenchCoach(true); };
  const coachOff = (): void => { setAuto(null); setBenchCoach(false); };
  // Leaving the dugout with the bench coach in charge hands the arms back too:
  // the screen that comes back starts in your hands.
  const autoNow = useRef(auto);
  autoNow.current = auto;
  useEffect(() => () => {
    if (autoNow.current !== null) useDynasty.getState().setBenchCoach(false);
  }, []);
  const played = live?.log.length ?? 0;
  useEffect(() => {
    if (!landing || !battedBall) return undefined;
    setPlaying(true);
    const ms = battedBall === 'ground' ? 1700 : 2100;
    const timer = setTimeout(() => setPlaying(false), ms);
    return () => clearTimeout(timer);
  }, [played]);

  /*
    The broadcast. Every line a play appended is read, the batter's own line
    decides the sound, contact always cracks, the catch lands when the ball
    does, and a play's scheduled sounds never outlive it.
  */
  const prevPlayed = useRef(0);
  const pendingSfx = useRef<number[]>([]);
  const clearPending = (): void => {
    for (const id of pendingSfx.current) window.clearTimeout(id);
    pendingSfx.current = [];
  };
  useEffect(() => clearPending, []);
  useEffect(() => {
    if (!live) { prevPlayed.current = 0; return; }
    const fresh = live.log.slice(prevPlayed.current);
    prevPlayed.current = played;
    if (fresh.length === 0 || fresh.length > 8) return;
    clearPending();
    const text = fresh.join('\n');
    const vary = (): number => 0.94 + ((played * 37) % 13) / 100;
    const crack = (gain: number): void => sfx(played % 2 ? 'crack' : 'crack2', { rate: vary(), gain });
    const catchAt = (ms: number, gain = 0.55): void => {
      pendingSfx.current.push(window.setTimeout(() => sfx('glove2', { gain }), ms));
    };
    if (/win it\./.test(text)) {
      if (/singles|doubles|triples|HOMERS|beats out|error|sacrifice/.test(text)) crack(1);
      sfx('clap', { gain: 0.9 });
      crowdSwell(1);
      buzz([40, 60, 120]);
      return;
    }
    if (/caught stealing/.test(text)) {
      sfx('glove', { gain: 0.8, rate: vary() });
      crowdSwell(0.2);
      buzz(12);
      return;
    }
    if (/steals /.test(text)) {
      crowdSwell(0.3);
      buzz(15);
      return;
    }
    const main = [...fresh].reverse().find((l) => !/^[\s\n]|^---/.test(l)) ?? '';
    if (/HOMERS/.test(main)) {
      crack(1); crowdSwell(0.8); buzz([25, 40, 60]);
    } else if (/triples|doubles/.test(main)) {
      crack(0.95); crowdSwell(0.45); buzz(20);
    } else if (/singles|beats out/.test(main)) {
      crack(0.9); crowdSwell(0.25); buzz(15);
    } else if (/strikes out/.test(main)) {
      sfx('glove', { rate: vary(), gain: 0.95 }); crowdSwell(0.2); buzz(12);
    } else if (/reaches on/.test(main)) {
      crack(0.85); crowdSwell(0.2); buzz(12);
    } else if (/double play/.test(main)) {
      crack(0.75); catchAt(600); catchAt(1350, 0.5); buzz(10);
    } else if (/grounds|bunts/.test(main)) {
      crack(0.7); catchAt(600); catchAt(1350, 0.45); buzz(10);
    } else if (/flies out|lines out|pops out|sacrifice fly|is retired/.test(main)) {
      crack(0.75); catchAt(1750); buzz(10);
    } else if (/lays down a sacrifice/.test(main)) {
      crack(0.6); catchAt(600); buzz(8);
    } else if (/walks|walked on purpose/.test(main)) {
      crowdSwell(0.22); buzz(8);
    } else if (/hit by the pitch/.test(main)) {
      sfx('glove', { rate: 0.8, gain: 0.6 }); crowdSwell(0.25); buzz(20);
    }
  }, [played]);

  /* The crowd: first pitch starts it, the final out sends it home, and how
     loud it idles follows the leverage. */
  const liveOn = !!live && !live.over;
  useEffect(() => {
    if (!liveOn) { crowdStop(); return undefined; }
    if (announcedGame !== live) { announcedGame = live; sfx('playball', { gain: 0.7 }); }
    crowdStart();
    return () => crowdStop();
  }, [liveOn]);
  const levInning = live?.pending?.inning ?? 0;
  const levMargin = Math.abs((live?.pending?.homeRuns ?? 0) - (live?.pending?.awayRuns ?? 0));
  useEffect(() => {
    if (!liveOn) return;
    crowdLeverage(levInning >= 8 && levMargin <= 2 ? 1 : levInning >= 7 ? 0.5 : 0.15);
  }, [liveOn, levInning, levMargin]);

  /* The bench coach calling: one call per tick, waiting out each play, until
     the game ends or you take it back. */
  useEffect(() => {
    if (auto === null || !live || live.over || playing || changingSides) return undefined;
    const t = setTimeout(() => {
      const cur = useDynasty.getState().live;
      if (!cur || cur.over) { setAuto(null); return; }
      const pick = cur.pending?.options.find((o) => o.available);
      if (pick) submitTactic(pick.tactic);
      else setAuto(null);
    }, 900);
    return () => clearTimeout(t);
  }, [auto, playing, changingSides, version, live?.over]);
  useEffect(() => { if (live?.over) setAuto(null); }, [live?.over]);

  /*
    The park takes whatever height the screen can spare, measured, so the
    canvas is exactly the box it sits in and the whole field is always in view.
  */
  const [sceneH, setSceneH] = useState(220);
  const sceneObserver = useRef<ResizeObserver | null>(null);
  const sceneRef = useCallback((el: HTMLDivElement | null) => {
    sceneObserver.current?.disconnect();
    sceneObserver.current = null;
    if (!el) return;
    const measure = (): void => setSceneH(Math.max(120, Math.round(el.clientHeight)));
    measure();
    if (typeof ResizeObserver === 'function') {
      sceneObserver.current = new ResizeObserver(measure);
      sceneObserver.current.observe(el);
    }
  }, []);
  // The full line score, folded under the score bar until it is asked for.
  const [box, setBox] = useState(false);

  /* Tonight's defensive positioning, so the men stand where the engine says. */
  const positioning = useMemo(() => {
    if (!season || !meta) return undefined;
    const fi = shownHalf === 'top' ? meta.home : meta.away;
    const oi = shownHalf === 'top' ? meta.away : meta.home;
    const f = season.teams[fi];
    const o = season.teams[oi];
    if (!f || !o) return undefined;
    const st = appliedStrategy(season, f, o);
    return { infield: st.infield, outfield: st.outfield, shift: st.shift };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, meta, shownHalf, version]);

  /* Who crossed the plate on the last play: one crossing per man per play. */
  const scoredRunners = useMemo(() => {
    const crossed = (live?.lastPlay ?? [])
      .filter((e) => e.kind === 'advance')
      .flatMap((e) => e.runners ?? [])
      .filter((r) => r.to === 4)
      .map((r) => ({ id: r.id, from: r.from }));
    const seen = new Set<string>();
    return crossed.filter((r) => {
      if (seen.has(String(r.id))) return false;
      seen.add(String(r.id));
      return true;
    });
  }, [live, version]);

  const totalRuns = (live?.pending?.awayRuns ?? 0) + (live?.pending?.homeRuns ?? 0);
  useEffect(() => {
    if (totalRuns !== lastRuns.current) {
      lastRuns.current = totalRuns;
      setScoreTick((n) => n + 1);
    }
  }, [totalRuns]);

  /*
    The runners the field draws, held across the gap between decisions:
    rendering through that gap unmounted every runner, and the walk animation
    never played.
  */
  const runnersHeld = useRef<NonNullable<NonNullable<typeof live>['pending']>['runners']>([]);

  if (!live || !meta || !season) {
    return (
      <div className="pb-live pb-live--empty">
        <p className="pb-text-muted">Every call of the next game, yours.</p>
        <Button variant="primary" icon="play" onClick={() => void startManagedGame()}>Manage the next game</Button>
      </div>
    );
  }

  const home = season.teams[meta.home];
  const away = season.teams[meta.away];
  const d = live.pending;
  const r = live.result;
  if (d) runnersHeld.current = d.runners;

  const status = d ? `${d.half === 'top' ? 'Top' : 'Bottom'} ${ordinal(d.inning)}` : 'Final';
  const awayRuns = d ? d.awayRuns : r.away.runs;
  const homeRuns = d ? d.homeRuns : r.home.runs;
  // Plays, not lines: the batter's line with what the runners did on it.
  const recent = groupPlays(live.log);
  const say = (p: { text: string; notes: string[] }): string => [p.text, ...p.notes].join(' ');
  // The last call, whole: a steal or a wild pitch before the result, too.
  const step = lastStep(recent);
  const latest = step.length > 0 ? step.map(say).join(' ') : null;

  // The linescore: completed halves from the record, the half being played is
  // the difference, and an unneeded bottom ninth is an X.
  const battingHalf = d?.half ?? null;
  const awayLs = r.away.lineScore;
  const homeLs = r.home.lineScore;
  const innCols = Math.max(9, awayLs.length + (battingHalf === 'top' ? 1 : 0), homeLs.length + (battingHalf === 'bottom' ? 1 : 0));
  const cellsFor = (side: 'away' | 'home'): Array<string | number> => {
    const ls = side === 'away' ? awayLs : homeLs;
    const runs = side === 'away' ? r.away.runs : r.home.runs;
    const batting = side === 'away' ? battingHalf === 'top' : battingHalf === 'bottom';
    const sum = ls.reduce((a, b) => a + b, 0);
    return Array.from({ length: innCols }, (_, i) => {
      if (i < ls.length) return ls[i] ?? 0;
      if (batting && i === ls.length) return runs - sum;
      if (live.over && side === 'home' && i === ls.length && awayLs.length > homeLs.length) return 'X';
      return '';
    });
  };
  // The word nobody says: from the sixth, a side without a hit. Never named.
  const nono = !!d && d.inning >= 6 && (r.home.hits === 0 || r.away.hits === 0);
  const late = !!d && d.inning >= 8 && Math.abs(d.homeRuns - d.awayRuns) <= 2;
  const mineBatting = d?.side === 'offense';

  const flatSize = Math.max(96, Math.min(sceneH - 16, 220));
  const field = flatField ? (
    <div className="pb-live__diamond"><Diamond runners={d?.runners ?? runnersHeld.current} scoreTick={scoreTick} size={flatSize} /></div>
  ) : Park ? (
    <Boundary fallback={() => (
      <div className="pb-live__diamond"><Diamond runners={d?.runners ?? runnersHeld.current} scoreTick={scoreTick} size={flatSize} /></div>
    )}>
      <Park
        runners={d?.runners ?? runnersHeld.current} scoreTick={scoreTick}
        ball={ball} scored={{ runners: scoredRunners, tick: scoreTick }} height={sceneH}
        // Midweek plays in the afternoon; the weekend series and all of June under the lights.
        night={meta.postseason === true || season.schedule[season.dayIndex]?.kind !== 'midweek'}
        accent={teamColour(season.teams[meta.home]?.def.abbr ?? '')}
        // Fielders in the defending school's colour, runners in the batting side's.
        defenceColour={teamColour(season.teams[shownHalf === 'top' ? meta.home : meta.away]?.def.abbr ?? '')}
        offenceColour={teamColour(season.teams[shownHalf === 'top' ? meta.away : meta.home]?.def.abbr ?? '')}
        positioning={positioning}
      />
    </Boundary>
  ) : patient ? (
    <div className="pb-live__loading" aria-hidden><span>Setting up the ballpark</span><i /></div>
  ) : (
    <div className="pb-live__diamond"><Diamond runners={d?.runners ?? runnersHeld.current} scoreTick={scoreTick} size={flatSize} /></div>
  );

  // Stamina is the pitches he has left against tonight's allowance; confidence
  // is the engine's own, full when he takes the mound and lost to hits, walks
  // and traffic. Both empty as the game goes, which is how they should read.
  const stamina = d ? Math.round((Math.max(0, d.outing.budget - d.outing.pitches) / Math.max(1, d.outing.budget)) * 100) : 0;
  const confidence = d ? Math.round(Math.max(0, Math.min(1, d.outing.confidence)) * 100) : 0;
  const gaugeTone = (v: number): FillTone => (v > 50 ? 'positive' : v > 25 ? 'warning' : 'negative');
  const userWon = live.over && ((meta.home === userTeam) === (homeRuns > awayRuns));

  return (
    <div ref={liveEl} className={`pb-live${nono ? ' is-nono' : late ? ' is-late' : ''}`}>
      <FirstVisit id="manage" />

      <header className="pb-live__top">
        <button
          type="button"
          className="pb-scorebug"
          aria-expanded={box}
          aria-label={`${away?.def.school} ${awayRuns}, ${home?.def.school} ${homeRuns}, ${status}. ${box ? 'Hide' : 'Show'} the line score.`}
          onClick={() => setBox((b) => !b)}
        >
          <span className={cx('pb-scorebug__team', d?.half === 'top' && 'is-batting', meta.away === userTeam && 'is-you')}>
            <b>{away?.def.abbr ?? 'AWY'}</b><em>{awayRuns}</em>
          </span>
          <span className={cx('pb-scorebug__team', d?.half === 'bottom' && 'is-batting', meta.home === userTeam && 'is-you')}>
            <b>{home?.def.abbr ?? 'HOM'}</b><em>{homeRuns}</em>
          </span>
          <span className="pb-scorebug__inning">
            {d ? <><Icon name={d.half === 'top' ? 'arrow-up' : 'arrow-down'} size={12} />{ordinal(d.inning)}</> : 'Final'}
          </span>
          <Icon name="chevron-down" size={16} className={cx('pb-scorebug__more', box && 'is-open')} />
        </button>
        {nono && <Tag tone="warning" title="A side has no hits yet. Nobody says the word.">Shh</Tag>}
        {d && <BaseState bases={d.bases} outs={d.outs} size={34} />}
      </header>
      {box && (
        <div className="pb-live__box">
          <LineScore
            status={status}
            inning={d?.inning}
            innings={innCols}
            teams={[
              { abbr: away?.def.abbr ?? 'AWY', innings: cellsFor('away'), r: awayRuns, h: r.away.hits, e: r.away.errors, you: meta.away === userTeam, batting: d?.half === 'top' },
              { abbr: home?.def.abbr ?? 'HOM', innings: cellsFor('home'), r: homeRuns, h: r.home.hits, e: r.home.errors, you: meta.home === userTeam, batting: d?.half === 'bottom' },
            ]}
          />
        </div>
      )}

      <div className="pb-live__scene ballpark-scene" ref={sceneRef}>
        {splash && <div className="hr-splash pb-live__splash" key={splash.tick} aria-hidden>{splash.text}</div>}
        {field}
      </div>

      <div className="pb-live__panel">
        {d && (
          <section className="pb-matchup" aria-label="The matchup">
            <div className="pb-matchup__side">
              <span className="pb-matchup__role">{mineBatting ? 'Your hitter' : 'Hitting'}</span>
              <b className="pb-matchup__name">{d.batter.name}</b>
              <span className="pb-matchup__meta">{d.batter.pos} · {batterShort(season, d.batter.id)}</span>
            </div>
            <div className="pb-matchup__side">
              <span className="pb-matchup__role">{mineBatting ? 'Pitching' : 'Your pitcher'} · {d.outing.pitches} pitches</span>
              <b className="pb-matchup__name">{d.pitcher.name}</b>
              <span className="pb-matchup__bars">
                <Gauge label="Stamina" value={stamina} tone={gaugeTone(stamina)} />
                <Gauge label="Confidence" value={confidence} tone={gaugeTone(confidence)} />
              </span>
            </div>
          </section>
        )}

        {latest && (
          <button type="button" className="pb-live__latest" onClick={() => setModal('log')}>
            <span className="pb-live__latest-text">{latest}</span>
            <span className="pb-live__latest-all">All plays</span>
          </button>
        )}

        {d ? (
          <div className="pb-callgrid" role="radiogroup" aria-label="Your call">
            {auto !== null && (
              <span className="pb-callgrid__coach" role="status"><Icon name="wand" size={14} />Your bench coach is calling it</span>
            )}
            {d.options.map((o, i) => {
              // Off while the play is on the field, and off because the
              // situation forbids it, are two different greys: the second
              // says why.
              const ready = o.available && !playing && !changingSides && auto === null;
              const note = o.available ? sentence(o.note) : `Not now: ${o.note}`;
              return (
                <button
                  key={o.tactic}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  className={cx('pb-callbtn', i === 0 && 'is-default')}
                  data-guide={i === 0 ? 'call-default' : undefined}
                  disabled={!ready}
                  title={note}
                  onClick={once(() => ready && submitTactic(o.tactic))}
                >
                  <b>{callName(o.label)}</b>
                  <small>{note}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <Callout
            tone={userWon ? 'positive' : 'neutral'}
            title={`${awayRuns > homeRuns ? away?.def.school : home?.def.school} win ${Math.max(awayRuns, homeRuns)}–${Math.min(awayRuns, homeRuns)}`}
          />
        )}
      </div>

      <ActionBar className="pb-live__bar">
        {d ? (
          <>
            <Button variant="secondary" icon="dots" data-guide="dugout" onClick={() => setModal('dugout')}>Dugout</Button>
            {auto === null ? (
              <Button variant="secondary" icon="wand" disabled={playing || changingSides} onClick={coachOn}>Bench coach</Button>
            ) : (
              <Button variant="primary" icon="person" onClick={coachOff}>Take over</Button>
            )}
          </>
        ) : (
          <Button variant="primary" data-guide="record-game" onClick={() => void endManagedGame()}>Record the game</Button>
        )}
      </ActionBar>

      {modal === 'dugout' && d && (
        <Sheet
          eyebrow={`Dugout · ${status}`}
          title={d.side === 'offense' ? 'Create the next edge' : 'Protect this inning'}
          subtitle={`${away?.def.school} ${awayRuns}, ${home?.def.school} ${homeRuns} · ${baseStateText(d.bases, d.outs)}`}
          onClose={() => setModal(null)}
          covered={picker !== null}
        >
          <List label="This inning">
            {d.side === 'offense' && (
              <ListRow
                icon="swap"
                title={`Pinch hit for ${d.batter.name}`}
                subtitle={live.benchAvailable.length > 0 ? `${plural(live.benchAvailable.length, 'bench player')} available` : 'Nobody left on the bench'}
                disabled={playing || changingSides || live.benchAvailable.length === 0}
                onClick={() => setPicker('pinch')}
              />
            )}
            {d.side === 'defense' && myPen && (
              <ListRow
                icon="swap"
                title="Go to the bullpen"
                subtitle={live.bullpenAvailable.length > 0 ? `${plural(live.bullpenAvailable.length, 'arm')} ready` : 'Nobody is ready'}
                disabled={playing || changingSides || live.bullpenAvailable.length === 0}
                onClick={() => setPicker('pen')}
              />
            )}
            {d.side === 'defense' && myVisits && (
              <ListRow
                icon="chat"
                title={d.outing.visitUsed ? 'Mound visit used' : 'Visit the mound'}
                subtitle={`${confidence}% confidence · ${d.outing.visitUsed ? 'one visit per pitcher' : 'a visit settles him'}`}
                disabled={playing || changingSides || auto !== null || d.outing.visitUsed}
                onClick={() => { void visitMound(); setModal(null); }}
              />
            )}
            {lastHit.current && (
              <ListRow
                icon="reset"
                title="See that again"
                subtitle="Replay the last ball in play"
                disabled={playing || changingSides}
                onClick={() => { setModal(null); replay(); }}
              />
            )}
          </List>
          <section className="pb-stack">
            <h3 className="pb-sheet__section">Who manages the rest</h3>
            {auto === null ? (
              <Button
                variant="secondary"
                block
                icon="wand"
                disabled={playing || changingSides}
                onClick={() => { coachOn(); setModal(null); }}
              >Let the bench coach call it</Button>
            ) : (
              <Button variant="secondary" block icon="person" onClick={() => { coachOff(); setModal(null); }}>Take the dugout back</Button>
            )}
            <ConfirmButton
              variant="secondary"
              block
              guide="sim-rest"
              idle="Sim the rest"
              meta="Can’t be undone"
              armed="Tap again to sim the rest"
              armedMeta="Plays it out now"
              disabled={playing || changingSides}
              onConfirm={() => { setModal(null); once(autoFinish)(); }}
            />
            {/* The way out without ending anything: the game keeps in memory
                and Play ball resumes it. June does not get this door; a June
                game holds the back gesture until it is over (2026-09-30). The
                old reason, that June could not save mid-bracket, is gone. */}
            {bracket === null && (
              <Button variant="quiet" block icon="arrow-left" onClick={() => { setModal(null); void saveNow(); go('home'); }}>
                Back to Today (the game waits)
              </Button>
            )}
          </section>
        </Sheet>
      )}

      {modal === 'log' && (
        <Sheet eyebrow={status} title="Play by play" onClose={() => setModal(null)} tall>
          <List label="Play by play">
            {[...recent].reverse().slice(0, 60).map((play, i) => {
              const called = /caught stealing|thrown out|double play|error/.test(say(play));
              return (
                <FeedItem
                  key={i}
                  meta={play.count}
                  title={play.text}
                  text={play.notes.length > 0 ? play.notes.join(' ') : undefined}
                  tone={called ? 'negative' : undefined}
                />
              );
            })}
          </List>
        </Sheet>
      )}

      {modal === 'dugout' && picker !== null && d && (
        <Picker
          title={picker === 'pinch' ? `Pinch hit for ${d.batter.name}` : 'Go to the bullpen'}
          eyebrow="Dugout decision"
          // The whole pen, with every resting arm greyed and saying why.
          rows={picker === 'pinch'
            ? live.benchAvailable.map((h: Hitter) => ({
              id: h.id, name: h.name, note: batLine(h, season.batting.get(h.id)), rating: overallOf(h),
            }))
            : [
              ...live.bullpenAvailable.map((p) => ({
                id: p.id, name: p.name, note: armLine(p, season.pitching.get(p.id)), rating: overallOf(p),
              })),
              ...restingPen(),
            ]}
          onPick={(id) => {
            if (picker === 'pinch') {
              const h = live.benchAvailable.find((x) => x.id === id);
              if (h) pinchHitFor(h);
            } else {
              const p = live.bullpenAvailable.find((x) => x.id === id);
              if (p) bringIn(p);
            }
            // Picker and dugout close in one commit: one history write, not two.
            setModal(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

/** Outs into the innings a box score prints: 5 outs is 1.2. */
const inningsFrom = (outs: number): string => `${Math.floor(outs / 3)}.${outs % 3}`;

/** The batter's season, short: average and home runs. */
function batterShort(
  season: ReturnType<typeof useDynasty.getState>['season'],
  id: PlayerId,
): string {
  const line = season?.batting.get(id);
  if (!line || line.ab === 0) return 'no at-bats yet';
  return `${pct(battingAverage(line))} · ${line.hr} HR`;
}

/** A gauge that starts full and empties: stamina, confidence. */
function Gauge({ label, value, tone }: { label: string; value: number; tone: FillTone }) {
  return (
    <span className="pb-gauge" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span className="pb-gauge__label">{label}</span>
      <span className="pb-gauge__track"><span className={`pb-gauge__fill pb-fill--${tone}`} style={{ width: `${value}%` }} /></span>
    </span>
  );
}

/** The batter's season line, in words: average, home runs, runs batted in. */
function batterLine(
  season: ReturnType<typeof useDynasty.getState>['season'],
  id: PlayerId,
): string {
  const line = season?.batting.get(id);
  if (!line || line.ab === 0) return 'No at-bats yet this season';
  return `${pct(battingAverage(line))} average · ${line.hr} HR · ${line.rbi} RBI`;
}

/** What a bench bat has done this year, on the picker row. */
function batLine(h: Hitter, s: BattingSeason | undefined): string {
  const hand = h.bats === 'S' ? 'Switch' : h.bats === 'L' ? 'Bats left' : 'Bats right';
  const pos = POSITION_NAME[h.pos] ?? h.pos;
  if (!s || s.ab === 0) return `${pos} · ${hand} · No at-bats yet`;
  return `${pos} · ${hand} · ${(s.h / s.ab).toFixed(3).replace(/^0/, '')} · ${s.hr} HR · ${s.rbi} RBI`;
}

/** And an arm's. */
function armLine(p: Arm, s: PitchingSeason | undefined): string {
  const hand = p.throws === 'L' ? 'Left-hander' : 'Right-hander';
  if (!s || s.outs === 0) return `${hand} · No innings yet`;
  return `${hand} · ${era(s).toFixed(2)} ERA · ${Math.floor(s.outs / 3)}.${s.outs % 3} innings · ${s.k} K`;
}

function Picker(
  { title, eyebrow, rows, onPick, onClose }:
  {
    title: string;
    eyebrow: string;
    rows: Array<{ id: string; name: string; note: string; rating: number; disabled?: boolean }>;
    onPick: (id: string) => void;
    onClose: () => void;
  },
) {
  return (
    <Sheet eyebrow={eyebrow} title={title} onClose={onClose} tall>
      {rows.length === 0 ? (
        <p className="pb-text-muted">Nobody is available.</p>
      ) : (
        <List label={title}>
          {rows.map((r) => (
            <PlayerRow
              key={r.id}
              name={r.name}
              meta={r.note}
              value={r.rating}
              valueLabel="Rating"
              disabled={r.disabled === true}
              chevron={!r.disabled}
              onClick={() => { if (!r.disabled) onPick(r.id); }}
              className={r.disabled ? 'is-resting' : undefined}
            />
          ))}
        </List>
      )}
    </Sheet>
  );
}
