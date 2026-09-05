// Today.tsx
// The hub. Where you are in the season, how the program is doing, and the one
// button that moves the year forward.
//
// The proposal's dashboard, class for class: a masthead with the date and the
// headline, the next game as a bordered card with its own label bar and two
// rows of actions, a three-up pulse grid, and the decision stack under it.
// There are no style objects in this file — every rule it needs is already in
// prototype.css, and a second opinion here would be a rule fighting a rule.
//
// Where the proposal shows something this game does not have, the slot keeps
// its shape and takes something true instead. The weather block is the clearest
// case: there is no weather in the sim, and an invented 72° would be the one
// dishonest number on the screen. It carries the national rank, which is what a
// coach actually looks up at that moment.

import { useRef, useState } from 'react';
import { PlayIcon, SewingPinIcon, StopwatchIcon, StarFilledIcon,
} from '@radix-ui/react-icons';
import { FINISH_LABEL } from '../../engine/postseason.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import {
  seasonComplete, rpiOrder, seasonLength, era,
  type SeasonState, type TeamRecord, type GameSummary,
} from '../../engine/season.js';
import { FirstVisit } from '../Tutorial.js';
import { useOpenTeam } from './TeamCard.js';
import { BoxScoreSheet } from './Schedule.js';
import { seasonDate } from '../format.js';
import { NeedsYou, useNeeds } from '../Needs.js';
import { seriesStake } from '../../engine/world.js';
import { teamReads } from '../../engine/tendencies.js';
import { SectionHeading } from '../components/Kit.js';
import { Crest } from '../Crest.js';
import type {Arm, Pitcher } from '../../engine/types.js';

