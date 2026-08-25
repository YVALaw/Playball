// achievements.test.ts
// Ten things a coach can only do once, and the notice board that reports them.
//
// The failure mode these guard against is not a crash. It is an achievement that
// fires for the wrong thing — which looks like a generous bug the first time and
// like a game with no standards by the fifth. So every case below is a pair: the
// thing it names earns it, and the near miss beside it does not.

import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS, ACHIEVEMENT_IDS, CINDERELLA_STARS,
  IRON_WILL_DEFICIT, LIFER_SEASONS, STREAK_WINS,
  award, awardFirstOverall, awardSeason, awardTopRecruit,
  largestDeficit, noFeats, noteGame, restoreAchievements,
  type AchievementId, type AchievementLog, type SeasonFacts,
} from '../src/engine/achievements.js';
import {
  INBOX_LIMIT, markAllRead, newItem, push, restoreInbox, resetInboxIds,
  unreadCount, type InboxItem,
} from '../src/engine/inbox.js';

/** A season that earns nothing. Every test below turns exactly one thing on. */
const plain = (over: Partial<SeasonFacts> = {}): SeasonFacts => ({
  year: 2030,
  team: 'RID',
  conference: 'GULF',
  conferenceWins: 18,
  conferenceLosses: 15,
  wonConference: false,
  wonRegional: false,
  wonTitle: false,
  titleLastYear: false,
  stars: 3,
  arrivedStars: 3,
  tenure: 4,
  feats: noFeats(),
  ...over,
});

const got = (over: Partial<SeasonFacts>): AchievementId[] =>
  awardSeason({}, plain(over));

describe('the cabinet', () => {
  it('starts empty and every id has a name and a requirement', () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(10);
    for (const id of ACHIEVEMENT_IDS) {
      expect(ACHIEVEMENTS[id].name.length).toBeGreaterThan(0);
      expect(ACHIEVEMENTS[id].note.length).toBeGreaterThan(0);
    }
  });

  it('keeps the first time and never the second', () => {
    // The whole difference from the record book next door. A mark is beaten; an
    // achievement is not a quantity and has nothing to beat, so a later one is
    // not a candidate at all.
    const log: AchievementLog = {};
    expect(award(log, 'dynasty', { year: 2031, team: 'RID' })).toBe(true);
    expect(award(log, 'dynasty', { year: 2035, team: 'TEX' })).toBe(false);
    expect(log.dynasty?.year).toBe(2031);
    expect(log.dynasty?.team).toBe('RID');
  });

  it('reports only what was newly earned', () => {
    const log: AchievementLog = {};
    const facts = plain({ tenure: LIFER_SEASONS });
    expect(awardSeason(log, facts)).toEqual(['lifer']);
    // The sixteenth season is still fifteen years at one school and must not
    // announce itself again.
    expect(awardSeason(log, { ...facts, tenure: LIFER_SEASONS + 1 })).toEqual([]);
  });
});

describe('each one is earned by the thing it names', () => {
  it('Perfect Conference: undefeated in league play, and not merely good at it', () => {
    expect(got({ conferenceWins: 33, conferenceLosses: 0 })).toContain('perfectConference');
    expect(got({ conferenceWins: 32, conferenceLosses: 1 })).not.toContain('perfectConference');
    // Nobody has gone undefeated in league play by playing none of it.
    expect(got({ conferenceWins: 0, conferenceLosses: 0 })).not.toContain('perfectConference');
  });

  it('Cinderella: the title at a small program, and not at a big one', () => {
    expect(got({ wonTitle: true, stars: CINDERELLA_STARS })).toContain('cinderella');
    expect(got({ wonTitle: true, stars: CINDERELLA_STARS + 1 })).not.toContain('cinderella');
    // Being small is not the achievement.
    expect(got({ wonTitle: false, stars: 1 })).not.toContain('cinderella');
  });

  it('Dynasty: back to back, and not one on its own', () => {
    expect(got({ wonTitle: true, titleLastYear: true })).toContain('dynasty');
    expect(got({ wonTitle: true, titleLastYear: false })).not.toContain('dynasty');
    expect(got({ wonTitle: false, titleLastYear: true })).not.toContain('dynasty');
  });

  it('Grand Slam: all three in one season, and not two of them', () => {
    const all = { wonConference: true, wonRegional: true, wonTitle: true };
    expect(got(all)).toContain('grandSlam');
    expect(got({ ...all, wonConference: false })).not.toContain('grandSlam');
    expect(got({ ...all, wonRegional: false })).not.toContain('grandSlam');
    expect(got({ ...all, wonTitle: false })).not.toContain('grandSlam');
  });

  it('Lifer: fifteen at one school, not fourteen', () => {
    expect(got({ tenure: LIFER_SEASONS })).toContain('lifer');
    expect(got({ tenure: LIFER_SEASONS - 1 })).not.toContain('lifer');
  });

  it('Builder: one star to five, at the school he started at', () => {
    expect(got({ arrivedStars: 1, stars: 5 })).toContain('builder');
    // Four is not five, and two was not one.
    expect(got({ arrivedStars: 1, stars: 4 })).not.toContain('builder');
    expect(got({ arrivedStars: 2, stars: 5 })).not.toContain('builder');
    // Inheriting a five star program builds nothing. `arrivedStars` is reset
    // every time he takes a chair, which is what makes this test the real rule
    // rather than a restatement of the comparison above it.
    expect(got({ arrivedStars: 5, stars: 5 })).not.toContain('builder');
  });

  it('Iron Will: six down and won, not five', () => {
    expect(got({ feats: { comeback: IRON_WILL_DEFICIT, streak: 0 } })).toContain('ironWill');
    expect(got({ feats: { comeback: IRON_WILL_DEFICIT - 1, streak: 0 } }))
      .not.toContain('ironWill');
  });

  it('Streak: twenty straight, not nineteen', () => {
    expect(got({ feats: { comeback: 0, streak: STREAK_WINS } })).toContain('streak');
    expect(got({ feats: { comeback: 0, streak: STREAK_WINS - 1 } })).not.toContain('streak');
  });

  it('Kingmaker and Recruiter are one-time the same way', () => {
    const log: AchievementLog = {};
    expect(awardFirstOverall(log, 2030, 'RID', 'Cole Marsh')).toEqual(['kingmaker']);
    expect(awardFirstOverall(log, 2031, 'RID', 'Dane Alvarez')).toEqual([]);
    expect(log.kingmaker?.detail).toBe('Cole Marsh');

    expect(awardTopRecruit(log, 2030, 'RID', 'Rey Sutton')).toEqual(['recruiter']);
    expect(awardTopRecruit(log, 2032, 'RID', 'Jon Pike')).toEqual([]);
  });

  it('does nothing at all for an ordinary season', () => {
    expect(awardSeason({}, plain())).toEqual([]);
  });
});

