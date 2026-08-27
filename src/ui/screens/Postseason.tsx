// Postseason.tsx
// June, in three championships.
//
// CONFERENCE: eight of twelve into a double elimination, top four finishers
// advance, the champion hangs a banner. REGIONALS: sixteen best-of-three
// championship series crossing neighbouring conferences, sixteen banners.
// NATIONAL: those sixteen champions plus four protected or at-large bids,
// twenty in all — seeds 13 to 20 play an opening round, the sixteen split
// into two double-elimination brackets, and the two bracket champions play a
// best-of-three for the country.
//
// The screen's rules, all reported from testing: the explanatory card is
// gone and the brackets own the room it ate; winners and losers are two
// views under a toggle rather than one giant map; every bracket card wears
// its school's colour; and the action button is pinned to the frame so it
// sits in the same place whatever tab is up.

import { useEffect, useState } from 'react';
import { useDynasty, useUserTeam, type NationalProgress } from '../../state/store.js';
import { FloatingAction } from '../Sticky.js';
import { Modal } from '../Modal.js';
import { Lineup } from './Lineup.js';
import { DoubleElimMap, type DECols } from '../DoubleElimMap.js';
import { teamColour } from '../Avatar.js';
import {
  conferenceField, liveSeries, nextGameFor, hostOfGame, roundName, clincher,
  regionOf, REGIONS, CONF_FIELD, CONF_ADVANCE,
} from '../../engine/postseason.js';
import type {
  Series, SeriesBracket, RegionalSeries, ConferenceTournament, TournamentResult,
} from '../../engine/postseason.js';
import { liveSlotFor, slotName, type DoubleElim } from '../../engine/doubleElim.js';
import { FirstVisit } from '../Tutorial.js';

type ConfView = 'winners' | 'losers';
type NatView = 'opening' | 'winners' | 'losers';

/*
  The toggles remember themselves across an unmount — managing a game covers
  this screen, and coming back to a different tab than you left reads as the
  screen forgetting you. Module scope on purpose: session-long, never saved,
  exactly the lifetime a view preference deserves.
*/
let confViewMemo: ConfView = 'winners';
let natViewMemo: NatView = 'opening';

