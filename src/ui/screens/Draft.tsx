// Draft.tsx
// Who left, and where they went.
//
// The roadmap's central tension, reported rather than predicted: you never keep
// your best players. Seniors go whatever happens and the draft takes the juniors
// who are good enough, so the better you develop somebody the sooner he is gone.
//
// Four views because the draft is a national event with a local consequence.
// Rounds one and two are the country's story; undrafted and departing are yours.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { draftChance } from '../../engine/progression.js';
import type { Departure } from '../../engine/progression.js';
import { overallOf } from '../../engine/ratings.js';
import type { Player } from '../../engine/types.js';
import { Avatar } from '../Avatar.js';

type View = 'round1' | 'round2' | 'undrafted' | 'departing';

const VIEW_LABEL: Record<View, string> = {
  round1: 'ROUND 1',
  round2: 'ROUND 2',
  undrafted: 'UNDRAFTED',
  departing: 'DEPARTING',
};

export function Draft() {
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const report = useDynasty((s) => s.lastOffseason);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const walkOns = report?.walkOns ?? [];
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  const [view, setView] = useState<View>('departing');

  const { round1, round2, undrafted, departing, mineDrafted } = useMemo(() => {
    const drafted = report?.drafted ?? [];
    const graduated = report?.graduated ?? [];
    const abbr = team?.def.abbr;
    return {
      round1: drafted.filter((d) => d.round === 1),
      round2: drafted.filter((d) => d.round === 2),
      // Seniors whose names were never called. Their careers are over.
      //
      // Walk-ons ride in the same list because the report has two arrays and
      // they belong in the one that is not the draft, but they are not this:
      // nobody's career ended, a one year lease simply ran out. Filtered here
      // rather than split upstream so the departing view still counts them as
      // men you lost, which is what they are.
      undrafted: graduated.filter((d) => d.reason === 'graduated')
        .sort((a, b) => b.overall - a.overall).slice(0, 40),
      departing: [...drafted, ...graduated]
        .filter((d) => d.teamAbbr === abbr)
        .sort((a, b) => b.overall - a.overall),
      mineDrafted: drafted.filter((d) => d.teamAbbr === abbr).length,
    };
  }, [report, team]);

  if (!team) return null;

  // Before the offseason has run there is nothing to report, so the screen falls
  // back to the odds — which is what it is for outside the sequence.
  if (!report) return <DraftOdds team={team} year={year} />;

  const holes = report.holes ?? [];
  const rows = view === 'round1' ? round1
    : view === 'round2' ? round2
    : view === 'undrafted' ? undrafted
    : departing;

  return (
    // Title, totals and the four views stay put; the list of names scrolls
    // under them. Same reason as the recruiting board: what you are looking at
    // and how many there are should not scroll away from the list itself.
    <FixedHeader header={
      <div style={{ padding: '14px 14px 10px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
        <div className="label">{year} · {team.def.abbr}</div>
        <div style={{
          font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>Draft results</div>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="YOU LOST" v={String(departing.length)} />
        <Tile k="DRAFTED" v={String(mineDrafted)} accent={mineDrafted > 0} />
        <Tile k="LEAGUE WIDE" v={String((report.drafted ?? []).length)} last />
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
        {(['round1', 'round2', 'undrafted', 'departing'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px 0',
              background: v === view ? 'var(--clay)' : 'var(--paper)',
              border: v === view ? '1px solid var(--clay)' : '1px solid rgba(28,36,48,.28)',
              color: v === view ? 'var(--cream)' : 'var(--ink)',
              font: "700 8px var(--mono)", letterSpacing: '.06em',
            }}
          >{VIEW_LABEL[v]}</button>
        ))}
      </div>
      </div>
    }>
    <div style={{ padding: '10px 14px 22px' }}>
      {/*
        The holes, first, above the names.

        This is the whole reason the draft now runs before recruiting: a list of
        who left is a eulogy, and a list of what you are short of is a shopping
        list. The recruiting board opens next and repeats it, so the two screens
        are about the same thing.
      */}
      {holes.length > 0 && (
        <>
          <div className="label" style={{ marginBottom: 7 }}>THE HOLES THIS LEAVES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {holes.map((h, i) => (
              <div
                key={h.pos}
                className="card-in"
                style={{
                  padding: '7px 10px',
                  border: '1px solid var(--clay)',
                  background: 'rgba(168,68,42,.08)',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <div style={{
                  font: "700 11px var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
                }}>{h.pos}</div>
                <div style={{
                  marginTop: 2, font: "400 8.5px var(--mono)", color: 'var(--dim)',
                }}>{h.count > 1 ? `${h.count} needed` : 'need one'}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {rows.length === 0 && (
          <div style={{
            padding: '18px 12px', font: "400 12px/1.55 var(--body)", color: 'var(--dim)',
            textAlign: 'center',
          }}>
            {view === 'departing'
              ? 'Nobody left. A whole roster returns, which almost never happens.'
              : 'Nobody here.'}
          </div>
        )}
        {rows.map((d, i) => (
          <DepartureRow
            key={d.id}
            d={d}
            pick={view === 'round1' || view === 'round2' ? i + 1 : undefined}
            mine={d.teamAbbr === team.def.abbr}
          />
        ))}
      </div>

      {view === 'undrafted' && (
        <div style={{
          marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          Nobody called their name. For a senior that is the end of it — four
          years, and then the game stops.
        </div>
      )}

      {/*
        Who filled the holes the class did not.

        A scholarship you never spent does not leave the spot empty; somebody
        walks on and plays there, and he is a long way below the players you
        were bidding on. Showing them is the honest accounting of a class that
        came up short.
      */}
      {walkOns.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
            WALK-ONS · {walkOns.length}
          </div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {walkOns.map((w) => (
              <button
                key={w.id}
                onClick={() => openPlayer(w.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                  gap: 10, alignItems: 'center', background: 'transparent',
                  padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
                }}
              >
                <span style={{ font: "400 13px var(--body)" }}>{w.name}</span>
                <span style={{
                  font: "400 10px var(--mono)", color: 'var(--dim)',
                }}>{w.pos} · FR</span>
                <span style={{ font: "600 13px var(--mono)" }}>{w.overall}</span>
              </button>
            ))}
          </div>
          <div style={{
            marginTop: 6, font: "400 11px/1.45 var(--body)", color: 'var(--dim)',
          }}>
            Nobody recruited them. Every scholarship you leave unspent is one of
            these instead &mdash; and each one is here for a season and then gone,
            so the hole comes straight back.
          </div>
        </>
      )}

      {phase !== null && (
        <FloatingAction label="TO RECRUITING" onClick={() => void nextPhase()} />
      )}
    </div>
    </FixedHeader>
  );
}

/** What the row says he did, and what colour it says it in. */
const EXIT: Record<Departure['reason'], { word: string; tag: string; tone: string }> = {
  drafted: { word: 'drafted', tag: 'RD', tone: 'var(--win)' },
  graduated: { word: 'graduated', tag: 'CAREER OVER', tone: 'var(--dim)' },
  // Not an ending. Nobody recruited him, so nothing held him for a second year.
  'walk-on': { word: 'walk-on', tag: 'YEAR UP', tone: 'var(--dim)' },
};

function DepartureRow({ d, pick, mine }: { d: Departure; pick?: number; mine: boolean }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const exit = EXIT[d.reason] ?? EXIT.graduated;
  return (
    <button
      onClick={() => openPlayer(d.id)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid',
        gridTemplateColumns: pick ? 'auto auto 1fr auto auto' : 'auto 1fr auto auto',
        gap: 9, alignItems: 'center',
        padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
        background: mine ? 'rgba(168,68,42,.10)' : 'transparent',
      }}
    >
      {pick !== undefined && (
        <span style={{
          font: "600 11px var(--mono)", color: 'var(--dim)', minWidth: 20, textAlign: 'right',
        }}>{pick}</span>
      )}
      <Avatar id={d.id} team={d.teamAbbr} size={30} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: `${mine ? 700 : 400} 13px var(--body)`,
          color: mine ? 'var(--clay)' : 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{d.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 10px var(--mono)", color: 'var(--dim)',
        }}>
          {d.teamAbbr} · {d.classYear} · {exit.word}
        </span>
      </span>
      <span style={{
        font: "700 8px var(--mono)", letterSpacing: '.08em',
        color: exit.tone, whiteSpace: 'nowrap',
      }}>{d.reason === 'drafted' ? `RD ${d.round ?? '—'}` : exit.tag}</span>
      <span style={{ font: "600 13px var(--mono)" }}>{d.overall}</span>
    </button>
  );
}

/** Outside the sequence there are no results yet, so show the odds instead. */
function DraftOdds({ team, year }: { team: NonNullable<ReturnType<typeof useUserTeam>>; year: number }) {
  const roster: Player[] = [
    ...team.team.lineup, ...team.team.bench,
    ...team.team.rotation, ...team.team.bullpen,
  ];
  const juniors = roster.filter((p) => p.classYear === 'JR')
    .sort((a, b) => overallOf(b) - overallOf(a));
  const seniors = roster.filter((p) => p.classYear === 'SR')
    .sort((a, b) => overallOf(b) - overallOf(a));
  const atRisk = juniors.filter((p) => draftChance(overallOf(p)) >= 0.35).length;

  return (
    <FixedHeader header={
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
          <div className="label">{team.def.abbr} · {year}</div>
          <div style={{
            font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
          }}>The draft</div>
        </div>
      </div>
    }>
    <div style={{ padding: '10px 14px 20px' }}>
      <div style={{ font: "400 12px/1.55 var(--body)", color: 'var(--dim)' }}>
        Seniors leave in June whatever happens. Juniors leave if the draft wants
        them &mdash; and the better you develop one, the more it does.
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="SENIORS" v={String(seniors.length)} />
        <Tile k="JUNIORS" v={String(juniors.length)} />
        <Tile k="LIKELY GONE" v={String(atRisk)} accent={atRisk > 0} last />
      </div>

      {juniors.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>DRAFT ELIGIBLE</div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {juniors.map((p) => <OddsRow key={p.id} player={p} odds={draftChance(overallOf(p))} />)}
          </div>
        </>
      )}

      {seniors.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
            LEAVING REGARDLESS
          </div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {seniors.map((p) => <OddsRow key={p.id} player={p} odds={null} />)}
          </div>
        </>
      )}
    </div>
    </FixedHeader>
  );
}

function OddsRow({ player, odds }: { player: Player; odds: number | null }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const word = odds === null ? 'GRADUATING'
    : odds >= 0.7 ? 'GONE' : odds >= 0.35 ? 'LIKELY'
    : odds >= 0.12 ? 'POSSIBLE' : 'SAFE';
  const tone = odds === null ? 'var(--dim)'
    : odds >= 0.35 ? 'var(--clay)' : odds >= 0.12 ? 'var(--ink)' : 'var(--win)';

  return (
    <button
      onClick={() => openPlayer(player.id)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '1fr auto auto',
        gap: 10, alignItems: 'center',
        padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: "400 13px var(--body)",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{player.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 10px var(--mono)", color: 'var(--dim)',
        }}>
          {player.type === 'pitcher' ? (player as { role: string }).role : player.pos}
          {' · '}{player.classYear}
        </span>
      </span>
      <span style={{
        font: "700 8.5px var(--mono)", letterSpacing: '.08em', color: tone, whiteSpace: 'nowrap',
      }}>{word}</span>
      <span style={{ font: "600 13px var(--mono)" }}>{overallOf(player)}</span>
    </button>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '10px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 20px/1 var(--display)", marginTop: 3,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}
