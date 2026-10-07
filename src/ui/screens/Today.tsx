// Today.tsx
// The screen that moves time, in three parts that fit one phone screen:
// the schedule as a wheel (played games above, the next one in front), the
// to-do list (what blocks play, then what is worth doing this week, each with
// its fix), and three buttons: sim a game, play it, sim the week.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FINISH_LABEL, conferenceField } from '../../engine/postseason.js';
import { RECRUITING_WEEKS, totalWeekSpend } from '../../engine/recruiting.js';
import { boardBudget, useConferenceTable, useDynasty, useUserTeam } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import {
  seasonComplete, nationalRank, pollIsProjected, era, startableSlot, injuryClock, currentDay,
  type SeasonState, type TeamRecord, type GameSummary, type GameDay, type ScheduledGame,
} from '../../engine/season.js';
import { FirstVisit } from '../Tutorial.js';
import { useOpenTeam } from './TeamCard.js';
import { BoxScoreSheet } from './Schedule.js';
import { shortDate } from '../format.js';
import { useNeeds, type Need } from '../Needs.js';
import { seriesStake } from '../../engine/world.js';
import { Icon, type IconName } from '../components/ui/index.js';
import { Crest } from '../Crest.js';
import { GameWheel } from '../GameWheel.js';
import { plural, recordText } from '../words.js';
import type { Arm } from '../../engine/types.js';

export { longDate, shortDate } from '../format.js';

/** One of the user's games, placed on the wheel. */
interface WheelGame {
  key: number;
  week: number;
  day: GameDay;
  game: ScheduledGame;
  home: boolean;
  opponent: TeamRecord;
  /** 0 for a midweek game; otherwise this game's place in its series. */
  seriesNo: number;
  seriesLen: number;
  result?: GameSummary;
}

type Tone = 'warning' | 'negative' | 'info' | 'accent' | 'positive' | 'muted';

/** One line of the to-do list. */
interface Todo {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  sub: string;
  action?: { label: string; onClick: () => void };
  /** Blocks the day until it is dealt with. */
  must?: boolean;
  /** Settled this week; stays, checked, at the foot. */
  done?: boolean;
}

/** The recap the coach dismissed, so it does not come back on every visit. */
let recapSeen = '';

const last = (name: string): string => name.split(' ').slice(-1)[0] ?? name;

/** "6.0 IP, 2 H, 1 R, 1 ER, 2 BB, 7 K" → "6.0 IP · 1 ER · 7 K". */
function shortArmLine(line: string): string {
  const ip = /([\d.]+) IP/.exec(line)?.[1];
  const er = /(\d+) ER/.exec(line)?.[1];
  const k = /(\d+) K/.exec(line)?.[1];
  return [ip && `${ip} IP`, er && `${er} ER`, k && `${k} K`].filter(Boolean).join(' · ');
}

function toneOfNeed(n: Need): Tone {
  if (n.must) return 'warning';
  if (n.id.startsWith('hurt-')) return 'negative';
  if (n.id === 'recruiting-points' || n.id === 'recruiting-list') return 'warning';
  if (n.id.startsWith('grades-')) return 'muted';
  return 'accent';
}

