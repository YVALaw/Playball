import { pitchFor, developmentScore } from './pitch.js';
import type { SeasonState, TeamRecord } from './season.js';
import type { Region } from '../data/schools.js';
import { actionInterest, weeklyPoints, weekActionCost, type Prospect } from './recruiting.js';
import { recruitingDirectiveMultiplier, facilityEffects, FACILITIES, pipelineStrength, recruitingFacilityScore, type Economy } from './economy.js';
import { holesFor } from './progression.js';
import type { Pitch } from './recruiting.js';
import type { Player } from './types.js';

/** One forecast for the board and the week-close calculation. It predicts
 * interest earned by this plan, not whether the recruit will sign. */
export function recruitingPlan(prospect: Prospect, pitch: Pitch, at: {
  team: number; actions: number; prestige: number; skill: number;
  economy?: Economy; roster?: readonly Player[];
}) {
  const p = prospect.player;
  const position = p.type === 'pitcher' ? p.role : p.pos;
  const need = holesFor(at.roster ?? []).some((h) => h.pos === position && h.count > 0);
  const multiplier = at.economy ? recruitingDirectiveMultiplier(at.economy, prospect.stars, need) : 1;
  const rp = at.actions + weekActionCost(prospect, at.team);
  const raw = rp > 0
    ? weeklyPoints(prospect, pitch, at.actions, at.prestige, at.skill) + actionInterest(prospect, pitch, at.team)
    : 0;
  const gain = raw * multiplier;
  const current = prospect.points[at.team] ?? 0;
  const projected = Math.max(0, current + gain);
  return { rp, multiplier, gain, current, projected };
}

/** Facilities, coach reputation and geography must match in the preview and settlement. */
export function programRecruitingPitch(season: SeasonState, record: TeamRecord, region: Region, coachPrestige: number, economy?: Economy): Pitch {
  const bonus = economy ? (FACILITIES[economy.facilities]?.devPitch ?? 0) + facilityEffects(economy).pitch : 0;
  return pitchFor(season, record, region, Math.min(1, developmentScore(record) + bonus),
    economy ? (state) => pipelineStrength(economy, state, record.def.state) : undefined,
    { coachPrestige, ...(economy ? { facilities: recruitingFacilityScore(economy) } : {}) });
}
