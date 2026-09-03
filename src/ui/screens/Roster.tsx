// Roster.tsx
// Your players. This is the screen where the dynasty becomes legible — class
// years show you who is about to leave, and the gap between overall and
// potential shows you who is worth waiting on.
//
// Three views of one list: everybody, the bats, the arms. The glove work that
// used to be a third tab here lives with the rest of the numbers on the STATS
// screen now — fielding is a statistic, not a separate species of player.
//
// The proposal's roster, class for class: a title row with the depth chart as a
// square command beside it, the group switch and the filter sharing a row, the
// list as `.data-table`, the two staff errands as `.inline-actions`, and the
// room's capacity under all of it.
//
// One thing genuinely changed shape. The old list was an eight column grid —
// POS, YR, OVR, POT and then two stat columns that swapped with the tab — and
// the proposal's row has three slots: a name, a line of detail, and one number.
// Nothing was dropped to fit: the four identity columns read as a sentence in
// the detail line, which is where a phone reads them faster anyway, and the
// number on the right is the one the tab is *about*. The eight column version
// was a spreadsheet on a 390 pixel screen and the columns were 26 pixels wide.

import { useState } from 'react';
import { MixerHorizontalIcon } from '@radix-ui/react-icons';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { Avatar } from '../Avatar.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { captainOf } from '../../engine/captains.js';
import { potentialGrade } from '../../engine/scouting.js';
import { battingAverage, era, inningsPitched, injuryClock } from '../../engine/season.js';
import { isHurt } from '../../engine/injury.js';
import { available } from '../../engine/depthChart.js';
import {
  Capacity, CaptainC, DataTable, InlineActions, ModuleIntro, Segmented, type Row,
} from '../components/Kit.js';
import { uniquePlayers } from '../../engine/types.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';

type Mode = 'all' | 'bat' | 'arm';

/** The order a lineup card thinks in; pitcher roles ride at the end. */
const SLOT_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

// A DH reads as the position he actually plays — the DH is a lineup slot, not
// a man. The lineup screen still shows DH where he bats; this list shows who
// he is. See `naturalPos`.
const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);

/**
 * Why a man is not playing, in the fewest letters that still say which.
 *
 * Four reasons and they are not interchangeable: HURT is the trainer's, ACAD is
 * the registrar's, R-S is a season you chose to spend, and REST is one you chose
 * to spend a few days of. A single "unavailable" mark would collapse a decision
 * you made into a thing that happened to you.
 *
 * Returns null for a man who is fit, which is nearly everybody nearly always —
 * the mark has to stay rare or it stops being a mark.
 */
function outTag(p: Player, day: number): string | null {
  if ((p as Player & { redshirt?: boolean }).redshirt) return 'R-S';
  if (available(p, day)) return null;
  if (isHurt(p, day)) return 'HURT';
  // `available` is false and the trainer has nothing to do with it, so it is
  // either the classroom or a rest the coach ordered. `why` says which.
  return (p as Player & { why?: string }).why === 'academic' ? 'ACAD' : 'REST';
}

