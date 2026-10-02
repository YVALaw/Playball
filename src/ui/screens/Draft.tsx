// Draft.tsx
// Who left, where they went, and the one conversation you get to have about it.
//
// A player with eligibility left has been offered a professional contract and
// has not signed it yet; what you say to him decides whether he is in your
// lineup in February. The offer is paid in offseason points, the fund the
// transfer portal also draws from, and it is spent whether it works or not.
//
// Three views: Waiting on you (a decision card per man, the pitch in a sheet),
// Leaving (what it cost you, with the positions it leaves short), and the
// Draft board (the country's story). Laid out and worded from the UI clarity
// review, variant A (design/UI Clarity Review/Draft.dc.html, 2026-09-25).

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { draftChance, holesFor } from '../../engine/progression.js';
import type { Departure } from '../../engine/progression.js';
import {
  draftContextOf, draftEligible, draftStock, keepPoints, pullHints,
  KEEP_PITCHES, KEEP_LABEL, KEEP_CASE, KEEP_RESTS_ON,
  type DraftedMan, type KeepPitch,
} from '../../engine/draft.js';
import { armValue, overallOf, naturalPos } from '../../engine/ratings.js';
import { coverTier } from '../../engine/positions.js';
import { BULLPEN_SIZE, ROTATION_SIZE, isArm } from '../../engine/roster.js';
import { rulesOf, type SeasonState } from '../../engine/season.js';
import { isTwoWay, uniquePlayers } from '../../engine/types.js';
import type { Arm, Hitter, Pitcher, Player, Position } from '../../engine/types.js';
import {
  Button, Callout, ConfirmButton, EmptyState, Face, Icon, List, Marquee, OptionGroup, PlayerRow,
  SectionHeader, SegmentedControl, Sheet, StatusBadge, Stepper, Tag, cx,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME, capsWords } from '../words.js';
import { ContinueBar, OffseasonPointsCard, StepScreen, useOffseasonPoints } from './OffseasonStep.js';

type View = 'keep' | 'leaving' | 'board';
type SpotTag = { text: string; title: string };

/**
 * A hitter as himself: at his own spot rather than one a lineup card has him
 * covering, which is how his player card names him too.
 */
const atHome = (h: Hitter): Hitter => (h.homePos ? { ...h, pos: h.homePos } : h);

/** His position as a short tag, with the full name for a screen reader. */
function slotTag(p: Player): SpotTag {
  if (isTwoWay(p)) return { text: 'Two-way', title: 'Two-way player' };
  const code = p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(atHome(p as Hitter));
  return { text: code, title: POSITION_NAME[code as Position] ?? code };
}

/** A hole's position in words: the report counts spare bats as BENCH. */
const holeName = (pos: string): string =>
  (pos === 'BENCH' ? 'Bench' : POSITION_NAME[pos as Position] ?? pos);

/**
 * The one line under the title, true to the board as it stands: how many the
 * clubs took, how many still owe you an answer, and what an answer costs.
 */
function introLine(called: number, pending: number): string {
  if (called === 0) return 'Pro clubs drafted none of your players who still have eligibility.';
  const head = `Pro clubs drafted ${called} of your players who still have eligibility.`;
  if (pending === 0) return `${head} ${called === 1 ? 'He has' : 'Each has'} an answer.`;
  const pitch = `${pending === 1 ? 'He' : 'Each'} will hear one pitch from you, `
    + 'backed by offseason points that are spent whether he stays or not.';
  if (pending === called) {
    return `${head} ${called === 1 ? 'He has not signed yet.' : 'None has signed yet.'} ${pitch}`;
  }
  return `${head} ${pending} still ${pending === 1 ? 'needs' : 'need'} an answer. ${pitch}`;
}

// ---------------------------------------------------------------------------
// If he signs
// ---------------------------------------------------------------------------

/** What his leaving costs at his spot: a few words, and whether it hurts. */
interface Loss { text: string; tone: 'warning' | 'positive'; weight: number }

/** How far the man stepping in may trail him before the spot reads thin. */
const THIN_GAP = 6;

const SPOT_WORD: Partial<Record<Position, string>> = {
  C: 'catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short',
  LF: 'left', CF: 'center', RF: 'right',
};

