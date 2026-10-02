// predictiveBack.ts
// The layer under the finger during Android's back swipe.
//
// Reported, again, 2026-09-24: "when we drag the screen to go back it still
// shows the card we tap that took us there and then a quick flick". In the
// APK the page only ever heard the release: an armed back callback owns the
// gesture, Android draws nothing of its own for it, so the card sat still
// under the finger for the whole drag and then vanished in one frame. That
// is the flick. Android's own apps move the thing being closed with the
// finger — it shrinks toward the edge being swiped from — and on release it
// finishes leaving, or springs back if the swipe is abandoned.
//
// This is that, for the three shapes a layer comes in here:
//   - a bottom sheet (a prospect's file, a coach's desk): it sinks and the
//     scrim thins, so the screen it covers comes back up underneath;
//   - a full-frame layer (a player card, a room, the inbox): it shrinks and
//     slides toward the swipe, and the live screen under it is uncovered;
//   - the screen itself, going back a route: it shrinks and dims over the
//     frame, and the screen it returns to fades in where it stood.
// The layer is only ever moved; which layer the press peels is `nav.ts`'s
// newest level, and `navTarget.ts` finds what that level shows.
//
// A system that sends only the release (Android 13, the three-button bar)
// gets the same leave animation from rest. No motion is played for a player
// who asked for less of it, or for a page nobody can see.

export type BackKind = 'blocked' | 'sheet' | 'layer' | 'screen' | 'plain' | 'none';

export interface BackTarget {
  kind: BackKind;
  /** What moves: the sheet, the layer's frame, or the scroller of the screen. */
  el?: HTMLElement | null;
  /** A sheet's scrim, which thins as the sheet sinks. */
  host?: HTMLElement | null;
}

type Dir = 1 | -1;

let drag: { t: BackTarget; dir: Dir; p: number } | null = null;
let committing = false;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
/** The finger's progress, eased so the layer answers early and settles late. */
const ease = (p: number): number => 1 - (1 - clamp01(p)) ** 3;

function stillMotion(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState !== 'visible') return true;
  const motion = document.documentElement.dataset.motion;
  if (motion === 'reduced') return true;
  if (motion === 'full') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const movable = (t: BackTarget): t is BackTarget & { el: HTMLElement } =>
  (t.kind === 'sheet' || t.kind === 'layer' || t.kind === 'screen') && !!t.el && t.el.isConnected;

/**
 * Take the layer out of its stylesheet animation for good. An entrance
 * animation that has finished still holds its last frame over an inline
 * transform, and handing the animation back later would replay the entrance.
 */
function hold(t: BackTarget & { el: HTMLElement }): void {
  t.el.style.animation = 'none';
  t.el.style.willChange = 'transform, opacity';
  if (t.host) t.host.style.animation = 'none';
  document.documentElement.dataset.backdrag = t.kind;
}

function paint(t: BackTarget & { el: HTMLElement }, dir: Dir, p: number): void {
  const e = ease(p);
  const s = t.el.style;
  s.transition = 'none';
  if (t.kind === 'sheet') {
    s.transformOrigin = '50% 100%';
    s.transform = `translateY(${(e * 56).toFixed(1)}px) scale(${(1 - 0.06 * e).toFixed(4)})`;
    if (t.host) { t.host.style.transition = 'none'; t.host.style.opacity = (1 - 0.4 * e).toFixed(3); }
    return;
  }
  // Shrunk about its middle and eased toward the side the finger travels, so
  // it floats clear of both edges and more of what is underneath shows on the
  // side the swipe came from.
  s.transformOrigin = '50% 50%';
  s.transform = `translateX(${(dir * e * 12).toFixed(1)}px) scale(${(1 - 0.1 * e).toFixed(4)})`;
  s.borderRadius = `${(e * 26).toFixed(1)}px`;
  s.boxShadow = `0 ${(e * 14).toFixed(1)}px ${(e * 44).toFixed(1)}px rgba(0, 0, 0, ${(e * 0.28).toFixed(3)})`;
  if (t.kind === 'screen') s.opacity = (1 - 0.3 * e).toFixed(3);
}

function clear(t: BackTarget): void {
  if (typeof document !== 'undefined') delete document.documentElement.dataset.backdrag;
  const el = t.el;
  if (el) {
    for (const k of ['transform', 'transformOrigin', 'transition', 'opacity', 'borderRadius', 'boxShadow', 'willChange'] as const) {
      el.style[k] = '';
    }
  }
  if (t.host) { t.host.style.opacity = ''; t.host.style.transition = ''; }
}

/**
 * Two frames on, with a timer behind them: a WebView that stops painting
 * never serves the frames, and a screen left waiting on them would stay
 * invisible.
 */
function twoFrames(cb: () => void): void {
  let fired = false;
  const go = (): void => { if (!fired) { fired = true; cb(); } };
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 60);
}

