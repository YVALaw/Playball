// Draft.tsx
// Who left, where they went, and the one conversation you get to have about it.
//
// A player with eligibility left has been offered a professional contract and
// has not signed it yet; what you say to him decides whether he is in your
// lineup in February. The offer is paid in offseason points, the fund the
// transfer portal also draws from, and it is spent whether it works or not.
//
// Three views: Waiting on you (the decisions), Leaving (what it cost you, with
// the positions it leaves short), and the Draft board (the country's story).

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { draftChance } from '../../engine/progression.js';
import type { Departure } from '../../engine/progression.js';
import {
  draftEligible, keepPoints, pullHints,
  KEEP_PITCHES, KEEP_LABEL, KEEP_CASE, KEEP_RESTS_ON,
  type DraftedMan, type KeepPitch,
} from '../../engine/draft.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { isTwoWay } from '../../engine/types.js';
import type { Hitter, Pitcher, Player, Position } from '../../engine/types.js';
import {
  Button, Callout, Chip, Chips, ConfirmButton, EmptyState, Face, List, Marquee, OptionCard,
  OptionGroup, PlayerRow, SectionHeader, SegmentedControl, Sheet, StatGroup, StatusBadge, Step,
  Stepper, Tag,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME, capsWords, plural } from '../words.js';
import { ContinueBar, OffseasonPointsCard, StepScreen, useOffseasonPoints } from './OffseasonStep.js';

type View = 'keep' | 'leaving' | 'board';

/** His position as a short tag, with the full name for a screen reader. */
function slotTag(p: Player): { text: string; title: string } {
  if (isTwoWay(p)) return { text: 'Two-way', title: 'Two-way player' };
  const code = p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);
  return { text: code, title: POSITION_NAME[code as Position] ?? code };
}

export function Draft() {
  const phase = useDynasty((s) => s.phase);
  const report = useDynasty((s) => s.lastOffseason);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  const board = season?.draft ?? null;
  const pending = board?.men.filter((m) => m.outcome === 'pending').length ?? 0;
  const [view, setView] = useState<View>(pending > 0 ? 'keep' : 'leaving');

  const { undrafted, leaving, national, mineLost, mineDrafted, kept } = useMemo(() => {
    const drafted = report?.drafted ?? [];
    const graduated = report?.graduated ?? [];
    const abbr = team?.def.abbr;
    const mine = [...drafted, ...graduated].filter((d) => d.teamAbbr === abbr);
    return {
      // The country's board, best round first, capped where reading stops.
      national: drafted.slice(0, 80),
      // Seniors whose names were never called; walk-ons whose year was up are
      // not this, and stay out of it.
      undrafted: graduated.filter((d) => d.reason === 'graduated').sort((a, b) => b.overall - a.overall).slice(0, 40),
      leaving: mine.sort((a, b) => b.overall - a.overall),
      mineLost: mine.filter((d) => !d.returned).length,
      mineDrafted: mine.filter((d) => !d.returned && d.reason === 'drafted').length,
      kept: mine.filter((d) => d.returned).length,
    };
  }, [report, team, version]);

  if (!team) return null;

  // Before the offseason has run there is nothing to report, so the screen
  // shows the odds instead: who is exposed and who is safe.
  if (!report && !board) return <DraftOdds team={team} year={year} inSequence={phase !== null} />;

  const holes = report?.holes ?? [];
  const called = board?.men.length ?? 0;

  const page = (
    <main className="pb-page">
      <FirstVisit id="draftphase" />
      <Marquee
        eyebrow={`${year} draft · The phone calls`}
        title="Draft"
      />
      <OffseasonPointsCard />
      <StatGroup
        size="sm"
        items={[
          { label: 'You lost', value: mineLost, note: `${mineDrafted} drafted · ${mineLost - mineDrafted} graduated` },
          { label: 'Talked into staying', value: kept },
          { label: 'Waiting on you', value: pending, noteTone: pending > 0 ? 'warning' : undefined, note: pending > 0 ? 'Decide before you move on' : 'All decided' },
        ]}
      />
      <SegmentedControl<View>
        label="Draft"
        value={view}
        onChange={setView}
        options={[
          { value: 'keep', label: 'Waiting on you', badge: pending > 0 ? pending : undefined },
          { value: 'leaving', label: 'Leaving' },
          { value: 'board', label: 'Draft board' },
        ]}
      />

      {view === 'keep' && <KeepList men={board?.men ?? []} abbr={team.def.abbr} />}

      {view === 'leaving' && (
        <>
          {/* What you are short of, above the names: a list of who left is a
              eulogy, a list of what you need is a shopping list. */}
          {holes.length > 0 && (
            <Callout tone="warning" title="Positions this leaves short">
              {holes.map((h) => `${POSITION_NAME[h.pos as Position] ?? h.pos}${h.count > 1 ? ` (${h.count})` : ''}`).join(', ')}.
              
            </Callout>
          )}
          <Departures rows={leaving} abbr={team.def.abbr} empty="Nobody left. A whole roster returns, which almost never happens." />
        </>
      )}

      {view === 'board' && (
        <>
          <NationalBoard rows={national} abbr={team.def.abbr} />
          {undrafted.length > 0 && (
            <section className="pb-stack">
              <SectionHeader title="Not drafted" count={undrafted.length} />
              <Departures rows={undrafted} abbr={team.def.abbr} empty="" />
            </section>
          )}
        </>
      )}
    </main>
  );

  if (phase === null) return page;
  return (
    <StepScreen
      bar={(
        <ContinueBar
          from="draft"
          note={pending > 0
            ? `${plural(pending, 'player is', 'players are')} still waiting on an answer. Moving on lets ${pending === 1 ? 'him' : 'them'} go.`
            : undefined}
        />
      )}
    >{page}</StepScreen>
  );
}

