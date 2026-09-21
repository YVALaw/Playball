// JobMarket.tsx
// Programs calling about their head-coaching job.
//
// Every offer is a card you can read before anything is signed: the program,
// how it compares with the job you have, what comes with you and what stays
// behind, and a two-press button to take it. Taking a job is one of the two
// irreversible acts in the game, so the second press says exactly what it
// does, and touching anything else stands it down.
//
// The jobs your career watches come along: starring a job on a college's page
// lists it here even while it is not calling, so the screen answers "where is
// my career pointed" and not only "who wants me this week".

import type { ReactNode } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { useOpenTeam } from './TeamCard.js';
import { Crest } from '../Crest.js';
import { prestigeStars, rosterStrength } from '../../engine/program.js';
import { regularRecord } from '../../engine/season.js';
import { annualBudget, dollars } from '../../engine/economy.js';
import {
  Card, CompareTable, ConfirmButton, EmptyState, Icon, List, ListRow, Marquee, SectionHeader, Stars,
} from '../components/ui/index.js';
import { conferenceName, plural, recordText } from '../words.js';

export function JobMarket({ lead }: { lead?: ReactNode } = {}) {
  const season = useDynasty((s) => s.season);
  const offers = useDynasty((s) => s.offers);
  const watch = useDynasty((s) => s.watch);
  const acceptOffer = useDynasty((s) => s.acceptOffer);
  const fired = useDynasty((s) => s.jobSearch);
  const coach = useDynasty((s) => s.coach);
  const current = useUserTeam();
  const openTeam = useOpenTeam();

  if (!season) return null;

  // Jobs your career points at, called or not. Starred, and sorted first.
  const starred = new Set(watch.jobs);
  const abbrOf = (team: number): string => season.teams[team]?.def.abbr ?? '';
  const calling = [...offers].sort((a, b) =>
    Number(starred.has(abbrOf(b.team))) - Number(starred.has(abbrOf(a.team))));
  const watchedIdle = watch.jobs
    .filter((abbr) => !offers.some((o) => abbrOf(o.team) === abbr))
    .map((abbr) => season.teams.find((t) => t.def.abbr === abbr))
    .filter((t): t is NonNullable<typeof t> => !!t);

  const currentPrestige = current?.prestige ?? coach.prestige;
  const currentRoster = current ? rosterStrength(current.team) : null;
  const here = fired ? 'Last job' : 'Your job';

  return (
    <main className="pb-page">
      <Marquee
        eyebrow={offers.length > 0 ? `The carousel · ${plural(offers.length, 'program')} calling` : 'The carousel'}
        title="Job offers"
        numbers={offers.length > 0 ? [
          { label: 'Calling', value: offers.length },
        ] : undefined}
      />
      {lead}

      {offers.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nobody is calling yet"
          text={fired
            ? 'Jobs open every June. Rebuild your name and the phone rings again.'
            : 'Offers arrive at the June board meeting. Star a job on a college’s page and you will hear the year it can be won.'}
        />
      ) : calling.map((o) => {
        const dest = season.teams[o.team];
        const rec = dest ? regularRecord(dest) : { w: 0, l: 0 };
        const destinationRoster = dest ? rosterStrength(dest.team) : 0;
        const abbr = abbrOf(o.team);
        return (
          <Card key={o.team} className="pb-offer">
            <button type="button" className="pb-offer__head" onClick={() => openTeam(o.team)}>
              <Crest abbr={abbr} size={44} />
              <span className="pb-offer__who">
                <span className="pb-offer__name">
                  {o.school}
                  {starred.has(abbr) && <Icon name="star-filled" size={14} label="A job you watch" className="pb-offer__star" />}
                </span>
                <span className="pb-offer__meta">{conferenceName(o.conference)} · {recordText(rec.w, rec.l)} this season</span>
                <Stars value={prestigeStars(o.prestige)} label="Program prestige" />
              </span>
              <Icon name="chevron-right" size={20} className="pb-offer__chevron" />
            </button>
            {o.pitch && <p className="pb-offer__pitch">&ldquo;{o.pitch}&rdquo;</p>}

            <CompareTable
              label={`${o.school} against ${here.toLowerCase()}`}
              labelHeader="Program"
              from={here}
              to="This job"
              rows={[
                { label: 'Prestige', hint: 'Out of 100', now: currentPrestige, next: o.prestige },
                currentRoster !== null
                  ? { label: 'Roster strength', hint: 'Average starter rating, of 100', now: currentRoster, next: destinationRoster }
                  : { label: 'Roster strength', hint: 'Average starter rating, of 100', nowText: '—', next: destinationRoster },
                {
                  label: 'Budget a year',
                  now: annualBudget(currentPrestige),
                  next: annualBudget(o.prestige),
                  nowText: dollars(annualBudget(currentPrestige)),
                  nextText: dollars(annualBudget(o.prestige)),
                  changeText: annualBudget(o.prestige) > annualBudget(currentPrestige) ? 'More'
                    : annualBudget(o.prestige) < annualBudget(currentPrestige) ? 'Less' : 'Same',
                  change: annualBudget(o.prestige) - annualBudget(currentPrestige),
                },
              ]}
            />

            <div className="pb-offer__moves">
              <div>
                <span className="pb-eyebrow">Comes with you</span>
                <p className="pb-text-muted">Assistants, tree, reputation, philosophy.</p>
              </div>
              <div>
                <span className="pb-eyebrow">Stays behind</span>
                <p className="pb-text-muted">Facilities, pipelines, reports, spending.</p>
              </div>
            </div>

            <ConfirmButton
              block
              variant="primary"
              idle={`Take the ${o.school} job`}
              armed={current && !fired ? `Tap again: leave ${current.def.school} for good` : 'Tap again to sign'}
              onConfirm={() => { void acceptOffer(o.team); }}
            />
          </Card>
        );
      })}

      {watchedIdle.length > 0 && (
        <section>
          <SectionHeader title="Jobs you watch" />
          <List label="Jobs you watch">
            {watchedIdle.map((t) => (
              <ListRow
                key={t.def.abbr}
                lead={<Crest abbr={t.def.abbr} size={32} />}
                title={t.def.school}
                subtitle={`${conferenceName(t.conference)} · prestige ${t.prestige} of 100`}
                status={<Stars value={prestigeStars(t.prestige)} label="Program prestige" />}
                onClick={() => openTeam(t.index)}
              />
            ))}
          </List>
        </section>
      )}
    </main>
  );
}
