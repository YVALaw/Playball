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
import { available, squad } from '../engine/depthChart.js';
import { standing, WORDS_A_SEASON } from '../engine/eligibility.js';
import { isHurt, prognosis } from '../engine/injury.js';
import { captainOf, candidates } from '../engine/captains.js';
import type { Player, Position } from '../engine/types.js';

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
/**
 * Why a man is unavailable, said the way each reason deserves.
 *
 * `prognosis` is the injury voice and says "fit" about everybody else, so a
 * rest and a suspension were both being reported as healthy on a card whose
 * whole point is that he cannot play.
 */
/**
 * Whether "is he going back in?" is still an open question for this man.
 *
 * Asked for as a hold: "use can not play until deciding if he is going back
 * to the lineup or not, that way we don't forget." True for a man healed
 * from an INJURY who is not in the nine and whose return was never settled —
 * and injuries only ever roll against the nine, so he was a displaced
 * starter by construction. The fortnight grace exists for saves from before
 * the rule: a man healed long ago with the cover still in is a decision the
 * coach already lived with, not a hold to spring on an old season. Inside a
 * live season the grace never triggers, because the hold stops the days.
 */
export function returnPending(man: Player, day: number): boolean {
  const u = man as Player & {
    outUntil?: number; why?: string; returnDecided?: number;
  };
  if (u.why !== 'injury' || u.outUntil === undefined) return false;
  if (day < u.outUntil) return false;
  if (u.returnDecided === u.outUntil) return false;
  return day - u.outUntil < 14;
}

export function whyOut(man: Player, day: number): string {
  const u = man as Player & { outUntil?: number; why?: string };
  if (u.why === 'injury') return prognosis(man, day);
  const back = typeof u.outUntil === 'number' ? u.outUntil - day : 0;
  if (u.why === 'academic') {
    return back > 1 ? `ineligible for ${back} more days` : 'ineligible today';
  }
  return back > 1 ? `resting, back in ${back} days` : 'resting today';
}