// ---------------------------------------------------------------------------
// Making the case
// ---------------------------------------------------------------------------

function KeepList({ men, abbr }: { men: readonly DraftedMan[]; abbr: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const talking = men.find((m) => m.player.id === open) ?? null;

  if (men.length === 0) {
    return <EmptyState icon="check-circled" title="Nobody to call" text="No pro team took a player of yours who still has eligibility." />;
  }
  return (
    <>
      <List label="Drafted players">
        {men.map((man) => {
          const p = man.player;
          const status = man.outcome === 'pending'
            ? <StatusBadge tone="warning" icon="clock">Waiting on you</StatusBadge>
            : man.outcome === 'stayed'
              ? <StatusBadge tone="positive">Coming back</StatusBadge>
              : <StatusBadge tone="neutral" icon="exit">Signed with a pro team</StatusBadge>;
          return (
            <PlayerRow
              key={p.id}
              name={p.name}
              avatar={<Face id={p.id} team={abbr} size={40} />}
              tags={[slotTag(p), CLASS_NAME[p.classYear]]}
              meta={`Round ${man.round} · usually takes ${keepPoints(man.round)} points`}
              flags={status}
              value={overallOf(p)}
              valueLabel="Rating"
              onClick={() => setOpen(p.id)}
            />
          );
        })}
      </List>
      {talking && <KeepSheet man={talking} abbr={abbr} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * The conversation: choose the argument, then put points behind it. The
 * points are spent whether he stays or not, so the press that spends them is
 * a two-press button; letting him go is too. Afterwards the same sheet says
 * how the call went.
 */
function KeepSheet({ man, abbr, onClose }: { man: DraftedMan; abbr: string; onClose: () => void }) {
  const keepPlayer = useDynasty((s) => s.keepPlayer);
  const releasePlayer = useDynasty((s) => s.releasePlayer);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const pts = useOffseasonPoints();
  const [pitch, setPitch] = useState<KeepPitch | null>(null);
  const [offer, setOffer] = useState(0);

  const p = man.player;
  const left = pts?.left ?? 0;
  const needs = keepPoints(man.round);
  const hints = pullHints(p);
  const done = man.outcome !== 'pending';
  const stayed = man.outcome === 'stayed';
  const quick = [Math.round(needs / 2), needs, left]
    .map((n) => Math.min(left, Math.max(1, n)))
    .filter((n, i, a) => left > 0 && a.indexOf(n) === i);

  return (
    <Sheet
      eyebrow={`Round ${man.round} · ${slotTag(p).title} · ${CLASS_NAME[p.classYear]}`}
      title={p.name}
      subtitle={`Rating ${overallOf(p)}`}
      lead={<Face id={p.id} team={abbr} size={48} />}
      onClose={onClose}
      tall
      footer={done ? <Button variant="secondary" block onClick={onClose}>Back to the draft</Button> : undefined}
    >
      {done ? (
        <Callout tone={stayed ? 'positive' : 'neutral'} title={stayed ? `${p.name} is coming back` : `${p.name} signed with a pro team`}>
          {man.pitch === null ? 'You made no case.' : `${capsWords(KEEP_LABEL[man.pitch])}: worth ${Math.round(man.made)} of the ${man.needed} needed.`}
        </Callout>
      ) : (
        <>
          <Callout tone="info" icon="chat" title="What his camp is saying">
            &ldquo;{hints[0]}&rdquo; &ldquo;{hints[1]}&rdquo;
          </Callout>

          <Step number={1} title="Choose your argument" state={pitch ? 'done' : 'current'} summary={pitch ? capsWords(KEEP_LABEL[pitch]) : undefined}>
            <OptionGroup label="Your argument">
              {KEEP_PITCHES.map((k) => (
                <OptionCard
                  key={k}
                  title={capsWords(KEEP_LABEL[k])}
                  hint={<>&ldquo;{KEEP_CASE[k]}&rdquo; Rests on: {KEEP_RESTS_ON[k].replace('TRAINING', 'Training')}</>}
                  selected={pitch === k}
                  onSelect={() => setPitch(k)}
                />
              ))}
            </OptionGroup>
          </Step>

          <Step number={2} title="Put points behind it" state={pitch ? 'current' : 'upcoming'}>
            <Stepper
              label="Points to offer"
              hint={`Round ${man.round} usually takes ${needs}. You have ${left}.`}
              value={Math.min(offer, left)}
              min={0}
              max={Math.max(0, left)}
              step={5}
              onChange={setOffer}
            />
            {quick.length > 0 && (
              <Chips label="Quick amounts">
                {quick.map((n) => (
                  <Chip key={n} selected={offer === n} onClick={() => setOffer(n)}>
                    {n === left ? `All ${n}` : n === needs ? `The usual: ${n}` : `${n}`}
                  </Chip>
                ))}
              </Chips>
            )}
            <ConfirmButton
              block
              icon="chat"
              disabled={!pitch || offer <= 0 || offer > left}
              idle={`Make the case · ${offer} points`}
              armed="Tap again: the points are spent either way"
              armedMeta={`${Math.max(0, left - offer)} left after`}
              onConfirm={() => { if (pitch) keepPlayer(p.id, pitch, offer); }}
            />
          </Step>

          <ConfirmButton
            block
            variant="danger"
            icon="exit"
            idle="Let him go"
            armed="Tap again to let him sign"
            armedMeta="Costs nothing"
            onConfirm={() => { releasePlayer(p.id); }}
          />
          <Button variant="quiet" size="sm" icon="id-card" onClick={() => { onClose(); openPlayer(p.id); }}>Open his card</Button>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The lists
// ---------------------------------------------------------------------------

/** How a player left, as a badge. */
function exitBadge(d: Departure) {
  if (d.returned) return <StatusBadge tone="positive">Stayed</StatusBadge>;
  if (d.reason === 'drafted') return <StatusBadge tone="info" icon={false}>Drafted · round {d.round ?? '?'}</StatusBadge>;
  if (d.reason === 'walk-on') return <StatusBadge tone="neutral" icon={false}>Walk-on, his year was up</StatusBadge>;
  return <StatusBadge tone="neutral" icon={false}>Graduated</StatusBadge>;
}

function Departures({ rows, abbr, empty }: { rows: Departure[]; abbr: string; empty: string }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const season = useDynasty((s) => s.season);
  if (rows.length === 0) {
    return empty ? <EmptyState icon="person" title="Nobody" text={empty} /> : null;
  }
  const schoolOf = (a: string): string => season?.teams.find((t) => t.def.abbr === a)?.def.school ?? a;
  return (
    <List label="Players">
      {rows.map((d) => (
        <PlayerRow
          key={d.id}
          name={d.name}
          avatar={<Face id={d.id} team={d.teamAbbr} size={40} />}
          mark={d.teamAbbr === abbr ? <Tag tone="you">Yours</Tag> : undefined}
          tags={[CLASS_NAME[d.classYear] ?? d.classYear]}
          meta={`${schoolOf(d.teamAbbr)} · age ${d.age}`}
          flags={exitBadge(d)}
          value={d.overall}
          valueLabel="Rating"
          onClick={() => openPlayer(d.id)}
        />
      ))}
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
  if (blocks.length === 0) return <EmptyState icon="person" title="Nobody taken" text="No college player was drafted this year." />;
  return (
    <>
      {blocks.map((b) => (
        <section key={b.round} className="pb-stack">
          <SectionHeader title={`Round ${b.round}`} count={b.men.length} />
          <Departures rows={b.men} abbr={abbr} empty="" />
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
  const roster: Player[] = [...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen];
  const byOverall = (a: Player, b: Player) => overallOf(b) - overallOf(a);
  // Eligibility is read against the June ahead, a year older than today.
  const inJune = (p: Player) => ({ classYear: p.classYear, age: p.age + 1 });
  const exposed = roster.filter((p) => p.classYear !== 'SR' && draftEligible(inJune(p))).sort(byOverall);
  const seniors = roster.filter((p) => p.classYear === 'SR').sort(byOverall);
  const atRisk = exposed.filter((p) => draftChance(overallOf(p)) >= 0.35).length;

  const oddsBadge = (odds: number | null) => (odds === null
    ? <StatusBadge tone="neutral" icon={false}>Graduating</StatusBadge>
    : odds >= 0.7 ? <StatusBadge tone="negative">Likely to leave</StatusBadge>
      : odds >= 0.35 ? <StatusBadge tone="warning">Could leave</StatusBadge>
        : odds >= 0.12 ? <StatusBadge tone="neutral" icon={false}>Outside chance</StatusBadge>
          : <StatusBadge tone="positive">Should stay</StatusBadge>);

  const rows = (list: Player[], withOdds: boolean) => (
    <List label="Players">
      {list.map((p) => (
        <PlayerRow
          key={p.id}
          name={p.name}
          avatar={<Face id={p.id} team={team.def.abbr} size={40} />}
          tags={[slotTag(p), CLASS_NAME[p.classYear]]}
          meta={`Age ${p.age}`}
          flags={oddsBadge(withOdds ? draftChance(overallOf(p)) : null)}
          value={overallOf(p)}
          valueLabel="Rating"
          onClick={() => openPlayer(p.id)}
        />
      ))}
    </List>
  );

  const page = (
    <main className="pb-page">
      <Marquee
        eyebrow={`${team.def.school} · ${year} · Who is exposed`}
        title="The draft"
        numbers={[
          { label: 'Seniors', value: seniors.length, note: 'Graduating' },
          { label: 'Eligible', value: exposed.length, note: 'Can be drafted' },
          { label: 'At risk', value: atRisk, note: 'Likely or could leave', tone: atRisk > 0 ? 'warning' : undefined },
        ]}
      />
      {exposed.length > 0 && (
        <section className="pb-stack">
          <SectionHeader title="Eligible for the draft" count={exposed.length} />
          {rows(exposed, true)}
        </section>
      )}
      {seniors.length > 0 && (
        <section className="pb-stack">
          <SectionHeader title="Leaving anyway" count={seniors.length} />
          {rows(seniors, false)}
        </section>
      )}
    </main>
  );
  return inSequence ? <StepScreen bar={<ContinueBar from="draft" />}>{page}</StepScreen> : page;
}
