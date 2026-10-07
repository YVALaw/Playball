// inert-under.test.ts
// While a layer is up, the rest of the frame is out of reach (audit 17, M18):
// src/ui/inertUnder.ts against a small stand-in for the frame's children.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyInert } from '../src/ui/inertUnder.js';

class El {
  attrs = new Map<string, string>();
  children: El[] = [];
  constructor(public tagName: string, public cls: string[] = [], public shown = true, attrs: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  matches(sel: string): boolean {
    return sel.split(',').map((s) => s.trim()).some((s) => {
      const attr = /^\[([\w-]+)="([^"]+)"\]$/.exec(s);
      if (attr) return this.attrs.get(attr[1]!) === attr[2];
      return s.startsWith('.') && this.cls.includes(s.slice(1));
    });
  }
  querySelectorAll(sel: string): El[] {
    const out: El[] = [];
    const walk = (e: El): void => { for (const c of e.children) { if (c.matches(sel)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  getClientRects(): unknown[] { return this.shown ? [{}] : []; }
  hasAttribute(k: string): boolean { return this.attrs.has(k); }
  getAttribute(k: string): string | null { return this.attrs.get(k) ?? null; }
  setAttribute(k: string, v: string): void { this.attrs.set(k, v); }
  removeAttribute(k: string): void { this.attrs.delete(k); }
}
const frameWith = (...kids: El[]): El => { const f = new El('DIV', ['app-frame']); f.children = kids; return f; };
const inert = (e: El): boolean => e.hasAttribute('inert');

describe('the screen under a layer', () => {
  it('goes inert while a visible layer is up, and comes back when it closes', () => {
    const header = new El('HEADER'); const main = new El('MAIN'); const nav = new El('NAV');
    const tip = new El('DIV', ['pb-tip-host'], true, { role: 'dialog' });
    const frame = frameWith(header, main, nav, tip);
    applyInert(frame as unknown as Element);
    expect([header, main, nav].map(inert)).toEqual([true, true, true]);
    expect(inert(tip)).toBe(false);
    frame.children = [header, main, nav];
    applyInert(frame as unknown as Element);
    expect([header, main, nav].map(inert)).toEqual([false, false, false]);
  });

  it('ignores a layer that is hidden, as a kept-alive screen\'s is', () => {
    const main = new El('MAIN');
    const frame = frameWith(main, new El('DIV', ['pb-sheet-host'], false));
    applyInert(frame as unknown as Element);
    expect(inert(main)).toBe(false);
  });

  it('never makes inert a child that holds the visible layer itself', () => {
    const main = new El('MAIN');
    main.children = [new El('DIV', ['pb-fulloverlay'], true, { 'aria-modal': 'true' })];
    const header = new El('HEADER');
    const frame = frameWith(header, main);
    applyInert(frame as unknown as Element);
    expect(inert(header)).toBe(true);
    expect(inert(main)).toBe(false);
  });

  it('leaves alone an inert it did not set: a lower overlay slot stays inert', () => {
    const lower = new El('DIV', ['pb-tableoverlay'], true, { inert: '' });
    const frame = frameWith(new El('MAIN'), lower);
    frame.children = [new El('MAIN'), lower];
    applyInert(frame as unknown as Element);
    expect(inert(lower)).toBe(true);
  });
});

describe('the pages laid over the frame are dialogs', () => {
  it('take focus, trap Tab and close on Escape through useDialogFocus', () => {
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    expect(app).toContain('useDialogFocus(ref, back, { active: top, layer: false });');
    expect(app).toContain('role="dialog"');
    expect(app).toContain("useEffect(() => watchInert(document.getElementById('root') ?? document.body), []);");
  });
});
