// Brief tips shown on the first visit to each screen.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { useScreenOwner } from './screenOwner.js';
import { readPrefs } from '../state/devicePrefs.js';
import { seasonPlanShowing, useDynasty } from '../state/store.js';
import { TUTORIALS, type TutorialPage } from './tutorials.js';
import { activeGuideStep } from './guide.js';
import { Icon } from './components/ui/index.js';

/** One short explanation and a clear next action. */
export function LessonBody({ page }: { page: TutorialPage }) {
  return <>
    <p className="pb-text">{page.body}</p>
    <p className="pb-tip__action"><Icon name="arrow-right" size={16} /><span>{page.action}</span></p>
  </>;
}

export function FirstVisit({ id }: { id: string }) {
  const seen = useDynasty((s) => s.seenTutorials);
  const markSeen = useDynasty((s) => s.markTutorialSeen);
  const firstSeason = useDynasty((s) => s.season !== null && s.phase === null && s.history.length === 0);
  const [page, setPage] = useState(0);
  const titleId = useId();
  const bodyId = useId();
  const pages = TUTORIALS[id];
  // A tip never stacks on the Season plan; it waits for the sheet to close.
  const planUp = useDynasty(seasonPlanShowing);
  const touring = activeGuideStep(seen, firstSeason, readPrefs().tutorials) !== null;
  const show = !!pages?.length && !touring && !seen.includes(id) && readPrefs().tutorials && !planUp;
  const frame = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  const primary = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const owner = useScreenOwner();
  const close = (): void => { markSeen(id); setPage(0); };
  useDialogFocus(dialog, close, { initial: primary, active: show && frame !== null, layer: false });
  useEffect(() => { setPage(0); }, [id]);

  if (!pages?.length || touring) return null;
  const current = pages[Math.min(page, pages.length - 1)]!;
  const last = page >= pages.length - 1;

  return <>
    {show && frame && createPortal(
      <div ref={dialog} className="pb-tip-host" data-owner={owner} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={bodyId} onClick={close}>
        <section className="pb-tip" onClick={(e) => e.stopPropagation()}>
          <header className="pb-tip__head">
            <span className="pb-tip__mark" aria-hidden><Icon name="question" size={20} /></span>
            <span className="pb-tip__titles">
              <span className="pb-eyebrow">Quick tip{pages.length > 1 ? ` \u00b7 ${page + 1} of ${pages.length}` : ''}</span>
              <h2 id={titleId} className="pb-tip__title" aria-live="polite">{current.title}</h2>
            </span>
            <button className="pb-icon-btn" type="button" aria-label="Close" onClick={close}><Icon name="cross" size={20} /></button>
          </header>
          <div id={bodyId} className="pb-tip__body"><LessonBody page={current} /></div>
          <footer className="pb-tip__foot">
            {page > 0 && <button className="pb-btn pb-btn--secondary pb-btn--md" type="button" onClick={() => setPage(page - 1)}><span className="pb-btn__label">Back</span></button>}
            <button className="pb-btn pb-btn--primary pb-btn--md" ref={primary} type="button"
              onClick={() => last ? close() : setPage(page + 1)}><span className="pb-btn__label">{last ? 'Got it' : 'Next'}</span></button>
          </footer>
        </section>
      </div>, frame,
    )}
  </>;
}
