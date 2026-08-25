// store.test.ts
// The store is deliberately thin, so most of it is covered by testing the
// engine. What lives here is the state that only exists in the store — and can
// therefore only go stale in the store.
//
// The case that motivated the file: `lastWeek`, the "WEEK N IS OVER" recap the
// board shows after a week closes. It was written on every close and cleared
// nowhere, so a player opening next year's window walked into a banner about a
// week that ended a season ago — over a board it did not describe.

import { describe, it, expect } from 'vitest';
import { useDynasty, PHASES } from '../src/state/store.js';
import { createSeason, simSeason } from '../src/engine/season.js';
import {
  conferenceIds, conferenceTournament, freezeRegularSeason, conferenceField,
} from '../src/engine/postseason.js';
import { buildSaveFile } from '../src/state/persistence.js';
import {
  restoreCoach, DEFAULT_PROFILE, DEFAULT_LOOK, LOOK_CHOICES,
  MIN_COACH_AGE, MAX_COACH_AGE,
  type CoachState,
} from '../src/engine/program.js';
import {
  strategyFor, strategyForPhilosophy, philosophyOf, PHILOSOPHIES,
  DEFAULT_PHILOSOPHY, DEFAULT_STRATEGY,
} from '../src/engine/strategy.js';
import {
  COACH_SKIN, COACH_HAIR, CUT_LABEL, BEARD_LABEL,
} from '../src/ui/CoachPortrait.js';
import { makeRng } from '../src/engine/rng.js';

// Saving touches IndexedDB, which node does not have. The store already treats
// a failed save as a surfaced error rather than a crash, so the tests simply
// let those rejections land in `saveState` and ignore them.

const STALE_WEEK = { closed: 3, yours: ['Somebody Signed'], gone: 5 };

describe('the week recap does not outlive its window', () => {
  it('starts a new dynasty with no recap on the board', () => {
    useDynasty.setState({ lastWeek: STALE_WEEK, lastCommits: ['Somebody Signed'] });
    useDynasty.getState().start(4242, 0);
    expect(useDynasty.getState().lastWeek).toBeNull();
    expect(useDynasty.getState().lastCommits).toEqual([]);
  });

  it('clears the recap when a new recruiting window opens', async () => {
    useDynasty.getState().start(4242, 0);
    // Last year's final recap is still sitting in the store, exactly as it
    // does across a real offseason.
    useDynasty.setState({
      phase: 'draft',
      furthestPhase: PHASES.indexOf('draft'),
      lastWeek: STALE_WEEK,
      lastCommits: ['Somebody Signed'],
    });

    await useDynasty.getState().nextPhase();

    const s = useDynasty.getState();
    expect(s.phase).toBe('recruiting');
    expect(s.season?.recruiting.week).toBe(1);
    // The window is live and nothing has closed yet: no banner.
    expect(s.lastWeek).toBeNull();
    expect(s.lastCommits).toEqual([]);
  });

  it('keeps the recap through the week that follows it', () => {
    // Persisting into the *next* week is the point of the banner — it is the
    // recap you read while deciding what to do with the new budget. Only a new
    // window may clear it.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ phase: 'recruiting' });
    const season = useDynasty.getState().season;
    if (!season) throw new Error('no season');
    season.recruiting.week = 1;

    useDynasty.getState().advanceRecruitingWeek();

    const s = useDynasty.getState();
    expect(s.season?.recruiting.week).toBe(2);
    expect(s.lastWeek?.closed).toBe(1);
  });
});

describe('the board meets every year, not just the first', () => {
  // `settleSeason` grades the year — prestige, the seat, career totals, and the
  // points a coach improves with — and it refuses to run while a review is
  // already sitting in the store. Nothing cleared that at the year roll except
  // the dismiss button on the program page, so a player who never tapped it was
  // silently ungraded from his second season onward. Reported as "I got points
  // in the first season to upgrade my coach but not in the second".

  it('clears last year\'s review when the year turns over', async () => {
    useDynasty.getState().start(4242, 0);
    const before = useDynasty.getState().coach.skillPoints;

    // A graded first season, its review never dismissed.
    useDynasty.getState().settleSeason();
    const reviewed = useDynasty.getState();
    expect(reviewed.lastReview).not.toBeNull();
    expect(reviewed.coach.skillPoints).toBeGreaterThan(before);

    await useDynasty.getState().rollYear();

    // The new year starts with no verdict carried over, so the next meeting can
    // actually happen.
    expect(useDynasty.getState().lastReview).toBeNull();
  });

  it('awards points again in the second season', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().settleSeason();
    const afterFirst = useDynasty.getState().coach.skillPoints;
    expect(afterFirst).toBeGreaterThan(0);

    await useDynasty.getState().rollYear();
    useDynasty.getState().settleSeason();

    expect(useDynasty.getState().lastReview).not.toBeNull();
    expect(useDynasty.getState().coach.skillPoints).toBeGreaterThan(afterFirst);
  });
});

