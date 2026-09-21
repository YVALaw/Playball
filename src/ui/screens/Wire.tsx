// Wire.tsx
// News: what the rest of the country is doing, with your program first.
//
// You play one team's schedule while ninety five programs move in the
// standings for reasons you never see; this is where those reasons go. Filter
// chips narrow it to your program or your conference, the strongest story
// leads as a card, and the rest run as a list. Every story opens the program it
// is about, so "tap a story" is a promise the screen keeps.
//
// Everything printed is derived from the live season by `engine/wire.ts`.
// Nothing here invents a fact, and reading the page consumes no dice.

import { useEffect, useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { wire, type WireItem, type WireKind } from '../../engine/wire.js';
import { Crest } from '../Crest.js';
import { useOpenTeam } from './TeamCard.js';
import {
  Button, Card, Chip, Chips, EmptyState, FeedItem, List, Marquee, SectionHeader, StatusBadge,
} from '../components/ui/index.js';
import { conferenceName } from '../words.js';
import { longDate } from '../format.js';

const KIND_LABEL: Record<WireKind, string> = {
  upset: 'Upset',
  streak: 'Streak',
  rout: 'Rout',
  ranking: 'Rankings',
  milestone: 'At the plate',
  race: 'Conference race',
  close: 'Extra innings',
  sweep: 'Sweep',
  gem: 'On the mound',
  power: 'Power',
  rivalry: 'The rivalry',
  chase: 'Record watch',
  realign: 'Realignment',
  moves: 'Coaching moves',
};

type Filter = 'all' | 'you' | 'conference' | 'following';

export function Wire() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const programs = useDynasty((s) => s.watch.programs);
  const openTeam = useOpenTeam();
  const [filter, setFilter] = useState<Filter>('all');

  /*
    Your programme's own season, kept whole. Reported 2026-09-20: "when tapping
    on your program, i would prefer if it keeps track of everything related to
    the team for the season, next season it gets reset and so on" — the filter
    read off the same fortnight the front page does, so a story from April was
    gone by May. This is derived from `season.results`, which is emptied at the
    year roll, so the resetting is the season's own.
  */
  const mySeason = useMemo(
    () => (season ? wire(season, 400, { focus: userTeam }) : []),
    [season, version, userTeam],
  );

  const items = useMemo(() => {
    if (!season) return [];
    const watched = new Set(programs);
    const myConference = season.teams[userTeam]?.conference;
    const score = (item: WireItem): number => {
      const teamRow = season.teams[item.team];
      const againstRow = item.against !== undefined ? season.teams[item.against] : undefined;
      const mine = item.team === userTeam || item.against === userTeam;
      const followed = watched.has(teamRow?.def.abbr ?? '') || watched.has(againstRow?.def.abbr ?? '');
      const conference = teamRow?.conference === myConference || againstRow?.conference === myConference;
      return item.weight + (mine ? 120 : 0) + (followed ? 32 : 0) + (conference ? 10 : 0);
    };
    return [...wire(season)].sort((a, b) => score(b) - score(a));
  }, [season, version, userTeam, programs]);

  /*
    That the coach came and read it: one of the habits that reward engaging
    with the game. Counted once per visit, and only when there is something to
    read, so opening an empty page in February is not keeping up.
  */
  const noteHabit = useDynasty((s) => s.noteHabit);
  useEffect(() => {
    if (items.length > 0) noteHabit('wire');
  }, [items.length > 0, season?.dayIndex, noteHabit]);

  if (!season || !team) return null;

  const watched = new Set(programs);
  const involves = (item: WireItem, test: (i: number) => boolean): boolean =>
    test(item.team) || (item.against !== undefined && test(item.against));
  const mine = (item: WireItem): boolean => involves(item, (i) => i === userTeam);
  const shown = filter === 'you' ? mySeason : items.filter((item) => (
    filter === 'all' ? true
      : filter === 'conference' ? involves(item, (i) => season.teams[i]?.conference === team.conference)
        : involves(item, (i) => watched.has(season.teams[i]?.def.abbr ?? ''))
  )).slice(0, 14);
  const lead = shown[0];
  const rest = shown.slice(1);
  const day = season.schedule[season.dayIndex]?.day ?? 0;
  const abbrOf = (i: number): string => season.teams[i]?.def.abbr ?? '';
  /** Words, not codes: the engine's headlines name schools by their letters. */
  const words = (text: string | undefined, item: WireItem): string | undefined => {
    if (!text) return text;
    let out = text;
    for (const i of [item.team, item.against]) {
      const t = i !== undefined ? season.teams[i] : undefined;
      if (t) out = out.replace(new RegExp(`\\b${t.def.abbr}\\b`, 'g'), t.def.school);
    }
    return out;
  };

  return (
    <main className="pb-page">
      <FirstVisit id="wire" />
      <Marquee
        eyebrow={`The wire · ${longDate(year, day)}`}
        title="News"
      />
      <Chips label="Show stories about">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip selected={filter === 'you'} onClick={() => setFilter('you')}>Your program</Chip>
        <Chip selected={filter === 'conference'} onClick={() => setFilter('conference')}>{conferenceName(team.conference)}</Chip>
        {programs.length > 0 && <Chip selected={filter === 'following'} onClick={() => setFilter('following')}>Following</Chip>}
      </Chips>

      {shown.length === 0 && (
        <EmptyState
          icon="reader"
          title={items.length === 0 ? 'No news yet' : 'Nothing here yet'}
          text={items.length === 0
            ? 'Play some games and the country will start making noise.'
            : 'No stories match this filter right now.'}
          action={filter !== 'all' ? { label: 'Show all stories', onClick: () => setFilter('all') } : undefined}
        />
      )}

      {lead && (
        <Card
          eyebrow={`${mine(lead) ? 'Your program · ' : ''}${KIND_LABEL[lead.kind]}`}
          title={words(lead.text, lead)}
          trailing={abbrOf(lead.team) ? <Crest abbr={abbrOf(lead.team)} size={40} /> : undefined}
          footer={(
            <Button variant="quiet" iconAfter="chevron-right" onClick={() => openTeam(lead.team)}>
              Open {season.teams[lead.team]?.def.school ?? 'the program'}
            </Button>
          )}
        >
          {lead.detail && <p className="pb-text">{words(lead.detail, lead)}</p>}
        </Card>
      )}

      {rest.length > 0 && (
        <section>
          <SectionHeader
            title={filter === 'you' ? `Your ${year} season` : 'Around the country'}
            count={rest.length}
            description={filter === 'you' ? 'Every story about you this year. It starts again in February.' : undefined}
          />
          <List label="Stories">
            {rest.map((item, i) => (
              <FeedItem
                key={`${item.kind}-${item.team}-${i}`}
                lead={abbrOf(item.team) ? <Crest abbr={abbrOf(item.team)} size={32} /> : undefined}
                meta={filter === 'you'
                  ? <>{KIND_LABEL[item.kind]}{item.at !== undefined ? ` · ${longDate(year, item.at)}` : ''}</>
                  : mine(item) ? <>{KIND_LABEL[item.kind]} <StatusBadge tone="info" icon={false}>Your program</StatusBadge></> : KIND_LABEL[item.kind]}
                title={words(item.text, item)}
                text={words(item.detail, item)}
                onClick={() => openTeam(item.team)}
              />
            ))}
          </List>
        </section>
      )}
    </main>
  );
}
