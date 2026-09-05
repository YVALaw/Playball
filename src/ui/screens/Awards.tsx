// Awards.tsx
// End of season honors, plus the All-Conference first team.
//
// Two rooms in one file. On the offseason night itself this is a CEREMONY —
// every award face-down, flipped one tap at a time, with the room throwing
// paper when a winner is yours — because a list of results is a spreadsheet
// and a spreadsheet is not how anybody remembers winning Player of the Year.
// Revisited later (from history, from the program page) it is the list again:
// the ceremony already happened, and making somebody re-flip cards to look up
// a name would be theatre at the expense of the reader.

import { useRef, useState, type ReactNode } from 'react';
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
import { sfx, buzz } from '../sound.js';
import { burstConfetti } from '../celebrate.js';

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

/**
 * One face-down card. Tapping turns it; a winner of yours gets the clap track,
 * a buzz, and paper in the school's colours thrown across the whole frame.
 * The celebration keys off the REVEAL, not the render, so scrolling past a
 * card you already turned stays quiet.
 */
function FlipCard({ id, label, mine, tint, revealed, onReveal, children }: {
  id: string; label: string; mine: boolean; tint: string;
  revealed: boolean; onReveal: (id: string) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = (): void => {
    if (revealed) return;
    onReveal(id);
    sfx('glove', { gain: 0.35, rate: 1.15 });
    if (mine) {
      sfx('clap', { gain: 0.55 });
      buzz([20, 40, 40]);
      const frame = ref.current?.closest('.app-frame');
      if (frame instanceof HTMLElement) {
        burstConfetti(frame, [tint, '#f5efe0']);
      }
    }
  };
  return (
    <div ref={ref} className={`flip${revealed ? ' revealed' : ''}`}>
      <div className="flip-inner">
        {/*
          The front face no longer takes the tap. Reported from the phone:
          "when tapping on the right side of the screen they don't reveal, it
          only works if I tap on the left side" — and desktop hit-testing
          probes clean across the full width, which is the tell. WebKit
          hit-tests 3D-transformed faces by their projected quads and gets the
          coplanar mirrored back involved despite backface-visibility and
          pointer-events, so which half of a face-down card worked depended on
          the browser's arithmetic rather than on this markup.

          So the tap lives on a flat overlay below instead — an ordinary 2D
          control WebKit has no opinions about — and both faces are scenery.
        */}
        <button type="button" className="flip-front" tabIndex={-1} aria-hidden>
          <small>{label}</small>
          <strong>?</strong>
          <span>TAP TO REVEAL</span>
        </button>
        <div className="flip-back">{children}</div>
      </div>
      {!revealed && (
        <button
          type="button"
          className="flip-tap"
          aria-label={`Reveal ${label}`}
          onClick={reveal}
        />
      )}
    </div>
  );
}

export function Awards() {
  // Rendered both as a normal screen and as a step of the offseason. The
  // continue only belongs in the second case — and so does the ceremony.
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

  const ceremony = phase !== null;
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const revealedSet = (id: string): void =>
    setShown((prev) => new Set(prev).add(id));

  if (!season || !team) return null;

  if (!seasonComplete(season)) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">SEASON IN PROGRESS</div>
        <div style={{
          marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 250, margin: '8px auto 0',
        }}>
          Handed out in June.
        </div>
      </div>
    );
  }

  const awards = seasonAwards(season);
  const first = allConference(season);
  const coach = coachOfTheYear(season, lastPostseason);

  // Everything the night can turn over, so "is the room done" is one check.
  const allIds = [
    ...awards.map((a) => `a:${a.title}`),
    'first-team',
    ...(coach ? ['coach'] : []),
  ];
  const done = !ceremony || allIds.every((id) => shown.has(id));

  /*
    Each winner wears his school — the BOX, not the letters. Reported from
    testing: "it's not the name letters that should be colored, it's the box
    they are in", and confirmed again on the port: "I like the coloring in
    each winner so keep that part."
  */
  const awardBody = (a: (typeof awards)[number]): ReactNode => {
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
    // A button only when there is a man to open. "A tap that opens nothing is
    // worse than no tap at all."
    return a.id
      ? (
        <button key={a.title} type="button" style={tone} onClick={() => openPlayer(a.id!)}>
          {body}
        </button>
      )
      : <div key={a.title} style={tone}>{body}</div>;
  };

  const coachCard = coach && (
    <section className="award-feature showpiece">
      <StarIcon />
      <small>COACH OF THE YEAR</small>
      <h2>{coach.team === team.index ? coachName : coach.school}</h2>
      <p>
        {coach.team === team.index ? `${coach.school} · ` : ''}
        {coach.wins}-{coach.losses}
      </p>
      <p>{COACH_BODY[coach.reason]}</p>
    </section>
  );

  const firstTeamList = (
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
  );

  return (
    <FixedHeader
      header={<ModuleIntro kicker={`${year} HONORS`} title="Awards night" />}
      action={phase !== null && (
        <FloatingAction label="SEASON REVIEW" onClick={() => void nextPhase('awards')} />
      )}
    >
    <FirstVisit id="awards" />
    <main className="module-workspace offseason-awards">
      {/*
        The tallies would spoil the envelopes. On the ceremony night the strip
        waits until the last card has turned; on a revisit there is nothing
        left to spoil and it leads, as any results page should.
      */}
      {done && (
        <MetricStrip>
          <Metric
            label="YOUR PROGRAM"
            value={String(awards.filter((a) => a.team === team.def.abbr).length
              + (coach?.team === team.index ? 1 : 0))}
            note="HONORS"
          />
          <Metric
            label="FIRST TEAM"
            value={String(first.filter((p) => p.team === team.def.abbr).length)}
            note={`OF ${first.length}`}
          />
          <Metric label="AWARDS" value={String(awards.length)} note="HANDED OUT" />
        </MetricStrip>
      )}

      {ceremony && !done && (
        <button
          type="button" className="reveal-all"
          onClick={() => setShown(new Set(allIds))}
        >
          SKIP THE CEREMONY — TURN EVERYTHING
        </button>
      )}

      <SectionHeading kicker="MAJOR AWARDS" title="National honors" />
      <section className="award-list">
        {awards.map((a) => {
          const id = `a:${a.title}`;
          return ceremony
            ? (
              <FlipCard
                key={a.title} id={id} label={a.title.toUpperCase()}
                mine={a.team === team.def.abbr} tint={teamColour(a.team)}
                revealed={shown.has(id)} onReveal={revealedSet}
              >{awardBody(a)}</FlipCard>
            )
            : awardBody(a);
        })}
      </section>

      <SectionHeading kicker="ALL-CONFERENCE" title="First Team" />
      {ceremony
        ? (
          <FlipCard
            id="first-team" label="THE FIRST TEAM"
            mine={first.some((p) => p.team === team.def.abbr)}
            tint={teamColour(team.def.abbr)}
            revealed={shown.has('first-team')} onReveal={revealedSet}
          >{firstTeamList}</FlipCard>
        )
        : firstTeamList}

      {/*
        Coach of the Year closes the night, the way it closes the real one —
        which is why the ceremony renders it last while the reference list
        keeps it wherever the reader's eye lands first.

        Four stories can win it: beating what the roster was worth, winning it
        all at a school nobody has heard of, the biggest one-year turnaround,
        and a conference title on the best run margin of anybody who won one.
        The engine picks whichever was loudest this season and writes the
        headline stat itself; the card just renders it.
      */}
      {coach && <SectionHeading kicker="COACH OF THE YEAR" title="The season’s top coach" />}
      {coach && (ceremony
        ? (
          <FlipCard
            id="coach" label="COACH OF THE YEAR"
            mine={coach.team === team.index} tint={teamColour(team.def.abbr)}
            revealed={shown.has('coach')} onReveal={revealedSet}
          >{coachCard}</FlipCard>
        )
        : coachCard)}

    </main>
    </FixedHeader>
  );
}
