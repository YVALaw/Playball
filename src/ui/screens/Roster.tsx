// Roster.tsx
// Your players, grouped the way a lineup card thinks — catchers, infield,
// outfield; starters and relievers — with the three things that need you
// counted on top: who is hurt, who the draft may take, who is unhappy.
//
// From the UI clarity review (design/UI Clarity Review/Roster and Player.dc.html,
// variant "A · Grouped with flags", 2026-09-25). It replaced a search field,
// view chips and a panel of filters: the counters are the filters now. A tap
// on one shows only those men, a second tap shows everyone again. Every row
// says the same things in the same places: the face, the name, the position
// and the class, what is wrong if anything is, then his potential and, big,
// his rating now. A row with something wrong carries its colour down its left
// edge, so a long list can be read by its edge alone.
//
// The words on the chips are the player card's (PlayerHub.tsx), so a row and
// the card it opens never disagree about a man.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { GodBolt } from '../god/GodBolt.js';
import { handles } from '../../state/depth.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { captainOf } from '../../engine/captains.js';
import { potentialGrade } from '../../engine/scouting.js';
import { injuryClock } from '../../engine/season.js';
import { isHurt } from '../../engine/injury.js';
import { isTwoWay, uniquePlayers } from '../../engine/types.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';
import {
  EmptyState, Face, Icon, List, Marquee, Monogram, NamePlate, PlayerRow, SectionHeader,
  SegmentedControl, Tag, cx, type IconName,
} from '../components/ui/index.js';
import {
  availabilityOf, classWord, draftOutlook, moodFlag, posName, type Tint,
} from './PlayerHub.js';

type View = 'bat' | 'arm' | 'all';
type Flag = 'hurt' | 'draft' | 'mood';

/** The counters, in the review's order: what is wrong, then what could go wrong. */
const FLAGS: ReadonlyArray<{ key: Flag; label: string; tone: 'negative' | 'warning'; icon: IconName; none: string }> = [
  { key: 'hurt', label: 'Injured', tone: 'negative', icon: 'cross-circled', none: 'injured' },
  { key: 'draft', label: 'Draft risk', tone: 'warning', icon: 'alert', none: 'at risk in the draft' },
  { key: 'mood', label: 'Unhappy', tone: 'warning', icon: 'minus-circled', none: 'unhappy' },
];

/*
  Where a man is listed. A hitter by the position he actually plays — his own,
  not the one the chart has him covering tonight, so the list does not
  reshuffle every time the lineup moves somebody for a night — and a man the
  roster calls a DH by the spot his glove says he is (`naturalPos`), because
  the DH is a lineup slot and not a position: he lands at first base or in a
  corner of the outfield. An arm by his own role, for the same reason
  (`homeRole`). A two-way man on the staff is both, so he is listed in both:
  at his position among the hitters and in his role among the pitchers, once
  under Everyone, and his tag says both halves ("SS/SP") wherever he appears.
*/
const HITTER_GROUPS: ReadonlyArray<[string, readonly string[]]> = [
  ['Catchers', ['C']],
  ['Infield', ['1B', '2B', 'SS', '3B']],
  ['Outfield', ['LF', 'CF', 'RF']],
];
const ARM_GROUPS: ReadonlyArray<[string, readonly string[]]> = [
  ['Starting pitchers', ['SP']],
  ['Relief pitchers', ['RP']],
];

interface Chip { text: string; tint: Tint; icon?: IconName; flag?: Flag }

interface Row {
  p: Player;
  /** His position among the hitters, or null for a man who only pitches. */
  pos: string | null;
  /** His role on the staff, or null for a man who only hits. */
  role: string | null;
  chips: Chip[];
  flags: Set<Flag>;
  /** The left edge: the first chip that is a problem or a watch. */
  edge: 'negative' | 'warning' | null;
}

