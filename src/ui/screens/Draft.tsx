// Draft.tsx
// Who left, where they went, and the one conversation you get to have about it.
//
// The roadmap's central tension used to be reported here and nothing more: you
// never keep your best players. That is still true, and it is still the point —
// but it is no longer a screen you only read. A man with eligibility left has
// been offered a professional contract and has not signed it yet, and what you
// say to him in the next minute decides whether he is in your lineup in
// February.
//
// The money is recruiting budget, out of the pool the board opens with in about
// ninety seconds. That is the whole design: keep the ace or sign the class.
//
// Four views because the draft is a national event with a local consequence.
// KEEP is the decision; DEPARTING is what it cost you; the BOARD is the
// country's story, which is worth reading now that a first round pick is two or
// three men in a year rather than sixty-four.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { draftChance } from '../../engine/progression.js';
import type { Departure } from '../../engine/progression.js';
import {
  draftEligible, keepPoints, pullHints,
  KEEP_PITCHES, KEEP_LABEL, KEEP_CASE, KEEP_RESTS_ON,
  type DraftedMan, type KeepPitch,
} from '../../engine/draft.js';
import { prestigeStars } from '../../engine/program.js';
import { windowBudget } from '../../engine/recruiting.js';
import { overallOf } from '../../engine/ratings.js';
import type { Pitcher, Player } from '../../engine/types.js';
import { Avatar } from '../Avatar.js';

type View = 'keep' | 'departing' | 'board' | 'undrafted';

const VIEW_LABEL: Record<View, string> = {
  keep: 'KEEP',
  departing: 'DEPARTING',
  board: 'BOARD',
  undrafted: 'UNDRAFTED',
};

const slotOf = (p: Player): string => (p.type === 'pitcher' ? (p as Pitcher).role : p.pos);

