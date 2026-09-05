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
import { overallOf } from '../src/engine/ratings.js';
import { cardGaps } from '../src/engine/depthChart.js';
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

    // Stage 10 put the portal between the draft and recruiting, so reaching
    // recruiting is two steps from the draft rather than one.
    await useDynasty.getState().nextPhase();
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
    await useDynasty.getState().startManagedGame();
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
    await useDynasty.getState().startManagedGame();
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

describe('an errand carries its subject', () => {
  /*
    NEEDS YOU sends the coach to the lineup about one injured man, and the
    lineup marks him. That handoff is one field, and it has two ways to fail
    silently: never arriving, and never leaving. Both were live during
    development — the mark was cleared before its first paint by StrictMode's
    synthetic unmount, and an uncleared mark would have flagged a healthy man on
    every later visit.
  */
  it('go() hands the destination a man, and only the trip that asked for one', () => {
    useDynasty.getState().start(4242, 0);

    useDynasty.getState().go('team', 'lineup', 'man-17');
    expect(useDynasty.getState().focusPlayer).toBe('man-17');
    expect(useDynasty.getState().screen).toBe('lineup');

    // Walking there yourself is not an errand, so nothing is marked.
    useDynasty.getState().go('team', 'lineup');
    expect(useDynasty.getState().focusPlayer).toBeNull();
  });

  it('drops the mark when the coach navigates on', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().go('team', 'lineup', 'man-17');

    useDynasty.getState().setScreen('roster');
    expect(useDynasty.getState().focusPlayer).toBeNull();
  });

  it('keeps the mark out of the save', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().go('team', 'lineup', 'man-17');
    expect(useDynasty.getState().focusPlayer).toBe('man-17');

    // A transient pointer at a screen is not a fact about the dynasty; a save
    // that carried one would restore a red row for an errand long since done.
    const saved = JSON.stringify([...disk.values()]);
    expect(saved).not.toContain('man-17');
  });
});

describe("the board's number is set in February", () => {
  /*
    Reported from play, with the reporter asking whether he was imagining it:
    "it was asking me for 18 wins, now it is saying 19." He was not. The
    program page recomputed the expectation from the live roster on every
    render, so the target crept as players developed — the same drift the page
    had already been cured of once, when it scaled by games played.
  */
  it('does not move when the roster develops mid-season', () => {
    useDynasty.getState().start(4242, 0);
    const ask = useDynasty.getState().boardAsk;
    expect(ask).not.toBeNull();
    const before = ask!.targetWins;

    // The roster gets dramatically better overnight.
    const me = useDynasty.getState().season!.teams[0]!;
    for (const h of me.team.lineup) {
      h.contact = 99; h.power = 99; h.eye = 99; h.speed = 99;
    }
    for (const a of me.team.rotation) {
      a.stuff = 99; a.movement = 99; a.control = 99;
    }

    // And the board's February number has not heard about it.
    expect(useDynasty.getState().boardAsk!.targetWins).toBe(before);
  });

  it('survives a save and comes back the same', async () => {
    useDynasty.getState().start(4242, 0);
    const before = useDynasty.getState().boardAsk!;
    await useDynasty.getState().saveNow('ask-slot');

    // Forget it, load, and the stamp is back — not a fresh recompute keyed to
    // whatever the roster looks like now.
    useDynasty.setState({ boardAsk: null });
    const ok = await useDynasty.getState().loadSlot('ask-slot');
    expect(ok).toBe(true);
    expect(useDynasty.getState().boardAsk).not.toBeNull();
    expect(useDynasty.getState().boardAsk!.targetWins).toBe(before.targetWins);
    expect(useDynasty.getState().boardAsk!.mandate).toBe(before.mandate);
  });
});