export function Roster() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const phase = useDynasty((s) => s.phase);
  const winter = phase !== null;
  const team = useUserTeam();
  const openOverlay = useDynasty((st) => st.openOverlay);
  // The captaincy has its own switch; this door reads that one.
  const namesCaptain = useDynasty((st) => handles(st.depth, 'captains'));
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [view, setView] = useState<View>('bat');
  const [flag, setFlag] = useState<Flag | null>(null);

  const day = season ? injuryClock(season) : 0;
  const rows = useMemo((): Row[] => {
    if (!team) return [];
    const men = uniquePlayers([
      ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
    ]);
    const hitters = new Set([...team.team.lineup, ...team.team.bench].map((p) => p.id));
    const arms = new Set([...team.team.rotation, ...team.team.bullpen].map((p) => p.id));
    return men.map((p): Row => {
      const homePos = p.type === 'hitter' ? (p as Hitter).homePos : undefined;
      const pos = p.type === 'hitter' && (hitters.has(p.id) || !arms.has(p.id))
        ? naturalPos(homePos ? { ...(p as Hitter), pos: homePos } : (p as Hitter)) : null;
      const arm = p.type === 'pitcher' || isTwoWay(p)
        ? (p as Pitcher & { homeRole?: Pitcher['role'] }) : null;
      const role = arm && (arms.has(p.id) || p.type === 'pitcher') ? (arm.homeRole ?? arm.role) : null;

      const chips: Chip[] = [];
      const status = availabilityOf(p, day, winter);
      if (status.chip) {
        const hurt = isHurt(p, day);
        chips.push({ text: status.chip, tint: status.tint, icon: hurt ? 'cross-circled' : undefined, flag: hurt ? 'hurt' : undefined });
      }
      const draft = draftOutlook(p, phase, season);
      if (draft.risk) chips.push({ text: draft.value, tint: 'warn', flag: 'draft' });
      const feeling = moodFlag(p);
      if (feeling) chips.push({ text: feeling.text, tint: feeling.tint, flag: 'mood' });

      const loud = chips.find((c) => c.tint === 'bad' || c.tint === 'warn');
      return {
        p,
        pos,
        role,
        chips,
        flags: new Set(chips.flatMap((c) => (c.flag ? [c.flag] : []))),
        edge: loud ? (loud.tint === 'bad' ? 'negative' : 'warning') : null,
      };
    });
    // The engine mutates the men in place; the version is what says they moved.
  }, [team, version, day, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!season || !team) return null;

  const captain = captainOf(team.team);
  const counts: Record<Flag, number> = {
    hurt: rows.filter((r) => r.flags.has('hurt')).length,
    draft: rows.filter((r) => r.flags.has('draft')).length,
    mood: rows.filter((r) => r.flags.has('mood')).length,
  };

  const pool = view === 'bat' ? rows.filter((r) => r.pos !== null)
    : view === 'arm' ? rows.filter((r) => r.role !== null)
      : rows;
  const shown = pool
    .filter((r) => flag === null || r.flags.has(flag))
    .sort((a, b) => overallOf(b.p) - overallOf(a.p));

  const defs = view === 'bat' ? HITTER_GROUPS : ARM_GROUPS;
  const slotOf = (r: Row): string => (view === 'arm' ? r.role : r.pos) ?? '';
  const groups: Array<{ title: string; rows: Row[]; cols: string }> = view === 'all'
    ? [{ title: 'Everyone', rows: shown, cols: '' }]
    : [
      ...defs.map(([title, spots]) => ({ title, rows: shown.filter((r) => spots.includes(slotOf(r))), cols: 'Pot. · Now' })),
      // Nobody should ever be missing from his own roster: a spot no group
      // names (none today) still gets a home at the end.
      {
        title: 'Others',
        rows: shown.filter((r) => !defs.some(([, spots]) => spots.includes(slotOf(r)))),
        cols: 'Pot. · Now',
      },
    ].filter((g) => g.rows.length > 0);

  const who = view === 'bat' ? 'hitters' : view === 'arm' ? 'pitchers' : 'players';
  const flagged = FLAGS.find((f) => f.key === flag);

  const row = (r: Row) => {
    const { p } = r;
    // Both halves of a two-way man, wherever he is listed.
    const slot = r.pos && r.role ? `${r.pos}/${r.role}` : (r.pos ?? r.role ?? '');
    const slotTitle = r.pos && r.role
      ? `${posName(r.pos)} and ${posName(r.role).toLowerCase()}` : posName(slot);
    return (
      <PlayerRow
        key={p.id}
        className={cx(r.edge && `is-flag-${r.edge}`)}
        name={p.name}
        avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
        mark={captain?.id === p.id ? <Tag tone="positive" title="Team captain">Captain</Tag> : undefined}
        tags={[{ text: slot, title: slotTitle }, classWord(p.classYear)]}
        meta={r.chips.length > 0 ? r.chips.map((c) => (
          <span key={c.text} className={cx('pb-roster__chip', `is-${c.tint}`)}>
            {c.icon && <Icon name={c.icon} size={11} />}{c.text}
          </span>
        )) : undefined}
        stats={[{ label: 'Pot.', value: potentialGrade(p.potential), title: 'Potential' }]}
        value={overallOf(p)}
        valueLabel="Now"
        chevron={false}
        onClick={() => openPlayer(p.id as Parameters<typeof openPlayer>[0])}
      />
    );
  };

  return (
    <main className="pb-page pb-roster">
      <FirstVisit id="roster" />
      <Marquee
        eyebrow={`${team.def.school} · ${rows.length} on the card`}
        title="Roster"
        trailing={<GodBolt target={{ kind: 'roster', team: team.index }} label="Edit the roster in god mode" />}
      />

      <div className="pb-roster__flags" role="group" aria-label="Needs a look">
        {FLAGS.map((f) => {
          const n = counts[f.key];
          const on = flag === f.key;
          return (
            <button
              key={f.key}
              type="button"
              className={cx('pb-roster__flag', `is-${f.tone}`, on && 'is-on', n === 0 && 'is-zero')}
              aria-pressed={on}
              disabled={n === 0 && !on}
              onClick={() => setFlag(on ? null : f.key)}
            >
              <span className="pb-roster__flag-count"><Icon name={f.icon} size={14} /><b>{n}</b></span>
              <small>{f.label}</small>
            </button>
          );
        })}
      </div>

      <SegmentedControl<View>
        label="Show"
        value={view}
        onChange={setView}
        options={[
          { value: 'bat', label: 'Hitters' },
          { value: 'arm', label: 'Pitchers' },
          { value: 'all', label: 'Everyone' },
        ]}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={flagged?.icon ?? 'person'}
          title={flagged ? `No ${who} ${flagged.none}` : `No ${who}`}
          action={flagged ? { label: 'Clear filter', onClick: () => setFlag(null) } : undefined}
        />
      ) : groups.map((g) => (
        <section key={g.title} className="pb-roster__group" aria-label={g.title}>
          <div className="pb-roster__grouphead">
            <h2>{g.title}<span>{g.rows.length}</span></h2>
            {g.cols && <small>{g.cols}</small>}
          </div>
          <List label={g.title}>{g.rows.map(row)}</List>
        </section>
      ))}

      {namesCaptain && (
        <section>
          <SectionHeader title="Team roles" />
          <NamePlate
            mark={captain
              ? <Face id={captain.id} team={team.def.abbr} size={36} />
              : <Monogram vacant size={36} />}
            role="Captain"
            name={captain ? captain.name : 'Nobody yet'}
            value={captain ? overallOf(captain) : undefined}
            vacant={!captain}
            onClick={() => openOverlay('captain')}
          />
        </section>
      )}
    </main>
  );
}
