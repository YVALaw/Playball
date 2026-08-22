// NewGame.tsx
// Choosing where the dynasty starts.
//
// Two ideas drive this screen.
//
// The first is that a star count tells you almost nothing. Two three star
// programs can be completely different jobs, and what decides which is which is
// the gap between what the school *is* and what its roster can *do* this year. A
// proud program with a thin team is asking you to survive a rebuild; a modest one
// with a senior heavy roster is handing you a window that closes in two years. So
// the card says all of it: reputation, current talent, the board's mandate in
// their own words, and how long they are giving you.
//
// The second is that **you cannot have any job you like.** A contender does not
// hand its program to someone who has never run one. Most of the board is locked
// on day one and it stays visible while it is locked, because a ladder you cannot
// see is not a ladder — it is just a short list that quietly gets longer.

import { useMemo, useState } from 'react';
import { CONFERENCES, type ConferenceDef, type SchoolDef } from '../../data/schools.js';
import {
  prestigeStars, expectationFor, contractFor, requiredCoachPrestige,
  canBeHired, hireGateNote, ROOKIE_PRESTIGE, rosterStrength,
  type Mandate, type Objective,
} from '../../engine/program.js';
import { useDynasty, WORLD_SEED } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { createSeason, seasonLength } from '../../engine/season.js';
import { makeRng } from '../../engine/rng.js';

const MANDATE_LABEL: Record<Mandate, string> = {
  develop: 'DEVELOP',
  build: 'REBUILD',
  compete: 'COMPETE',
  contend: 'CONTEND',
  championship: 'WIN IT ALL',
};

/** How hard the job is, said plainly rather than implied by a star count. */
const MANDATE_NOTE: Record<Mandate, string> = {
  develop: 'The most forgiving job on the board. Nobody expects wins yet.',
  build: 'A proud school with a thin roster. Patience, but not unlimited patience.',
  compete: 'Middle of the pack. Win more than you lose and you keep the job.',
  contend: 'Real talent and real expectations. June is the target.',
  championship: 'The hardest seat here. Anything short of Omaha is a failed year.',
};

/**
 * What kind of program this is, read off the gap between name and roster. This
 * is the single most useful thing on a row: it is the difference between a job
 * that is hard because it is good and a job that is hard because it is not.
 */
function archetype(prestige: number, quality: number): string | null {
  const gap = prestige - quality;
  // A giant has to actually be sleeping. The gap alone is not enough, because a
  // 78 prestige school sits so far above the scale that a good roster still
  // trails its name by a dozen points — which briefly had the best team in the
  // Gulf labelled a rebuild.
  if (gap >= 12 && prestige >= 50) return 'SLEEPING GIANT';
  if (gap <= -12) return 'ON THE RISE';
  if (prestige >= 60) return 'PERENNIAL POWER';
  if (prestige <= 34) return 'REBUILD';
  return null;
}

const TIER_WORD: Record<number, string> = {
  1: 'a power league',
  2: 'a solid league',
  3: 'a modest league',
};

