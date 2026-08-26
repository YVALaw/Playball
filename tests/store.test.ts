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
import { useDynasty, PHASES, boardBudget } from '../src/state/store.js';
import { windowBudget } from '../src/engine/recruiting.js';
import { prestigeStars } from '../src/engine/program.js';
import type { DraftBoard } from '../src/engine/draft.js';
import { createSeason, simSeason, seasonComplete } from '../src/engine/season.js';
import type { SeasonState, TeamRecord } from '../src/engine/season.js';
import type { OffseasonReport } from '../src/engine/progression.js';
import type { Player, PlayerId } from '../src/engine/types.js';
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
import { restoreInbox, unreadCount } from '../src/engine/inbox.js';
import { buildCase } from '../src/engine/hall.js';

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

describe('the world reports itself', () => {
  // The inbox and the rival carousel are both engine-side and both tested
  // there. What can only go wrong here is the wiring: a store that computes a
  // carousel nobody is told about, or a board verdict that reaches a screen and
  // nowhere else. These check that settling a season actually files something.

  it('files the board\'s verdict where it can be read later', () => {
    useDynasty.setState({ inbox: [] });
    useDynasty.getState().start(4242, 0);
    expect(useDynasty.getState().inbox).toHaveLength(0);

    useDynasty.getState().settleSeason();
    const inbox = useDynasty.getState().inbox;
    expect(inbox.some((i) => i.kind === 'board')).toBe(true);
    expect(unreadCount(inbox)).toBeGreaterThan(0);

    // And opening the screen is the only thing that clears the badge.
    useDynasty.getState().readInbox();
    expect(unreadCount(useDynasty.getState().inbox)).toBe(0);
  });

  it('runs the other ninety five careers at the same meeting', () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season as SeasonState;
    const before = season.teams.map((t) => t.prestige);
    const staffed = season.teams.filter((t) => t.coach).length;
    // Every chair but the user's has a man in it from the first day.
    expect(staffed).toBe(season.teams.length - 1);

    useDynasty.getState().settleSeason();
    const after = season.teams.map((t) => t.prestige);
    // Somebody other than the user moved. Before B7 this array was frozen for
    // the life of the dynasty.
    let moved = 0;
    for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) moved += 1;
    expect(moved).toBeGreaterThan(1);
    // And the bench edge is restamped on all of them, so the next season's
    // games are played by the coaches who are actually in post.
    for (const t of season.teams) {
      if (t.coach) expect(t.coachMods?.offense).toBe(t.coach.skills.offense);
    }
  });

  it('still finds somebody who would take the call after a sacking', async () => {
    // The trap B7 laid and this is the tripwire for. Every chair in the country
    // has a man in it and `runCarousel` never leaves one open, so an offer list
    // filtered on "the chair is empty" comes back empty every single time — and
    // the job search screen has no way forward with nothing on it. A career
    // would end on a page saying nobody rang.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({
      coach: { ...useDynasty.getState().coach, prestige: 55, security: 12, tenure: 4 },
    });
    const season = useDynasty.getState().season as SeasonState;
    const me = season.teams[0] as TeamRecord;
    me.rw = 4; me.rl = 41; me.cw = 2; me.cl = 31;

    useDynasty.getState().settleSeason();
    expect(useDynasty.getState().lastReview?.fired).toBe(true);
    await useDynasty.getState().rollYear();

    expect(useDynasty.getState().jobSearch).toBe(true);
    expect(useDynasty.getState().offers.length).toBeGreaterThan(0);
    // And they are all programs whose current man is worse than he is, or
    // programs with nobody in the chair at all.
    const after = useDynasty.getState().season as SeasonState;
    for (const o of useDynasty.getState().offers) {
      const chair = after.teams[o.team] as TeamRecord;
      expect(!chair.coach || chair.coach.prestige < 55).toBe(true);
    }
  });

  it('carries the inbox and the cabinet onto the save record', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().settleSeason();
    const s = useDynasty.getState();
    const file = buildSaveFile(
      'slot', 'Dynasty', s.season as SeasonState, s.year, s.userTeam,
      { coach: s.coach, inbox: s.inbox },
    );
    // The save record is assembled field by field, so a widened type is not
    // enough — and an inbox that was dropped looks exactly like one that was
    // empty on the next load.
    expect(Array.isArray(file.inbox)).toBe(true);
    expect((file.inbox as unknown[]).length).toBeGreaterThan(0);
    expect((file.coach as CoachState).achievements).toBeDefined();
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

describe("a departing player's last season reaches the record book", () => {
  /**
   * The most damaging thing this file has ever had to cover, and it was never a
   * regression: it had always been so.
   *
   * `departAndDevelop` runs at the draft step and strips every man who is
   * leaving off `lineup`, `bench`, `rotation` and `bullpen`. `archiveSeason`
   * ran later, at the year roll, and reads only those four arrays. So a
   * graduating senior's final year — usually the best of his career, and
   * exactly what a hall of fame weighs — was never written down at all. The
   * archive now runs beside `recordSeasonMarks` on the way into the draft,
   * which is the last moment those rosters exist.
   */

  const appeared = (season: SeasonState, id: PlayerId): boolean =>
    (season.batting.get(id)?.ab ?? 0) > 0 || (season.pitching.get(id)?.outs ?? 0) > 0;

  /** A season played to the end, with the user in the chair at team 0. */
  const played = (seed: number): SeasonState => {
    useDynasty.getState().start(seed, 0);
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    return season;
  };

  const intoTheDraft = async (): Promise<void> => {
    useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach') });
    await useDynasty.getState().nextPhase();
  };

  it('archives every man who left, whichever door he left by', async () => {
    const season = played(6161);
    const me = season.teams[0] as TeamRecord;
    const year = useDynasty.getState().year;

    // Nobody has been recruited onto this roster yet, so no walk-on exists to
    // lose. One is made by hand rather than by rolling a whole year forward:
    // the exit route is the point, and `departAndDevelop` reads the flag and
    // nothing else.
    const roster = [
      ...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen,
    ];
    const walker = roster.find((p) => p.classYear !== 'SR' && appeared(season, p.id));
    expect(walker).toBeDefined();
    (walker as Player).walkOn = true;

    await intoTheDraft();

    const report = useDynasty.getState().lastOffseason as OffseasonReport;
    const mine = [...report.graduated, ...report.drafted]
      .filter((d) => d.teamAbbr === me.def.abbr);

    // All three routes out are represented, so none of them is being covered
    // by accident.
    expect(new Set(mine.map((d) => d.reason)))
      .toEqual(new Set(['graduated', 'drafted', 'walk-on']));

    for (const d of mine) {
      if (!appeared(season, d.id)) continue;
      const career = season.careers[d.id] ?? [];
      expect(career.some((row) => row.year === year)).toBe(true);
    }
  });

  it('files a season under the class year it was actually played at', async () => {
    // `departAndDevelop` ages every survivor as it goes, so an archive taken
    // afterwards recorded a junior's season as a senior's.
    const season = played(6161);
    const me = season.teams[0] as TeamRecord;
    const year = useDynasty.getState().year;
    const before = new Map(
      [...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen]
        .map((p) => [p.id, p.classYear] as const),
    );

    await intoTheDraft();

    let checked = 0;
    for (const [id, classYear] of before) {
      const row = (season.careers[id] ?? []).find((r) => r.year === year);
      if (!row) continue;
      expect(row.classYear).toBe(classYear);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(15);
  });

  it('does not write the year twice when the draft step is re-entered', async () => {
    // Walking back to the coach step and forward again runs the branch a
    // second time. Two rows for one season would double a career total.
    const season = played(6161);
    const year = useDynasty.getState().year;
    await intoTheDraft();
    const rowsFor = (id: PlayerId): number =>
      (season.careers[id] ?? []).filter((r) => r.year === year).length;
    const ids = Object.keys(season.careers) as PlayerId[];
    const after = ids.map((id) => [id, rowsFor(id)] as const);
    expect(after.length).toBeGreaterThan(0);

    await intoTheDraft();
    for (const [id, count] of after) expect(rowsFor(id)).toBe(count);
  });
});

describe('talking a drafted player out of professional baseball', () => {
  /**
   * The mechanic's whole weight is that it spends the recruiting budget, and
   * the recruiting board opens ninety seconds later. So what has to be held
   * here is not the persuasion arithmetic — that is `tests/draft.test.ts` —
   * but the accounting: the money comes out of the right pool, it cannot go
   * past the bottom of it, and a man who stays is genuinely back on the roster
   * rather than only marked as such.
   */

  const intoTheDraft = async (seed: number): Promise<SeasonState> => {
    useDynasty.getState().start(seed, 0);
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach') });
    await useDynasty.getState().nextPhase();
    return season;
  };

  const window = (season: SeasonState): number =>
    windowBudget(prestigeStars((season.teams[0] as TeamRecord).prestige));

  it('offers your own men with eligibility left, and nobody else', async () => {
    const season = await intoTheDraft(6161);
    const board = season.draft as DraftBoard;
    const report = useDynasty.getState().lastOffseason as OffseasonReport;
    const abbr = (season.teams[0] as TeamRecord).def.abbr;

    expect(board.men.length).toBeGreaterThan(0);
    const drafted = new Map(report.drafted.map((d) => [d.id, d]));
    for (const man of board.men) {
      const notice = drafted.get(man.player.id);
      expect(notice, 'somebody on the board was never drafted').toBeDefined();
      expect(notice?.teamAbbr, 'a rival program\'s player was offered to you').toBe(abbr);
      // A senior has nothing to come back to, so there is no conversation.
      expect(man.player.classYear).not.toBe('SR');
      expect(man.round).toBe(notice?.round);
    }
  });

  it('never spends past the bottom of the recruiting pool', async () => {
    const season = await intoTheDraft(6161);
    const board = season.draft as DraftBoard;
    const man = board.men[0] as DraftBoard['men'][number];
    // Everything, twice over, on one man.
    useDynasty.getState().keepPlayer(man.player.id, 'ring', 9999);
    expect(board.spent).toBe(window(season));
    expect(boardBudget(season, 0)).toBe(0);

    // And a second man cannot spend money that is gone.
    const next = board.men[1];
    if (next) {
      useDynasty.getState().keepPlayer(next.player.id, 'word', 40);
      expect(board.spent).toBe(window(season));
      expect(next.offered).toBe(0);
    }
  });

  it('takes what it spends off every week of the board', async () => {
    const season = await intoTheDraft(6161);
    const board = season.draft as DraftBoard;
    const full = boardBudget(season, 0);
    const man = board.men[0] as DraftBoard['men'][number];
    useDynasty.getState().keepPlayer(man.player.id, 'word', 30);
    expect(board.spent).toBe(30);
    // Thirty out of a three week window is ten a week.
    expect(boardBudget(season, 0)).toBe(full - 10);
  });

  it('puts a man who stays back on the roster, as a senior', async () => {
    const season = await intoTheDraft(6161);
    const board = season.draft as DraftBoard;
    const junior = board.men.find((m) => m.player.classYear === 'JR');
    expect(junior).toBeDefined();
    const man = junior as DraftBoard['men'][number];

    // Made deliberately cheap and deliberately well matched, because what is
    // being tested here is the bookkeeping and not whether the price was fair.
    man.round = 20;
    man.player.priorities = {
      prestige: 0.02, playingTime: 0.02, winning: 0.92, proximity: 0.02, development: 0.02,
    };
    useDynasty.getState().keepPlayer(man.player.id, 'ring', 60);
    expect(man.outcome, 'he did not stay').toBe('stayed');

    const team = (season.teams[0] as TeamRecord).team;
    const roster = [...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen];
    expect(roster.some((p) => p.id === man.player.id)).toBe(true);
    // A returning junior is a senior, which is the bet: no leverage next June.
    expect(man.player.classYear).toBe('SR');
    // He is on the roster once, not twice.
    expect(roster.filter((p) => p.id === man.player.id)).toHaveLength(1);

    // The notice changes its mind rather than disappearing — being taken in a
    // round and turning it down is a thing that happened to him.
    const report = useDynasty.getState().lastOffseason as OffseasonReport;
    const row = report.drafted.find((d) => d.id === man.player.id);
    expect(row?.returned).toBe(true);
  });

  it('signs anybody still undecided when the phase closes', async () => {
    const season = await intoTheDraft(6161);
    const board = season.draft as DraftBoard;
    expect(board.men.some((m) => m.outcome === 'pending')).toBe(true);
    await useDynasty.getState().nextPhase();
    for (const man of board.men) expect(man.outcome).not.toBe('pending');
  });
});

describe('the offseason cannot be run twice', () => {
  /**
   * The rail lets you walk back to a step you have already done. Everything
   * else on the way into the draft is idempotent by construction; the departure
   * pass is not, and once the draft board holds decisions the coach has paid
   * for, running it again would take his money and give the player back to
   * professional baseball.
   */
  it('leaves the rosters and the draft board alone on a second pass', async () => {
    useDynasty.getState().start(6161, 0);
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach') });
    await useDynasty.getState().nextPhase();

    const board = season.draft as DraftBoard;
    const man = board.men[0] as DraftBoard['men'][number];
    useDynasty.getState().keepPlayer(man.player.id, 'word', 25);
    const spent = board.spent;
    const outcome = man.outcome;
    const team = (season.teams[0] as TeamRecord).team;
    const before = [
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ].map((p) => p.id);

    // Back to the coach step and forward again.
    useDynasty.getState().goPhase('coach');
    await useDynasty.getState().nextPhase();

    expect(useDynasty.getState().season?.draft).toBe(board);
    expect(board.spent).toBe(spent);
    expect(board.men[0]?.outcome).toBe(outcome);
    const after = [
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ].map((p) => p.id);
    expect(after, 'a second class graduated out of an emptied roster').toEqual(before);
  });
});

describe('the hall of fame meets when the draft settles', () => {
  /**
   * B12, end to end through the store.
   *
   * The careers are written into the archive by hand rather than played out,
   * because a hall of fame case takes three seasons to accumulate and this is a
   * unit test. What is being checked is the wiring and the timing — that the
   * ballot runs at the one moment every departure is settled, that it announces
   * itself, and that it does not touch a man who is still on a roster.
   */
  const greatYear = (year: number, classYear: string, abbr: string, name: string) => ({
    year, classYear, team: abbr, name,
    ab: 180, h: 72, d: 18, t: 2, hr: 15, rbi: 65, bb: 30, sb: 4,
  });

  it('inducts a finished career, says so, and leaves a man still playing alone', async () => {
    useDynasty.getState().start(7373, 0);
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    const me = season.teams[0] as TeamRecord;
    const year = useDynasty.getState().year;
    const abbr = me.def.abbr;

    // One man who left three Junes ago, and one of exactly the same quality who
    // is a freshman and has three seasons in front of him.
    const departed = 'Hall Worthy';
    season.careers[departed as PlayerId] = [
      greatYear(year - 3, 'SO', abbr, departed),
      greatYear(year - 2, 'JR', abbr, departed),
      greatYear(year - 1, 'SR', abbr, departed),
    ];
    const kid = me.team.lineup.find((p) => p.classYear === 'FR') as Player;
    expect(kid).toBeDefined();
    season.careers[kid.id] = [
      greatYear(year - 1, 'FR', abbr, kid.name),
      greatYear(year, 'SO', abbr, kid.name),
    ];

    useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach') });
    await useDynasty.getState().nextPhase();      // into the draft
    // Nothing is inducted at the draft step: a man on the board may yet be
    // talked into coming back, so his career is not over until the step ends.
    expect(useDynasty.getState().season?.hall ?? []).toEqual([]);

    await useDynasty.getState().nextPhase();      // into recruiting, and the hall meets

    const after = useDynasty.getState().season as SeasonState;
    const hall = (after.hall ?? []).map((m) => String(m.id));
    expect(hall).toContain(departed);

    // The freshman is a sophomore now and still on the roster, so he is not on
    // the ballot however good his two seasons were.
    const roster = new Set([
      ...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen,
    ].map((p) => String(p.id)));
    expect(roster.has(String(kid.id))).toBe(true);
    expect(hall).not.toContain(String(kid.id));

    // Announced. The inbox is where a thing that happened to you goes.
    const posted = useDynasty.getState().inbox.filter((i) => i.kind === 'hall');
    expect(posted.length).toBe(1);
    expect(posted[0]?.title).toContain(departed);
    expect(posted[0]?.year).toBe(year);

    // And it is on the disk, which for this record has to be checked rather than
    // assumed: the save is assembled field by field one level down.
    const file = buildSaveFile('slot', 'Test', after, year, 0, {}, 0);
    expect((file.season.hall ?? []).map((m) => String(m.id))).toContain(departed);

    // Walking back and forward again does not induct him twice.
    useDynasty.getState().goPhase('draft');
    await useDynasty.getState().nextPhase();
    expect((useDynasty.getState().season?.hall ?? []).length).toBe(hall.length);
    expect(useDynasty.getState().inbox.filter((i) => i.kind === 'hall').length).toBe(1);
  });

  /*
    The ballot meets in the June after a man's last game, and it could not see
    what he won in it.

    Two things had to move to fix that and they are the same mistake twice.
    `history` was written at the year roll, which happens after the hall meets —
    so the honours handed to the ballot were every season the coach had ever
    finished except the one that had just ended, which is the season a departing
    senior wins things in. And the record itself was assembled after
    `departAndDevelop` had emptied the rosters, so an award could no longer be
    resolved to the man who won it: the graduating Player of the Year was not in
    the country any more, and his award went into no list at all.

    Both are fixed by writing the season down at the board meeting, where the
    rosters that produced it are still standing.
  */
  it('reads what a man won in the season he has just finished', async () => {
    useDynasty.getState().start(7373, 0);
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    const me = season.teams[0] as TeamRecord;
    const year = useDynasty.getState().year;
    const abbr = me.def.abbr;
    useDynasty.setState({ history: [], inbox: [] });

    // The board meets, which is when the season goes into the books.
    useDynasty.getState().settleSeason();
    const closing = useDynasty.getState().history.find((h) => h.year === year);
    expect(closing).toBeDefined();
    const voted = closing!.awards ?? [];
    expect(voted.length).toBeGreaterThan(0);

    // Somebody at this program the country voted for this June.
    const who = voted[0]!.id as PlayerId;
    const his = voted.filter((a) => a.id === who).map((a) => a.title);

    // And he has just played his last game: two seasons in the book, and off
    // every roster in the country, which is what makes a career finished.
    for (const arr of [me.team.lineup, me.team.bench, me.team.rotation, me.team.bullpen]) {
      const at = arr.findIndex((p) => String(p.id) === String(who));
      if (at >= 0) arr.splice(at, 1);
    }
    const rows = [
      greatYear(year - 1, 'JR', abbr, String(who)),
      greatYear(year, 'SR', abbr, String(who)),
    ];
    season.careers[who] = rows;

    useDynasty.setState({ phase: 'draft', furthestPhase: PHASES.indexOf('draft') });
    await useDynasty.getState().nextPhase();

    const inducted = (useDynasty.getState().season?.hall ?? [])
      .find((m) => String(m.id) === String(who));
    expect(inducted).toBeDefined();
    // The case that put him in is the one with this June on it.
    expect(inducted!.score).toBe(Math.round(buildCase(who, rows, his).score));
    expect(inducted!.score).toBeGreaterThan(Math.round(buildCase(who, rows, []).score));
  });

  it('does not write the same season into the books twice', async () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    useDynasty.setState({ history: [] });

    useDynasty.getState().settleSeason();
    expect(useDynasty.getState().history).toHaveLength(1);

    await useDynasty.getState().rollYear();
    // The year roll used to be where this was written. It is the fallback now,
    // and a fallback that fires on top of the real thing is a duplicated season
    // in the record book for ever.
    expect(useDynasty.getState().history).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

/*
  The season's own news, which the inbox did not have any of.

  Reported: "the inbox stayed empty for a whole season." It was: every writer in
  the store fired between the last game of one year and the first of the next,
  so a notification centre with a badge on the nav had nothing to put in it for
  the four months anybody was looking. These pin the four in-season writers and,
  more importantly, the property that makes them trustworthy — a season simmed
  in one press has to file the same cards as one walked through a day at a time,
  because the fast path is the one most people use and it only ever sees the
  finished year.
*/
describe('the inbox during a season', () => {
  it('has something to say about an ordinary season', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ inbox: [] });
    const year = useDynasty.getState().year;

    await useDynasty.getState().playSeason();

    const mine = useDynasty.getState().inbox.filter((i) => i.year === year);
    expect(mine.length).toBeGreaterThan(0);
    // The board at the halfway mark is the one that fires every year, whatever
    // kind of season it was, and it is why "empty all season" cannot happen
    // again quietly.
    expect(mine.some((i) => i.id.endsWith('halfway'))).toBe(true);
  });

  it('files the same cards however the season was played', async () => {
    // Day by day, the whole way. Nothing here may depend on the live streak
    // counter or on the current record, both of which say something different
    // at the end of a season than they did in April.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ inbox: [] });
    let guard = 0;
    while (!seasonComplete(useDynasty.getState().season as SeasonState) && guard++ < 200) {
      useDynasty.getState().advanceDay();
    }
    const walked = useDynasty.getState().inbox.map((i) => i.id).sort();

    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ inbox: [] });
    await useDynasty.getState().playSeason();
    const simmed = useDynasty.getState().inbox.map((i) => i.id).sort();

    // The runs and the poll report the best rung reached, so a season handed
    // over finished files the top one and never the ones under it. Everything
    // it does file, the slow walk filed too.
    expect(simmed.length).toBeGreaterThan(0);
    for (const id of simmed) expect(walked).toContain(id);
  });

  it('does not repeat itself when the scan runs again', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ inbox: [] });
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);

    useDynasty.getState().noteSeasonNews();
    const once = useDynasty.getState().inbox.length;
    expect(once).toBeGreaterThan(0);
    // Every writer is a scan rather than an event, and the calendar moves a
    // great many times. Keyed ids are what makes that safe.
    useDynasty.getState().noteSeasonNews();
    useDynasty.getState().noteSeasonNews();
    expect(useDynasty.getState().inbox.length).toBe(once);
  });

  it('gives a card somewhere to go, and leaves the ones with nowhere inert', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ inbox: [] });
    const season = useDynasty.getState().season as SeasonState;
    simSeason(season);
    useDynasty.getState().noteSeasonNews();
    useDynasty.getState().settleSeason();

    const inbox = useDynasty.getState().inbox;
    const verdict = inbox.find((i) => i.kind === 'board' && i.id.endsWith('halfway') === false);
    expect(verdict?.link).toEqual({ to: 'program', sheet: 'board' });

    // And the destinations survive a reload, which is the only place a link can
    // quietly become undefined.
    const back = restoreInbox(JSON.parse(JSON.stringify(inbox)) as unknown);
    expect(back.find((i) => i.id === verdict?.id)?.link).toEqual(verdict?.link);
    // A link with a target this build does not know is dropped rather than
    // reaching the screen as a card that looks tappable and is not.
    const junk = restoreInbox([{
      id: 'x-1', year: 2027, kind: 'board', title: 'T', body: '', read: false,
      link: { to: 'nowhere' },
    }]);
    expect(junk[0]?.link).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('points can be taken back until the step closes', () => {
  it('gives a point back, and refuses once the offseason has moved on', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({
      phase: 'coach',
      furthestPhase: PHASES.indexOf('signing'),
      spentThisStep: {},
    });
    const start = useDynasty.getState().coach.skills.offense;
    useDynasty.setState({
      coach: { ...useDynasty.getState().coach, skillPoints: 3 },
    });

    // Three into the wrong skill, which is the report exactly.
    for (let i = 0; i < 3; i++) useDynasty.getState().spendSkill('offense');
    expect(useDynasty.getState().coach.skills.offense).toBe(start + 3);
    expect(useDynasty.getState().coach.skillPoints).toBe(0);

    // Two of them back, and spent where they were meant to go.
    useDynasty.getState().refundSkill('offense');
    useDynasty.getState().refundSkill('offense');
    expect(useDynasty.getState().coach.skills.offense).toBe(start + 1);
    expect(useDynasty.getState().coach.skillPoints).toBe(2);
    useDynasty.getState().spendSkill('training');
    useDynasty.getState().spendSkill('training');
    expect(useDynasty.getState().coach.skills.training).toBe(start + 2);

    // The step closes. What was spent is his.
    useDynasty.getState().goPhase('draft');
    useDynasty.getState().refundSkill('training');
    expect(useDynasty.getState().coach.skills.training).toBe(start + 2);
    expect(useDynasty.getState().coach.skillPoints).toBe(0);
  });

  it('will not refund a point it did not put there', () => {
    // The difference between an undo and a respec. Nothing earned in an earlier
    // year can be taken off, however many points are on the skill.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ phase: 'coach', spentThisStep: {} });
    const before = useDynasty.getState().coach.skills.recruiting;
    useDynasty.getState().refundSkill('recruiting');
    expect(useDynasty.getState().coach.skills.recruiting).toBe(before);
  });
});

