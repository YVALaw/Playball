// Lineup.tsx
// The first screen where you are coaching rather than reading.
//
// Both of these are real: the engine reads `team.lineup` for the batting order
// and `team.rotation` for who takes the ball, so a change here changes what
// happens on the field. Positions print as baseball abbreviations — C, SS, CF —
// the same vocabulary every other screen speaks.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf } from '../../engine/ratings.js';
import { battingAverage, era, inningsPitched } from '../../engine/season.js';
import { pct } from '../format.js';

/** Friday, Saturday, Sunday, then the midweek arm. */
const SLOTS = ['FRI', 'SAT', 'SUN', 'MID'];

/*
  No tap-through to the player card here, deliberately.

  The row's tap is how you move the batting order — pick one, pick another, they
  swap — and a second meaning on the same target makes both unreliable. Reported
  from testing: "in lineup the players should not open their profile since we
  have to tap one and tap another to actually move the lineup around."
*/
export function Lineup() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const swapLineup = useDynasty((s) => s.swapLineup);
  const moveRotation = useDynasty((s) => s.moveRotation);
  const autoLineup = useDynasty((s) => s.autoLineup);
  const team = useUserTeam();
  const [picked, setPicked] = useState<number | null>(null);
  const [dealt, setDealt] = useState(false);
  void version;

  if (!season || !team) return null;

  const order = team.team.lineup;

  // The fourth starter only pitches non-conference games, so his innings are a
  // quick read on whether that slot is carrying real work.
  const midweekArm = team.team.rotation[3];
  const midweekLine = midweekArm ? season.pitching.get(midweekArm.id) : undefined;
  const midweekInnings = midweekLine ? inningsPitched(midweekLine) : 0;

  const tap = (i: number): void => {
    if (picked === null) { setPicked(i); return; }
    if (picked === i) { setPicked(null); return; }
    swapLineup(picked, i);
    setPicked(null);
  };

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            gap: 8, borderBottom: '2px solid var(--ink)', paddingBottom: 6,
          }}>
            <div>
              <div className="label">BATTING ORDER</div>
              <div style={{
                font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
              }}>Lineup card</div>
            </div>
            {/* One tap deals a sound order — best hitter third, power fourth,
                the table-setters ahead of them. Same nine men, and every swap
                below still works afterwards: AUTO is a starting point. */}
            <button
              onClick={() => { autoLineup(); setPicked(null); setDealt(true); }}
              className="tap"
              style={{
                flex: 'none', padding: '9px 13px', minHeight: 40, marginBottom: 2,
                background: 'transparent', border: '1px solid var(--clay)',
                color: 'var(--clay)', font: "700 10px var(--mono)", letterSpacing: '.12em',
              }}
            >AUTO</button>
          </div>

          {/*
            The instruction rides with the title rather than the list. It is the
            other half of a two-tap gesture — "now tap the spot to swap with
            Reyes" — and a prompt you can scroll off the screen halfway through
            the thing it is prompting is a prompt that has stopped working. It
            is also where AUTO reports, because a button that reorders a list
            you may not have memorised needs to say it did something.
          */}
          <div style={{
            marginTop: 8, font: "400 11px/1.5 var(--body)",
            color: picked === null ? (dealt ? 'var(--win)' : 'var(--dim)') : 'var(--clay)',
          }}>
            {picked !== null
              ? `Now tap the spot to swap with ${order[picked]?.name ?? ''}.`
              : dealt
                ? 'Order dealt. Tap two spots to fine-tune it.'
                : 'Tap two spots to swap them.'}
          </div>
        </div>
      }
    >
    <div style={{ padding: '10px 14px 16px' }}>
      <div style={{
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {order.map((p, i) => {
          const line = season.batting.get(p.id);
          const on = picked === i;
          return (
            <button
              key={p.id}
              onClick={() => tap(i)}
              style={{
                width: '100%', display: 'grid',
                gridTemplateColumns: '18px 26px 1fr 30px 44px',
                gap: 8, alignItems: 'center', textAlign: 'left',
                padding: '9px 10px', borderBottom: '1px solid var(--hairline)',
                background: on ? 'rgba(168,68,42,.12)' : 'transparent',
              }}
            >
              <span style={{ font: "700 13px var(--display)", color: 'var(--dim)' }}>{i + 1}</span>
              {/* The position as baseball says it — C, SS, CF — rather than
                  the scorer's 2-6-8. The abbreviations are what every other
                  screen prints, and a lineup card is not a scorebook. */}
              <span style={{ font: "500 10px var(--mono)", color: 'var(--clay)' }}>
                {p.pos}
              </span>
              <span style={{
                font: `${on ? 600 : 400} 13px var(--body)`,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</span>
              <span style={{
                font: "400 10px var(--mono)", color: 'var(--dim)', textAlign: 'right',
              }}>{overallOf(p)}</span>
              <span style={{ font: "400 11px var(--mono)", textAlign: 'right' }}>
                {line && line.ab > 0 ? pct(battingAverage(line)) : '—'}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, borderBottom: '2px solid var(--ink)', paddingBottom: 6,
      }}>
        <div className="label">WEEKEND ROTATION</div>
      </div>

      <div style={{
        marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {team.team.rotation.map((p, i) => {
          const line = season.pitching.get(p.id);
          return (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '34px 1fr 30px 46px 44px',
              gap: 6, alignItems: 'center',
              padding: '9px 10px', borderBottom: '1px solid var(--hairline)',
            }}>
              <span style={{
                font: "700 11px var(--display)", letterSpacing: '.1em', color: 'var(--clay)',
              }}>{SLOTS[i]}</span>
              <span style={{
                font: "400 13px var(--body)",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</span>
              <span style={{
                font: "400 10px var(--mono)", color: 'var(--dim)', textAlign: 'right',
              }}>{overallOf(p)}</span>
              <span style={{ font: "400 11px var(--mono)", textAlign: 'right' }}>
                {line && line.outs > 0 ? era(line).toFixed(2) : '—'}
              </span>
              <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <Nudge onClick={() => moveRotation(i, -1)} disabled={i === 0}>↑</Nudge>
                <Nudge
                  onClick={() => moveRotation(i, 1)}
                  disabled={i === team.team.rotation.length - 1}
                >↓</Nudge>
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
        Your Friday arm starts the opener of every conference series. The midweek starter
        takes all twelve non-conference games — {midweekInnings.toFixed(0)} innings so far.
      </div>

      {/* The pen, most rested arms doing most of the work. Read-only here —
          who comes in is a game-night decision, made from the BULLPEN button
          on the manage screen — but the rotation's other half belongs on the
          same card as the rotation. */}
      <div style={{
        marginTop: 20, borderBottom: '2px solid var(--ink)', paddingBottom: 6,
      }}>
        <div className="label">THE BULLPEN</div>
      </div>
      <div style={{
        marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {team.team.bullpen.map((p) => {
          const line = season.pitching.get(p.id);
          const ip = line ? inningsPitched(line) : 0;
          return (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '34px 1fr 30px 46px 44px',
              gap: 6, alignItems: 'center',
              padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
            }}>
              <span style={{
                font: "600 9px var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
              }}>{p.role}</span>
              <span style={{
                font: "400 13px var(--body)",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</span>
              <span style={{
                font: "400 10px var(--mono)", color: 'var(--dim)', textAlign: 'right',
              }}>{overallOf(p)}</span>
              <span style={{ font: "400 11px var(--mono)", textAlign: 'right' }}>
                {line && line.outs > 0 ? era(line).toFixed(2) : '—'}
              </span>
              <span style={{
                font: "400 10px var(--mono)", color: 'var(--dim)', textAlign: 'right',
              }}>{ip > 0 ? `${ip.toFixed(0)} IP` : '—'}</span>
            </div>
          );
        })}
      </div>
      <FirstVisit id="lineup" />
    </div>
    </FixedHeader>
  );
}

function Nudge(
  { onClick, disabled, children }:
  { onClick: () => void; disabled: boolean; children: string },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 20, height: 20, lineHeight: '18px', textAlign: 'center',
        border: '1px solid var(--faint)',
        color: disabled ? 'rgba(28,36,48,.2)' : 'var(--ink)',
        font: '11px var(--mono)',
      }}
    >{children}</button>
  );
}
