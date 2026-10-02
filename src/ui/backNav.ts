// backNav.ts
// The native seam of the back gesture.
//
// Stage 18b. Android 16 decides what the gesture will do — preview an exit,
// or hand it to the app — from whether the app has claimed it, and it asks
// at the start of the drag. So the page tells the shell, every time the
// answer changes, and the shell claims the gesture only while there is
// something to peel or refuse: `nav.depth() > 0` in App.tsx. Since CL
// (2026-09-30) `nav.ts` is the only count; this file kept a copy until then.
//
// Measured on an Android 16 emulator, September 6 2026 (`07` stage 18b):
// with nothing claiming it, the gesture returned to the launcher from any
// depth, and the History-based handler never ran in the APK at all.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** Where the finger is during a claimed back swipe (Android 14 and later). */
export interface BackMotion {
  /** 0 at the edge, 1 at the far side. */
  progress: number;
  /** The edge the swipe started from. */
  edge: 'left' | 'right';
  x: number;
  y: number;
}

interface BackPlugin {
  /** Claim or release the system gesture. */
  arm(options: { armed: boolean }): Promise<void>;
  /** Fires when the claimed gesture commits (and for a press with no swipe at all). */
  addListener(event: 'back' | 'backCancel', listener: () => void): Promise<PluginListenerHandle>;
  /** The swipe began, and each move of the finger after it. */
  addListener(event: 'backStart' | 'backProgress', listener: (motion: BackMotion) => void): Promise<PluginListenerHandle>;
}

/** The 25-line native side: native/android/com/playball/dynasty/BackPlugin.java, copied into the generated shell by `npm run apk`. */
export const Back = registerPlugin<BackPlugin>('Back');

/** Android APK only. iOS has no BackPlugin and must use WebKit History for edge-swipe navigation. */
export const isNativeShell = (): boolean => Capacitor.getPlatform() === 'android';
