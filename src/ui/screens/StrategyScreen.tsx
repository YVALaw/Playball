// StrategyScreen.tsx
// The five things you actually control.
//
// Every option says what it costs, not just what it gives. That is the whole
// design: if one column were strictly better the screen would be a stat boost
// with extra steps, and the player would set it once and never look again. The
// notes below are the real trade the engine implements, not flavour — an
// aggressive running game does take more bases and does run into more outs.

import { useEffect, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FieldNote, ModuleIntro } from '../components/Kit.js';
import { InFrame } from '../Overlay.js';
import { teamReads } from '../../engine/tendencies.js';
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
      { value: 'constant', label: 'CONSTANT', cost: 'Twice the steal attempts, and the outs that come with them' },
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
  // Stage 22: positioning, made real — three more controls, each a trade,
  // each standing exactly where the dugout draws them.
  {
    key: 'infield',
    title: 'INFIELD DEPTH',
    note: 'Where the dirt four stand.',
    options: [
      { value: 'in', label: 'ON THE GRASS', cost: 'Kills the run at the plate and the bunt; ground balls find the outfield' },
      { value: 'normal', label: 'STANDARD', cost: 'The book depth' },
      { value: 'back', label: 'BACK', cost: 'Outs everywhere — and the run from third scores' },
    ],
  },
  {
    key: 'outfield',
    title: 'OUTFIELD DEPTH',
    note: "The outfield's leash.",
    options: [
      { value: 'shallow', label: 'SHALLOW', cost: 'Singles die in front; the ball over their heads runs for ever' },
      { value: 'normal', label: 'STANDARD', cost: 'The book depth' },
      { value: 'deep', label: 'DEEP', cost: 'Nothing lands behind them; everything lands in front' },
    ],
  },
  {
    key: 'shift',
    title: 'OVERSHIFT',
    note: 'A called side, over the standing alignment.',
    options: [
      { value: 'none', label: 'NO CALL', cost: 'The alignment policy above stays in charge' },
      { value: 'left', label: 'SHADE LEFT', cost: 'Takes hits from right-handed pull. A gift to everyone else' },
      { value: 'right', label: 'SHADE RIGHT', cost: 'Takes hits from left-handed pull. A gift to everyone else' },
    ],
  },
] as Array<Group<keyof Strategy>>;

/** What an unset optional control means: the game as it always played. */
const NEUTRAL: Partial<Record<keyof Strategy, Strategy[keyof Strategy]>> = {
  infield: 'normal',
  outfield: 'normal',
  shift: 'none',
};

const STRATEGY_SECTIONS: ReadonlyArray<{
  kicker: string;
  title: string;
  keys: ReadonlyArray<keyof Strategy>;
}> = [
  { kicker: 'WITH THE BAT', title: 'Pressure', keys: ['running', 'steals', 'bunt'] },
  { kicker: 'ON THE MOUND', title: 'Pitching decisions', keys: ['hook'] },
  { kicker: 'WITHOUT THE BALL', title: 'Positioning', keys: ['alignment', 'infield', 'outfield', 'shift'] },
];

