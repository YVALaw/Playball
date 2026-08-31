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

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeftIcon, CheckIcon, ChevronRightIcon, Pencil1Icon,
} from '@radix-ui/react-icons';
import { ModuleIntro, SectionHeading } from '../components/Kit.js';
import {
  CONFERENCES, STATES_BY_REGION, type SchoolDef,
} from '../../data/schools.js';
import {
  prestigeStars, expectationFor, contractFor, requiredCoachPrestige,
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
import { drawQuestions, settle, ASKED, ASKED_CASUAL } from '../../engine/interviewResult.js';
import { SKILL_LABEL, type CoachSkills } from '../../engine/program.js';
import type { InterviewAnswer, InterviewQuestion } from '../../data/interview.js';
import { cultureOf, CULTURE_LABEL } from '../../data/cultures.js';

const MANDATE_LABEL: Record<Mandate, string> = {
  develop: 'DEVELOP',
  build: 'REBUILD',
  compete: 'COMPETE',
  contend: 'CONTEND',
  championship: 'WIN IT ALL',
};

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
  /*
    The interview, and what it made of him.

    The draw is seeded off the dynasty rather than off `Math.random`, so a
    career is genuinely one career: reloading creation does not reroll the
    questions, and the same seed with the same coach is the same five. Casual
    gets two of them rather than none -- five is a slow start for somebody who
    chose the shorter game, but zero would put the best-written thing in the
    game out of reach of the players most likely to bounce off.
  */
  const asked = useMemo(
    () => drawQuestions(
      makeRng(seed ^ 0x1a7e), mode === 'casual' ? ASKED_CASUAL : ASKED,
      { age: coach.age, warm: WARM_STATES.has(coach.homeState) },
    ),
    [seed, mode, coach.age, coach.homeState],
  );
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);


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
    return {
      roster,
      stars: prestigeStars(school.prestige),
      contract: contractFor(school.prestige),
      expectation: expectationFor(school.prestige, roster, seasonLength(world.config)),
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

  /**
   * The programs that actually rang. The old screen printed all ninety six and
   * let the player discover which would take his call; this is the market as a
   * rookie really meets it — the handful of genuine offers, chosen by the same
   * hiring ladder every later job change uses, with at least one guaranteed.
   */
  /*
    What the five answers made of him, and therefore who rings.

    Settled here rather than at the moment a job is taken, because the offers
    themselves depend on it: the leanings decide which programmes reach for him
    and which pass, so they have to exist before the desk is drawn.
  */
  /*
    Where a coach starts before he has said anything.

    The same twenty `newCoach` uses. The interview adds to it rather than
    replacing it, so a man who has answered nothing is exactly the coach this
    game has always made -- which is what keeps the questions an addition to
    creation instead of a rewrite of it.
  */
  const BASE_SKILLS = { offense: 20, defense: 20, training: 20, recruiting: 20 };

  const outcome = useMemo(
    () => settle(answers, BASE_SKILLS),
    [answers],
  );

  const offers = useMemo(
    () => {
      const picks = startingOffers(world.teams, 5, {
        leans: outcome.leans,
        ambition: outcome.ambition,
        // Seeded off the career and the answers together, so the wobble is
        // fixed for a given man rather than reshuffling every render.
        rng: makeRng(seed ^ 0x0ffe4 ^ answers.length),
      });
      /*
        TESTING ONLY — remove before v1.0, together with the loaded roster in
        `store.start`. Pascagoula Tech is always on the desk so the loaded
        team is one tap away every run; it takes the last slot rather than a
        seventh so the market keeps its shape.
      */
      const psc = world.teams.findIndex((t) => t.def.abbr === 'PSC');
      if (psc >= 0 && !picks.includes(psc)) {
        picks.splice(Math.max(0, picks.length - 1), 1, psc);
      }
      return picks.map((i) => world.teams[i]!.def);
    },
    [world, outcome, seed, answers.length],
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
      <InterviewStep
        questions={asked}
        answers={answers}
        onAnswer={(a) => setAnswers((prev) => [...prev, a])}
        onBack={() => { setAnswers([]); setStep(1); }}
        onDone={() => setStep(3)}
      />
    );
  }

  if (step === 3) {
    return (
      <PlayStyle
        chosen={coach.philosophy ?? DEFAULT_PHILOSOPHY}
        onChoose={(philosophy) => setCoach({ ...coach, philosophy })}
        onBack={() => { setAnswers([]); setStep(2); }}
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
          <p>COACH PRESTIGE {ROOKIE_PRESTIGE} · {offers.length} PROGRAM
            {offers.length === 1 ? '' : 'S'} CALLED</p>
        </button>

        {/* Only the chairs that actually rang. The rest of the country starts
            calling once there is a record to point at. */}
        <section className="career-offers">
          {offers.map((school) => {
            const o = preview(school);
            const on = picked?.abbr === school.abbr;
            return (
              <button
                className={on ? 'selected' : ''}
                type="button"
                key={school.abbr}
                onClick={() => setPicked(on ? null : school)}
              >
                <span>
                  <strong>{school.school}</strong>
                  <small>
                    {confNameOf(school)} · {'★'.repeat(o.stars)} · roster {o.roster}
                    {' · '}{o.contract} year deal
                  </small>
                </span>
                <b>{o.open ? MANDATE_LABEL[o.expectation.mandate] : 'NOT YET'}</b>
                {on && <CheckIcon />}
              </button>
            );
          })}
        </section>

        {picked && detail && (
          <InFrame>
          <div className="modal-scrim" onClick={() => setPicked(null)}>
            <section
              className="career-offer-detail offer-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <small>{MANDATE_LABEL[detail.expectation.mandate]} · {confNameOf(picked)}</small>
              <strong>{picked.school}</strong>
              <p>
                {picked.nickname} · {'★'.repeat(detail.stars)}{'☆'.repeat(5 - detail.stars)}
                {' · roster '}{detail.roster} · {detail.contract} year deal
              </p>

              {/* Name against roster is the whole story of a job, so it is
                  spelled out rather than left to two numbers side by side. */}
              {detail.tag && (
                <>
                  <span>{detail.tag}</span>
                  <p>
                    {picked.prestige - picked.quality >= 12
                      ? 'The name is bigger than the team. Expectations will not wait for the roster to catch up.'
                      : picked.quality - picked.prestige >= 12
                        ? 'Better than its reputation right now. This roster is a window, and windows close.'
                        : picked.prestige >= 60
                          ? 'They have been good for a long time and they intend to stay that way.'
                          : 'Nothing here yet. Whatever gets built, you build it.'}
                  </p>
                </>
              )}

              {/*
                What they believe, and why they rang. The line above says what
                the *job* is; this says what the *place* is — which is the thing
                the interview was for. Five answers decided which programmes
                reached, and a desk that never explained itself would have made
                those five answers invisible.
              */}
              {culture && (
                <>
                  <hr />
                  <small>{culture.name} · {CULTURE_LABEL[culture.edge]}</small>
                  <p>{culture.creed}</p>
                  {record && (
                    <p>{offerPitch(record, {
                      leans: outcome.leans, ambition: outcome.ambition,
                    })}</p>
                  )}
                </>
              )}

              <hr />
              <small>THE MANDATE</small>
              <p>{detail.expectation.summary}</p>
              {rival && <p>Rivalry: {rival.school}, three times a year.</p>}

              {detail.open ? (
                <button
                  className="career-offer-sign tap"
                  type="button"
                  style={{ color: picked.color }}
                  onClick={() => start(seed, indexOf(picked), coach, mode, {
                    skills: outcome.skills,
                    badges: outcome.badges,
                    leans: outcome.leans,
                  })}
                >SIGN WITH {picked.abbr}</button>
              ) : (
                <div className="career-offer-gate">
                  <strong>THEY WANT {detail.needs} · YOU ARE {ROOKIE_PRESTIGE}</strong>
                  {detail.gate}
                </div>
              )}

              <button
                className="career-offer-close tap"
                type="button"
                onClick={() => setPicked(null)}
              >Look at other jobs</button>
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
const STEP_NAMES = ['You', 'Desk', 'Interview', 'Plan', 'Offers'] as const;

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
      header={<div className="setup-head">
        <StepHead n={1} title="Your coach" />
      </div>}
      action={<FloatingAction
        label="HOW YOU PLAY"
        onClick={onDone}
        secondary={{ label: 'SOMEBODY ELSE', onClick: onShuffle }}
      />}
    >
      <main className="module-workspace career-workspace">
        <ModuleIntro kicker="WHO YOU ARE" title="Meet the coach" />

        {/*
          The proposal's coach card: the face, the name, the age, in one panel.
          Every control below it is only meaningful as a thing that changed the
          picture — split them across the screen and you are tapping colours and
          watching nothing happen.
        */}
        <section className="career-identity">
          <span className="career-face">
            <CoachPortrait look={look} size={72} />
          </span>
          <div>
            <small>COACH NAME</small>
            {/*
              The proposal draws this as a button that cycles a name. Ours takes
              one, because a dynasty is somebody's. The pencil is the same
              affordance and the field is the same rule underneath it.

              16px is the floor on the input, not a taste: a focused field under
              16px makes a phone browser zoom the whole page in, and it does not
              zoom back out when the keyboard leaves.
            */}
            <label className="career-name-edit">
              <input
                value={profile.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={26}
                aria-label="Coach name"
              />
              <Pencil1Icon />
            </label>
            {/*
              A stepper rather than a keyboard. The range is 41 wide, every
              value in it is acceptable, and putting a numeric keypad over half
              the screen to collect one of them is the slower way round.
            */}
            <div className="career-age">
              <small>AGE · {MIN_COACH_AGE}–{MAX_COACH_AGE}</small>
              <button
                type="button"
                aria-label="Younger"
                onClick={() => set('age', clampAge(profile.age - 1))}
              >−</button>
              <strong>{profile.age}</strong>
              <button
                type="button"
                aria-label="Older"
                onClick={() => set('age', clampAge(profile.age + 1))}
              >+</button>
            </div>
          </div>
        </section>

        <SectionHeading kicker="THE LOOK" title="How he shows up" />

        {/*
          Swatches rather than sliders.

          A slider for six skin tones reads as a continuum, which is what a
          slider means, and the value underneath is one of six — so the thumb
          snaps and the control lies about what it is. Six swatches fit across a
          360px phone at a comfortable thumb size, show every option at once
          instead of one at a time, and cost one tap rather than a drag.
        */}
        <section className="career-look">
          <Row label="SKIN">
            {COACH_SKIN.map((c, i) => (
              <Swatch
                key={c} colour={c} on={look.skin === i}
                onClick={() => setLook({ skin: i })}
              />
            ))}
          </Row>
          <Row label="HAIR COLOUR">
            {COACH_HAIR.map((c, i) => (
              <Swatch
                key={c} colour={c} on={look.hair === i}
                onClick={() => setLook({ hair: i })}
              />
            ))}
          </Row>
          <Row label="HAIR">
            {CUT_LABEL.map((word, i) => (
              <Chip
                key={word} label={word} on={look.cut === i}
                onClick={() => setLook({ cut: i })}
              />
            ))}
          </Row>
          <Row label="FACIAL HAIR">
            {BEARD_LABEL.map((word, i) => (
              <Chip
                key={word} label={word} on={look.beard === i}
                onClick={() => setLook({ beard: i })}
              />
            ))}
          </Row>
        </section>

        {/*
          The same two letter codes recruits and programs carry, grouped by the
          same regions. A free text box would let you be from somewhere this
          world has never heard of, and the state is the unit the rest of the
          game already thinks in.
        */}
        <div className="career-field">
          <small>WHERE HE IS FROM</small>
          <select
            value={profile.homeState}
            onChange={(e) => set('homeState', e.target.value)}
            aria-label="Home state"
          >
            {Object.entries(STATES_BY_REGION).map(([region, states]) => (
              <optgroup key={region} label={region}>
                {states.map((st) => <option key={st} value={st}>{st} · {region}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
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
        <ModuleIntro kicker="HOW MUCH REACHES YOU" title="Set your desk" />

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
        <StepHead n={4} title="Set your plan" onBack={onBack} />
      </div>}
      action={<FloatingAction
        label="FIND A JOB"
        onClick={onDone}
      />}
    >
      <main className="module-workspace career-workspace">
        <ModuleIntro kicker="THE BENCH YOU RUN" title="Set your plan" />

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
  { colour, on, onClick }: { colour: string; on: boolean; onClick: () => void },
) {
  return (
    <button
      className={`career-swatch tap${on ? ' selected' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={colour}
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

/** The warm half of the country, for the two questions that ask about heat. */
const WARM_STATES = new Set([
  'LA', 'MS', 'AL', 'TX', 'NC', 'SC', 'GA', 'FL', 'VA',
  'CA', 'AZ', 'NM', 'NV',
]);

/**
 * Step three: five questions, one at a time.
 *
 * The whole stage rests on this screen not feeling like a form, so it shows one
 * question at a time and nothing else — no progress bar counting down, no
 * summary of what you have picked, and no way back. An interview is a thing you
 * are in, not a thing you are filling out.
 *
 * The effect of an answer *is* shown, which was a deliberate call. A character
 * question whose consequence you cannot read is a guess rather than a choice,
 * and the four skills are the part of a coach a player watches most closely.
 * What is not shown is the badge each answer votes for: that is who he turns out
 * to be, and finding out is better than picking.
 */
function InterviewStep(
  { questions, answers, onAnswer, onBack, onDone }: {
    questions: readonly InterviewQuestion[];
    answers: readonly InterviewAnswer[];
    onAnswer: (a: InterviewAnswer) => void;
    onBack: () => void;
    onDone: () => void;
  },
) {
  const i = answers.length;
  const q = questions[i];

  // Answered them all. The step hands over on the next paint rather than
  // rendering an empty frame.
  useEffect(() => { if (!q) onDone(); }, [q, onDone]);
  if (!q) return null;

  return (
    <FixedHeader
      header={<div className="setup-head">
        <StepHead
          n={3}
          title="A few questions"
          onBack={i === 0 ? onBack : undefined}
        />
      </div>}
    >
      <main className="module-workspace career-workspace">
        <ModuleIntro
          kicker={`${questions.length} QUESTIONS · ${i + 1}`}
          title="The interview"
        />

        {/*
          The situation, in the straight man's voice. Pre-wrapped rather than
          left to the browser: these are written with their line breaks as part
          of the rhythm, and a paragraph that reflows on a narrow phone reads as
          prose instead of as somebody talking.
        */}
        <section className="career-question">
          <small>ATHLETIC DIRECTOR</small>
          <p>{q.setup}</p>
          <h2>{q.ask}</h2>
        </section>

        {/*
          What each answer costs and buys, on the answer itself.

          A deliberate call: the numbers make this a character sheet rather than
          a conversation, which is the risk. But an interview whose effects are
          invisible is five taps that appear to do nothing, and a player who
          cannot see that the answers matter stops reading them.
        */}
        <section className="answer-list">
          {q.answers.map((a) => (
            <button className="tap" type="button" key={a.text} onClick={() => onAnswer(a)}>
              <ChevronRightIcon />
              <span>
                {a.text}
                <em>
                  {(Object.entries(a.skills) as [keyof CoachSkills & string, number][])
                    .filter(([, n]) => n !== 0)
                    .map(([k, n]) => (
                      <i className={n > 0 ? 'up' : 'down'} key={k}>
                        {n > 0 ? '+' : ''}{n} {SKILL_LABEL[k]}
                      </i>
                    ))}
                </em>
              </span>
            </button>
          ))}
        </section>
      </main>
    </FixedHeader>
  );
}
