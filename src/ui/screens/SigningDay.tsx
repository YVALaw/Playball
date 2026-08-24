// SigningDay.tsx
// Where the whole class went.
//
// Three views, because a signing day report answers three different questions:
// how everyone finished nationally, what you actually got, and where every
// individual recruit ended up. The third is the one that makes recruiting feel
// like a competition rather than a slot machine — losing a player to a program
// you can name and click on is a rivalry, losing him into a void is a number
// going down.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import {
  PRIORITY_LABEL, PRIORITIES, type Prospect, type Priority,
} from '../../engine/recruiting.js';
import { scoutedOverall, scoutedPotential, highSchoolLine } from '../../engine/scouting.js';
import type { Pitcher } from '../../engine/types.js';
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

export function SigningDay() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const next = useDynasty((s) => s.nextPhase);
  const team = useUserTeam();

  const [view, setView] = useState<View>('mine');
  const [openId, setOpenId] = useState<string | null>(null);

  const { rankings, mine, signed, myRank } = useMemo(() => {
    const prospects = season?.recruiting.prospects ?? [];
    const byTeam = new Map<number, Prospect[]>();
    for (const p of prospects) {
      if (p.signedBy === null) continue;
      const list = byTeam.get(p.signedBy) ?? [];
      list.push(p);
      byTeam.set(p.signedBy, list);
    }

    const table = [...byTeam.entries()]
      .map(([t, list]) => ({ team: t, list, points: classPoints(list) }))
      .sort((a, b) => b.points - a.points);

    return {
      rankings: table,
      mine: (byTeam.get(userTeam) ?? []).sort((a, b) => b.stars - a.stars),
      signed: prospects.filter((p) => p.signedBy !== null)
        .sort((a, b) => b.stars - a.stars || b.player.potential - a.player.potential),
      myRank: table.findIndex((r) => r.team === userTeam) + 1,
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
            <RecruitRow key={p.id} p={p} onOpen={() => setOpenId(p.id)} />
          ))}
        </div>
      )}

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
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
    </FixedHeader>
  );
}

function RecruitRow({
  p, onOpen, destination, mine,
}: { p: Prospect; onOpen: () => void; destination?: string; mine?: boolean }) {
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
      <span style={{ font: "600 12px var(--mono)", color: 'var(--dim)' }}>
        {scoutedOverall(p.player, p.stars)}
      </span>
      <span style={{ font: "600 11px var(--mono)", color: 'var(--clay)' }}>
        {'★'.repeat(p.stars)}
      </span>
    </button>
  );
}

function RecruitSheet({
  prospect, userTeam, onClose,
}: { prospect: Prospect; userTeam: number; onClose: () => void }) {
  const season = useDynasty((s) => s.season);
  const p = prospect.player;
  const to = season?.teams[prospect.signedBy as number];
  const mine = prospect.signedBy === userTeam;

  const chased = Object.entries(prospect.points)
    .map(([t, pts]) => ({ team: Number(t), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);

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
                {slotOf(prospect)} &middot; bats {p.bats} &middot; throws {p.throws}
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
            <Stat k="OVERALL" v={String(scoutedOverall(p, prospect.stars))} />
            <Stat k="POTENTIAL" v={scoutedPotential(p, prospect.stars)} />
            <Stat k="WANTED" v={PRIORITY_LABEL[topPriority(prospect)]} last />
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
