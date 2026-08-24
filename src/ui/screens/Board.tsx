// Board.tsx
// Recruiting, over three weeks.
//
// Four views of the same class — everyone available, who you are chasing, who
// you have landed, and the roster the class is meant to fix — because those are
// four different questions and answering them on one list means answering none
// of them well.
//
// Two rules hold the screen together. Ratings are **scouting reports, not
// truth**, so the board is a set of bets rather than a sorted table. And a
// recruit out of your program's reach is refused outright rather than quietly
// discounted, because a button that works and achieves nothing reads as a bug.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import {
  fit, weeklyPoints, canPursue, PRIORITIES, PRIORITY_LABEL, PRIORITY_BLURB,
  SCHOLARSHIPS, MAX_PER_RECRUIT, RECRUITING_WEEKS, budgetFor,
  type Prospect, type Priority,
} from '../../engine/recruiting.js';
import { pitchFor, developmentScore } from '../../engine/pitch.js';
import { overallOf } from '../../engine/ratings.js';
import {
  scoutedOverall, scoutedPotential, scoutedRange, highSchoolLine,
  POTENTIAL_BLURB, type PotentialGrade,
} from '../../engine/scouting.js';
import { CONFERENCES, ALL_STATES } from '../../data/schools.js';
import { prestigeStars } from '../../engine/program.js';
import { Avatar } from '../Avatar.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import type { Hitter, Pitcher, Position } from '../../engine/types.js';

type View = 'recruits' | 'targets' | 'commits' | 'needs' | 'roster';
type Sheet = 'overview' | 'ratings' | 'stats' | 'schools';

/** Grades in order, so a "minimum potential" filter has something to compare. */
const GRADE_RANK: Record<PotentialGrade, number> = {
  '?': 0, D: 1, C: 2, B: 3, A: 4, S: 5, 'S+': 6,
};

/** What the "minimum potential" slider is asking for at each notch. */
const GRADE_STEPS: PotentialGrade[] = ['D', 'C', 'B', 'A', 'S'];

const wantedGrade = (min: number): PotentialGrade =>
  GRADE_STEPS[Math.min(GRADE_STEPS.length - 1, Math.ceil(min / 20) - 1)] as PotentialGrade;

const VIEW_LABEL: Record<View, string> = {
  recruits: 'RECRUITS',
  targets: 'TARGETS',
  commits: 'COMMITS',
  needs: 'NEEDS',
  roster: 'ROSTER',
};

const POSITIONS: readonly (Position | 'SP' | 'RP')[] =
  ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP', 'RP'];

interface Filters {
  pos: string | null;
  minOverall: number;
  minPotential: number;
  state: string | null;
  affordableOnly: boolean;
}

const NO_FILTERS: Filters = {
  pos: null, minOverall: 0, minPotential: 0, state: null, affordableOnly: false,
};

/** How the chase is going, said in words rather than a raw point total. */
function standing(mine: number, best: number, anyone: boolean): { label: string; tone: string } {
  if (!anyone) return { label: 'NOBODY ON HIM', tone: 'var(--dim)' };
  if (mine <= 0) return { label: 'NOT IN IT', tone: 'var(--dim)' };
  if (mine >= best) return { label: 'LEADING', tone: 'var(--win)' };
  const behind = (best - mine) / best;
  if (behind < 0.2) return { label: 'RIGHT THERE', tone: 'var(--win)' };
  if (behind < 0.5) return { label: 'IN THE MIX', tone: 'var(--ink)' };
  return { label: 'WAY BEHIND', tone: 'var(--clay)' };
}

const topPriority = (p: Prospect): Priority =>
  [...PRIORITIES].sort((a, b) => p.priorities[b] - p.priorities[a])[0] as Priority;

const slotOf = (p: Prospect): string =>
  p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

