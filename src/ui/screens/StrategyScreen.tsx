// StrategyScreen.tsx
// How your team plays: every game, and against one team.
//
// One card per policy, grouped at the plate, on the mound and in the field.
// Each says what it controls in a sentence, offers its choices in full words,
// and says what the current choice gives and what it costs; no column is
// strictly better, which is the whole design. The trade-offs are the real ones
// the engine implements.
//
// An opponent plan (unlocked by scouting a program) applies by itself whenever
// you play them. Its rows that differ from your standing plan say so, and
// building counters from the scouting report shows what it changed, with Undo.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { teamReads } from '../../engine/tendencies.js';
import type { Strategy } from '../../engine/strategy.js';
import {
  Button, Callout, Card, EmptyState, List, ListRow, Marquee, SectionHeader, SegmentedControl, Sheet,
  Tag,
} from '../components/ui/index.js';
import { Crest } from '../Crest.js';
import { capsWords, conferenceName, recordText } from '../words.js';

interface Group<K extends keyof Strategy> {
  key: K;
  title: string;
  note: string;
  options: Array<{ value: Strategy[K]; label: string; cost: string }>;
}

const GROUPS: Array<Group<keyof Strategy>> = [
  {
    key: 'running', title: 'Base running', note: 'How hard your runners are sent for the extra base.',
    options: [
      { value: 'patient', label: 'Patient', cost: 'Fewer extra bases, and almost never thrown out.' },
      { value: 'balanced', label: 'Balanced', cost: 'Takes what is there.' },
      { value: 'aggressive', label: 'Aggressive', cost: 'More bases taken, and about twice as many runners thrown out.' },
    ],
  },
  {
    key: 'steals', title: 'Stolen bases', note: 'Whether your runners try to steal.',
    options: [
      { value: 'never', label: 'Never', cost: 'Nobody runs: no steals, and no outs given away.' },
      { value: 'selective', label: 'When it fits', cost: 'Your runners go when the matchup is right.' },
      { value: 'constant', label: 'Always', cost: 'Twice the steal attempts, and the outs that come with them.' },
    ],
  },
  {
    key: 'bunt', title: 'Sacrifice bunts', note: 'Trading an out to move a runner, late in a close game.',
    options: [
      { value: 'never', label: 'Never', cost: 'Everyone swings.' },
      { value: 'rare', label: 'Rarely', cost: 'Only the bottom of the order, only when one run decides it.' },
      { value: 'often', label: 'Often', cost: 'Moves runners, and costs you runs on balance. Bunting usually does.' },
    ],
  },
  {
    key: 'hook', title: 'When to pull the starter', note: 'How long a starting pitcher stays in once he is in trouble.',
    options: [
      { value: 'quick', label: 'Early', cost: 'Fresher arms on the mound, and a bullpen worked hard.' },
      { value: 'standard', label: 'Normal', cost: 'He comes out when he is done.' },
      { value: 'patient', label: 'Late', cost: 'The bullpen stays rested, and tired starters stay in.' },
    ],
  },
  {
    key: 'alignment', title: 'Shift', note: 'Whether the infield moves toward where a hitter usually hits it.',
    options: [
      { value: 'straight', label: 'None', cost: 'No opinion about who is batting, and nothing exposed.' },
      { value: 'situational', label: 'When it fits', cost: 'Shifts only against slow pull hitters: the percentage play.' },
      { value: 'shift', label: 'Full shift', cost: 'Big against a pull-heavy lineup, badly punished by one that runs.' },
    ],
  },
  {
    key: 'infield', title: 'Infield depth', note: 'How far back the four infielders play.',
    options: [
      { value: 'in', label: 'Drawn in', cost: 'Stops the run at the plate and the bunt; ground balls get through to the outfield.' },
      { value: 'normal', label: 'Normal', cost: 'The usual depth.' },
      { value: 'back', label: 'Back', cost: 'More room to field ground balls; gives up the play at home.' },
    ],
  },
  {
    key: 'outfield', title: 'Outfield depth', note: 'How deep the outfield plays.',
    options: [
      { value: 'shallow', label: 'Shallow', cost: 'Short hits die in front; a ball over their heads runs forever.' },
      { value: 'normal', label: 'Normal', cost: 'The usual depth.' },
      { value: 'deep', label: 'Deep', cost: 'Fewer balls over their heads; more room for short hits.' },
    ],
  },
  {
    key: 'shift', title: 'Lean', note: 'A called side, on top of the shift above.',
    options: [
      { value: 'none', label: 'None', cost: 'The shift above stays in charge.' },
      { value: 'left', label: 'Lean left', cost: 'Takes hits away from right-handed pull hitters, and gifts them to everyone else.' },
      { value: 'right', label: 'Lean right', cost: 'Takes hits away from left-handed pull hitters, and gifts them to everyone else.' },
    ],
  },
] as Array<Group<keyof Strategy>>;