/**
 * "If he signs", on his decision card.
 *
 * Read off the roster as it stands, which at the draft step is who is coming
 * back: the seniors and every drafted man are already off it, a man talked
 * round is back on it, and he himself is left out by id. The best man left at
 * his spot is his heir. Nobody there: the spot is open. Only a man covering
 * from another spot, or an heir six or more points worse: thin. Arms read the
 * same way against the man who would take his turn: the next best starter for
 * the top one ("No Friday ace"), the last man into the rotation for the rest,
 * and the pen likewise ("No closer"). Anything else is covered. A two-way man
 * counts whichever half costs more.
 */
function ifHeSigns(man: Player, roster: readonly Player[]): Loss {
  const rest = uniquePlayers(roster).filter((p) => p.id !== man.id);
  const covered: Loss = { text: 'Covered', tone: 'positive', weight: 0 };
  const thin = (text: string): Loss => ({ text, tone: 'warning', weight: 1 });
  const open = (text: string): Loss => ({ text, tone: 'warning', weight: 2 });
  const losses: Loss[] = [];

  if (man.type === 'hitter') {
    // Every man judged at his own spot, him and the men who might replace
    // him: a catcher a card has covering first is still the catcher's heir.
    const spot = naturalPos(atHome(man));
    const word = SPOT_WORD[spot] ?? spot;
    const where = spot === 'LF' || spot === 'CF' || spot === 'RF' ? 'in' : 'at';
    const hitters = rest.filter((p): p is Hitter => p.type === 'hitter');
    // Both rated standing there, since a rating weighs the glove by the spot.
    const there = (h: Hitter): number => overallOf({ ...h, pos: spot });
    const heir = hitters
      .filter((h) => coverTier(atHome(h), spot) === 0)
      .sort((a, b) => there(b) - there(a))[0];
    if (heir) {
      losses.push(there(man) - there(heir) >= THIN_GAP ? thin(`Thin ${where} ${word}`) : covered);
    } else if (hitters.some((h) => coverTier(atHome(h), spot) === 1)) {
      losses.push(thin(`Thin ${where} ${word}`));
    } else {
      losses.push(open(spot === 'C' ? 'No catcher' : `Nobody ${where} ${word}`));
    }
  }

  if (isArm(man)) {
    const his = armValue(man);
    const arms = rest.filter(isArm).sort((a, b) => armValue(b) - armValue(a));
    const starters = arms.filter((a) => a.role === 'SP');
    const trails = (by: Arm | undefined): boolean => !by || his - armValue(by) >= THIN_GAP;
    if (man.role === 'SP') {
      const last = starters[ROTATION_SIZE - 1];
      losses.push(trails(starters[0]) ? open('No Friday ace')
        : !last ? thin('Rotation short')
          : trails(last) ? thin('Thin rotation') : covered);
    } else {
      // The pen is the relievers and any starter the rotation has no turn for.
      const pen = arms.filter((a) => a.role === 'RP' || starters.indexOf(a) >= ROTATION_SIZE);
      const last = pen[BULLPEN_SIZE - 1];
      losses.push(trails(pen[0]) ? open('No closer')
        : !last ? thin('Bullpen short')
          : trails(last) ? thin('Thin bullpen') : covered);
    }
  }
  return losses.reduce((worst, l) => (l.weight > worst.weight ? l : worst), covered);
}

/**
 * Where each of your men stood this spring, by id: the spot the box scores
 * have him at most often. A man who has left is on no roster to ask, and his
 * departure notice keeps his class and his rating but not his position. A bat
 * that only came off the bench (SUB), or a two-way man's day at the plate
 * (PH), names no spot; a man who never appeared gets no tag.
 */
