// Postseason.tsx
// June, one stage at a time.
//
// Reported from testing, twice. First: a 25-8 season pressed one button and
// arrived at the awards screen — the postseason had happened, somewhere, to
// somebody. Then, once it could be played: "I'm still a bit lost… I won 2 and
// lost 2 and then it was over… we have to make it easier to understand visually
// so that everything is clear, like a real bracket, where we see who advances
// and who stays behind."
//
// So the rules are on the screen now rather than assumed. Every tournament shows
// its full field with each team's record and whether they are still alive, every
// game is listed with its winner, and finishing a tournament no longer skips
// past its own result on the way to the next screen.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FloatingAction } from '../Sticky.js';
import { teamColour } from '../Avatar.js';
import { regionalGroups } from '../../engine/postseason.js';
import type {
  BracketGame, Bid, BracketState,
} from '../../engine/postseason.js';

const STAGE_TITLE: Record<string, string> = {
  conference: 'Conference tournament',
  selection: 'The regionals',
  regional: 'The regionals',
  omaha: 'Omaha',
  done: 'The season is over',
};

const STAGE_LABEL: Record<string, string> = {
  conference: 'STAGE 1 OF 3',
  selection: 'STAGE 2 OF 3',
  regional: 'STAGE 2 OF 3',
  omaha: 'STAGE 3 OF 3',
  done: 'FINAL',
};

/** The four steps, and what each one is. Shown as a rail on every stage. */
const LADDER: { key: string; name: string; blurb: string }[] = [
  {
    key: 'conference', name: 'CONFERENCE',
    blurb: 'Your conference plays a six team tournament. Double elimination: two losses and you are out. Win it and you are in the national field whatever your record says.',
  },
  {
    key: 'regional', name: 'REGIONALS',
    blurb: 'Sixteen teams — the eight conference champions plus eight at large on RPI — split into four regionals of four. Double elimination again, so two losses ends your season. Win yours and you go to Omaha.',
  },
  {
    key: 'omaha', name: 'OMAHA',
    blurb: 'The four regional winners, one last double elimination. Whoever is standing at the end is national champion.',
  },
];

/** What the button does when you play the stage. */
const PLAY_LABEL: Record<string, string> = {
  conference: 'PLAY THE TOURNAMENT',
  selection: 'PLAY THE REGIONAL',
  regional: 'PLAY THE REGIONAL',
  omaha: 'PLAY OMAHA',
};

/**
 * The same buttons when your season is already over.
 *
 * Reported from testing: a board saying you were knocked out, above a button
 * saying PLAY OMAHA. Telling a player he is eliminated and then offering to let
 * him play is the kind of thing that makes people think the game is broken.
 */
const WATCH_LABEL: Record<string, string> = {
  conference: 'PLAY THE TOURNAMENT',
  selection: 'WATCH THE REGIONALS',
  regional: 'WATCH THE REGIONALS',
  omaha: 'SEE WHO WINS IT',
};

/** And what it does once the stage has been played and there is a result up. */
const CONTINUE_LABEL: Record<string, string> = {
  conference: 'ON TO THE REGIONALS',
  selection: 'ON TO OMAHA',
  regional: 'ON TO OMAHA',
  omaha: 'END THE SEASON',
  done: 'END THE SEASON',
};

const LIVE_TITLE: Record<string, string> = {
  conference: 'YOUR CONFERENCE TOURNAMENT',
  regional: 'YOUR REGIONAL',
  omaha: 'OMAHA',
};

