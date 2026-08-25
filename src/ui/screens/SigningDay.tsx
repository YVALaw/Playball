// SigningDay.tsx
// Where the whole class went, and what they actually were.
//
// Three views, because a signing day report answers three different questions:
// how everyone finished nationally, what you actually got, and where every
// individual recruit ended up. The third is the one that makes recruiting feel
// like a competition rather than a slot machine — losing a player to a program
// you can name and click on is a rivalry, losing him into a void is a number
// going down.
//
// This is also the screen where the guessing stops. All winter the board showed
// bands and impressions; here the real overall and the real ceiling are printed
// next to the report you were working from. That contrast is the payoff for the
// whole system — a steal and a bust look identical while you are bidding, and
// only ever become visible here.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import {
  PRIORITY_LABEL, PRIORITIES, byRank, reportedOverall, reportedPotential,
  type Prospect, type Priority,
} from '../../engine/recruiting.js';
import { highSchoolLine, potentialGrade, GRADE_LADDER } from '../../engine/scouting.js';
import { walkOnShortfall } from '../../engine/progression.js';
import { overallOf } from '../../engine/ratings.js';
import type { Pitcher, Player } from '../../engine/types.js';
import { Avatar } from '../Avatar.js';

type View = 'rankings' | 'mine' | 'all';

/**
 * Class strength, weighted so quality beats quantity.
 *
 * Stars squared: four two-star signings is not a better class than one five
 * star, and a straight count would say it was.
 */
const classPoints = (list: readonly Prospect[]): number =>
  list.reduce((a, p) => a + p.stars * p.stars, 0);

const slotOf = (p: Prospect): string =>
  p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

const topPriority = (p: Prospect): Priority =>
  [...PRIORITIES].sort((a, b) => p.priorities[b] - p.priorities[a])[0] as Priority;

/**
 * How the truth landed against the report you were working from.
 *
 * The band always contained him — that is how it was built — so the question is
 * never whether you were wrong, it is *where inside your own report* he came
 * out. The top of the band is the steal and the bottom is the one you paid over
 * the odds for, and both are invisible until this screen.
 *
 * Deliberately silent in the middle. A verdict on every single signing turns
 * into wallpaper, and then the two that mattered do not stand out.
 */
function verdict(
  prospect: Prospect, recruitingSkill: number,
): { short: string; long: string; tone: string } | null {
  const truth = GRADE_LADDER.indexOf(potentialGrade(prospect.player.potential));
  const band = reportedPotential(prospect, recruitingSkill);
  if (band.low === band.high) return null;
  if (truth === GRADE_LADDER.indexOf(band.high)) {
    return { short: 'HIGH END', long: 'TOP OF YOUR REPORT', tone: 'var(--win)' };
  }
  if (truth === GRADE_LADDER.indexOf(band.low)) {
    return { short: 'LOW END', long: 'BOTTOM OF YOUR REPORT', tone: 'var(--clay)' };
  }
  return null;
}

