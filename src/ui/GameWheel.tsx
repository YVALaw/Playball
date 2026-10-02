// GameWheel.tsx
// Home's schedule, as a drum of game cards: played games above, the ones to
// come below, the next one in front. Drag, scroll, arrow keys or tap a card
// behind to turn it; the rail on the right jumps to a week. When the next
// game moves (a sim), the drum turns to it.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './components/ui/index.js';

export interface WheelItem {
  key: string | number;
  week: number;
}

interface Props<T extends WheelItem> {
  items: readonly T[];
  /** The card in front when nothing is being looked at: the next game. */
  home: number;
  /** A card's face. `front` is true for the card in front. */
  render: (item: T, index: number, front: boolean) => ReactNode;
  /** A tap on the front card. */
  onOpen?: (item: T, index: number) => void;
  /** Tells Home which card is in front, for the label over the drum. */
  onFocus?: (index: number) => void;
  /** Turn to this index when it changes (the "back to next game" chip). */
  jump?: { to: number; n: number };
}

const CARD_H = 168;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Where a card sits for an offset `o` from the front, on a drum of radius r. */
function geo(o: number, r: number): { y: number; t: string; op: number } {
  const a = Math.abs(o);
  const ang = clamp(o * 27, -80, 80);
  const rad = (ang * Math.PI) / 180;
  const y = Math.sin(rad) * r;
  const z = (Math.cos(rad) - 1) * r;
  return {
    y,
    t: `perspective(760px) translate3d(0,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${(-ang).toFixed(1)}deg)`,
    op: a > 3.2 ? 0 : Math.max(0, 1 - a * 0.27),
  };
}

