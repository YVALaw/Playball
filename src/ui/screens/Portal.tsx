// Portal.tsx
// Both directions, on one screen, kept apart.
//
// Leaving you: your own players with a foot out of the door, each with the
// reason he is going and the price of talking him round. Available: players
// from other schools you could sign, who can play right away. Both spend
// offseason points, the fund the draft also drew from, and each card shows the
// points before and after, so the choice is made on the number it costs.
// Keeping and signing are both two-press buttons; not enough points is a
// disabled button that says how many are missing.

import { Fragment, useState } from 'react';
import { FirstVisit } from '../Tutorial.js';
import { handles } from '../../state/depth.js';
import { flightRisk, mood } from '../../engine/morale.js';
import { sfx, buzz } from '../sound.js';
import { GodBolt } from '../god/GodBolt.js';
import { useDynasty } from '../../state/store.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { isTwoWay } from '../../engine/types.js';
import type { Hitter, Pitcher, Player, Position } from '../../engine/types.js';
import type { PortalMan } from '../../engine/portal.js';
import {
  Button, Card, CompareTable, ConfirmButton, EmptyState, Face, Marquee, PlayerRow, SectionHeader, SegmentedControl,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME, plural } from '../words.js';
import { ContinueBar, OffseasonPointsCard, StepScreen, useOffseasonPoints } from './OffseasonStep.js';

/**
 * What it takes to talk a player out of the portal: the engine's own
 * arithmetic (`makeTheCase`), his cost plus however far out of the door he
 * already is. Paying it keeps him; anything less does not.
 */
function keepCost(m: PortalMan): number {
  return Math.round(m.cost * (1 + flightRisk(m.player)));
}

function slotTag(p: Player): { text: string; title: string } {
  if (isTwoWay(p)) return { text: 'Two-way', title: 'Two-way player' };
  const code = p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);
  return { text: code, title: POSITION_NAME[code as Position] ?? code };
}

const MOOD_WORD: Record<ReturnType<typeof mood>, string> = {
  buzzing: 'Buzzing', fine: 'Content', restless: 'Restless', unhappy: 'Unhappy',
};

const PAGE = 25;

export function Portal() {
  const [view, setView] = useState<'leaving' | 'available'>('leaving');
  const [shown, setShown] = useState(PAGE);
  // Whether you shop the portal yourself; a delegated career's staff works it.
  const runsPortal = useDynasty((s) => handles(s.depth, 'portal'));
  const portal = useDynasty((s) => s.portal);
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const year = useDynasty((s) => s.year);
  const keepFromPortal = useDynasty((s) => s.keepFromPortal);
  const takeFromPortal = useDynasty((s) => s.takeFromPortal);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const version = useDynasty((s) => s.version);
  const pts = useOffseasonPoints();
  void version;

  const rec = season?.teams[userTeam];
  if (!portal || !rec || !pts) return null;

  const left = pts.left;
  const leavingCount = portal.leaving.length;
  // A delegated portal keeps the national pool for the other programs to
  // shop (H1); it is not this coach's list to show.
  const list = view === 'leaving' ? portal.leaving : runsPortal ? portal.available : [];
  /*
    Available: the men your points can pay for first, best first within
    each group, under a head that carries the points left.

    The pool is sorted by rating and paged at twenty five, and price follows
    rating, so a winter down to its last thirty points opened on twenty five
    men at forty and more, every button saying how many points were missing,
    with the thirty-nine it could afford behind "Show more". Reported
    2026-09-26: "when we spend points it keeps saying that we still have the
    same amount of points even tho we just spent them and it would not let us
    spend more". The total sat once at the top of a long page; now the number
    you are spending is right above the men it buys.
  */
  const within = view === 'available' ? list.filter((m) => m.cost <= left) : [];
  const beyond = view === 'available' ? list.filter((m) => m.cost > left) : [];
  const ordered = view === 'available' ? [...within, ...beyond] : list;
  const visible = view === 'available' ? ordered.slice(0, shown) : ordered;

  return (
    <StepScreen
      bar={(
        <ContinueBar
          from="portal"
          // Leaving is what releases anybody still in it; said before it happens.
          note={leavingCount > 0
            ? `${plural(leavingCount, 'player is', 'players are')} still in the portal. Moving on lets ${leavingCount === 1 ? 'him' : 'them'} go.`
            : undefined}
        />
      )}
    >
      <main className="pb-page">
        <FirstVisit id="portal" />
        <Marquee
          eyebrow={`${year} offseason · The portal`}
          title="Transfer portal"
          trailing={<GodBolt target={{ kind: 'portal' }} label="Sign from the portal for nothing, in god mode" />}
          numbers={[
            { label: 'Leaving you', value: leavingCount, tone: leavingCount > 0 ? 'warning' : undefined },
            { label: 'Available', value: runsPortal ? portal.available.length : 0 },
          ]}
        />
        <OffseasonPointsCard />
        <SegmentedControl<'leaving' | 'available'>
          label="Transfer portal"
          value={view}
          onChange={(v) => { setView(v); setShown(PAGE); }}
          options={[
            { value: 'leaving', label: 'Leaving you', badge: leavingCount || undefined },
            { value: 'available', label: 'Available', badge: (runsPortal && portal.available.length) || undefined },
          ]}
        />

        {visible.length === 0 ? (
          view === 'leaving'
            ? <EmptyState icon="check-circled" title="Nobody wants to leave" text="Not one of your players put his name in. That is what keeping your word looks like." />
            : runsPortal
              ? <EmptyState icon="search" title="Nobody available" text="No transfers are available right now." />
              : <EmptyState icon="person" title="Your staff is working it" text="In this career your staff handles the players coming in." />
        ) : visible.map((m, i) => (
          <Fragment key={m.player.id}>
            {view === 'available' && i === 0 && within.length > 0 && (
              <SectionHeader className="pb-portal-group" title={`Within your ${left} points`} count={within.length} />
            )}
            {view === 'available' && i === within.length && (
              <SectionHeader className="pb-portal-group" title="Out of reach" count={beyond.length} />
            )}
            <PortalCard
              m={m}
              mode={view}
              left={left}
              abbr={view === 'leaving' ? rec.def.abbr : undefined}
              onOpen={() => openPlayer(m.player.id)}
              onKeep={(cost) => keepFromPortal(m.player.id, cost)}
              onSign={() => takeFromPortal(m.player.id)}
            />
          </Fragment>
        ))}

        {view === 'available' && list.length > shown && (
          <Button variant="secondary" block icon="plus" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, list.length - shown)} more of {list.length}
          </Button>
        )}
      </main>
    </StepScreen>
  );
}