export function Postseason() {
  const season = useDynasty((s) => s.season);
  const bracket = useDynasty((s) => s.bracket);
  const myBracket = useDynasty((s) => s.myBracket);
  const advance = useDynasty((s) => s.advanceBracket);
  const nextGame = useDynasty((s) => s.myNextGame);
  const manage = useDynasty((s) => s.manageBracketGame);
  const sim = useDynasty((s) => s.simBracket);
  const userTeam = useDynasty((s) => s.userTeam);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();
  const version = useDynasty((s) => s.version);
  void version;

  if (!season || !team || !bracket) return null;

  const name = (i: number) => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number) => season.teams[i]?.def.abbr ?? '?';

  const myCup = bracket.cups.find((c) => c.conference === team.conference) ?? null;
  const myRegional = bracket.regionals.find((r) => r.seeds.includes(userTeam)) ?? null;
  const inField = bracket.field.some((b) => b.team === userTeam);

  // Your tournament, mid-flight. `due` is the game waiting for you; null means a
  // bye, or that your run is over and the rest is just being played out.
  const live = myBracket ? myBracket.state : null;
  const out = live ? live.eliminated.includes(userTeam) : false;
  const due = live && !out ? nextGame() : null;

  // Has this stage been played? Playing it and leaving it are different
  // presses now, and the button has to say which one it is.
  const stagePlayed =
    bracket.stage === 'conference' ? bracket.cups.length > 0
    : bracket.stage === 'selection' ? bracket.field.length > 0
    : bracket.stage === 'regional' ? bracket.regionals.length > 0
    : bracket.stage === 'omaha' ? bracket.omaha !== null
    : true;

  // Still playing for something?
  const alive =
    bracket.field.length > 0 && !inField ? false
    : bracket.regionals.length > 0 && !bracket.regionals.some((r) => r.champion === userTeam)
      ? false
      : true;

  const action = due
    ? { label: 'PLAY THIS GAME', run: manage }
    : live
      ? out
        ? { label: 'PLAY IT OUT', run: () => sim('rest') }
        : { label: 'ON TO YOUR NEXT GAME', run: () => sim('until') }
      : stagePlayed
        ? { label: CONTINUE_LABEL[bracket.stage] ?? 'CONTINUE', run: advance }
        : {
            label: (alive ? PLAY_LABEL : WATCH_LABEL)[bracket.stage] ?? 'CONTINUE',
            run: advance,
          };

  return (
    <div style={{ padding: '14px 14px 22px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
        <div className="label">{year} POSTSEASON · {STAGE_LABEL[bracket.stage]}</div>
        <div style={{
          font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>{STAGE_TITLE[bracket.stage]}</div>
      </div>

      <Ladder stage={bracket.stage} />

      {/* Your own bracket, a game at a time. */}
      {live && myBracket && (
        <>
          <Section title={LIVE_TITLE[myBracket.kind] ?? 'YOUR BRACKET'}>
            <Standing live={live} userTeam={userTeam} out={out} />
            {due && (
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)',
              }}>
                <div className="label">{due.round.toUpperCase()}</div>
                <div style={{
                  font: "700 20px/1.1 var(--display)", marginTop: 4,
                  textTransform: 'uppercase',
                }}>
                  {hostOf(live, due) === userTeam ? 'vs ' : 'at '}
                  {name(due.a === userTeam ? due.b : due.a)}
                </div>
                <button
                  onClick={() => sim('round')}
                  style={{
                    marginTop: 10, width: '100%', padding: '10px 0',
                    background: 'transparent', border: '1px solid rgba(28,36,48,.42)',
                    font: "700 10px var(--mono)", letterSpacing: '.12em',
                    color: 'var(--ink)',
                  }}
                >SIMULATE IT INSTEAD</button>
              </div>
            )}
            {!due && !out && (
              <div style={{
                marginTop: 8, font: "400 12px/1.5 var(--body)", color: 'var(--dim)',
              }}>
                A bye — the best seed left standing sits the round out. The rest of
                the bracket plays on without you.
              </div>
            )}
          </Section>

          <Board
            title="THE BRACKET"
            seeds={live.seeds}
            games={live.games}
            eliminated={live.eliminated}
            champion={live.champion}
            userTeam={userTeam}
            name={name}
            abbr={abbr}
          />
        </>
      )}

      {/* Stage one, finished. */}
      {!live && myCup && (
        <>
          <Section title={`${team.conference} TOURNAMENT`}>
            <Verdict
              good={myCup.champion === userTeam}
              text={myCup.champion === userTeam
                ? `${team.def.school} win the conference — an automatic bid to the national field.`
                : myCup.seeds.includes(userTeam)
                  ? `${name(myCup.champion)} won it and take the automatic bid. You need an at-large place now, and the national field is announced next.`
                  : `You did not make the six team field. ${name(myCup.champion)} won it.`}
            />
          </Section>
          <Board
            title={`${team.conference} BRACKET`}
            seeds={myCup.seeds}
            games={myCup.games}
            eliminated={myCup.eliminated}
            champion={myCup.champion}
            userTeam={userTeam}
            name={name}
            abbr={abbr}
          />
        </>
      )}

      {bracket.field.length > 0 && !live && bracket.regionals.length === 0 && (
        <Section title="THE NATIONAL FIELD">
          <Verdict
            good={inField}
            text={inField
              ? `${team.def.school} are in — ${bracket.field.find((b) => b.team === userTeam)?.kind === 'automatic' ? 'an automatic bid, as conference champions' : 'an at-large place, on RPI'}.`
              : 'Left out. Sixteen teams got in and you were not one of them; the season ends here.'}
          />
          <Field field={bracket.field} userTeam={userTeam} name={name} abbr={abbr} />
        </Section>
      )}

      {!live && myRegional && (
        <>
          <Section title="YOUR REGIONAL">
            <Verdict
              good={myRegional.champion === userTeam}
              text={myRegional.champion === userTeam
                ? `${team.def.school} win the regional and are going to Omaha.`
                : `Out in the regional — two losses ends it. ${name(myRegional.champion)} advanced.`}
            />
          </Section>
          <Board
            title="REGIONAL BRACKET"
            seeds={myRegional.seeds}
            games={myRegional.games}
            eliminated={myRegional.eliminated}
            champion={myRegional.champion}
            userTeam={userTeam}
            name={name}
            abbr={abbr}
          />
        </>
      )}

      {!live && bracket.omaha && (
        <>
          <Section title="OMAHA">
            <Verdict
              good={bracket.omaha.champion === userTeam}
              text={bracket.omaha.champion === userTeam
                ? `${team.def.school} are national champions.`
                : `${name(bracket.omaha.champion)} win the national title.`}
            />
          </Section>
          <Board
            title="OMAHA BRACKET"
            seeds={bracket.omaha.seeds}
            games={bracket.omaha.games}
            eliminated={bracket.omaha.eliminated}
            champion={bracket.omaha.champion}
            userTeam={userTeam}
            name={name}
            abbr={abbr}
          />
        </>
      )}

      <FloatingAction label={action.label} onClick={action.run} />
    </div>
  );
}

