// RosterMoves.tsx
// The three things stage 8 lets a coach do to one man.
//
// Split out of `Player.tsx` rather than added to it, because that file is
// already the largest screen in the game and these three share one rule that is
// easier to hold in one place: **they are only ever offered for your own men**,
// and only when they are actually possible. A control that is visible and
// refuses is worse than one that is not there.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { standing, gradesOf, WORDS_A_SEASON, AT_RISK } from '../../engine/eligibility.js';
import { canRedshirt, MAX_REDSHIRTS, redshirtCount } from '../../engine/redshirt.js';
import { secondaryPositions } from '../../engine/positions.js';
import { chartFor, squad, available } from '../../engine/depthChart.js';
import { isHurt, prognosis } from '../../engine/injury.js';
import { legWeariness } from '../../engine/workload.js';
import { mood, promiseOf, squadRanks } from '../../engine/morale.js';
import { overallOf } from '../../engine/ratings.js';
import type { Hitter, Player as AnyPlayer, Position } from '../../engine/types.js';

const WORDS: Record<'fine' | 'watch' | 'trouble', { label: string; tone: string; line: string }> = {
  fine: {
    label: 'IN GOOD STANDING', tone: 'var(--win)',
    line: 'Nothing to do here.',
  },
  watch: {
    label: 'ON THE WATCH LIST', tone: 'var(--clay)',
    line: 'He is close to the line. A week could go either way.',
  },
  trouble: {
    label: 'FAILING', tone: 'var(--clay)',
    line: 'He is short of eligible and will start missing weeks.',
  },
};