function PortalCard(
  { m, mode, left, abbr, onOpen, onKeep, onSign }:
  {
    m: PortalMan; mode: 'leaving' | 'available'; left: number; abbr?: string;
    onOpen: () => void; onKeep: (cost: number) => boolean; onSign: () => boolean;
  },
) {
  const p = m.player;
  const cost = mode === 'leaving' ? keepCost(m) : m.cost;
  const can = left >= cost;
  const settle = (ok: boolean): boolean => {
    if (ok) { sfx('clap', { gain: 0.4 }); buzz(20); } else buzz([30, 40, 30]);
    return ok;
  };
  return (
    <Card flush>
      <PlayerRow
        name={p.name}
        avatar={<Face id={p.id} team={abbr} size={44} />}
        tags={[slotTag(p), CLASS_NAME[p.classYear]]}
        meta={mode === 'leaving' ? `Mood: ${MOOD_WORD[mood(p)]}` : `From ${m.fromName}`}
        value={overallOf(p)}
        valueLabel="Rating"
        onClick={onOpen}
      />
      <div className="pb-pad">
        <p className="pb-text">
          {m.reason}
          {mode === 'available' ? ' He can play right away.' : ''}
        </p>
        <CompareTable
          label="Your offseason points"
          labelHeader="Offseason points"
          from="Now"
          to={mode === 'leaving' ? 'If you keep him' : 'If you sign him'}
          rows={[{ label: 'Left', now: left, next: left - cost, better: 'up' }]}
        />
        {can ? (
          <ConfirmButton
            block
            variant="primary"
            icon={mode === 'leaving' ? 'chat' : 'plus'}
            idle={mode === 'leaving' ? `Keep him · ${cost} points` : `Sign ${p.name} · ${cost} points`}
            armed={mode === 'leaving' ? 'Tap again to keep him' : 'Tap again to sign him'}
            armedMeta={`${left - cost} left after`}
            done={mode === 'leaving' ? 'He is staying' : 'Signed'}
            failed={mode === 'leaving' ? 'He went anyway' : 'Could not sign him'}
            onConfirm={() => settle(mode === 'leaving' ? onKeep(cost) : onSign())}
          />
        ) : (
          <Button block disabled>{cost - left} more points needed</Button>
        )}
        {mode === 'leaving' && (
          <p className="pb-note">Paying {cost} keeps him.</p>
        )}
      </div>
    </Card>
  );
}
