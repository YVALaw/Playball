// NewGame.tsx
// Choosing where the dynasty starts.
//
// Two ideas drive this screen.
//
// The first is that a star count tells you almost nothing. Two three star
// programs can be completely different jobs, and what decides which is which is
// the gap between what the school *is* and what its roster can *do* this year. A
// proud program with a thin team is asking you to survive a rebuild; a modest one
// with a senior heavy roster is handing you a window that closes in two years. So
// the card says all of it: reputation, current talent, the board's mandate in
// their own words, and how long they are giving you.
//
// The second is that **you cannot have any job you like.** A contender does not
// hand its program to someone who has never run one. So the final step is a
// desk with the offers that actually came — the handful of chairs the hiring
// ladder says would ring a rookie, picked by `startingOffers` with at least one
// guaranteed — rather than a directory of ninety six schools you page through
// discovering which ones would take the call. The ladder itself is still
// visible where it matters: mid-career, the job market prices every move.
//
// Four steps, in that order: who you are, how much of the game you want to be
// asked about, how your teams play, where you work.
//
// The second is the one that frames the rest, which is why it sits that early.
// It is not a difficulty setting and the screen says so: the engine models all
// ninety-six programs identically either way, and the only thing the answer
// moves is how much of it lands on the desk.
//
// The first is pre-filled and skippable in a single press, because a form
// standing between a player and the game is a toll, not a feature — and
// everything it collects is flavour, which is exactly why it is not allowed to
// cost anybody a minute. The second is the opposite: it is four sentences and it
// really does decide how the games are played, so it is a step of its own rather
// than a control buried in the first one.
//
// What the middle step is deliberately *not* is a second copy of the strategy
// screen. That screen exists, it is where the five policies are argued with one
// at a time, and asking somebody to set five enums before he has a team is
// asking a question he has no information to answer. Here he picks a coach; the
// policies follow from that and stay editable for ever after.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeftIcon, CheckIcon, Pencil1Icon,
} from '@radix-ui/react-icons';
import { ModuleIntro, SectionHeading } from '../components/Kit.js';
import {
  CONFERENCES, STATES_BY_REGION, type SchoolDef,
} from '../../data/schools.js';
import {
  prestigeStars, contractFor, leagueShape, playerBoard, requiredCoachPrestige,
  canBeHired, hireGateNote, ROOKIE_PRESTIGE, rosterStrength, startingOffers, offerPitch,
  randomProfile, clampAge, MIN_COACH_AGE, MAX_COACH_AGE, DEFAULT_LOOK,
  type CoachProfile, type CoachLook, type Mandate,
} from '../../engine/program.js';
import {
  PHILOSOPHIES, philosophyOf, DEFAULT_PHILOSOPHY, strategyForPhilosophy,
  type PhilosophyId,
} from '../../engine/strategy.js';
import { useDynasty, careerSeed } from '../../state/store.js';
import { SYSTEMS, type DepthMode } from '../../state/depth.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { InFrame } from '../Overlay.js';
import {
  CoachPortrait, COACH_SKIN, COACH_HAIR, CUT_LABEL, BEARD_LABEL,
} from '../CoachPortrait.js';
import { createSeason, seasonLength } from '../../engine/season.js';
import { makeRng } from '../../engine/rng.js';
import { SKILL_LABEL, type CoachSkills } from '../../engine/program.js';
import { cultureOf, CULTURE_LABEL, type CultureEdge } from '../../data/cultures.js';
import { Crest } from '../Crest.js';

const MANDATE_LABEL: Record<Mandate, string> = {
  develop: 'DEVELOP',
  build: 'REBUILD',
  compete: 'COMPETE',
  contend: 'CONTEND',
  championship: 'WIN IT ALL',
};


type BackgroundId = 'player' | 'recruiter' | 'hitting' | 'pitching';

interface CoachBackground {
  id: BackgroundId;
  title: string;
  kicker: string;
  blurb: string;
  skills: CoachSkills;
  leans: Partial<Record<CultureEdge, number>>;
  ambition: number;
  badges: string[];
}

/**
 * Step three is a background, not a personality quiz.
 *
 * The old interview asked three situations and then translated the answers into
 * the same four numbers shown below. That was a lot of reading before the first
 * pitch for a result the player could not predict. A background is both fiction
 * and mechanics at once: choose the career the coach had before the dugout and
 * see exactly which tools he brings into year one.
 */
