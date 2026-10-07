// nav-trail.test.ts
// The route trail in the store, written by intent (back-plan package T,
// 2026-09-30): `go` and `setScreen` record the route they leave, `goBack`
// takes this era's newest stop, `leaveGame` steps out of a managed game,
// `stepBack` walks the offseason rail, and the team card lives in the store.
// Nothing reads the trail for history yet; these pin what it records.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useDynasty, PHASES, railSteps, stepStops, eraStops, lineupHolds, type DynastyStore,
} from '../src/state/store.js';
import { setEraReset, storeLayerIds } from '../src/state/era.js';
import { buildSaveFile } from '../src/state/persistence.js';
import { newestStoreLayer, resetBackLayers } from '../src/state/backLayers.js';

const S = (): DynastyStore => useDynasty.getState();
const route = (): string => `${S().tab}|${S().screen}`;
const trail = (): string[] => S().navTrail.map((x) => `${x.tab}|${x.screen}`);

/** A `document` whose view transition never calls back (backNav.test.ts). */
function stubDocument(): void {
  (globalThis as { document?: unknown }).document = {
    documentElement: { dataset: {} as Record<string, string | undefined> },
    startViewTransition: (): unknown => ({ finished: Promise.resolve() }),
  };
}
const dropDocument = (): void => { delete (globalThis as { document?: unknown }).document; };

/** A nine with one position twice, which the lineup gate holds. */
function breakTheNine(): void {
  const s = S();
  const nine = s.season!.teams[s.userTeam]!.team.lineup;
  nine[1]!.pos = nine[0]!.pos;
}

beforeEach(() => {
  dropDocument();
  setEraReset(false);
  S().start(4242, 0);
  useDynasty.setState({
    tab: 'home', screen: 'today', phase: null, bracket: null, jobSearch: false, live: null,
    overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, godStack: [],
    navTrail: [], restoringVisit: null, stepBase: null, teamCard: null,
  });
  resetBackLayers();
});
afterEach(() => { dropDocument(); setEraReset(false); });

describe('what go and setScreen record', () => {
  it('records the route left on a real move, with its visit and era', () => {
    const v0 = S().routeVisit;
    S().go('team');
    expect(route()).toBe('team|roster');
    expect(trail()).toEqual(['home|today']);
    expect(S().navTrail[0]!.visit).toBe(v0);
    expect(S().navTrail[0]!.era.startsWith('season|')).toBe(true);
    expect(S().routeVisit).toBeGreaterThan(v0);
    const v1 = S().routeVisit;
    S().setScreen('stats');
    expect(route()).toBe('team|stats');
    expect(trail()).toEqual(['home|today', 'team|roster']);
    expect(S().navTrail[1]!.visit).toBe(v1);
    expect(S().routeVisit).toBeGreaterThan(v1);
  });

  it('records nothing when the route does not move', () => {
    S().go('team', 'roster');
    const v = S().routeVisit;
    S().go('team', 'roster');
    S().setScreen('roster');
    expect(trail()).toEqual(['home|today']);
    expect(S().routeVisit).toBe(v);
  });

  it('keeps setScreen synchronous and the version still', () => {
    const version = S().version;
    S().setScreen('wire');
    expect(route()).toBe('home|wire');
    expect(S().version).toBe(version);
  });

  it('records nothing outside the nav frames', () => {
    useDynasty.setState({ phase: 'awards' });
    const v = S().routeVisit;
    S().go('team');
    S().setScreen('stats');
    expect(S().navTrail).toEqual([]);
    expect(S().routeVisit).toBe(v);
  });

  it('never records the game, going in or coming out', () => {
    S().go('team');
    useDynasty.setState({ live: {} as never, tab: 'home', screen: 'box' });
    const v = S().routeVisit;
    S().go('home');
    expect(route()).toBe('home|today');
    expect(trail()).toEqual(['home|today']);
    expect(S().routeVisit).toBeGreaterThan(v);
    S().go('team', 'stats');
    S().go('home', 'box');
    expect(trail()).toEqual(['home|today', 'home|today']);
  });

  it('treats June Home as one route', () => {
    useDynasty.setState({ bracket: {} as never });
    const v = S().routeVisit;
    S().setScreen('wire');
    expect(S().navTrail).toEqual([]);
    expect(S().routeVisit).toBe(v);
    S().go('team');
    expect(trail()).toEqual(['home|wire']);
    expect(S().navTrail[0]!.era.startsWith('june|')).toBe(true);
  });
});

