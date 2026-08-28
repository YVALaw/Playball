// cultures.ts
// What ninety-six programs believe, and what they will not put up with.
//
// A school used to be a name, a colour, a state and two numbers. Prestige said
// what it *was* and quality said what this year's roster could *do*, and
// between them there was nothing about what the place actually wants — so every
// programme was interchangeable except in strength, and taking a job was
// picking a number off a ladder.
//
// This is the missing half. Every school now believes something, in the way a
// real one does: the Heat make you run, the Spurs are proud of a defensive
// scheme, one place will wait six years and the one next door sacks a man with
// a winning record. It is what the creation questions match against, what the
// athletic director judges you by, and eventually a very slight thumb on how
// the programme develops what it has.
//
// ---------------------------------------------------------------------------
// Why it is data rather than derived
// ---------------------------------------------------------------------------
//
// Prestige and region imply a lot — a rich Gulf blueblood and a cold Northeast
// doormat are obviously different places — and deriving culture from them was
// the cheap option and the wrong one. Derived culture is a restatement of
// prestige wearing a hat: the top schools would all be impatient and ambitious
// and the bottom ones all patient and modest, which is exactly the flat world
// this exists to fix.
//
// Hand-written, so a poor school can be arrogant, a rich one can be unhurried,
// and a mid-table programme in Iowa can be the best place in the country to be
// a pitcher. Each one is tied to the name it was given: the Anvils forge, the
// Sodbusters broke the ground, the Silkmen are the bottom rung and cheerful
// about it.
//
// ---------------------------------------------------------------------------
// The two numbers
// ---------------------------------------------------------------------------
//
// `patience` is how long the board gives you before it starts counting. High is
// six years and a shrug; low is a winning record and a P45.
//
// `ambition` is what clearing the bar means here. High is Omaha or nothing; low
// is a winning season and a good crowd. **It is deliberately not prestige** —
// the interesting programmes are the ones where the two disagree, and there are
// plenty on purpose.
//
// `edge` is the one thing the place is known for. It is what the creation
// questions match against most strongly, and it is the hook for the slight
// mechanical effects that come later — a pitching school getting a little more
// out of its arms. Nothing here touches the simulation yet.

/** The one thing a programme is known for. */
export type CultureEdge =
  | 'development'
  | 'pitching'
  | 'defense'
  | 'power'
  | 'loyalty'
  | 'recruiting'
  | 'tradition'
  | 'ambition';

export interface SchoolCulture {
  /** Two or three words. What a player reads first. */
  readonly name: string;
  /** What the place believes, in one line and in its own voice. */
  readonly creed: string;
  readonly edge: CultureEdge;
  /** 0–100. How long before the board starts counting. */
  readonly patience: number;
  /** 0–100. What clearing the bar means here. Not prestige. */
  readonly ambition: number;
}

export const CULTURE_LABEL: Record<CultureEdge, string> = {
  development: 'DEVELOPMENT',
  pitching: 'PITCHING',
  defense: 'DEFENCE',
  power: 'POWER',
  loyalty: 'LOYALTY',
  recruiting: 'RECRUITING',
  tradition: 'TRADITION',
  ambition: 'AMBITION',
};

/**
 * Every programme in the country, by abbreviation.
 *
 * `tests/cultures.test.ts` checks that this covers all ninety-six exactly —
 * no school without a culture, no culture without a school — because a missing
 * entry would be a programme that silently wants nothing.
 */
