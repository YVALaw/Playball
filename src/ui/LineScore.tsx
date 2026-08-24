// LineScore.tsx
// The classic linescore: runs by inning, then R, H, E.
//
// One component for both places it appears — live above the managed game, and
// afterwards in the box score sheet — so the two can never disagree about what
// the strip looks like. The caller decides what goes in each cell, because only
// it knows the game's state: a blank for an inning not yet reached, the running
// count for the half being played, an 'X' for a bottom ninth the home team never
// needed.
//
// The innings scroll in their own container while the team names and the R/H/E
// totals hold still at the edges. A 14-inning game on a 360px phone is the case
// this is built for: the totals are what you glance at, the innings are what
// you scroll through.

const CELL = {
  flex: 'none', width: 18, height: 15, lineHeight: '15px',
  textAlign: 'center' as const,
};

function Strip(
  { cells, dim }: { cells: Array<string | number>; dim?: boolean },
) {
  return (
    <div style={{ display: 'flex' }}>
      {cells.map((c, i) => (
        <span key={i} style={{
          ...CELL,
          font: dim ? "500 9px var(--mono)" : "600 10px var(--mono)",
          color: dim ? 'var(--dim)' : 'var(--ink)',
        }}>{c}</span>
      ))}
    </div>
  );
}

export interface LineScoreRow {
  abbr: string;
  /** One entry per inning column: a run count, '' for not reached, 'X' for skipped. */
  cells: Array<string | number>;
  r: number;
  h: number;
  e: number;
}

export function LineScore(
  { innings, rows }: { innings: number; rows: readonly LineScoreRow[] },
) {
  const header = Array.from({ length: innings }, (_, i) => i + 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ flex: 'none', marginRight: 6 }}>
        <div style={{ ...CELL, width: 'auto' }} />
        {rows.map((row) => (
          <div key={row.abbr} style={{
            height: 15, lineHeight: '15px',
            font: "700 10px var(--mono)", letterSpacing: '.04em', color: 'var(--ink)',
          }}>{row.abbr}</div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
        <div style={{ display: 'inline-block' }}>
          <Strip cells={header} dim />
          {rows.map((row) => <Strip key={row.abbr} cells={row.cells} />)}
        </div>
      </div>
      <div style={{ flex: 'none', marginLeft: 8, borderLeft: '1px solid var(--hairline)', paddingLeft: 6 }}>
        <Strip cells={['R', 'H', 'E']} dim />
        {rows.map((row) => <Strip key={row.abbr} cells={[row.r, row.h, row.e]} />)}
      </div>
    </div>
  );
}
