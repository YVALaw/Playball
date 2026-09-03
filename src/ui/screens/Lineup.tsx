// Lineup.tsx
// The first screen where you are coaching rather than reading.
//
// Both of these are real: the engine reads `team.lineup` for the batting order
// and `team.rotation` for who takes the ball, so a change here changes what
// happens on the field. Positions print as baseball abbreviations — C, SS, CF —
// the same vocabulary every other screen speaks.
//
// The proposal's lineup, and the best idea in the whole of it: the diamond rail
// down the right edge. Nine positions as rotated squares, and tapping one is
// how you ask "who is my centre fielder" without leaving the batting order.
//
// Two of the proposal's details are deliberately not here, and both were
// settled by playtesting before the port started.
//
// The drag handle is gone. The row's tap is how you move the batting order —
// pick one, pick another, they swap — and a second meaning on the same target
// makes both unreliable. Reported from testing: "in lineup the players should
// not open their profile since we have to tap one and tap another to actually
// move the lineup around." The chevron into the player card went with it, for
// the same reason.
//
// So the row keeps the proposal's anatomy — order number, portrait, name, three
// rating meters — and loses the two controls that would fight the gesture. The
// `.drag` cell stays in the grid as the selection mark, which is the one thing
// a two-tap swap genuinely needs and the proposal had nowhere to put.

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ReloadIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Avatar } from '../Avatar.js';
import { FirstVisit } from '../Tutorial.js';
import { returnPending, whyOut } from '../Needs.js';
import { Modal } from '../Modal.js';
import { overallOf } from '../../engine/ratings.js';
import { captainOf } from '../../engine/captains.js';
import { battingAverage, era, inningsPitched } from '../../engine/season.js';
import { handles } from '../../state/depth.js';
import { available, cardGaps } from '../../engine/depthChart.js';
import type { PlayerId, Position } from '../../engine/types.js';
import { CaptainC, DidButton, FieldNote, ModuleIntro, Rating, SectionHeading } from '../components/Kit.js';
import type { Hitter } from '../../engine/types.js';

/** Friday, Saturday, Sunday, then the midweek arm. */
const SLOTS = ['FRI', 'SAT', 'SUN', 'MID'];

/** The rail, in the order the proposal draws it: outfield down to the plate. */
const POSITIONS = ['CF', 'RF', 'LF', '2B', 'SS', '3B', '1B', 'C', 'DH'] as const;

