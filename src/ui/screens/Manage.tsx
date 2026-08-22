// Manage.tsx
// The manager's chair. Every plate appearance, all nine innings.
//
// This is the quick manage the mockup lays out and the roadmap calls the
// emotional core: you never swing a bat, you make the call and read what
// happened. The buttons change with the situation — a sacrifice is not offered
// with the bases empty, and you cannot put a man on when first is occupied.

import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerName } from '../PlayerName.js';
import { useDynasty } from '../../state/store.js';
import { lazy, Suspense } from 'react';
import { Diamond } from '../Diamond.js';

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
import type { Hitter, Pitcher } from '../../engine/types.js';

type Modal = 'pinch' | 'pen' | null;

export function Manage() {
  const live = useDynasty((s) => s.live);
  const meta = useDynasty((s) => s.liveMeta);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const submitTactic = useDynasty((s) => s.submitTactic);
  const pinchHitFor = useDynasty((s) => s.pinchHitFor);
  const bringIn = useDynasty((s) => s.bringIn);
  const autoFinish = useDynasty((s) => s.autoFinish);
  const endManagedGame = useDynasty((s) => s.endManagedGame);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const [modal, setModal] = useState<Modal>(null);
  const [scoreTick, setScoreTick] = useState(0);
  const [ball, setBall] = useState<BallHit | null>(null);
  const ballTick = useRef(0);
  const lastRuns = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  void version;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
      hit: !wasOut, tick: ballTick.current,
    });
  }, [landing?.x, landing?.y, battedBall, version]);

  // Who crossed the plate on the last play. The engine reports it as an advance
  // to base 4, which is the only record of a man scoring — he is off the bases
  // by the time the screen sees the new state.
  const scoredIds = useMemo(() => {
    const advance = live?.lastPlay.find((e) => e.kind === 'advance');
    return (advance?.runners ?? []).filter((r) => r.to === 4).map((r) => r.id);
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
          marginTop: 8, marginBottom: 14, font: "400 12px/1.6 var(--body)",
          color: 'var(--dim)', maxWidth: 250, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Take the dugout and call every plate appearance of your next game.
        </div>
        <button
          onClick={startManagedGame}
          style={{
            padding: '11px 18px', background: 'var(--clay)',
            border: '1px solid var(--clay)', color: 'var(--cream)',
            font: "600 11px var(--mono)", letterSpacing: '.14em',
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 'none', background: 'var(--navy)', padding: '10px 14px 12px' }}>
        <Line abbr={away?.def.abbr ?? '—'} name={away?.def.school ?? ''} runs={awayRuns} batting={d?.half === 'top'} />
        <Line abbr={home?.def.abbr ?? '—'} name={home?.def.school ?? ''} runs={homeRuns} batting={d?.half === 'bottom'} />
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            font: "600 10px var(--mono)", letterSpacing: '.16em', color: 'rgba(246,241,230,.72)',
          }}>{inning}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              font: "500 9px var(--mono)", letterSpacing: '.14em',
              color: 'rgba(246,241,230,.5)',
            }}>OUT</span>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 7, height: 7, borderRadius: '50%',
                border: '1px solid rgba(246,241,230,.45)',
                background: i < outs ? 'var(--clay)' : 'transparent',
                transition: 'background 180ms ease',
              }} />
            ))}
          </span>
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
      <div style={{
        flex: 'none', height: 178, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '8px 12px 6px', borderBottom: '1px solid var(--faint)',
        background: 'var(--paper)',
      }}>
        <div style={{ flex: 'none', width: '100%', height: 118 }}>
          <Suspense fallback={
            <Diamond runners={d?.runners ?? []} scoreTick={scoreTick} size={112} />
          }>
            <Diamond3D
              runners={d?.runners ?? []} scoreTick={scoreTick}
              ball={ball} scored={{ ids: scoredIds, tick: scoreTick }} height={118}
            />
          </Suspense>
        </div>
        <div style={{ minWidth: 0, flex: 'none' }}>
          {d ? (
            <>
              <div className="label">
                {d.side === 'offense' ? 'AT THE PLATE' : 'ON THE MOUND'}
              </div>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2,
              }}>
                <PlayerName
                  id={d.side === 'offense' ? d.batter.id : d.pitcher.id}
                  style={{
                    font: "700 15px/1.1 var(--display)", textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >{d.side === 'offense' ? d.batter.name : d.pitcher.name}</PlayerName>
                <span style={{
                  font: "400 9.5px var(--mono)", color: 'var(--dim)', whiteSpace: 'nowrap',
                }}>
                  {d.side === 'offense'
                    ? `${d.batter.pos} · ${d.batter.bats} vs ${d.pitcher.throws}HP`
                    : `${d.pitcher.throws}HP`}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="label">FINAL</div>
              <div style={{
                marginTop: 3, font: "700 17px/1.1 var(--display)", textTransform: 'uppercase',
              }}>
                {homeRuns > awayRuns ? home?.def.school : away?.def.school} win
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={logRef} style={{
        flex: 1, minWidth: 0, overflowY: 'auto', padding: '9px 12px 12px 14px',
      }}>
        {recent.map((line, i) => {
          const call = line.startsWith('[bunt]') || line.startsWith('[intentional]');
          const sub = line.startsWith('   ');
          return (
            <div key={i} style={{
              padding: '3px 0',
              font: `${i === recent.length - 1 ? 600 : 400} 12px/1.45 var(--body)`,
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
            {d.options.map((o) => (
              <button
                key={o.tactic}
                onClick={() => o.available && submitTactic(o.tactic)}
                disabled={!o.available}
                style={{
                  padding: '7px 8px', textAlign: 'left', flex: 'none',
                  // Available calls are raised paper with a real border. The
                  // unavailable ones recede rather than merely dimming, so the
                  // difference is obvious at arm's length on a phone.
                  background: o.available ? 'var(--paper)' : 'transparent',
                  border: o.available
                    ? '1px solid rgba(28,36,48,.42)'
                    : '1px dashed rgba(28,36,48,.16)',
                  boxShadow: o.available ? '0 1px 0 rgba(28,36,48,.16)' : 'none',
                }}
              >
                <div style={{
                  font: "700 10px var(--mono)", letterSpacing: '.04em',
                  color: o.available ? 'var(--ink)' : 'rgba(28,36,48,.34)',
                }}>{o.label}</div>
                <div style={{
                  marginTop: 1, font: "400 9.5px/1.25 var(--body)",
                  color: o.available ? 'var(--dim)' : 'rgba(28,36,48,.28)',
                }}>{o.note}</div>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <Small
              onClick={() => setModal(d.side === 'offense' ? 'pinch' : 'pen')}
              disabled={d.side === 'offense'
                ? live.benchAvailable.length === 0
                : live.bullpenAvailable.length === 0}
            >{d.side === 'offense' ? 'PINCH HIT' : 'BULLPEN'}</Small>
            <Small onClick={autoFinish}>SIM THE REST</Small>
          </>
        ) : (
          <>
            <div className="label">GAME OVER</div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => void endManagedGame()}
              style={{
                padding: '11px 0', background: 'var(--clay)',
                border: '1px solid var(--clay)', color: 'var(--cream)',
                font: "600 10px var(--mono)", letterSpacing: '.1em',
              }}
            >RECORD</button>
          </>
        )}
      </div>
      </div>

      {modal && (
        <Picker
          title={modal === 'pinch' ? 'PINCH HITTER' : 'TO THE BULLPEN'}
          rows={modal === 'pinch'
            ? live.benchAvailable.map((h: Hitter) => ({ id: h.id, name: h.name, note: h.pos }))
            : live.bullpenAvailable.map((p: Pitcher) => ({ id: p.id, name: p.name, note: `${p.throws}HP` }))}
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

function Small(
  { onClick, disabled, children }:
  { onClick: () => void; disabled?: boolean; children: string },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 'none', padding: '8px 0',
        background: disabled ? 'transparent' : 'var(--paper)',
        border: disabled ? '1px dashed rgba(28,36,48,.16)' : '1px solid rgba(28,36,48,.42)',
        boxShadow: disabled ? 'none' : '0 1px 0 rgba(28,36,48,.16)',
        color: disabled ? 'rgba(28,36,48,.3)' : 'var(--ink)',
        font: "700 9.5px var(--mono)", letterSpacing: '.08em',
      }}
    >{children}</button>
  );
}

function Picker(
  { title, rows, onPick, onClose }:
  {
    title: string;
    rows: Array<{ id: string; name: string; note: string }>;
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
            font: "600 10px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>{title}</span>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: 14, font: "400 12px var(--body)", color: 'var(--dim)' }}>
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
            <span style={{ font: "400 13px var(--body)" }}>{r.name}</span>
            <span style={{
              float: 'right', font: "400 10px var(--mono)", color: 'var(--dim)',
            }}>{r.note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Line(
  { abbr, name, runs, batting }:
  { abbr: string; name: string; runs: number; batting?: boolean },
) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '1px 0' }}>
      <span style={{ width: 8, font: "600 11px var(--mono)", color: 'var(--clay)' }}>
        {batting ? '•' : ''}
      </span>
      <span style={{
        width: 34, font: "700 13px var(--display)", letterSpacing: '.04em', color: 'var(--cream)',
      }}>{abbr}</span>
      <span style={{
        flex: 1, minWidth: 0, font: "400 11px var(--body)", color: 'rgba(246,241,230,.6)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</span>
      <span style={{
        font: "800 22px/1 var(--display)",
        color: batting ? 'var(--cream)' : 'rgba(246,241,230,.75)',
      }}>{runs}</span>
    </div>
  );
}

