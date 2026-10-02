// Honours.tsx
// Trophies, award emblems and the Hall of Fame logo, as the art drawn for them.
//
// One webp per honour, cut from the art sheets: ./trophies for the five ways a
// season ends in silverware, ./awards for the six season awards, ./hall for the
// Hall of Fame logo. Anything without a file falls back to the plain medal, so
// an honour the engine adds later still renders. All of it is decoration: the
// words beside it say what it is, so the images are silent to screen readers
// unless a caller passes a label.

import { Medal } from './components/ui/index.js';

/* The same glob-through-a-cast as Crest.tsx, once per folder: Vite only
   expands a literal call. */
type UrlGlob = (pattern: string, options: { eager: true; query: '?url'; import: 'default' }) => Record<string, string>;
const TROPHIES = (import.meta as unknown as { glob: UrlGlob }).glob('./trophies/*.webp', {
  eager: true, query: '?url', import: 'default',
});
const AWARDS = (import.meta as unknown as { glob: UrlGlob }).glob('./awards/*.webp', {
  eager: true, query: '?url', import: 'default',
});
const HALL = (import.meta as unknown as { glob: UrlGlob }).glob('./hall/*.webp', {
  eager: true, query: '?url', import: 'default',
});

export type TrophyKind = 'conference' | 'regional' | 'bracket' | 'national' | 'runnerUp';

const TROPHY_METAL: Record<TrophyKind, 'gold' | 'silver' | 'bronze'> = {
  conference: 'bronze', regional: 'silver', bracket: 'silver', national: 'gold', runnerUp: 'silver',
};

/**
 * A trophy, by height. They run from tall and narrow (the national trophy) to
 * nearly square, so every one sits in a box wide enough for the widest (the
 * runners-up cup) and a column of them lines up.
 */
export function Trophy(
  { kind, size = 44, label, className }: { kind: TrophyKind; size?: number; label?: string; className?: string },
) {
  const src = TROPHIES[`./trophies/${kind}.webp`];
  if (!src) return <Medal metal={TROPHY_METAL[kind]} size={size} label={label} />;
  return (
    <img
      className={className ? `pb-honour ${className}` : 'pb-honour'} src={src} alt={label ?? ''}
      draggable={false} decoding="async" style={{ width: Math.round(size * 0.96), height: size }}
    />
  );
}

/** The award titles as the engine writes them, to the emblem drawn for each. */
const AWARD_FILE: Record<string, string> = {
  'Player of the Year': 'playerOfTheYear',
  'Pitcher of the Year': 'pitcherOfTheYear',
  'Reliever of the Year': 'relieverOfTheYear',
  'Freshman of the Year': 'freshmanOfTheYear',
  'Coach of the Year': 'coachOfTheYear',
  'All-Conference': 'allConference',
};

/** An award's emblem, by width: they are banners, about half again as wide as tall. */
export function AwardEmblem({ title, size = 44, label }: { title: string; size?: number; label?: string }) {
  const file = AWARD_FILE[title];
  const src = file ? AWARDS[`./awards/${file}.webp`] : undefined;
  if (!src) return <Medal metal="gold" size={Math.round(size * 0.75)} label={label} />;
  return (
    <img
      className="pb-honour" src={src} alt={label ?? ''} draggable={false} decoding="async"
      style={{ width: size, height: Math.round(size / 1.39) }}
    />
  );
}

/** The Hall of Fame logo, by height; it is about twice as wide. */
export function HallOfFameLogo({ height = 56, className }: { height?: number; className?: string }) {
  const src = HALL['./hall/hallOfFame.webp'];
  if (!src) return null;
  return (
    <img
      className={className ? `pb-honour ${className}` : 'pb-honour'} src={src} alt=""
      draggable={false} decoding="async" style={{ width: Math.round(height * 2.07), height }}
    />
  );
}
