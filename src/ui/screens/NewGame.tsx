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
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { ModuleIntro } from '../components/Kit.js';
import {
  CONFERENCES, STATES_BY_REGION, type SchoolDef,
} from '../../data/schools.js';
import {
  prestigeStars, expectationFor, contractFor, requiredCoachPrestige,
  canBeHired, hireGateNote, ROOKIE_PRESTIGE, rosterStrength, startingOffers, offerPitch,
  randomProfile, clampAge, MIN_COACH_AGE, MAX_COACH_AGE, DEFAULT_LOOK,
  type CoachProfile, type CoachLook, type Mandate, type Objective,
} from '../../engine/program.js';
import {
  PHILOSOPHIES, philosophyOf, DEFAULT_PHILOSOPHY, strategyForPhilosophy,
  type PhilosophyId,
} from '../../engine/strategy.js';
import { useDynasty, careerSeed } from '../../state/store.js';
import type { DepthMode } from '../../state/depth.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
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

/** How hard the job is, said plainly rather than implied by a star count. */
const MANDATE_NOTE: Record<Mandate, string> = {
  develop: 'The most forgiving job on the board. Nobody expects wins yet.',
  build: 'A proud school with a thin roster. Patience, but not unlimited patience.',
  compete: 'Middle of the pack. Win more than you lose and you keep the job.',
  // These sit directly above the checklist, so they say what the checklist says.
  // "June is the target" survived a change that made reaching June a bonus, and
  // a note that contradicts the boxes under it is worse than no note.
  contend: 'Real talent and real expectations. The top of the league, not the middle.',
  championship: 'The hardest seat here. Win the conference or it is a wasted year.',
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

  return (
    <FixedHeader
      header={
        <div className="setup-head">
          <StepHead n={5} title="Take a job" onBack={() => setStep(3)} />

          {/*
            Who you are and what you are worth, on one line above the offers.
            The face and the philosophy ride along because the two steps behind
            this one are otherwise invisible from here — and a choice you
            cannot see from the screen after it is a choice you are entitled to
            think was not saved. Coach Prestige sits at the end of the line: it
            is the number that decided which offers exist at all.
          */}
          <button
            onClick={() => setStep(0)}
            style={{
              width: '100%', marginTop: 9, padding: '7px 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 8, background: 'transparent', textAlign: 'left',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <CoachPortrait look={coach.look ?? DEFAULT_LOOK} size={26} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', font: "600 calc(11px * var(--ts)) var(--mono)",
              }}>{coach.name}</span>
              <span style={{
                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
              }}>
                {coach.age}{' · '}{coach.homeState}{' · '}
                {philosophyOf(coach.philosophy ?? DEFAULT_PHILOSOPHY).name}
                <span style={{ color: 'var(--clay)' }}> · EDIT</span>
              </span>
            </span>
            <span style={{
              font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.1em',
              color: 'var(--dim)', whiteSpace: 'nowrap',
            }}>COACH PRESTIGE {ROOKIE_PRESTIGE}</span>
          </button>
        </div>
      }
    >
    <div style={{ padding: '8px 14px 22px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginTop: 4, marginBottom: 6,
      }}>
        <span className="label">THE OFFERS</span>
        <span style={{ font: "600 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
          {offers.length} PROGRAM{offers.length === 1 ? '' : 'S'} CALLED
        </span>
      </div>

      {/* Only the chairs that actually rang. Coach Prestige is what opens
          doors, and at 25 these are the doors that opened — the rest of the
          country will start calling once there is a record to point at. */}
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {offers.map((school) => {
          const p = preview(school);
          return (
            <button
              key={school.abbr}
              onClick={() => setPicked(school)}
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '3px 1fr auto',
                gap: 9, alignItems: 'center',
                padding: '11px 11px 11px 0',
                borderBottom: '1px solid var(--hairline)',
                background: 'transparent',
              }}
            >
              {/* The school's colour, so a program is recognisable before you
                  have learned its name. */}
              <span style={{ alignSelf: 'stretch', background: school.color }} />
              <span style={{ minWidth: 0, paddingLeft: 8 }}>
                <span style={{
                  display: 'block', font: "400 calc(13.5px * var(--ts)) var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{school.school}</span>
                <span style={{
                  display: 'block', marginTop: 1,
                  font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
                }}>
                  {confNameOf(school)} · roster {p.roster} · {p.contract} year deal
                  {p.tag && <span style={{ color: 'var(--clay)' }}> · {p.tag}</span>}
                </span>
              </span>
              <span style={{
                textAlign: 'right', paddingRight: 11, whiteSpace: 'nowrap',
              }}>
                <span style={{
                  display: 'block', font: "600 calc(11px * var(--ts)) var(--mono)", color: 'var(--clay)',
                }}>{'★'.repeat(p.stars)}</span>
                <span style={{
                  display: 'block', marginTop: 2,
                  font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
                }}>{MANDATE_LABEL[p.expectation.mandate]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: 8, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
      }}>
        Tap an offer to read the board's mandate before you sign. Better
        programs answer once your prestige gives them a reason to.
      </div>

      {/*
        The offer arrives as a sheet over the list rather than a block appended
        below it — an offer that renders under eight rows is an offer you have to
        go looking for, and it is easy to lose your place scrolling back.
      */}
      {picked && (() => {
        const p = preview(picked);
        const rival = rivalOf(picked);
        return (
          <div
            onClick={() => setPicked(null)}
            className="sheet-scrim"
            style={{
              position: 'absolute', inset: 0, background: 'rgba(var(--ink-rgb), .55)',
              display: 'flex', alignItems: 'flex-end', zIndex: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="sheet"
              style={{
                width: '100%', maxHeight: '90%', overflowY: 'auto',
                background: 'var(--paper)', borderTop: `3px solid ${picked.color}`,
              }}
            >
              <div style={{
                padding: '7px 12px', background: picked.color,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
                }}>{p.open ? 'THE OFFER' : 'NOT YET'}</span>
                <button
                  onClick={() => setPicked(null)}
                  style={{
                    font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                    color: 'rgba(var(--cream-rgb), .85)',
                  }}
                >BACK</button>
              </div>

              <div style={{ padding: '13px 12px 16px' }}>
                <div style={{
                  font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
                }}>{picked.school}</div>
                <div style={{
                  marginTop: 3, font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)',
                }}>{picked.nickname} · {confNameOf(picked)}</div>

                <div style={{ display: 'flex', marginTop: 12 }}>
                  <Stat k="REPUTATION" v={'★'.repeat(p.stars) + '☆'.repeat(5 - p.stars)} />
                  <Stat k="ROSTER OVR" v={String(p.roster)} />
                  <Stat k="CONTRACT" v={p.open ? `${p.contract} yrs` : '—'} last />
                </div>

                {/* Name against roster is the whole story of a job, so it is
                    spelled out rather than left to two numbers side by side. */}
                {p.tag && (
                  <div style={{
                    marginTop: 11, padding: '8px 10px',
                    border: `1px solid ${picked.color}`, borderLeftWidth: 3,
                    font: "400 calc(11.5px * var(--ts))/1.45 var(--body)",
                  }}>
                    <strong style={{ font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.1em' }}>
                      {p.tag}
                    </strong>
                    <br />
                    {picked.prestige - picked.quality >= 12
                      ? 'The name is bigger than the team. Expectations will not wait for the roster to catch up.'
                      : picked.quality - picked.prestige >= 12
                        ? 'Better than its reputation right now. This roster is a window, and windows close.'
                        : picked.prestige >= 60
                          ? 'They have been good for a long time and they intend to stay that way.'
                          : 'Nothing here yet. Whatever gets built, you build it.'}
                  </div>
                )}

                {/*
                  What they believe, and why they rang.

                  The block above says what the *job* is — a big name with a
                  thin roster, a window closing. This says what the *place* is,
                  which is the thing the interview was for: five answers decided
                  which of these programmes reached, and a desk that never
                  explained itself would have made those five answers invisible.
                */}
                {(() => {
                  const culture = cultureOf(picked.abbr);
                  if (!culture) return null;
                  const record = world.teams.find((t) => t.def.abbr === picked.abbr);
                  return (
                    <div style={{
                      marginTop: 9, padding: '9px 10px',
                      background: 'var(--paper)',
                      border: '1px solid var(--faint)', borderLeft: '3px solid var(--ink)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap',
                      }}>
                        <span style={{
                          font: "800 calc(13px * var(--ts))/1.05 var(--display)",
                          textTransform: 'uppercase',
                        }}>{culture.name}</span>
                        <span style={{
                          font: "600 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                          color: 'var(--clay)',
                        }}>{CULTURE_LABEL[culture.edge]}</span>
                      </div>
                      <div style={{
                        marginTop: 4,
                        font: "400 calc(11px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
                      }}>{culture.creed}</div>
                      {record && (
                        <div style={{
                          marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hairline)',
                          font: "400 calc(11px * var(--ts))/1.45 var(--body)", color: 'var(--ink)',
                        }}>
                          {offerPitch(record, {
                            leans: outcome.leans, ambition: outcome.ambition,
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {rival && (
                  <div style={{
                    marginTop: 9, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
                  }}>
                    Rivalry: <strong style={{ color: 'var(--ink)' }}>{rival.school}</strong>.
                    Three games a year, every year.
                  </div>
                )}

                <div style={{
                  marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--hairline)',
                }}>
                  <div className="label">THE MANDATE · {MANDATE_LABEL[p.expectation.mandate]}</div>
                  <div style={{ marginTop: 5, font: "400 calc(13px * var(--ts))/1.5 var(--body)" }}>
                    {p.expectation.summary}
                  </div>

                  {/*
                    What they will actually grade you on, before you sign. The
                    required boxes are the job; the bonuses are what a good year
                    looks like on top of it. Two jobs with the same star rating
                    can be asking for completely different things, and this list
                    is the only place that difference is visible.
                  */}
                  <div style={{ marginTop: 9 }}>
                    {p.expectation.objectives.map((o) => <Ask key={o.key} objective={o} />)}
                  </div>
                </div>

                <div style={{
                  marginTop: 10, padding: '9px 10px', background: 'var(--field)',
                  font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
                }}>{MANDATE_NOTE[p.expectation.mandate]}</div>

                {p.open ? (
                  <>
                    <div style={{
                      marginTop: 10, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
                    }}>
                      They are giving you <strong style={{ color: 'var(--ink)' }}>
                        {p.contract} seasons</strong>. Meet the mandate and they will
                      extend it; run the deal out without convincing them and they
                      simply will not renew.
                    </div>

                    <button
                      onClick={() => start(seed, indexOf(picked), coach, mode, {
                        skills: outcome.skills,
                        badges: outcome.badges,
                        leans: outcome.leans,
                      })}
                      style={{
                        marginTop: 14, width: '100%', padding: '13px 0',
                        background: picked.color, border: `1px solid ${picked.color}`,
                        color: 'var(--cream)',
                        font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                      }}
                    >SIGN WITH {picked.abbr}</button>
                  </>
                ) : (
                  <div style={{
                    marginTop: 12, padding: '11px 12px',
                    border: '1px solid var(--clay)', background: 'rgba(var(--clay-rgb), .07)',
                  }}>
                    <div className="label" style={{ color: 'var(--clay)' }}>
                      THEY WANT {p.needs} · YOU ARE {ROOKIE_PRESTIGE}
                    </div>
                    <div style={{
                      marginTop: 5, font: "400 calc(12px * var(--ts))/1.5 var(--body)",
                    }}>{p.gate}</div>
                  </div>
                )}

                <button
                  onClick={() => setPicked(null)}
                  style={{
                    marginTop: 8, width: '100%', padding: '10px 0',
                    background: 'transparent', border: '1px solid rgba(var(--ink-rgb), .28)',
                    font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.12em', color: 'var(--dim)',
                  }}
                >LOOK AT OTHER JOBS</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
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
          one you are on is named underneath. */}
      <div
        className="setup-steps setup-steps-five"
        role="img"
        aria-label={`Step ${n} of ${STEPS}`}
      >
        {STEP_NAMES.map((name, i) => (
          <span className={i + 1 === n ? 'active' : ''} key={name}>
            {i + 1}
            <b>{name}</b>
          </span>
        ))}
      </div>
      <ModuleIntro kicker={`STEP ${n} OF ${STEPS}`} title={title} />
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
        note="None of this changes how a game is played. What comes next does."
      />}
    >
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
          Already filled in. Change what you like, or go straight on.
        </div>

        {/*
          The portrait and its controls in one panel, with the face at the top of
          it, because every control below is only meaningful as a thing that
          changed the picture. Split across the screen — face here, swatches
          somewhere further down — and you are tapping colours and watching
          nothing happen.
        */}
        <div style={{
          marginTop: 12, padding: '12px 11px 6px',
          border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* The face in a ring, and it repaints the instant a swatch below
                is tapped — the controls only mean anything as things that
                change this picture. The same circular treatment the top bar
                wears, so the man made here is recognisably the man up there. */}
            <div style={{
              width: 116, height: 116, borderRadius: '50%', overflow: 'hidden',
              border: '3px solid var(--ink)', background: 'var(--field)',
              display: 'grid', placeItems: 'center',
            }}>
              <CoachPortrait look={look} size={104} />
            </div>
          </div>

          {/*
            Swatches rather than sliders.

            A slider for six skin tones reads as a continuum, which is what a
            slider means, and the value underneath is one of six — so the thumb
            snaps and the control lies about what it is. Six swatches fit across
            a 360px phone at a comfortable thumb size, show every option at once
            instead of one at a time, and cost one tap rather than a drag with a
            target the width of a thumbnail.
          */}
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
        </div>

        <div className="label" style={{ marginTop: 16, marginBottom: 5 }}>NAME</div>
        <input
          value={profile.name}
          onChange={(e) => set('name', e.target.value)}
          // Long enough for a real name and short enough to fit the headline it
          // is printed in on every screen after this one.
          maxLength={26}
          style={{
            width: '100%', padding: '11px 10px', background: 'var(--paper)',
            border: '1px solid rgba(var(--ink-rgb), .28)', borderRadius: 0,
            // 16px is the floor, not a taste. A focused input under 16px makes
            // a phone browser zoom the whole page in, and it does not zoom back
            // out when the keyboard leaves — reported from creating a coach.
            color: 'var(--ink)', font: "400 calc(16px * var(--ts)) var(--body)",
          }}
        />

        <div className="label" style={{ marginTop: 14, marginBottom: 5 }}>
          AGE · {MIN_COACH_AGE}–{MAX_COACH_AGE}
        </div>
        {/*
          A stepper rather than a keyboard. The range is 41 wide, every value in
          it is acceptable, and putting a numeric keypad over half the screen to
          collect one of them is the slower way round.
        */}
        <div style={{
          display: 'flex', alignItems: 'stretch',
          border: '1px solid rgba(var(--ink-rgb), .28)', background: 'var(--paper)',
        }}>
          <Nudge label="−" onClick={() => set('age', clampAge(profile.age - 1))} />
          <div style={{
            flex: 1, textAlign: 'center', padding: '11px 0',
            font: "700 calc(20px * var(--ts))/1 var(--display)",
          }}>{profile.age}</div>
          <Nudge label="+" onClick={() => set('age', clampAge(profile.age + 1))} />
        </div>

        <div className="label" style={{ marginTop: 14, marginBottom: 5 }}>FROM</div>
        {/*
          The same two letter codes recruits and programs carry, grouped by the
          same regions. A free text box would let you be from somewhere this
          world has never heard of, and the state is the unit the rest of the
          game already thinks in.
        */}
        <select
          value={profile.homeState}
          onChange={(e) => set('homeState', e.target.value)}
          style={{
            width: '100%', padding: '11px 10px', background: 'var(--paper)',
            border: '1px solid rgba(var(--ink-rgb), .28)', borderRadius: 0,
            color: 'var(--ink)', font: "600 calc(14px * var(--ts)) var(--mono)", letterSpacing: '.04em',
          }}
        >
          {Object.entries(STATES_BY_REGION).map(([region, states]) => (
            <optgroup key={region} label={region}>
              {states.map((st) => <option key={st} value={st}>{st} · {region}</option>)}
            </optgroup>
          ))}
        </select>

        {/*
          Said plainly, because the alternative is a player spending real thought
          on which of these buys him something. None of them do — and the next
          step, which does, says so in its own words.
        */}
      </div>
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
        note="You can change this, or take back any single part of it, in settings at any point in your career."
      />}
    >
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
          Not a difficulty. The game simulates all ninety-six programs the same
          way either way — this only decides how much of it reaches your desk.
        </div>

        <div style={{ marginTop: 12 }}>
          {cards.map((c) => {
            const on = c.id === chosen;
            return (
              <button
                key={c.id}
                onClick={() => onChoose(c.id)}
                className="tap"
                style={{
                  width: '100%', textAlign: 'left', marginBottom: 7,
                  padding: '11px 12px',
                  background: on ? 'rgba(var(--clay-rgb), .10)' : 'var(--paper)',
                  border: `1px solid ${on ? 'var(--clay)' : 'rgba(var(--ink-rgb), .28)'}`,
                }}
              >
                <div style={{
                  font: "800 calc(17px * var(--ts))/1 var(--display)",
                  textTransform: 'uppercase',
                  color: on ? 'var(--clay)' : 'var(--ink)',
                }}>{c.title}</div>
                <div style={{
                  marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.4 var(--body)",
                }}>{c.line}</div>
                <ul style={{
                  margin: '7px 0 0', paddingLeft: 15,
                  font: "400 calc(10.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
                }}>
                  {c.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </button>
            );
          })}
        </div>

      </div>
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
        note="Not a lock. Every one of these is five settings you can change on the strategy screen once the season starts."
      />}
    >
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
          Pick the bench you want to run. Whoever hires you plays this way from
          the first pitch.
        </div>

        <div style={{ marginTop: 12 }}>
          {PHILOSOPHIES.map((p) => {
            const on = p.id === chosen;
            return (
              <button
                key={p.id}
                onClick={() => onChoose(p.id)}
                className="tap"
                style={{
                  width: '100%', textAlign: 'left', marginBottom: 7,
                  padding: '11px 12px',
                  background: on ? 'rgba(var(--clay-rgb), .10)' : 'var(--paper)',
                  border: `1px solid ${on ? 'var(--clay)' : 'rgba(var(--ink-rgb), .28)'}`,
                  boxShadow: on ? 'none' : '0 1px 0 rgba(var(--ink-rgb), .10)',
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', gap: 8,
                }}>
                  <span style={{
                    font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                    color: on ? 'var(--clay)' : 'var(--ink)',
                  }}>{p.name}</span>
                  {/* The check the reference puts on the chosen row. A row that
                      is only marked by its background reads as a hover state. */}
                  {on && (
                    <span style={{
                      font: "700 calc(12px * var(--ts)) var(--mono)", color: 'var(--clay)', lineHeight: 1,
                    }}>✓</span>
                  )}
                </div>
                <div style={{
                  marginTop: 4, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
                }}>{p.blurb}</div>
                {/* The five settings this bench actually sets, spelled out — a
                    plan you can read is a plan, a name alone is a vibe. Each
                    chip is one of the strategy screen's own controls. */}
                <div style={{
                  marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 4,
                }}>
                  {planChips(p.id).map((chip) => (
                    <span key={chip} style={{
                      font: "600 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                      padding: '2px 6px 3px',
                      background: on ? 'rgba(var(--clay-rgb), .14)' : 'var(--field)',
                      border: '1px solid var(--faint)',
                      color: on ? 'var(--clay)' : 'var(--dim)',
                    }}>{chip}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

      </div>
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
    <div style={{ marginTop: 11 }}>
      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
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
      onClick={onClick}
      className="tap"
      aria-label={colour}
      style={{
        width: 38, height: 28, background: colour,
        border: `1px solid ${on ? 'var(--ink)' : 'var(--faint)'}`,
        boxShadow: on ? 'inset 0 0 0 2px var(--paper)' : 'none',
      }}
    />
  );
}

/** A word you can pick, in the same chip the region filter uses. */
function Chip(
  { label, on, onClick }: { label: string; on: boolean; onClick: () => void },
) {
  return (
    <button
      onClick={onClick}
      className="tap"
      style={{
        padding: '7px 10px',
        background: on ? 'var(--clay)' : 'var(--paper)',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(var(--ink-rgb), .28)'}`,
        color: on ? 'var(--cream)' : 'var(--ink)',
        font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.06em',
      }}
    >{label}</button>
  );
}

/** One end of the age stepper. Wide enough to hit with a thumb. */
function Nudge({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 54, background: 'transparent',
        font: "600 calc(18px * var(--ts))/1 var(--mono)", color: 'var(--clay)',
      }}
    >{label}</button>
  );
}

/** One of the board's asks, before a game has been played. */
function Ask({ objective }: { objective: Objective }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{
        font: "700 calc(11px * var(--ts)) var(--mono)", width: 12,
        color: objective.required ? 'var(--clay)' : 'rgba(var(--ink-rgb), .34)',
      }}>{objective.required ? '•' : '◦'}</span>
      <span style={{ flex: 1, font: "400 calc(12px * var(--ts))/1.4 var(--body)" }}>
        {objective.label}
        {!objective.required && (
          <span style={{
            marginLeft: 6, font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em',
            color: 'var(--dim)',
          }}>BONUS</span>
        )}
      </span>
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, paddingRight: 10,
      borderRight: last ? 'none' : '1px solid var(--hairline)',
      paddingLeft: last ? 10 : 0,
    }}>
      <div className="label">{k}</div>
      <div style={{ font: "700 calc(18px * var(--ts))/1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
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
        <div style={{
          marginTop: 2, font: "500 calc(9px * var(--ts)) var(--mono)",
          letterSpacing: '.16em', color: 'var(--dim)',
        }}>{i + 1} OF {questions.length}</div>
      </div>}
    >
      <div style={{ padding: '4px 14px 18px' }}>
        {/*
          The situation, in the straight man's voice. Pre-wrapped rather than
          left to the browser: these are written with their line breaks as part
          of the rhythm, and a paragraph that reflows on a narrow phone reads as
          prose instead of as somebody talking.
        */}
        <div style={{
          padding: '12px 13px 13px',
          background: 'var(--navy)',
          borderLeft: '4px solid var(--clay)',
        }}>
          <div style={{
            whiteSpace: 'pre-line',
            font: "400 calc(12.5px * var(--ts))/1.55 var(--body)",
            color: 'var(--cream)',
          }}>{q.setup}</div>
          <div style={{
            marginTop: 9,
            font: "800 calc(16px * var(--ts))/1.15 var(--display)",
            textTransform: 'uppercase', color: 'var(--cream)',
          }}>{q.ask}</div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {q.answers.map((a) => (
            <button
              key={a.text}
              className="tap"
              onClick={() => onAnswer(a)}
              style={{
                textAlign: 'left', padding: '11px 12px', minHeight: 48,
                background: 'var(--paper)',
                border: '1px solid rgba(var(--ink-rgb), .3)',
                boxShadow: '0 1px 0 rgba(var(--ink-rgb), .14)',
              }}
            >
              <div style={{
                font: "400 calc(12.5px * var(--ts))/1.45 var(--body)", color: 'var(--ink)',
              }}>{a.text}</div>
              <div style={{
                marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 5,
              }}>
                {(Object.entries(a.skills) as [keyof CoachSkills & string, number][])
                  .filter(([, n]) => n !== 0)
                  .map(([k, n]) => (
                    <span key={k} style={{
                      padding: '2px 5px',
                      border: `1px solid ${n > 0 ? 'var(--win)' : 'var(--clay)'}`,
                      color: n > 0 ? 'var(--win)' : 'var(--clay)',
                      font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                    }}>{n > 0 ? '+' : ''}{n} {SKILL_LABEL[k]}</span>
                  ))}
              </div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 12,
          font: "400 calc(10.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          There is no wrong answer here. What you say changes which programmes
          want you, not whether any of them do.
        </div>
      </div>
    </FixedHeader>
  );
}
