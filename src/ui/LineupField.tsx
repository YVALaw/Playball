// LineupField.tsx
// Tonight's nine on a ballpark, each name standing at his position.
//
// Asked for in the UI clarity review (2026-09-25): "make it look more like the
// ball park and compact a bit the names and locate them in the positions". The
// field replaces the row of position chips that used to sit over the batting
// order, and does the chips' job better: a tap on a position opens the men who
// can play it (PositionPicker.tsx), grown out of the name that was tapped. It
// also takes the other half of the lineup grammar, "tap a player, then the
// spot he should take": with a man picked in the order or on the bench, a tap
// on the field puts him there.
//
// The palette is the 3D park's (Diamond3D.tsx), flattened: the same grass,
// dirt, track and wall, so the two drawings of the same field agree. The
// labels are keyed by player, so a man who changes position walks across the
// grass to his new spot instead of blinking there.

import type { ButtonHTMLAttributes } from 'react';
import { Icon, cx } from './components/ui/index.js';
import { ordinal } from './format.js';
import type { Position } from '../engine/types.js';

/** The drawing's own units. The labels are placed in the same box, as percentages of it. */
const W = 360;
const H = 316;
const HOME = { x: 180, y: 258 };
/** Home to first, in drawing units. */
const SIDE = 92;
const D = SIDE / Math.SQRT2;
const MOUND = { x: HOME.x, y: HOME.y - 0.475 * SIDE * Math.SQRT2 };
/** The wall and the warning track, measured from the plate. */
const WALL_R = 238;
const TRACK_R = 227;
/** The edge of the infield dirt, measured from the mound. */
const SKIN_R = 95;

/**
 * Where each position's name stands. Tuned so no two labels touch down to a
 * 288px-wide field (a 320px phone): the labels are a quarter of the field
 * wide, so neighbours across are kept apart by height, not width.
 */
const SPOT: Record<Position | 'P', { x: number; y: number }> = {
  CF: { x: 180, y: 44 },
  LF: { x: 58, y: 100 },
  RF: { x: 302, y: 100 },
  SS: { x: 131, y: 153 },
  '2B': { x: 229, y: 153 },
  '3B': { x: 76, y: 207 },
  '1B': { x: 284, y: 207 },
  P: { x: 180, y: 212 },
  C: { x: 180, y: 293 },
  DH: { x: 60, y: 293 },
};

/** The order a screen reader walks the field in: the nine, then the mound (last). */
const WALK: Array<Position> = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

const pct = (v: number, of: number): string => `${((v / of) * 100).toFixed(3)}%`;

/** A point on a foul line, `t` units out from the plate. side −1 is third base, +1 first. */
function foul(t: number, side: -1 | 1): { x: number; y: number } {
  return { x: HOME.x + side * t * Math.SQRT1_2, y: HOME.y - t * Math.SQRT1_2 };
}

/** Where a foul line crosses the circle of radius r around the mound. */
function skinEdge(side: -1 | 1): { x: number; y: number } {
  // |HOME + t·u − MOUND|² = r², with u the foul line's unit vector.
  const dy = HOME.y - MOUND.y;
  const b = -2 * dy * Math.SQRT1_2;
  const c = dy * dy - SKIN_R * SKIN_R;
  const t = (-b + Math.sqrt(b * b - 4 * c)) / 2;
  return foul(t, side);
}

const f = (n: number): string => n.toFixed(1);

