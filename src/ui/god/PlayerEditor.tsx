// god/PlayerEditor.tsx — one player, split into focused panels.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import {
  BADGE_IDS, RATING_LABEL, S_PLUS_POTENTIAL, findPlayer, isIronMan, isRedshirt, moodValue, ratingsOf,
} from '../../engine/godMode.js';
import { BADGES as PLAYER_BADGES, TIER_NAME } from '../../engine/badges.js';
import { daysLeft, isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import {
  isTwoWay,
  type BadgeId, type BadgeTier, type Bats, type ClassYear, type Hand, type Hitter, type Pitcher,
  type PitcherRole, type PlayerId, type Position,
} from '../../engine/types.js';
import { Button, Card, EmptyState, SegmentedControl, StatGroup, StatusBadge } from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME, conferenceName, plural } from '../words.js';
import { Choose, Field, GodPage, Slider, SureButton, Toast, Toggle, words } from './controls.js';

const POSITIONS: readonly Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const CLASSES: readonly ClassYear[] = ['FR', 'SO', 'JR', 'SR'];
type Panel = 'profile' | 'ratings' | 'status' | 'badges' | 'move';
const PANELS = [
  { value: 'profile', label: 'Profile' },
  { value: 'ratings', label: 'Ratings' },
  { value: 'status', label: 'Status' },
  { value: 'badges', label: 'Badges' },
  { value: 'move', label: 'Move' },
] as const;