export const CULTURES: Record<string, SchoolCulture> = {
  // --- Gulf Coast Conference ------------------------------------------------
  BAY: { name: 'Omaha or nothing', creed: 'Two men have been sacked here with winning records.', edge: 'ambition', patience: 18, ambition: 95 },
  MOB: { name: 'The old navy', creed: 'They will tell you about 1974 before they tell you where your office is.', edge: 'tradition', patience: 55, ambition: 52 },
  DLT: { name: 'Arms first', creed: 'Sign a bat and the pitching coach will want a word.', edge: 'pitching', patience: 48, ambition: 74 },
  THB: { name: 'The long game', creed: 'Nobody here has ever been in a hurry, including the board.', edge: 'tradition', patience: 78, ambition: 52 },
  GLP: { name: 'Storm baseball', creed: 'Swing hard. The wind off the water does the rest.', edge: 'power', patience: 44, ambition: 55 },
  PSC: { name: 'The forge', creed: 'Nobody arrives finished. Everybody leaves better or leaves early.', edge: 'development', patience: 62, ambition: 66 },
  LKC: { name: 'Drill deep', creed: 'They sign men nobody scouted and are quietly smug about it.', edge: 'recruiting', patience: 58, ambition: 45 },
  BIL: { name: 'The short porch', creed: 'The fence is close and the philosophy is closer.', edge: 'power', patience: 50, ambition: 40 },
  ATF: { name: 'Basin time', creed: 'The water takes its time. So does the board.', edge: 'loyalty', patience: 82, ambition: 32 },
  PTA: { name: 'Dock work', creed: 'Nobody here is above carrying something.', edge: 'defense', patience: 60, ambition: 34 },
  HTB: { name: 'Cut and stack', creed: 'Four years, a degree, and a hard nine innings.', edge: 'loyalty', patience: 72, ambition: 28 },
  SEL: { name: 'Anvil work', creed: 'They have never bought a player and do not intend to start.', edge: 'development', patience: 70, ambition: 25 },

  // --- Atlantic Coast League ------------------------------------------------
  PIE: { name: 'The standard', creed: 'A regional is a disappointment they are too polite to name.', edge: 'ambition', patience: 22, ambition: 96 },
  CHS: { name: 'The admiralty', creed: 'Blazers in the stands and a century of minutes in a cabinet.', edge: 'tradition', patience: 52, ambition: 50 },
  TAM: { name: 'Star power', creed: 'They want the best kid in Florida and they usually get him.', edge: 'recruiting', patience: 38, ambition: 80 },
  NEU: { name: 'Grind it out', creed: 'They will forgive a loss. They will not forgive a lazy one.', edge: 'defense', patience: 58, ambition: 52 },
  ASH: { name: 'The high road', creed: 'Thin air, long practices, and a genuine belief that it matters.', edge: 'development', patience: 66, ambition: 48 },
  SAV: { name: 'River arms', creed: 'They would rather have three arms than one bat.', edge: 'pitching', patience: 55, ambition: 68 },
  JAX: { name: 'Hold fast', creed: 'Men who leave early are spoken about carefully and not warmly.', edge: 'loyalty', patience: 68, ambition: 44 },
  OKE: { name: 'Swamp rules', creed: 'They find them where nobody else is looking.', edge: 'recruiting', patience: 64, ambition: 34 },
  CPF: { name: 'Take what you can', creed: 'Steal a base, steal a game, steal somebody else’s recruit.', edge: 'recruiting', patience: 46, ambition: 40 },
  ALT: { name: 'Strike first', creed: 'A quiet place that plays aggressive baseball.', edge: 'power', patience: 52, ambition: 32 },
  SNB: { name: 'Run it out', creed: 'Legs, wind, and a groundskeeper who cuts the grass short.', edge: 'defense', patience: 62, ambition: 27 },
  OCL: { name: 'The nursery', creed: 'Half the coaches in the country took their first job here.', edge: 'tradition', patience: 76, ambition: 26 },

  // --- Pacific --------------------------------------------------------------
  RID: { name: 'West coast standard', creed: 'A trophy case, and a list of everyone who failed to add to it.', edge: 'ambition', patience: 26, ambition: 92 },
  BRK: { name: 'The archive', creed: 'Every banner has a man who hung it, and they know all their names.', edge: 'tradition', patience: 58, ambition: 48 },
  MBT: { name: 'By the numbers', creed: 'They will ask about your defensive alignment before your record.', edge: 'defense', patience: 50, ambition: 70 },
  PIN: { name: 'First in', creed: 'They would rather try something and be wrong than be late.', edge: 'ambition', patience: 44, ambition: 62 },
  CAL: { name: 'Dig for it', creed: 'Nothing here has ever come up easy and they prefer it that way.', edge: 'power', patience: 68, ambition: 48 },
  OAK: { name: 'The quiet school', creed: 'Good grades, good gloves, and no fuss about either.', edge: 'defense', patience: 70, ambition: 42 },
  VER: { name: 'Let it fly', creed: 'The ball carries here, and so does the philosophy.', edge: 'power', patience: 42, ambition: 64 },
  SUT: { name: 'Ride for the brand', creed: 'Four years, or do not bother knocking.', edge: 'loyalty', patience: 74, ambition: 36 },
  CSC: { name: 'Mill work', creed: 'Rain, reps, and a bullpen that throws all winter.', edge: 'pitching', patience: 64, ambition: 34 },
  SLS: { name: 'Grow your own', creed: 'They have not signed a rated recruit in eleven years. On purpose.', edge: 'development', patience: 72, ambition: 32 },
  KLM: { name: 'Set the line', creed: 'Patient, quiet, and unusually good at stealing a game.', edge: 'defense', patience: 66, ambition: 28 },
  MOJ: { name: 'Desert legs', creed: 'If it is on the ground, somebody here is already running.', edge: 'development', patience: 62, ambition: 25 },

  // --- Heartland ------------------------------------------------------------
  PLT: { name: 'Break the ground', creed: 'Founded by men who dug it out, and they never stop saying so.', edge: 'tradition', patience: 60, ambition: 50 },
  OZK: { name: 'Hold the hill', creed: 'Four coaches in fifty years. They liked three of them.', edge: 'loyalty', patience: 84, ambition: 42 },
  WIC: { name: 'Swing at everything', creed: 'The wind blows out, and forty years of baseball is built on it.', edge: 'power', patience: 46, ambition: 58 },
  LWR: { name: 'Find the vein', creed: 'Scouting is the whole religion here.', edge: 'recruiting', patience: 56, ambition: 50 },
  KEA: { name: 'The honest yard', creed: 'They want it played properly and will tell you when it was not.', edge: 'defense', patience: 64, ambition: 44 },
  CDR: { name: 'Arms and winter', creed: 'Six months indoors makes pitchers. They have the record to prove it.', edge: 'pitching', patience: 62, ambition: 58 },
  DUB: { name: 'Run the river', creed: 'They gamble. It has cost them, and they keep doing it.', edge: 'ambition', patience: 50, ambition: 56 },
  SLN: { name: 'Harvest work', creed: 'One crop a year, and everybody is expected to be there for it.', edge: 'loyalty', patience: 74, ambition: 32 },
  CHK: { name: 'Move them along', creed: 'Bunt, run, take the extra base, go home.', edge: 'development', patience: 66, ambition: 30 },
  RDO: { name: 'Thresh it out', creed: 'They keep the ones who last the winter.', edge: 'loyalty', patience: 72, ambition: 26 },
  MRL: { name: 'Steady hands', creed: 'Never ranked, and never a losing decade.', edge: 'defense', patience: 78, ambition: 18 },
  SDL: { name: 'The junction', creed: 'Men pass through on the way somewhere. Both directions.', edge: 'development', patience: 68, ambition: 24 },

  // --- Desert ---------------------------------------------------------------
  SON: { name: 'Hunt in packs', creed: 'Nine men, one plan, and no room for a passenger.', edge: 'defense', patience: 48, ambition: 70 },
  TUC: { name: 'Never stand still', creed: 'First to third on anything. They will not apologise for an out.', edge: 'ambition', patience: 44, ambition: 72 },
  RGV: { name: 'The pipeline', creed: 'Every man on the roster is from within four hours of here.', edge: 'recruiting', patience: 58, ambition: 56 },
  ALB: { name: 'High heat', creed: 'Thin air, hard throwers, and a staff that likes both.', edge: 'pitching', patience: 54, ambition: 50 },
  LCR: { name: 'Raise a little dust', creed: 'Nobody expects anything here, which is exactly how they like it.', edge: 'development', patience: 68, ambition: 40 },
  ELP: { name: 'Pull the load', creed: 'Long bus rides, and no complaining about them.', edge: 'loyalty', patience: 70, ambition: 38 },
  YUM: { name: 'All summer', creed: 'They play more baseball in a year than anybody in the country.', edge: 'development', patience: 60, ambition: 58 },
  NGL: { name: 'Small and mean', creed: 'Nobody wants to come here in May, and they know it.', edge: 'defense', patience: 58, ambition: 34 },
  MOA: { name: 'The wall', creed: 'Deep fences, deep counts, deep patience.', edge: 'pitching', patience: 66, ambition: 30 },
  PAH: { name: 'Dig in', creed: 'No winning season since 1998, and the stands are still full.', edge: 'loyalty', patience: 80, ambition: 26 },
  GAL: { name: 'Light and quick', creed: 'Speed is cheaper than power, and they made a philosophy of it.', edge: 'development', patience: 64, ambition: 26 },
  CSG: { name: 'Stand still and grow', creed: 'Nothing happens fast here. That is the entire pitch.', edge: 'development', patience: 84, ambition: 22 },

  // --- Great Lakes ----------------------------------------------------------
  ERI: { name: 'Carry the load', creed: 'Big rosters, long seasons, and no interest in shortcuts.', edge: 'power', patience: 62, ambition: 60 },
  SAG: { name: 'Ironside defence', creed: 'They will lose two-one and call it a good night out.', edge: 'defense', patience: 60, ambition: 40 },
  FVL: { name: 'Pour and set', creed: 'Take the raw thing, heat it, and see what it becomes.', edge: 'development', patience: 70, ambition: 48 },
  TOL: { name: 'Clear sight', creed: 'They keep more numbers than anybody, and read all of them.', edge: 'recruiting', patience: 56, ambition: 44 },
  SUP: { name: 'Through the ice', creed: 'Nothing about being here is easy, starting with February.', edge: 'loyalty', patience: 72, ambition: 38 },
  MRQ: { name: 'The long way out', creed: 'They recruit places nobody else will drive to.', edge: 'recruiting', patience: 64, ambition: 52 },
  HUR: { name: 'Pull together', creed: 'One oar out of time and the whole thing turns.', edge: 'defense', patience: 66, ambition: 32 },
  ATB: { name: 'Into the wind', creed: 'Cold, loud, and unreasonably hard to beat at home.', edge: 'defense', patience: 62, ambition: 28 },
  MSK: { name: 'Shifting ground', creed: 'Nobody plays one position here for four years.', edge: 'development', patience: 68, ambition: 26 },
  KNK: { name: 'Work the current', creed: 'Small ball, small budget, small complaints.', edge: 'development', patience: 70, ambition: 24 },
  SDY: { name: 'The long winter', creed: 'They judge a coach on his fourth year, not his first.', edge: 'loyalty', patience: 86, ambition: 22 },
  WBS: { name: 'Hammer and heat', creed: 'Nobody is recruited here. Everybody is made here.', edge: 'power', patience: 74, ambition: 22 },

  // --- Mountain -------------------------------------------------------------
  TET: { name: 'The high ground', creed: 'Altitude, attitude, and a fence nobody clears cheaply.', edge: 'power', patience: 52, ambition: 58 },
  SIL: { name: 'Hardrock', creed: 'They mine. They do not shop.', edge: 'tradition', patience: 68, ambition: 36 },
  WAS: { name: 'Clean mechanics', creed: 'The pitching lab keeps better hours than the library.', edge: 'pitching', patience: 58, ambition: 48 },
  LAR: { name: 'Run the plain', creed: 'Nobody outruns them and nobody outlasts them.', edge: 'defense', patience: 64, ambition: 40 },
  DUR: { name: 'The rim', creed: 'Quiet, remote, and deeply suspicious of anybody in a hurry.', edge: 'loyalty', patience: 76, ambition: 36 },
  BIT: { name: 'Bite first', creed: 'A small school that plays like it has just been insulted.', edge: 'ambition', patience: 46, ambition: 56 },
  POC: { name: 'Stay put', creed: 'Men graduate here. All four years, every time.', edge: 'loyalty', patience: 78, ambition: 32 },
  GRJ: { name: 'One-run games', creed: 'They have lost more of them than anybody, and learned from it.', edge: 'defense', patience: 66, ambition: 28 },
  BUT: { name: 'Dig and hold', creed: 'A century of hard work, and no apologies for the record.', edge: 'tradition', patience: 74, ambition: 26 },
  CDA: { name: 'Slow water', creed: 'They will give a coach six years. They will also notice all six.', edge: 'loyalty', patience: 82, ambition: 24 },
  RWL: { name: 'Wind and dust', creed: 'The hardest place in the country to win, and they know it.', edge: 'tradition', patience: 80, ambition: 20 },
  SLD: { name: 'Climb something', creed: 'Nobody has ever expected anything, so anything is a triumph.', edge: 'ambition', patience: 70, ambition: 24 },

  // --- Northeast ------------------------------------------------------------
  HUD: { name: 'The watch', creed: 'Old school, old money, and a very long memory.', edge: 'tradition', patience: 56, ambition: 40 },
  NWP: { name: 'The long voyage', creed: 'They have waited forty years and are prepared to wait longer.', edge: 'loyalty', patience: 80, ambition: 34 },
  BRS: { name: 'Rivet and beam', creed: 'Defence first, and they will say it twice.', edge: 'defense', patience: 62, ambition: 46 },
  ALG: { name: 'Down the seam', creed: 'Hard hours, no shortcuts, and a suspicion of anybody polished.', edge: 'development', patience: 68, ambition: 40 },
  PRT: { name: 'Keep the light', creed: 'Somebody has done this job for a century without any fuss.', edge: 'loyalty', patience: 78, ambition: 36 },
  NSH: { name: 'The second shift', creed: 'They take the men who were passed over, and work them.', edge: 'recruiting', patience: 70, ambition: 50 },
  SCR: { name: 'Break it down', creed: 'They rebuild swings from nothing. Some of them survive it.', edge: 'development', patience: 64, ambition: 32 },
  BGR: { name: 'North of everything', creed: 'The bus rides are the recruiting pitch. They are honest about it.', edge: 'loyalty', patience: 76, ambition: 24 },
  UTC: { name: 'Steady fall', creed: 'Nothing dramatic has happened here, and nothing is expected to.', edge: 'defense', patience: 74, ambition: 24 },
  PTS: { name: 'Burn long', creed: 'Hard, slow and hot. Ask anybody who played here.', edge: 'power', patience: 72, ambition: 22 },
  CHC: { name: 'Thread by thread', creed: 'They build a roster the way they built the town. Slowly.', edge: 'tradition', patience: 78, ambition: 20 },
  PSA: { name: 'The bottom rung', creed: 'Every coach here is on the way up or on the way out. Both are welcome.', edge: 'development', patience: 66, ambition: 20 },
};

