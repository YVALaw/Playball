// Manage.tsx
// The manager's chair. Every plate appearance, all nine innings.
//
// This is the quick manage the mockup lays out and the roadmap calls the
// emotional core: you never swing a bat, you make the call and read what
// happened. The buttons change with the situation — a sacrifice is not offered
// with the bases empty, and you cannot put a man on when first is occupied.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftIcon, ChevronRightIcon, Cross1Icon, DotsHorizontalIcon, PlayIcon,
  StopwatchIcon,
} from '@radix-ui/react-icons';
import { PlayerName } from '../PlayerName.js';
import { teamColour } from '../Avatar.js';
import { FirstVisit } from '../Tutorial.js';
import { InFrame } from '../Overlay.js';
import { overallOf } from '../../engine/ratings.js';
import { battingAverage } from '../../engine/season.js';
import { pct } from '../format.js';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import {
  buzz, crowdLeverage, crowdStart, crowdStop, crowdSwell, sfx,
} from '../sound.js';
import { lazy, Suspense } from 'react';
import { LineScore } from '../LineScore.js';

/**
 * The 3D field, loaded only when a game is actually being managed.
 *
 * three.js is roughly 600KB and the rest of the app never needs it, so it must
 * not sit in the initial bundle — a dynasty screen has no business paying for a
 * renderer it will not use. The 2D diamond is the fallback rather than a spinner:
 * it is a complete, working field, so a slow connection or a device without
 * WebGL gets the game rather than a placeholder.
 */
import type { BallHit } from '../Diamond3D.js';
import { appliedStrategy } from '../../engine/season.js';

const Diamond3D = lazy(() =>
  import('../Diamond3D.js').then((m) => ({ default: m.Diamond3D })));
import type { Hitter, Pitcher, PlayerId } from '../../engine/types.js';

type Modal = 'pinch' | 'pen' | null;

