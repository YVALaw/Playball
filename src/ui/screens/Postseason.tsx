// Postseason.tsx
// June, in three championships.
//
// CONFERENCE: eight of twelve into a double elimination, top four finishers
// advance, the champion hangs a banner. REGIONALS: sixteen best-of-three
// championship series crossing neighbouring conferences, sixteen banners.
// NATIONAL: those sixteen champions plus four protected or at-large bids,
// twenty in all — split into two ten-team double eliminations whose bottom
// four apiece play their way in, and the two bracket champions play a
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
import { BoxScoreSheet } from './Schedule.js';
import { teamColour } from '../Avatar.js';
import {
  conferenceField, liveSeries, nextGameFor, hostOfGame, roundName, clincher,
  regionOf, REGIONS, CONF_FIELD, CONF_ADVANCE,
} from '../../engine/postseason.js';
import type {
  Series, SeriesBracket, RegionalSeries, ConferenceTournament, TournamentResult,
} from '../../engine/postseason.js';
import {
  liveSlotFor, slotName, nextRoundName,
  type DoubleElim, type DESlot,
} from '../../engine/doubleElim.js';
import { FirstVisit } from '../Tutorial.js';

type ConfView = 'winners' | 'losers';
type NatView = 'winners' | 'losers';

/*
  The toggles remember themselves across an unmount — managing a game covers
  this screen, and coming back to a different tab than you left reads as the
  screen forgetting you. Module scope on purpose: session-long, never saved,
  exactly the lifetime a view preference deserves.
*/
let confViewMemo: ConfView = 'winners';
let natViewMemo: NatView = 'winners';

