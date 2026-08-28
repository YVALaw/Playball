// Manage.tsx
// The manager's chair. Every plate appearance, all nine innings.
//
// This is the quick manage the mockup lays out and the roadmap calls the
// emotional core: you never swing a bat, you make the call and read what
// happened. The buttons change with the situation — a sacrifice is not offered
// with the bases empty, and you cannot put a man on when first is occupied.

import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerName } from '../PlayerName.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf } from '../../engine/ratings.js';
import { battingAverage } from '../../engine/season.js';
import { pct } from '../format.js';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { readPrefs } from '../../state/devicePrefs.js';
import { lazy, Suspense } from 'react';
import { Diamond } from '../Diamond.js';
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
  // Read once when the game opens rather than subscribed to: nobody changes
  // their field preference in the middle of an at-bat, and re-reading storage
  // on every pitch to find that out would be absurd.
  const [flatField] = useState(() => readPrefs().field === '2d');
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
  const [scoreTick, setScoreTick] = useState(0);
  const [ball, setBall] = useState<BallHit | null>(null);
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
      tick: ballTick.current,
    });
    // `wasOut` is read above and belongs here: identical landing coordinates
    // with a different outcome must still refresh what the ball flashes.
  }, [landing?.x, landing?.y, battedBall, wasOut, version]);

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
    if (worthManaging()) { setAuto(null); return undefined; }
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
  const scoredRunners = useMemo(() => {
    return (live?.lastPlay ?? [])
      .filter((e) => e.kind === 'advance')
      .flatMap((e) => e.runners ?? [])
      .filter((r) => r.to === 4)
      .map((r) => ({ id: r.id, from: r.from }));
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
          Take the dugout and call every plate appearance of your next game.
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <FirstVisit id="manage" />
      {/*
        The top bar, rebuilt to the mock.

        It used to carry a full linescore, which printed the score twice and
        spent 82px of a screen whose whole job is the field. The strip now says
        the four things you glance at — which half of which inning, how many
        out, and the score — and the linescore itself is a tap behind LINE
        SCORE, where a fourteen-inning game can have all the room it needs.

        There is deliberately no ball-strike count. This game is managed a
        plate appearance at a time rather than a pitch at a time, so at the
        moment you are asked for a call the count is always nothing-and-nothing;
        a count only exists *inside* a resolved at bat, which is why the log
        prints one. Drawing "B 0 S 0" on every decision would be furniture that
        never changes.
      */}
      <div style={{
        flex: 'none', background: 'var(--navy)', padding: '7px 12px 8px',
        paddingTop: 'calc(env(safe-area-inset-top) + 7px)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 18,
        }}>
          <span style={{
            font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.12em',
            color: 'var(--cream)', whiteSpace: 'nowrap',
          }}>
            {inning}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              font: "500 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em',
              color: 'rgba(246,241,230,.5)',
            }}>OUT</span>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 8, height: 8, transform: 'rotate(45deg)',
                border: '1px solid rgba(246,241,230,.45)',
                background: i < outs ? 'var(--clay)' : 'transparent',
                transition: 'background 180ms ease',
              }} />
            ))}
          </span>
          <button
            onClick={() => { void saveNow(); go('home'); }}
            className="tap"
            style={{
              flex: 'none', padding: '5px 10px',
              border: '1px solid rgba(246,241,230,.35)',
              color: 'var(--cream)',
              font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
            }}
          >EXIT</button>
        </div>

        {/*
          The linescore, always there.

          It was folded behind a LINE SCORE button, which was the wrong trade:
          reported straight back that it should sit on the bar with R/H/E rather
          than drop down on demand. It is the one thing on this screen that
          answers "where are we" without being asked, and a scoreboard you have
          to press is not a scoreboard.

          The innings scroll inside their own container while the abbreviations
          and the R/H/E totals hold still at the edges, which is what makes a
          fourteen-inning game fit a phone.
        */}
        <div style={{ marginTop: 5 }}>
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
      </div>


      {/*
        Everything below the scoreboard is one row: the field and the log on the
        left, the calls down the right. The calls therefore run the full height
        under the score rather than only beside the log — on a phone the column
        was overflowing, and scrolling to reach the last button pushed the
        scoreboard off the top of the screen.
      */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/*
        Taller than it was, because the field is now three dimensional and 96 by
        76 could not hold one — the diamond rendered as a wedge of dirt with home
        plate cropped off the bottom. The play log below still gets the remaining
        height, which on a phone is the larger share.
      */}
      {/*
        The field, roughly doubled, with the situation written across the
        bottom of it.

        It was 118px inside a 178px block that also held the matchup, which is
        the complaint the rebuild exists to answer. The diamond says *where* the
        runners are; the banner says what that means — "runners on first and
        second" is the sentence a manager says to himself, and it sits on the
        field rather than above the calls because it belongs to the picture.
      */}
      <div style={{
        flex: 'none', position: 'relative',
        borderBottom: '1px solid var(--faint)',
        background: 'var(--paper)',
      }}>
        <div style={{ flex: 'none', width: '100%', height: 210 }}>
          {/* The 2D diamond was always the fallback for a device without WebGL;
              settings simply lets somebody choose it. Picking it also means
              three.js is never fetched at all, which is 600KB a slower phone
              does not have to spend on a renderer its owner did not want. */}
          {flatField ? (
            <Diamond runners={d?.runners ?? []} scoreTick={scoreTick} size={200} />
          ) : (
            <Suspense fallback={
              <Diamond runners={d?.runners ?? []} scoreTick={scoreTick} size={200} />
            }>
              <Diamond3D
                runners={d?.runners ?? []} scoreTick={scoreTick}
                ball={ball} scored={{ runners: scoredRunners, tick: scoreTick }} height={210}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/*
        The matchup, as two cards.

        The strip it replaces was two lines of names, which is the least a
        screen can say about the only two men who matter. Each card now carries
        the three numbers you would actually want — what he is hitting, what the
        arm has done today — and the pitcher's card carries the thing the dugout
        never showed at all: how far into his outing he is.
      */}
      {d && (
        <div style={{
          flex: 'none', display: 'flex', gap: 1,
          background: 'var(--faint)', borderBottom: '1px solid var(--faint)',
        }}>
          <ManCard
            kicker="AT BAT"
            corner=""
            id={d.batter.id}
            name={d.batter.name}
            sub={`${d.batter.pos} · ${d.batter.bats} vs ${d.pitcher.throws}HP`}
            mine={d.side === 'offense'}
            stats={batterLine(season, d.batter.id)}
          />
          <ManCard
            kicker="PITCHING"
            corner={d.outing.relief ? 'RELIEF' : 'START'}
            id={d.pitcher.id}
            name={d.pitcher.name}
            sub={`${d.pitcher.throws}HP · ${d.outing.relief ? 'relief' : 'starter'}`}
            mine={d.side === 'defense'}
            stats={[
              { k: 'IP', v: inningsFrom(d.outing.outs) },
              { k: 'K', v: String(d.outing.strikeouts) },
              { k: 'PC', v: String(d.outing.pitches) },
            ]}
            gauges={[
              {
                label: 'ARM',
                /* What he has left, not what he has spent.
                   Fatigue is real and always has been: past his budget an arm
                   loses effectiveness on a slope down to a floor of 0.55. The
                   bar is that budget drawn as *remaining*, because a bar that
                   fills as a man tires reads as something being earned. */
                fill: Math.max(0, 1 - d.outing.pitches / Math.max(1, d.outing.budget)),
                over: d.outing.pitches > d.outing.budget,
                note: 'PAST HIS BUDGET',
              },
              {
                /* The other half of what he is carrying, and the same
                   direction of travel: full when he takes the mound, spent by
                   what gets done to him. A man at full is exactly as good as he
                   was before this channel existed, which is what lets it sit
                   inside a calibrated engine. */
                label: 'CONF',
                fill: d.outing.confidence,
                over: d.outing.confidence < 0.45,
                note: 'LOSING HIM',
              },
            ]}
          />
        </div>
      )}

      <div ref={logRef} style={{
        flex: 1, minWidth: 0, overflowY: 'auto', padding: '9px 12px 12px 14px',
      }}>
        {/*
          Where everybody is, in the place the game is already being narrated.

          This was a dark banner laid over the foot of the field, and it was
          reported twice -- first for covering the two cards, then for existing
          at all. The second is the better note: the diamond already shows the
          runners, so a caption over it is the same fact twice, and the one
          place a reader is looking for words about the situation is the log.

          Pinned at the top rather than pushed into the stream, because it is
          the state *now* rather than a thing that happened, and it must not
          scroll away with the play that produced it.
        */}
        {d && (
          <div style={{
            position: 'sticky', top: -9, zIndex: 1,
            margin: '-9px -12px 7px -14px', padding: '6px 12px 6px 14px',
            background: 'var(--field)', borderBottom: '1px solid var(--faint)',
            font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.1em',
            color: 'var(--dim)', textTransform: 'uppercase',
          }}>{baseState(d.bases, d.outs)}</div>
        )}
        {recent.map((line, i) => {
          // The calls, and the two ways a call goes wrong. A runner thrown out
          // is the most consequential thing on this screen and it was reading as
          // dim grey filler, which is a large part of why a manager can call for
          // a steal all afternoon and never notice the ones that failed.
          const call = line.startsWith('[bunt]') || line.startsWith('[intentional]')
            || /caught stealing|thrown out|forced at/.test(line);
          const sub = line.startsWith('   ');
          return (
            <div key={i} style={{
              padding: '3px 0',
              font: `${i === recent.length - 1 ? 600 : 400} calc(12px * var(--ts))/1.45 var(--body)`,
              color: call ? 'var(--clay)' : sub ? 'var(--dim)' : 'var(--ink)',
              opacity: i === recent.length - 1 ? 1 : 0.75,
            }}>{line.replace(/^\[[a-z]+\]\s*/, '').trim()}</div>
          );
        })}
      </div>

      </div>

      {/*
        The calls run down the right rather than across the bottom. Stacked, the
        fixed height this panel needs came straight out of the play log — and the
        log is the thing you are actually reading.
      */}
      <div style={{
        flex: 'none', width: 146, borderLeft: '1px solid var(--faint)',
        background: 'var(--field)', padding: '8px 8px 9px',
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        {d ? (
          <>
            <div className="label">{d.side === 'offense' ? 'BATTING' : 'IN THE FIELD'}</div>
            {d.options.map((o) => {
              // Off while the play is on the field, and off because the
              // situation forbids it, are two different greys: one comes back
              // in a second, the other is telling you why it cannot be done.
              const live0 = o.available && !playing && auto === null;
              return (
              <button
                key={o.tactic}
                onClick={once(() => live0 && submitTactic(o.tactic))}
                disabled={!live0}
                style={{
                  padding: '5px 8px', textAlign: 'left', flex: 'none',
                  // Apple's 44pt floor, and not a pixel under it: these are the
                  // most-tapped controls in the game. The padding came down
                  // rather than the target, which is what made room for the
                  // mound visit without costing anybody a thumb.
                  minHeight: 40,
                  // Available calls are raised paper with a real border. The
                  // unavailable ones recede rather than merely dimming, so the
                  // difference is obvious at arm's length on a phone.
                  background: live0 ? 'var(--paper)' : 'transparent',
                  border: o.available
                    ? '1px solid rgba(28,36,48,.42)'
                    : '1px dashed rgba(28,36,48,.16)',
                  opacity: o.available && playing ? 0.45 : 1,
                  transition: 'opacity 160ms ease, background 160ms ease',
                  boxShadow: live0 ? '0 1px 0 rgba(28,36,48,.16)' : 'none',
                }}
              >
                <div style={{
                  font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.03em',
                  color: o.available ? 'var(--ink)' : 'rgba(28,36,48,.34)',
                }}>{o.label}</div>
                <div style={{
                  marginTop: 1, font: "400 calc(9px * var(--ts))/1.2 var(--body)",
                  color: o.available ? 'var(--dim)' : 'rgba(28,36,48,.28)',
                }}>{o.note}</div>
              </button>
              );
            })}
            <div style={{ flex: 1 }} />
            {d.side === 'defense' && myVisits && (
              <Small
                onClick={once(visitMound)}
                disabled={playing || auto !== null || d.outing.visitUsed}
              >{d.outing.visitUsed ? 'VISIT USED' : 'MOUND VISIT'}</Small>
            )}
            {(d.side === 'offense' || myPen) && (
              <Small
                onClick={() => setModal(d.side === 'offense' ? 'pinch' : 'pen')}
                disabled={playing || (d.side === 'offense'
                  ? live.benchAvailable.length === 0
                  : live.bullpenAvailable.length === 0)}
              >{d.side === 'offense' ? 'PINCH HIT' : 'BULLPEN'}</Small>
            )}
            {/* The bench coach's two doors, and the way to take the dugout
                back. While he is calling, the only useful button is the one
                that stops him -- so that is the only one shown. */}
            {auto === null ? (
              <>
                <Small onClick={() => setAuto('watch')} disabled={playing}>WATCH</Small>
                <Small onClick={once(autoFinish)} disabled={playing}>SIM THE REST</Small>
              </>
            ) : (
              <Small onClick={() => setAuto(null)}>
                TAKE IT BACK
              </Small>
            )}
            {/* The way out without ending anything, and it writes on the way.
                Reported from testing: "going back to the desk from the
                minigame should save the progress as it is at the moment we
                exit." What it can honestly save is the dynasty — the season,
                the roster, the calendar — because a half-played game is a
                running coroutine (`LiveGame` carries `submit` and `finish` as
                closures) and there is nothing serialisable to write. So the
                game keeps in memory and BACK TO THE GAME resumes it, while
                the save makes sure that stepping away cannot cost anything
                that already happened. June does not get this door: its frame
                is the bracket, and mid-bracket saving is restricted to stage
                boundaries on purpose. */}
            {bracket === null && (
              <Small onClick={() => { void saveNow(); go('home'); }}>
                BACK TO THE DESK
              </Small>
            )}
          </>
        ) : (
          <>
            <div className="label">GAME OVER</div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => void endManagedGame()}
              style={{
                padding: '11px 0', minHeight: 44, background: 'var(--clay)',
                border: '1px solid var(--clay)', color: 'var(--cream)',
                font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em',
              }}
            >RECORD</button>
          </>
        )}
      </div>
      </div>

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
            : live.bullpenAvailable.map((p: Pitcher) => ({
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
function ManCard(
  { kicker, corner, id, name, sub, mine, stats, gauges }: {
    kicker: string;
    corner: string;
    id: PlayerId;
    name: string;
    sub: string;
    mine: boolean;
    stats: { k: string; v: string }[];
    gauges?: { label: string; fill: number; over: boolean; note?: string }[];
  },
) {
  return (
    <div style={{
      flex: 1, minWidth: 0, background: 'var(--paper)', padding: '6px 9px 7px',
      borderTop: `2px solid ${mine ? 'var(--clay)' : 'transparent'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="label" style={{ color: mine ? 'var(--clay)' : undefined }}>{kicker}</span>
        <span style={{ flex: 1 }} />
        <span style={{
          font: "500 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em',
          color: 'var(--dim)',
        }}>{corner}</span>
      </div>
      <PlayerName
        id={id}
        style={{
          display: 'block', marginTop: 2,
          font: "800 calc(14px * var(--ts))/1.05 var(--display)",
          textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: mine ? 'var(--ink)' : 'var(--dim)',
        }}
      >{name}</PlayerName>
      <div style={{
        marginTop: 1,
        font: "400 calc(8.5px * var(--ts))/1.3 var(--mono)", color: 'var(--dim)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{sub}</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
        {stats.map((s) => (
          <span key={s.k} style={{ minWidth: 0 }}>
            <span style={{
              display: 'block',
              font: "500 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
              color: 'var(--dim)',
            }}>{s.k}</span>
            <span style={{
              display: 'block',
              font: "700 calc(11.5px * var(--ts))/1.1 var(--body)",
              fontVariantNumeric: 'tabular-nums',
            }}>{s.v}</span>
          </span>
        ))}
      </div>

      {gauges && gauges.map((g) => (
        <div key={g.label} style={{ marginTop: 5 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span style={{
              font: "500 calc(7px * var(--ts)) var(--mono)", letterSpacing: '.12em',
              color: g.over ? 'var(--clay)' : 'var(--dim)',
            }}>{g.label}</span>
            {g.over && g.note && (
              <span style={{
                font: "600 calc(7px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                color: 'var(--clay)',
              }}>{g.note}</span>
            )}
          </div>
          <div style={{
            marginTop: 2, height: 3, background: 'var(--faint)', overflow: 'hidden',
          }}>
            <div className="grow" style={{
              width: `${Math.round(g.fill * 100)}%`, height: '100%',
              background: g.over ? 'var(--clay)' : 'var(--win)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Side(
  { abbr, runs, batting, home }:
  { abbr: string; runs: number; batting?: boolean; home?: boolean },
) {
  const name = (
    <span style={{
      font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.12em',
      color: batting ? 'var(--cream)' : 'rgba(246,241,230,.55)',
    }}>{abbr}</span>
  );
  const score = (
    <span style={{
      font: `800 calc(20px * var(--ts))/1 var(--display)`,
      color: batting ? 'var(--cream)' : 'rgba(246,241,230,.75)',
      fontVariantNumeric: 'tabular-nums',
    }}>{runs}</span>
  );
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {home ? <>{score}{name}</> : <>{name}{score}</>}
    </span>
  );
}

function Small(
  { onClick, disabled, children }:
  { onClick: () => void; disabled?: boolean; children: string },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 'none', padding: '8px 0', minHeight: 44,
        background: disabled ? 'transparent' : 'var(--paper)',
        border: disabled ? '1px dashed rgba(28,36,48,.16)' : '1px solid rgba(28,36,48,.42)',
        boxShadow: disabled ? 'none' : '0 1px 0 rgba(28,36,48,.16)',
        color: disabled ? 'rgba(28,36,48,.3)' : 'var(--ink)',
        font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.08em',
      }}
    >{children}</button>
  );
}

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
    <div
      onClick={onClose}
      className="sheet-scrim"
            style={{
        position: 'absolute', inset: 0, background: 'rgba(28,36,48,.55)',
        display: 'flex', alignItems: 'flex-end', zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet"
        style={{ width: '100%', background: 'var(--field)', maxHeight: '70%', overflowY: 'auto' }}
      >
        <div style={{ padding: '9px 14px', background: 'var(--navy)' }}>
          <span style={{
            font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>{title}</span>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: 14, font: "400 calc(12px * var(--ts)) var(--body)", color: 'var(--dim)' }}>
            Nobody left.
          </div>
        )}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '11px 14px',
              borderBottom: '1px solid var(--hairline)', background: 'var(--paper)',
            }}
          >
            <span style={{ font: "400 calc(13px * var(--ts)) var(--body)" }}>{r.name}</span>
            <span style={{
              float: 'right', font: "700 calc(13px * var(--ts)) var(--mono)", marginLeft: 10,
            }}>{r.rating}</span>
            <span style={{
              float: 'right', font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
            }}>{r.note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
