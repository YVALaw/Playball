// PositionPicker.tsx
// Who can play this spot: the lineup ballpark's chooser.
//
// Asked for on 2026-09-25: "if you select one position a modal would open with
// a nice transition from that position you chose that would show the players
// who can play that position". It grows out of the name the coach tapped on
// the field and, once he picks, shrinks back into the same spot, where the new
// man's name is already walking in. So the tap, the choice and the result read
// as one motion rather than three screens.
//
// The men come in the cover matrix's own order (positions.ts): the ones who
// play the spot, then the natural covers, then the stretches and the men out
// of their depth behind one tap, because a shortstop at catcher is a real
// option and also nearly always a mistake. Each carries his glove at the spot,
// taxed for it — at the DH, his bat — since that is what moving him changes;
// his bat goes wherever he does. Picking a man already in the nine trades him
// with the spot's holder, batting order untouched; picking a bench man sends
// the holder to the bench (see `assignPosition` in the store).

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { useScreenOwner } from './screenOwner.js';
import { Face, Icon, cx } from './components/ui/index.js';
import type { Position } from '../engine/types.js';

export interface PickerMan {
  id: string;
  /** Printed as it is: the screen passes the short form it wants. */
  name: string;
  /** His school, for the face's colours. */
  team: string;
  /** Where he is tonight: "Batting 3rd · 1B", "Bench". */
  where: string;
  /** His average, or a dash. */
  avg: string;
  /** His glove at this spot, taxed for it; at the DH, his bat. 0-100. */
  rating: number;
  /** 0 plays it, 1 covers it, 2 a stretch, 3 out of his depth. */
  tier: 0 | 1 | 2 | 3;
  /** Holding the spot tonight. */
  here: boolean;
  /** Why he cannot play tonight, when he cannot. */
  out?: string;
}

const POS_WORD: Record<Position, string> = {
  C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base', SS: 'Shortstop',
  LF: 'Left field', CF: 'Center field', RF: 'Right field', DH: 'Designated hitter', P: 'Pitcher',
};

