// Avatar.tsx
// A face for every player.
//
// Four thousand players and no artist, so the portraits are drawn from the
// player's own id: the same man gets the same face on the recruiting board, on
// his card, and in the draft results four years later. That consistency is the
// whole point — a face that shuffles on every render is worse than no face,
// because it stops being *his*.
//
// The face is a stack of PNG layers from public/avatars, all on one 144x216
// canvas so they line up at 0,0: neck, jersey, head, eyes, mouth, cap, outlines,
// facial hair. Skin tone and the program's cap colours are not baked into the
// PNGs — they are CSS backgrounds showing through mask layers — so one set of
// images serves every skin tone and all ninety-six programs. The layers are
// generated from the reference sheet by scripts/avatar-compose.mjs.

/// <reference types="vite/client" />
import { CONFERENCES } from '../data/schools.js';
import { ATLAS } from './avatar-atlas.js';

/** A stable value in [0,1) from an id and a salt. Same input, same face. */
function hash(seed: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const v = Math.sin(h * 0.0001 + salt * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

const pick = <T,>(list: readonly T[], seed: string, salt: number): T =>
  list[Math.floor(hash(seed, salt) * list.length)] as T;

const BASE = `${import.meta.env.BASE_URL}avatars/`;

/**
 * The circle fit shows this window of the canvas: from just above the cap to
 * the collar, a square 144 canvas units tall. Above it is only the crown of the
 * tallest hair; below it, more shirt than a 34px row has room for.
 */
const CIRCLE_TOP = 24;

interface Props {
  /** The player's id. Everything about the face is derived from it. */
  id: string;
  /**
   * Team abbreviation. With one he wears the program's cap, in its colours,
   * with its letter; without one he is a recruit — no cap, plain grey shirt.
   */
  team?: string;
  /** Pixels: the side of the square for `circle`, the height for `bust`. */
  size?: number;
  /** `circle` for rows and discs; `bust` shows the whole 2:3 portrait. */
  fit?: 'circle' | 'bust';
}

export function Avatar({ id, team, size = 40, fit = 'circle' }: Props) {
  const skin = pick(ATLAS.skins, id, 1);
  const hair = pick(ATLAS.hair, id, 3);
  const eyes = pick(ATLAS.eyes, id, 6);
  const beard = hash(id, 4) > 0.78 ? pick(ATLAS.beards, id, 7) : null;

  const colour = team ? teamColour(team) : null;
  const cap = colour ? capColours(colour) : null;
  const jersey = colour ? nearestJersey(colour) : 'grey';
  const dir = cap ? 'cap' : 'head';

  // The canvas is always 2:3. The circle fit slides it up inside a square box
  // so the face, not the shirt, is what the circle holds.
  const width = fit === 'bust' ? size * (ATLAS.width / ATLAS.height) : size;
  const canvasH = width * (ATLAS.height / ATLAS.width);
  const top = fit === 'bust' ? 0 : -(CIRCLE_TOP / ATLAS.width) * size;
  const mark = ATLAS.crown[hair];

  return (
    <span className="avatar pt" style={{ width, height: size }} aria-hidden="true">
      <span className="pt-canvas" style={{ top, height: canvasH }}>
        <Tint src="neck.skin.png" colour={skin} />
        <Layer src="neck.rest.png" />
        <Layer src={`jersey/${jersey}.png`} />
        <Tint src={`${dir}/${hair}.skin.png`} colour={skin} />
        <Layer src={`eyes/${eyes}.png`} />
        <Layer src="mouth.png" />
        {cap && <Tint src={`cap/${hair}.crown.png`} colour={cap.crown} />}
        {cap && <Tint src={`cap/${hair}.brim.png`} colour={cap.brim} />}
        {/* Outlines go over every tint, and the beard over the jaw line. */}
        <Layer src={`${dir}/${hair}.rest.png`} />
        {beard && <Layer src={`beard/${beard}.png`} />}
        {cap && team && (
          <span
            className="pt-letter"
            style={{
              left: `${(mark.x / ATLAS.width) * 100}%`,
              top: `${(mark.y / ATLAS.height) * 100}%`,
              fontSize: canvasH * 0.115,
              color: cap.letter,
            }}
          >{team[0]}</span>
        )}
      </span>
    </span>
  );
}

/** A flat colour showing through a mask: skin, or a cap panel. */
function Tint({ src, colour }: { src: string; colour: string }) {
  const mask = `url("${BASE}${src}")`;
  return <span className="pt-l" style={{ backgroundColor: colour, WebkitMaskImage: mask, maskImage: mask }} />;
}

/** A layer drawn as-is: outlines, hair, eyes, a shirt. */
function Layer({ src }: { src: string }) {
  return <img className="pt-l" src={`${BASE}${src}`} alt="" draggable={false} />;
}

/* ------------------------------------------------------------- colours -- */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const luminance = (hex: string) => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/**
 * How a program's one colour becomes a cap.
 *
 * The reference does two things: a dark crown carries its own colour on the
 * brim and a pale letter; a light crown takes a dark brim and a dark letter.
 */
function capColours(colour: string): { crown: string; brim: string; letter: string } {
  return luminance(colour) < 0.55
    ? { crown: colour, brim: colour, letter: '#f6f1e6' }
    : { crown: colour, brim: '#1b2a52', letter: '#1b2a52' };
}

/** The sheet's jersey whose body colour is closest to the program's. */
function nearestJersey(colour: string): string {
  const [r, g, b] = rgb(colour);
  let best = 'grey', bestD = Infinity;
  for (const j of ATLAS.jerseys) {
    if (j.name === 'catcher') continue;
    const [jr, jg, jb] = rgb(j.body);
    const d = (r - jr) ** 2 + (g - jg) ** 2 + (b - jb) ** 2;
    if (d < bestD) { bestD = d; best = j.name; }
  }
  return best;
}

/**
 * The program's colour, from the frozen school table.
 *
 * Exported because a school's name should carry it too. Ninety six programs in
 * one typeface are ninety six strings; in their own colours they are places you
 * start to recognise, which is most of what makes a league feel inhabited.
 */
export function teamColour(abbr?: string): string {
  if (!abbr) return '#236b42';
  for (const conf of CONFERENCES) {
    for (const school of conf.schools) {
      if (school.abbr === abbr) return school.color;
    }
  }
  return '#236b42';
}
