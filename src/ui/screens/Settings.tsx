// Settings.tsx
// Two kinds of preference, kept visibly apart.
//
// An index and four pages. HOW YOU PLAY is about a *career* — how deep a game
// you want this dynasty to be — and rides the save. DISPLAY and SOUND are about
// a *device* and ride the phone: loading a five-year-old dynasty must not shrink
// your text, and starting a new one must not turn the sound back on. The index
// says which is which in a line, so nobody has to be told twice.

import { useState, type ReactNode } from 'react';
import { Card } from '../components/Kit.js';
import { useDynasty, type SettingsPage } from '../../state/store.js';
import {
  SYSTEMS, handles, presetSays, type DepthMode, type SystemKey,
} from '../../state/depth.js';
import {
  readPrefs, writePrefs, applyPrefs, TEXT_SCALES,
  type DevicePrefs, type FieldMode, type MotionPref,
} from '../../state/devicePrefs.js';

/** A row that reads as a sentence and toggles on the right. */
function Row(
  { label, blurb, on, disabled, note, onToggle }: {
    label: string; blurb: string; on: boolean;
    disabled?: boolean; note?: string; onToggle?: () => void;
  },
) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 10px', borderTop: '1px solid var(--hairline)',
      opacity: disabled ? 0.44 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          font: "600 calc(11.5px * var(--ts))/1.2 var(--body)", color: 'var(--ink)',
        }}>{label}</div>
        <div style={{
          marginTop: 2, font: "400 calc(10px * var(--ts))/1.35 var(--body)",
          color: 'var(--dim)',
        }}>{note ?? blurb}</div>
      </div>
      <button
        className="tap"
        disabled={disabled}
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={label}
        style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0,
          background: on && !disabled ? 'var(--clay)' : 'var(--faint)',
          padding: 2, display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: 'var(--paper)',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        }} />
      </button>
    </div>
  );
}

