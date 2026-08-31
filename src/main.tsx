import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.js';
import { readPrefs, applyPrefs } from './state/devicePrefs.js';
import './ui/tokens.css';
// The design of record, then the dozen rules that hang it off a flex column
// instead of a simulated phone. Order matters: the frame file overrides.
import './ui/prototype.css';
import './ui/prototype-frame.css';

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

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><App /></StrictMode>,
);
