import { pitchFor, developmentScore } from './pitch.js';
import type { SeasonState, TeamRecord } from './season.js';
import type { Region } from '../data/schools.js';
import { actionInterest, weeklyPoints, weekActionCost, type Prospect } from './recruiting.js';
import { recruitingDirectiveMultiplier, facilityEffects, FACILITIES, pipelineStrength, recruitingFacilityScore, type Economy } from './economy.js';
import { holesFor, depthShortfall } from './progression.js';
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
  const need = holesFor(at.roster ?? []).some((h) => h.pos === position && h.count > 0)
    || depthShortfall(at.roster ?? [], []).some((h) => h.pos === position);
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
/**
 * What a program without a budget screen has to show a recruit.
 *
 * Only the coached program carries an `Economy`: facilities and pipelines are
 * bought on a screen ninety-five programs do not have. Passing `undefined` for
 * the rest meant their plant and their reach were literally absent from the
 * model — so a facility was a one-sided advantage, and the home-state edge
 * `pipelineStrength` grants at sixty was the coached program's alone.
 *
 * Derived from prestige rather than persisted, because a program's plant is
 * the most predictable thing about it: a ninety-prestige school has the
 * complex, a twenty-prestige school has a cage and a hope. The range stops
 * short of what a fully built department reaches, so a coach who actually
 * spends the money is still buying something.
 */
function standingFor(record: TeamRecord): { facilities: number; devPitch: number } {
  const p = Math.max(0, Math.min(100, record.prestige)) / 100;
  return { facilities: 0.22 + p * 0.5, devPitch: p * 0.1 };
}

export function programRecruitingPitch(season: SeasonState, record: TeamRecord, region: Region, coachPrestige: number, economy?: Economy): Pitch {
  const standing = economy ? null : standingFor(record);
  const bonus = economy
    ? (FACILITIES[economy.facilities]?.devPitch ?? 0) + facilityEffects(economy).pitch
    : standing!.devPitch;
  // Everybody's own state reaches him: `pipelineStrength` returns sixty at home
  // before a single pipeline is built, and a rival deserves the same sixty.
  const reach = economy
    ? (state: string) => pipelineStrength(economy, state, record.def.state)
    : (state: string) => (state === record.def.state ? 60 : 0);
  return pitchFor(season, record, region, Math.min(1, developmentScore(record) + bonus),
    reach,
    { coachPrestige, facilities: economy ? recruitingFacilityScore(economy) : standing!.facilities });
}