export function Draft() {
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const report = useDynasty((s) => s.lastOffseason);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  const board = season?.draft ?? null;
  const pending = board?.men.filter((m) => m.outcome === 'pending').length ?? 0;
  const [view, setView] = useState<View>(pending > 0 ? 'keep' : 'departing');

  const { undrafted, departing, national, mineLost, kept } = useMemo(() => {
    const drafted = report?.drafted ?? [];
    const graduated = report?.graduated ?? [];
    const abbr = team?.def.abbr;
    const mine = [...drafted, ...graduated].filter((d) => d.teamAbbr === abbr);
    return {
      // The country's board, best round first. Capped because two hundred names
      // is a scroll nobody finishes and the interesting part is the top of it.
      national: drafted.slice(0, 80),
      // Seniors whose names were never called. Their careers are over.
      //
      // Walk-ons ride in the same list because the report has two arrays and
      // they belong in the one that is not the draft, but they are not this:
      // nobody's career ended, a one year lease simply ran out. Filtered here
      // rather than split upstream so the departing view still counts them as
      // men you lost, which is what they are.
      undrafted: graduated.filter((d) => d.reason === 'graduated')
        .sort((a, b) => b.overall - a.overall).slice(0, 40),
      departing: mine.sort((a, b) => b.overall - a.overall),
      mineLost: mine.filter((d) => !d.returned).length,
      kept: mine.filter((d) => d.returned).length,
    };
  }, [report, team, version]);

  if (!team) return null;

  // Before the offseason has run there is nothing to report, so the screen falls
  // back to the odds — which is what it is for outside the sequence.
  if (!report && !board) return <DraftOdds team={team} year={year} phase={phase} />;

  const holes = report?.holes ?? [];
  const stars = prestigeStars(team.prestige);
  const pool = windowBudget(stars);
  const left = pool - (board?.spent ?? 0);

  return (
    // Title, totals and the four views stay put; the list of names scrolls
    // under them. Same reason as the recruiting board: what you are looking at
    // and how many there are should not scroll away from the list itself.
    <FixedHeader header={
      <div style={{ padding: '14px 14px 10px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
        <div className="label">{year} · {team.def.abbr}</div>
        <div style={{
          font: "800 calc(22px * var(--ts))/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>Draft results</div>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="YOU LOST" v={String(mineLost)} accent={mineLost > 0} />
        <Tile k="TALKED ROUND" v={String(kept)} tone={kept > 0 ? 'var(--win)' : undefined} />
        <Tile k="BUDGET LEFT" v={String(left)} last />
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
        {(['keep', 'departing', 'board', 'undrafted'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px 0',
              background: v === view ? 'var(--clay)' : 'var(--paper)',
              border: v === view ? '1px solid var(--clay)' : '1px solid rgba(28,36,48,.28)',
              color: v === view ? 'var(--cream)' : 'var(--ink)',
              font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.06em',
            }}
          >{VIEW_LABEL[v]}{v === 'keep' && pending > 0 ? ` ${pending}` : ''}</button>
        ))}
      </div>
      </div>
    }
      action={phase !== null && (
    <FloatingAction
      label="TO RECRUITING"
      note={pending > 0
        ? `${pending} ${pending === 1 ? 'man is' : 'men are'} still waiting on an answer. Leaving now signs ${pending === 1 ? 'him' : 'them'}.`
        : undefined}
      onClick={() => void nextPhase('draft')}
    />
  )}
    >
    <FirstVisit id="draftphase" />
    <div style={{ padding: '10px 14px 22px' }}>
      {view === 'keep' && (
        <KeepList men={board?.men ?? []} left={left} pool={pool} abbr={team.def.abbr} />
      )}

      {view === 'departing' && (
        <>
          {/*
            The holes, first, above the names.

            This is the whole reason the draft runs before recruiting: a list of
            who left is a eulogy, and a list of what you are short of is a
            shopping list. It also answers the retention screen — talk a
            catcher out of professional ball and the catcher-shaped hole here
            closes while you watch.
          */}
          {holes.length > 0 && (
            <>
              <div className="label" style={{ marginBottom: 7 }}>THE HOLES THIS LEAVES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {holes.map((h, i) => (
                  <div
                    key={h.pos}
                    className="card-in"
                    style={{
                      padding: '7px 10px',
                      border: '1px solid var(--clay)',
                      background: 'rgba(168,68,42,.08)',
                      animationDelay: `${i * 40}ms`,
                    }}
                  >
                    <div style={{
                      font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
                    }}>{h.pos}</div>
                    <div style={{
                      marginTop: 2, font: "400 calc(8.5px * var(--ts)) var(--mono)", color: 'var(--dim)',
                    }}>{h.count > 1 ? `${h.count} needed` : 'need one'}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <Rows rows={departing} abbr={team.def.abbr} empty={
            'Nobody left. A whole roster returns, which almost never happens.'
          } />
        </>
      )}

      {view === 'board' && <NationalBoard rows={national} abbr={team.def.abbr} />}

      {view === 'undrafted' && (
        <Rows rows={undrafted} abbr={team.def.abbr} empty="Nobody here." />
      )}

      {/*
        There was a walk-on list here, and it rendered for nobody.

        `lastOffseason.walkOns` is filled by `fillRosters`, which runs at the
        year roll — and the year roll sets `phase` to null, which is what makes
        this screen unreachable. So the array was always empty at the only
        moment the block could have been drawn. The class review carries the
        shortfall now, before signing day rather than after it, where it is a
        thing you can still do something about instead of a receipt.
      */}
    </div>
    </FixedHeader>
  );
}

// ---------------------------------------------------------------------------
// Talking him out of it
// ---------------------------------------------------------------------------

function KeepList(
  { men, left, pool, abbr }:
  { men: readonly DraftedMan[]; left: number; pool: number; abbr: string },
) {
  // The row is the player; the conversation lives in a sheet the row opens.
  // Reported from testing: the inline version put four pitches, a stepper and
  // two buttons under every name and the list stopped being a list.
  const [open, setOpen] = useState<string | null>(null);
  const talking = men.find((m) => m.player.id === open) ?? null;

  if (men.length === 0) {
    return (
      <div style={{
        border: '1px solid var(--faint)', background: 'var(--paper)',
        padding: '18px 12px', font: "400 calc(12px * var(--ts))/1.55 var(--body)", color: 'var(--dim)',
        textAlign: 'center',
      }}>
        No club took a man of yours who still has eligibility, so there is
        nobody here to talk to.
      </div>
    );
  }
  return (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 7,
      }}>
        <span className="label">THE PHONE CALLS</span>
        <span style={{ font: "600 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
          {left} OF {pool} LEFT
        </span>
      </div>
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {men.map((man) => (
          <KeepRow
            key={man.player.id}
            man={man}
            abbr={abbr}
            onOpen={() => setOpen(man.player.id)}
          />
        ))}
      </div>
      {talking && (
        <KeepSheet man={talking} left={left} abbr={abbr} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

/** One man, one line, one state. The tap is the whole interface. */
function KeepRow(
  { man, abbr, onOpen }: { man: DraftedMan; abbr: string; onOpen: () => void },
) {
  const p = man.player;
  const done = man.outcome !== 'pending';
  const stayed = man.outcome === 'stayed';
  return (
    <button
      onClick={onOpen}
      className="tap"
      style={{
        width: '100%', textAlign: 'left', display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto', gap: 9, alignItems: 'center',
        padding: '10px 11px', background: 'transparent',
        borderBottom: '1px solid var(--hairline)',
        borderLeft: done
          ? `3px solid ${stayed ? 'var(--win)' : 'var(--dim)'}`
          : '3px solid var(--clay)',
      }}
    >
      <Avatar id={p.id} team={abbr} size={32} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: "700 calc(14px * var(--ts)) var(--body)",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{p.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
        }}>
          {slotOf(p)} · {p.classYear} · RD {man.round} · OVR {overallOf(p)}
        </span>
      </span>
      <span style={{
        font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.07em', whiteSpace: 'nowrap',
        color: done ? (stayed ? 'var(--win)' : 'var(--dim)') : 'var(--clay)',
      }}>
        {done ? (stayed ? 'STAYING' : 'SIGNED') : 'ON THE PHONE'}
      </span>
      <span aria-hidden style={{ font: "400 calc(13px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>›</span>
    </button>
  );
}

/**
 * The conversation, laid over the list.
 *
 * Everything the inline card used to hold — his hints, the four pitches, the
 * money, the handshake — in a sheet that exists only while you are actually
 * talking to him. After the answer, the same sheet reads back how the call
 * went, so a decided row still has its story.
 */
function KeepSheet(
  { man, left, abbr, onClose }:
  { man: DraftedMan; left: number; abbr: string; onClose: () => void },
) {
  const keepPlayer = useDynasty((s) => s.keepPlayer);
  const releasePlayer = useDynasty((s) => s.releasePlayer);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [pitch, setPitch] = useState<KeepPitch | null>(null);
  const [offer, setOffer] = useState(0);

  const p = man.player;
  const needs = keepPoints(man.round);
  const hints = pullHints(p);
  const done = man.outcome !== 'pending';
  const stayed = man.outcome === 'stayed';
  const set = (n: number) => setOffer(Math.max(0, Math.min(left, Math.round(n))));

  return (
    <div
      onClick={onClose}
      className="fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Talking to ${p.name}`}
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'rgba(28,36,48,.62)',
        display: 'grid', placeItems: 'end center', padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise-in"
        style={{
          width: '100%', maxHeight: '86%', overflowY: 'auto',
          background: 'var(--field)', borderTop: '2px solid var(--ink)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px 0',
        }}>
          <button
            onClick={() => openPlayer(p.id)}
            style={{
              display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left',
              background: 'transparent', padding: 0, minWidth: 0,
            }}
          >
            <Avatar id={p.id} team={abbr} size={38} />
            <span style={{ minWidth: 0 }}>
              <span style={{
                display: 'block', font: "800 calc(17px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</span>
              <span style={{
                display: 'block', marginTop: 3, font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
              }}>
                {slotOf(p)} · {p.classYear} · OVR {overallOf(p)} · ROUND {man.round} PICK
              </span>
            </span>
          </button>
          <button
            onClick={onClose}
            className="tap"
            aria-label="Close"
            style={{
              flex: 'none', padding: '8px 12px', minHeight: 36,
              background: 'transparent', border: '1px solid rgba(28,36,48,.3)',
              color: 'var(--dim)', font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.1em',
            }}
          >CLOSE</button>
        </div>

        <div style={{ padding: '10px 14px 14px' }}>
          <div style={{
            padding: '9px 11px', background: 'var(--paper)',
            borderLeft: '3px solid var(--faint)',
            font: "400 calc(12px * var(--ts))/1.55 var(--body)",
          }}>
            &ldquo;{hints[0]}&rdquo;<br />
            &ldquo;{hints[1]}&rdquo;
          </div>

          {!done && (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginTop: 12,
              }}>
                <span className="label">WHAT A ROUND {man.round} MAN WANTS</span>
                <span style={{ font: "700 calc(15px * var(--ts)) var(--display)", color: 'var(--clay)' }}>{needs}</span>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8,
              }}>
                {KEEP_PITCHES.map((k) => (
                  <button
                    key={k}
                    onClick={() => setPitch(k)}
                    className="tap"
                    style={{
                      padding: '9px 4px', minHeight: 36,
                      background: k === pitch ? 'var(--ink)' : 'var(--paper)',
                      border: k === pitch ? '1px solid var(--ink)' : '1px solid rgba(28,36,48,.28)',
                      color: k === pitch ? 'var(--cream)' : 'var(--ink)',
                      font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.07em',
                    }}
                  >{KEEP_LABEL[k]}</button>
                ))}
              </div>

              {pitch && (
                <>
                  <div style={{
                    marginTop: 9, padding: '9px 10px', background: 'var(--paper)',
                    borderLeft: '3px solid var(--ink)',
                  }}>
                    <div style={{ font: "400 calc(12px * var(--ts))/1.45 var(--body)" }}>
                      &ldquo;{KEEP_CASE[pitch]}&rdquo;
                    </div>
                    <div style={{
                      marginTop: 5, font: "400 calc(10.5px * var(--ts))/1.4 var(--mono)", color: 'var(--dim)',
                    }}>{KEEP_RESTS_ON[pitch]}</div>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
                  }}>
                    <span style={{
                      font: "800 calc(26px * var(--ts))/1 var(--display)",
                      color: offer > 0 ? 'var(--clay)' : 'var(--dim)',
                      minWidth: 44, textAlign: 'right',
                    }}>{offer}</span>
                    <Step label="−10" onClick={() => set(offer - 10)} off={offer === 0} />
                    <Step label="−1" onClick={() => set(offer - 1)} off={offer === 0} />
                    <Step label="+1" onClick={() => set(offer + 1)} off={offer >= left} />
                    <Step label="+10" onClick={() => set(offer + 10)} off={offer >= left} />
                    <Step label="ALL" onClick={() => set(left)} off={offer >= left} wide />
                  </div>

                  <button
                    onClick={() => keepPlayer(p.id, pitch, offer)}
                    disabled={offer <= 0}
                    style={{
                      width: '100%', marginTop: 10, padding: '13px 10px',
                      background: offer > 0 ? 'var(--clay)' : 'rgba(28,36,48,.12)',
                      border: '1px solid transparent',
                      color: offer > 0 ? 'var(--cream)' : 'var(--dim)',
                      font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                    }}
                  >MAKE THE CASE</button>
                </>
              )}

              <button
                onClick={() => releasePlayer(p.id)}
                style={{
                  width: '100%', marginTop: 6, padding: '9px 10px',
                  background: 'transparent', border: '1px solid rgba(28,36,48,.22)',
                  color: 'var(--dim)', font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                }}
              >SHAKE HIS HAND AND LET HIM GO</button>
            </>
          )}

          {done && (
            <div style={{ marginTop: 12 }}>
              <div style={{
                font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                color: stayed ? 'var(--win)' : 'var(--dim)',
              }}>{stayed ? 'HE IS COMING BACK' : 'HE SIGNED'}</div>
              <div style={{
                marginTop: 5, font: "400 calc(11.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
              }}>
                {man.pitch === null
                  ? 'You did not make a case, and he did not need one to make up his mind.'
                  : (
                    <>
                      You made the case on <strong style={{ color: 'var(--ink)' }}>
                        {KEEP_LABEL[man.pitch].toLowerCase()}
                      </strong> and put <strong style={{ color: 'var(--ink)' }}>
                        {man.offered}
                      </strong> behind it. It was worth {Math.round(man.made)} against
                      the {man.needed} a round {man.round} man wanted.
                      {stayed
                        ? ' He comes back a year older, a year better, and with no leverage at all next June. That is the bet you just made on his behalf.'
                        : ' Not enough, and the money is spent.'}
                    </>
                  )}
              </div>
              <button
                onClick={onClose}
                className="tap"
                style={{
                  width: '100%', marginTop: 10, padding: '12px 10px',
                  background: 'var(--ink)', border: '1px solid var(--ink)',
                  color: 'var(--cream)', font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                }}
              >BACK TO THE LIST</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step(
  { label, onClick, off, wide }:
  { label: string; onClick: () => void; off?: boolean; wide?: boolean },
) {
  return (
    <button
      onClick={onClick}
      disabled={off}
      className="tap"
      style={{
        flex: wide ? '0 0 40px' : 1, padding: '9px 0',
        background: 'transparent',
        border: '1px solid rgba(28,36,48,.22)',
        color: off ? 'rgba(28,36,48,.22)' : 'var(--ink)',
        font: "700 calc(10px * var(--ts)) var(--mono)",
      }}
    >{label}</button>
  );
}

// ---------------------------------------------------------------------------
// The lists
// ---------------------------------------------------------------------------

function Rows({ rows, abbr, empty }: { rows: Departure[]; abbr: string; empty: string }) {
  return (
    <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
      {rows.length === 0 && (
        <div style={{
          padding: '18px 12px', font: "400 calc(12px * var(--ts))/1.55 var(--body)", color: 'var(--dim)',
          textAlign: 'center',
        }}>{empty}</div>
      )}
      {rows.map((d) => (
        <DepartureRow key={d.id} d={d} mine={d.teamAbbr === abbr} />
      ))}
    </div>
  );
}

/**
 * The country's draft, round by round.
 *
 * Grouped rather than numbered pick by pick, because our ninety-six programs
 * supply only a slice of each thirty-name round and printing "3" beside the
 * third of our men in round seven would be inventing a pick number nobody
 * assigned him. The round is the fact; the order inside it is best first.
 */
function NationalBoard({ rows, abbr }: { rows: Departure[]; abbr: string }) {
  const blocks: { round: number; men: Departure[] }[] = [];
  for (const d of rows) {
    const round = d.round ?? 99;
    const last = blocks[blocks.length - 1];
    if (last && last.round === round) last.men.push(d);
    else blocks.push({ round, men: [d] });
  }
  if (blocks.length === 0) {
    return (
      <div style={{
        border: '1px solid var(--faint)', background: 'var(--paper)',
        padding: '18px 12px', font: "400 calc(12px * var(--ts))/1.55 var(--body)", color: 'var(--dim)',
        textAlign: 'center',
      }}>No club took anybody. That has never happened.</div>
    );
  }
  return (
    <>
      {blocks.map((b) => (
        <div key={b.round} style={{ marginBottom: 10 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 5,
          }}>
            <span className="label">ROUND {b.round}</span>
            <span style={{ font: "400 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
              {b.men.length}
            </span>
          </div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {b.men.map((d) => (
              <DepartureRow key={d.id} d={d} mine={d.teamAbbr === abbr} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** What the row says he did, and what colour it says it in. */
const EXIT: Record<Departure['reason'], { word: string; tag: string; tone: string }> = {
  drafted: { word: 'drafted', tag: 'RD', tone: 'var(--win)' },
  graduated: { word: 'graduated', tag: 'CAREER OVER', tone: 'var(--dim)' },
  // Not an ending. Nobody recruited him, so nothing held him for a second year.
  'walk-on': { word: 'walk-on', tag: 'YEAR UP', tone: 'var(--dim)' },
};

function DepartureRow({ d, mine }: { d: Departure; mine: boolean }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const exit = EXIT[d.reason] ?? EXIT.graduated;
  return (
    <button
      onClick={() => openPlayer(d.id)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
        gap: 9, alignItems: 'center',
        padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
        background: mine ? 'rgba(168,68,42,.10)' : 'transparent',
      }}
    >
      <Avatar id={d.id} team={d.teamAbbr} size={30} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: `${mine ? 700 : 400} calc(13px * var(--ts)) var(--body)`,
          color: mine ? 'var(--clay)' : 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{d.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
        }}>
          {d.teamAbbr} · {d.classYear} · {d.age} · {d.returned ? 'came back' : exit.word}
        </span>
      </span>
      <span style={{
        font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em',
        color: d.returned ? 'var(--win)' : exit.tone, whiteSpace: 'nowrap',
      }}>
        {d.returned ? 'STAYED'
          : d.reason === 'drafted' ? `RD ${d.round ?? '—'}` : exit.tag}
      </span>
      <span style={{ font: "600 calc(13px * var(--ts)) var(--mono)" }}>{d.overall}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Outside the sequence
// ---------------------------------------------------------------------------

/** No results yet, so show who is exposed and who is safe. */
function DraftOdds(
  { team, year, phase }:
  { team: NonNullable<ReturnType<typeof useUserTeam>>; year: number; phase: string | null },
) {
  const nextPhase = useDynasty((s) => s.nextPhase);
  const roster: Player[] = [
    ...team.team.lineup, ...team.team.bench,
    ...team.team.rotation, ...team.team.bullpen,
  ];
  const byOverall = (a: Player, b: Player) => overallOf(b) - overallOf(a);
  // Eligibility is read against the June ahead, so everybody is a year older
  // than the roster says. That is the whole reason a twenty-year-old sophomore
  // is on this list and a nineteen-year-old one is not.
  const inJune = (p: Player) => ({ classYear: p.classYear, age: p.age + 1 });
  const exposed = roster
    .filter((p) => p.classYear !== 'SR' && draftEligible(inJune(p))).sort(byOverall);
  const seniors = roster.filter((p) => p.classYear === 'SR').sort(byOverall);
  const atRisk = exposed.filter((p) => draftChance(overallOf(p)) >= 0.35).length;

  return (
    <FixedHeader header={
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
          <div className="label">{team.def.abbr} · {year}</div>
          <div style={{
            font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
          }}>The draft</div>
        </div>
      </div>
    }
      action={phase !== null && (
    <FloatingAction label="TO RECRUITING" onClick={() => void nextPhase('draft')} />
  )}
    >
    <div style={{ padding: '10px 14px 20px' }}>
      <div style={{
        display: 'flex', marginTop: 2,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="SENIORS" v={String(seniors.length)} />
        <Tile k="ELIGIBLE" v={String(exposed.length)} />
        <Tile k="LIKELY GONE" v={String(atRisk)} accent={atRisk > 0} last />
      </div>

      {exposed.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>DRAFT ELIGIBLE</div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {exposed.map((p) => <OddsRow key={p.id} player={p} odds={draftChance(overallOf(p))} />)}
          </div>
        </>
      )}

      {seniors.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
            LEAVING REGARDLESS
          </div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {seniors.map((p) => <OddsRow key={p.id} player={p} odds={null} />)}
          </div>
        </>
      )}

      {/*
        A way out, because this screen is reachable *inside* the sequence.

        A reload during the offseason comes back on the step it was left on and
        without the report that step is about, so this fallback can be the whole
        draft phase — and without a button it was a dead end with the dynasty
        behind it.
      */}
    </div>
    </FixedHeader>
  );
}

function OddsRow({ player, odds }: { player: Player; odds: number | null }) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const word = odds === null ? 'GRADUATING'
    : odds >= 0.7 ? 'GONE' : odds >= 0.35 ? 'LIKELY'
    : odds >= 0.12 ? 'POSSIBLE' : 'SAFE';
  const tone = odds === null ? 'var(--dim)'
    : odds >= 0.35 ? 'var(--clay)' : odds >= 0.12 ? 'var(--ink)' : 'var(--win)';

  return (
    <button
      onClick={() => openPlayer(player.id)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '1fr auto auto',
        gap: 10, alignItems: 'center',
        padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: "400 calc(13px * var(--ts)) var(--body)",
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{player.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
        }}>
          {slotOf(player)} · {player.classYear} · AGE {player.age}
        </span>
      </span>
      <span style={{
        font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: tone, whiteSpace: 'nowrap',
      }}>{word}</span>
      <span style={{ font: "600 calc(13px * var(--ts)) var(--mono)" }}>{overallOf(player)}</span>
    </button>
  );
}

function Tile(
  { k, v, accent, tone, last }:
  { k: string; v: string; accent?: boolean; tone?: string; last?: boolean },
) {
  return (
    <div style={{
      flex: 1, padding: '10px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 calc(20px * var(--ts))/1 var(--display)", marginTop: 3,
        color: tone ?? (accent ? 'var(--clay)' : 'var(--ink)'),
      }}>{v}</div>
    </div>
  );
}
