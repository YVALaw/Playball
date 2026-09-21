// Today.tsx
// The screen that moves time.
//
// It answers three questions, in this order: what is tonight, what stops me
// from playing it, and how is the week going. At most one warning sits above
// the game when something blocks play, with its fix as the action; the game
// card says both starters and every way to play the night, and the sims say how
// far they go. Below that: what needs you, the recruiting week, the games
// around tonight and three season numbers.

import { useEffect, useRef, useState } from 'react';
import { FINISH_LABEL, conferenceField } from '../../engine/postseason.js';
import { RECRUITING_WEEKS, totalWeekSpend } from '../../engine/recruiting.js';
import { boardBudget, useConferenceTable, useDynasty, useUserTeam } from '../../state/store.js';
import {
  seasonComplete, nationalRank, pollIsProjected, era, startableSlot, injuryClock, currentDay,
  type SeasonState, type TeamRecord, type GameSummary,
} from '../../engine/season.js';
import { SCOUT_COST, dollars } from '../../engine/economy.js';
import { FirstVisit } from '../Tutorial.js';
import { useOpenTeam } from './TeamCard.js';
import { BoxScoreSheet } from './Schedule.js';
import { seasonDate, pct, longDate, shortDate } from '../format.js';
import { NeedsYou, useNeeds } from '../Needs.js';
import { seriesStake } from '../../engine/world.js';
import { teamReads } from '../../engine/tendencies.js';
import {
  Button, Callout, Card, GameCard, GameRow, Icon, List, Marquee, Meter, SectionHeader,
  StatusBadge,
} from '../components/ui/index.js';
import { Crest } from '../Crest.js';
import { conferenceName, ordinal, plural, recordText } from '../words.js';
import type { Arm } from '../../engine/types.js';

export { longDate, shortDate } from '../format.js';

/** A team's collective batting average, off the season books. */
function teamAverage(season: SeasonState, t: TeamRecord): number | null {
  let h = 0, ab = 0;
  for (const p of [...t.team.lineup, ...t.team.bench]) {
    const line = season.batting.get(p.id);
    if (!line) continue;
    h += line.h; ab += line.ab;
  }
  return ab >= 20 ? h / ab : null;
}

/** And its collective ERA, same construction. */
function teamEra(season: SeasonState, t: TeamRecord): number | null {
  let er = 0, outs = 0;
  for (const p of [...t.team.rotation, ...t.team.bullpen]) {
    const line = season.pitching.get(p.id);
    if (!line) continue;
    er += line.er; outs += line.outs;
  }
  return outs >= 27 ? (er * 27) / outs : null;
}

