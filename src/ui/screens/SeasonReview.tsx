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
import type { Hitter, PlayerId } from '../../engine/types.js';

export function SeasonReview() {
  const season = useDynasty((s) => s.season);
  const review = useDynasty((s) => s.lastReview);
  const post = useDynasty((s) => s.lastPostseason);
  const year = useDynasty((s) => s.year);
  const next = useDynasty((s) => s.nextPhase);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const openOverlay = useDynasty((s) => s.openOverlay);
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
