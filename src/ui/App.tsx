// App.tsx
// The four frames the game can be in — the regular season, the offseason, the
// postseason and the job search — and the furniture each of them wears.
//
// The furniture itself moved to Chrome.tsx during the Roster Tabletop port. It
// was written inline here four times over, once per frame, out of the same
// handful of ideas, and two of the four had already drifted. What is left in
// this file is which frame you are in and what goes in each of its slots, which
// is the only part that was ever different between them.
//
// design/Roster Tabletop/ is the design of record.

import { regularRecord } from '../engine/season.js';
import { useShallow } from 'zustand/react/shallow';
import {
  Activity, memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type ReactNode,
} from 'react';
import { keptAlive, leftScroll, rememberScroll, scrollId, type Alive } from './keptAlive.js';
import * as nav from '../state/nav.js';
import { browserDeps, installHistorySync, type HistorySync } from './historySync.js';
import { domQuery, levelHolder, movesScreen, toTarget } from './navTarget.js';
import { arrive, backCancel, backCommit, backProgress, backStart } from './predictiveBack.js';
import { markReturn, pushMark, trackPresses } from './returnMark.js';
import { Modal } from './Modal.js';
import { applyTeamAccent } from './accent.js';
import { audioReady, preloadSfx, unlockAudio } from './sound.js';
import { BigMomentCard } from './BigMoment.js';
import { teamColour } from './Avatar.js';
import { Button, Callout, Icon, List, ListRow, ScreenHeader, StatGroup, Stars, type IconName } from './components/ui/index.js';
import {
  PHASES, PHASE_LABEL, railSteps, closedStep, TABS, useDynasty, useUserTeam,
  isRoom,
  type Tab, type Overlay as OverlayName,
} from '../state/store.js';
import { Back, isNativeShell } from './backNav.js';
import { initBilling } from '../state/billing.js';
import { TEST_SHORTCUTS } from '../state/testBuild.js';
import { eraKey, frameOf } from '../state/era.js';
import { readPrefs, writePrefs, applyPrefs } from '../state/devicePrefs.js';
import { StepRail } from './StepRail.js';
import { Overlay } from './Overlay.js';
import { ScreenOwner, overlayOwner, overlayRule, ownerRule } from './screenOwner.js';
import { AreaNav, SchoolHeader, SectionTabs } from './Chrome.js';
import { capsWords, conferenceName, plural, recordText } from './words.js';
import { Today } from './screens/Today.js';
import { Standings, StandingsScreen } from './screens/Standings.js';
import { Roster } from './screens/Roster.js';
import { Schedule } from './screens/Schedule.js';
import { Stats } from './screens/Stats.js';
import { Lineup } from './screens/Lineup.js';
import { Awards } from './screens/Awards.js';
import { Manage } from './screens/Manage.js';
import { AlumniScreen, History } from './screens/History.js';
import { Player } from './screens/Player.js';
import { Program } from './screens/Program.js';
import { RoomScreen } from './screens/Rooms.js';
import { Captain } from './screens/Captain.js';
import { JobMarket } from './screens/JobMarket.js';
import { Portal } from './screens/Portal.js';
import { NewGame } from './screens/NewGame.js';
import { StrategyScreen } from './screens/StrategyScreen.js';
import { Placeholder } from './screens/Placeholder.js';
import { Board } from './screens/Board.js';
import { GodOverlay } from './god/GodSheet.js';
import { GodBolt } from './god/GodBolt.js';
import { SeasonReview } from './screens/SeasonReview.js';
import { SeasonTerms } from './screens/SeasonTerms.js';
import { SeasonPlan } from './screens/SeasonPlan.js';
import { CoachPoints } from './screens/CoachPoints.js';
import { SigningDay } from './screens/SigningDay.js';
import { Postseason } from './screens/Postseason.js';
import { Rankings } from './screens/Rankings.js';
import { JobSearch } from './screens/JobSearch.js';
import { Legacy } from './screens/Legacy.js';
import { Draft } from './screens/Draft.js';
import { Wire } from './screens/Wire.js';
import { Inbox } from './screens/Inbox.js';
import { RecordBook } from './screens/RecordBook.js';
import { unreadCount } from '../engine/inbox.js';
import { Saves } from './screens/Saves.js';
import { OpenTeam, TeamCard } from './screens/TeamCard.js';
import { GuidedStretch } from './GuidedStretch.js';
import { Colleges } from './screens/Colleges.js';
import { Settings } from './screens/Settings.js';
import { Start } from './screens/Start.js';
import { prestigeStars } from '../engine/program.js';
import { teamReads } from '../engine/tendencies.js';

/**
 * How a table row opens a rival's page.
 *
 * The conference table and the national rankings render in two places apiece,
 * so the way in is a context rather than a callback threaded through four call
 * sites. The card itself lives in the store now, beside `selectedPlayer`, so
 * the back gesture sees it as one more level (back plan SW, 2026-09-30).
 * Stable on purpose: a version that was a new function on every render once
 * closed the card it had just opened ("tap SCOUT and it just flashes").
 */
const openTeamCard = (index: number): void => { useDynasty.getState().openTeamCard(index); };

/** The dev server's build: the ledger shows itself on the console as `__nav` (the probe reads it). */
const DEV = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

/** The app: the accent, the audio unlock, and the body with its frames. */

/** Once per launch, however often the store reports its receipts. */
let unownedCounted = false;

