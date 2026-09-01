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
import { CaptainC, ModuleIntro } from '../components/Kit.js';
import { depthAt, startersFrom, SPOTS, available, squad } from '../../engine/depthChart.js';
import { positionPenalty, secondaryPositions } from '../../engine/positions.js';
import { standing, gradesOf } from '../../engine/eligibility.js';
import { handles } from '../../state/depth.js';
import { captainOf } from '../../engine/captains.js';
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
  const [open, setOpen] = useState<Position | null>(null);
  void version;

  if (!team || !season) return null;
  const day = season.dayIndex;
  const nine = startersFrom(team.team, day);
  const men = squad(team.team);
  const out = men.filter((p) => !available(p, day));

  /*
    Where every man stands TONIGHT, so the candidate list answers the question
    it kept raising. Reported: "I don't know which of these players is on the
    bench and which is already starting and covering a base." Read off the
    same `startersFrom` the game uses, so a cover shows as IN THE NINE at the
    spot he is actually covering.
  */
  const startingAt = new Map<string, Position>();
  for (const spot of SPOTS) {
    const man = nine[spot];
    if (man) startingAt.set(man.id, spot);
  }
  const standsFor = (p: Hitter, spot: Position): { text: string; tone: string } => {
    if (!available(p, day)) {
      const u = p as Hitter & { outUntil?: number };
      const left = typeof u.outUntil === 'number' ? u.outUntil - day : 0;
      return { text: left > 0 ? `OUT · ${left} MORE ${left === 1 ? 'DAY' : 'DAYS'}` : 'OUT', tone: 'var(--alert)' };
    }
    const at = startingAt.get(p.id);
    if (at === spot) return { text: 'TONIGHT\'S MAN HERE', tone: 'var(--win)' };
    if (at) return { text: `IN THE NINE · ${at}`, tone: 'var(--clay)' };
    return { text: 'BENCH', tone: 'var(--dim)' };
  };

  const spots = SPOTS;

  return (
    <FixedHeader
      header={
        <ModuleIntro kicker={`THE DEPTH CHART · ${men.length} MEN`} title="Who plays where" />
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
          The captain used to live here, above the chart. He has his own screen
          now (Captain.tsx) with every eligible man and the room's pick beside
          the decision -- and reported from testing, the leftover list here was
          two places to do the same job: 'you still have the name a captain
          button in the depth chart, it should no longer be there.'
        */}
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
                  border: '1px solid rgba(var(--ink-rgb), .28)',
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
                          {captainOf(team.team)?.id === p.id && <CaptainC />}
                          <span style={{ color: 'var(--dim)' }}> · {overallOf(p)}</span>
                          <span style={{
                            display: 'block',
                            font: "700 calc(7.5px * var(--ts))/1.4 var(--mono)",
                            letterSpacing: '.1em',
                            color: standsFor(p, spot).tone,
                          }}>{standsFor(p, spot).text}</span>
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
                            border: '1px solid rgba(var(--ink-rgb), .25)',
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
