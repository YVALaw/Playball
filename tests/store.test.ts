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