/** Launches in a row on which Google Play said god mode is not owned. Read with no argument. */
function notOwnedRuns(set?: number): number {
  const KEY = 'playball.billing.unowned';
  try {
    if (set !== undefined) { window.localStorage.setItem(KEY, String(set)); return set; }
    return Number(window.localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}
export function App() {
  /*
    Your school's colours, worn by the whole app.

    Proposed from play: 'instead of white and green, the green accent is
    changed to the team's colors they select.' The accent hooks are filled
    from the team the save says you coach and cleared when there is none --
    creation and the menu keep the house green. See accent.ts for why the
    lightness is clamped per theme rather than the hex applied raw.
  */
  const accentAbbr = useDynasty((s) => {
    const i = s.userTeam;
    return s.season?.teams[i]?.def.abbr ?? null;
  });
  useEffect(() => {
    applyTeamAccent(accentAbbr ? teamColour(accentAbbr) : null);
  }, [accentAbbr]);

  /*
    The broadcast's ears — stage 14. Mobile browsers refuse audio until a user
    gesture, so the first touch anywhere unlocks the context and warms the
    sample cache. Once is enough; the listener removes itself.
  */
  useEffect(() => {
    /*
      WebKit only counts touch-RELEASE events as the gesture that may unlock
      audio — pointerdown is not one, which is why the phone stayed silent
      while desktop testing heard everything. Listen on the releases, keep
      listening until the context genuinely runs (resume() is async, so the
      ready check often passes one tap late), and let pointerdown stay only
      to warm the sample cache early.
    */
    const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    const off = (): void => {
      for (const e of events) window.removeEventListener(e, wake);
      window.removeEventListener('pointerdown', warm);
    };
    const wake = (): void => {
      unlockAudio();
      preloadSfx();
      if (audioReady()) off();
    };
    const warm = (): void => preloadSfx();
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    window.addEventListener('pointerdown', warm, { passive: true });
    return off;
  }, []);

  return (
    <OpenTeam.Provider value={openTeamCard}>
      <AppBody />
      {/* The first season's tour. Beside the body rather than inside a
          screen, because it follows the player from screen to screen. */}
      <GuidedStretch />
    </OpenTeam.Provider>
  );
}

function AppBody() {
  const season = useDynasty((s) => s.season);
  // The sandbox's screen exists only in a career that turned it on.
  const godMode = useDynasty((s) => s.godMode);
  const tab = useDynasty((s) => s.tab);
  const screen = useDynasty((s) => s.screen);
  const go = useDynasty((s) => s.go);
  const setScreen = useDynasty((s) => s.setScreen);
  const year = useDynasty((s) => s.year);
  // The chrome prints live numbers now — the record, the date, the roster —
  // and the engine mutates in place, so the version counter is what tells this
  // component a day has been played.
  const version = useDynasty((s) => s.version);
  void version;
  const team = useUserTeam();
  // Selected as a number rather than as the list, so a card being marked read
  // does not re-render the whole chrome.
  const unread = useDynasty((s) => unreadCount(s.inbox));
  // New silverware waiting in the cabinet — the dot that replaced the
  // achievement letters.
  // Coach achievements wear their dot on the portrait (the profile is its own
  // layer now); the Program tab's dot is the record book's.
  const unseenRecords = useDynasty((s) => s.unseenRecords.length);
  // The board waiting on an answer: a review, an offer, or this year's terms.
  const boardWaiting = useDynasty((s) => (s.lastReview !== null && !s.reviewDismissed) || s.offers.length > 0 || s.seasonOpener !== null);
  const sectionAlert = (t: Tab, id: string): boolean => (
    (t === 'program' && id === 'history' && unseenRecords > 0)
    || (t === 'office' && id === 'board' && boardWaiting)
  );
  const tabAlert = (t: Tab): boolean => (t === 'program' && unseenRecords > 0) || (t === 'office' && boardWaiting);

  const chooseSection = (id: string): void => { setScreen(id); };
  const chooseTab = (id: Tab): void => { go(id); };

  // Which frame is on screen: the store's own answer (era.ts), so App and
  // the store cannot disagree about it (2026-09-30).
  const frame = useDynasty(frameOf);
  const phase = useDynasty((s) => s.phase);
  const bracket = useDynasty((s) => s.bracket);
  const live = useDynasty((s) => s.live);
  const furthestPhase = useDynasty((s) => s.furthestPhase);
  const goPhase = useDynasty((s) => s.goPhase);
  // The offseason rail, the one `stepBack` walks: cut at the review when the
  // career ends at this meeting or he has resigned. Shallow, as it is a new
  // array per read.
  const rail = useDynasty(useShallow(railSteps));
  const loadError = useDynasty((s) => s.loadError);
  const backupFor = useDynasty((s) => s.backupFor);
  const newDynasty = useDynasty((s) => s.newDynasty);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const refreshSaves = useDynasty((s) => s.refreshSaves);
  const atStart = useDynasty((s) => s.atStart);
  const backToStart = useDynasty((s) => s.backToStart);
  const [checked, setChecked] = useState(false);

  /**
   * The loading screen is not allowed to be the last thing that happens.
   *
   * Reported twice, the second time browser-specific: "still stuck at building
   * the league in Chrome, Safari works". Opening IndexedDB has failure modes
   * that never resolve and never reject — a blocked upgrade, restricted site
   * data — so no `catch` can reach them. Whatever the cause, after eight
   * seconds the screen stops claiming to be loading and offers a way past.
   */
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (checked) return undefined;
    const t = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(t);
  }, [checked]);

  /**
   * A new screen starts at the top.
   *
   * The same <main> element is reused across the offseason steps, so it keeps
   * whatever scroll position the previous step left behind — which is how
   * pressing CONTINUE at the bottom of the season review opened recruiting
   * already scrolled past its own header.
   */
  const mainRef = useRef<HTMLElement>(null);
  // The reset itself lives with the scroll memory below, because a back
  // gesture returns to where the screen was left rather than to the top.

  /*
    The back gesture: one list of levels, and everything that answers a
    press reads it.

    `nav.ts` derives the list from the store and the sheet registry: this
    era's route stops and the game (or June's game guard, or the winter
    steps), the store's layers in the order they are drawn, each
    screen-held sheet just above what was open before it, and a blocking
    card last. The level on top is both what a swipe shows and what it
    takes. It replaced three hand-kept copies of that answer in this file
    (the peel, the peek and the arming), whose drift was the swipe that
    "gets crazy ... showing other screens" (back plan SW, 2026-09-30).

    In a browser tab and as a home-screen icon, `historySync.ts` keeps the
    entries equal to the levels after every commit that changes them or
    the era, and turns a swipe into peels; it is the only code that writes
    history. In the APK a native plugin (BackPlugin.java) is armed while
    there is a level, guards included, and a press peels the newest.
    Disarmed, the system's own predictive exit runs.

    `key` is the list as one string, so React compares a primitive, and
    `era` is one frame of one career in one year. Here, above every early
    return, so each frame keeps the ledger in step.
  */
  const key = useSyncExternalStore(nav.subscribe, nav.levelsKey, nav.levelsKey);
  const era = useDynasty(eraKey);
  const ledger = useRef<HistorySync | null>(null);
  useLayoutEffect(() => { ledger.current?.afterCommit(); }, [key, era]);
  // Any other commit here (a day played) may change the picture too (V1).
  useLayoutEffect(() => { ledger.current?.painting(); });
  useEffect(() => {
    if (isNativeShell()) return undefined;
    const stopPresses = trackPresses();
    const sync = installHistorySync({
      ...browserDeps(nav.ledgerNav, DEV),
      // A level that arrives before the frame under it has painted is held
      // (hidden) until it has, so the swipe's picture is that frame (V1).
      hold: levelHolder(domQuery(() => mainRef.current), nav.levels),
    }, {
      pushMark,
      markReturn,
      /*
        A browser that animated the swipe itself (a phone's edge swipe) has
        already carried the page across. One that did not (a desktop Back
        button) swapped nothing on screen, so a screen that comes back fades
        up into place instead of snapping in.
      */
      onUserPop: ({ uaAnimated, kinds }) => {
        if (uaAnimated !== false || !movesScreen(kinds[0])) return;
        const el = mainRef.current;
        if (el) { el.style.transition = 'none'; el.style.opacity = '0'; el.style.transform = 'scale(0.97)'; }
        let fired = false;
        const up = (): void => { if (!fired) { fired = true; arrive(mainRef.current); } };
        requestAnimationFrame(() => requestAnimationFrame(up));
        setTimeout(up, 60);
      },
    });
    ledger.current = sync;
    return () => {
      stopPresses();
      sync.dispose();
      if (ledger.current === sync) ledger.current = null;
    };
  }, []);

  type RouteStop = { tab: Tab; screen: string };
  // Every place is a tab and a screen now: the rooms that used to be sheets
  // inside Program's overview are screens of their own (2026-09-24).
  const routeStop = (t: Tab, sc: string): RouteStop => ({ tab: t, screen: sc });
  const routeKey = (r: RouteStop): string => `${r.tab}|${r.screen}`;
  /*
    The screens kept alive behind the one on show, most recent last. See the
    in-season frame's <main>: going back shows the very screen that was left.
    A new era (another career, school, year or frame) starts the list again,
    so nothing from the last one comes back. One instance per visit, not per
    screen (keptAlive.ts).
  */
  const aliveRef = useRef<Alive<RouteStop>>({ list: [], last: null, gen: 0 });
  const aliveEra = useRef(era);
  if (aliveEra.current !== era) {
    aliveEra.current = era;
    aliveRef.current = { list: [], last: null, gen: aliveRef.current.gen };
  }
  /*
    A back move returned to this visit: `goBack` sets both numbers, and the
    next forward move takes a fresh visit. The screen kept alive for it comes
    back, at the height it was left.
  */
  const routeVisit = useDynasty((s) => s.routeVisit);
  const restoringVisit = useDynasty((s) => s.restoringVisit);
  const restoring = restoringVisit !== null && restoringVisit === routeVisit;

  /*
    Where each screen was left, so the back gesture returns to it.

    Reported 2026-09-10: "when dragging the screen to go back, once it goes
    back the screen resets and starts from the top instead of going back to
    the same place it was at." Every route change remembers the scroll of
    the screen being left — read in the store subscription, which fires
    before React swaps the screen, so the old scroller is still there — and
    a back restore puts the returning screen at that height before paint. A
    forward navigation still opens at the top, which is what stopped the
    season review's CONTINUE opening recruiting already scrolled past its
    own header. Opening or closing a player card no longer resets the page
    under it: the card is a layer over the screen, not a new screen.
  */
  // Keyed by visit (S6, 2026-09-30): Colleges seen twice keeps two heights.
  const scrollMemory = useRef(new Map<string, number>());
  useEffect(() => useDynasty.subscribe((s, prev) => {
    const id = leftScroll(s, prev, routeKey);
    const el = mainRef.current;
    if (id !== null && el) rememberScroll(scrollMemory.current, id, el.scrollTop);
  }), []);
  // The visit the last run below saw, so only the commit a back move lands
  // in restores: a stage or a game changing later on the same visit opens at
  // the top, as it always has.
  const seenVisit = useRef(routeVisit);
  useLayoutEffect(() => {
    const arrived = seenVisit.current !== routeVisit;
    seenVisit.current = routeVisit;
    const el = mainRef.current;
    if (!el) return;
    const back = arrived && restoring;
    const y = back ? (scrollMemory.current.get(scrollId({ tab, screen, routeVisit }, routeKey)) ?? 0) : 0;
    // Before paint, so the arriving page never shows at the wrong height and
    // then jumps; and once more on the next frame for a screen whose rows
    // arrive a beat after its frame does.
    el.scrollTo(0, y);
    if (y > 0) requestAnimationFrame(() => { if (mainRef.current === el) el.scrollTo(0, y); });
  }, [phase, tab, screen, routeVisit, bracket?.stage, live !== null]);

  /*
    Stage 19: the store's word on god mode, at launch and on every restore.
    The entitlement lives on the device (`DevicePrefs.godMode`) and only the
    store — or the test build's stand-in — may set it (05 §61.3, §62.3). In
    the browser and in a shell without Play services `initBilling` records
    "not available" and nothing else happens.
  */
  useEffect(() => {
    if (!isNativeShell()) return;
    void initBilling({
      owned: () => {
        notOwnedRuns(0);
        const prefs = readPrefs();
        if (prefs.godMode) return;
        const next = { ...prefs, godMode: true };
        writePrefs(next);
        applyPrefs(next);
      },
      /*
        Refunded or revoked (audit 17, L3): the entitlement goes when Google
        Play has said "not owned" on two launches running, so one bad read
        never takes a paid feature away. Sandbox careers already made stay
        sandboxes; only new ones need the unlock. A test build's free unlock
        is not the store's to revoke.
      */
      notOwned: () => {
        if (TEST_SHORTCUTS || unownedCounted) return;
        unownedCounted = true;
        const runs = notOwnedRuns() + 1;
        notOwnedRuns(runs);
        const prefs = readPrefs();
        if (runs < 2 || !prefs.godMode) return;
        const next = { ...prefs, godMode: false };
        writePrefs(next);
        applyPrefs(next);
      },
    });
  }, []);

  /*
    The APK: claim the gesture exactly while there is a level to peel or a
    guard to refuse with a shake, and answer it. Disarmed, at an era's root,
    the system's own default runs: the predictive exit preview, and the exit.
    An armed callback tells Android the app will consume the gesture, and
    Android then never previews leaving, which is why it is a toggle.
  */
  useEffect(() => {
    if (!isNativeShell()) return;
    void Back.arm({ armed: nav.depth() > 0 });
  }, [key]);
  /*
    And follow the finger while it is down (Android 14 and later send the
    whole swipe; older systems only the release). The level the release will
    peel moves with the swipe, in the shape `navTarget.ts` gives it, and the
    peel happens once it has finished leaving — never a card sitting still
    under a moving finger and then vanishing in a frame, which is the flick
    reported on 2026-09-24.

    The shell can report one swipe twice, and one physical gesture peels
    exactly one level: a second release inside 350 ms is dropped. Native
    only; in a browser the pop has already spent its entry, and the ledger
    reads how far it went.
  */
  const lastPeel = useRef(0);
  useEffect(() => {
    if (!isNativeShell()) return;
    const q = domQuery(() => mainRef.current);
    const peek = () => toTarget(nav.newest(), q);
    const guardedPeel = (): void => {
      const now = Date.now();
      if (now - lastPeel.current < 350) return;
      lastPeel.current = now;
      nav.peelNewest();
    };
    const handles: { remove: () => Promise<void> }[] = [];
    let gone = false;
    const keep = (p: Promise<{ remove: () => Promise<void> }>): void => {
      void p.then((h) => { if (gone) void h.remove(); else handles.push(h); });
    };
    keep(Back.addListener('backStart', (m) => { backStart(peek(), m.edge); }));
    keep(Back.addListener('backProgress', (m) => { backProgress(m.progress); }));
    keep(Back.addListener('backCancel', () => { backCancel(); }));
    keep(Back.addListener('back', () => { backCommit(peek, guardedPeel, () => mainRef.current); }));
    return () => { gone = true; for (const h of handles) void h.remove(); };
  }, []);

  /*
    The app opens at its own front door now rather than inside the last
    career. Asked for by name — "we need to start creating the starting
    screen, like new game, load game" — and it is also where a deleted
    career goes: resuming automatically meant the live autosave could only
    be left by deleting it, and deleting it did nothing because the next
    tap wrote it back.

    The saves are read here so the door knows whether it has a CONTINUE to
    offer; nothing is loaded until somebody chooses it.
  */
  useEffect(() => {
    if (checked) return;
    void refreshSaves().catch(() => {}).finally(() => setChecked(true));
  }, [checked, refreshSaves]);

  // Each frame below is `frameOf`'s answer, in its order; the front door
  // waits for the saves to be read, and loading covers it until then.
  if (frame === 'front' && checked && atStart) {
    return (
      <div className="app-frame">
        <Start
          onNew={() => useDynasty.setState({ needsTeam: true })}
          onLoad={() => openOverlay('saves')}
          onSettings={() => openOverlay('settings')}
        />
        <Overlays />
      </div>
    );
  }

  if (frame === 'front' && checked) {
    return (
      <div className="app-frame">
        <main ref={mainRef} key={phase ?? screen} className="screen-in pb-framemain pb-framemain--stack">
          {loadError && (
            <div className="pb-frameerror">
              <Callout
                tone="warning"
                title="That career would not open"
                {...(backupFor ? { action: {
                  label: `Open the copy from ${new Date(backupFor.savedAt).toLocaleString()}`,
                  onClick: () => { void useDynasty.getState().loadBackup(backupFor.slot); },
                } } : {})}
              >
                {/newer version|schema/i.test(loadError)
                  ? 'Saved by a newer version. Nothing was deleted.' : 'The save could not be read. Nothing was deleted.'}
                <span className="pb-errdetail">{loadError}</span>
              </Callout>
            </div>
          )}
          <div className="pb-framefill"><NewGame onExit={backToStart} /></div>
        </main>
      </div>
    );
  }

  /*
    A career that is over, which is the other end of the same idea as the
    market frame below: no club, no nav, and one screen. It is tested first
    because a man can be let go and finished in the same week — the board
    meeting hands those two to retirement, and a legacy screen that flashed
    the job market on the way past would be telling him to go and find work.
  */
  if (frame === 'legacy') {
    return (
      <div className="app-frame">
        <SchoolHeader kicker="The end of a career" name="What you built" />
        <SaveAlert topmost />
        <main ref={mainRef} key="legacy" className="screen-in pb-framemain">
          <Legacy />
        </main>
        <Overlays />
      </div>
    );
  }

  // No job, no team screen. Everything else waits until you take one.
  if (frame === 'market') {
    return (
      <div className="app-frame">
        {/*
          The one frame that can genuinely dead-end — an older save carried
          `jobSearch` without the offers, and the screen below rendered
          "NOBODY IS CALLING" with no nav and no way anywhere else. The offers
          are persisted (and regenerated) now, but a way out stays here on
          principle: a terminal frame always offers the saves menu, the same
          escape the unreadable-save and stalled-storage screens give.
        */}
        {/* No club mark and no record: there is no club yet, which is the whole
            situation this frame describes. */}
        <SchoolHeader kicker="Between jobs" name="The job market" />
        <SaveAlert topmost />
        <main ref={mainRef} key={phase ?? screen} className="screen-in pb-framemain">
          <JobSearch />
        </main>
        <Overlays />
      </div>
    );
  }

  // `frameOf` says 'loading' (or 'front' before the saves are read) exactly
  // when this holds; the check stays for the types below it.
  if (frame === 'front' || frame === 'loading' || !season || !team) {
    /*
      Two different states wear the same face, and only one of them is loading.

      A save that opens but points at a team the world does not contain leaves
      `season` set and `team` undefined, and this screen then sat there for
      ever with nothing behind it. It is a broken save, not a slow one, and the
      way out is a new dynasty rather than more waiting.
    */
    if (checked && season) {
      return (
        <div className="app-frame">
          <FrameMessage
            icon="alert"
            title="This save cannot be read"
            text="It points at a program that no longer exists. Start a new career to carry on."
            action={{ label: 'Start a new career', onClick: newDynasty }}
          />
        </div>
      );
    }
    if (stalled) {
      return (
        <div className="app-frame">
          <FrameMessage
            icon="archive"
            title="Your saves cannot be reached"
            text={isNativeShell()
              ? 'The game cannot reach its storage on this device. You can play, but nothing will be saved.'
              : "The browser will not open the game's storage: another tab may have Playball open, or site data is blocked here. You can play anyway, but nothing will be saved."}
            action={{
              label: 'Play without saving',
              onClick: () => {
                useDynasty.setState({ needsTeam: true });
                setChecked(true);
              },
            }}
          />
        </div>
      );
    }

    return (
      <div className="app-frame">
        <FrameMessage busy title="Building the league…" />
      </div>
    );
  }

  // The offseason takes the whole screen.
  //
  // It is a sequence with an order, not a place to browse: recruiting means
  // something because it happens once, on a deadline, and letting the player
  // wander off to the standings mid-window would make the clock decorative.
  // The nav comes back when the year does.
  // The postseason takes the whole screen for the same reason the offseason does:
  // it is a sequence with an order, and it is the part of the year the season was
  // played for.
  if (frame === 'june') {
    return (
      <div className="app-frame postseason-frame">
        {/*
          A slim top bar, for the one piece of furniture June cannot do
          without: the inbox. The frame used to render no header at all, which
          made the notification centre unreachable for the whole postseason —
          the stretch of the year with the most to report. SAVES stays off
          this bar. This used to say mid-bracket saving was restricted to stage
          boundaries; no longer (2026-09-30): June saves as it goes, mid-bracket
          included (`simBracket`, `endManagedGame`, the anchor before a game).
        */}
        {/* The bar steps aside while a game is being managed — the dugout owns
            the whole screen, the same rule the regular season follows. */}
        {!live && (
          <SchoolHeader
            abbr={team.def.abbr}
            kicker={`${year} postseason`}
            name={team.def.school}
            // June's own record: "Record" means the regular season everywhere.
            record={`${team.w - regularRecord(team).w}–${team.l - regularRecord(team).l}`}
            recordLabel="In June"
            extra={<GodBolt target={{ kind: 'tab', tab }} label="God mode for this tab" className="header-god" />}
          />
        )}
        <SaveAlert topmost />
        {/*
          The sub-nav, which restoring the bottom nav forgot.

          Bringing the four tabs back to June without this put you on a tab's
          first screen with no way to reach its others — TEAM landed on the
          roster and STATS could not be opened at all, which is exactly where
          the postseason leaderboard lives. Reported as the stats not being
          there; they were, behind a control that had not been rendered.

          Only away from the bracket: JUNE is the postseason screen and has its
          own stage rail, so a second row of tabs above it would be two
          navigations arguing about the same space.
        */}
        {!live && tab !== 'home' && (
          <SectionTabs
            label={`${(TABS.find((t) => t.id === tab) ?? TABS[0]!).label} sections`}
            items={(TABS.find((t) => t.id === tab) ?? TABS[0]!).screens.filter((item) => item.id !== 'god' || godMode).map((item) => ({
              ...item,
              alert: sectionAlert(tab, item.id),
            }))}
            active={screen}
            onSelect={chooseSection}
          />
        )}
        <main ref={mainRef} key={phase ?? screen} className="screen-in pb-framemain">
          {/* A bracket game you took yourself is managed on the same screen a
              regular season game is, so nothing about June feels like a
              different game than the one you played in April. */}
          {live ? <Manage /> : (tab === 'home' ? <Postseason /> : <Screen id={screen} />)}
        </main>
        {/*
          The nav comes back to June.

          It was taken away on the argument that the postseason is a sequence
          with an order and deserves the whole screen, and that argument was
          half right: the *bracket* deserves the screen, and it still has it.
          What the rule cost was everything else — reported plainly as wanting
          to see the roster during the postseason, and it applies just as much
          to who is hitting and where the year stands.

          So the bar returns with JUNE in the home slot instead of TODAY: the
          bracket is what the home tab means for as long as the bracket exists,
          and the other three are the screens they have always been. It stays
          away while a game is being managed, which is the one place the
          original argument holds completely.
        */}
        {!live && (
          <AreaNav
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.id === 'home' ? 'June' : t.label,
              alert: (t.id === 'home' && unread > 0) || tabAlert(t.id),
            }))}
            active={tab}
            onSelect={(id) => chooseTab(id as Tab)}
          />
        )}
        <Overlays />
      </div>
    );
  }

  /*
    The room used to be here, ahead of everything else on the screen, and it is
    now an overlay you open from NEEDS YOU instead. Two separate reports, and
    they landed on the same line of code.

    The first was a layout bug: it "expanded the screen out of its regular
    mobile size", which is exactly what it did. `.app-frame` is the phone — it
    caps the width at 430, clips its overflow, and, the part that bit, carries
    `position: relative`. `FixedHeader` lays itself out `absolute; inset: 0`, so
    with no frame around it the nearest positioned ancestor was the window and
    the room stretched across a desktop. Every other return in this function
    wraps; this one was written as a guard clause, and guard clauses do not look
    like they are missing a wrapper.

    The second was the design: it "shouldn't simply appear all of a sudden".
    The original comment here argued the opposite — put it in a tab and it
    becomes a thing you can walk away from, which is the one shape it must not
    have — and that argument was wrong in a way worth keeping a note of. It
    bought attention by taking the screen away from a player in the middle of
    doing something else, and it is the only thing in the game that does. What
    replaces it is how the rest of this game already works: the question is
    written down, it sits at the top of the home screen in red, and you go to
    it. See `Needs.tsx`.
  */

  if (frame === 'winter' && phase !== null) {
    return (
      <div className="app-frame offseason-frame">
        <SchoolHeader
          abbr={team.def.abbr}
          kicker={`${year} offseason`}
          name={team.def.school}
          extra={<GodBolt target={{ kind: 'tab', tab }} label="God mode for this tab" className="header-god" />}
        />
        {/* The bottom nav is gone from here by design; the header's bell and
            portrait menu are the inbox, the profile and the saves for the
            steps that have the most to report. */}
        <SaveAlert />
        {/*
          The rail is the offseason this world actually runs, so a career
          started without a portal never shows a PORTAL step it cannot open.
          `furthestPhase` is an index into the canonical `PHASES` and stays
          one — it is a number in a save file — so it is translated into the
          rail's own shorter numbering here rather than stored twice.
        */}
        {(() => {
          /*
            A career that ends at this meeting does not have a draft and a
            signing day after it. Reported: "after tapping next after season
            review to coach points it did take me to the end of the career
            which feels weird" — the rail was still promising four more steps
            while the button under it was closing the book. `railSteps` makes
            that cut.
          */
          const steps = rail;
          const furthest = steps.reduce(
            (n, p, i) => (PHASES.indexOf(p) <= furthestPhase ? i : n), 0,
          );
          return (
            <StepRail
              steps={steps.map((p) => ({ key: p, label: PHASE_LABEL[p] }))}
              at={steps.indexOf(phase)}
              furthest={furthest}
              locked={steps.filter((p) => closedStep(useDynasty.getState(), p))}
              onGo={(k) => goPhase(k as Exclude<typeof phase, null>)}
            />
          );
        })()}
        <main ref={mainRef} key={phase ?? screen} className="screen-in pb-framemain">
          {phase === 'awards' && <Awards />}
          {phase === 'review' && <SeasonReview />}
          {phase === 'coach' && <CoachPoints />}
          {phase === 'recruiting' && <Board />}
          {phase === 'signing' && <SigningDay />}
          {phase === 'draft' && <Draft />}
          {phase === 'portal' && <Portal />}
        </main>
        <Overlays />
      </div>
    );
  }

  /*
    A game in progress owns the screen. No school masthead, no portrait, no
    record, no nav — reported from testing: "when we are playing we dont need
    to see the team name, the coach pic, inbox and record up there." The
    scoreboard is the header; BACK TO THE DESK inside the dugout is the way
    out, and the game keeps until it is finished or simmed.
  */
  if (live && screen === 'box') {
    return (
      <div className="app-frame">
        <SaveAlert topmost />
        <main ref={mainRef} className="pb-framemain pb-framemain--fixed">
          <Manage />
        </main>
        <Overlays />
      </div>
    );
  }

  const tabDef = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  const alive = keptAlive(aliveRef, routeStop(tab, screen), routeKey, routeVisit, restoring);
  // The one on show is always last: two visits to Colleges are two entries.
  const shown = alive[alive.length - 1];
  const liveOwner = shown ? `${routeKey(shown.r)}#${shown.gen}` : '';

  return (
    <div className="app-frame playball-app">
      {/*
        The top bar, on paper.

        It was navy with a pinstripe through it and a clay rule underneath, and
        it read as a masthead — the app announcing itself above the thing you
        came to look at. The same five pieces of information are here; they are
        simply on the same ground as the screen, separated by a hairline. What
        the change buys is the club mark, which is the only fixed shape in a
        header whose every other slot changes daily.

        The record keeps its own block. It rode the identity line at nine point
        beside the nickname and the conference, and it was reported as hard to
        see and easy to lose — which it was: the one number that changes every
        day was set in the same weight as two that never change. Overall only;
        the conference record is a tap away on the standings.
      */}
      <SchoolHeader
        abbr={team.def.abbr}
        kicker={`${team.def.nickname} · ${conferenceName(team.conference)}`}
        name={team.def.school}
        record={`${regularRecord(team).w}–${regularRecord(team).l}`}
        extra={<GodBolt target={{ kind: 'tab', tab }} label="God mode for this tab" className="header-god" />}
      />

      <SaveAlert />

      <SectionTabs
        label={`${tabDef.label} sections`}
        items={tabDef.screens.map((item) => ({
          ...item,
          alert: sectionAlert(tab, item.id),
        }))}
        active={screen}
        onSelect={chooseSection}
      />

      {/*
        The screen on show and the last few before it, the way a phone keeps
        the page underneath alive. Reported for years as the back gesture's
        flick: the swipe previews the page as it was left, and the page then
        rebuilt from nothing — its wheel back on the next game, its tabs and
        expanded cards closed, its logos a frame late. A screen the gesture
        returns to is now the same screen, only hidden meanwhile: its state,
        its images and its layout are exactly as they were. `Activity` keeps
        it without running its effects or painting it.

        Its sheets and tips render into the frame, outside the Activity, so
        each screen names itself as their owner and the rule hides every one
        but the live screen's (screenOwner.ts, 2026-09-30).
      */}
      <main ref={mainRef} className="app-content pb-framemain">
        {alive.map(({ r, gen }) => (
          <Activity key={`${routeKey(r)}#${gen}`} mode={gen === shown?.gen ? 'visible' : 'hidden'}>
            <ScreenOwner.Provider value={`${routeKey(r)}#${gen}`}>
              <ScreenSurface fill={r.screen === 'today'}>
                <Screen id={r.screen} />
              </ScreenSurface>
            </ScreenOwner.Provider>
          </Activity>
        ))}
      </main>
      <style>{ownerRule(liveOwner)}</style>

      {/* The dot on HOME is how unread survives being three screens away; the
          count itself is on the top-bar envelope, one tap from here, where
          there is room to print it. */}
      <AreaNav
        tabs={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          alert: (t.id === 'home' && unread > 0) || tabAlert(t.id),
        }))}
        active={tab}
        onSelect={(id) => chooseTab(id as Tab)}
      />
      <Overlays />
    </div>
  );
}

