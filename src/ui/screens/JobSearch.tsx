// JobSearch.tsx
// You were let go. Now what.
//
// Reported from testing: "if the board decided not to renew my contract we
// should not be prompted to the team recruiting — we should go back to picking
// a team, while maintaining in history my coach statistics and achievements."
//
// Being fired takes the job away, and the only thing that survives is what you
// did: the record, the rings, the tournaments. The offers themselves are the
// job market, the same screen a mid-career offer opens, so the game has one
// place where a job is accepted and one two-press confirmation guarding it.
// This file only adds the career you carry, because it is the one thing you
// still have.

import { useDynasty } from '../../state/store.js';
import { Card, StatGroup } from '../components/ui/index.js';
import { recordText, stateName } from '../words.js';
import { JobMarket } from './JobMarket.js';

export function JobSearch() {
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  // Tied to the year he left in (the roll has turned it since), so a stale
  // mark can never speak for a later search.
  const resigned = useDynasty((s) => s.coach.resignYear !== undefined && s.coach.resignYear === s.year - 1);

  if (!season) return null;

  const titles = history.filter((h) => h.finish === 'champion').length;
  const rings = history.filter((h) => h.wonConference).length;
  /*
    Three men see this screen now. One has been let go and has a career behind
    him; one has never had a chair at all — the successor to a coach who
    retired, who arrives here the moment he is made; and one walked out on his
    own (2026-09-30). "Out of a job" is wrong for the last two, and a row of
    zeroes needs a sentence that expects them.
  */
  const first = coach.careerWins + coach.careerLosses === 0;

  return (
    <JobMarket
      lead={(
        <Card eyebrow={first ? 'Looking for a first job' : resigned ? 'Looking for a new job' : 'Out of a job'} title={coach.name}>
          <p className="pb-text-muted">
            Age {coach.age} · from {stateName(coach.homeState)} · coach prestige {coach.prestige} of 100
          </p>
          <StatGroup
            size="sm"
            items={[
              { label: 'Career record', value: recordText(coach.careerWins, coach.careerLosses) },
              { label: 'National titles', value: titles },
              { label: 'Conference titles', value: rings },
            ]}
          />
        </Card>
      )}
    />
  );
}
