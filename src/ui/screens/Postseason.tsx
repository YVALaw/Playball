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

import { useEffect, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
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
  const knockout = useDynasty((s) => s.knockout);
  const seen = useDynasty((s) => s.postseasonSeen);
  const markSeen = useDynasty((s) => s.markPostseasonSeen);
  const version = useDynasty((s) => s.version);
  void version;

  // Opening a stage is not a decision, so it is not a press.
  useEffect(() => { openStage(); }, [openStage, bracket?.stage, version]);

  const live: SeriesBracket | null = myBracket ? myBracket.state : null;
  /**
   * Out of it — from the store when there is no bracket left to ask.
   *
   * Losing the deciding game of a tier removes the bracket in the same commit
   * that decides it, so a screen that only knew how to look at `live` could see
   * an elimination only when the tournament carried on without you.
   */
  const knockedOut = knockout !== null && knockout.year === year;
  const iAmOut = live ? live.eliminated.includes(userTeam) : knockedOut;
  const stageKey = bracket?.stage ?? '';

  /**
   * The one moment worth stopping the screen for is the one it cannot see.
   *
   * Both flags live in the store rather than in a ref: managing a game unmounts
   * this screen, and a remounted ref believes it has never spoken — which is
   * how the qualification modal came back after a game and the elimination
   * modal never came at all.
   */
  const stillIn = myBracket !== null && !knockedOut;
  const mySeed = season && team
    ? conferenceField(season, team.conference).field.indexOf(userTeam) + 1
    : 0;
  const inTheField = mySeed > 0;
  const introKey = `${year}:in:${stageKey}`;
  const outKey = knockedOut && knockout ? `${year}:out:${knockout.kind}` : '';

  useEffect(() => {
    if (!bracket) return;
    // Elimination first. A year that has just ended is never also a year that
    // is about to begin, whatever stage the bracket says it is on.
    if (outKey && !seen.includes(outKey)) {
      markSeen(outKey);
      setModal('out');
      return;
    }
    // And the welcome only where there is something to welcome you to: a live
    // run of your own, or a May that ended without one.
    if (stageKey === 'conference' && (inTheField ? stillIn : true)
      && !seen.includes(introKey)) {
      markSeen(introKey);
      setModal('in');
    }
  }, [bracket, stageKey, outKey, introKey, seen, markSeen, stillIn, inTheField]);

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

  const qualified = inTheField
    ? {
        good: true,
        title: `${team.conference} tournament`,
        lines: [
          `${team.def.school} are the ${ordinal(mySeed)} seed of ${CONF_FIELD}.`,
          `Win it and you play the ${regionName} regional. Lose once and the year is over.`,
        ],
      }
    : {
        good: false,
        title: 'Season over',
        lines: [
          `${team.def.school} finished outside the top ${CONF_FIELD} of the ${team.conference}.`,
          'Half the league goes home in May, and this year that is you.',
        ],
      };

  const howFar = (() => {
    // Read from the recorded elimination, not from the live bracket: by the
    // time a losing final renders there is no live bracket to read.
    const kind = knockout?.kind ?? myBracket?.kind ?? 'conference';
    const where = kind === 'conference'
      ? `the ${team.conference} tournament`
      : kind === 'regional' ? `the ${regionName} regional`
      : 'the last four';
    const round = knockout ? roundName(knockout.rounds, knockout.round) : '';
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
          // Only once you are out. While you are alive but waiting, running to
          // the end of the tournament would run your own games with it, which
          // is exactly what taking them one at a time exists to prevent.
          secondary: iAmOut
            ? { label: 'SIM TO THE END OF THE TOURNAMENT', onClick: () => sim('rest') }
            : null,
        }
      : stagePlayed
        ? {
            // What the press does depends on how the tier went. "ON TO THE
            // REGIONALS" over a season that just ended reads as an invitation
            // to a tournament you are not in.
            label: bracket.stage === 'conference'
              ? (verdict.good ? 'ON TO THE REGIONALS' : 'SEE THE REGIONALS')
              : bracket.stage === 'regional'
                ? (verdict.good ? 'ON TO THE LAST FOUR' : 'SEE THE LAST FOUR')
                : 'END THE SEASON',
            run: advance,
          }
        : { label: 'CONTINUE', run: advance };

  return (
    <>
      {/*
        The modals stay outside the screen's own scroller. They cover the frame,
        and a cover that lives inside the box it is covering scrolls with it.
      */}
      {modal === 'in' && (
        <Modal
          kicker={`${year} POSTSEASON`}
          title={qualified.title}
          lines={qualified.lines}
          tone={qualified.good ? 'win' : 'clay'}
          action={qualified.good ? "LET'S GO" : 'SEE THE REST OF IT'}
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

      {/*
        Which stage this is, and how far through June you are, pinned. Both are
        the answer to "where am I", and a map 430 pixels tall pushes them off
        the top of the screen the moment you go looking at the bracket.
      */}
      <FixedHeader header={
        <div style={{ padding: '14px 0 12px' }}>
          <div style={{
            margin: '0 14px', borderBottom: '2px solid var(--ink)', paddingBottom: 8,
          }}>
            <div className="label">{year} POSTSEASON · STAGE {rung + 1} OF 3</div>
            <div style={{
              font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
            }}>{stageTitle}</div>
          </div>

          <Ladder at={rung} />
        </div>
      }>
      <div style={{ padding: '12px 0 22px' }}>
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

      {/* The gutter the button bar expects, given to the bar alone.
          The bar bleeds 14px into its parent's padding so its background can
          reach the edges of the screen while the button inside stays inset.
          Every other screen that uses it is padded; this one cannot be, because
          the map is full bleed on purpose — so the bar came out 28px wider than
          the screen and June scrolled sideways. The gutter goes here instead.
          It carries the pinning too: a sticky box is confined to its own
          containing block, so a wrapper this tight would otherwise leave the
          button parked at the bottom of the content rather than the frame. */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 10, padding: '0 14px' }}>
        <FloatingAction
          label={action.label}
          onClick={action.run}
          secondary={action.secondary ?? null}
        />
      </div>
      </div>
      </FixedHeader>
    </>
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
