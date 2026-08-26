// PostseasonMap.tsx
// The whole postseason, on one map you can move around.
//
// Three cameras over the same board. Zoomed in you read school names; a step out
// and they become abbreviations; all the way out and every game is a pair of
// colour marks and the map fits the screen. The layers all exist at once and
// crossfade, so nothing reflows mid-zoom — the board never jumps under your
// thumb.
//
// Panning writes the transform straight to the node and commits to React state
// only on release. The board carries a few thousand descendants, and a render
// that big between the touch and the movement is what makes a map feel dead.
//
// Camera moves the *app* makes travel; camera moves your *finger* makes do not.
// Both go down the same imperative path, so an eased move costs no more renders
// than a drag does.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { teamColour } from './Avatar.js';
import {
  buildGraph, layoutGraph, CARD_W, COL_W, SECTION_GAP, CHAMP_W,
  type GraphInput, type Section, type Box,
} from './postseasonGraph.js';

const CLAY = '#a8442a';

/**
 * Room to the left of a bracket for its name.
 *
 * Measured against the middle zoom rather than the live one, so the board does
 * not reflow when you change zoom — the label just gets more or less slack.
 */
const gutterFor = (labels: readonly string[]): number => {
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0);
  return (longest * 7.6 + 18) / 0.46;
};
const INK = '#1c2430';
const WIN = '#3f6b46';
const FAINT = 'rgba(28,36,48,.2)';

const SECTIONS: Section[] = ['conf', 'regional', 'national'];
const TAB_NAME: Record<Section, string> = {
  conf: 'CONFERENCE', regional: 'REGIONALS', national: 'NATIONAL',
};

/** How much of the board you can pull past the edge, as a share of the screen. */
const MARGIN_X = 0.45;
const MARGIN_Y = 0.3;
const PAD = 12;

/**
 * How long a camera move the app makes takes to travel.
 *
 * Simulating a game re-points the camera, and a re-point that lands in a single
 * frame reads as the board being pulled out from under you. Scaled by how far
 * it actually has to go on screen: a flight across the bracket gets the top of
 * this range so the eye can keep hold of the board on the way past, and a small
 * correction gets the bottom of it, because a forty pixel nudge that takes as
 * long as a traverse reads as lag rather than as care.
 */
const GLIDE_MIN_MS = 170;
const GLIDE_MAX_MS = 460;
/** The screen distance beyond which a move is as slow as it will ever get. */
const GLIDE_FULL_PX = 520;

/**
 * How much clear glass a card needs around it to count as already on screen.
 *
 * Reported: *"when playing the post season if i hit simulate this game it keeps
 * dragging the camera instead of staying where I was at the moment"*. Easing the
 * move did not answer it, because the complaint is not that the travel is abrupt
 * — it is that pressing SIMULATE takes the board out from under you at all.
 *
 * So the camera now only moves when the series it wants to show you is not
 * already in front of you, which is the rule maps settle on: do not move what
 * the reader can see. A card touching the edge does not count — half a matchup
 * against the bezel is the case the follow exists for — hence a margin rather
 * than a plain intersection test.
 */
const HOLD_MARGIN = 10;