const BACKGROUNDS: readonly CoachBackground[] = [
  {
    id: 'player', title: 'Former player', kicker: 'CLUBHOUSE',
    blurb: 'Played the game, reads people quickly, and starts with a balanced feel for both sides of the ball.',
    skills: { offense: 23, defense: 23, training: 24, recruiting: 20 },
    leans: { loyalty: 2, tradition: 1, development: 1 }, ambition: 0,
    badges: ['players'],
  },
  {
    id: 'recruiter', title: 'Recruiter', kicker: 'THE ROAD',
    blurb: 'Built his name in living rooms and summer parks. The opening class is where he has the clearest edge.',
    skills: { offense: 20, defense: 20, training: 22, recruiting: 28 },
    leans: { recruiting: 3, ambition: 1 }, ambition: 1,
    badges: ['closer'],
  },
  {
    id: 'hitting', title: 'Hitting guru', kicker: 'THE CAGES',
    blurb: 'An offensive teacher first. Bats develop faster under his eye, but the mound is not where he made his name.',
    skills: { offense: 28, defense: 19, training: 23, recruiting: 20 },
    leans: { power: 3, development: 1 }, ambition: 1,
    badges: ['slugger'],
  },
  {
    id: 'pitching', title: 'Pitching guru', kicker: 'THE MOUND',
    blurb: 'Built staffs before he built lineups. Arms and run prevention are his strongest tools from day one.',
    skills: { offense: 19, defense: 28, training: 23, recruiting: 20 },
    leans: { pitching: 3, development: 1 }, ambition: 0,
    badges: ['armsman'],
  },
];

function BackgroundIcon({ id }: { id: BackgroundId }) {
  if (id === 'player') return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="3"/><path d="M6 20c.6-4.2 2.6-6.3 6-6.3s5.4 2.1 6 6.3M5 7l4-2M19 7l-4-2"/></svg>;
  if (id === 'recruiter') return <svg viewBox="0 0 24 24" aria-hidden><circle cx="10" cy="10" r="5"/><path d="M14 14l5 5M8 10h4M10 8v4"/></svg>;
  if (id === 'hitting') return <svg viewBox="0 0 24 24" aria-hidden><path d="M5 20L16 4l3 2L8 21z"/><circle cx="18" cy="17" r="2"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden><circle cx="8" cy="7" r="3"/><path d="M6 20c.5-4 2.3-6 5-6 2 0 3.6 1 4.5 3M15 5c3 1 4.5 3 4.5 6"/><circle cx="19" cy="12" r="1.5"/></svg>;
}

/**
 * What kind of program this is, read off the gap between name and roster. This
 * is the single most useful thing on a row: it is the difference between a job
 * that is hard because it is good and a job that is hard because it is not.
 */
function archetype(prestige: number, quality: number): string | null {
  const gap = prestige - quality;
  // A giant has to actually be sleeping. The gap alone is not enough, because a
  // 78 prestige school sits so far above the scale that a good roster still
  // trails its name by a dozen points — which briefly had the best team in the
  // Gulf labelled a rebuild.
  if (gap >= 12 && prestige >= 50) return 'SLEEPING GIANT';
  if (gap <= -12) return 'ON THE RISE';
  if (prestige >= 60) return 'PERENNIAL POWER';
  if (prestige <= 34) return 'REBUILD';
  return null;
}

