// Placeholder.tsx
// The safety net behind the screen switch. Every id the nav can produce has a
// real screen now, so in ordinary play this never renders — it exists for an
// id nothing routes to yet, and it names the one feature that genuinely is
// planned rather than pretending built screens are still on the way. The old
// list here described eleven screens as "built later" years after they were
// built.

const BUILT_LATER: Record<string, string> = {
  portal: 'Transfer portal, both directions. Not built.',
};

export function Placeholder({ id }: { id: string }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center' }}>
      <div style={{
        font: "800 21px/1 var(--display)", textTransform: 'uppercase',
        color: 'var(--faint)',
      }}>{id}</div>
      <div style={{
        marginTop: 10, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
        maxWidth: 260, marginLeft: 'auto', marginRight: 'auto',
      }}>{BUILT_LATER[id] ?? 'Not built yet.'}</div>
    </div>
  );
}