describe('a navigation whose animation is dropped or overtaken', () => {
  it('records only the move that ran', async () => {
    stubDocument();
    S().go('team');
    // The capture is live and nothing has run: no stop yet.
    expect(route()).toBe('home|today');
    expect(S().navTrail).toEqual([]);
    const epoch = S().navEpoch;
    S().go('program');
    expect(route()).toBe('program|records');
    expect(trail()).toEqual(['home|today']);
    expect(S().navEpoch).toBe(epoch + 1);
    await new Promise((r) => setTimeout(r, 250));
    expect(route()).toBe('program|records');
    expect(trail()).toEqual(['home|today']);
  });

  // A back press inside the capture drops the waiting move, as a newer go does.
  it('stays where goBack put it', async () => {
    S().go('team');
    stubDocument();
    S().go('program');
    expect(route()).toBe('team|roster');
    expect(S().goBack()).toBe('peeled');
    await new Promise((r) => setTimeout(r, 250));
    expect(route()).toBe('home|today');
    expect(S().navTrail).toEqual([]);
  });

  it('stays where leaveGame put it', async () => {
    useDynasty.setState({ live: {} as never, tab: 'home', screen: 'box' });
    stubDocument();
    S().go('team');
    expect(S().leaveGame()).toBe('peeled');
    await new Promise((r) => setTimeout(r, 250));
    expect(route()).toBe('home|today');
  });

  it('stays where stepBack put it', async () => {
    useDynasty.setState({ phase: 'draft', stepBase: 'review', furthestPhase: PHASES.length - 1 });
    stubDocument();
    S().go('team');
    expect(S().stepBack()).toBe('peeled');
    const at = route();
    await new Promise((r) => setTimeout(r, 250));
    expect(S().phase).toBe('coach');
    expect(route()).toBe(at);
  });
});

describe('goBack', () => {
  it("takes this era's newest stop and marks the visit it restores", () => {
    S().go('team');
    const teamVisit = S().routeVisit;
    S().setScreen('stats');
    const epoch = S().navEpoch;
    useDynasty.setState({ selectedPlayer: 'p1' as never, focusPlayer: 'p1' as never });
    expect(S().goBack()).toBe('peeled');
    expect(route()).toBe('team|roster');
    expect(S().routeVisit).toBe(teamVisit);
    expect(S().restoringVisit).toBe(teamVisit);
    expect(S().selectedPlayer).toBeNull();
    expect(S().focusPlayer).toBeNull();
    expect(S().navEpoch).toBe(epoch + 1);
    expect(trail()).toEqual(['home|today']);
    expect(S().goBack()).toBe('peeled');
    expect(route()).toBe('home|today');
    expect(S().goBack()).toBe('none');
    // A forward move ends the restore.
    S().go('office');
    expect(S().restoringVisit).toBeNull();
  });

  it('walks only the era it is in', () => {
    S().go('team');
    S().setScreen('stats');
    const year = S().year;
    useDynasty.setState({ year: year + 1 });
    expect(eraStops(S())).toEqual([]);
    expect(S().goBack()).toBe('none');
    expect(route()).toBe('team|stats');
    // Old stops stay in the trail, unwalked; the cap is per era.
    expect(S().navTrail).toHaveLength(2);
    S().setScreen('lineup');
    expect(eraStops(S()).map((x) => `${x.tab}|${x.screen}`)).toEqual(['team|stats']);
    expect(S().goBack()).toBe('peeled');
    expect(route()).toBe('team|stats');
    expect(S().navTrail).toHaveLength(2);
  });

  it('is refused on a broken nine: the pickbar shakes and nothing moves', () => {
    S().go('team', 'lineup');
    breakTheNine();
    expect(lineupHolds(S())).toBe(true);
    const { cardNudge, lineupGate } = S();
    expect(S().goBack()).toBe('refused');
    expect(S().cardNudge).toBe(cardNudge + 1);
    expect(S().lineupGate).toBe(lineupGate);
    expect(route()).toBe('team|lineup');
    expect(trail()).toEqual(['home|today']);
    // The same read holds the front doors.
    S().go('home');
    S().setScreen('stats');
    S().openOverlay('inbox');
    expect(route()).toBe('team|lineup');
    expect(S().overlay).toBeNull();
    expect(S().lineupGate).toBe(lineupGate + 3);
  });
});