/** Your record in the tournament you are in, and what it means. */
function Standing(
  { live, userTeam, out }: { live: BracketState; userTeam: number; out: boolean },
) {
  const played = live.games.filter((g) => g.home === userTeam || g.away === userTeam);
  const w = played.filter((g) => g.winner === userTeam).length;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ font: "800 26px/1 var(--display)" }}>{w}-{played.length - w}</span>
      <span style={{ font: "400 12px var(--body)", color: 'var(--dim)' }}>
        {out
          ? 'Two losses. You are out.'
          : live.unbeaten.includes(userTeam)
            ? 'Still unbeaten. Two losses would end it.'
            : 'One loss. The next one ends it.'}
      </span>
    </div>
  );
}

/**
 * A tournament, whole: who is left, who went home, and every game.
 *
 * Double elimination does not draw as a single elimination ladder — a team can
 * lose and still be playing — so the honest picture is the standing plus the
 * results rather than a diagram of lines. This is what answers "how did the
 * regional get resolved if I won 2 and lost 2".
 */
/**
 * A tournament as rounds you tab between, with the games as cards.
 *
 * Modelled on how a real bracket app reads: pick a round, see the matchups,
 * winner in black with the score, loser greyed out. The whole set of results at
 * once was accurate and unreadable — sixteen lines of "DLT beat GLP" is a log,
 * not a bracket.
 *
 * The first tab is the field itself, because double elimination has no shape a
 * ladder can draw: a team can lose and still be playing, so "who is still alive"
 * is a fact you have to state rather than something the diagram shows.
 */