export function NewGame() {
  const start = useDynasty((s) => s.start);
  const [picked, setPicked] = useState<SchoolDef | null>(null);

  /**
   * This career's seed, drawn once when the screen opens.
   *
   * The same number previews the world and starts it, and that is the whole
   * point: the rosters on this screen have to be the rosters you get. Preview
   * from one seed and start from another and the offer screen is a lie.
   */
  const [seed] = useState(careerSeed);

  // Drawn off the career seed rather than the clock, so the suggestion is the
  // same man every render of the same career rather than a new one each time
  // React decides to redraw the screen.
  const suggestion = useMemo(() => randomProfile(makeRng(seed ^ 0x5eed)), [seed]);
  const [coach, setCoach] = useState<CoachProfile>(suggestion);
  /** Which of the three we are on. See the note at the top of the file. */
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  // How deep a game this career is. Held here rather than written straight to
  // the store because no dynasty exists yet — it is handed to `start` with the
  // rest of the answers when a job is finally taken.
  const [mode, setMode] = useState<DepthMode>('full');
  // The coach's pre-dugout background. Unlike the old interview, this is one
  // visible choice with a visible year-one stat shape.
  const [backgroundId, setBackgroundId] = useState<BackgroundId>('player');


  // Build the actual world, not an estimate of it. Generation is deterministic
  // from the seed and costs about 2ms, so the screen can simply read the
  // rosters the player is going to get.
  //
  // The estimate it replaces was quality alone, which ran 1.7 points light on
  // average and up to 7 in the tail — enough to move a job across a mandate
  // boundary. The offer screen advertised Pascagoula Tech as COMPETE with a 61
  // roster wanting 20 wins; signing produced CONTEND, a 65 roster and 22 wins.
  // A board that changes its terms between the handshake and the first day is a
  // bug, however small the numbers are.
  const world = useMemo(() => createSeason(makeRng(seed), undefined, CONFERENCES), [seed]);

  const rosters = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of world.teams) map.set(t.def.abbr, rosterStrength(t.team));
    return map;
  }, [world]);

  const indexOf = (school: SchoolDef): number =>
    Math.max(0, world.teams.findIndex((t) => t.def.abbr === school.abbr));

  const rosterOf = (school: SchoolDef): number =>
    rosters.get(school.abbr) ?? school.quality;

  const preview = (school: SchoolDef) => {
    const roster = rosterOf(school);
    /*
      The same call the board actually stamps on day one — playerBoard with
      the league shape and the school's patience — not the raw
      expectationFor. The comment above this screen already records this
      exact bug being fixed once (quality-only rosters moved a job across a
      mandate boundary), and it crept back in from the other side when the
      drift correction was added to the live board and not to the offer:
      reported as "the job offer was asking for 13 wins but the program is
      asking for 16." One function, one number, both rooms.
    */
    const record = world.teams[indexOf(school)];
    return {
      roster,
      stars: prestigeStars(school.prestige),
      contract: contractFor(school.prestige),
      expectation: playerBoard(
        school.prestige, roster, seasonLength(world.config),
        record?.culture?.patience, leagueShape(world.teams),
      ).expectation,
      open: canBeHired(ROOKIE_PRESTIGE, school.prestige, roster),
      needs: requiredCoachPrestige(school.prestige, roster),
      gate: hireGateNote(ROOKIE_PRESTIGE, school.prestige, roster),
      tag: archetype(school.prestige, roster),
    };
  };

  const rivalOf = (school: SchoolDef): SchoolDef | undefined =>
    CONFERENCES.flatMap((c) => c.schools).find((s) => s.abbr === school.rival);

  const confNameOf = (school: SchoolDef): string =>
    CONFERENCES.find((c) => c.schools.some((s) => s.abbr === school.abbr))?.name ?? '';

  /** The programs that actually rang, shaped by the background you chose. */
  const background = BACKGROUNDS.find((b) => b.id === backgroundId) ?? BACKGROUNDS[0]!;
  const outcome = useMemo(() => ({
    skills: background.skills, leans: background.leans, ambition: background.ambition,
    badges: background.badges, grants: [] as string[],
  }), [background]);

  const offers = useMemo(
    () => {
      const picks = startingOffers(world.teams, 5, {
        leans: outcome.leans,
        ambition: outcome.ambition,
        // Seeded off the career and the answers together, so the wobble is
        // fixed for a given man rather than reshuffling every render.
        rng: makeRng(seed ^ 0x0ffe4 ^ BACKGROUNDS.findIndex((b) => b.id === backgroundId)),
      });
      /*
        TESTING ONLY — keep Pascagoula Tech on the rookie desk while its five
        99-rated test players are enabled in store.start. It replaces the last
        generated offer so the opening market keeps the normal five-card shape.
      */
      const psc = world.teams.findIndex((t) => t.def.abbr === 'PSC');
      if (psc >= 0 && !picks.includes(psc)) {
        picks.splice(Math.max(0, picks.length - 1), 1, psc);
      }
      return picks.map((i) => world.teams[i]!.def);
    },
    [world, outcome, seed, backgroundId],
  );

  if (step === 0) {
    return (
      <Identity
        profile={coach}
        onChange={setCoach}
        // The philosophy is left alone. Somebody who comes back a step to try
        // another face has not asked to be handed a different bench as well.
        onShuffle={() => setCoach({
          ...randomProfile(makeRng(careerSeed())),
          philosophy: coach.philosophy ?? DEFAULT_PHILOSOPHY,
        })}
        onDone={() => {
          // A blank name is not a name. Clearing the field and pressing on
          // used to carry an empty identity to the job board — the summary
          // strip read "42 · AL · POWER" with nobody in it — and the world
          // then quietly christened him "Coach". The prefilled man comes back
          // instead, the same fallback the screen opened with.
          const name = coach.name.trim();
          if (name !== coach.name || name.length === 0) {
            setCoach({ ...coach, name: name.length > 0 ? name : suggestion.name });
          }
          setStep(1);
        }}
      />
    );
  }

  if (step === 1) {
    return (
      <DepthStep
        chosen={mode}
        onChoose={setMode}
        onBack={() => setStep(0)}
        onDone={() => setStep(2)}
      />
    );
  }

  if (step === 2) {
    return (
      <BackgroundStep
        chosen={backgroundId}
        onChoose={setBackgroundId}
        onBack={() => setStep(1)}
        onDone={() => setStep(3)}
      />
    );
  }

  if (step === 3) {
    return (
      <PlayStyle
        chosen={coach.philosophy ?? DEFAULT_PHILOSOPHY}
        onChoose={(philosophy) => setCoach({ ...coach, philosophy })}
        onBack={() => setStep(2)}
        onDone={() => setStep(4)}
      />
    );
  }

  const detail = picked ? preview(picked) : null;
  const rival = picked ? rivalOf(picked) : undefined;
  const culture = picked ? cultureOf(picked.abbr) : undefined;
  const record = picked ? world.teams.find((t) => t.def.abbr === picked.abbr) : undefined;

  return (
    <FixedHeader
      header={
        <div className="setup-head">
          <StepHead n={5} title="Take a job" onBack={() => setStep(3)} />
        </div>
      }
    >
      <main className="module-workspace career-workspace">
        <ModuleIntro kicker="THE OFFERS" title="Programs that called" />

        {/*
          Who you are and what you are worth, above the offers. The four steps
          behind this one are otherwise invisible from here, and a choice you
          cannot see from the screen after it is a choice you are entitled to
          think was not saved. Coach prestige is the number that decided which
          of these doors opened at all.
        */}
        <button
          className="career-summary tap"
          type="button"
          onClick={() => setStep(0)}
        >
          <small>YOUR COACH · TAP TO EDIT</small>
          <strong>{coach.name}</strong>
          <span>
            {coach.age}{' · '}{coach.homeState}{' · '}
            {philosophyOf(coach.philosophy ?? DEFAULT_PHILOSOPHY).name}
          </span>
          <p>COACH PRESTIGE {ROOKIE_PRESTIGE}</p>
        </button>

        {/* Only the chairs that actually rang. The rest of the country starts
            calling once there is a record to point at. */}
        <section className="career-offers career-offer-deck">
          {offers.map((school) => {
            const o = preview(school);
            const on = picked?.abbr === school.abbr;
            return (
              <button
                className={`career-offer-card tap${on ? ' selected' : ''}`}
                type="button"
                key={school.abbr}
                onClick={() => setPicked(school)}
              >
                <span className="career-offer-card-crest"><Crest abbr={school.abbr} size={44} /></span>
                <span className="career-offer-card-copy">
                  <small>{confNameOf(school)} · {o.contract} YEAR DEAL</small>
                  <strong>{school.school}</strong>
                  <em>{'★'.repeat(o.stars)} · roster {o.roster}</em>
                </span>
                <span className="career-offer-card-ask">
                  <small>BOARD</small>
                  <b>{o.open ? MANDATE_LABEL[o.expectation.mandate] : 'NOT YET'}</b>
                </span>
              </button>
            );
          })}
        </section>

        {picked && detail && (
          <InFrame>
            <div className="modal-scrim fade-in" onClick={() => setPicked(null)}>
              <section
                className="career-offer-detail offer-modal offer-decision-modal rise-in"
                style={{ '--offer-accent': picked.color } as CSSProperties}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="offer-decision-hero">
                  <span className="offer-decision-crest"><Crest abbr={picked.abbr} size={62} /></span>
                  <div>
                    <small>{confNameOf(picked)} · {MANDATE_LABEL[detail.expectation.mandate]}</small>
                    <h2>{picked.school}</h2>
                    <p>{picked.nickname}</p>
                  </div>
                </header>

                <section className="offer-decision-metrics">
                  <span><small>PRESTIGE</small><strong>{'★'.repeat(detail.stars)}</strong></span>
                  <span><small>ROSTER</small><strong>{detail.roster}</strong></span>
                  <span><small>CONTRACT</small><strong>{detail.contract} yr</strong></span>
                  <span><small>BOARD ASK</small><strong>{detail.expectation.targetWins} W</strong></span>
                </section>

                <section className="offer-decision-story">
                  <article>
                    <small>THE JOB{detail.tag ? ` · ${detail.tag}` : ''}</small>
                    <p>{picked.prestige - picked.quality >= 12
                      ? 'The name is ahead of the roster. Expectations arrive before the depth does.'
                      : picked.quality - picked.prestige >= 12
                        ? 'The roster is ahead of the name. There is a window here right now.'
                        : picked.prestige >= 60
                          ? 'A strong program that expects to stay strong.'
                          : 'A blanker canvas. Whatever this becomes, you build it.'}</p>
                  </article>
                  {culture && (
                    <article>
                      <small>THE PLACE · {CULTURE_LABEL[culture.edge]}</small>
                      <p>{culture.creed}</p>
                      {record && <em>{offerPitch(record, { leans: outcome.leans, ambition: outcome.ambition })}</em>}
                    </article>
                  )}
                </section>

                <section className="offer-decision-terms">
                  <small>YEAR ONE MANDATE</small>
                  <strong>{detail.expectation.summary}</strong>
                  {rival && <span>Rivalry: {rival.school} · three times a year</span>}
                </section>

                {detail.open ? (
                  <button
                    className="career-offer-sign offer-sign-primary tap"
                    type="button"
                    onClick={() => start(seed, indexOf(picked), coach, mode, {
                      skills: outcome.skills,
                      badges: outcome.badges,
                      leans: outcome.leans,
                    })}
                  >TAKE THE {picked.abbr} JOB</button>
                ) : (
                  <div className="career-offer-gate offer-gate-modern">
                    <small>NOT OPEN TO YOU YET</small>
                    <strong>THEY WANT {detail.needs} · YOU ARE {ROOKIE_PRESTIGE}</strong>
                    <p>{detail.gate}</p>
                  </div>
                )}

                <button className="career-offer-close tap" type="button" onClick={() => setPicked(null)}>
                  Back to offers
                </button>
              </section>
            </div>
          </InFrame>
        )}

      </main>
    </FixedHeader>
  );
}

