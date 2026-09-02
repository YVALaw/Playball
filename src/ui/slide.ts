// slide.ts
// The sliding indicator every tab strip shares.
//
// Asked for globally: "in the subtabs, i would also like to have an animation
// globally... the color transitioning from left to right... same with the line
// in the main nav bar." One hook, three wearers — Segmented's clay fill,
// ContextNav's underline, PrimaryNav's top line — so the gesture reads the
// same everywhere, which is the point of asking for it globally.
//
// How it works: the container gets two CSS custom properties, measured from
// the active button (`--slide-x`, `--slide-w`), and a `data-slide` attribute
// saying the measurement is live. A `::before` on the container is the
// indicator, and CSS transitions carry it from the old numbers to the new.
// The old per-button paint (the clay fill, the underline) stays in the
// stylesheet as the fallback and is switched off under `[data-slide]` — a
// container this hook never touched looks exactly as it always did.
//
// Measured every commit rather than on a dependency list: the strips re-render
// when their tab changes, labels change under the same tab about never, and
// two style writes are cheaper than being wrong about staleness. The
// ResizeObserver catches what renders cannot — text-size changes, rotation,
// the frame resizing under a desktop window.

import { useLayoutEffect, useRef, type RefObject } from 'react';

function measure(el: HTMLElement | null, inset: number): void {
  if (!el) return;
  const on = el.querySelector<HTMLElement>('button.active');
  if (!on) {
    // No active button is a strip mid-transition or misconfigured; take the
    // indicator away rather than leaving it on a stale spot.
    el.removeAttribute('data-slide');
    return;
  }
  el.setAttribute('data-slide', 'on');
  el.style.setProperty('--slide-x', `${on.offsetLeft + inset}px`);
  el.style.setProperty('--slide-w', `${Math.max(0, on.offsetWidth - inset * 2)}px`);
}

/**
 * Attach to a tab-strip container whose active button wears `.active`.
 *
 * `inset` shrinks the indicator symmetrically inside the button — the
 * context-nav's underline has always stopped 12px short of each edge, and the
 * slide keeps that shape.
 */
export function useSlide<E extends HTMLElement>(inset = 0): RefObject<E | null> {
  const ref = useRef<E | null>(null);

  // Every commit, no dependency list, idempotent — StrictMode's double call
  // measures the same numbers twice.
  useLayoutEffect(() => { measure(ref.current, inset); });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el, inset));
    ro.observe(el);
    return () => ro.disconnect();
  }, [inset]);

  return ref;
}
