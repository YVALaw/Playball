// Captain.tsx
// Who wears the C, and why it is a decision rather than a formality.
//
// Reported after the first real play session: *"the button set captain in roster
// ... it should have its own screen with hints of whom should be the captain,
// the way we have it right now we don't really have an option to decide, it
// simply show us one person and that person is the one that gets selected. Not a
// real decision."*
//
// That was exactly right. The button went to the depth chart, which named the
// room's own choice at the top of a page about something else — so the one man
// the game suggested was the only man you ever saw, and picking him was the only
// thing the screen let you do.
//
// A decision needs more than one door and a reason to prefer one. So this screen
// shows every eligible man, says what each of them brings, says who the room
// would pick if nobody asked you, and lets you disagree. The engine's rules are
// unchanged: a freshman never leads, and a man without one of the three
// leadership badges is not on the list — those are the room's rules, not the
// screen's, and `appoint` enforces them whatever this page renders.

import { StarIcon } from '@radix-ui/react-icons';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Avatar } from '../Avatar.js';
import { BADGES, badgesOf } from '../../engine/badges.js';
import { candidates, captainOf, roomsChoice } from '../../engine/captains.js';
import { overallOf } from '../../engine/ratings.js';
import { mood } from '../../engine/morale.js';
import { FieldNote, ModuleIntro, SectionHeading } from '../components/Kit.js';
import type { Player, PlayerId } from '../../engine/types.js';

/** The three badges the room actually follows, in the words it uses for them. */
const LEADERSHIP = ['gymRat', 'noPanic', 'bigStage'];

/**
 * Why this man, in one line.
 *
 * Built from what he actually has rather than from a rating: the badges are the
 * reason he is eligible at all, so they are the reason to pick him. Seniority
 * and mood come after, because those are the two things that decide whether the
 * room listens when he speaks.
 */
function caseFor(p: Player): string {
  const held = badgesOf(p)
    .filter((b) => LEADERSHIP.includes(b.id))
    .map((b) => BADGES[b.id].label.toLowerCase());
  const year = p.classYear === 'SR' ? 'A senior'
    : p.classYear === 'JR' ? 'A junior' : 'A sophomore';
  const feeling = mood(p);
  const room = feeling === 'unhappy' ? ' He is unhappy, which the room will hear.'
    : feeling === 'restless' ? ' He is restless.'
      : feeling === 'buzzing' ? ' He is playing the best baseball of his life.' : '';
  return `${year} with ${held.length === 1 ? held[0] : held.join(' and ')}.${room}`;
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
    <main className="module-workspace">
      <ModuleIntro
        kicker="THE ROOM"
        title={current ? `${current.name} wears the C` : 'Nobody wears the C'}
        text="A captain does not make anybody better. He is the reason a bad April
          does not become a bad year — and who you pick is a decision the room
          will read either way."
      />

      {men.length === 0 ? (
        <section className="empty-state">
          <StarIcon />
          <h2>Nobody is ready</h2>
          <p>
            A freshman never leads a room, and neither does a man without one of
            the three badges that say he can. Recruit for it, or wait for
            somebody to earn one.
          </p>
        </section>
      ) : (
        <>
          {/*
            The room's own pick, said out loud rather than applied.

            Seniority first and ability second, because that is how a dressing
            room actually chooses. Showing it beside the list rather than at the
            top of it is what makes ignoring it a decision instead of an
            oversight.
          */}
          {suggested && (
            <FieldNote
              title={`The room would pick ${suggested.name}`}
              text={`${caseFor(suggested)} You do not have to agree — a captain the
                coach chose and the room did not is a different season from one
                they both wanted, and both of them happen.`}
            />
          )}

          <SectionHeading
            kicker="ELIGIBLE"
            title={men.length === 1 ? 'One man' : `${men.length} men`}
          />

          <section className="captain-list">
            {men.map((p) => {
              const isCurrent = current?.id === p.id;
              const isRoom = suggested?.id === p.id;
              return (
                <div className={isCurrent ? 'is-captain' : ''} key={p.id}>
                  <button
                    className="captain-man tap"
                    type="button"
                    onClick={() => openPlayer(p.id as PlayerId)}
                  >
                    <span className="portrait">
                      <Avatar id={p.id} team={team.def.abbr} size={34} />
                    </span>
                    <span>
                      <strong>
                        {p.name}
                        {isCurrent && <em>CAPTAIN</em>}
                        {!isCurrent && isRoom && <em className="room">THE ROOM</em>}
                      </strong>
                      <small>
                        {p.type === 'pitcher' ? p.role : p.pos} · {p.classYear}
                        {' · '}{overallOf(p)} OVR
                      </small>
                      <p>{caseFor(p)}</p>
                    </span>
                  </button>
                  <button
                    className="captain-pick tap"
                    type="button"
                    disabled={isCurrent}
                    onClick={() => nameCaptain(p.id as PlayerId)}
                  >{isCurrent ? 'He has it' : 'Give him the C'}</button>
                </div>
              );
            })}
          </section>

          {current && (
            <button
              className="secondary-command tap"
              type="button"
              onClick={() => clearCaptain()}
            >TAKE THE C OFF {current.name.toUpperCase()}</button>
          )}
        </>
      )}
    </main>
  );
}
