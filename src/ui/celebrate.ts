// celebrate.ts
// Paper in the air, for the two screens allowed to throw it.
//
// The takeover card and awards night both need the same forty pieces of
// confetti, and both need them to respect the motion preference the rest of
// the app already honours. Pure DOM: pieces are absolutely positioned inside
// the host, animated by a keyframe in the stylesheet, and swept up afterwards.

/**
 * Whether this device wants things to move.
 *
 * The settings override wins in either direction; absent one, the OS answers.
 * Mirrors exactly how tokens.css interprets `data-motion`.
 */
export function wantsMotion(): boolean {
  if (typeof document === 'undefined') return false;
  const forced = document.documentElement.getAttribute('data-motion');
  if (forced === 'reduced') return false;
  if (forced === 'full') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * One burst. The host must be positioned; pieces fall through it and are
 * removed as a group. Colours are the school's — a title in your own colours
 * is the point of having colours.
 */
export function burstConfetti(host: HTMLElement, colours: string[]): void {
  if (!wantsMotion() || colours.length === 0) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  for (let i = 0; i < 42; i++) {
    const p = document.createElement('i');
    const w = 5 + Math.random() * 5;
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `width:${w}px`, `height:${w * (0.6 + Math.random())}px`,
      `background:${colours[i % colours.length]}`,
      `animation-delay:${Math.random() * 0.55}s`,
      `animation-duration:${1.5 + Math.random() * 1.2}s`,
      `--drift:${(Math.random() * 90 - 45).toFixed(0)}px`,
      `--spin:${(Math.random() * 640 - 320).toFixed(0)}deg`,
    ].join(';');
    layer.appendChild(p);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 3400);
}
