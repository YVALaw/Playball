// Portal.tsx
// Both directions, on one screen, kept apart.
//
// Stage 10. The two halves are two different decisions with two different
// verbs -- you talk one lot round and you sign the other -- and the first
// version put them in one list, which read as a jumble of names with no way to
// tell whose they were. So: who is leaving you, then who is available.
//
// The leaving half comes first because it is the one with a deadline attached
// and the one you can still do something about. It is also the bill for stage
// 9: every man on it is a promise somebody broke, and the card says which.

import { useDynasty } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { ModuleIntro } from '../components/Kit.js';
import { overallOf } from '../../engine/ratings.js';
import { prestigeStars } from '../../engine/program.js';
import { windowBudget } from '../../engine/recruiting.js';
import { mood } from '../../engine/morale.js';
import type { PortalMan } from '../../engine/portal.js';

export function Portal() {
  const portal = useDynasty((s) => s.portal);
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const keepFromPortal = useDynasty((s) => s.keepFromPortal);
  const takeFromPortal = useDynasty((s) => s.takeFromPortal);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  void version;

  const rec = season?.teams[userTeam];
  if (!portal || !rec) return null;

  const budget = windowBudget(prestigeStars(rec.prestige));
  const left = budget - portal.spent;

  return (
    <FixedHeader
      header={
        <ModuleIntro kicker={`THE PORTAL · ${left} OF ${budget} LEFT`} title="Both directions" />
      }
      /*
        The way out, which this screen shipped without.

        Every other offseason step supplies its own pinned action and this one
        did not, so the rail reached the portal and stopped -- the offseason
        could not be finished at all. Found by playing a season rather than by
        any test, because every test drives `nextPhase` directly and never has
        to find a button.

        The note is load-bearing too: leaving is what releases anybody still in
        the portal, and that has to be said before it happens rather than
        reported afterwards.
      */
      action={(
        <FloatingAction
          label="TO RECRUITING"
          note={portal.leaving.length > 0
            ? `${portal.leaving.length} ${portal.leaving.length === 1 ? 'man is' : 'men are'} still in it. Leaving now lets ${portal.leaving.length === 1 ? 'him' : 'them'} go.`
            : undefined}
          onClick={() => void nextPhase('portal')}
        />
      )}
    >
      <div style={{ padding: '10px 14px 20px' }}>
        <div style={{
          marginBottom: 12,
          font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          The same points that sign a class. Keeping a man and taking one both
          come out of it, and whatever is left goes into recruiting.
        </div>

        {/* Yours, first: it is the half with a deadline you can act on. */}
        <div className="label" style={{ marginBottom: 6 }}>
          LEAVING YOU · {portal.leaving.length}
        </div>
        {portal.leaving.length === 0 ? (
          <Empty>Nobody has put his name in. That is what keeping your word
            looks like.</Empty>
        ) : (
          portal.leaving.map((m) => (
            <Row
              key={m.player.id}
              man={m}
              onOpen={() => openPlayer(m.player.id)}
              action={{
                label: `TALK HIM ROUND · ${Math.round(m.cost * 1.5)}`,
                can: left >= Math.round(m.cost * 1.5),
                run: () => keepFromPortal(m.player.id, Math.round(m.cost * 1.5)),
              }}
              note={m.reason}
            />
          ))
        )}

        <div className="label" style={{ margin: '16px 0 6px' }}>
          AVAILABLE · {portal.available.length}
        </div>
        {portal.available.length === 0 ? (
          <Empty>Nobody worth having is in it this winter.</Empty>
        ) : (
          portal.available.slice(0, 25).map((m) => (
            <Row
              key={m.player.id}
              man={m}
              onOpen={() => openPlayer(m.player.id)}
              action={{
                label: `SIGN HIM · ${m.cost}`,
                can: left >= m.cost,
                run: () => takeFromPortal(m.player.id),
              }}
              note={`From ${m.fromName}. Eligible immediately.`}
            />
          ))
        )}
      </div>
    </FixedHeader>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <div style={{
      padding: '10px 12px', background: 'var(--paper)',
      font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
    }}>{children}</div>
  );
}

function Row(
  { man, onOpen, action, note }:
  {
    man: PortalMan;
    onOpen: () => void;
    action: { label: string; can: boolean; run: () => void };
    note: string;
  },
) {
  const p = man.player;
  return (
    <div style={{
      marginBottom: 6, background: 'var(--paper)',
      border: '1px solid rgba(var(--ink-rgb), .26)',
    }}>
      <button
        className="tap"
        onClick={onOpen}
        style={{
          width: '100%', textAlign: 'left', padding: '9px 11px',
          background: 'none', border: 'none',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          <span style={{
            flex: 1, font: "700 calc(13px * var(--ts)) var(--display)",
            textTransform: 'uppercase',
          }}>{p.name}</span>
          <span style={{
            flex: 'none', font: "700 calc(11px * var(--ts)) var(--mono)",
          }}>{overallOf(p)}</span>
        </div>
        <div style={{
          marginTop: 2,
          font: "400 calc(10.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
        }}>
          {p.type === 'pitcher' ? (p as { role: string }).role : p.pos} · {p.classYear}
          {' · '}{mood(p)} · {note}
        </div>
      </button>
      <button
        className="tap"
        disabled={!action.can}
        onClick={action.run}
        style={{
          width: '100%', padding: '8px 11px', minHeight: 38,
          background: action.can ? 'var(--field)' : 'transparent',
          border: 'none', borderTop: '1px solid var(--faint)',
          color: action.can ? 'var(--ink)' : 'var(--dim)',
          font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.11em',
        }}
      >{action.can ? action.label : 'NOT ENOUGH LEFT'}</button>
    </div>
  );
}