/** Ease in and out, so the camera sets off and arrives rather than cutting. */
const ease = (t: number): number =>
  (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

/**
 * A large area of the screen sliding is exactly what this setting is about, so
 * the same moves happen instantly when it is on. Read at the moment of the
 * move rather than once at mount: the preference can be changed mid-session.
 */
const wantsNoMotion = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Names, abbreviations, colour marks. `k: null` means fit the whole board. */
const DENSITIES = [
  { k: 1 as number | null, name: 1, abbr: 0, mark: 0, ref: 1 },
  { k: 0.46 as number | null, name: 0, abbr: 1, mark: 0, ref: 0.46 },
  { k: null as number | null, name: 0, abbr: 0, mark: 1, ref: 0.09 },
];

export function PostseasonMap(
  { input, abbr, name, height, focusKey, section }:
  {
    input: GraphInput;
    abbr: (i: number) => string;
    name: (i: number) => string;
    height: number;
    /** Changes when a round is played, so the camera follows your team. */
    focusKey: string;
    /**
     * The tier being played. One tier is drawn at a time.
     *
     * The map used to hold all three at once and let you pan between them.
     * That made every simulated game a camera flight across the whole board —
     * reported as "when we click to simulate the map goes crazy and janks the
     * camera from one side to another" — and it buried the tier you were
     * actually in. One tier per slide: the conferences, then the regionals,
     * then the last four.
     *
     * Which one is *on screen* is the tabs' business, below. Playing or simming
     * anything snaps the view back here, so the board is never showing you
     * somewhere else while your own tier moves.
     */
    section: Section;
  },
) {
  const { userTeam } = input;
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<
    { x: number; y: number; cam: { x: number; y: number }; id: number } | null
  >(null);
  /** The frame handle of a move in flight, and null when the camera is still. */
  const tweenRef = useRef<number | null>(null);
  /**
   * Which tier the camera was last pointed at.
   *
   * A move within a tier is a move across a board that is still there. A move
   * between tiers is not — see the follow effect below.
   */
  const lastViewRef = useRef<Section | null>(null);

  const [dens, setDens] = useState(1);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  /**
   * The tier on screen, which is the tier being played until you say otherwise.
   *
   * Browsing the other two is worth having — the regional you are trying to
   * reach is the reason the conference final matters — but only as a discrete
   * tap. Free panning between tiers is what janked the camera across the board
   * on every press, and it is not coming back.
   */
  const [view, setView] = useState<Section>(section);
  const [size, setSize] = useState({ w: 390, h: height });

  // Anything that moves the postseason puts you back in front of it.
  useEffect(() => { setView(section); }, [section, focusKey]);

  // The board is rebuilt only when the postseason itself changes.
  //
  // Keyed on `focusKey` rather than on `input`, which is an object literal the
  // caller rebuilds every render — memoising on its identity meant recomputing
  // the layout on every render, and the camera effect below fires whenever the
  // layout changes. That was most of the jank.
  const { graph, layout } = useMemo(() => {
    const full = buildGraph(input);
    const nodes = full.nodes.filter((n) => n.section === view);
    const ids = new Set(nodes.map((n) => n.id));
    const g = {
      ...full,
      nodes,
      edges: full.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
      brackets: full.brackets.filter((b) => b.section === view),
    };
    const laid = layoutGraph(g);

    // Slide the tier back to the origin on both axes. The layout reserves a
    // column run and a row band for every tier, so a lone regional would
    // otherwise sit a thousand units to the right of, and some way down, a
    // canvas that is mostly empty. Normalising here is what lets the camera
    // below treat the totals as the real size of what is on screen.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of laid.pos.values()) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.w);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + p.h);
    }
    if (minX !== Infinity) {
      // Room for the bracket names, which are drawn in the gutter to the left.
      const dx = minX - gutterFor(g.brackets.map((b) => b.label));
      const dy = minY;
      if (dx !== 0 || dy !== 0) {
        for (const [id, p] of laid.pos) laid.pos.set(id, { ...p, x: p.x - dx, y: p.y - dy });
        for (const [key, box] of laid.bracketBox) {
          laid.bracketBox.set(key, { ...box, x: box.x - dx, y: box.y - dy });
        }
        for (const st of Object.keys(laid.sectionSpan) as Section[]) {
          const s2 = laid.sectionSpan[st];
          if (s2.w > 0) laid.sectionSpan[st] = { ...s2, x: s2.x - dx, y: s2.y - dy };
        }
      }
      laid.totalW = Math.max(1, maxX - dx);
      laid.totalH = Math.max(1, maxY - dy);
    }
    return { graph: g, layout: laid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, view]);

  const mine = useMemo(
    () => new Set(graph.nodes.filter((n) =>
      (n.kind === 'series' && (n.a === userTeam || n.b === userTeam))
      || (n.kind === 'champ' && n.team === userTeam),
    ).map((n) => n.id)),
    [graph, userTeam],
  );
  const myEdges = useMemo(
    () => new Set(graph.edges.filter((e) => e.team === userTeam).map((e) => `${e.from}>${e.to}`)),
    [graph, userTeam],
  );

  const D = DENSITIES[dens] as typeof DENSITIES[number];
  const scaleFor = (i: number): number => {
    const k = DENSITIES[i]?.k;
    if (k !== null && k !== undefined) {
      // The middle camera is the one that has to hold the whole tier across,
      // because it is where every slide opens: a champion card hanging off the
      // right edge is the one thing you must not have to go looking for. The
      // close camera stays close — reading full names is what it is for.
      if (i !== 1) return k;
      return Math.min(k, (size.w - 2 * PAD) / Math.max(1, layout.totalW));
    }
    return Math.min(
      (size.w - 2 * PAD) / Math.max(1, layout.totalW),
      (size.h - 2 * PAD) / Math.max(1, layout.totalH),
    );
  };
  const k = scaleFor(dens);

  /**
   * The map is only as tall as the tier needs.
   *
   * A region is a single series and the last four is three: at the fixed
   * zooms those occupy a strip, and giving them the full height of the eight
   * conference trees left most of the screen empty. A tier that overflows
   * still gets the whole box to be panned around in.
   */
  // Measured from the fixed zoom rather than from `k`: the fit zoom is derived
  // from the height, and feeding it back in here would be a loop.
  const fixedK = DENSITIES[dens]?.k ?? null;
  // Sized from the zoom actually in use — which a fixed camera may have
  // narrowed to keep the board inside the sides — and never from a scale that
  // is itself derived from the height, which would be a loop.
  const viewH = fixedK === null ? null
    : Math.max(180, Math.min(height, Math.round(layout.totalH * k) + 2 * PAD));

  /**
   * Offset for a camera point.
   *
   * The bound is the overscroll margin, not the viewport edge, so the outermost
   * node can still be brought to the middle of the screen. A dimension that
   * already fits is not locked either: the two bounds cross, and the range
   * between them becomes the slack the map can be moved through.
   */
  const offsetFor = (c: { x: number; y: number }, kk: number): { x: number; y: number } => {
    const place = (v: number, max: number, viewport: number, margin: number): number => {
      // A tier that fits is centred rather than tracked. With one tier per
      // slide the small ones — a region is one series, the last four is three —
      // fit whole, and following a node around inside them only pushed the
      // champion off the right edge.
      if (max * kk <= viewport) return (viewport - max * kk) / 2;
      const want = viewport / 2 - v * kk;
      const m = viewport * margin;
      const lo = viewport - m - max * kk;
      const hi = m;
      return Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), want));
    };
    return {
      x: place(c.x, layout.totalW, size.w, MARGIN_X),
      y: place(c.y, layout.totalH, size.h, MARGIN_Y),
    };
  };

  const applyTransform = (c: { x: number; y: number }, kk: number): void => {
    const el = canvasRef.current;
    if (!el) return;
    const off = offsetFor(c, kk);
    el.style.transform = `translate3d(${off.x}px,${off.y}px,0) scale(${kk})`;
  };
  // Held in a ref so a move already in flight keeps writing through the current
  // layout and the current box size. The map shrinks to fit a short tier, so
  // both can change under a move that is halfway through it.
  const applyRef = useRef(applyTransform);
  applyRef.current = applyTransform;

  /**
   * Is this box whole on the screen from where the camera is standing now?
   *
   * Read off `camRef` and not off `cam`, because the answer has to be about
   * where the board actually is — a drag writes the node without telling React,
   * and asking the committed camera would say a series is visible when the
   * player has just pushed it off the side.
   */
  const onScreen = (p: Box, kk: number): boolean => {
    const o = offsetFor(camRef.current, kk);
    const left = o.x + p.x * kk;
    const top = o.y + p.y * kk;
    return left >= HOLD_MARGIN
      && top >= HOLD_MARGIN
      && left + p.w * kk <= size.w - HOLD_MARGIN
      && top + p.h * kk <= size.h - HOLD_MARGIN;
  };

  const stopGlide = (): void => {
    if (tweenRef.current === null) return;
    cancelAnimationFrame(tweenRef.current);
    tweenRef.current = null;
  };

  /**
   * Take the camera to a focal point over time.
   *
   * Every frame goes straight to the node, exactly as a drag does. Easing this
   * by re-rendering would put a few thousand descendants between the tween and
   * the glass sixty times a second, which is the one thing this file is
   * arranged to avoid — and `cam` is therefore only committed once the move is
   * over, because a render carrying the destination would write it to the node
   * and cut the travel short.
   */
  const glideTo = (to: { x: number; y: number }, kk: number, cut: boolean): void => {
    // Wherever it is right now, which is what makes a target arriving mid-move
    // pick up from here instead of restarting from where the last one began.
    stopGlide();
    const from = camRef.current;
    const a = offsetFor(from, kk);
    const b = offsetFor(to, kk);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (cut || dist < 1 || wantsNoMotion()) {
      camRef.current = to;
      applyRef.current(to, kk);
      setCam(to);
      return;
    }
    const dur = GLIDE_MIN_MS
      + (GLIDE_MAX_MS - GLIDE_MIN_MS) * Math.min(1, dist / GLIDE_FULL_PX);
    const t0 = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      const c = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      camRef.current = c;
      applyRef.current(c, kk);
      if (t < 1) {
        tweenRef.current = requestAnimationFrame(step);
        return;
      }
      tweenRef.current = null;
      setCam(to);
    };
    tweenRef.current = requestAnimationFrame(step);
  };

  // A move outlives nothing. Cancel on the way out or the next frame writes to
  // a node that is no longer on the page.
  useEffect(() => () => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
  }, []);

  useLayoutEffect(() => {
    // React writes the transform from `cam` on every commit, and commits land
    // in the middle of both kinds of movement: the zoom crossfades as soon as
    // it is pressed, and the store keeps rendering behind the map. Either would
    // snap the board to the last committed camera. Put the live one back.
    if (tweenRef.current !== null || dragRef.current) applyRef.current(camRef.current, k);
  });

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setSize({ w: r.width, h: r.height });
    };
    measure();
    // The box shrinks to fit a short tier, so the element resizes without the
    // window doing anything. Watch the element itself or the camera centres
    // against a height that is no longer there.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /** Your next game if you have one, else the last thing that happened to you. */
  useEffect(() => {
    // Only in the tier you are playing. Every tier is laid out from its own
    // origin, so a camera left pointing at your conference final while the
    // regionals are on screen is a point in a coordinate space that is no
    // longer drawn — a tier being browsed is shown whole instead.
    const ids = view === section ? graph.nodes.filter((n) => mine.has(n.id)) : [];
    const next = ids.find((n) => n.kind === 'series' && n.winner === null);
    const target = next ?? ids[ids.length - 1];
    const p = target ? layout.pos.get(target.id) : undefined;
    const c = p
      ? { x: p.x + p.w / 2, y: p.y + p.h / 2 }
      : { x: layout.totalW / 2, y: layout.totalH / 2 };
    // Within a tier the camera travels; across tiers it cuts.
    //
    // Each tier is laid out from its own origin, so the point being left and
    // the point being arrived at are numbers in two different coordinate
    // spaces — a slide between them traverses a board that does not exist, over
    // nodes that were all replaced in the same commit. A cut is honest about
    // what happened: you are somewhere else now. The first paint cuts for the
    // same reason, there being nowhere to have travelled from.
    const cut = lastViewRef.current !== view;
    lastViewRef.current = view;

    // The board stays where you left it if what changed is already in front of
    // you. Pressing SIMULATE THIS GAME while watching your own series is the
    // common case by a distance, and the camera answering it by travelling —
    // however smoothly — is the board being pulled out from under your thumb.
    //
    // A tier change is exempt and has to be: the point being left and the point
    // being arrived at are numbers in two different coordinate spaces, so
    // "already visible" is not a question that can be asked across the cut —
    // and the first paint is a tier change, which is what still lets the map
    // open pointed at your own bracket.
    //
    // Nothing of yours in the tier holds as well. A coach who is out, or who
    // never qualified, is watching somebody else's June: re-centring the board
    // under him on every press is the same complaint with nothing of his own on
    // the screen to justify it.
    if (!cut && (!p || onScreen(p, k))) return;
    glideTo(c, k, cut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, layout, view]);

  // --- pointer panning -----------------------------------------------------
  const onDown = (e: React.PointerEvent): void => {
    // A finger on the glass owns the board outright. Dropping the move here
    // rather than letting it finish is what keeps it from fighting the drag,
    // and taking the drag origin from `camRef` — wherever the move had got to —
    // is what keeps the board from snapping back to where it set off from.
    stopGlide();
    dragRef.current = {
      x: e.clientX, y: e.clientY, cam: camRef.current, id: e.pointerId,
    };
    if (overlayRef.current) overlayRef.current.style.opacity = '0.16';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  };
  const onMove = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    if (!d) return;
    const c = {
      x: d.cam.x - (e.clientX - d.x) / k,
      y: d.cam.y - (e.clientY - d.y) / k,
    };
    camRef.current = c;
    applyTransform(c, k);
  };
  const onUp = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (overlayRef.current) overlayRef.current.style.opacity = '1';
    try { e.currentTarget.releasePointerCapture(d.id); } catch { /* already gone */ }

    // Commit where you travelled to. The camera stays put — you are the one who
    // moved it. Nothing has to be worked out about which tier you landed in:
    // only one is drawn, and the tabs decide which.
    setCam(camRef.current);
  };

  const changeDensity = (i: number): void => {
    // The whole-map camera centres on the whole map. Keeping the previous focal
    // point there leaves the board parked against an edge with the rest of June
    // off screen, which is the one thing this zoom level exists to prevent.
    const c = DENSITIES[i]?.k == null
      ? { x: layout.totalW / 2, y: layout.totalH / 2 }
      : (() => {
          // Otherwise zoom around what is in the middle of the screen right now,
          // read back out of the live offset so a clamped view does not jump
          // when the clamp lets go.
          const off = offsetFor(camRef.current, k);
          return { x: (size.w / 2 - off.x) / k, y: (size.h / 2 - off.y) / k };
        })();
    // The zoom itself is a step, not a slide. Three fixed cameras is the whole
    // idea, the label layers crossfade to carry the change, and a scale that
    // ramps would have to ramp the drag's pixels-per-unit with it. What eases
    // is only where the camera has to sit afterwards — which for the two close
    // cameras is barely anywhere, since the point under the middle of the
    // screen is deliberately the point kept.
    glideTo(c, scaleFor(i), false);
    setDens(i);
  };

  const goView = (st: Section): void => {
    if (st === view) return;
    // A drag in progress belongs to the layout that is going away, and its
    // start point means nothing in the next one. Same for a move in flight:
    // the follow effect will re-point the camera in the new tier's own
    // coordinates the moment the layout lands.
    dragRef.current = null;
    stopGlide();
    setView(st);
  };

  const off = offsetFor(cam, k);

  // --- wires ---------------------------------------------------------------
  /**
   * Where one bracket stops and the next starts, as a y for each gap.
   *
   * Taken from the laid-out boxes rather than from the order the brackets were
   * built in, because the layout sweeps cards apart to stop them overlapping
   * and a conference can end up drawn somewhere its position in the list does
   * not predict. Sorting by what is actually on the board is the only way the
   * rule lands in the gap it is meant to mark.
   */
  const dividers = useMemo(() => {
    const boxes = graph.brackets
      .map((b) => ({ key: b.key, box: layout.bracketBox.get(b.key) }))
      .filter((x): x is { key: string; box: Box } => !!x.box)
      .sort((a, b) => a.box.y - b.box.y);

    const gaps: { key: string; y: number }[] = [];
    for (let i = 1; i < boxes.length; i++) {
      const above = boxes[i - 1] as { key: string; box: Box };
      const below = boxes[i] as { key: string; box: Box };
      const bottom = above.box.y + above.box.h;
      // Two brackets the sweep left overlapping have no gap to draw in, and a
      // rule through the middle of a card is worse than no rule at all.
      if (below.box.y <= bottom) continue;
      gaps.push({ key: below.key, y: (bottom + below.box.y) / 2 });
    }
    return gaps;
  }, [graph, layout]);

  const wires = useMemo(() => {
    const th = Math.max(1.4, 1.8 * D.ref) / D.ref;
    const list: {
      id: string; x: number; y: number; w: number; h: number; bg: string; op: number;
    }[] = [];
    const channel = new Map<string, number>();
    let seq = 0;
    for (const e of graph.edges) {
      const a = layout.pos.get(e.from);
      const b = layout.pos.get(e.to);
      if (!a || !b) continue;
      const onMyPath = myEdges.has(`${e.from}>${e.to}`);
      const cross = e.kind === 'qualifies';
      const bg = onMyPath ? CLAY : cross ? 'rgba(28,36,48,.5)' : 'rgba(28,36,48,.4)';
      const op = onMyPath ? 1 : cross ? 0.8 : 0.72;
      const w = onMyPath ? th * 1.6 : cross ? th * 1.1 : th;
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      // Qualification lines share a few vertical channels before their target
      // rather than all turning on the same x, so sixteen of them read as a
      // funnel instead of one thick rule.
      if (cross && !channel.has(e.to)) channel.set(e.to, seq++ % 4);
      const midX = cross
        ? x2 - SECTION_GAP * (0.24 + 0.055 * (channel.get(e.to) ?? 0))
        : x1 + Math.max(12, (x2 - x1) / 2);
      const key = `${e.from}>${e.to}`;
      list.push({ id: `${key}a`, x: x1, y: y1 - w / 2, w: Math.max(0, midX - x1), h: w, bg, op });
      if (Math.abs(y2 - y1) > 0.5) {
        list.push({
          id: `${key}b`, x: midX - w / 2, y: Math.min(y1, y2),
          w, h: Math.abs(y2 - y1), bg, op,
        });
      }
      list.push({ id: `${key}c`, x: midX, y: y2 - w / 2, w: Math.max(0, x2 - midX), h: w, bg, op });
    }
    return list;
  }, [graph, layout, myEdges, D]);

  const champ = graph.nodes.find((n) => n.kind === 'champ');
  const champPos = layout.pos.get('champ');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: viewH === null ? height : undefined,
    }}>
      <div style={{
        flex: 'none', display: 'flex', flexDirection: 'column', gap: 7,
        padding: '8px 14px', background: 'var(--paper)',
        borderBottom: '1px solid rgba(28,36,48,.12)',
      }}>
        {/* Which tier is on screen. Three taps rather than a pan, because the
            tiers are drawn one at a time and browsing to the regional you are
            trying to reach should not move the tier you are playing. A tier
            nobody has qualified for yet is still a tier: it draws as the empty
            tree it will be filled into. */}
        <div style={{ display: 'flex', gap: 3 }}>
          {SECTIONS.map((st) => (
            <button
              key={st}
              onClick={() => goView(st)}
              className="tap"
              style={{
                flex: 1, minWidth: 0, padding: '5px 2px',
                background: view === st ? CLAY : 'transparent',
                border: `1px solid ${view === st ? CLAY : 'rgba(28,36,48,.22)'}`,
                color: view === st ? 'var(--cream)' : 'rgba(28,36,48,.6)',
                font: "700 9px var(--mono)", letterSpacing: '.08em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >{TAB_NAME[st]}{st === section ? ' •' : ''}</button>
          ))}
        </div>

        {/* What you are looking at, and how close. Three fixed cameras rather
            than a pinch, because a pinch on a board this size lands you
            somewhere you did not choose. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            flex: 1, minWidth: 0, font: "600 10px var(--mono)", letterSpacing: '.04em',
            color: 'rgba(28,36,48,.7)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{hereLabel(graph, view)}</div>
          <div style={{ flex: 'none', display: 'flex', gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => changeDensity(i)}
                className="tap"
                style={{
                  width: 30, height: 26, display: 'grid', placeItems: 'center',
                  background: dens === i ? CLAY : 'transparent',
                  border: `1px solid ${dens === i ? CLAY : 'rgba(28,36,48,.28)'}`,
                }}
                aria-label={['Names', 'Abbreviations', 'Whole map'][i]}
              >
                <DensityIcon level={i} ink={dens === i ? 'var(--cream)' : 'rgba(28,36,48,.55)'} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={viewRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          flex: viewH === null ? 1 : 'none',
          height: viewH ?? undefined,
          minHeight: 0, position: 'relative', overflow: 'hidden',
          touchAction: 'none', background: 'var(--field)',
        }}
      >
        <div
          ref={canvasRef}
          style={{
            position: 'absolute', left: 0, top: 0, transformOrigin: '0 0',
            willChange: 'transform', pointerEvents: 'none',
            // No CSS transition on the transform. Panning writes this property
            // once per pointer event and a move writes it once per frame, so a
            // transition would restart on every write and turn both into mush —
            // and it could not be trusted to stay off the drag either, since
            // React only re-applies an inline style whose value has changed.
            transform: `translate3d(${off.x}px,${off.y}px,0) scale(${k})`,
          }}
        >
          {/*
            A rule between one bracket and the next.

            Eight conference draws stacked in a column read as one continuous
            tree — there is nothing to say where the Gulf ends and the Atlantic
            begins, so a card halfway down belongs to whichever league the eye
            happens to have been following. The line is drawn in the gap between
            two brackets rather than around each one: a box per tournament would
            put eight more rectangles on a board that is already mostly
            rectangles, and the only thing missing is the boundary.
          */}
          {dividers.map((d) => (
            <div key={`div-${d.key}`} style={{
              position: 'absolute', left: 0, top: d.y,
              width: layout.totalW, height: Math.max(1, 1 / D.ref),
              background: 'rgba(28,36,48,.14)',
            }} />
          ))}

          {graph.brackets.map((b) => {
            const bb = layout.bracketBox.get(b.key);
            if (!bb) return null;
            return (
              <div key={`lbl-${b.key}`} style={{
                position: 'absolute', textAlign: 'right',
                left: 0, width: bb.x - 14 / D.ref,
                top: bb.y + bb.h / 2 - 8 / D.ref,
                font: `700 ${11 / D.ref}px var(--mono)`,
                letterSpacing: '.06em',
                color: b.mine ? CLAY : 'rgba(28,36,48,.42)',
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}>{b.label}</div>
            );
          })}

          {wires.map((w) => (
            <div key={w.id} style={{
              position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
              background: w.bg, opacity: w.op,
            }} />
          ))}

          {graph.nodes.map((n) => {
            const p = layout.pos.get(n.id);
            if (!p) return null;
            const isMine = mine.has(n.id);

            if (n.kind === 'champ') return null;

            // A series, not a game. The card carries the state of the matchup —
            // who leads it and how far it has to go — because that is the unit
            // the format is built out of now.
            const settled = n.winner !== null;
            const started = n.games.length > 0;
            const known = n.a !== null && n.b !== null;
            const mineA = n.a === userTeam;
            const mineB = n.b === userTeam;
            const colourOf = (team: number | null, wins: number, other: number): string => {
              if (team === userTeam) return CLAY;
              if (!known) return 'rgba(28,36,48,.45)';
              if (settled) return n.winner === team ? INK : 'rgba(28,36,48,.5)';
              return wins > other ? INK : 'rgba(28,36,48,.62)';
            };
            const markOf = (team: number | null, wins: number, other: number): string => {
              if (team === null) return 'rgba(28,36,48,.07)';
              const c = teamColour(abbr(team));
              if (!started) return `${c}33`;
              if (settled) return n.winner === team ? c : `${c}4d`;
              return wins >= other ? c : `${c}4d`;
            };
            // A settled series with no games is a bye: the seed was rewarded for
            // finishing high enough that nobody was left to play it in round one.
            const bye = settled && !started;
            const label = (team: number | null, long: boolean): string => {
              if (team === null) return bye ? 'BYE' : 'TBD';
              return (team === userTeam ? '★ ' : '') + (long ? name(team) : abbr(team));
            };

            return (
              <div key={n.id} style={{
                position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h,
                border: `2px ${settled ? 'solid' : 'dashed'} ${
                  isMine ? CLAY : settled ? FAINT : 'rgba(28,36,48,.22)'}`,
                background: started ? 'var(--paper)' : 'rgba(251,247,238,.55)',
                overflow: 'hidden',
              }}>
                <Layer opacity={D.mark}>
                  <div style={{ flex: 1, background: markOf(n.a, n.aWins, n.bWins) }} />
                  <div style={{ flex: 1, background: markOf(n.b, n.bWins, n.aWins) }} />
                </Layer>

                <Layer opacity={D.abbr}>
                  <Side
                    bar={n.a === null ? 'rgba(28,36,48,.14)' : teamColour(abbr(n.a))}
                    seed={n.aSeed} text={label(n.a, false)}
                    score={started ? String(n.aWins) : ''}
                    colour={colourOf(n.a, n.aWins, n.bWins)}
                    weight={settled && n.winner === n.a ? 700 : 400} mine={mineA} big
                  />
                  <Side
                    bar={n.b === null ? 'rgba(28,36,48,.14)' : teamColour(abbr(n.b))}
                    seed={n.bSeed} text={label(n.b, false)}
                    score={started ? String(n.bWins) : ''}
                    colour={colourOf(n.b, n.bWins, n.aWins)}
                    weight={settled && n.winner === n.b ? 700 : 400} mine={mineB} big top
                  />
                </Layer>

                <Layer opacity={D.name}>
                  <Side
                    bar={n.a === null ? 'rgba(28,36,48,.14)' : teamColour(abbr(n.a))}
                    text={label(n.a, true)}
                    score={started ? String(n.aWins) : ''}
                    colour={colourOf(n.a, n.aWins, n.bWins)}
                    weight={settled && n.winner === n.a ? 700 : 400} mine={mineA}
                  />
                  <Side
                    bar={n.b === null ? 'rgba(28,36,48,.14)' : teamColour(abbr(n.b))}
                    text={label(n.b, true)}
                    score={started ? String(n.bWins) : ''}
                    colour={colourOf(n.b, n.bWins, n.aWins)}
                    weight={settled && n.winner === n.b ? 700 : 400} mine={mineB} top
                  />
                </Layer>

                {/* What the series is, in the corner. Best of three reads very
                    differently from best of seven and the card has to say which. */}
                <div style={{
                  position: 'absolute', right: 4, top: 2, opacity: D.mark ? 0 : 0.75,
                  font: "600 9px var(--mono)", letterSpacing: '.06em',
                  color: settled ? 'rgba(28,36,48,.45)' : CLAY,
                  transition: 'opacity 480ms ease',
                }}>BO{n.bestOf}</div>
              </div>
            );
          })}

          {/* The terminus. The only node with nothing after it. */}
          {champ && champPos && (
            <div style={{
              position: 'absolute', left: champPos.x, top: champPos.y,
              width: champPos.w, height: champPos.h,
              border: `5px solid ${CLAY}`,
              background: champ.kind === 'champ' && champ.team !== null
                ? CLAY : 'rgba(168,68,42,.06)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '0 14px',
            }}>
              <div style={{ opacity: D.mark ? 0 : 1, transition: 'opacity 480ms ease' }}>
                <div style={{
                  font: "700 13px var(--mono)", letterSpacing: '.14em',
                  color: champ.kind === 'champ' && champ.team !== null
                    ? 'rgba(246,241,230,.75)' : CLAY,
                }}>NATIONAL CHAMPION</div>
                <div style={{
                  marginTop: 6, font: "800 30px/1.06 var(--display)", textTransform: 'uppercase',
                  color: champ.kind === 'champ' && champ.team !== null
                    ? 'var(--cream)' : 'rgba(28,36,48,.3)',
                }}>
                  {champ.kind === 'champ' && champ.team !== null ? name(champ.team) : 'TBD'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Orientation, pinned at screen size. Steps back while you drag. */}
        <div
          ref={overlayRef}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            transition: 'opacity 260ms ease',
          }}
        >
          <div style={{
            position: 'absolute', right: 8, bottom: 8,
            font: "400 8px var(--mono)", color: 'rgba(28,36,48,.28)',
          }}>{D.mark ? 'the whole postseason' : 'drag to move'}</div>
        </div>
      </div>
    </div>
  );
}

function Layer({ opacity, children }: { opacity: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      opacity, transition: 'opacity 480ms ease',
    }}>{children}</div>
  );
}

