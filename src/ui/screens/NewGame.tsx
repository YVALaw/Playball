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
// hand its program to someone who has never run one. Most of the board is locked
// on day one and it stays visible while it is locked, because a ladder you cannot
// see is not a ladder — it is just a short list that quietly gets longer.
//
// Three steps, in that order: who you are, how your teams play, where you work.
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

import { useMemo, useState, type ReactNode } from 'react';
import {
  CONFERENCES, STATES_BY_REGION, type ConferenceDef, type SchoolDef,
} from '../../data/schools.js';
import {
  prestigeStars, expectationFor, contractFor, requiredCoachPrestige,
  canBeHired, hireGateNote, ROOKIE_PRESTIGE, rosterStrength,
  randomProfile, clampAge, MIN_COACH_AGE, MAX_COACH_AGE, DEFAULT_LOOK,
  type CoachProfile, type CoachLook, type Mandate, type Objective,
} from '../../engine/program.js';
import {
  PHILOSOPHIES, philosophyOf, DEFAULT_PHILOSOPHY, type PhilosophyId,
} from '../../engine/strategy.js';
import { useDynasty, careerSeed } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import {
  CoachPortrait, COACH_SKIN, COACH_HAIR, CUT_LABEL, BEARD_LABEL,
} from '../CoachPortrait.js';
import { createSeason, seasonLength } from '../../engine/season.js';
import { makeRng } from '../../engine/rng.js';

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
  contend: 'Real talent and real expectations. June is the target.',
  championship: 'The hardest seat here. Anything short of Omaha is a failed year.',
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

const TIER_WORD: Record<number, string> = {
  1: 'a power league',
  2: 'a solid league',
  3: 'a modest league',
};

