// OffseasonStep.tsx
// The frame every offseason step shares: the page scrolls, and one bar pinned
// to the bottom moves on. Its button names the next step exactly as the rail
// above does, so "Continue to signing day" goes to signing day, and a world
// with no transfers never offers a transfer portal.

import { useRef, type ReactNode } from 'react';
import { useDynasty, stepsFor, type Phase } from '../../state/store.js';
import { rulesOf } from '../../engine/season.js';
import { prestigeStars } from '../../engine/program.js';
import { flexibleOffseasonBudget } from '../../engine/recruiting.js';
import { ActionBar, Button, Card, Meter } from '../components/ui/index.js';

/** "Continue to …", for each step that can come next. */
const CONTINUE_TO: Record<string, string> = {
  review: 'Continue to your season review',
  coach: 'Continue to coach points',
  draft: 'Continue to the draft',
  portal: 'Continue to the transfer portal',
  recruiting: 'Continue to recruiting',
  signing: 'Continue to signing day',
};

/** The step after this one, in the world's own offseason. */
export function useNextStep(from: Exclude<Phase, null>): Exclude<Phase, null> | null {
  const season = useDynasty((s) => s.season);
  if (!season) return null;
  const steps = stepsFor(rulesOf(season));
  return steps[steps.indexOf(from) + 1] ?? null;
}

export function StepScreen({ children, bar, top }: { children: ReactNode; bar?: ReactNode; top?: ReactNode }) {
  return (
    <div className="pb-stepscreen">
      {top}
      <div className="pb-stepscreen__scroll">{children}</div>
      {bar}
    </div>
  );
}

/**
 * The bar that moves the offseason on. One press means one press: a fast
 * double tap would otherwise skip a step unseen.
 */
export function ContinueBar(
  { from, note, disabled, label, secondary, variant = 'primary', children }:
  {
    from: Exclude<Phase, null>;
    /** What moving on costs, when it costs something. */
    note?: ReactNode;
    disabled?: boolean;
    /** In place of "Continue to …", for the step that does something else. */
    label?: string;
    secondary?: { label: string; onClick: () => void } | null;
    /**
     * The weight of the "Continue to …" button. Outlined while the step still
     * has answers owed that moving on would give for you (the draft's men
     * nobody has spoken to), solid once it has none. UI clarity review,
     * 2026-09-25.
     */
    variant?: 'primary' | 'secondary';
    /** A different primary control altogether (a two-press button). */
    children?: ReactNode;
  },
) {
  const next = useDynasty((s) => s.nextPhase);
  const step = useNextStep(from);
  const lastTap = useRef(0);
  const once = (fn: () => void) => (): void => {
    const now = Date.now();
    if (now - lastTap.current < 600) return;
    lastTap.current = now;
    fn();
  };
  return (
    <ActionBar note={note}>
      {secondary && <Button variant="secondary" onClick={once(secondary.onClick)}>{secondary.label}</Button>}
      {children ?? (
        <Button variant={variant} iconAfter="arrow-right" disabled={disabled} onClick={once(() => void next(from))}>
          {label ?? (step ? CONTINUE_TO[step] ?? 'Continue' : 'Continue')}
        </Button>
      )}
    </ActionBar>
  );
}

/**
 * The one fund the draft and the transfer portal both spend from, called
 * offseason points everywhere. Recruiting has its own weekly points and never
 * touches it.
 */
export function useOffseasonPoints(): { pool: number; draft: number; portal: number; left: number } | null {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const portal = useDynasty((s) => s.portal);
  const rec = season?.teams[userTeam];
  if (!season || !rec) return null;
  const pool = flexibleOffseasonBudget(prestigeStars(rec.prestige));
  const draft = season.draft?.spent ?? 0;
  const portalSpent = portal?.spent ?? 0;
  return { pool, draft, portal: portalSpent, left: pool - draft - portalSpent };
}

export function OffseasonPointsCard(
  { note }: {
    /**
     * A short line at the right of the head, standing in for the line under
     * the meter: the draft's "Same pool as the transfer portal" (UI clarity
     * review, 2026-09-25). Given at all, even as `false`, it replaces that
     * line; left out, the card is as it always was.
     */
    note?: ReactNode;
  },
) {
  const pts = useOffseasonPoints();
  if (!pts) return null;
  const replaced = note !== undefined;
  return (
    <Card eyebrow="Offseason points" title={`${pts.left} of ${pts.pool} left`} trailing={replaced && note ? note : undefined}>
      <Meter value={Math.max(0, pts.left)} max={Math.max(1, pts.pool)} ariaLabel="Offseason points left" />
      {!replaced && (
        <p className="pb-text-muted">
          Shared by the draft and the portal.
          {pts.draft > 0 || pts.portal > 0 ? ` So far: ${pts.draft} in the draft, ${pts.portal} in the portal.` : ''}
        </p>
      )}
    </Card>
  );
}