/**
 * The top of every step: where you are, what this one is called, and the way
 * back out of it.
 *
 * The count is not decoration. A form that arrives without saying how long it is
 * has to be finished before you find out, and the whole promise of this flow is
 * that it is short. The back control is a header control rather than something
 * at the end of the content for the reason Sticky.tsx exists: a way out you have
 * to scroll to find is a way out the player has to think about.
 */
/**
 * How many steps creation has.
 *
 * Written once rather than three times, because it was three times and the
 * interview arriving in the middle made two of them wrong -- the count said
 * four while the dots drew four and the flow ran to five.
 */
const STEPS = 5;

function StepHead(
  { n, title, onBack }: { n: number; title: string; onBack?: () => void },
) {
  return (
    <>
      {onBack && (
        <button className="back-link tap" type="button" onClick={onBack}>
          <ArrowLeftIcon /> Back
        </button>
      )}
      {/* The road so far, in the proposal's setup rail: done, here, still to
          come. Colour is not the only signal — every step is numbered and the
          one you are on is named underneath.

          The rail is the whole header now. Each step opens with its own
          ModuleIntro in the workspace below, which is where the proposal puts
          the title, and a heading printed in both places was the same sentence
          twice on a 360px screen. */}
      <div
        className="setup-steps setup-steps-five"
        role="img"
        aria-label={`Step ${n} of ${STEPS}: ${title}`}
      >
        {/* A number for the step you are on and the ones ahead, a check for
            every one behind you. Reported from the phone: the rail filled in
            green but never actually said a step was finished. */}
        {STEP_NAMES.map((name, i) => (
          <span className={i + 1 <= n ? 'active' : ''} key={name}>
            {i + 1 < n ? <CheckIcon /> : i + 1}
            <b>{name}</b>
          </span>
        ))}
      </div>
    </>
  );
}