export function RosterMoves({ p, isOurs }: { p: AnyPlayer; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const wordsUsed = useDynasty((s) => s.wordsUsed);
  const wordWith = useDynasty((s) => s.wordWith);
  const setRedshirt = useDynasty((s) => s.setRedshirt);
  const restMan = useDynasty((s) => s.restMan);
  const changePosition = useDynasty((s) => s.changePosition);
  const version = useDynasty((s) => s.version);
  // A career that asked its staff to decide who sits does not get the button.
  const mine = useDynasty((s) => handles(s.depth, 'redshirts'));
  const [moving, setMoving] = useState(false);
  void version;

  // Everything below is a thing a coach does to his own player. A leaderboard
  // is full of men you do not employ.
  if (!isOurs || !season) return null;
  const team = season.teams[userTeam]?.team;
  if (!team) return null;

  const school = standing(p);
  const sitting = (p as AnyPlayer & { redshirt?: boolean }).redshirt === true;
  const outUntil = (p as AnyPlayer & { outUntil?: number }).outUntil;
  const suspended = typeof outUntil === 'number' && season.dayIndex < outUntil;
  const wordsLeft = WORDS_A_SEASON - wordsUsed;
  // The real rule: one appearance burns the season, so this is only a decision
  // before the first pitch of the year.
  const preseason = season.dayIndex === 0;
  const canSit = preseason && mine && canRedshirt(p) && redshirtCount(team) < MAX_REDSHIRTS;

  /*
    The hardest three, not all of them.

    A shortstop can genuinely stand anywhere except behind the plate, so the
    honest list for him is six positions -- which on a card is a wall, and the
    three easiest of them tell you nothing you had not guessed. `secondaryPositions`
    already sorts hardest first, so the top of that list is the half worth
    printing: what he can do that is *not* obvious.
  */
  const alsoPlays = (p.type === 'hitter' ? secondaryPositions(p as Hitter) : []).slice(0, 3);

  /*
    The game says so, rather than waiting to be asked.

    A man behind somebody at his own position who could walk into a spot nobody
    owns is the one case worth raising unprompted -- it is the whole "your best
    athlete cannot stay at short" conversation, and a player who never opens
    this sheet would otherwise never find it. Read off the chart, so it is the
    same fact the chart is already showing rather than a second opinion.
  */
  const suggestion = (() => {
    if (p.type !== 'hitter') return null;
    const chart = chartFor(team);
    const rankAt = (spot: Position): number =>
      (chart[spot] ?? []).indexOf(p.id);
    if (rankAt(p.pos) <= 0) return null;              // he is the man there
    for (const spot of alsoPlays) {
      const holder = (chart[spot] ?? [])[0];
      const held = holder ? squad(team).find((m) => m.id === holder) : undefined;
      // Somewhere he would walk in ahead of whoever is there now.
      if (held && overallOf(held) < overallOf(p as Hitter)) return spot;
    }
    return null;
  })();

  const hurtNow = isHurt(p, season.dayIndex);
  const feeling = mood(p);
  const rank = squadRanks(team).get(p.id) ?? 20;
  const resting = !hurtNow && !available(p, season.dayIndex);
  const tired = legWeariness(p);

  return (
    <>
      {/* The trainer, first, because it is the thing that decides whether he
          is playing at all. */}
      {(hurtNow || resting) && (
        <>
          <div className="label" style={{ margin: '14px 0 6px' }}>THE TRAINER</div>
          <div style={{
            padding: '9px 11px', background: 'var(--paper)',
            borderLeft: '3px solid var(--clay)',
          }}>
            <div style={{
              font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.12em',
              color: 'var(--clay)',
            }}>{hurtNow ? String((p as { hurt?: string }).hurt ?? 'hurt').toUpperCase() : 'RESTED'}</div>
            <div style={{
              marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)",
            }}>
              {hurtNow
                ? `He is ${prognosis(p, season.dayIndex)}.`
                : 'You are keeping him off his feet. He is available again shortly.'}
            </div>
          </div>
        </>
      )}

      {/* How he is, and what he was told he would be. */}
      <div className="label" style={{ margin: '14px 0 6px' }}>THE ROOM</div>
      <div style={{ padding: '9px 11px', background: 'var(--paper)' }}>
        <div style={{
          font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.12em',
          color: feeling === 'unhappy' || feeling === 'restless' ? 'var(--clay)' : 'var(--win)',
        }}>{feeling.toUpperCase()}</div>
        <div style={{
          marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)",
        }}>
          He {promiseOf(p, rank)}.
          {tired > 0.5 && ' He has played a great many days in a row.'}
        </div>
        {!hurtNow && !resting && tired > 0.35 && mine && (
          <button
            className="tap"
            onClick={() => restMan(p.id, 3)}
            style={{
              marginTop: 8, width: '100%', padding: '9px 11px', minHeight: 40,
              background: 'var(--field)', border: '1px solid rgba(var(--ink-rgb), .32)',
              font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.11em',
            }}
          >GIVE HIM THREE DAYS</button>
        )}
      </div>

      <div className="label" style={{ margin: '14px 0 6px' }}>THE CLASSROOM</div>
      <div style={{
        padding: '9px 11px', background: 'var(--paper)',
        borderLeft: `3px solid ${WORDS[school].tone}`,
      }}>
        <div style={{
          font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.12em',
          color: WORDS[school].tone,
        }}>{WORDS[school].label}</div>
        <div style={{
          marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)",
        }}>{WORDS[school].line}</div>
        {suspended && (
          <div style={{
            marginTop: 4, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)",
            color: 'var(--clay)',
          }}>He is sitting out this week.</div>
        )}
        {school !== 'fine' && (
          <button
            className="tap"
            disabled={wordsLeft <= 0}
            onClick={() => wordWith(p.id)}
            style={{
              marginTop: 8, width: '100%', padding: '9px 11px', minHeight: 40,
              background: wordsLeft > 0 ? 'var(--field)' : 'transparent',
              border: '1px solid rgba(var(--ink-rgb), .32)',
              color: wordsLeft > 0 ? 'var(--ink)' : 'var(--dim)',
              font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.11em',
            }}
          >
            {wordsLeft > 0 ? `HAVE A WORD · ${wordsLeft} LEFT` : 'NO WORDS LEFT THIS SEASON'}
          </button>
        )}
      </div>

      {/* Where else he can stand, and moving him there for good. */}
      {p.type === 'hitter' && (
        <>
          <div className="label" style={{ margin: '14px 0 6px' }}>WHERE ELSE HE PLAYS</div>
          <div style={{ padding: '9px 11px', background: 'var(--paper)' }}>
            <div style={{ font: "400 calc(11.5px * var(--ts))/1.45 var(--body)" }}>
              {alsoPlays.length > 0
                ? `${p.pos} — and he can cover ${alsoPlays.join(', ')}.`
                : `${p.pos}, and nowhere else without it showing.`}
            </div>
            {suggestion && !moving && (
              <div style={{
                marginTop: 6, padding: '6px 9px',
                background: 'var(--field)', borderLeft: '3px solid var(--you)',
                font: "400 calc(11px * var(--ts))/1.45 var(--body)",
              }}>
                He is behind somebody here and would walk into {suggestion}.
              </div>
            )}
            {/*
              Was MOVE HIM FOR GOOD, and reported as not making sense. Fairly:
              "for good" was doing two jobs and neither of them clearly. It
              meant permanently — as against covering there for a night, which
              is what the depth chart already does — but it reads first as "for
              his benefit", so the control appeared to be offering to do the man
              a favour rather than to relist him.

              The distinction it was reaching for is a real one and worth
              keeping, so the line under the button now says it in words instead
              of asking one idiom to carry it.
            */}
            {alsoPlays.length > 0 && (
              <button
                className="tap"
                onClick={() => setMoving(!moving)}
                style={{
                  marginTop: 8, width: '100%', padding: '9px 11px', minHeight: 40,
                  background: 'var(--field)', border: '1px solid rgba(var(--ink-rgb), .32)',
                  font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.11em',
                }}
              >{moving ? 'NEVER MIND' : 'CHANGE HIS POSITION'}</button>
            )}
            {moving && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {alsoPlays.map((spot) => (
                  <button
                    key={spot}
                    className="tap"
                    onClick={() => { changePosition(p.id, spot as Position); setMoving(false); }}
                    style={{
                      padding: '7px 11px', minHeight: 34,
                      background: 'var(--paper)', border: '1px solid var(--you)',
                      color: 'var(--you)',
                      font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                    }}
                  >{spot}</button>
                ))}
              </div>
            )}
            {moving && (
              <div style={{
                marginTop: 6, font: "400 calc(10.5px * var(--ts))/1.45 var(--body)",
                color: 'var(--dim)',
              }}>
                This is where he is listed from now on, not cover for a night.
                He will be a step behind there for a season or two, and then he
                will not.
              </div>
            )}
          </div>
        </>
      )}

      {/* The redshirt, offered only while it is still a decision. */}
      {(canSit || sitting) && (
        <>
          <div className="label" style={{ margin: '14px 0 6px' }}>THE YEAR THAT DOES NOT COUNT</div>
          <div style={{ padding: '9px 11px', background: 'var(--paper)' }}>
            <div style={{ font: "400 calc(11.5px * var(--ts))/1.45 var(--body)" }}>
              {sitting
                ? 'He sits this season out. It costs him nothing but a year of '
                  + 'his life, and you have him one year longer.'
                : 'Sit him out and he keeps the season. He plays no games at '
                  + 'all, and he is yours a fifth year.'}
            </div>
            <button
              className="tap"
              onClick={() => setRedshirt(p.id, !sitting)}
              style={{
                marginTop: 8, width: '100%', padding: '9px 11px', minHeight: 40,
                background: sitting ? 'var(--field)' : 'var(--paper)',
                border: `1px solid ${sitting ? 'rgba(var(--ink-rgb), .32)' : 'var(--you)'}`,
                color: sitting ? 'var(--ink)' : 'var(--you)',
                font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.11em',
              }}
            >{sitting ? 'PLAY HIM AFTER ALL' : 'REDSHIRT HIM'}</button>
          </div>
        </>
      )}
    </>
  );
}
