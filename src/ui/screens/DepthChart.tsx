// DepthChart.tsx
// Who plays where, and who plays there when he cannot.
//
// Stage 8's screen. Two things are shown at once because they are two different
// facts and the game needs both: the nine who take the field today, and the
// order behind each of them.
//
// There is no BENCH here, and that is deliberate. A man not starting is
// *benched* -- that is what the word means -- so the squad is one list and the
// nine are marked in it, rather than a roster split into a starting group and a
// separate group with its own tab. Asked for in those terms.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { depthAt, startersFrom, SPOTS, available, squad } from '../../engine/depthChart.js';
import { positionPenalty, secondaryPositions } from '../../engine/positions.js';
import { standing, gradesOf } from '../../engine/eligibility.js';
import { captainOf, candidates, roomsChoice } from '../../engine/captains.js';
import { handles } from '../../state/depth.js';
import { overallOf } from '../../engine/ratings.js';
import type { Hitter, Position } from '../../engine/types.js';

/** What the chart says about a man at a spot, in words rather than a number. */
function fitOf(p: Hitter, spot: Position): { text: string; tone: string } {
  const cost = positionPenalty(p, spot);
  if (p.pos === spot) return { text: 'HIS OWN', tone: 'var(--win)' };
  if (cost === 0) return { text: 'COVERS', tone: 'var(--you)' };
  if (cost >= 20) return { text: 'OUT OF HIS DEPTH', tone: 'var(--clay)' };
  return { text: 'A STRETCH', tone: 'var(--clay)' };
}

