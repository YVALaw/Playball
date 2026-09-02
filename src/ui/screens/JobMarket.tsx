// JobMarket.tsx
// The screen for a university calling about a job — asked for by name.
//
// Offers used to render as a list buried on the program board, where a tap on
// the row WAS the acceptance: one loose thumb on a scrolling screen and you
// coached somewhere else. This is the mockup's job market instead — every
// offer a row you can open and read before anything is signed, and signing a
// two-press act with the second press saying exactly what it does.
//
// The rows the career watches come along: TRACK JOB PATH on a college profile
// stars its chair here, and the chairs you watch are listed even while they
// are not calling, so the screen answers "where is my career pointed" and not
// only "who wants me this week".

import { useState } from 'react';
import { ChevronRightIcon, StarIcon, StarFilledIcon } from '@radix-ui/react-icons';
import { useDynasty } from '../../state/store.js';
import { useOpenTeam } from './TeamCard.js';
import { Crest } from '../Crest.js';
import { Confirmable, FieldNote, ModuleIntro, SectionHeading } from '../components/Kit.js';
import { prestigeStars } from '../../engine/program.js';

export function JobMarket() {
  const season = useDynasty((s) => s.season);
  const offers = useDynasty((s) => s.offers);
  const watch = useDynasty((s) => s.watch);
  const acceptOffer = useDynasty((s) => s.acceptOffer);
  const fired = useDynasty((s) => s.jobSearch);
  const coach = useDynasty((s) => s.coach);
  const openTeam = useOpenTeam();
  /*
    Accepting is one of two irreversible acts in the game (the other starts a
    season), so the button asks twice: the first press arms it, the second
    signs, and tapping anywhere else stands it down.

    That last clause used to be written here and not implemented anywhere — an
    offer armed by a stray thumb stayed armed until the next press, which took
    the job. It is real now, and it lives in `Confirmable` with the rest of the
    grammar rather than in this file. See Kit.tsx.
  */

  if (!season) return null;

  // Chairs your career points at, called or not. Starred, and sorted first.
  const starred = new Set(watch.jobs);
  const abbrOf = (team: number): string => season.teams[team]?.def.abbr ?? '';
  const calling = [...offers].sort((a, b) =>
    Number(starred.has(abbrOf(b.team))) - Number(starred.has(abbrOf(a.team))));
  const watchedIdle = watch.jobs
    .filter((abbr) => !offers.some((o) => abbrOf(o.team) === abbr))
    .map((abbr) => season.teams.find((t) => t.def.abbr === abbr))
    .filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker={`${offers.length} OPEN ${offers.length === 1 ? 'CHAIR' : 'CHAIRS'}`}
        title="The market"
        text="Every offer changes prestige, expectations, pipeline, and the shape of
          your next season."
      />

      {offers.length === 0 ? (
        <section className="empty-state">
          <StarIcon />
          <h2>Nobody is calling</h2>
          <p>
            {fired
              ? `No program will have you at ${coach.prestige}. Prestige is what
                opens the board, and yours is too low.`
              : 'Offers arrive at the June board meeting, and they follow your record. Track a chair and your agent flags it the year it can be won.'}
          </p>
        </section>
      ) : (
        <section className="job-list">
          {calling.map((o) => (
            <div key={o.team}>
              <button type="button" onClick={() => openTeam(o.team)}>
                <span>
                  <strong>
                    {starred.has(abbrOf(o.team)) && <StarFilledIcon className="job-star" />}
                    {o.school}
                  </strong>
                  <small>{o.conference} · {o.pitch}</small>
                </span>
                <b>{'★'.repeat(prestigeStars(o.prestige))}</b>
                <ChevronRightIcon />
              </button>
              {/*
                The same two-press grammar the portal speaks, off the same
                component — this screen had grown its own copy of it, one state
                variable and two labels, and the two versions had already
                drifted: the portal settled into a green "he is in" and this one
                settled into nothing at all.

                No `done` state here on purpose, and it is not an omission.
                Accepting an offer ends the job search outright: the screen it
                is on goes away in the same tick, so a settled label would be a
                promise made to a control nobody ever sees again.

                Keyed on the job, for the reason the portal's is keyed on the
                man — a reused element would carry an armed state to whichever
                offer landed in its position next.
              */}
              <Confirmable
                key={o.team}
                idle="Accept offer"
                armed="Confirm — leave for good"
                onConfirm={() => { void acceptOffer(o.team); }}
              />
            </div>
          ))}
        </section>
      )}

      {watchedIdle.length > 0 && (
        <>
          <SectionHeading kicker="YOUR CAREER PATH" title="Chairs you watch" />
          <section className="retention-list">
            {watchedIdle.map((t) => (
              <button className="tap" type="button" key={t.def.abbr} onClick={() => openTeam(t.index)}>
                <span className="team-mark small"><Crest abbr={t.def.abbr} size={30} /></span>
                <span>
                  <strong>{t.def.school}</strong>
                  <small>{t.conference} · {'★'.repeat(prestigeStars(t.prestige))} · not calling yet</small>
                </span>
                <b>{t.prestige}</b>
                <ChevronRightIcon />
              </button>
            ))}
          </section>
        </>
      )}

      {offers.length > 0 && (
        <FieldNote
          title="Taking a job is for keeps"
          text="Your contract here ends the moment you sign there. The roster, the
            class you signed, and the promises you made all stay behind."
        />
      )}
    </main>
  );
}
