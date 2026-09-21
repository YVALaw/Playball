// god/controls.tsx — the parts every god-mode editor is built from.
//
// A slider that commits when the thumb lets go, a line of text that commits on
// Enter or blur, a switch, a button that asks twice, and the note that confirms
// an edit, all drawn with the design system's own pieces. Labels written in
// capitals by the engine's tables are said in sentence case here, once, so no
// editor has to remember to.

import { useState, type ReactNode } from 'react';
import { Callout, ConfirmButton, ScreenHeader, Switch } from '../components/ui/index.js';

/** A label a table wrote in capitals, in sentence case: "GROUND BALL" reads "Ground ball". */
export function words(text: string): string {
  if (!/[A-Z]/.test(text) || text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** One god-mode page: what it edits, then the controls. */
export function GodPage(
  { eyebrow, title, description, children }:
  { eyebrow: string; title: ReactNode; description?: ReactNode; children: ReactNode },
) {
  return (
    <main className="pb-page">
      <ScreenHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </main>
  );
}

/** A number on a rail, with its scale. Commits when the thumb lets go, not on every pixel. */
export function Slider(
  { label, value, min = 1, max = 99, onCommit, hint }:
  { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void; hint?: ReactNode },
) {
  const [live, setLive] = useState<number | null>(null);
  // Generated ratings can be fractional; the rail and its number are whole.
  const shown = Math.round(live ?? value);
  const commit = (): void => {
    if (live !== null && live !== Math.round(value)) onCommit(live);
    setLive(null);
  };
  return (
    <label className="pb-godslider">
      <span className="pb-godslider__head">
        <span className="pb-godslider__label">{words(label)}</span>
        <b>{shown}<small> / {max}</small></b>
      </span>
      <input
        className="pb-range"
        type="range"
        min={min}
        max={max}
        value={shown}
        onChange={(e) => setLive(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={words(label)}
      />
      {hint && <span className="pb-field__hint">{hint}</span>}
    </label>
  );
}

/** A line of text. Commits on Enter or when focus leaves. */
export function Field(
  { label, value, onCommit, placeholder, numeric = false }:
  { label: string; value: string; onCommit: (v: string) => void; placeholder?: string; numeric?: boolean },
) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft !== null && draft.trim() !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <label className="pb-field">
      <span className="pb-field__label">{words(label)}</span>
      <input
        className="pb-field__input"
        type="text"
        inputMode={numeric ? 'numeric' : undefined}
        value={draft ?? value}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
    </label>
  );
}

/** A choice from a short list, as a native select. */
export function Choose<T extends string | number>(
  { label, value, options, onChange, disabled }:
  {
    label: string; value: T; disabled?: boolean;
    options: ReadonlyArray<{ value: T; label: string } | { group: string; options: ReadonlyArray<{ value: T; label: string }> }>;
    onChange: (v: T) => void;
  },
) {
  const flat = options.flatMap((o) => ('group' in o ? o.options : [o]));
  return (
    <label className="pb-field">
      <span className="pb-field__label">{words(label)}</span>
      <select
        className="pb-field__input pb-select"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const hit = flat.find((o) => String(o.value) === e.target.value);
          if (hit) onChange(hit.value);
        }}
      >
        {options.map((o) => ('group' in o ? (
          <optgroup key={o.group} label={o.group}>
            {o.options.map((x) => <option key={String(x.value)} value={String(x.value)}>{x.label}</option>)}
          </optgroup>
        ) : <option key={String(o.value)} value={String(o.value)}>{o.label}</option>))}
      </select>
    </label>
  );
}

/** On or off, said plainly. */
export function Toggle(
  { label, on, onChange, note }:
  { label: string; on: boolean; onChange: (on: boolean) => void; note?: string },
) {
  return (
    <div className="pb-list">
      <Switch label={words(label)} description={note} checked={on} onChange={(c) => onChange(c)} />
    </div>
  );
}

/** A button that wants a second press before it does anything it cannot undo. */
export function SureButton(
  { label, onSure, armed }: { label: string; onSure: () => void; armed?: string },
) {
  return (
    <ConfirmButton
      block
      variant="danger"
      idle={words(label)}
      armed={armed ?? 'Tap again: this cannot be undone'}
      onConfirm={() => { onSure(); }}
    />
  );
}

/** The note that confirms an edit, or says why it did not happen. */
export function Toast({ note }: { note: string | null }) {
  return note ? <Callout tone="info" role="status">{note}</Callout> : null;
}
