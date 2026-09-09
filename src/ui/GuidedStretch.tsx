// GuidedStretch.tsx
// The guided first stretch, on screen: the card, then the light.
//
// `guide.ts` decides which step is live and what it points at; this component
// draws it. Two phases per step. First the card — the same scrim and card the
// screen tutorials use, so the tour reads as the same voice — and then the
// spotlight: the frame goes dark except for a hole cut around the control the
// step is about, and the control is tapped through the hole. The tap is the
// real one. The tour never presses anything on the player's behalf; it only
// takes the other choices away for a moment.
//
// Mounted once, in App, beside the body. It reads the store, not the screen
// components, so no screen has to know it is being taught — a screen's whole
// contribution is a `data-guide` name on the control the tour lights.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { assistantFor } from '../engine/program.js';
import { readPrefs } from '../state/devicePrefs.js';
import { useDynasty } from '../state/store.js';
import { activeGuideStep, guideSkipStamps, guideStamp, type GuideStep, type GuideView } from './guide.js';

/** "Leonardo Townsend" is the masthead's business; a card just says Townsend. */
const lastName = (full: string): string => full.split(' ').pop() ?? full;

/** Breathing room between the control and the edge of its hole. */
const PAD = 6;

/**
 * The control a step lights right now: the first of its names that is in
 * the frame, visible, and not disabled. Nothing, when none is — and nothing
 * is the honest answer, because a light on a dead button is a dead end.
 */
function resolveTarget(
  frame: HTMLElement,
  names: readonly string[],
): { el: HTMLElement; name: string } | null {
  for (const name of names) {
    const el = frame.querySelector<HTMLElement>(`[data-guide="${name}"]`);
    if (!el) continue;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    return { el, name };
  }
  return null;
}

type Box = { x: number; y: number; w: number; h: number; name: string };

