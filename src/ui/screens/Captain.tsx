// Captain.tsx
// Who wears the C, and why it is a decision rather than a formality.
//
// Every eligible player is listed with the reason to pick him, the team's own
// choice is said out loud (seniority first, then ability) rather than applied,
// and you can disagree. The rules are the engine's and `appoint` enforces them
// whatever this page renders: a freshman never leads, and a player without
// one of the three leadership badges is not on the list.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { BADGES, badgesOf } from '../../engine/badges.js';
import { candidates, captainOf, roomsChoice } from '../../engine/captains.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { mood } from '../../engine/morale.js';
import type { Hitter, Pitcher, Player, PlayerId, Position } from '../../engine/types.js';
import {
  Button, ConfirmButton, EmptyState, Face, List, Marquee, PlayerRow, SectionHeader, StatusBadge, Tag,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME, capsWords } from '../words.js';

/** The three badges the team follows. */
const LEADERSHIP = ['gymRat', 'noPanic', 'bigStage'];

/** The position he plays, as a short tag with its full name on hover. */
const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);

/**
 * Why this man, in one line: the badges that make him eligible, then his mood,
 * which decides whether the room listens when he speaks.
 */
function caseFor(p: Player): string {
  const held = badgesOf(p)
    .filter((b) => LEADERSHIP.includes(b.id))
    .map((b) => capsWords(BADGES[b.id].label));
  const feeling = mood(p);
  const room = feeling === 'unhappy' ? ' · unhappy'
    : feeling === 'restless' ? ' · restless'
      : feeling === 'buzzing' ? ' · buzzing' : '';
  return `${held.join(', ')}${room}`;
}

export function Captain() {
  const team = useUserTeam();
  const version = useDynasty((s) => s.version);
  const nameCaptain = useDynasty((s) => s.nameCaptain);
  const clearCaptain = useDynasty((s) => s.clearCaptain);
  const openPlayer = useDynasty((s) => s.openPlayer);
  void version;

  if (!team) return null;

  const men = candidates(team.team);
  const current = captainOf(team.team);
  const suggested = roomsChoice(team.team);

  return (
    <main className="pb-page">
      <Marquee eyebrow="Who wears the C" title="Captain" />

      {men.length === 0 ? (
        <EmptyState
          icon="star"
          title="Nobody is ready yet"
          text="A sophomore or older with Gym rat, No panic or Big stage can wear it."
        />
      ) : (
        <section>
          <SectionHeader
            title="Who can wear the C"
            count={men.length}
            description={suggested ? `The team would pick ${suggested.name}` : undefined}
          />
          <List label="Captain candidates">
            {men.map((p) => {
              const isCurrent = current?.id === p.id;
              const isRoom = suggested?.id === p.id;
              const slot = slotOf(p);
              return (
                <div className="pb-candidate" key={p.id}>
                  <PlayerRow
                    name={p.name}
                    avatar={<Face id={p.id} team={team.def.abbr} size={40} />}
                    mark={isCurrent
                      ? <Tag tone="positive">Captain</Tag>
                      : isRoom ? <Tag tone="you" title="The one the players would pick">Team&rsquo;s pick</Tag> : undefined}
                    tags={[
                      { text: slot, title: POSITION_NAME[slot as Position] ?? slot },
                      CLASS_NAME[p.classYear],
                    ]}
                    meta={caseFor(p)}
                    value={overallOf(p)}
                    valueLabel="Rating"
                    onClick={() => openPlayer(p.id as PlayerId)}
                  />
                  <div className="pb-candidate__action">
                    {isCurrent ? (
                      <StatusBadge tone="positive" icon="star-filled">Wears the C</StatusBadge>
                    ) : current ? (
                      <ConfirmButton
                        size="sm"
                        variant="secondary"
                        icon="star"
                        idle="Make him captain"
                        armed="Tap again to hand him the C"
                        armedMeta={`${current.name} loses it`}
                        onConfirm={() => nameCaptain(p.id as PlayerId)}
                      />
                    ) : (
                      <Button size="sm" variant="primary" icon="star" onClick={() => nameCaptain(p.id as PlayerId)}>
                        Make him captain
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </List>
        </section>
      )}

      {current && (
        <ConfirmButton
          variant="secondary"
          block
          idle={`Take the C off ${current.name}`}
          armed="Tap again to take it off"
          armedMeta="The team goes without one"
          onConfirm={() => { clearCaptain(); }}
        />
      )}
    </main>
  );
}