describe('how far the offseason got, across a reload', () => {
  // `phase` is where the coach is standing; `furthestPhase` is how far the
  // career has ever walked. They are usually the same number and the whole
  // point of keeping both is the moment they are not.

  it('remembers every step already walked, so the rail is not greyed out', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({
      phase: 'recruiting',
      furthestPhase: PHASES.indexOf('recruiting'),
    });
    const { season, coach } = useDynasty.getState();
    if (!season) throw new Error('no season');

    const file = buildSaveFile('slot', 'Dynasty', season, 2029, 0, {
      coach,
      phase: 'recruiting',
      furthestPhase: PHASES.indexOf('recruiting'),
    });

    expect(file.furthestPhase).toBe(PHASES.indexOf('recruiting'));
  });

  it('writes a furthest step of nought rather than dropping it', () => {
    // The record is assembled field by field on a truthiness test, and nought
    // is a real answer here — the first step of the offseason. Dropped, a
    // reload cannot tell "has been nowhere" from "was never written down", and
    // the two have opposite consequences at the draft.
    const { season, coach } = useDynasty.getState();
    if (!season) throw new Error('no season');

    const file = buildSaveFile('slot', 'Dynasty', season, 2029, 0, {
      coach, phase: 'awards', furthestPhase: 0,
    });

    expect(file).toHaveProperty('furthestPhase');
    expect(file.furthestPhase).toBe(0);
  });

  it('keeps the furthest step when the save was taken on an earlier one', () => {
    // The load-bearing case. Walking back moves `phase` and deliberately leaves
    // `furthestPhase` alone, and reading the inbox — which the top bar offers
    // at any moment — writes a save. So a save genuinely says `coach` while the
    // career had reached recruiting.
    //
    // Deriving the furthest step from `phase` here would report 2 rather than
    // 4, which is not merely a greyed-out rail: `nextPhase` runs the offseason
    // departures only while the furthest step is short of the draft, so the
    // walk forward would graduate a second class and lose any man kept out of
    // the draft at the cost of a recruiting budget.
    const { season, coach } = useDynasty.getState();
    if (!season) throw new Error('no season');

    const file = buildSaveFile('slot', 'Dynasty', season, 2029, 0, {
      coach,
      phase: 'coach',
      furthestPhase: PHASES.indexOf('recruiting'),
    });

    expect(file.phase).toBe('coach');
    expect(file.furthestPhase).toBe(PHASES.indexOf('recruiting'));
    expect(file.furthestPhase as number).toBeGreaterThan(PHASES.indexOf('draft'));
  });
});