export function Manage() {
  const live = useDynasty((s) => s.live);
  const meta = useDynasty((s) => s.liveMeta);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  // Whether the pen is yours tonight. The button comes off entirely rather
  // than being greyed: a disabled control implies you could have it, and in
  // casual you have delegated it on purpose.
  const depth = useDynasty((s) => s.depth);
  const myPen = handles(depth, 'bullpen');
  // Separate from the pen on purpose: somebody can want the bullpen and not the
  // conversations, or the other way round.
  const myVisits = handles(depth, 'moundVisits');
  // The 2D field is gone by request — "completely removing the 2D ballpark
  // in the dugout; instead we can add a lazy loading when the 3D is
  // loading." The park is the park; while its chunk downloads, a dressed
  // placeholder holds the seat.
  // The full linescore, on request rather than always. See the top bar.
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
  const [modal, setModal] = useState<Modal>(null);
  /** The dugout tools, behind the round button in the corner. Three phases,
      the same grammar as the player and college FABs: the menu leaves the way
      it arrives — reported here too, "a nice animation when opening but not
      when closing, it simply disappears." */
  const [toolsPhase, setToolsPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const tools = toolsPhase === 'open';
  const closeTools = (): void => {
    setToolsPhase('closing');
    window.setTimeout(() => {
      setToolsPhase((ph) => (ph === 'closing' ? 'closed' : ph));
    }, 200);
  };
  const setTools = (next: boolean): void => {
    if (next) setToolsPhase('open');
    else closeTools();
  };
  /** The linescore, open by default and closed by BOX. */
  const [book, setBook] = useState(true);
  const [scoreTick, setScoreTick] = useState(0);
  const [ball, setBall] = useState<BallHit | null>(null);
  /*
    The words a home run deserves — asked for after seeing the first burst:
    "we need something like big words and more firework." A DOM splash over
    the park rather than 3D text: the display font the whole app speaks, at
    a size no in-scene mesh could match, gone in two and a half seconds.
    GRAND SLAM when three men were aboard to score ahead of him.
  */
  const [splash, setSplash] = useState<{ tick: number; text: string } | null>(null);
  /*
    Which side is in the field, as the PARK is showing it — which lags the
    scoreboard by however long the last play takes to finish.
  */
  const [shownHalf, setShownHalf] = useState<'top' | 'bottom'>('top');
  /*
    Turn the sides over once the play is dead — a beat after, so the men who
    were chasing it have walked back to their stations first. Without the
    wait the third out repainted every shirt mid-chase, which is what "they
    just appear all of a sudden" was.
  */
  // Read from the store rather than from `d`, which is only in scope past the
  // early returns below — and a hook cannot live there.
  const liveHalf = useDynasty((s) => s.live?.pending?.half);
  useEffect(() => {
    if (liveHalf === undefined || liveHalf === shownHalf) return undefined;
    if (ball !== null) return undefined;      // a ball is still in play
    const t = setTimeout(() => setShownHalf(liveHalf), 700);
    return () => clearTimeout(t);
  }, [liveHalf, shownHalf, ball]);
  const ballTick = useRef(0);
  const lastRuns = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  void version;

  /*
    One press is one call. Reported from testing: "right now i can rapid fire
    the first button" — two taps a heartbeat apart submitted two plate
    appearances, the second on a situation the manager never saw. Long enough
    to swallow a double-tap, short enough that deliberate play never meets it.
  */
  const lastCall = useRef(0);
  const once = (fn: () => void) => (): void => {
    const now = Date.now();
    if (now - lastCall.current < 500) return;
    lastCall.current = now;
    fn();
  };

  /**
   * The log follows the game down.
   *
   * A play resolves two or three lines at once and a simmed rest of the game
   * resolves thirty, and snapping the scroll to the bottom made the text jump
   * out from under whoever was reading it — the same complaint as the map
   * camera, on a smaller board. It glides instead. The very first tail is still
   * a jump: joining a game already in progress and then watching it scroll down
   * from the top would be showing you the wrong innings on the way past.
   */
  const tailed = useRef(false);
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const smooth = tailed.current
      && !(typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    tailed.current = true;
    if (!smooth || typeof el.scrollTo !== 'function') {
      el.scrollTop = el.scrollHeight;
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  });

  useEffect(() => {
    if (!ball || ball.y <= 1) return undefined;
    setSplash({
      tick: ball.tick,
      text: scoredRunners.length >= 4 ? 'GRAND SLAM' : 'HOME RUN',
    });
    const id = window.setTimeout(() => setSplash(null), 2600);
    return () => window.clearTimeout(id);
  }, [ball?.tick]);

  // Follow the ball. `lastPlay` is cleared on every submit, so whatever contact
  // event is in it belongs to the play that just happened — and a play with no
  // contact (a strikeout, a walk) clears the field rather than leaving the last
  // hit sitting there as if it were still live.
  const contact = live?.lastPlay.find((e) => e.kind === 'contact' && e.landing);
  const landing = contact?.landing;
  const battedBall = contact?.battedBall;
  // An out on the play means the batter did not reach. A fielder's choice and a
  // sacrifice both count as outs, which is what a viewer reads them as.
  const wasOut = !!live?.lastPlay.some((e) => e.kind === 'out');
  useEffect(() => {
    if (!landing || !battedBall) { setBall(null); return; }
    ballTick.current += 1;
    setBall({
      x: landing.x, y: landing.y, kind: battedBall,
      hit: !wasOut,
      // Caught on the fly, which is not the same question as "was it an out":
      // a ground out reached the dirt and a dropped fly did not retire
      // anybody. The field draws a catch as a glove and everything else as a
      // ball on the grass with somebody running after it.
      caught: wasOut && battedBall !== 'ground',
      // A booted or thrown-away ball never settles into anybody's hands —
      // that posture is what made an error read as a clean out.
      loose: (contact as { errored?: boolean } | undefined)?.errored === true,
      tick: ballTick.current,
    });
    // `wasOut` is read above and belongs here: identical landing coordinates
    // with a different outcome must still refresh what the ball flashes.
    // playSeq, not version: version moves on mound visits and substitutions
    // too, and those play nothing.
  }, [landing?.x, landing?.y, battedBall, wasOut, live?.playSeq]);

  /*
    REPLAY — named in stage 5's brief, built in stage 15. The events already
    take zero random draws, so seeing a play again is nothing but re-keying
    the same BallHit: the flight, the chase, the throw, the camera's pan and
    a homer's whole show all run again off the fresh tick. Nothing touches
    the engine — a replay is a picture, and pictures are free.
  */
  const lastHit = useRef<BallHit | null>(null);
  useEffect(() => { if (ball) lastHit.current = ball; }, [ball]);
  const replay = (): void => {
    const hit = lastHit.current;
    if (!hit) return;
    ballTick.current += 1;
    setBall({ ...hit, tick: ballTick.current });
  };

  /*
    The calls sleep while the play is on the field.

    Reported from testing: *"you didn't work in the minigame's buttons to grey
    them out when the sim is doing an action so we don't tap the button fifty
    times real quick."* The 500ms tap guard stopped the double press; it did
    not stop a manager calling the next plate appearance over the top of an
    animation he had not watched. The window is the length of the play — a
    little over a second for anything on the ground, longer for a ball hit to
    the wall — and it is cosmetic in the sense that the engine has already
    resolved everything, and load-bearing in the sense that the play is the
    thing you are here for.
  */
  const [playing, setPlaying] = useState(false);

  /*
    Handing the dugout to your bench coach.

    SIM THE REST was all or nothing, so a manager up nine in the sixth chose
    between forty more taps and giving up the rest of the game unseen. Two
    softer doors, which is what the plan asked for:

      WATCH   he calls it, you watch it, the field animates and the log
              fills. Stoppable at any pitch, and it hands the dugout back on
              its own the moment something worth managing arrives.

    Neither changes a single outcome. The bench coach submits the same default
    call the screen already highlights, which is exactly what SIM THE REST has
    always done -- this only decides how much of it you see and when it stops.
  */
  const [auto, setAuto] = useState<null | 'watch'>(null);
  /*
    One flight per ball, not one per store change.

    This depended on `version`, which is bumped by *everything* -- so a mound
    visit or a trip to the bullpen replayed the last ball. Reported exactly that
    way: "it simulates one at bat even though it does not record it, but the
    animation of the ball flying runs". Nothing was simulated; the screen was
    showing the previous play again.

    A play is identified by how much has been written down. The log only grows
    when something happens, so it is the one counter that cannot be moved by a
    decision that is not a pitch.
  */
  const played = live?.log.length ?? 0;
  useEffect(() => {
    if (!landing || !battedBall) return undefined;
    setPlaying(true);
    // Roughly the plan's own length: flight, roll, the hold, and the throw.
    const ms = battedBall === 'ground' ? 1500 : 1900;
    const timer = setTimeout(() => setPlaying(false), ms);
    return () => clearTimeout(timer);
  }, [played]);

  /*
    The broadcast — stage 14, rebuilt after the phone heard it.

    The log is still the one honest account, but the first pass read only the
    LAST line of it — and the engine appends several lines per play (the
    forced-at note, the scoring note, the batter's line), so whole classes of
    contact never made a sound: fielder's choices, errors, bunts, "is
    retired". Reported as "when we hit, even if it's an out, the bat should
    play — and sometimes it doesn't."

    So the classifier now reads every line the play appended, finds the
    batter's own line (the un-indented one), and matches against the complete
    OUT_TEXT/hit vocabulary in engine/game.ts. Contact ALWAYS cracks. The
    catch lands when the ball does — the same flight times the animation runs
    on — instead of a flat 700ms. And the umpire (freesound 625473, CC0)
    works the game: strike three called, safe on the steal, out on the caught
    stealing. His pitch varies a few percent so forty strikeouts are not one
    recording.
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
    // A sim jump (bench coach finishing, watch fast-forward catching up)
    // appends a whole game at once; scoring that as one play is noise.
    if (fresh.length === 0 || fresh.length > 8) return;

    /*
      Reported: "the ball is catched and the bat sound comes up instead of
      the catching." Two causes. The catch was on guessed timers that had
      nothing to do with the flight the screen draws — it lands with the
      animation now, a beat before the outcome flash (ground plays resolve at
      ~1500ms, air at ~1900ms; see the play-length effect above, which uses
      the same numbers). And a play's scheduled sounds used to outlive it: a
      fly ball's glove could fire during the NEXT at-bat's swing. Every
      scheduled sound is cancelled the moment a new play starts.
    */
    clearPending();
    const text = fresh.join('\n');
    const vary = (): number => 0.94 + ((played * 37) % 13) / 100;
    const crack = (gain: number): void =>
      sfx(played % 2 ? 'crack' : 'crack2', { rate: vary(), gain });
    const catchAt = (ms: number, gain = 0.55): void => {
      pendingSfx.current.push(window.setTimeout(() => sfx('glove2', { gain }), ms));
    };

    // The night's biggest beat outranks everything else in it.
    if (/win it\./.test(text)) {
      if (/singles|doubles|triples|HOMERS|beats out|error|sacrifice/.test(text)) crack(1);
      sfx('clap', { gain: 0.9 });
      crowdSwell(1);
      buzz([40, 60, 120]);
      return;
    }

    // Baserunning events arrive as their own beats, indented. No voice
    // lines here any more — the mislabeled cuts were saying the wrong words.
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

    // The batter's own line: the one that is not an indented note or a frame.
    const main = [...fresh].reverse().find((l) => !/^[\s\n]|^---/.test(l)) ?? '';

    if (/HOMERS/.test(main)) {
      crack(1);
      crowdSwell(0.8);
      buzz([25, 40, 60]);
    } else if (/triples|doubles/.test(main)) {
      crack(0.95);
      crowdSwell(0.45);
      buzz(20);
    } else if (/singles|beats out/.test(main)) {
      crack(0.9);
      crowdSwell(0.25);
      buzz(15);
    } else if (/strikes out/.test(main)) {
      // The mitt, per the report: "we should at least listen to the mitt."
      sfx('glove', { rate: vary(), gain: 0.95 });
      crowdSwell(0.2);
      buzz(12);
    } else if (/reaches on/.test(main)) {
      // Errors and the fielder's choice: the ball was struck either way.
      crack(0.85);
      crowdSwell(0.2);
      buzz(12);
    } else if (/double play/.test(main)) {
      crack(0.75);
      catchAt(600);
      catchAt(1350, 0.5);
      buzz(10);
    } else if (/grounds|bunts/.test(main)) {
      crack(0.7);
      catchAt(600);
      // The throw beats him to first as the play resolves.
      catchAt(1350, 0.45);
      buzz(10);
    } else if (/flies out|lines out|pops out|sacrifice fly|is retired/.test(main)) {
      crack(0.75);
      catchAt(1750);
      buzz(10);
    } else if (/lays down a sacrifice/.test(main)) {
      crack(0.6);
      catchAt(600);
      buzz(8);
    } else if (/walks|walked on purpose/.test(main)) {
      // The ball-four call was here and was confirmed once — then cut on
      // September 2: "delete the audio when the player is walked." A walk
      // keeps the ambient swell and the haptic; the voice clip goes.
      crowdSwell(0.22);
      buzz(8);
    } else if (/hit by the pitch/.test(main)) {
      sfx('glove', { rate: 0.8, gain: 0.6 });
      crowdSwell(0.25);
      buzz(20);
    }
  }, [played]);

  /*
    The bed under it all: first pitch starts the crowd, the final out sends it
    home, and how loud it idles follows the leverage — late and close is a
    different building from a Tuesday blowout.
  */
  const liveOn = !!live && !live.over;
  useEffect(() => {
    if (!liveOn) { crowdStop(); return undefined; }
    sfx('playball', { gain: 0.7 });
    crowdStart();
    return () => crowdStop();
  }, [liveOn]);
  const levInning = live?.pending?.inning ?? 0;
  const levMargin = Math.abs((live?.pending?.homeRuns ?? 0) - (live?.pending?.awayRuns ?? 0));
  useEffect(() => {
    if (!liveOn) return;
    crowdLeverage(levInning >= 8 && levMargin <= 2 ? 1 : levInning >= 7 ? 0.5 : 0.15);
  }, [liveOn, levInning, levMargin]);

  /*
    What counts as a moment worth handing back for.

    Deliberately conservative -- a handover that fires every half inning is a
    handover nobody uses. Three things, and each is a real decision rather than
    a change of scenery: a man in scoring position, a close game gone late, or
    an arm past the budget the bar has been drawing all night.
  */
  const worthManaging = (): boolean => {
    const p = live?.pending;
    if (!p) return false;
    // Second or third. `bases` is three booleans, not three nullable slots --
    // written as a null check first, which is always true of a boolean, so
    // every empty diamond counted as scoring position and the handover fired
    // on the first pitch.
    const inScoring = p.bases[1] || p.bases[2];
    const margin = Math.abs((p.homeRuns ?? 0) - (p.awayRuns ?? 0));
    const lateAndClose = p.inning >= 7 && margin <= 2;
    const armGone = !!p.outing && p.outing.pitches > p.outing.budget;
    return inScoring || lateAndClose || armGone;
  };

  /*
    The bench coach, calling.

    One call per tick, never two: the guard is `playing`, the same flag that
    greys the buttons while a ball is in the air, so the coach waits out an
    animation exactly like a person would. WATCH keeps a beat between calls so
    there is something to watch; AUTO does not, because nobody
    wants to sit through the eleven plate appearances before the one they asked
    for.
  */
  useEffect(() => {
    if (auto === null || !live || live.over || playing) return undefined;
    // Watching stops when there is something to manage. That was a second
    // button for a while and did not need to be: somebody who asked to watch
    // still wants the dugout back when it matters.
    const beat = 900;
    const t = setTimeout(() => {
      const cur = useDynasty.getState().live;
      if (!cur || cur.over) { setAuto(null); return; }
      const pick = cur.pending?.options.find((o) => o.available);
      if (pick) submitTactic(pick.tactic);
      else setAuto(null);
    }, beat);
    return () => clearTimeout(t);
  }, [auto, playing, version, live?.over]);

  // A finished game hands the dugout back on its own.
  useEffect(() => { if (live?.over) setAuto(null); }, [live?.over]);

  // Who crossed the plate on the last play. The engine reports it as an advance
  // to base 4, which is the only record of a man scoring — he is off the bases
  // by the time the screen sees the new state. All advance events, not just the
  // first: a steal now emits one of its own, and a run scored on the plate
  // appearance after it must still flash.
  // Stage 22: tonight's defensive positioning — the fielding side's book,
  // playbook-aware, so the men on the field stand where the engine says.
  const positioning = useMemo(() => {
    if (!season || !meta) return undefined;
    const half = live?.pending?.half;
    const fi = half === 'top' ? meta.home : meta.away;
    const oi = half === 'top' ? meta.away : meta.home;
    const f = season.teams[fi];
    const o = season.teams[oi];
    if (!f || !o) return undefined;
    const st = appliedStrategy(season, f, o);
    return { infield: st.infield, outfield: st.outfield, shift: st.shift };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, meta, live?.pending?.half, version]);

  const scoredRunners = useMemo(() => {
    const crossed = (live?.lastPlay ?? [])
      .filter((e) => e.kind === 'advance')
      .flatMap((e) => e.runners ?? [])
      .filter((r) => r.to === 4)
      .map((r) => ({ id: r.id, from: r.from }));
    // One crossing per man per play, however many advance groups mention it —
    // a resumed journal can replay the same crossing into lastPlay twice, and
    // downstream these become React keys.
    const seen = new Set<string>();
    return crossed.filter((r) => {
      if (seen.has(String(r.id))) return false;
      seen.add(String(r.id));
      return true;
    });
  }, [live, version]);

  // A run crossing is the one moment worth announcing, so the plate flashes.
  const totalRuns = (live?.pending?.awayRuns ?? 0) + (live?.pending?.homeRuns ?? 0);
  useEffect(() => {
    if (totalRuns !== lastRuns.current) {
      lastRuns.current = totalRuns;
      setScoreTick((n) => n + 1);
    }
  }, [totalRuns]);

  if (!live || !meta || !season) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO GAME IN PROGRESS</div>
        <div style={{
          marginTop: 8, marginBottom: 14, font: "400 calc(12px * var(--ts))/1.6 var(--body)",
          color: 'var(--dim)', maxWidth: 250, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Every call of the next game, yours.
        </div>
        <button
          onClick={() => void startManagedGame()}
          style={{
            padding: '11px 18px', background: 'var(--clay)',
            border: '1px solid var(--clay)', color: 'var(--cream)',
            font: "600 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.14em',
          }}
        >MANAGE NEXT GAME</button>
      </div>
    );
  }

  const home = season.teams[meta.home];
  const away = season.teams[meta.away];
  const d = live.pending;
  const r = live.result;

  /*
    The runners the FIELD draws, held across the gap between decisions.

    Between one batter resolving and the next decision arriving, `d` is
    briefly null — and rendering `d?.runners ?? []` through that gap
    unmounted every runner dot, so the remount placed the men ON their new
    bags with no trip between them. Reported: "sometimes the walks simply
    load the bases without showing the walking animation." A real
    bases-empty state still clears, because it arrives WITH a decision.
  */
  const runnersHeld = useRef<NonNullable<typeof d>['runners']>([]);
  if (d) runnersHeld.current = d.runners;

  // The pending decision knows the live state; once the game is over it is null,
  // so fall back to the final line.
  const inning = d ? `${d.half === 'top' ? '▲' : '▼'} ${d.inning}` : 'FINAL';
  const awayRuns = d ? d.awayRuns : r.away.runs;
  const homeRuns = d ? d.homeRuns : r.home.runs;
  const outs = d?.outs ?? 0;

  const recent = live.log.filter((l) => !l.startsWith('\n')).slice(-30);

  // The linescore. Completed halves live in TeamState.lineScore; the half being
  // played is the difference between the scoreboard and what has been written
  // down. The two lines legitimately differ in length — a bottom ninth the home
  // team never needed is an 'X', exactly as a newspaper would set it.
  const battingHalf = d?.half ?? null;
  const awayLs = r.away.lineScore;
  const homeLs = r.home.lineScore;
  const innCols = Math.max(
    9,
    awayLs.length + (battingHalf === 'top' ? 1 : 0),
    homeLs.length + (battingHalf === 'bottom' ? 1 : 0),
  );
  const cellsFor = (side: 'away' | 'home'): Array<string | number> => {
    const ls = side === 'away' ? awayLs : homeLs;
    const runs = side === 'away' ? r.away.runs : r.home.runs;
    const batting = side === 'away' ? battingHalf === 'top' : battingHalf === 'bottom';
    const played = ls.reduce((a, b) => a + b, 0);
    return Array.from({ length: innCols }, (_, i) => {
      if (i < ls.length) return ls[i] ?? 0;
      if (batting && i === ls.length) return runs - played;
      if (live.over && side === 'home' && i === ls.length && awayLs.length > homeLs.length) return 'X';
      return '';
    });
  };

  // The word nobody says. From the sixth on, a side without a hit turns the
  // scoreboard's edge gold; the flag never names it, per the dugout's law.
  const nono = !!d && d.inning >= 6 && (r.home.hits === 0 || r.away.hits === 0);
  // Late and close: the same read the crowd bed runs on, drawn for the eyes.
  const late = !!d && d.inning >= 8 && Math.abs(d.homeRuns - d.awayRuns) <= 2;

  return (
    <div className="live-game">
      <FirstVisit id="manage" />

      {/*
        No header bar.

        Reported with the screen marked up: the bar across the top, the way back
        to the desk and the box toggle all crossed out, with "you can barely see
        the park, you can remove the upper bar". It was ninety pixels spent on a
        score the linescore already prints and two controls that both have homes
        elsewhere — the desk is a manager tool, and the box is the strip
        underneath, which is always open now.

        What the bar carried that nothing else did is the inning and the count
        of outs, and those ride on the linescore instead.
      */}
      {/*
        The linescore. The proposal folds it away, having no extra innings to
        worry about; it was reported here that it should sit on the bar with
        R/H/E rather than drop on demand, because it is the one thing on this
        screen that answers "where are we" without being asked.

        So it is open by default and the BOX button closes it. The innings
        scroll inside their own container while the abbreviations and the totals
        hold still, which is what makes a fourteen-inning game fit a phone.
      */}
      <div className={`live-linescore${nono ? ' nono' : late ? ' leverage' : ''}`}>
        <div className="live-state">
          <span>{inning}</span>
          {d && <span>{outs} OUT</span>}
          {nono && <span className="nono-flag">DON'T SAY IT</span>}
        </div>
        <LineScore
            tone="navy"
            innings={innCols}
            rows={[
              {
                abbr: away?.def.abbr ?? 'AWY', cells: cellsFor('away'),
                r: awayRuns, h: r.away.hits, e: r.away.errors,
                batting: d?.half === 'top',
              },
              {
                abbr: home?.def.abbr ?? 'HOM', cells: cellsFor('home'),
                r: homeRuns, h: r.home.hits, e: r.home.errors,
                batting: d?.half === 'bottom',
              },
          ]}
        />
      </div>

      <main className="ballpark-game">
        {/*
          The field, with the situation written across the bottom of it. The
          diamond says *where* the runners are; the banner says what that
          means — "runners on first and second" is the sentence a manager says
          to himself, and it sits on the field because it belongs to the
          picture.

          The proposal draws a flat canvas ballpark. This one keeps its three
          dimensional diamond, which was the call made before the port started;
          the 2D one is still here as the fallback for a device without WebGL,
          and settings lets somebody choose it. Picking it also means three.js
          is never fetched at all, which is 600KB a slower phone does not have
          to spend on a renderer its owner did not want.
        */}
        <div className="ballpark-scene">
          {splash && (
            <div className="hr-splash" key={splash.tick} aria-hidden>
              {splash.text}
            </div>
          )}
          {(
            <Suspense fallback={
              <div className="park-loading" style={{ height: 250 }} aria-hidden>
                <span>THE PARK</span>
                <div><i /><i /><i /></div>
              </div>
            }>
              <Diamond3D
                runners={d?.runners ?? runnersHeld.current} scoreTick={scoreTick}
                ball={ball} scored={{ runners: scoredRunners, tick: scoreTick }} height={250}
                // Midweek plays in the afternoon; the weekend series and all
                // of June under the lights. Derived from the fixture, never asked.
                night={!!meta && (meta.postseason === true
                  || season?.schedule[season.dayIndex]?.kind !== 'midweek')}
                accent={meta ? teamColour(season?.teams[meta.home]?.def.abbr ?? '') : undefined}
                // The men wear their own shirts — asked for from the dugout:
                // fielders in the defending school's colour, runners in the
                // batting side's. Top of the inning the away side bats.
                defenceColour={meta
                  ? teamColour(season?.teams[
                    shownHalf === 'top' ? meta.home : meta.away
                  ]?.def.abbr ?? '')
                  : undefined}
                offenceColour={meta
                  ? teamColour(season?.teams[
                    shownHalf === 'top' ? meta.away : meta.home
                  ]?.def.abbr ?? '')
                  : undefined}
                positioning={positioning}
              />
            </Suspense>
          )}
          {d && (
            <div className="ballpark-situation">
              <span>{baseState(d.bases, d.outs)}</span>
              <b>{d.outs} OUT</b>
            </div>
          )}
        </div>

        {d && (
          <section className="ballpark-matchup">
            <article>
              <small>{d.side === 'offense' ? 'AT BAT · YOURS' : 'AT BAT · THEIRS'}</small>
              <strong>{d.batter.name}</strong>
              <span>{d.batter.pos} · {d.batter.bats} vs {d.pitcher.throws}HP</span>
              <div>
                {batterLine(season, d.batter.id).map((s) => (
                  <b key={s.k}>{s.k} {s.v}</b>
                ))}
              </div>
            </article>
            <article>
              <small>{d.side === 'defense' ? 'PITCHING · YOURS' : 'PITCHING · THEIRS'}</small>
              <strong>{d.pitcher.name}</strong>
              <span>
                {d.pitcher.throws}HP · {d.outing.relief ? 'relief' : 'starter'}
                {' · '}{d.outing.pitches} pitches
              </span>
              <div>
                <b>IP {inningsFrom(d.outing.outs)}</b>
                <b>K {d.outing.strikeouts}</b>
                <b>CONF {Math.round(d.outing.confidence * 100)}%</b>
              </div>
              {/*
                What he has left, not what he has spent. Fatigue is real and
                always has been: past his budget an arm loses effectiveness on a
                slope down to a floor of 0.55. The bar is that budget drawn as
                *remaining*, because a bar that fills as a man tires reads as
                something being earned. It goes red past the budget, which is the
                moment the dugout is supposed to notice.
              */}
              <i>
                <em style={{
                  width: `${Math.round(Math.max(0, 1 - d.outing.pitches / Math.max(1, d.outing.budget)) * 100)}%`,
                  background: d.outing.pitches > d.outing.budget ? 'var(--alert)' : 'var(--yellow)',
                }} />
              </i>
            </article>
          </section>
        )}

        <section className="ballpark-log" ref={logRef}>
          <div>
            <small>PLAY-BY-PLAY</small>
            <b>{d ? 'LIVE' : 'FINAL'}</b>
          </div>
          {recent.map((line, i) => {
            // The calls, and the two ways a call goes wrong. A runner thrown
            // out is the most consequential thing on this screen and it was
            // reading as dim grey filler, which is a large part of why a manager
            // can call for a steal all afternoon and never notice the failures.
            const called = line.startsWith('[bunt]') || line.startsWith('[intentional]')
              || /caught stealing|thrown out|forced at|error/.test(line);
            return (
              <p
                className={`${i === recent.length - 1 ? 'latest' : ''}${called ? ' called' : ''}`}
                key={i}
              >{line.replace(/^\[[a-z]+\]\s*/, '').trim()}</p>
            );
          })}
        </section>

        {d ? (
          <section className="ballpark-call">
            {/*
              One line, not four.

              Reported: "instead of all that text in the stripe in the field,
              simply have your call and that's it. That way everything can fit."
              Which is right — the situation was already written across the
              corner of the field, the batter's name was already the biggest
              thing on the matchup card, and repeating both above the buttons
              cost the buttons the room to be on screen.
            */}
            <div><small>YOUR CALL</small></div>
            <div>
              {d.options.map((o) => {
                // Off while the play is on the field, and off because the
                // situation forbids it, are two different greys: one comes back
                // in a second, the other is telling you why it cannot be done.
                const ready = o.available && !playing && auto === null;
                return (
                  <button
                    className={o.available ? '' : 'unavailable'}
                    key={o.tactic}
                    type="button"
                    disabled={!ready}
                    title={o.note}
                    onClick={once(() => ready && submitTactic(o.tactic))}
                  >{o.label}</button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="ballpark-call">
            <div>
              <small>FINAL</small>
              <strong>{awayRuns > homeRuns ? away?.def.school : home?.def.school}</strong>
              <span>That is the ballgame.</span>
            </div>
            <div>
              <button className="selected" type="button" onClick={() => void endManagedGame()}>
                Record the game
              </button>
            </div>
          </section>
        )}

        {/*
          No pace row.

          Reported: "you can also remove the manager tools and next pitch
          buttons, these are already in the action button or the controls." They
          were — the tools are the round button, and the next pitch is whichever
          call you tap. Two buttons that only duplicated things one thumb-width
          away, holding the bottom of a screen that had none to spare.
        */}
      </main>

      {/*
        The dugout's own tools, behind the proposal's round button: the bench,
        the pen, and the mound. They were four stacked buttons in a 146 pixel
        column down the right of the screen — a column the field and the log
        both wanted back.
      */}
      {d && tools && (
        <button
          className="popover-scrim"
          type="button"
          aria-label="Close manager tools"
          onClick={closeTools}
        />
      )}
      {d && (
        <aside className={`game-manager-fab${tools ? ' open' : ''}${toolsPhase === 'closing' ? ' closing' : ''}`}>
          <section className="game-manager-popover">
            <div className="game-tool-context">
              <small>DUGOUT · {inning}</small>
              <strong>{d?.side === 'offense' ? 'Create the next edge' : 'Protect this inning'}</strong>
              {d && (
                <div className="game-tool-live-grid">
                  <article><small>SCORE</small><b>{away?.def.abbr} {awayRuns} · {home?.def.abbr} {homeRuns}</b></article>
                  <article><small>OUTS</small><b>{d.outs}</b></article>
                  <article><small>SITUATION</small><b>{baseState(d.bases, d.outs)}</b></article>
                </div>
              )}
            </div>
            <div className="game-tool-options">
              {/*
                The bench coach's two doors live here now as well.

                Reported: "in the action button I would add all managerial
                actions like mound visit, bullpen, pinch hit, etc, in the main
                screen I would just keep the match buttons." Watching and simming
                are decisions about who is managing the game, which is the same
                kind of decision as who is pitching it — and the row under the
                calls was the last thing pushing them off a short screen.
              */}
              {/*
                Two groups, because the reporter's sentence had two halves:
                "we have to organise the buttons inside the action button,
                also remove the short explanation on those buttons — they
                are not really needed since the titles are self
                explanatory." Managing the game and handing it over are
                different kinds of decision and were interleaved in one flat
                list. Every sub-line is gone; the two counts that were facts
                rather than restatements ride in their own titles.
              */}
              {(d.side === 'offense' || (d.side === 'defense' && (myPen || myVisits))
                || lastHit.current) && (
                <small className="game-tool-group">THIS INNING</small>
              )}
              {d.side === 'offense' && (
                <button
                  type="button"
                  disabled={playing || live.benchAvailable.length === 0}
                  onClick={() => { setModal('pinch'); setTools(false); }}
                >
                  <strong>
                    Pinch hit for {d.batter.name}
                    {live.benchAvailable.length > 0 ? ` · ${live.benchAvailable.length}` : ''}
                  </strong>
                  <ChevronRightIcon />
                </button>
              )}
              {d.side === 'defense' && myPen && (
                <button
                  type="button"
                  disabled={playing || live.bullpenAvailable.length === 0}
                  onClick={() => { setModal('pen'); setTools(false); }}
                >
                  <strong>
                    Go to the bullpen
                    {live.bullpenAvailable.length > 0 ? ` · ${live.bullpenAvailable.length}` : ''}
                  </strong>
                  <ChevronRightIcon />
                </button>
              )}
              {d.side === 'defense' && myVisits && (
                <button
                  type="button"
                  disabled={playing || auto !== null || d.outing.visitUsed}
                  onClick={() => { void visitMound(); setTools(false); }}
                >
                  <strong>{d.outing.visitUsed ? 'Visit already used' : 'Visit the mound'}</strong>
                  <ChevronRightIcon />
                </button>
              )}
              {lastHit.current && (
                <button
                  type="button"
                  disabled={playing}
                  onClick={() => { setTools(false); replay(); }}
                >
                  <strong>See that again</strong>
                  <ChevronRightIcon />
                </button>
              )}

              <small className="game-tool-group">THE DUGOUT</small>
              {auto === null ? (
                <button
                  type="button"
                  disabled={playing}
                  onClick={() => { setAuto('watch'); setTools(false); }}
                >
                  <strong>AUTO</strong>
                  <ChevronRightIcon />
                </button>
              ) : (
                <button type="button" onClick={() => { setAuto(null); setTools(false); }}>
                  <strong>Take the dugout back</strong>
                  <ChevronRightIcon />
                </button>
              )}
              <button
                type="button"
                disabled={playing}
                onClick={() => { setTools(false); once(autoFinish)(); }}
              >
                <strong>Sim the rest</strong>
                <ChevronRightIcon />
              </button>
              {/*
                The way out without ending anything, and it writes on the way.
                What it can honestly save is the dynasty — a half-played game
                is a running coroutine with nothing serialisable to write — so
                the game keeps in memory and PLAY BALL resumes it. June does
                not get this door: its frame is the bracket, and mid-bracket
                saving is restricted to stage boundaries on purpose.
              */}
              {bracket === null && (
                <button type="button" onClick={() => { void saveNow(); go('home'); }}>
                  <strong>Back to the desk</strong>
                  <ChevronRightIcon />
                </button>
              )}
            </div>
          </section>
          <button
            className="game-manager-trigger"
            type="button"
            aria-label={tools ? 'Close manager tools' : 'Open manager tools'}
            aria-expanded={tools}
            onClick={() => setTools(!tools)}
          >{tools ? <Cross1Icon /> : <DotsHorizontalIcon />}<span>{tools ? 'Close' : 'Dugout'}</span></button>
        </aside>
      )}

      {modal && (
        <Picker
          title={modal === 'pinch' ? 'PINCH HITTER' : 'TO THE BULLPEN'}
          // With the overall on it.
          //
          // Picking a reliever off a list of names is picking at random, which
          // is not a decision — the whole point of a bullpen is that some of
          // them are better than others and you choose when to spend them.
          rows={modal === 'pinch'
            ? live.benchAvailable.map((h: Hitter) => ({
                id: h.id, name: h.name, note: h.pos, rating: overallOf(h),
              }))
            : live.bullpenAvailable.map((p) => ({
                id: p.id, name: p.name, note: `${p.throws}HP`, rating: overallOf(p),
              }))}
          onPick={(id) => {
            if (modal === 'pinch') {
              const h = live.benchAvailable.find((x) => x.id === id);
              if (h) pinchHitFor(h);
            } else {
              const p = live.bullpenAvailable.find((x) => x.id === id);
              if (p) bringIn(p);
            }
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/**
 * One team's half of the score line.
 *
 * The batting side is marked rather than merely brighter: a dot beside the
 * abbreviation says whose half it is without a second row of text, and it is
 * the one thing on this bar that changes every half inning.
 */
/**
 * The situation, in the words a manager would use.
 *
 * The diamond already says which bags are occupied; this says what that adds up
 * to. Deliberately a sentence rather than a code — "runners on first and
 * second, two away" is read at a glance, and "1-2, 2 out" has to be decoded.
 */
function baseState(bases: [boolean, boolean, boolean], outs: number): string {
  const [first, second, third] = bases;
  const on = [first && 'first', second && 'second', third && 'third']
    .filter((x): x is string => typeof x === 'string');
  const away = outs === 0 ? 'nobody out' : outs === 1 ? 'one away' : 'two away';

  if (on.length === 3) return `bases loaded, ${away}`;
  if (on.length === 0) return `bases empty, ${away}`;
  if (on.length === 1) return `runner on ${on[0]}, ${away}`;
  return `runners on ${on[0]} and ${on[1]}, ${away}`;
}

/** Outs into the innings figure a box score prints: 5 outs is 1.2. */
const inningsFrom = (outs: number): string =>
  `${Math.floor(outs / 3)}.${outs % 3}`;

/**
 * The batter's season line, for his card.
 *
 * Three numbers, chosen because they are the three anybody asks about a hitter
 * before a plate appearance. A man with no at bats yet gets dashes rather than
 * a .000 that reads as a slump.
 */
function batterLine(
  season: ReturnType<typeof useDynasty.getState>['season'],
  id: PlayerId,
): { k: string; v: string }[] {
  const line = season?.batting.get(id);
  if (!line || line.ab === 0) {
    return [{ k: 'AVG', v: '—' }, { k: 'HR', v: '—' }, { k: 'RBI', v: '—' }];
  }
  return [
    { k: 'AVG', v: pct(battingAverage(line)) },
    { k: 'HR', v: String(line.hr) },
    { k: 'RBI', v: String(line.rbi) },
  ];
}

/**
 * One of the two men in the matchup.
 *
 * Both cards are the same component so they cannot drift into two designs, and
 * the side that belongs to you is marked rather than merely brighter — you are
 * always one of these two, and which one changes every half inning.
 *
 * `gauges` is a list because there are two, and they are the pair that
 * describes an outing: ARM is a budget that only ever spends, and HEAD is a
 * state that moves both ways. Keeping them separate is the whole design -- a
 * settled man who is out of pitches is still out of pitches, and a mound visit
 * can only ever move the second one.
 */
// ManCard, Side and Small went with the layout they belonged to: two paper
// cards and a column of stacked buttons down the right of the screen. The
// proposal draws the matchup as two dark articles and puts the dugout tools
// behind a round button, and both of those are markup rather than components.

function Picker(
  { title, rows, onPick, onClose }:
  {
    title: string;
    rows: Array<{ id: string; name: string; note: string; rating: number }>;
    onPick: (id: string) => void;
    onClose: () => void;
  },
) {
  return (
    <InFrame>
      <div onClick={onClose} className="sheet-scrim game-picker-layer">
        <section
          onClick={(e) => e.stopPropagation()}
          className="game-picker-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <header>
            <span><small>DUGOUT DECISION</small><strong>{title}</strong></span>
            <button className="tap" type="button" onClick={onClose}>CLOSE</button>
          </header>
          <div className="game-picker-list">
            {rows.length === 0 && (
              <div className="game-picker-empty">
                <small>NO OPTION</small>
                <strong>Nobody available</strong>
              </div>
            )}
            {rows.map((r) => (
              <button className="game-picker-row tap" key={r.id} type="button" onClick={() => onPick(r.id)}>
                <span><strong>{r.name}</strong><small>{r.note}</small></span>
                <b>{r.rating}</b>
              </button>
            ))}
          </div>
        </section>
      </div>
    </InFrame>
  );
}
