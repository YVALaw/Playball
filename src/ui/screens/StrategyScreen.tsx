// StrategyScreen.tsx
// The five things you actually control.
//
// Every option says what it costs, not just what it gives. That is the whole
// design: if one column were strictly better the screen would be a stat boost
// with extra steps, and the player would set it once and never look again. The
// notes below are the real trade the engine implements, not flavour — an
// aggressive running game does take more bases and does run into more outs.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FieldNote, ModuleIntro, Segmented } from '../components/Kit.js';
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
    <main className="module-workspace">
      <ModuleIntro
        kicker="TEAM IDENTITY"
        title="Standing strategy"
        text="Set the situations your club should recognise without interrupting every
          inning. These are live from the next pitch, and every one of them gives
          something up — there is no column here that is simply better."
      />

      {/*
        The proposal's strategy board cycles one value per row on tap, which is
        the right shape for three settings with three values each and the wrong
        one here: every option in this game says what it *costs*, and a control
        that only shows the current value hides the trade that is the whole
        point of the screen. So the board is the row — label, value, note — and
        the options open under it as a segmented strip, which is the proposal's
        own control for exactly this.
      */}
      {GROUPS.map((g) => {
        const chosen = g.options.find((o) => o.value === current[g.key]);
        return (
          <section className="strategy-board" key={g.key}>
            <button type="button" disabled>
              <span>{g.title}</span>
              <strong>{chosen?.label ?? '—'}</strong>
              <small>{chosen?.cost ?? g.note}</small>
            </button>
            <div className="setting-choice">
              <Segmented
                label={g.title}
                value={String(current[g.key])}
                onChange={(v) => setStrategy(g.key, v as never)}
                options={g.options.map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
              />
            </div>
          </section>
        );
      })}

      <FieldNote
        title="Nothing here is free"
        text="An aggressive running game does take more bases and does run into more
          outs. A full shift is big against a pull-heavy lineup and badly punished
          by one that runs. The notes are the trade the engine actually makes."
      />
    </main>
  );
}