/**
 * A save that did not go through, said out loud, on every frame the game has.
 *
 * `saveState` has been in the store since saving existed and nothing has ever
 * rendered it, so a write that failed — storage refused, a second tab holding
 * the database, a quota — was completely silent. The player carried on for an
 * hour and lost the hour. The persistence file's own comment calls that the
 * worst outcome available to this app, and a strip of clay across the top is a
 * small price for never doing it.
 *
 * A row of the frame rather than something floating over it: it must not cover
 * the nav, and it must not be dismissable, because the condition it reports does
 * not go away when you stop looking at it. Tapping retries, which is worth
 * offering — a failed open is not cached, so a blocking tab that has since been
 * closed will simply work on the next attempt.
 */
function SaveAlert({ topmost }: { topmost?: boolean }) {
  const saveState = useDynasty((s) => s.saveState);
  const lastSaveError = useDynasty((s) => s.lastSaveError);
  const saveNow = useDynasty((s) => s.saveNow);
  const simError = useDynasty((s) => s.simError);
  const playSeason = useDynasty((s) => s.playSeason);
  // The sim's failure is not a save failure, and its retry runs the sim —
  // safe, because a failed run never replaced the season.
  if (simError !== null) {
    return (
      <AlertBar
        topmost={topmost}
        title="The sim stopped. Tap to run it again."
        text="Nothing was lost: the season is exactly where it was."
        onClick={() => { void playSeason(); }}
      />
    );
  }
  if (saveState !== 'error') return null;
  return (
    <AlertBar
      topmost={topmost}
      title="Not saved. Tap to try again."
      text={lastSaveError ?? 'The save did not finish.'}
      onClick={() => { void saveNow(); }}
    />
  );
}