/** The park itself: foul ground, the fair grass with its stripes, the track, the wall, the infield. */
function Park() {
  const wallL = foul(WALL_R, -1);
  const wallR = foul(WALL_R, 1);
  const trackL = foul(TRACK_R, -1);
  const trackR = foul(TRACK_R, 1);
  const skinL = skinEdge(-1);
  const skinR = skinEdge(1);
  const first = { x: HOME.x + D, y: HOME.y - D };
  const second = { x: HOME.x, y: HOME.y - 2 * D };
  const third = { x: HOME.x - D, y: HOME.y - D };
  const fair = `M${f(HOME.x)} ${f(HOME.y)} L${f(wallL.x)} ${f(wallL.y)} A${WALL_R} ${WALL_R} 0 0 1 ${f(wallR.x)} ${f(wallR.y)} Z`;
  const track = `M${f(wallL.x)} ${f(wallL.y)} A${WALL_R} ${WALL_R} 0 0 1 ${f(wallR.x)} ${f(wallR.y)}`
    + ` L${f(trackR.x)} ${f(trackR.y)} A${TRACK_R} ${TRACK_R} 0 0 0 ${f(trackL.x)} ${f(trackL.y)} Z`;
  const skin = `M${f(HOME.x)} ${f(HOME.y)} L${f(skinR.x)} ${f(skinR.y)} A${SKIN_R} ${SKIN_R} 0 0 0 ${f(skinL.x)} ${f(skinL.y)} Z`;
  // The grass inside the base paths, pulled in off the bags so the paths show.
  const inset = 9;
  const infieldGrass = [
    `${f(HOME.x)},${f(HOME.y - inset * 1.3)}`,
    `${f(first.x - inset)},${f(first.y)}`,
    `${f(second.x)},${f(second.y + inset)}`,
    `${f(third.x + inset)},${f(third.y)}`,
  ].join(' ');
  const bag = (p: { x: number; y: number }, key: string) => (
    <rect key={key} className="pb-park__bag" x={f(p.x - 3.6)} y={f(p.y - 3.6)} width="7.2" height="7.2" transform={`rotate(45 ${f(p.x)} ${f(p.y)})`} />
  );
  return (
    <svg className="pb-park__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
      <defs>
        <pattern id="pb-park-mow" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(45)">
          <rect className="pb-park__mow" width="13" height="26" />
        </pattern>
        <clipPath id="pb-park-fair"><path d={fair} /></clipPath>
      </defs>
      <rect className="pb-park__foul" width={W} height={H} rx="14" />
      <path className="pb-park__grass" d={fair} />
      <rect width={W} height={H} fill="url(#pb-park-mow)" clipPath="url(#pb-park-fair)" />
      <path className="pb-park__track" d={track} />
      <path className="pb-park__wall" d={`M${f(wallL.x)} ${f(wallL.y)} A${WALL_R} ${WALL_R} 0 0 1 ${f(wallR.x)} ${f(wallR.y)}`} />
      <path className="pb-park__cap" d={`M${f(wallL.x)} ${f(wallL.y - 2.6)} A${WALL_R + 2.6} ${WALL_R + 2.6} 0 0 1 ${f(wallR.x)} ${f(wallR.y - 2.6)}`} />
      <line className="pb-park__pole" x1={f(wallL.x)} y1={f(wallL.y)} x2={f(wallL.x)} y2={f(wallL.y - 14)} />
      <line className="pb-park__pole" x1={f(wallR.x)} y1={f(wallR.y)} x2={f(wallR.x)} y2={f(wallR.y - 14)} />
      <path className="pb-park__dirt" d={skin} />
      <polygon className="pb-park__infield" points={infieldGrass} />
      <line className="pb-park__chalk" x1={f(HOME.x)} y1={f(HOME.y)} x2={f(wallL.x)} y2={f(wallL.y)} />
      <line className="pb-park__chalk" x1={f(HOME.x)} y1={f(HOME.y)} x2={f(wallR.x)} y2={f(wallR.y)} />
      <circle className="pb-park__dirt" cx={f(MOUND.x)} cy={f(MOUND.y)} r="10" />
      <rect className="pb-park__rubber" x={f(MOUND.x - 3.5)} y={f(MOUND.y - 0.9)} width="7" height="1.8" />
      <circle className="pb-park__dirt" cx={f(HOME.x)} cy={f(HOME.y)} r="15" />
      <circle className="pb-park__deck" cx={f(HOME.x - 58)} cy={f(HOME.y + 16)} r="5" />
      <circle className="pb-park__deck" cx={f(HOME.x + 58)} cy={f(HOME.y + 16)} r="5" />
      {bag(first, '1')}
      {bag(second, '2')}
      {bag(third, '3')}
      <path
        className="pb-park__bag"
        d={`M${f(HOME.x - 4)} ${f(HOME.y - 3)} h8 v3.4 l-4 3.6 l-4 -3.6 Z`}
      />
    </svg>
  );
}

export interface FieldMan {
  id: string;
  name: string;
  pos: Position;
  /** 1 to 9. */
  order: number;
  /** The one number under his name: his average, or "Out". */
  line: string;
  out?: boolean;
  /** Playing somewhere he is not at home: out of position, still settling, or never took to it. */
  offPos?: boolean;
  /** A long press, for his stats. */
  hold?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'type'>;
}

/** "Emiliano Gravestock" becomes "Gravestock"; a one-word name stays whole. */
export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

const POS_WORD: Record<Position, string> = {
  C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base', SS: 'Shortstop',
  LF: 'Left field', CF: 'Center field', RF: 'Right field', DH: 'Designated hitter', P: 'Pitcher',
};