export function NewGame() {
  const start = useDynasty((s) => s.start);
  const [conference, setConference] = useState<ConferenceDef>(CONFERENCES[0] as ConferenceDef);
  const [picked, setPicked] = useState<SchoolDef | null>(null);

  // Build the actual world, not an estimate of it. Generation is deterministic
  // from WORLD_SEED and costs about 2ms, so the screen can simply read the
  // rosters the player is going to get.
  //
  // The estimate it replaces was quality alone, which ran 1.7 points light on
  // average and up to 7 in the tail — enough to move a job across a mandate
  // boundary. The offer screen advertised Pascagoula Tech as COMPETE with a 61
  // roster wanting 20 wins; signing produced CONTEND, a 65 roster and 22 wins.
  // A board that changes its terms between the handshake and the first day is a
  // bug, however small the numbers are.
  const world = useMemo(() => createSeason(makeRng(WORLD_SEED), undefined, CONFERENCES), []);

  const rosters = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of world.teams) map.set(t.def.abbr, rosterStrength(t.team));
    return map;
  }, [world]);

  const indexOf = (school: SchoolDef): number =>
    Math.max(0, world.teams.findIndex((t) => t.def.abbr === school.abbr));

  const rosterOf = (school: SchoolDef): number =>
    rosters.get(school.abbr) ?? school.quality;

  const preview = (school: SchoolDef) => {
    const roster = rosterOf(school);
    return {
      roster,
      stars: prestigeStars(school.prestige),
      contract: contractFor(school.prestige),
      expectation: expectationFor(school.prestige, roster, seasonLength(world.config)),
      open: canBeHired(ROOKIE_PRESTIGE, school.prestige, roster),
      needs: requiredCoachPrestige(school.prestige, roster),
      gate: hireGateNote(ROOKIE_PRESTIGE, school.prestige, roster),
      tag: archetype(school.prestige, roster),
    };
  };

  const rivalOf = (school: SchoolDef): SchoolDef | undefined =>
    conference.schools.find((s) => s.abbr === school.rival);

  const openCount = conference.schools.filter((s) => preview(s).open).length;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '14px 14px 8px' }}>
          {/*
            Title, your standing, and the region chips stay put. The program list
            runs twelve deep and the chips are how you move between regions —
            scrolling them off means scrolling back up every time you want to
            look somewhere else.
          */}
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
            <div className="label">NEW DYNASTY</div>
            <div style={{
              font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
            }}>Take a job</div>
          </div>

          <div style={{
            marginTop: 10, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
          }}>
            Sixty four programs across eight regions. You play everyone in your region
            every year, so the seven schools you pick alongside are the ones you will
            know best.
          </div>

          {/* Why half the board is greyed out, said before you tap a locked row. */}
          <div style={{
            marginTop: 12, padding: '10px 11px',
            background: 'var(--field)', borderLeft: '3px solid var(--clay)',
          }}>
            <div className="label">YOUR STANDING · {ROOKIE_PRESTIGE}</div>
            <div style={{ marginTop: 4, font: "400 12px/1.5 var(--body)" }}>
              Nobody has heard of you. The good programs are not going to take that
              call yet — win somewhere small and they will.
            </div>
          </div>

          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>REGION</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CONFERENCES.map((c) => {
              const on = c.id === conference.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setConference(c); setPicked(null); }}
                  style={{
                    padding: '8px 11px',
                    background: on ? 'var(--clay)' : 'var(--paper)',
                    border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
                    color: on ? 'var(--cream)' : 'var(--ink)',
                    font: "700 10px var(--mono)", letterSpacing: '.06em',
                  }}
                >{c.region.toUpperCase()}</button>
              );
            })}
          </div>

          <div style={{
            marginTop: 9, font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
          }}>
            <strong style={{ color: 'var(--ink)' }}>{conference.name}</strong>
            {' · '}{TIER_WORD[conference.tier]}
            <br />{conference.blurb}
          </div>

        </div>
      }
    >
    <div style={{ padding: '8px 14px 22px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginTop: 18, marginBottom: 6,
      }}>
        <span className="label">PROGRAM</span>
        <span style={{ font: "600 9px var(--mono)", color: 'var(--dim)' }}>
          {openCount} OF 8 WILL HIRE YOU
        </span>
      </div>

      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {conference.schools.map((school) => {
          const p = preview(school);
          return (
            <button
              key={school.abbr}
              onClick={() => setPicked(school)}
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '3px 1fr auto auto',
                gap: 9, alignItems: 'center',
                padding: '10px 11px 10px 0',
                borderBottom: '1px solid var(--hairline)',
                background: 'transparent',
                opacity: p.open ? 1 : 0.55,
              }}
            >
              {/* The school's colour, so a program is recognisable before you
                  have learned its name. */}
              <span style={{
                alignSelf: 'stretch', background: school.color,
                opacity: p.open ? 1 : 0.5,
              }} />
              <span style={{ minWidth: 0, paddingLeft: 8 }}>
                <span style={{
                  display: 'block', font: "400 13px var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{school.school}</span>
                <span style={{
                  display: 'block', marginTop: 1,
                  font: "400 10px var(--mono)", color: 'var(--dim)',
                }}>
                  {school.abbr} · {school.nickname}
                  {p.tag && <span style={{ color: 'var(--clay)' }}> · {p.tag}</span>}
                </span>
              </span>
              <span style={{
                font: "700 8.5px var(--mono)", letterSpacing: '.08em',
                color: 'var(--dim)', whiteSpace: 'nowrap', textAlign: 'right',
              }}>
                {p.open ? MANDATE_LABEL[p.expectation.mandate] : `NEEDS ${p.needs}`}
              </span>
              <span style={{
                font: "600 11px var(--mono)", whiteSpace: 'nowrap', paddingRight: 11,
                color: p.open ? 'var(--clay)' : 'var(--dim)',
              }}>{p.open ? '★'.repeat(p.stars) : '🔒'}</span>
            </button>
          );
        })}
      </div>

      {/*
        The offer arrives as a sheet over the list rather than a block appended
        below it — an offer that renders under eight rows is an offer you have to
        go looking for, and it is easy to lose your place scrolling back.
      */}
      {picked && (() => {
        const p = preview(picked);
        const rival = rivalOf(picked);
        return (
          <div
            onClick={() => setPicked(null)}
            className="sheet-scrim"
            style={{
              position: 'absolute', inset: 0, background: 'rgba(28,36,48,.55)',
              display: 'flex', alignItems: 'flex-end', zIndex: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="sheet"
              style={{
                width: '100%', maxHeight: '90%', overflowY: 'auto',
                background: 'var(--paper)', borderTop: `3px solid ${picked.color}`,
              }}
            >
              <div style={{
                padding: '7px 12px', background: picked.color,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
                }}>{p.open ? 'THE OFFER' : 'NOT YET'}</span>
                <button
                  onClick={() => setPicked(null)}
                  style={{
                    font: "600 9px var(--mono)", letterSpacing: '.14em',
                    color: 'rgba(246,241,230,.85)',
                  }}
                >BACK</button>
              </div>

              <div style={{ padding: '13px 12px 16px' }}>
                <div style={{
                  font: "800 22px/1 var(--display)", textTransform: 'uppercase',
                }}>{picked.school}</div>
                <div style={{
                  marginTop: 3, font: "400 11px var(--mono)", color: 'var(--dim)',
                }}>{picked.nickname} · {conference.name}</div>

                <div style={{ display: 'flex', marginTop: 12 }}>
                  <Stat k="REPUTATION" v={'★'.repeat(p.stars) + '☆'.repeat(5 - p.stars)} />
                  <Stat k="ROSTER OVR" v={String(p.roster)} />
                  <Stat k="CONTRACT" v={p.open ? `${p.contract} yrs` : '—'} last />
                </div>

                {/* Name against roster is the whole story of a job, so it is
                    spelled out rather than left to two numbers side by side. */}
                {p.tag && (
                  <div style={{
                    marginTop: 11, padding: '8px 10px',
                    border: `1px solid ${picked.color}`, borderLeftWidth: 3,
                    font: "400 11.5px/1.45 var(--body)",
                  }}>
                    <strong style={{ font: "700 9px var(--mono)", letterSpacing: '.1em' }}>
                      {p.tag}
                    </strong>
                    <br />
                    {picked.prestige - picked.quality >= 12
                      ? 'The name is bigger than the team. Expectations will not wait for the roster to catch up.'
                      : picked.quality - picked.prestige >= 12
                        ? 'Better than its reputation right now. This roster is a window, and windows close.'
                        : picked.prestige >= 60
                          ? 'They have been good for a long time and they intend to stay that way.'
                          : 'Nothing here yet. Whatever gets built, you build it.'}
                  </div>
                )}

                {rival && (
                  <div style={{
                    marginTop: 9, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                  }}>
                    Rivalry: <strong style={{ color: 'var(--ink)' }}>{rival.school}</strong>.
                    Three games a year, every year.
                  </div>
                )}

                <div style={{
                  marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--hairline)',
                }}>
                  <div className="label">THE MANDATE · {MANDATE_LABEL[p.expectation.mandate]}</div>
                  <div style={{ marginTop: 5, font: "400 13px/1.5 var(--body)" }}>
                    {p.expectation.summary}
                  </div>

                  {/*
                    What they will actually grade you on, before you sign. The
                    required boxes are the job; the bonuses are what a good year
                    looks like on top of it. Two jobs with the same star rating
                    can be asking for completely different things, and this list
                    is the only place that difference is visible.
                  */}
                  <div style={{ marginTop: 9 }}>
                    {p.expectation.objectives.map((o) => <Ask key={o.key} objective={o} />)}
                  </div>
                </div>

                <div style={{
                  marginTop: 10, padding: '9px 10px', background: 'var(--field)',
                  font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                }}>{MANDATE_NOTE[p.expectation.mandate]}</div>

                {p.open ? (
                  <>
                    <div style={{
                      marginTop: 10, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                    }}>
                      They are giving you <strong style={{ color: 'var(--ink)' }}>
                        {p.contract} seasons</strong>. Meet the mandate and they will
                      extend it; run the deal out without convincing them and they
                      simply will not renew.
                    </div>

                    <button
                      onClick={() => start(undefined, indexOf(picked))}
                      style={{
                        marginTop: 14, width: '100%', padding: '13px 0',
                        background: picked.color, border: `1px solid ${picked.color}`,
                        color: 'var(--cream)',
                        font: "700 11px var(--mono)", letterSpacing: '.14em',
                      }}
                    >SIGN WITH {picked.abbr}</button>
                  </>
                ) : (
                  <div style={{
                    marginTop: 12, padding: '11px 12px',
                    border: '1px solid var(--clay)', background: 'rgba(168,68,42,.07)',
                  }}>
                    <div className="label" style={{ color: 'var(--clay)' }}>
                      THEY WANT {p.needs} · YOU ARE {ROOKIE_PRESTIGE}
                    </div>
                    <div style={{
                      marginTop: 5, font: "400 12px/1.5 var(--body)",
                    }}>{p.gate}</div>
                  </div>
                )}

                <button
                  onClick={() => setPicked(null)}
                  style={{
                    marginTop: 8, width: '100%', padding: '10px 0',
                    background: 'transparent', border: '1px solid rgba(28,36,48,.28)',
                    font: "600 10px var(--mono)", letterSpacing: '.12em', color: 'var(--dim)',
                  }}
                >LOOK AT OTHER JOBS</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </FixedHeader>
  );
}

/** One of the board's asks, before a game has been played. */
function Ask({ objective }: { objective: Objective }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{
        font: "700 11px var(--mono)", width: 12,
        color: objective.required ? 'var(--clay)' : 'rgba(28,36,48,.34)',
      }}>{objective.required ? '•' : '◦'}</span>
      <span style={{ flex: 1, font: "400 12px/1.4 var(--body)" }}>
        {objective.label}
        {!objective.required && (
          <span style={{
            marginLeft: 6, font: "600 8px var(--mono)", letterSpacing: '.1em',
            color: 'var(--dim)',
          }}>BONUS</span>
        )}
      </span>
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
      <div style={{ font: "700 18px/1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
