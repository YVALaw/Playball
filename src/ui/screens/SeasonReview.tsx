// SeasonReview.tsx
// What the year came to.
//
// Your job first: the board's decision is the first thing on the page, and
// being let go is said at the top in red, with a button that says what happens
// next. Then how the year ended, the goals the board set in February with Met
// or Missed on each, the players who carried it, and what the season did to
// the program's prestige, with the reasons and the next star.

import { useEffect, useMemo } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { retirementStatus } from '../../engine/retirement.js';
import { GoalGrid } from './BoardGoals.js';
import { badgeOf } from '../../data/badges.js';
import { FirstVisit } from '../Tutorial.js';
import { rpiOrder, standings, regularRecord, seasonComplete } from '../../engine/season.js';
import { objectiveMet, prestigeStars, resignationCost, STAR_MARKS } from '../../engine/program.js';
import { ceremonyOf, type Finish } from '../../engine/postseason.js';
import type { Hitter, PlayerId } from '../../engine/types.js';
import { Trophy, type TrophyKind } from '../Honours.js';
import {
  Button, Callout, Card, CompareTable, Face, List, ListRow, Marquee, PlayerRow, StatGroup,
  StatusBadge, Table, Tag,
} from '../components/ui/index.js';
import { conferenceName, ordinal, plural, recordText, sentence, stateName } from '../words.js';
import { ContinueBar, StepScreen } from './OffseasonStep.js';
import type { StaffSeat } from '../../engine/economy.js';

/** The staff work card's order: the bats, the arms, then the network. */
const STAFF_ORDER: StaffSeat[] = ['hitting', 'pitching', 'recruiting'];

/** How far a season went, in the postseason's own words. */
const FINISH_WORDS: Record<Finish, string> = {
  missed: 'Missed the postseason',
  conference: 'Conference tournament',
  regional: 'Regionals',
  national: 'National tournament',
  omaha: 'National tournament',
  'runner-up': 'National runners-up',
  champion: 'National champions',
};

