// Postseason.tsx
// June, on one map.
//
// Reported from testing, over and over, and finally settled by changing the
// format rather than the drawing. Double elimination is what college baseball
// plays and it is the best drama the sport has — but its losers' bracket
// pairings do not exist until somebody loses, so **there is no full bracket to
// draw**. Every attempt at one could only ever show the next round, which is
// what "we were supposed to see all the bracket before it all started" was
// asking for and never getting.
//
// A knockout tree of series is determined by its seeding. The whole thing can be
// drawn on day one with TBD in the empty slots, and the drama moves into series
// length: best of three in the conference, best of five to the last four, best
// of seven from there.

import { useEffect, useRef, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FloatingAction } from '../Sticky.js';
import { Modal } from '../Modal.js';
import { PostseasonMap } from '../PostseasonMap.js';
import type { GraphInput } from '../postseasonGraph.js';
import {
  conferenceField, liveSeries, nextGameFor, hostOfGame, roundName, clincher,
  regionOf, REGIONS, SERIES, CONF_FIELD,
} from '../../engine/postseason.js';
import type { Series, SeriesBracket } from '../../engine/postseason.js';

/** The three parts of June, as the player thinks of them. */
const LADDER = [
  {
    key: 'conference',
    name: 'CONFERENCE',
    blurb: `The top ${CONF_FIELD} of your twelve team conference, knockout, every round a best of ${SERIES.conference}. Half the league is already finished in May; win this and you are your conference champion.`,
  },
  {
    key: 'regional',
    name: 'REGIONAL',
    blurb: `Your conference champion against the champion of the conference next door — one best of ${SERIES.regional} for the region. Four regions, four survivors.`,
  },
  {
    key: 'national',
    name: 'NATIONAL',
    blurb: `The four regional champions. A semifinal and a final, both best of ${SERIES.national}, and the last team standing takes the country.`,
  },
];

const ordinal = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