export function Postseason() {
  const [modal, setModal] = useState<'in' | 'out' | 'won' | null>(null);
  const [showLineup, setShowLineup] = useState(false);
  const [confView, setConfView0] = useState<ConfView>(confViewMemo);
  const [natView, setNatView0] = useState<NatView>(natViewMemo);
  const setConfView = (v: ConfView): void => { confViewMemo = v; setConfView0(v); };
  const setNatView = (v: NatView): void => { natViewMemo = v; setNatView0(v); };

  const season = useDynasty((s) => s.season);
  const bracket = useDynasty((s) => s.bracket);
  const myBracket = useDynasty((s) => s.myBracket);
  const sideShow = useDynasty((s) => s.sideShow);
  const pendingGame = useDynasty((s) => s.pendingGame);
  const resumeGame = useDynasty((s) => s.resumeGame);
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

  const knockedOut = knockout !== null && knockout.year === year;
  const iAmOut = myBracket
    ? myBracket.state.eliminated.includes(userTeam)
    : knockedOut;
  const stageKey = bracket?.stage ?? '';

  const stillIn = myBracket !== null && !knockedOut;
  const mySeed = season && team
    ? conferenceField(season, team.conference).field.indexOf(userTeam) + 1
    : 0;
  const inTheField = mySeed > 0;
  const introKey = `${year}:in:${stageKey}`;
  const outKey = knockedOut && knockout ? `${year}:out:${knockout.kind}` : '';

  /** Whether the tier on screen is finished, and whether you won something. */
  const nat = bracket?.national ?? null;
  const stagePlayed = bracket
    ? (bracket.stage === 'conference' ? bracket.cups.length >= 8
      : bracket.stage === 'regional' ? bracket.regionals.length >= 16
      : nat !== null && nat.final !== null)
    : false;
  const wonConference = bracket?.cups.some((c) => c.champion === userTeam) ?? false;
  const wonRegional = bracket?.regionals.some((r) => r.champion === userTeam) ?? false;
  const wonTitle = nat?.final?.champion === userTeam;
  const iWonStage = bracket !== null && (
    bracket.stage === 'conference' ? (stagePlayed && wonConference)
      : bracket.stage === 'regional' ? (stagePlayed && wonRegional)
      : wonTitle
  );
  const winKey = iWonStage ? `${year}:win:${stageKey}` : '';

  useEffect(() => {
    if (!bracket) return;
    if (outKey && !seen.includes(outKey)) {
      markSeen(outKey);
      setModal('out');
      return;
    }
    if (winKey && !seen.includes(winKey)) {
      markSeen(winKey);
      setModal('won');
      return;
    }
    if (stageKey === 'conference' && (inTheField ? stillIn : true)
      && !seen.includes(introKey)) {
      markSeen(introKey);
      setModal('in');
    }
  }, [bracket, stageKey, outKey, winKey, introKey, seen, markSeen, stillIn, inTheField]);

  if (!season || !team || !bracket) return null;

  const name = (i: number): string => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';

  const rung = bracket.stage === 'conference' ? 0
    : bracket.stage === 'regional' ? 1 : 2;
  const stageTitle = rung === 0 ? `${team.conference} tournament`
    : rung === 1 ? 'The regionals' : 'The national tournament';

  const qualified = inTheField
    ? {
        good: true,
        title: `${ordinal(mySeed)} seed`,
        lines: [
          `Double elimination. Two losses and it is winter.`,
          `Finish top ${CONF_ADVANCE} and you play a regional.`,
        ],
      }
    : {
        good: false,
        title: 'Season over',
        lines: [
          `${team.def.school} finished outside the top ${CONF_FIELD}.`,
          'A third of the league goes home in May.',
        ],
      };

  /*
    Where the year stopped — or didn't.

    Reported from testing: *"we won the first and lost the second and got
    knocked out."* He had, of that tournament, and the card told him his
    season was over. It was not: second place in a conference tournament goes
    to a regional, and a protected top-four seed reaches the national field
    whatever its regional does. `knockout.advanced` is the store's answer to
    that, worked out at the moment of elimination.

    Kept short on purpose. These cards are read at the loudest moment in a
    season and a paragraph is not read at all.
  */
  const howFar = (() => {
    const kind = knockout?.kind ?? 'conference';
    const where = knockout?.label ? ` in the ${knockout.label}` : '';
    const place = knockout?.placing ?? 0;

    if (kind === 'conference' && knockout?.advanced) {
      const finished = place === 2 ? 'Runners up'
        : place === 3 ? 'Third in the league'
        : 'Fourth in the league';
      return {
        good: true,
        title: finished,
        lines: [
          `${team.def.school} are out of the ${team.conference} tournament.`,
          'But the top four travel. A regional championship series is next.',
        ],
      };
    }
    if (kind === 'conference') {
      return {
        good: false,
        title: 'Out in May',
        lines: [
          `${team.def.school} fall${where} of the ${team.conference} tournament.`,
          'Winter is for getting the bats loud again.',
        ],
      };
    }
    if (kind === 'regional' && knockout?.advanced) {
      return {
        good: true,
        title: 'Protected',
        lines: [
          `${team.def.school} lose the regional championship series.`,
          'The regular season already bought the national field. You travel anyway.',
        ],
      };
    }
    if (kind === 'regional') {
      return {
        good: false,
        title: 'Out at the regional',
        lines: [
          `${team.def.school} lose the regional championship series.`,
          'One series from the national field. Close enough to sting.',
        ],
      };
    }
    if (kind === 'opening') {
      return {
        good: false,
        title: 'Out in the opening round',
        lines: [
          `${team.def.school} fall in the national opening round.`,
          'Twenty teams made the field. You were one of them.',
        ],
      };
    }
    if (kind === 'final') {
      return {
        good: false,
        title: 'Runners up',
        lines: [
          `${team.def.school} lose the national championship series.`,
          'Second best in the country, and it still feels like this.',
        ],
      };
    }
    return {
      good: false,
      title: 'Out of the showdown',
      lines: [
        `${team.def.school} take a second loss${where}.`,
        'Sixteen reach the showdown. Most of the country never sees it.',
      ],
    };
  })();

  // A banner and a sentence. Anything longer is read at the one moment nobody
  // is reading.
  const wonCard = bracket.stage === 'conference'
    ? {
        kicker: `${year} ${team.conference.toUpperCase()}`,
        title: 'Conference champions',
        lines: [`${team.def.school} take the ${team.conference}. Gas up the bus.`],
      }
    : bracket.stage === 'regional'
      ? {
          kicker: `${year} REGIONAL`,
          title: 'Regional champions',
          lines: [`${team.def.school} win the region, and a seat at the national table.`],
        }
      : {
          kicker: `${year} NATIONAL CHAMPIONSHIP`,
          title: 'National champions',
          lines: [`${team.def.school} win it all. Nobody left to beat.`],
        };

  /** What the pinned button does right now. */
  const due = myBracket
    ? (myBracket.format === 'series'
      ? nextGameFor(myBracket.state, userTeam) !== null
      : liveSlotFor(myBracket.state, userTeam) !== null)
    : false;
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
    : myBracket
      ? {
          label: iAmOut ? 'SEE THE NEXT GAMES' : 'PLAY THE NEXT GAMES',
          run: () => sim('round'),
          secondary: iAmOut
            ? { label: 'SIM TO THE END OF THE TOURNAMENT', onClick: () => sim('rest') }
            : null,
        }
      : stagePlayed
        ? {
            label: bracket.stage === 'conference'
              ? (wonConference ? 'ON TO THE REGIONALS' : 'SEE THE REGIONALS')
              : bracket.stage === 'regional'
                ? (wonRegional ? 'ON TO THE NATIONALS' : 'SEE THE NATIONALS')
                : 'END THE SEASON',
            run: advance,
          }
        // The national stage names its own next step, because "CONTINUE" over
        // four different things is how a player ends up looking at a finished
        // tournament wondering when it was played.
        : bracket.stage === 'national'
          ? {
              label: !nat || nat.opening.length < 4 ? 'PLAY THE OPENING ROUND'
                : (!nat.bracketA || !nat.bracketB) ? 'PLAY THE SHOWDOWN'
                : 'PLAY THE CHAMPIONSHIP',
              run: advance,
            }
          : { label: 'CONTINUE', run: advance };

  return (
    <>
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
          kicker={howFar.good ? `${year} · STILL ALIVE` : `${year} · SEASON OVER`}
          title={howFar.title}
          lines={howFar.lines}
          tone={howFar.good ? 'win' : 'clay'}
          action={howFar.good
            ? (knockout?.kind === 'conference' ? 'ON TO THE REGIONAL' : 'ON TO THE NATIONALS')
            : 'SEE THE REST OF IT'}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'won' && (
        <Modal
          kicker={wonCard.kicker}
          title={wonCard.title}
          lines={wonCard.lines}
          tone="win"
          action="LET'S GO"
          onClose={() => setModal(null)}
        />
      )}

      {showLineup && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'var(--field)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            flex: 'none', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '10px 14px',
            borderBottom: '2px solid var(--ink)', background: 'var(--field)',
          }}>
            <div className="label">POSTSEASON · YOUR CARD</div>
            <button
              onClick={() => setShowLineup(false)}
              className="tap"
              style={{
                padding: '8px 14px', minHeight: 36,
                background: 'var(--ink)', border: '1px solid var(--ink)',
                color: 'var(--cream)', font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
              }}
            >DONE</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <Lineup />
          </div>
        </div>
      )}

      {/*
        The frame: pinned header (title + stage nav + secondary toggle),
        scrolling brackets, and the action button OUTSIDE the scroller so it
        holds its position whatever tab is up and however long its content is.
      */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <FirstVisit id="postseason" />
        <div style={{
          flex: 'none', background: 'var(--field)',
          borderBottom: '1px solid var(--faint)',
        }}>
          <div style={{ padding: '10px 14px 0' }}>
            <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
              <div className="label">{year} POSTSEASON · STAGE {rung + 1} OF 3</div>
              <div style={{
                font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 3, textTransform: 'uppercase',
              }}>{stageTitle}</div>
            </div>
          </div>

          <StageRail at={rung} />

          {bracket.stage === 'conference' && (
            <SubToggle
              options={[['winners', 'WINNERS'], ['losers', 'LOSERS']]}
              at={confView}
              onGo={(v) => setConfView(v as ConfView)}
            />
          )}
          {bracket.stage === 'national' && (
            <SubToggle
              options={[['opening', 'OPENING'], ['winners', 'WINNERS'], ['losers', 'LOSERS']]}
              at={natView}
              onGo={(v) => setNatView(v as NatView)}
            />
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ padding: '8px 0 10px' }}>
            {/*
              A bracket game a phone call took away.

              The same offer the dashboard makes, because June has its own
              frame and the dashboard is not in it — and a postseason game is
              the one you least want to lose.
            */}
            {pendingGame && (
              <div style={{ padding: '0 14px', marginBottom: 8 }}>
                <div className="rise-in" style={{
                  border: '1px solid var(--clay)', borderLeft: '5px solid var(--clay)',
                  background: 'var(--paper)',
                }}>
                  <div style={{ padding: '5px 11px', background: 'var(--clay)' }}>
                    <span style={{
                      font: "600 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.18em',
                      color: 'var(--cream)',
                    }}>GAME IN PROGRESS</span>
                  </div>
                  <div style={{ padding: '10px 12px 11px' }}>
                    <div style={{
                      font: "800 calc(16px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
                    }}>{pendingGame.line}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                      <button
                        onClick={() => void resumeGame(true)}
                        className="tap"
                        style={{
                          flex: 1, padding: '11px 8px', minHeight: 42,
                          background: 'var(--clay)', border: '1px solid var(--clay)',
                          color: 'var(--cream)', font: "700 calc(10px * var(--ts)) var(--mono)",
                          letterSpacing: '.1em',
                        }}
                      >PICK IT UP</button>
                      <button
                        onClick={() => void resumeGame(false)}
                        className="tap"
                        style={{
                          flex: 1, padding: '11px 8px', minHeight: 42,
                          background: 'transparent', border: '1px solid rgba(28,36,48,.4)',
                          color: 'var(--ink)', font: "700 calc(10px * var(--ts)) var(--mono)",
                          letterSpacing: '.1em',
                        }}
                      >LET THEM FINISH</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {myBracket && !iAmOut && <YourNext
              myBracket={myBracket} userTeam={userTeam} name={name}
              onLineup={() => setShowLineup(true)}
            />}

            {bracket.stage === 'conference' && (
              <ConferenceStage
                cups={bracket.cups}
                mine={myBracket?.kind === 'conference' && myBracket.format === 'double'
                  ? myBracket.state : null}
                myConference={team.conference}
                view={confView}
                abbr={abbr}
                userTeam={userTeam}
              />
            )}

            {bracket.stage === 'regional' && (
              <RegionalStage
                regionals={bracket.regionals}
                mine={myBracket?.kind === 'regional' && myBracket.format === 'series'
                  ? {
                      state: myBracket.state,
                      meta: myBracket.meta ?? null,
                    }
                  : null}
                myRegion={regionOf(team.conference)}
                season={season}
                abbr={abbr}
                userTeam={userTeam}
              />
            )}

            {bracket.stage === 'national' && (
              <NationalStage
                nat={nat}
                myBracket={myBracket}
                sideShow={sideShow}
                view={natView}
                abbr={abbr}
                userTeam={userTeam}
              />
            )}
          </div>
        </div>

        {/* Pinned to the frame, not the scroll. Same spot, every tab. */}
        <div style={{
          flex: 'none', padding: '0 14px',
          background: 'var(--field)', borderTop: '1px solid var(--faint)',
        }}>
          <FloatingAction
            label={action.label}
            onClick={action.run}
            secondary={action.secondary ?? null}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Header furniture
// ---------------------------------------------------------------------------

/** Where you are in June. The blurbs are gone; the tutorial teaches instead. */
function StageRail({ at }: { at: number }) {
  const NAMES = ['CONFERENCE', 'REGIONALS', 'NATIONAL'];
  return (
    <div style={{ margin: '8px 14px 0', display: 'flex', gap: 3 }}>
      {NAMES.map((n, i) => (
        <div key={n} style={{ flex: 1 }}>
          <div style={{
            height: 4,
            background: i < at ? 'rgba(168,68,42,.42)'
              : i === at ? 'var(--clay)' : 'var(--faint)',
            transition: 'background 220ms ease',
          }} />
          <div style={{
            marginTop: 4, font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em',
            color: i === at ? 'var(--clay)' : 'var(--dim)', textAlign: 'center',
          }}>{n}</div>
        </div>
      ))}
    </div>
  );
}

/** The winners/losers (and opening) toggle, in the app's own clothes. */
function SubToggle(
  { options, at, onGo }:
  { options: [string, string][]; at: string; onGo: (v: string) => void },
) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 14px 8px' }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onGo(v)}
          className="tap"
          style={{
            flex: 1, padding: '7px 0', minHeight: 32,
            background: v === at ? 'var(--clay)' : 'var(--paper)',
            border: v === at ? '1px solid var(--clay)' : '1px solid rgba(28,36,48,.28)',
            color: v === at ? 'var(--cream)' : 'var(--ink)',
            font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.1em',
          }}
        >{label}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your next game
// ---------------------------------------------------------------------------

/** What you are due to play, and the door to your lineup. */
function YourNext(
  { myBracket, userTeam, name, onLineup }:
  {
    myBracket: NonNullable<ReturnType<typeof useDynasty.getState>['myBracket']>;
    userTeam: number;
    name: (i: number) => string;
    onLineup: () => void;
  },
) {
  let line: string | null = null;
  let sub: string | null = null;

  if (myBracket.format === 'series') {
    const next = nextGameFor(myBracket.state, userTeam);
    const s = liveSeries(myBracket.state, userTeam);
    if (next && s) {
      const host = hostOfGame(s, s.games.length);
      const other = next.a === userTeam ? next.b : next.a;
      line = `${host === userTeam ? 'vs' : 'at'} ${name(other)}`;
      const wins = (t: number): number => s.games.filter((g) => g.winner === t).length;
      const len = myBracket.state.lengths[s.round] ?? 3;
      sub = `Game ${s.games.length + 1} of ${len} · you ${wins(userTeam)}-${wins(other)} · first to ${clincher(len)}`;
    }
  } else {
    const slot = liveSlotFor(myBracket.state, userTeam);
    if (slot && slot.a !== null && slot.b !== null) {
      const host = slot.side === 'F' ? slot.a
        : (slot.aSeed <= slot.bSeed ? slot.a : slot.b);
      const other = slot.a === userTeam ? slot.b : slot.a;
      line = `${host === userTeam ? 'vs' : 'at'} ${name(other)}`;
      const losses = myBracket.state.losses.get(userTeam) ?? 0;
      /*
        The stake, before the game rather than after it.

        Reported from testing: he came through the losers bracket, won the
        first final, lost the second and was out — and had no way of knowing
        beforehand that he needed both. In a double elimination the man
        arriving unbeaten needs one win and the man arriving with a loss needs
        two, and "Championship · the reset" is bracket jargon that teaches
        nobody that. So the card says it in words.
      */
      if (slot.side === 'F') {
        sub = losses === 0
          ? 'Championship · win one and it is yours'
          : 'Championship · you must win this AND the next one';
      } else {
        sub = `${slotName(slot)} · ${losses === 0 ? 'unbeaten' : 'one loss, elimination baseball'}`;
      }
    }
  }
  if (!line) return null;

  return (
    <div style={{ padding: '0 14px', marginBottom: 8 }}>
      <div style={{
        border: '1px solid var(--faint)', borderLeft: '3px solid var(--clay)',
        background: 'var(--paper)', padding: '9px 11px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: "700 calc(15px * var(--ts))/1.1 var(--display)", textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{line}</div>
          {sub && <div style={{
            marginTop: 2, font: "400 calc(9.5px * var(--ts)) var(--mono)", color: 'var(--dim)',
          }}>{sub}</div>}
        </div>
        <button
          onClick={onLineup}
          className="tap"
          style={{
            flex: 'none', padding: '8px 10px', minHeight: 36,
            background: 'var(--field)', border: '1px solid rgba(28,36,48,.4)',
            color: 'var(--ink)', font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.08em',
          }}
        >LINEUP</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage bodies
// ---------------------------------------------------------------------------

function ConferenceStage(
  { cups, mine, myConference, view, abbr, userTeam }:
  {
    cups: ConferenceTournament[];
    mine: DoubleElim | null;
    myConference: string;
    view: ConfView;
    abbr: (i: number) => string;
    userTeam: number;
  },
) {
  // Yours first, live or finished; then the rest of the country.
  const rows: { conference: string; de: DECols; you: boolean }[] = [];
  if (mine) {
    rows.push({
      conference: myConference, you: true,
      de: { winners: mine.winners, losers: mine.losers, final: mine.final },
    });
  }
  for (const c of [...cups].sort((a, b) =>
    (a.conference === myConference ? -1 : 0) - (b.conference === myConference ? -1 : 0))) {
    if (!c.de) continue;
    rows.push({
      conference: c.conference,
      you: c.conference === myConference,
      de: c.de as DECols,
    });
  }

  return (
    <>
      {rows.map((r) => (
        <div key={r.conference} style={{ marginBottom: 10 }}>
          <div style={{
            margin: '0 14px 4px', paddingBottom: 3,
            borderBottom: '2px solid var(--ink)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label" style={{ color: r.you ? 'var(--clay)' : 'var(--ink)' }}>
              {r.conference}{r.you ? ' · YOU' : ''}
            </span>
          </div>
          <DoubleElimMap de={r.de} view={view} abbr={abbr} userTeam={userTeam} />
        </div>
      ))}
    </>
  );
}

function RegionalStage(
  { regionals, mine, myRegion, season, abbr, userTeam }:
  {
    regionals: RegionalSeries[];
    mine: {
      state: SeriesBracket;
      meta: { region: string; name: string; aLabel: string; bLabel: string } | null;
    } | null;
    myRegion: string;
    season: { teams: ReadonlyArray<{ def: { abbr: string } }> };
    abbr: (i: number) => string;
    userTeam: number;
  },
) {
  void season;
  const byRegion = new Map<string, RegionalSeries[]>();
  for (const r of regionals) {
    byRegion.set(r.region, [...(byRegion.get(r.region) ?? []), r]);
  }
  const order = [...REGIONS].sort((a, b) =>
    (a.id === myRegion ? -1 : 0) - (b.id === myRegion ? -1 : 0));

  return (
    <>
      {order.map((region) => {
        const list = byRegion.get(region.id) ?? [];
        const mineHere = mine && (mine.meta?.region ?? myRegion) === region.id
          ? mine : null;
        if (list.length === 0 && !mineHere) return null;
        return (
          <div key={region.id} style={{ padding: '0 14px', marginBottom: 12 }}>
            <div style={{
              paddingBottom: 3, marginBottom: 6, borderBottom: '2px solid var(--ink)',
            }}>
              <span className="label" style={{
                color: region.id === myRegion ? 'var(--clay)' : 'var(--ink)',
              }}>
                {region.name.toUpperCase()} REGIONAL
                {region.id === myRegion ? ' · YOU' : ''}
              </span>
            </div>
            {mineHere && (
              <LiveSeriesCard
                state={mineHere.state}
                aLabel={mineHere.meta?.aLabel ?? ''}
                bLabel={mineHere.meta?.bLabel ?? ''}
                abbr={abbr}
                userTeam={userTeam}
              />
            )}
            {list.map((r, i) => (
              <SeriesResultCard key={i} r={r} abbr={abbr} userTeam={userTeam} />
            ))}
          </div>
        );
      })}
    </>
  );
}

/** A finished (or simulated) best-of-three, as a card. */
function SeriesResultCard(
  { r, abbr, userTeam, tag }:
  { r: RegionalSeries | (TournamentResult & { aLabel?: string; bLabel?: string });
    abbr: (i: number) => string; userTeam: number; tag?: string },
) {
  const a = r.seeds[0]; const b = r.seeds[1];
  if (a === undefined || b === undefined) return null;
  const winsOf = (t: number): number => r.games.filter(
    (g) => (g.homeRuns > g.awayRuns ? g.home : g.away) === t,
  ).length;
  return (
    <div style={{
      marginBottom: 6,
      border: (a === userTeam || b === userTeam)
        ? '1.5px solid var(--clay)' : '1px solid var(--faint)',
      background: 'var(--paper)',
    }}>
      {tag && (
        <div style={{
          padding: '3px 9px', background: 'var(--ink)',
          font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--cream)',
        }}>{tag}</div>
      )}
      <TeamLine
        team={a} label={(r as RegionalSeries).aLabel} wins={winsOf(a)}
        champion={r.champion === a} abbr={abbr} userTeam={userTeam} top
      />
      <TeamLine
        team={b} label={(r as RegionalSeries).bLabel} wins={winsOf(b)}
        champion={r.champion === b} abbr={abbr} userTeam={userTeam}
      />
    </div>
  );
}

/** A matchup that exists and has not been played. Both names, no scores. */
function PendingSeriesCard(
  { a, b, aLabel, bLabel, abbr, userTeam }:
  {
    a: number; b: number; aLabel: string; bLabel: string;
    abbr: (i: number) => string; userTeam: number;
  },
) {
  const mine = a === userTeam || b === userTeam;
  return (
    <div style={{
      marginBottom: 6,
      border: mine ? '1.5px solid var(--clay)' : '1px solid var(--faint)',
      background: 'var(--paper)',
    }}>
      <div style={{
        padding: '3px 9px', background: 'var(--field)',
        borderBottom: '1px solid var(--hairline)',
        font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--dim)',
      }}>BEST OF 3 · NOT PLAYED</div>
      <TeamLine team={a} label={aLabel} wins={0} champion={false}
        abbr={abbr} userTeam={userTeam} top />
      <TeamLine team={b} label={bLabel} wins={0} champion={false}
        abbr={abbr} userTeam={userTeam} />
    </div>
  );
}

/** The user's live series, game by game. */
function LiveSeriesCard(
  { state, aLabel, bLabel, abbr, userTeam }:
  {
    state: SeriesBracket; aLabel: string; bLabel: string;
    abbr: (i: number) => string; userTeam: number;
  },
) {
  const s: Series | undefined = state.rounds[0]?.[0];
  if (!s || s.a === null || s.b === null) return null;
  const wins = (t: number): number => s.games.filter((g) => g.winner === t).length;
  const len = state.lengths[0] ?? 3;
  return (
    <div style={{
      marginBottom: 6, border: '1.5px solid var(--clay)', background: 'var(--paper)',
    }}>
      <div style={{
        padding: '3px 9px', background: 'var(--clay)',
        font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--cream)',
      }}>
        BEST OF {len} · {s.winner === null
          ? `GAME ${s.games.length + 1}`
          : 'FINAL'}
      </div>
      <TeamLine
        team={s.a} label={aLabel} wins={wins(s.a)}
        champion={s.winner === s.a} abbr={abbr} userTeam={userTeam} top
      />
      <TeamLine
        team={s.b} label={bLabel} wins={wins(s.b)}
        champion={s.winner === s.b} abbr={abbr} userTeam={userTeam}
      />
    </div>
  );
}

function TeamLine(
  { team, label, wins, champion, abbr, userTeam, top }:
  {
    team: number; label?: string; wins: number; champion: boolean;
    abbr: (i: number) => string; userTeam: number; top?: boolean;
  },
) {
  const tint = teamColour(abbr(team));
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 9px',
      borderBottom: top ? '1px solid var(--hairline)' : 'none',
      borderLeft: `3px solid ${tint}`,
      background: champion ? `${tint}1c` : 'transparent',
    }}>
      <span style={{
        flex: 'none', font: `${champion ? 700 : 600} calc(12px * var(--ts)) var(--mono)`,
        color: tint, letterSpacing: '.04em',
      }}>
        {abbr(team)}{team === userTeam ? ' ★' : ''}
      </span>
      {label && (
        <span style={{
          font: "400 calc(8.5px * var(--ts)) var(--mono)", color: 'var(--dim)', letterSpacing: '.06em',
        }}>{label}</span>
      )}
      <span style={{ flex: 1 }} />
      {champion && (
        <span style={{
          font: "700 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: tint,
        }}>CHAMPIONS</span>
      )}
      <span style={{
        font: `${champion ? 800 : 600} calc(14px * var(--ts)) var(--display)`,
        minWidth: 14, textAlign: 'right',
      }}>{wins}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The national stage
// ---------------------------------------------------------------------------

function NationalStage(
  { nat, myBracket, sideShow, view, abbr, userTeam }:
  {
    nat: NationalProgress | null;
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    sideShow: ReturnType<typeof useDynasty.getState>['sideShow'];
    view: NatView;
    abbr: (i: number) => string;
    userTeam: number;
  },
) {
  if (!nat) {
    return (
      <div style={{
        padding: '20px 14px', textAlign: 'center',
        font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
      }}>The field is being announced.</div>
    );
  }
  const seeds = nat.field.seeds;

  if (view === 'opening') {
    return (
      <div style={{ padding: '0 14px' }}>
        <div style={{
          paddingBottom: 3, marginBottom: 6, borderBottom: '2px solid var(--ink)',
        }}>
          <span className="label">SEEDS 1–12 · BYE TO THE SHOWDOWN</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {seeds.slice(0, 12).map((t, i) => (
            <span key={t} style={{
              padding: '4px 8px',
              border: t === userTeam ? '1.5px solid var(--clay)' : '1px solid var(--faint)',
              borderLeft: `3px solid ${teamColour(abbr(t))}`,
              background: 'var(--paper)',
              font: "600 calc(9.5px * var(--ts)) var(--mono)", color: teamColour(abbr(t)),
            }}>
              <span style={{ color: 'var(--dim)' }}>{i + 1} </span>
              {abbr(t)}{t === userTeam ? ' ★' : ''}
              {nat.field.protectedTeams.includes(t) && (
                <span style={{ color: 'var(--dim)' }}> · P</span>
              )}
            </span>
          ))}
        </div>

        <div style={{
          paddingBottom: 3, marginBottom: 6, borderBottom: '2px solid var(--ink)',
        }}>
          <span className="label">OPENING ROUND · SEEDS 13–20 · BEST OF 3</span>
        </div>
        {myBracket?.kind === 'opening' && myBracket.format === 'series' && (
          <LiveSeriesCard
            state={myBracket.state}
            aLabel={`#${seeds.indexOf(myBracket.state.seeds[0] ?? -1) + 1}`}
            bLabel={`#${seeds.indexOf(myBracket.state.seeds[1] ?? -1) + 1}`}
            abbr={abbr}
            userTeam={userTeam}
          />
        )}
        {/*
          Every pairing, played or not. The four series used to appear only
          once they had results, so a player arriving at this stage saw an
          empty tab and then, one press later, four finished series he never
          saw start. The matchups are drawn from the seeding — which is fixed
          the moment the field is chosen — and fill in as they are played.
        */}
        {([[12, 19], [13, 18], [14, 17], [15, 16]] as const).map(([hi, lo], i) => {
          const a = seeds[hi]; const b = seeds[lo];
          if (a === undefined || b === undefined) return null;
          const live = myBracket?.kind === 'opening' && myBracket.format === 'series'
            && myBracket.state.seeds.includes(a) && myBracket.state.seeds.includes(b)
            ? myBracket : null;
          if (live) {
            return (
              <LiveSeriesCard
                key={i}
                state={live.state}
                aLabel={`#${hi + 1}`} bLabel={`#${lo + 1}`}
                abbr={abbr} userTeam={userTeam}
              />
            );
          }
          const done = nat.opening.find(
            (o) => o.seeds.includes(a) && o.seeds.includes(b),
          );
          if (done) {
            return (
              <SeriesResultCard
                key={i}
                r={{ ...done, aLabel: `#${done.aSeed}`, bLabel: `#${done.bSeed}` }}
                abbr={abbr}
                userTeam={userTeam}
                tag="FINAL"
              />
            );
          }
          return (
            <PendingSeriesCard
              key={i}
              a={a} b={b}
              aLabel={`#${hi + 1}`} bLabel={`#${lo + 1}`}
              abbr={abbr} userTeam={userTeam}
            />
          );
        })}
        <div style={{
          marginTop: 4, font: "400 calc(10px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          P marks a protected top four seed from the regular season. Protection
          buys the field and the bye, never a banner.
        </div>
      </div>
    );
  }

  /*
    The showdown: two eight-team double eliminations, then the championship.

    Each half is one of three things and the header says which: the one you
    are playing, the one being played beside it, or a finished result. Before
    this, a live bracket sat next to a finished one with nothing to
    distinguish them, which is what read as "everything is already played".
  */
  const half = (which: 'A' | 'B'): { de: DECols; tag: string; tone: string } | null => {
    if (myBracket?.kind === 'national' && myBracket.format === 'double'
      && myBracket.half === which) {
      const s = myBracket.state;
      return {
        de: { winners: s.winners, losers: s.losers, final: s.final },
        tag: 'YOUR BRACKET · LIVE', tone: 'var(--clay)',
      };
    }
    if (sideShow && sideShow.half === which) {
      const s = sideShow.state;
      return {
        de: { winners: s.winners, losers: s.losers, final: s.final },
        tag: 'LIVE', tone: 'var(--ink)',
      };
    }
    const r = which === 'A' ? nat.bracketA : nat.bracketB;
    return r
      ? {
          de: { winners: r.winners, losers: r.losers, final: r.final },
          tag: 'FINAL', tone: 'var(--dim)',
        }
      : null;
  };

  return (
    <>
      {(['A', 'B'] as const).map((label) => {
        const h = half(label);
        return (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{
            margin: '0 14px 4px', paddingBottom: 3, borderBottom: '2px solid var(--ink)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label">NATIONAL BRACKET {label}</span>
            {h && (
              <span style={{
                font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: h.tone,
              }}>{h.tag}</span>
            )}
          </div>
          {h
            ? <DoubleElimMap de={h.de} view={view === 'losers' ? 'losers' : 'winners'}
                abbr={abbr} userTeam={userTeam} />
            : (
              <div style={{
                padding: '10px 14px', font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
              }}>Waiting on the opening round.</div>
            )}
        </div>
        );
      })}

      <div style={{ padding: '0 14px', marginBottom: 10 }}>
        <div style={{
          paddingBottom: 3, marginBottom: 6, borderBottom: '2px solid var(--ink)',
        }}>
          <span className="label">NATIONAL CHAMPIONSHIP · BEST OF 3</span>
        </div>
        {myBracket?.kind === 'final' && myBracket.format === 'series' ? (
          <LiveSeriesCard
            state={myBracket.state}
            aLabel="BRACKET A" bLabel="BRACKET B"
            abbr={abbr} userTeam={userTeam}
          />
        ) : nat.final ? (
          <SeriesResultCard
            r={{ ...nat.final, aLabel: 'BRACKET A', bLabel: 'BRACKET B' }}
            abbr={abbr} userTeam={userTeam}
          />
        ) : (
          <div style={{
            padding: '8px 0', font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
          }}>The two bracket champions meet here.</div>
        )}
      </div>
    </>
  );
}

const ordinal = (n: number): string => {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
};