/** Whether this device asked for stillness, by the app's own setting or the system's. */
function still(): boolean {
  if (typeof document === 'undefined') return true;
  const own = document.documentElement.dataset['motion'];
  if (own === 'reduced') return true;
  if (own === 'full') return false;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The transform that lays a box of `to`'s size exactly over `from`, scaled from its top left. */
function over(from: DOMRect, to: DOMRect): string {
  const sx = Math.max(0.05, from.width / Math.max(1, to.width));
  const sy = Math.max(0.05, from.height / Math.max(1, to.height));
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 0.7, 0.2)';

export function PositionPicker({
  pos, from, men, onPick, onClose,
}: {
  pos: Position;
  /** The label the coach tapped: where the picker grows from and goes back to. */
  from: DOMRect | null;
  men: PickerMan[];
  /** He plays here now. Called before the picker closes, so his name is already moving. */
  onPick: (id: string) => void;
  /** The picker has finished closing. */
  onClose: () => void;
}) {
  const host = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  const owner = useScreenOwner();
  const panel = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const scrim = useRef<HTMLDivElement | null>(null);
  const closing = useRef(false);
  const [more, setMore] = useState(false);

  // Grows out of the tapped name: the panel starts laid over the label and
  // opens to its own size, the words fading in once there is room for them.
  useLayoutEffect(() => {
    const el = panel.current;
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    if (!el || !from || still()) return;
    el.animate(
      [
        { transform: over(from, el.getBoundingClientRect()), borderRadius: '10px', opacity: 0.9 },
        { transform: 'none', borderRadius: '24px', opacity: 1 },
      ],
      { duration: 360, easing: EASE_OUT },
    );
    body.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 130, easing: 'ease-out', fill: 'backwards' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Back into the spot it came from, then gone. Once, however it is asked. */
  const close = (): void => {
    if (closing.current) return;
    closing.current = true;
    const el = panel.current;
    if (!el || !from || still()) { onClose(); return; }
    body.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' });
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
    const shrink = el.animate(
      [
        { transform: 'none', borderRadius: '24px', opacity: 1 },
        { transform: over(from, el.getBoundingClientRect()), borderRadius: '10px', opacity: 0.35 },
      ],
      { duration: 290, easing: EASE_IN, fill: 'forwards' },
    );
    // The animation's end, or a timer just past it: a page that is not
    // painting (a backgrounded app, the test pane) never ends an animation,
    // and the picker would sit there closed-looking but still in the way.
    let gone = false;
    const finish = (): void => { if (gone) return; gone = true; onClose(); };
    shrink.onfinish = finish;
    shrink.oncancel = finish;
    window.setTimeout(finish, 360);
  };
  useDialogFocus(panel, close, { active: !!host });

  const pick = (m: PickerMan): void => {
    if (closing.current) return;
    if (!m.here && !m.out) onPick(m.id);
    close();
  };

  const holder = men.find((m) => m.here);
  const byRating = (a: PickerMan, b: PickerMan): number => Number(!!a.out) - Number(!!b.out) || b.rating - a.rating;
  const plays = men.filter((m) => m.tier === 0).sort(byRating);
  const covers = men.filter((m) => m.tier === 1).sort(byRating);
  const stretches = men.filter((m) => m.tier === 2).sort(byRating);
  const deep = men.filter((m) => m.tier === 3).sort(byRating);
  const others = stretches.length + deep.length;
  // Everybody else is folded away unless nobody fits: a card with no one at
  // the spot and no cover should not hide the only answers it has.
  const showOthers = more || plays.length + covers.length === 0;
  const dh = pos === 'DH';
  const unit = dh ? 'bat' : 'glove';

  const row = (m: PickerMan) => (
    <button
      key={m.id}
      type="button"
      className={cx('pb-picker__man', m.here && 'is-here', m.out && 'is-out')}
      disabled={!!m.out}
      aria-current={m.here ? 'true' : undefined}
      onClick={() => pick(m)}
    >
      <Face id={m.id} team={m.team} size={34} />
      <span className="pb-picker__who">
        <span className="pb-picker__name">
          <span className="pb-ellipsis">{m.name}</span>
          {m.here && <span className="pb-picker__here">Here now</span>}
        </span>
        <span className={cx('pb-picker__where', m.out && 'is-out')}>
          {m.out ?? (m.avg !== '—' ? `${m.where} · ${m.avg}` : m.where)}
        </span>
      </span>
      <span className="pb-picker__num">
        <b>{m.rating}</b>
        <small>{unit}</small>
      </span>
    </button>
  );

  const group = (title: string, list: PickerMan[]) => list.length > 0 && (
    <section className="pb-picker__group" aria-label={title}>
      <h3 className="pb-picker__label">{title}<span>{list.length}</span></h3>
      <div className="pb-picker__list">{list.map(row)}</div>
    </section>
  );

  if (!host) return null;
  return createPortal(
    <div className="pb-picker-host" data-owner={owner}>
      <div ref={scrim} className="pb-picker-host__scrim" onClick={close} aria-hidden />
      <section
        ref={panel}
        className="pb-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pb-picker-title"
      >
        <header className="pb-picker__head">
          <span className="pb-picker__pos" aria-hidden>{pos}</span>
          <span className="pb-picker__titles">
            <h2 id="pb-picker-title" className="pb-picker__title">{POS_WORD[pos]}</h2>
            <span className={cx('pb-picker__now', !holder && 'is-empty')}>
              {holder ? `Now ${holder.name} · ${unit} ${holder.rating}` : 'Nobody plays here'}
            </span>
          </span>
          <button type="button" className="pb-icon-btn" aria-label="Close" onClick={close}>
            <Icon name="cross" size={20} />
          </button>
        </header>
        <div ref={body} className="pb-picker__body">
          {group(dh ? 'Any hitter' : 'Plays it', plays)}
          {group('Can cover', covers)}
          {others > 0 && (showOthers
            ? (
              <>
                {group('A stretch', stretches)}
                {group('Out of his depth', deep)}
              </>
            ) : (
              <button type="button" className="pb-picker__more" onClick={() => setMore(true)}>
                <span>Show {others} out of position</span>
                <Icon name="chevron-down" size={16} />
              </button>
            ))}
        </div>
      </section>
    </div>,
    host,
  );
}
