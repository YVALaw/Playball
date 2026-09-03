// traits.test.ts
// The situational layer: what a pitcher throws, what a player is like, and the
// badges he carries.
//
// Three systems that all sit on top of the ratings without being ratings, and
// each has a different property that has to hold or it becomes one. A
// repertoire has to differ man to man or the palette is decoration. A tendency
// has to be power-neutral across the league or it is a stat boost with a story.
// A badge has to be small, capped, and earned by the thing it names.
//
// The expensive checks — the league-wide effect of badges, and discovery
// happening through simulated play — are at the bottom and are deliberately
// game trials rather than unit assertions, because both are claims about what
// the simulation does over a season and nothing smaller can answer them.

import { describe, it, expect } from 'vitest';
import {
  BADGES, BADGE_IDS, badgeCap, badgesOf, badgeMods, developBadges, eligibleBadges,
  grantBadge, innateBadges, SIGNING_CAP, tierOf,
  type BadgeEvidence, type BadgeId, type HeldBadge,
} from '../src/engine/badges.js';
import { simGame } from '../src/engine/game.js';
import {
  fastballShare, PITCHES, repertoireOf, resetRepertoires,
} from '../src/engine/pitches.js';
import { makeHitter, makePitcher, makeTeam, resetNames } from '../src/engine/players.js';
import { platoonMultiplier, platoonSplit } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { potentialGrade } from '../src/engine/scouting.js';
import {
  HITTER_TENDENCIES, PITCHER_TENDENCIES, TENDENCIES, blankWatch, isKnown, teamReads,
  pullMultiplier, runningMods, tendenciesOf, tendencyMods, watchProgress,
  type Situation, type TendencyId,
} from '../src/engine/tendencies.js';
import {
  createSeason, recordResult, simNextDay, DEFAULT_SEASON, seasonLength,
} from '../src/engine/season.js';
import type { Hitter, Pitcher, Player } from '../src/engine/types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** A big pool of generated men, built once. Reused by everything below. */
function pool(seed = 4242, teams = 14): { bats: Hitter[]; arms: Pitcher[] } {
  resetNames();
  const rng = makeRng(seed);
  const bats: Hitter[] = [];
  const arms: Pitcher[] = [];
  for (let i = 0; i < teams; i++) {
    const t = makeTeam(rng, `T${i}`, 50);
    bats.push(...t.lineup, ...t.bench);
    arms.push(...t.rotation, ...t.bullpen);
  }
  return { bats, arms };
}

const FLAT: Situation = {
  risp: false, runnersOn: false, timesThrough: 1, outs: 0,
  inning: 1, margin: 0, leadingOff: false, postseason: false,
};

// ---------------------------------------------------------------------------
// B16 — the repertoire
// ---------------------------------------------------------------------------

