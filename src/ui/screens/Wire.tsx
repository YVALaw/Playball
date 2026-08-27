// Wire.tsx
// What the rest of the country is doing, set like a paper.
//
// You play one team's schedule and the other ninety five programs move in the
// standings overnight for reasons you never see. The wire is where those reasons
// go — and it reads as a morning sports page rather than a list of event cards:
// a masthead, a lead story with a deck, a two-column well, and briefs. Same
// tokens and faces as the rest of the app; the newspaper is an arrangement,
// not a second design.
//
// Everything printed is derived from the live season by `engine/wire.ts`.
// Nothing here invents a fact, and reading the page consumes no dice.

import { useMemo } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { seasonDate } from '../format.js';
import { wire, type WireItem, type WireKind } from '../../engine/wire.js';

const KIND_LABEL: Record<WireKind, string> = {
  upset: 'UPSET',
  streak: 'STREAK',
  rout: 'ROUT',
  ranking: 'POLL',
  milestone: 'AT THE PLATE',
  race: 'RACE',
  close: 'EXTRA INNINGS',
  sweep: 'SWEEP',
  gem: 'ON THE MOUND',
  power: 'POWER',
};

const KIND_TONE: Record<WireKind, string> = {
  upset: 'var(--clay)',
  streak: 'var(--win)',
  rout: 'var(--dim)',
  ranking: 'var(--ink)',
  milestone: 'var(--ink)',
  race: 'var(--clay)',
  close: 'var(--navy)',
  sweep: 'var(--win)',
  gem: 'var(--navy)',
  power: 'var(--clay)',
};

/** The category chip + YOU marker row every story opens with. */
function Kicker({ item, mine }: { item: WireItem; mine: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
    }}>
      <span style={{
        font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em',
        padding: '2px 6px 3px',
        background: KIND_TONE[item.kind], color: 'var(--cream)',
      }}>{KIND_LABEL[item.kind]}</span>
      <span style={{ flex: 1, borderTop: '1px solid var(--faint)' }} />
      {mine && (
        <span style={{
          font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.12em', color: 'var(--clay)',
        }}>■ YOUR PROGRAM</span>
      )}
    </div>
  );
}

export function Wire() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();

  const items = useMemo(() => (season ? wire(season) : []), [season, version]);

  if (!season || !team) return null;

  // The page's parts, dealt mechanically: the strongest story leads, the next
  // three fill the well, the rest run as briefs.
  const lead = items[0];
  const well = items.slice(1, 4);
  const briefs = items.slice(4, 10);
  const day = season.schedule[season.dayIndex]?.day ?? 0;
  const played = season.results.length;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '10px 14px 8px' }}>
          {/* Folio, masthead, edition line — the furniture that makes it a
              paper. The volume number is the dynasty's own age. */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            font: "500 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.18em', color: 'var(--dim)',
          }}>
            <span>VOL. {year - 2026} · THE COUNTRY'S GAME</span>
            <span>{team.conference} EDITION</span>
          </div>
          <div style={{
            marginTop: 4, borderTop: '3px solid var(--ink)', borderBottom: '1px solid var(--ink)',
            textAlign: 'center', padding: '2px 0 3px',
          }}>
            <span style={{
              font: "800 calc(34px * var(--ts))/1 var(--display)", textTransform: 'uppercase', letterSpacing: '.02em',
            }}>The Wire</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            borderBottom: '3px double var(--ink)', padding: '3px 0 4px',
            font: "500 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'var(--dim)',
          }}>
            <span>{seasonDate(year, day).toUpperCase()} · {year}</span>
            <span>{played > 0 ? 'LATE EDITION' : 'FIRST EDITION'}</span>
            <span>{items.length === 1 ? 'ONE ITEM' : `${Math.min(items.length, 10)} ITEMS`}</span>
          </div>
        </div>
      }
    >
    <div style={{ padding: '2px 14px 20px' }}>
      <FirstVisit id="wire" />
      {items.length === 0 && (
        <div style={{
          marginTop: 16, padding: '18px 12px', border: '1px solid var(--faint)',
          background: 'var(--paper)', textAlign: 'center',
          font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
        }}>
          Nothing on the wire yet. Play some games and the country will start
          making noise.
        </div>
      )}

      {/* The lead story: kicker, a headline set big, and the deck under it. */}
      {lead && (
        <div style={{
          marginTop: 12, padding: '12px 12px 13px',
          background: 'var(--paper)', border: '1px solid var(--faint)',
        }}>
          <Kicker item={lead} mine={lead.team === userTeam || lead.against === userTeam} />
          <div style={{
            font: "800 calc(26px * var(--ts))/1.02 var(--display)", textTransform: 'uppercase',
          }}>{lead.text}</div>
          {lead.detail && (
            <div style={{
              marginTop: 7, font: "italic 400 calc(13px * var(--ts))/1.5 var(--body)", color: 'var(--ink)',
            }}>{lead.detail}</div>
          )}
          <div style={{
            marginTop: 8, paddingTop: 5, borderTop: '1px solid var(--hairline)',
            font: "500 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--dim)',
          }}>BY THE {team.conference} DESK</div>
        </div>
      )}

      {/* Around the country: the second-tier stories. */}
      {well.length > 0 && (
        <>
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ flex: 1, borderTop: '1px solid var(--faint)' }} />
            <span className="label">AROUND THE COUNTRY</span>
            <span style={{ flex: 1, borderTop: '1px solid var(--faint)' }} />
          </div>
          <div style={{ marginTop: 8 }}>
            {well.map((item, i) => {
              const mine = item.team === userTeam || item.against === userTeam;
              return (
                <div key={`${item.kind}-${item.team}-${i}`} style={{
                  padding: '10px 12px', marginBottom: 6,
                  background: 'var(--paper)',
                  border: mine ? '1px solid var(--clay)' : '1px solid var(--faint)',
                }}>
                  <Kicker item={item} mine={mine} />
                  <div style={{
                    font: "800 calc(17px * var(--ts))/1.1 var(--display)", textTransform: 'uppercase',
                  }}>{item.text}</div>
                  {item.detail && (
                    <div style={{
                      marginTop: 4, font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
                    }}>{item.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* In brief: a run-in headline, a period, the rest of the sentence. */}
      {briefs.length > 0 && (
        <div style={{
          marginTop: 12, padding: '9px 12px 11px',
          borderTop: '3px double var(--ink)', borderBottom: '3px double var(--ink)',
          background: 'var(--paper)',
        }}>
          <div className="label" style={{ marginBottom: 6 }}>IN BRIEF</div>
          {briefs.map((item, i) => {
            const mine = item.team === userTeam || item.against === userTeam;
            return (
              <div key={`${item.kind}-${item.team}-${i}`} style={{
                display: 'flex', gap: 7, alignItems: 'baseline',
                padding: '5px 0',
                borderTop: i > 0 ? '1px solid var(--hairline)' : 'none',
              }}>
                <span aria-hidden style={{
                  flex: 'none', width: 6, height: 6, transform: 'rotate(45deg)',
                  background: mine ? 'var(--clay)' : KIND_TONE[item.kind],
                  position: 'relative', top: -1,
                }} />
                <span style={{ font: "400 calc(12px * var(--ts))/1.5 var(--body)" }}>
                  <b style={{ font: "700 calc(12px * var(--ts))/1.5 var(--body)" }}>{item.text}.</b>
                  {item.detail ? ` ${item.detail}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </FixedHeader>
  );
}
