// Settings.tsx
// Two kinds of preference, kept visibly apart.
//
// An index and four pages. Display, sound and god mode belong to the device:
// loading a five-year-old career must not shrink your text, and starting a new
// one must not turn the sound back on. How you play belongs to the career and
// rides its save, so it is only offered while a career is open; on the start
// screen there is no career to write it to, and anything set there would be
// thrown away the moment one began. A new career chooses it on its own step.

import { setSoundEnabled } from '../sound.js';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { billingState, onBilling, buyGodMode, restorePurchases } from '../../state/billing.js';
import { useDynasty } from '../../state/store.js';
import { SaveAndLeave } from '../components/SaveAndLeave.js';
import { TEST_SHORTCUTS } from '../../state/testBuild.js';
import { SCOUTING } from '../../state/features.js';
import {
  SYSTEMS, handles, presetSays, type DepthMode, type SystemKey,
} from '../../state/depth.js';
import {
  readPrefs, writePrefs, applyPrefs, TEXT_SCALES,
  type DevicePrefs, type MotionPref, type ThemePref, type FieldMode,
} from '../../state/devicePrefs.js';
import {
  Button, Callout, Card, List, ListRow, ScreenHeader, SectionHeader, SegmentedControl, StatusBadge, Switch, Table,
} from '../components/ui/index.js';

/*
  Sound credits, shipped in the app (stage 19).

  Every sample was pulled from freesound.org and processed by
  `scripts/prep-sfx.mjs`; the manifest and each sound's licence live in
  `public/sfx/CREDITS.md`. Three of the eight are Creative Commons
  Attribution, which *requires* the author credited wherever the app ships —
  so the credit rides the build, here, and not only in the repo. The five
  CC0 samples ask for nothing, but a name costs nothing and they get one too.
  Licences verified against each sound's freesound page, September 16 2026.
*/
type SoundCredit = { heard: string; author: string; licence: string; id: string };
const SOUND_CREDITS: readonly SoundCredit[] = [
  { heard: 'The crack of the bat', author: 'CGEffex', licence: 'CC BY 4.0', id: '93136' },
  { heard: 'A second bat', author: 'Urkki69', licence: 'CC0', id: '628352' },
  { heard: 'Ball into the glove', author: 'Luisa_Sanchez', licence: 'CC0', id: '816984' },
  { heard: 'A second glove', author: 'keus92', licence: 'CC0', id: '432502' },
  { heard: '“Play ball!”', author: 'CGEffex', licence: 'CC BY 4.0', id: '101137' },
  { heard: 'The crowd', author: 'Adrian_Gomar', licence: 'CC BY 3.0', id: '197285' },
  { heard: 'Applause', author: 'jasinski', licence: 'CC0', id: '18364' },
  { heard: 'The umpire', author: 'jcookvoice', licence: 'CC0', id: '625473' },
];

/** One setting with a few values: what it is, the choice, and what the choice means. */
function Choice<T extends string>(
  { title, value, options, onPick, note }: {
    title: string; value: T;
    options: readonly { value: T; label: string }[];
    onPick: (v: T) => void;
    note?: ReactNode;
  },
) {
  return (
    <Card title={title}>
      <SegmentedControl<T> kind="radio" label={title} value={value} onChange={onPick} options={options} />
      {note && <p className="pb-text-muted">{note}</p>}
    </Card>
  );
}