export function Today() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const year = useDynasty((s) => s.year);
  // A season a coach has announced as his last reads differently all the way
  // through, starting with the line at the top of the screen he opens daily.
  const farewellYear = useDynasty((s) => s.coach.farewellYear);
  const advanceDay = useDynasty((s) => s.advanceDay);
  const simWeek = useDynasty((s) => s.simWeek);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const playPostseason = useDynasty((s) => s.playPostseason);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const openOffseason = useDynasty((s) => s.openOffseason);
  const go = useDynasty((s) => s.go);
  const busy = useDynasty((s) => s.busy);
  const progress = useDynasty((s) => s.progress);
  const live = useDynasty((s) => s.live);
  const liveStarting = useDynasty((s) => s.liveStarting);
  const pendingGame = useDynasty((s) => s.pendingGame);
  const resumeGame = useDynasty((s) => s.resumeGame);
  const rivalry = useDynasty((s) => s.rivalry);
  const economy = useDynasty((s) => s.economy);
  const setPlaybookFocus = useDynasty((s) => s.setPlaybookFocus);
  const openPlayer = useDynasty((s) => s.openPlayer);
  /*
    The desk does not advance past a decision only you can make: a starter who
    cannot play, a failing player you still have a talk for. Those freeze the
    ways time moves; everything else on the screen stays live.
  */
  const needs = useNeeds();
  const musts = needs.filter((n) => n.must);
  const held = musts.length > 0;
  const openTeam = useOpenTeam();
  const team = useUserTeam();
  const table = useConferenceTable();
  void version;

  /*
    A beat before a sim resolves. A day sims in milliseconds, and a result that
    lands the frame the thumb does reads as though nothing was played. It
    doubles as the double-tap guard for these two controls.
  */
  const [thinking, setThinking] = useState<'game' | 'week' | null>(null);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const think = (which: 'game' | 'week', run: () => void): void => {
    if (thinking !== null) return;
    setThinking(which);
    thinkTimer.current = setTimeout(() => {
      thinkTimer.current = null;
      setThinking(null);
      run();
    }, 800);
  };
  useEffect(() => () => { if (thinkTimer.current) clearTimeout(thinkTimer.current); }, []);

  /** A finished game, opened off the week's list. */
  const [openGame, setOpenGame] = useState<GameSummary | null>(null);

  if (!season || !team) return null;

  const done = seasonComplete(season);
  const farewell = farewellYear === year;
  const day = season.schedule[season.dayIndex];
  const rank = nationalRank(season, team.index);
  const projected = pollIsProjected(season);

  const todayGame = day?.games.find((g) => g.home === team.index || g.away === team.index);
  const opponent = todayGame
    ? season.teams[todayGame.home === team.index ? todayGame.away : todayGame.home]
    : null;
  const atHome = todayGame?.home === team.index;
  const formerAssistant = opponent?.coach
    ? (economy.tree ?? []).find((branch) => branch.name === opponent.coach?.name)
    : undefined;
  const activePlaybook = opponent ? season.playbooks?.[opponent.def.abbr] : undefined;
  const prepRead = opponent && activePlaybook ? teamReads(opponent.team)[0] : undefined;

  // Tonight's probable starters, picked exactly the way the engine will.
  const slot = todayGame?.slot ?? 0;
  const clock = injuryClock(season);
  const today = currentDay(season);
  const ourArm = team.team.rotation[startableSlot(season, team.team, slot, today, clock)] ?? team.team.rotation[0];
  const theirArm = opponent
    ? opponent.team.rotation[startableSlot(season, opponent.team, slot, today, clock)] ?? opponent.team.rotation[0]
    : null;
  const armEra = (p: Arm | null | undefined): string | undefined => {
    if (!p) return undefined;
    const line = season.pitching.get(p.id);
    return line && line.outs >= 9 ? `${era(line).toFixed(2)} ERA` : 'No innings yet';
  };

  // Where the series stands, when tonight is part of one.
  const seriesSoFar = todayGame && opponent && day?.kind === 'series'
    ? season.results.filter((r) =>
      Math.abs(r.day - day.day) <= 3
      && ((r.home === team.index && r.away === opponent.index)
        || (r.away === team.index && r.home === opponent.index)))
    : [];
  const seriesWins = seriesSoFar.filter((r) => (r.home === team.index) === (r.homeRuns > r.awayRuns)).length;
  const stake = day?.kind === 'series' ? seriesStake(seriesSoFar.length, seriesWins) : null;
  const seriesName = opponent && opponent.conference === team.conference ? 'Conference series' : 'Weekend series';
  const gameNo = seriesSoFar.length + 1;
  const kind = day?.kind === 'series'
    ? seriesSoFar.length === 0 ? `${seriesName} · Game 1 of 3`
      : seriesWins * 2 > seriesSoFar.length ? `Game ${gameNo} · You lead ${recordText(seriesWins, seriesSoFar.length - seriesWins)}`
        : seriesWins * 2 < seriesSoFar.length ? `Game ${gameNo} · They lead ${recordText(seriesSoFar.length - seriesWins, seriesWins)}`
          : `Game ${gameNo} · Series level`
    : 'Midweek';

  const ourAvg = teamAverage(season, team);
  const ourEra = teamEra(season, team);
  const confRank = table.findIndex((t) => t.index === team.index) + 1;

  const playLocked = held && !live;
  const firstMust = musts[0];
  const busyNow = busy || liveStarting;

  return (
    <>
      <main className="pb-page" aria-label="Today">
        <FirstVisit id="today" />
        <Marquee
          mark={<Crest abbr={team.def.abbr} size={44} />}
          eyebrow={farewell
            ? `${done ? 'The last one is over' : longDate(year, day?.day ?? 0)} · Your last season`
            : done ? `${year} · The regular season is over` : `${longDate(year, day?.day ?? 0)} · Week ${day?.week ?? 1}`}
          title="Today"
          trailing={rank ? (
            <StatusBadge tone="neutral" size="lg" icon={false}>
              #{rank} {projected ? 'projected' : 'nationally'}
            </StatusBadge>
          ) : undefined}
          numbers={[
            {
              label: 'Record',
              value: recordText(team.w, team.l),
              note: team.cw + team.cl > 0
                ? `${ordinal(confRank)} in ${conferenceName(team.conference)}`
                : conferenceName(team.conference),
            },
            {
              label: 'Team AVG',
              value: ourAvg === null ? '—' : pct(ourAvg),
              note: ourAvg === null ? (team.gp === 0 ? 'No games yet' : 'Too few at-bats') : `${plural(team.rs, 'run')} scored`,
            },
            {
              label: 'Team ERA',
              value: ourEra === null ? '—' : ourEra.toFixed(2),
              note: ourEra === null ? (team.gp === 0 ? 'No innings' : 'Too few innings') : `${plural(team.ra, 'run')} allowed`,
            },
          ]}
        />

        {firstMust && !done && (
          <Callout
            tone="warning"
            eyebrow="Before you play"
            title={firstMust.title}
            action={{ label: firstMust.cta, variant: 'secondary', onClick: firstMust.go }}
          >
            {firstMust.note}{musts.length > 1 ? ` ${plural(musts.length - 1, 'more')} below.` : ''}
          </Callout>
        )}

        {/*
          The game a phone call took away, offered back rather than restored:
          being dropped into the seventh inning of a game you forgot is its own
          kind of lost. Declining lets the bench coach finish it.
        */}
        {pendingGame && (
          <Card
            eyebrow="Game in progress"
            title="You left this one on the field"
            footer={(
              <div className="pb-buttons-2">
                <Button variant="secondary" onClick={() => void resumeGame(false)}>Let them finish</Button>
                <Button variant="primary" icon="play" onClick={() => void resumeGame(true)}>Pick it up</Button>
              </div>
            )}
          >
            <p className="pb-text">{pendingGame.line}</p>
          </Card>
        )}

        {todayGame && opponent && (
          <GameCard
            label="Tonight's game"
            when="Tonight"
            kind={kind}
            away={atHome
              ? { abbr: opponent.def.abbr, name: opponent.def.school, record: recordText(opponent.w, opponent.l), onClick: () => openTeam(opponent.index) }
              : { abbr: team.def.abbr, name: team.def.school, record: recordText(team.w, team.l), you: true, onClick: () => openTeam(team.index) }}
            home={atHome
              ? { abbr: team.def.abbr, name: team.def.school, record: recordText(team.w, team.l), you: true, onClick: () => openTeam(team.index) }
              : { abbr: opponent.def.abbr, name: opponent.def.school, record: recordText(opponent.w, opponent.l), onClick: () => openTeam(opponent.index) }}
            facts={[
              { label: 'Your starter', value: <button type="button" className="pb-inline-link" onClick={() => ourArm && openPlayer(ourArm.id, 'stats')}>{ourArm?.name ?? '—'}</button>, note: armEra(ourArm) },
              { label: 'Their starter', value: <button type="button" className="pb-inline-link" onClick={() => theirArm && openPlayer(theirArm.id, 'stats')}>{theirArm?.name ?? '—'}</button>, note: armEra(theirArm) },
            ]}
            actions={(
              <>
                <Button variant="secondary" icon="rows" onClick={() => go('team', 'lineup')}>Set lineup</Button>
                <Button
                  variant="primary"
                  icon={playLocked ? 'lock' : 'play'}
                  data-guide="play-ball"
                  disabled={busyNow || thinking !== null || playLocked || pendingGame !== null}
                  onClick={() => void startManagedGame()}
                >{live ? 'Back to the game' : 'Play ball'}</Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyNow || !!live || held || pendingGame !== null || thinking === 'week'}
                  onClick={() => think('game', advanceDay)}
                >{thinking === 'game' ? <span className="pb-spinner" aria-label="Simulating" /> : 'Sim tonight'}</Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyNow || !!live || held || pendingGame !== null || thinking === 'game'}
                  onClick={() => think('week', simWeek)}
                >{thinking === 'week' ? <span className="pb-spinner" aria-label="Simulating" /> : 'Sim to Sunday'}</Button>
              </>
            )}
            actionsNote={pendingGame !== null
              ? 'Finish the game in progress first.'
              : held && !live
                ? 'Settle what needs you first.'
                : undefined}
          >
            {(stake || opponent.def.abbr === team.def.rival || formerAssistant) && (
              <ul className="pb-game__notes">
                {stake && <li><Icon name="target" size={16} />{stake}</li>}
                {opponent.def.abbr === team.def.rival && (
                  <li><Icon name="star-filled" size={16} />
                    Rivalry game. {rivalry.w + rivalry.l > 0
                      ? rivalry.w >= rivalry.l
                        ? `You lead the series ${recordText(rivalry.w, rivalry.l)}.`
                        : `They lead the series ${recordText(rivalry.l, rivalry.w)}.`
                      : 'The first one on your watch.'}
                  </li>
                )}
                {formerAssistant && (
                  <li><Icon name="person" size={16} />
                    {opponent.coach?.name} spent {plural(formerAssistant.yearsWithYou, 'year')} on your staff.
                  </li>
                )}
              </ul>
            )}
            {activePlaybook ? (
              <div className="pb-inlinerow is-positive">
                <Icon name="check-circled" size={16} />
                <span className="pb-inlinerow__text">Playbook on{prepRead ? `: ${prepRead.title}` : ''}</span>
                <Button size="sm" variant="quiet" onClick={() => { setPlaybookFocus(opponent.def.abbr); go('program', 'strategy'); }}>Open</Button>
              </div>
            ) : (
              <div className="pb-inlinerow">
                <Icon name="file" size={16} />
                <span className="pb-inlinerow__text">No scouting report</span>
                <Button size="sm" variant="quiet" meta={dollars(SCOUT_COST)} onClick={() => openTeam(opponent.index)}>Scout</Button>
              </div>
            )}
          </GameCard>
        )}

        {!todayGame && !done && (
          <Card
            eyebrow={`Week ${day?.week ?? 1}`}
            title="Off day"
            footer={(
              <div className="pb-buttons-2">
                <Button
                  variant="secondary"
                  disabled={busyNow || !!live || held || pendingGame !== null || thinking === 'week'}
                  onClick={() => think('game', advanceDay)}
                >{thinking === 'game' ? <span className="pb-spinner" aria-label="Simulating" /> : 'Next day'}</Button>
                <Button
                  variant="primary"
                  disabled={busyNow || !!live || held || pendingGame !== null || thinking === 'game'}
                  onClick={() => think('week', simWeek)}
                >{thinking === 'week' ? <span className="pb-spinner" aria-label="Simulating" /> : 'Sim to Sunday'}</Button>
              </div>
            )}
          >
          </Card>
        )}

        {busy && progress && (
          <Card title="Simulating">
            <Meter
              label={`Day ${progress.day} of ${progress.totalDays}`}
              valueText={`${Math.round((progress.day / progress.totalDays) * 100)}%`}
              value={progress.day}
              max={progress.totalDays}
            />
          </Card>
        )}

        {done && !lastPostseason && (
          <Card
            eyebrow={`${year} · The regular season is in the books`}
            title="June is here"
            footer={(
              <Button variant="primary" block disabled={busy} onClick={() => void playPostseason()}>
                {busy ? 'Playing…' : 'Play the postseason'}
              </Button>
            )}
          >
            <p className="pb-text">{recordText(team.w, team.l)}, and now the games that get remembered.</p>
          </Card>
        )}

        {done && lastPostseason && (
          <PostseasonVerdict onEnd={() => openOffseason()} />
        )}

        <NeedsYou />

        {!done && season.recruiting.week <= RECRUITING_WEEKS && (() => {
          const rp = boardBudget(season, team.index, economy.recruitingGrant);
          const spentRp = totalWeekSpend(season.recruiting.prospects, team.index);
          const left = Math.max(0, rp - spentRp);
          const commits = season.recruiting.prospects.filter((p) => p.signedBy === team.index).length;
          const targets = season.recruiting.prospects.filter((p) => p.signedBy === null
            && ((p.points[team.index] ?? 0) > 0 || (p.spent[team.index] ?? 0) > 0)).length;
          return (
            <Card
              eyebrow={`Recruiting · Week ${season.recruiting.week} of ${RECRUITING_WEEKS}`}
              title={`${left} of ${rp} points left this week`}
              trailing={<StatusBadge tone="neutral" icon="clock">Resets weekly</StatusBadge>}
              footer={<Button variant="quiet" iconAfter="chevron-right" onClick={() => go('program', 'recruiting')}>Open recruiting</Button>}
            >
              <Meter value={left} max={Math.max(1, rp)} size="sm" ariaLabel="Recruiting points left this week" />
              <p className="pb-text-muted">{plural(targets, 'target')} · {commits} committed</p>
            </Card>
          );
        })()}

        <section>
          <SectionHeader title="This week" action={{ label: 'Full schedule', onClick: () => go('season', 'sched') }} />
          <WeekGames season={season} team={team} year={year} onOpen={setOpenGame} />
        </section>
      </main>

      {/* The user's own game has a full box score in the save. */}
      {openGame && openGame.day in (season.boxScores ?? {})
        && (openGame.home === team.index || openGame.away === team.index) && (
        <BoxScoreSheet
          box={season.boxScores[openGame.day]!}
          season={season}
          onClose={() => setOpenGame(null)}
        />
      )}
    </>
  );
}

