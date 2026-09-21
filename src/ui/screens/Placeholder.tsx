// Placeholder.tsx
// The safety net behind the screen switch. Every id the nav can produce has a
// real screen now, so in ordinary play this never renders; it exists for an id
// nothing routes to yet, and says so plainly rather than pretending a screen is
// on the way.

import { EmptyState } from '../components/ui/index.js';

export function Placeholder({ id }: { id: string }) {
  return (
    <main className="pb-page">
      <EmptyState icon="question" title="Nothing here yet" text={`There is no screen called “${id}” in this version of the game.`} />
    </main>
  );
}
