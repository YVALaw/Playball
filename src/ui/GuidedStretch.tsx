// GuidedStretch.tsx
// The guided first stretch, on screen: the card, then the light.
//
// `guide.ts` decides which step is live and what it points at; this component
// draws it. Two phases per step. First the card — the same scrim and card the
// screen tutorials use, so the tour reads as the same voice, raised to the
// middle of the frame so it never sits on the control it is about to light —
// and then the spotlight: the frame goes dark except for a hole cut around
// the control the step is about, and the control is tapped through the hole.
// The tap is the real one. The tour never presses anything on the player's
// behalf; it only takes the other choices away for a moment.
//
// Mounted once, in App, beside the body. It reads the store, not the screen
// components, so no screen has to know it is being taught — a screen's whole
// contribution is a `data-guide` name on the control the tour lights.

import { useEffect, useId, useRef, useState } from 'react';
import { useDialogFocus } from './dialogFocus.js';
import { LessonBody } from './Tutorial.js';
import { createPortal } from 'react-dom';
import { assistantFor } from '../engine/program.js';
import { facilityLevel, staffPlan } from '../engine/economy.js';
import { readPrefs } from '../state/devicePrefs.js';
import { useDynasty, useUserTeam } from '../state/store.js';
import {
  activeGuideStep, dueGuideStamps, guideCard, guideSkipStamps, visibleGuideStep,
  guideProgress, guideStepStamps, type GuideCard, type GuideStep, type GuideView,
} from './guide.js';

/** "Leonardo Townsend" is the masthead's business; a card just says Townsend. */
const lastName = (full: string): string => full.split(' ').pop() ?? full;

/** Breathing room between the control and the edge of its hole. */
const PAD = 6;

/**
 * The control a step lights right now: the first of its names that is in
 * the frame, visible, and not disabled. Nothing, when none is — and nothing
 * is the honest answer, because a light on a dead button is a dead end.
 */
