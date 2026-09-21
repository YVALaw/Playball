// Awards.tsx
// End-of-season honors and the all-conference first team.
//
// On the offseason night itself this is a ceremony: every award face down,
// turned one tap at a time, with confetti when a winner is yours (and a Yours
// tag, so it is said in words too). "Turn them all" skips it. Revisited later
// it is a plain list: the ceremony already happened. The summary of what your
// program won is visible from the start either way.
//
// Each winner shows the award, the name, the school by its name and crest,
// and the stat line in words.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { teamColour } from '../Avatar.js';
import { Crest } from '../Crest.js';
import { seasonComplete } from '../../engine/season.js';
import {
  seasonAwards, allConference, coachOfTheYear, type CoachAwardReason,
} from '../../engine/postseason.js';
import { sfx, buzz } from '../sound.js';
import { burstConfetti } from '../celebrate.js';
import {
  Button, EmptyState, Icon, Marquee, SectionHeader, Tag, cx,
} from '../components/ui/index.js';
import { POSITION_NAME, plural, statLineWords } from '../words.js';
import { ContinueBar, StepScreen } from './OffseasonStep.js';

/** The sentence under the coach's headline, one per way of winning it. */
const COACH_BODY: Record<CoachAwardReason, string> = {
  overachieved: 'Nobody got more out of less. The roster said no; the record said yes.',
  giantKiller: 'The trophy went home to a school that had no business holding it.',
  turnaround: 'The biggest one-year climb in the country, same school, same players.',
  wireToWire: 'Won the league and outscored everybody doing it, start to finish.',
};

/**
 * One face-down card. Tapping turns it; a winner of yours gets the clap, a
 * buzz, and paper in the school's colours. The celebration keys off the
 * reveal, not the render, so scrolling past a turned card stays quiet.
 *
 * The tap lives on a flat button over the card rather than on the 3D faces:
 * WebKit hit-tests rotated faces by their projected shapes, and only half of
 * a face-down card used to respond.
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
      if (frame instanceof HTMLElement) burstConfetti(frame, [tint, '#f5efe0']);
    }
  };
  return (
    <div ref={ref} className={cx('pb-flip', revealed && 'is-revealed')}>
      <div className="pb-flip__inner">
        <div className="pb-flip__front" aria-hidden>
          <small>{label}</small>
          <strong>?</strong>
          <span>Tap to turn it over</span>
        </div>
        <div className="pb-flip__back">{children}</div>
      </div>
      {!revealed && (
        <button type="button" className="pb-flip__tap" aria-label={`Turn over: ${label}`} onClick={reveal} />
      )}
    </div>
  );
}

/** One winner: the school's colour down the side, its crest and name. */
function Winner(
  { eyebrow, name, school, abbr, line, mine, onOpen }:
  { eyebrow: string; name: string; school: string; abbr: string; line: string; mine: boolean; onOpen?: () => void },
) {
  const body = (
    <>
      <Crest abbr={abbr} size={40} />
      <span className="pb-award__text">
        <span className="pb-eyebrow">{eyebrow}</span>
        <span className="pb-award__name">
          <span className="pb-ellipsis">{name}</span>
          {mine && <Tag tone="you">Yours</Tag>}
        </span>
        <span className="pb-award__line">{school} · {line}</span>
      </span>
      {onOpen && <Icon name="chevron-right" size={20} className="pb-award__chevron" />}
    </>
  );
  const style = { borderLeftColor: teamColour(abbr) };
  return onOpen
    ? <button type="button" className="pb-award is-interactive" style={style} onClick={onOpen}>{body}</button>
    : <div className="pb-award" style={style}>{body}</div>;
}

