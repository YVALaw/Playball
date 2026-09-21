// BoardGoals.tsx
// The board's asks, as a board of them.
//
// Reported 2026-09-20: "in the board goals I prefer if it is a grid instead of
// a list". A list of five rows reads as a queue — one thing after another, each
// with a status you have to track back along the row. Four or five goals is a
// scoreboard, and a scoreboard is read at a glance: state first, in the corner
// of the eye, then the goal, then the number.
//
// One component for both places that show them — the board's room during the
// season, and the season review that grades them — so the two can never drift
// into saying the same thing two ways.

import type { Objective } from '../../engine/program.js';
import { StatusBadge } from '../components/ui/index.js';
import { cx } from '../components/ui/core.js';

/** Where a goal stands: met, missed for good, or still open. */
export type GoalState = 'met' | 'missed' | 'open';

const WORD: Record<GoalState, string> = { met: 'Met', missed: 'Missed', open: 'Open' };

export function GoalGrid({
  objectives, state, progress, label = "The board's goals",
}: {
  objectives: readonly Objective[];
  state: (o: Objective) => GoalState;
  /** "21/33" while a counted goal is still running. */
  progress?: (o: Objective) => string | undefined;
  label?: string;
}) {
  return (
    <div className="pb-goalgrid" role="list" aria-label={label}>
      {objectives.map((o) => {
        const at = state(o);
        const count = progress?.(o);
        return (
          <div key={o.key} role="listitem" className={cx('pb-goal', `is-${at}`)}>
            <span className="pb-goal__state">
              <StatusBadge
                tone={at === 'met' ? 'positive' : at === 'missed' ? 'negative' : 'neutral'}
                icon={at === 'met' ? 'check' : at === 'missed' ? 'cross-circled' : false}
              >
                {WORD[at]}
              </StatusBadge>
            </span>
            <span className="pb-goal__label">{o.label}</span>
            <span className="pb-goal__meta">
              {o.required ? 'Required' : 'Bonus'}
              {count ? ` · ${count}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
