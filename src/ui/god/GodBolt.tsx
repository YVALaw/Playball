// god/GodBolt.tsx — the bolt that opens god mode for the thing beside it.
//
// Rendered only in a sandbox career; everywhere else it is nothing, so a
// screen can carry one without knowing whether god mode exists. `label`
// is what a screen reader says and what the tooltip shows.

import { LightningBoltIcon } from '@radix-ui/react-icons';
import { useDynasty } from '../../state/store.js';
import type { GodTarget } from './target.js';

export function GodBolt(
  { target, label, className }: { target: GodTarget; label: string; className?: string },
) {
  const godMode = useDynasty((s) => s.godMode);
  const openGod = useDynasty((s) => s.openGod);
  if (!godMode) return null;
  return (
    <button
      type="button"
      className={`god-bolt tap${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); openGod(target); }}
    >
      <LightningBoltIcon />
    </button>
  );
}

/** A module intro with a bolt on its right. */
export function GodIntroRow({ children, target, label }: { children: React.ReactNode; target: GodTarget; label: string }) {
  const godMode = useDynasty((s) => s.godMode);
  if (!godMode) return <>{children}</>;
  return (
    <div className="god-intro-row">
      <div>{children}</div>
      <GodBolt target={target} label={label} />
    </div>
  );
}