describe('the coach profile survives the disk', () => {
  // Name, age and hometown are flavour, which is exactly why they are easy to
  // lose: nothing downstream breaks when they go missing, so a drop shows up as
  // a career quietly belonging to a 41 year old man called "Coach". The save
  // record is assembled field by field, so this is the check that the profile is
  // actually named on it.

  const PROFILE = { name: 'Wendell Hartsock', age: 52, homeState: 'MS' };

  it('starts a career with the profile the creation step collected', () => {
    useDynasty.getState().start(4242, 0, PROFILE);
    const coach = useDynasty.getState().coach;
    expect(coach.name).toBe('Wendell Hartsock');
    expect(coach.age).toBe(52);
    expect(coach.homeState).toBe('MS');
  });

  it('writes the new fields into the save file', () => {
    useDynasty.getState().start(4242, 0, PROFILE);
    const { season, coach } = useDynasty.getState();
    if (!season) throw new Error('no season');

    const file = buildSaveFile('slot', 'Dynasty', season, 2027, 0, { coach });
    const saved = file.coach as CoachState;
    expect(saved.name).toBe('Wendell Hartsock');
    expect(saved.age).toBe(52);
    expect(saved.homeState).toBe('MS');
    // And back out again, which is the trip that actually matters.
    expect(restoreCoach(saved)).toEqual(coach);
  });

  it('keeps an age outside the hiring range once a career has run long enough', () => {
    // Twenty years in the chair puts a coach past the upper bound of the
    // creation screen, and a load must not pull him back to it.
    const old = { ...useDynasty.getState().coach, age: MAX_COACH_AGE + 20 };
    expect(restoreCoach(old).age).toBe(MAX_COACH_AGE + 20);
  });

  it('loads a save written before the profile existed, with defaults', () => {
    useDynasty.getState().start(4242, 0, PROFILE);
    const { coach } = useDynasty.getState();

    // Exactly what an older build put on disk: a coach with a name, a record and
    // no profile at all.
    const legacy = { ...coach } as Partial<CoachState>;
    delete legacy.age;
    delete legacy.homeState;
    legacy.careerWins = 140;

    const restored = restoreCoach(legacy);
    expect(restored.age).toBe(DEFAULT_PROFILE.age);
    expect(restored.homeState).toBe(DEFAULT_PROFILE.homeState);
    expect(restored.age).toBeGreaterThanOrEqual(MIN_COACH_AGE);
    // Nothing the old save did carry may be lost on the way through.
    expect(restored.name).toBe('Wendell Hartsock');
    expect(restored.careerWins).toBe(140);
    expect(restored.skills).toEqual(coach.skills);
  });

  it('loads a save with no coach at all rather than throwing', () => {
    const restored = restoreCoach(undefined);
    expect(restored.name).toBe(DEFAULT_PROFILE.name);
    expect(restored.age).toBe(DEFAULT_PROFILE.age);
    expect(restored.homeState).toBe(DEFAULT_PROFILE.homeState);
  });

  // The portrait and the philosophy arrived after the three fields above, and
  // they go on disk the same way: named nowhere, carried along inside `coach`.
  // Which is exactly the arrangement that loses them, so the round trip is
  // checked rather than assumed.

  const LOOK = { skin: 4, hair: 5, cut: 3, beard: 2 };
  const DRESSED = { ...PROFILE, look: LOOK, philosophy: 'smallball' as const };

  it('starts a career with the face and the philosophy the creation flow collected', () => {
    useDynasty.getState().start(4242, 0, DRESSED);
    const coach = useDynasty.getState().coach;
    expect(coach.look).toEqual(LOOK);
    expect(coach.philosophy).toBe('smallball');
  });

  it('writes the face and the philosophy into the save file', () => {
    useDynasty.getState().start(4242, 0, DRESSED);
    const { season, coach } = useDynasty.getState();
    if (!season) throw new Error('no season');

    const file = buildSaveFile('slot', 'Dynasty', season, 2027, 0, { coach });
    const saved = file.coach as CoachState;
    expect(saved.look).toEqual(LOOK);
    expect(saved.philosophy).toBe('smallball');
    expect(restoreCoach(saved)).toEqual(coach);
  });

  it('loads a save written before the portrait and the philosophy existed', () => {
    useDynasty.getState().start(4242, 0, DRESSED);
    const { coach } = useDynasty.getState();

    const legacy = { ...coach } as Partial<CoachState>;
    delete legacy.look;
    delete legacy.philosophy;
    legacy.careerWins = 140;

    const restored = restoreCoach(legacy);
    expect(restored.look).toEqual(DEFAULT_LOOK);
    expect(restored.philosophy).toBe(DEFAULT_PHILOSOPHY);
    // And nothing that career did carry may be lost on the way through.
    expect(restored.name).toBe('Wendell Hartsock');
    expect(restored.careerWins).toBe(140);
    expect(restored.skills).toEqual(coach.skills);
  });

  it('brings a nonsense face back inside the range the portrait can draw', () => {
    // A hand-edited save, or one written by a build with more colours in it.
    const restored = restoreCoach({
      name: 'Somebody', look: { skin: 99, hair: -3, cut: 'blond', beard: undefined },
      philosophy: 'triangle-offense',
    });
    expect(restored.look.skin).toBeLessThan(LOOK_CHOICES.skin);
    expect(restored.look.hair).toBeGreaterThanOrEqual(0);
    expect(restored.look.cut).toBe(0);
    expect(restored.look.beard).toBe(0);
    expect(restored.philosophy).toBe(DEFAULT_PHILOSOPHY);
  });

  it('offers exactly as many choices as the engine believes it does', () => {
    // The palettes live in the portrait and the counts live in the engine, which
    // draws a random coach from them. A colour added to one and not the other is
    // a colour no career can ever be given.
    expect({
      skin: COACH_SKIN.length, hair: COACH_HAIR.length,
      cut: CUT_LABEL.length, beard: BEARD_LABEL.length,
    }).toEqual(LOOK_CHOICES);
  });
});

