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
        ? { title: 'National runners up', note: 'The last series of the year, and the wrong end of it. It counts, and it stings.' }
        : finish === 'omaha'
          ? { title: 'The national field', note: 'You reached the national showdown — the last twenty standing out of ninety six.' }
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
      header={<ModuleIntro kicker={`${team.def.school} · ${year}`} title="Season report" />}
      action={<FloatingAction label="CONTINUE" onClick={() => void next('review')} />}
    >
      <FirstVisit id="review" />
      <main className="module-workspace offseason-review season-report-workspace">
        <section className={`season-report-hero${post?.champion === team.index ? ' champion' : ''}`}>
          <div className="season-report-hero-copy">
            <small>{banner ? 'HOW THE YEAR ENDED' : 'FINAL REPORT'}</small>
            <h2>{banner?.title ?? (finish ? FINISH_LABEL[finish] : `${played.w}-${played.l}`)}</h2>
            <p>{banner?.note ?? `${team.def.school} close ${year} at ${played.w}-${played.l}.`}</p>
          </div>
          <div className="season-report-record">
            <strong>{played.w}-{played.l}</strong>
            <span>FINAL RECORD</span>
          </div>
          <div className="season-report-rankings">
            <button type="button" onClick={() => openOverlay('rankings')}>
              <small>NATIONAL</small><strong>{nationalRank > 0 ? `#${nationalRank}` : '—'}</strong>
            </button>
            <button type="button" onClick={() => openOverlay('standings')}>
              <small>{team.conference}</small><strong>{confRank > 0 ? `#${confRank}` : '—'}</strong>
            </button>
            <button type="button" onClick={() => openOverlay('schedule')}>
              <small>POSTSEASON</small><strong>{finish ? FINISH_LABEL[finish] : '—'}</strong>
            </button>
          </div>
        </section>

        {earned.length > 0 && (
          <section className="season-report-badges">
            {earned.map((b) => (
              <article key={b.id}>
                <StarIcon />
                <span><small>COACH IDENTITY EARNED</small><strong>{b.name}</strong><p>{b.line}</p></span>
              </article>
            ))}
          </section>
        )}

        {ask && outcome && (
          <section className="season-report-section">
            <header><span><small>THE BOARD</small><strong>{ask.mandate.toUpperCase()} YEAR</strong></span><em>{ask.objectives.filter((o) => objectiveMet(o, outcome)).length}/{ask.objectives.length} met</em></header>
            <div className="season-objective-grid">
              {ask.objectives.map((o) => {
                const met = objectiveMet(o, outcome);
                return (
                  <article key={o.key} className={met ? 'met' : 'missed'}>
                    <small>{o.required ? 'REQUIRED' : 'STRETCH'}</small>
                    <strong>{o.label}</strong>
                    <b>{met ? '✓ MET' : 'MISSED'}</b>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {leaders.length > 0 && (
          <section className="season-report-section">
            <header><span><small>THE MEN</small><strong>Season leaders</strong></span></header>
            <div className="season-leader-grid">
              {leaders.map((l) => (
                <button key={`${l.id}-${l.k}`} className="season-leader-card tap" type="button" onClick={() => openPlayer(l.id)}>
                  <Avatar id={l.id} team={team.def.abbr} size={36} />
                  <span><small>{l.k}</small><strong>{l.name}</strong><em>{l.line}</em></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {mvp && (
          <button className="season-mvp-feature tap" type="button" onClick={() => openPlayer(mvp.id)}>
            <span className="season-mvp-avatar"><Avatar id={mvp.id} team={team.def.abbr} size={58} /></span>
            <span><small>TEAM MVP</small><strong>{mvp.name}</strong><em>{mvp.line}</em></span>
            <b>OPEN CARD ›</b>
          </button>
        )}

        {review && (
          <section className="prestige-journey">
            <header><small>PROGRAM PRESTIGE</small><strong>What the season moved</strong></header>
            <div className="prestige-journey-line">
              <span><small>FEBRUARY</small><strong>{review.prestigeBefore}</strong></span>
              <i><b style={{ width: `${Math.max(8, Math.min(100, review.prestigeAfter))}%` }} /></i>
              <span className="change"><small>CHANGE</small><strong>{delta > 0 ? '+' : ''}{delta}</strong></span>
              <span><small>NOW</small><strong>{review.prestigeAfter}</strong></span>
            </div>
            <p>{review.message}</p>
          </section>
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