export function Board() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const recruitFor = useDynasty((s) => s.recruit);
  const advanceWeek = useDynasty((s) => s.advanceRecruitingWeek);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();

  const [view, setView] = useState<View>('recruits');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lastWeek = useDynasty((s) => s.lastWeek);

  const pitch = useMemo(() => {
    if (!season || !team) return null;
    const conf = CONFERENCES.find((c) => c.id === team.conference);
    return pitchFor(season, team, conf?.region ?? 'Gulf', developmentScore(team));
  }, [season, team, version]);

  const myStars = team ? prestigeStars(team.prestige) : 1;

  const { list, targets, commits, spent, locked } = useMemo(() => {
    const all = season?.recruiting.prospects ?? [];

    // Anyone this program has ever put money on stays on the target list until
    // he is resolved — signed here or signed somewhere else.
    //
    // Filtering targets by *this week's* spend made a recruit disappear the
    // moment the week turned, so a board you had been working for two weeks came
    // back empty and there was no way to see who you were still in on. A target
    // list you lose track of is not a target list.
    // Once he commits here he is not a target any more, he is a commit — and he
    // has his own tab. Leaving him on both lists made the board read as if there
    // were still work to do on a player who was already signed. A recruit who
    // picked somebody else does stay, marked, because losing one quietly is how
    // you never learn who you were beaten by.
    const mine = all.filter(
      (p) => p.signedBy !== userTeam
        && ((p.spent[userTeam] ?? 0) > 0 || (p.points[userTeam] ?? 0) > 0),
    );
    const used = all.reduce((a, p) => a + (p.spent[userTeam] ?? 0), 0);
    const signed = all.filter((p) => p.signedBy === userTeam);

    const open = all.filter((p) => p.signedBy === null);
    const passes = (p: Prospect): boolean => {
      if (filters.pos && slotOf(p) !== filters.pos) return false;
      if (filters.state && p.state !== filters.state) return false;
      if (filters.affordableOnly && !canPursue(p, myStars)) return false;
      // Filtered on the *reported* numbers, because those are the only ones a
      // coach has. Filtering on truth would leak the ratings the screen is
      // deliberately hiding.
      if (scoutedOverall(p.player, p.stars) < filters.minOverall) return false;
      // Potential is a grade, not a number — a minimum is a minimum grade.
      if (filters.minPotential > 0) {
        const rank = GRADE_RANK[scoutedPotential(p.player, p.stars)];
        if (rank < GRADE_RANK[wantedGrade(filters.minPotential)]) return false;
      }
      return true;
    };

    const shown = open.filter(passes);
    const reachable = shown.filter((p) => canPursue(p, myStars));
    const ranked = pitch
      ? [...reachable].sort((a, b) => (b.stars * fit(b, pitch)) - (a.stars * fit(a, pitch)))
      : reachable;

    return {
      list: ranked.slice(0, 50),
      targets: mine.slice().sort((a, b) => {
        // Unresolved first — those are the ones still worth a decision.
        const live = Number(a.signedBy !== null) - Number(b.signedBy !== null);
        return live || (b.points[userTeam] ?? 0) - (a.points[userTeam] ?? 0);
      }),
      commits: signed.sort((a, b) => b.stars - a.stars),
      spent: used,
      locked: shown.filter((p) => !canPursue(p, myStars))
        .sort((a, b) => b.stars - a.stars).slice(0, 5),
    };
  }, [season, userTeam, version, pitch, myStars, filters]);

  if (!season || !team || !pitch) return null;

  const week = season.recruiting.week;

  // The brief, straight off the draft that just ran.
  const holes = useDynasty.getState().lastOffseason?.holes ?? [];
  const needNote = holes.length === 0 ? null
    : `You are short ${holes.map((h) => (h.count > 1 ? `${h.count} ${h.pos}` : h.pos)).join(', ')}. `
      + 'Anything you do not sign gets filled by a walk-on.';
  const open = season.recruiting.prospects.find((p) => p.id === openId) ?? null;
  const left = budgetFor(myStars) - spent;
  const live = week >= 1 && week <= RECRUITING_WEEKS;
  const full = commits.length >= SCHOLARSHIPS;
  const activeFilters = filters.pos !== null || filters.state !== null
    || filters.minOverall > 0 || filters.minPotential > 0 || filters.affordableOnly;

  return (
    /*
      The title, the budget and the four tabs stay put; the list scrolls under
      them.

      Reported from testing: "the list of players should be what actually
      scrolls, not the whole page". On a phone the old layout put the tab you
      were on, the money you had left and the scholarships you had used off the
      top of the screen the moment you started reading — which is exactly when
      you need them, because every one of them is a constraint on the decision
      you are scrolling to make.
    */
    <FixedHeader header={
      <div style={{ padding: '12px 14px 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        borderBottom: '2px solid var(--ink)', paddingBottom: 6,
      }}>
        <div>
          <div className="label">
            RECRUITING · {live ? `WEEK ${week} OF ${RECRUITING_WEEKS}` : 'SIGNED'}
          </div>
          <div style={{
            font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
          }}>The board</div>
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          style={{
            padding: '7px 10px',
            background: activeFilters ? 'var(--clay)' : 'var(--paper)',
            border: `1px solid ${activeFilters ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
            color: activeFilters ? 'var(--cream)' : 'var(--ink)',
            font: "700 9px var(--mono)", letterSpacing: '.1em',
          }}
        >FILTER{activeFilters ? ' ON' : ''}</button>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="SCHOLARSHIPS" v={`${commits.length}/${SCHOLARSHIPS}`} accent={full} />
        <Tile k="BUDGET" v={live ? String(left) : '—'} accent={live && left === 0} />
        <Tile k="PRESTIGE" v={'★'.repeat(myStars) + '☆'.repeat(5 - myStars)} last />
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
        {(['recruits', 'targets', 'commits', 'needs', 'roster'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px 0',
              background: v === view ? 'var(--clay)' : 'var(--paper)',
              border: v === view ? '1px solid var(--clay)' : '1px solid rgba(28,36,48,.28)',
              color: v === view ? 'var(--cream)' : 'var(--ink)',
              font: "700 8.5px var(--mono)", letterSpacing: '.08em',
            }}
          >
            {VIEW_LABEL[v]}
            {v === 'targets' && targets.length > 0 ? ` ${targets.length}` : ''}
            {v === 'commits' && commits.length > 0 ? ` ${commits.length}` : ''}
            {v === 'needs' && holes.length > 0 ? ` ${holes.length}` : ''}
          </button>
        ))}
      </div>
      </div>
    }>
    <div style={{ padding: '10px 14px 20px' }}>
      {filtersOpen && (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(NO_FILTERS)}
        />
      )}

      {live && lastWeek && (
        <div style={{
          marginBottom: 10, border: '1px solid var(--clay)',
          background: 'rgba(168,68,42,.10)',
        }}>
          <div style={{ padding: '5px 10px', background: 'var(--clay)' }}>
            <span style={{
              font: "700 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>WEEK {lastWeek.closed} IS OVER</span>
          </div>
          <div style={{ padding: '10px 11px', font: "400 12px/1.5 var(--body)" }}>
            {lastWeek.yours.length > 0 ? (
              <div style={{ marginBottom: 6 }}>
                <strong>Committed to you:</strong> {lastWeek.yours.join(', ')}.
              </div>
            ) : (
              <div style={{ marginBottom: 6, color: 'var(--dim)' }}>
                Nobody committed to you this week.
              </div>
            )}
            <div style={{ color: 'var(--dim)' }}>
              {lastWeek.gone === 0
                ? `Nobody came off the board anywhere. Your budget is back to ${budgetFor(myStars)}.`
                : `${lastWeek.gone} recruit${lastWeek.gone === 1 ? '' : 's'} signed elsewhere and ${lastWeek.gone === 1 ? 'is' : 'are'} off the board. Your budget is back to ${budgetFor(myStars)}.`}
            </div>
          </div>
        </div>
      )}

      {live && (
        <div style={{
          marginBottom: 10, font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          {budgetFor(myStars)} a week, spread how you like. Points carry over and
          the most points signs him &mdash; so staying with somebody works, and
          recruits come off the board every week you spend deciding. The best in
          the country want more attention than one week can buy.
        </div>
      )}

      {view === 'needs' ? (
        <NeedsView holes={holes} filled={commits} onPick={(pos) => {
          setFilters({ ...NO_FILTERS, pos });
          setView('recruits');
        }} />
      ) : view === 'roster' ? (
        <RosterView />
      ) : (
        <>
          <div style={{
            marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            {(view === 'recruits' ? list : view === 'targets' ? targets : commits).length === 0 && (
              <div style={{
                padding: '18px 12px', font: "400 12px var(--body)", color: 'var(--dim)',
                textAlign: 'center',
              }}>
                {view === 'targets' ? 'Nobody on your board yet.'
                  : view === 'commits' ? 'No commitments yet.'
                  : activeFilters ? 'Nobody matches those filters.' : 'Nobody available.'}
              </div>
            )}
            {(view === 'recruits' ? list : view === 'targets' ? targets : commits).map((p) => (
              <Row
                key={p.id}
                p={p}
                userTeam={userTeam}
                onOpen={() => setOpenId(p.id)}
                signed={view === 'commits'}
              />
            ))}
          </div>

          {view === 'recruits' && locked.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
                OUT OF REACH
              </div>
              <div style={{
                border: '1px solid var(--faint)', background: 'var(--paper)', opacity: 0.72,
              }}>
                {locked.map((p) => (
                  <Row key={p.id} p={p} userTeam={userTeam} onOpen={() => setOpenId(p.id)} />
                ))}
              </div>
              <div style={{
                marginTop: 6, font: "400 11px/1.45 var(--body)", color: 'var(--dim)',
              }}>
                These will not take your call yet. Build the program up and
                players like them start listening.
              </div>
            </>
          )}
        </>
      )}

      {open && (
        <ProspectSheet
          prospect={open}
          userTeam={userTeam}
          coachPrestige={coach.prestige}
          recruitingSkill={coach.skills.recruiting}
          pitch={pitch}
          reachable={canPursue(open, myStars)}
          live={live}
          full={full && open.signedBy === null}
          left={left}
          onSet={(n) => recruitFor(open.id, n)}
          onClose={() => setOpenId(null)}
        />
      )}

      {live && (
        <FloatingAction
          label={week >= RECRUITING_WEEKS ? 'SIGNING DAY' : `END WEEK ${week}`}
          onClick={() => {
            if (week >= RECRUITING_WEEKS) { advanceWeek(); void nextPhase(); }
            else advanceWeek();
          }}
        />
      )}
    </div>
    </FixedHeader>
  );
}

function Row({
  p, userTeam, onOpen, signed,
}: { p: Prospect; userTeam: number; onOpen: () => void; signed?: boolean }) {
  const spent = p.spent[userTeam] ?? 0;
  const points = Object.values(p.points);
  const best = points.length ? Math.max(...points) : 0;
  const s = signed || p.signedBy === userTeam
    ? { label: 'SIGNED', tone: 'var(--win)' }
    : p.signedBy !== null
      ? { label: 'LOST HIM', tone: 'var(--clay)' }
      : standing(p.points[userTeam] ?? 0, best, points.length > 0);

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
        gap: 9, alignItems: 'center',
        padding: '10px 11px', borderBottom: '1px solid var(--hairline)',
        background: spent > 0 && !signed ? 'rgba(168,68,42,.10)' : 'transparent',
      }}
    >
      <Avatar id={p.id} size={34} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: `${spent > 0 ? 700 : 400} 13px var(--body)`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{p.player.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 10px var(--mono)", color: 'var(--dim)',
        }}>
          #{p.rank} · {slotOf(p)} · {p.state} · {PRIORITY_LABEL[topPriority(p)]}
        </span>
      </span>
      <span style={{
        font: "700 8.5px var(--mono)", letterSpacing: '.08em', color: s.tone,
        whiteSpace: 'nowrap', textAlign: 'right',
      }}>
        {s.label}
        {spent > 0 && !signed && (
          <span style={{ display: 'block', color: 'var(--clay)' }}>{spent} spent</span>
        )}
      </span>
      <span style={{
        font: "600 11px var(--mono)", color: 'var(--clay)', whiteSpace: 'nowrap',
      }}>{'★'.repeat(p.stars)}</span>
    </button>
  );
}

function FilterPanel({
  filters, onChange, onClear,
}: { filters: Filters; onChange: (f: Filters) => void; onClear: () => void }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div style={{
      marginTop: 10, padding: '11px 12px',
      border: '1px solid var(--clay)', background: 'var(--paper)',
    }}>
      <div className="label" style={{ marginBottom: 5 }}>POSITION</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {POSITIONS.map((pos) => (
          <Chip
            key={pos}
            on={filters.pos === pos}
            onClick={() => set('pos', filters.pos === pos ? null : pos)}
          >{pos}</Chip>
        ))}
      </div>

      <div className="label" style={{ marginTop: 11, marginBottom: 5 }}>HOME STATE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ALL_STATES.map((st) => (
          <Chip
            key={st}
            on={filters.state === st}
            onClick={() => set('state', filters.state === st ? null : st)}
          >{st}</Chip>
        ))}
      </div>

      <Slider
        label="MIN OVERALL"
        value={filters.minOverall}
        onChange={(n) => set('minOverall', n)}
      />
      <Slider
        label={filters.minPotential > 0
          ? `MIN POTENTIAL · ${wantedGrade(filters.minPotential)} OR BETTER`
          : 'MIN POTENTIAL'}
        value={filters.minPotential}
        onChange={(n) => set('minPotential', n)}
      />

      <button
        onClick={() => set('affordableOnly', !filters.affordableOnly)}
        style={{
          marginTop: 10, width: '100%', padding: '9px 0',
          background: filters.affordableOnly ? 'var(--clay)' : 'var(--field)',
          border: `1px solid ${filters.affordableOnly ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
          color: filters.affordableOnly ? 'var(--cream)' : 'var(--ink)',
          font: "700 9.5px var(--mono)", letterSpacing: '.1em',
        }}
      >WITHIN MY REACH ONLY</button>

      <button
        onClick={onClear}
        style={{
          marginTop: 6, width: '100%', padding: '8px 0', background: 'transparent',
          border: '1px solid rgba(28,36,48,.2)',
          font: "600 9px var(--mono)", letterSpacing: '.1em', color: 'var(--dim)',
        }}
      >CLEAR</button>
    </div>
  );
}

function Chip({ on, onClick, children }: {
  on: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 8px',
        background: on ? 'var(--clay)' : 'var(--field)',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.2)'}`,
        color: on ? 'var(--cream)' : 'var(--ink)',
        font: "700 9px var(--mono)", letterSpacing: '.06em',
      }}
    >{children}</button>
  );
}

