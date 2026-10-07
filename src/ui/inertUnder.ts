// inertUnder.ts — the screen under a layer is out of reach (audit 17, M18).
//
// Every layer the app draws (a sheet, a dialog, a tip, the player card, a page
// laid over the frame) is a child of `.app-frame`, beside the header, the tabs,
// the screen and the bottom nav. `aria-modal` traps Tab inside a dialog, but
// the page behind stayed in the accessibility tree: TalkBack read the hidden
// Home screen first and could press Play ball through Settings. Here, while a
// visible layer is up, every other child of the frame is made `inert`: not
// focusable, not clickable, not read. A child that holds a visible layer of
// its own (the June lineup card draws inside its screen) is left alone, so a
// layer is never made inert by the rule meant to protect it.

/** What counts as a layer: anything modal, and the hosts the layers sit in. */
const LAYER = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .pb-tableoverlay, .pb-sheet-host, .pb-dialog-host, .pb-picker-host';

const visible = (el: Element): boolean => el.getClientRects().length > 0;

/** Apply the rule once to one frame. Exported for tests. */
export function applyInert(frame: Element): void {
  const children = Array.from(frame.children);
  const isLayer = (el: Element): boolean => el.matches(LAYER) && visible(el);
  const holds = (el: Element): boolean => isLayer(el) || Array.from(el.querySelectorAll(LAYER)).some(visible);
  const holding = children.map(holds);
  const up = holding.some(Boolean);
  children.forEach((el, i) => {
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return;
    const want = up && !holding[i];
    // Only ever undo what this rule did: a lower overlay slot is inert by its
    // own hand (App.tsx), and stays so.
    if (want) {
      if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); el.setAttribute('data-inert-by', 'layers'); }
    } else if (el.getAttribute('data-inert-by') === 'layers') {
      el.removeAttribute('inert');
      el.removeAttribute('data-inert-by');
    }
  });
}

/**
 * Watch the app and keep the rule true. One observer on the root; the work is
 * batched to a frame, and touches only the frame's direct children.
 */
export function watchInert(root: Element): () => void {
  let queued = 0;
  const run = (): void => {
    queued = 0;
    for (const frame of Array.from(root.querySelectorAll('.app-frame'))) applyInert(frame);
  };
  const schedule = (): void => { if (!queued) queued = requestAnimationFrame(run); };
  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'data-owner', 'aria-hidden'],
  });
  schedule();
  return () => { observer.disconnect(); if (queued) cancelAnimationFrame(queued); };
}
