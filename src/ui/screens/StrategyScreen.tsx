// StrategyScreen.tsx
// The five things you actually control.
//
// Every option says what it costs, not just what it gives. That is the whole
// design: if one column were strictly better the screen would be a stat boost
// with extra steps, and the player would set it once and never look again. The
// notes below are the real trade the engine implements, not flavour — an
// aggressive running game does take more bases and does run into more outs.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { ReloadIcon } from '@radix-ui/react-icons';
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

export function StrategyScreen() {
  const setStrategy = useDynasty((s) => s.setStrategy);
  const setPlaybook = useDynasty((s) => s.setPlaybook);
  const autoSet = useDynasty((s) => s.autoSetPlaybook);
  const focus = useDynasty((s) => s.playbookFocus);
  const setFocus = useDynasty((s) => s.setPlaybookFocus);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  if (!team) return null;
  /*
    Stage 22: the default book and the opponent books, one screen. The
    standing strategy is the DEFAULT playbook; every scouted club adds a
    tab, and the book under a tab is applied by itself whenever that club
    is across the field.
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

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker={open ? `THE BOOK · ${open}` : 'TEAM IDENTITY'}
        title={open ? `Against ${oppName}` : 'Standing strategy'}
        text={open
          ? 'Applied by itself whenever they are across the field.'
          : 'Live from the next pitch, and every column gives something up.'}
      />

      {books.length > 0 && (
        <Segmented
          label="Which playbook"
          value={open ?? 'DEFAULT'}
          onChange={(v: string) => setFocus(v === 'DEFAULT' ? null : v)}
          options={[
            { value: 'DEFAULT', label: 'DEFAULT' },
            ...books.map((b) => ({ value: b, label: b })),
          ]}
        />
      )}

      {open && (
        <button
          className="secondary-command tap"
          type="button"
          onClick={() => autoSet(open)}
        >
          AUTO SET FROM THE BOOK
        </button>
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
      {GROUPS.map((g) => {
        const held = current[g.key] ?? NEUTRAL[g.key];
        const i = g.options.findIndex((o) => o.value === held);
        const chosen = g.options[i];
        const next = g.options[(i + 1) % g.options.length]!;
        return (
          <section className="strategy-board" key={g.key}>
            <button
              className="tap"
              type="button"
              aria-label={`${g.title}: ${chosen?.label ?? ''}. Tap for ${next.label}`}
              onClick={() => write(g.key, next.value)}
            >
              <span>{g.title}</span>
              <strong>{chosen?.label ?? '—'}</strong>
              <small>{chosen?.cost ?? g.note}</small>
              <ReloadIcon />
            </button>
          </section>
        );
      })}

      <FieldNote
        title="Nothing here is free"
        text="The notes on each row are the trade the engine actually makes."
      />
      {books.length === 0 && (
        <FieldNote
          title="Opponent playbooks"
          text="Scout a club and its book appears here, applied by itself
            whenever you meet them."
        />
      )}
    </main>
  );
}
