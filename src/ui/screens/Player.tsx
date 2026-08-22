// Player.tsx
// One player's card.
//
// Ratings are shown as bars against a fixed 0 to 99 scale rather than as bare
// numbers, because what matters is the shape of a player — where he is strong,
// where the hole is — and a row of two digit numbers hides that. The gap between
// where he is and where he could be is drawn as a lighter extension of the same
// bar, so a freshman with room to grow reads differently from a finished senior
// at a glance.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { potentialGrade } from '../../engine/scouting.js';
import { overallOf } from '../../engine/ratings.js';
import { Avatar, teamColour } from '../Avatar.js';
import { battingAverage, onBase, slugging, era, whip, inningsPitched } from '../../engine/season.js';
import { pct } from '../format.js';
import type { Hitter, Pitcher, Player as AnyPlayer } from '../../engine/types.js';

/**
 * The ratings, under the names baseball actually uses.
 *
 * The internal fields keep their engine names — `range`, `hands`, `stuff` — but
 * nobody outside this file should have to learn them. "Stuff 72" and "Hands 61"
 * are house vocabulary; K/9 and Fielding are what a player already knows from
 * every other baseball game, and a rating you have to be taught is a rating you
 * do not read.
 *
 * The descriptions stay, because a familiar name still does not say what the
 * simulation does with it.
 */
const HITTER_BARS: Array<[keyof Hitter & string, string, string]> = [
  ['contact', 'CONTACT', 'Hits for average, and strikes out less'],
  ['power', 'POWER', 'Home runs and extra base hits'],
  ['eye', 'DISCIPLINE', 'Draws walks, chases less'],
  ['speed', 'SPEED', 'Triples, infield hits, steals, extra bases'],
  ['range', 'REACTION', 'First step and ground covered — turns would-be hits into outs'],
  ['hands', 'FIELDING', 'Handles what he reaches. Low fielding is how a routine play becomes an error'],
  ['arm', 'ARM STRENGTH', 'Keeps runners from taking the extra base. Behind the plate, throws them out'],
];

const PITCHER_BARS: Array<[keyof Pitcher & string, string, string]> = [
  ['stuff', 'K/9', 'Misses bats. This is the strikeout rating'],
  ['movement', 'H/9', 'Suppresses hits and home runs'],
  ['control', 'BB/9', 'Throws strikes. Fewer walks and hit batters'],
  ['stamina', 'STAMINA', 'How deep into a start he can go'],
  ['groundBall', 'GB RATE', 'Keeps it on the ground, sets up double plays'],
  ['holdRunners', 'PICKOFF', 'Keeps baserunners honest'],
];