export function StrategyScreen() {
  const setStrategy = useDynasty((s) => s.setStrategy);
  const setPlaybook = useDynasty((s) => s.setPlaybook);
  const autoSet = useDynasty((s) => s.autoSetPlaybook);
  const focus = useDynasty((s) => s.playbookFocus);
  const setFocus = useDynasty((s) => s.setPlaybookFocus);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState<string | null>(null);
  void version;

  useEffect(() => {
    if (!autoConfirmed) return undefined;
    const id = window.setTimeout(() => setAutoConfirmed(null), 1700);
    return () => window.clearTimeout(id);
  }, [autoConfirmed]);

  if (!team) return null;
  /*
    The standing plan remains one fixed destination. Opponent-specific plans
    live in a library instead of becoming an ever-growing tab strip; selecting
    one keeps the matchup context on the board while the top-level navigation
    stays stable no matter how many clubs have been scouted.
  */
  const books = Object.keys(season?.playbooks ?? {}).sort();
  const open = focus && books.includes(focus) ? focus : null;
  const current: Strategy = open
    ? (season?.playbooks?.[open] as Strategy)
    : team.strategy;
  const write = (key: keyof Strategy, value: Strategy[keyof Strategy]): void => {
    if (open) setPlaybook(open, key, value);
    else setStrategy(key, value as never);
  };
  const oppName = open
    ? season?.teams.find((t) => t.def.abbr === open)?.def.school ?? open
    : null;
  const opponent = open ? season?.teams.find((t) => t.def.abbr === open) ?? null : null;
  const reads = opponent ? teamReads(opponent.team).slice(0, 4) : [];

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker={open ? `OPPONENT PLAYBOOK · ${open}` : 'TEAM IDENTITY'}
        title={open ? `Against ${oppName}` : 'Standing strategy'}
        text={open
          ? 'Applied by itself whenever they are across the field.'
          : 'Live from the next pitch, and every column gives something up.'}
      />

      {books.length > 0 && (
        <section className="playbook-picker-bar" aria-label="Strategy plan">
          <button
            className={!open ? 'active tap' : 'tap'}
            type="button"
            onClick={() => setFocus(null)}
          >
            <small>STANDING PLAN</small>
            <strong>Default strategy</strong>
          </button>
          <button
            className={open ? 'active tap' : 'tap'}
            type="button"
            onClick={() => setLibraryOpen(true)}
          >
            <small>OPPONENT PLANS · {books.length}</small>
            <strong>{open ? oppName : 'Choose a matchup'}</strong>
          </button>
        </section>
      )}

      {libraryOpen && (
        <InFrame>
        <div className="playbook-library-layer" role="presentation">
          <button
            className="playbook-library-scrim"
            type="button"
            aria-label="Close opponent plans"
            onClick={() => setLibraryOpen(false)}
          />
          <section className="playbook-library-sheet" role="dialog" aria-modal="true" aria-label="Opponent plans">
            <header>
              <span><small>OPPONENT PLANS</small><strong>Choose a matchup</strong></span>
              <button className="tap" type="button" onClick={() => setLibraryOpen(false)}>CLOSE</button>
            </header>
            <div className="playbook-library-grid">
              {books.map((abbr) => {
                const rival = season?.teams.find((t) => t.def.abbr === abbr);
                const selected = abbr === open;
                return (
                  <button
                    className={selected ? 'selected tap' : 'tap'}
                    type="button"
                    key={abbr}
                    onClick={() => { setFocus(abbr); setLibraryOpen(false); }}
                  >
                    <span><small>{rival?.conference ?? 'SCOUTED'}</small><strong>{rival?.def.school ?? abbr}</strong></span>
                    <span><b>{rival ? `${rival.w}-${rival.l}` : '—'}</b><small>{selected ? 'OPEN' : 'PLAN'}</small></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        </InFrame>
      )}

      {open && (
        <section className="playbook-intel-card">
          <header>
            <span>
              <small>SCOUTING REPORT</small>
              <strong>{oppName}</strong>
            </span>
            {opponent && <b>{opponent.w}-{opponent.l}</b>}
          </header>
          <div className="playbook-intel-reads">
            {reads.map((read) => (
              <article key={`${read.slot}-${read.title}`}>
                <strong>{read.title}</strong>
                <p>{read.text}</p>
              </article>
            ))}
          </div>
          <button
            className={`playbook-auto-command tap${autoConfirmed === open ? ' confirmed' : ''}`}
            type="button"
            onClick={() => { if (autoSet(open)) setAutoConfirmed(open); }}
          >
            <span>
              <strong>{autoConfirmed === open ? 'Counters built' : 'Build counters from report'}</strong>
              <small>{autoConfirmed === open
                ? 'Defensive positioning updated from the scouting report.'
                : 'Sets defensive positioning from what your scouts found. Your offensive identity stays yours.'}</small>
            </span>
            <b>{autoConfirmed === open ? '✓ DONE' : 'AUTO'}</b>
          </button>
        </section>
      )}

      {/*
        The proposal's strategy board, behaving exactly as the proposal draws
        it: the row is the control, and tapping it cycles to the next option.

        It shipped as a disabled display row with a segmented strip underneath,
        and the report was 'the strategy buttons are not really working and
        hard to understand' -- a big tappable-looking row that ignores the tap
        teaches you the screen is broken before you find the strip. One target,
        and the cost line under the value updates the moment it changes, which
        keeps the trade visible -- the reason the strip existed at all.
      */}
      {STRATEGY_SECTIONS.map((section) => (
        <section className="strategy-section" key={section.kicker}>
          <header>
            <small>{section.kicker}</small>
            <h2>{section.title}</h2>
          </header>
          <div className="strategy-card-grid">
            {section.keys.map((key) => {
              const g = GROUPS.find((group) => group.key === key)!;
              const held = current[g.key] ?? NEUTRAL[g.key];
              const chosen = g.options.find((o) => o.value === held) ?? g.options[0];
              return (
                <article className="strategy-control-card" key={g.key}>
                  <div className="strategy-control-head">
                    <span><small>{g.title}</small><strong>{chosen?.label ?? '—'}</strong></span>
                    <p>{g.note}</p>
                  </div>
                  <div className="strategy-choice-row" role="group" aria-label={g.title}>
                    {g.options.map((option) => (
                      <button
                        className={option.value === held ? 'active tap' : 'tap'}
                        type="button"
                        key={String(option.value)}
                        aria-pressed={option.value === held}
                        onClick={() => write(g.key, option.value)}
                      >{option.label}</button>
                    ))}
                  </div>
                  <p className="strategy-tradeoff">{chosen?.cost}</p>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {books.length === 0 && (
        <FieldNote
          title="Opponent playbooks"
          text="Scout a program to unlock a dedicated plan that applies automatically whenever you face them."
        />
      )}
    </main>
  );
}