function Spotlight(
  { frame, step, onSkip }: { frame: HTMLElement; step: GuideStep; onSkip: () => void },
) {
  const [box, setBox] = useState<Box | null>(null);
  const names = step.target ?? [];
  const key = names.join('|');

  /*
    Measured every frame while the light is on. The control can move — a
    list scrolls, the dugout tools slide out, a tab strip settles — and a
    hole that lags its control by a tick is a hole around nothing. The
    measure is one getBoundingClientRect; the state only changes when the
    numbers do, so React sees a still picture.
  */
  useEffect(() => {
    let raf = 0;
    let brought: HTMLElement | null = null;
    const tick = (): void => {
      const found = resolveTarget(frame, names);
      if (found) {
        if (brought !== found.el) {
          found.el.scrollIntoView({ block: 'center', inline: 'nearest' });
          brought = found.el;
        }
        const f = frame.getBoundingClientRect();
        const r = found.el.getBoundingClientRect();
        const next: Box = {
          x: Math.round(r.left - f.left), y: Math.round(r.top - f.top),
          w: Math.round(r.width), h: Math.round(r.height), name: found.name,
        };
        setBox((prev) => (
          prev && prev.x === next.x && prev.y === next.y && prev.w === next.w
            && prev.h === next.h && prev.name === next.name ? prev : next
        ));
      } else {
        setBox(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, key]);

  const swallow = (e: React.SyntheticEvent): void => { e.stopPropagation(); e.preventDefault(); };
  const caption = box ? step.caption?.[box.name] : undefined;
  const frameH = frame.clientHeight;
  // The caption sits under the hole unless the hole is near the bottom — a
  // bottom-nav tab, say — in which case it sits above.
  const below = box ? box.y + box.h + PAD + 12 : 0;
  const captionAbove = box ? below + 56 > frameH : false;

  return (
    <div className="guide-mask" data-lit={box ? box.name : undefined}>
      {/*
        Four sheets around the hole rather than one sheet with a hole in it:
        the hole is simply where no sheet is, so the tap through it reaches
        whatever is under it — the control — with nothing in the way. No
        target: no sheets either. A dark screen with nothing to tap would be
        a trap, and the control that is not here yet will be in a moment.
      */}
      {box && (
        <>
          <div className="guide-mask-part" style={{ top: 0, left: 0, right: 0, height: Math.max(0, box.y - PAD) }} onClick={swallow} onPointerDown={swallow} />
          <div className="guide-mask-part" style={{ top: box.y + box.h + PAD, left: 0, right: 0, bottom: 0 }} onClick={swallow} onPointerDown={swallow} />
          <div className="guide-mask-part" style={{ top: box.y - PAD, left: 0, width: Math.max(0, box.x - PAD), height: box.h + PAD * 2 }} onClick={swallow} onPointerDown={swallow} />
          <div className="guide-mask-part" style={{ top: box.y - PAD, left: box.x + box.w + PAD, right: 0, height: box.h + PAD * 2 }} onClick={swallow} onPointerDown={swallow} />
          <div
            className="guide-hole guide-glow"
            style={{ top: box.y - PAD, left: box.x - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }}
          />
          {caption && (
            <p
              className="guide-caption"
              style={captionAbove
                ? { bottom: frameH - (box.y - PAD) + 10 }
                : { top: below }}
            >{caption}</p>
          )}
        </>
      )}
      <button className="guide-skip tap" type="button" onClick={onSkip}>SKIP TOUR</button>
    </div>
  );
}

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
  const pending = useDynasty((s) => s.pendingGame !== null);
  // A modal the tour must not talk over: the season's opener, a big moment,
  // the resume prompt, a player's card.
  const blocked = useDynasty((s) => Boolean(
    s.seasonOpener || s.playbookInvite || s.bigMoment || s.pendingGame || s.selectedPlayer !== null,
  ));

  /*
    The inning, polled. The live game is a running object the store holds by
    reference and never re-sets, so nothing about its inning reaches a
    selector; four times a second is plenty for "has the second started".
  */
  const [inning, setInning] = useState(0);
  useEffect(() => {
    if (!live) { setInning(0); return; }
    const read = (): void => {
      const l = useDynasty.getState().live;
      setInning(l ? l.inning : 0);
    };
    read();
    const t = window.setInterval(read, 250);
    return () => window.clearInterval(t);
  }, [live]);

  /** The step whose card has been read, so the light is showing. */
  const [lit, setLit] = useState<string | null>(null);

  const step = activeGuideStep(seen, firstSeason, readPrefs().tutorials);
  const view: GuideView = { tab, screen, overlay, programSheet, live, inning, pending };

  // A step that finished by being done — the game started, the tab changed —
  // is stamped the moment it is, wherever the player is looking.
  const finished = step !== null && step.done !== null && step.done(view);
  useEffect(() => {
    if (!step || !finished) return;
    stamp([guideStamp(step.id), ...(step.covers ?? [])]);
  }, [step, finished, stamp]);

  if (!step || finished || blocked || !step.where(view)) return null;
  const frame = document.querySelector<HTMLElement>('.app-frame');
  if (!frame) return null;

  const skip = (): void => stamp(guideSkipStamps());
  const card = step.card;

  if (card && lit !== step.id) {
    return createPortal(
      <div
        className="tutorial-scrim fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={`The tour: ${card.title}`}
      >
        <section className="tutorial-card rise-in">
          <div className="flow-section-title">
            <span className="label">{lastName(assistant).toUpperCase()} SHOWS YOU AROUND</span>
            <button className="tap" type="button" onClick={skip}>SKIP</button>
          </div>
          <h2>{card.title}</h2>
          <p>{card.body}</p>
          <footer>
            <button
              className="primary-command tap"
              type="button"
              autoFocus
              onClick={() => {
                if (step.target) setLit(step.id);
                else stamp([guideStamp(step.id), ...(step.covers ?? [])]);
              }}
            >{step.target ? 'SHOW ME' : 'GOT IT'}</button>
          </footer>
        </section>
      </div>,
      frame,
    );
  }

  if (!step.target) return null;
  return createPortal(<Spotlight frame={frame} step={step} onSkip={skip} />, frame);
}
