// era.test.ts
// Which frame the game is in, the era it belongs to, and the store middleware
// that stamps store layers and (once the switch turns it on) closes an old
// era's layers in the write that ends it (back-plan package E, 2026-09-30).

// era.ts first, on purpose: it must load before the store without a cycle.
import { frameOf, eraKey, storeLayerIds, setEraReset } from '../src/state/era.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDynasty, type DynastyStore } from '../src/state/store.js';
import { newestStoreLayer, registerBackLayer, resetBackLayers, topBackLayer } from '../src/state/backLayers.js';

type S = Parameters<typeof eraKey>[0];
const st = (over: Record<string, unknown> = {}): S => ({
  atStart: false, season: { teams: [{}, {}] }, needsTeam: false, coach: {}, jobSearch: false,
  userTeam: 0, bracket: null, phase: null, loadedSlot: null, year: 2027, ...over,
}) as unknown as S;

describe('frameOf', () => {
  it('answers every frame, in order', () => {
    expect(frameOf(st({ season: null, atStart: true }))).toBe('front');
    expect(frameOf(st({ season: null, needsTeam: true }))).toBe('front');
    expect(frameOf(st({ season: null }))).toBe('loading');
    expect(frameOf(st({ userTeam: 7 }))).toBe('loading');
    expect(frameOf(st({ coach: { retiredYear: 2027 } }))).toBe('legacy');
    expect(frameOf(st({ jobSearch: true }))).toBe('market');
    expect(frameOf(st({ bracket: { stage: 'x' } }))).toBe('june');
    expect(frameOf(st({ phase: 'awards' }))).toBe('winter');
    expect(frameOf(st())).toBe('season');
  });

  it('puts retirement before the market and June before the winter', () => {
    expect(frameOf(st({ coach: { retiredYear: 2027 }, jobSearch: true }))).toBe('legacy');
    expect(frameOf(st({ bracket: { stage: 'x' }, phase: 'awards' }))).toBe('june');
    // A career in hand is not the front door, whatever the flags say.
    expect(frameOf(st({ atStart: true, needsTeam: true }))).toBe('season');
  });

  it('keeps a resigner in the winter until the year roll opens the market', () => {
    expect(frameOf(st({ coach: { resignYear: 2027 }, phase: 'review' }))).toBe('winter');
    expect(frameOf(st({ coach: { resignYear: 2027 }, phase: null, jobSearch: true }))).toBe('market');
  });
});

describe('eraKey', () => {
  it('changes with the frame, the slot, the school and the year', () => {
    const k = eraKey(st());
    expect(eraKey(st())).toBe(k);
    expect(eraKey(st({ phase: 'awards' }))).not.toBe(k);
    expect(eraKey(st({ loadedSlot: 'b' }))).not.toBe(k);
    expect(eraKey(st({ userTeam: 1 }))).not.toBe(k);
    expect(eraKey(st({ year: 2028 }))).not.toBe(k);
  });
});

describe('storeLayerIds', () => {
  it('names each store layer, bottom first', () => {
    expect(storeLayerIds({
      overlay: 'settings', overlayStack: [{ overlay: 'inbox' }], settingsPage: 'sound',
      coachSeat: 'hitting', selectedPlayer: 'p1' as never, godStack: [{} as never, {} as never],
    })).toEqual(['o:0:inbox', 'o:1:settings', 'sp:sound', 'c:hitting', 'p:p1', 'g:0', 'g:1']);
    // A settings page counts only while settings is the open overlay.
    expect(storeLayerIds({
      overlay: 'inbox', overlayStack: [], settingsPage: 'sound', coachSeat: null, selectedPlayer: null, godStack: [],
    })).toEqual(['o:0:inbox']);
  });
});

const CLOSED: Partial<DynastyStore> = {
  overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, godStack: [], settingsPage: 'index',
};

