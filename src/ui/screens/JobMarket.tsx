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

import { ChevronRightIcon, StarIcon, StarFilledIcon } from '@radix-ui/react-icons';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { useOpenTeam } from './TeamCard.js';
import { Crest } from '../Crest.js';
import { Confirmable, ModuleIntro, SectionHeading } from '../components/Kit.js';
import { prestigeStars, rosterStrength } from '../../engine/program.js';
import { regularRecord } from '../../engine/season.js';
import { annualBudget, dollars } from '../../engine/economy.js';

export function JobMarket() {
  const season = useDynasty((s) => s.season);
  const offers = useDynasty((s) => s.offers);
  const watch = useDynasty((s) => s.watch);
  const acceptOffer = useDynasty((s) => s.acceptOffer);
  const fired = useDynasty((s) => s.jobSearch);
  const coach = useDynasty((s) => s.coach);
  const current = useUserTeam();
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
        text="Compare the program, then decide what is worth leaving behind."
      />

      {offers.length === 0 ? (
        <section className="empty-state">
          <StarIcon />
          <h2>Nobody is calling</h2>
          <p>
            {fired
              ? 'Chairs open every June. Rebuild the name and the phone rings again.'
              : 'Offers land at the June board meeting. Track a chair and your agent flags it the year it can be won.'}
          </p>
        </section>
      ) : (
        <section className="job-offer-grid">
          {calling.map((o) => {
            const dest = season.teams[o.team];
            const rec = dest ? regularRecord(dest) : { w: 0, l: 0 };
            const currentPrestige = current?.prestige ?? coach.prestige;
            const currentRoster = current ? rosterStrength(current.team) : 0;
            const destinationRoster = dest ? rosterStrength(dest.team) : 0;
            const prestigeDelta = o.prestige - currentPrestige;
            const rosterDelta = destinationRoster - currentRoster;
            return (
              <article className="job-offer-card" key={o.team}>
                <button className="job-offer-head tap" type="button" onClick={() => openTeam(o.team)}>
                  <span className="job-offer-crest"><Crest abbr={abbrOf(o.team)} size={42} /></span>
                  <span>
                    <small>{o.conference.toUpperCase()} · {rec.w}-{rec.l}</small>
                    <strong>{starred.has(abbrOf(o.team)) && <StarFilledIcon className="job-star" />}{o.school}</strong>
                    <p>{o.pitch}</p>
                  </span>
                  <ChevronRightIcon />
                </button>

                <div className="job-offer-comparison">
                  <span><small>PRESTIGE</small><strong>{o.prestige}</strong><em className={prestigeDelta >= 0 ? 'up' : 'down'}>{prestigeDelta === 0 ? 'EVEN' : `${prestigeDelta > 0 ? '+' : ''}${prestigeDelta}`}</em></span>
                  <span><small>ROSTER</small><strong>{destinationRoster}</strong><em className={rosterDelta >= 0 ? 'up' : 'down'}>{rosterDelta === 0 ? 'EVEN' : `${rosterDelta > 0 ? '+' : ''}${rosterDelta}`}</em></span>
                  <span><small>ANNUAL BUDGET</small><strong>{dollars(annualBudget(o.prestige))}</strong><em>NEW LEDGER</em></span>
                </div>

                <div className="job-move-consequence">
                  <small>WHAT MOVES WITH YOU</small>
                  <p><b>Comes:</b> your assistants, coaching tree, reputation, and philosophy.</p>
                  <p><b>Stays:</b> facilities, earned pipelines, scouting reports, and this program's spending.</p>
                </div>

                <Confirmable
                  key={o.team}
                  idle={`Take the ${o.school} job`}
                  armed="Confirm — leave for good"
                  onConfirm={() => { void acceptOffer(o.team); }}
                />
              </article>
            );
          })}
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

    </main>
  );
}