export function SigningDay() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const next = useDynasty((s) => s.nextPhase);
  const team = useUserTeam();
  // The coach phase runs before recruiting, so this is the same skill the board
  // drew its bands with — the report shown here is the one you were reading.
  const recruitingSkill = coach.skills.recruiting;

  const [view, setView] = useState<View>('mine');
  const [openId, setOpenId] = useState<string | null>(null);

  const { rankings, mine, signed, myRank, walkOns } = useMemo(() => {
    const prospects = season?.recruiting.prospects ?? [];
    const byTeam = new Map<number, Prospect[]>();
    for (const p of prospects) {
      if (p.signedBy === null) continue;
      const list = byTeam.get(p.signedBy) ?? [];
      list.push(p);
      byTeam.set(p.signedBy, list);
    }

    /*
      What the class did not cover.

      The roster is standing here half empty — the draft step emptied it and
      nothing refills it until the year turns over — so the men who are on it
      plus the men just signed are exactly the two inputs the year roll will
      use. Read in board order rather than from `mine`, which is sorted for the
      screen: the engine takes the class in the order the board holds it, and a
      projection that disagreed on a tie would be a projection worth nothing.
    */
    const me = season?.teams[userTeam]?.team;
    const roster: Player[] = me
      ? [...me.lineup, ...me.bench, ...me.rotation, ...me.bullpen] : [];
    const classPlayers = prospects
      .filter((p) => p.signedBy === userTeam)
      .map((p) => p.player);

    const table = [...byTeam.entries()]
      .map(([t, list]) => ({ team: t, list, points: classPoints(list) }))
      .sort((a, b) => b.points - a.points);

    // Both lists read in national ranking order, which is the number printed
    // beside every name on this screen. Sorted on stars they came out in an
    // order nothing on the row explained — five players all showing ★★★★, the
    // 9th best in the country under the 140th — and the class review is the one
    // screen whose whole job is to say what you got.
    return {
      rankings: table,
      mine: (byTeam.get(userTeam) ?? []).slice().sort(byRank),
      signed: prospects.filter((p) => p.signedBy !== null).sort(byRank),
      myRank: table.findIndex((r) => r.team === userTeam) + 1,
      walkOns: me ? walkOnShortfall(roster, classPlayers) : [],
    };
  }, [season, userTeam]);

  if (!season || !team) return null;

  const open = season.recruiting.prospects.find((p) => p.id === openId) ?? null;

  return (
    // The class totals and the three views hold still; the names scroll.
    <FixedHeader header={
      <div style={{ padding: '14px 14px 10px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
        <div className="label">SIGNING DAY</div>
        <div style={{
          font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>The class</div>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="SIGNED" v={String(mine.length)} />
        <Tile k="CLASS POINTS" v={String(classPoints(mine))} />
        <Tile k="NATIONALLY" v={myRank > 0 ? `#${myRank}` : '—'} accent last />
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
        {([['mine', 'YOUR CLASS'], ['rankings', 'RANKINGS'], ['all', 'EVERY RECRUIT']] as const)
          .map(([v, label]) => (
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
            >{label}</button>
          ))}
      </div>
      </div>
    }>
    <div style={{ padding: '10px 14px 22px' }}>
      {view === 'mine' && (
        <div style={{
          marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {mine.length === 0 && (
            <div style={{
              padding: '18px 12px', font: "400 12px/1.55 var(--body)", color: 'var(--dim)',
            }}>
              Nobody signed. Every hole on the roster gets filled by a walk-on, and
              a walk-on is a long way below the players you were bidding on.
            </div>
          )}
          {mine.map((p) => (
            <RecruitRow
              key={p.id} p={p} onOpen={() => setOpenId(p.id)}
              recruitingSkill={recruitingSkill}
            />
          ))}
        </div>
      )}

      {/*
        Said once, at the top of your own class, rather than on every row. The
        numbers on this screen are not the ones the board showed all winter and
        a player who does not know that will read a bust as a bug.
      */}
      {view === 'mine' && mine.length > 0 && (
        <div style={{
          marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          Physicals are in. These are the real numbers, not your reports &mdash;
          tap a name to see what you had him at.
        </div>
      )}

      {/*
        The men you did not sign, kept apart from the men you did.

        Deliberately not rows in the class list above, and deliberately not
        sorted in among them. A walk-on is what a program gets because it
        missed; folding him into the class would let a coach who covered four
        holes out of nine read a nine man class off this screen, which is the
        opposite of what it is for.

        Positions and counts rather than names, because the names do not exist
        yet — these men are manufactured when the year rolls over, three taps
        from here. What is knowable today is which spots the roster and the
        class between them fail to cover, and that is exactly what arrives.
      */}
      {view === 'mine' && <WalkOnGroup rows={walkOns} />}

      {view === 'rankings' && (
        <div style={{
          marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {rankings.slice(0, 25).map((row, i) => {
            const t = season.teams[row.team];
            const isMine = row.team === userTeam;
            return (
              <div key={row.team} style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                gap: 10, alignItems: 'baseline',
                padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
                background: isMine ? 'rgba(168,68,42,.10)' : 'transparent',
              }}>
                <span style={{
                  font: "600 11px var(--mono)", color: 'var(--dim)',
                  minWidth: 20, textAlign: 'right',
                }}>{i + 1}</span>
                <span style={{
                  font: `${isMine ? 700 : 400} 12.5px var(--body)`,
                  color: isMine ? 'var(--clay)' : 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t?.def.school ?? '?'}</span>
                <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>
                  {row.list.length} signed
                </span>
                <span style={{ font: "600 12px var(--mono)" }}>{row.points}</span>
              </div>
            );
          })}
          {myRank > 25 && (
            <div style={{
              padding: '9px 11px', background: 'rgba(168,68,42,.10)',
              font: "600 12px var(--mono)", color: 'var(--clay)',
            }}>#{myRank} &nbsp; {team.def.school}</div>
          )}
        </div>
      )}

      {view === 'all' && (
        <div style={{
          marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {signed.slice(0, 60).map((p) => (
            <RecruitRow
              key={p.id}
              p={p}
              onOpen={() => setOpenId(p.id)}
              recruitingSkill={recruitingSkill}
              destination={season.teams[p.signedBy as number]?.def.abbr}
              mine={p.signedBy === userTeam}
            />
          ))}
        </div>
      )}

      <FloatingAction label="START NEXT SEASON" onClick={() => void next()} />

      {open && (
        <RecruitSheet
          prospect={open}
          userTeam={userTeam}
          recruitingSkill={recruitingSkill}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
    </FixedHeader>
  );
}

/**
 * The shortfall, as a block of its own under the class.
 *
 * Muted rather than clay: every accent on this screen means "yours", and these
 * are the spots nobody's signature covered. A class that covered everything says
 * so in one line — the good outcome is worth printing, and a group that only
 * ever appears when you failed teaches the player to dread the heading.
 */
function WalkOnGroup({ rows }: { rows: readonly { pos: string; count: number }[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0);

  if (total === 0) {
    return (
      <div style={{
        marginTop: 14, padding: '11px 12px',
        border: '1px solid var(--faint)', background: 'var(--paper)',
        font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        Every hole is covered. Nobody walks on this year &mdash; the whole roster
        is men you went and got.
      </div>
    );
  }

  return (
    <>
      <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
        WALK-ONS &middot; {total}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {rows.map((r, i) => (
          <div
            key={r.pos}
            className="card-in"
            style={{
              padding: '7px 10px',
              border: '1px solid var(--faint)',
              background: 'var(--paper)',
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div style={{
              font: "700 11px var(--mono)", letterSpacing: '.08em', color: 'var(--ink)',
            }}>{r.pos}</div>
            <div style={{
              marginTop: 2, font: "400 8.5px var(--mono)", color: 'var(--dim)',
            }}>{r.count > 1 ? `${r.count} bodies` : 'one body'}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 7, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        These are the positions your class did not cover. They get filled in June
        by whoever turns up, a long way below your own level &mdash; and a walk-on
        is gone again the moment the season ends, so the hole is back on next
        winter&rsquo;s board.
      </div>
    </>
  );
}

function RecruitRow({
  p, onOpen, recruitingSkill, destination, mine,
}: {
  p: Prospect; onOpen: () => void; recruitingSkill: number;
  destination?: string; mine?: boolean;
}) {
  const call = verdict(p, recruitingSkill);
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
        gap: 9, alignItems: 'center',
        padding: '10px 11px', borderBottom: '1px solid var(--hairline)',
        background: mine ? 'rgba(168,68,42,.10)' : 'transparent',
      }}
    >
      <Avatar id={p.id} team={destination} size={34} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: `${mine ? 700 : 400} 13px var(--body)`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{p.player.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 10px var(--mono)", color: 'var(--dim)',
        }}>
          #{p.rank} · {slotOf(p)} · {p.state}
          {destination ? ` · → ${destination}` : ''}
          {p.committedWeek !== null ? ` · wk ${p.committedWeek}` : ''}
        </span>
      </span>
      {/*
        The truth, both halves of it. The board printed a band here all winter
        and a class review that printed the same band would have nothing to
        review — the whole point of this row is that the guessing is over.
      */}
      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <span style={{ font: "600 12px var(--mono)" }}>
          {overallOf(p.player)}
          <span style={{ color: 'var(--dim)' }}> · </span>
          {potentialGrade(p.player.potential)}
        </span>
        {call && (
          <span style={{
            display: 'block', marginTop: 1,
            font: "700 7px var(--mono)", letterSpacing: '.08em', color: call.tone,
          }}>{call.short}</span>
        )}
      </span>
      <span style={{ font: "600 11px var(--mono)", color: 'var(--clay)' }}>
        {'★'.repeat(p.stars)}
      </span>
    </button>
  );
}

function RecruitSheet({
  prospect, userTeam, recruitingSkill, onClose,
}: {
  prospect: Prospect; userTeam: number; recruitingSkill: number; onClose: () => void;
}) {
  const season = useDynasty((s) => s.season);
  const p = prospect.player;
  const to = season?.teams[prospect.signedBy as number];
  const mine = prospect.signedBy === userTeam;

  const chased = Object.entries(prospect.points)
    .map(([t, pts]) => ({ team: Number(t), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  const band = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  const call = verdict(prospect, recruitingSkill);

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
          // Fixed, for the same reason the recruiting sheet is: a panel that
          // resizes to its contents jumps under the thumb.
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '13px 12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar id={p.id} team={to?.def.abbr} size={54} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "800 22px/1 var(--display)", textTransform: 'uppercase' }}>
                {p.name}
              </div>
              <div style={{ marginTop: 3, font: "400 11px var(--mono)", color: 'var(--dim)' }}>
                {/* Age, because a class is not all one age. A freshman who
                    arrives at twenty is draft eligible after one season, and
                    the day you sign him is the day to know it. */}
                {slotOf(prospect)} &middot; age {p.age} &middot; bats {p.bats}
                {' '}&middot; throws {p.throws}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 12, padding: '11px 12px',
            background: mine ? 'rgba(168,68,42,.10)' : 'var(--field)',
            borderLeft: `3px solid ${mine ? 'var(--clay)' : 'var(--faint)'}`,
          }}>
            <div className="label">SIGNED WITH</div>
            <div style={{
              font: "700 17px/1.1 var(--display)", marginTop: 3, textTransform: 'uppercase',
              color: mine ? 'var(--clay)' : 'var(--ink)',
            }}>{to?.def.school ?? 'nobody'}{mine ? ' — you' : ''}</div>
            {prospect.committedWeek !== null && (
              <div style={{
                marginTop: 3, font: "400 11px var(--mono)", color: 'var(--dim)',
              }}>committed in week {prospect.committedWeek}</div>
            )}
          </div>

          <div style={{ display: 'flex', marginTop: 12 }}>
            <Stat k="OVERALL" v={String(overallOf(p))} />
            <Stat k="CEILING" v={potentialGrade(p.potential)} />
            <Stat k="WANTED" v={PRIORITY_LABEL[topPriority(prospect)]} last />
          </div>

          {/*
            What you had him at, printed under what he is.

            The band always contained him, so this is never a gotcha about being
            wrong — it is the width of your own ignorance, made visible at the
            one moment it can be checked. A coach who keeps signing players who
            come out at the bottom of his reports is being read by the rest of
            the country, and a coach whose reports are eight points wide can see
            what the coach points bought him.
          */}
          <div style={{
            marginTop: 10, padding: '9px 11px', background: 'var(--field)',
            borderLeft: `3px solid ${call ? call.tone : 'var(--faint)'}`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span className="label">YOUR REPORT HAD HIM</span>
              {call && (
                <span style={{
                  font: "700 8px var(--mono)", letterSpacing: '.1em', color: call.tone,
                }}>{call.long}</span>
              )}
            </div>
            <div style={{
              marginTop: 4, font: "600 12.5px var(--mono)", color: 'var(--ink)',
            }}>
              {band.low}&ndash;{band.high}
              <span style={{ color: 'var(--dim)' }}> overall &middot; </span>
              {ceiling.low} &ndash; {ceiling.high}
              <span style={{ color: 'var(--dim)' }}> ceiling</span>
            </div>
          </div>

          <div className="label" style={{ marginTop: 14, marginBottom: 5 }}>LAST SPRING</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {highSchoolLine(p).map((row) => (
              <div key={row.label} style={{
                width: '33.33%', padding: '7px 0',
                borderBottom: '1px solid var(--hairline)',
              }}>
                <div className="label">{row.label}</div>
                <div style={{ font: "700 15px/1 var(--display)", marginTop: 3 }}>{row.value}</div>
              </div>
            ))}
          </div>

          {chased.length > 1 && (
            <>
              <div className="label" style={{ marginTop: 14, marginBottom: 5 }}>
                WHO WAS IN ON HIM
              </div>
              {chased.map((r) => {
                const t = season?.teams[r.team];
                const isMine = r.team === userTeam;
                const won = r.team === prospect.signedBy;
                return (
                  <div key={r.team} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0', borderBottom: '1px solid var(--hairline)',
                    font: `${isMine ? 700 : 400} 12px var(--body)`,
                    color: won ? 'var(--win)' : isMine ? 'var(--clay)' : 'var(--dim)',
                  }}>
                    <span>{t?.def.school ?? '?'}{isMine ? ' (you)' : ''}</span>
                    <span style={{ font: "600 10px var(--mono)" }}>
                      {Math.round(r.pts)}{won ? ' · SIGNED' : ''}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '11px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 22px/1 var(--display)", marginTop: 4,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, paddingRight: 8,
      borderRight: last ? 'none' : '1px solid var(--hairline)',
      paddingLeft: last ? 8 : 0,
    }}>
      <div className="label">{k}</div>
      <div style={{ font: "700 14px/1.1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