export function Postseason() {
  const [modal, setModal] = useState<'in' | 'out' | null>(null);
  const shown = useRef<{ in: boolean; out: string | null }>({ in: false, out: null });

  const season = useDynasty((s) => s.season);
  const bracket = useDynasty((s) => s.bracket);
  const myBracket = useDynasty((s) => s.myBracket);
  const advance = useDynasty((s) => s.advanceBracket);
  const manage = useDynasty((s) => s.manageBracketGame);
  const sim = useDynasty((s) => s.simBracket);
  const openStage = useDynasty((s) => s.openStage);
  const userTeam = useDynasty((s) => s.userTeam);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();
  const version = useDynasty((s) => s.version);
  void version;

  // Opening a stage is not a decision, so it is not a press.
  useEffect(() => { openStage(); }, [openStage, bracket?.stage, version]);

  const live: SeriesBracket | null = myBracket ? myBracket.state : null;
  const iAmOut = live ? live.eliminated.includes(userTeam) : false;
  const stageKey = bracket?.stage ?? '';

  useEffect(() => {
    if (!bracket) return;
    if (!shown.current.in && bracket.stage === 'conference') {
      shown.current.in = true;
      setModal('in');
      return;
    }
    if (iAmOut && shown.current.out !== stageKey) {
      shown.current.out = stageKey;
      setModal('out');
    }
  }, [bracket, iAmOut, stageKey]);

  if (!season || !team || !bracket) return null;

  const name = (i: number): string => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';

  const myCup = bracket.cups.find((c) => c.conference === team.conference) ?? null;
  const myRegionId = regionOf(team.conference);
  const myRegional = bracket.regionals.find((r) => r.region === myRegionId) ?? null;
  const regionName = REGIONS.find((r) => r.id === myRegionId)?.name ?? myRegionId;

  const mySeries = live ? liveSeries(live, userTeam) : null;
  const due = live && !iAmOut ? nextGameFor(live, userTeam) : null;

  const stagePlayed = bracket.stage === 'conference' ? bracket.cups.length > 0
    : bracket.stage === 'regional' ? bracket.regionals.length >= REGIONS.length
    : bracket.national !== null;

  /** Which rung of the ladder is lit. */
  const rung = bracket.stage === 'conference' ? 0
    : bracket.stage === 'regional' ? 1 : 2;

  const stageTitle = rung === 0 ? `${team.conference} tournament`
    : rung === 1 ? `${regionName} regional` : 'The last four';

  const graphInput: GraphInput = {
    season,
    userTeam,
    cups: bracket.cups,
    regionals: bracket.regionals,
    national: bracket.national,
    live: myBracket ? { kind: myBracket.kind, state: myBracket.state } : null,
  };

  const qualified = (() => {
    const seed = conferenceField(season, team.conference).field.indexOf(userTeam) + 1;
    if (seed > 0) {
      return {
        title: `${team.conference} tournament`,
        lines: [
          `${team.def.school} are the ${ordinal(seed)} seed of ${CONF_FIELD}.`,
          `Win it and you play the ${regionName} regional. Lose once and the year is over.`,
        ],
      };
    }
    return {
      title: 'Season over',
      lines: [
        `${team.def.school} finished outside the top ${CONF_FIELD} of the ${team.conference}.`,
        'Half the league goes home in May, and this year that is you.',
      ],
    };
  })();

  const howFar = (() => {
    const where = myBracket?.kind === 'conference'
      ? `the ${team.conference} tournament`
      : myBracket?.kind === 'regional' ? `the ${regionName} regional`
      : 'the last four';
    const round = live ? roundName(live.rounds.length, live.roundIndex) : '';
    return {
      title: 'Knocked out',
      lines: [
        `${team.def.school} are out of ${where}${round ? ` in the ${round.toLowerCase()}` : ''}.`,
        'The season ends here. Only champions go on.',
      ],
    };
  })();

  const verdict = (() => {
    if (bracket.stage === 'conference' && myCup) {
      return {
        good: myCup.champion === userTeam,
        text: myCup.champion === userTeam
          ? `${team.def.school} win the ${team.conference} — on to the ${regionName} regional.`
          : myCup.seeds.includes(userTeam)
            ? `${name(myCup.champion)} won the conference. Your season ends here.`
            : `You did not make the ${CONF_FIELD} team field. ${name(myCup.champion)} won it.`,
      };
    }
    if (bracket.stage === 'regional' && myRegional) {
      return {
        good: myRegional.champion === userTeam,
        text: myRegional.champion === userTeam
          ? `${team.def.school} take the ${regionName} — you are in the last four.`
          : `${name(myRegional.champion)} take the ${regionName}. Your season ends here.`,
      };
    }
    if (bracket.national) {
      return {
        good: bracket.national.champion === userTeam,
        text: bracket.national.champion === userTeam
          ? `${team.def.school} are national champions.`
          : `${name(bracket.national.champion)} win the national title.`,
      };
    }
    return { good: false, text: 'Still being played.' };
  })();

  const action: {
    label: string;
    run: () => void;
    secondary?: { label: string; onClick: () => void } | null;
  } = due
    ? {
        label: 'PLAY THIS GAME',
        run: manage,
        secondary: { label: 'SIMULATE THIS GAME', onClick: () => sim('game') },
      }
    : live
      ? {
          // Not your series: the whole round at once. One game per press is
          // the right size when you are in it and far too small when you
          // are not. And once you are out you are watching, not playing —
          // offering to "play" the semifinal of a tournament that knocked you
          // out in the quarterfinal reads as though you were still in it.
          label: `${iAmOut ? 'SEE' : 'PLAY'} THE ${
            roundName(live.rounds.length, live.roundIndex).toUpperCase()}`,
          run: () => sim('round'),
        }
      : stagePlayed
        ? {
            label: bracket.stage === 'conference' ? 'ON TO THE REGIONALS'
              : bracket.stage === 'regional' ? 'ON TO THE LAST FOUR'
              : 'END THE SEASON',
            run: advance,
          }
        : { label: 'CONTINUE', run: advance };

  return (
    <div style={{ padding: '14px 0 22px' }}>
      {modal === 'in' && (
        <Modal
          kicker={`${year} POSTSEASON`}
          title={qualified.title}
          lines={qualified.lines}
          tone="win"
          action="LET'S GO"
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'out' && (
        <Modal
          kicker="KNOCKED OUT"
          title={howFar.title}
          lines={howFar.lines}
          tone="clay"
          action="SEE THE REST OF IT"
          onClose={() => setModal(null)}
        />
      )}

      <div style={{
        margin: '0 14px', borderBottom: '2px solid var(--ink)', paddingBottom: 8,
      }}>
        <div className="label">{year} POSTSEASON · STAGE {rung + 1} OF 3</div>
        <div style={{
          font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>{stageTitle}</div>
      </div>

      <Ladder at={rung} />

      <PostseasonMap
        section={rung === 0 ? 'conf' : rung === 1 ? 'regional' : 'national'}
        input={graphInput}
        abbr={abbr}
        name={name}
        height={430}
        focusKey={`${bracket.stage}:${live ? live.roundIndex : 9}:${
          live ? live.rounds.flat().reduce((a, s) => a + s.games.length, 0) : 0}`}
      />

      {live && (
        <div style={{ padding: '0 14px' }}>
          <Section title="YOUR SERIES">
            <SeriesPanel
              series={mySeries}
              userTeam={userTeam}
              out={iAmOut}
              name={name}
              rounds={live.rounds.length}
              lengths={live.lengths}
            />
            {due && mySeries && (
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)',
              }}>
                <div className="label">
                  GAME {mySeries.games.length + 1} OF {live.lengths[mySeries.round]}
                </div>
                <div style={{
                  font: "700 20px/1.1 var(--display)", marginTop: 4,
                  textTransform: 'uppercase',
                }}>
                  {hostOfGame(mySeries, mySeries.games.length) === userTeam ? 'vs ' : 'at '}
                  {name(due.a === userTeam ? due.b : due.a)}
                </div>
              </div>
            )}
          </Section>
        </div>
      )}

      {!live && stagePlayed && (
        <div style={{ padding: '0 14px' }}>
          <Section title="RESULT">
            <div style={{
              font: "400 13px/1.5 var(--body)",
              color: verdict.good ? 'var(--win)' : 'var(--ink)',
              fontWeight: verdict.good ? 600 : 400,
            }}>{verdict.text}</div>
          </Section>
        </div>
      )}

      <FloatingAction
        label={action.label}
        onClick={action.run}
        secondary={action.secondary ?? null}
      />
    </div>
  );
}