/** A row of mutually exclusive chips. */
function Choice<T extends string | number>(
  { label, value, options, onPick, disabled }: {
    label: string; value: T;
    options: readonly { value: T; label: string }[];
    onPick: (v: T) => void; disabled?: boolean;
  },
) {
  return (
    <div style={{
      padding: '9px 10px', borderTop: '1px solid var(--hairline)',
      opacity: disabled ? 0.44 : 1,
    }}>
      <div style={{
        font: "600 calc(11.5px * var(--ts))/1.2 var(--body)", marginBottom: 7,
      }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              className="tap"
              disabled={disabled}
              onClick={() => onPick(o.value)}
              style={{
                padding: '5px 11px',
                border: `1px solid ${on ? 'var(--clay)' : 'var(--faint)'}`,
                background: on ? 'var(--clay)' : 'transparent',
                color: on ? 'var(--cream)' : 'var(--dim)',
                font: "600 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.1em',
              }}
            >{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

/** The four pages, and the index that lists them. */
type Page = SettingsPage;

const PAGES: { id: Page | 'saves'; title: string; blurb: string }[] = [
  { id: 'display', title: 'Display', blurb: 'Text size, the field, motion.' },
  { id: 'sound', title: 'Sound', blurb: 'Bat, glove, crowd, haptics.' },
  { id: 'play', title: 'How you play', blurb: 'Full or casual, and what you handle.' },
  { id: 'saves', title: 'Saved dynasties', blurb: 'Name a save, load a career, start again.' },
];

export function Settings() {
  const depth = useDynasty((s) => s.depth);
  const setDepthMode = useDynasty((s) => s.setDepthMode);
  const setDepthSystem = useDynasty((s) => s.setDepthSystem);
  const resetTutorials = useDynasty((s) => s.resetTutorials);
  const openOverlay = useDynasty((s) => s.openOverlay);

  /*
    One page at a time.

    It shipped as a single column of five cards and was reported as
    unscrollable with the saves row nowhere to be found — which is one fault,
    not two. The overlay this sits inside is `overflow: hidden` on purpose,
    because every other screen in there pins its own header and scrolls its own
    body. This one did neither, so it rendered at whatever height it liked and
    everything past the fold was simply unreachable.

    An index and four pages fixes the reachability twice over: each page brings
    its own scroller, and no page is long enough to need one.
  */
  const page = useDynasty((s) => s.settingsPage);
  const setPage = useDynasty((s) => s.setSettingsPage);

  // Device preferences are not in the store: nothing else in the app reads
  // them, they must not ride a save, and they have to survive with no dynasty
  // loaded at all.
  const [prefs, setPrefs] = useState<DevicePrefs>(() => readPrefs());
  const put = (patch: Partial<DevicePrefs>): void => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writePrefs(next);
    applyPrefs(next);
  };

  const [taught, setTaught] = useState(false);

  if (page === 'index') {
    return (
      <Frame title="Settings" kicker="THIS DEVICE AND THIS CAREER">
        <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              className="tap"
              onClick={() => {
                // Saves is a screen of its own and already reachable from the
                // overlay system; the index sends you there rather than keeping
                // a second copy of it in here.
                if (p.id === 'saves') openOverlay('saves');
                else setPage(p.id as Page);
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '13px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
                borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block',
                  font: "600 calc(13px * var(--ts))/1.2 var(--body)", color: 'var(--ink)',
                }}>{p.title}</span>
                <span style={{
                  display: 'block', marginTop: 2,
                  font: "400 calc(10.5px * var(--ts))/1.35 var(--body)", color: 'var(--dim)',
                }}>{p.blurb}</span>
              </span>
              <span style={{
                font: "400 calc(15px * var(--ts)) var(--body)", color: 'var(--dim)',
              }}>&rsaquo;</span>
            </button>
          ))}
        </div>
        <div style={{
          marginTop: 12, font: "400 calc(10.5px * var(--ts))/1.5 var(--body)",
          color: 'var(--dim)',
        }}>
          Display and sound belong to this device and follow you between
          dynasties. How you play belongs to this career and rides the save.
        </div>
      </Frame>
    );
  }

  if (page === 'display') {
    return (
      <Frame title="Display" kicker="THIS DEVICE" onBack={() => setPage('index')}>
        <Card tag="TYPE AND MOTION">
          <Choice<number>
            label="Text size"
            value={prefs.textScale}
            options={TEXT_SCALES.map((t) => ({ value: t.value, label: t.label.toUpperCase() }))}
            onPick={(v) => put({ textScale: v })}
          />
          <Choice<FieldMode>
            label="The field"
            value={prefs.field}
            options={[
              { value: '3d', label: '3D' },
              { value: '2d', label: 'DIAMOND' },
            ]}
            onPick={(v) => put({ field: v })}
          />
          <Choice<MotionPref>
            label="Motion"
            value={prefs.motion}
            options={[
              { value: 'system', label: 'SYSTEM' },
              { value: 'full', label: 'FULL' },
              { value: 'reduced', label: 'REDUCED' },
            ]}
            onPick={(v) => put({ motion: v })}
          />
        </Card>
        <Card tag="TEACHING">
          <Row
            label="Explain the screens"
            blurb="Each screen says what it is for, once."
            note={prefs.tutorials
              ? 'Each screen says what it is for, once.'
              : 'Nothing explains itself. Turn this back on and the reset below still works.'}
            on={prefs.tutorials}
            onToggle={() => put({ tutorials: !prefs.tutorials })}
          />
          <button
            className="tap"
            onClick={() => { resetTutorials(); setTaught(true); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px',
              borderTop: '1px solid var(--hairline)',
            }}
          >
            <div style={{ font: "600 calc(11.5px * var(--ts))/1.2 var(--body)" }}>
              {taught ? 'The screens will teach again' : 'Show the tutorials again'}
            </div>
            <div style={{
              marginTop: 2, font: "400 calc(10px * var(--ts))/1.35 var(--body)",
              color: 'var(--dim)',
            }}>Every screen explains itself once more on your next visit.</div>
          </button>
        </Card>
      </Frame>
    );
  }

  if (page === 'sound') {
    return (
      <Frame title="Sound" kicker="THIS DEVICE" onBack={() => setPage('index')}>
        <Card tag="NOT YET BUILT">
          <Row
            label="Sound" blurb="Bat, glove, crowd."
            note="Arrives with broadcast."
            on={false} disabled
          />
          <Row
            label="Haptics" blurb="A tap on contact, and on the third out."
            note="Arrives with broadcast."
            on={false} disabled
          />
        </Card>
        <div style={{
          marginTop: 12, font: "400 calc(10.5px * var(--ts))/1.5 var(--body)",
          color: 'var(--dim)',
        }}>
          The game is completely silent and always has been. Both are stored and
          defaulted off, so turning them on when the broadcast stage builds them
          is a switch rather than a migration.
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      title="How you play"
      kicker="THIS CAREER"
      onBack={() => setPage('index')}
    >
      <div style={{
        marginBottom: 4,
        font: "400 calc(11px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
      }}>
        The game always models everything — injuries, development, all
        ninety-six programs. This decides how much of it you are asked about.
      </div>

      <Card tag="YOUR CAREER" note={depth.mode === 'full' ? 'FULL' : 'CASUAL'}>
        <Choice<DepthMode>
          label="Depth"
          value={depth.mode}
          options={[
            { value: 'full', label: 'FULL' },
            { value: 'casual', label: 'CASUAL' },
          ]}
          onPick={(m) => setDepthMode(m)}
        />
      </Card>

      <Card tag="WHAT YOU HANDLE">
        {SYSTEMS.map((sys) => {
          const on = handles(depth, sys.key);
          const overridden = !sys.comingIn && presetSays(depth.mode, sys.key) !== on;
          return (
            <Row
              key={sys.key}
              label={sys.label}
              blurb={sys.blurb}
              on={sys.comingIn ? false : on}
              disabled={!!sys.comingIn}
              note={sys.comingIn
                ? `Arrives with ${sys.comingIn}.`
                : on
                  ? (overridden ? `${sys.blurb} · your choice, not the preset` : sys.blurb)
                  : (overridden ? `${sys.whenOff} · your choice, not the preset` : sys.whenOff)}
              onToggle={() => setDepthSystem(sys.key as SystemKey, !on)}
            />
          );
        })}
      </Card>
    </Frame>
  );
}

/**
 * A settings page: a pinned title, and a body that scrolls.
 *
 * The scroller is the entire point — see the note in `Settings`. Anything that
 * lives in the overlay has to bring its own, because the overlay deliberately
 * does not scroll on its own behalf.
 */
function Frame(
  { title, kicker, onBack, children }:
  { title: string; kicker: string; onBack?: () => void; children: ReactNode },
) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{
        flex: 'none', padding: '12px 14px 8px', background: 'var(--field)',
      }}>
        <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
          {onBack ? (
            <button
              onClick={onBack}
              className="tap"
              style={{
                font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                color: 'var(--clay)', padding: '0 10px 4px 0',
              }}
            >&lsaquo; SETTINGS</button>
          ) : <div className="label">{kicker}</div>}
          <div style={{
            font: "800 calc(21px * var(--ts))/0.95 var(--display)",
            marginTop: 4, textTransform: 'uppercase',
          }}>{title}</div>
        </div>
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px 24px',
      }}>{children}</div>
    </div>
  );
}
