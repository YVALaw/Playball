// JobSearch.tsx
// You were let go. Now what.
//
// Reported from testing: "if the board decided not to renew my contract we
// should not be prompted to the team recruiting — we should go back to picking
// a team, while maintaining in history my coach statistics and achievements."
//
// Which was exactly true: being fired set a flag, printed a verdict, and then
// handed you back the keys to a program that had just dismissed you. Getting
// fired has to actually take the job away, and the only thing that survives is
// what you did — the record, the rings, the tournaments.
//
// The offers themselves are the job market — the same screen a mid-career
// offer opens, so the game has exactly one place where a chair is accepted and
// exactly one two-press confirmation guarding it. This file only adds what
// being between jobs changes: the career strip at the top, because the one
// thing you still have is what you did.

import { useDynasty } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { Metric, MetricStrip, ModuleIntro } from '../components/Kit.js';
import { JobMarket } from './JobMarket.js';

export function JobSearch() {
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;

  if (!season) return null;

  const titles = history.filter((h) => h.finish === 'champion').length;
  const rings = history.filter((h) => h.wonConference).length;

  return (
    <FixedHeader header={
      <div style={{ padding: '16px 14px 10px' }}>
        {/*
          Where the profile made at the start of the career shows up: this is
          the one screen that is about the man rather than the program.
        */}
        <ModuleIntro
          kicker="OUT OF A JOB"
          title={coach.name}
          text={`${coach.age} · ${coach.homeState} · coach prestige ${coach.prestige}`}
        />
        <MetricStrip>
          <Metric label="RECORD" value={`${coach.careerWins}-${coach.careerLosses}`} note="CAREER" />
          <Metric label="TITLES" value={String(titles)} note="NATIONAL" />
          <Metric label="CONFERENCE" value={String(rings)} note="RINGS" />
        </MetricStrip>
      </div>
    }>
      <JobMarket />
    </FixedHeader>
  );
}
