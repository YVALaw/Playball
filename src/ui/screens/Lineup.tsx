// Lineup.tsx
// Who plays tonight, where they bat, where they stand, and who pitches.
//
// Every change writes straight to the team the engine reads, so nothing here
// needs saving. The grammar is one gesture everywhere: tap a player, then the
// spot he should take. It works between batting spots (a swap), from the bench
// into the order (he starts instead), between a position on the field and a
// player (he plays there, either way round), between two positions (their men
// trade), between rotation days, and from the bullpen to a rotation day.
//
// The field over the batting order is a ballpark with each starter's name at
// his position (LineupField.tsx). It replaced a row of position chips: "make
// it look more like the ball park and compact a bit the names and locate them
// in the positions" (the UI clarity review, 2026-09-25). While a player or a
// position is picked, the bar pinned to the foot of the lists says what the
// next tap does. Holding a row or a name still opens his stats; "Card" in the
// bar is the visible way.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { blockingCardUp, lineupHolds, useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { returnPending, whyOut } from '../Needs.js';
import { Modal } from '../Modal.js';
import { armValue, batScore, gloveOf, overallOf } from '../../engine/ratings.js';
import { isTwoWay, uniquePlayers } from '../../engine/types.js';
import { captainOf } from '../../engine/captains.js';
import {
  battingAverage, era, inningsPitched, injuryClock, seriesGames,
  restedFirst, closerFrom, startableSlot, currentDay, shortRest, restDays, recoveryGap,
} from '../../engine/season.js';
import { handles } from '../../state/depth.js';
import { available, cardGaps } from '../../engine/depthChart.js';
import { coverTier, fieldingAt, positionPenalty } from '../../engine/positions.js';
import { useHold } from '../useLongPress.js';
import type { Arm, Hitter, Player, PlayerId, Position } from '../../engine/types.js';
import {
  Button, Callout, Face, Icon, List, Marquee, PlayerRow, SectionHeader,
  SegmentedControl, StatusBadge, Tag,
} from '../components/ui/index.js';
import { LineupField, type FieldMan } from '../LineupField.js';
import { PositionPicker, type PickerMan } from '../PositionPicker.js';
import { POSITION_NAME, plural } from '../words.js';
import { ordinal, pct, shortName } from '../format.js';

/**
 * What each rotation slot is called, for a weekend of `weekend` games. The
 * weekend takes the last `weekend` days of a Thursday-to-Sunday block, the
 * midweek arm follows it, and anything past that is depth.
 */
const WEEKEND_DAYS = ['THU', 'FRI', 'SAT', 'SUN'];
export const slotNames = (weekend: number, size: number): string[] => {
  const days = WEEKEND_DAYS.slice(Math.max(0, WEEKEND_DAYS.length - weekend));
  const out = [...days, 'MID'];
  while (out.length < size) out.push('DEPTH');
  return out.slice(0, Math.max(size, out.length));
};
const SLOT_WORD: Record<string, string> = {
  THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun', MID: 'Midweek', DEPTH: 'Depth',
};