/**
 * The games around tonight: the three before and the three after. A played
 * game carries its score and opens the box score; one still to come opens the
 * other program.
 */
function WeekGames(
  { season, team, year, onOpen }:
  { season: SeasonState; team: TeamRecord; year: number; onOpen: (g: GameSummary) => void },
) {
  const openTeam = useOpenTeam();
  const mine = season.schedule.flatMap((d) => {
    const g = d.games.find((x) => x.home === team.index || x.away === team.index);
    return g ? [{ d, g }] : [];
  });
  const today = season.schedule[season.dayIndex]?.day ?? Number.POSITIVE_INFINITY;
  const next = mine.find(({ d }) => d.day >= today) ?? mine[mine.length - 1];
  if (!next) return null;
  const focusIndex = Math.max(0, mine.indexOf(next));
  const rail = mine.slice(Math.max(0, focusIndex - 3), Math.min(mine.length, focusIndex + 4));
  return (
    <List label="This week">
      {rail.map(({ d, g }) => {
        const home = g.home === team.index;
        const opponent = season.teams[home ? g.away : g.home];
        const result = season.results.find((r) => r.day === d.day && (r.home === team.index || r.away === team.index));
        const us = result ? (home ? result.homeRuns : result.awayRuns) : null;
        const them = result ? (home ? result.awayRuns : result.homeRuns) : null;
        const box = result !== undefined && d.day in (season.boxScores ?? {});
        const when = shortDate(year, d.day);
        const kind = d.kind === 'series'
          ? (opponent && opponent.conference === team.conference ? 'Conference series' : 'Weekend series')
          : 'Midweek';
        return (
          <GameRow
            key={d.day}
            day={when.weekday}
            date={when.date}
            opponent={opponent?.def.school ?? '—'}
            abbr={opponent?.def.abbr ?? ''}
            home={home}
            kind={kind}
            current={d.day === next.d.day && !result}
            result={result && us !== null && them !== null ? { win: us > them, score: recordText(us, them) } : undefined}
            status={result ? undefined : d.day === today ? 'Tonight' : when.weekday}
            onClick={() => (box && result ? onOpen(result) : opponent && openTeam(opponent.index))}
          />
        );
      })}
    </List>
  );
}

