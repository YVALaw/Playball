// Postseason.tsx
// June, one stage at a time.
//
// Reported from testing: a 25-8 season pressed one button and arrived at the
// awards screen. The postseason had happened, somewhere, to somebody. That is
// the single worst place in a dynasty game to elide, because the whole year is
// an argument about whether you deserve to be here — and then you are not shown.
//
// Four stages, each with something to look at: your conference tournament, the
// field being announced, your regional, and Omaha. The rest of the country is a
// result; your own games are yours to manage, one at a time, exactly as they are
// in the regular season.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FloatingAction } from '../Sticky.js';
import { teamColour } from '../Avatar.js';
import { regionalGroups } from '../../engine/postseason.js';
import type { BracketGame, TournamentResult, Bid } from '../../engine/postseason.js';
import type { SeasonState } from '../../engine/season.js';

const STAGE_TITLE: Record<string, string> = {
  conference: 'Conference tournaments',
  selection: 'Selection day',
  regional: 'The regionals',
  omaha: 'Omaha',
  done: 'The season is over',
};

const STAGE_LABEL: Record<string, string> = {
  conference: 'STAGE 1 OF 4',
  selection: 'STAGE 2 OF 4',
  regional: 'STAGE 3 OF 4',
  omaha: 'STAGE 4 OF 4',
  done: 'FINAL',
};

const NEXT_LABEL: Record<string, string> = {
  conference: 'PLAY THE CONFERENCE TOURNAMENTS',
  selection: 'ANNOUNCE THE FIELD',
  regional: 'PLAY THE REGIONALS',
  omaha: 'PLAY OMAHA',
  done: 'TO THE AWARDS',
};

/**
 * The same buttons when your season is already over.
 *
 * Reported from testing: a board saying you were knocked out, above a button
 * saying PLAY OMAHA. Telling a player he is eliminated and then offering to let
 * him play is the kind of thing that makes people think the game is broken.
 */
const WATCH_LABEL: Record<string, string> = {
  conference: 'PLAY THE CONFERENCE TOURNAMENTS',
  selection: 'ANNOUNCE THE FIELD',
  regional: 'WATCH THE REGIONALS',
  omaha: 'SEE WHO WINS IT',
  done: 'TO THE AWARDS',
};

