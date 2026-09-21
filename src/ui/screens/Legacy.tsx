// Legacy.tsx
// The end of a career, and what happens next.
//
// The record, and the two doors out of it. Every number opens the seasons
// behind it (LegacySheets.tsx); take another chair and the world carries on
// with somebody new in it; end here and the career is a finished thing in the
// saves list that opens again whenever he wants to look at it.
//
// There was a ceremony in front of this for a day — the cabinet face down,
// turned over card by card. It went, and the report is the reason: "the screen
// where confetti comes down and all feels pointless tbh, cause the other
// screen already has all that same info and more in deep cause we can tap on
// it and expand." It was right. The cards carried the same five numbers this
// page carries as tiles, slower and without the seasons behind them, so the
// ceremony was spending a player's attention to tell him something he was
// about to be told properly.
//
// What a moment is actually for is left where it belongs: the verdict leads
// this page, and a career worth gold gets the confetti once, here, on arrival.
//
// Everything is read off the `Legend`, never off the coach in the store: he is
// finished, his history is thrown away the moment a successor is made, and a
// career reopened years later has to read exactly as it did the day it ended.

import { useEffect, useRef, useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { endingOf, inTheHall, legacyRank, type Legend } from '../../engine/retirement.js';
import { makeRng } from '../../engine/rng.js';
import { randomProfile, type CoachProfile } from '../../engine/program.js';
import { BACKGROUNDS, type BackgroundId } from '../../data/backgrounds.js';
import { CoachPortrait } from '../CoachPortrait.js';
import {
  ActionBar, Button, Callout, Card, List, ListRow, Marquee, Plaque, TileGrid,
} from '../components/ui/index.js';
import { cx } from '../components/ui/core.js';
import { burstConfetti } from '../celebrate.js';
import { sfx, buzz } from '../sound.js';
import { Identity, BackgroundStep } from './NewGame.js';
import {
  AllTimeSheet, ProsSheet, SchoolSheet, SeasonSheet, YearsSheet, useLegendPros,
  type LegacySheet,
} from './LegacySheets.js';
import { plural, recordText } from '../words.js';
import { pct } from '../format.js';

export function Legacy() {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const startNewCoach = useDynasty((s) => s.startNewCoach);
  const saveNow = useDynasty((s) => s.saveNow);
  const backToStart = useDynasty((s) => s.backToStart);
  /*
    A player's card is a full overlay at z-30 and a sheet is at z-60, and the
    two genuinely interleave — the card itself opens sheets — so neither can
    simply sit above the other. Reported 2026-09-20: "when we tap on one of
    them the profile opens in the background and keeps the list up top."

    So the list steps aside while the card is up, and comes back exactly as it
    was when the card closes: the stack is still in state, only unmounted.
  */
  const playerOpen = useDynasty((s) => s.selectedPlayer !== null);

  const [step, setStep] = useState<'record' | 'who' | 'background'>('record');
  const [stack, setStack] = useState<LegacySheet[]>([]);
  const [profile, setProfile] = useState<CoachProfile>(
    () => randomProfile(makeRng(((season?.seed ?? 1) ^ (year * 2654435761)) >>> 0)),
  );
  const [background, setBackground] = useState<BackgroundId>(BACKGROUNDS[0]!.id);

  const book = season?.legends ?? [];
  const legend = [...book].reverse().find((l) => l.you);
  const pros = useLegendPros(legend ?? ({ stints: [] } as unknown as Legend));
  const gold = legend ? endingOf(legend).tone === 'gold' : false;

  /*
    The moment, such as it is: one burst when a career worth gold arrives, and
    nothing at all when it is not. A quiet ending is not a lesser one and does
    not want a consolation animation — the words carry it.

    Above the early return because a hook has to run every render, and fired
    once per mount, so pressing back out of a sheet does not set it off again.
  */
  const celebrated = useRef(false);
  const page = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!gold || celebrated.current) return undefined;
    /*
      A beat, and not for drama: the paper is appended into the frame, and the
      frame is still settling when this mounts — the render that lands a moment
      later takes the layer down with it, which is why the first version of
      this fired correctly and showed nothing. Waiting also puts the burst
      after the page has drawn, which is when there is something to celebrate
      on screen. Cleared on unmount, so a mount that is immediately thrown
      away never spends it.
    */
    const id = window.setTimeout(() => {
      celebrated.current = true;
      const frame = page.current?.closest('.app-frame');
      if (frame instanceof HTMLElement) burstConfetti(frame, ['#f2cf6b', '#d9b44a', '#f5efe0']);
      sfx('clap', { gain: 0.8 });
      buzz([60, 80, 200]);
    }, 420);
    return () => window.clearTimeout(id);
  }, [gold]);

  if (!legend) return null;

  const ending = endingOf(legend);
  const rank = legacyRank(legend.score, book.filter((l) => l !== legend));
  const hall = inTheHall(legend);
  const games = legend.careerWins + legend.careerLosses;
  const open = (sheet: LegacySheet): void => setStack((prev) => [...prev, sheet]);
  const back = (): void => setStack((prev) => prev.slice(0, -1));

  const bar = (label: string, onClick: () => void) => (
    <ActionBar>
      <Button variant="primary" iconAfter="arrow-right" onClick={onClick}>{label}</Button>
    </ActionBar>
  );

  if (step === 'who') {
    return (
      <Identity
        rail={null}
        profile={profile}
        onChange={setProfile}
        bar={bar('Continue', () => {
          const name = profile.name.trim();
          if (name !== profile.name) setProfile({ ...profile, name });
          setStep('background');
        })}
      />
    );
  }

  if (step === 'background') {
    const picked = BACKGROUNDS.find((b) => b.id === background) ?? BACKGROUNDS[0]!;
    return (
      <BackgroundStep
        rail={null}
        chosen={background}
        onChoose={setBackground}
        onBack={() => setStep('who')}
        bar={bar('See who is hiring', () => {
          void startNewCoach(profile, {
            skills: picked.skills, badges: picked.badges,
            leans: picked.leans, ambition: picked.ambition,
          });
        })}
      />
    );
  }

  const top = playerOpen ? undefined : stack[stack.length - 1];

  return (
    <main className="pb-page" ref={page}>
      <Marquee
        eyebrow={`${legend.from}–${legend.to} · ${plural(legend.seasons, 'season')}`}
        title={legend.name}
        subtitle={`${recordText(legend.careerWins, legend.careerLosses)}${games > 0 ? ` · ${pct(legend.careerWins / games)} won` : ''}`}
        mark={legend.look && <span className="pb-portrait"><CoachPortrait look={legend.look} size={72} /></span>}
      />

      <Callout
        tone={ending.tone === 'gold' ? 'positive' : 'info'}
        icon={ending.tone === 'gold' ? 'star-filled' : 'bookmark'}
        eyebrow={hall ? 'Into the hall of fame' : `#${rank.rank} of ${rank.of} all-time`}
        title={ending.title}
        className={cx('pb-verdict-callout', `is-${ending.tone}`)}
      >
        {ending.line}
      </Callout>

      {/* Every number opens what is behind it. */}
      <TileGrid label="The cabinet" cols={3}>
        <Plaque
          icon="star-filled"
          label="National"
          value={legend.titles}
          tone={legend.titles > 0 ? 'positive' : undefined}
          note={legend.titles > 0 ? 'See them' : undefined}
          onClick={() => open({ kind: 'years', title: 'National titles', filter: 'titles' })}
        />
        <Plaque
          icon="target"
          label="Omaha"
          value={legend.regionalTitles}
          onClick={() => open({ kind: 'years', title: 'Trips to Omaha', filter: 'omaha' })}
        />
        <Plaque
          icon="star"
          label="Conference"
          value={legend.conferenceTitles}
          onClick={() => open({ kind: 'years', title: 'League titles', filter: 'conference' })}
        />
        <Plaque
          icon="calendar"
          label="Bids"
          value={legend.tournaments}
          onClick={() => open({ kind: 'years', title: 'Tournament bids', filter: 'bids' })}
        />
        <Plaque
          icon="person"
          label="To the pros"
          value={pros.length}
          note={pros.filter((p) => p.highest === 'THE SHOW').length > 0
            ? `${pros.filter((p) => p.highest === 'THE SHOW').length} in The Show` : undefined}
          onClick={() => open({ kind: 'pros' })}
        />
        <Plaque
          icon="bar-chart"
          label="All-time"
          value={`#${rank.rank}`}
          note={`of ${rank.of}`}
          onClick={() => open({ kind: 'alltime' })}
        />
      </TileGrid>

      <Card title="Where you coached" flush>
        <List label="Career path" className="pb-list--inset">
          {legend.stints.map((stint, i) => (
            <ListRow
              key={`${stint.school}-${stint.from}`}
              title={stint.school}
              subtitle={stint.from === stint.to ? String(stint.from) : `${stint.from}–${stint.to}`}
              status={stint.titles > 0 ? <span className="pb-tone--positive">{plural(stint.titles, 'title')}</span> : undefined}
              value={recordText(stint.w, stint.l)}
              onClick={() => open({ kind: 'school', index: i })}
            />
          ))}
        </List>
      </Card>

      {/*
        Two doors, and both of them are real. Reported 2026-09-20: "instead of
        just one button saying take another chair we should also have the end
        here for people who don't want to continue from there." Ending here
        leaves the career in the saves list as a finished thing, which opens
        straight back onto this page — including this button, in case the day
        comes when he wants another chair after all.
      */}
      {/* Two on one bar at phone width, so the labels are short enough to
          stay on one line each. The note above carries the meaning. */}
      <ActionBar note="Carry on in this world, or leave it here.">
        <Button variant="primary" iconAfter="arrow-right" onClick={() => setStep('who')}>Another chair</Button>
        <Button
          variant="secondary"
          icon="exit"
          onClick={() => { void saveNow().then(() => backToStart()); }}
        >
          End here
        </Button>
      </ActionBar>

      {top?.kind === 'years' && (
        <YearsSheet
          legend={legend}
          title={top.title}
          filter={top.filter}
          onOpen={(y) => open({ kind: 'season', year: y })}
          onClose={back}
        />
      )}
      {top?.kind === 'season' && <SeasonSheet legend={legend} year={top.year} onClose={back} />}
      {top?.kind === 'school' && (
        <SchoolSheet
          legend={legend}
          index={top.index}
          onOpen={(y) => open({ kind: 'season', year: y })}
          onClose={back}
        />
      )}
      {top?.kind === 'pros' && <ProsSheet legend={legend} onClose={back} />}
      {top?.kind === 'alltime' && <AllTimeSheet onClose={back} />}
    </main>
  );
}
