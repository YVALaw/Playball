// screenOwner.ts
// Which screen a sheet, tip or dialog belongs to.
//
// Every sheet renders into the app frame, outside the screen that opened it,
// so a screen the season frame keeps alive but hidden (App's `keptAlive`)
// left its tip or sheet on top of the one the back gesture returned to — a
// Stats tip over Roster that "Got it" could not close, two "Open seat" sheets
// (2026-09-30). Each portal root now carries its screen's name, and one rule
// in the frame hides every portal whose screen is not the one on show.

import { createContext, useContext } from 'react';

/** Outside any kept-alive screen: the frame itself, never hidden. */
export const FRAME_OWNER = 'frame';

export const ScreenOwner = createContext<string>(FRAME_OWNER);

/** The owner a portal root puts in its `data-owner`. */
export function useScreenOwner(): string {
  return useContext(ScreenOwner);
}

/**
 * The frame's rule: every owned portal but the live screen's is hidden. A
 * rule rather than an effect, so a portal that opens while its screen is
 * hidden (a tip waiting on the Season plan) is hidden from its first frame.
 * The overlays' slots answer to their own rule below.
 */
export function ownerRule(live: string): string {
  const quoted = live.replace(/[\\"]/g, (c) => `\\${c}`);
  return `.app-frame [data-owner]:not([data-owner="${FRAME_OWNER}"]):not([data-owner^="${SLOT}"]):not([data-owner="${quoted}"]){display:none!important}`;
}

/*
  The overlays stack, and the ones under the top stay mounted (back plan S5,
  2026-09-30): the Inbox under the standings came back at the top of its
  letters. Each slot owns its portals, and only the top slot's are drawn, in
  every frame the overlays appear in.
*/
const SLOT = 'o:';

/** Whether a portal belongs to an overlay slot rather than a screen or the frame. */
export function isOverlayOwner(owner: string): boolean {
  return owner.startsWith(SLOT);
}

/** The owner of overlay slot `i`, bottom first. */
export function overlayOwner(i: number): string {
  return `${SLOT}${i}`;
}

/** Every overlay slot's portals hidden but the top one's. */
export function overlayRule(top: number): string {
  return `.app-frame [data-owner^="${SLOT}"]:not([data-owner="${overlayOwner(top)}"]){display:none!important}`;
}

/**
 * The last of these that is drawn. A hidden screen's copy of a sheet (the
 * coach seat both staff rooms render) comes last in the frame and has no box,
 * so the Android back gesture moves the one on show instead. Nothing drawn:
 * the last, as before.
 */
export function lastShown<T extends { getClientRects(): { length: number } }>(all: ArrayLike<T>): T | null {
  for (let i = all.length - 1; i >= 0; i -= 1) {
    if (all[i]!.getClientRects().length > 0) return all[i]!;
  }
  return all[all.length - 1] ?? null;
}
