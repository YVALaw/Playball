// SaveAndLeave.tsx
// The one way out of a career that promises to save first.
//
// Settings' "Save and leave" and the Legacy screen's "End here" both used to
// call backToStart whatever saveNow answered, so a full phone lost every day
// played since the last good write without a word (audit 17, M52). Here the
// career closes only on a save that landed; a failed one says so and offers
// the choice instead.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Button } from './ui/index.js';
import type { IconName } from './ui/Icon.js';

export function SaveAndLeave({ label, block, icon = 'exit' }: { label: string; block?: boolean; icon?: IconName }) {
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const leave = (): void => {
    if (state === 'saving') return;
    setState('saving');
    void useDynasty.getState().saveNow().then((ok) => {
      if (ok) { useDynasty.getState().backToStart(); return; }
      setState('failed');
    }, () => setState('failed'));
  };
  return (
    <>
      <Button variant="secondary" block={block} icon={icon} disabled={state === 'saving'} onClick={leave}>
        {state === 'failed' ? 'Try saving again' : label}
      </Button>
      {state === 'failed' && (
        <>
          <p className="pb-text-muted" role="alert">
            The save did not go through. Leaving now loses everything since your last save.
          </p>
          <Button variant="danger" block={block} onClick={() => useDynasty.getState().backToStart()}>
            Leave without saving
          </Button>
        </>
      )}
    </>
  );
}
