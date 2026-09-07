// Boundary.tsx — the fence a throw stops at.
//
// React unmounts the whole tree under an uncaught render error: a blank
// white page with no nav, no way back to the start screen and no saves list —
// and because the state that caused it is autosaved, a reload lands in the
// same place. Nothing in the app caught that until the release audit
// (05 §62.6). Two fences now: one around the whole app, whose fallback offers
// a reload and the start screen; one around the 3D field's lazy chunk, whose
// fallback is the 2D diamond, because a chunk that fails to arrive on a bad
// connection rejects rather than suspends and `<Suspense>` never sees it.

import { Component, type ReactNode } from 'react';

export class Boundary extends Component<
  { fallback: (reset: () => void) => ReactNode; onError?: (e: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  override componentDidCatch(e: unknown): void { this.props.onError?.(e); }
  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback(() => this.setState({ failed: false }));
  }
}
