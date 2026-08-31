// Awards.tsx
// End of season honours, plus the All-Conference first team.
//
// These only mean anything once a season is in the books, so the screen says so
// rather than showing a leaderboard of nobody.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { ChevronRightIcon, StarIcon } from '@radix-ui/react-icons';
import {
  FieldNote, Metric, MetricStrip, ModuleIntro, SectionHeading,
} from '../components/Kit.js';
import { FirstVisit } from '../Tutorial.js';
import { teamColour } from '../Avatar.js';
import { seasonComplete } from '../../engine/season.js';
import {
  seasonAwards, allConference, coachOfTheYear, type CoachAwardReason,
} from '../../engine/postseason.js';

/**
 * The sentence under the headline stat, one per way of winning it. The stat
 * itself comes from the engine (`award.line`) so every screen tells the same
 * story; this is just the colour around it.
 */
const COACH_BODY: Record<CoachAwardReason, string> = {
  overachieved: 'Nobody got more out of less. The roster said no; the record said yes.',
  giantKiller: 'The trophy went home to a school that had no business holding it.',
  turnaround: 'The biggest one-year climb in the country, same school, same players.',
  wireToWire: 'Won the league and outscored everybody doing it, start to finish.',
};

export function Awards() {
  // Rendered both as a normal screen and as a step of the offseason. The
  // continue only belongs in the second case.
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const coachName = useDynasty((s) => s.coach.name);
  void version;

  if (!season || !team) return null;

  if (!seasonComplete(season)) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">SEASON IN PROGRESS</div>
        <div style={{
          marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 250, margin: '8px auto 0',
        }}>
          Awards are handed out when the regular season is over.
        </div>
      </div>
    );
  }

  const awards = seasonAwards(season);
  const first = allConference(season);
  const coach = coachOfTheYear(season, lastPostseason);

  return (
    <FixedHeader
      header={<ModuleIntro kicker={`${year} HONOURS`} title="Awards night" />}
      action={phase !== null && (
        <FloatingAction label="SEASON REVIEW" onClick={() => void nextPhase('awards')} />
      )}
    >
    <FirstVisit id="awards" />
    <main className="module-workspace">
      <MetricStrip>
        <Metric
          label="YOUR PROGRAM"
          value={String(awards.filter((a) => a.team === team.def.abbr).length
            + (coach?.team === team.index ? 1 : 0))}
          note="HONOURS"
        />
        <Metric
          label="FIRST TEAM"
          value={String(first.filter((p) => p.team === team.def.abbr).length)}
          note={`OF ${first.length}`}
        />
        <Metric label="AWARDS" value={String(awards.length)} note="HANDED OUT" />
      </MetricStrip>

      {/*
        Coach of the Year, which is not the most wins — that award always goes
        to whoever was handed the best roster, and it says nothing.

        Four stories can win it: beating what the roster was worth, winning it
        all at a school nobody has heard of, the biggest one-year turnaround, and
        a conference title on the best run margin of anybody who won one. The
        engine picks whichever was loudest this season, measured against what a
        normal year of that story looks like, and writes the headline stat
        itself; the card just renders it.
      */}
      {coach && (
        <section className="award-feature">
          <StarIcon />
          <small>COACH OF THE YEAR</small>
          <h2>{coach.team === team.index ? coachName : coach.school}</h2>
          <p>
            {coach.team === team.index ? `${coach.school} · ` : ''}
            {coach.wins}-{coach.losses} · {coach.line}
          </p>
          <p>{COACH_BODY[coach.reason]}</p>
        </section>
      )}

      {/*
        Each winner wears his school — the BOX, not the letters. Reported from
        testing: "it's not the name letters that should be colored, it's the box
        they are in", and confirmed again on the port: "I like the coloring in
        each winner so keep that part." So the colour stays exactly where it was
        and only the anatomy around it changed.
      */}
      <SectionHeading kicker="THE WINNERS" title="Who took what" />
      <section className="award-list">
        {awards.map((a) => {
          const tint = teamColour(a.team);
          const body = (
            <>
              <span className="award-mark" style={{ background: tint }}>{a.team}</span>
              <span>
                <small>{a.title.toUpperCase()}</small>
                <strong>{a.name}</strong>
                <p>{a.line}</p>
              </span>
              {a.id && <ChevronRightIcon />}
            </>
          );
          const tone = { background: `${tint}33`, borderLeftColor: tint };
          // A button only when there is a man to open. The record book settled
          // this exact case with a div — "a tap that opens nothing is worse than
          // no tap at all" — and a winner with no id was a button that silently
          // swallowed the press.
          return a.id
            ? (
              <button key={a.title} type="button" style={tone} onClick={() => openPlayer(a.id!)}>
                {body}
              </button>
            )
            : <div key={a.title} style={tone}>{body}</div>;
        })}
      </section>

      <SectionHeading kicker="ALL-CONFERENCE" title="The first team" />
      <section className="award-list">
        {first.map((p, i) => {
          const tint = teamColour(p.team);
          return (
            <button
              key={`${p.position}-${p.id}-${i}`}
              type="button"
              style={{ background: `${tint}33`, borderLeftColor: tint }}
              onClick={() => openPlayer(p.id)}
            >
              <span className="award-mark" style={{ background: tint }}>{p.position}</span>
              <span>
                <small>{p.team}</small>
                <strong>{p.name}</strong>
                <p>{p.line}</p>
              </span>
              <ChevronRightIcon />
            </button>
          );
        })}
      </section>

      <FieldNote
        title="The room is not over"
        text="Season review is next. Tap any winner or first-team man to read his card before you move on."
      />
    </main>
    </FixedHeader>
  );
}
