// A sheet, tip or dialog belongs to the screen that opened it: the frame's
// rule hides every portal whose screen is kept alive but not on show
// (back plan S1, 2026-09-30).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FRAME_OWNER, ScreenOwner, lastShown, ownerRule } from '../src/ui/screenOwner.js';
import { Modal } from '../src/ui/Modal.js';

describe('ownerRule', () => {
  it('hides every owned portal but the frame, the overlay slots and the live screen', () => {
    // The overlay slots answer to overlayRule (back plan S5).
    expect(ownerRule('team|stats#3')).toBe(
      '.app-frame [data-owner]:not([data-owner="frame"]):not([data-owner^="o:"]):not([data-owner="team|stats#3"]){display:none!important}',
    );
  });

  it('escapes quotes and backslashes in the live owner', () => {
    const rule = ownerRule('a"b\\c');
    expect(rule).toContain(':not([data-owner="a\\"b\\\\c"])');
    // One selector, one declaration block: nothing broke out of the string.
    expect(rule.match(/\{/g)).toHaveLength(1);
  });

  it('with no live screen still hides only owned portals', () => {
    expect(ownerRule('')).toContain(':not([data-owner=""])');
  });
});

describe('lastShown (the Android back gesture moves the sheet on show)', () => {
  const el = (name: string, drawn: boolean) => ({ name, getClientRects: () => ({ length: drawn ? 1 : 0 }) });

  it('skips a hidden screen\'s copy that comes last in the frame', () => {
    // Season plan > Hire one with Office > Staff kept alive: the probe's order.
    const hosts = [el('season plan', true), el('open seat, frame', true), el('open seat, hidden staff', false)];
    expect(lastShown(hosts)?.name).toBe('open seat, frame');
  });

  it('takes the last one when every copy is drawn, and the last when none is', () => {
    expect(lastShown([el('a', true), el('b', true)])?.name).toBe('b');
    expect(lastShown([el('a', false), el('b', false)])?.name).toBe('b');
    expect(lastShown([])).toBeNull();
  });

  // App's own peek went at the switch (back plan SW, 2026-09-30): the target
  // is the newest level's, found by navTarget.ts's live query, which App hands
  // the native gesture.
  it('the gesture\'s peek picks its targets through it', () => {
    const target = readFileSync('src/ui/navTarget.ts', 'utf8');
    expect(target).toContain('lastShown(document.querySelectorAll<HTMLElement>(sel))');
    expect(target).toContain("case 'c': return asShown(q.last('.pb-sheet-host > .pb-sheet'));");
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    expect(app).toContain('const q = domQuery(() => mainRef.current);');
    expect(app).toContain('toTarget(nav.newest(), q)');
  });
});

describe('portal roots carry their owner', () => {
  const modal = () => createElement(Modal, { kicker: 'Heads up', title: 'Title', lines: ['One line'], action: 'OK', onClose: () => {} });

  it('Modal renders inline without a document, owned by the frame by default', () => {
    const html = renderToStaticMarkup(modal());
    expect(html).toContain('pb-dialog-host');
    expect(html).toContain(`data-owner="${FRAME_OWNER}"`);
  });

  it('Modal takes the owner of the screen around it', () => {
    const html = renderToStaticMarkup(createElement(ScreenOwner.Provider, { value: 'x' }, modal()));
    expect(html).toContain('data-owner="x"');
  });

  it('every portal root names its owner, and App provides one per kept screen', () => {
    const src = (p: string): string => readFileSync(p, 'utf8');
    for (const [file, root] of [
      ['src/ui/components/ui/layout.tsx', 'pb-sheet-host'],
      ['src/ui/Modal.tsx', 'pb-dialog-host'],
      ['src/ui/Tutorial.tsx', 'pb-tip-host'],
      ['src/ui/PositionPicker.tsx', 'pb-picker-host'],
      ['src/ui/Overlay.tsx', 'pb-fulloverlay'],
    ] as const) {
      const text = src(file);
      expect(text, file).toContain(root);
      expect(text, file).toContain('data-owner={');
      expect(text, file).toContain('useScreenOwner()');
    }
    const app = src('src/ui/App.tsx');
    expect(app).toContain('<ScreenOwner.Provider value={`${routeKey(r)}#${gen}`}>');
    expect(app).toContain('<style>{ownerRule(liveOwner)}</style>');
  });
});