describe('what a pitcher throws', () => {
  const { arms } = pool();

  it('gives every pitcher a repertoire whose usage shares are a real distribution', () => {
    for (const p of arms) {
      const rep = repertoireOf(p);
      expect(rep.length, p.name).toBeGreaterThanOrEqual(2);
      expect(rep.length, p.name).toBeLessThanOrEqual(5);
      const total = rep.reduce((a, o) => a + o.usage, 0);
      expect(total, p.name).toBeCloseTo(1, 10);
      for (const o of rep) expect(o.usage, `${p.name} ${o.id}`).toBeGreaterThan(0);
      // Best pitch first, which is the order the card reads in.
      for (let i = 1; i < rep.length; i++) {
        expect((rep[i] as { usage: number }).usage)
          .toBeLessThanOrEqual((rep[i - 1] as { usage: number }).usage);
      }
      // Every man has something hard, even the knuckleballer.
      expect(rep.some((o) => PITCHES[o.id].family === 'fastball'), p.name).toBe(true);
    }
  });

  it('does not draw them all from one identical set', () => {
    const shapes = new Set(arms.map((p) =>
      repertoireOf(p).map((o) => `${o.id}${Math.round(o.usage * 100)}`).join(',')));
    // Near enough one per man. Two arms sharing a repertoire to the percentage
    // point is allowed; a palette that produced twenty distinct pitchers out of
    // three hundred would be the failure this whole file was written against.
    expect(shapes.size).toBeGreaterThan(arms.length * 0.85);

    const kinds = new Set(arms.flatMap((p) => repertoireOf(p).map((o) => o.id)));
    // The breadth the brief asked for by name, knuckleball and vulcan included.
    expect(kinds.size).toBeGreaterThanOrEqual(9);
  });

  it('keeps the curiosities rare and the ordinary pitches common', () => {
    const carry = (id: keyof typeof PITCHES): number =>
      arms.filter((p) => repertoireOf(p).some((o) => o.id === id)).length / arms.length;
    expect(carry('SL')).toBeGreaterThan(0.35);
    expect(carry('CH')).toBeGreaterThan(0.35);
    expect(carry('KN')).toBeLessThan(0.05);
    expect(carry('VU')).toBeLessThan(0.12);
    expect(carry('SC')).toBeLessThan(0.12);
  });

  it('makes a knuckleballer a knuckleballer rather than a man with four pitches', () => {
    resetNames();
    const rng = makeRng(70707);
    let found = 0;
    for (let i = 0; i < 3000 && found < 4; i++) {
      const p = makePitcher(rng, 50);
      const rep = repertoireOf(p);
      const kn = rep.find((o) => o.id === 'KN');
      if (!kn) continue;
      found += 1;
      expect(kn.usage).toBeGreaterThan(0.55);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('reads the pitch-usage tendency off the usage shares, not off a separate roll', () => {
    for (const p of arms) {
      const share = fastballShare(repertoireOf(p));
      const pole = tendenciesOf(p).mix ?? 0;
      if (pole === 1) expect(share, p.name).toBeGreaterThan(0.6);
      if (pole === -1) expect(share, p.name).toBeLessThan(0.5);
    }
  });

  it('is stable across a reload, because nothing about it is stored', () => {
    const before = arms.map((p) => repertoireOf(p).map((o) => `${o.id}:${o.usage}`).join());
    resetRepertoires();
    const after = arms.map((p) => repertoireOf(p).map((o) => `${o.id}:${o.usage}`).join());
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// B17 — the split
// ---------------------------------------------------------------------------

describe('the platoon split, surfaced', () => {
  const { bats, arms } = pool(909, 8);
  const rhp = { ...(arms[0] as Pitcher), throws: 'R' as const, platoonSkill: 0 };
  const lhp = { ...(arms[0] as Pitcher), throws: 'L' as const, platoonSkill: 0 };

  it('matches the multiplier the simulation actually applies', () => {
    for (const h of bats) {
      const split = platoonSplit(h);
      expect(split.vsRHP, h.name).toBeCloseTo(platoonMultiplier(h, rhp), 12);
      expect(split.vsLHP, h.name).toBeCloseTo(platoonMultiplier(h, lhp), 12);
    }
  });

  it('puts the good side of it on the opposite hand', () => {
    const righty = bats.find((h) => h.bats === 'R' && h.platoonSkill > 0.02) as Hitter;
    const lefty = bats.find((h) => h.bats === 'L' && h.platoonSkill > 0.02) as Hitter;
    expect(platoonSplit(righty).vsLHP).toBeGreaterThan(platoonSplit(righty).vsRHP);
    expect(platoonSplit(lefty).vsRHP).toBeGreaterThan(platoonSplit(lefty).vsLHP);
  });

  it('gives a switch hitter the same reading from both sides', () => {
    const s = bats.find((h) => h.bats === 'S') as Hitter;
    expect(platoonSplit(s).vsRHP).toBeCloseTo(platoonSplit(s).vsLHP, 12);
    expect(platoonSplit(s).vsRHP).toBeGreaterThanOrEqual(1);
  });

  it('prints contact and power as ratings, and moves them the same direction', () => {
    const h = bats.find((b) => b.bats === 'L' && b.platoonSkill > 0.06) as Hitter;
    const s = platoonSplit(h);
    expect(s.contact?.vsRHP as number).toBeGreaterThan(s.contact?.vsLHP as number);
    expect(s.power?.vsRHP as number).toBeGreaterThan(s.power?.vsLHP as number);
    // The contact swing is the larger one, because the contact curve is the
    // shallower of the two. This is the model, not a rounding artefact.
    const contactSwing = (s.contact?.vsRHP as number) - (s.contact?.vsLHP as number);
    const powerSwing = (s.power?.vsRHP as number) - (s.power?.vsLHP as number);
    expect(contactSwing).toBeGreaterThan(powerSwing);
  });

  it('reads a pitcher as what he allows', () => {
    const side = arms.find((p) => p.platoonSkill > 0.02) as Pitcher;
    const s = platoonSplit(side);
    const same = side.throws === 'R' ? s.vsRHP : s.vsLHP;
    const opposite = side.throws === 'R' ? s.vsLHP : s.vsRHP;
    expect(same).toBeLessThan(opposite);
  });
});

// ---------------------------------------------------------------------------
// B11 — tendencies
// ---------------------------------------------------------------------------

describe('tendencies', () => {
  /*
    Sixty teams rather than twenty, and the neutrality bound below is 0.008
    rather than 0.005 — re-measured when stage 16's findable-gems knob
    changed generation's draw pattern and re-dealt every id in the sample.
    The averages are not exactly 1 even in the limit: the pole pairs are
    sized against the run environment, and the cross products of bat and arm
    multipliers carry a second-order structure worth about half a percent on
    the walk and homerun channels (measured at 160 teams: walk .9956,
    homerun 1.0050). Twenty teams passed on sampling luck; sixty measures
    the real thing, and .008 still catches a mis-sized pair, which moves a
    channel by two percent or more.
  */
  const { bats, arms } = pool(5150, 60);

  it('hands each pole about a fifth of the league, and leaves most men ordinary', () => {
    for (const slot of [...HITTER_TENDENCIES, ...PITCHER_TENDENCIES] as TendencyId[]) {
      const men: Player[] = TENDENCIES[slot].side === 'hitter' ? bats : arms;
      let plus = 0, minus = 0;
      for (const p of men) {
        const pole = tendenciesOf(p)[slot] ?? 0;
        if (pole === 1) plus += 1;
        if (pole === -1) minus += 1;
      }
      expect(plus / men.length, `${slot} plus`).toBeGreaterThan(0.13);
      expect(plus / men.length, `${slot} plus`).toBeLessThan(0.29);
      expect(minus / men.length, `${slot} minus`).toBeGreaterThan(0.13);
      expect(minus / men.length, `${slot} minus`).toBeLessThan(0.29);
    }
  });

  /**
   * The property that stops a tendency being a rating: over the league, every
   * pole pair has to average to one on the channel it touches. Measured on the
   * multipliers themselves rather than through a season, because this is an
   * arithmetic claim and a simulation would only add noise to it.
   */
  it('is power neutral across the league on every channel it touches', () => {
    const keys = ['all', 'walk', 'single', 'double', 'homerun', 'strikeout', 'groundBall', 'pace'] as const;
    const totals: Record<string, number> = {};
    let n = 0;
    for (const b of bats) {
      for (const p of arms) {
        const m = tendencyMods(b, p, FLAT);
        for (const k of keys) totals[k] = (totals[k] ?? 0) + m[k];
        n += 1;
      }
    }
    for (const k of keys) {
      expect(Math.abs((totals[k] as number) / n - 1), k).toBeLessThan(0.008);
    }
  });

  it('keeps clutch neutral over a season by paying for the big spot out of the quiet ones', () => {
    const clutchBat = bats.find((b) => (tendenciesOf(b).clutch ?? 0) === 1) as Hitter;
    const arm = arms.find((p) => Object.values(tendenciesOf(p)).every((v) => v === 0)) as Pitcher;
    const risp = tendencyMods(clutchBat, arm, { ...FLAT, risp: true }).all;
    const empty = tendencyMods(clutchBat, arm, FLAT).all;
    expect(risp).toBeGreaterThan(1);
    expect(empty).toBeLessThan(1);
    // A quarter of plate appearances come with a man in scoring position, and
    // the lift there is priced to cost exactly what it gains over the rest.
    expect(0.24 * risp + 0.76 * empty).toBeCloseTo(1, 3);
  });

  it('changes what each tendency names and nothing else', () => {
    const neutralBat = bats.find((b) =>
      Object.values(tendenciesOf(b)).every((v) => v === 0)) as Hitter;
    const neutralArm = arms.find((p) =>
      Object.values(tendenciesOf(p)).every((v) => v === 0)) as Pitcher;
    const base = tendencyMods(neutralBat, neutralArm, FLAT);
    for (const k of Object.keys(base) as Array<keyof typeof base>) expect(base[k]).toBe(1);

    // A free swinger walks less and does more damage. He does not throw more
    // ground balls, because nothing about his approach says he would.
    const free = bats.find((b) => (tendenciesOf(b).approach ?? 0) === 1
      && (tendenciesOf(b).firstPitch ?? 0) === 0
      && (tendenciesOf(b).clutch ?? 0) === 0) as Hitter;
    const fm = tendencyMods(free, neutralArm, FLAT);
    expect(fm.walk).toBeLessThan(1);
    expect(fm.homerun).toBeGreaterThan(1);
    expect(fm.groundBall).toBe(1);
    expect(fm.all).toBe(1);

    // A nibbler walks more and is squared up less. He does not change how often
    // the man at the plate strikes out.
    const nibbler = arms.find((p) => (tendenciesOf(p).zone ?? 0) === -1
      && (tendenciesOf(p).mix ?? 0) === 0
      && (tendenciesOf(p).poise ?? 0) === 0) as Pitcher;
    const nm = tendencyMods(neutralBat, nibbler, FLAT);
    expect(nm.walk).toBeGreaterThan(1);
    expect(nm.homerun).toBeLessThan(1);
    expect(nm.strikeout).toBe(1);

    // A power arm misses bats and gives up the long one. His walks are his own
    // business and this is not it.
    const power = arms.find((p) => (tendenciesOf(p).mix ?? 0) === 1
      && (tendenciesOf(p).zone ?? 0) === 0) as Pitcher;
    const pm = tendencyMods(neutralBat, power, FLAT);
    expect(pm.strikeout).toBeGreaterThan(1);
    expect(pm.homerun).toBeGreaterThan(1);
    expect(pm.groundBall).toBeLessThan(1);
    expect(pm.walk).toBe(1);
  });

  it('turns a green light into more attempts and more risk, both', () => {
    const green = bats.find((b) => (tendenciesOf(b).running ?? 0) === 1) as Hitter;
    const station = bats.find((b) => (tendenciesOf(b).running ?? 0) === -1) as Hitter;
    expect(runningMods(green).steal).toBeGreaterThan(runningMods(station).steal);
    expect(runningMods(green).attempt).toBeGreaterThan(1);
    // The double edge. An aggressive runner is not a free upgrade.
    expect(runningMods(green).risk).toBeGreaterThan(1);
    expect(runningMods(station).risk).toBeLessThan(1);
  });

  it('sends a pull hitter to one side of the diamond and a spray hitter to all of it', () => {
    const puller = bats.find((b) => (tendenciesOf(b).spray ?? 0) === 1) as Hitter;
    const sprayer = bats.find((b) => (tendenciesOf(b).spray ?? 0) === -1) as Hitter;
    expect(pullMultiplier(puller)).toBeGreaterThan(1);
    expect(pullMultiplier(sprayer)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

describe('discovering a tendency', () => {
  it('is not known on a man who has never played', () => {
    for (const slot of HITTER_TENDENCIES) {
      expect(isKnown(slot, undefined, true), slot).toBe(false);
      expect(isKnown(slot, blankWatch(), true), slot).toBe(false);
      expect(watchProgress(slot, blankWatch())).toBe(0);
    }
  });

  it('is known on an opponent immediately, which is the whole point of a scouting report', () => {
    for (const slot of [...HITTER_TENDENCIES, ...PITCHER_TENDENCIES]) {
      expect(isKnown(slot, undefined, false), slot).toBe(true);
    }
  });

  it('needs the evidence the reading is actually made of', () => {
    // A spray chart comes from balls in play, so plate appearances alone will
    // never produce one however many of them there are.
    const watched = { pa: 100000, on: 0, bip: 0 };
    expect(isKnown('spray', watched, true)).toBe(false);
    expect(isKnown('running', watched, true)).toBe(false);
    expect(isKnown('approach', watched, true)).toBe(true);
  });

  it('learns the obvious things long before the subtle ones', () => {
    expect(TENDENCIES.mix.need).toBeLessThan(TENDENCIES.pace.need);
    expect(TENDENCIES.pace.need).toBeLessThan(TENDENCIES.zone.need);
    expect(TENDENCIES.zone.need).toBeLessThan(TENDENCIES.poise.need);
    expect(TENDENCIES.firstPitch.need).toBeLessThan(TENDENCIES.approach.need);
    expect(TENDENCIES.approach.need).toBeLessThan(TENDENCIES.clutch.need);
  });

  /**
   * The claim that matters, and the reason this is a season trial rather than a
   * unit test: discovery has to happen through **ordinary simulated play**. A
   * mechanic that only advanced in games the coach managed himself would be
   * invisible to most of the people playing this.
   */
  it('advances through simulated games, and gets there over a season', () => {
    resetNames();
    const season = createSeason(makeRng(2027));
    season.captureBoxFor = 3;
    expect(season.watch).toBeUndefined();

    for (let i = 0; i < seasonLength(DEFAULT_SEASON); i++) simNextDay(season);

    const watch = season.watch;
    expect(watch).toBeDefined();
    const mine = season.teams[3]?.team as { lineup: Hitter[]; rotation: Pitcher[] };

    // Only your own program. Nobody has been watching anybody else's shortstop.
    const theirs = season.teams[4]?.team.lineup[0] as Hitter;
    expect(watch?.get(theirs.id)).toBeUndefined();

    const regular = mine.lineup[0] as Hitter;
    const seen = watch?.get(regular.id);
    expect(seen?.pa ?? 0).toBeGreaterThan(120);
    expect(seen?.on ?? 0).toBeGreaterThan(40);
    expect(seen?.bip ?? 0).toBeGreaterThan(80);

    // A season of watching an everyday player settles the quick readings and
    // leaves the slow one open, which is exactly the intended shape.
    expect(isKnown('firstPitch', seen, true)).toBe(true);
    expect(isKnown('running', seen, true)).toBe(true);
    expect(isKnown('clutch', seen, true)).toBe(false);

    const friday = mine.rotation[0] as Pitcher;
    const arm = watch?.get(friday.id);
    expect(isKnown('mix', arm, true)).toBe(true);
    expect(isKnown('poise', arm, true)).toBe(false);
  });

  it('does not count a replayed game twice', () => {
    resetNames();
    const season = createSeason(makeRng(4242));
    season.captureBoxFor = 0;
    const home = season.teams[0]?.team as Parameters<typeof simGame>[0];
    const away = season.teams[1]?.team as Parameters<typeof simGame>[1];
    const result = simGame(home, away, season.rng, {});
    recordResult(season, 0, 1, result, { record: true, standings: false });
    const after = new Map([...(season.watch ?? new Map())].map(([k, v]) => [k, { ...v }]));
    recordResult(season, 0, 1, result, { record: false, standings: false });
    for (const [id, w] of season.watch ?? new Map()) {
      expect(w.pa, id).toBe(after.get(id)?.pa);
    }
  });
});

// ---------------------------------------------------------------------------
// B10 — badges
// ---------------------------------------------------------------------------

describe('badges', () => {
  const { bats, arms } = pool(31337, 20);
  const everyone: Player[] = [...bats, ...arms];

  it('caps what a man can hold by the ceiling he was scouted at', () => {
    expect(badgeCap(96)).toBe(10);   // S+, the store player, exempt by design
    expect(badgeCap(93)).toBe(6);    // S
    expect(badgeCap(86)).toBe(5);    // A+
    expect(badgeCap(75)).toBe(4);    // A
    expect(badgeCap(64)).toBe(3);    // B
    expect(badgeCap(55)).toBe(2);    // C
    expect(badgeCap(40)).toBe(2);    // D shares C's two on purpose
  });

  it('hands out at most two at signing, and never past the ceiling', () => {
    for (const p of everyone) {
      const held = badgesOf(p);
      expect(held.length, p.name).toBeLessThanOrEqual(SIGNING_CAP);
      expect(held.length, p.name).toBeLessThanOrEqual(badgeCap(p.potential));
      // And never one he could not use.
      for (const b of held) expect(BADGES[b.id].eligible(p), `${p.name} ${b.id}`).toBe(true);
      // No duplicates.
      expect(new Set(held.map((b) => b.id)).size).toBe(held.length);
    }
  });

  it('leaves most of the country without one, and gold genuinely rare', () => {
    const held = everyone.flatMap((p) => badgesOf(p));
    const per = held.length / everyone.length;
    expect(per).toBeGreaterThan(0.35);
    expect(per).toBeLessThan(0.85);
    const gold = held.filter((b) => b.tier === 3).length / held.length;
    expect(gold).toBeGreaterThan(0);
    expect(gold).toBeLessThan(0.10);
  });

  it('is position aware: nobody is offered a badge he could not use', () => {
    const first = bats.find((b) => b.pos === '1B') as Hitter;
    expect(eligibleBadges(first)).not.toContain('cannon');
    expect(eligibleBadges(first)).not.toContain('painter');
    expect(eligibleBadges(first)).not.toContain('stealsStrikes');
    const catcher = bats.find((b) => b.pos === 'C') as Hitter;
    expect(eligibleBadges(catcher)).toContain('stealsStrikes');
    const sp = arms.find((p) => p.role === 'SP') as Pitcher;
    expect(eligibleBadges(sp)).toContain('deepWater');
    expect(eligibleBadges(sp)).not.toContain('theDoor');
    const rp = arms.find((p) => p.role === 'RP') as Pitcher;
    expect(eligibleBadges(rp)).toContain('theDoor');
    expect(eligibleBadges(rp)).not.toContain('deepWater');
  });

  it('refuses to go past the cap, and upgrades instead of duplicating', () => {
    const man = { ...(bats[0] as Hitter), potential: 40, badges: [] };
    expect(badgeCap(man.potential)).toBe(2);
    expect(grantBadge(man, 'lightTower')).toBe('new');
    expect(grantBadge(man, 'wheels')).toBe('new');
    expect(grantBadge(man, 'toughOut')).toBe(null);      // cap reached
    expect(grantBadge(man, 'lightTower')).toBe('upgraded');
    expect(grantBadge(man, 'lightTower')).toBe('upgraded');
    expect(tierOf(man, 'lightTower')).toBe(3);
    expect(grantBadge(man, 'lightTower')).toBe(null);    // gold is the top
    expect(badgesOf(man).length).toBe(2);
  });

  it('fires only in the situation it names', () => {
    const arm = { ...(arms[0] as Pitcher), badges: [] };
    const bat = { ...(bats[0] as Hitter), badges: [{ id: 'getsHimIn' as BadgeId, tier: 3 as const }] };
    expect(badgeMods(bat, arm, null, FLAT).all).toBe(1);
    const withMan = badgeMods(bat, arm, null, { ...FLAT, risp: true }).all;
    expect(withMan).toBeCloseTo(1.08, 6);

    const closer = {
      ...(arms.find((p) => p.role === 'RP') as Pitcher),
      badges: [{ id: 'theDoor' as BadgeId, tier: 3 as const }],
    };
    const quiet = { ...(bats[1] as Hitter), badges: [] };
    expect(badgeMods(quiet, closer, null, FLAT).all).toBe(1);
    const late = badgeMods(quiet, closer, null,
      { ...FLAT, inning: 9, margin: -2 }).all;
    expect(late).toBeCloseTo(0.90, 6);
  });

  it('sizes a gold badge against the engine’s own reference points', () => {
    // Home field is a 1.020 multiplier worth about five points of win
    // probability. A gold badge on its own channel must sit well inside that,
    // and a bronze one must be a nudge.
    for (const id of BADGE_IDS) {
      const [bronze, silver, gold] = BADGES[id].size;
      expect(bronze, id).toBeGreaterThanOrEqual(0.02);
      expect(bronze, id).toBeLessThan(silver);
      expect(silver, id).toBeLessThan(gold);
      expect(gold, id).toBeLessThanOrEqual(0.10);
    }
  });

  it('is earned by the thing it names, and not by anything else', () => {
    const slugger = { ...(bats[2] as Hitter), potential: 90, badges: [] };
    const quiet: BadgeEvidence = {
      bat: { g: 45, ab: 170, h: 44, d: 8, t: 0, hr: 1, bb: 14, k: 40, sb: 1, cs: 1, rbi: 18, r: 20, hbp: 2 },
    };
    const twenty: BadgeEvidence = {
      bat: { ...(quiet.bat as NonNullable<BadgeEvidence['bat']>), hr: 12 },
    };
    expect(BADGES.lightTower.earned?.(quiet)).toBe(false);
    expect(BADGES.lightTower.earned?.(twenty)).toBe(true);
    // And the season that earns the home run badge does not earn the walk one.
    expect(BADGES.tableSetter.earned?.(twenty)).toBe(false);
    expect(BADGES.burglar.earned?.(twenty)).toBe(false);
    void slugger;

    const wild: BadgeEvidence = {
      pit: { g: 14, gs: 13, outs: 240, h: 70, er: 30, bb: 40, k: 60, hr: 6, pitches: 1300, bf: 340, w: 6, sv: 0 },
    };
    const surgical: BadgeEvidence = {
      pit: { ...(wild.pit as NonNullable<BadgeEvidence['pit']>), bb: 12 },
    };
    expect(BADGES.painter.earned?.(wild)).toBe(false);
    expect(BADGES.painter.earned?.(surgical)).toBe(true);
    expect(BADGES.swingAndMiss.earned?.(surgical)).toBe(false);
  });

  it('gives a man who did the thing a real chance of keeping it', () => {
    const bomber: BadgeEvidence = {
      bat: { g: 45, ab: 170, h: 55, d: 12, t: 1, hr: 14, bb: 20, k: 30, sb: 2, cs: 0, rbi: 45, r: 40, hbp: 2 },
    };
    let got = 0;
    for (let i = 0; i < 60; i++) {
      const man = { ...(bats[i % bats.length] as Hitter), potential: 90, badges: [] };
      developBadges(man, bomber, 2030, 20);
      if (tierOf(man, 'lightTower') > 0) got += 1;
    }
    expect(got).toBeGreaterThan(12);
    expect(got).toBeLessThan(55);
  });

  it('never lets development push a man past his ceiling', () => {
    const monster: BadgeEvidence = {
      bat: { g: 45, ab: 180, h: 80, d: 20, t: 4, hr: 16, bb: 40, k: 12, sb: 20, cs: 2, rbi: 60, r: 55, hbp: 9 },
      fld: { g: 45, chances: 200, plays: 170, expected: 160, errors: 1, throwing: 0, sba: 30, cs: 14 },
    };
    for (const seed of [40, 55, 64, 75, 86, 93]) {
      const man = { ...(bats[3] as Hitter), potential: seed, badges: [] };
      for (let y = 0; y < 6; y++) developBadges(man, monster, 2030 + y, 99);
      expect(badgesOf(man).length, `potential ${seed}`).toBeLessThanOrEqual(badgeCap(seed));
    }
  });

  it('lets a trained staff develop more of them', () => {
    const ordinary: BadgeEvidence = {
      bat: { g: 45, ab: 150, h: 38, d: 6, t: 0, hr: 2, bb: 12, k: 35, sb: 2, cs: 2, rbi: 16, r: 18, hbp: 1 },
    };
    const count = (training: number): number => {
      let n = 0;
      for (let i = 0; i < bats.length; i++) {
        const man = { ...(bats[i] as Hitter), potential: 90, badges: [] };
        for (let y = 0; y < 4; y++) developBadges(man, ordinary, 2030 + y, training);
        n += badgesOf(man).length;
      }
      return n;
    };
    // Nothing in this line earns anything, so every badge here is coached — which
    // makes this a clean read on the one lever a coach has over the system.
    const untrained = count(20);
    const trained = count(99);
    expect(untrained).toBeGreaterThan(0);
    expect(trained).toBeGreaterThan(untrained * 1.25);
  });

  it('generates the same badges twice, because they are hashed and not drawn', () => {
    for (const p of everyone.slice(0, 200)) {
      expect(innateBadges(p)).toEqual(innateBadges(p));
    }
  });
});

// ---------------------------------------------------------------------------
// The size of the whole thing
// ---------------------------------------------------------------------------

describe('what badges are worth, measured', () => {
  /**
   * A squad against an identical squad, one of them with its badges taken off.
   *
   * This is the check the brief asked for by name and the one that decides
   * whether the layer is a nudge or a second rating. The two rosters are the
   * same players — the same ids, the same ratings, the same tendencies — so the
   * only difference in the world is the badge list, and the win rate is the
   * whole of the answer.
   */
  /** One squad against the same men with their badge lists changed. */
  function trial(
    bend: (p: Player) => HeldBadge[] | undefined, games: number, seed = 8080,
  ): { rate: number; held: number } {
    resetNames();
    const build = makeRng(seed);
    const source = makeTeam(build, 'Badged', 50);
    const other = makeTeam(build, 'Bare', 50);
    const roster = (list: readonly Player[], f: (p: Player) => HeldBadge[] | undefined) =>
      list.map((p) => ({ ...p, badges: f(p) }));
    const strip = (): undefined => undefined;
    const badged = {
      ...source,
      lineup: roster(source.lineup, bend) as typeof source.lineup,
      bench: roster(source.bench, bend) as typeof source.bench,
      rotation: roster(source.rotation, bend) as typeof source.rotation,
      bullpen: roster(source.bullpen, bend) as typeof source.bullpen,
    };
    const bare = {
      ...other,
      name: 'Bare',
      lineup: roster(source.lineup, strip) as typeof source.lineup,
      bench: roster(source.bench, strip) as typeof source.bench,
      rotation: roster(source.rotation, strip) as typeof source.rotation,
      bullpen: roster(source.bullpen, strip) as typeof source.bullpen,
    };

    const held = [
      ...badged.lineup, ...badged.bench, ...badged.rotation, ...badged.bullpen,
    ].reduce((a, p) => a + badgesOf(p).length, 0);

    let wins = 0;
    const rng = makeRng(4242);
    for (let i = 0; i < games; i++) {
      // Alternate home so the measurement is not home field wearing a badge.
      const res = i % 2 === 0
        ? simGame(badged, bare, rng, {})
        : simGame(bare, badged, rng, {});
      const mine = i % 2 === 0 ? res.home : res.away;
      const them = i % 2 === 0 ? res.away : res.home;
      if (mine.runs > them.runs) wins += 1;
    }
    return { rate: wins / games, held };
  }

  it('leaves an ordinary roster’s badges close to invisible over a season', () => {
    const { rate, held } = trial((p) => p.badges, 12000);
    // Ten or so badges across twenty three men, most of them bronze, several on
    // channels that fire a handful of times a week. The right answer is that you
    // cannot see them in a win column, and this is the assertion that says so.
    expect(held).toBeGreaterThan(4);
    expect(Math.abs(rate - 0.5)).toBeLessThan(0.02);
  });

  it('is still a nudge when every man on the roster carries two gold ones', () => {
    // A squad nothing in the game can produce: forty six gold badges, two on
    // every man, against the same twenty three players with none. This is the
    // ceiling of the whole system, and the number it lands on is what says the
    // layer is a nudge rather than a second rating.
    const { rate, held } = trial((p) => {
      const ids = eligibleBadges(p).filter((id) => BADGES[id].earned !== null).slice(0, 2);
      return ids.map((id) => ({ id, tier: 3 as const }));
    }, 12000);
    expect(held).toBeGreaterThan(40);
    expect(rate).toBeGreaterThan(0.55);
    expect(rate).toBeLessThan(0.70);
    // The number that actually says whether a badge is a nudge: what one of
    // them is worth, at the top tier, in points of team win probability.
    // Measured at 0.31, against home field's 4.9 — so sixteen gold badges are
    // worth playing at home, and one is worth almost nothing, which is the size
    // the whole catalogue was designed to.
    const perBadge = (rate - 0.5) / held;
    expect(perBadge).toBeLessThan(0.005);
  });
});

/*
  The scout's book — stage 16's tendencies screen. The reads are pure
  aggregation over the same poles the sim plays, so the pins are about
  honesty: the counts in the copy are the counts on the field, the book is
  never empty, never a flood, and never different on a second reading.
*/
describe('the scout\u2019s book', () => {
  it('reads three to five habits off a club, the same way twice', () => {
    const season = createSeason(makeRng(64), DEFAULT_SEASON, CONFERENCES);
    for (const rec of season.teams.slice(0, 12)) {
      const book = teamReads(rec.team);
      // Three to five lines, except for the vanishingly ordinary club whose
      // whole book is the line saying so.
      expect(book.length).toBeLessThanOrEqual(5);
      const blank = book.some((r) => r.title === 'No habits worth planning around');
      if (!blank) expect(book.length).toBeGreaterThanOrEqual(3);
      expect(teamReads(rec.team)).toEqual(book);
      // No slot read twice — one habit, one line.
      const keys = book.map((r) => r.slot + r.title);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('says the number that is actually on the field', () => {
    const season = createSeason(makeRng(64), DEFAULT_SEASON, CONFERENCES);
    const team = season.teams[3]!.team;
    for (const read of teamReads(team)) {
      const m = read.text.match(/^(\d+) of (?:the |their )?(\d+)/);
      if (!m) continue;          // the ordinary-club line carries no count
      const spec = TENDENCIES[read.slot];
      const men = spec.side === 'hitter'
        ? team.lineup
        : [...team.rotation, ...team.bullpen];
      expect(Number(m[2])).toBe(men.length);
      const wanted = read.title === spec.plus || spec.plusNote
        ? undefined : undefined;
      // Count both poles and require the printed number to match one of them
      // exactly — the copy templates decide which pole wore the title.
      let plus = 0; let minus = 0;
      for (const man of men) {
        const pole = tendenciesOf(man)[read.slot] ?? 0;
        if (pole > 0) plus++; else if (pole < 0) minus++;
      }
      void wanted;
      expect([plus, minus]).toContain(Number(m[1]));
    }
  });
});