/** The culture of a programme, by abbreviation. */
export const cultureOf = (abbr: string): SchoolCulture | undefined => CULTURES[abbr];

/**
 * A programme's culture as it stands *now*, drift included.
 *
 * Structurally typed rather than importing `TeamRecord`, which would make this
 * file depend on the engine it is data for. Anything with an abbreviation and
 * an optional override can be asked.
 */
export const cultureFor = (
  t: { def: { abbr: string }; culture?: SchoolCulture },
): SchoolCulture | undefined => t.culture ?? CULTURES[t.def.abbr];

/** How far a culture may wander from what it was written as. */
const DRIFT_BOUND = 18;

/**
 * A year of results, applied to what a programme believes.
 *
 * Cultures were written by hand and they are still the baseline; this moves a
 * school around that baseline rather than replacing it, and everything pulls
 * back toward the authored value when nothing is happening. A place that has
 * been quietly mediocre for a decade should read as the place it was written
 * as, not as wherever a random walk left it.
 *
 * The bound matters more than the steps. Eighteen points is enough for a patient
 * school to become a twitchy one over a bad decade and not enough for any school
 * to become a different school — the Anvils are never going to start buying
 * players, however the last ten years went.
 *
 * Returns `undefined` when nothing moved, so the caller can leave the sparse
 * override unset and the save unchanged.
 */