function Slider({ label, value, onChange }: {
  label: string; value: number; onChange: (n: number) => void;
}) {
  return (
    <div style={{ marginTop: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="label">{label}</span>
        <span style={{ font: "700 11px var(--mono)", color: 'var(--clay)' }}>
          {value > 0 ? value : 'ANY'}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={80}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', marginTop: 4, accentColor: 'var(--clay)' }}
      />
    </div>
  );
}

/** The roster the class is meant to fix. */
/**
 * What the draft took, as a list you can act on.
 *
 * This was a sentence under the header — "you are short 1B, 2B, 4 BENCH" — which
 * said the right thing in the place you stop reading. As its own tab it is a
 * checklist: every hole, whether the class has covered it yet, and a tap that
 * filters the board down to players who play there.
 */
function NeedsView(
  { holes, filled, onPick }:
  {
    holes: { pos: string; count: number }[];
    filled: Prospect[];
    onPick: (pos: string) => void;
  },
) {
  if (holes.length === 0) {
    return (
      <div style={{
        marginTop: 10, padding: '18px 12px', border: '1px solid var(--faint)',
        background: 'var(--paper)', font: "400 12px/1.55 var(--body)", color: 'var(--dim)',
        textAlign: 'center',
      }}>
        Nobody left. Every spot the draft opened up is covered.
      </div>
    );
  }

  const signedAt = (pos: string): number =>
    filled.filter((p) => slotOf(p) === pos).length;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        marginBottom: 10, padding: '9px 11px', background: 'var(--paper)',
        borderLeft: '3px solid var(--clay)',
        font: "400 11.5px/1.5 var(--body)", color: 'var(--ink)',
      }}>
        The draft and graduation left these open. Anything you do not sign gets
        filled by a walk-on — thirteen points below your program's own level.
      </div>

      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {holes.map((h) => {
          const got = h.pos === 'BENCH' ? 0 : signedAt(h.pos);
          const done = got >= h.count;
          return (
            <button
              key={h.pos}
              onClick={() => h.pos !== 'BENCH' && onPick(h.pos)}
              disabled={h.pos === 'BENCH'}
              className="tap"
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '52px 1fr auto',
                gap: 10, alignItems: 'center',
                padding: '11px 11px', borderBottom: '1px solid var(--hairline)',
                background: 'transparent',
              }}
            >
              <span style={{
                font: "700 13px var(--mono)", letterSpacing: '.06em',
                color: done ? 'var(--win)' : 'var(--clay)',
              }}>{h.pos}</span>
              <span style={{ font: "400 11.5px/1.4 var(--body)", color: 'var(--dim)' }}>
                {h.count > 1 ? `${h.count} to replace` : 'one to replace'}
                {h.pos !== 'BENCH' && ` · ${got} signed`}
              </span>
              <span style={{
                font: "700 8px var(--mono)", letterSpacing: '.1em',
                color: done ? 'var(--win)' : 'var(--dim)',
              }}>{done ? 'COVERED' : h.pos === 'BENCH' ? 'DEPTH' : 'SHOW ME →'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RosterView() {
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  if (!team) return null;

  const groups: [string, (Hitter | Pitcher)[]][] = [
    ['LINEUP', team.team.lineup],
    ['BENCH', team.team.bench],
    ['ROTATION', team.team.rotation],
    ['BULLPEN', team.team.bullpen],
  ];

  return (
    <div style={{ marginTop: 10 }}>
      {groups.map(([label, players]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 5 }}>{label}</div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => openPlayer(p.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                  gap: 9, alignItems: 'center', background: 'transparent',
                  padding: '8px 11px', borderBottom: '1px solid var(--hairline)',
                }}
              >
                <Avatar id={p.id} size={28} />
                <span style={{
                  font: "400 12.5px var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</span>
                <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>
                  {p.type === 'pitcher' ? (p as Pitcher).role : p.pos} · {p.classYear}
                </span>
                <span style={{ font: "600 12px var(--mono)" }}>{overallOf(p)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProspectSheet({
  prospect, userTeam, coachPrestige, recruitingSkill, pitch, reachable, live, full, left,
  onSet, onClose,
}: {
  prospect: Prospect; userTeam: number; coachPrestige: number; recruitingSkill: number;
  pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; live: boolean; full: boolean; left: number;
  onSet: (n: number) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Sheet>('overview');
  const p = prospect.player;
  const spent = prospect.spent[userTeam] ?? 0;
  const points = Object.values(prospect.points);
  const best = points.length ? Math.max(...points) : 0;
  const s = standing(prospect.points[userTeam] ?? 0, best, points.length > 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(28,36,48,.55)',
        display: 'flex', alignItems: 'flex-end', zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          /*
            A fixed height, not a maximum.
            
            The four tabs hold very different amounts — two priorities against
            six rating bands against a list of eight rival schools — so a sheet
            sized to its contents jumped every time you switched, which is the
            same "the app keeps changing shape" problem the manage screen had.
            The sheet is a fixed panel now and the body scrolls inside it, so
            switching tabs moves nothing but the text.
          */
          width: '100%', height: '72%',
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderTop: '3px solid var(--clay)',
        }}
      >
        <div style={{
          flex: 'none', padding: '7px 12px', background: 'var(--clay)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>{'★'.repeat(prospect.stars)} · {prospect.state}</span>
          <button onClick={onClose} style={{
            font: "600 9px var(--mono)", letterSpacing: '.14em', color: 'rgba(246,241,230,.8)',
          }}>CLOSE</button>
        </div>

        <div style={{
          flex: 'none', padding: '13px 12px 6px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Avatar id={p.id} size={54} />
          <div style={{ minWidth: 0 }}>
          <div style={{ font: "800 22px/1 var(--display)", textTransform: 'uppercase' }}>
            {p.name}
          </div>
          <div style={{ marginTop: 3, font: "400 11px var(--mono)", color: 'var(--dim)' }}>
            {slotOf(prospect)} &middot; bats {p.bats} &middot; throws {p.throws}
            {' '}&middot; <span style={{ color: s.tone }}>{s.label}</span>
          </div>
          </div>
        </div>

        <div style={{ flex: 'none', display: 'flex', gap: 4, padding: '0 12px' }}>
          {(['overview', 'ratings', 'stats', 'schools'] as Sheet[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0',
                background: t === tab ? 'var(--ink)' : 'var(--field)',
                border: 'none',
                color: t === tab ? 'var(--cream)' : 'var(--dim)',
                font: "700 8.5px var(--mono)", letterSpacing: '.08em',
              }}
            >{t === 'stats' ? 'HIGH SCHOOL' : t.toUpperCase()}</button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
          {tab === 'overview' && (
            <Overview
              prospect={prospect} pitch={pitch} reachable={reachable} live={live}
              full={full} spent={spent} left={left} coachPrestige={coachPrestige}
              recruitingSkill={recruitingSkill}
              onSet={onSet}
            />
          )}
          {tab === 'ratings' && <Ratings prospect={prospect} />}
          {tab === 'stats' && <Stats prospect={prospect} />}
          {tab === 'schools' && <Schools prospect={prospect} userTeam={userTeam} />}
        </div>
      </div>
    </div>
  );
}

function Overview({
  prospect, pitch, reachable, live, full, spent, left, coachPrestige, recruitingSkill, onSet,
}: {
  prospect: Prospect; pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; live: boolean; full: boolean;
  spent: number; left: number; coachPrestige: number; recruitingSkill: number;
  onSet: (n: number) => void;
}) {
  const wants = [...PRIORITIES].sort(
    (a, b) => prospect.priorities[b] - prospect.priorities[a],
  ).slice(0, 2);
  // The same call the week close will make, skill included, or the preview
  // undersells what the spend is actually worth.
  const gain = weeklyPoints(prospect, pitch, Math.max(spent, 1), coachPrestige, recruitingSkill);
  const steps = [0, 2, 4, 6, 8, 10, 12].filter((n) => n <= MAX_PER_RECRUIT);

  return (
    <>
      <div className="label">WHAT HE WANTS</div>
      <div style={{ marginTop: 5 }}>
        {wants.map((k) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '6px 0', borderBottom: '1px solid var(--hairline)',
          }}>
            <span style={{ font: "600 11px var(--mono)", letterSpacing: '.06em' }}>
              {PRIORITY_LABEL[k]}
            </span>
            <span style={{ font: "400 11px var(--body)", color: 'var(--dim)' }}>
              {PRIORITY_BLURB[k]}
            </span>
          </div>
        ))}
      </div>

      {!reachable && (
        <div style={{
          marginTop: 12, padding: '11px 12px', background: 'var(--field)',
          borderLeft: '3px solid var(--clay)',
          font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          <strong style={{ color: 'var(--ink)' }}>He will not take the call.</strong>
          {' '}A program of his calibre is not on his list at your level. Build the
          program up and players like him start listening.
        </div>
      )}

      {reachable && full && (
        <div style={{
          marginTop: 12, padding: '11px 12px', background: 'var(--field)',
          borderLeft: '3px solid var(--clay)',
          font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          <strong style={{ color: 'var(--ink)' }}>Your class is full.</strong>
          {' '}Every scholarship is spoken for.
        </div>
      )}

      {reachable && live && !full && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="label">YOUR OFFER</span>
            <span style={{ font: "700 11px var(--mono)", color: 'var(--clay)' }}>
              +{Math.round(gain)} pts a week
            </span>
          </div>

          {/*
            A slider rather than a row of steps. The budget is a continuous
            quantity and reads as one — dragging shows the cost against the
            remaining pool as it moves, where discrete buttons make you compute
            the difference yourself.
          */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
          }}>
            <span style={{
              font: "800 26px/1 var(--display)", color: spent > 0 ? 'var(--clay)' : 'var(--dim)',
              minWidth: 34, textAlign: 'right',
            }}>{spent}</span>
            {/*
              A step down and a step up either side of it.

              Reported from testing: "the bar works fine to add points but to
              remove points it's a hassle, doesn't work most of the times". On a
              phone a drag that starts on a thin track is ambiguous — the
              scroller can claim it — and dragging *left* to a smaller number is
              the fiddliest version of that. `touchAction: none` gives the
              gesture to the slider, and the buttons mean you never have to make
              it at all.
            */}
            <Step label="−" onClick={() => onSet(Math.max(0, spent - 1))} disabled={spent === 0} />
            {/*
              Pips, not a track.

              A range input on a phone is a drag that has to beat the scroller
              for the gesture, and dragging *down* to a smaller number is the
              worst case of it — "the bar works fine to add points but to remove
              them it doesn't work most of the times". Twelve tap targets in a
              row have no gesture to lose: tap the sixth pip and the offer is
              six. The steppers either side stay for one-at-a-time nudging.
            */}
            <div style={{ flex: 1, display: 'flex', gap: 3 }}>
              {Array.from({ length: MAX_PER_RECRUIT }, (_, i) => {
                const n = i + 1;
                const reachable = n <= Math.min(MAX_PER_RECRUIT, spent + left);
                const on = n <= spent;
                return (
                  <button
                    key={n}
                    onClick={() => onSet(reachable ? (spent === n ? n - 1 : n) : spent)}
                    disabled={!reachable}
                    className="tap"
                    style={{
                      flex: 1, height: 26, padding: 0,
                      background: on ? 'var(--clay)'
                        : reachable ? 'rgba(28,36,48,.10)' : 'rgba(28,36,48,.04)',
                      border: 'none',
                    }}
                    aria-label={`Offer ${n}`}
                  />
                );
              })}
            </div>
            <Step
              label="+"
              onClick={() => onSet(Math.min(Math.min(MAX_PER_RECRUIT, spent + left), spent + 1))}
              disabled={spent >= Math.min(MAX_PER_RECRUIT, spent + left)}
            />
            <button
              onClick={() => onSet(0)}
              disabled={spent === 0}
              style={{
                flex: 'none', padding: '6px 9px', background: 'transparent',
                border: '1px solid rgba(28,36,48,.22)',
                color: spent > 0 ? 'var(--dim)' : 'rgba(28,36,48,.2)',
                font: "700 8.5px var(--mono)", letterSpacing: '.08em',
              }}
            >OFF</button>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 8, font: "400 10.5px var(--mono)", color: 'var(--dim)',
          }}>
            <span>Budget: <strong style={{ color: 'var(--ink)' }}>{left}</strong> left</span>
            <span>Min. prestige: {'★'.repeat(prospect.minProgram)}</span>
          </div>
        </div>
      )}
    </>
  );
}

/** One notch on the offer, with a target big enough to hit with a thumb. */
function Step(
  { label, onClick, disabled }:
  { label: string; onClick: () => void; disabled: boolean },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 'none', width: 38, height: 38,
        background: disabled ? 'transparent' : 'var(--field)',
        border: `1px solid ${disabled ? 'rgba(28,36,48,.14)' : 'rgba(28,36,48,.34)'}`,
        color: disabled ? 'rgba(28,36,48,.22)' : 'var(--ink)',
        font: "700 18px var(--mono)", lineHeight: 1,
      }}
    >{label}</button>
  );
}

/** Estimates, with the uncertainty shown rather than hidden behind a number. */
function Ratings({ prospect }: { prospect: Prospect }) {
  const p = prospect.player;
  const rows: [string, number][] = p.type === 'pitcher'
    ? [['K/9', (p as Pitcher).stuff], ['H/9', (p as Pitcher).movement],
       ['BB/9', (p as Pitcher).control], ['STAMINA', (p as Pitcher).stamina]]
    : [['CONTACT', (p as Hitter).contact], ['POWER', (p as Hitter).power],
       ['DISCIPLINE', (p as Hitter).eye], ['SPEED', (p as Hitter).speed],
       ['REACTION', (p as Hitter).range], ['ARM STRENGTH', (p as Hitter).arm]];

  return (
    <>
      <div style={{ display: 'flex', marginBottom: 10 }}>
        <Stat k="OVERALL" v={String(scoutedOverall(p, prospect.stars))} />
        <Stat k="POTENTIAL" v={scoutedPotential(p, prospect.stars)} last />
      </div>

      <div style={{
        marginBottom: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>{POTENTIAL_BLURB[scoutedPotential(p, prospect.stars)]}</div>

      {rows.map(([label, value], i) => {
        const { low, high } = scoutedRange(p.id, prospect.stars, value, i + 20);
        return (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: '1px solid var(--hairline)',
          }}>
            <span style={{ font: "600 10px var(--mono)", letterSpacing: '.08em' }}>{label}</span>
            <span style={{ font: "600 12px var(--mono)", color: 'var(--dim)' }}>
              {low}&ndash;{high}
            </span>
          </div>
        );
      })}

      <div style={{
        marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        Scouting reports, not measurements. The lower a recruit is rated, the less
        anybody has watched him &mdash; and the wider these get.
      </div>
    </>
  );
}

function Stats({ prospect }: { prospect: Prospect }) {
  const line = highSchoolLine(prospect.player);
  return (
    <>
      <div className="label" style={{ marginBottom: 6 }}>LAST SPRING</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {line.map((row) => (
          <div key={row.label} style={{
            width: '33.33%', padding: '8px 0',
            borderBottom: '1px solid var(--hairline)',
          }}>
            <div className="label">{row.label}</div>
            <div style={{ font: "700 16px/1 var(--display)", marginTop: 3 }}>{row.value}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        High school numbers, against high school pitching. Everybody's look
        absurd; what matters is whose look absurd for the right reasons.
      </div>
    </>
  );
}

function Schools({ prospect, userTeam }: { prospect: Prospect; userTeam: number }) {
  const season = useDynasty((s) => s.season);
  const rivals = Object.entries(prospect.points)
    .map(([team, pts]) => ({ team: Number(team), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  if (!season) return null;
  const best = rivals[0]?.pts ?? 1;

  return (
    <>
      <div className="label" style={{ marginBottom: 6 }}>WHO ELSE IS IN</div>
      {rivals.length === 0 && (
        <div style={{ font: "400 12px/1.55 var(--body)", color: 'var(--dim)' }}>
          Nobody has been to see him. That is an opportunity or a warning, and the
          only way to find out is to spend on him.
        </div>
      )}
      {rivals.map((r) => {
        const t = season.teams[r.team];
        const mine = r.team === userTeam;
        return (
          <div key={r.team} style={{ padding: '7px 0' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{
                font: `${mine ? 700 : 400} 12.5px var(--body)`,
                color: mine ? 'var(--clay)' : 'var(--ink)',
              }}>{t?.def.school ?? '?'}{mine ? ' (you)' : ''}</span>
              <span style={{ font: "600 10px var(--mono)", color: 'var(--dim)' }}>
                {Math.round(r.pts)}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(28,36,48,.09)', marginTop: 3 }}>
              <div style={{
                width: `${(r.pts / best) * 100}%`, height: '100%',
                background: mine ? 'var(--clay)' : 'rgba(28,36,48,.35)',
              }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 17px/1 var(--display)", marginTop: 3,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, paddingRight: 10,
      borderRight: last ? 'none' : '1px solid var(--hairline)',
      paddingLeft: last ? 10 : 0,
    }}>
      <div className="label">{k}</div>
      <div style={{ font: "700 20px/1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