export function useNeeds(): Need[] {
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const wordsUsed = useDynasty((s) => s.wordsUsed);
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
    The press card that used to open this list is gone with the press room —
    "the press questions, we will remove that entirely." The header's history
    of how the room became an errand stays, because it is the argument for
    how everything else on this list still works.
  */

  /*
    Men in your nine who cannot take the field.

    Full careers only — see the header. Counted off the same `startersFrom` the
    game itself uses, so this cannot disagree with who actually runs out.
  */
  const nineIds = new Set(team.team.lineup.map((p) => p.id));
  const covered = new Set<string>();
  if (handles(depth, 'lineups') || handles(depth, 'depthChart')) {
    /*
      A hurt man still first on his spot's chart.

      This used to scan `startersFrom`'s nine — which FILTERS the
      unavailable, so the must could never fire and the chart quietly covered
      every injury. Reported: "when someone is hurt I don't want the chart to
      automatically cover him — we have to edit the lineup manually and it
      should be a requirement." The scan reads the top of each chart order
      instead: while the hurt man is penciled in, the day does not move.
      Promoting his cover on the chart is the manual act that clears it.
    */
    /*
      A hurt man in tonight's nine.

      Scanned off `team.lineup` — the array the engine actually fields —
      after the chart-top rule proved to be about a nine the game never
      played. Reported as Hans Hood "playing" with no stats: the chart said
      he was in, the lineup said otherwise, and the lineup was right. The
      day holds until the hurt man is swapped out BY HAND on the lineup.
    */
    for (let i = 0; i < team.team.lineup.length; i++) {
      const man = team.team.lineup[i]!;
      if (available(man, day)) continue;
      covered.add(man.id);
      needs.push({
        id: `cover-${man.id}`,
        title: `${man.name} cannot play`,
        /*
          Why he cannot go, in the words that fit the reason.

          This called `prognosis` for every unavailable man, and prognosis
          answers about INJURIES — it returns the literal word "fit" for
          anyone whose absence is anything else. So a rested regular and an
          ineligible one both produced a red card reading "cannot play —
          fit", on the most prominent surface in the game. Found in audit.
        */
        note: `Batting ${i + 1} in tonight's nine — ${whyOut(man, day)}. `
          + 'Nobody is moved for you — swap him out on the lineup.',
        must: true,
        cta: 'THE LINEUP',
        // The man rides along. Landing on twenty-three names with no idea which
        // one the card was about is the errand handed over without its subject.
        go: () => { useDynasty.getState().go('team', 'lineup', man.id); },
      });
    }

    /*
      And the man walking back in — a HOLD now, not a nudge. The first
      version was a soft three-day card that cleared itself, and the report
      that replaced it says why that was wrong: "add to needs you a
      confirmation when the injured player can get back to play — he can not
      play until deciding if he is going back to the lineup or not, that way
      we don't forget." Every route back into the nine settles it silently
      (see settleReturn); KEEP THE COVER on the lineup is the other answer.
    */
    for (const man of squad(team.team)) {
      if (nineIds.has(man.id) || !returnPending(man, day)) continue;
      needs.push({
        id: `back-${man.id}`,
        title: `${man.name} is fit — decide his return`,
        note: 'Healed, and the cover still has his spot. Nothing moves until '
          + 'you put him back in the nine or keep the cover. Settle it on the lineup.',
        must: true,
        cta: 'THE LINEUP',
        go: () => { useDynasty.getState().go('team', 'lineup', man.id); },
      });
    }
  }

  /*
    Every other hurt man, one card each. Reported: "injuries should be in
    needs as well — basically everything that affects the team gameplan has to
    be in needs you." Not red — the trainer owns the clock and the chart has
    covered him — but it is a fact about tonight's team you should not have to
    tour the roster to learn.
  */
  for (const man of squad(team.team)) {
    if (!isHurt(man, day) || nineIds.has(man.id) || covered.has(man.id)) continue;
    needs.push({
      id: `hurt-${man.id}`,
      title: `${man.name} is hurt`,
      note: `${prognosis(man, day)} The chart covers him while he heals.`,
      must: false,
      /*
        THE LINEUP, not HIS CARD.

        Asked for after playing against the iOS competition: tapping an injury
        should put you where the injury is dealt with. His card is the more
        informative screen and the less useful one — it tells you how long he is
        out, which the note above already said, and offers nothing to do about
        it. The lineup is where the hole gets covered, and he arrives on it
        marked so you can see which hole.
      */
      cta: 'THE LINEUP',
      go: () => { useDynasty.getState().go('team', 'lineup', man.id); },
    });
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
        go: () => openOverlay('captain'),
      });
    }
  }

  /*
    The classroom. News rather than a decision — he is already sitting out — but
    it is the one piece of news with a thing you can do about it attached, and
    the conversations are limited so it is worth knowing they are there.
  */
  /*
    One card per man, not a headcount. Reported: "players failing should be
    shown one by one in needs, not like 3 players failing, cause that way it
    will only target one player directly." Each card opens its own man.
  */
  const wordsLeft = WORDS_A_SEASON - wordsUsed;
  for (const man of squad(team.team).filter((p) => standing(p) === 'trouble')) {
    needs.push({
      id: `grades-${man.id}`,
      title: `${man.name} is failing`,
      note: wordsLeft > 0
        ? 'Short of where he needs to be, and one bad week from missing a series. '
          + 'Have a word with him before tonight.'
        : 'Short of where he needs to be, and you are out of conversations this '
          + 'season. He works it out or he sits.',
      must: wordsLeft > 0,
      cta: 'HIS CARD',
      go: () => {
        openPlayer(man.id);
        // First time only, and only while there is a word to have: light the
        // path (action button, SCHOOL, HAVE A WORD) instead of leaving the
        // player on a card with no idea what to do. The stamp is written when
        // the word lands, not here — abandoning the errand keeps the lesson.
        const st = useDynasty.getState();
        if (wordsLeft > 0 && !st.seenTutorials.includes('guide:word')) {
          st.startGuide('word');
        }
      },
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
              Marked in red above. The day holds until they are dealt with.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