export function DepthChart() {
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const moveDepth = useDynasty((s) => s.moveDepth);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const nameCaptain = useDynasty((s) => s.nameCaptain);
  const clearCaptain = useDynasty((s) => s.clearCaptain);
  const namesCaptain = useDynasty((s) => handles(s.depth, 'captains'));
  const [open, setOpen] = useState<Position | null>(null);
  void version;

  if (!team || !season) return null;
  const day = season.dayIndex;
  const nine = startersFrom(team.team, day);
  const men = squad(team.team);
  const out = men.filter((p) => !available(p, day));

  const leader = captainOf(team.team);
  const able = candidates(team.team);
  const pick = roomsChoice(team.team);
  const spots = SPOTS;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">THE DEPTH CHART · {men.length} MEN</div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)",
              marginTop: 3, textTransform: 'uppercase',
            }}>Who plays where</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '10px 14px 20px' }}>
        {out.length > 0 && (
          <div style={{
            marginBottom: 10, padding: '8px 11px',
            background: 'var(--paper)', borderLeft: '3px solid var(--clay)',
          }}>
            <div className="label" style={{ color: 'var(--clay)' }}>UNAVAILABLE</div>
            <div style={{
              marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.5 var(--body)",
            }}>
              {out.map((p) => p.name).join(', ')} — the next man on the chart plays.
            </div>
          </div>
        )}

        {/*
          Declining the DH is not here, and it is not an oversight.

          Assigning the slot works -- the DH row below is a ranking like any
          other, and the coach decides who fills it. Letting the *pitcher* hit
          instead is a different feature: the batting order is `Hitter[]` and a
          pitcher has no hitting ratings at all, so it needs a man modelled in
          two rating systems at once. Which is the exact thing that got two-way
          players split out of this stage.

          So it ships with them. A toggle here today would be a control that
          changes nothing, and this codebase has spent a week deleting those.
        */}
        {/*
          The captain, above the chart because he is about the room rather than
          about a position.

          The room's own choice is printed beside the decision rather than
          applied, so ignoring it is a visible thing a coach did. And only men
          with the makeup for it appear at all -- without that gate, naming a
          captain is a free buff on your best player and the answer is the same
          man every year.
        */}
        {namesCaptain && (
          <div style={{ marginBottom: 10, padding: '9px 11px', background: 'var(--paper)' }}>
            <div className="label">THE CAPTAIN</div>
            {leader ? (
              <>
                <div style={{
                  marginTop: 3, font: "700 calc(13px * var(--ts)) var(--display)",
                  textTransform: 'uppercase',
                }}>{leader.name}</div>
                <div style={{
                  marginTop: 2, font: "400 calc(11px * var(--ts))/1.45 var(--body)",
                  color: 'var(--dim)',
                }}>
                  He steadies the room. He will not make anybody happy — he stops
                  a bad month becoming a bad year.
                </div>
                <button
                  className="tap"
                  onClick={clearCaptain}
                  style={{
                    marginTop: 8, width: '100%', padding: '8px 11px', minHeight: 38,
                    background: 'transparent', border: '1px solid rgba(28,36,48,.28)',
                    font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.11em',
                    color: 'var(--dim)',
                  }}
                >STAND HIM DOWN</button>
              </>
            ) : (
              <>
                <div style={{
                  marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)",
                }}>
                  {able.length > 0
                    ? 'Nobody wears it. These are the men the room would follow.'
                    : 'Nobody in this room has the makeup for it yet.'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {able.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      className="tap"
                      onClick={() => nameCaptain(c.id)}
                      style={{
                        textAlign: 'left', padding: '8px 10px', minHeight: 38,
                        background: 'var(--field)',
                        border: `1px solid ${c.id === pick?.id ? 'var(--you)' : 'rgba(28,36,48,.24)'}`,
                        font: "400 calc(11.5px * var(--ts)) var(--body)",
                      }}
                    >
                      {c.name} · {c.classYear}
                      {c.id === pick?.id && (
                        <span style={{ color: 'var(--you)' }}> · THE ROOM WOULD PICK HIM</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {spots.map((spot) => {
          const order = depthAt(team.team, spot);
          const starter = nine[spot];
          const showing = open === spot;
          return (
            <div key={spot} style={{ marginBottom: 6 }}>
              <button
                className="tap"
                onClick={() => setOpen(showing ? null : spot)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 11px', minHeight: 44,
                  background: 'var(--paper)',
                  border: '1px solid rgba(28,36,48,.28)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  flex: 'none', width: 30,
                  font: "800 calc(13px * var(--ts)) var(--display)",
                  color: 'var(--clay)',
                }}>{spot}</span>
                <span style={{
                  flex: 1,
                  font: "700 calc(13px * var(--ts)) var(--display)",
                  textTransform: 'uppercase',
                }}>{starter ? starter.name : 'NOBODY'}</span>
                {starter && (
                  <span style={{
                    flex: 'none',
                    font: "600 calc(9px * var(--ts)) var(--mono)",
                    color: fitOf(starter, spot).tone,
                  }}>{fitOf(starter, spot).text}</span>
                )}
                <span style={{
                  flex: 'none', font: "700 calc(11px * var(--ts)) var(--mono)",
                  color: 'var(--dim)',
                }}>{showing ? '−' : '+'}</span>
              </button>

              {showing && (
                <div style={{ padding: '4px 0 2px 10px' }}>
                  {order.slice(0, 5).map((p, i) => {
                    const fit = fitOf(p, spot);
                    const fit2 = standing(p);
                    const sittingOut = !available(p, day);
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '6px 9px', marginBottom: 3,
                          background: 'var(--field)',
                          border: '1px solid var(--faint)',
                          opacity: sittingOut ? 0.5 : 1,
                        }}
                      >
                        <span style={{
                          flex: 'none', width: 14,
                          font: "700 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
                        }}>{i + 1}</span>
                        <button
                          className="tap"
                          onClick={() => openPlayer(p.id)}
                          style={{
                            flex: 1, textAlign: 'left', background: 'none', border: 'none',
                            padding: 0,
                            font: "400 calc(12px * var(--ts)) var(--body)", color: 'var(--ink)',
                          }}
                        >
                          {p.name}
                          <span style={{ color: 'var(--dim)' }}> · {overallOf(p)}</span>
                          {fit2 !== 'fine' && (
                            <span style={{ color: 'var(--clay)' }}>
                              {' '}· {fit2 === 'trouble' ? 'FAILING' : 'GRADES'}
                            </span>
                          )}
                        </button>
                        <span style={{
                          flex: 'none',
                          font: "600 calc(8px * var(--ts)) var(--mono)", color: fit.tone,
                        }}>{fit.text}</span>
                        <button
                          className="tap"
                          aria-label={`Move ${p.name} up at ${spot}`}
                          onClick={() => moveDepth(spot, p.id, -1)}
                          disabled={i === 0}
                          style={{
                            flex: 'none', width: 26, minHeight: 26,
                            background: 'transparent',
                            border: '1px solid rgba(28,36,48,.25)',
                            color: i === 0 ? 'var(--faint)' : 'var(--ink)',
                            font: "700 calc(10px * var(--ts)) var(--mono)",
                          }}
                        >{'↑'}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{
          marginTop: 12,
          font: "400 calc(10.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          The chart is what the game plays. When a man cannot go, the next name
          here takes his place and bats where he was batting.
        </div>
      </div>
    </FixedHeader>
  );
}