export function NewGame() {
  const start = useDynasty((s) => s.start);
  const [conference, setConference] = useState<ConferenceDef>(CONFERENCES[0] as ConferenceDef);
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
  const [step, setStep] = useState<0 | 1 | 2>(0);

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
    conference.schools.find((s) => s.abbr === school.rival);

  const openCount = conference.schools.filter((s) => preview(s).open).length;

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
        onDone={() => setStep(1)}
      />
    );
  }

  if (step === 1) {
    return (
      <PlayStyle
        chosen={coach.philosophy ?? DEFAULT_PHILOSOPHY}
        onChoose={(philosophy) => setCoach({ ...coach, philosophy })}
        onBack={() => setStep(0)}
        onDone={() => setStep(2)}
      />
    );
  }

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 8px' }}>
          {/*
            Title, who you are, and the region chips stay put. The program list
            runs twelve deep and the chips are how you move between regions —
            scrolling them off means scrolling back up every time you want to
            look somewhere else.
          */}
          <StepHead n={3} title="Take a job" onBack={() => setStep(1)} />

          {/*
            Who you are and what you are worth, on the line the standing box used
            to take five for. What that box said in prose — nobody has heard of
            you, the good jobs will not take the call — the board already says
            per row with NEEDS 38 and a padlock, and says properly in the offer
            sheet where `hireGateNote` explains the particular job you tapped.
            Saying it a third time at the top cost the list about a fifth of the
            screen, and the list is the reason anybody is here.

            The face and the philosophy ride along on the same line, because the
            two steps behind this one are otherwise invisible from here — and a
            choice you cannot see from the screen after it is a choice you are
            entitled to think was not saved.
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
                whiteSpace: 'nowrap', font: "600 11px var(--mono)",
              }}>{coach.name}</span>
              <span style={{
                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', font: "400 10px var(--mono)", color: 'var(--dim)',
              }}>
                {coach.age}{' · '}{coach.homeState}{' · '}
                {philosophyOf(coach.philosophy ?? DEFAULT_PHILOSOPHY).name}
                <span style={{ color: 'var(--clay)' }}> · EDIT</span>
              </span>
            </span>
            <span style={{
              font: "600 9px var(--mono)", letterSpacing: '.1em',
              color: 'var(--dim)', whiteSpace: 'nowrap',
            }}>STANDING {ROOKIE_PRESTIGE}</span>
          </button>

          <div className="label" style={{ marginTop: 12, marginBottom: 6 }}>REGION</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CONFERENCES.map((c) => {
              const on = c.id === conference.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setConference(c); setPicked(null); }}
                  style={{
                    padding: '8px 11px',
                    background: on ? 'var(--clay)' : 'var(--paper)',
                    border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
                    color: on ? 'var(--cream)' : 'var(--ink)',
                    font: "700 10px var(--mono)", letterSpacing: '.06em',
                  }}
                >{c.region.toUpperCase()}</button>
              );
            })}
          </div>

          {/*
            The league's name and what class of league it is. The one line blurb
            that used to follow was weather and atmosphere — nothing in it moves
            a game or picks a job, and it wrapped to two lines on a phone.
          */}
          <div style={{
            marginTop: 8, font: "400 11.5px/1.4 var(--body)", color: 'var(--dim)',
          }}>
            <strong style={{ color: 'var(--ink)' }}>{conference.name}</strong>
            {' · '}{TIER_WORD[conference.tier]}
          </div>

        </div>
      }
    >
    <div style={{ padding: '8px 14px 22px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginTop: 4, marginBottom: 6,
      }}>
        <span className="label">PROGRAM</span>
        <span style={{ font: "600 9px var(--mono)", color: 'var(--dim)' }}>
          {openCount} OF {conference.schools.length} WILL HIRE YOU
        </span>
      </div>

      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {conference.schools.map((school) => {
          const p = preview(school);
          return (
            <button
              key={school.abbr}
              onClick={() => setPicked(school)}
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '3px 1fr auto auto',
                gap: 9, alignItems: 'center',
                padding: '10px 11px 10px 0',
                borderBottom: '1px solid var(--hairline)',
                background: 'transparent',
                opacity: p.open ? 1 : 0.55,
              }}
            >
              {/* The school's colour, so a program is recognisable before you
                  have learned its name. */}
              <span style={{
                alignSelf: 'stretch', background: school.color,
                opacity: p.open ? 1 : 0.5,
              }} />
              <span style={{ minWidth: 0, paddingLeft: 8 }}>
                <span style={{
                  display: 'block', font: "400 13px var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{school.school}</span>
                <span style={{
                  display: 'block', marginTop: 1,
                  font: "400 10px var(--mono)", color: 'var(--dim)',
                }}>
                  {school.abbr} · {school.nickname}
                  {p.tag && <span style={{ color: 'var(--clay)' }}> · {p.tag}</span>}
                </span>
              </span>
              <span style={{
                font: "700 8.5px var(--mono)", letterSpacing: '.08em',
                color: 'var(--dim)', whiteSpace: 'nowrap', textAlign: 'right',
              }}>
                {p.open ? MANDATE_LABEL[p.expectation.mandate] : `NEEDS ${p.needs}`}
              </span>
              <span style={{
                font: "600 11px var(--mono)", whiteSpace: 'nowrap', paddingRight: 11,
                color: p.open ? 'var(--clay)' : 'var(--dim)',
              }}>{p.open ? '★'.repeat(p.stars) : '🔒'}</span>
            </button>
          );
        })}
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
              position: 'absolute', inset: 0, background: 'rgba(28,36,48,.55)',
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
                  font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
                }}>{p.open ? 'THE OFFER' : 'NOT YET'}</span>
                <button
                  onClick={() => setPicked(null)}
                  style={{
                    font: "600 9px var(--mono)", letterSpacing: '.14em',
                    color: 'rgba(246,241,230,.85)',
                  }}
                >BACK</button>
              </div>

              <div style={{ padding: '13px 12px 16px' }}>
                <div style={{
                  font: "800 22px/1 var(--display)", textTransform: 'uppercase',
                }}>{picked.school}</div>
                <div style={{
                  marginTop: 3, font: "400 11px var(--mono)", color: 'var(--dim)',
                }}>{picked.nickname} · {conference.name}</div>

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
                    font: "400 11.5px/1.45 var(--body)",
                  }}>
                    <strong style={{ font: "700 9px var(--mono)", letterSpacing: '.1em' }}>
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

                {rival && (
                  <div style={{
                    marginTop: 9, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                  }}>
                    Rivalry: <strong style={{ color: 'var(--ink)' }}>{rival.school}</strong>.
                    Three games a year, every year.
                  </div>
                )}

                <div style={{
                  marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--hairline)',
                }}>
                  <div className="label">THE MANDATE · {MANDATE_LABEL[p.expectation.mandate]}</div>
                  <div style={{ marginTop: 5, font: "400 13px/1.5 var(--body)" }}>
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
                  font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                }}>{MANDATE_NOTE[p.expectation.mandate]}</div>

                {p.open ? (
                  <>
                    <div style={{
                      marginTop: 10, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                    }}>
                      They are giving you <strong style={{ color: 'var(--ink)' }}>
                        {p.contract} seasons</strong>. Meet the mandate and they will
                      extend it; run the deal out without convincing them and they
                      simply will not renew.
                    </div>

                    <button
                      onClick={() => start(seed, indexOf(picked), coach)}
                      style={{
                        marginTop: 14, width: '100%', padding: '13px 0',
                        background: picked.color, border: `1px solid ${picked.color}`,
                        color: 'var(--cream)',
                        font: "700 11px var(--mono)", letterSpacing: '.14em',
                      }}
                    >SIGN WITH {picked.abbr}</button>
                  </>
                ) : (
                  <div style={{
                    marginTop: 12, padding: '11px 12px',
                    border: '1px solid var(--clay)', background: 'rgba(168,68,42,.07)',
                  }}>
                    <div className="label" style={{ color: 'var(--clay)' }}>
                      THEY WANT {p.needs} · YOU ARE {ROOKIE_PRESTIGE}
                    </div>
                    <div style={{
                      marginTop: 5, font: "400 12px/1.5 var(--body)",
                    }}>{p.gate}</div>
                  </div>
                )}

                <button
                  onClick={() => setPicked(null)}
                  style={{
                    marginTop: 8, width: '100%', padding: '10px 0',
                    background: 'transparent', border: '1px solid rgba(28,36,48,.28)',
                    font: "600 10px var(--mono)", letterSpacing: '.12em', color: 'var(--dim)',
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
function StepHead(
  { n, title, onBack }: { n: number; title: string; onBack?: () => void },
) {
  return (
    <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        {onBack ? (
          <button
            onClick={onBack}
            className="tap"
            style={{
              font: "600 9px var(--mono)", letterSpacing: '.14em',
              color: 'var(--clay)', padding: '2px 10px 2px 0',
            }}
          >‹ BACK</button>
        ) : <span className="label">NEW DYNASTY</span>}
        <span className="label">STEP {n} OF 3</span>
      </div>
      <div style={{
        font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
      }}>{title}</div>
    </div>
  );
}

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
    <FixedHeader header={<div style={{ padding: '12px 14px 8px' }}>
      <StepHead n={1} title="Your coach" />
    </div>}>
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ font: "400 12px/1.5 var(--body)", color: 'var(--dim)' }}>
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
            <CoachPortrait look={look} size={104} />
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
            border: '1px solid rgba(28,36,48,.28)', borderRadius: 0,
            color: 'var(--ink)', font: "400 15px var(--body)",
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
          border: '1px solid rgba(28,36,48,.28)', background: 'var(--paper)',
        }}>
          <Nudge label="−" onClick={() => set('age', clampAge(profile.age - 1))} />
          <div style={{
            flex: 1, textAlign: 'center', padding: '11px 0',
            font: "700 20px/1 var(--display)",
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
            border: '1px solid rgba(28,36,48,.28)', borderRadius: 0,
            color: 'var(--ink)', font: "600 14px var(--mono)", letterSpacing: '.04em',
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
        <FloatingAction
          label="HOW YOUR TEAMS PLAY"
          onClick={onDone}
          secondary={{ label: 'SOMEBODY ELSE', onClick: onShuffle }}
          note="None of this changes how a game is played. The next step does."
        />
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
function PlayStyle(
  { chosen, onChoose, onBack, onDone }: {
    chosen: PhilosophyId;
    onChoose: (id: PhilosophyId) => void;
    onBack: () => void;
    onDone: () => void;
  },
) {
  return (
    <FixedHeader header={<div style={{ padding: '12px 14px 8px' }}>
      <StepHead n={2} title="How you coach" onBack={onBack} />
    </div>}>
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ font: "400 12px/1.5 var(--body)", color: 'var(--dim)' }}>
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
                  background: on ? 'rgba(168,68,42,.10)' : 'var(--paper)',
                  border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
                  boxShadow: on ? 'none' : '0 1px 0 rgba(28,36,48,.10)',
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', gap: 8,
                }}>
                  <span style={{
                    font: "700 11px var(--mono)", letterSpacing: '.08em',
                    color: on ? 'var(--clay)' : 'var(--ink)',
                  }}>{p.name}</span>
                  {/* The check the reference puts on the chosen row. A row that
                      is only marked by its background reads as a hover state. */}
                  {on && (
                    <span style={{
                      font: "700 12px var(--mono)", color: 'var(--clay)', lineHeight: 1,
                    }}>✓</span>
                  )}
                </div>
                <div style={{
                  marginTop: 4, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
                }}>{p.blurb}</div>
              </button>
            );
          })}
        </div>

        <FloatingAction
          label="LOOK AT THE JOBS"
          onClick={onDone}
          note="Not a lock. Every one of these is five settings you can change on the strategy screen once the season starts."
        />
      </div>
    </FixedHeader>
  );
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
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
        color: on ? 'var(--cream)' : 'var(--ink)',
        font: "700 9.5px var(--mono)", letterSpacing: '.06em',
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
        font: "600 18px/1 var(--mono)", color: 'var(--clay)',
      }}
    >{label}</button>
  );
}

/** One of the board's asks, before a game has been played. */
function Ask({ objective }: { objective: Objective }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{
        font: "700 11px var(--mono)", width: 12,
        color: objective.required ? 'var(--clay)' : 'rgba(28,36,48,.34)',
      }}>{objective.required ? '•' : '◦'}</span>
      <span style={{ flex: 1, font: "400 12px/1.4 var(--body)" }}>
        {objective.label}
        {!objective.required && (
          <span style={{
            marginLeft: 6, font: "600 8px var(--mono)", letterSpacing: '.1em',
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
      <div style={{ font: "700 18px/1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
