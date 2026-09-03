// Tutorial.tsx
// Teaching on arrival, once.
//
// Every screen used to carry its manual in permanent footer text, which is the
// worst of both worlds: a first-time player reads it too late and a veteran
// scrolls past it forever. This is the replacement — a short card the first
// time a screen appears, remembered in the save, replayable from the saves
// screen, and never seen again otherwise.
//
// One component and one copy table (`tutorials.ts`) serve every screen, so a
// new tutorial is a new entry, not a new modal system.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readPrefs } from '../state/devicePrefs.js';
import { useDynasty } from '../state/store.js';
import { TUTORIALS } from './tutorials.js';
import { assistantFor } from '../engine/program.js';

/** "Leonardo Townsend" is the masthead's business; a card just says Townsend. */
const lastName = (full: string): string => full.split(' ').pop() ?? full;

/**
 * Show this screen's first-visit tutorial, if it has one and it is unseen.
 *
 * Drop `<FirstVisit id="roster" />` anywhere in a screen; everything else —
 * whether to show, paging, remembering — is handled here. The id doubles as
 * the key in the copy table and in the save.
 */
export function FirstVisit({ id }: { id: string }) {
  /*
    Who is talking. Decided at 15.5's door: the assistant is "the one
    speaking in the tutorials" — the same right-hand man who signs the inbox,
    so the game has ONE friendly voice teaching it and writing home about it.
    The copy was already written in his register; this is the byline.
  */
  const assistant = useDynasty((s) => assistantFor(s.coach.name));
  const seen = useDynasty((s) => s.seenTutorials);
  const markSeen = useDynasty((s) => s.markTutorialSeen);
  const pages = TUTORIALS[id];
  const [page, setPage] = useState(0);

  /*
    Turned off entirely, for somebody who does not want teaching.

    Read straight from the device preference rather than held in React state,
    because the switch is on another screen and this component may already be
    mounted when it is flipped. Cheap enough to read on every render -- it is a
    JSON parse of five keys from localStorage, done once per screen visit.
  */
  const show = !!pages && pages.length > 0 && !seen.includes(id) && readPrefs().tutorials;

  // A dialog a keyboard can leave. Same contract as Modal: Escape dismisses,
  // focus starts on the safe control and goes home afterwards.
  const done = useRef(() => { markSeen(id); });
  done.current = () => { markSeen(id); };
  const primary = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!show) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); done.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [show]);

  if (!show) return null;

  /*
    Rendered into the app frame rather than in place.

    In place, the scrim's absolute inset:0 resolved against the scrolling
    content, so on any screen taller than the viewport the card — pinned to the
    scrim's bottom — rendered below the fold. Reported from the lineup: 'it
    gets darker like if the tutorial was showing but the card never shows.'
    The frame is the phone, and a dialog covers the phone.
  */
  const frame = document.querySelector('.app-frame');
  if (!frame) return null;
  const current = pages[Math.min(page, pages.length - 1)]!;
  const last = page >= pages.length - 1;

  return createPortal(
    <div
      className="tutorial-scrim fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`About this screen: ${current.title}`}
      // Backdrop tap dismisses for good — a tutorial must never trap anybody.
      onClick={() => done.current()}
    >
      <section className="tutorial-card rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="flow-section-title">
          <span className="label">
            {lastName(assistant).toUpperCase()} SHOWS YOU AROUND
            {pages.length > 1 ? ` · ${page + 1} OF ${pages.length}` : ''}
          </span>
          <button className="tap" type="button" onClick={() => done.current()}>SKIP</button>
        </div>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <footer>
          {pages.length > 1 && pages.map((_, i) => (
            <span key={i} aria-hidden className={i <= page ? 'on' : ''} />
          ))}
          <button
            className="primary-command tap"
            ref={primary}
            type="button"
            onClick={() => (last ? done.current() : setPage(page + 1))}
          >{last ? 'GOT IT' : 'NEXT'}</button>
        </footer>
      </section>
    </div>,
    frame,
  );
}
