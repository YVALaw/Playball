// audit-regressions.test.ts
// The double-click and stale-state family, pinned.
//
// Every test here reproduces a corruption the August 2026 audit demonstrated at
// runtime: a doubled press or a mid-operation action reaching a store with no
// guard. The store never had a concurrency test — every action was only ever
// called once, politely — and each of these bugs would have been caught by the
// ten lines that now catch its regression.
//
// IndexedDB is not in node; saves are given the same Map-backed stand-in the
// saves suite uses, because two of these bugs are about what a save carries.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());

vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => {
      disk.set(value.slot, structuredClone(value));
    },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

import { useDynasty, PHASES } from '../src/state/store.js';
import { createSeason, simSeason, simNextDay, seasonComplete } from '../src/engine/season.js';
import {
  freezeRegularSeason, conferenceField, conferenceIds, conferenceTournament,
} from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { newTeams } from '../src/engine/calibration.js';
import { simGame } from '../src/engine/game.js';
import { DEFAULT_STRATEGY } from '../src/engine/strategy.js';

/** Fresh store between tests: the harness reuses one module instance. */
beforeEach(() => {
  disk.clear();
  useDynasty.getState().newDynasty();
});

describe('the postseason can only be started once', () => {
  it('ignores a second press instead of replaying June on top of itself', () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    simSeason(season);

    useDynasty.getState().playPostseason();
    const first = useDynasty.getState().bracket;
    expect(first).not.toBeNull();
    const champions = first!.cups.map((c) => c.champion);
    const rng = season.rng.state!();
    const day = season.postseasonDay;

    // The double-tap. It used to re-freeze the record, throw the cups away and
    // play sixty more days of postseason on the calendar.
    useDynasty.getState().playPostseason();

    const second = useDynasty.getState().bracket!;
    expect(second.cups.map((c) => c.champion)).toEqual(champions);
    expect(season.rng.state!()).toBe(rng);
    expect(season.postseasonDay).toBe(day);
  });
});

describe('one press of CONTINUE is one step', () => {
  it('a doubled call carrying its step advances once', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ phase: 'review', furthestPhase: PHASES.indexOf('review'), lastReview: null });
    // Both presses were rendered on the review screen, so both say so — that
    // is exactly what two click events from one double-tap deliver.
    const a = useDynasty.getState().nextPhase('review');
    const b = useDynasty.getState().nextPhase('review');
    await Promise.all([a, b]);
    expect(useDynasty.getState().phase).toBe('coach');
  });

  it('the skip it prevents was real: an unqualified doubled call steps twice', async () => {
    // Documents why the token exists rather than asserting a requirement: the
    // bare form is deliberately unconditional (the store's own tail and the
    // tests use it), so calling it twice without the token still walks two
    // steps. The UI never does — every button passes the phase it rendered on.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ phase: 'review', furthestPhase: PHASES.indexOf('review'), lastReview: null });
    await useDynasty.getState().nextPhase();
    await useDynasty.getState().nextPhase();
    expect(useDynasty.getState().phase).not.toBe('coach');
  });
});

describe('walking back to the draft step cannot restart recruiting', () => {
  it('keeps the week and the rival points where they were', async () => {
    useDynasty.getState().start(4242, 0);
    const s = useDynasty.getState();
    const season = s.season!;
    // The career has already reached recruiting and played a week of it.
    useDynasty.setState({
      phase: 'draft',
      furthestPhase: PHASES.indexOf('recruiting'),
    });
    season.recruiting.week = 2;
    const contested = season.recruiting.prospects.find(
      (p) => p.points && Object.keys(p.points).length > 0,
    );
    const before = contested ? { ...contested.points } : null;

    await useDynasty.getState().nextPhase();

    expect(useDynasty.getState().phase).toBe('recruiting');
    // The clock did not rewind and the country did not get a second free
    // pass at the class.
    expect(season.recruiting.week).toBe(2);
    if (contested && before) expect(contested.points).toEqual(before);
  });
});