export function driftCulture(
  base: SchoolCulture,
  now: SchoolCulture,
  year: { wonTitle: boolean; wonRegional: boolean; sacked: boolean },
  newDirector: boolean,
): SchoolCulture | undefined {
  let patience = now.patience;
  let ambition = now.ambition;

  /*
    Events, not weather.

    Missing the postseason was the first driver of impatience and it was a
    ratchet rather than a wobble: twenty bids across ninety-six programmes means
    roughly *four in five* schools miss every single year, so a two-point
    penalty against a one-point pull home dragged the entire country toward
    twitchiness over a decade. Measured as league turnover rising from 9.0
    chairs a year to 9.5 -- a five percent shift in a tuned number, produced
    entirely by the majority case being treated as a failure.

    A board becomes less patient when it has just sacked somebody, which happens
    to about nine schools a year and is the thing impatience actually looks
    like. Ordinary disappointment is what most seasons are, and it should move
    nothing.
  */
  if (year.wonTitle) { ambition += 4; patience += 2; }
  else if (year.wonRegional) ambition += 1;
  if (year.sacked) { patience -= 3; ambition += 1; }

  /*
    And the pull home.

    Without it, drift is a random walk and every school ends a thirty-year save
    somewhere arbitrary -- which would quietly undo the hand-writing that made
    the country worth having. One point a year toward what the place was written
    as is slow enough to lose an argument with a bad decade and strong enough to
    win one with a quiet one.
  */
  const home = (v: number, to: number): number =>
    v > to ? v - 1 : v < to ? v + 1 : v;
  patience = home(patience, base.patience);
  ambition = home(ambition, base.ambition);

  /*
    A new athletic director, and the one thing here that is not gradual.

    Rare on purpose. It is the only way a programme's posture can change faster
    than a decade, and it is what makes a school you knew ten years ago worth
    looking at again.
  */
  if (newDirector) {
    patience = base.patience + (patience > base.patience ? -10 : 10);
    ambition = base.ambition + (ambition > base.ambition ? -8 : 8);
  }

  const clamp = (v: number, to: number): number =>
    Math.max(5, Math.min(97, Math.max(to - DRIFT_BOUND, Math.min(to + DRIFT_BOUND, v))));
  patience = clamp(patience, base.patience);
  ambition = clamp(ambition, base.ambition);

  if (patience === now.patience && ambition === now.ambition) return undefined;
  return { ...now, patience, ambition };
}
