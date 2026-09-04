// liveGame.ts
// Managing a game one plate appearance at a time.
//
// This is the Out of the Park style quick manage the roadmap's mockup lays out:
// you make a call on every trip to the plate — swing away, hit and run, bunt,
// steal on offence; work him, sink it, pitch around, put him on when you are in
// the field — and you carry it through nine innings rather than dipping in for
// scripted moments.
//
// It does NOT reimplement the game. `createHalfInning` in game.ts is the single
// implementation of what a plate appearance does, and both this and the fast
// simulation drive it. The only thing that differs is who decides when to step.

import { createHalfInning, TeamState, RULES, type SimOptions, moundVisit } from './game.js';
import { pitchBudget, CONFIDENCE } from './ratings.js';
import type { GameResult } from './game.js';
import { ENGINES } from './engines.js';
import type {Arm, EngineFn, Hitter, Pitcher, PlayerId, PlayEvent, Rng, Tactic, Team,
} from './types.js';

/** What the manager is being asked, and what he can answer. */
export interface Decision {
  side: 'offense' | 'defense';
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  bases: [boolean, boolean, boolean];
  awayRuns: number;
  homeRuns: number;
  batter: Hitter;
  pitcher: Arm;
  /**
   * The man on the mound's outing so far, for the screen.
   *
   * Fatigue has always been real — past `pitchBudget` an arm loses
   * effectiveness on a slope down to a floor — and the dugout showed his name
   * and his throwing hand and nothing else. So the game asked you to decide
   * when to go to the bullpen while telling you nothing to decide on.
   *
   * Reported, never computed here: reading a counter and a rating takes no
   * random draws, which is the rule the whole reporting layer keeps.
   */
  outing: {
    /** Pitches thrown in this game by this man. */
    pitches: number;
    /** What he has before he starts fading. Draw the bar against this. */
    budget: number;
    /** Outs he has recorded, so a card can print an innings figure. */
    outs: number;
    strikeouts: number;
    /** Whether he came out of the pen rather than starting. */
    relief: boolean;
    /**
     * How he is carrying himself, 0 to 1, half being level.
     *
     * The twin of `budget`, and drawn beside it: one is what he has spent and
     * cannot get back, the other is how he is holding up and can. A mound visit
     * moves this and nothing else.
     */
    confidence: number;
    /** Whether the one visit this man is allowed has been spent. */
    visitUsed: boolean;
  };
  /**
   * Who is standing where, with identity. The booleans above say a base is
   * occupied; this says *which runner* is on it, which is what lets the diamond
   * animate a specific man from first to third rather than blinking two lamps.
   */
  runners: Array<{ id: PlayerId; name: string; base: 1 | 2 | 3 }>;
  /** Calls that make sense right now, with the ones that do not left out. */
  options: TacticOption[];
}

export interface TacticOption {
  tactic: Tactic;
  label: string;
  /** What the call does, or why it is not available right now. */
  note: string;
  available: boolean;
}

export interface LiveGame {
  /** Null when the game is over or it is not your turn to decide. */
  readonly pending: Decision | null;
  /**
   * What happened on the last plate appearance, for the field to animate.
   * Cleared and rebuilt on every step, so it is always just the latest play.
   */
  readonly lastPlay: readonly PlayEvent[];
  /**
   * Counts plate appearances stepped. The field keys its animation to this,
   * so a mound visit or a substitution — which bump the store's version but
   * play nothing — cannot replay the last ball.
   */
  readonly playSeq: number;
  readonly over: boolean;
  readonly log: readonly string[];
  readonly result: GameResult;
  /** Answer the pending decision and play on to the next one. */
  submit: (tactic: Tactic) => void;
  /** Hand the rest of the game to the computer. */
  finish: () => void;
  /** Send a bench bat up in place of the man due. */
  pinchHit: (hitter: Hitter) => boolean;
  /** Go to the bullpen. */
  changePitcher: (arm: Arm) => boolean;
  /**
   * Go and talk to him. Confidence only, once per pitcher per outing.
   *
   * False when there is nothing to spend -- the visit is gone, you are batting,
   * or the staff is running itself -- so the screen can grey the control rather
   * than offer something that will not happen.
   */
  visitMound: () => boolean;
  /** Who is available off the bench and in the pen. */
  readonly benchAvailable: readonly Hitter[];
  readonly bullpenAvailable: readonly Arm[];
}

