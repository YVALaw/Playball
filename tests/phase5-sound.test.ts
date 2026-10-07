// phase5-sound.test.ts
// docs/18-fix-plan.md Phase 5: the crowd answers the Sound switch mid-game
// (audit 17, L61), and the app in the background goes quiet (M39).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { log, stored, listeners } = vi.hoisted(() => {
  const log = [] as string[];
  const stored = new Map<string, string>();
  const listeners = new Map<string, Array<() => void>>();
  class FakeContext {
    state: 'running' | 'suspended' = 'running';
    currentTime = 0;
    destination = {};
    async resume(): Promise<void> { this.state = 'running'; log.push('resume'); }
    async suspend(): Promise<void> { this.state = 'suspended'; log.push('suspend'); }
    async decodeAudioData(): Promise<object> { return {}; }
    createGain(): object {
      return { gain: { value: 0, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setValueAtTime: () => {} }, connect: (n: unknown) => n };
    }
    createBufferSource(): object {
      return { connect: (n: unknown) => n, start: () => log.push('bed on'), stop: () => log.push('bed off') };
    }
  }
  const g = globalThis as unknown as Record<string, unknown>;
  g.AudioContext = FakeContext;
  g.window = { AudioContext: FakeContext, localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); } } };
  g.document = {
    hidden: false,
    createElement: () => ({ play: async () => {} }),
    addEventListener: (t: string, f: () => void) => { listeners.set(t, [...(listeners.get(t) ?? []), f]); },
  };
  g.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(0) });
  return { log, stored, listeners };
});
const g = globalThis as unknown as Record<string, unknown>;
void stored;

import { crowdStart, crowdStop, setSoundEnabled, sfx } from '../src/ui/sound.js';
import { writePrefs, DEFAULT_PREFS } from '../src/state/devicePrefs.js';

const settle = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
const sound = (on: boolean): void => writePrefs({ ...DEFAULT_PREFS, sound: on });

beforeEach(() => { log.length = 0; sound(true); });

describe('the crowd answers the Sound switch mid-game (L61)', () => {
  it('stops when Sound goes off, and comes back when it goes on while the game is on', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'], shouldAdvanceTime: true });
    try {
      crowdStart();
      await settle();
      expect(log).toEqual(['bed on']);
      sound(false); setSoundEnabled(false);
      vi.advanceTimersByTime(1000);
      expect(log).toEqual(['bed on', 'bed off']);
      sound(true); setSoundEnabled(true);
      await settle();
      expect(log).toEqual(['bed on', 'bed off', 'bed on']);
      // After the game, turning Sound on starts nothing.
      crowdStop();
      vi.advanceTimersByTime(1000);
      sound(false); setSoundEnabled(false);
      sound(true); setSoundEnabled(true);
      await settle();
      expect(log.filter((x) => x === 'bed on')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the background is quiet (M39)', () => {
  it('suspends on hidden and on the shell pause, resumes on return', async () => {
    const doc = g.document as { hidden: boolean };
    crowdStart();
    await settle();
    log.length = 0;
    doc.hidden = true;
    for (const f of listeners.get('visibilitychange') ?? []) f();
    expect(log).toContain('suspend');
    log.length = 0;
    sfx('playball');
    await settle();
    expect(log, 'no one-shot while hidden').toEqual([]);
    doc.hidden = false;
    for (const f of listeners.get('visibilitychange') ?? []) f();
    expect(log).toContain('resume');
    log.length = 0;
    for (const f of listeners.get('pause') ?? []) f();
    expect(log).toContain('suspend');
    crowdStop();
  });
});