/** How the year ended, shown once between the last game and the roll over. */
function PostseasonVerdict({ onEnd }: { onEnd: () => void }) {
  const season = useDynasty((x) => x.season);
  const userTeam = useDynasty((x) => x.userTeam);
  const result = useDynasty((x) => x.lastPostseason);
  if (!season || !result) return null;
  // A club that went out in its conference tournament did not miss the postseason.
  const conference = season.teams[userTeam]?.conference;
  const inField = conference !== undefined && conferenceField(season, conference).field.includes(userTeam);
  const me = result.finish[userTeam] ?? (inField ? 'conference' : 'missed');
  const champion = season.teams[result.champion]?.def.school ?? '—';
  const wonConference = result.conferenceChampions.includes(userTeam);
  const big = me === 'champion';
  return (
    <Card
      eyebrow="Postseason"
      title={FINISH_LABEL[me]}
      trailing={big ? <StatusBadge tone="positive" icon="star-filled">National champions</StatusBadge> : undefined}
      footer={<Button variant="primary" block onClick={onEnd}>Start the offseason</Button>}
    >
      <p className="pb-text">
        {wonConference ? 'Won the conference tournament. ' : ''}
        {big ? 'Nobody can take this one away.' : `${champion} won the national title.`}
      </p>
    </Card>
  );
}