describe('a coaching philosophy reaches the field', () => {
  // The failure this exists to catch is the dead menu: a creation screen that
  // collects an answer nothing downstream reads. A philosophy is worth having
  // only if the team's actual `strategy` — the one every game is built from and
  // the one the strategy screen edits — is what it says it is.

  it('sets the five real policies on the program that hires you', () => {
    useDynasty.getState().start(4242, 0, {
      ...DEFAULT_PROFILE, philosophy: 'pitching',
    });
    const me = useDynasty.getState().season?.teams[0];
    expect(me?.strategy).toEqual({
      running: 'patient', steals: 'selective', bunt: 'rare',
      hook: 'quick', alignment: 'shift',
    });
  });

  it('gives every philosophy a distinct bench, and balanced the default one', () => {
    // If two of these were the same set of policies the screen would be offering
    // a choice it does not have.
    const seen = PHILOSOPHIES.map((p) => JSON.stringify(p.strategy));
    expect(new Set(seen).size).toBe(PHILOSOPHIES.length);
    expect(strategyForPhilosophy('balanced')).toEqual(DEFAULT_STRATEGY);
    for (const p of PHILOSOPHIES) {
      expect(philosophyOf(p.id).name.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });

  it('leaves a career that never chose one playing the balanced bench', () => {
    useDynasty.getState().start(4242, 0);
    expect(useDynasty.getState().coach.philosophy).toBe(DEFAULT_PHILOSOPHY);
    expect(useDynasty.getState().season?.teams[0]?.strategy).toEqual(DEFAULT_STRATEGY);
  });

  it('is a starting point rather than a lock', () => {
    useDynasty.getState().start(4242, 0, { ...DEFAULT_PROFILE, philosophy: 'smallball' });
    useDynasty.getState().setStrategy('bunt', 'never');

    const s = useDynasty.getState();
    expect(s.season?.teams[0]?.strategy.bunt).toBe('never');
    // The override is the player's; the philosophy is still who he is, and it
    // is what the next job will start from.
    expect(s.season?.teams[0]?.strategy.steals).toBe('constant');
    expect(s.coach.philosophy).toBe('smallball');
  });

  it('follows the coach to his next job and leaves the old one as it found it', async () => {
    useDynasty.getState().start(4242, 0, { ...DEFAULT_PROFILE, philosophy: 'power' });
    useDynasty.getState().setStrategy('bunt', 'often');

    await useDynasty.getState().acceptOffer(5);

    const teams = useDynasty.getState().season?.teams;
    expect(useDynasty.getState().userTeam).toBe(5);
    expect(teams?.[5]?.strategy).toEqual(strategyForPhilosophy('power'));
    // The program he left goes back to playing like itself rather than keeping
    // a bench that belonged to somebody who no longer works there.
    expect(teams?.[0]?.strategy).toEqual(strategyFor(0));
  });
});

describe('a postseason survives being put down and picked up', () => {
  // Opening a stage decides every tournament you are not in and leaves yours
  // live. A save taken from there therefore carries the other seven conferences
  // and no record of your own — and the guard that asked "has anything been
  // played at this stage" read that as a finished stage and moved past it. The
  // player's own tournament was never played, which also left him out of the
  // regional, because he had not won anything to qualify with.

  /** A season played out, with a user who reached his conference tournament. */
  const qualified = (seed: number) => {
    const season = createSeason(makeRng(seed));
    simSeason(season);
    freezeRegularSeason(season);
    const me = season.teams.findIndex(
      (t) => conferenceField(season, t.conference).field.includes(t.index),
    );
    if (me < 0) throw new Error('nobody qualified, which cannot happen');
    return { season, me };
  };

  it('plays your own conference tournament after a reload, instead of skipping it', () => {
    const { season, me } = qualified(3131);
    const mine = season.teams[me]!.conference;

    // Exactly what a save written mid-stage brings back: the rest of the
    // country decided, your own tournament absent, and no live bracket.
    const others = conferenceIds(season)
      .filter((id) => id !== mine)
      .map((id) => conferenceTournament(season, id));
    useDynasty.setState({
      season, userTeam: me, myBracket: null,
      bracket: { stage: 'conference', cups: others, regionals: [], national: null },
    });

    useDynasty.getState().openStage();

    const after = useDynasty.getState();
    expect(after.myBracket).not.toBeNull();
    expect(after.myBracket?.kind).toBe('conference');
    expect(after.myBracket?.state.seeds).toContain(me);
    // The seven already on the books are kept rather than rolled again: a fresh
    // simulation would change who is waiting in the regional.
    expect(after.bracket?.cups).toBe(others);
    expect(after.bracket?.cups.some((c) => c.conference === mine)).toBe(false);
  });

  it('leaves a tournament alone once your result is on the books', () => {
    const { season, me } = qualified(3131);
    const all = conferenceIds(season).map((id) => conferenceTournament(season, id));

    useDynasty.setState({
      season, userTeam: me, myBracket: null,
      bracket: { stage: 'conference', cups: all, regionals: [], national: null },
    });

    useDynasty.getState().openStage();

    // Your conference is among them, so the stage is genuinely done. Opening it
    // again must not hand you a tournament you have already played.
    expect(useDynasty.getState().myBracket).toBeNull();
  });

  it('writes your half-played tournament into the save file', () => {
    const { season, me } = qualified(3131);
    useDynasty.setState({ season, userTeam: me, myBracket: null });
    useDynasty.setState({
      bracket: { stage: 'conference', cups: [], regionals: [], national: null },
    });
    useDynasty.getState().openStage();

    const live = useDynasty.getState().myBracket;
    expect(live).not.toBeNull();

    // The record is assembled field by field, so a value the types accept can
    // still be dropped on the floor. This is that check, for the one field
    // whose absence silently voided a postseason.
    const file = buildSaveFile('slot', 'Dynasty', season, 2030, me, {
      myBracket: { kind: live!.kind, state: { ...live!.state, season: undefined } },
    });
    const saved = file.myBracket as { kind: string; state: { seeds: number[] } };
    expect(saved.kind).toBe('conference');
    expect(saved.state.seeds).toContain(me);
  });
});
