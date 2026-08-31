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
import { teamColour } from '../Avatar.js';
import { FieldNote, ModuleIntro, SectionHeading } from '../components/Kit.js';
import { prestigeStars } from '../../engine/program.js';

export function JobMarket() {
  const season = useDynasty((s) => s.season);
  const offers = useDynasty((s) => s.offers);
  const watch = useDynasty((s) => s.watch);
  const acceptOffer = useDynasty((s) => s.acceptOffer);
  const openTeam = useOpenTeam();
  /*
    The armed offer. Accepting is one of two irreversible acts in the game (the
    other starts a season), so the button asks twice: the first press arms it,
    the second signs. Tapping anywhere else stands it down.
  */
  const [arming, setArming] = useState<number | null>(null);

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
            Offers arrive at the June board meeting, and they follow your
            record. Win, and this page stops being empty.
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
              <button
                className={arming === o.team ? 'arming' : ''}
                type="button"
                onClick={() => {
                  if (arming === o.team) void acceptOffer(o.team);
                  else setArming(o.team);
                }}
              >{arming === o.team ? 'Confirm — leave for good' : 'Accept offer'}</button>
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
                <span className="team-mark small" style={{ background: teamColour(t.def.abbr) }}>
                  {t.def.abbr}
                </span>
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
