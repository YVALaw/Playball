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
import { useDynasty } from '../state/store.js';
import { TUTORIALS } from './tutorials.js';

/**
 * Show this screen's first-visit tutorial, if it has one and it is unseen.
 *
 * Drop `<FirstVisit id="roster" />` anywhere in a screen; everything else —
 * whether to show, paging, remembering — is handled here. The id doubles as
 * the key in the copy table and in the save.
 */
export function FirstVisit({ id }: { id: string }) {
  const seen = useDynasty((s) => s.seenTutorials);
  const markSeen = useDynasty((s) => s.markTutorialSeen);
  const pages = TUTORIALS[id];
  const [page, setPage] = useState(0);

  const show = !!pages && pages.length > 0 && !seen.includes(id);

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
  const current = pages[Math.min(page, pages.length - 1)]!;
  const last = page >= pages.length - 1;

  return (
    <div
      className="fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`About this screen: ${current.title}`}
      // Backdrop tap dismisses for good — a tutorial must never trap anybody.
      onClick={() => done.current()}
      style={{
        position: 'absolute', inset: 0, zIndex: 38,
        background: 'rgba(28,36,48,.55)',
        display: 'grid', placeItems: 'end center', padding: 16,
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="rise-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: 'var(--paper)', border: '1px solid var(--faint)',
          borderTop: '3px solid var(--clay)',
          boxShadow: '0 14px 40px rgba(0,0,0,.35)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px 0',
        }}>
          <span className="label" style={{ color: 'var(--clay)', flex: 1 }}>
            FIRST TIME HERE{pages.length > 1 ? ` · ${page + 1} OF ${pages.length}` : ''}
          </span>
          <button
            onClick={() => done.current()}
            className="tap"
            style={{
              padding: '6px 9px', background: 'transparent',
              border: '1px solid var(--faint)', color: 'var(--dim)',
              font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.14em',
            }}
          >SKIP</button>
        </div>
        <div style={{ padding: '8px 12px 12px' }}>
          <div style={{
            font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
          }}>{current.title}</div>
          <div style={{
            marginTop: 7, font: "400 calc(12.5px * var(--ts))/1.55 var(--body)", color: 'var(--ink)',
          }}>{current.body}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 12px 12px',
        }}>
          {pages.length > 1 && pages.map((_, i) => (
            <span key={i} aria-hidden style={{
              width: 7, height: 7, transform: 'rotate(45deg)',
              background: i <= page ? 'var(--clay)' : 'var(--faint)',
            }} />
          ))}
          <div style={{ flex: 1 }} />
          <button
            ref={primary}
            onClick={() => (last ? done.current() : setPage(page + 1))}
            className="tap"
            style={{
              padding: '11px 22px', minHeight: 44,
              background: 'var(--clay)', border: '1px solid var(--clay)',
              color: 'var(--cream)',
              font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.14em',
            }}
          >{last ? 'GOT IT' : 'NEXT'}</button>
        </div>
      </div>
    </div>
  );
}