function spotsPlayed(season: SeasonState, team: number): Map<string, string> {
  const tally = new Map<string, Map<string, number>>();
  for (const box of Object.values(season.boxScores ?? {})) {
    const home = box.home === team;
    if (!home && box.away !== team) continue;
    const lines = home
      ? [...box.homeBatting, ...box.homePitching]
      : [...box.awayBatting, ...box.awayPitching];
    for (const line of lines) {
      if (line.slot === 'SUB' || line.slot === 'PH') continue;
      const id = String(line.id);
      const his = tally.get(id) ?? new Map<string, number>();
      his.set(line.slot, (his.get(line.slot) ?? 0) + 1);
      tally.set(id, his);
    }
  }
  const out = new Map<string, string>();
  for (const [id, his] of tally) {
    let spot = '';
    let most = 0;
    for (const [slot, n] of his) if (n > most) { spot = slot; most = n; }
    if (spot) out.set(id, spot);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export function Draft() {
  const phase = useDynasty((s) => s.phase);
  const report = useDynasty((s) => s.lastOffseason);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  const board = season?.draft ?? null;
  // Highest pick first, and the order never changes after that: a man talked
  // round takes his development year, and sorting on his rating would move
  // his card the moment he said yes.
  const men = useMemo(() => [...(board?.men ?? [])].sort((a, b) => a.round - b.round), [board, version]);
  const pending = men.filter((m) => m.outcome === 'pending').length;
  const [view, setView] = useState<View>(pending > 0 ? 'keep' : 'leaving');

  const abbr = team?.def.abbr;
  const teamIndex = team?.index ?? -1;
  const { undrafted, national, leaving } = useMemo(() => {
    const drafted = report?.drafted ?? [];
    const graduated = report?.graduated ?? [];
    // A man still waiting on you has not left yet: he is on the first tab.
    const waiting = new Set(men.filter((m) => m.outcome === 'pending').map((m) => String(m.player.id)));
    const order: Record<Departure['reason'], number> = { drafted: 0, graduated: 1, 'walk-on': 2 };
    return {
      // The country's board, best round first, capped where reading stops.
      national: drafted.slice(0, 80),
      // Seniors whose names were never called; walk-ons whose year was up are
      // not this, and stay out of it.
      undrafted: graduated.filter((d) => d.reason === 'graduated').sort((a, b) => b.overall - a.overall).slice(0, 40),
      leaving: [...drafted, ...graduated]
        .filter((d) => d.teamAbbr === abbr && !waiting.has(String(d.id)))
        .sort((a, b) => order[a.reason] - order[b.reason] || b.overall - a.overall),
    };
  }, [report, abbr, men, version]);
  const spots = useMemo(
    () => (season && teamIndex >= 0 ? spotsPlayed(season, teamIndex) : new Map<string, string>()),
    [season, teamIndex],
  );

  if (!team) return null;

  // Before the offseason has run there is nothing to report, so the screen
  // shows the odds instead: who is exposed and who is safe.
  if (!report && !board) return <DraftOdds team={team} year={year} inSequence={phase !== null} />;

  // Who is coming back, which is the roster the draft left: the holes are read
  // off it live rather than off the report, so a man talked round, and a save
  // from before the report was kept, both leave them right.
  const roster = uniquePlayers([
    ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
  ]);
  const holes = holesFor(roster);
  const called = men.length;
  const portal = rulesOf(season).portal;
  // The save keeps the offseason report now. One written before it did comes
  // back with the board alone, so the men you have answered are listed as
  // leaving from the board itself.
  const leavingRows: Departure[] = report ? leaving : men
    .filter((m) => m.outcome !== 'pending')
    .map((m) => ({
      id: m.player.id, name: m.player.name, team: team.index, teamAbbr: team.def.abbr,
      classYear: m.player.classYear, age: m.player.age, overall: overallOf(m.player),
      reason: 'drafted' as const, round: m.round, returned: m.outcome === 'stayed',
    }));
  const tagOf = (id: string): SpotTag | null => {
    const man = men.find((m) => String(m.player.id) === id);
    if (man) return slotTag(man.player);
    const code = spots.get(id);
    return code ? { text: code, title: POSITION_NAME[code as Position] ?? code } : null;
  };

  const page = (
    <main className="pb-page pb-draft">
      <FirstVisit id="draftphase" />
      <Marquee
        eyebrow={`${year} draft · Decision time`}
        title="Draft"
        subtitle={introLine(called, pending)}
      />
      <OffseasonPointsCard
        note={portal ? <span className="pb-draft-poolnote">Same pool as the<br />transfer portal</span> : false}
      />
      <SegmentedControl<View>
        label="Draft"
        className="pb-draft-tabs"
        value={view}
        onChange={setView}
        options={[
          { value: 'keep', label: 'Waiting on you', badge: pending > 0 ? pending : undefined },
          { value: 'leaving', label: 'Leaving' },
          { value: 'board', label: 'Draft board' },
        ]}
      />

      {view === 'keep' && <KeepList men={men} pending={pending} abbr={team.def.abbr} roster={roster} />}

      {view === 'leaving' && (
        <>
          {/* What you are short of, above the names: a list of who left is a
              eulogy, a list of what you need is a shopping list. */}
          {holes.length > 0 && (
            <Callout tone="warning" title="You are now short at">
              {holes.map((h) => `${holeName(h.pos)}${h.count > 1 ? ` (${h.count})` : ''}`).join(', ')}.
              {` Fill these through recruiting${portal ? ' or the transfer portal' : ''}.`}
            </Callout>
          )}
          <LeavingList rows={leavingRows} tagOf={tagOf} claimEmpty={!!report} />
        </>
      )}

      {view === 'board' && (report ? (
        <>
          <p className="pb-text-muted">Every college player taken this June, grouped by round. Yours are marked.</p>
          <NationalBoard rows={national} abbr={team.def.abbr} />
          {undrafted.length > 0 && (
            <section className="pb-stack">
              <SectionHeader className="pb-draft-round pb-draft-flush" title="Not drafted" count={undrafted.length} />
              <BoardRows rows={undrafted} abbr={team.def.abbr} />
            </section>
          )}
        </>
      ) : (
        // The country's board lives in the offseason report, which the save
        // keeps now. Only a winter begun on a save from before it did has
        // none to show, and nothing can rebuild it.
        <EmptyState icon="info" title="The draft board is gone" text="Older saves did not keep it." />
      ))}
    </main>
  );

  if (phase === null) return page;
  // The note always holds its two lines, so the button under it never moves
  // when the last answer comes in (see ActionBar).
  const note = pending > 0
    ? `${pending} ${pending === 1 ? 'player still needs' : 'players still need'} an answer. `
      + `If you move on, ${pending === 1 ? 'he signs with his club' : 'they sign with their clubs'}.`
    : called > 0 ? 'Every drafted player has an answer.' : '';
  return (
    <StepScreen
      bar={(
        <ContinueBar
          from="draft"
          variant={pending > 0 ? 'secondary' : 'primary'}
          note={<span className={cx('pb-draft-note', pending > 0 ? 'pb-tone--warning' : 'pb-tone--positive')}>{note}</span>}
        />
      )}
    >{page}</StepScreen>
  );
}

// ---------------------------------------------------------------------------
// Waiting on you
// ---------------------------------------------------------------------------

function KeepList(
  { men, pending, abbr, roster }:
  { men: readonly DraftedMan[]; pending: number; abbr: string; roster: readonly Player[] },
) {
  const releasePlayer = useDynasty((s) => s.releasePlayer);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [open, setOpen] = useState<string | null>(null);
  const talking = men.find((m) => m.player.id === open) ?? null;

  if (men.length === 0) return <EmptyState icon="check-circled" title="Nobody to call" />;
  return (
    <section className="pb-stack">
      <SectionHeader
        className="pb-draft-flush"
        title="Waiting on you"
        count={pending > 0 ? `${pending} to decide` : 'All decided'}
      />
      {men.map((man) => (
        <DecisionCard
          key={man.player.id}
          man={man}
          abbr={abbr}
          loss={ifHeSigns(man.player, roster)}
          onOpen={() => openPlayer(man.player.id)}
          onPitch={() => setOpen(man.player.id)}
          onRelease={() => { releasePlayer(man.player.id); }}
        />
      ))}
      {talking && <KeepSheet man={talking} abbr={abbr} onClose={() => setOpen(null)} />}
    </section>
  );
}

/**
 * One drafted man and the decision he is waiting on: where he went, what
 * keeping him usually costs, and what losing him costs. Letting him sign is a
 * two-press button here; the pitch is made in the sheet. Once he has an
 * answer, the answer takes the buttons' place.
 */
function DecisionCard(
  { man, abbr, loss, onOpen, onPitch, onRelease }:
  { man: DraftedMan; abbr: string; loss: Loss; onOpen: () => void; onPitch: () => void; onRelease: () => void },
) {
  const p = man.player;
  const waiting = man.outcome === 'pending';
  return (
    <article
      className={cx('pb-dcard', waiting && 'is-pending', man.outcome === 'stayed' && 'is-stayed')}
      aria-label={p.name}
    >
      {/* The man and his numbers open his card, as a player row does
          everywhere else (2026-09-26: "if we tap the players card it should
          open the players profile from here too"). The buttons stay the call. */}
      <button type="button" className="pb-dcard__open" onClick={onOpen}>
        <span className="pb-dcard__head">
          <Face id={p.id} team={abbr} size={44} />
          <span className="pb-dcard__who">
            <span className="pb-dcard__name">{p.name}</span>
            <span className="pb-dcard__role">{slotTag(p).title} · {CLASS_NAME[p.classYear]}</span>
          </span>
          <span className="pb-dcard__rating"><b>{overallOf(p)}</b><small>Rating</small></span>
        </span>
        <span className="pb-dcard__facts">
          <span><span className="pb-dcard__dt">Drafted in</span><span className="pb-dcard__dd">Round {man.round}</span></span>
          <span><span className="pb-dcard__dt">Usual price</span><span className="pb-dcard__dd">{keepPoints(man.round)} pts</span></span>
          <span>
            <span className="pb-dcard__dt">If he signs</span>
            <span className={cx('pb-dcard__dd', 'is-words', `pb-tone--${loss.tone}`)}>{loss.text}</span>
          </span>
        </span>
      </button>
      {waiting ? (
        <div className="pb-dcard__actions">
          <ConfirmButton
            variant="secondary"
            size="sm"
            className="pb-dcard__release"
            idle="Let him sign"
            armed="Tap again"
            onConfirm={onRelease}
          />
          <Button variant="primary" size="sm" icon="chat" onClick={onPitch}>Make your pitch</Button>
        </div>
      ) : <Outcome man={man} className="pb-dcard__result" />}
    </article>
  );
}

/** How the call went, once it has gone. */
function Outcome({ man, className }: { man: DraftedMan; className?: string }) {
  const p = man.player;
  // Floored, never rounded: he stays when the worth reaches the price, and a
  // 29.6 shown as 30 would read "30 against a price of 30" on a man who left.
  const made = Math.floor(man.made);
  if (man.outcome === 'stayed') {
    // The pitch by its name, in quotes: "Your a starting job pitch" does not
    // survive being read aloud.
    const named = man.pitch ? `“${capsWords(KEEP_LABEL[man.pitch])}” ` : '';
    return (
      <Callout tone="positive" title={`${p.name} is back for another season`} className={className}>
        Your {named}pitch was worth {made} against a price of {man.needed}.
      </Callout>
    );
  }
  // No pitch is a release: let go from here, or by moving on without an answer.
  if (man.pitch === null) {
    return (
      <Callout tone="neutral" icon="exit" title={`${p.name} signed with his club`} className={className}>
        You let him go. No points spent.
      </Callout>
    );
  }
  return (
    <Callout tone="neutral" icon="exit" title={`${p.name} turned you down`} className={className}>
      Your pitch was worth {made} against a price of {man.needed}. He signed, and the points are gone.
    </Callout>
  );
}

/**
 * The conversation: choose the pitch, then put points behind it. The points
 * are spent whether he stays or not, so the press that spends them is a
 * two-press button in the pinned footer; letting him sign is too. Afterwards
 * the same sheet says how the call went.
 */
function KeepSheet({ man, abbr, onClose }: { man: DraftedMan; abbr: string; onClose: () => void }) {
  const keepPlayer = useDynasty((s) => s.keepPlayer);
  const releasePlayer = useDynasty((s) => s.releasePlayer);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const pts = useOffseasonPoints();
  const [pitch, setPitch] = useState<KeepPitch | null>(null);
  const [offer, setOffer] = useState(0);

  const p = man.player;
  const pool = pts?.pool ?? 0;
  const left = Math.max(0, pts?.left ?? 0);
  const needs = keepPoints(man.round);
  const shown = Math.min(offer, left);
  const ready = pitch !== null && shown > 0;
  const done = man.outcome !== 'pending';
  const hints = pullHints(p);

  const read = pitch === null ? 'Choose a pitch first.'
    : shown === 0 ? 'Add points to your offer.'
      : shown < needs * 0.7 ? 'Well under the usual price. Only a pitch that really lands will hold him.'
        : shown < needs ? `Just under the usual price of ${needs}.`
          : `At or above the usual price of ${needs}.`;

  // The bar runs to whichever is larger, what you have or his usual price, so
  // a price out of reach shows as out of reach rather than off the end.
  const scale = Math.max(left, needs, 1);
  const at = (n: number): number => Math.max(0, Math.min(100, (n / scale) * 100));
  const price = <><b>{needs}</b> usual price</>;
  const have = <>{left} available</>;
  const priceFirst = needs <= left;
  const nearAt = at(priceFirst ? needs : left);
  // The nearer mark sits under its place, held clear of the labels at either
  // end; once the two would touch they are read as one line at the end.
  const together = nearAt > 60;
  const nearLeft = `clamp(${priceFirst ? '5em' : '4.5em'}, ${nearAt}%, calc(100% - ${priceFirst ? '10em' : '11.5em'}))`;

  const half = Math.round(needs / 2);
  const quick = [
    { n: half, label: `Half · ${half}` },
    { n: needs, label: `Usual · ${needs}` },
    { n: left, label: `All · ${left}` },
  ];

  return (
    <Sheet
      className="pb-keepsheet"
      eyebrow={`Round ${man.round} · ${slotTag(p).title} · ${CLASS_NAME[p.classYear]}`}
      // His name and his face open his card, over the conversation, so the way
      // back is the conversation (2026-09-24). The button for it sat at the
      // very bottom of a tall sheet, where nobody found it.
      title={(
        <button type="button" className="pb-sheet__who" onClick={() => openPlayer(p.id)}>
          {p.name}<Icon name="chevron-right" size={18} />
        </button>
      )}
      subtitle={`Rating ${overallOf(p)}`}
      lead={(
        <button type="button" className="pb-sheet__face" aria-label={`Open ${p.name}'s card`} onClick={() => openPlayer(p.id)}>
          <Face id={p.id} team={abbr} size={48} />
        </button>
      )}
      onClose={onClose}
      tall
      footer={done ? <Button variant="secondary" block onClick={onClose}>Back to the draft</Button> : (
        <>
          <span className="pb-keep-foot__line">
            <span>{pitch ? `${capsWords(KEEP_LABEL[pitch])} · ${shown} pts` : 'No pitch chosen'}</span>
            <span>{left - shown} of {pool} left after</span>
          </span>
          <span className="pb-keep-foot__buttons">
            <ConfirmButton
              variant="danger"
              className="pb-keep-foot__release"
              idle="Let him sign"
              armed="Tap again: he signs"
              onConfirm={() => { releasePlayer(p.id); }}
            />
            <ConfirmButton
              variant="primary"
              disabled={!ready}
              idle={ready ? `Make the offer · ${shown} pts` : pitch ? 'Add points' : 'Choose a pitch'}
              armed="Tap again: points are spent either way"
              onConfirm={() => { if (pitch) keepPlayer(p.id, pitch, shown); }}
            />
          </span>
        </>
      )}
    >
      {done ? <Outcome man={man} /> : (
        <>
          <div className="pb-keep-hear">
            <Icon name="chat" size={16} />
            <span className="pb-keep-hear__body">
              <span className="pb-keep-label">What we are hearing</span>
              <span className="pb-keep-hear__quotes">&ldquo;{hints[0]}&rdquo; &ldquo;{hints[1]}&rdquo;</span>
            </span>
          </div>

          <section className="pb-keep-part">
            <header className="pb-keep-part__head">
              <h3 className="pb-keep-part__title">1 · Your pitch</h3>
              <span className="pb-keep-part__caption">He hears one</span>
            </header>
            <OptionGroup label="Your pitch" columns={2}>
              {KEEP_PITCHES.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={pitch === k}
                  className={cx('pb-keep-pitch', pitch === k && 'is-selected')}
                  onClick={() => setPitch(k)}
                >
                  <span className="pb-keep-pitch__top">
                    <span className="pb-keep-pitch__title">{capsWords(KEEP_LABEL[k])}</span>
                    <span className="pb-keep-pitch__dot" aria-hidden />
                  </span>
                  <span className="pb-keep-pitch__case">&ldquo;{KEEP_CASE[k]}&rdquo;</span>
                  <span className="pb-keep-pitch__when">
                    <span className="pb-keep-label">Works when</span>
                    <span className="pb-keep-pitch__whentext">{KEEP_RESTS_ON[k]}</span>
                  </span>
                </button>
              ))}
            </OptionGroup>
          </section>

          <section className="pb-keep-offer">
            <header className="pb-keep-offer__head">
              <h3 className="pb-keep-part__title">2 · Back it with points</h3>
              <Stepper
                label="Points to offer"
                className="pb-keep-offer__stepper"
                value={shown}
                min={0}
                max={left}
                step={5}
                onChange={setOffer}
              />
            </header>
            <div className="pb-keep-offer__bar" aria-hidden>
              <span className="pb-keep-offer__track">
                <i className={cx('pb-keep-offer__fill', shown >= needs && 'is-enough')} style={{ width: `${at(shown)}%` }} />
                {needs > left && <i className="pb-keep-offer__beyond" style={{ left: `${at(left)}%` }} />}
              </span>
              <i className="pb-keep-offer__tick" style={{ left: `${at(needs)}%` }} />
            </div>
            <div className="pb-keep-offer__labels" aria-hidden>
              <span>0</span>
              {together
                ? <span className="pb-keep-offer__end">{priceFirst ? price : have} · {priceFirst ? have : price}</span>
                : (
                  <>
                    <span className="pb-keep-offer__mid" style={{ left: nearLeft }}>{priceFirst ? price : have}</span>
                    <span className="pb-keep-offer__end">{priceFirst ? have : price}</span>
                  </>
                )}
            </div>
            <span className="pb-sr">Usual price {needs}. {left} available.</span>
            <div className="pb-keep-offer__quick" role="group" aria-label="Quick amounts">
              {quick.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  className={cx(q.n > 0 && shown === q.n && 'is-selected')}
                  aria-pressed={q.n > 0 && shown === q.n}
                  disabled={q.n <= 0 || q.n > left}
                  onClick={() => setOffer(q.n)}
                >{q.label}</button>
              ))}
            </div>
            <p className={cx('pb-keep-offer__read', ready && shown < needs * 0.7 && 'is-warning')}>{read}</p>
          </section>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The lists
// ---------------------------------------------------------------------------

/** A rating at the end of a compact row, named for a screen reader. */
function Rating({ value }: { value: number }) {
  return <b className="pb-drow__value"><span className="pb-sr">Rating </span>{value}</b>;
}

/** How a player left, as a badge. */
function exitBadge(d: Departure) {
  if (d.returned) return <StatusBadge tone="positive" icon={false}>Stayed</StatusBadge>;
  if (d.reason === 'drafted') return <StatusBadge tone="info" icon={false}>Drafted · round {d.round ?? '?'}</StatusBadge>;
  if (d.reason === 'walk-on') return <StatusBadge tone="neutral" icon={false}>Walk-on, year up</StatusBadge>;
  return <StatusBadge tone="neutral" icon={false}>Graduated</StatusBadge>;
}

/** Everyone who left you, with how. */
function LeavingList(
  { rows, tagOf, claimEmpty }:
  { rows: Departure[]; tagOf: (id: string) => SpotTag | null; claimEmpty: boolean },
) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  if (rows.length === 0) return claimEmpty ? <EmptyState icon="person" title="Nobody left" /> : null;
  return (
    <List label="Leaving">
      {rows.map((d) => {
        const tag = tagOf(String(d.id));
        return (
          <PlayerRow
            key={d.id}
            className="pb-drow"
            name={d.name}
            avatar={<Face id={d.id} team={d.teamAbbr} size={36} />}
            tags={tag ? [tag] : undefined}
            meta={CLASS_NAME[d.classYear] ?? d.classYear}
            trailing={<span className="pb-drow__end">{exitBadge(d)}<Rating value={d.overall} /></span>}
            chevron={false}
            onClick={() => openPlayer(d.id)}
          />
        );
      })}
    </List>
  );
}

/** Players on the national board: school, class and age, yours marked. */
function BoardRows({ rows, abbr }: { rows: Departure[]; abbr: string }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const season = useDynasty((s) => s.season);
  const schools = useMemo(
    () => new Map((season?.teams ?? []).map((t) => [t.def.abbr, t.def.school])),
    [season],
  );
  return (
    <List label="Players">
      {rows.map((d) => {
        const mine = d.teamAbbr === abbr;
        return (
          <PlayerRow
            key={d.id}
            className={cx('pb-drow', 'pb-drow--board', mine && 'is-yours')}
            name={d.name}
            avatar={<Face id={d.id} team={d.teamAbbr} size={32} />}
            mark={mine ? <Tag tone="you">Yours</Tag> : undefined}
            meta={`${schools.get(d.teamAbbr) ?? d.teamAbbr} · ${CLASS_NAME[d.classYear] ?? d.classYear} · age ${d.age}`}
            trailing={<Rating value={d.overall} />}
            chevron={false}
            onClick={() => openPlayer(d.id)}
          />
        );
      })}
    </List>
  );
}

/**
 * The country's draft, round by round. Grouped rather than numbered pick by
 * pick: our schools supply only a slice of each round, and a pick number would
 * be invented.
 */
function NationalBoard({ rows, abbr }: { rows: Departure[]; abbr: string }) {
  const blocks: { round: number; men: Departure[] }[] = [];
  for (const d of rows) {
    const round = d.round ?? 99;
    const last = blocks[blocks.length - 1];
    if (last && last.round === round) last.men.push(d);
    else blocks.push({ round, men: [d] });
  }
  if (blocks.length === 0) return <EmptyState icon="person" title="Nobody taken" />;
  return (
    <>
      {blocks.map((b) => (
        <section key={b.round} className="pb-stack">
          <SectionHeader className="pb-draft-round pb-draft-flush" title={`Round ${b.round}`} count={b.men.length} />
          <BoardRows rows={b.men} abbr={abbr} />
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Before the draft
// ---------------------------------------------------------------------------

/** No results yet: who is exposed to the draft, and who is safe. */
function DraftOdds(
  { team, year, inSequence }:
  { team: NonNullable<ReturnType<typeof useUserTeam>>; year: number; inSequence: boolean },
) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const season = useDynasty((s) => s.season);
  // One body once: a two-way man stands in the lineup and the rotation both.
  const roster: Player[] = uniquePlayers([
    ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
  ]);
  const byOverall = (a: Player, b: Player) => overallOf(b) - overallOf(a);
  // Eligibility is read against the June ahead, a year older than today.
  const inJune = (p: Player) => ({ classYear: p.classYear, age: p.age + 1 });
  const exposed = roster.filter((p) => p.classYear !== 'SR' && draftEligible(inJune(p))).sort(byOverall);
  const seniors = roster.filter((p) => p.classYear === 'SR').sort(byOverall);
  // The odds June's draw is made against: his rating moved by his season so
  // far, and a two-way man's better half (`draftStock`).
  const ctx = season ? draftContextOf(season) : null;
  const oddsOf = (p: Player): number => draftChance(draftStock(p, season, ctx));
  const atRisk = exposed.filter((p) => oddsOf(p) >= 0.35).length;
  // "Juniors and older" is the rule most years; the age clause can put a
  // younger man on the list too, and then the line has to say so.
  const underclass = exposed.some((p) => p.classYear === 'FR' || p.classYear === 'SO');

  const oddsBadge = (odds: number | null) => (odds === null
    ? <StatusBadge tone="neutral" icon={false}>Graduating</StatusBadge>
    : odds >= 0.7 ? <StatusBadge tone="negative" icon={false}>Likely to leave</StatusBadge>
      : odds >= 0.35 ? <StatusBadge tone="warning" icon={false}>Could leave</StatusBadge>
        : odds >= 0.12 ? <StatusBadge tone="neutral" icon={false}>Outside chance</StatusBadge>
          : <StatusBadge tone="positive" icon={false}>Should stay</StatusBadge>);

  const rows = (list: Player[], withOdds: boolean) => (
    <List label="Players">
      {list.map((p) => (
        <PlayerRow
          key={p.id}
          className="pb-drow"
          name={p.name}
          avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
          tags={[slotTag(p)]}
          meta={`${CLASS_NAME[p.classYear]} · age ${p.age}`}
          trailing={(
            <span className="pb-drow__end">
              {oddsBadge(withOdds ? oddsOf(p) : null)}
              <Rating value={overallOf(p)} />
            </span>
          )}
          chevron={false}
          onClick={() => openPlayer(p.id)}
        />
      ))}
    </List>
  );

  const page = (
    <main className="pb-page pb-draft">
      <Marquee
        eyebrow={`${team.def.school} · ${year} · Who could be taken`}
        title="The draft"
        subtitle="The draft is in June. Juniors and older can be taken; seniors leave either way."
        numbers={[
          { label: 'Seniors', value: seniors.length, note: 'Graduating' },
          { label: 'Eligible', value: exposed.length, note: 'Can be drafted' },
          {
            label: 'At risk',
            value: atRisk > 0 ? <span className="pb-tone--warning">{atRisk}</span> : atRisk,
            note: 'Likely or could leave',
          },
        ]}
      />
      {exposed.length > 0 && (
        <section className="pb-stack">
          {/* The review's line, true again since 2026-09-26: the odds are
              his rating moved by his season (`draftStock`). */}
          <SectionHeader
            className="pb-draft-flush"
            title="Eligible for the draft"
            count={exposed.length}
            description={`${underclass ? 'Juniors, and anyone 21 by June.' : 'Juniors and older.'} `
              + 'A strong season raises the odds a club takes him.'}
          />
          {rows(exposed, true)}
        </section>
      )}
      {seniors.length > 0 && (
        <section className="pb-stack">
          <SectionHeader
            className="pb-draft-flush"
            title="Leaving anyway"
            count={seniors.length}
            description="Seniors in their final season."
          />
          {rows(seniors, false)}
        </section>
      )}
    </main>
  );
  return inSequence ? <StepScreen bar={<ContinueBar from="draft" />}>{page}</StepScreen> : page;
}
