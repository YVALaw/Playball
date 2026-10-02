// TeamCard.tsx
// Another program's page: who they are, how they are playing, you against
// them, and what you can do about them.
//
// Opened from any team row, over whatever screen it was opened from. A header
// that says who they are and how they relate to you, then four views:
// Overview, Roster, Results and Scouting. Your career moves (following the
// program, watching its coach's job, sending word you're interested) sit in
// their own section, apart from preparing for a game.
//
// Box scores are kept for your own program alone, so a rival's season is a
// list of scores, and the Results view says so.

import { createContext, useContext, useState } from 'react';
import { dollars, remaining, SCOUT_COST, SCOUT_DAYS } from '../../engine/economy.js';
import { SCOUTING } from '../../state/features.js';
import { handles } from '../../state/depth.js';
import { cultureFor } from '../../data/cultures.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Crest } from '../Crest.js';
import { overallOf } from '../../engine/ratings.js';
import { prestigeStars, rosterStrength } from '../../engine/program.js';
import { teamReads } from '../../engine/tendencies.js';
import {
  battingAverage, era, inningsPitched, regularRecord, rpiOrder,
} from '../../engine/season.js';
import { pct, ipText, shortDate } from '../format.js';
import type { Arm, Hitter } from '../../engine/types.js';
import type { SeasonState } from '../../engine/season.js';
import {
  Button, Callout, Card, ConfirmButton, DescriptionList, EmptyState, Face, GameRow, List, ListRow,
  ProfileHeader, RatingRow, SectionHeader, SegmentedControl, StatGroup, Stars, StatusBadge, Switch, Table,
  Tag, type TableColumn,
} from '../components/ui/index.js';
import { capsWords, conferenceName, plural, recordText, stateName } from '../words.js';

type Owner = SeasonState['teams'][number];

/**
 * How a table row asks for a program's page. A context, because the tables
 * that open it are rendered in several places; the default does nothing, so a
 * table outside the app frame still works.
 */
export const OpenTeam = createContext<(index: number) => void>(() => {});

/** Tap a team row to open its page. */
export const useOpenTeam = (): ((index: number) => void) => useContext(OpenTeam);

type View = 'overview' | 'roster' | 'results' | 'scouting';

