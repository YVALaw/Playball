import { pitchFor, developmentScore } from './pitch.js';
import type { SeasonState, TeamRecord } from './season.js';
import type { Region } from '../data/schools.js';
import { actionInterest, weeklyPoints, weekActionCost, type Prospect } from './recruiting.js';
import { recruitingDirectiveMultiplier, facilityEffects, FACILITIES, pipelineStrength, recruitingFacilityScore, nightCraft, type Economy } from './economy.js';
import { holesFor, depthShortfall } from './progression.js';
import type { Pitch } from './recruiting.js';
import type { Player } from './types.js';

/*
  ---------------------------------------------------------------------------
  Handing the board to your coordinator
  ---------------------------------------------------------------------------

  Asked for 2026-09-12 in a list of twenty-six — "we should also add automated
  or delegated recruiting as an option" — and answered to the brief given when
  I asked what it should feel like: **"a bit worse than a user would do it plus
  depending on their stats they get a bit better."**

  Both halves of that sentence are load bearing and they pull against each
  other, so it is worth being explicit about how they are held apart.

  A delegated week is worked by the same routine the other ninety five
  programmes use — `aiTargets` chooses the board, `planAiRecruitActions` spends
  the rest of the week on pitches and visits — with the coached programme's own
  pitch, prestige, facilities and pipelines. Delegating does not make your
  programme worse. It makes your **week** worse, and only that.

  The whole of the handicap is the size of the week, through `aiTargets`'
  `effort` dial. Nothing else is touched: not the quality of the reading, not
  the odds a recruit says yes, not the interest a point converts into. This is
  deliberate. A handicap applied to *judgement* — a staff that picks worse men,
  or randomly forgets somebody — is indistinguishable from a bug when you watch
  it happen, and a player who delegates is precisely the player who will not be
  watching closely enough to tell the difference. A staff that simply does not
  get through as much is legible from the one number on the screen.

  And it never reaches one. The ceiling is 94%, so the answer to "am I better
  off doing this myself" is always yes — which is the first half of the brief,
  and the thing that keeps the board a game rather than a chore with an opt-out
  button that strictly dominates it.
*/

/**
 * How much of a recruiting week a delegated staff gets through.
 *
 * The floor is what a programme with nobody in the chair manages — there is
 * still a staff, they are just not a coordinator. The ceiling is 94% and is
 * never reached by accident: see the note above for why it is not 100%.
 */
export const DELEGATE_FLOOR = 0.72;
export const DELEGATE_CEILING = 0.94;

/**
 * The board half of a coordinator's craft, which is `nightCraft` — his rating
 * less whatever of it he spends on winter relationships.
 *
 * A "Network builder" (`winter` at or above .68) is deliberately poor at this:
 * he is the man who brings you a state, not the man who works a Tuesday. So
 * the same wage buys two genuinely different things and the shape of the man
 * you hired decides which, which is the decision the staff screen already
 * exists to pose.
 */
export const DELEGATE_TOP_CRAFT = 60;

/** What share of his own week a coach gets back when he hands it over. */
export function delegateEffort(economy?: Economy): number {
  const coordinator = economy?.staff.recruiting;
  const craft = coordinator ? nightCraft(coordinator) : 0;
  const reach = Math.max(0, Math.min(1, craft / DELEGATE_TOP_CRAFT));
  return DELEGATE_FLOOR + (DELEGATE_CEILING - DELEGATE_FLOOR) * reach;
}

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
