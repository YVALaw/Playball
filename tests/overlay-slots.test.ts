// An overlay under another stays mounted: the Inbox under the standings keeps
// its scroll, the coach profile its tab (back plan S5, 2026-09-30). The lower
// slots are drawn under the top one, inert and hidden from readers, and their
// sheets and tips answer to their slot.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDynasty } from '../src/state/store.js';
import { ScreenOwner, overlayOwner, overlayRule, ownerRule } from '../src/ui/screenOwner.js';
import { Modal } from '../src/ui/Modal.js';
import { TableOverlay } from '../src/ui/App.js';
import { askCoachView, takeCoachView } from '../src/ui/screens/ProgramRooms.js';

const s = () => useDynasty.getState();

describe('overlay slot owners', () => {
  it('names each slot bottom first, and draws only the top slot\'s portals', () => {
    expect(overlayOwner(0)).toBe('o:0');
    expect(overlayRule(2)).toBe('.app-frame [data-owner^="o:"]:not([data-owner="o:2"]){display:none!important}');
  });

  it('the screens\' rule leaves the slots to their own', () => {
    expect(ownerRule('home|today#0')).toContain(':not([data-owner^="o:"])');
  });

  it('a dialog in a slot is owned by it', () => {
    const modal = createElement(Modal, { kicker: 'K', title: 'T', lines: ['L'], action: 'OK', onClose: () => {} });
    const html = renderToStaticMarkup(createElement(ScreenOwner.Provider, { value: overlayOwner(1) }, modal));
    expect(html).toContain('data-owner="o:1"');
  });
});

describe('TableOverlay draws the whole stack', () => {
  // A server render reads the store's first state, so each render lends it
  // this one and takes it back.
  const first = useDynasty.getInitialState();
  const kept = { ...first };
  const render = (): string => {
    Object.assign(first, useDynasty.getState());
    try { return renderToStaticMarkup(createElement(TableOverlay)); } finally { Object.assign(first, kept); }
  };
  beforeEach(() => {
    s().newDynasty();
    s().start(4242, 0);
  });

  const slots = (html: string): string[] => html.match(/<div class="pb-tableoverlay"[^>]*>/g) ?? [];

  it('one slot when one overlay is open, live', () => {
    useDynasty.setState({ overlay: 'schedule', overlayStack: [] });
    const html = render();
    const found = slots(html);
    expect(found).toHaveLength(1);
    expect(found[0]).not.toContain('inert');
    expect(found[0]).not.toContain('aria-hidden');
    expect(html).toContain(overlayRule(0));
  });

  it('the ones below the top stay drawn, inert and hidden from readers, top last', () => {
    useDynasty.setState({ overlay: 'standings', overlayStack: [{ overlay: 'schedule' }, { overlay: 'rankings' }] });
    const html = render();
    const found = slots(html);
    expect(found).toHaveLength(3);
    for (const lower of found.slice(0, 2)) {
      expect(lower).toContain('inert');
      expect(lower).toContain('aria-hidden="true"');
    }
    expect(found[2]).not.toContain('inert');
    expect(found[2]).not.toContain('aria-hidden');
    expect(html).toContain(overlayRule(2));
  });

  it('nothing open, nothing drawn', () => {
    useDynasty.setState({ overlay: null, overlayStack: [] });
    expect(render()).toBe('');
  });

  it('closing the top leaves the slot below as it was', () => {
    useDynasty.setState({ overlay: 'standings', overlayStack: [{ overlay: 'schedule' }] });
    s().closeOverlay();
    expect(s().overlay).toBe('schedule');
    expect(s().overlayStack).toEqual([]);
    // Keyed by place and name: the slot below keeps its key, so it is not
    // mounted again when the one over it goes.
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    expect(app).toContain('key={`${i}:${name}`} value={overlayOwner(i)}');
  });

  // Staff, network, staff: both staff rooms draw the coach's sheet. "Review"
  // in the top one asks for the contract tab, and the hidden one below, drawn
  // first, used to take it.
  it('only the staff room that asked opens the coach on the asked tab', () => {
    useDynasty.setState({ overlay: 'network', overlayStack: [{ overlay: 'staff' }], coachSeat: 'hitting' });
    askCoachView(overlayOwner(2), 'contract');
    render();
    // The staff room in slot 0 drew the sheet and left the request alone.
    expect(takeCoachView(overlayOwner(2))).toBe('contract');
    askCoachView(overlayOwner(2), 'contract');
    useDynasty.setState({ overlay: 'staff', overlayStack: [{ overlay: 'staff' }, { overlay: 'network' }], coachSeat: 'hitting' });
    render();
    // The top one took it.
    expect(takeCoachView(overlayOwner(2))).toBe('work');
  });

  it('the asked tab goes to the asking owner, once', () => {
    askCoachView(overlayOwner(2), 'contract');
    expect(takeCoachView(overlayOwner(0))).toBe('work');
    expect(takeCoachView(overlayOwner(2))).toBe('contract');
    expect(takeCoachView(overlayOwner(2))).toBe('work');
  });
});

describe('the guided stretch never lights a control under the top overlay', () => {
  it('skips a target inside an inert slot', () => {
    expect(readFileSync('src/ui/GuidedStretch.tsx', 'utf8')).toContain("if (el.closest('[inert]')) continue;");
  });
});
