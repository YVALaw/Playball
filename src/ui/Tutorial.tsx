// Brief tips shown on the first visit to each screen.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { readPrefs } from '../state/devicePrefs.js';
import { useDynasty } from '../state/store.js';
import { TUTORIALS, type TutorialPage } from './tutorials.js';
import { activeGuideStep } from './guide.js';

/** One short explanation and a clear next action. */
export function LessonBody({ page }: { page: TutorialPage }) {
  return <>
    <p>{page.body}</p>
    <div className="tutorial-action">
      <p>{page.action}</p>
    </div>
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
  const touring = activeGuideStep(seen, firstSeason, readPrefs().tutorials) !== null;
  const show = !!pages?.length && !touring && !seen.includes(id) && readPrefs().tutorials;
  const frame = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  const primary = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const close = (): void => { markSeen(id); setPage(0); };
  useDialogFocus(dialog, close, { initial: primary, active: show && frame !== null });
  useEffect(() => { setPage(0); }, [id]);

  if (!pages?.length || touring) return null;
  const current = pages[Math.min(page, pages.length - 1)]!;
  const last = page >= pages.length - 1;

  return <>
    {show && frame && createPortal(
      <div ref={dialog} className="tutorial-scrim fade-in" role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={bodyId} onClick={close}>
        <section className="tutorial-card rise-in" onClick={(e) => e.stopPropagation()}>
          <div className="flow-section-title">
            <span className="label">QUICK TIP{pages.length > 1 ? ` · ${page + 1} OF ${pages.length}` : ''}</span>
            <button className="tap" type="button" onClick={close}>Close</button>
          </div>
          <h2 id={titleId} aria-live="polite">{current.title}</h2>
          <div id={bodyId}><LessonBody page={current} /></div>
          <footer>
            {page > 0 && <button className="tutorial-back tap" type="button" onClick={() => setPage(page - 1)}>Back</button>}
            <button className="primary-command tap" ref={primary} type="button"
              onClick={() => last ? close() : setPage(page + 1)}>{last ? 'GOT IT' : 'NEXT'}</button>
          </footer>
        </section>
      </div>, frame,
    )}
  </>;
}
