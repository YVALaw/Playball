// sound.ts
// The broadcast's ears — stage 14.
//
// One WebAudio context, unlocked by the first user gesture (mobile browsers
// refuse audio before one), a handful of one-shot samples, and a crowd bed
// that idles under the live game and swells with what just happened. The
// samples are the reporter's own freesound pack, trimmed and normalized by
// scripts/prep-sfx.mjs; every call site asks for a *name*, so a better sample
// later is a file swap and not a code change.
//
// Everything checks the device preference at call time — sound landed ON by
// default with the mute in settings, because a silent game that ships its
// sound behind a toggle stays a silent game.

import { readPrefs } from '../state/devicePrefs.js';

type SfxName =
  | 'crack' | 'crack2' | 'glove' | 'glove2' | 'playball' | 'clap' | 'crowd'
  | 'ump-ballfour';

const FILE: Record<SfxName, string> = {
  crack: '/sfx/crack.wav',
  crack2: '/sfx/crack2.mp3',
  glove: '/sfx/glove.wav',
  glove2: '/sfx/glove2.wav',
  playball: '/sfx/playball.wav',
  clap: '/sfx/clap.mp3',
  crowd: '/sfx/crowd.wav',
  'ump-ballfour': '/sfx/ump-ballfour.wav',
};

let ctx: AudioContext | null = null;

/*
  The iPhone's ringer switch.

  Reported from the phone: "there is no sound at all." The files were served
  and decoded fine — iOS simply mutes ALL WebAudio while the hardware switch
  is on silent, the way it mutes a ringtone. HTML5 media is treated as
  playback and is NOT muted, and WebKit sorts the whole page into one bucket
  or the other: play one <audio> element inside a user gesture and the page's
  audio session becomes "playback", after which WebAudio ignores the switch
  too. So the unlock plays a twentieth of a second of silence through an
  <audio> tag. Every serious mobile web game ships this exact trick.
*/
const SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
let promoted = false;
function promoteAudioSession(): void {
  if (promoted || typeof document === 'undefined') return;
  promoted = true;
  try {
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.src = SILENCE;
    el.play().catch(() => { promoted = false; });
  } catch {
    promoted = false;
  }
}
const buffers = new Map<SfxName, AudioBuffer>();
const loading = new Map<SfxName, Promise<AudioBuffer | null>>();

/** The context, created lazily. Null where WebAudio does not exist (tests). */
function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/**
 * Mobile autoplay policy: a context starts suspended until a user gesture.
 * Called from a pointerdown listener the app installs once; safe to call
 * any number of times.
 */
export function unlockAudio(): void {
  promoteAudioSession();
  const a = audio();
  if (a && a.state === 'suspended') void a.resume();
}

/** Whether the context is actually running — the unlock listener's exit test. */
export function audioReady(): boolean {
  return ctx?.state === 'running';
}

function load(name: SfxName): Promise<AudioBuffer | null> {
  const have = loading.get(name);
  if (have) return have;
  const p = (async () => {
    const a = audio();
    if (!a) return null;
    try {
      const res = await fetch(FILE[name]);
      const buf = await a.decodeAudioData(await res.arrayBuffer());
      buffers.set(name, buf);
      return buf;
    } catch {
      // A missing or undecodable file is a silent effect, never a crash.
      return null;
    }
  })();
  loading.set(name, p);
  return p;
}

/**
 * Warm the whole cache. Fire-and-forget.
 *
 * Everything, not a shortlist — the reporter heard cracks landing seconds
 * late, and a first-use fetch+decode on a phone is exactly that long. The
 * entire pack is ~750 KB and it decodes once.
 */
export function preloadSfx(): void {
  for (const name of Object.keys(FILE) as SfxName[]) void load(name);
}

/**
 * One-shot. `rate` varies playback speed (a bat never sounds identical
 * twice); `gain` is linear.
 */
export function sfx(name: SfxName, opts: { gain?: number; rate?: number } = {}): void {
  if (!readPrefs().sound) return;
  const a = audio();
  if (!a) return;
  /*
    Reported from the phone: the raw file played, the dugout stayed silent.
    iOS only grants the audio unlock inside touch-RELEASE events, and almost
    every sfx call here happens inside a React onClick — which is one. So a
    suspended context gets its resume attempt on every call, and the guard
    moved to play time: by then the resume from THIS tap has usually landed,
    and if it has not, the clip is skipped rather than queued (a backlog of
    cracks all firing at the moment of unlock would be worse than silence).
  */
  if (a.state === 'suspended') { void a.resume(); promoteAudioSession(); }
  void load(name).then((buf) => {
    if (!buf || a.state !== 'running') return;
    const src = a.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = a.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(a.destination);
    src.start();
  });
}

// ---------------------------------------------------------------------------
// The crowd bed
// ---------------------------------------------------------------------------

let bedSrc: AudioBufferSourceNode | null = null;
let bedGain: GainNode | null = null;
/** Where the bed sits when nothing is happening. Leverage moves it. */
let bedFloor = 0.12;

/** Start the ambience loop under a live game. Idempotent. */
export function crowdStart(): void {
  if (!readPrefs().sound) return;
  const a = audio();
  if (!a || bedSrc) return;
  if (a.state === 'suspended') { void a.resume(); promoteAudioSession(); }
  void load('crowd').then((buf) => {
    if (!buf || bedSrc || !readPrefs().sound || a.state !== 'running') return;
    bedSrc = a.createBufferSource();
    bedSrc.buffer = buf;
    bedSrc.loop = true;
    bedGain = a.createGain();
    bedGain.gain.value = 0;
    bedSrc.connect(bedGain).connect(a.destination);
    bedSrc.start();
    bedGain.gain.linearRampToValueAtTime(bedFloor, a.currentTime + 1.2);
  });
}

/** Fade the bed out and stop it. The game is over or backgrounded. */
export function crowdStop(): void {
  const a = audio();
  if (!a || !bedSrc || !bedGain) return;
  const src = bedSrc;
  bedGain.gain.linearRampToValueAtTime(0, a.currentTime + 0.8);
  bedSrc = null;
  bedGain = null;
  setTimeout(() => { try { src.stop(); } catch { /* already done */ } }, 900);
}

/**
 * Where the game sits. 0 is a Tuesday in March; 1 is late, close and loud.
 * The bed drifts there rather than jumping — a crowd does not teleport.
 */
export function crowdLeverage(level: number): void {
  const a = audio();
  if (!a || !bedGain) return;
  bedFloor = 0.08 + Math.max(0, Math.min(1, level)) * 0.2;
  bedGain.gain.linearRampToValueAtTime(bedFloor, a.currentTime + 2.5);
}

/** Something happened: swell above the floor, then settle back to it. */
export function crowdSwell(intensity: number): void {
  const a = audio();
  if (!a || !bedGain) return;
  const peak = Math.min(0.7, bedFloor + intensity * 0.5);
  const t = a.currentTime;
  bedGain.gain.cancelScheduledValues(t);
  bedGain.gain.setValueAtTime(bedGain.gain.value, t);
  bedGain.gain.linearRampToValueAtTime(peak, t + 0.25);
  bedGain.gain.linearRampToValueAtTime(bedFloor, t + 2.6 + intensity * 2);
}

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

/** A tap on contact, a thud on outs, a pattern for the night's big moment. */
export function buzz(pattern: number | number[]): void {
  if (!readPrefs().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch { /* not on this device */ }
}
