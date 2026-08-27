// Settings.tsx
// Two kinds of preference, kept visibly apart.
//
// The top of this screen is about a *career* — how deep a game you want this
// dynasty to be — and it rides the save. The bottom is about a *device* — text
// size, the field, sound — and it rides the phone. The separation is not
// pedantry: loading a five-year-old dynasty must not shrink your text, and
// starting a new one must not undo your depth choice. Putting them on one screen
// under two headers is how a player learns which is which without being told.

import { useState } from 'react';
import { Card } from '../components/Kit.js';
import { useDynasty } from '../../state/store.js';
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

export function Settings() {
  const depth = useDynasty((s) => s.depth);
  const setDepthMode = useDynasty((s) => s.setDepthMode);
  const setDepthSystem = useDynasty((s) => s.setDepthSystem);
  const resetTutorials = useDynasty((s) => s.resetTutorials);
  const openOverlay = useDynasty((s) => s.openOverlay);

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

  return (
    <div style={{ padding: '0 14px 30px' }}>

      <Card tag="HOW YOU PLAY" note={depth.mode === 'full' ? 'FULL' : 'CASUAL'}>
        <div style={{ padding: '10px 10px 2px' }}>
          <div style={{
            font: "400 calc(11px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
          }}>
            The game always models everything — injuries, development, all
            ninety-six programs. This decides how much of it you are asked about.
          </div>
        </div>
        <Choice<DepthMode>
          label="Your career"
          value={depth.mode}
          options={[
            { value: 'full', label: 'FULL' },
            { value: 'casual', label: 'CASUAL' },
          ]}
          onPick={(m) => setDepthMode(m)}
        />
      </Card>

      <Card tag="WHAT YOU HANDLE">
        {SYSTEMS.map((s) => {
          const on = handles(depth, s.key);
          const overridden = !s.comingIn
            && presetSays(depth.mode, s.key) !== on;
          return (
            <Row
              key={s.key}
              label={s.label}
              blurb={s.blurb}
              on={s.comingIn ? false : on}
              disabled={!!s.comingIn}
              note={s.comingIn
                ? `Arrives with ${s.comingIn}.`
                : on
                  ? (overridden ? `${s.blurb} · your choice, not the preset` : s.blurb)
                  : (overridden ? `${s.whenOff} · your choice, not the preset` : s.whenOff)}
              onToggle={() => setDepthSystem(s.key as SystemKey, !on)}
            />
          );
        })}
      </Card>

      <Card tag="DISPLAY">
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

      <Card tag="SOUND">
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

      <Card tag="THIS DEVICE">
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
        <button
          className="tap"
          onClick={() => openOverlay('saves')}
          style={{
            width: '100%', textAlign: 'left', padding: '10px',
            borderTop: '1px solid var(--hairline)',
          }}
        >
          <div style={{ font: "600 calc(11.5px * var(--ts))/1.2 var(--body)" }}>
            Saved dynasties
          </div>
          <div style={{
            marginTop: 2, font: "400 calc(10px * var(--ts))/1.35 var(--body)",
            color: 'var(--dim)',
          }}>Name a save, load an old career, or start again.</div>
        </button>
      </Card>

    </div>
  );
}