export function Roster() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openOverlay = useDynasty((st) => st.openOverlay);
  /*
    The captaincy has its own switch, and this door was reading the chart's.

    Found in audit: a coach who handed the depth chart to his staff also lost
    the only permanent route to the captain screen, while one who handed over
    the captaincy still got a live "Name a captain". Two settings, crossed.
  */
  const namesCaptain = useDynasty((st) => handles(st.depth, 'captains'));
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [mode, setMode] = useState<Mode>('all');
  /*
    The filters, both optional and both toggles. Reported from testing: "in
    teams in the roster we need a filter so we can filter players like if i
    want to see players in a position or year." One class, one spot, or both
    at once; tapping the active chip clears it.

    Behind a button, because two labelled selects is a whole row of screen
    standing above the list they filter. Reported: the filters were far too big
    and eating the space the roster pass was trying to win back. The list keeps
    the room and the controls come to it, with the button carrying a mark when a
    filter is on so a filtered roster can never look like a short one.
  */
  const [yearF, setYearF] = useState<string | null>(null);
  const [posF, setPosF] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  void version;

  if (!season || !team) return null;

  const hittersAll = [...team.team.lineup, ...team.team.bench];
  const armsAll = [...team.team.rotation, ...team.team.bullpen];

  const keep = (p: Player): boolean =>
    (yearF === null || p.classYear === yearF)
    && (posF === null || slotOf(p) === posF);

  const hitters = hittersAll.filter(keep);
  const arms = armsAll.filter(keep);
  const everybody: Player[] = uniquePlayers([...hitters, ...arms])
    .sort((a, b) => overallOf(b) - overallOf(a));

  // Only spots somebody actually plays get a chip, in scorebook order.
  const slots = [...new Set([...hittersAll, ...armsAll].map(slotOf))]
    .sort((a, b) => {
      const ai = SLOT_ORDER.indexOf(a); const bi = SLOT_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });

  const filtered = yearF !== null || posF !== null;
  const squad = hittersAll.length + armsAll.length;

  /**
   * A player as a row.
   *
   * The detail line is the four identity columns the old grid carried, read as
   * a sentence. The mark for a man who is not playing rides at the front of it,
   * where it is the first thing read rather than the last column reached.
   */
  const rowFor = (p: Player): Row => {
    const out = outTag(p, season.dayIndex);
    const pot = potentialGrade(p.potential);
    return {
      key: p.id,
      title: p.name,
      mark: captainOf(team.team)?.id === p.id
        ? <CaptainC />
        : (isHurt(p, injuryClock(season))
          ? <span className="hurt-mark" aria-label="injured">✚</span>
          : undefined),
      detail: `${out ? `${out} · ` : ''}${slotOf(p)} · ${p.classYear} · ${overallOf(p)} OVR · ${pot} POT`,
      face: <Avatar id={p.id} team={team.def.abbr} size={34} />,
    };
  };

  const rows: Row[] = mode === 'all'
    ? everybody.map(rowFor)
    : mode === 'bat'
      ? hitters
        .map((p) => ({ p, line: season.batting.get(p.id) }))
        .sort((a, b) => overallOf(b.p) - overallOf(a.p))
        .map(({ p, line }) => ({
          ...rowFor(p),
          // The number the tab is about: what he is hitting, and the power
          // behind it once there is enough of a season to mean anything.
          value: line && line.ab > 0
            ? `${battingAverage(line).toFixed(3).replace(/^0/, '')}${line.hr > 0 ? ` · ${line.hr} HR` : ''}`
            : '—',
        }))
      : arms
        .map((p) => ({ p, line: season.pitching.get(p.id) }))
        .sort((a, b) => overallOf(b.p) - overallOf(a.p))
        .map(({ p, line }) => ({
          ...rowFor(p),
          value: line && line.outs > 0
            ? `${era(line).toFixed(2)} · ${inningsPitched(line).toFixed(1)} IP`
            : '—',
        }));

  return (
    <main className="module-workspace">
      <FirstVisit id="roster" />

      <div className="screen-title-row">
        <ModuleIntro
          kicker={filtered ? `${rows.length} OF ${squad}` : 'ACTIVE ROSTER'}
          title={`${rows.length} ${rows.length === 1 ? 'player' : 'players'}`}
          text="Everyone in the building. Tap a row to meet the man."
        />
      </div>

      <div className="screen-tools">
        <Segmented
          label="Roster group"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'all', label: 'All' },
            { value: 'bat', label: 'Hitters' },
            { value: 'arm', label: 'Pitchers' },
          ]}
        />
        <button
          className="filter-button tap"
          type="button"
          aria-label={filtered ? 'Filter roster, filters on' : 'Filter roster'}
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((v) => !v)}
          style={filtered ? { borderColor: 'var(--clay)', color: 'var(--clay)' } : undefined}
        ><MixerHorizontalIcon /><span>Filter</span></button>
      </div>

      {filterOpen && (
        <section className="recruiting-filter">
          <div className="flow-section-title">
            <span className="label">FILTER THE ROSTER</span>
            {filtered && (
              <button type="button" onClick={() => { setYearF(null); setPosF(null); }}>
                CLEAR
              </button>
            )}
          </div>
          <Segmented
            label="Class year"
            value={yearF ?? 'all'}
            onChange={(v) => setYearF(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'Any year' },
              ...(['FR', 'SO', 'JR', 'SR'] as const).map((y) => ({ value: y, label: y })),
            ]}
          />
          <Segmented
            label="Position"
            value={posF ?? 'all'}
            onChange={(v) => setPosF(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'Any spot' },
              ...slots.map((s) => ({ value: s, label: s })),
            ]}
          />
        </section>
      )}

      <DataTable
        rows={rows}
        onOpen={(id) => openPlayer(id as Parameters<typeof openPlayer>[0])}
        empty="Nobody fits that filter. Whole roster, no such man."
      />

      {/* One door to the chart, not two. The CHART square in the title row is
          the way in; the copy that sat here — "all the way down, right up top
          of the name a captain" — was the same room with a second handle, and
          it was reported as part of why the chart feels confusing at all. */}
      {namesCaptain && (
        <InlineActions
          actions={[{ label: 'Name a captain', onClick: () => openOverlay('captain') }]}
        />
      )}

      <Capacity
        groups={[
          { label: 'HITTERS', used: hittersAll.length, cap: hittersAll.length },
          { label: 'ARMS', used: armsAll.length, cap: armsAll.length },
          { label: 'ROSTER', used: squad, cap: squad },
        ]}
      />
    </main>
  );
}
