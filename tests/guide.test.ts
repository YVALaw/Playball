// The guided first stretch's pure half: which step is live, which one shows,
// and when a step is over. The DOM half is exercised by hand in the pane;
// this pins the derivation the save relies on.

import { describe, expect, it } from 'vitest';
import {
  GUIDE_STEPS, activeGuideStep, dueGuideStamps, guideCard, guideSkipStamps, guideStamp,
  visibleGuideStep, guideStepStamps, type GuideView,
} from '../src/ui/guide.js';

const at = (over: Partial<GuideView> = {}, present: string[] = []): GuideView => ({
  tab: 'home', screen: 'today', overlay: null, programSheet: 'overview',
  live: false, inning: 0, half: 'top', batting: false, over: false, pending: false,
  playerOpen: false, wordGuide: false, wordSeen: false,
  hittingHired: false, hittingDirective: 'balanced', cageLevel: 0,
  playedSinceLit: false, lineupChanged: false, positionsChanged: false,
  has: (name) => present.includes(name),
  ...over,
});

const by = Object.fromEntries(GUIDE_STEPS.map((s) => [s.id, s]));
const mains = GUIDE_STEPS.filter((s) => !s.aside);

describe('the guided first stretch', () => {
  it('starts at the welcome on a new career and walks the main steps in order', () => {
    expect(activeGuideStep([], true, true)?.id).toBe('welcome');
    const seen: string[] = [];
    for (const step of mains) {
      expect(activeGuideStep(seen, true, true)?.id).toBe(step.id);
      seen.push(guideStamp(step.id));
    }
    expect(activeGuideStep(seen, true, true)).toBeNull();
  });

  it('never waits on an aside', () => {
    const seen = [guideStamp('welcome')];
    // The word errand is unstamped, and the tour is already on the field.
    expect(activeGuideStep(seen, true, true)?.id).toBe('field-1');
  });

  it('never starts for a save that met TODAY before the tour existed', () => {
    expect(activeGuideStep(['today', 'roster'], true, true)).toBeNull();
    // But a career that began on the tour keeps it through its own stamps.
    expect(activeGuideStep([guideStamp('welcome'), 'today'], true, true)?.id).toBe('field-1');
  });

  it('is a first-season thing, and respects the tutorials switch', () => {
    expect(activeGuideStep([], false, true)).toBeNull();
    expect(activeGuideStep([], true, false)).toBeNull();
  });

  it('SKIP stamps every step and every card a step stood in for', () => {
    const stamps = guideSkipStamps();
    for (const s of GUIDE_STEPS) expect(stamps).toContain(guideStamp(s.id));
    for (const c of ['today', 'manage', 'program', 'roster', 'lineup', 'coach']) expect(stamps).toContain(c);
    expect(activeGuideStep(stamps, true, true)).toBeNull();
  });

  it('shows the word errand over the welcome while a failing man is open', () => {
    const welcome = by.welcome!;
    const onCard = at({ playerOpen: true, wordGuide: true });
    expect(visibleGuideStep([], welcome, onCard)?.id).toBe('word');
    // The word had: the way back, then the welcome's own light again.
    const afterWord = at({ playerOpen: true, wordSeen: true });
    expect(visibleGuideStep([guideStamp('word')], welcome, afterWord)?.id).toBe('word-back');
    expect(visibleGuideStep([guideStamp('word'), guideStamp('word-back')], welcome, at())?.id).toBe('welcome');
    // And the welcome never draws over an open card.
    expect(welcome.where(at({ playerOpen: true }))).toBe(false);
  });

  it('stamps a done aside and the current step together', () => {
    const welcome = by.welcome!;
    // No word had: the asides are not stamped away behind the player's back.
    expect(dueGuideStamps([], welcome, at({ live: true, screen: 'box' })))
      .toEqual([guideStamp('welcome'), 'today']);
    expect(dueGuideStamps([], welcome, at())).toEqual([]);
    // The word had and the card closed: both asides are over with the step.
    const v = at({ live: true, screen: 'box', wordSeen: true });
    expect(dueGuideStamps([], welcome, v))
      .toEqual([guideStamp('welcome'), 'today', guideStamp('word'), guideStamp('word-back')]);
    expect(dueGuideStamps([guideStamp('word')], welcome, v))
      .toEqual([guideStamp('welcome'), 'today', guideStamp('word-back')]);
    // The word had with the card still open: the way back is still owed.
    expect(dueGuideStamps([guideStamp('word')], welcome, at({ playerOpen: true, wordSeen: true }))).toEqual([]);
  });

  it('teaches the field in the first inning, one call per half, and the dugout from the second', () => {
    const calls = ['call-default'];
    expect(by['field-1']!.where(at({ live: true, screen: 'box', inning: 1, half: 'top' }, calls))).toBe(true);
    expect(by['field-1']!.where(at({ live: true, screen: 'box', inning: 1, half: 'top' }))).toBe(false);
    expect(by['field-2']!.where(at({ live: true, screen: 'box', inning: 1, half: 'bottom' }, calls))).toBe(true);
    expect(by['field-1']!.done!(at({ playedSinceLit: true }))).toBe(true);
    expect(by.dugout!.where(at({ live: true, screen: 'box', inning: 1 }))).toBe(false);
    expect(by.dugout!.where(at({ live: true, screen: 'box', inning: 2 }))).toBe(true);
    expect(by.dugout!.done!(at({ live: true, over: true }))).toBe(true);
    expect(by.record!.where(at({ live: true, screen: 'box', over: true }))).toBe(true);
    // A game a phone call interrupted is not a game that was recorded.
    expect(by.record!.done!(at({ live: false, pending: true }))).toBe(false);
    expect(by.record!.done!(at({ live: false }))).toBe(true);
  });

  it('says whose call it is', () => {
    const v = at({ live: true, screen: 'box', inning: 1, half: 'top' }, ['call-default']);
    expect(guideCard(by['field-1']!, { ...v, batting: true }).title).toBe('Your call');
    expect(guideCard(by['field-1']!, { ...v, batting: false }).title).toBe('Your pitch');
  });

  it('walks the budget: staff, the hire, the directive, the barn — and gives up honestly', () => {
    const money = { tab: 'program' as const, screen: 'records', programSheet: 'money' as const };
    expect(by.staff!.where(at(money, ['money-staff']))).toBe(true);
    expect(by.staff!.done!(at(money, ['seat-hitting']))).toBe(true);
    expect(by.hire!.done!(at({ ...money, hittingHired: true }))).toBe(true);
    expect(by.hire!.done!(at(money, ['hire-blocked']))).toBe(true);
    expect(by.hire!.done!(at(money, ['staff-delegated']))).toBe(true);
    expect(by.hire!.done!(at(money))).toBe(false);
    expect(by.task!.where(at({ ...money, hittingHired: true }, ['directive']))).toBe(true);
    expect(by.task!.done!(at({ ...money, hittingHired: true, hittingDirective: 'power' }))).toBe(true);
    expect(by.task!.done!(at({ ...money, hittingHired: true }))).toBe(false);
    expect(by.build!.done!(at({ ...money, cageLevel: 1 }))).toBe(true);
    expect(by.build!.done!(at(money, ['facility-blocked']))).toBe(true);
    expect(by.build!.done!(at(money))).toBe(false);
  });

  it('teaches the lineup by the order and the positions actually changing', () => {
    const lineup = { tab: 'team' as const, screen: 'lineup' };
    expect(by['lineup-swap']!.where(at(lineup))).toBe(true);
    expect(by['lineup-swap']!.done!(at({ ...lineup, lineupChanged: true }))).toBe(true);
    expect(by['lineup-swap']!.done!(at(lineup))).toBe(false);
    expect(by['lineup-spot']!.done!(at({ ...lineup, positionsChanged: true }))).toBe(true);
  });

  it('keeps its cards off the field and out from under overlays', () => {
    for (const s of GUIDE_STEPS) {
      if (s.id.startsWith('field') || s.id === 'dugout' || s.id === 'record') continue;
      expect(s.where(at({ live: true, screen: 'box', inning: 3 }, ['call-default']))).toBe(false);
    }
    for (const s of GUIDE_STEPS) {
      if (s.id === 'done') continue;
      expect(s.where(at({ overlay: 'inbox' }))).toBe(false);
    }
  });

  it('continues from the dugout when a resumed game has passed the first inning', () => {
    const seen = [guideStamp('welcome')];
    const view = at({ live: true, screen: 'box', inning: 4 }, ['call-default']);
    for (const id of ['field-1', 'field-2']) {
      const step = activeGuideStep(seen, true, true)!;
      expect(step.id).toBe(id);
      seen.push(...dueGuideStamps(seen, step, view));
    }
    const next = activeGuideStep(seen, true, true)!;
    expect(next.id).toBe('dugout');
    expect(visibleGuideStep(seen, next, view)?.id).toBe('dugout');
  });

  it('still teaches the bottom half when only the top-half lesson was missed', () => {
    const view = at({ live: true, screen: 'box', inning: 1, half: 'bottom' }, ['call-default']);
    expect(dueGuideStamps([], by['field-1']!, view)).toContain(guideStamp('field-1'));
    expect(dueGuideStamps([], by['field-2']!, view)).not.toContain(guideStamp('field-2'));
    expect(by['field-2']!.where(view)).toBe(true);
  });

  it('does not strand the tour after the first game was already recorded', () => {
    const view = at({ gamesPlayed: 1 });
    for (const id of ['field-1', 'field-2', 'dugout', 'record']) {
      expect(dueGuideStamps([], by[id]!, view)).toContain(guideStamp(id));
    }
    // A new career and an interrupted game still need their game lessons.
    expect(by['field-1']!.done!(at())).toBe(false);
    expect(by['field-1']!.done!(at({ gamesPlayed: 1, pending: true }))).toBe(false);
  });

  it('does not skip a new live game merely because older games exist', () => {
    const view = at({ live: true, screen: 'box', gamesPlayed: 7, inning: 1, half: 'top' }, ['call-default']);
    expect(by['field-1']!.done!(view)).toBe(false);
    expect(by['field-1']!.where(view)).toBe(true);
  });

  it('moves past the directive lesson when no coach was hired', () => {
    const seen = mains.slice(0, mains.findIndex((s) => s.id === 'hire')).map((s) => guideStamp(s.id));
    seen.push(...guideStepStamps(by.hire!));
    const current = activeGuideStep(seen, true, true)!;
    expect(current.id).toBe('task');
    seen.push(...dueGuideStamps(seen, current, at({ hittingHired: false })));
    expect(activeGuideStep(seen, true, true)?.id).toBe('facilities');
  });

  it('skips only one lineup exercise and keeps the next lesson available', () => {
    const seen = mains.slice(0, mains.findIndex((s) => s.id === 'lineup-swap')).map((s) => guideStamp(s.id));
    seen.push(...guideStepStamps(by['lineup-swap']!));
    expect(activeGuideStep(seen, true, true)?.id).toBe('lineup-spot');
    expect(seen).not.toContain(guideStamp('done'));
  });
});