export function LineupField({
  men, missing = [], spot, picked, pitcher, interactive, onSpot, onMan, onPitcher, className,
}: {
  men: FieldMan[];
  /** Positions nobody holds tonight: drawn as an empty, tappable spot. */
  missing?: Position[];
  /** The position picked, waiting for its man. */
  spot: Position | null;
  /** The man picked in the order or on the bench, waiting for his spot. */
  picked: string | null;
  /** Tonight's starter, on the mound. */
  pitcher?: { name: string; line: string; out?: boolean } | null;
  /** False when the bench coach writes the card: a tap opens the man instead. */
  interactive: boolean;
  /** A position tapped, with where its label sits, for a picker to grow out of. */
  onSpot: (pos: Position, from: DOMRect) => void;
  onMan?: (id: string) => void;
  onPitcher?: () => void;
  className?: string;
}) {
  // Two men at one position: the second stands a step behind the first, so
  // neither hides the other and the doubled spot reads as the problem it is.
  const seen = new Map<Position, number>();
  const placed = men.map((m) => {
    const n = seen.get(m.pos) ?? 0;
    seen.set(m.pos, n + 1);
    return { m, stack: n };
  });
  const doubled = new Set([...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p));
  const byWalk = [...placed].sort((a, b) => WALK.indexOf(a.m.pos) - WALK.indexOf(b.m.pos));

  const place = (pos: Position | 'P', stack = 0): { left: string; top: string } => {
    const at = SPOT[pos];
    return { left: pct(at.x, W), top: pct(at.y + stack * 34, H) };
  };

  return (
    <div className={cx('pb-park', !interactive && 'is-readonly', spot !== null && 'has-spot', picked !== null && 'has-pick', className)}>
      <Park />
      {byWalk.map(({ m, stack }) => {
        const isSpot = spot === m.pos;
        const isPicked = picked === m.id;
        const warn = doubled.has(m.pos) || m.offPos;
        return (
          <button
            key={m.id}
            type="button"
            {...m.hold}
            className={cx('pb-park__man', isSpot && 'is-spot', isPicked && 'is-picked', m.out && 'is-out', warn && 'is-warn')}
            style={place(m.pos, stack)}
            data-pos={m.pos}
            aria-pressed={interactive ? isSpot || isPicked : undefined}
            aria-haspopup={interactive ? 'dialog' : undefined}
            aria-label={`${POS_WORD[m.pos]}: ${m.name}, batting ${ordinal(m.order)}${m.out ? ', cannot play' : ''}${warn ? ', out of position' : ''}`}
            onClick={(e) => {
              if (interactive) onSpot(m.pos, e.currentTarget.getBoundingClientRect());
              else onMan?.(m.id);
            }}
          >
            <span className="pb-park__name" aria-hidden>{surname(m.name)}</span>
            <span className="pb-park__line" aria-hidden>
              <span className="pb-park__num">{m.order}</span>
              <b>{m.pos}</b>
              {m.out ? <span className="pb-park__flag is-out">Out</span>
                : warn ? <span className="pb-park__flag is-warn"><Icon name="alert" size={10} />{m.line}</span>
                  : <span>{m.line}</span>}
            </span>
          </button>
        );
      })}
      {missing.map((pos) => (
        <button
          key={`missing-${pos}`}
          type="button"
          className={cx('pb-park__man', 'is-empty', spot === pos && 'is-spot')}
          style={place(pos)}
          data-pos={pos}
          aria-pressed={interactive ? spot === pos : undefined}
          aria-haspopup={interactive ? 'dialog' : undefined}
          aria-label={`${POS_WORD[pos]}: nobody`}
          disabled={!interactive}
          onClick={(e) => onSpot(pos, e.currentTarget.getBoundingClientRect())}
        >
          <span className="pb-park__name" aria-hidden>Nobody</span>
          <span className="pb-park__line" aria-hidden><Icon name="plus" size={10} /><b>{pos}</b></span>
        </button>
      ))}
      {pitcher && (
        <button
          type="button"
          className={cx('pb-park__man', 'pb-park__man--arm', pitcher.out && 'is-out')}
          style={place('P')}
          aria-label={`Pitching tonight: ${pitcher.name}. Opens the pitching staff.`}
          onClick={onPitcher}
        >
          <span className="pb-park__name" aria-hidden>{surname(pitcher.name)}</span>
          <span className="pb-park__line" aria-hidden><b>P</b><span>{pitcher.line}</span></span>
        </button>
      )}
    </div>
  );
}
