// SeasonReview.tsx
// What the year came to.
//
// The one screen in the offseason that is purely a verdict: the record, where
// you finished nationally and in your region, the player who carried you, and
// what the whole thing did to the program's standing.
//
// Prestige is shown as the arithmetic — what it was, what the season moved it,
// what it is now — because that number is the currency everything else in the
// dynasty is priced in. Recruiting gates on it, jobs gate on it, and a player
// who only ever sees the final figure never learns what moves it.

import { useEffect, useMemo } from 'react';

import { useDynasty, useUserTeam } from '../../state/store.js';
import { badgeOf } from '../../data/badges.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { StarIcon } from '@radix-ui/react-icons';
import { ModuleIntro } from '../components/Kit.js';
import { FirstVisit } from '../Tutorial.js';
import { Avatar } from '../Avatar.js';
import { rpiOrder, standings, regularRecord } from '../../engine/season.js';
import { overallOf } from '../../engine/ratings.js';
import { FINISH_LABEL } from '../../engine/postseason.js';
import { objectiveMet } from '../../engine/program.js';
import type { Hitter, PlayerId } from '../../engine/types.js';

export function SeasonReview() {
  const season = useDynasty((s) => s.season);
  const review = useDynasty((s) => s.lastReview);
  const post = useDynasty((s) => s.lastPostseason);
  const year = useDynasty((s) => s.year);
  const next = useDynasty((s) => s.nextPhase);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const openOverlay = useDynasty((s) => s.openOverlay);
  // The February stamp and the June outcome — the two ends of the promise the
  // checklist below settles. Hooks, so they live above the early return.
  const ask = useDynasty((s) => s.boardAsk);
  const outcome = useDynasty((s) => s.lastOutcome);
  const team = useUserTeam();
  /*
    Read once and cleared, so the card fires on the season it belongs to.

    Cleared on mount rather than on the button, because a player who leaves this
    screen without pressing anything has still been told -- and being told twice
    would make the rarest thing in the stage feel like a notification.
  */
  const newBadges = useDynasty((s) => s.newBadges);
  const clearNewBadges = useDynasty((s) => s.clearNewBadges);
  const earned = useMemo(
    () => newBadges.map((id) => badgeOf(id)).filter((b): b is NonNullable<typeof b> => !!b),
    [newBadges],
  );
  useEffect(() => {
    if (newBadges.length > 0) return () => clearNewBadges();
    return undefined;
  }, [newBadges.length, clearNewBadges]);

  if (!season || !team) return null;

  const played = regularRecord(team);
  const nationalRank = rpiOrder(season).findIndex((r) => r.team.index === team.index) + 1;
  const conf = standings(season, team.conference);
  const confRank = conf.findIndex((t) => t.index === team.index) + 1;
  const finish = post?.finish[team.index];

  // The man who carried the season. Judged on production, not on rating, so it
  // is a report of what happened rather than a second look at the roster page.
  let mvp: { id: PlayerId; name: string; line: string } | null = null;
  let best = -1;
  for (const p of [...team.team.lineup, ...team.team.bench] as Hitter[]) {
    const line = season.batting.get(p.id);
    if (!line || line.ab < 30) continue;
    const score = line.h + line.hr * 3 + line.rbi * 0.5 + line.bb * 0.3;
    if (score > best) {
      best = score;
      mvp = {
        id: p.id,
        name: p.name,
        line: `${(line.h / line.ab).toFixed(3).replace(/^0/, '')} · ${line.hr} HR · ${line.rbi} RBI`,
      };
    }
  }
  for (const p of [...team.team.rotation, ...team.team.bullpen]) {
    const line = season.pitching.get(p.id);
    if (!line || line.outs < 90) continue;
    const era = (line.er * 27) / Math.max(1, line.outs);
    const score = (line.w * 8) + Math.max(0, (6 - era) * 12);
    if (score > best) {
      best = score;
      mvp = {
        id: p.id,
        name: p.name,
        line: `${line.w}-${line.l} · ${era.toFixed(2)} ERA · ${line.k} K`,
      };
    }
  }

  const delta = review ? review.prestigeAfter - review.prestigeBefore : 0;

  /*
    The tops of the books, one man per question. Thirty at-bats and ninety
    outs are the same floors the awards use, so a leader here is a man the
    line genuinely belongs to rather than whoever went two-for-three once.
  */
  const leaders: { id: PlayerId; name: string; line: string; k: string }[] = [];
  const bats = ([...team.team.lineup, ...team.team.bench] as Hitter[])
    .map((p) => ({ p, l: season.batting.get(p.id) }))
    .filter((x): x is { p: Hitter; l: NonNullable<typeof x.l> } => !!x.l && x.l.ab >= 30);
  const arms = [...team.team.rotation, ...team.team.bullpen]
    .map((p) => ({ p, l: season.pitching.get(p.id) }))
    .filter((x): x is { p: (typeof x)['p']; l: NonNullable<typeof x.l> } => !!x.l && x.l.outs >= 90);
  const bestBat = [...bats].sort((a, b) => b.l.h / b.l.ab - a.l.h / a.l.ab)[0];
  const bestPow = [...bats].sort((a, b) => b.l.hr - a.l.hr)[0];
  const bestArm = [...arms].sort((a, b) => a.l.er / a.l.outs - b.l.er / b.l.outs)[0];
  const bestK = [...arms].sort((a, b) => b.l.k - a.l.k)[0];
  if (bestBat) leaders.push({ id: bestBat.p.id, name: bestBat.p.name, k: 'AVG', line: `${(bestBat.l.h / bestBat.l.ab).toFixed(3).replace(/^0/, '')} on the year` });
  if (bestPow && bestPow.l.hr > 0 && bestPow.p.id !== bestBat?.p.id) {
    leaders.push({ id: bestPow.p.id, name: bestPow.p.name, k: 'HR', line: `${bestPow.l.hr} home runs` });
  }
  if (bestArm) leaders.push({ id: bestArm.p.id, name: bestArm.p.name, k: 'ERA', line: `${((bestArm.l.er * 27) / bestArm.l.outs).toFixed(2)} across ${Math.floor(bestArm.l.outs / 3)} innings` });
  if (bestK && bestK.p.id !== bestArm?.p.id) {
    leaders.push({ id: bestK.p.id, name: bestK.p.name, k: 'K', line: `${bestK.l.k} strikeouts` });
  }

  // What the year is remembered as. Null for a season that is remembered as
  // nothing, which is most of them.
  const wonConference = post?.conferenceChampions.includes(team.index) ?? false;
  const banner: { title: string; note: string } | null =
    post?.champion === team.index
      ? {
          title: 'National champions',
          note: `${team.def.school} win it all. Nothing you do to a program moves it further.`,
        }
      : finish === 'runner-up'
        ? { title: 'National runners up', note: 'One game short in Omaha. It counts, and it stings.' }
        : finish === 'omaha'
          ? { title: 'Omaha', note: 'You made the College World Series. Four teams out of ninety six.' }
          : wonConference
            ? {
                title: `${team.conference} champions`,
                note: 'Won the conference tournament and the automatic bid that comes with it.',
              }
            : finish === 'regional'
              /*
                Reported: "it told me I reached the nationals but I actually
                didn't, I lost in the regionals and was 22nd."

                He was right and the banner was wrong. A finish of 'regional' is
                written for every team that *played* a regional, and it is
                overwritten with 'omaha' the moment one is won -- so the string
                means the opposite of what this line claimed. Thirty two get to
                the regionals; twenty come out of them into the national field.
              */
              ? { title: 'Regionals', note: 'Thirty two programs got that far. Your run ended in yours.' }
              : confRank === 1
                ? {
                    title: `${team.conference} regular season`,
                    note: 'Best record in the conference over the games that count for seeding.',
                  }
                : null;

  return (
    <FixedHeader
      header={
        <ModuleIntro kicker={`${team.def.school} · ${year}`} title="The season" />
      }
      action={<FloatingAction label="CONTINUE" onClick={() => void next('review')} />}
    >
    <FirstVisit id="review" />
    <main className="module-workspace">
      {/*
        What the year made you, said once.

        Above the banner on purpose. A badge is the rarer thing -- most seasons
        do not produce one -- and it is about the man rather than the record, so
        it should not be read as a footnote to a win total.

        The counters behind it are never shown and never will be. Somebody who
        can see he is four mound visits away stops going to the mound because he
        wants to and starts going because he is four away, which is the
        difference between a coach and a checklist.
      */}
      {earned.length > 0 && (
        <>
          {earned.map((b) => (
            <section className="award-feature rise-in" key={b.id}>
              <StarIcon />
              <small>THEY HAVE STARTED SAYING</small>
              <h2>{b.name}</h2>
              <p>{b.line}</p>
            </section>
          ))}
        </>
      )}
      {/*
        The banner, and only when the season earned one.

        A dark slab reading "MISSED THE TOURNAMENT" every June is a slab nobody
        reads; silence is the honest treatment of a year that went nowhere. When
        there *is* something to say it is the first thing on the screen, because
        it is the answer to the only question the screen exists to answer.
      */}
      {banner && (
        <section className="season-verdict rise-in">
          <small>FINISHED</small>
          <strong>{banner.title}</strong>
          <p>{banner.note}</p>
        </section>
      )}

      <div style={{
        display: 'flex', marginTop: 14,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {/*
          Every number here is a door.
          
          A verdict screen that only states its conclusions is a screen you read
          once; the record is a season of games, the national rank is a table you
          are somewhere in, and the MVP is a player. Making them tap through is
          what turns the summary into a way into the season rather than the end
          of it.
        */}
        <Tile k="RECORD" v={`${played.w}-${played.l}`} onClick={() => openOverlay('schedule')} />
        <Tile
          k="NATIONAL"
          v={nationalRank > 0 ? `#${nationalRank}` : '—'}
          onClick={() => openOverlay('rankings')}
        />
        <Tile
          k={team.conference}
          v={confRank > 0 ? `#${confRank}` : '—'}
          onClick={() => openOverlay('standings')}
          last
        />
      </div>

      {/*
        The finish stripe only when the banner did not already say it. A June
        that earned the big slab does not need the same fact repeated two
        inches lower in a smaller voice.
      */}
      {finish && !banner && (
        <div style={{
          marginTop: 10, padding: '11px 12px',
          background: 'var(--paper)', borderLeft: '3px solid var(--clay)',
          font: "400 calc(12.5px * var(--ts))/1.5 var(--body)",
        }}>
          <strong>{FINISH_LABEL[finish]}</strong>
        </div>
      )}

      {/*
        What the board asked in February, box by box — the same stamped
        checklist the program page showed all season (see `boardAsk`), settled
        here where the year is judged. Part of the "expand the review" pass:
        the screen stated conclusions and skipped the terms they were reached
        on.
      */}
      {ask && outcome && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
            WHAT THE BOARD ASKED · {ask.mandate.toUpperCase()}
          </div>
          <div style={{
            padding: '4px 12px', border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            {ask.objectives.map((o, i) => {
              const met = objectiveMet(o, outcome);
              return (
                <div
                  key={o.key}
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: 10,
                    alignItems: 'baseline', padding: '9px 0',
                    borderBottom: i < ask.objectives.length - 1 ? '1px solid var(--hairline)' : 'none',
                  }}
                >
                  <span style={{ font: "400 calc(12.5px * var(--ts))/1.4 var(--body)" }}>
                    {o.label}
                    {!o.required && (
                      <span style={{ color: 'var(--dim)', font: "400 calc(10px * var(--ts)) var(--body)" }}>
                        {' '}· stretch
                      </span>
                    )}
                  </span>
                  <b style={{
                    flex: 'none',
                    font: "800 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                    color: met ? 'var(--win)' : 'var(--alert)',
                  }}>{met ? 'MET' : 'MISSED'}</b>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* The men behind the record — the top of each book, every name a door.
          Same expansion pass: an MVP alone said who carried it and nothing
          about who else showed up. */}
      {leaders.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>SEASON LEADERS</div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {leaders.map((l, i) => (
              <button
                key={l.id}
                onClick={() => openPlayer(l.id)}
                style={{
                  width: '100%', display: 'flex', gap: 10, alignItems: 'center',
                  textAlign: 'left', padding: '9px 12px', background: 'transparent',
                  borderBottom: i < leaders.length - 1 ? '1px solid var(--hairline)' : 'none',
                }}
              >
                <Avatar id={l.id} team={team.def.abbr} size={30} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', font: "700 calc(12.5px * var(--ts))/1.2 var(--body)" }}>{l.name}</span>
                  <span style={{ display: 'block', font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{l.line}</span>
                </span>
                <span className="label" style={{ flex: 'none' }}>{l.k}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {mvp && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>TEAM MVP</div>
          <button
            onClick={() => openPlayer(mvp.id)}
            style={{
              width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center',
              padding: '12px', border: '1px solid var(--faint)', background: 'var(--paper)',
            }}
          >
            <Avatar id={mvp.id} team={team.def.abbr} size={46} />
            <span>
              <span style={{
                display: 'block', font: "700 calc(18px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
              }}>{mvp.name}</span>
              <span style={{
                display: 'block', marginTop: 4, font: "400 calc(11.5px * var(--ts)) var(--mono)", color: 'var(--dim)',
              }}>{mvp.line}</span>
            </span>
          </button>
        </>
      )}

      {review && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
            PROGRAM PRESTIGE
          </div>
          <div style={{
            padding: '14px 12px', border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <Step k="WAS" v={String(review.prestigeBefore)} />
              <Step
                k="THE SEASON"
                v={`${delta > 0 ? '+' : ''}${delta}`}
                tone={delta > 0 ? 'var(--win)' : delta < 0 ? 'var(--clay)' : 'var(--dim)'}
              />
              <Step k="NOW" v={String(review.prestigeAfter)} accent />
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)',
              font: "400 calc(12px * var(--ts))/1.55 var(--body)",
            }}>{review.message}</div>
          </div>
        </>
      )}
    </main>
    </FixedHeader>
  );
}

function Tile(
  { k, v, last, onClick }:
  { k: string; v: string; last?: boolean; onClick?: () => void },
) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        flex: 1, padding: '11px 8px', textAlign: 'left', background: 'transparent',
        borderRight: last ? 'none' : '1px solid var(--hairline)',
      }}
    >
      <div className="label">{k}</div>
      <div style={{
        font: "700 calc(22px * var(--ts))/1 var(--display)", marginTop: 4,
        color: onClick ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </button>
  );
}

function Step({ k, v, tone, accent }: { k: string; v: string; tone?: string; accent?: boolean }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div style={{
        font: `700 calc(${accent ? 26 : 22}px * var(--ts))/1 var(--display)`, marginTop: 3,
        color: tone ?? (accent ? 'var(--clay)' : 'var(--ink)'),
      }}>{v}</div>
    </div>
  );
}