export function Player() {
  const season = useDynasty((s) => s.season);
  const selected = useDynasty((s) => s.selectedPlayer);
  const setScreen = useDynasty((s) => s.setScreen);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  if (!season || !team || !selected) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO PLAYER SELECTED</div>
        <div style={{
          marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
        }}>Tap a name on the roster.</div>
      </div>
    );
  }

  // Look across the whole world, not just this roster. A leaderboard is full of
  // players you do not employ and would still like to read about.
  const rosterOf = (t: typeof team): AnyPlayer[] =>
    [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen];

  let p: AnyPlayer | undefined = rosterOf(team).find((x) => x.id === selected);
  let owner = team;
  if (!p) {
    for (const t of season.teams) {
      const found = rosterOf(t).find((x) => x.id === selected);
      if (found) { p = found; owner = t; break; }
    }
  }
  if (!p) return null;

  /**
   * You only scout your own program in full. For everyone else the card shows
   * what a box score would tell you — ratings and production — and withholds
   * potential, which is the one number a rival coach genuinely cannot know.
   */
  const isOurs = owner.index === team.index;
  const isPitcher = p.type === 'pitcher';
  const bars = isPitcher ? PITCHER_BARS : HITTER_BARS;
  const bat = season.batting.get(p.id);
  const pit = season.pitching.get(p.id);
  const ovr = overallOf(p);

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      <div style={{
        borderBottom: '2px solid var(--ink)', paddingBottom: 8,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <Avatar id={p.id} team={owner.def.abbr} size={72} />
        <div style={{ minWidth: 0, flex: 1 }}>
        <div className="label">
          {isPitcher ? (p as Pitcher).role : p.pos} · {p.classYear} · BATS {p.bats} · THROWS {p.throws}
          {isPitcher && (p as Pitcher).sidearm ? ' · SIDEARM' : ''}
        </div>
        {!isOurs && (
          <div style={{
            marginTop: 4, font: "600 10px var(--mono)", letterSpacing: '.1em',
            color: teamColour(owner.def.abbr),
          }}>{owner.def.school.toUpperCase()} · {owner.conference}</div>
        )}
        <div style={{
          font: "800 26px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
        }}>{p.name}</div>
        </div>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="OVERALL" v={String(ovr)} />
        {isOurs
          ? <Tile k="POTENTIAL" v={potentialGrade(p.potential)} accent={p.potential > ovr} />
          : <Tile k="POTENTIAL" v="—" />}
        <Tile k="CLASS" v={p.classYear} last />
      </div>

      {!isOurs && (
        <div style={{ marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
          He plays for someone else. You can see what he has done and what he can do
          now — how much further he might go is your rival's problem to know.
        </div>
      )}

      <div style={{ marginTop: 16, borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">SCOUTING</div>
      </div>

      <div style={{
        marginTop: 8, padding: '12px 12px 6px',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {bars.map(([key, label, note]) => (
          <Bar
            key={key}
            label={label}
            note={note}
            value={Math.round((p as unknown as Record<string, number>)[key] ?? 0)}
          />
        ))}
        {isPitcher && (
          <div style={{
            marginTop: 2, paddingTop: 9, borderTop: '1px solid var(--hairline)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label">FASTBALL</span>
            <span style={{ font: "600 13px var(--mono)" }}>
              {(p as Pitcher).velocity} mph
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">THIS SEASON</div>
      </div>

      <div style={{
        marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {isPitcher ? (
          pit && pit.outs > 0 ? (
            <>
              <Stat k="RECORD" v={`${pit.w}-${pit.l}`} />
              <Stat k="ERA" v={era(pit).toFixed(2)} />
              <Stat k="INNINGS" v={inningsPitched(pit).toFixed(1)} />
              <Stat k="STRIKEOUTS" v={String(pit.k)} />
              <Stat k="WALKS" v={String(pit.bb)} />
              <Stat k="WHIP" v={whip(pit).toFixed(2)} />
              <Stat k="SAVES" v={String(pit.sv)} last />
            </>
          ) : <Empty />
        ) : (
          bat && bat.ab > 0 ? (
            <>
              <Stat k="AVERAGE" v={pct(battingAverage(bat))} />
              <Stat k="ON BASE" v={pct(onBase(bat))} />
              <Stat k="SLUGGING" v={pct(slugging(bat))} />
              <Stat k="HITS" v={`${bat.h}-for-${bat.ab}`} />
              <Stat k="HOME RUNS" v={String(bat.hr)} />
              <Stat k="RUNS BATTED IN" v={String(bat.rbi)} />
              <Stat k="STOLEN BASES" v={`${bat.sb}-${bat.sb + bat.cs}`} last />
            </>
          ) : <Empty />
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div style={{ padding: '12px', font: "400 12px var(--body)", color: 'var(--dim)' }}>
      Has not appeared yet this season.
    </div>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 24px/1 var(--display)", marginTop: 2,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 12px',
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <span className="label">{k}</span>
      <span style={{ font: "600 14px var(--mono)" }}>{v}</span>
    </div>
  );
}

/** A rating, drawn against the full scale so the shape of a player is readable. */
function Bar({ label, note, value }: { label: string; note: string; value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 2,
      }}>
        <span className="label">{label}</span>
        <span style={{ font: "600 11px var(--mono)", color: 'var(--dim)' }}>{value}</span>
      </div>
      <div style={{
        font: "400 10px/1.3 var(--body)", color: 'var(--dim)', marginBottom: 4,
      }}>{note}</div>
      <div style={{ height: 6, background: 'rgba(28,36,48,.09)' }}>
        <div style={{
          width: `${width}%`, height: '100%',
          background: value >= 60 ? 'var(--clay)' : 'var(--ink)',
          opacity: value >= 60 ? 1 : 0.55,
        }} />
      </div>
    </div>
  );
}