const posName = (p: string): string => POSITION_NAME[p as keyof typeof POSITION_NAME] ?? p;
const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function Lineup() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const swapLineup = useDynasty((s) => s.swapLineup);
  /*
    Whether this card is yours to write. A casual coach's bench coach rewrites
    it before every game, so the rows are read-only then and the screen says so
    rather than accepting edits it will not keep.
  */
  const mine = useDynasty((s) => handles(s.depth, 'lineups'));
  // The pitching half follows 'Rotation and bullpen', not 'Lineups' (M77).
  const arms = useDynasty((s) => handles(s.depth, 'bullpen'));
  const swapStarter = useDynasty((s) => s.swapStarter);
  const assignPosition = useDynasty((s) => s.assignPosition);
  const moveRotation = useDynasty((s) => s.moveRotation);
  const promoteArm = useDynasty((s) => s.promoteArm);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const autoLineup = useDynasty((s) => s.autoLineup);
  const swapPen = useDynasty((s) => s.swapPen);
  const myBracket = useDynasty((s) => s.myBracket);
  const keepCover = useDynasty((s) => s.keepCover);
  const team = useUserTeam();
  /*
    Open on the part that needs a hand. A starter who cannot go, with the
    batting order fine, is a pitching problem — and the screen opened on the
    batting order anyway from tonight's card, which carries no player
    ("when a pitcher gets injured and you tap to go set the lineup it drops
    you in the batting order instead of the pitching"). A flagged man still
    picks his own tab below.
  */
  const [view, setView] = useState<'bat' | 'pitch'>(() => {
    const s = useDynasty.getState();
    const t = s.season?.teams[s.userTeam]?.team;
    if (!s.season || !t) return 'bat';
    /*
      Sent here about one man: his side of the card. Reported 2026-09-24: a
      hurt catcher's SET THE LINEUP opened on the pitching order, because the
      guess below saw an arm it thought needed looking at.
    */
    const sentFor = s.focusPlayer;
    if (sentFor) {
      if ([...t.lineup, ...t.bench].some((p) => p.id === sentFor)) return 'bat';
      if ([...t.rotation, ...t.bullpen].some((p) => p.id === sentFor)) return 'pitch';
    }
    const day = injuryClock(s.season);
    const gaps = cardGaps(t.lineup);
    const batNeeds = gaps.missing.length > 0 || gaps.doubled.length > 0 || t.lineup.some((p) => !available(p, day));
    /*
      Only a starter who is genuinely out — hurt or ineligible. A redshirt is
      never available, and a reliever resting after last night is not out, so
      counting either sent every visit to the pitching order.
    */
    const genuinelyOut = (p: Player): boolean => {
      const u = p as Player & { why?: string; outUntil?: number };
      return (u.why === 'injury' || u.why === 'academic') && typeof u.outUntil === 'number' && day < u.outUntil;
    };
    const armNeeds = t.rotation.some(genuinelyOut);
    return armNeeds && !batNeeds ? 'pitch' : 'bat';
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [pickedArm, setPickedArm] = useState<number | null>(null);
  const [pickedPen, setPickedPen] = useState<PlayerId | null>(null);
  const [pickedBench, setPickedBench] = useState<PlayerId | null>(null);
  /** The position whose picker is open, and the label on the field it grew from. */
  const [choosing, setChoosing] = useState<{ pos: Position; from: DOMRect | null } | null>(null);
  const [dealt, setDealt] = useState(false);
  /** Bumped on every auto lineup, so the list re-keys and animates in. */
  const [deal, setDeal] = useState(0);
  useEffect(() => {
    if (!dealt) return undefined;
    const t = window.setTimeout(() => setDealt(false), 2400);
    return () => window.clearTimeout(t);
  }, [dealt, deal]);
  /*
    Hold a row to read his stats; the callout's button is the visible way. The
    row being held is kept in state so the line across its bottom can fill for
    as long as the hold is charging — without it a hold reads as a dead touch
    until the card simply appears.
  */
  const { hold, consumed } = useHold();
  const [charging, setCharging] = useState<string | null>(null);
  const holdStats = (id: PlayerId) => hold(
    () => openPlayer(id, 'stats'),
    (active) => setCharging(active ? String(id) : null),
  );
  const held = (id: string): string => (charging === String(id) ? ' is-holding' : '');

  /*
    The player the needs list sent you here about: taken into local state on
    arrival and marked, then scrolled to. One delivery, then it is the screen's.
  */
  const focus = useDynasty((s) => s.focusPlayer);
  const clearFocus = useDynasty((s) => s.clearFocusPlayer);
  const [flaggedId, setFlaggedId] = useState<string | null>(null);
  const flagged = useRef<HTMLElement | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const rowTops = useRef(new Map<string, number>());

  /* Rows glide to their new place after a swap. `offsetTop`, never a rect: a
     rect includes the transform the animation is applying mid-flight. */
  useLayoutEffect(() => {
    const still = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tops = new Map<string, number>();
    for (const [id, el] of rowEls.current) if (el.isConnected) tops.set(id, el.offsetTop);
    if (!still) {
      for (const [id, el] of rowEls.current) {
        const was = rowTops.current.get(id);
        const now = tops.get(id);
        if (was !== undefined && now !== undefined && Math.abs(was - now) > 1 && typeof el.animate === 'function') {
          if (typeof el.getAnimations === 'function') for (const a of el.getAnimations()) a.cancel();
          el.animate(
            [{ transform: `translateY(${was - now}px)` }, { transform: 'translateY(0)' }],
            { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' },
          );
        }
      }
    }
    rowTops.current = tops;
  });

  /*
    The lineup warned about, never corrected: a manual move that leaves a
    position empty or doubled raises this, and leaving with the card broken
    (the lineup gate) raises it again wherever you are.
  */
  const [gapWarn, setGapWarn] = useState<{ missing: string[]; doubled: string[] } | null>(null);
  const gateTick = useDynasty((s) => s.lineupGate);
  const warnIfBroken = (): void => {
    const t = useDynasty.getState().season?.teams[useDynasty.getState().userTeam]?.team;
    if (!t) return;
    const gaps = cardGaps(t.lineup);
    if (gaps.missing.length > 0 || gaps.doubled.length > 0) {
      setGapWarn({ missing: gaps.missing, doubled: [...new Set(gaps.doubled)] });
    }
  };
  useEffect(() => {
    if (!focus) return;
    setFlaggedId(focus);
    clearFocus();
  }, [focus, clearFocus]);
  // Arriving is not refusing: the callout above the order covers arrival, and
  // the modal answers only a refused exit made while this screen is up.
  const gateAtMount = useRef(gateTick);
  useEffect(() => {
    if (gateTick === gateAtMount.current) return;
    if (mine) warnIfBroken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateTick, mine]);
  /*
    A back press refused because the card has a hole (the store's `goBack`
    bumps `cardNudge`; it opens no modal, since nothing may mount during a
    pop). The "Nobody at ..." line that says why shakes, or on the Pitching
    tab the Batting order tab its dot sits on. Motion only: no words, nothing
    moves out of its place. Driven off the DOM so a second press shakes too.
  */
  const pageEl = useRef<HTMLElement | null>(null);
  const nudge = useDynasty((s) => s.cardNudge);
  const nudgedAt = useRef(nudge);
  useEffect(() => {
    if (nudge === nudgedAt.current) return;
    nudgedAt.current = nudge;
    const s = useDynasty.getState();
    if (!lineupHolds(s) || blockingCardUp(s)) return;
    const root = pageEl.current;
    const el = root?.querySelector<HTMLElement>('.pb-lineup-gap')
      ?? root?.querySelector<HTMLElement>('.pb-lineup-part > .pb-seg__opt:first-child');
    if (!el) return;
    el.classList.remove('is-nudged');
    void el.offsetWidth;
    el.classList.add('is-nudged');
  }, [nudge]);
  useEffect(() => {
    if (!flaggedId) return;
    const t = window.setTimeout(() => flagged.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    return () => window.clearTimeout(t);
  }, [flaggedId]);
  // A flagged man opens his own side of the card: pitchers the Pitching tab,
  // everybody else the batting order.
  useEffect(() => {
    if (!flaggedId || !team) return;
    const bat = [...team.team.lineup, ...team.team.bench].some((p) => p.id === flaggedId);
    const arm = [...team.team.rotation, ...team.team.bullpen].some((p) => p.id === flaggedId);
    if (arm && !bat) setView('pitch');
    else if (bat) setView('bat');
  }, [flaggedId, team]);

  void version;
  if (!season || !team) return null;

  const clock = injuryClock(season);
  const dayNow = currentDay(season);
  const order = team.team.lineup;
  const gaps = cardGaps(order);
  const broken = gaps.missing.length > 0 || gaps.doubled.length > 0;
  const captainId = captainOf(team.team)?.id;
  const clearPicks = (): void => { setPicked(null); setPickedArm(null); setPickedPen(null); setPickedBench(null); };

  const tap = (i: number): void => {
    setPickedArm(null); setPickedPen(null);
    if (pickedBench !== null) {
      swapStarter(i, pickedBench);
      warnIfBroken();
      setPickedBench(null); setPicked(null);
      return;
    }
    if (picked === null) { setPicked(i); return; }
    if (picked === i) { setPicked(null); return; }
    swapLineup(picked, i);
    setPicked(null);
  };

  const tapBench = (id: PlayerId): void => {
    setPickedArm(null); setPickedPen(null);
    if (picked !== null) {
      swapStarter(picked, id);
      warnIfBroken();
      setPicked(null); setPickedBench(null);
      return;
    }
    if (pickedBench === id) { setPickedBench(null); return; }
    setPickedBench(id);
  };

  /*
    A tap on the field. A man already picked, in the order or on the bench,
    takes this position; otherwise the men who can play it open over the
    field, grown out of the name that was tapped (PositionPicker.tsx).
  */
  const tapSpot = (pos: Position, from: DOMRect | null): void => {
    setPickedArm(null); setPickedPen(null);
    const man = picked !== null ? order[picked] ?? null
      : pickedBench !== null ? team.team.bench.find((p) => p.id === pickedBench) ?? null
        : null;
    if (man) {
      assignPosition(man.id, pos);
      setPicked(null); setPickedBench(null);
      return;
    }
    setChoosing({ pos, from });
  };

  const tapArm = (i: number): void => {
    setPicked(null); setPickedBench(null);
    if (pickedPen !== null) {
      promoteArm(pickedPen, i);
      setPickedPen(null); setPickedArm(null);
      return;
    }
    if (pickedArm === null) { setPickedArm(i); return; }
    if (pickedArm === i) { setPickedArm(null); return; }
    moveRotation(pickedArm, i - pickedArm);
    setPickedArm(null);
  };

  const tapPen = (id: PlayerId): void => {
    setPicked(null); setPickedBench(null);
    if (pickedArm !== null) {
      promoteArm(id, pickedArm);
      setPickedArm(null); setPickedPen(null);
      return;
    }
    if (pickedPen !== null && pickedPen !== id) {
      swapPen(pickedPen, id);
      setPickedPen(null);
      return;
    }
    setPickedPen(pickedPen === id ? null : id);
  };

  // Who pitches tonight: the scheduled slot, walked past an arm on short rest,
  // the same arithmetic the game uses.
  const nominalSlot: number | null = myBracket
    ? ((myBracket.state as { appearances?: Map<number, number> }).appearances?.get(team.index) ?? 0) % 3
    : season.schedule[season.dayIndex]?.games.find((g) => g.home === team.index || g.away === team.index)?.slot ?? null;
  const tonightSlot = nominalSlot === null ? null : startableSlot(season, team.team, nominalSlot, dayNow, clock);
  const penTonight = restedFirst(season, team);
  const closerTonight = closerFrom(penTonight, team.team.penByHand);
  const slots = slotNames(seriesGames(season.config), team.team.rotation.length);

  const pickedMan: Player | null = picked !== null ? order[picked] ?? null
    : pickedBench !== null ? team.team.bench.find((p) => p.id === pickedBench) ?? null
      : pickedArm !== null ? team.team.rotation[pickedArm] ?? null
        : pickedPen !== null ? team.team.bullpen.find((p) => p.id === pickedPen) ?? null : null;

  /* What the next tap does, said in the pinned bar. */
  const selection = (() => {
    if (!pickedMan) return null;
    if (pickedBench !== null) return { title: `Starting ${pickedMan.name}`, text: 'tap a batter or a position' };
    if (picked !== null) return { title: `Moving ${pickedMan.name}`, text: 'tap a batter, a position or the bench' };
    return { title: `Moving ${pickedMan.name}`, text: 'tap a day or a reliever' };
  })();
  /* Pinned to the foot of the screen, over the lists. It sat in the bar above
     the order first, and appearing there pushed every row down by its own
     height on the very tap that picked one ("the whole thing moves around"). */
  const hint = selection && (
    <div className="pb-pickhint" role="status">
      <Icon name="swap" size={16} />
      <span className="pb-pickhint__text"><b>{selection.title}</b>: {selection.text}</span>
      {pickedMan && <Button size="sm" variant="quiet" onClick={() => openPlayer(pickedMan.id, 'stats')}>Card</Button>}
      <Button size="sm" variant="quiet" onClick={clearPicks}>Cancel</Button>
    </div>
  );
  const auto = (): void => { autoLineup(); clearPicks(); setDealt(true); setDeal((n) => n + 1); };

  const pitchingAlert = team.team.rotation.some((p) => !available(p, clock))
    || (arms && team.team.bullpen.some((p) => returnPending(p, clock)));
  const benchHurt = team.team.bench.filter((p) => !available(p, clock)).length;

  const statCells = (p: Player): Array<{ label: string; value: string; title: string }> => {
    const line = season.batting.get(p.id);
    return [
      { label: 'AVG', title: 'Batting average', value: line && line.ab > 0 ? pct(battingAverage(line)) : '—' },
      { label: 'HR', title: 'Home runs', value: String(line?.hr ?? 0) },
      { label: 'RBI', title: 'Runs batted in', value: String(line?.rbi ?? 0) },
    ];
  };
  const trackRow = (p: Player) => (el: HTMLElement | null): void => {
    if (el) rowEls.current.set(String(p.id), el); else rowEls.current.delete(String(p.id));
    if (p.id === flaggedId) flagged.current = el;
  };
  const outBadge = (p: Player) => (available(p, clock) ? undefined
    : <StatusBadge tone="negative" icon="cross-circled">{sentence(whyOut(p, clock))}</StatusBadge>);

  /*
    Where a man stands against where he is at home: the same reading the
    order's warning line makes, so the field and the row never disagree.
  */
  const fit = (p: (typeof order)[number]) => {
    const home = (p as typeof p & { homePos?: Position }).homePos ?? p.pos;
    const asHome = home === p.pos ? p : { ...p, pos: home };
    const tier = coverTier(asHome, p.pos);
    const stuck = (p as typeof p & { stuck?: boolean }).stuck === true;
    return {
      tier, stuck,
      settling: tier === 0 && positionPenalty(p, p.pos) > 0,
      plays: overallOf(fieldingAt(asHome, p.pos)),
    };
  };

  // The nine on the field: his average under his name, or, playing out of
  // position, the rating he is worth where he stands.
  const fieldMen: FieldMan[] = order.map((p, i) => {
    const f = fit(p);
    const offPos = f.stuck || f.tier > 0;
    const bat = season.batting.get(p.id);
    return {
      id: String(p.id),
      name: p.name,
      pos: p.pos as Position,
      order: i + 1,
      line: offPos ? String(f.plays) : bat && bat.ab > 0 ? pct(battingAverage(bat)) : '—',
      out: !available(p, clock),
      offPos,
      guide: choosing === null && p.pos === 'CF' ? 'lineup-spot' : undefined,
      hold: holdStats(p.id),
    };
  });

  /*
    Everyone who could be sent to a position, for its picker: the nine and the
    bench, each with what his glove would be worth there (`gloveOf`, taxed for
    the spot), and at the DH his bat alone (`batScore`). Not the overall at
    the spot, which is mostly bat: it had a first baseman who has never caught
    out-scoring the catcher at catcher.
  */
  const pickerMen = (pos: Position): PickerMan[] => [
    ...order.map((p, i) => ({ p, where: `Batting ${ordinal(i + 1)} · ${p.pos}`, starting: true })),
    ...team.team.bench.map((p) => ({ p, where: 'Bench', starting: false })),
  ].map(({ p, where, starting }) => {
    const home = (p as typeof p & { homePos?: Position }).homePos ?? p.pos;
    const asHome = home === p.pos ? p : { ...p, pos: home };
    const bat = season.batting.get(p.id);
    return {
      id: String(p.id),
      name: shortName(p.name),
      team: team.def.abbr,
      where,
      avg: bat && bat.ab > 0 ? pct(battingAverage(bat)) : '—',
      rating: pos === 'DH' ? batScore(p as Hitter) : gloveOf({ ...fieldingAt(asHome, pos), pos }),
      tier: coverTier(asHome, pos),
      here: starting && p.pos === pos,
      out: available(p, clock) ? undefined : sentence(whyOut(p, clock)),
    };
  });
  const starter = tonightSlot === null ? null : team.team.rotation[tonightSlot] ?? null;
  const starterLine = starter ? season.pitching.get(starter.id) : undefined;
  const onMound = starter ? {
    name: starter.name,
    line: starterLine && starterLine.outs > 0 ? `${era(starterLine).toFixed(2)} ERA` : 'Tonight',
    out: !available(starter, clock),
  } : null;

  return (
    <>
      <main className="pb-page" ref={pageEl}>
        <FirstVisit id="lineup" />
        <Marquee
          eyebrow="Tonight's card"
          title="Lineup"
          trailing={mine ? (
            <Button
              size="sm"
              variant={dealt ? 'primary' : 'secondary'}
              icon={dealt ? 'check' : 'wand'}
              className={dealt ? 'pb-btn--done' : undefined}
              aria-live="polite"
              onClick={auto}
            >{dealt ? 'Lineup set' : 'Auto lineup'}</Button>
          ) : undefined}
        />
        {!mine && (
          <Callout tone="info" icon="wand" title="Your bench coach sets the lineup">
            Change it in Settings.
          </Callout>
        )}
        <SegmentedControl<'bat' | 'pitch'>
          label="Lineup part"
          className="pb-lineup-part"
          value={view}
          onChange={(v) => { clearPicks(); setView(v); }}
          options={[
            { value: 'bat', label: 'Batting order', badge: broken && mine ? true : undefined },
            { value: 'pitch', label: 'Pitching', badge: pitchingAlert ? true : undefined },
          ]}
        />


        {view === 'bat' && (
          <>
            <div className="pb-stack pb-lineup-scope">
              <LineupField
                className="pb-lineup-field"
                men={fieldMen}
                missing={gaps.missing as Position[]}
                spot={choosing?.pos ?? null}
                picked={picked !== null || pickedBench !== null ? pickedMan?.id ?? null : null}
                pitcher={onMound}
                interactive={mine}
                onSpot={(pos, from) => { if (consumed()) return; tapSpot(pos, from); }}
                onMan={(id) => { if (consumed()) return; openPlayer(id as PlayerId, 'stats'); }}
                onPitcher={() => { clearPicks(); setView('pitch'); }}
              />
              <List label="Batting order" key={`order-${deal}`}>
                {order.map((p, i) => {
                  const on = picked === i;
                  // The tour teaches the two-tap grammar by hand. Its position
                  // lesson lights a man inside the picker instead (lineup-assign).
                  const guide = picked === null
                    ? (i === 0 ? 'lineup-first' : undefined)
                    : (i === (picked === 0 ? 1 : 0) ? 'lineup-second' : undefined);
                  const { tier, stuck, settling, plays } = fit(p);
                  // One short line, so the row stays the height of its neighbours:
                  // the state and what he is worth where he stands.
                  const warning = stuck ? `Never took to ${p.pos} · ${plays}`
                    : settling ? `Settling in at ${p.pos}`
                      : tier > 0 ? `Out of position · ${plays}`
                        : undefined;
                  return (
                    <PlayerRow
                      key={p.id}
                      lead={i + 1}
                      name={shortName(p.name)}
                      avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
                      mark={captainId === p.id ? <Tag tone="positive" title="Team captain">Captain</Tag> : undefined}
                      tags={[
                        { text: p.pos, title: posName(p.pos) },
                        ...(isTwoWay(p) ? [{ text: 'Two-way', title: 'Also pitches' }] : []),
                      ]}
                      flags={outBadge(p)}
                      warning={warning}
                      stats={statCells(p)}
                      selected={on}
                      chevron={!mine}
                      guide={guide}
                      className={`${p.id === flaggedId ? 'is-flagged' : ''}${held(p.id)}`.trim() || undefined}
                      elRef={trackRow(p)}
                      buttonProps={holdStats(p.id)}
                      onClick={() => { if (consumed()) return; if (!mine) { openPlayer(p.id, 'stats'); return; } tap(i); }}
                    />
                  );
                })}
              </List>

            {mine && team.team.bench.filter((p) => returnPending(p, clock)).map((p) => (
              <Callout
                key={`return-${p.id}`}
                tone="info"
                icon="check-circled"
                title={`${p.name} is fit again`}
                action={{ label: 'Keep his replacement', variant: 'secondary', onClick: () => keepCover(p.id) }}
              >
                Put him back, or keep his replacement.
              </Callout>
            ))}

              <SectionHeader
                className="pb-lineup-next"
                title="Bench"
                count={`${team.team.bench.length - benchHurt} ready${benchHurt > 0 ? ` · ${benchHurt} out` : ''}`}
              />
              <List label="Bench">
                {team.team.bench.map((p) => {
                  const hurt = !available(p, clock);
                  return (
                    <PlayerRow
                      key={p.id}
                      name={shortName(p.name)}
                      avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
                      mark={captainId === p.id ? <Tag tone="positive" title="Team captain">Captain</Tag> : undefined}
                      tags={[{ text: p.pos, title: posName(p.pos) }]}
                      meta={`Rating ${overallOf(p)}`}
                      flags={outBadge(p)}
                      stats={statCells(p)}
                      selected={pickedBench === p.id}
                      chevron={!mine}
                      className={`${hurt ? 'is-unavailable' : ''}${p.id === flaggedId ? ' is-flagged' : ''}${held(p.id)}`}
                      elRef={trackRow(p)}
                      buttonProps={{ ...holdStats(p.id), 'aria-disabled': hurt || undefined }}
                      onClick={() => { if (consumed()) return; if (!mine) { openPlayer(p.id, 'stats'); return; } if (!hurt) tapBench(p.id); }}
                    />
                  );
                })}
              </List>
              {/* The card's warning rides in the pinned bar with the hint: it
                  used to appear over the order the moment a swap opened a
                  hole, and pushed every row down as it came. */}
              {(hint || (broken && mine)) && (
                <div className="pb-pickbar">
                  {broken && mine && (
                    <Callout
                      tone="warning"
                      className="pb-lineup-gap"
                      title={gaps.missing.length > 0
                        ? `Nobody at ${gaps.missing.map((p) => posName(p).toLowerCase()).join(', ')}`
                        : `Two players at ${[...new Set(gaps.doubled)].map((p) => posName(p).toLowerCase()).join(', ')}`}
                      action={{ label: 'Let auto fix it', variant: 'secondary', onClick: auto }}
                    >
                      The game can&rsquo;t start until every position is covered.
                    </Callout>
                  )}
                  {hint}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'pitch' && (
          <>
            <div className="pb-stack pb-lineup-scope">
              <SectionHeader
                title="Rotation"
                count={plural(team.team.rotation.length, 'starter')}
                description={team.team.rotationByHand ? 'Your order' : 'Tired starters are skipped'}
              />
              <List label="Rotation">
                {team.team.rotation.map((p, i) => {
                  const line = season.pitching.get(p.id);
                  const hurt = !available(p, clock);
                  const tonight = !hurt && tonightSlot === i;
                  const skipped = !hurt && nominalSlot === i && tonightSlot !== i;
                  const back = (() => {
                    const last = season.pitcherWorkload?.get(p.id);
                    return last ? Math.max(1, recoveryGap(last.pitches) - restDays(season, p, dayNow)) : 1;
                  })();
                  return (
                    <PlayerRow
                      key={p.id}
                      lead={<span className="pb-prow__day">{SLOT_WORD[slots[i] ?? 'DEPTH'] ?? slots[i]}</span>}
                      name={shortName(p.name)}
                      avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
                      mark={captainId === p.id ? <Tag tone="positive" title="Team captain">Captain</Tag> : undefined}
                      meta={`Rating ${armValue(p)}${line && line.outs > 0 ? ` · ${era(line).toFixed(2)} ERA` : ''}`}
                      flags={hurt ? outBadge(p)
                        : tonight ? <StatusBadge tone="info" icon="play">Starts tonight{shortRest(season, p, dayNow) ? ', on short rest' : ''}</StatusBadge>
                          : skipped ? <StatusBadge tone="warning" icon="clock">Resting · back in {plural(back, 'day')}</StatusBadge>
                            : undefined}
                      selected={pickedArm === i}
                      chevron={!arms}
                      className={`${hurt ? 'is-unavailable' : ''}${p.id === flaggedId ? ' is-flagged' : ''}`}
                      elRef={trackRow(p)}
                      buttonProps={holdStats(p.id)}
                      onClick={() => { if (consumed()) return; if (!arms) { openPlayer(p.id, 'stats'); return; } tapArm(i); }}
                    />
                  );
                })}
              </List>

            {arms && team.team.bullpen.filter((p) => returnPending(p, clock)).map((p) => (
              <Callout
                key={`return-arm-${p.id}`}
                tone="info"
                icon="check-circled"
                title={`${p.name} is ready to pitch again`}
                action={{ label: 'Keep his replacement', variant: 'secondary', onClick: () => keepCover(p.id) }}
              >
                Give him his start back, or keep his replacement.
              </Callout>
            ))}

              <SectionHeader
                className="pb-lineup-next"
                title="Bullpen"
                count={plural(team.team.bullpen.length, 'arm')}
                description={team.team.penByHand ? 'Your order · the top arm closes' : 'The freshest arm closes'}
              />
              <List label="Bullpen">
                {team.team.bullpen.map((p, idx) => {
                  const line = season.pitching.get(p.id);
                  const hurt = !available(p, clock);
                  const closer = closerTonight?.id === p.id;
                  return (
                    <PlayerRow
                      key={p.id}
                      lead={team.team.penByHand ? idx + 1 : undefined}
                      name={shortName(p.name)}
                      avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
                      mark={closer ? <Tag tone="positive" title="Pitches the ninth">Closer</Tag> : undefined}
                      meta={`Rating ${armValue(p)}${line && line.outs > 0 ? ` · ${era(line).toFixed(2)} ERA · ${Math.round(inningsPitched(line))} innings` : ''}`}
                      flags={outBadge(p)}
                      selected={pickedPen === p.id}
                      chevron={!arms}
                      className={`${hurt ? 'is-unavailable' : ''}${p.id === flaggedId ? ' is-flagged' : ''}`}
                      elRef={trackRow(p)}
                      buttonProps={{ ...holdStats(p.id), 'aria-disabled': hurt || undefined }}
                      onClick={() => { if (consumed()) return; if (!arms) { openPlayer(p.id, 'stats'); return; } if (!hurt) tapPen(p.id); }}
                    />
                  );
                })}
              </List>
              {hint && <div className="pb-pickbar">{hint}</div>}
            </div>
          </>
        )}

        {(() => {
          const hurt = uniquePlayers([
            ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
          ] as Player[]).filter((p) => !available(p, clock));
          if (hurt.length === 0) return null;
          return (
            <section className="pb-stack">
              <SectionHeader title="Out right now" count={hurt.length} />
              <List label="Out right now">
                {hurt.map((p) => (
                  <PlayerRow
                    key={p.id}
                    name={shortName(p.name)}
                    avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
                    tags={[{ text: p.type === 'pitcher' ? (p as Arm).role : (p as Hitter).pos }]}
                    flags={outBadge(p)}
                    onClick={() => openPlayer(p.id)}
                  />
                ))}
              </List>
            </section>
          );
        })()}
      </main>

      {choosing && (
        <PositionPicker
          pos={choosing.pos}
          from={choosing.from}
          men={pickerMen(choosing.pos)}
          onPick={(id) => { assignPosition(id as PlayerId, choosing.pos); }}
          onClose={() => setChoosing(null)}
        />
      )}

      {gapWarn && (
        <Modal
          kicker="The lineup"
          title={gapWarn.missing.length > 0
            ? `Nobody at ${gapWarn.missing.map((p) => posName(p).toLowerCase()).join(', ')}`
            : `Two players at ${gapWarn.doubled.map((p) => posName(p).toLowerCase()).join(', ')}`}
          lines={[
            gapWarn.missing.length > 0 && gapWarn.doubled.length > 0
              ? `Two players are at ${gapWarn.doubled.map((p) => posName(p).toLowerCase()).join(' and ')}, and nobody is at ${gapWarn.missing.map((p) => posName(p).toLowerCase()).join(' or ')}.`
              : gapWarn.missing.length > 0
                ? `Tonight's lineup covers eight positions; ${gapWarn.missing.map((p) => posName(p).toLowerCase()).join(' and ')} ${gapWarn.missing.length === 1 ? 'is' : 'are'} open.`
                : `Two players are playing ${gapWarn.doubled.map((p) => posName(p).toLowerCase()).join(' and ')}.`,
            'The game can’t start until every position is covered.',
          ]}
          action="Let auto fix it"
          onClose={() => {
            autoLineup();
            clearPicks();
            setDealt(true);
            setDeal((n) => n + 1);
            setGapWarn(null);
          }}
          cancel={{ label: 'I’ll fix it', onClick: () => setGapWarn(null) }}
        />
      )}
    </>
  );
}
