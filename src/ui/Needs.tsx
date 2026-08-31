// Needs.tsx
// The things waiting on you, in one place, on the screen you start from.
//
// ---------------------------------------------------------------------------
// Why this exists at all
// ---------------------------------------------------------------------------
//
// Reported after playing two seasons: *"the press thing … shouldn't simply
// appear all of a sudden. I'm thinking on removing the last games thingy in the
// home screen and change it for something like NEEDS YOU — these press
// conferences, injuries, things of this nature appear there."*
//
// That is a better piece of design than the one it replaces, and it is worth
// being clear about why rather than just doing as asked.
//
// The press room was built to interrupt. `App` returned it ahead of everything
// else with a comment defending the choice: put it in a tab and it becomes a
// thing you can walk away from. True — and the wrong trade. What actually
// happened is that a screen the player had not asked for replaced the screen he
// was on, in the middle of a season he was moving through at his own pace, and
// the only way to find out what it was about was to answer it. An interruption
// guarantees attention and destroys context, and this game is otherwise built
// entirely the other way: things happen, they are written down, you go and look.
//
// So the room stops being an ambush and becomes an errand. What keeps it from
// being ignored is not that it blocks the screen — it is that it sits at the top
// of the home page in red until it is dealt with, which is how everything else
// that matters in this game already works.
//
// ---------------------------------------------------------------------------
// Red means it is waiting on a decision only you can make
// ---------------------------------------------------------------------------
//
// Two severities, and the line between them is a real one rather than a sense
// of importance. `must` is a thing the game cannot do for you: a question only
// you can answer, a job only you can fill. Everything else is a thing you might
// want to look at and which resolves itself if you do not.
//
// A man's grades are not red. He is already sitting out — the decision was made
// for you by the registrar, and the chart has covered him. It is news.
//
// A man who is hurt *is* red, and only in a full career: that is the mode where
// the coach picks who plays, so an unavailable starter is a card you have not
// finished writing. In a casual career the bench coach writes the card and the
// same fact is not a decision at all, so it does not appear. Which is the depth
// mode rule stated exactly: the mode changes what the player is asked, never
// what the simulation does. Either way the man is hurt and either way somebody
// covers him.

import { ChevronRightIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { useDynasty, useUserTeam } from '../state/store.js';
import { handles } from '../state/depth.js';
import { startersFrom, available, squad, SPOTS } from '../engine/depthChart.js';
import { standing } from '../engine/eligibility.js';
import { captainOf, candidates } from '../engine/captains.js';
import type { Player } from '../engine/types.js';

/** One thing waiting on the coach. */
export interface Need {
  id: string;
  /** The line in the list, in the room's words. */
  title: string;
  /** One line under it, saying what happens if you go. */
  note: string;
  /** Red: a decision the game cannot make for you. See the header. */
  must: boolean;
  /** What the button says. */
  cta: string;
  go: () => void;
}

/**
 * Everything waiting, worst first.
 *
 * A hook rather than a pure function because the list is assembled out of store
 * state and store actions both, and the actions are the whole point — a need you
 * cannot act on from here is a notification, and this game has an inbox for
 * those.
 */
export function useNeeds(): Need[] {
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  const pendingPress = useDynasty((s) => s.pendingPress);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const depth = useDynasty((s) => s.depth);
  // Subscribed to deliberately: every one of these is read off mutable engine
  // objects, which do not change identity when they change. Without it the list
  // is correct once and then frozen.
  const version = useDynasty((s) => s.version);
  void version;

  const needs: Need[] = [];
  if (!team || !season) return needs;

  const day = season.dayIndex;

  /*
    The room. First, because it is the one thing here with a clock on it — a
    question about a game everybody has just watched stops being worth asking
    some weeks later.
  */
  if (pendingPress) {
    needs.push({
      id: 'press',
      title: 'The press are waiting',
      note: 'They want a word about what just happened. Nothing you say here is wrong.',
      must: true,
      cta: 'GO IN',
      go: () => openOverlay('press'),
    });
  }

  /*
    Men in your nine who cannot take the field.

    Full careers only — see the header. Counted off the same `startersFrom` the
    game itself uses, so this cannot disagree with who actually runs out.
  */
  if (handles(depth, 'lineups') || handles(depth, 'depthChart')) {
    const nine = startersFrom(team.team, day);
    const hurt: Player[] = [];
    for (const spot of SPOTS) {
      const man = nine[spot];
      if (man && !available(man, day)) hurt.push(man);
    }
    if (hurt.length > 0) {
      needs.push({
        id: 'hurt',
        title: hurt.length === 1
          ? `${hurt[0]!.name} cannot play`
          : `${hurt.length} of your nine cannot play`,
        note: 'He is still first on the chart at his spot. Move somebody up, or the '
          + 'next man covers as he is.',
        must: true,
        cta: 'THE DEPTH CHART',
        go: () => openOverlay('depth'),
      });
    }
  }

  /*
    Nobody wearing the C, when somebody could.

    A vacancy rather than a problem, so it is not red — but it is a job only the
    coach fills, and a season run without one is a season of swings nobody
    damped. Shown only while the room actually has a man in it who could do it;
    a roster with nobody eligible is not a thing anybody has failed to do.
  */
  if (handles(depth, 'captains') && !captainOf(team.team)) {
    const able = candidates(team.team);
    if (able.length > 0) {
      needs.push({
        id: 'captain',
        title: 'Nobody wears the C',
        note: (able.length === 1
          ? 'One man in this room has the makeup for it.'
          : `${able.length} men in this room have the makeup for it.`)
          + ' A captain stops a bad month becoming a bad year.',
        must: false,
        cta: 'NAME ONE',
        go: () => openOverlay('depth'),
      });
    }
  }

  /*
    The classroom. News rather than a decision — he is already sitting out — but
    it is the one piece of news with a thing you can do about it attached, and
    the conversations are limited so it is worth knowing they are there.
  */
  const trouble = squad(team.team).filter((p) => standing(p) === 'trouble');
  if (trouble.length > 0) {
    needs.push({
      id: 'grades',
      title: trouble.length === 1
        ? `${trouble[0]!.name} is failing`
        : `${trouble.length} men are failing`,
      note: 'Short of where he needs to be, and one bad week from missing a series. '
        + 'A word with him helps.',
      must: false,
      cta: 'THE ROSTER',
      go: () => openOverlay('depth'),
    });
  }

  return needs.sort((a, b) => Number(b.must) - Number(a.must));
}

/**
 * The panel.
 *
 * It renders nothing at all when there is nothing waiting, which is the correct
 * behaviour and worth saying out loud: an empty NEEDS YOU reading "nothing needs
 * you" is a row of furniture that trains the eye to skip the place where the
 * urgent things appear.
 */
export function NeedsYou() {
  const needs = useNeeds();
  const openOverlay = useDynasty((s) => s.openOverlay);
  if (needs.length === 0) return null;

  const musts = needs.filter((n) => n.must).length;

  return (
    <>
      <section className="dashboard-heading">
        <div>
          <small>AROUND THE CLUB</small>
          <h2>Needs your eye</h2>
        </div>
        <button type="button" onClick={() => openOverlay("inbox")}>
          Inbox <ChevronRightIcon />
        </button>
      </section>
      <section className="decision-stack">
        {needs.map((n, i) => (
          <button key={n.id} type="button" onClick={n.go}>
            {/*
              The number is the proposal's mark, and it earns the red it is
              already painted in: these are ordered, the ones that must be dealt
              with sort first, and the count in the mark is how many are ahead
              of this one. A must keeps the red; the rest of the stack is quiet.
            */}
            <span
              className="decision-mark"
              style={n.must ? undefined : { color: "var(--dim)" }}
            >{String(i + 1).padStart(2, "0")}</span>
            <span>
              <strong>{n.title}</strong>
              <small>{n.note}</small>
            </span>
            <ChevronRightIcon />
          </button>
        ))}
      </section>
      {musts > 0 && (
        <section className="field-note">
          <SewingPinIcon />
          <div>
            <strong>{musts} {musts === 1 ? "decision is" : "decisions are"} waiting on you</strong>
            <p>
              Marked in red above. Nothing stops until they are dealt with, but a
              week goes past either way.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
