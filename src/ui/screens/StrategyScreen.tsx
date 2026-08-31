// StrategyScreen.tsx
// The five things you actually control.
//
// Every option says what it costs, not just what it gives. That is the whole
// design: if one column were strictly better the screen would be a stat boost
// with extra steps, and the player would set it once and never look again. The
// notes below are the real trade the engine implements, not flavour — an
// aggressive running game does take more bases and does run into more outs.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import type { Strategy } from '../../engine/strategy.js';

interface Group<K extends keyof Strategy> {
  key: K;
  title: string;
  note: string;
  options: Array<{ value: Strategy[K]; label: string; cost: string }>;
}

const GROUPS: Array<Group<keyof Strategy>> = [
  {
    key: 'running',
    title: 'BASE RUNNING',
    note: 'How hard runners are sent for the extra base.',
    options: [
      { value: 'patient', label: 'PATIENT', cost: 'Fewer extra bases, almost never thrown out' },
      { value: 'balanced', label: 'BALANCED', cost: 'Takes what is there' },
      { value: 'aggressive', label: 'AGGRESSIVE', cost: 'More bases taken, and roughly twice as many runners retired' },
    ],
  },
  {
    key: 'steals',
    title: 'STOLEN BASES',
    note: 'Green light policy for anyone who reaches.',
    options: [
      { value: 'never', label: 'NEVER', cost: 'Nobody runs. No steals, and none given away' },
      { value: 'selective', label: 'SELECTIVE', cost: 'Your runners go when the matchup is right' },
      { value: 'constant', label: 'CONSTANT', cost: 'Twice the steals and twice the outs on the bases' },
    ],
  },
  {
    key: 'bunt',
    title: 'SACRIFICE BUNT',
    note: 'Trading an out to move a runner, late and close.',
    options: [
      { value: 'never', label: 'NEVER', cost: 'Everyone swings' },
      { value: 'rare', label: 'RARE', cost: 'Only the bottom of the order, only when a run decides it' },
      { value: 'often', label: 'OFTEN', cost: 'Moves runners, and costs you runs on balance. Bunting usually does' },
    ],
  },
  {
    key: 'hook',
    title: 'PITCHING HOOK',
    note: 'How long a starter stays once he is in trouble.',
    options: [
      { value: 'quick', label: 'QUICK', cost: 'Fresher arms on the mound, bullpen worked hard' },
      { value: 'standard', label: 'STANDARD', cost: 'Out when he is done' },
      { value: 'patient', label: 'PATIENT', cost: 'Bullpen stays rested, tired starters stay in' },
    ],
  },
  {
    key: 'alignment',
    title: 'ALIGNMENT',
    note: 'Where the infield stands.',
    options: [
      { value: 'straight', label: 'STRAIGHT UP', cost: 'No opinion about who is batting, no exposure' },
      { value: 'situational', label: 'SITUATIONAL', cost: 'Shift only against slow pull hitters. The percentage play' },
      { value: 'shift', label: 'FULL SHIFT', cost: 'Big against a pull heavy lineup, badly punished by one that runs' },
    ],
  },
] as Array<Group<keyof Strategy>>;

export function StrategyScreen() {
  const setStrategy = useDynasty((s) => s.setStrategy);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  if (!team) return null;
  const current = team.strategy;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">HOW YOU PLAY</div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>Strategy</div>
          </div>
        </div>
      }
    >
    <div style={{ padding: '10px 14px 16px' }}>
      <div style={{
        font: "400 calc(11.5px * var(--ts))/1.55 var(--body)", color: 'var(--dim)',
      }}>
        These are live from the next pitch. Every setting gives something up —
        there is no column here that is simply better than the others.
      </div>

      {GROUPS.map((g) => (
        <div key={g.key} style={{ marginTop: 18 }}>
          <div className="label">{g.title}</div>
          <div style={{
            marginTop: 2, marginBottom: 6,
            font: "400 calc(11px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
          }}>{g.note}</div>

          {g.options.map((o) => {
            const on = current[g.key] === o.value;
            return (
              <button
                key={String(o.value)}
                onClick={() => setStrategy(g.key, o.value)}
                style={{
                  width: '100%', textAlign: 'left', marginBottom: 5,
                  padding: '9px 11px',
                  background: on ? 'rgba(var(--clay-rgb), .10)' : 'var(--paper)',
                  border: `1px solid ${on ? 'var(--clay)' : 'rgba(var(--ink-rgb), .28)'}`,
                  boxShadow: on ? 'none' : '0 1px 0 rgba(var(--ink-rgb), .10)',
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                }}>
                  <span style={{
                    font: "700 calc(10.5px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                    color: on ? 'var(--clay)' : 'var(--ink)',
                  }}>{o.label}</span>
                  {on && (
                    <span style={{
                      font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.12em', color: 'var(--clay)',
                    }}>IN USE</span>
                  )}
                </div>
                <div style={{
                  marginTop: 3, font: "400 calc(11px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
                }}>{o.cost}</div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
    </FixedHeader>
  );
}
