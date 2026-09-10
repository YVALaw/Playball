// backNav.ts
// The back gesture: what counts as a layer to peel, and the native seam.
//
// Stage 18b. The handler in App.tsx peels one layer per press in a fixed
// order — a blocking card is swallowed, then the player card, the rival's
// page, the overlay, the tab's sub-screen, the tab itself. `hasLayerToClose`
// is that same order asked a different question: is there anything at all?
// It exists because the answer now has to be known *before* the press, not
// after it. Android 16 decides what the gesture will do — preview an exit,
// or hand it to the app — from whether the app has claimed it, and it asks
// at the start of the drag. So the page tells the shell, every time the
// answer changes, and the shell claims the gesture only while it is true.
//
// Measured on an Android 16 emulator, September 6 2026 (`07` stage 18b):
// with nothing claiming it, the gesture returned to the launcher from any
// depth, and the History-based handler never ran in the APK at all.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { TABS, type Tab } from '../state/store.js';

export interface BackState {
  /** A card that swallows the press rather than obeying it. */
  blocked: boolean;
  playerOpen: boolean;
  teamCardOpen: boolean;
  /** A coaching seat is open as a profile over the Budget. */
  coachOpen?: boolean;
  overlayOpen: boolean;
  /** A god-mode sheet is up. */
  godOpen?: boolean;
  /** True when the in-session route trail has a real previous destination. */
  routeBackAvailable?: boolean;
  tab: Tab;
  screen: string;
}

/** True while a back press has something to do — including swallowing it. */
export function hasLayerToClose(s: BackState): boolean {
  if (s.blocked) return true;
  if (s.godOpen || s.playerOpen || s.coachOpen || s.teamCardOpen || s.overlayOpen) return true;
  if (s.routeBackAvailable) return true;
  const first = TABS.find((t) => t.id === s.tab)?.screens[0]?.id;
  if (first && s.screen !== first) return true;
  return s.tab !== 'home';
}

interface BackPlugin {
  /** Claim or release the system gesture. */
  arm(options: { armed: boolean }): Promise<void>;
  /** Fires when the claimed gesture commits. */
  addListener(event: 'back', listener: () => void): Promise<PluginListenerHandle>;
}

/** The 25-line native side: native/android/com/playball/dynasty/BackPlugin.java, copied into the generated shell by `npm run apk`. */
export const Back = registerPlugin<BackPlugin>('Back');

/** Android APK only. iOS has no BackPlugin and must use WebKit History for edge-swipe navigation. */
export const isNativeShell = (): boolean => Capacitor.getPlatform() === 'android';
