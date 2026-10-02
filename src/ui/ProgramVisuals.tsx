import type { ReactNode } from 'react';
import { CoachPortrait } from './CoachPortrait.js';
import { LOOK_CHOICES, type CoachLook } from '../engine/program.js';
import type { Building } from '../engine/economy.js';
import type { CareerYear, SchoolSeason } from '../engine/season.js';

/** Stable cosmetic identity only; never consumes the simulation's RNG. */
export function StaffFace({ id, size = 60 }: { id: string; size?: number }) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const look = Object.fromEntries(Object.entries(LOOK_CHOICES).map(([key, count], i) =>
    [key, (hash >>> (i * 7)) % count])) as unknown as CoachLook;
  return <span className="staff-face"><CoachPortrait look={look} size={size} /></span>;
}

export function TrophyMark({ small = false }: { small?: boolean }) {
  return <svg className={`legacy-trophy${small ? ' small' : ''}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M14 8h20v10c0 8-5 13-10 13s-10-5-10-13V8Z" fill="currentColor" opacity=".18" />
    <path d="M14 8h20v10c0 8-5 13-10 13s-10-5-10-13V8Zm0 4H7v5c0 6 4 8 10 8m17-13h7v5c0 6-4 8-10 8M24 31v9m-9 0h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m24 13 2 4 4 .6-3 3 .7 4.4-3.7-2-3.7 2 .7-4.4-3-3 4-.6 2-4Z" fill="currentColor" />
  </svg>;
}

/** Cutaway training spaces: the equipment shows what each building does. */
export function FacilityArt({ kind }: { kind: Building }) {
  return <svg className={`facility-art facility-art-${kind}`} viewBox="0 0 240 160" fill="none" aria-hidden="true">
    <ellipse cx="121" cy="145" rx="104" ry="8" fill="currentColor" opacity=".08" />
    <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {kind === 'cage' ? <>
        <title>Hitting barn with a netted batting lane, batter, and pitching machine</title>
        <path d="M25 68 120 16l95 52v72H25V68Z" fill="var(--paper)" />
        <path d="m18 70 102-57 102 57M25 68h190M97 68V30m46 38V30" />
        <path d="m29 65 91-47 90 47H29Z" fill="currentColor" opacity=".1" stroke="none" />
        <path d="M43 140V79h151v61" fill="var(--wash)" />
        <path d="M43 79h151M60 79v58m20-58v58m20-58v58m20-58v58m20-58v58m20-58v58m20-58v58M43 93h151M43 108h151M43 122h151" opacity=".2" />
        <path d="M43 140V79h151v61" strokeWidth="3" />
        <path d="m58 133 7 4 8-4v-4H58v4Z" fill="var(--paper)" />
        <circle cx="69" cy="96" r="5" fill="currentColor" />
        <path d="m69 103-2 13 9 14m-9-14-8 14m11-24 10 3 5-9m-15 7 8-8" strokeWidth="4" />
        <path d="m83 100 12-24" strokeWidth="4" />
        <path d="m111 105 34 8" strokeDasharray="3 5" /><circle cx="107" cy="104" r="3" fill="currentColor" stroke="none" />
        <path d="m168 114 14 8m-8-9-10 21m9-10 9 10" />
        <circle cx="172" cy="113" r="8" fill="var(--paper)" strokeWidth="3" /><circle cx="172" cy="113" r="3" />
      </> : kind === 'pen' ? <>
        <title>Pitching lab with a practice mound, pitcher, catcher target, and pitch monitor</title>
        <path d="M25 53h190v87H25V53Z" fill="var(--paper)" />
        <path d="m20 53 16-22h168l16 22H20Z" fill="currentColor" fillOpacity=".1" />
        <path d="M36 64h168v65H36V64Z" fill="var(--wash)" stroke="none" />
        <path d="M45 60v68m12-68v68m12-68v68M36 76h72M36 93h72" opacity=".15" />
        <rect x="137" y="43" width="45" height="28" rx="3" fill="var(--paper)" />
        <path d="M143 65V49m0 16h33m-29-6 7-2 7 3 9-10m-12 21v7m-7 0h17" />
        <ellipse cx="81" cy="128" rx="27" ry="10" fill="currentColor" fillOpacity=".12" />
        <path d="m71 129 19-3" strokeWidth="4" />
        <circle cx="80" cy="86" r="5" fill="currentColor" />
        <path d="m80 93-1 16-9 17m9-17 16 13m-15-26 12 3 12-10m-25 8-10 4-5-10" strokeWidth="4" />
        <circle cx="109" cy="88" r="3" fill="currentColor" stroke="none" />
        <path d="m119 89 39 15" strokeDasharray="3 5" />
        <rect x="169" y="85" width="30" height="43" rx="5" fill="var(--paper)" strokeWidth="3" />
        <rect x="177" y="96" width="14" height="18" rx="2" strokeDasharray="3 3" />
        <path d="m169 128-5 8m35-8 5 8m-82-9 38-12" opacity=".5" />
      </> : <>
        <title>Clubhouse with uniform lockers, a team bench, and a recruiting board</title>
        <path d="M25 48h190v92H25V48Z" fill="var(--paper)" />
        <path d="m19 48 17-20h168l17 20H19Z" fill="currentColor" fillOpacity=".1" />
        <rect x="38" y="59" width="35" height="68" rx="2" fill="var(--wash)" />
        <rect x="78" y="59" width="35" height="68" rx="2" fill="var(--wash)" />
        <rect x="118" y="59" width="35" height="68" rx="2" fill="var(--wash)" />
        <path d="M38 69h35m5 0h35m5 0h35M38 116h35m5 0h35m5 0h35" opacity=".5" />
        {[44, 84, 124].map(x => <path key={x} d={`m${x} 79 7-5 5 3 5-3 7 5-4 7-3-2v22h-10V84l-3 2-4-7Z`} fill="currentColor" fillOpacity=".18" strokeWidth="1.5" />)}
        <rect x="163" y="60" width="41" height="39" rx="3" fill="var(--soft)" />
        <path d="m173 70 16 5-9 13m9-13 8 11" opacity=".5" />
        <circle cx="173" cy="70" r="3" fill="currentColor" /><circle cx="189" cy="75" r="3" fill="currentColor" /><circle cx="180" cy="88" r="3" fill="currentColor" /><circle cx="197" cy="86" r="3" fill="currentColor" />
        <path d="M48 131h146v6H48v-6Zm9 6v5m128-5v5" fill="currentColor" fillOpacity=".12" />
        <path d="M173 112h21m-16-5h11l-2 5h-7l-2-5Z" /><path d="M178 112v11m11-11v11m-15 0h19" />
      </>}
    </g>
  </svg>;
}

export function LevelTrack({ level, max = 3 }: { level: number; max?: number }) {
  return <span className="program-level-track" aria-label={`Level ${level} of ${max}`}>
    {Array.from({ length: max }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
  </span>;
}

export function LegacyBadge({ children, tone = 'quiet' }: { children: ReactNode; tone?: 'quiet' | 'gold' | 'accent' }) {
  return <span className={`legacy-badge ${tone}`}>{children}</span>;
}

/** Archive-only totals. Missing stats stay missing instead of becoming a rating. */
export function collegeSummary(years: readonly CareerYear[]) {
  const sum = (key: keyof CareerYear) => years.reduce((n, y) => n + (typeof y[key] === 'number' ? y[key] as number : 0), 0);
  const ab = sum('ab'), h = sum('h'), outs = sum('outs'), er = sum('er');
  return {
    first: years.length ? Math.min(...years.map(y => y.year)) : undefined,
    last: years.length ? Math.max(...years.map(y => y.year)) : undefined,
    hitting: ab > 0, pitching: outs > 0,
    average: ab > 0 ? (h / ab).toFixed(3).replace(/^0\./, '.') : '—',
    era: outs > 0 ? (er * 27 / outs).toFixed(2) : '—',
    h, hr: sum('hr'), rbi: sum('rbi'), k: sum('k'), w: sum('w'),
    innings: `${Math.floor(outs / 3)}.${outs % 3}`,
  };
}

export function SeasonTrend({ seasons }: { seasons: readonly SchoolSeason[] }) {
  const years = [...seasons].sort((a, b) => a.year - b.year).slice(-6);
  if (years.length < 2) return null;
  return <section className="legacy-trend" aria-label="Win percentage by season">
    <div className="legacy-section-heading"><h3>Program trajectory</h3><small>WIN PERCENTAGE</small></div>
    <div className="legacy-trend-bars">
      {years.map(s => {
        const value = s.w + s.l ? Math.round(s.w / (s.w + s.l) * 100) : 0;
        return <div key={s.year} className={s.finish === 'champion' ? 'champion' : ''}>
          <strong>{value}%</strong><span><i style={{ height: `${value}%` }} /></span><small>{s.year}</small>
        </div>;
      })}
    </div>
  </section>;
}