export function Settings() {
  const depth = useDynasty((s) => s.depth);
  const setDepthMode = useDynasty((s) => s.setDepthMode);
  const setDepthSystem = useDynasty((s) => s.setDepthSystem);
  const resetTutorials = useDynasty((s) => s.resetTutorials);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const atStart = useDynasty((s) => s.atStart);

  // One page at a time. Each page scrolls in the overlay's scroller; the
  // overlay's Back steps a page back to this index before it closes anything.
  const page = useDynasty((s) => s.settingsPage);
  const setPage = useDynasty((s) => s.setSettingsPage);

  // Device preferences are not in the store: nothing else in the app reads
  // them, they must not ride a save, and they have to survive with no career
  // loaded at all.
  const [prefs, setPrefs] = useState<DevicePrefs>(() => readPrefs());
  const season = useDynasty((s) => s.season);
  const godMode = useDynasty((s) => s.godMode);
  const forkToSandbox = useDynasty((s) => s.godForkToSandbox);
  const closeOverlay = useDynasty((s) => s.closeOverlay);
  const openGod = useDynasty((s) => s.openGod);
  const put = (patch: Partial<DevicePrefs>): void => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writePrefs(next);
    applyPrefs(next);
  };
  /*
    The store's side of god mode (stage 19). `App` writes the entitlement
    when Google Play says the product is owned; this screen re-reads the
    device prefs at that moment so the panel turns over without a reload.
  */
  const billing = useSyncExternalStore(onBilling, billingState, billingState);
  // A real, purchasable product: the store is reachable and Play returned a
  // price. Before the product is created in the console (billing deferred),
  // this is false and no purchase UI is offered (05 §62.3).
  const canBuy = billing.available && !!billing.price;
  useEffect(() => {
    if (billing.owned && !prefs.godMode) setPrefs(readPrefs());
  }, [billing.owned, prefs.godMode]);

  const [taught, setTaught] = useState(false);
  const inCareer = !!season && !atStart;

  if (page === 'index') {
    return (
      <main className="pb-page">
        <ScreenHeader
          title="Settings"
        />

        <section>
          <SectionHeader title="This device" />
          <List label="Device settings">
            <ListRow icon="text-size" title="Display" subtitle="Text size, theme, the field, motion and tutorials" onClick={() => setPage('display')} />
            <ListRow icon="speaker" title="Sound" subtitle="Bat, glove, the crowd, and haptics" onClick={() => setPage('sound')} />
            <ListRow
              icon="lightning"
              title="God mode"
              subtitle="The sandbox: edit anything in a career"
              status={prefs.godMode ? <StatusBadge tone="positive">Unlocked</StatusBadge> : <StatusBadge tone="neutral" icon="lock">Locked</StatusBadge>}
              onClick={() => setPage('god')}
            />
          </List>
        </section>

        <section>
          <SectionHeader
            title={inCareer ? 'This career' : 'Careers'}
            description={inCareer ? undefined : 'Chosen when a career starts'}
          />
          <List label="Career settings">
            {inCareer && (
              <ListRow
                icon="layers"
                title="How you play"
                subtitle={`${depth.mode === 'full' ? 'Full career' : 'Casual'}: what you handle and what your staff does`}
                onClick={() => setPage('play')}
              />
            )}
            <ListRow icon="archive" title="Saved careers" subtitle="Save a copy, open another, or delete one" onClick={() => openOverlay('saves')} />
          </List>
        </section>

        {/* The way back to the front door: "in settings we should have a
            button to go back to the main menu in case a player wants to start
            a new career." It saves first. */}
        {inCareer && (
          <Card eyebrow="Main menu" title="Leave this career">
            <p className="pb-text-muted">Saves first.</p>
            <SaveAndLeave label="Save and leave" block />
          </Card>
        )}
      </main>
    );
  }

  if (page === 'display') {
    return (
      <main className="pb-page">
        <ScreenHeader eyebrow="This device" title="Display" />
        <Choice<string>
          title="Text size"
          value={String(prefs.textScale)}
          options={TEXT_SCALES.map((t) => ({ value: String(t.value), label: t.label }))}
          onPick={(v) => put({ textScale: Number(v) })}
          note="Every screen scales with it."
        />
        <Choice<ThemePref>
          title="Theme"
          value={prefs.theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onPick={(v) => put({ theme: v })}
          note={prefs.theme === 'system' ? 'Follows your phone’s light or dark setting.' : undefined}
        />
        <Choice<FieldMode>
          title="The field in a live game"
          value={prefs.field}
          options={[
            { value: '3d', label: '3D' },
            { value: '2d', label: '2D' },
          ]}
          onPick={(v) => put({ field: v })}
          note={prefs.field === '3d' ? 'A 3D ballpark. 2D is lighter on older phones.' : 'A flat diagram of the diamond, lighter on older phones.'}
        />
        <Choice<MotionPref>
          title="Motion"
          value={prefs.motion}
          options={[
            { value: 'system', label: 'System' },
            { value: 'full', label: 'Full' },
            { value: 'reduced', label: 'Reduced' },
          ]}
          onPick={(v) => put({ motion: v })}
          note={prefs.motion === 'reduced' ? 'Screens change without sliding or fading.'
            : prefs.motion === 'full' ? 'Every slide and fade, whatever your phone says.'
              : 'Follows your phone’s reduce-motion setting.'}
        />
        <section>
          <SectionHeader title="Teaching" />
          <List label="Teaching">
            <Switch
              label="Automatic tutorials"
              description="The tour and first-visit tips"
              checked={prefs.tutorials}
              onChange={() => put({ tutorials: !prefs.tutorials })}
            />
          </List>
          {/*
            The replay only exists while tutorials are on. The switch turns
            explaining off and this makes every screen explain itself again, so
            with the switch off it would either do nothing or quietly undo it.
          */}
          {prefs.tutorials && (
            <Callout
              tone={taught ? 'positive' : 'neutral'}
              icon={taught ? undefined : 'reset'}
              title={taught ? 'Tutorials are ready to replay' : 'Replay the help'}
              action={taught ? undefined : { label: 'Replay tutorials', onClick: () => { resetTutorials(); setTaught(true); } }} />
          )}
        </section>
      </main>
    );
  }

  if (page === 'sound') {
    return (
      <main className="pb-page">
        <ScreenHeader eyebrow="This device" title="Sound" />
        <List label="Sound">
          <Switch
            label="Sound"
            description="Bat, glove and crowd"
            checked={prefs.sound}
            onChange={() => { put({ sound: !prefs.sound }); setSoundEnabled(!prefs.sound); }}
          />
          <Switch
            label="Haptics"
            description="Taps on contact and outs"
            checked={prefs.haptics}
            onChange={() => put({ haptics: !prefs.haptics })}
          />
        </List>
        <Card title="Sound credits" eyebrow="Samples from freesound.org" flush>
          <Table
            dense
            label="Sound credits"
            columns={[
              { label: 'Sound', grow: true },
              { label: 'By', grow: true },
              { label: 'Licence', width: '80px', align: 'right' },
            ]}
            rows={SOUND_CREDITS.map((c) => ({
              key: c.id,
              cells: [c.heard, <span className="pb-cell-stack" key="a"><span>{c.author}</span><small>freesound.org/s/{c.id}</small></span>, c.licence],
            }))}
            caption="Trimmed and downsampled for the game. Thank you to the authors."
          />
        </Card>
      </main>
    );
  }

  if (page === 'god') {
    return (
      <main className="pb-page">
        <ScreenHeader
          eyebrow="This device"
          title="God mode"
          trailing={prefs.godMode ? <StatusBadge tone="positive" size="lg">Unlocked</StatusBadge> : <StatusBadge tone="neutral" size="lg" icon="lock">Locked</StatusBadge>}
        />

        <Card eyebrow="This device" title={prefs.godMode ? 'Available for every new career' : 'One purchase, permanent'}>
          <p className="pb-text-muted">
            {prefs.godMode
              ? 'Turn it on when you start a career, or fork one below.'
              : canBuy
                ? `One purchase on Google Play, ${billing.price}. Yours for good.`
                : TEST_SHORTCUTS
                  ? 'Test builds unlock it for free.'
                  : 'Arrives with the store listing.'}
          </p>
          {billing.error && canBuy && <Callout tone="negative">{billing.error}</Callout>}
          {/*
            The purchase goes through Google Play (state/billing.ts) and is shown
            only when the store offers the product with a price. Before that a
            test build lets a tester unlock it free; a store build shows the
            state and no way to flip it (05 §62.3).
          */}
          {!prefs.godMode && canBuy && (
            <Button variant="primary" block icon="lightning" disabled={billing.busy} onClick={() => void buyGodMode()}>
              {billing.busy ? 'One moment…' : `Unlock god mode · ${billing.price}`}
            </Button>
          )}
          {!prefs.godMode && !canBuy && TEST_SHORTCUTS && (
            <Button variant="primary" block icon="lightning" onClick={() => put({ godMode: true })}>Unlock god mode</Button>
          )}
          {prefs.godMode && TEST_SHORTCUTS && (
            <Button variant="secondary" block onClick={() => put({ godMode: false })}>Remove access (test build)</Button>
          )}
          {!prefs.godMode && canBuy && (
            <Button variant="quiet" block disabled={billing.busy} onClick={() => void restorePurchases()}>
              Already bought it? Restore the purchase
            </Button>
          )}
        </Card>

        {prefs.godMode && season && (
          <Card
            eyebrow="This career"
            title={godMode ? 'God mode is on in this career' : 'Keep this career honest'}
            trailing={godMode ? <StatusBadge tone="positive">Sandbox</StatusBadge> : undefined}
          >
            <p className="pb-text-muted">
              {godMode ? 'Tap a lightning bolt to edit anything.' : 'Makes a separate sandbox copy. This career stays as it is.'}
            </p>
            {godMode ? (
              <Button variant="primary" block icon="lightning" onClick={() => { closeOverlay(); openGod({ kind: 'tab', tab: 'program' }); }}>Open god mode</Button>
            ) : (
              <Button variant="secondary" block icon="swap" onClick={() => void forkToSandbox()}>Fork into a sandbox copy</Button>
            )}
          </Card>
        )}

        <Card title="How it works" flush>
          <List label="How god mode works">
            <ListRow lead={<span className="pb-mono pb-mono--neutral">1</span>} title="Unlock it once on this device." />
            <ListRow lead={<span className="pb-mono pb-mono--neutral">2</span>} title="Turn it on when you create a career, or fork a career you already have." />
            <ListRow lead={<span className="pb-mono pb-mono--neutral">3</span>} title="Tap the bolt beside a player, program or system to edit it where it is." />
          </List>
        </Card>
      </main>
    );
  }

  // How you play: only reachable with a career open (see the index).
  return (
    <main className="pb-page">
      <ScreenHeader
        eyebrow="This career"
        title="How you play"
      />
      <Choice<DepthMode>
        title="Style"
        value={depth.mode}
        options={[
          { value: 'full', label: 'Full career' },
          { value: 'casual', label: 'Casual' },
        ]}
        onPick={(m) => setDepthMode(m)}
        note={`${depth.mode === 'full'
          ? 'Every decision is yours.'
          : 'Your staff handles the routine and you handle the season.'} Switching style keeps anything you changed yourself below.`}
      />
      <section>
        <SectionHeader title="What you handle" />
        <List label="What you handle">
          {/* Scouting reports are switched off in this version (features.ts), so
              their row is not offered: a live switch that did nothing read as
              the recruiting switch (2026-09-29, "I selected to run the scouting
              myself but I can not spend points"). */}
          {SYSTEMS.filter((sys) => SCOUTING || sys.key !== 'scouting').map((sys) => {
            const on = handles(depth, sys.key);
            // Recruiting in a casual career is either way by default: a new one
            // starts with the staff running it (the creation step's default,
            // 2026-09-28), an older one with the coach. Neither is a change.
            const eitherWay = sys.key === 'recruiting' && depth.mode === 'casual';
            const overridden = !sys.comingIn && !eitherWay && presetSays(depth.mode, sys.key) !== on;
            return (
              <Switch
                key={sys.key}
                label={sys.label}
                description={sys.comingIn ? 'Not in this version' : `${on ? sys.blurb : sys.whenOff}${overridden ? ' (changed)' : ''}`}
                checked={sys.comingIn ? false : on}
                disabled={!!sys.comingIn}
                onChange={() => setDepthSystem(sys.key as SystemKey, !on)}
              />
            );
          })}
        </List>
      </section>
    </main>
  );
}