export interface LiveOptions extends SimOptions {
  /** Which dugout you are sitting in. */
  managing: 'home' | 'away';
  /**
   * Let the pitching staff run itself while you keep the offense.
   *
   * The half-inning already knows how to run either dugout automatically —
   * that is how the computer opponent gets a bullpen — so this simply points
   * that machinery at your own defensive halves. Nothing about the simulation
   * changes; a different set of decisions gets made, by the same code that has
   * always made them for the other ninety-five programs.
   *
   * The engine has no idea *why* it was asked. It is handed a boolean, and what
   * that boolean means about how somebody likes to play is entirely the state
   * layer's business.
   */
  autoPitching?: boolean;
}

/**
 * Every call is always listed, with the unavailable ones greyed and carrying the
 * reason. Hiding them made the panel resize on almost every pitch, and it left
 * the manager guessing at his own options — a sacrifice that silently vanishes
 * teaches nothing, whereas "two outs already" teaches the rule.
 */
const opt = (
  tactic: Tactic, label: string, note: string, available: boolean, why: string,
): TacticOption => ({ tactic, label, note: available ? note : why, available });

export const OFFENSE = (bases: [boolean, boolean, boolean], outs: number): TacticOption[] => {
  const [first, second, third] = bases;
  const anyOn = first || second || third;

  // Which bag the engine would actually take if the runner were sent. The label
  // has to name it, because "STEAL" with men on first and second reads as a
  // double steal and what happens is the lead runner going to third alone.
  const target = first && !second ? 2 : second && !third ? 3 : null;

  // What shortening up buys in the situation on the field, rather than one
  // sentence that is true only with a man on third. Putting the ball in play
  // trades power for contact, and who that helps depends on where they are
  // standing: it is a sacrifice fly with a man on third and less than two out,
  // and simply a better chance to move the line along otherwise.
  const contactNote = third && outs < 2 ? 'a ball in the air brings him home'
    : third ? 'shorten up; he scores on a base hit'
    : second ? 'put it in play and get him to third'
    : 'shorten up and move him along';

  return [
    opt('swing', 'SWING AWAY', 'let him hit', true, ''),
    opt('hitrun', 'HIT AND RUN', 'runner goes with the pitch',
      first && outs < 2, !first ? 'nobody on first' : 'two outs already'),
    /*
      Always on the table. It shipped gated to a man on and less than two out,
      and the report was right to object: 'lets say I have a super fast batter,
      I can try a bunt to see if he gets to base at any point regardless of the
      base play or outs.' The engine has always modelled exactly that -- the
      bunt single rolls off speed and bunt craft, an empty-bases bunt that does
      not beat the throw is just an out -- so the gate was the UI refusing a
      play the game could already score. The label says which play it is.
    */
    opt('bunt',
      (first || second || third) && outs < 2 ? 'SAC BUNT' : 'BUNT FOR A HIT',
      (first || second) && outs < 2 ? 'trade an out to move him up'
        : 'drop one down and beat it out',
      true, ''),
    // Any runner benefits from a ball in play, so the only true reason to
    // withhold this is an empty basepath.
    opt('contact', 'PLAY FOR CONTACT', contactNote, anyOn, 'nobody on to move'),
    // A double steal is not modelled, so with men on first and second only the
    // lead runner goes and the label says third. Nobody steals home here either,
    // and the unavailable text says so rather than pretending the bag is taken.
    opt('steal', target === 3 ? 'STEAL THIRD' : 'STEAL SECOND',
      target === 3 ? 'send the man on second' : 'send the man on first',
      target !== null,
      !anyOn ? 'nobody on'
        : third && !first && !second ? 'only home is left, and nobody steals home'
        : 'the next bag is taken'),
  ];
};