/** Where you are in June, and what this part of it is. */
function Ladder({ at }: { at: number }) {
  return (
    <div style={{ margin: '12px 14px 0' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {LADDER.map((l, i) => (
          <div key={l.key} style={{ flex: 1 }}>
            <div style={{
              height: 4,
              background: i < at ? 'rgba(168,68,42,.42)'
                : i === at ? 'var(--clay)' : 'var(--faint)',
              transition: 'background 220ms ease',
            }} />
            <div style={{
              marginTop: 5, font: "600 8px var(--mono)", letterSpacing: '.08em',
              color: i === at ? 'var(--clay)' : 'var(--dim)', textAlign: 'center',
            }}>{l.name}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 9, padding: '10px 12px', background: 'var(--paper)',
        borderLeft: '3px solid var(--clay)', font: "400 12px/1.5 var(--body)",
      }}>{LADDER[at]?.blurb}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>{title}</div>
      <div style={{
        padding: '12px', border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>{children}</div>
    </>
  );
}

/**
 * The series you are in, as a score and a sentence.
 *
 * A best of seven at 2-2 is a different situation from a best of three at 1-1,
 * and the number alone does not say which — so the line underneath says what one
 * more win, or one more loss, would mean.
 */
function SeriesPanel(
  { series, userTeam, out, name, rounds, lengths }:
  {
    series: Series | null;
    userTeam: number;
    out: boolean;
    name: (i: number) => string;
    rounds: number;
    lengths: readonly number[];
  },
) {
  if (out || !series) {
    return (
      <div style={{ font: "400 13px/1.5 var(--body)", color: 'var(--clay)' }}>
        {out
          ? 'Your run is over. The rest of the bracket plays on.'
          : 'Waiting on the round below to finish.'}
      </div>
    );
  }

  const mineIsA = series.a === userTeam;
  const wins = (team: number | null): number =>
    series.games.filter((g) => g.winner === team).length;
  const me = wins(mineIsA ? series.a : series.b);
  const them = wins(mineIsA ? series.b : series.a);
  const other = mineIsA ? series.b : series.a;
  const need = clincher(lengths[series.round] ?? 3);

  const line = series.winner === userTeam ? 'Series won.'
    : series.winner !== null ? 'Series lost.'
    : me === need - 1 && them === need - 1 ? 'Winner takes the series.'
    : me === need - 1 ? 'One more win takes it.'
    : them === need - 1 ? 'One more loss ends it.'
    : me > them ? 'Ahead in the series.'
    : me < them ? 'Behind in the series.'
    : me === 0 ? 'Not started.' : 'Level.';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ font: "800 26px/1 var(--display)" }}>{me}-{them}</span>
        <span style={{ font: "400 12px var(--body)", color: 'var(--dim)' }}>{line}</span>
      </div>
      <div style={{
        marginTop: 5, font: "400 11.5px var(--mono)", color: 'var(--dim)',
      }}>
        {roundName(rounds, series.round)}
        {other !== null ? ` · vs ${name(other)}` : ''}
        {` · best of ${lengths[series.round]}`}
      </div>
    </>
  );
}