describe('withNav', () => {
  beforeEach(() => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ ...CLOSED, tab: 'home', screen: 'today', phase: null, bracket: null, jobSearch: false });
    resetBackLayers();
  });
  afterEach(() => { setEraReset(false); });

  it('stamps through useDynasty.setState, one id at a time, on the shared counter', () => {
    useDynasty.setState({ overlay: 'inbox' });
    expect(newestStoreLayer()).toBe(1);
    // The inbox keeps its stamp when a page opens over it.
    useDynasty.setState({ overlayStack: [{ overlay: 'inbox' }], overlay: 'standings' });
    expect(newestStoreLayer()).toBe(2);
    const sheet = registerBackLayer(() => undefined);
    expect(sheet).toBe(3);
    useDynasty.setState({ coachSeat: 'hitting' });
    expect(newestStoreLayer()).toBe(4);
    useDynasty.setState({ coachSeat: null });
    expect(newestStoreLayer()).toBe(2);
    expect(topBackLayer()).toBeGreaterThan(newestStoreLayer());
    useDynasty.setState({ overlayStack: [], overlay: 'inbox' });
    expect(newestStoreLayer()).toBe(1);
    useDynasty.setState({ overlay: null });
    expect(newestStoreLayer()).toBe(0);
    resetBackLayers();
    expect(newestStoreLayer()).toBe(0);
  });

  it("stamps the store's own actions too", () => {
    useDynasty.getState().openOverlay('inbox');
    expect(newestStoreLayer()).toBeGreaterThan(0);
    useDynasty.getState().closeOverlay();
    expect(useDynasty.getState().overlay).toBeNull();
  });

  it('takes a function partial', () => {
    const year = useDynasty.getState().year;
    useDynasty.setState((s) => ({ year: s.year + 1 }));
    expect(useDynasty.getState().year).toBe(year + 1);
    useDynasty.setState((s) => ({ year: s.year - 1 }));
  });

  it('resolves a function partial itself, so the era reset reaches it', () => {
    // Without the wrapper's own resolution zustand would resolve it and skip the reset.
    setEraReset(true);
    useDynasty.setState({ overlay: 'inbox', coachSeat: 'hitting', tab: 'team', screen: 'roster' });
    let calls = 0;
    const off = useDynasty.subscribe(() => { calls++; });
    useDynasty.setState((s) => ({ phase: s.phase ?? 'awards' }));
    off();
    const s = useDynasty.getState();
    expect(calls).toBe(1);
    expect(s.phase).toBe('awards');
    expect(s.overlay).toBeNull();
    expect(s.coachSeat).toBeNull();
  });

  it('notifies once per write, the era reset included', () => {
    let calls = 0;
    const off = useDynasty.subscribe(() => { calls++; });
    useDynasty.setState({ overlay: 'inbox' });
    expect(calls).toBe(1);
    setEraReset(true);
    useDynasty.setState({ phase: 'awards' });
    expect(calls).toBe(2);
    expect(useDynasty.getState().overlay).toBeNull();
    off();
  });

  it('leaves the layers alone while the reset is off', () => {
    useDynasty.setState({ overlay: 'inbox', coachSeat: 'hitting' });
    useDynasty.setState({ phase: 'awards' });
    expect(useDynasty.getState().overlay).toBe('inbox');
    expect(useDynasty.getState().coachSeat).toBe('hitting');
  });

  it('lets a write that names a layer keep it', () => {
    setEraReset(true);
    useDynasty.setState({ coachSeat: 'hitting', tab: 'team', screen: 'roster' });
    // The backNav.test.ts shape: a new frame and its overlay in one write.
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: 'staff', overlayStack: [], phase: 'review' });
    const s = useDynasty.getState();
    expect(s.overlay).toBe('staff');
    expect(s.coachSeat).toBeNull();
    expect(s.phase).toBe('review');
  });

  it('sends a new season or June era home, but not a winter one', () => {
    setEraReset(true);
    useDynasty.setState({ tab: 'team', screen: 'roster' });
    useDynasty.setState({ phase: 'awards' });
    expect(useDynasty.getState().tab).toBe('team');
    useDynasty.setState({ phase: null });
    expect([useDynasty.getState().tab, useDynasty.getState().screen]).toEqual(['home', 'today']);
    // Same era: nothing moves.
    useDynasty.setState({ tab: 'team', screen: 'roster', overlay: 'inbox' });
    useDynasty.setState({ version: useDynasty.getState().version + 1 });
    expect(useDynasty.getState().overlay).toBe('inbox');
    expect(useDynasty.getState().tab).toBe('team');
  });

  it('closes the jobs overlay when a job is taken', () => {
    setEraReset(true);
    useDynasty.setState({ jobSearch: true, overlay: 'jobs', overlayStack: [] });
    expect(useDynasty.getState().overlay).toBe('jobs');
    // acceptOffer's shape: a new school and the route, no word about overlays.
    useDynasty.setState({ jobSearch: false, userTeam: 1, tab: 'home', screen: 'today' });
    expect(useDynasty.getState().overlay).toBeNull();
    expect(newestStoreLayer()).toBe(0);
  });
});

describe('module order', () => {
  it('loads era.ts before the store without a cycle', async () => {
    vi.resetModules();
    const era = await import('../src/state/era.js');
    const store = await import('../src/state/store.js');
    expect(typeof era.withNav).toBe('function');
    expect(store.useDynasty.getState().tab).toBe('home');
  });
});
