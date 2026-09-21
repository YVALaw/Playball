// god/GodBolt.tsx — the bolt that opens god mode for the thing beside it.
//
// Rendered only in a sandbox career; everywhere else it is nothing, so a
// screen can carry one without knowing whether god mode exists. `label` is
// what a screen reader says and what the tooltip shows.

import { useDynasty } from '../../state/store.js';
import { Icon, cx } from '../components/ui/index.js';
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
      className={cx('pb-iconbtn', 'pb-godbolt', className)}
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); openGod(target); }}
    >
      <Icon name="lightning" size={18} />
    </button>
  );
}
