// park.ts — the 3D park's chunk, and a wait for it that cannot hang.
//
// The park is three.js, six hundred kilobytes the app fetches only when a
// game is about to be watched (05 §62.6), and it was fetched through
// React.lazy behind a Suspense whose fallback was THE PARK and three dots.
// Reported 2026-09-15: "the park isn't loading, it just shows the park and
// the loading dots." Suspense waits for as long as the import takes, and an
// import from a dev server that has gone away -- or over a phone's wifi to a
// machine that has stopped answering -- does not fail quickly; it hangs until
// the connection times out, minutes on some stacks, and the dots hold the
// seat the whole time. A rejection reached the fence and the 2D diamond; a
// wait reached nobody.
//
// Two changes. The chunk is asked for at boot, after the first paint
// (`main.tsx`), so it is in memory before the first pitch and a server that
// dies later does not matter to it. And the wait has a patience: the dots
// hold the seat for six seconds, then the 2D diamond takes it, and the park
// takes over from the diamond whenever the chunk does arrive. A failed fetch
// is forgotten, so the next game asks again. Nothing is ever stuck.

import { useEffect, useState } from 'react';

type ParkModule = typeof import('./Diamond3D.js');

let park: ParkModule | null = null;
let arriving: Promise<ParkModule> | null = null;

/** Fetch the chunk, once; a failed fetch is forgotten so the next ask retries. */
export function loadPark(): Promise<ParkModule> {
  if (park) return Promise.resolve(park);
  arriving ??= import('./Diamond3D.js').then(
    (m) => { park = m; return m; },
    (e: unknown) => { arriving = null; throw e; },
  );
  return arriving;
}

/** How long the dots hold the seat before the 2D diamond takes it. */
export const PARK_PATIENCE_MS = 6000;

/**
 * The park's component once it is here, and whether the dots should still
 * hold its seat. `Park` is null until the chunk arrives; `patient` is true
 * until the wait has run out or the fetch has failed. `want` false -- the 2D
 * field chosen in settings -- asks for nothing, so three.js is never fetched.
 */
export function usePark(want: boolean): { Park: ParkModule['Diamond3D'] | null; patient: boolean } {
  const [, arrived] = useState(0);
  const [patient, setPatient] = useState(true);
  useEffect(() => {
    if (!want || park) return;
    let gone = false;
    const timer = setTimeout(() => { if (!gone) setPatient(false); }, PARK_PATIENCE_MS);
    loadPark().then(
      () => { if (!gone) arrived((n) => n + 1); },
      () => { if (!gone) setPatient(false); },
    );
    return () => { gone = true; clearTimeout(timer); };
  }, [want]);
  return { Park: want ? park?.Diamond3D ?? null : null, patient };
}