export function PlayerEditor({ id }: { id: PlayerId }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const editPlayer = useDynasty((s) => s.godEditPlayer);
  const heal = useDynasty((s) => s.godHeal);
  const ironMan = useDynasty((s) => s.godIronMan);
  const movePlayer = useDynasty((s) => s.godMovePlayer);
  const cutPlayer = useDynasty((s) => s.godCutPlayer);
  const setMood = useDynasty((s) => s.godSetMood);
  const setRedshirt = useDynasty((s) => s.godSetRedshirt);
  const setAge = useDynasty((s) => s.godSetAge);
  const grantBadge = useDynasty((s) => s.godGrantBadge);
  const revokeBadge = useDynasty((s) => s.godRevokeBadge);
  const twoWay = useDynasty((s) => s.godTwoWay);
  const closeGod = useDynasty((s) => s.closeGod);
  const [panel, setPanel] = useState<Panel>('profile');
  const [moveTo, setMoveTo] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  void version;

  if (!season) return null;
  const found = findPlayer(season, id);
  if (!found) {
    return (
      <main className="pb-page">
        <EmptyState icon="person" title="He is no longer in the world" text="He was cut, or his playing days are over." />
      </main>
    );
  }
  const man = found.player;
  const record = found.team;
  const day = season.dayIndex;
  const hurtNow = isHurt(man, day);
  const moveTarget = moveTo >= 0 && moveTo !== record.index ? season.teams[moveTo] ?? null : null;
  const noRoom = `Nobody could take ${man.name}’s place. Add a hitter or a pitcher to that roster first.`;

  return (
    <GodPage
      eyebrow="God mode · Player"
      title={man.name}
      description={`${record.def.school} · ${conferenceName(record.conference)}`}
    >
      <StatGroup
        size="sm"
        items={[
          { label: 'Rating', value: overallOf(man), unit: '/100' },
          { label: 'Ceiling', value: potentialGrade(man.potential), note: `${Math.round(man.potential)} of 100` },
          { label: 'Health', value: hurtNow ? 'Hurt' : 'Fit', note: hurtNow ? `Out ${plural(daysLeft(man, day), 'more day')}` : undefined },
        ]}
      />

      <SegmentedControl<Panel> label="Player editor section" value={panel} onChange={setPanel} options={PANELS} />

      {panel === 'profile' && (
        <Card title="Profile">
          <Field label="Name" value={man.name} onCommit={(v) => editPlayer(man.id, { name: v })} />
          <div className="pb-fieldgrid">
            <Choose<ClassYear>
              label="Class"
              value={man.classYear}
              options={CLASSES.map((c) => ({ value: c, label: CLASS_NAME[c] }))}
              onChange={(v) => editPlayer(man.id, { classYear: v })}
            />
            {man.type !== 'pitcher' ? (
              <Choose<Position>
                label="Position"
                value={(man as Hitter).pos}
                options={POSITIONS.map((p) => ({ value: p, label: POSITION_NAME[p] }))}
                onChange={(v) => editPlayer(man.id, { pos: v })}
              />
            ) : (
              <Choose<PitcherRole>
                label="Role"
                value={(man as Pitcher).role}
                options={[{ value: 'SP', label: 'Starting pitcher' }, { value: 'RP', label: 'Relief pitcher' }]}
                onChange={(v) => editPlayer(man.id, { role: v })}
              />
            )}
            <Choose<Bats>
              label="Bats"
              value={man.bats}
              options={[{ value: 'R', label: 'Right' }, { value: 'L', label: 'Left' }, { value: 'S', label: 'Both' }]}
              onChange={(v) => editPlayer(man.id, { bats: v })}
            />
            <Choose<Hand>
              label="Throws"
              value={man.throws}
              options={[{ value: 'R', label: 'Right' }, { value: 'L', label: 'Left' }]}
              onChange={(v) => editPlayer(man.id, { throws: v })}
            />
          </div>
          <Slider
            label={`Potential · ceiling ${potentialGrade(man.potential)}`}
            value={man.potential}
            onCommit={(v) => editPlayer(man.id, { potential: v })}
            hint="How good he can become. S+ is a grade only god mode can give."
          />
          <div className="pb-buttons-2">
            <Button variant="secondary" onClick={() => editPlayer(man.id, { potential: S_PLUS_POTENTIAL })}>Make him an S+</Button>
            <Button
              variant="secondary"
              onClick={() => editPlayer(man.id, { ratings: Object.fromEntries(ratingsOf(man).map((k) => [k, 99])) })}
            >Every rating to 99</Button>
          </div>
        </Card>
      )}

      {panel === 'ratings' && (
        <Card title="Ratings" eyebrow="Only the ratings that apply to him">
          {ratingsOf(man).map((k) => (
            <Slider
              key={k}
              label={RATING_LABEL[k]}
              value={(man as unknown as Record<string, number>)[k] ?? 1}
              onCommit={(v) => editPlayer(man.id, { ratings: { [k]: v } })}
            />
          ))}
        </Card>
      )}

      {panel === 'status' && (
        <>
          <Card
            title="Health today"
            trailing={hurtNow ? <StatusBadge tone="negative">Hurt</StatusBadge> : <StatusBadge tone="positive">Fit</StatusBadge>}
          >
            <p className="pb-text-muted">{hurtNow ? `Out ${plural(daysLeft(man, day), 'more day')}.` : 'Ready to play.'}</p>
            <Button variant="secondary" block disabled={!hurtNow} onClick={() => { heal(man.id); setNote(`${man.name} is healed.`); }}>Heal him now</Button>
          </Card>
          <Toggle label="Iron man" on={isIronMan(man)} onChange={(on) => ironMan(man.id, on)} note="He never gets hurt." />
          <Toggle label="Redshirt" on={isRedshirt(man)} onChange={(on) => setRedshirt(man.id, on)} note="He sits the year and keeps it; his class does not move." />
          {man.type !== 'pitcher' && (
            <Toggle
              label="Two-way player"
              on={isTwoWay(man)}
              onChange={(on) => { if (twoWay(man.id, on)) setNote(on ? `${man.name} pitches too now.` : `${man.name} only hits again.`); }}
              note="A hitter given an arm and a place in the bullpen."
            />
          )}
          <Card title="Age and mood">
            <Slider label="Age" value={man.age} min={17} max={40} onCommit={(v) => setAge(man.id, v)} />
            <Slider label="Mood" value={moodValue(man)} min={0} max={100} onCommit={(v) => setMood(man.id, v)} hint="How happy he is with his role and the program." />
          </Card>
        </>
      )}

      {panel === 'badges' && (
        <Card title="Badges" eyebrow="None, bronze, silver or gold">
          <div className="pb-fieldgrid">
            {BADGE_IDS.map((bid: BadgeId) => {
              const held = man.badges?.find((b) => b.id === bid);
              const spec = PLAYER_BADGES[bid];
              return (
                <Choose<number>
                  key={bid}
                  label={spec.label}
                  value={held?.tier ?? 0}
                  options={[{ value: 0, label: 'None' }, ...([1, 2, 3] as const).map((t) => ({ value: t as number, label: words(TIER_NAME[t]) }))]}
                  onChange={(tier) => { if (tier === 0) revokeBadge(man.id, bid); else grantBadge(man.id, bid, tier as BadgeTier); }}
                />
              );
            })}
          </div>
        </Card>
      )}

      {panel === 'move' && (
        <Card title="Move or cut">
          <Choose<number>
            label="Move him to"
            value={moveTo}
            options={[
              { value: -1, label: 'Choose a program' },
              ...season.teams.filter((t) => t.index !== record.index)
                .map((t) => ({ value: t.index, label: `${t.def.school} · ${conferenceName(t.conference)}` })),
            ]}
            onChange={setMoveTo}
          />
          {/* A move or a cut is refused when nobody can take his spot; the
              editor says so rather than doing nothing (05 §62.4). */}
          <Button
            variant="secondary"
            block
            disabled={!moveTarget}
            onClick={() => {
              if (!moveTarget) return;
              if (movePlayer(man.id, moveTarget.index)) { setNote(`${man.name} is at ${moveTarget.def.school} now.`); setMoveTo(-1); }
              else setNote(noRoom);
            }}
          >{moveTarget ? `Move him to ${moveTarget.def.school}` : 'Move him'}</Button>
          <SureButton
            label="Cut him"
            armed="Tap again: he leaves the world"
            onSure={() => { if (cutPlayer(man.id)) closeGod(); else setNote(noRoom); }}
          />
          <p className="pb-note">Moved, he joins their bench or bullpen. Cut, he leaves the world.</p>
        </Card>
      )}

      <Toast note={note} />
    </GodPage>
  );
}
