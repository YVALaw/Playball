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
  type DevicePrefs, type MotionPref, type ThemePref,
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
      className="toggle-row setting-toggle-card tap"
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
    <div className="setting-choice setting-choice-card" aria-disabled={disabled}>
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

function SettingIcon({ kind }: { kind: 'display' | 'sound' | 'play' | 'saves' }) {
  if (kind === 'display') return <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/></svg>;
  if (kind === 'sound') return <svg viewBox="0 0 24 24" aria-hidden><path d="M4 10h4l5-4v12l-5-4H4zM17 9c1.5 1 1.5 5 0 6M19 6c3 3 3 9 0 12"/></svg>;
  if (kind === 'play') return <svg viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M7 4v6M4 17h16M16 14v6"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden><path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 16h8"/></svg>;
}

const PAGES: { id: Exclude<Page, 'index'> | 'saves'; title: string; blurb: string }[] = [
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
      <Frame title="Settings" kicker="CONTROL ROOM">
        <section className="settings-command-hero">
          <small>PLAYBALL</small>
          <strong>Make the game fit you.</strong>
          <p>Device preferences stay on this phone. Career control travels with the save.</p>
        </section>
        <section className="settings-tile-grid">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className="settings-tile tap"
              onClick={() => {
                if (p.id === 'saves') openOverlay('saves');
                else setPage(p.id as Page);
              }}
            >
              <span className="settings-tile-icon"><SettingIcon kind={p.id} /></span>
              <span><strong>{p.title}</strong><small>{p.blurb}</small></span>
              <b>›</b>
            </button>
          ))}
        </section>
        <section className="settings-scope-note">
          <span><small>DEVICE</small><strong>Display · Sound</strong></span>
          <span><small>CAREER</small><strong>How you play</strong></span>
        </section>
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
            note={prefs.tutorials ? '\u00a0' : 'Nothing explains itself.'}
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
            className="settings-reset-card tap"
            onClick={() => { resetTutorials(); setTaught(true); }}
          >
            <span><small>TEACHING RESET</small><strong>{taught ? 'The screens will teach again' : 'Show the tutorials again'}</strong></span>
            <em>On your next visit to each.</em>
            <b>↻</b>
          </button>
          )}
        </section>
      </Frame>
    );
  }

  if (page === 'sound') {
    return (
      <Frame title="Sound" kicker="THIS DEVICE" onBack={() => setPage('index')}>
        <SectionHeading kicker="SETTINGS" title="The broadcast" />
        <section className="settings-list">
          <Row
            label="Sound" blurb="Bat, glove, the crowd under a live game."
            note={prefs.sound
              ? 'The crack, the glove, and a crowd that knows the score.'
              : 'Silent. The game plays exactly the same way.'}
            on={prefs.sound}
            onToggle={() => put({ sound: !prefs.sound })}
          />
          <Row
            label="Haptics" blurb="A tap on contact, and on the third out."
            note={prefs.haptics
              ? 'A light touch. The walk-off gets the only real buzz.'
              : 'Off. Nothing hums.'}
            on={prefs.haptics}
            onToggle={() => put({ haptics: !prefs.haptics })}
          />
        </section>
      </Frame>
    );
  }

  return (
    <Frame
      title="How you play"
      kicker="THIS CAREER"
      onBack={() => setPage('index')}
    >
      <section className="settings-career-note">
        <small>CAREER CONTROL</small>
        <strong>The world stays the same. Your desk changes.</strong>
        <p>The game always models injuries, development and all ninety-six programs. This decides how much lands on you.</p>
      </section>

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
      <main className="module-workspace settings-workspace">{children}</main>
    </FixedHeader>
  );
}
