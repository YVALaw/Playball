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

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><App /></StrictMode>,
);