/**
 * A team's collective batting average, straight off the season books.
 *
 * Walked over the roster rather than kept as a running counter, because the
 * only honest team average is the sum of its player lines — the audit found
 * what happens to a second copy of a number.
 */
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
  const advanceDay = useDynasty((s) => s.advanceDay);
  const simWeek = useDynasty((s) => s.simWeek);
  const playSeason = useDynasty((s) => s.playSeason);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const playPostseason = useDynasty((s) => s.playPostseason);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const openOffseason = useDynasty((s) => s.openOffseason);
  const go = useDynasty((s) => s.go);
  const busy = useDynasty((s) => s.busy);
  const progress = useDynasty((s) => s.progress);
  const live = useDynasty((s) => s.live);
  const pendingGame = useDynasty((s) => s.pendingGame);
  const resumeGame = useDynasty((s) => s.resumeGame);
  const rivalry = useDynasty((s) => s.rivalry);
  const boardAsk = useDynasty((s) => s.boardAsk);
  const coach = useDynasty((s) => s.coach);
  const economy = useDynasty((s) => s.economy);
  const setProgramSheet = useDynasty((s) => s.setProgramSheet);
  const setPlaybookFocus = useDynasty((s) => s.setPlaybookFocus);
  const openPlayer = useDynasty((s) => s.openPlayer);
  /*
    The desk does not advance past a decision only you can make.

    Asked for directly: "when someone gets injured or needs to be talked to
    about their grades, we should not be able to continue playing until
    resolved." The red needs — a starter who cannot play, the press waiting, a
    failing man you still have a word for — freeze the four ways time moves.
    Everything else on the screen stays live, because reading the wire is not
    playing on.
  */
  const musts = useNeeds().filter((n) => n.must).length;
  const held = musts > 0;
  const openTeam = useOpenTeam();
  const team = useUserTeam();
  void version;                         // in-place mutation: see store.ts

  /*
    The 0.8 second breath before a sim resolves.

    A day sims in a couple of milliseconds, and a result that appears the same
    frame the thumb lands reads as though nothing was played. The pause is
    honest about what it is — a beat, in the button itself, with a ring — and
    it doubles as the rapid-fire guard for these two controls.
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

  /** A finished game, opened off the results strip. */
  const [openGame, setOpenGame] = useState<GameSummary | null>(null);

  if (!season || !team) return null;

  const done = seasonComplete(season);
  const day = season.schedule[season.dayIndex];

  // Where the program sits nationally. Recomputed rather than cached — 96 teams
  // is cheap and a stale rank on the hub screen is worse than the work.
  // RPI needs games. Before any are played every team is 0-0, so the table is
  // ordered by the tiebreak backstop alone — showing "#1" off that would be
  // inventing a standing.
  const ranks = new Map<number, number>();
  if (team.gp > 0) rpiOrder(season).forEach((r, i) => ranks.set(r.team.index, i + 1));
  const rank = ranks.get(team.index) ?? 0;

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

  // Tonight's probable arms, exactly the way the engine will pick them: the
  // scheduled rotation slot on both sides.
  const slot = todayGame?.slot ?? 0;
  const ourArm = team.team.rotation[slot] ?? team.team.rotation[0];
  const theirArm = opponent
    ? opponent.team.rotation[slot] ?? opponent.team.rotation[0]
    : null;
  /*
    Probable starters get their own row now. The old half-row had to fit a
    crest, record and name in the same ~130px and inevitably hid the arm on
    smaller phones. With a dedicated half-width line we can show the actual
    name and still ellipsize safely when somebody has a very long one.
  */
  const armShort = (p: Arm | null | undefined): string => {
    if (!p) return '—';
    const line = season.pitching.get(p.id);
    const e = line && line.outs >= 9 ? ` · ${era(line).toFixed(2)}` : '';
    return `${p.name}${e}`;
  };

  // Where the series stands, when tonight is part of one. The schedule plays
  // Friday–Sunday against one opponent; games already played against them this
  // week are the series so far.
  const seriesSoFar = todayGame && opponent && day?.kind === 'series'
    ? season.results.filter((r) =>
      Math.abs(r.day - day.day) <= 3
      && ((r.home === team.index && r.away === opponent.index)
        || (r.away === team.index && r.home === opponent.index)))
    : [];
  const seriesWins = seriesSoFar.filter((r) =>
    (r.home === team.index) === (r.homeRuns > r.awayRuns)).length;

  /*
    What tonight settles — stage 12, the other half of R8. The game number and
    the lead shipped with stage 4; the stake did not.
  */
  const stake = day?.kind === 'series' ? seriesStake(seriesSoFar.length, seriesWins) : null;
  const seriesTag = seriesSoFar.length === 0
    ? `${atHome ? 'HOME' : 'ROAD'} SERIES · GAME 1 OF 3`
    : seriesWins * 2 > seriesSoFar.length
      ? `GAME ${seriesSoFar.length + 1} · YOU LEAD ${seriesWins}-${seriesSoFar.length - seriesWins}`
      : seriesWins * 2 < seriesSoFar.length
        ? `GAME ${seriesSoFar.length + 1} · THEY LEAD ${seriesSoFar.length - seriesWins}-${seriesWins}`
        : `GAME ${seriesSoFar.length + 1} · SERIES LEVEL`;

  const ourAvg = teamAverage(season, team);
  const ourEra = teamEra(season, team);

  const streakLine = team.streak === 0
    ? `${team.def.school} is ${team.w}-${team.l}.`
    : `${team.def.school} has ${team.streak > 0 ? 'won' : 'lost'} ${Math.abs(team.streak)} straight.`;

  const headline = done
    ? 'The regular season is done.'
    : live ? 'A game is waiting on you.'
      : todayGame ? 'First pitch is next.'
        : 'No game today.';

  return (
    <>
      <main className="dashboard-workspace">
        <FirstVisit id="today" />

        <section className="club-masthead">
          <div>
            <p>{done ? `${year} FINAL` : seasonDate(year, day?.day ?? 0).toUpperCase()}</p>
            <h1>{headline}</h1>
            <small>{streakLine}</small>
          </div>
          {/*
            The proposal's weather block, carrying the one number a coach would
            actually glance up for. There is no weather in this sim and there is
            no plan for one; a painted 72° would be the only invented figure on
            the screen.
          */}
          <div className="weather-block">
            <strong>{rank ? `#${rank}` : '—'}</strong>
            <span>RPI<br />{team.conference}</span>
          </div>
        </section>

        {/*
          The game a phone call took away, offered back.

          Above the card for tonight, because it is the only thing on this
          screen that is already in progress — and offered rather than restored,
          because being teleported into the seventh inning of a game you had
          forgotten is its own kind of disorienting. Declining does not un-play
          the day: the bench coach finishes it, which is what happens to a
          manager who walks out of a dugout anyway.
        */}
        {pendingGame && (
          <section className="next-game rise-in">
            <div className="match-label">
              <span>GAME IN PROGRESS</span><b>YOU LEFT THIS ONE ON THE FIELD</b>
            </div>
            <p><StopwatchIcon /> {pendingGame.line}</p>
            <div className="match-actions">
              <button type="button" onClick={() => void resumeGame(false)}>Let them finish</button>
              <button type="button" onClick={() => void resumeGame(true)}><PlayIcon /> Pick it up</button>
            </div>
          </section>
        )}

        {todayGame && opponent && (
          <section className="next-game">
            <button
              className="match-label match-label-tap tap"
              type="button"
              onClick={() => openTeam(opponent.index)}
            >
              <span>
                {atHome ? 'TONIGHT VS' : 'TONIGHT AT'} {opponent.def.school.toUpperCase()}
              </span>
              <b>{day?.kind === 'series' ? seriesTag : 'MIDWEEK'}</b>
            </button>
            {/*
              Crests rather than the abbreviation in 39px display type, and the
              second draft of the row. The first stacked crest over record in
              the letters' old slots, which grew the card — reported the same
              day it shipped: "the tonight card should not change its size, I
              just noticed how it expanded" — and left the space either side of
              the shields carrying nothing but air.

              So the row works sideways now, the way the report sketched it:
              each pitcher rides the empty side next to his crest, the crests
              pull in toward the AT, and the line that used to spell the arms
              out underneath is gone — which is what buys the height back. A
              first initial rather than the full name, because "Giovanni
              Galvan · 3.42" has to fit half a 320-wide phone.
            */}
            <div className="matchup">
              <button className="match-team" type="button" onClick={() => openTeam(team.index)}>
                <Crest abbr={team.def.abbr} size={48} />
                <span className="matchup-record">{team.w}-{team.l}</span>
              </button>
              <span className="versus">{atHome ? 'VS' : 'AT'}</span>
              <button className="match-team" type="button" onClick={() => openTeam(opponent.index)}>
                <Crest abbr={opponent.def.abbr} size={48} />
                <span className="matchup-record">{opponent.w}-{opponent.l}</span>
              </button>
            </div>
            <div className="probable-arms" aria-label="Probable pitchers">
              <button type="button" onClick={() => ourArm && openPlayer(ourArm.id, 'stats')}>
                <small>YOUR PROBABLE</small><strong>{armShort(ourArm)}</strong>
              </button>
              <button type="button" onClick={() => theirArm && openPlayer(theirArm.id, 'stats')}>
                <small>THEIR PROBABLE</small><strong>{armShort(theirArm)}</strong>
              </button>
            </div>
            {stake && (
              <p className="stake-line"><SewingPinIcon /> {stake}</p>
            )}
            {/*
              The warnings, in one red strip where the pitchers' line used to
              be — asked for in the same report: "the warnings make them more
              visible and in a red strip." The rivalry and the held desk were
              two quiet grey lines a scroll apart; anything on this card that
              is a warning rather than a fact now shares the one band, and the
              band only exists on a night that has one.
            */}
            {(opponent.def.abbr === team.def.rival || held || formerAssistant) && (
              <div className="match-warnings">
                {opponent.def.abbr === team.def.rival && (
                  <p>
                    <StarFilledIcon /> The rivalry.{' '}
                    {rivalry.w + rivalry.l > 0
                      ? rivalry.w >= rivalry.l
                        ? `You lead the series ${rivalry.w}-${rivalry.l}.`
                        : `They lead the series ${rivalry.l}-${rivalry.w}.`
                      : 'The first chapter under your watch.'}
                  </p>
                )}
                {formerAssistant && (
                  <p>
                    <StarFilledIcon /> Coaching tree. {opponent.coach?.name} spent {formerAssistant.yearsWithYou}{' '}
                    {formerAssistant.yearsWithYou === 1 ? 'year' : 'years'} on your staff before taking his own path.
                  </p>
                )}
                {held && (
                  <p>
                    <SewingPinIcon /> Nothing moves until
                    {musts === 1 ? ' the decision below is' : ' the decisions below are'} made.
                  </p>
                )}
              </div>
            )}
            <button
              className={`match-prep tap${activePlaybook ? ' is-active' : ''}`}
              type="button"
              onClick={() => {
                if (activePlaybook) {
                  setPlaybookFocus(opponent.def.abbr);
                  go('program', 'strategy');
                } else {
                  openTeam(opponent.index);
                }
              }}
            >
              <span>
                <small>PREPARATION</small>
                <strong>{activePlaybook ? 'Opponent playbook active' : 'No opponent playbook'}</strong>
                <em>{activePlaybook
                  ? prepRead ? `${prepRead.title}. Open the plan to adjust your counters.` : 'Your custom plan applies automatically tonight.'
                  : 'Open their profile for a scouting brief before you spend.'}</em>
              </span>
              <span className="match-prep-cta">{activePlaybook ? 'OPEN PLAN' : 'SCOUT'} ›</span>
            </button>
            <div className="match-actions">
              <button type="button" onClick={() => go('team', 'lineup')}>
                Set lineup
              </button>
              <button
                type="button"
                disabled={busy || thinking !== null || (held && !live)}
                onClick={() => void startManagedGame()}
              ><PlayIcon /> {live ? 'Back to the game' : 'Play ball'}</button>
            </div>
            <div className="simulation-row">
              <button
                type="button"
                disabled={busy || !!live || held || thinking === 'week'}
                onClick={() => think('game', advanceDay)}
              >{thinking === 'game' ? <span className="spinner" /> : 'Sim game'}</button>
              <button
                type="button"
                disabled={busy || !!live || held || thinking === 'game'}
                onClick={() => think('week', simWeek)}
              >{thinking === 'week' ? <span className="spinner" /> : 'Sim week'}</button>
            </div>
          </section>
        )}

        {!todayGame && !done && (
          <section className="next-game">
            <div className="match-label">
              <span>OFF DAY</span><b>WEEK {day?.week ?? 1}</b>
            </div>
            <p><SewingPinIcon /> Bullpen work and situational defense.</p>
            <div className="simulation-row">
              <button
                type="button"
                disabled={busy || !!live || held || thinking === 'week'}
                onClick={() => think('game', advanceDay)}
              >{thinking === 'game' ? <span className="spinner" /> : 'Advance'}</button>
              <button
                type="button"
                disabled={busy || !!live || held || thinking === 'game'}
                onClick={() => think('week', simWeek)}
              >{thinking === 'week' ? <span className="spinner" /> : 'Sim week'}</button>
            </div>
          </section>
        )}

        {busy && progress && (
          <section className="budget-bar">
            <span>
              <small>SIMULATING</small>
              <strong>DAY {progress.day} / {progress.totalDays}</strong>
            </span>
            <i>
              <b style={{ width: `${Math.round((progress.day / progress.totalDays) * 100)}%` }} />
            </i>
          </section>
        )}



        {/*
          TESTING ONLY. A full regular season in one press so UI/offseason
          work can be inspected without playing fifty-plus dates first.
          Remove together with the Pascagoula Tech test roster before release.
        */}
        {!done && (
          <section className="test-shortcuts" aria-label="Testing shortcuts">
            <span><small>TEST BUILD</small><strong>Skip to June</strong></span>
            <button
              className="secondary-command"
              type="button"
              disabled={busy || !!live || held || thinking !== null}
              onClick={() => void playSeason()}
            >SIM THE SEASON</button>
          </section>
        )}

        {done && !lastPostseason && (
          /*
            The season is over and the screen says so like it matters.

            The opponent card vanishes with the schedule, and a bare button
            floating where it used to be read as something missing rather than
            something arriving. Reported from testing: "when the play the post
            season button came up it took out the whole card which makes it look
            weird." This is the card that takes its place — a gate, not a gap.
          */
          <>
            <section className="season-verdict rise-in">
              <small>{year} · THE REGULAR SEASON IS IN THE BOOKS</small>
              <strong>June is here</strong>
              <p>
                {team.w}-{team.l}, and now the games that get remembered. Every
                jersey in the country is washed for this.
              </p>
            </section>
            <button
              className="primary-command"
              type="button"
              disabled={busy}
              onClick={() => void playPostseason()}
            >{busy ? 'PLAYING…' : 'PLAY THE POSTSEASON'}</button>
          </>
        )}

        {done && lastPostseason && (
          <>
            <PostseasonVerdict />
            {/*
              The offseason is a sequence of full screens, so this hands over to
              it rather than doing the work itself. It is only reachable after a
              reload, because the phase is not persisted — normally the
              postseason opens the sequence directly.
            */}
            <button
              className="primary-command"
              type="button"
              onClick={() => openOffseason()}
            >END THE SEASON</button>
          </>
        )}

        {/*
          What is waiting on you, where the conference scoreboard used to be.

          Asked for in those terms, and it is the better use of the space. The
          scoreboard was eight results you could do nothing about, sitting under
          the one button that moves your season -- and the things you *could* do
          something about had nowhere to be, so the press room got itself a
          screen by interrupting and an injury got itself nothing at all.

          Last night around the conference has not gone anywhere: SCHEDULE has
          every result and CONFERENCE has the table they add up to.
        */}
        <NeedsYou />

        {boardAsk && (
          <button
            className="today-board-card tap"
            type="button"
            onClick={() => { setProgramSheet('board'); go('program', 'records'); }}
          >
            <span><small>BOARD</small><strong>{boardAsk.summary}</strong></span>
            <em>{coach.security} security · {coach.contractYears}y contract</em>
            <span aria-hidden>›</span>
          </button>
        )}

        {/* Below the needs, by request: "needs you is more important than the
            other." The pulse is reference; the needs are work. */}
        <SectionHeading
          kicker="CLUB PULSE"
          title="This week"
          action="Schedule"
          onAction={() => { go('season', 'sched'); }}
        />
        <section className="pulse-grid">
          <button type="button" onClick={() => { go('team', 'stats'); }}>
            {/*
              One card, one side of the ball.

              This tile printed TEAM AVG over a line about innings pitched —
              and when nobody had thrown one it read "TEAM AVG — / no innings
              yet", which is a batting card explaining itself with a pitching
              sentence. Found in an outside audit and confirmed on a fresh
              career. The bat gets the headline and the bat gets the note; the
              arm has its own tile beside it now.
            */}
            <small>TEAM AVG</small>
            <strong>{ourAvg === null ? '—' : ourAvg.toFixed(3).replace(/^0/, '')}</strong>
            <span>{ourAvg === null
              ? (team.gp === 0 ? 'no games yet' : 'not enough at-bats yet')
              : `${team.rs} run${team.rs === 1 ? '' : 's'} scored`}</span>
          </button>
          <button type="button" onClick={() => { go('season', 'stand'); }}>
            <small>{team.conference.toUpperCase()}</small>
            <strong>{team.cw}-{team.cl}</strong>
            <span>{team.w}-{team.l} overall</span>
          </button>
          {/*
            The arm, which had no tile at all.

            This was GAMES PLAYED — a number the header already carries as a
            record and the schedule carries as a calendar, so the pulse spent
            a third of itself repeating. Bat, league, arm: three tiles, three
            different questions.
          */}
          <button type="button" onClick={() => { go('team', 'stats'); }}>
            <small>TEAM ERA</small>
            <strong>{ourEra === null ? '—' : ourEra.toFixed(2)}</strong>
            <span>{ourEra === null
              ? (team.gp === 0 ? 'no innings yet' : 'not enough innings yet')
              : `${team.ra} run${team.ra === 1 ? '' : 's'} allowed`}</span>
          </button>
        </section>

      </main>

      {/*
        How it played out. The user's own game has a full box score in the save,
        so it opens the real one; everyone else's carries a summary card.
      */}
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

/** How the year ended, shown once between the last game and the roll over. */
function PostseasonVerdict() {
  const season = useDynasty((x) => x.season);
  const userTeam = useDynasty((x) => x.userTeam);
  const result = useDynasty((x) => x.lastPostseason);
  if (!season || !result) return null;

  const me = result.finish[userTeam] ?? 'missed';
  const champion = season.teams[result.champion]?.def.school ?? '—';
  const wonConference = result.conferenceChampions.includes(userTeam);
  const big = me === 'champion';

  return (
    <section className="season-verdict">
      <small>POSTSEASON</small>
      <strong>{FINISH_LABEL[me]}</strong>
      <p>
        {wonConference ? 'Won the conference tournament. ' : ''}
        {big ? 'Nobody can take this one away.' : `${champion} won the national title.`}
      </p>
    </section>
  );
}