export function GameWheel<T extends WheelItem>({ items, home, render, onOpen, onFocus, jump }: Props<T>) {
  const n = items.length;
  const [f, setFState] = useState(home);
  const [dragging, setDragging] = useState(false);
  const [r, setR] = useState(230);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; f: number; moved: boolean; id: number; caught: boolean } | null>(null);
  const acc = useRef(0);
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
    The drum is driven frame by frame, never by a CSS transition: a flick
    keeps turning and slows to a stop, and every move ends on a card.
    `fRef` mirrors `f` for the handlers; `target` is where the drum is going.
  */
  const fRef = useRef(home);
  const target = useRef(home);
  /** The running glide's number; bumping it stops the glide. Null when still. */
  const frame = useRef<number | null>(null);
  const runs = useRef(0);
  const samples = useRef<{ t: number; f: number }[]>([]);
  const setF = (v: number): void => { fRef.current = v; setFState(v); };
  const halt = (): boolean => {
    runs.current += 1;
    if (frame.current === null) return false;
    frame.current = null;
    return true;
  };
  /*
    The next frame, with a timer behind it: a webview that stops painting
    (a hidden pane, a throttled tab) never calls back, and a glide that
    never ends leaves the drum between two cards.
  */
  const nextFrame = (cb: (now: number) => void): void => {
    let fired = false;
    const go = (): void => { if (!fired) { fired = true; cb(performance.now()); } };
    requestAnimationFrame(go);
    setTimeout(go, 34);
  };
  const reduced = (): boolean => document.documentElement.dataset.motion === 'reduced'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  /** Ease from where the drum is to card `to`; `v0` (cards per ms) makes the start match a flick. */
  const glide = (to: number, v0 = 0): void => {
    const end = clamp(Math.round(to), 0, Math.max(0, n - 1));
    target.current = end;
    halt();
    const from = fRef.current;
    const dist = end - from;
    if (Math.abs(dist) < 0.001 || reduced()) { setF(end); return; }
    // Ease-out cubic starts at 3·dist/duration; pick the duration so that
    // speed equals the finger's, then keep it in a comfortable range.
    const dur = Math.abs(v0) > 0.0005
      ? clamp((3 * Math.abs(dist)) / Math.abs(v0), 280, 1800)
      : clamp(240 + Math.abs(dist) * 90, 240, 900);
    const t0 = performance.now();
    const run = runs.current;
    const tick = (now: number): void => {
      if (run !== runs.current) return;
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      setF(from + dist * e);
      if (p < 1) nextFrame(tick);
      else frame.current = null;
    };
    frame.current = run;
    nextFrame(tick);
  };
  useEffect(() => () => { halt(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    A sim moved the next game: turn to it. Only when it actually moved: Home
    stays mounted behind other screens (App.tsx), its effects run again each
    time it is shown, and a back swipe must find the wheel where it was left.
  */
  const lastHome = useRef(home);
  useEffect(() => {
    if (lastHome.current === home) return;
    lastHome.current = home;
    glide(home);
  }, [home]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastJump = useRef(jump?.n);
  useEffect(() => {
    if (!jump || lastJump.current === jump.n) return;
    lastJump.current = jump.n;
    glide(jump.to);
  }, [jump?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const front = clamp(Math.round(f), 0, Math.max(0, n - 1));
  useEffect(() => { onFocus?.(front); }, [front]); // eslint-disable-line react-hooks/exhaustive-deps

  // The drum's radius follows the room it has, so short phones keep the
  // cards above and below in view.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const size = (): void => setR(Math.max(150, Math.min(260, el.clientHeight * 0.72)));
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => { if (accTimer.current) clearTimeout(accTimer.current); }, []);

  if (n === 0) return null;
  // Steps add up from where the drum is headed, so quick presses queue.
  const step = (d: number): void => glide(clamp(target.current + d, 0, n - 1));

  const weeks = [...new Set(items.map((g) => g.week))];
  const firstOfWeek = new Map<number, number>();
  items.forEach((g, i) => { if (!firstOfWeek.has(g.week)) firstOfWeek.set(g.week, i); });
  const homeWeek = items[home]?.week ?? 0;
  const frontWeek = items[front]?.week ?? 0;

  const shown: number[] = [];
  for (let i = Math.max(0, Math.floor(f - 3.4)); i <= Math.min(n - 1, Math.ceil(f + 3.4)); i++) shown.push(i);

  return (
    <div className="pb-wheel">
      <div
        ref={boxRef}
        className={`pb-wheel__drum${dragging ? ' is-dragging' : ''}`}
        role="listbox"
        aria-label="Schedule"
        aria-activedescendant={`pb-wheel-${String(items[front]?.key)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const it = items[front]; if (it) onOpen?.(it, front); }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // A finger on a spinning drum catches it where it is.
          const caught = halt();
          drag.current = { y: e.clientY, f: fRef.current, moved: false, id: e.pointerId, caught };
          samples.current = [{ t: e.timeStamp, f: fRef.current }];
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.abs(dy) > 6) {
            d.moved = true;
            setDragging(true);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
          }
          if (!d.moved) return;
          // Past either end the drum gives a little, then resists.
          let v = d.f - dy / 70;
          if (v < 0) v = -0.35 * (1 - 1 / (1 - v));
          else if (v > n - 1) v = n - 1 + 0.35 * (1 - 1 / (1 + v - (n - 1)));
          setF(v);
          samples.current.push({ t: e.timeStamp, f: v });
          if (samples.current.length > 8) samples.current.shift();
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          if (d.moved) {
            setDragging(false);
            // The finger's speed over its last ~100ms, in cards per ms.
            const s = samples.current.filter((x) => e.timeStamp - x.t <= 100);
            const a = s[0], b = s[s.length - 1];
            const v = a && b && b.t > a.t && e.timeStamp - b.t < 80 ? (b.f - a.f) / (b.t - a.t) : 0;
            // How far a flick carries: its speed times a decay constant.
            glide(Math.abs(v) > 0.002 ? fRef.current + v * 320 : fRef.current, v);
            return;
          }
          if (d.caught) { glide(fRef.current); return; }
          // A tap: the card under the finger comes to the front; the front
          // card opens.
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = e.clientY - (rect.top + rect.height / 2);
          const base = Math.round(f);
          let best = base, bd = Infinity;
          for (let o = -3; o <= 3; o++) {
            const i = base + o;
            if (i < 0 || i >= n) continue;
            const dd = Math.abs(geo(o, r).y - rel);
            if (dd < bd) { bd = dd; best = i; }
          }
          if (best === base && Math.abs(rel) <= CARD_H / 2) { const it = items[base]; if (it) onOpen?.(it, base); }
          else glide(best);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); glide(fRef.current); }}
        onWheel={(e) => {
          acc.current += e.deltaY;
          if (accTimer.current) clearTimeout(accTimer.current);
          accTimer.current = setTimeout(() => { acc.current = 0; }, 180);
          if (Math.abs(acc.current) >= 45) { const s = Math.sign(acc.current); acc.current = 0; step(s); }
        }}
      >
        {shown.map((i) => {
          const o = i - f;
          const a = Math.abs(o);
          const g = geo(o, r);
          const it = items[i]!;
          return (
            <div
              key={it.key}
              id={`pb-wheel-${String(it.key)}`}
              role="option"
              aria-selected={i === front}
              className="pb-wheel__slot"
              style={{
                transform: g.t,
                opacity: a > 3.4 ? 0 : a > 2.5 ? Math.max(0, 1 - (a - 2.5) / 0.9) : 1,
                zIndex: 100 - Math.round(a * 10),
              }}
            >
              {render(it, i, i === front && a < 0.5)}
              <span className="pb-wheel__dim" style={{ opacity: Math.min(0.88, 1 - g.op) }} />
            </div>
          );
        })}
        <div className="pb-wheel__fade pb-wheel__fade--top" />
        <div className="pb-wheel__fade pb-wheel__fade--bottom" />
      </div>
      <div className="pb-wheel__rail">
        <button type="button" aria-label="Earlier game" onClick={() => step(-1)}>
          <Icon name="chevron-down" size={14} className="pb-wheel__up" />
        </button>
        <div className="pb-wheel__weeks">
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Week ${w}`}
              onClick={() => glide(firstOfWeek.get(w) ?? 0)}
            >
              <span
                className={w === frontWeek ? 'is-on' : w === homeWeek ? 'is-now' : w < homeWeek ? 'is-past' : ''}
              />
            </button>
          ))}
        </div>
        <button type="button" aria-label="Later game" onClick={() => step(1)}>
          <Icon name="chevron-down" size={14} />
        </button>
      </div>
    </div>
  );
}