function resolveTarget(frame: HTMLElement, names: readonly string[]): { el: HTMLElement; name: string } | null {
  for (const name of names) {
    for (const el of frame.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`)) {
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
      const r = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      if (!r.width || !r.height || css.visibility === 'hidden' || css.display === 'none') continue;
      return { el, name };
    }
  }
  return null;
}

type Box = { x: number; y: number; w: number; h: number; frameH: number; name: string };
const FOCUSABLE = 'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex="0"]';

function Spotlight({ frame, step, onSkip, onSkipStep, onRead }: {
  frame: HTMLElement; step: GuideStep; onSkip: () => void; onSkipStep: () => void; onRead: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const [panelH, setPanelH] = useState(170);
  const names = step.target ?? [];
  const key = names.join('|');
  const progress = guideProgress(step);
  const captionId = useId();
  const callbacks = useRef({ onSkip, onRead });
  callbacks.current = { onSkip, onRead };

  useEffect(() => {
    if (!panel.current) return;
    const observer = new ResizeObserver(() => setPanelH(panel.current?.scrollHeight ?? 170));
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let brought: HTMLElement | null = null;
    let described: HTMLElement | null = null;
    let oldDescription: string | null = null;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreDescription = (): void => {
      if (!described) return;
      if (oldDescription === null) described.removeAttribute('aria-describedby');
      else described.setAttribute('aria-describedby', oldDescription);
    };
    const tick = (): void => {
      const found = resolveTarget(frame, names);
      if (found) {
        if (brought !== found.el) {
          restoreDescription();
          described = found.el;
          oldDescription = found.el.getAttribute('aria-describedby');
          found.el.setAttribute('aria-describedby', [oldDescription, captionId].filter(Boolean).join(' '));
          found.el.scrollIntoView({ block: 'center', inline: 'nearest' });
          const focus = found.el.matches(FOCUSABLE) ? found.el : found.el.querySelector<HTMLElement>(FOCUSABLE);
          focus?.focus({ preventScroll: true });
          brought = found.el;
        }
        const f = frame.getBoundingClientRect();
        const r = found.el.getBoundingClientRect();
        const x = Math.max(PAD, Math.round(r.left - f.left));
        const y = Math.max(PAD, Math.round(r.top - f.top));
        const next: Box = {
          x, y, w: Math.max(0, Math.min(Math.round(r.right - f.left), f.width - PAD) - x),
          h: Math.max(0, Math.min(Math.round(r.bottom - f.top), f.height - PAD) - y),
          frameH: Math.round(f.height), name: found.name,
        };
        setBox((prev) => prev && Object.keys(next).every((k) => prev[k as keyof Box] === next[k as keyof Box]) ? prev : next);
      } else {
        restoreDescription();
        described = null;
        brought = null;
        setBox(null);
      }
      raf = requestAnimationFrame(tick);
    };
    // Keep keyboard users on the same target and tour controls as pointer users.
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onRead(); return; }
      if (event.key !== 'Tab') return;
      const target = resolveTarget(frame, names)?.el;
      const items = [
        ...(target ? (target.matches(FOCUSABLE) ? [target] : Array.from(target.querySelectorAll<HTMLElement>(FOCUSABLE))) : []),
        ...Array.from(panel.current?.querySelectorAll<HTMLElement>('button') ?? []),
      ].filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      restoreDescription();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // The target list is keyed; callbacks are read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, key, captionId]);

  const swallow = (e: React.SyntheticEvent): void => { e.stopPropagation(); e.preventDefault(); };
  const caption = box ? step.caption?.[box.name] ?? 'Use the highlighted control to continue.'
    : 'Control unavailable. Read again or skip this step.';
  const below = box ? box.y + box.h + PAD + 12 : 12;
  const aboveSpace = box ? Math.max(0, box.y - PAD - 24) : 0;
  const belowSpace = box ? Math.max(0, box.frameH - below - 12) : frame.clientHeight - 24;
  const above = !!box && belowSpace < panelH && aboveSpace > belowSpace;
  const available = above ? aboveSpace : belowSpace;
  // A very tall target can fill the frame at large text sizes. Keep the tour
  // controls reachable inside the frame even when no separate gap is left.
  const panelStyle = box && available >= 100
    ? { ...(above ? { bottom: box.frameH - box.y + PAD + 12 } : { top: below }), maxHeight: available }
    : { bottom: 12, maxHeight: Math.max(88, Math.min(180, frame.clientHeight - 24)) };

  return (
    <div className="guide-mask" data-lit={box?.name}>
      {box && box.w > 0 && box.h > 0 && <>
        <div className="guide-mask-part" style={{ top: 0, left: 0, right: 0, height: Math.max(0, box.y - PAD) }} onClick={swallow} onPointerDown={swallow} />
        <div className="guide-mask-part" style={{ top: box.y + box.h + PAD, left: 0, right: 0, bottom: 0 }} onClick={swallow} onPointerDown={swallow} />
        <div className="guide-mask-part" style={{ top: box.y - PAD, left: 0, width: Math.max(0, box.x - PAD), height: box.h + PAD * 2 }} onClick={swallow} onPointerDown={swallow} />
        <div className="guide-mask-part" style={{ top: box.y - PAD, left: box.x + box.w + PAD, right: 0, height: box.h + PAD * 2 }} onClick={swallow} onPointerDown={swallow} />
        <div className="guide-hole" style={{ top: box.y - PAD, left: box.x - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }} />
      </>}
      <div ref={panel} className="guide-caption" style={panelStyle} aria-label="Tour controls">
        <small>{step.aside ? 'PLAYER HELP' : `STEP ${progress.current} OF ${progress.total}`}</small>
        <p id={captionId} role="status">{caption}</p>
        <div className="guide-controls">
          <button className="tap" type="button" onClick={onRead}>Read again</button>
          {!step.aside && <button className="tap" type="button" onClick={onSkipStep}>Skip step</button>}
          <button className="tap" type="button" onClick={onSkip}>End tour</button>
        </div>
      </div>
    </div>
  );
}

function TourLesson({ step, card, assistant, leaving, onSkip, onSkipStep, onContinue }: {
  step: GuideStep; card: GuideCard; assistant: string; leaving: boolean;
  onSkip: () => void; onSkipStep: () => void; onContinue: () => void;
}) {
  const dialog = useRef<HTMLDivElement | null>(null);
  const primary = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const progress = guideProgress(step);
  useDialogFocus(dialog, onSkip, { initial: primary });
  return <div ref={dialog} className={`tutorial-scrim guide-scrim${leaving ? ' leaving' : ' fade-in'}`}
    role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
    <section className={`tutorial-card${leaving ? '' : ' rise-in'}`}>
      <div className="flow-section-title">
        <span className="label">{step.aside ? 'PLAYER HELP' : `STEP ${progress.current} OF ${progress.total}`}</span>
        <button className="tap" type="button" disabled={leaving} onClick={onSkip}>End tour</button>
      </div>
      <div className="tutorial-progress" role="progressbar" aria-label="Tour progress"
        aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.current - 1}>
        <span style={{ width: `${(progress.current - 1) / progress.total * 100}%` }} />
      </div>
      <h2 id={titleId}>{card.title}</h2>
      <div id={bodyId}><LessonBody page={card} /></div>
      <p className="tutorial-byline">Your assistant, {lastName(assistant)}</p>
      <footer>
        {!step.aside && step.target && <button className="tutorial-back tap" type="button" disabled={leaving} onClick={onSkipStep}>Skip step</button>}
        <button ref={primary} className="primary-command tap" type="button" disabled={leaving} onClick={onContinue}>
          {step.target ? 'SHOW ME' : 'FINISH TOUR'}
        </button>
      </footer>
    </section>
  </div>;
}

/** What the world looked like when a step's light came on. */
type Snapshot = { id: string; plays: number; lineup: string; positions: string };

export function GuidedStretch() {
  const seen = useDynasty((s) => s.seenTutorials);
  const stamp = useDynasty((s) => s.markTutorialsSeen);
  const assistant = useDynasty((s) => assistantFor(s.coach.name));
  const firstSeason = useDynasty((s) => s.season !== null && s.phase === null && s.history.length === 0);
  const tab = useDynasty((s) => s.tab);
  const screen = useDynasty((s) => s.screen);
  const overlay = useDynasty((s) => s.overlay);
  const programSheet = useDynasty((s) => s.programSheet);
  const live = useDynasty((s) => s.live !== null);
  const userHome = useDynasty((s) => s.liveMeta !== null && s.liveMeta.home === s.userTeam);
  const pending = useDynasty((s) => s.pendingGame !== null);
  const playerOpen = useDynasty((s) => s.selectedPlayer !== null);
  const wordGuide = useDynasty((s) => s.guide === 'word');
  const hittingHired = useDynasty((s) => Boolean(s.economy.staff.hitting));
  const hittingDirective = useDynasty((s) => staffPlan(s.economy, 'hitting').directive);
  const cageLevel = useDynasty((s) => facilityLevel(s.economy, 'cage'));
  // A modal the tour must not talk over: the season's opener, a big moment,
  // the resume prompt. A player's card is not one — the word errand is
  // taught on it.
  const blocked = useDynasty((s) => Boolean(s.seasonOpener || s.playbookInvite || s.bigMoment || s.pendingGame));
  const user = useUserTeam();
  const version = useDynasty((s) => s.version);

  /*
    The field, polled. The live game is a running object the store holds by
    reference and never re-sets, so nothing about its inning, its half or
    its play count reaches a selector; four times a second is plenty for
    "has the second started" and "was a call made".
  */
  const [field, setField] = useState({ inning: 0, half: 'top' as 'top' | 'bottom', over: false, plays: 0 });
  useEffect(() => {
    if (!live) { setField({ inning: 0, half: 'top', over: false, plays: 0 }); return; }
    const read = (): void => {
      const l = useDynasty.getState().live;
      if (!l) return;
      setField((prev) => (
        prev.inning === l.inning && prev.half === l.half && prev.over === l.over && prev.plays === l.playSeq
          ? prev
          : { inning: l.inning, half: l.half, over: l.over, plays: l.playSeq }
      ));
    };
    read();
    const t = window.setInterval(read, 250);
    return () => window.clearInterval(t);
  }, [live]);

  /** The step whose card has been read, and the world as it was then. */
  const [lit, setLit] = useState<Snapshot | null>(null);

  /*
    The card leaves before the light arrives. Reported: "when we hit SHOW ME
    it just does a clean cut instead of a disappearing card animation." Two
    hundred milliseconds of fade-and-sink, then whatever the press asked for;
    reduced motion skips straight to it, the way every other leave here does.
  */
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current); }, []);
  const dismiss = (then: () => void): void => {
    const root = document.documentElement.dataset.motion;
    const still = root === 'reduced'
      || (root !== 'full' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (leaving) return;
    if (still) { then(); return; }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      setLeaving(false);
      then();
    }, 200);
  };

  /*
    A heartbeat while the tour is on. Several steps end on something only
    the DOM knows — the money sheet's view is Program's own state, the
    dugout tools are Manage's — and nothing in the store changes when they
    do, so nothing would re-run `has()`. Three times a second is plenty, and
    the render is a handful of querySelectors.
  */
  const touring = activeGuideStep(seen, firstSeason, readPrefs().tutorials) !== null;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!touring) return;
    const t = window.setInterval(() => bump((n) => n + 1), 300);
    return () => window.clearInterval(t);
  }, [touring]);

  const lineupSig = user ? user.team.lineup.map((p) => p.id).join(',') : '';
  const positionsSig = user ? user.team.lineup.map((p) => p.pos).join(',') : '';
  void version;

  const frame = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.app-frame');
  const has = (name: string): boolean => frame !== null && frame.querySelector(`[data-guide="${name}"]`) !== null;

  const current = activeGuideStep(seen, firstSeason, readPrefs().tutorials);
  /*
    "Since the light came on" means THIS step's light. Measured against the
    previous step's snapshot, the batting card was over the instant it became
    current — plays had happened since the pitching card's light — and it
    never showed. A step that has not been lit has had nothing happen since.
  */
  const since = lit !== null && current !== null && lit.id === current.id ? lit : null;

  const view: GuideView = {
    tab, screen, overlay, programSheet,
    live, inning: field.inning, half: field.half, over: field.over,
    batting: live && (userHome ? field.half === 'bottom' : field.half === 'top'),
    pending, playerOpen, wordGuide,
    wordSeen: seen.includes('guide:word'),
    hittingHired, hittingDirective, cageLevel,
    gamesPlayed: user ? user.w + user.l : 0,
    playedSinceLit: since !== null && field.plays > since.plays,
    lineupChanged: since !== null && lineupSig !== since.lineup,
    positionsChanged: since !== null && positionsSig !== since.positions,
    has,
  };
  const due = current ? dueGuideStamps(seen, current, view) : [];
  const dueKey = due.join('|');
  useEffect(() => {
    if (due.length > 0) stamp(due);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueKey, stamp]);

  if (!current || due.length > 0 || blocked || !frame) return null;
  const step = visibleGuideStep(seen, current, view);
  if (!step) return null;

  const skipNow = (): void => stamp(guideSkipStamps());
  const card = guideCard(step, view);

  const skipStep = (): void => { setLit(null); stamp(guideStepStamps(step)); };
  if (lit?.id !== step.id) {
    return createPortal(<TourLesson key={step.id} step={step} card={card} assistant={assistant} leaving={leaving}
      onSkip={() => dismiss(skipNow)} onSkipStep={() => dismiss(skipStep)}
      onContinue={() => dismiss(() => {
        if (step.target) setLit({ id: step.id, plays: field.plays, lineup: lineupSig, positions: positionsSig });
        else stamp(guideStepStamps(step));
      })} />, frame);
  }

  if (!step.target) return null;
  return createPortal(<Spotlight key={step.id} frame={frame} step={step} onSkip={skipNow}
    onSkipStep={skipStep} onRead={() => setLit(null)} />, frame);
}
