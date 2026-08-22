// Placeholder.tsx
// Screens the mockup specifies that are not built yet. Named rather than blank
// so the navigation is honest about what exists.

const BUILT_LATER: Record<string, string> = {
  wire: 'The news feed, once games generate headlines.',
  box: 'Line score, play log and box — needs a live game first.',
  roster: 'Hitters and pitchers with season lines.',
  lineup: 'Tap-to-swap batting order and the weekend rotation.',
  strategy: 'The five coaching policies.',
  sched: 'The 33 game calendar, results as they land.',
  stats: 'National and conference leaderboards.',
  board: 'The recruiting board. Phase 4.',
  portal: 'Transfer portal, both directions. Phase 4.',
  draft: 'Who the draft took in June.',
  awards: 'Player, Pitcher and Freshman of the Year.',
  history: 'Season by season program record.',
  records: 'The program record book.',
};

export function Placeholder({ id }: { id: string }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center' }}>
      <div style={{
        font: "800 26px/1 var(--display)", textTransform: 'uppercase',
        color: 'var(--faint)',
      }}>{id}</div>
      <div style={{
        marginTop: 10, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
        maxWidth: 260, marginLeft: 'auto', marginRight: 'auto',
      }}>{BUILT_LATER[id] ?? 'Not built yet.'}</div>
    </div>
  );
}