describe('leaveGame', () => {
  it('steps out of a managed season game to Today, and only there', () => {
    expect(S().leaveGame()).toBe('none');
    useDynasty.setState({ live: {} as never, tab: 'home', screen: 'box' });
    expect(S().leaveGame()).toBe('peeled');
    expect(route()).toBe('home|today');
    expect(S().live).not.toBeNull();
    expect(S().navTrail).toEqual([]);
    expect(S().leaveGame()).toBe('none');
    // A June game is not left this way.
    useDynasty.setState({ bracket: {} as never, screen: 'box' });
    expect(S().leaveGame()).toBe('none');
  });
});

describe('stepBack', () => {
  const winter = (phase: DynastyStore['phase'], stepBase: DynastyStore['phase']): void =>
    useDynasty.setState({ phase, stepBase, furthestPhase: PHASES.length - 1 });

  it('walks the rail back to the step the era began at', () => {
    winter('draft', 'review');
    expect(stepStops(S())).toEqual(['coach', 'draft']);
    expect(S().stepBack()).toBe('peeled');
    expect(S().phase).toBe('coach');
    expect(S().stepBack()).toBe('peeled');
    expect(S().phase).toBe('review');
    expect(S().stepBack()).toBe('none');
    expect(S().phase).toBe('review');
  });

  it('does nothing outside the winter', () => {
    expect(stepStops(S())).toEqual([]);
    expect(S().stepBack()).toBe('none');
  });

  it('lowers the base when a rail tap goes below it', () => {
    winter('draft', 'draft');
    expect(S().stepBack()).toBe('none');
    S().goPhase('coach');
    expect(S().stepBase).toBe('coach');
    // Back cannot walk forward into the step the tap left.
    expect(stepStops(S())).toEqual([]);
    expect(S().stepBack()).toBe('none');
  });

  it('stops the rail at the review once he has resigned or his career ends', () => {
    const full = railSteps(S());
    expect(full.length).toBeGreaterThan(2);
    useDynasty.setState({ coach: { ...S().coach, resignYear: S().year } });
    expect(railSteps(S())).toEqual(['awards', 'review']);
    winter('review', 'awards');
    expect(S().stepBack()).toBe('peeled');
    expect(S().phase).toBe('awards');
    expect(S().stepBack()).toBe('none');
    useDynasty.setState({ coach: { ...S().coach, resignYear: undefined, farewellYear: S().year } });
    expect(railSteps(S())).toEqual(['awards', 'review']);
  });

  it('starts at the step the era opened on, once the era reset is on', () => {
    setEraReset(true);
    useDynasty.setState({ phase: 'review', furthestPhase: PHASES.length - 1 });
    expect(S().stepBase).toBe('review');
    expect(S().navTrail).toEqual([]);
    expect(S().stepBack()).toBe('none');
  });
});

