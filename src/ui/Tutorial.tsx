// The card a screen shows the first time it opens (tutorials.ts).
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { useScreenOwner } from './screenOwner.js';
import { readPrefs } from '../state/devicePrefs.js';
import { seasonPlanShowing, useDynasty } from '../state/store.js';
import { TUTORIALS } from './tutorials.js';
import { Icon } from './components/ui/index.js';

export function FirstVisit({ id }: { id: string }) {
  const seen = useDynasty((s) => s.seenTutorials);
  const markSeen = useDynasty((s) => s.markTutorialSeen);
  const titleId = useId();
  const bodyId = useId();
  const card = TUTORIALS[id];
  // A tip never stacks on the Season plan; it waits for the sheet to close.
  const planUp = useDynasty(seasonPlanShowing);
  const show = !!card && !seen.includes(id) && readPrefs().tutorials && !planUp;
  const frame = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  const primary = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const owner = useScreenOwner();
  const close = (): void => markSeen(id);
  // A back layer like any other card: back closes the tip, never the screen under it (M44).
  useDialogFocus(dialog, close, { initial: primary, active: show && frame !== null });

  if (!card || !show || !frame) return null;
  return createPortal(
    <div ref={dialog} className="pb-tip-host" data-owner={owner} role="dialog" aria-modal="true"
      aria-labelledby={titleId} aria-describedby={bodyId} onClick={close}>
      <section className="pb-tip" onClick={(e) => e.stopPropagation()}>
        <header className="pb-tip__head">
          <span className="pb-tip__mark" aria-hidden><Icon name="question" size={20} /></span>
          <span className="pb-tip__titles">
            <span className="pb-eyebrow">Quick tip</span>
            <h2 id={titleId} className="pb-tip__title">{card.title}</h2>
          </span>
          <button className="pb-icon-btn" type="button" aria-label="Close" onClick={close}><Icon name="cross" size={20} /></button>
        </header>
        <div id={bodyId} className="pb-tip__body">
          <p className="pb-text">{card.body}</p>
          <p className="pb-tip__action"><Icon name="arrow-right" size={16} /><span>{card.action}</span></p>
        </div>
        <footer className="pb-tip__foot">
          <button className="pb-btn pb-btn--primary pb-btn--md" ref={primary} type="button" onClick={close}>
            <span className="pb-btn__label">Got it</span>
          </button>
        </footer>
      </section>
    </div>, frame,
  );
}
