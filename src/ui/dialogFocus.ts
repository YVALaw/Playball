// dialogFocus.ts
// The keyboard contract every dialog in the app shares.
//
// The app is built for thumbs, but it runs in a browser today, and for a long
// time every sheet was a div: no Escape, focus left sitting behind the scrim
// on whatever opened it, Tab walking out into the page underneath. Modal.tsx
// has had the answer since August; this is that answer as a hook, so the
// bottom sheets — the dugout picker, an open letter, a recruiting file, a
// portal signing, a retention call, the opponent library — carry it too.
//
// On open, focus moves to the safest control: a CLOSE button by preference,
// otherwise the first thing inside that can take it, so Enter on a fresh
// dialog closes and never destroys. Tab and Shift+Tab stay inside. Escape
// dismisses, and only the topmost dialog answers it, so a confirm laid over a
// sheet does not close both. When the dialog goes, focus goes home to the
// element that opened it.

import { useEffect, useRef, type RefObject } from 'react';

const TABBABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** The dialogs open right now, oldest first. Escape belongs to the last. */
const open: symbol[] = [];

export function useDialogFocus(
  dialog: RefObject<HTMLElement | null>,
  dismiss: () => void,
  opts: {
    /** Where focus lands on open. Default: the first tabbable inside. */
    initial?: RefObject<HTMLElement | null>;
    /** For a dialog rendered inline behind a flag rather than mounted on its own. */
    active?: boolean;
  } = {},
): void {
  const { initial, active = true } = opts;
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    if (!active) return undefined;
    const token = Symbol('dialog');
    open.push(token);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = initial?.current
      ?? dialog.current?.querySelector<HTMLElement>(TABBABLE)
      ?? dialog.current;
    first?.focus();
    const onKey = (e: KeyboardEvent): void => {
      // A guided spotlight may already have handled navigation between its
      // target dialog and tour controls. Do not apply a second focus move.
      if (e.defaultPrevented) return;
      if (open[open.length - 1] !== token) return;
      if (e.key === 'Escape') { e.stopPropagation(); dismissRef.current(); return; }
      if (e.key !== 'Tab') return;
      const box = dialog.current;
      if (!box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(TABBABLE));
      if (items.length === 0) { e.preventDefault(); return; }
      const head = items[0]!;
      const tail = items[items.length - 1]!;
      const at = document.activeElement;
      const inside = at instanceof Node && box.contains(at);
      if (e.shiftKey ? (!inside || at === head) : (!inside || at === tail)) {
        e.preventDefault();
        (e.shiftKey ? tail : head).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(token), 1);
      opener?.focus();
    };
    // The refs are stable boxes; `active` is the only input that changes.
  }, [active]);
}