export function SeasonReview() {
  const season = useDynasty((s) => s.season);
  const review = useDynasty((s) => s.lastReview);
  const post = useDynasty((s) => s.lastPostseason);
  const year = useDynasty((s) => s.year);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const openOverlay = useDynasty((s) => s.openOverlay);
  // The February stamp and the June outcome: the two ends of the promise the
  // goals below settle.
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const endCareer = useDynasty((s) => s.endCareer);
  const ask = useDynasty((s) => s.boardAsk);
  const outcome = useDynasty((s) => s.lastOutcome);
  const economy = useDynasty((s) => s.economy);
  const team = useUserTeam();
  // Read once and cleared on mount: leaving without pressing anything still
  // counts as having been told.
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
  const displayFinish = finish ?? (outcome?.madeConferenceTournament ? 'conference' : undefined);
  const confName = conferenceName(team.conference);

  // The squad as it stood when June ended: by the draft step the rosters have
  // lost their seniors, and the review named somebody else on a revisit (M93).
  const squad = seasonComplete(season) ? ceremonyOf(season, team.index, post).squad : null;
  const hitters: { id: PlayerId; name: string }[] = squad
    ? squad.filter((m) => !m.pitcher) : [...team.team.lineup, ...team.team.bench] as Hitter[];
  const pitchers: { id: PlayerId; name: string }[] = squad
    ? squad.filter((m) => m.pitcher) : [...team.team.rotation, ...team.team.bullpen];

  // The player who carried the season, judged on production rather than rating.
  let mvp: { id: PlayerId; name: string; line: string } | null = null;
  let best = -1;
  for (const p of hitters) {
    const line = season.batting.get(p.id);
    if (!line || line.ab < 30) continue;
    const score = line.h + line.hr * 3 + line.rbi * 0.5 + line.bb * 0.3;
    if (score > best) {
      best = score;
      mvp = {
        id: p.id, name: p.name,
        line: `${(line.h / line.ab).toFixed(3).replace(/^0/, '')} average · ${plural(line.hr, 'home run')} · ${line.rbi} RBI`,
      };
    }
  }
  for (const p of pitchers) {
    const line = season.pitching.get(p.id);
    if (!line || line.outs < 90) continue;
    const era = (line.er * 27) / Math.max(1, line.outs);
    const score = (line.w * 8) + Math.max(0, (6 - era) * 12);
    if (score > best) {
      best = score;
      mvp = {
        id: p.id, name: p.name,
        line: `${recordText(line.w, line.l)} record · ${era.toFixed(2)} ERA · ${plural(line.k, 'strikeout')}`,
      };
    }
  }

  // The tops of the books, one player per question, on the awards' floors.
  const leaders: { id: PlayerId; name: string; line: string; k: string }[] = [];
  const bats = hitters
    .map((p) => ({ p, l: season.batting.get(p.id) }))
    .filter((x): x is { p: (typeof x)['p']; l: NonNullable<typeof x.l> } => !!x.l && x.l.ab >= 30);
  const arms = pitchers
    .map((p) => ({ p, l: season.pitching.get(p.id) }))
    .filter((x): x is { p: (typeof x)['p']; l: NonNullable<typeof x.l> } => !!x.l && x.l.outs >= 90);
  const bestBat = [...bats].sort((a, b) => b.l.h / b.l.ab - a.l.h / a.l.ab)[0];
  const bestPow = [...bats].sort((a, b) => b.l.hr - a.l.hr)[0];
  const bestArm = [...arms].sort((a, b) => a.l.er / a.l.outs - b.l.er / b.l.outs)[0];
  const bestK = [...arms].sort((a, b) => b.l.k - a.l.k)[0];
  if (bestBat) leaders.push({ id: bestBat.p.id, name: bestBat.p.name, k: 'Best average', line: `${(bestBat.l.h / bestBat.l.ab).toFixed(3).replace(/^0/, '')} on the year` });
  if (bestPow && bestPow.l.hr > 0 && bestPow.p.id !== bestBat?.p.id) {
    leaders.push({ id: bestPow.p.id, name: bestPow.p.name, k: 'Most home runs', line: plural(bestPow.l.hr, 'home run') });
  }
  if (bestArm) leaders.push({ id: bestArm.p.id, name: bestArm.p.name, k: 'Best ERA', line: `${((bestArm.l.er * 27) / bestArm.l.outs).toFixed(2)} over ${Math.floor(bestArm.l.outs / 3)} innings` });
  if (bestK && bestK.p.id !== bestArm?.p.id) {
    leaders.push({ id: bestK.p.id, name: bestK.p.name, k: 'Most strikeouts', line: plural(bestK.l.k, 'strikeout') });
  }

  // What the year is remembered as; nothing, for most of them.
  const wonConference = post?.conferenceChampions.includes(team.index) ?? false;
  const banner: { title: string; note: string; trophy?: TrophyKind } | null =
    post?.champion === team.index
      ? { title: 'National champions', note: `${team.def.school} win it all. Nothing moves a program further.`, trophy: 'national' }
      : finish === 'runner-up'
        ? { title: 'National runners-up', note: 'The last series of the year, and the wrong end of it. It counts, and it stings.', trophy: 'runnerUp' }
        : finish === 'omaha'
          ? { title: 'National tournament', note: `You reached the national tournament: the last 20 of ${season.teams.length}.` }
          : wonConference
            ? { title: `${confName} champions`, note: 'Won the conference tournament.', trophy: 'conference' }
            // A finish of 'regional' is written for every team that played a
            // regional and overwritten once one is won, so it means the run
            // ended there.
            : displayFinish === 'regional'
              ? { title: 'Regionals', note: 'Thirty-two programs got that far. Your run ended in yours.' }
              : displayFinish === 'conference'
                ? { title: 'Conference tournament', note: 'You made the postseason. The run ended before the regionals.' }
                : confRank === 1
                  ? { title: `${confName} regular-season champions`, note: 'The best record in the conference over the games that count for seeding.', trophy: 'conference' }
                  : null;

  /*
    And the other way a tenure ends. `last` is a career that is already over —
    he said so in the spring, or the years have run out — so leaving this page
    finishes it rather than starting a winter, and the store's own check at the
    same moment agrees (`careerFinished`). `asked` is only ever a question: the
    continue button still continues.
  */
  const seasons = Math.max(history.length, coach.tenure);
  const years = retirementStatus({ age: coach.age, seasons });
  const last = coach.farewellYear === year || years === 'over';
  // He handed in his notice, and this meeting is his last here (2026-09-30).
  const resigning = !last && coach.resignYear === year;
  // A coach the board has let go, or one who resigned, is not continuing to
  // anything: leaving this page ends the tenure and puts him on the market,
  // and the button says so.
  const leaving = review?.fired === true || resigning;
  // What the resignation costs as he leaves: the years after this season, read
  // off the coach exactly as `chargeResignation` reads them, so a review card
  // dismissed from the Board room cannot hide the price.
  const cost = resigning ? resignationCost(coach.contractYears) : 0;
  // Still asked when he resigned: Walk away ends it, Continue is the market.
  const asked = !last && !review?.fired && years === 'asked';
  const through = review ? year + review.contractYears : year;
  const job: { tone: 'positive' | 'warning' | 'negative' | 'info'; title: string } | null = !review ? null
    // A last meeting is about the career, not the contract. Everything below
    // this line is a board deciding what to do with you next year, and there
    // is no next year.
    : last ? {
      tone: 'info',
      title: coach.farewellYear === year
        ? 'Your last meeting with the board'
        : `The years call it at ${coach.age}`,
    }
    : resigning ? { tone: 'info', title: `Your last meeting at ${team.def.school}` }
    : review.fired ? { tone: 'negative', title: 'The board has let you go' }
      : review.notRenewed ? { tone: 'negative', title: 'The board did not renew your contract' }
        : review.renewed ? { tone: 'positive', title: `The board renewed your contract through ${through}` }
          : review.extended ? { tone: 'positive', title: `The board extended your contract through ${through}` }
            : review.securityAfter < 35 ? { tone: 'warning', title: 'You are on notice' }
              : { tone: review.verdict === 'exceeded' || review.verdict === 'met' ? 'positive' : 'info', title: review.headline ?? 'The board has reviewed your season' };

  // What the staff's season work added, man by man (and state by state); only what moved.
  const work = (economy.projectHistory ?? [])
    .filter((r) => r.season === true && r.year === year)
    .sort((a, b) => STAFF_ORDER.indexOf(a.seat) - STAFF_ORDER.indexOf(b.seat))
    .flatMap((r) => r.changes.map((c) => ({ r, c, b: Math.round(c.before), a: Math.round(c.after) })))
    .filter((x) => x.a > x.b);

  const delta = review ? review.prestigeAfter - review.prestigeBefore : 0;
  const nextMark = review ? STAR_MARKS.find((mark) => review.prestigeAfter < mark) : undefined;
  const metCount = ask && outcome ? ask.objectives.filter((o) => objectiveMet(o, outcome)).length : 0;

  return (
    <StepScreen
      bar={(
        <ContinueBar
          from="review"
          label={last ? 'See what you built' : leaving ? 'Look for a new job' : undefined}
          note={last
            ? `${seasons} seasons. Leaving this page closes the career.`
            : resigning && cost > 0 ? `Leaving this page ends your time here. −${cost} prestige.`
              : leaving ? 'Leaving this page ends your time here and puts you on the job market.' : undefined}
        />
      )}
    >
      <main className="pb-page">
        <FirstVisit id="review" />
        <Marquee
          eyebrow={`${team.def.school} · ${year} in the books`}
          title="Season review"
        />

        {job && review && (
          <Callout tone={job.tone} title={job.title}>
            {review.message}
            {/* A contract that runs through 2033 is not news to a man who
                finishes in 2028. */}
            {!last && !resigning && !review.fired && !review.notRenewed && !review.renewed && !review.extended
              ? ` Your contract runs through ${through}.` : ''}
          </Callout>
        )}

        <Card
          eyebrow="How the year ended"
          title={banner?.title ?? (displayFinish ? FINISH_WORDS[displayFinish] : `${year} season`)}
          trailing={banner?.trophy ? <Trophy kind={banner.trophy} size={56} label={banner.title} /> : undefined}
          footer={(
            <div className="pb-june__tools">
              <Button size="sm" variant="quiet" iconAfter="chevron-right" onClick={() => openOverlay('rankings')}>National ranking</Button>
              <Button size="sm" variant="quiet" iconAfter="chevron-right" onClick={() => openOverlay('standings')}>Conference</Button>
              <Button size="sm" variant="quiet" iconAfter="chevron-right" onClick={() => openOverlay('schedule')}>Schedule</Button>
            </div>
          )}
        >
          <p className="pb-text">{banner?.note ?? `${team.def.school} finish ${year} at ${recordText(played.w, played.l)}.`}</p>
          <StatGroup
            size="sm"
            items={[
              { label: 'Record', value: recordText(played.w, played.l), note: 'Regular season' },
              { label: 'National rank', value: nationalRank > 0 ? `#${nationalRank}` : '—', note: `of ${season.teams.length}` },
              { label: 'Conference', value: confRank > 0 ? ordinal(confRank) : '—', note: confName },
            ]}
          />
        </Card>

        {asked && (
          <Callout
            tone="neutral"
            icon="clock"
            eyebrow={`Age ${coach.age} · ${plural(seasons, 'season')}`}
            title="One more year?"
            action={{ label: 'Walk away', onClick: () => { void endCareer(); } }}
          >
            Carry on and nobody will mention it again until next June.
          </Callout>
        )}

        {earned.map((b) => (
          <Callout key={b.id} tone="positive" icon="star" eyebrow="New coach identity" title={b.name}>{b.line}</Callout>
        ))}

        {ask && outcome && (
          <Card
            eyebrow={`${sentence(ask.mandate)} year`}
            title="The board's goals"
            trailing={<StatusBadge tone={metCount === ask.objectives.length ? 'positive' : 'neutral'} icon={false}>{metCount} of {ask.objectives.length} met</StatusBadge>}
          >
            <GoalGrid
              objectives={ask.objectives}
              // Nothing is open at the meeting: the season is over, so a goal
              // that is not met is missed, and a bonus that is not met is just
              // a bonus nobody collected.
              state={(o) => (objectiveMet(o, outcome) ? 'met' : 'missed')}
            />
          </Card>
        )}

        {(mvp || leaders.length > 0) && (
          <Card title="The players who carried it" flush>
            <List className="pb-list--inset" label="Season leaders">
              {mvp && (
                <PlayerRow
                  name={mvp.name}
                  avatar={<Face id={mvp.id} team={team.def.abbr} size={40} />}
                  mark={<Tag tone="positive">Team MVP</Tag>}
                  meta={mvp.line}
                  onClick={() => openPlayer(mvp!.id)}
                />
              )}
              {leaders.map((l) => (
                <PlayerRow
                  key={`${l.id}-${l.k}`}
                  name={l.name}
                  avatar={<Face id={l.id} team={team.def.abbr} size={40} />}
                  tags={[l.k]}
                  meta={l.line}
                  onClick={() => openPlayer(l.id)}
                />
              ))}
            </List>
          </Card>
        )}

        {work.length > 0 && (
          <Card title="Staff work" flush>
            <List className="pb-list--inset" label="Staff work">
              {work.map(({ r, c, b, a }, i) => (c.id ? (
                <PlayerRow
                  key={`${r.seat}-${c.id}`}
                  name={c.name}
                  avatar={<Face id={c.id} team={team.def.abbr} size={40} />}
                  meta={`${c.attribute} ${b} → ${a}`}
                  value={`+${a - b}`}
                  onClick={() => openPlayer(c.id as PlayerId)}
                />
              ) : (
                <ListRow
                  key={`${r.seat}-${i}`}
                  icon="globe"
                  markTone="info"
                  title={stateName(c.name)}
                  subtitle={`Pipeline strength ${b} → ${a}`}
                  value={`+${a - b}`}
                />
              )))}
            </List>
          </Card>
        )}

        {review && (
          <Card eyebrow="What the season moved" title="Program prestige">
            <CompareTable
              label="Prestige and job security"
              labelHeader="Out of 100"
              from="February"
              to="Now"
              rows={[
                { label: 'Prestige', now: review.prestigeBefore, next: review.prestigeAfter, better: 'up' },
                { label: 'Job security', now: review.securityBefore, next: review.securityAfter, better: 'up' },
              ]}
            />
            {review.prestigeReasons?.length > 0 && (
              <Table
                dense
                label="Why prestige moved"
                columns={[
                  { label: 'Why prestige moved', grow: true },
                  { label: 'Change', width: '64px', align: 'right', strong: true },
                ]}
                rows={review.prestigeReasons.map((r, i) => ({
                  key: `${r.label}-${i}`,
                  cells: [r.label, `${r.amount > 0 ? '+' : r.amount < 0 ? '−' : ''}${Math.abs(r.amount)}`],
                }))}
              />
            )}
          </Card>
        )}
      </main>
    </StepScreen>
  );
}
