// Settings.tsx
// Two kinds of preference, kept visibly apart.
//
// An index and four pages. HOW YOU PLAY is about a *career* — how deep a game
// you want this dynasty to be — and rides the save. DISPLAY and SOUND are about
// a *device* and ride the phone: loading a five-year-old dynasty must not shrink
// your text, and starting a new one must not turn the sound back on. The index
// says which is which in a line, so nobody has to be told twice.

import { useState, type ReactNode } from 'react';
import { FixedHeader } from '../Sticky.js';
import { ModuleIntro, SectionHeading, Segmented } from '../components/Kit.js';
import { useDynasty, type SettingsPage } from '../../state/store.js';
import {
  SYSTEMS, handles, presetSays, type DepthMode, type SystemKey,
} from '../../state/depth.js';
import {
  readPrefs, writePrefs, applyPrefs, TEXT_SCALES,
  type DevicePrefs, type FieldMode, type MotionPref, type ThemePref,
} from '../../state/devicePrefs.js';

/** A row that reads as a sentence and toggles on the right. */
function Row(
  { label, blurb, on, disabled, note, onToggle }: {
    label: string; blurb: string; on: boolean;
    disabled?: boolean; note?: string; onToggle?: () => void;
  },
) {
  return (
    <button
      className="toggle-row tap"
      type="button"
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
    >
      <span>
        <strong>{label}</strong>
        <small>{note ?? blurb}</small>
      </span>
      <i className={on && !disabled ? 'on' : ''}><b /></i>
    </button>
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
    <div className="setting-choice" aria-disabled={disabled}>
      <strong>{label}</strong>
      <Segmented
        label={label}
        value={String(value)}
        onChange={(v) => {
          const hit = options.find((o) => String(o.value) === v);
          if (hit && !disabled) onPick(hit.value);
        }}
        options={options.map((o) => ({ value: String(o.value), label: o.label }))}
      />
    </div>
  );
}

/** The four pages, and the index that lists them. */
type Page = SettingsPage;

const PAGES: { id: Page | 'saves'; title: string; blurb: string }[] = [
  { id: 'display', title: 'Display', blurb: 'Text size, theme, the field, motion.' },
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
        <SectionHeading kicker="SETTINGS" title="Type and motion" />
        <section className="settings-list">
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
          <Choice<ThemePref>
            label="Theme"
            value={prefs.theme}
            options={[
              { value: 'system', label: 'SYSTEM' },
              { value: 'light', label: 'LIGHT' },
              { value: 'dark', label: 'DARK' },
            ]}
            onPick={(v) => put({ theme: v })}
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
        </section>
        <SectionHeading kicker="SETTINGS" title="Teaching" />
        <section className="settings-list">
          <Row
            label="Explain the screens"
            blurb="Each screen says what it is for, once."
            note={prefs.tutorials
              ? 'Each screen says what it is for, once.'
              : 'Nothing explains itself. Turn this back on and the reset below still works.'}
            on={prefs.tutorials}
            onToggle={() => put({ tutorials: !prefs.tutorials })}
          />
          {/*
            The reset only exists while there is teaching to reset.

            These two sat one on top of the other, and they do opposite things:
            the switch turns explaining off, the button makes every screen
            explain itself again. Reported as the off switch "reactivating the
            tutorials I had already seen", which is precisely what the control
            underneath it does -- so the likeliest reading is that the wrong one
            got pressed, and the layout invited it.

            With the switch off the reset has nothing to do anyway, so it goes
            away rather than sitting there as a live-looking control that either
            does nothing or quietly undoes the setting above it.
          */}
          {prefs.tutorials && (
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
          )}
        </section>
      </Frame>
    );
  }

  if (page === 'sound') {
    return (
      <Frame title="Sound" kicker="THIS DEVICE" onBack={() => setPage('index')}>
        <SectionHeading kicker="SETTINGS" title="Not yet built" />
        <section className="settings-list">
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
        </section>
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

      <SectionHeading kicker="YOUR CAREER" title={depth.mode === 'full' ? 'Full control' : 'Casual'} />
      <section className="settings-list">
        <Choice<DepthMode>
          label="Depth"
          value={depth.mode}
          options={[
            { value: 'full', label: 'FULL' },
            { value: 'casual', label: 'CASUAL' },
          ]}
          onPick={(m) => setDepthMode(m)}
        />
      </section>

      <SectionHeading kicker="SETTINGS" title="What you handle" />
        <section className="settings-list">
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
      </section>
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
    <FixedHeader
      header={
        <>
          {/* No back control of its own. This screen only ever renders inside
              the overlay, and that bar already steps a settings page back to the
              index before it closes anything — reported as two back buttons,
              which is what they were. */}
          <ModuleIntro kicker={kicker} title={title} />
        </>
      }
    >
      <main className="module-workspace">{children}</main>
    </FixedHeader>
  );
}
