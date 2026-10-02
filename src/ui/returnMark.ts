// returnMark.ts
// The card that took you somewhere, still pressed as you come back — then not.
//
// A phone browser's back swipe previews a snapshot of the page it returns to,
// taken the moment that page was left, which is the moment a card on it was
// tapped. Chrome holds a tapped element's pressed look for at least 150ms, so
// the snapshot has the card pressed (the grey "sunken" row, tile or card), and
// the live page that replaces the snapshot when the swipe lands did not: the
// card jumped from pressed to plain in one frame, one of the flicks reported
// after every swipe (2026-09-24). iOS's own apps do the honest thing here —
// the row you came back to is lit as you arrive and fades out — so this does
// the same: it remembers, per history entry, the card whose tap pushed it,
// and when the back swipe pops that entry the card shows pressed and fades.
//
// Browser only (App.tsx wires it). The APK's gesture previews nothing: the
// page itself moves under the finger (predictiveBack.ts).

/**
 * Exactly the controls whose pressed look is the sunken background
 * (components.css, screens.css): anything else was never pressed-looking in
 * the snapshot, and lighting it would be a flick of its own.
 */
const PRESSED_LOOK = [
  '.pb-row.is-interactive', '.pb-card.is-interactive', '.pb-prow.is-interactive', '.pb-table__row.is-interactive',
  '.pb-gamerow.is-interactive', '.pb-feed.is-interactive', '.pb-tile.is-interactive', '.pb-award.is-interactive',
  'button.pb-staff__head', '.pb-menu > button',
].join(', ');

let lastPress: { el: HTMLElement; at: number } | null = null;

/** Listen for presses. Returns the way to stop. */
export function trackPresses(): () => void {
  const down = (e: PointerEvent): void => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(PRESSED_LOOK) ?? null;
    lastPress = el ? { el, at: performance.now() } : null;
  };
  window.addEventListener('pointerdown', down, { capture: true, passive: true });
  return () => window.removeEventListener('pointerdown', down, { capture: true });
}

/**
 * The ledger's marks (historySync.ts), keyed by the entry's own index rather
 * than stacked, so a refund or a jump of three cannot put them out of step.
 * The old bridge's stack went with its events (CL, 2026-09-30).
 */
const byEntry = new Map<number, HTMLElement | null>();

/**
 * History entry `i` was pushed: remember the card that pushed it, if a tap
 * did, and forget every mark above it.
 */
export function pushMark(i: number): void {
  const recent = lastPress && performance.now() - lastPress.at < 1500 ? lastPress.el : null;
  lastPress = null;
  for (const k of byEntry.keys()) if (k > i) byEntry.delete(k);
  byEntry.set(i, recent);
}

/** The back swipe popped entry `i`: light the card that pushed it, once, and let it fade. */
export function markReturn(i: number): void {
  const el = byEntry.get(i);
  byEntry.delete(i);
  if (!el || !el.isConnected) return;
  el.classList.remove('pb-returned');
  el.classList.add('pb-returning');
  let fired = false;
  const fade = (): void => {
    if (fired) return;
    fired = true;
    el.classList.remove('pb-returning');
    el.classList.add('pb-returned');
    setTimeout(() => el.classList.remove('pb-returned'), 420);
  };
  // Two frames lit, so the first frame after the swipe matches its snapshot.
  requestAnimationFrame(() => requestAnimationFrame(fade));
  setTimeout(fade, 120);
}