/** The four steps, and what each one is. Shown as a rail on every stage. */
const LADDER: { key: string; name: string; blurb: string }[] = [
  { key: 'conference', name: 'CONFERENCE', blurb: 'Six teams per conference, double elimination. Win it and you are in.' },
  { key: 'selection', name: 'SELECTION', blurb: 'Sixteen teams: eight conference champions, eight at large on RPI.' },
  { key: 'regional', name: 'REGIONALS', blurb: 'Four regionals of four, double elimination. Win yours to reach Omaha.' },
  { key: 'omaha', name: 'OMAHA', blurb: 'The four regional winners. Last one standing is national champion.' },
];

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

  /** Your games in a finished bracket, which is the only part you sat through. */
  const myGames = (t: TournamentResult | null): BracketGame[] =>
    (t?.games ?? []).filter((g) => g.home === userTeam || g.away === userTeam);

  const myCup = bracket.cups.find((c) => c.conference === team.conference) ?? null;
  const myRegional = bracket.regionals.find(
    (r) => r.seeds.includes(userTeam),
  ) ?? null;
  const inField = bracket.field.some((b) => b.team === userTeam);
  const wonCup = myCup?.champion === userTeam;

  // Your tournament, mid-flight. `due` is the game waiting for you; null means a
  // bye, or that your run is over and the rest is just being played out.
  const live = myBracket ? myBracket.state : null;
  const out = live ? live.eliminated.includes(userTeam) : false;
  const due = live && !out ? nextGame() : null;

  // Whether you are still playing for something, which decides what the button
  // is allowed to call itself.
  const stillIn = bracket.stage === 'conference'
    || (bracket.field.length === 0 || bracket.field.some((b) => b.team === userTeam))
    && (bracket.regionals.length === 0 || bracket.regionals.some((r) => r.champion === userTeam));

  const labels = stillIn ? NEXT_LABEL : WATCH_LABEL;

  const action = due
    ? { label: 'PLAY THIS GAME', run: manage }
    : live
      ? out
        ? { label: 'PLAY OUT THE TOURNAMENT', run: () => sim('rest') }
        : { label: 'ON TO YOUR NEXT GAME', run: () => sim('until') }
      : { label: labels[bracket.stage] ?? 'CONTINUE', run: advance };

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
        <Section title={LIVE_TITLE[myBracket.kind] ?? 'YOUR BRACKET'}>
          {(() => {
            const played = live.games.filter(
              (g) => g.home === userTeam || g.away === userTeam,
            );
            const w = played.filter((g) => g.winner === userTeam).length;
            return (
              <>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 8,
                }}>
                  <span style={{ font: "800 26px/1 var(--display)" }}>
                    {w}-{played.length - w}
                  </span>
                  <span style={{ font: "400 12px var(--body)", color: 'var(--dim)' }}>
                    {out
                      ? 'Knocked out. Two losses and you are done.'
                      : live.unbeaten.includes(userTeam)
                        ? 'Still unbeaten.'
                        : 'One loss. The next one ends it.'}
                  </span>
                </div>

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
                    A bye — the best seed left standing sits the round out. The
                    rest of the bracket plays on without you.
                  </div>
                )}

                <Games games={played} userTeam={userTeam} season={season} />
              </>
            );
          })()}
        </Section>
      )}

      {/* Stage one is finished once the cups exist. */}
      {myCup && (
        <Section title={`${team.conference} TOURNAMENT`}>
          <Verdict
            good={wonCup}
            text={wonCup
              ? `${team.def.school} win the conference — an automatic bid.`
              : myCup.seeds.includes(userTeam)
                ? `Knocked out. ${name(myCup.champion)} took the automatic bid.`
                : `You did not make the eight team field. ${name(myCup.champion)} won it.`}
          />
          <Games games={myGames(myCup)} userTeam={userTeam} season={season} />
        </Section>
      )}

      {bracket.stage === 'selection' && (
        <Note>
          Every conference champion is in. The rest of the field is chosen on RPI,
          which is where a soft non-conference schedule finally shows up.
        </Note>
      )}

      {bracket.field.length > 0 && (
        <Section title="THE NATIONAL FIELD">
          <Verdict
            good={inField}
            text={inField
              ? `${team.def.school} are in — ${bracket.field.find((b) => b.team === userTeam)?.kind === 'automatic' ? 'automatic bid' : 'at large'}.`
              : 'Left out. The season ends here.'}
          />
          {/*
            Grouped into the four regionals rather than listed one to sixteen.
            Reported from testing: "it does not look like rankings, it is
            organized in a weird way" — because it was neither a ranking nor a
            bracket, just sixteen tags in seed order. These are the games.
          */}
          <Field field={bracket.field} userTeam={userTeam} name={name} abbr={abbr} />
        </Section>
      )}

      {myRegional && (
        <Section title="YOUR REGIONAL">
          <Verdict
            good={myRegional.champion === userTeam}
            text={myRegional.champion === userTeam
              ? `${team.def.school} win the regional and are going to Omaha.`
              : `Out in the regional. ${name(myRegional.champion)} advanced.`}
          />
          <Games games={myGames(myRegional)} userTeam={userTeam} season={season} />
        </Section>
      )}

      {bracket.omaha && (
        <Section title="OMAHA">
          <Verdict
            good={bracket.omaha.champion === userTeam}
            text={bracket.omaha.champion === userTeam
              ? `${team.def.school} are national champions.`
              : `${name(bracket.omaha.champion)} win the national title.`}
          />
          {myGames(bracket.omaha).length > 0 && (
            <Games games={myGames(bracket.omaha)} userTeam={userTeam} season={season} />
          )}
        </Section>
      )}

      <FloatingAction label={action.label} onClick={action.run} />
    </div>
  );
}

/**
 * Where you are in June.
 *
 * Four steps, always visible, with the one you are on named and explained. The
 * postseason is the part of the year with the most rules and it was the part
 * with the least explanation on screen — "then I had a button to play the
 * regionals" is what that feels like from the other side.
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

/** Who hosts: the better seed, which is exactly how the bracket decides it. */
function hostOf(
  live: { seedOf: Map<number, number> },
  due: { a: number; b: number },
): number {
  const sa = live.seedOf.get(due.a) ?? Number.MAX_SAFE_INTEGER;
  const sb = live.seedOf.get(due.b) ?? Number.MAX_SAFE_INTEGER;
  return sa <= sb ? due.a : due.b;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 12, padding: '11px 12px', background: 'var(--paper)',
      borderLeft: '3px solid var(--faint)',
      font: "400 12px/1.55 var(--body)", color: 'var(--dim)',
    }}>{children}</div>
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

/**
 * Your games, in the order they were played.
 *
 * Only yours. A regional is a dozen games and eleven of them happened to other
 * people; listing them all would bury the four that were about you.
 */
function Games(
  { games, userTeam, season }:
  { games: readonly BracketGame[]; userTeam: number; season: SeasonState },
) {
  if (games.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {games.map((g, i) => {
        const home = g.home === userTeam;
        const us = home ? g.homeRuns : g.awayRuns;
        const them = home ? g.awayRuns : g.homeRuns;
        const won = us > them;
        const other = home ? g.away : g.home;
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr auto',
            gap: 8, alignItems: 'baseline',
            padding: '7px 0', borderTop: '1px solid var(--hairline)',
          }}>
            <span style={{
              font: "700 9px var(--mono)", letterSpacing: '.08em',
              color: won ? 'var(--win)' : 'var(--clay)', minWidth: 14,
            }}>{won ? 'W' : 'L'}</span>
            <span style={{ font: "400 12px var(--body)" }}>
              {home ? 'vs' : 'at'} {season.teams[other]?.def.school ?? '?'}
            </span>
            <span style={{ font: "600 12px var(--mono)" }}>{us}-{them}</span>
          </div>
        );
      })}
    </div>
  );
}