export function TeamCard({ index }: { index: number }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const me = useUserTeam();
  const rivalry = useDynasty((s) => s.rivalry);
  const [view, setView] = useState<View>('overview');
  void version;

  const t = season?.teams[index];
  if (!season || !t) {
    return (
      <main className="pb-page">
        <EmptyState icon="globe" title="No program selected" text="Tap a team in the conference table or the national ranking." />
      </main>
    );
  }

  const reg = regularRecord(t);
  const stars = prestigeStars(t.prestige);
  const rank = t.gp === 0 ? 0 : rpiOrder(season).findIndex((r) => r.team.index === t.index) + 1;
  const mine = me !== null && me.index === t.index;
  const rival = !!me && !mine && t.def.abbr === me.def.rival;
  const state = (t.def as { state?: string }).state;

  // How they relate to you, in one badge.
  let relation = null;
  if (mine) relation = <Tag tone="you">Your program</Tag>;
  else if (rival) {
    relation = (
      <StatusBadge tone="warning" icon="star-filled">
        Your rival{rivalry.w + rivalry.l > 0 ? ` · ${rivalry.w >= rivalry.l ? 'you lead' : 'you trail'} ${recordText(Math.max(rivalry.w, rivalry.l), Math.min(rivalry.w, rivalry.l))}` : ''}
      </StatusBadge>
    );
  } else if (me && me.conference === t.conference && (t.cw + t.cl > 0)) {
    const gap = ((t.cw - me.cw) + (me.cl - t.cl)) / 2;
    relation = (
      <StatusBadge tone="neutral" icon={false}>
        {gap === 0 ? 'Level with you in the conference'
          : gap > 0 ? `${gap} ${gap === 1 ? 'game' : 'games'} ahead of you in the conference`
            : `${-gap} ${gap === -1 ? 'game' : 'games'} behind you in the conference`}
      </StatusBadge>
    );
  }

  return (
    <main className="pb-page">
      <ProfileHeader
        media={<Crest abbr={t.def.abbr} size={72} />}
        eyebrow={`${conferenceName(t.conference)}${state ? ` · ${stateName(state)}` : ''}`}
        name={t.def.school}
        meta={t.def.nickname}
        tags={(
          <>
            <Stars value={stars} label="Prestige" />
            {relation}
          </>
        )}
        stats={[
          { label: 'National rank', value: rank > 0 ? `#${rank}` : '—' },
          { label: 'Record', value: recordText(reg.w, reg.l) },
        ]}
      />
      <SegmentedControl<View>
        label="Program page"
        value={view}
        onChange={setView}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'roster', label: 'Roster' },
          { value: 'results', label: 'Results' },
          ...(!mine && SCOUTING ? [{ value: 'scouting' as const, label: 'Scouting' }] : []),
        ]}
      />
      {view === 'overview' && <Overview t={t} me={me} season={season} />}
      {view === 'roster' && <RosterView t={t} season={season} />}
      {view === 'results' && <Results t={t} mine={mine} season={season} />}
      {view === 'scouting' && !mine && SCOUTING && <Scouting t={t} />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/** What you have done to each other this year, and what is still to come. */
function headToHead(season: SeasonState, mine: number, theirs: number) {
  const isPair = (a: number, b: number): boolean =>
    (a === mine && b === theirs) || (a === theirs && b === mine);
  const games = season.results
    .filter((r) => isPair(r.home, r.away))
    .map((r) => {
      const home = r.home === mine;
      return { day: r.day, home, us: home ? r.homeRuns : r.awayRuns, them: home ? r.awayRuns : r.homeRuns };
    })
    .sort((a, b) => a.day - b.day);
  const w = games.filter((g) => g.us > g.them).length;
  const ahead = season.schedule.slice(season.dayIndex).filter((d) => d.games.some((g) => isPair(g.home, g.away)));
  return { w, l: games.length - w, games, toCome: ahead.length, next: ahead[0]?.day ?? null };
}

function Overview({ t, me, season }: { t: Owner; me: Owner | null; season: SeasonState }) {
  const year = useDynasty((s) => s.year);
  const mine = !!me && me.index === t.index;
  const h2h = me && !mine ? headToHead(season, me.index, t.index) : null;
  const culture = cultureFor(t);
  const games = season.results
    .filter((r) => r.home === t.index || r.away === t.index)
    .sort((a, b) => a.day - b.day)
    .map((r) => {
      const home = r.home === t.index;
      return { home, won: (home ? r.homeRuns : r.awayRuns) > (home ? r.awayRuns : r.homeRuns) };
    });
  const last = games.slice(-10);
  const lastW = last.filter((g) => g.won).length;
  const streak = t.streak === 0 ? 'No streak' : `${t.streak > 0 ? 'Won' : 'Lost'} ${Math.abs(t.streak)} in a row`;
  const diff = t.rs - t.ra;

  return (
    <>
      <StatGroup
        size="sm"
        items={[
          { label: 'Conference', value: recordText(t.cw, t.cl), note: conferenceName(t.conference) },
          { label: `Last ${last.length || 10}`, value: last.length ? recordText(lastW, last.length - lastW) : '—', note: streak },
          { label: 'Run difference', value: `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`, note: `${t.rs} scored, ${t.ra} allowed` },
        ]}
      />

      {h2h && me && (
        <Card
          title={`You and ${t.def.school}`}
          eyebrow="This season"
          trailing={h2h.games.length > 0 ? <StatusBadge tone={h2h.w >= h2h.l ? 'positive' : 'negative'} icon={false}>{recordText(h2h.w, h2h.l)}</StatusBadge> : undefined}
          flush
        >
          {h2h.games.length > 0 ? (
            <List className="pb-list--inset" label="Games between you">
              {h2h.games.map((g) => {
                const when = shortDate(year, g.day);
                return (
                  <GameRow
                    key={g.day}
                    day={when.weekday}
                    date={when.date}
                    opponent={t.def.school}
                    abbr={t.def.abbr}
                    home={g.home}
                    kind="Final"
                    result={{ win: g.us > g.them, score: `${g.us}–${g.them}` }}
                  />
                );
              })}
            </List>
          ) : null}
          <p className="pb-note pb-card__note">
            {h2h.toCome > 0 && h2h.next !== null
              ? `${h2h.games.length ? plural(h2h.toCome, 'game') + ' still to play' : `First meeting ${shortDate(year, h2h.next).weekday}, ${shortDate(year, h2h.next).date}`}${h2h.games.length ? ` · next ${shortDate(year, h2h.next).date}` : ''}.`
              : h2h.games.length ? 'The season series is over.' : `You do not play ${t.def.school} this season.`}
          </p>
          <Table
            dense
            label="You and them"
            columns={[
              { label: 'Side by side', grow: true },
              { label: 'You', width: '56px', align: 'right' },
              { label: 'Them', width: '56px', align: 'right' },
            ]}
            rows={[
              { key: 'p', cells: ['Prestige, of 100', me.prestige, t.prestige] },
              { key: 'r', cells: ['Roster strength', rosterStrength(me.team), rosterStrength(t.team)] },
              { key: 'd', cells: ['Run difference', me.rs - me.ra, t.rs - t.ra] },
            ]}
            caption="Roster strength is the talent on the field today; prestige is the program's long-term pull. Neither is a chance of winning."
          />
        </Card>
      )}

      {culture && (
        <Card title="How they play" eyebrow={culture.name} trailing={<Tag>{capsWords(culture.edge)}</Tag>}>
          <p className="pb-text">{culture.creed}</p>
          <p className="pb-text-muted">
            {culture.patience >= 60 ? 'The board gives a coach time to build. '
              : culture.patience <= 40 ? 'The board counts bad seasons quickly. ' : 'The board wants progress and a direction. '}
            {culture.ambition >= 60 ? 'The benchmark is the national tournament.'
              : culture.ambition <= 40 ? 'A winning season clears the bar.' : 'Postseason baseball is expected.'}
          </p>
        </Card>
      )}

      {!mine && me && <YourCareer t={t} />}
    </>
  );
}

/**
 * Your own career, apart from preparing for a game: follow the program, watch
 * its head coach's job, and send word you would be interested, which spends
 * one of three approaches a season and can get back to your own board.
 */
function YourCareer({ t }: { t: Owner }) {
  const watch = useDynasty((s) => s.watch);
  const toggleProgramWatch = useDynasty((s) => s.toggleProgramWatch);
  const toggleJobWatch = useDynasty((s) => s.toggleJobWatch);
  const approaches = useDynasty((s) => s.approaches);
  const approach = useDynasty((s) => s.approach);
  const [said, setSaid] = useState<string | null>(null);
  const abbr = t.def.abbr;
  const left = Math.max(0, 3 - approaches.tried.length);
  const tried = approaches.tried.includes(t.index);
  const interested = approaches.interest.includes(t.index);

  return (
    <section className="pb-stack">
      <SectionHeader title="Your career" />
      <div className="pb-list">
        <Switch
          label={`Follow ${t.def.school}`}
          description="More of their news"
          checked={watch.programs.includes(abbr)}
          onChange={() => toggleProgramWatch(abbr)}
        />
        <Switch
          label="Watch their head coach's job"
          description="Hear when the job opens"
          checked={watch.jobs.includes(abbr)}
          onChange={() => toggleJobWatch(abbr)}
        />
      </div>
      <Card title="Send word you're interested" eyebrow={`${left} of 3 left this season`}>
        <p className="pb-text-muted">The board may hear about it.</p>
        {said ? (
          <Callout tone={said.startsWith('Somebody') ? 'warning' : 'info'}>{said}</Callout>
        ) : interested ? (
          <Callout tone="positive">They would take the call when the job opens.</Callout>
        ) : tried ? (
          <p className="pb-note">You have already sent word here this season.</p>
        ) : left === 0 ? (
          <p className="pb-note">You have used all three this season.</p>
        ) : (
          <ConfirmButton
            variant="secondary"
            icon="envelope"
            idle="Send word"
            armed="Tap again to send it"
            armedMeta={`${left - 1} of 3 left after`}
            onConfirm={() => {
              const out = approach(t.index);
              setSaid(out === 'interested' ? 'They would take the call when the job opens.'
                : out === 'caught' ? 'Somebody talked. Your own board has heard about it.'
                  : out === 'ignored' ? 'Nothing came back.' : 'Not this season.');
            }}
          />
        )}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Their lineup, rotation, bullpen and bench. Every name opens the player card,
 * which withholds a rival's potential: what he has done is public, what he
 * might become is his coach's to know.
 */
function RosterView({ t, season }: { t: Owner; season: SeasonState }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const who = (id: string, name: string, sub: string) => (
    <span className="pb-teamcell">
      <Face id={id} team={t.def.abbr} size={28} />
      <span className="pb-teamcell__text">
        <span className="pb-teamcell__name"><span className="pb-ellipsis">{name}</span></span>
        <span className="pb-teamcell__sub">{sub}</span>
      </span>
    </span>
  );
  const batCols: TableColumn[] = [
    { label: 'Hitter', grow: true },
    { label: 'Rating', width: '48px', align: 'right', strong: true },
    { label: 'AVG', title: 'Batting average', width: '44px', align: 'right' },
    { label: 'HR', title: 'Home runs', width: '32px', align: 'right' },
  ];
  const armCols: TableColumn[] = [
    { label: 'Pitcher', grow: true },
    { label: 'Rating', width: '48px', align: 'right', strong: true },
    { label: 'ERA', title: 'Earned run average', width: '44px', align: 'right' },
    { label: 'IP', title: 'Innings pitched', width: '40px', align: 'right' },
  ];
  const bats = (list: Hitter[]) => list.map((p) => {
    const line = season.batting.get(p.id);
    return {
      key: p.id, onClick: () => openPlayer(p.id),
      cells: [who(p.id, p.name, p.pos), overallOf(p), line && line.ab > 0 ? pct(battingAverage(line)) : '—', line?.hr ?? 0],
    };
  });
  const arms = (list: Arm[]) => list.map((p) => {
    const line = season.pitching.get(p.id);
    return {
      key: p.id, onClick: () => openPlayer(p.id),
      cells: [who(p.id, p.name, p.role), overallOf(p), line && line.outs > 0 ? era(line).toFixed(2) : '—', line ? ipText(inningsPitched(line)) : '0'],
    };
  });
  const BAT_NOTE = 'Rating is how good he is today, out of 100. AVG batting average · HR home runs.';
  const ARM_NOTE = 'Rating is how good he is today, out of 100. ERA earned runs per 9 innings · IP innings pitched.';

  return (
    <>
      <Card title="Lineup" flush><Table dense label="Lineup" columns={batCols} rows={bats(t.team.lineup)} caption={BAT_NOTE} /></Card>
      <Card title="Rotation" flush><Table dense label="Rotation" columns={armCols} rows={arms(t.team.rotation)} caption={ARM_NOTE} /></Card>
      <Card title="Bullpen" flush><Table dense label="Bullpen" columns={armCols} rows={arms(t.team.bullpen)} caption={ARM_NOTE} /></Card>
      {t.team.bench.length > 0 && (
        <Card title="Bench" flush><Table dense label="Bench" columns={batCols} rows={bats(t.team.bench)} caption={BAT_NOTE} /></Card>
      )}
      <p className="pb-note">His potential stays with his coach.</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Results({ t, mine, season }: { t: Owner; mine: boolean; season: SeasonState }) {
  const year = useDynasty((s) => s.year);
  const rows = season.results
    .filter((r) => r.home === t.index || r.away === t.index)
    .map((r) => {
      const home = r.home === t.index;
      return {
        day: r.day, home, conference: r.conference,
        opponent: season.teams[home ? r.away : r.home],
        us: home ? r.homeRuns : r.awayRuns, them: home ? r.awayRuns : r.homeRuns,
      };
    })
    .sort((a, b) => b.day - a.day);

  if (rows.length === 0) {
    return <EmptyState icon="calendar" title="No games yet" text="They have not played a game this season." />;
  }
  return (
    <Card title="Results" eyebrow={`${plural(rows.length, 'game')} played · newest first`} flush>
      <List className="pb-list--inset" label="Results">
        {rows.map((r, i) => {
          const when = shortDate(year, r.day);
          return (
            <GameRow
              key={`${r.day}-${i}`}
              day={when.weekday}
              date={when.date}
              opponent={r.opponent?.def.school ?? '—'}
              abbr={r.opponent?.def.abbr ?? ''}
              home={r.home}
              kind={r.conference ? 'Conference' : 'Non-conference'}
              result={{ win: r.us > r.them, score: `${r.us}–${r.them}` }}
            />
          );
        })}
      </List>
      <p className="pb-note pb-card__note">
        {mine ? 'Box scores are on your schedule.' : 'Scores only.'}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Scouting
// ---------------------------------------------------------------------------

/**
 * The scouting report, and the man in their chair. The report is bought (in a
 * full career) and lasts a stretch of days; it reveals their habits and lets
 * you build a plan that applies whenever you play them.
 */
function Scouting({ t }: { t: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const scoutsHimself = useDynasty((s) => handles(s.depth, 'scouting'));
  const scoutTeam = useDynasty((s) => s.scoutTeam);
  const go = useDynasty((s) => s.go);
  const setPlaybookFocus = useDynasty((s) => s.setPlaybookFocus);
  const autoSetPlaybook = useDynasty((s) => s.autoSetPlaybook);
  const closeOverlay = useDynasty((s) => s.closeOverlay);
  const abbr = t.def.abbr;
  const day = season?.dayIndex ?? 0;
  const until = economy.scouted[t.index] ?? -1;
  const active = until >= day;
  const hasPlan = !!season?.playbooks?.[abbr];
  const daysLeft = active ? Math.max(0, until - day) : 0;
  const prestige = season?.teams[userTeam]?.prestige ?? 40;
  const budget = remaining(economy, prestige);
  const canAfford = budget >= SCOUT_COST;
  const booked = active || !scoutsHimself;
  const reads = booked ? teamReads(t.team).slice(0, 6) : [];
  const coach = t.coach;

  const openPlan = (): void => {
    if (!scoutsHimself && !season?.playbooks?.[abbr]) autoSetPlaybook(abbr);
    setPlaybookFocus(abbr);
    closeOverlay();
    go('team', 'strategy');
  };

  const status = !scoutsHimself
    ? <StatusBadge tone="positive">Your staff has it</StatusBadge>
    : active
      ? <StatusBadge tone="positive">Active · {daysLeft === 0 ? 'last day' : `${plural(daysLeft, 'day')} left`}</StatusBadge>
      : hasPlan
        ? <StatusBadge tone="warning" icon="clock">Expired</StatusBadge>
        : <StatusBadge tone="neutral" icon={false}>Not scouted</StatusBadge>;

  const strengths = coach
    ? (Object.entries(coach.skills) as Array<[string, number]>).sort((a, b) => b[1] - a[1]).slice(0, 4)
    : [];

  return (
    <>
      <Card title="Scouting report" trailing={status}>
        <p className="pb-text-muted">
          Shows their habits and lets you plan against them, for {plural(SCOUT_DAYS, 'day')}.
        </p>
        {booked ? (
          <Button variant="primary" block icon="target" onClick={openPlan}>Open their playbook</Button>
        ) : canAfford ? (
          <ConfirmButton
            block
            icon="eye"
            idle={hasPlan ? 'Refresh the report' : 'Buy the report'}
            meta={dollars(SCOUT_COST)}
            armed="Tap again to buy it"
            armedMeta={`${dollars(budget - SCOUT_COST)} left after`}
            onConfirm={() => { scoutTeam(t.index); }}
          />
        ) : (
          <Button block disabled>Need {dollars(SCOUT_COST - budget)} more</Button>
        )}
      </Card>

      {reads.length > 0 && (
        <Card title="What the report found" flush>
          <List className="pb-list--inset" label="What the report found">
            {reads.map((read) => (
              <ListRow
                key={`${read.slot}-${read.title}`}
                title={read.title === read.title.toUpperCase() ? capsWords(read.title) : read.title}
                subtitle={read.text}
              />
            ))}
          </List>
        </Card>
      )}

      <Card title={coach ? coach.name : 'Nobody in the chair'} eyebrow="Head coach">
        {coach ? (
          <>
            <DescriptionList
              items={[
                { label: 'In the job', value: coach.tenure === 0 ? 'First season' : plural(coach.tenure, 'season'), note: `Age ${coach.age}` },
                { label: 'Career record', value: recordText(coach.careerWins, coach.careerLosses), note: `${plural(coach.titles, 'national title')} · ${plural(coach.conferenceTitles, 'conference title')}` },
                {
                  label: 'Job security',
                  value: coach.security >= 70 ? 'Safe' : coach.security >= 45 ? 'Settled' : coach.security >= 25 ? 'Under pressure' : 'On the way out',
                  tone: coach.security >= 45 ? undefined : 'warning',
                  note: `${plural(coach.contractYears, 'year')} left on his deal`,
                },
              ]}
            />
            {strengths.map(([k, v]) => (
              <RatingRow key={k} label={capsWords(k.replace(/([A-Z])/g, ' $1'))} value={v} />
            ))}
          </>
        ) : <p className="pb-text-muted">The school has not named a coach yet.</p>}
      </Card>
      <p className="pb-note">Potential stays hidden.</p>
    </>
  );
}
