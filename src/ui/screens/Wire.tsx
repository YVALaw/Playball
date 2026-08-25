// Wire.tsx
// What the rest of the country is doing.
//
// You play one team's schedule and the other ninety five programs move in the
// standings overnight for reasons you never see. The wire is where those reasons
// go, so the league reads as a place rather than a table that updates itself.

import { useMemo } from 'react';
import { useDynasty } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { wire, type WireKind } from '../../engine/wire.js';

const KIND_LABEL: Record<WireKind, string> = {
  upset: 'UPSET',
  streak: 'STREAK',
  rout: 'ROUT',
  ranking: 'POLL',
  milestone: 'AT THE PLATE',
  race: 'RACE',
};

const KIND_TONE: Record<WireKind, string> = {
  upset: 'var(--clay)',
  streak: 'var(--win)',
  rout: 'var(--dim)',
  ranking: 'var(--ink)',
  milestone: 'var(--ink)',
  race: 'var(--clay)',
};

export function Wire() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const version = useDynasty((s) => s.version);

  const items = useMemo(() => (season ? wire(season) : []), [season, version]);

  if (!season) return null;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">AROUND THE COUNTRY</div>
            <div style={{
              font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>The wire</div>
          </div>
        </div>
      }
    >
    <div style={{ padding: '2px 14px 20px' }}>
      {items.length === 0 && (
        <div style={{
          marginTop: 16, padding: '18px 12px', border: '1px solid var(--faint)',
          background: 'var(--paper)', textAlign: 'center',
          font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
        }}>
          Nothing on the wire yet. Play some games and the country will start
          making noise.
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {items.map((item, i) => {
          const mine = item.team === userTeam;
          return (
            <div
              key={`${item.kind}-${item.team}-${i}`}
              style={{
                padding: '10px 12px', marginBottom: 6,
                background: 'var(--paper)',
                border: mine ? '1px solid var(--clay)' : '1px solid var(--faint)',
                borderLeft: `3px solid ${mine ? 'var(--clay)' : KIND_TONE[item.kind]}`,
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: 3,
              }}>
                <span style={{
                  font: "700 8px var(--mono)", letterSpacing: '.14em',
                  color: KIND_TONE[item.kind],
                }}>{KIND_LABEL[item.kind]}</span>
                {mine && (
                  <span style={{
                    font: "700 8px var(--mono)", letterSpacing: '.12em', color: 'var(--clay)',
                  }}>YOU</span>
                )}
              </div>
              <div style={{ font: "400 13px/1.45 var(--body)" }}>{item.text}</div>
            </div>
          );
        })}
      </div>
    </div>
    </FixedHeader>
  );
}
