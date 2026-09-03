// field-regions.test.ts
// Stage 15: the defense stands where a defense stands, and each man owns a
// region. Pins the two reports that were one bug — "the second baseman goes
// all the way to the pitcher to catch a ball, this one should be caught by
// the pitcher itself" — and the shape of the whole fan, so a future nudge to
// the stations cannot quietly hand the mound's lane back to the middle
// infield.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { regionOwner, STATIONS } from '../src/ui/Diamond3D.js';

const at = (x: number, z: number): number =>
  regionOwner(new THREE.Vector3(x, 0.26, z));

// Station indices, named. Same order STATIONS declares.
const [, P, FIRST, SECOND, SS, THIRD, LF, CF, RF] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

describe('the ball belongs to the man whose ground it dies on', () => {
  it('a ball dying in front of the mound is the pitcher’s, not the second baseman’s', () => {
    // The reported play: a tap that stops between the plate and the mound.
    expect(at(0, -1.2)).toBe(P);
    expect(at(0.4, -2.0)).toBe(P);
    expect(at(-0.5, -1.6)).toBe(P);
  });

  it('the infield splits into four lanes', () => {
    expect(at(2.6, -2.6)).toBe(FIRST);
    expect(at(1.2, -3.6)).toBe(SECOND);
    expect(at(-1.2, -3.6)).toBe(SS);
    expect(at(-2.6, -2.6)).toBe(THIRD);
  });

  it('the outfield splits into thirds', () => {
    expect(at(-4.3, -6.5)).toBe(LF);
    expect(at(0, -7.7)).toBe(CF);
    expect(at(4.3, -6.5)).toBe(RF);
    // The gaps go to whoever’s third they fall in, never to an infielder.
    expect([LF, CF]).toContain(at(-2.6, -6.9));
    expect([CF, RF]).toContain(at(2.6, -6.9));
  });

  it('every station stands inside its own region', () => {
    // The catcher (index 0) never chases and owns no ground; everyone else’s
    // feet must be on ground the partition hands to him, or the picture shows
    // a man sprinting off his own spot to a ball that is already there.
    STATIONS.forEach((s, i) => {
      if (i === 0) return;
      expect(at(s[0], s[2]), `station ${i}`).toBe(i);
    });
  });
});