describe('a tier cannot be left while your tournament is live', () => {
  it('refuses the advance until your result is on the books', () => {
    const season = createSeason(makeRng(3131));
    simSeason(season);
    freezeRegularSeason(season);
    const me = season.teams.findIndex(
      (t) => conferenceField(season, t.conference).field.includes(t.index),
    );
    const mine = season.teams[me]!.conference;
    const others = conferenceIds(season)
      .filter((id) => id !== mine)
      .map((id) => conferenceTournament(season, id));
    useDynasty.setState({
      season, userTeam: me, myBracket: null,
      bracket: { stage: 'conference', cups: others, regionals: [], national: null },
    });
    useDynasty.getState().openStage();
    expect(useDynasty.getState().myBracket).not.toBeNull();

    useDynasty.getState().advanceBracket();

    // Still on the conference tier: seven cups are recorded, yours is not.
    expect(useDynasty.getState().bracket?.stage).toBe('conference');
  });
});

describe('an orphaned managed game is dropped, not recorded', () => {
  it('refuses to write a game after the calendar moved past its day', async () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    useDynasty.getState().startManagedGame();
    const live = useDynasty.getState().live;
    expect(live).not.toBeNull();
    useDynasty.getState().autoFinish();
    expect(live!.over).toBe(true);

    // The day plays out without the game being recorded first — the state a
    // worker-race or a mid-game load used to produce. Recording the leftover
    // game after this appended a second copy of the same fixture.
    simNextDay(season);
    const me = season.teams[useDynasty.getState().userTeam]!;
    const played = me.gp;

    await useDynasty.getState().endManagedGame();

    expect(useDynasty.getState().live).toBeNull();
    expect(me.gp).toBe(played);
  });
});

describe('loading a save clears the game being played', () => {
  it('and brings a dismissed coach his offers back', async () => {
    useDynasty.getState().start(4242, 0);
    // A career on the market: dismissed, with two chairs calling.
    useDynasty.setState({
      jobSearch: true,
      offers: [
        { team: 3, school: 'Bayou State', conference: 'GULF', prestige: 60, pitch: 'Win here.' },
        { team: 7, school: 'Biloxi Coast', conference: 'GULF', prestige: 40, pitch: 'Build here.' },
      ],
    });
    // A named slot: the second dynasty below autosaves over 'auto' the moment
    // it starts, exactly as the real app would.
    await useDynasty.getState().saveNow('market-slot');

    // A different dynasty is played in the meantime, mid-game.
    useDynasty.getState().newDynasty();
    useDynasty.getState().start(7777, 1);
    useDynasty.getState().startManagedGame();
    expect(useDynasty.getState().live).not.toBeNull();

    const ok = await useDynasty.getState().loadSlot('market-slot');
    expect(ok).toBe(true);

    const s = useDynasty.getState();
    // The old game did not follow the load in — it belonged to the world that
    // was put down, and recording it would have written a 46th game into a
    // 45-game season.
    expect(s.live).toBeNull();
    expect(s.liveMeta).toBeNull();
    expect(s.busy).toBe(false);
    // And the market is intact: jobSearch without offers was a career that
    // could never be resumed.
    expect(s.jobSearch).toBe(true);
    expect(s.offers.map((o) => o.team)).toEqual([3, 7]);
  });

  it('regenerates offers for an old save that recorded only the dismissal', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ jobSearch: true, offers: [] });
    // What an older build wrote: the flag with nothing beside it.
    await useDynasty.getState().saveNow();

    const ok = await useDynasty.getState().loadSlot();
    expect(ok).toBe(true);
    const s = useDynasty.getState();
    expect(s.jobSearch).toBe(true);
    // The market is rebuilt from the same rule that made it, not left empty.
    expect(s.offers.length).toBeGreaterThan(0);
  });
});

describe('a beaten-out bunt is a team hit', () => {
  it('the H column always equals the sum of the player lines', () => {
    const bunting = { ...DEFAULT_STRATEGY, bunt: 'often' as const };
    let bunts = 0;
    for (let i = 0; i < 400; i++) {
      const { rng, a, b } = newTeams(9000 + i);
      const res = simGame(a, b, rng, {
        // Verbose so the log exists to count bunts in — the equality check
        // alone would pass vacuously in a run where nobody ever bunted on.
        engine: 'log5', verbose: true, homeStrategy: bunting, awayStrategy: bunting,
      });
      for (const side of [res.home, res.away]) {
        let players = 0;
        for (const l of side.batting.values()) players += l.h;
        expect(side.hits).toBe(players);
      }
      bunts += res.log.filter((l) => l.includes('bunt single')).length;
    }
    // The assertion above is vacuous if nothing ever bunted its way on.
    expect(bunts).toBeGreaterThan(0);
  });
});