export function Postseason() {
  const [modal, setModal] = useState<'in' | 'out' | 'won' | 'title' | null>(null);
  const [showLineup, setShowLineup] = useState(false);
  /*
    A bracket game, opened.

    Box scores are stored only for the user's own program, so this is honest
    about what it can offer: a slot whose day has a box shows the whole game,
    and everything else stays a score. Storing every line for ninety-six
    programs would put tens of thousands of rows in a save to serve a screen
    almost nobody opens for a game they were not in.
  */
  const [openDay, setOpenDay] = useState<number | null>(null);
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

  /*
    Two different questions, and conflating them was half the bug.

    `reported` is "there is an elimination this year that has not been shown" —
    true whether or not it ended the season, because losing a conference final
    and going on to a regional is still news. `knockedOut` is "your June is
    over", which an advancing exit is not. The screen used to ask the first and
    act on the second, so a team that advanced spent the rest of the postseason
    being treated as finished.
  */
  const reported = knockout !== null && knockout.year === year;
  const knockedOut = reported && !knockout!.advanced;
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
  const outKey = reported && knockout ? `${year}:out:${knockout.kind}` : '';

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

  /*
    A title game, announced before it is played.

    Reported as wanting a modal when a competition's championship is on, rather
    than the game being one more card inside a bracket. It is the same surface
    as the trophy card by design — the request was for one thing that changes
    state, not two things to dismiss — so this says who, what is at stake and
    what winning takes, and the crown card above takes over once it is decided.

    Fires once per title game and never again, keyed like every other card June
    raises. A modal that reappeared every time you came back to the bracket
    would be a modal you learn to tap through without reading.
  */
  const titleGame = (() => {
    if (!myBracket || iAmOut || !season || !team || !bracket) return null;
    const stake = (extra: string): string[] => [extra];
    if (myBracket.format === 'double') {
      const slot = liveSlotFor(myBracket.state, userTeam);
      if (!slot || slot.side !== 'F' || slot.a === null || slot.b === null) return null;
      const other = slot.a === userTeam ? slot.b : slot.a;
      const losses = myBracket.state.losses.get(userTeam) ?? 0;
      const where = bracket.stage === 'conference' ? `${team.conference} championship`
        : 'Bracket championship';
      return {
        key: `${year}:title:${stageKey}:${slot.round}`,
        kicker: `${year} · ${where.toUpperCase()}`,
        title: `${team.def.school} v ${(season.teams[other]?.def.school ?? '?')}`,
        lines: stake(losses === 0
          ? 'You arrived unbeaten. Win one and it is yours.'
          : 'You came through the losers bracket. You must win this one AND the next.'),
      };
    }
    if (myBracket.kind !== 'regional' && myBracket.kind !== 'final') return null;
    const s = liveSeries(myBracket.state, userTeam);
    const next = nextGameFor(myBracket.state, userTeam);
    if (!s || !next) return null;
    const other = next.a === userTeam ? next.b : next.a;
    const len = myBracket.state.lengths[s.round] ?? 3;
    const wins = (t: number): number => s.games.filter((g) => g.winner === t).length;
    const isFinal = myBracket.kind === 'final';
    return {
      key: `${year}:title:${myBracket.kind}`,
      kicker: isFinal ? `${year} · NATIONAL CHAMPIONSHIP` : `${year} · REGIONAL CHAMPIONSHIP`,
      title: `${team.def.school} v ${(season.teams[other]?.def.school ?? '?')}`,
      lines: stake(
        `Best of ${len}, first to ${clincher(len)}. You lead it ${wins(userTeam)}-${wins(other)}.`,
      ),
    };
  })();

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
      return;
    }
    // Last, because a trophy and an exit both outrank the game in front of you.
    if (titleGame && !seen.includes(titleGame.key)) {
      markSeen(titleGame.key);
      setModal('title');
    }
  }, [bracket, stageKey, outKey, winKey, introKey, seen, markSeen, stillIn, inTheField,
    titleGame]);

  if (!season || !team || !bracket) return null;

  /*
    Opening a bracket game.

    A slot carries the day its game was played, and box scores are filed by
    day — so the lookup is exact rather than a search, and it simply finds
    nothing for a game between two programs that are not yours. Nothing is a
    perfectly good answer here: the score is already on the card.
  */
  const openSlot = (slot: DESlot): void => {
    const day = slot.game?.day;
    if (day === undefined) return;
    if (!season.boxScores?.[day]) return;
    setOpenDay(day);
  };

  const name = (i: number): string => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';

  /*
    The trophy this stage has already handed out, if it has.

    Deliberately the *stage's* champion rather than only the user's: somebody
    else winning the country is still the biggest thing that happened, and the
    old screen's answer to it was a stripe at the foot of the page. A rival's
    title is a quiet card and yours is a loud one, which is the difference
    between reporting the news and celebrating.
  */
  const crown: Crown | null = (() => {
    if (!bracket) return null;
    if (bracket.stage === 'national') {
      const champ = nat?.final?.champion;
      if (champ === undefined) return null;
      return {
        team: champ, rung: 2,
        kicker: `${year} NATIONAL CHAMPIONS`,
        title: 'Champions of the country',
        line: champ === userTeam
          ? 'Everything this season was for.'
          : 'Somebody else takes it home this year.',
      };
    }
    if (bracket.stage === 'regional') {
      const mineRegional = bracket.regionals.find((r) => r.champion === userTeam);
      if (!mineRegional) return null;
      return {
        team: userTeam, rung: 1,
        kicker: `${year} REGIONAL CHAMPIONS`,
        title: 'A regional banner',
        line: 'On to the national tournament.',
      };
    }
    const mineCup = bracket.cups.find((c) => c.champion === userTeam);
    if (!mineCup) return null;
    return {
      team: userTeam, rung: 0,
      kicker: `${year} ${mineCup.conference} CHAMPIONS`,
      title: 'Conference champions',
      line: 'The league is yours.',
    };
  })();

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
          /*
            The button says which round it is about to play.

            Reported: it said PLAY THE NEXT GAMES and then played the play-in
            and the opening round together, so it was vague about a thing it
            was also wrong about. The engine steps one round now, and the
            button reads that round's own name — the same string the bracket
            column and the log use, so the three cannot drift.
          */
          label: (() => {
            const round = myBracket.format === 'double'
              ? nextRoundName(myBracket.state) : null;
            if (!round) return iAmOut ? 'SEE THE NEXT GAMES' : 'PLAY THE NEXT GAMES';
            return `${iAmOut ? 'SEE' : 'SIM'} THE ${round.toUpperCase()}`;
          })(),
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
              label: (!nat?.bracketA || !nat.bracketB) ? 'PLAY THE SHOWDOWN'
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
      {modal === 'title' && titleGame && (
        <Modal
          kicker={titleGame.kicker}
          title={titleGame.title}
          lines={titleGame.lines}
          tone="ink"
          action="TAKE THE FIELD"
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

      {/* A bracket game, opened. Same sheet the schedule uses, because a
          postseason box score is a box score. */}
      {openDay !== null && season.boxScores?.[openDay] && (
        <BoxScoreSheet
          box={season.boxScores[openDay]}
          season={season}
          onClose={() => setOpenDay(null)}
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
              options={[['winners', 'WINNERS'], ['losers', 'LOSERS']]}
              at={natView}
              onGo={(v) => setNatView(v as NatView)}
            />
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ padding: '8px 0 10px' }}>
            {/*
              Who won, at the top, where it cannot be missed.

              Reported plainly: the national champion sat at the foot of the
              page behind two full brackets, and *"I didn't even know it was
              down there"*. A champion is the loudest thing that happens in a
              season and it was reading as a footnote.

              It is the same card the takeover shows, kept rather than spent:
              the moment fires once, and then this stays for the rest of June so
              it can be read again.
            */}
            {crown && (
              <div style={{ padding: '0 14px', marginBottom: 8 }}>
                <CrownCard
                  crown={crown}
                  mine={crown.team === userTeam}
                  school={name(crown.team)}
                  abbr={abbr(crown.team)}
                />
              </div>
            )}
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
                onOpen={openSlot}
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
                onOpen={openSlot}
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
  { cups, mine, myConference, view, abbr, userTeam, onOpen }:
  {
    cups: ConferenceTournament[];
    mine: DoubleElim | null;
    myConference: string;
    view: ConfView;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen: (s: DESlot) => void;
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
          <DoubleElimMap de={r.de} view={view} abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
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
  { nat, myBracket, sideShow, view, abbr, userTeam, onOpen }:
  {
    nat: NationalProgress | null;
    myBracket: ReturnType<typeof useDynasty.getState>['myBracket'];
    sideShow: ReturnType<typeof useDynasty.getState>['sideShow'];
    view: NatView;
    abbr: (i: number) => string;
    userTeam: number;
    onOpen: (s: DESlot) => void;
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
                abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
            : (
              <div style={{
                padding: '10px 14px', font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
              }}>Waiting on the field to be drawn.</div>
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

/** A decided trophy: which one, who took it, and how loudly to say so. */
export interface Crown {
  team: number;
  /** 0 conference, 1 regional, 2 the country. Drives every size below. */
  rung: 0 | 1 | 2;
  kicker: string;
  title: string;
  line: string;
}

/**
 * The trophy card, at three intensities.
 *
 * One component rather than three, because a conference banner and a national
 * title are the same fact at different volumes, and the escalation is itself
 * information: a player who has seen the conference card knows immediately,
 * without reading a word, that the national one is bigger. Three separate
 * components would have drifted into three different designs and lost that.
 *
 * The loudest it goes is still type and colour. Sound, animation and a
 * full-screen celebration are the broadcast stage's job and are deliberately
 * not faked here with a bigger font.
 */
function CrownCard(
  { crown, mine, school, abbr }:
  { crown: Crown; mine: boolean; school: string; abbr: string },
) {
  const big = crown.rung === 2;
  const mid = crown.rung === 1;
  const ground = mine ? 'var(--win)' : 'var(--navy)';
  return (
    <div
      className="rise-in"
      style={{
        border: `1px solid ${ground}`,
        borderLeft: `${big ? 7 : mid ? 5 : 4}px solid ${ground}`,
        background: 'var(--paper)',
      }}
    >
      <div style={{ padding: '5px 11px', background: ground }}>
        <span style={{
          font: `600 calc(${big ? 9 : 8.5}px * var(--ts)) var(--mono)`,
          letterSpacing: '.18em', color: 'var(--cream)',
        }}>{crown.kicker}</span>
      </div>
      <div style={{ padding: big ? '14px 12px 15px' : '10px 12px 11px' }}>
        <div style={{
          font: `800 calc(${big ? 30 : mid ? 22 : 18}px * var(--ts))/0.95 var(--display)`,
          textTransform: 'uppercase', color: ground,
        }}>{school}</div>
        <div style={{
          marginTop: big ? 5 : 3,
          font: `700 calc(${big ? 13 : 11}px * var(--ts))/1.2 var(--display)`,
          letterSpacing: '.04em', textTransform: 'uppercase',
        }}>{crown.title}</div>
        <div style={{
          marginTop: 4, font: "400 calc(11px * var(--ts))/1.4 var(--body)",
          color: 'var(--dim)',
        }}>{crown.line}</div>
        <div style={{
          marginTop: 7, font: "500 calc(9px * var(--ts)) var(--mono)",
          letterSpacing: '.16em', color: 'var(--faint)',
        }}>{abbr}</div>
      </div>
    </div>
  );
}