function Side(
  { bar, seed, text, score, colour, weight, mine, big, top }:
  {
    bar: string; seed?: number; text: string; score: string; colour: string;
    weight: number; mine: boolean; big?: boolean; top?: boolean;
  },
) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', alignItems: 'center',
      gap: big ? 8 : 7, padding: big ? '0 12px' : '0 9px',
      background: mine ? 'rgba(168,68,42,.12)' : 'transparent',
      borderTop: top ? '1px solid rgba(28,36,48,.09)' : 'none',
    }}>
      <div style={{ flex: 'none', width: 5, height: '54%', background: bar }} />
      {seed !== undefined && seed > 0 && (
        <span style={{
          flex: 'none', font: "600 18px var(--mono)", color: 'rgba(28,36,48,.42)',
        }}>{seed}</span>
      )}
      <span style={{
        flex: 1, minWidth: 0,
        font: big ? `${weight} 22px var(--mono)` : `${weight} 15px var(--body)`,
        color: colour,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{text}</span>
      <span style={{
        flex: 'none', font: `700 ${big ? 24 : 20}px var(--mono)`, color: colour,
      }}>{score}</span>
    </div>
  );
}

/**
 * What the toolbar says you are looking at.
 *
 * Your own bracket if the tier on screen has one, because that is the thing you
 * came to see; otherwise the tier itself. Every bracket on the board is named
 * in its own gutter, so this line does not have to guess at one. It names the
 * tier being *viewed*, not the one being played — the two differ the moment you
 * go and look at a regional you have not reached.
 */
function hereLabel(graph: ReturnType<typeof buildGraph>, view: Section): string {
  const mine = graph.brackets.find((b) => b.mine);
  if (mine) return `${mine.label} · YOU`;
  return view === 'conf' ? 'THE CONFERENCES'
    : view === 'regional' ? 'THE REGIONALS' : 'THE LAST FOUR';
}
function DensityIcon({ level, ink }: { level: number; ink: string }) {
  if (level === 0) {
    return <span style={{ display: 'block', width: 15, height: 11, border: `1.5px solid ${ink}` }} />;
  }
  if (level === 1) {
    return (
      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ display: 'block', width: 6, height: 4, border: `1px solid ${ink}` }} />
        ))}
      </span>
    );
  }
  return (
    <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} style={{ display: 'block', width: 3.5, height: 2.5, background: ink }} />
      ))}
    </span>
  );
}

export { CARD_W, COL_W, CHAMP_W };