const DEFENSE = (bases: [boolean, boolean, boolean], outs: number): TacticOption[] => {
  const [first, second, third] = bases;
  return [
    opt('pitch', 'PITCH', 'let him work', true, ''),
    opt('groundball', 'PITCH FOR GROUND', 'sink it, get two', true, ''),
    opt('around', 'PITCH AROUND', 'nothing over the plate', true, ''),
    opt('infieldIn', 'INFIELD IN', 'cut the run off at the plate',
      third && outs < 2,
      !third ? 'no runner on third' : 'two outs already'),
    // Putting a man on only makes sense with first open and a force to set up.
    opt('ibb', 'WALK HIM', 'first base is open',
      !first && (second || third) && outs < 2,
      first ? 'first base is taken' : !(second || third) ? 'nobody on' : 'two outs already'),
  ];
};

export function createLiveGame(
  homeTeam: Team,
  awayTeam: Team,
  rng: Rng,
  opts: LiveOptions,
): LiveGame {
  const engine: EngineFn = ENGINES[opts.engine ?? 'log5'];
  const log: string[] = [];
  const say = (s: string): void => { log.push(s); };

  // Strategies matter here as much as in the fast path: the user's settings
  // govern his automatic baserunning, and the opponent's personality governs
  // the game the computer plays back at him.
  // Including the coach-skill nudge: a game you manage carries the same tiny
  // edge as one the season sims, deliberately, or managing would change the
  // odds rather than the decisions.
  const home = new TeamState(
    homeTeam, true, opts.homeStarter ?? 0, opts.homeBullpen, opts.homeLineup, opts.homeStrategy,
    opts.homeCoachMods,
  );
  const away = new TeamState(
    awayTeam, false, opts.awayStarter ?? 0, opts.awayBullpen, opts.awayLineup, opts.awayStrategy,
    opts.awayCoachMods,
  );
  const mine = opts.managing === 'home' ? home : away;

  // Same decision tracking the fast path uses, so a managed game credits the
  // pitcher of record by the same rule.
  let leadHolder: TeamState | null = null;
  let creditTo: Arm | null = null;
  let blameTo: Arm | null = null;
  const onScore = (bat: TeamState, fld: TeamState): void => {
    if (bat.runs <= fld.runs) return;
    if (leadHolder === bat) return;
    leadHolder = bat;
    creditTo = bat.pitcher;
    blameTo = fld.pitcher;
  };

  // The field layer animates from these. A managed game emits them for one plate
  // appearance at a time rather than accumulating a whole game's worth: the
  // manager only ever needs to see the play that just happened.
  let events: PlayEvent[] = [];
  let playSeq = 0;

  let inning = 1;
  let half: 'top' | 'bottom' = 'top';
  let current: ReturnType<typeof createHalfInning> | null = null;
  let over = false;
  let auto = false;

  const bat = (): TeamState => (half === 'top' ? away : home);
  const fld = (): TeamState => (half === 'top' ? home : away);

  const openHalf = (): void => {
    say(`\n--- ${half === 'top' ? 'Top' : 'Bottom'} ${inning} --- (${away.runs}-${home.runs})`);
    // Only the human dugout is manual. The computer opponent keeps its whole
    // automatic game — steals, pinch hitters, the bullpen — or a managed game
    // is nine innings against a team with no coach. Once the game is handed
    // over, both sides run themselves.
    current = createHalfInning(
      bat(), fld(), inning, engine, rng, say,
      half === 'bottom' && inning >= 9, events, onScore,
      !auto && bat() === mine,
      !auto && fld() === mine && !opts.autoPitching,
    );
  };

  const closeHalf = (): void => {
    const side = bat();
    side.lineScore.push(side.runs - (side.lineScore.reduce((a, b) => a + b, 0)));
    current = null;

    if (RULES.decided(half, inning, home, away, opts.runRule !== false)) { over = true; return; }
    if (half === 'top') { half = 'bottom'; } else { half = 'top'; inning += 1; }
    if (inning > 30) over = true;
  };

  /** Play until the manager has something to answer, or the game ends. */
  const advance = (): void => {
    for (let guard = 0; guard < 5000 && !over; guard++) {
      if (!current) {
        if (half === 'bottom' && RULES.skipBottom(inning, home, away)) { over = true; return; }
        openHalf();
      }
      // Your turn: stop and ask, unless you have handed it over — either for
      // the rest of the game, or permanently for the pitching half.
      if (!auto && (bat() === mine || (fld() === mine && !opts.autoPitching))) return;
      if (current) {
        playSeq += 1;
        if (current.step()) closeHalf();
      }
    }
  };

  const decision = (): Decision | null => {
    if (over || auto || !current) return null;
    const offense = bat() === mine;
    // A defensive half is only yours to answer if you kept the pitching.
    if (!offense && (fld() !== mine || opts.autoPitching)) return null;

    const b = bat();
    const batter = b.order[b.spot];
    const pitcher = fld().pitcher;
    if (!batter) return null;

    const bases = current.bases.map(Boolean) as [boolean, boolean, boolean];
    const runners = current.bases.flatMap((r, i) =>
      r ? [{ id: r.id, name: r.name, base: (i + 1) as 1 | 2 | 3 }] : []);
    return {
      runners,
      side: offense ? 'offense' : 'defense',
      inning, half,
      outs: current.outs,
      bases,
      awayRuns: away.runs,
      homeRuns: home.runs,
      batter,
      pitcher,
      outing: {
        pitches: fld().pitcherPitches,
        budget: pitchBudget(pitcher),
        outs: fld().pitchLine(pitcher).outs,
        strikeouts: fld().pitchLine(pitcher).k,
        relief: pitcher !== fld().starter,
        confidence: fld().pitcherConfidence,
        visitUsed: fld().visitUsed,
      },
      options: offense ? OFFENSE(bases, current.outs) : DEFENSE(bases, current.outs),
    };
  };

  advance();

  return {
    get pending() { return decision(); },
    get lastPlay() { return events; },
    get playSeq() { return playSeq; },
    get over() { return over; },
    get log() { return log; },
    get result(): GameResult {
      const homeWon = home.runs > away.runs;
      const winnerIs = homeWon ? home : away;
      return {
        home, away, innings: inning, log, playEvents: [],
        winningPitcher: leadHolder === winnerIs ? creditTo : null,
        losingPitcher: leadHolder === winnerIs ? blameTo : null,
      };
    },
    // Availability is per game, tracked on the TeamState. The season's roster
    // is never touched: splicing a pinch hitter out of team.bench deleted him
    // from the program for good, which turned every substitution into a quiet
    // roster cut.
    get benchAvailable() {
      return mine.team.bench.filter(
        (h) => !mine.usedBench.includes(h) && !mine.order.includes(h),
      );
    },
    get bullpenAvailable() {
      return mine.relief.filter(
        (p) => p !== mine.pitcher && !mine.usedPen.includes(p),
      );
    },

    submit(tactic) {
      if (over || !current) return;
      // Only the play that just happened, so the field animates one thing.
      events.length = 0;
      playSeq += 1;
      if (current.step(tactic)) closeHalf();
      advance();
    },

    finish() {
      auto = true;
      advance();
    },

    pinchHit(hitter) {
      if (over || bat() !== mine) return false;
      const outgoing = mine.order[mine.spot];
      if (!outgoing || !mine.team.bench.includes(hitter)) return false;
      if (mine.usedBench.includes(hitter) || mine.order.includes(hitter)) return false;
      // Marks him used for this game and nothing more. The man he replaced is
      // done for the day too — he is out of the order and cannot re-enter.
      mine.pinchHit(mine.spot, hitter);
      say(`   Pinch hitter: ${hitter.name} bats for ${outgoing.name}.`);
      return true;
    },

    visitMound() {
      if (over || fld() !== mine || opts.autoPitching) return false;
      return moundVisit(mine, say);
    },

    changePitcher(arm) {
      if (over || fld() !== mine || opts.autoPitching) return false;
      if (!mine.relief.includes(arm)) return false;
      // Once out, out for good — but taking the third arm on the list spends
      // only him, not the two listed ahead of him.
      if (arm === mine.pitcher || mine.usedPen.includes(arm)) return false;
      mine.usedPen.push(arm);
      mine.pitcher = arm;
      mine.pitcherPitches = 0;
      // A new man, a new outing: his own confidence and his own visit.
      mine.pitcherConfidence = CONFIDENCE.relief;
      mine.visitUsed = false;
      say(`   Pitching change: ${arm.name} (${arm.throws}HP) enters.`);
      return true;
    },
  };
}