/** A policy and its setting in this screen's own words: "Stolen bases", "When it fits". */
export function policyWords(key: keyof Strategy, value: Strategy[keyof Strategy]): { title: string; label: string } {
  const g = GROUPS.find((x) => x.key === key);
  return { title: g?.title ?? String(key), label: g?.options.find((o) => o.value === value)?.label ?? String(value) };
}

/** What an unset optional control means: the game as it always played. */
const NEUTRAL: Partial<Record<keyof Strategy, Strategy[keyof Strategy]>> = {
  infield: 'normal',
  outfield: 'normal',
  shift: 'none',
};

const SECTIONS: ReadonlyArray<{ title: string; keys: ReadonlyArray<keyof Strategy> }> = [
  { title: 'At the plate', keys: ['running', 'steals', 'bunt'] },
  { title: 'On the mound', keys: ['hook'] },
  { title: 'In the field', keys: ['alignment', 'infield', 'outfield', 'shift'] },
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
  const [picking, setPicking] = useState(false);
  // What the last "build counters" changed, so it can be read and undone.
  const [built, setBuilt] = useState<{ abbr: string; changes: Array<{ key: keyof Strategy; from: Strategy[keyof Strategy] }> } | null>(null);
  void version;

  if (!team) return null;

  const books = Object.keys(season?.playbooks ?? {}).sort();
  const open = focus && books.includes(focus) ? focus : null;
  const current: Strategy = open ? (season?.playbooks?.[open] as Strategy) : team.strategy;
  const standing = team.strategy;
  const opponent = open ? season?.teams.find((t) => t.def.abbr === open) ?? null : null;
  const oppName = opponent?.def.school ?? open ?? '';
  const reads = opponent ? teamReads(opponent.team).slice(0, 4) : [];
  const valueOf = (s: Strategy, key: keyof Strategy) => s[key] ?? NEUTRAL[key];
  const write = (key: keyof Strategy, value: Strategy[keyof Strategy]): void => {
    if (open) setPlaybook(open, key, value);
    else setStrategy(key, value as never);
  };
  const labelOf = (key: keyof Strategy, value: Strategy[keyof Strategy]): string =>
    GROUPS.find((g) => g.key === key)?.options.find((o) => o.value === value)?.label ?? String(value);

  const buildCounters = (): void => {
    if (!open) return;
    const before = { ...current };
    const moved = autoSet(open);
    if (moved === null) return;
    const after = useDynasty.getState().season?.playbooks?.[open] as Strategy | undefined;
    const changes = GROUPS
      .filter((g) => after && valueOf(after, g.key) !== valueOf(before, g.key))
      .map((g) => ({ key: g.key, from: valueOf(before, g.key) as Strategy[keyof Strategy] }));
    setBuilt({ abbr: open, changes });
  };
  const undoCounters = (): void => {
    if (!built) return;
    for (const c of built.changes) setPlaybook(built.abbr, c.key, c.from);
    setBuilt(null);
  };

  return (
    <main className="pb-page">
      <Marquee eyebrow="How your team plays" title="Strategy" />

      {books.length > 0 ? (
        <SegmentedControl<'every' | 'one'>
          label="Which plan"
          value={open ? 'one' : 'every'}
          onChange={(v) => { if (v === 'every') setFocus(null); else if (!open) setPicking(true); }}
          options={[
            { value: 'every', label: 'Every game' },
            { value: 'one', label: 'Against one team', badge: books.length },
          ]}
        />
      ) : (
        <Callout tone="info" title="Plans against one team">
          Scout a program to unlock one.
        </Callout>
      )}

      {open && opponent && (
        <Card
          eyebrow="Against one team"
          title={oppName}
          trailing={<Button size="sm" variant="quiet" iconAfter="chevron-right" onClick={() => setPicking(true)}>Change team</Button>}
        >
          {reads.length > 0 && (
            <List label="What the report found">
              {reads.map((read) => (
                <ListRow
                  key={`${read.slot}-${read.title}`}
                  title={read.title === read.title.toUpperCase() ? capsWords(read.title) : read.title}
                  subtitle={read.text}
                />
              ))}
            </List>
          )}
          {built && built.abbr === open ? (
            <Callout
              tone={built.changes.length ? 'positive' : 'neutral'}
              title={built.changes.length ? `Counters built: ${built.changes.length} ${built.changes.length === 1 ? 'row' : 'rows'} changed` : 'Nothing to change'}
              action={built.changes.length ? { label: 'Undo', onClick: undoCounters } : undefined}
            >
              {built.changes.length
                ? built.changes.map((c) => `${GROUPS.find((g) => g.key === c.key)?.title}: ${labelOf(c.key, c.from)} to ${labelOf(c.key, valueOf(current, c.key) as Strategy[keyof Strategy])}`).join('. ') + '.'
                : 'Nothing in the report is unusual enough to move a row. Your standing plan works against them.'}
            </Callout>
          ) : (
            <Button variant="secondary" block icon="wand" onClick={buildCounters}>Build counters from the report</Button>
          )}
        </Card>
      )}

      {SECTIONS.map((section) => (
        <section key={section.title} className="pb-stack">
          <SectionHeader title={section.title} />
          {section.keys.map((key) => {
            const g = GROUPS.find((group) => group.key === key)!;
            const held = valueOf(current, g.key);
            const chosen = g.options.find((o) => o.value === held) ?? g.options[0];
            const differs = !!open && held !== valueOf(standing, g.key);
            return (
              <Card
                key={g.key}
                title={g.title}
                trailing={differs ? <Tag tone="warning">Changed for {oppName}</Tag> : undefined}
              >
                
                <SegmentedControl<string>
                  kind="radio"
                  label={g.title}
                  value={String(held)}
                  onChange={(v) => write(g.key, g.options.find((o) => String(o.value) === v)!.value)}
                  options={g.options.map((o) => ({ value: String(o.value), label: o.label }))}
                />
                <p className="pb-text">{chosen?.cost}</p>
              </Card>
            );
          })}
        </section>
      ))}

      {picking && (
        <Sheet title="Choose a team" eyebrow="Plans against one team" onClose={() => setPicking(false)}>
          {books.length === 0 ? (
            <EmptyState icon="target" title="No plans yet" text="Scout a program to start one." />
          ) : (
            <List label="Scouted teams">
              {books.map((abbr) => {
                const rival = season?.teams.find((t) => t.def.abbr === abbr);
                return (
                  <ListRow
                    key={abbr}
                    lead={<Crest abbr={abbr} size={32} />}
                    title={rival?.def.school ?? abbr}
                    subtitle={rival ? `${conferenceName(rival.conference)} · ${recordText(rival.w, rival.l)}` : 'Scouted'}
                    selected={abbr === open}
                    onClick={() => { setFocus(abbr); setPicking(false); setBuilt(null); }}
                  />
                );
              })}
            </List>
          )}
        </Sheet>
      )}
    </main>
  );
}