/** Run `after` when the element's transition ends, or a little after it should have. */
function afterTransition(el: HTMLElement, ms: number, after: () => void): void {
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    el.removeEventListener('transitionend', onEnd);
    after();
  };
  const onEnd = (e: TransitionEvent): void => { if (e.target === el) finish(); };
  el.addEventListener('transitionend', onEnd);
  setTimeout(finish, ms + 60);
}

/** The swipe began: note what it would close, and start moving it. */
export function backStart(t: BackTarget, edge: 'left' | 'right'): void {
  if (committing) return;
  if (drag) clear(drag.t);
  const dir: Dir = edge === 'right' ? -1 : 1;
  drag = { t, dir, p: 0 };
  if (stillMotion() || !movable(t)) return;
  hold(t);
  paint(t, dir, 0);
}

/** The finger moved. */
export function backProgress(p: number): void {
  if (!drag || committing) return;
  drag.p = p;
  const t = drag.t;
  if (stillMotion() || !movable(t)) return;
  paint(t, drag.dir, p);
}

/** The swipe was abandoned: the layer springs back to where it was. */
export function backCancel(): void {
  const d = drag;
  drag = null;
  if (!d || committing) return;
  const t = d.t;
  if (!movable(t)) { clear(t); return; }
  const s = t.el.style;
  s.transition = 'transform 220ms cubic-bezier(.2, .8, .3, 1), opacity 220ms ease, border-radius 220ms ease, box-shadow 220ms ease';
  s.transform = 'none';
  s.opacity = '1';
  s.borderRadius = '0px';
  s.boxShadow = 'none';
  if (t.host) { t.host.style.transition = 'opacity 220ms ease'; t.host.style.opacity = '1'; }
  afterTransition(t.el, 220, () => clear(t));
}

/**
 * The swipe was released (or a press arrived with no swipe at all): finish
 * moving the layer out, then peel it. `peek` names the layer when there was
 * no swipe to learn it from; `main` is the scroller a returning screen fades
 * into.
 */
export function backCommit(peek: () => BackTarget, peel: () => void, main: () => HTMLElement | null): void {
  if (committing) return;
  const d = drag;
  drag = null;
  const t = d?.t ?? peek();
  const dir: Dir = d?.dir ?? 1;
  if (stillMotion() || !movable(t)) {
    if (d) clear(t);
    peel();
    return;
  }
  committing = true;
  hold(t);
  if (!d) paint(t, dir, 0);
  // Read the starting frame before the end state is written, or the browser
  // folds the two into one and there is nothing to animate.
  void t.el.getBoundingClientRect();
  const s = t.el.style;
  const ms = t.kind === 'screen' ? 140 : 190;
  s.transition = `transform ${ms}ms cubic-bezier(.4, 0, 1, 1), opacity ${ms}ms ease-in`;
  if (t.kind === 'sheet') {
    s.transform = 'translateY(105%)';
    if (t.host) { t.host.style.transition = `opacity ${ms}ms ease-in`; t.host.style.opacity = '0'; }
  } else {
    s.transform = `translateX(${dir * 22}%) scale(0.86)`;
    s.opacity = '0';
  }
  afterTransition(t.el, ms, () => {
    const screen = t.kind === 'screen';
    const el = t.el;
    peel();
    committing = false;
    if (!screen) {
      // Normally unmounted by the peel; a layer the press swallowed stays,
      // and must come back as it was.
      twoFrames(() => { if (el.isConnected) clear(t); else if (typeof document !== 'undefined') delete document.documentElement.dataset.backdrag; });
      return;
    }
    // The screen it returns to arrives where this one stood: invisible now,
    // then up to full over two frames' time, after the new screen has rendered.
    // The frame's scroller can be a new element after the swap; a screen
    // inside an overlay (a settings page) is the same element with new rows.
    const next = el.classList.contains('pb-framemain') ? (main() ?? el) : el;
    clear(t);
    next.style.animation = 'none';
    next.style.transition = 'none';
    next.style.opacity = '0';
    next.style.transform = 'scale(0.97)';
    twoFrames(() => arrive(next));
  });
}

/** A screen swapped in under a finished gesture fades up into place. */
export function arrive(el: HTMLElement | null): void {
  if (!el || !el.isConnected) return;
  if (stillMotion()) { el.style.opacity = ''; el.style.transform = ''; el.style.transition = ''; return; }
  const s = el.style;
  if (s.opacity === '') { s.transition = 'none'; s.opacity = '0'; s.transform = 'scale(0.97)'; void el.getBoundingClientRect(); }
  s.transition = 'opacity 180ms ease-out, transform 220ms cubic-bezier(.2, .8, .3, 1)';
  s.opacity = '1';
  s.transform = 'none';
  afterTransition(el, 220, () => { s.transition = ''; s.opacity = ''; s.transform = ''; });
}

/** Tests only. */
export function resetPredictiveBack(): void { drag = null; committing = false; }
