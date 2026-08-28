// depth.ts
// How much of the game you want to be asked about.
//
// The single most important thing about this file is what it does NOT do: it
// never reaches the engine. `src/engine` imports nothing from the state layer
// and `tests/architecture.test.ts` enforces that, but the rule here is stronger
// than the import boundary and worth stating plainly.
//
//   **The engine always models everything. The mode changes what the player is
//   asked, never what the simulation does.**
//
// Casual does not turn the bullpen off; it has your pitching coach run it.
// Every one of the ninety-five rival programs already plays that way — they have
// always had their decisions made by code — so a casual career and a full career
// in the same world produce the same league, the same rankings, the same
// records, and the same hall of fame. The moment a mode reached into the
// simulation, every comparison in the game would become a lie: your .312 would
// not mean what a rival's .312 meant, and there would be no honest way to rank
// ninety-six programs against each other.
//
// The second rule follows from the first. **Anything that touches the whole
// league is not a preference.** Injuries, academic eligibility, conference
// realignment — those are properties of the world, on for everybody or off for
// everybody, and they are deliberately absent from the catalogue below however
// natural they might look on a settings screen.
//
// The third is the reason there are overrides at all. **A preset is a preset,
// not a cage.** "Casual, but I want to call my own bullpen" is a thing a person
// is allowed to be, and switching mode mid-career is safe by construction —
// there is nothing to migrate, because nothing about the world depended on it.

/** The two ways to play. */
export type DepthMode = 'full' | 'casual';

/**
 * Every system whose *involvement* is a preference.
 *
 * Adding a key here is a promise that the system asks the player something and
 * that a competent staff could answer it instead. If the honest answer to "what
 * happens in casual?" is "the world is different", it does not belong here.
 */
export type SystemKey =
  | 'lineups'
  | 'bullpen'
  | 'skillPoints'
  | 'draftTalk'
  | 'recruiting'
  | 'moundVisits'
  | 'pitchCalling'
  | 'scouting'
  | 'pressers'
  | 'assistants'
  | 'captains'
  | 'redshirts'
  | 'depthChart'
  | 'portal'
  | 'facilities';

export interface SystemDef {
  key: SystemKey;
  /** What it is called on the settings sheet. */
  label: string;
  /** One line, in the second person, describing what being *on* means. */
  blurb: string;
  /**
   * And one for when it is off, naming who does it instead.
   *
   * Not decoration. A row reading "You write the card every day" with its
   * switch off is telling the player something false about his own team, and
   * "casual answers the question for you" only means anything if the screen
   * will say who answered it.
   */
  whenOff: string;
  /**
   * Whether a casual coach handles this himself. `false` means his staff does.
   *
   * Only two are false today, and that is not timidity — it is the honest
   * answer to "which of the things this game currently asks you to do would a
   * real head coach delegate?" A bench coach fills out a card and a pitching
   * coach runs a bullpen. Nobody delegates their recruiting board.
   */
  casual: boolean;
  /**
   * The stage that builds it, for anything that does not exist yet. Present
   * means the row is shown but disabled — the shape of the game is visible from
   * the first day, and no row is ever a surprise later.
   */
  comingIn?: string;
}

export const SYSTEMS: readonly SystemDef[] = [
  {
    key: 'lineups', label: 'Lineups',
    blurb: 'You write the card every day.',
    whenOff: 'Your bench coach writes the card.',
    casual: false,
  },
  {
    key: 'bullpen', label: 'Rotation and bullpen',
    blurb: 'You choose the starter and work the pen.',
    whenOff: 'Your pitching coach runs the pen.',
    casual: false,
  },
  {
    key: 'skillPoints', label: 'Coaching points',
    blurb: 'You decide what to get better at each offseason.',
    whenOff: 'Your points go to your strongest suit.',
    casual: true,
  },
  {
    key: 'draftTalk', label: 'Draft conversations',
    blurb: 'You answer when a club calls about one of your men.',
    whenOff: 'Your staff answers the club.',
    casual: true,
  },
  {
    key: 'recruiting', label: 'The recruiting board',
    blurb: 'You work your own board and spend your own week.',
    whenOff: 'Your coordinator works the board.',
    casual: true,
  },
  {
    key: 'moundVisits', label: 'Mound visits',
    blurb: 'You decide when an arm needs settling.',
    whenOff: 'Your pitching coach decides when to go out.',
    casual: false,
  },
  {
    key: 'pitchCalling', label: 'Calling pitches',
    blurb: 'You call the game pitch by pitch.',
    whenOff: 'Your catcher calls the game.',
    // Cut from v1.0 rather than deferred, and the row says so instead of
    // promising a stage that will never build it: the engine settles a plate
    // appearance and *then* sequences pitches to land on it, so a pitch you
    // called could not change anything already decided.
    casual: false, comingIn: 'a later game',
  },
  {
    key: 'scouting', label: 'Scouting reports',
    blurb: 'You spend prep to learn the other side before a series.',
    whenOff: 'Your staff brings you the report.',
    casual: false, comingIn: 'the economy',
  },
  {
    key: 'pressers', label: 'Press conferences',
    blurb: 'You answer for the season, win or lose.',
    whenOff: 'Your sports information director speaks for you.',
    casual: false, comingIn: 'the coach',
  },
  {
    key: 'assistants', label: 'Assistant coaches',
    blurb: 'You hire your staff and keep them from being poached.',
    whenOff: 'The athletic director fills the vacancies.',
    casual: false, comingIn: 'the coach',
  },
  {
    key: 'captains', label: 'Captains',
    blurb: 'You name the men who lead the room.',
    whenOff: 'The room picks its own leaders.',
    casual: false, comingIn: 'players as people',
  },
  {
    key: 'redshirts', label: 'Redshirts',
    blurb: 'You decide who sits a year to keep it.',
    whenOff: 'Your staff decides who sits a year.',
    casual: false, comingIn: 'the roster',
  },
  {
    key: 'depthChart', label: 'The depth chart',
    blurb: 'You set who plays where, and who backs him up.',
    whenOff: 'Your staff sets the chart.',
    casual: false, comingIn: 'the roster',
  },
  {
    key: 'portal', label: 'The transfer portal',
    blurb: 'You work the portal in both directions.',
    whenOff: 'Your staff works the portal.',
    casual: false, comingIn: 'the portal',
  },
  {
    key: 'facilities', label: 'Facilities and budget',
    blurb: 'You spend the program’s money.',
    whenOff: 'The athletic director spends the budget.',
    casual: true, comingIn: 'the economy',
  },
];