describe('positions are yours to break, and the game remembers home', () => {
  /*
    The first version of this block pinned the opposite rule: every route into
    the nine relabelled the man to the slot he took. Played for a weekend and
    reversed in exactly these words — "I don't want them to be automatically
    assigned, the automation is only if I tap on auto lineup." So the manual
    swap moves the man and nothing else; the automation (AUTO, the staff, the
    rail's explicit appointment) still adopts — and any adoption remembers
    `homePos`, so a cover coming back to the bench is himself again.
  */
  it('a manual start keeps his own label, even when it breaks the set', () => {
    useDynasty.getState().start(4242, 0);
    const t = useDynasty.getState().season!.teams[0]!.team;
    const bench = t.bench[0]!;
    const benchPos = bench.pos;
    expect(useDynasty.getState().swapStarter(2, bench.id)).toBe(true);
    expect(t.lineup[2]!.id).toBe(bench.id);
    // No relabel. He plays where he plays.
    expect(t.lineup[2]!.pos).toBe(benchPos);
    expect(t.lineup[2]!.homePos).toBeUndefined();
    // And the screen's reading of the card agrees with what just happened:
    // broken if the labels no longer cover nine spots, clean if they do.
    const gaps = cardGaps(t.lineup);
    const spots = new Set(t.lineup.map((p) => p.pos));
    expect(gaps.missing.length === 0 && gaps.doubled.length === 0).toBe(spots.size === 9);
  });

  it('a cover returns to the bench as himself', () => {
    useDynasty.getState().start(4242, 0);
    const t = useDynasty.getState().season!.teams[0]!.team;
    const bench = t.bench[0]!;
    const home = bench.pos;
    // The rail's explicit appointment: put the bench man at catcher.
    expect(useDynasty.getState().assignPosition(bench.id, 'C')).toBe(true);
    const inNine = t.lineup.find((p) => p.id === bench.id)!;
    expect(inNine.pos).toBe('C');
    if (home !== 'C') expect(inNine.homePos).toBe(home);
    // Send him back down by starting someone else in his spot.
    const idx = t.lineup.findIndex((p) => p.id === bench.id);
    const other = t.bench[0]!;
    expect(useDynasty.getState().swapStarter(idx, other.id)).toBe(true);
    const backDown = t.bench.find((p) => p.id === bench.id)!;
    expect(backDown.pos).toBe(home);
    expect(backDown.homePos).toBeUndefined();
  });

  it('the rail appointment inside the nine trades labels, and both remember', () => {
    useDynasty.getState().start(4242, 0);
    const t = useDynasty.getState().season!.teams[0]!.team;
    const man = t.lineup[5]!;
    const from = man.pos;
    const holder = t.lineup.find((p) => p.pos === 'C')!;
    expect(useDynasty.getState().assignPosition(man.id, 'C')).toBe(true);
    expect(man.pos).toBe('C');
    expect(holder.pos).toBe(from);
    expect(new Set(t.lineup.map((p) => p.pos)).size).toBe(9);
    // Adoption, not amnesia: both men know where home is.
    expect(man.homePos).toBe(from);
    expect(holder.homePos).toBe('C');
  });

  it('AUTO repairs a broken card, restores the bench, and orders the arms', () => {
    useDynasty.getState().start(4242, 0);
    const t = useDynasty.getState().season!.teams[0]!.team;
    // The reported corruption, made by hand: a duplicate label in the nine.
    t.lineup[0]!.pos = t.lineup[1]!.pos;
    // And a man stranded on the bench still wearing a covered label.
    t.bench[0]!.homePos = t.bench[0]!.pos;
    t.bench[0]!.pos = 'C';
    // And a rotation deliberately upside down.
    t.rotation.reverse();
    useDynasty.getState().autoLineup();
    expect(new Set(t.lineup.map((p) => p.pos)).size).toBe(9);
    // The whole bench went home — the fit pass may have reshuffled who sits
    // where, but nobody down there is still wearing a cover.
    for (const b of t.bench) expect(b.homePos).toBeUndefined();
    const ovr = t.rotation.map((p) => overallOf(p));
    for (let i = 1; i < ovr.length; i++) expect(ovr[i - 1]!).toBeGreaterThanOrEqual(ovr[i]!);
  });
});

describe('pitching staff swaps preserve the arm\'s real role', () => {
  it('an RP who borrows a rotation slot comes back to the bullpen as an RP', () => {
    useDynasty.getState().start(4242, 0);
    const state = useDynasty.getState();
    const club = state.season!.teams[state.userTeam]!.team;
    const rp = club.bullpen.find((p) => p.role === 'RP');
    const starter = club.rotation[0];
    expect(rp).toBeDefined();
    expect(starter).toBeDefined();
    if (!rp || !starter) return;

    expect(state.promoteArm(rp.id, 0)).toBe(true);
    expect(club.rotation[0]!.id).toBe(rp.id);
    expect(club.rotation[0]!.role).toBe('SP');
    expect(club.rotation[0]!.homeRole).toBe('RP');

    // The displaced starter is now the bullpen selection. Swapping him back
    // must restore the promoted reliever's original role rather than preserve
    // the temporary SP label he wore while starting.
    expect(useDynasty.getState().promoteArm(starter.id, 0)).toBe(true);
    const returned = club.bullpen.find((p) => p.id === rp.id);
    expect(returned).toBeDefined();
    expect(returned!.role).toBe('RP');
    expect(returned!.homeRole).toBe('RP');
  });

  it('repairs the legacy-save shape where a bullpen arm was stranded as SP', () => {
    useDynasty.getState().start(4242, 0);
    const state = useDynasty.getState();
    const club = state.season!.teams[state.userTeam]!.team;
    const arm = club.bullpen.find((p) => p.role === 'RP');
    expect(arm).toBeDefined();
    if (!arm) return;

    // Recreate what an older save could contain after the former swap bug.
    arm.role = 'SP';
    delete arm.homeRole;
    const starter = club.rotation[0]!;

    expect(state.promoteArm(arm.id, 0)).toBe(true);
    expect(useDynasty.getState().promoteArm(starter.id, 0)).toBe(true);
    const healed = club.bullpen.find((p) => p.id === arm.id)!;
    expect(healed.role).toBe('RP');
    expect(healed.homeRole).toBe('RP');
  });
});