export function Today() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const year = useDynasty((s) => s.year);
  const farewellYear = useDynasty((s) => s.coach.farewellYear);
  const resignYear = useDynasty((s) => s.coach.resignYear);
  const advanceDay = useDynasty((s) => s.advanceDay);
  const simWeek = useDynasty((s) => s.simWeek);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const playPostseason = useDynasty((s) => s.playPostseason);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const openOffseason = useDynasty((s) => s.openOffseason);
  const go = useDynasty((s) => s.go);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const busy = useDynasty((s) => s.busy);
  const progress = useDynasty((s) => s.progress);
  const live = useDynasty((s) => s.live);
  const liveStarting = useDynasty((s) => s.liveStarting);
  const pendingGame = useDynasty((s) => s.pendingGame);
  const resumeGame = useDynasty((s) => s.resumeGame);
  const economy = useDynasty((s) => s.economy);
  const depth = useDynasty((s) => s.depth);
  const phase = useDynasty((s) => s.phase);
  const needs = useNeeds();
  const musts = needs.filter((n) => n.must);
  const held = musts.length > 0;
  const openTeam = useOpenTeam();
  const team = useUserTeam();
  const table = useConferenceTable();

  /*
    A beat before a sim resolves. A day sims in milliseconds, and a result that
    lands the frame the thumb does reads as though nothing was played. It
    doubles as the double-tap guard for these two controls.
  */
  /*
    One lock for the three delayed presses (audit 17, M46, M83, M84). It is
    held until the run has finished, not released just before it: a second
    tap during the sim used to queue and play a second week. And it is not a
    cleanup: under keep-alive the screen's effects are torn down every time it
    is hidden, which cancelled the tapped sim and left the row on a spinner.
    A press made is a press that happens, wherever the coach has gone.
  */
  const [thinking, setThinking] = useState<'game' | 'week' | 'play' | null>(null);
  const thinkLock = useRef(false);
  const think = (which: 'game' | 'week' | 'play', run: () => unknown, delay = 800): void => {
    if (thinkLock.current) return;
    thinkLock.current = true;
    setThinking(which);
    setTimeout(() => {
      void Promise.resolve()
        .then(run)
        .finally(() => { thinkLock.current = false; setThinking(null); });
    }, delay);
  };

  const [openGame, setOpenGame] = useState<GameSummary | null>(null);
  const [focus, setFocus] = useState(0);
  const [jump, setJump] = useState<{ to: number; n: number } | undefined>(undefined);
  const [, bump] = useState(0);

  // Every game of ours, in order, with its result when it has one.
  const games = useMemo<WheelGame[]>(() => {
    if (!season || !team) return [];
    const results = new Map<number, GameSummary>();
    for (const r of season.results) {
      if (r.home === team.index || r.away === team.index) results.set(r.day, r);
    }
    const out: WheelGame[] = [];
    for (const d of season.schedule) {
      const g = d.games.find((x) => x.home === team.index || x.away === team.index);
      if (!g) continue;
      const home = g.home === team.index;
      const opponent = season.teams[home ? g.away : g.home];
      if (!opponent) continue;
      out.push({ key: d.day, week: d.week, day: d, game: g, home, opponent, seriesNo: 0, seriesLen: 0, result: results.get(d.day) });
    }
    // Number the series: consecutive series days against one club in one week.
    for (let i = 0; i < out.length; i++) {
      const w = out[i]!;
      if (w.day.kind !== 'series') continue;
      const prev = out[i - 1];
      w.seriesNo = prev && prev.day.kind === 'series' && prev.week === w.week && prev.opponent.index === w.opponent.index
        ? prev.seriesNo + 1 : 1;
    }
    for (let i = out.length - 1; i >= 0; i--) {
      const w = out[i]!;
      if (w.seriesNo === 0) continue;
      const after = out[i + 1];
      w.seriesLen = after && after.seriesNo === w.seriesNo + 1 && after.opponent.index === w.opponent.index
        ? after.seriesLen : w.seriesNo;
    }
    return out;
  }, [season, team, version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!season || !team) return null;

  const done = seasonComplete(season);
  const farewell = farewellYear === year;
  // On notice: his last season at this school, not his last season.
  const leavingHere = !farewell && resignYear === year;
  const day =season.schedule[season.dayIndex];
  const todayNo = day?.day ?? Number.POSITIVE_INFINITY;
  const rank = nationalRank(season, team.index);
  const projected = pollIsProjected(season);
  const todayGame = day?.games.find((g) => g.home === team.index || g.away === team.index);

  const nextIdx = (() => {
    const i = games.findIndex((g) => !g.result && g.day.day >= todayNo);
    return i >= 0 ? i : Math.max(0, games.length - 1);
  })();
  const next = games[nextIdx];

  // Probable starters: tonight exactly as the engine will pick; later games by
  // the rotation's turn.
  const clock = injuryClock(season);
  const now = currentDay(season);
  const starter = (rec: TeamRecord, g: WheelGame): Arm | undefined => {
    const rot = rec.team.rotation;
    if (rot.length === 0) return undefined;
    if (g.day.day === todayNo) return rot[startableSlot(season, rec.team, g.game.slot, now, clock)] ?? rot[0];
    return rot[g.game.slot % rot.length];
  };
  const armStat = (p: Arm | undefined): string => {
    if (!p) return '';
    const line = season.pitching.get(p.id);
    const hand = `${p.throws}HP`;
    if (!line || line.outs < 3) return `${hand} · No innings yet`;
    return `${hand} · ${recordText(line.w, line.l)} · ${era(line).toFixed(2)} ERA · ${line.k} K`;
  };

  // Series standing, for the rest of the series now being played.
  const seriesLine = (g: WheelGame): string | null => {
    if (!next || g.result || g.seriesNo < 2 || g.week !== next.week || g.opponent.index !== next.opponent.index) return null;
    const prior = games.filter((x) => x.week === g.week && x.opponent.index === g.opponent.index
      && x.seriesNo > 0 && x.seriesNo < g.seriesNo && x.result);
    if (prior.length === 0) return null;
    const w = prior.filter((x) => (x.result!.home === team.index) === (x.result!.homeRuns > x.result!.awayRuns)).length;
    const l = prior.length - w;
    const lead = w > l ? `You lead ${recordText(w, l)}` : w < l ? `They lead ${recordText(l, w)}` : `Series ${recordText(w, l)}`;
    const stake = g === next ? seriesStake(prior.length, w) : null;
    return stake ? `${lead} · ${stake.replace(/\.$/, '').toLowerCase()}` : lead;
  };

  const face = (g: WheelGame, index: number, front: boolean) => {
    const r = g.result;
    const us = r ? (g.home ? r.homeRuns : r.awayRuns) : 0;
    const them = r ? (g.home ? r.awayRuns : r.homeRuns) : 0;
    const win = r ? us > them : false;
    const when = shortDate(year, g.day.day);
    const tonight = g.day.day === todayNo;
    const badge = r ? (win ? 'WIN' : 'LOSS')
      : index === nextIdx ? (tonight ? 'TONIGHT' : 'NEXT UP')
        : next && g.week === next.week ? 'THIS WEEK' : `WEEK ${g.week}`;
    const badgeTone = r ? (win ? 'positive' : 'negative') : index === nextIdx ? 'command' : 'muted';
    const rival = g.opponent.def.abbr === team.def.rival;

    let ourArm = '', ourStat = '', theirArm = '', theirStat = '';
    let line = '';
    let lineIcon: IconName = 'home';
    let lineTone = '';
    const box = r ? season.boxScores?.[g.day.day] : undefined;
    if (r) {
      if (box) {
        const ours = (box.home === team.index ? box.homePitching : box.awayPitching)[0];
        const theirs = (box.home === team.index ? box.awayPitching : box.homePitching)[0];
        ourArm = ours?.name ?? ''; ourStat = ours ? shortArmLine(ours.line) : '';
        theirArm = theirs?.name ?? ''; theirStat = theirs ? shortArmLine(theirs.line) : '';
        // The night's best bat on our side.
        const bats = box.home === team.index ? box.homeBatting : box.awayBatting;
        let best: { name: string; line: string } | null = null;
        let bestScore = 0;
        for (const b of bats) {
          const h = Number(/^(\d+)-/.exec(b.line)?.[1] ?? 0);
          const hr = Number(/(\d+) HR/.exec(b.line)?.[1] ?? 0);
          const rbi = Number(/(\d+) RBI/.exec(b.line)?.[1] ?? 0);
          const score = h * 2 + hr * 3 + rbi;
          if (score > bestScore) { bestScore = score; best = b; }
        }
        if (best) line = `${last(best.name)} ${best.line}`;
      }
      if (!line) line = win ? 'Win' : 'Loss';
      lineIcon = win ? 'star-filled' : 'minus';
      lineTone = win ? 'is-gold' : '';
    } else {
      const a = starter(team, g), b = starter(g.opponent, g);
      ourArm = a?.name ?? '—'; ourStat = armStat(a);
      theirArm = b?.name ?? '—'; theirStat = armStat(b);
      const series = seriesLine(g);
      if (series) { line = series; lineIcon = 'target'; lineTone = 'is-accent'; }
      else {
        line = `${g.home ? 'Home' : 'Away'} · ${g.seriesNo === 0 ? 'Midweek game'
          : rival ? 'Rivalry series' : g.game.conference ? 'Conference series' : 'Weekend series'}`;
      }
    }

    return (
      <div className={`pb-gcard${front ? ' is-front' : ''}${index === nextIdx && !r ? ' is-next' : ''}`}>
        <div className="pb-gcard__top">
          <span className="pb-gcard__when">
            {when.weekday.toUpperCase()} {when.date.toUpperCase()} · {g.seriesNo === 0 ? 'MIDWEEK' : `SERIES ${g.seriesNo}/${g.seriesLen}`}
          </span>
          <span className={`pb-gcard__badge is-${badgeTone}`}>{badge}</span>
        </div>
        <div className="pb-gcard__teams">
          <div className="pb-gcard__side">
            <Crest abbr={team.def.abbr} size={30} />
            <span className="pb-gcard__name"><b>{team.def.school}</b><small>{recordText(team.w, team.l)}</small></span>
          </div>
          <div className="pb-gcard__score">
            {r ? (
              <span><b className={win ? '' : 'is-muted'}>{us}</b><i>–</i><b className={win ? 'is-muted' : ''}>{them}</b></span>
            ) : (
              <span><i>{g.home ? 'vs' : 'at'}</i></span>
            )}
            <small>{r ? (r.innings !== 9 ? `F/${r.innings}` : 'FINAL') : g.game.conference ? 'CONF' : ' '}</small>
          </div>
          <div className="pb-gcard__side is-right">
            <span className="pb-gcard__name"><b>{g.opponent.def.school}</b><small>{recordText(g.opponent.w, g.opponent.l)}</small></span>
            <Crest abbr={g.opponent.def.abbr} size={30} />
          </div>
        </div>
        <div className="pb-gcard__arms">
          <span><b>{ourArm}</b><small>{ourStat}</small></span>
          <span className="is-right"><b>{theirArm}</b><small>{theirStat}</small></span>
        </div>
        <div className="pb-gcard__line">
          <span className={`pb-gcard__lineicon ${lineTone}`}><Icon name={lineIcon} size={12} /></span>
          <span className="pb-gcard__linetext">{line}</span>
          {rival && <span className="pb-gcard__rival"><Icon name="star-filled" size={9} />Rival</span>}
        </div>
      </div>
    );
  };

  const openFromWheel = (g: WheelGame): void => {
    if (g.result && g.day.day in (season.boxScores ?? {})) setOpenGame(g.result);
    else openTeam(g.opponent.index);
  };

  /* ------------------------------------------------------------- to do */

  const todos: Todo[] = [];

  if (pendingGame) {
    todos.push({
      id: 'pending', icon: 'play', tone: 'warning', must: true,
      title: 'You left a game on the field', sub: pendingGame.line,
      action: { label: 'Let them finish', onClick: () => void resumeGame(false) },
    });
  }

  if (done && lastPostseason) {
    const conference = season.teams[team.index]?.conference;
    const inField = conference !== undefined && conferenceField(season, conference).field.includes(team.index);
    const me = lastPostseason.finish[team.index] ?? (inField ? 'conference' : 'missed');
    const champ = season.teams[lastPostseason.champion]?.def.school ?? '—';
    todos.push({
      id: 'verdict', icon: me === 'champion' ? 'star-filled' : 'calendar', tone: me === 'champion' ? 'positive' : 'accent',
      title: FINISH_LABEL[me],
      sub: `${lastPostseason.conferenceChampions.includes(team.index) ? 'Conference champions · ' : ''}${me === 'champion' ? 'National champions' : `${champ} won it all`}`,
    });
  }

  // Last week, once, at the start of the next.
  const lastPlayed = [...games].reverse().find((g) => g.result);
  if (!done && next && lastPlayed && lastPlayed.week < next.week) {
    const tag = `${year}:${lastPlayed.week}`;
    if (recapSeen !== tag) {
      const wk = games.filter((g) => g.week === lastPlayed.week && g.result);
      const won = (g: WheelGame): boolean => (g.result!.home === team.index) === (g.result!.homeRuns > g.result!.awayRuns);
      const w = wk.filter(won).length;
      /*
        Every game the week counted, by itself. The line under it used to be the
        season's record, which read as the week's: a 2–1 weekend after a
        Tuesday win showed "Week 3: 3–1" over "3–1", and looked wrong twice
        (2026-09-24). Now the Tuesday game is right there in the list.
      */
      const each = wk.map((g) => {
        const r = g.result!;
        const us = g.home ? r.homeRuns : r.awayRuns;
        const them = g.home ? r.awayRuns : r.homeRuns;
        return `${won(g) ? 'W' : 'L'} ${us}–${them}`;
      });
      todos.push({
        id: 'recap', icon: 'calendar', tone: 'accent',
        title: `Week ${lastPlayed.week}: ${recordText(w, wk.length - w)}`,
        sub: each.join(' · '),
        action: { label: 'Got it', onClick: () => { recapSeen = tag; bump((x) => x + 1); } },
      });
    }
  }

  for (const n of needs) {
    todos.push({
      id: n.id, icon: n.icon, tone: toneOfNeed(n), must: n.must,
      title: n.title, sub: n.note, action: { label: n.cta, onClick: n.go },
    });
  }

  // The week's recruiting, done: said once it is, so the list shows progress.
  if (phase === null && handles(depth, 'recruiting') && !done
    && season.recruiting.week >= 1 && season.recruiting.week <= RECRUITING_WEEKS
    && !needs.some((n) => n.id === 'recruiting-points')) {
    const commits = season.recruiting.prospects.filter((p) => p.signedBy === team.index).length;
    const spent = totalWeekSpend(season.recruiting.prospects, team.index);
    const budget = boardBudget(season, team.index, economy.recruitingGrant);
    if (spent > 0) {
      todos.push({
        id: 'recruiting-done', icon: 'target', tone: 'accent', done: true,
        title: 'Recruiting points spent', sub: `${spent} of ${budget} · ${commits} committed`,
      });
    }
  }

  // Staff and buildings live in the Office rooms, not here: the season is
  // quiet (2026-09-28).

  const rank3 = (t: Todo): number => (t.done ? 2 : t.must ? 0 : 1);
  const list = todos.map((t, i) => ({ t, i })).sort((a, b) => rank3(a.t) - rank3(b.t) || a.i - b.i).map((x) => x.t);
  const pending = list.filter((t) => !t.done && t.action).length;
  const firstMustId = list.find((t) => t.must && t.id !== 'pending')?.id;

  /* ----------------------------------------------------------- buttons */

  const busyNow = busy || liveStarting;
  const blocked = busyNow || !!live || held || pendingGame !== null;
  const firstMust = musts[0];
  const spinner = <span className="pb-spinner" aria-label="Simulating" />;
  const left3 = next && !done
    ? games.filter((g) => g.week === next.week && !g.result).length : 0;

  type Btn = { label: ReactNode; sub?: string; onClick?: () => void; disabled?: boolean; icon?: IconName; guide?: string; tone?: 'warn' };
  let leftBtn: Btn, midBtn: Btn, rightBtn: Btn;
  if (done) {
    leftBtn = { label: 'Standings', onClick: () => go('team', 'stand') };
    midBtn = lastPostseason
      ? { label: 'Offseason', sub: 'Start it', icon: 'arrow-right', onClick: () => openOffseason() }
      : { label: busy ? 'Playing…' : 'Postseason', sub: recordText(team.w, team.l), icon: 'star-filled', disabled: busy, onClick: () => void playPostseason() };
    rightBtn = { label: 'Schedule', onClick: () => openOverlay('schedule') };
  } else {
    const tonight = todayGame && next && next.day.day === todayNo ? next : undefined;
    leftBtn = held && firstMust && !live
      ? { label: firstMust.cta, sub: plural(musts.length, 'thing'), onClick: firstMust.go, tone: 'warn', icon: 'alert' }
      : {
        label: thinking === 'game' ? spinner : tonight ? 'Sim game' : 'Next day',
        sub: tonight ? `${shortDate(year, tonight.day.day).weekday} ${tonight.home ? 'vs' : 'at'} ${tonight.opponent.def.abbr}` : 'Off day',
        disabled: blocked || thinking !== null,
        onClick: () => think('game', advanceDay),
      };
    midBtn = pendingGame
      ? { label: 'Pick it up', sub: 'Game in progress', icon: 'play', onClick: () => void resumeGame(true) }
      : {
        label: live ? 'Back to game' : 'Play ball',
        sub: live ? 'In progress' : !todayGame ? 'No game today' : held ? 'Settle the list' : 'Coach it live',
        icon: held && !live ? 'lock' : 'play',
        guide: 'play-ball',
        disabled: live ? false : busyNow || thinking !== null || held || !todayGame,
        // Looking at another game: roll to tonight's first, then go, holding
        // the same lock the sims hold so neither can fire in the gap (M84).
        onClick: () => { if (focus !== nextIdx && !live) think('play', startManagedGame, 650); else void startManagedGame(); },
      };
    rightBtn = {
      label: thinking === 'week' ? spinner : 'Sim week',
      sub: busy && progress ? `Day ${progress.day} of ${progress.totalDays}` : plural(left3, 'game') + ' left',
      disabled: blocked || thinking !== null,
      onClick: () => think('week', simWeek),
    };
  }

  /* ------------------------------------------------------------ label */

  const fg = games[focus];
  const focusLabel = fg
    ? `Week ${fg.week} · ${fg.result ? 'played' : focus === nextIdx ? (fg.day.day === todayNo ? 'tonight' : 'next game') : 'upcoming'}`
    : 'Schedule';
  const off = !done && focus !== nextIdx;
  const rollHome = (): void => { if (focus !== nextIdx) setJump((j) => ({ to: nextIdx, n: (j?.n ?? 0) + 1 })); };

  return (
    <>
      <main className="pb-page pb-home" aria-label="Today">
        <FirstVisit id="today" />
        <div className="pb-home__bar">
          {/* The full schedule, now that it has no tab of its own. */}
          <button type="button" className="pb-home__label" onClick={() => openOverlay('schedule')}>
            <Icon name="calendar" size={12} />
            <span>{farewell ? 'Last season · ' : leavingHere ? 'Leaving · ' : ''}{focusLabel}</span>
          </button>
          {off ? (
            <button type="button" className="pb-home__jump" onClick={rollHome}>
              <Icon name="target" size={11} />Next game
            </button>
          ) : rank ? (
            <span className="pb-home__rank">#{rank}{projected ? ' proj' : ''}</span>
          ) : null}
        </div>

        {games.length > 0 ? (
          <GameWheel
            items={games}
            home={nextIdx}
            render={face}
            onOpen={openFromWheel}
            onFocus={setFocus}
            jump={jump}
          />
        ) : <div className="pb-wheel" />}

        <section className="pb-home__todo" aria-label="To do">
          <div className="pb-home__todohead">
            <span>To do</span>
            <small className={pending ? 'is-warning' : 'is-positive'}>{pending ? `${pending} to do` : 'All clear'}</small>
          </div>
          <div className="pb-home__todolist">
            {list.map((t) => (
              <div key={t.id} className={`pb-todo is-${t.tone}${t.must ? ' is-must' : ''}${t.done ? ' is-done' : ''}`}>
                <span className="pb-todo__icon"><Icon name={t.done ? 'check' : t.icon} size={14} /></span>
                <span className="pb-todo__text">
                  <b>{t.title}</b>
                  <small>{t.sub}</small>
                </span>
                {t.action && !t.done && (
                  <button
                    type="button"
                    className="pb-todo__btn"
                    data-guide={t.id === firstMustId ? 'need-must' : undefined}
                    onClick={t.action.onClick}
                  >{t.action.label}</button>
                )}
              </div>
            ))}
            {list.length === 0 && <p className="pb-home__clear">Nothing waiting.</p>}
          </div>
        </section>

        <div className="pb-home__actions">
          {[leftBtn, midBtn, rightBtn].map((b, i) => (
            <button
              key={i}
              type="button"
              className={`pb-home__act${i === 1 ? ' is-main' : ''}${b.tone === 'warn' ? ' is-warn' : ''}`}
              disabled={b.disabled}
              data-guide={b.guide}
              onClick={() => { rollHome(); b.onClick?.(); }}
            >
              <span className="pb-home__actlabel">{b.icon && <Icon name={b.icon} size={i === 1 ? 15 : 13} />}{b.label}</span>
              {b.sub && <small>{b.sub}</small>}
            </button>
          ))}
        </div>
      </main>

      {openGame && openGame.day in (season.boxScores ?? {}) && (
        <BoxScoreSheet
          box={season.boxScores[openGame.day]!}
          season={season}
          onClose={() => setOpenGame(null)}
        />
      )}
    </>
  );
}