export function Awards() {
  // Rendered both as a normal screen and as a step of the offseason. The
  // ceremony and the continue bar belong to the second case only.
  const phase = useDynasty((s) => s.phase);
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
  const reveal = (id: string): void => setShown((prev) => new Set(prev).add(id));
  const ready = !!season && !!team && seasonComplete(season);
  const awards = ready ? seasonAwards(season!) : [];
  const first = ready ? allConference(season!) : [];
  const coach = ready ? coachOfTheYear(season!, lastPostseason) : null;
  const allIds = [...awards.map((a) => `a:${a.title}`), 'first-team', ...(coach ? ['coach'] : [])];
  const done = !ceremony || allIds.every((id) => shown.has(id));
  const summaryRef = useRef<HTMLDivElement>(null);
  const wasDone = useRef(done);
  useEffect(() => {
    if (ceremony && done && !wasDone.current) {
      requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    wasDone.current = done;
  }, [ceremony, done]);

  if (!season || !team) return null;

  if (!seasonComplete(season)) {
    return (
      <main className="pb-page">
        <EmptyState icon="star" title="Awards are handed out in June" text="Come back when the season is over." />
      </main>
    );
  }

  const schoolOf = (abbr: string): string => season.teams.find((t) => t.def.abbr === abbr)?.def.school ?? abbr;
  const mineCount = awards.filter((a) => a.team === team.def.abbr).length + (coach?.team === team.index ? 1 : 0);
  const firstMine = first.filter((p) => p.team === team.def.abbr).length;

  const awardRow = (a: (typeof awards)[number]): ReactNode => (
    <Winner
      key={a.title}
      eyebrow={a.title}
      name={a.name}
      school={schoolOf(a.team)}
      abbr={a.team}
      line={statLineWords(a.line)}
      mine={a.team === team.def.abbr}
      onOpen={a.id ? () => openPlayer(a.id!) : undefined}
    />
  );

  const firstTeam = (
    <div className="pb-award-list">
      {first.map((p, i) => (
        <Winner
          key={`${p.position}-${p.id}-${i}`}
          eyebrow={POSITION_NAME[p.position as keyof typeof POSITION_NAME] ?? p.position}
          name={p.name}
          school={schoolOf(p.team)}
          abbr={p.team}
          line={statLineWords(p.line)}
          mine={p.team === team.def.abbr}
          onOpen={() => openPlayer(p.id)}
        />
      ))}
    </div>
  );

  const coachCard = coach && (
    <Winner
      eyebrow="Coach of the Year"
      name={coach.team === team.index ? coachName : `${coach.school} head coach`}
      school={coach.school}
      abbr={season.teams[coach.team]?.def.abbr ?? ''}
      line={`${coach.wins}–${coach.losses} · ${COACH_BODY[coach.reason]}`}
      mine={coach.team === team.index}
    />
  );

  const page = (
    <main className="pb-page">
      <FirstVisit id="awards" />
      <div ref={summaryRef}>
        <Marquee
          eyebrow={`${year} honors · The ceremony`}
          title="Awards"
          numbers={[
            { label: 'Your program', value: done ? mineCount : '?', note: done ? plural(mineCount, 'honor') : 'Turn the cards' },
            { label: 'First team', value: done ? firstMine : '?', note: `of ${first.length} places` },
            { label: 'Handed out', value: awards.length + (coach ? 1 : 0), note: 'Awards' },
          ]}
        />
      </div>

      {ceremony && !done && (
        <Button variant="secondary" block icon="layers" onClick={() => setShown(new Set(allIds))}>Turn them all</Button>
      )}

      <section className="pb-stack">
        <SectionHeader title="National awards" />
        <div className="pb-award-list">
          {awards.map((a) => {
            const id = `a:${a.title}`;
            return ceremony ? (
              <FlipCard
                key={a.title} id={id} label={a.title}
                mine={a.team === team.def.abbr} tint={teamColour(a.team)}
                revealed={shown.has(id)} onReveal={reveal}
              >{awardRow(a)}</FlipCard>
            ) : awardRow(a);
          })}
        </div>
      </section>

      <section className="pb-stack">
        <SectionHeader
          title="All-Conference first team"
          description="Picked from every school"
        />
        {ceremony ? (
          <FlipCard
            id="first-team" label="The first team"
            mine={first.some((p) => p.team === team.def.abbr)}
            tint={teamColour(team.def.abbr)}
            revealed={shown.has('first-team')} onReveal={reveal}
          >{firstTeam}</FlipCard>
        ) : firstTeam}
      </section>

      {/* Coach of the Year closes the night, the way it closes the real one. */}
      {coach && (
        <section className="pb-stack">
          <SectionHeader title="Coach of the Year" />
          {ceremony ? (
            <FlipCard
              id="coach" label="Coach of the Year"
              mine={coach.team === team.index} tint={teamColour(team.def.abbr)}
              revealed={shown.has('coach')} onReveal={reveal}
            >{coachCard}</FlipCard>
          ) : coachCard}
        </section>
      )}
    </main>
  );

  return ceremony ? <StepScreen bar={<ContinueBar from="awards" />}>{page}</StepScreen> : page;
}