describe('the evidence only a game can leave', () => {
  it('reads the biggest deficit off the scoreboard, half inning by half inning', () => {
    // Away side bats first. Down 0-7 after the top of the first, and he wins.
    const mine = [0, 3, 0, 5, 1];
    const theirs = [7, 0, 0, 0, 0];
    expect(largestDeficit(mine, theirs, true)).toBe(7);
  });

  it('counts a lead answered inside the same inning, which a whole-inning read misses', () => {
    // Seven in the top, eight in the bottom. On whole innings he was never
    // behind; he plainly was, by seven, while he was batting.
    expect(largestDeficit([8], [7], true)).toBe(7);
  });

  it('measures the away side against the same scoreboard', () => {
    // He is the away team: he bats first, so a deficit only exists after the
    // home half. Two in the first, four back in the bottom.
    expect(largestDeficit([2, 6], [4, 0], false)).toBe(2);
  });

  it('survives the home half that is never played', () => {
    // The home side is ahead, so the bottom of the last is skipped and the two
    // line scores differ in length.
    expect(largestDeficit([0, 0, 4], [3, 0], true)).toBe(3);
  });

  it('keeps the best of the year and ignores losses', () => {
    const feats = noFeats();
    noteGame(feats, true, 4, 3);
    noteGame(feats, true, 9, 1);
    // A loss carries no evidence: the streak on it is not his and the deficit
    // is one he did not come back from.
    noteGame(feats, false, 40, 40);
    expect(feats.streak).toBe(9);
    expect(feats.comeback).toBe(3);
  });
});

describe('a cabinet off the disk', () => {
  it('drops a row that is not one of ours and keeps one that is', () => {
    const restored = restoreAchievements({
      lifer: { year: 2040, team: 'RID', detail: '15 seasons' },
      // A key from a build that named things differently.
      ironFist: { year: 2041, team: 'RID' },
      // A row with the wrong shape, which would reach the screen as a hole.
      dynasty: { year: 'twenty forty', team: 'RID' },
    });
    expect(restored.lifer?.year).toBe(2040);
    expect(restored.dynasty).toBeUndefined();
    expect(Object.keys(restored)).toEqual(['lifer']);
  });

  it('gives a career that predates the ledger an empty one rather than a hole', () => {
    expect(restoreAchievements(undefined)).toEqual({});
    expect(restoreAchievements('nonsense')).toEqual({});
  });
});

describe('the inbox', () => {
  const item = (year: number, title: string): InboxItem =>
    newItem({ year, kind: 'board', title, body: '' });

  it('keeps the newest first and stops growing', () => {
    let box: InboxItem[] = [];
    for (let i = 0; i < INBOX_LIMIT + 20; i++) box = push(box, item(2030, `n${i}`));
    expect(box).toHaveLength(INBOX_LIMIT);
    expect(box[0]?.title).toBe(`n${INBOX_LIMIT + 19}`);
  });

  it('counts what is unread and clears it in one go', () => {
    const box = push(push([], item(2030, 'a')), item(2030, 'b'));
    expect(unreadCount(box)).toBe(2);
    const read = markAllRead(box);
    expect(unreadCount(read)).toBe(0);
    // And the original is untouched, because the store swaps the array rather
    // than mutating one React is already rendering.
    expect(unreadCount(box)).toBe(2);
  });

  it('never hands out an id a restored card is already using', () => {
    // The bug this guards is invisible until it happens: two cards with the
    // same React key make the list reorder itself on the next render.
    resetInboxIds();
    const before = [item(2030, 'a'), item(2030, 'b'), item(2030, 'c')];
    const saved = JSON.parse(JSON.stringify(before)) as unknown;
    resetInboxIds();
    const restored = restoreInbox(saved);
    const next = item(2031, 'd');
    expect(restored.map((i) => i.id)).not.toContain(next.id);
  });

  it('drops a malformed card and keeps the read flag on a good one', () => {
    const restored = restoreInbox([
      { id: '2030-1', year: 2030, kind: 'board', title: 'Kept', body: '', read: true },
      { id: '2030-2', year: 2030, kind: 'not-a-kind', title: 'Dropped', body: '' },
      { id: '2030-3', year: 2030, title: 'No kind at all' },
      'nonsense',
    ]);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.read).toBe(true);
  });
});