export function Lineup() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const swapLineup = useDynasty((s) => s.swapLineup);
  /*
    Whether this card is yours to write.

    Found in audit: nothing on this screen ever asked. A casual coach could
    reorder his nine, watch the button flip to "Order dealt", read "Saved as
    you go" underneath — and then his own bench coach overwrote the card on
    the next sim, because `staffSetsTheCard` runs before every day, every
    week and every managed game he does not set himself. The screen was
    promising something the game undid a tap later, which is worse than not
    offering it.
  */
  const mine = useDynasty((s) => handles(s.depth, 'lineups'));
  const swapStarter = useDynasty((s) => s.swapStarter);
  const assignPosition = useDynasty((s) => s.assignPosition);
  const moveRotation = useDynasty((s) => s.moveRotation);
  const autoLineup = useDynasty((s) => s.autoLineup);
  const keepCover = useDynasty((s) => s.keepCover);
  const team = useUserTeam();
  const [picked, setPicked] = useState<number | null>(null);
  /** Same two-tap swap, for the rotation. */
  const [pickedArm, setPickedArm] = useState<number | null>(null);
  const [pickedBench, setPickedBench] = useState<PlayerId | null>(null);
  const [dealt, setDealt] = useState(false);
  /** Bumped on every auto-deal, so the list re-keys and animates in. */
  const [deal, setDeal] = useState(0);
  /** Which spot on the field the rail is asking about. */
  const [spot, setSpot] = useState<Position | null>(null);

  /*
    The man NEEDS YOU sent you here about.

    Asked for after playing the iOS competition: tapping an injury should land
    on the lineup with the injured man showing, not on a screen of twenty-three
    names that looks exactly as it did before you tapped. `focusPlayer` is set
    by `go` and is deliberately not in the save — see the store.

    Taken into local state on arrival and handed straight back, rather than read
    off the store for the life of the screen. Two reasons, one of them learned
    the hard way:

    The store's copy is the errand — one delivery — so consuming it immediately
    means the mark cannot come back later because something else re-rendered.
    The screen's copy is the mark, and it lasts exactly as long as the visit,
    because the frame remounts this component on every navigation.

    And the version this replaced returned `clearFocusPlayer` as the effect's
    cleanup, which `StrictMode` calls on its synthetic unmount the instant the
    screen mounts. The focus was gone before the first paint and the row was
    never marked at all. Both effects here are idempotent, so running them twice
    is the same as running them once.

    Up here with the rest of the hooks rather than beside the code that uses it:
    the two returns below are conditional and hooks are not.
  */
  const focus = useDynasty((s) => s.focusPlayer);
  const clearFocus = useDynasty((s) => s.clearFocusPlayer);
  const [flaggedId, setFlaggedId] = useState<string | null>(null);
  const flagged = useRef<HTMLButtonElement | null>(null);

  /*
    The card warned about, never corrected.

    A manual start stopped relabelling anybody — asked for in exactly these
    words: "I don't want them to be automatically assigned, the automation is
    only if I tap on auto lineup. If I do it manually and don't change the
    position, you should simply issue a modal warning letting the user know,
    for example, you are missing X position or you have two players in the
    same position." So after any manual move the set is read, and a broken one
    gets this modal — once per breakage, not once per render.
  */
  const [gapWarn, setGapWarn] = useState<{ missing: string[]; doubled: string[] } | null>(null);
  const warnIfBroken = (): void => {
    const t = useDynasty.getState().season?.teams[useDynasty.getState().userTeam]?.team;
    if (!t) return;
    const gaps = cardGaps(t.lineup);
    // Deduped for the sentence: three catchers is still "two men at C" to a
    // reader, not "at C and C".
    if (gaps.missing.length > 0 || gaps.doubled.length > 0) {
      setGapWarn({ missing: gaps.missing, doubled: [...new Set(gaps.doubled)] });
    }
  };

  useEffect(() => {
    if (!focus) return;
    setFlaggedId(focus);
    clearFocus();
  }, [focus, clearFocus]);

  /*
    Then put him where he can be seen. A mark below the fold is a mark nobody
    saw, and the bench sits a long way down this screen. `block: 'center'`
    rather than the default, which parks him under the sticky toolbar.
  */
  useEffect(() => {
    if (!flaggedId) return;
    flagged.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [flaggedId]);

  void version;

  if (!season || !team) return null;

  const order = team.team.lineup;

  // The fourth starter only pitches non-conference games, so his innings are a
  // quick read on whether that slot is carrying real work.
  const midweekArm = team.team.rotation[3];
  const midweekLine = midweekArm ? season.pitching.get(midweekArm.id) : undefined;
  const midweekInnings = midweekLine ? inningsPitched(midweekLine) : 0;

  const tap = (i: number): void => {
    setPickedArm(null);
    /*
      A position on the rail was picked first: this tap assigns the man to
      that spot rather than starting an order swap. Asked for exactly this
      way — "when you press on one and then press on the player, the player
      is assigned to that position... in case someone gets injured and you
      want your next best player here instead of the one suggested by the
      engine." The rail used to only mark; now marking is what a lone tap
      does, and a second tap on a man is the appointment.
    */
    if (spot !== null) {
      const man = order[i];
      if (man) assignPosition(man.id, spot);
      setSpot(null);
      setPicked(null);
      return;
    }
    // A bench man was picked first: he takes this batting slot, and the man
    // in it walks to the bench. The other order of the same two taps below.
    if (pickedBench !== null) {
      swapStarter(i, pickedBench);
      warnIfBroken();
      setPickedBench(null);
      setPicked(null);
      return;
    }
    if (picked === null) { setPicked(i); return; }
    if (picked === i) { setPicked(null); return; }
    swapLineup(picked, i);
    setPicked(null);
  };

  /*
    The bench joins the same two-tap grammar. Reported, twice over: "he didn't
    appear in the lineup to be selected since he is on the bench... we should
    be able to pick whoever we want to start" — and behind it, the discovery
    that the depth chart's nine was one no game ever fielded. `team.lineup`
    is the truth, so starting a man is: tap his spot, tap him. Or tap him,
    then the spot.
  */
  const tapBench = (id: PlayerId): void => {
    setPickedArm(null);
    // The rail grammar reaches the bench too: spot then man, and he comes in
    // at that spot for whoever held it. Refused (and the spot kept armed) if
    // he cannot play today, so the note can say why nothing happened.
    if (spot !== null) {
      const ok = assignPosition(id, spot);
      if (ok) setSpot(null);
      setPickedBench(null);
      setPicked(null);
      return;
    }
    if (picked !== null) {
      swapStarter(picked, id);
      warnIfBroken();
      setPicked(null);
      setPickedBench(null);
      return;
    }
    setPickedBench(pickedBench === id ? null : id);
  };

  /*
    The rotation moves the way the batting order moves: tap one, tap the other.

    It shipped as a chevron that walked a man down one slot per press, and the
    report was blunt — "the pitchers rotation is not clear as to how to handle
    it, simply keep it as the batters lineup." One gesture for every reorder on
    the screen, and moveRotation(i, j - i) is already an arbitrary swap. Picking
    a batter clears a picked arm and the other way round, so two half-finished
    swaps cannot coexist.
  */
  const tapArm = (i: number): void => {
    setPicked(null);
    if (pickedArm === null) { setPickedArm(i); return; }
    if (pickedArm === i) { setPickedArm(null); return; }
    moveRotation(pickedArm, i - pickedArm);
    setPickedArm(null);
  };

  /*
    What the rail is pointing at.

    Tapping CF does not filter the list — the batting order is nine men in an
    order and hiding eight of them would break the thing this screen is for. It
    marks the row instead, and says who it is underneath, which is the question
    the rail is actually asking.
  */
  const atSpot = spot === null ? -1 : order.findIndex((p) => p.pos === spot);
  const manAtSpot = atSpot >= 0 ? order[atSpot] : null;

  const benchMan = pickedBench !== null
    ? team.team.bench.find((p) => p.id === pickedBench) ?? null : null;
  const note = benchMan
    ? `Now tap the spot ${benchMan.name} takes in the nine.`
    : picked !== null
    ? `Tap a spot to swap the order — or a bench man to start him instead of ${order[picked]?.name ?? ''}.`
    : pickedArm !== null
      ? `Now tap the day for ${team.team.rotation[pickedArm]?.name ?? ''} to take.`
    : spot !== null
      ? manAtSpot
        ? `${manAtSpot.name} is at ${spot}, batting ${atSpot + 1}. Tap a man to put him there instead.`
        : `Nobody in tonight's nine is at ${spot}. Tap a man to put him there.`
      : dealt
        ? 'Order dealt. Tap two spots to fine-tune it.'
        : 'Tap two spots to swap them.';

  return (
    <>
      <main className="lineup-workspace">
        <ModuleIntro
          kicker="TEAM · LINEUP"
          title="Starting nine"
          text="Set the batting order, the field, and the rotation for tonight."
        />

        <section className="editor-toolbar">
          {/* One tap deals a sound order — best hitter third, power fourth, the
              table-setters ahead of them. Same nine men, and every swap below
              still works afterwards: AUTO is a starting point. */}
          {/*
            Reported: "when clicking on set lineup automatically there is not a
            visual confirmation that it happened." It reordered nine rows and
            said nothing — and if you had not memorised the old order, nothing on
            screen had visibly changed. The button reports, the note under it
            reports, and the rows themselves arrive with the card animation so
            the list is visibly re-dealt.
          */}
          {/* This is where `DidButton` came from, so it goes back onto it: the
              report was hand-rolled here and the same idea was owed to half the
              actions in the game. */}
          <DidButton
            idle="Auto lineup"
            done="Order dealt"
            icon={<ReloadIcon />}
            doneIcon={<CheckIcon />}
            onPress={() => { autoLineup(); setPicked(null); setDealt(true); setDeal((n) => n + 1); }}
          />
          {/*
            No save button, and that is not an omission.

            The proposal has one because a prototype has nowhere to put a
            change. Here `swapLineup` writes straight to the team the engine
            reads, and the save is debounced behind it — a SAVE that confirmed
            something already true would be theatre, and worse, it would imply
            an unsaved state that can be lost.
          */}
          <span className="saved-mark">
            <CheckIcon /> {mine ? 'Saved as you go' : 'Your bench coach writes this'}
          </span>
        </section>

        <p className="selection-note"><SewingPinIcon /> {note}</p>

        {/*
          Whose card this is, said once, where the promise used to be.

          A casual coach's edits were accepted and then overwritten by his own
          staff before the next pitch — the screen showed "Order dealt" for a
          card the game was about to rewrite. It says so now, and points at
          the one switch that changes it.
        */}
        {!mine && (
          <FieldNote
            title="Your bench coach writes the card"
            text="You can move anybody here to see what he would do differently, but
              the staff set the nine before every game. Settings, then What you
              handle, hands the lineup back."
          />
        )}

        {/*
          The order and the field, side by side.

          The rail used to be positioned against the whole screen and spaced
          with `space-between`, so its nine diamonds were spread down the
          workspace rather than beside the nine men — the last one sat level with
          the rotation list. As a column of the same grid it shares the table's
          rows, so CF is beside whoever is batting first and DH beside whoever is
          batting ninth, which is the entire point of putting it there.
        */}
        <div className="lineup-body">
        <section className="lineup-table" key={deal}>
          {order.map((p, i) => {
            const line = season.batting.get(p.id);
            const on = picked === i;
            const marked = i === atSpot;
            return (
              <button
                className={`player-row card-in${on || marked ? ' is-selected' : ''}`
                  + (p.id === flaggedId ? ' is-flagged' : '')}
                ref={p.id === flaggedId ? flagged : undefined}
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => tap(i)}
              >
                {/* Where the proposal's drag handle sat. It is the swap mark
                    now: the first tap lights it, the second completes. */}
                <span className="drag">{on ? <SewingPinIcon /> : null}</span>
                <span className="order">{i + 1}</span>
                <span className="portrait">
                  <Avatar id={p.id} team={team.def.abbr} size={30} />
                </span>
                <span className="player-name">
                  <strong>
                    {p.name}
                    {captainOf(team.team)?.id === p.id && <CaptainC />}
                  </strong>
                  <small>
                    {p.pos} · Bats {p.bats} · {overallOf(p)} OVR
                    {line && line.ab > 0
                      ? ` · ${battingAverage(line).toFixed(3).replace(/^0/, '')}`
                      : ''}
                  </small>
                  {/* Why he is not playing tonight, on the row itself — asked
                      for plainly: "the needs you needs to always tell you why
                      the player isn't playing tonight." The card up on the
                      desk says it too, but the lineup is where the errand
                      lands, and a red row that will not explain itself sends
                      you back a screen to find out. */}
                  {!available(p, season.dayIndex) && (
                    <small className="row-why">✚ {whyOut(p, season.dayIndex)}</small>
                  )}
                </span>
                <Rating label="CON" value={(p as Hitter).contact} />
                <Rating label="POW" value={(p as Hitter).power} />
                <Rating label="DEF" value={(p as Hitter).range} />
                <span className="row-chevron" />
              </button>
            );
          })}
        </section>

        {/*
          The diamond rail. Nine spots down the right edge, each a square turned
          forty-five degrees, which is the shape of a base and reads as the field
          rather than as a list of two-letter codes.
        */}
        <aside className="position-rail" aria-label="Field positions">
          {POSITIONS.map((item) => (
            <button
              className={spot === item ? 'active' : ''}
              key={item}
              type="button"
              aria-pressed={spot === item}
              aria-label={`Show who is at ${item}`}
              onClick={() => setSpot(spot === item ? null : item)}
            ><span><i>{item}</i></span></button>
          ))}
        </aside>
        </div>

        <SectionHeading kicker="THE BENCH" title="Everyone else" />
        {/* The healed-return hold's other answer. Swapping him in settles the
            question by itself; this button is how the coach says "the cover
            keeps the spot" — and until one of the two happens, NEEDS YOU
            holds the day. Full careers only, the same rule as the card. */}
        {mine && team.team.bench.filter((p) => returnPending(p, season.dayIndex)).map((p) => (
          <div key={`return-${p.id}`} className="return-strip">
            <div>
              <strong>{p.name} is fit again.</strong>
              <span>Swap him back in — or keep the cover. The day holds until you choose.</span>
            </div>
            <button type="button" className="tap" onClick={() => keepCover(p.id)}>
              KEEP THE COVER
            </button>
          </div>
        ))}
        <section className="lineup-bench">
          {team.team.bench.map((p) => {
            const hurt = !available(p, season.dayIndex);
            const on = pickedBench === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`player-row${on ? ' is-selected' : ''}`
                  + (p.id === flaggedId ? ' is-flagged' : '')}
                ref={p.id === flaggedId ? flagged : undefined}
                disabled={hurt}
                aria-pressed={on}
                onClick={() => tapBench(p.id)}
              >
                <span className="drag">{on ? <SewingPinIcon /> : null}</span>
                <span className="portrait">
                  <Avatar id={p.id} team={team.def.abbr} size={30} />
                </span>
                <span className="player-name">
                  <strong>
                    {p.name}
                    {captainOf(team.team)?.id === p.id && <CaptainC />}
                  </strong>
                  <small>
                    {p.pos} · Bats {p.bats} · {overallOf(p)} OVR
                    {/* The reason, not just the fact — same report as the
                        order above. */}
                    {hurt && <b className="bench-out"> · ✚ {whyOut(p, season.dayIndex)}</b>}
                  </small>
                </span>
                <Rating label="CON" value={(p as Hitter).contact} />
                <Rating label="POW" value={(p as Hitter).power} />
                <Rating label="DEF" value={(p as Hitter).range} />
                <span className="row-chevron" />
              </button>
            );
          })}
        </section>

        <SectionHeading kicker="ROTATION" title="Who takes the ball" />
        <section className="rotation-list">
          {team.team.rotation.map((p, i) => {
            const line = season.pitching.get(p.id);
            const on = pickedArm === i;
            return (
              <button
                className={on ? 'is-selected' : ''}
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => tapArm(i)}
              >
                <span>{SLOTS[i]}</span>
                <strong>
                  {p.name}
                  {captainOf(team.team)?.id === p.id && <CaptainC />}
                </strong>
                <small>
                  {overallOf(p)} OVR
                  {line && line.outs > 0 ? ` · ${era(line).toFixed(2)}` : ''}
                </small>
                <i className="drag">{on ? <SewingPinIcon /> : null}</i>
              </button>
            );
          })}
        </section>
        <p className="selection-note">
          <SewingPinIcon /> Your Friday arm starts the opener of every conference
          series. The midweek starter takes all twelve non-conference
          games — {midweekInnings.toFixed(0)} innings so far.
        </p>

        {/* The pen, most rested arms doing most of the work. Read-only here —
            who comes in is a game-night decision, made from the BULLPEN button
            on the manage screen — but the rotation's other half belongs on the
            same screen as the rotation. */}
        <SectionHeading kicker="THE BULLPEN" title="The rest of the staff" />
        <section className="rotation-list">
          {team.team.bullpen.map((p) => {
            const line = season.pitching.get(p.id);
            const ip = line ? inningsPitched(line) : 0;
            return (
              <div key={p.id}>
                <span>{p.role}</span>
                <strong>{p.name}</strong>
                <small>
                  {overallOf(p)} OVR
                  {line && line.outs > 0
                    ? ` · ${era(line).toFixed(2)} · ${ip.toFixed(0)} IP`
                    : ''}
                </small>
                <span />
              </div>
            );
          })}
        </section>

        <FirstVisit id="lineup" />
      </main>

      {/* The warning the manual rule earns. It announces and corrects nothing:
          the rail or AUTO is how the coach answers it, on purpose. */}
      {gapWarn && (
        <Modal
          kicker="THE CARD"
          title={gapWarn.missing.length > 0
            ? `Nobody at ${gapWarn.missing.join(', ')}`
            : `Two men at ${gapWarn.doubled.join(', ')}`}
          lines={[
            gapWarn.missing.length > 0 && gapWarn.doubled.length > 0
              ? `You have two men at ${gapWarn.doubled.join(' and ')} and nobody at ${gapWarn.missing.join(' or ')}.`
              : gapWarn.missing.length > 0
                ? `Tonight's nine covers eight spots. ${gapWarn.missing.join(' and ')} ${gapWarn.missing.length === 1 ? 'is' : 'are'} open.`
                : `Two men are wearing ${gapWarn.doubled.join(' and ')}.`,
            'Nothing is moved for you. Use the rail to put a man on the open spot, or AUTO to let the bench coach sort the whole card.',
          ]}
          action="GOT IT"
          onClose={() => setGapWarn(null)}
        />
      )}
    </>
  );
}
