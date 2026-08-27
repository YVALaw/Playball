// depth.test.ts
// The rules that keep two ways to play from becoming two games.
//
// The load-bearing one is not tested here because it cannot be: "the engine
// never reads this" is enforced by `architecture.test.ts`, which fails if
// anything under `src/engine` imports the state layer at all. What *is* tested
// here is everything that would quietly rot the mode from the state side —
// overrides that outlive their meaning, presets that stop applying to systems
// added later, and old saves being handed a career they did not choose.

import { describe, it, expect } from 'vitest';
import {
  SYSTEMS, DEFAULT_DEPTH, handles, presetSays, setSystem, setMode,
  normalizeDepth, type DepthSettings,
} from '../src/state/depth.js';

const fresh = (mode: 'full' | 'casual'): DepthSettings => ({ mode, overrides: {} });

describe('the two presets', () => {
  it('gives a full career every decision', () => {
    const d = fresh('full');
    for (const s of SYSTEMS) expect(handles(d, s.key)).toBe(true);
  });

  it('hands a casual career exactly the routine, and nothing else', () => {
    const d = fresh('casual');
    // The two the player chose: a bench coach fills out a card and a pitching
    // coach runs a pen. Everything else — the board, the draft, the big calls —
    // stays his, in both modes.
    expect(handles(d, 'lineups')).toBe(false);
    expect(handles(d, 'bullpen')).toBe(false);
    expect(handles(d, 'recruiting')).toBe(true);
    expect(handles(d, 'draftTalk')).toBe(true);
    expect(handles(d, 'skillPoints')).toBe(true);
  });

  it('never lists a system that would change the world rather than the desk', () => {
    // Rule two, as a test. Injuries, eligibility and realignment are properties
    // of a league of ninety-six programs, so they are on for everybody or off
    // for everybody and can never appear here however natural they look.
    const keys = SYSTEMS.map((s) => s.key as string);
    for (const forbidden of ['injuries', 'academics', 'realignment', 'development']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('says who does it instead, for every single system', () => {
    // A row whose switch is off and whose text still says "you write the card"
    // is lying about the player's own team.
    for (const s of SYSTEMS) {
      expect(s.whenOff.length).toBeGreaterThan(0);
      expect(s.whenOff).not.toBe(s.blurb);
    }
  });
});

describe('a preset is a preset, not a cage', () => {
  it('takes an override and honours it over the preset', () => {
    const d = setSystem(fresh('casual'), 'bullpen', true);
    expect(handles(d, 'bullpen')).toBe(true);
    expect(handles(d, 'lineups')).toBe(false);
  });

  it('stores only disagreements, so the preset keeps meaning something', () => {
    // Setting a system to what the preset already said is not an opinion, and
    // storing it would silently defeat the next preset change.
    const d = setSystem(fresh('casual'), 'recruiting', true);
    expect(d.overrides.recruiting).toBeUndefined();
    expect(Object.keys(d.overrides)).toHaveLength(0);
  });

  it('drops overrides that the new preset agrees with', () => {
    // Full, minus the bullpen. Switching to casual makes that override
    // redundant, because casual says the same thing — and keeping it would
    // leave a career carrying opinions it no longer holds.
    let d = setSystem(fresh('full'), 'bullpen', false);
    expect(d.overrides.bullpen).toBe(false);
    d = setMode(d, 'casual');
    expect(d.overrides.bullpen).toBeUndefined();
    expect(handles(d, 'bullpen')).toBe(false);
  });

  it('keeps an override that still disagrees after the switch', () => {
    let d = setSystem(fresh('full'), 'lineups', false);
    d = setMode(d, 'full');
    expect(handles(d, 'lineups')).toBe(false);
    expect(d.overrides.lineups).toBe(false);
  });

  it('forgets an override once a preset has agreed with it, and that is the deal', () => {
    /*
      A casual coach who takes his own bullpen back has an opinion. Switching to
      full grants it — and at that moment the opinion stops being a
      disagreement, so it is dropped. Coming back to casual, he is casual again,
      bullpen included.

      This is a real trade and it is the right way round. The alternative is a
      career quietly accumulating invisible overrides that outlive the reason
      they were set, so that months later CASUAL does not produce a casual game
      and there is nothing on screen explaining why. Losing a preference the
      player can see and re-set in two taps beats hidden state that makes the
      preset a lie.
    */
    const start = setSystem(fresh('casual'), 'bullpen', true);
    expect(handles(start, 'bullpen')).toBe(true);

    const there = setMode(start, 'full');
    expect(handles(there, 'bullpen')).toBe(true);
    expect(Object.keys(there.overrides)).toHaveLength(0);

    const back = setMode(there, 'casual');
    expect(handles(back, 'bullpen')).toBe(false);
    expect(back).toEqual(fresh('casual'));
  });

  it('carries an override that never stopped disagreeing all the way round', () => {
    // The other half: an opinion neither preset has granted survives both
    // switches, because it has been a disagreement the whole time.
    const start = setSystem(fresh('casual'), 'lineups', true);
    const back = setMode(setMode(start, 'casual'), 'casual');
    expect(handles(back, 'lineups')).toBe(true);
    expect(handles(back, 'bullpen')).toBe(false);
  });
});

describe('what a save carries', () => {
  it('reads a career written before the mode existed as a full one', () => {
    // The only honest answer: those careers were played with every decision in
    // the player's hands, and defaulting them to anything else takes something
    // away from a dynasty already in progress.
    for (const nothing of [undefined, null, 0, '', 'casual', []]) {
      const d = normalizeDepth(nothing);
      expect(d.mode).toBe('full');
      expect(handles(d, 'lineups')).toBe(true);
    }
    expect(normalizeDepth(undefined)).toEqual(DEFAULT_DEPTH);
  });

  it('round-trips a real one', () => {
    const d = setSystem(fresh('casual'), 'bullpen', true);
    expect(normalizeDepth(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('throws away junk field by field rather than all at once', () => {
    const d = normalizeDepth({
      mode: 'casual',
      overrides: { bullpen: true, notASystem: true, lineups: 'yes' },
    });
    expect(d.mode).toBe('casual');
    expect(handles(d, 'bullpen')).toBe(true);
    // The unknown key and the non-boolean are dropped; the good one survives.
    expect(Object.keys(d.overrides)).toEqual(['bullpen']);
    expect(handles(d, 'lineups')).toBe(false);
  });

  it('applies the preset to systems that did not exist when the save was written', () => {
    // The reason overrides store disagreements rather than a full set: a casual
    // career from an older build must pick up the casual answer for anything
    // added since, not silently opt out of it.
    const d = normalizeDepth({ mode: 'casual', overrides: {} });
    for (const s of SYSTEMS) {
      expect(handles(d, s.key)).toBe(presetSays('casual', s.key));
    }
  });
});