describe('the team card in the store', () => {
  it('is a store layer of its own, closed by a move of route or phase', () => {
    S().openTeamCard(3);
    expect(S().teamCard).toBe(3);
    expect(storeLayerIds(S())).toEqual(['t:3']);
    expect(newestStoreLayer()).toBeGreaterThan(0);
    S().go('team');
    expect(S().teamCard).toBeNull();
    expect(newestStoreLayer()).toBe(0);

    S().openTeamCard(2);
    S().setScreen('stats');
    expect(S().teamCard).toBeNull();

    S().openTeamCard(2);
    useDynasty.setState({ phase: 'awards' });
    expect(S().teamCard).toBeNull();

    // A write that names it keeps it.
    useDynasty.setState({ phase: null, teamCard: 5 });
    expect(S().teamCard).toBe(5);
    S().closeTeamCard();
    expect(S().teamCard).toBeNull();
  });

  it('is dropped with the rest of an old era once the reset is on', () => {
    setEraReset(true);
    S().go('team');
    S().openTeamCard(4);
    const v = S().routeVisit;
    useDynasty.setState({ year: S().year + 1 });
    expect(S().teamCard).toBeNull();
    expect(S().navTrail).toEqual([]);
    expect(S().routeVisit).toBeGreaterThan(v);
    expect(route()).toBe('home|today');
  });
});

describe('the save file', () => {
  it('carries none of the nav fields', () => {
    S().go('team');
    S().openTeamCard(1);
    const s = S();
    const file = buildSaveFile('auto', 'A', s.season!, s.year, s.userTeam, s as never) as unknown as Record<string, unknown>;
    for (const k of ['navTrail', 'routeVisit', 'restoringVisit', 'stepBase', 'teamCard']) {
      expect(k in file, k).toBe(false);
    }
  });
});

describe('the trail is bounded, the Android way (audit 17, M45)', () => {
  it('a bottom-tab tap leaves only Home under the area, and Home under nothing', () => {
    S().go('team');
    S().setScreen('stats');
    S().setScreen('lineup');
    expect(trail()).toEqual(['home|today', 'team|roster', 'team|stats']);
    S().go('office');
    expect(trail()).toEqual(['home|today']);
    S().go('program');
    expect(trail()).toEqual(['home|today']);
    expect(S().goBack()).toBe('peeled');
    expect(route()).toBe('home|today');
    expect(S().goBack()).toBe('none');
    S().go('team');
    S().go('home');
    expect(trail()).toEqual([]);
  });

  it('back from Home exits after any amount of wandering', () => {
    for (let i = 0; i < 30; i++) { S().go('team'); S().go('office'); S().go('home'); }
    expect(trail()).toEqual([]);
    expect(S().goBack()).toBe('none');
  });

  it('a screen visited again is the visit already in the trail, with no loop added', () => {
    S().go('team');
    S().setScreen('stats');
    const statsVisit = S().routeVisit;
    S().setScreen('lineup');
    S().setScreen('stats');
    expect(trail()).toEqual(['home|today', 'team|roster']);
    expect(S().routeVisit).toBe(statsVisit);
    expect(S().restoringVisit).toBe(statsVisit);
  });

  it('never holds more than TRAIL_CAP stops in an era', async () => {
    const { TRAIL_CAP } = await import('../src/state/store.js');
    expect(TRAIL_CAP).toBe(20);
    S().go('team');
    const screens = ['stats', 'lineup', 'stand', 'strategy'];
    for (let i = 0; i < 50; i++) S().setScreen(screens[i % screens.length]!);
    expect(eraStops(S()).length).toBeLessThanOrEqual(TRAIL_CAP);
  });
});

describe('a first-visit tip is a back layer (audit 17, M44)', () => {
  it('registers with the back gesture, so back closes the tip and not the screen', async () => {
    const { readFileSync } = await import('node:fs');
    const tip = readFileSync('src/ui/Tutorial.tsx', 'utf8');
    expect(tip).toContain('useDialogFocus(dialog, close, { initial: primary, active: show && frame !== null });');
    expect(tip).not.toContain('layer: false');
  });
});