export const SYSTEM_BY_KEY: ReadonlyMap<SystemKey, SystemDef> =
  new Map(SYSTEMS.map((s) => [s.key, s]));

export interface DepthSettings {
  mode: DepthMode;
  /**
   * Per-system answers that disagree with the preset.
   *
   * Only disagreements are stored, never the whole set. That is what lets the
   * preset stay meaningful: a career on casual that has never overridden
   * anything follows casual, including for systems that did not exist when it
   * started. A stored full set would freeze a career against a version of the
   * game and quietly opt it out of everything added later.
   */
  overrides: Partial<Record<SystemKey, boolean>>;
}

/**
 * Full, and nothing overridden.
 *
 * This is also what every save written before the mode existed becomes on load,
 * which is the only correct answer: those careers have been played with every
 * decision in the player's hands, and a migration that quietly handed the
 * bullpen to an assistant would be taking something away.
 */
export const DEFAULT_DEPTH: DepthSettings = { mode: 'full', overrides: {} };

/** Whether the player handles this system himself, preset plus any override. */
export function handles(depth: DepthSettings, key: SystemKey): boolean {
  const override = depth.overrides[key];
  if (override !== undefined) return override;
  const def = SYSTEM_BY_KEY.get(key);
  if (!def) return true;
  return depth.mode === 'full' ? true : def.casual;
}

/** What the preset alone would say, ignoring overrides. Used to show a reset. */
export function presetSays(mode: DepthMode, key: SystemKey): boolean {
  const def = SYSTEM_BY_KEY.get(key);
  if (!def) return true;
  return mode === 'full' ? true : def.casual;
}

/** Set one system, storing it only when it actually disagrees with the preset. */
export function setSystem(
  depth: DepthSettings, key: SystemKey, value: boolean,
): DepthSettings {
  const overrides = { ...depth.overrides };
  if (presetSays(depth.mode, key) === value) delete overrides[key];
  else overrides[key] = value;
  return { ...depth, overrides };
}

/**
 * Change the preset, keeping only the overrides that still say something.
 *
 * Switching from full to casual and back should not leave a career quietly
 * carrying a dozen redundant overrides, because those would silently defeat the
 * next preset change. An override that agrees with the new preset has stopped
 * being an opinion.
 */
export function setMode(depth: DepthSettings, mode: DepthMode): DepthSettings {
  const overrides: Partial<Record<SystemKey, boolean>> = {};
  for (const [k, v] of Object.entries(depth.overrides)) {
    const key = k as SystemKey;
    if (v !== undefined && presetSays(mode, key) !== v) overrides[key] = v;
  }
  return { mode, overrides };
}

/** Read whatever a save carried, defaulting anything missing or malformed. */
export function normalizeDepth(raw: unknown): DepthSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DEPTH, overrides: {} };
  const o = raw as Partial<DepthSettings>;
  const mode: DepthMode = o.mode === 'casual' ? 'casual' : 'full';
  const overrides: Partial<Record<SystemKey, boolean>> = {};
  if (o.overrides && typeof o.overrides === 'object') {
    for (const [k, v] of Object.entries(o.overrides)) {
      if (typeof v === 'boolean' && SYSTEM_BY_KEY.has(k as SystemKey)) {
        overrides[k as SystemKey] = v;
      }
    }
  }
  return setMode({ mode, overrides }, mode);
}
