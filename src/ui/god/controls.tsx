// god/controls.tsx — the four controls every god-mode editor is built from.
//
// A slider that commits when the thumb lets go, a text line that commits
// on Enter or blur, a plain on/off, and a button that asks twice. They were
// the top of the one-screen desk (05 §61) and moved here when the desk was
// broken up into sheets opened from the places they edit (§61.5).

import { useState } from 'react';

/** A number on a rail. Commits when the thumb lets go, not on every pixel. */
export function Slider(
  { label, value, min = 1, max = 99, onCommit }:
  { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void },
) {
  const [live, setLive] = useState<number | null>(null);
  // Generated ratings can be fractional; the rail and its number are whole.
  const shown = Math.round(live ?? value);
  const commit = (): void => {
    if (live !== null && live !== Math.round(value)) onCommit(live);
    setLive(null);
  };
  return (
    <label className="god-slider">
      <span><small>{label}</small><strong>{shown}</strong></span>
      <input
        type="range"
        min={min}
        max={max}
        value={shown}
        onChange={(e) => setLive(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={label}
      />
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
    <label className="god-field">
      <small>{label}</small>
      <input
        type="text"
        inputMode={numeric ? 'numeric' : undefined}
        value={draft ?? value}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label={label}
      />
    </label>
  );
}

/** On or off, said plainly. */
export function Toggle(
  { label, on, onChange, note }:
  { label: string; on: boolean; onChange: (on: boolean) => void; note?: string },
) {
  return (
    <div className="god-actions">
      <span><small>{label}</small><strong>{on ? 'ON' : 'OFF'}</strong>{note && <em className="god-note">{note}</em>}</span>
      <button type="button" className={`tap${on ? ' active' : ''}`} aria-pressed={on} onClick={() => onChange(!on)}>
        {on ? 'TURN OFF' : 'TURN ON'}
      </button>
    </div>
  );
}

/** A button that wants a second press before it does anything it cannot undo. */
export function SureButton({ label, onSure }: { label: string; onSure: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`tap${armed ? ' god-danger' : ''}`}
      onClick={() => { if (armed) { onSure(); setArmed(false); } else setArmed(true); }}
      onBlur={() => setArmed(false)}
    >{armed ? `${label} · SURE?` : label}</button>
  );
}

/** The note that confirms an edit, under the sheet's last section. */
export function Toast({ note }: { note: string | null }) {
  return note ? <p className="god-note god-toast" role="status">{note}</p> : null;
}