function Board(
  { title, seeds, games, eliminated, champion, userTeam, name, abbr }:
  {
    title: string;
    seeds: readonly number[];
    games: readonly BracketGame[];
    eliminated: readonly number[];
    champion: number | null;
    userTeam: number;
    name: (i: number) => string;
    abbr: (i: number) => string;
  },
) {
  const [tab, setTab] = useState(0);

  const record = (t: number) => {
    const mine = games.filter((g) => g.home === t || g.away === t);
    const w = mine.filter((g) => g.winner === t).length;
    return { w, l: mine.length - w };
  };

  // Champion first, then whoever is still alive, then the eliminated in reverse
  // order — the last man out ranks above the first.
  const rank = (t: number): number => {
    if (t === champion) return -1;
    const i = eliminated.indexOf(t);
    return i < 0 ? 0 : eliminated.length - i;
  };
  const order = [...seeds].sort(
    (a, b) => rank(a) - rank(b) || seeds.indexOf(a) - seeds.indexOf(b),
  );

  const rounds: { round: string; games: BracketGame[] }[] = [];
  for (const g of games) {
    const last = rounds[rounds.length - 1];
    if (last && last.round === g.round) last.games.push(g);
    else rounds.push({ round: g.round, games: [g] });
  }

  const tabs = ['TEAMS', ...rounds.map((r) => shortRound(r.round))];
  const here = Math.min(tab, tabs.length - 1);
  const shown = rounds[here - 1];

  return (
    <>
      <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>{title}</div>

      {/* The round strip. Scrolls sideways rather than wrapping, so the shape of
          the tournament stays one line however deep it goes. */}
      <div style={{
        display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
      }}>
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{
              flex: 'none', padding: '7px 11px', whiteSpace: 'nowrap',
              background: i === here ? 'var(--clay)' : 'var(--paper)',
              border: `1px solid ${i === here ? 'var(--clay)' : 'rgba(28,36,48,.22)'}`,
              color: i === here ? 'var(--cream)' : 'var(--dim)',
              font: "700 9px var(--mono)", letterSpacing: '.1em',
            }}
          >{t}</button>
        ))}
      </div>

      {here === 0 ? (
        <div style={{
          marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {order.map((t) => {
            const r = record(t);
            const gone = eliminated.includes(t);
            const won = t === champion;
            const mine = t === userTeam;
            return (
              <div key={t} style={{
                display: 'grid', gridTemplateColumns: '22px 1fr auto auto',
                gap: 8, alignItems: 'center',
                padding: '9px 10px', borderBottom: '1px solid var(--hairline)',
                borderLeft: mine ? '3px solid var(--clay)' : '3px solid transparent',
                background: mine ? 'rgba(168,68,42,.10)' : 'transparent',
                opacity: gone && !mine ? 0.55 : 1,
              }}>
                <span style={{
                  font: "700 10px var(--mono)", color: 'var(--dim)',
                }}>{seeds.indexOf(t) + 1}</span>
                <span style={{
                  font: `${mine || won ? 700 : 400} 12.5px var(--body)`,
                  color: mine ? 'var(--clay)' : 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{name(t)}</span>
                <span style={{
                  font: "600 11px var(--mono)", color: 'var(--dim)',
                }}>{r.w}-{r.l}</span>
                <span style={{
                  font: "700 8px var(--mono)", letterSpacing: '.1em', minWidth: 52,
                  textAlign: 'right',
                  color: won ? 'var(--win)' : gone ? 'var(--dim)' : 'var(--clay)',
                }}>{won ? 'CHAMPION' : gone ? 'OUT' : 'ALIVE'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {(shown?.games ?? []).map((g, i) => (
            <Matchup
              key={i}
              game={g}
              round={shown?.round ?? ''}
              seeds={seeds}
              userTeam={userTeam}
              name={name}
              abbr={abbr}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** One game, as a card: both teams, seeds, score, winner in black. */
function Matchup(
  { game, round, seeds, userTeam, name, abbr }:
  {
    game: BracketGame; round: string; seeds: readonly number[]; userTeam: number;
    name: (i: number) => string; abbr: (i: number) => string;
  },
) {
  const rows: { team: number; runs: number }[] = [
    { team: game.home, runs: game.homeRuns },
    { team: game.away, runs: game.awayRuns },
  ].sort((a, b) => b.runs - a.runs);

  return (
    <div style={{
      marginBottom: 8, background: 'var(--paper)',
      border: '1px solid var(--faint)',
      boxShadow: '0 1px 3px rgba(28,36,48,.07)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 11px', borderBottom: '1px solid var(--hairline)',
      }}>
        <span className="label">{round}</span>
        <span style={{
          font: "700 9px var(--mono)", letterSpacing: '.12em', color: 'var(--dim)',
        }}>FINAL</span>
      </div>
      {rows.map((r, i) => {
        const winner = r.team === game.winner;
        const mine = r.team === userTeam;
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '30px 22px 1fr auto',
            gap: 8, alignItems: 'center', padding: '10px 11px',
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: '50%',
              background: teamColour(abbr(r.team)),
              color: 'var(--cream)', font: "700 11px var(--mono)",
              display: 'grid', placeItems: 'center',
              opacity: winner ? 1 : 0.5,
            }}>{abbr(r.team).slice(0, 1)}</span>
            <span style={{
              font: "700 10px var(--mono)", color: 'var(--dim)', textAlign: 'right',
            }}>{seeds.indexOf(r.team) + 1}</span>
            <span style={{
              font: `${winner ? 700 : 400} 13.5px var(--body)`,
              color: mine ? 'var(--clay)' : winner ? 'var(--ink)' : 'var(--dim)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{name(r.team)}</span>
            <span style={{
              font: `${winner ? 700 : 400} 15px var(--mono)`,
              color: winner ? 'var(--ink)' : 'var(--dim)',
            }}>{r.runs}</span>
          </div>
        );
      })}
    </div>
  );
}

/** "Winners round 2" is a tab label of about four characters. */
function shortRound(round: string): string {
  const m = /(\d+)/.exec(round);
  if (/^Championship, if/i.test(round)) return 'GAME 2';
  if (/^Championship/i.test(round)) return 'FINAL';
  if (/^Winners/i.test(round)) return `W${m ? m[1] : ''}`;
  if (/^Elimination/i.test(round)) return `E${m ? m[1] : ''}`;
  return round.toUpperCase();
}

/** Who hosts: the better seed, which is exactly how the bracket decides it. */
function hostOf(
  live: { seedOf: Map<number, number> },
  due: { a: number; b: number },
): number {
  const sa = live.seedOf.get(due.a) ?? Number.MAX_SAFE_INTEGER;
  const sb = live.seedOf.get(due.b) ?? Number.MAX_SAFE_INTEGER;
  return sa <= sb ? due.a : due.b;
}

/**
 * Where you are in June.
 *
 * Four steps, always visible, with the one you are on named and explained. The
 * postseason is the part of the year with the most rules and it was the part
 * with the least explanation on screen.
 */
function Ladder({ stage }: { stage: string }) {
  const at = LADDER.findIndex((l) => l.key === stage);
  const here = at < 0 ? LADDER.length - 1 : at;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {LADDER.map((l, i) => (
          <div key={l.key} style={{ flex: 1 }}>
            <div style={{
              height: 4,
              background: i < here ? 'rgba(168,68,42,.42)'
                : i === here ? 'var(--clay)' : 'var(--faint)',
            }} />
            <div style={{
              marginTop: 5, font: "600 8px var(--mono)", letterSpacing: '.08em',
              color: i === here ? 'var(--clay)' : 'var(--dim)',
              textAlign: 'center',
            }}>{l.name}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 9, padding: '10px 12px', background: 'var(--paper)',
        borderLeft: '3px solid var(--clay)',
        font: "400 12px/1.5 var(--body)",
      }}>{LADDER[here]?.blurb}</div>
    </div>
  );
}

/**
 * The sixteen team field, as four regionals.
 *
 * Seeds one to sixteen are a ranking; who plays whom is the thing you actually
 * want to know, and it is decided the moment the field is announced.
 */
function Field(
  { field, userTeam, name, abbr }:
  {
    field: readonly Bid[]; userTeam: number;
    name: (i: number) => string; abbr: (i: number) => string;
  },
) {
  const seedOf = new Map(field.map((b, i) => [b.team, i + 1]));
  const groups = regionalGroups(field);
  return (
    <div style={{ marginTop: 10 }}>
      {groups.map((g, gi) => {
        const mine = g.includes(userTeam);
        return (
          <div key={gi} style={{
            marginTop: gi === 0 ? 0 : 8,
            border: `1px solid ${mine ? 'var(--clay)' : 'var(--hairline)'}`,
            background: mine ? 'rgba(168,68,42,.07)' : 'transparent',
          }}>
            <div style={{
              padding: '5px 8px', borderBottom: '1px solid var(--hairline)',
              font: "600 8.5px var(--mono)", letterSpacing: '.14em',
              color: mine ? 'var(--clay)' : 'var(--dim)',
            }}>
              {mine ? `REGIONAL ${gi + 1} · YOURS` : `REGIONAL ${gi + 1}`}
            </div>
            {g.map((t) => (
              <div key={t} style={{
                display: 'grid', gridTemplateColumns: '26px 1fr auto',
                gap: 8, alignItems: 'baseline', padding: '5px 8px',
              }}>
                <span style={{
                  font: "700 10px var(--mono)", color: 'var(--dim)',
                }}>{seedOf.get(t)}</span>
                <span style={{
                  font: `${t === userTeam ? 700 : 400} 12px var(--body)`,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{name(t)}</span>
                <span style={{
                  font: "600 9.5px var(--mono)", color: teamColour(abbr(t)),
                }}>{abbr(t)}</span>
              </div>
            ))}
          </div>
        );
      })}
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

function Verdict({ good, text }: { good: boolean; text: string }) {
  return (
    <div style={{
      font: "400 13px/1.5 var(--body)",
      color: good ? 'var(--win)' : 'var(--ink)',
      fontWeight: good ? 600 : 400,
    }}>{text}</div>
  );
}
