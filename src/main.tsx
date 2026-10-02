import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.js';
import { Boundary } from './ui/Boundary.js';
import { useDynasty } from './state/store.js';
import { readPrefs, applyPrefs } from './state/devicePrefs.js';
import './ui/tokens.css';
// The design of record, then the dozen rules that hang it off a flex column
// instead of a simulated phone. Order matters: the frame file overrides.
import './ui/prototype.css';
import './ui/prototype-frame.css';
import './ui/program.css';
// Shape last: one file assigns every corner in the app from the three radius
// tokens, so a radius is never written beside a screen's own rules.
import './ui/rounded-ui.css';
// Playball 1.0 minimal mobile visual system. Keep this last: it is the deliberate
// replacement skin for the legacy tabletop styling while preserving behaviour.
import './ui/minimal-ui.css';
// The design system: tokens, then its components. Last, so where a legacy
// rule and a design-system rule meet, the design system wins.
import './ui/design/tokens.css';
import './ui/design/components.css';
import './ui/design/screens.css';
// The UI clarity review (2026-09-25), one file per area so each screen's
// rules sit together: design/UI Clarity Review holds the mockups they follow.
import './ui/design/draft.css';
import './ui/design/roster.css';
import './ui/design/lineup.css';
import './ui/design/recruiting.css';
import './ui/design/office.css';
import './ui/design/terms.css';

/*
  Preferences before the first paint.

  Text size is a CSS variable every font size in the app multiplies against, so
  applying it inside a component would mean rendering the whole app once at the
  wrong size and then reflowing it. Reading `localStorage` synchronously here
  costs a fraction of a millisecond and means a player who chose LARGER never
  sees the small version flash past.
*/
applyPrefs(readPrefs());

// The store on the console, dev server only. Costs nothing in a build and
// makes 'drive the season to recruiting and poke the board' a one-liner
// instead of an afternoon of tapping.
if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
  void import('./state/store.js').then((m) => {
    (window as unknown as { store: unknown }).store = m.useDynasty;
  });
}

/*
  The fence around the whole app (05 §62.6). A render throw used to unmount
  everything to a blank page, and because the state that caused it is
  autosaved, a reload landed in the same place. The fallback offers the two
  ways out: try again, or the start screen — `backToStart` puts the career
  down without touching the disk.
*/
function crashed(reset: () => void) {
  return (
    <div className="app-crash" role="alert">
      <small>SOMETHING BROKE</small>
      <strong>The screen could not be drawn.</strong>
      <p>Your career is saved as it was before this screen. Try again, or go back to the start and open it from there.</p>
      <div>
        <button type="button" className="tap" onClick={reset}>TRY AGAIN</button>
        <button type="button" className="tap" onClick={() => { useDynasty.getState().backToStart(); reset(); }}>BACK TO START</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><Boundary fallback={crashed}><App /></Boundary></StrictMode>,
);

/*
  The boot splash (index.html) holds the screen while the bundle loads, and
  leaves once the app has drawn — but never before a beat has passed since
  launch, so it reads as the game's front door rather than a flash.
  `performance.now()` counts from the moment the page started loading. A plain
  timer, not an animation frame: frames stop while a page is hidden, and a
  splash must never outstay an app opened in the background.
*/
const splash = document.getElementById('boot-splash');
if (splash) {
  const SPLASH_MS = 1200;
  window.setTimeout(() => {
    splash.classList.add('is-gone');
    window.setTimeout(() => splash.remove(), 420);
  }, Math.max(0, SPLASH_MS - performance.now()));
}

/*
  The park, fetched while nobody is waiting for it.

  Three.js is the one chunk the app loads late, and the first pitch was the
  first time anybody asked for it -- over a phone's wifi to a dev server that
  may have stopped answering by then (see `ui/park.ts`). Asked for a few
  seconds after the first paint instead, so it is in memory before the first
  game; unless the field is the 2D diamond by choice, in which case it is
  never fetched at all (05 §62.6).
*/
if (readPrefs().field !== '2d') {
  setTimeout(() => {
    void import('./ui/park.js').then((m) => m.loadPark()).catch(() => undefined);
  }, 3000);
}
