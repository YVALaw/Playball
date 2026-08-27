// LineScore.tsx
// The classic linescore: runs by inning, then R, H, E.
//
// One component for both places it appears — live in the managed game's
// scoreboard and afterwards in the box score sheet — so the two can never
// disagree about what the strip looks like. The caller decides what goes in each
// cell, because only it knows the game's state: a blank for an inning not yet
// reached, the running count for the half being played, an 'X' for a bottom
// ninth the home team never needed.
//
// The innings scroll in their own container while the team names and the R/H/E
// totals hold still at the edges. A 14-inning game on a 360px phone is the case
// this is built for: the totals are what you glance at, the innings are what
// you scroll through.
//
// Two tones, because the managed game's strip IS the scoreboard rather than a
// second one below it. On navy the R column carries the score itself, so it is
// set larger and in cream while H and E recede — one strip that answers "what is
// the score" and "how did we get here" in the same three lines.

export type Tone = 'paper' | 'navy';

const INK = (tone: Tone): string => (tone === 'navy' ? 'var(--cream)' : 'var(--ink)');
const DIM = (tone: Tone): string => (tone === 'navy' ? 'rgba(246,241,230,.52)' : 'var(--dim)');
const RULE = (tone: Tone): string =>
  (tone === 'navy' ? 'rgba(246,241,230,.22)' : 'var(--hairline)');

/** Row heights differ per tone only because navy has to fit a scoreboard. */
const geom = (tone: Tone) => (tone === 'navy'
  ? { head: 11, row: 18, cell: 17, runs: 13 }
  : { head: 15, row: 15, cell: 18, runs: 10 });

function Strip(
  {
    cells, dim, tone, height, width, sizes,
  }: {
    cells: Array<string | number>;
    dim?: boolean;
    tone: Tone;
    height: number;
    width: number;
    /** Per-cell font size, for the navy strip where R outranks H and E. */
    sizes?: readonly number[];
  },
) {
  return (
    <div style={{ display: 'flex' }}>
      {cells.map((c, i) => (
        <span key={i} style={{
          flex: 'none', width, height, lineHeight: `${height}px`, textAlign: 'center',
          font: `${dim ? 500 : 600} calc(${sizes?.[i] ?? (dim ? 9 : 10)}px * var(--ts)) var(--mono)`,
          color: dim ? DIM(tone) : INK(tone),
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
  /** Marks the side at bat, on the navy strip. */
  batting?: boolean;
}

export function LineScore(
  { innings, rows, tone = 'paper' }:
  { innings: number; rows: readonly LineScoreRow[]; tone?: Tone },
) {
  const g = geom(tone);
  const header = Array.from({ length: innings }, (_, i) => i + 1);
  // R is the score on navy, so it is set two points up from H and E.
  const totalSizes = tone === 'navy' ? [g.runs, 9.5, 9.5] : undefined;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ flex: 'none', marginRight: 6 }}>
        <div style={{ height: g.head }} />
        {rows.map((row) => (
          <div key={row.abbr} style={{
            height: g.row, lineHeight: `${g.row}px`, whiteSpace: 'nowrap',
            font: `700 calc(${tone === 'navy' ? 11 : 10}px * var(--ts)) var(--mono)`,
            letterSpacing: '.04em', color: INK(tone),
          }}>
            {tone === 'navy' && (
              <span style={{
                display: 'inline-block', width: 8,
                color: 'var(--clay)', font: "600 calc(11px * var(--ts)) var(--mono)",
              }}>{row.batting ? '•' : ''}</span>
            )}
            {row.abbr}
          </div>
        ))}
      </div>
      {/*
        No scrollbar gutter on the scoreboard. A desktop browser reserves six
        pixels under the innings that the fixed columns beside them do not have,
        which both misaligns the two and costs height on the one strip whose
        entire purpose is to be short. A phone draws an overlay scrollbar and
        never had the gutter to begin with.
      */}
      <div style={{
        flex: 1, minWidth: 0, overflowX: 'auto',
        ...(tone === 'navy' ? { scrollbarWidth: 'none' as const } : {}),
      }}>
        {/*
          A block sized to its content, not an inline-block. An inline-block sits
          on the text baseline and carries the line box's descender with it, which
          added six invisible pixels under the innings and left them a row taller
          than the fixed columns either side.
        */}
        <div style={{ display: 'block', width: 'max-content' }}>
          <Strip cells={header} dim tone={tone} height={g.head} width={g.cell} />
          {rows.map((row) => (
            <Strip key={row.abbr} cells={row.cells} tone={tone} height={g.row} width={g.cell} />
          ))}
        </div>
      </div>
      <div style={{
        flex: 'none', marginLeft: 8, borderLeft: `1px solid ${RULE(tone)}`, paddingLeft: 6,
      }}>
        <Strip cells={['R', 'H', 'E']} dim tone={tone} height={g.head} width={g.cell} />
        {rows.map((row) => (
          <Strip
            key={row.abbr} cells={[row.r, row.h, row.e]} tone={tone}
            height={g.row} width={g.cell} sizes={totalSizes}
          />
        ))}
      </div>
    </div>
  );
}
