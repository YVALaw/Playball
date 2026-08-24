// JobSearch.tsx
// You were let go. Now what.
//
// Reported from testing: "if the board decided not to renew my contract we
// should not be prompted to the team recruiting — we should go back to picking
// a team, while maintaining in history my coach statistics and achievements.
// The way you have it right now I can keep playing with the same team even
// though I'm no longer contracted with them."
//
// Which was exactly true: being fired set a flag, printed a verdict, and then
// handed you back the keys to a program that had just dismissed you. Getting
// fired has to actually take the job away, and the only thing that survives is
// what you did — the record, the rings, the tournaments.

import { useDynasty } from '../../state/store.js';
import { prestigeStars } from '../../engine/program.js';

export function JobSearch() {
  const coach = useDynasty((s) => s.coach);
  const offers = useDynasty((s) => s.offers);
  const history = useDynasty((s) => s.history);
  const accept = useDynasty((s) => s.acceptOffer);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;

  if (!season) return null;

  const titles = history.filter((h) => h.finish === 'champion').length;
  const rings = history.filter((h) => h.wonConference).length;
  const trips = history.filter((h) => h.finish !== 'missed').length;

  return (
    <div style={{ padding: '16px 14px 24px' }}>
      <div style={{ borderBottom: '2px solid var(--clay)', paddingBottom: 8 }}>
        <div className="label" style={{ color: 'var(--clay)' }}>OUT OF A JOB</div>
        <div style={{
          font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>{coach.name}</div>
        {/*
          Where the profile made at the start of the career shows up: this is
          the one screen that is about the man rather than the program.
        */}
        <div style={{
          marginTop: 3, font: "400 10px var(--mono)", color: 'var(--dim)',
        }}>{coach.age} · {coach.homeState}</div>
      </div>

      {/*
        The paragraph that used to sit here — the board has decided not to
        renew, your record goes with you, somebody else's program is the next
        job — said in three lines what the heading, the career tiles and the
        list of callers below already say between them, and it said it directly
        above the only decision on the screen.
      */}

      <div className="label" style={{ marginTop: 16, marginBottom: 6 }}>YOUR CAREER</div>
      <div style={{
        display: 'flex', border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="RECORD" v={`${coach.careerWins}-${coach.careerLosses}`} />
        <Tile k="TITLES" v={String(titles)} accent={titles > 0} />
        <Tile k="CONF" v={String(rings)} />
        <Tile k="TOURNAMENTS" v={String(trips)} last />
      </div>

      <div className="label" style={{ marginTop: 16, marginBottom: 6 }}>
        {offers.length > 0 ? 'WHO IS CALLING' : 'NOBODY IS CALLING'}
      </div>

      {/* The empty state stays: with no rows on screen it is the only thing
          that explains why, which is the same job hireGateNote does. */}
      {offers.length === 0 && (
        <div style={{
          padding: '14px 12px', border: '1px solid var(--faint)', background: 'var(--paper)',
          font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
        }}>
          No program will have you at {coach.prestige}. Prestige is what opens
          the board, and yours is too low.
        </div>
      )}

      {offers.map((o) => {
        const stars = prestigeStars(o.prestige);
        return (
          <button
            key={o.team}
            onClick={() => void accept(o.team)}
            style={{
              width: '100%', textAlign: 'left', marginBottom: 8, padding: '12px',
              border: '1px solid var(--faint)', background: 'var(--paper)',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{
                font: "800 19px/1 var(--display)", textTransform: 'uppercase',
              }}>{o.school}</span>
              <span style={{ font: "600 11px var(--mono)", color: 'var(--clay)' }}>
                {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
              </span>
            </div>
            <div style={{
              marginTop: 3, font: "500 9px var(--mono)", letterSpacing: '.14em',
              color: 'var(--dim)', textTransform: 'uppercase',
            }}>{o.conference}</div>
            <div style={{
              marginTop: 7, font: "400 12px/1.5 var(--body)", color: 'var(--dim)',
            }}>{o.pitch}</div>
            <div style={{
              marginTop: 9, padding: '9px 0', textAlign: 'center',
              background: 'var(--clay)', color: 'var(--cream)',
              font: "700 10px var(--mono)", letterSpacing: '.14em',
            }}>TAKE THE JOB</div>
          </button>
        );
      })}
    </div>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '10px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 20px/1 var(--display)", marginTop: 3,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}