/** What each step is, so the rail can name them rather than number them. */
const STEP_NAMES = ['Coach', 'Control', 'Background', 'Plan', 'Offers'] as const;

/**
 * Step one. Who the dynasty belongs to, and what he looks like.
 *
 * The fields arrive filled in with a plausible man, so the whole step is one
 * press for anybody who came here to coach rather than to fill in a form. That
 * is the constraint the layout is built around: nothing is required, nothing is
 * validated against the player, and the button at the bottom is always live.
 *
 * The bounds on the age stepper are the only rule in here, and they are about
 * the fiction rather than the simulation — see MIN_COACH_AGE.
 */
function Identity(
  { profile, onChange, onShuffle, onDone }: {
    profile: CoachProfile;
    onChange: (p: CoachProfile) => void;
    onShuffle: () => void;
    onDone: () => void;
  },
) {
  const set = <K extends keyof CoachProfile>(key: K, value: CoachProfile[K]): void =>
    onChange({ ...profile, [key]: value });
  const look = profile.look ?? DEFAULT_LOOK;
  const setLook = (part: Partial<CoachLook>): void => set('look', { ...look, ...part });

  return (
    <FixedHeader
      header={<div className="setup-head"><StepHead n={1} title="Your coach" /></div>}
      action={<FloatingAction label="CONTINUE" onClick={onDone} />}
    >
      <main className="module-workspace career-workspace coach-builder-workspace">
        <ModuleIntro kicker="STEP ONE" title="Build the coach" />

        <section className="coach-builder-stage">
          <div className="coach-builder-portrait">
            <span><CoachPortrait look={look} size={122} /></span>
            <button className="tap" type="button" onClick={onShuffle}>RANDOMIZE</button>
          </div>
          <div className="coach-builder-identity">
            <small>HEAD COACH</small>
            <label className="coach-builder-name">
              <input
                value={profile.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={26}
                aria-label="Coach name"
              />
              <Pencil1Icon />
            </label>
            <div className="coach-builder-facts">
              <article>
                <small>AGE</small>
                <div>
                  <button type="button" aria-label="Younger" onClick={() => set('age', clampAge(profile.age - 1))}>−</button>
                  <strong>{profile.age}</strong>
                  <button type="button" aria-label="Older" onClick={() => set('age', clampAge(profile.age + 1))}>+</button>
                </div>
              </article>
              <article>
                <small>HOME STATE</small>
                <select value={profile.homeState} onChange={(e) => set('homeState', e.target.value)} aria-label="Home state">
                  {Object.entries(STATES_BY_REGION).map(([region, states]) => (
                    <optgroup key={region} label={region}>
                      {states.map((st) => <option key={st} value={st}>{st} · {region}</option>)}
                    </optgroup>
                  ))}
                </select>
              </article>
            </div>
          </div>
        </section>

        <section className="coach-appearance-board">
          <header><small>APPEARANCE</small><strong>Make him yours</strong></header>
          <div className="coach-appearance-groups">
            <Row label="SKIN">
              {COACH_SKIN.map((c, i) => (
                <Swatch key={c} colour={c} on={look.skin === i}
                  label={`Skin tone ${i + 1} of ${COACH_SKIN.length}`} onClick={() => setLook({ skin: i })} />
              ))}
            </Row>
            <Row label="HAIR COLOR">
              {COACH_HAIR.map((c, i) => (
                <Swatch key={c} colour={c} on={look.hair === i}
                  label={`Hair color ${i + 1} of ${COACH_HAIR.length}`} onClick={() => setLook({ hair: i })} />
              ))}
            </Row>
            <Row label="HAIR">
              {CUT_LABEL.map((word, i) => (
                <Chip key={word} label={word} on={look.cut === i} onClick={() => setLook({ cut: i })} />
              ))}
            </Row>
            <Row label="FACIAL HAIR">
              {BEARD_LABEL.map((word, i) => (
                <Chip key={word} label={word} on={look.beard === i} onClick={() => setLook({ beard: i })} />
              ))}
            </Row>
          </div>
        </section>
      </main>
    </FixedHeader>
  );
}

/**
 * Step two. What kind of coach he is.
 *
 * Four sentences and a tick, and behind each one a full set of the five policies
 * the engine already reads — see PHILOSOPHIES in engine/strategy.ts. The
 * deliberate omission is the policies themselves: this screen names benches, not
 * enums. Somebody who has not seen a game yet has no way to judge whether he
 * wants the hook fifteen pitches early, and asking him to is how a creation
 * screen turns into a settings screen with the settings in the wrong order.
 *
 * The strategy screen is where those five are argued with individually, and
 * everything here is editable there from the first day of the season. This step
 * only decides where he starts.
 */
/**
 * Step two. How much of the game you want to be asked about.
 *
 * Deliberately the second thing that happens, before the bench and before the
 * job: it changes the shape of everything after it, and a question that frames
 * the rest of the flow has no business arriving at the end of it.
 *
 * It is also deliberately *not* a difficulty menu, and the copy works hard at
 * that. Nothing here makes the game easier or the world smaller — the engine
 * models every one of the ninety-six programs identically whichever card is
 * picked. The only thing that changes is how much lands on your desk. Saying so
 * plainly is what stops "casual" reading as "the lesser game", which it is not.
 */
/**
 * The systems the desk cards preview. The built ones — a chip for a system
 * that ships later would be promising a control the settings screen greys.
 */
const DESK_KEYS: readonly string[] = [
  'lineups', 'bullpen', 'moundVisits', 'depthChart', 'redshirts',
  'captains', 'recruiting', 'draftTalk', 'skillPoints',
];

function DepthStep(
  { chosen, onChoose, onBack, onDone }: {
    chosen: DepthMode;
    onChoose: (m: DepthMode) => void;
    onBack: () => void;
    onDone: () => void;
  },
) {
  const cards: { id: DepthMode; title: string; line: string; bullets: string[] }[] = [
    {
      id: 'full', title: 'Full career',
      line: 'Every decision is yours.',
      bullets: [
        'You write the lineup card',
        'You work the bullpen, inning by inning',
        'Everything the game adds, you get asked about',
      ],
    },
    {
      id: 'casual', title: 'Casual',
      line: 'Your staff handles the routine. You handle the season.',
      bullets: [
        'Your bench coach fills out the card',
        'Your pitching coach runs the pen',
        'Recruiting, the draft and the big calls stay yours',
      ],
    },
  ];
  return (
    <FixedHeader
      header={<div className="setup-head">
        <StepHead n={2} title="How you want to play" onBack={onBack} />
      </div>}
      action={<FloatingAction
        label="CONTINUE"
        onClick={onDone}
      />}
    >
      <main className="module-workspace career-workspace">
        <ModuleIntro kicker="CONTROL" title="Choose what you handle" />

        <section className="career-depth-options">
          {cards.map((c) => (
            <button
              className={c.id === chosen ? 'selected' : ''}
              type="button"
              key={c.id}
              onClick={() => onChoose(c.id)}
            >
              <strong>{c.title}</strong>
              <p>{c.line}</p>
              {c.id === chosen && <CheckIcon />}
            </button>
          ))}
        </section>

        {/*
          What the chosen card actually moves, split the way the answer splits
          it. Reported: "it doesn't really show what the difference is — those
          small lineup, bullpen, redshirt, captains chips should change
          depending if we are selecting casual or full." The lists are read off
          the same SYSTEMS table the settings screen enforces, so this preview
          and the career it starts cannot disagree.
        */}
        {(() => {
          const shown = SYSTEMS.filter((sys) => DESK_KEYS.includes(sys.key));
          const desk = chosen === 'full' ? shown : shown.filter((sys) => sys.casual);
          const staff = chosen === 'full' ? [] : shown.filter((sys) => !sys.casual);
          return (
            <>
              <div className="career-chip-head label">ON YOUR DESK</div>
              <section className="career-system-chips">
                {desk.map((sys) => <span key={sys.key}>{sys.label.toUpperCase()}</span>)}
              </section>
              {staff.length > 0 && (
                <>
                  <div className="career-chip-head label">YOUR STAFF HANDLES</div>
                  <section className="career-system-chips staff">
                    {staff.map((sys) => <span key={sys.key}>{sys.label.toUpperCase()}</span>)}
                  </section>
                </>
              )}
            </>
          );
        })()}
      </main>
    </FixedHeader>
  );
}

function PlayStyle(
  { chosen, onChoose, onBack, onDone }: {
    chosen: PhilosophyId;
    onChoose: (id: PhilosophyId) => void;
    onBack: () => void;
    onDone: () => void;
  },
) {
  return (
    <FixedHeader
      header={<div className="setup-head">
        <StepHead n={4} title="Your approach" onBack={onBack} />
      </div>}
      action={<FloatingAction
        label="FIND A JOB"
        onClick={onDone}
      />}
    >
      <main className="module-workspace career-workspace">
        <ModuleIntro kicker="PLAYING IDENTITY" title="Choose how your teams play" />

        <section className="career-plan-list">
          {PHILOSOPHIES.map((p) => (
            <button
              className={p.id === chosen ? 'selected' : ''}
              type="button"
              key={p.id}
              onClick={() => onChoose(p.id)}
            >
              <strong>{p.name}</strong>
              <small>{p.blurb}</small>
              {p.id === chosen && <CheckIcon />}
            </button>
          ))}
        </section>

        {/* The five settings this bench actually sets, spelled out — a plan you
            can read is a plan, a name alone is a vibe. Each chip is one of the
            strategy screen's own controls. */}
        <section className="career-system-chips">
          {planChips(chosen).map((chip) => <span key={chip}>{chip}</span>)}
        </section>
      </main>
    </FixedHeader>
  );
}

/** The five policy chips a philosophy sets, in the strategy screen's words. */
function planChips(id: PhilosophyId): string[] {
  const s = strategyForPhilosophy(id);
  const alignment = { straight: 'STRAIGHT UP', situational: 'SITUATIONAL', shift: 'FULL SHIFT' };
  return [
    `RUN ${s.running.toUpperCase()}`,
    `STEAL ${s.steals.toUpperCase()}`,
    `BUNT ${s.bunt.toUpperCase()}`,
    `HOOK ${s.hook.toUpperCase()}`,
    alignment[s.alignment],
  ];
}

/** One labelled line of choices inside the appearance panel. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="career-look-row">
      <small>{label}</small>
      <div>{children}</div>
    </div>
  );
}

/**
 * A colour, shown as itself.
 *
 * The chosen one is marked with a ring drawn *inside* the swatch rather than a
 * thicker border, so selecting does not change the size of the thing you just
 * tapped and shuffle the row under your thumb.
 */
function Swatch(
  { colour, on, onClick, label }:
  { colour: string; on: boolean; onClick: () => void;
    /** What a screen reader says. A hex code spoken aloud is not a colour. */
    label: string },
) {
  return (
    <button
      className={`career-swatch tap${on ? ' selected' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ background: colour }}
    />
  );
}

/** A word you can pick, in the same chip the region filter uses. */
function Chip(
  { label, on, onClick }: { label: string; on: boolean; onClick: () => void },
) {
  return (
    <button
      className={`career-chip tap${on ? ' selected' : ''}`}
      type="button"
      onClick={onClick}
    >{label}</button>
  );
}


function BackgroundStep(
  { chosen, onChoose, onBack, onDone }: {
    chosen: BackgroundId;
    onChoose: (id: BackgroundId) => void;
    onBack: () => void;
    onDone: () => void;
  },
) {
  const picked = BACKGROUNDS.find((b) => b.id === chosen) ?? BACKGROUNDS[0]!;
  return (
    <FixedHeader
      header={<div className="setup-head"><StepHead n={3} title="Your background" onBack={onBack} /></div>}
      action={<FloatingAction label="CONTINUE" onClick={onDone} />}
    >
      <main className="module-workspace career-workspace background-workspace">
        <ModuleIntro kicker="BEFORE THE DUGOUT" title="What did you do before this?" />
        <section className="coach-background-grid">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`coach-background-card tap${chosen === b.id ? ' selected' : ''}`}
              onClick={() => onChoose(b.id)}
            >
              <span className="coach-background-icon"><BackgroundIcon id={b.id} /></span>
              <small>{b.kicker}</small>
              <strong>{b.title}</strong>
              <p>{b.blurb}</p>
              {chosen === b.id && <CheckIcon />}
            </button>
          ))}
        </section>

        <section className="background-stat-preview">
          <header><small>YEAR ONE SHAPE</small><strong>{picked.title}</strong></header>
          <div>
            {(Object.entries(picked.skills) as [keyof CoachSkills, number][]).map(([k, value]) => (
              <span key={k}>
                <small>{SKILL_LABEL[k]}</small>
                <strong>{value}</strong>
                <i><b style={{ width: `${Math.min(100, value * 3.2)}%` }} /></i>
              </span>
            ))}
          </div>
          <p>This is your starting edge, not a permanent class. Coach development can reshape it every offseason.</p>
        </section>
      </main>
    </FixedHeader>
  );
}