/** A row of the frame that reports something still wrong, and retries on a tap. */
function AlertBar(
  { title, text, onClick, topmost }: { title: string; text: string; onClick: () => void; topmost?: boolean },
) {
  return (
    <button type="button" className={`pb-alertbar${topmost ? ' is-topmost' : ''}`} onClick={onClick}>
      <Icon name="alert" size={18} />
      <span className="pb-alertbar__text"><b>{title}</b><small>{text}</small></span>
      <Icon name="reset" size={18} />
    </button>
  );
}

/**
 * A whole frame with one thing to say: the league being built, a save that
 * cannot be read, storage that will not open. Said plainly, with the one way on.
 */
function FrameMessage(
  { icon = 'info', title, text, action, busy }:
  { icon?: IconName; title: string; text?: string; action?: { label: string; onClick: () => void }; busy?: boolean },
) {
  return (
    <div className="pb-framemsg" role={busy ? 'status' : 'alert'}>
      <span className="pb-framemsg__icon">{busy ? <span className="pb-spinner" aria-hidden /> : <Icon name={icon} size={24} />}</span>
      <h1 className="pb-framemsg__title">{title}</h1>
      {text && <p className="pb-framemsg__text">{text}</p>}
      {action && <Button variant="primary" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

/**
 * The three things that can cover a frame, stacked in the order you meet them.
 *
 * A table sits over the screen, a program's page sits over the table you tapped
 * it from, and a player's card sits over whichever of those named him — so
 * closing each one puts you back exactly where you were rather than at the top
 * of somewhere else. Gathered into one component because all three frames the
 * app can be in need the identical set, and three copies of it is three places
 * to forget one.
 */
function Overlays() {
  const overlay = useDynasty((s) => s.overlay);
  const teamCard = useDynasty((s) => s.teamCard);
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  return (
    <>
      {overlay !== null && <TableOverlay />}
      {teamCard !== null && <TeamOverlay index={teamCard} />}
      {selectedPlayer !== null && <PlayerOverlay />}
      {/* Over the card it may have been opened from. */}
      <GodOverlay />
      {/* The board's terms at the top of a season: a step over the whole
          frame until they are signed (SeasonTerms.tsx). */}
      <SeasonTerms />
      {/* Once a season at each chair: after the terms, or on day one of a
          first season or a new job (SeasonPlan.tsx). */}
      <SeasonPlan />
      <WeekStopped />
      <PlaybookInvite />
      {/* Above everything, because it IS the screen while it lasts. */}
      <BigMomentCard />
    </>
  );
}

/**
 * A rival's program, over the table you tapped it in.
 *
 * The player card's twin in every respect that shows: the same navy bar, the
 * same absolute frame, the same rule that nothing underneath unmounts. Keyed on
 * the program so opening a second one is a second page rather than the first
 * one with new numbers on whatever tab you left it on.
 */
function TeamOverlay({ index }: { index: number }) {
  const season = useDynasty((s) => s.season);
  const onBack = useDynasty((s) => s.closeTeamCard);
  const rival = season?.teams[index];
  return (
    <Overlay
      eyebrow="College profile"
      title={rival?.def.school ?? 'Program'}
      className="is-team"
      onClose={onBack}
      floating={<GodBolt target={{ kind: 'program', team: index }} label={`Edit ${rival?.def.school ?? 'this program'} in god mode`} />}
    >
      <TeamCard key={index} index={index} />
    </Overlay>
  );
}

/**
 * A table over the top of anything: schedule, conference, country.
 *
 * Same shape as the player card and for the same reason — the screen
 * underneath, which during the offseason is a step in a sequence, must still be
 * there when you close it.
 *
 * Every slot of the stack is drawn, the top one last and over the rest (back
 * plan S5, 2026-09-30). A slot under another used to unmount, so the Inbox
 * under the standings came back at the top of its letters and the coach
 * profile back on Overview. The ones below are inert and hidden from readers,
 * and their sheets and tips answer to their slot (screenOwner.ts).
 */
export function TableOverlay() {
  const overlay = useDynasty((s) => s.overlay);
  const below = useDynasty((s) => s.overlayStack);
  if (overlay === null) return null;
  const slots = [...below.map((b) => b.overlay), overlay];
  const top = slots.length - 1;
  return (
    <>
      {slots.map((name, i) => (
        <ScreenOwner.Provider key={`${i}:${name}`} value={overlayOwner(i)}>
          <TableSlot overlay={name} top={i === top} />
        </ScreenOwner.Provider>
      ))}
      <style>{overlayRule(top)}</style>
    </>
  );
}

function TableSlot({ overlay, top }: { overlay: OverlayName; top: boolean }) {
  const close = useDynasty((s) => s.closeOverlay);
  /*
    Back means one step, not all the way out.

    Settings is the only screen in here with pages of its own, and it has two
    back controls: its own, and the overlay's, which is the bigger and more
    obvious of the two. Reported as pressing back on a settings page and being
    returned to whatever screen preceded settings entirely. So the outer one
    defers to the inner one while there is an inner one to defer to.
  */
  const settingsPage = useDynasty((s) => s.settingsPage);
  const setSettingsPage = useDynasty((s) => s.setSettingsPage);
  /*
    A room laid over the frame (the coach profile, the board from a letter)
    is its own layer: Back closes it and nothing else. It used to be a sheet
    inside Program's overview, so the way out of the coach profile could land
    on Program (2026-09-24: "make sure they are not longer linked to program").
  */
  const back = (): void => {
    if (overlay === 'settings' && settingsPage !== 'index') setSettingsPage('index');
    else close();
  };
  return (
    <div className="pb-tableoverlay" inert={!top || undefined} aria-hidden={!top || undefined}>
      <BackBar onBack={back} />
      {/* Hidden, not auto. Every screen in here brings its own scroller, so a
          scroller here would be a scroller around a scroller. */}
      <div className="pb-tableoverlay__body">
        {overlay === 'schedule' && <div className="pb-scroll"><Schedule /></div>}
        {overlay === 'standings' && <div className="pb-scroll"><Standings /></div>}
        {overlay === 'rankings' && <div className="pb-scroll"><Rankings /></div>}
        {/* Not a table, but the same shape of thing: a screen laid over the one
            you were on, with the screen underneath still mounted when you close
            it. During the offseason it is the only way in — the nav is gone. */}
        {overlay === 'saves' && <div className="pb-scroll"><Saves /></div>}
        {overlay === 'settings' && <div className="pb-scroll" key={settingsPage}><Settings /></div>}
        {/* And the same argument again, for the three the inbox needs. The
            inbox itself, because it is a HOME tab and HOME does not exist
            during the offseason — which is precisely when it has the most to
            say. The program page and the record book, because they are where
            its cards point, and a card that is only tappable in one of the
            three frames is not tappable. */}
        {overlay === 'inbox' && <Inbox />}
        {/* A room: the coach profile, the board, the staff room... each a
            plain column in the same scroller the jobs screen uses. Keyed, so
            one room opened from another starts at its own top. */}
        {isRoom(overlay) && (
          <div className="pb-scroll" key={overlay}><RoomScreen room={overlay} /></div>
        )}
        {/* The depth chart screen is gone — removed whole in the sorting
            session ("remove it entirely"): the lineup, the rail and AUTO do
            its work, and the one fact it held (where else a man can stand)
            lives on the player card's info now. The engine's chartFor is
            untouched; it was never this screen's. */}
        {/* Who wears the C, with every eligible man and a reason to prefer one.
            It used to be a line at the top of the depth chart, which made the
            room's own pick the only name anybody ever saw. */}
        {/* No pinned header of its own, so it gets the scroller the container
            above deliberately does not have -- without it the list of eligible
            men was simply cut off at the fold. */}
        {/* The job market — a university calling about a job gets a screen,
            not a list buried on the program board. Same scroller story as the
            captain below. */}
        {overlay === 'jobs' && (
          <div className="pb-scroll"><JobMarket /></div>
        )}
        {overlay === 'captain' && (
          <div className="pb-scroll"><Captain /></div>
        )}
        {/* The press room, which stopped being an interruption and became an
            errand. Here rather than in the screen switch because the overlays
            are the one layer present in every frame the offseason included, and
            a question raised by the last game of a regional must still be
            answerable once the regular season's nav has gone. */}
        {/* The one of these that does not pin its own header — it is normally
            the second sheet of HISTORY, which does the pinning for it — so it
            gets the scroller the container above deliberately does not have. */}
        {overlay === 'book' && (
          <div className="pb-scroll">
            <main className="pb-page">
              <ScreenHeader title="Record book" />
              <RecordBook />
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The way out of anything that covers the whole frame.
 *
 * One definition, because the two overlays are the same object to the player
 * and looked like two different apps when each drew its own: the tables came
 * back on a bar with a bordered ← BACK, the player card on a bare chevron
 * tucked into its own header. Whichever it is, it earns its height by being
 * outside the scroller — a control you can lose by reading too far is the
 * complaint the whole of Sticky.tsx exists to answer.
 *
 * An arrow in a square rather than the word, which is the proposal's overlay
 * header and is safe here for a reason worth stating: the bar carries exactly
 * one control, so there is nothing for a bare glyph to be confused with. It
 * carries an `aria-label` because a screen reader has no such luxury.
 *
 * No title on it yet. The proposal's version prints an eyebrow and the name of
 * whatever you opened, and every screen behind this bar already prints its own
 * through `FixedHeader` — so adding one here today buys a duplicate. It belongs
 * with the overlay rework in phase five, where the screen's own header is the
 * thing that goes.
 *
 * Bottom sheets dismiss with CLOSE on their own bar instead, and that is a
 * different pattern for a different thing: a sheet sits on top of a screen you
 * can still see, while these replace it.
 */
function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="pb-overlaybar">
      <button type="button" className="pb-back" onClick={onBack}>
        <Icon name="arrow-left" size={16} />Back
      </button>
    </div>
  );
}

/**
 * The player card, over whatever is underneath it.
 *
 * An overlay rather than a route, and that is the fix for a whole class of
 * complaint at once: navigating to a card unmounted the screen you came from, so
 * the roster forgot you were on the pitchers tab, a long list forgot where you
 * had scrolled, and "back" dropped you at the top of something else. Nothing
 * underneath unmounts now, so closing the card puts you exactly where you were.
 *
 * The back bar belongs to the overlay rather than to the card, and it is the
 * same bar the table overlay uses. A chevron drawn inside the card's own header
 * was tried and is what prompted "the back button does not follow the other
 * designs": it saved forty pixels and cost the player the one control in the
 * app that always looks the same wherever it appears.
 */
/**
 * Stage 22: the scouting desk's follow-through — "the moment you scout a
 * team it right away asks you to set up their playbook against them and
 * takes you to do it."
 */
function PlaybookInvite() {
  const invite = useDynasty((s) => s.playbookInvite);
  const nudge = useDynasty((s) => s.cardNudge);
  const dismiss = useDynasty((s) => s.dismissPlaybookInvite);
  const go = useDynasty((s) => s.go);
  const setFocus = useDynasty((s) => s.setPlaybookFocus);
  const closeOverlay = useDynasty((s) => s.closeOverlay);
  const season = useDynasty((s) => s.season);
  if (!invite) return null;
  const opponent = season?.teams.find((t) => t.def.abbr === invite);
  const school = opponent?.def.school ?? invite;
  const reads = opponent ? teamReads(opponent.team).slice(0, 3) : [];
  const runDiff = opponent ? opponent.rs - opponent.ra : 0;
  return (
    <Modal
      nudge={nudge}
      kicker="Scouting report ready"
      title={`The ${school} report is ready`}
      lines={[
        'Build a plan against them now, or keep your standing strategy and come back to it later.',
      ]}
      body={opponent ? (
        <>
          <StatGroup
            size="sm"
            items={[
              { label: 'Record', value: recordText(opponent.w, opponent.l) },
              { label: 'Run difference', value: `${runDiff > 0 ? '+' : runDiff < 0 ? '−' : ''}${Math.abs(runDiff)}` },
              { label: 'Prestige', value: <Stars value={prestigeStars(opponent.prestige)} label="Prestige" /> },
            ]}
          />
          {reads.length > 0 && (
            <List label="What the report found">
              {reads.map((read) => (
                <ListRow
                  key={`${read.slot}-${read.title}`}
                  title={read.title === read.title.toUpperCase() ? capsWords(read.title) : read.title}
                  subtitle={read.text}
                />
              ))}
            </List>
          )}
          <p className="pb-note">Your plan applies whenever you face them.</p>
        </>
      ) : undefined}
      action="Build a plan"
      onClose={() => {
        dismiss();
        setFocus(invite);
        closeOverlay();
        go('team', 'strategy');
      }}
      cancel={{ label: 'Later', onClick: dismiss }}
    />
  );
}

/**
 * A man hurt, or a hurt man fit again, said the moment it happens — whether
 * the day was simmed, coached, a week at a time or in June (2026-09-24). The
 * week still stops where it broke: "if after the first game of the week one of
 * my players got injured, I want the simulation to stop and ask me to fix the
 * lineup." The button opens the lineup on the man himself — his side of it,
 * batting or pitching, scrolled to his row.
 */
function WeekStopped() {
  const alert = useDynasty((s) => s.rosterAlert);
  const clear = useDynasty((s) => s.clearRosterAlert);
  const go = useDynasty((s) => s.go);
  if (alert === null) return null;
  const more = alert.more > 0 ? ` ${plural(alert.more, 'more roster change')}.` : '';
  const hurt = alert.kind === 'hurt';
  const what = alert.what ? alert.what.charAt(0).toUpperCase() + alert.what.slice(1) : '';
  return (
    <Modal
      kicker={hurt ? (alert.stopped ? 'The week stopped' : 'Injury') : 'Back from injury'}
      title={hurt ? `${alert.name} is hurt` : `${alert.name} is fit`}
      tone={hurt ? 'clay' : 'win'}
      lines={[hurt
        ? `${what}.${alert.stopped ? ' The rest of the week is still there.' : ''}${more}`
        : `Put him back, or keep his replacement.${more}`]}
      action="Set the lineup"
      cancel={{ label: 'Later', onClick: clear }}
      onClose={() => { clear(); go('team', 'lineup', alert.id); }}
    />
  );
}

function PlayerOverlay() {
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  const close = useDynasty((s) => s.closePlayer);
  const name = usePlayerName(selectedPlayer);
  return (
    <Overlay
      eyebrow="Player card"
      title={name}
      className="is-player"
      onClose={close}
      floating={selectedPlayer ? <GodBolt target={{ kind: 'player', id: selectedPlayer }} label={`Edit ${name} in god mode`} /> : null}
    >
      {/*
        Keyed on the man, so opening a second card is a fresh card, on its
        first tab and at the top. Tapping a name in a box score and landing
        halfway down someone else's game log is the bug the key prevents. The
        screen underneath is left exactly where it was — since 2026-09-10 the
        frame no longer resets it when a card opens or closes.
      */}
      <Player key={selectedPlayer ?? ''} />
    </Overlay>
  );
}

/**
 * The name for the bar over the card.
 *
 * The card itself finds the man by searching every roster in the world, which
 * is the right thing for a screen that opens leaderboard strangers and drafted
 * alumni alike. The bar above it only needs the name, so it does the cheap half
 * of the same search and falls back to a title rather than to nothing — a card
 * for a man the world no longer contains still has a header.
 */
function usePlayerName(id: string | null): string {
  const season = useDynasty((s) => s.season);
  const report = useDynasty((s) => s.lastOffseason);
  if (!id || !season) return 'Player card';
  for (const t of season.teams) {
    for (const p of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) {
      if (p.id === id) return p.name;
    }
  }
  const gone = [...(report?.graduated ?? []), ...(report?.drafted ?? [])]
    .find((d) => d.id === id);
  return gone?.name ?? 'Player card';
}

/**
 * A screen's frame, with the soft fade it arrives with — once. The fade
 * (`pageSoftIn`) used to replay on a screen the back gesture brought back:
 * the swipe had already shown the page at full strength, and it then dimmed
 * and came up again, the "quick flick" after every swipe (2026-09-24). A
 * screen that mounts under a back navigation starts still; one that has
 * played its fade never plays it again, however often it is hidden and shown.
 */
function ScreenSurface({ fill, children }: { fill: boolean; children: ReactNode }) {
  const backNow = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.nav === 'back';
  const [still, setStill] = useState(backNow);
  // Shown again by a back navigation (Activity re-runs this on every show):
  // still before the first paint, so a fade cut short earlier cannot replay.
  useLayoutEffect(() => { if (backNow()) setStill(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className={`screen-surface${fill ? ' screen-surface--fill' : ''}${still ? ' is-still' : ''}`}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setStill(true); }}
    >
      {children}
    </div>
  );
}

// Memoised: AppBody re-renders on every version bump, and without this every
// kept-alive screen behind the visible one re-rendered with it. Each screen
// subscribes to what it reads itself (audit 17, M50).
const Screen = memo(function Screen({ id }: { id: string }) {
  switch (id) {
    case 'today': return <Today />;
    case 'roster': return <Roster />;
    case 'stats': return <Stats />;
    case 'lineup': return <Lineup />;
    case 'stand': return <StandingsScreen />;
    case 'strategy': return <StrategyScreen />;
    case 'box': return <Manage />;
    // Office: running the program.
    case 'recruiting': return <Board />;
    case 'staff': return <RoomScreen room="staff" />;
    case 'facilities': return <RoomScreen room="facilities" />;
    case 'budget': return <RoomScreen room="budget" />;
    case 'board': return <RoomScreen room="board" />;
    // Program: what it has become.
    case 'records': return <Program />;
    case 'history': return <History />;
    case 'hall': return <RoomScreen room="hall" />;
    case 'alumni': return <AlumniScreen />;
    case 'colleges': return <Colleges />;
    // Draft remains an offseason phase. Recruiting is now a season-long Program
    // destination; the legacy offseason board route is kept only for old saves.
    case 'wire': return <Wire />;
    case 'inbox': return <Inbox />;
    case 'saves': return <Saves />;
    default: return <Placeholder id={id} />;
  }
});
