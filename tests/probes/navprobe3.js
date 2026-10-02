// navprobe3.js — the browser back-gesture probe (plan package PR, 2026-09-30).
//
// What a phone's back swipe previews is the picture of the entry it returns
// to, taken when that entry was LEFT. This probe keeps that picture for every
// entry and, after each back press, compares it with what the app then shows.
// It reads the page itself (`domSig`), so it works on today's event bridge and
// on the ledger after the switch alike; `window.__nav` and `window.store` are
// read when present and only add detail.
//
// Use (dev server 5175 `playball-check` or a no-watch port like 5176; never
// 5174 or the user's saves). It refuses to install on 5173 and 5174, and on
// any port but 5175/5176 unless `window.__np3Allow = true` is set first:
//   - paste the file into the page (javascript_tool), then
//     `await __np3.run('S1')`, `await __np3.runAll(['S1','S3'])`, `__np3.table()`;
//   - after a reload, `eval(sessionStorage.getItem('navprobe3:src'))` puts it
//     back, and `await __np3.resume()` finishes a scenario that reloaded (S8);
//   - or drive it with navprobe3-driver.mjs, which injects it before the app
//     boots and gives the runners trusted taps (the ledger only pushes after a
//     real activation, so synthetic clicks cannot open levels once it lands).
//
// Each back press returns `{scenario, press, i, preview, live, match}`, plus
// the diff and the faults seen during it: a push inside a popstate, a push
// with no activation since the last traversal, a second go() while one is in
// flight. Pushes made by the probe's own synthetic clicks are marked `soft`.
//
// The preview is the landed entry's picture as the pop finds it. `reshot`
// says the app left that entry again before the check (a refund, a bounce, a
// give-back, a fold to the root) and filed a newer picture the swipe never
// showed (SW probe round 1: read late, that one hid misses).
//
// A runner tags a press with what the plan expects of it:
//   leave         the page goes: an era's root with nothing open (§6.1, §6.5);
//                 pressed anyway (something was still up) counts as `leaveHeld`
//   guard         a blocking card or a June game holds the screen (§6.3, §6.4)
//   refused       the lineup gate, or a forward swipe (§6.4, §6.6)
//   residual      the swipe after a refused lineup is fixed previews Lineup (§7, P0.6)
//   no-tap        a level came with no tap since the last swipe, so its entry
//                 was refunded or owed and one swipe misses (§6.10)
//   known:<pkg>   a miss the named later package fixes (V1, V2, S5, S6);
//                 counted as `known`, apart from the trade-offs and the misses
(() => {
  const install = () => {
    if (window.__np3) return 'navprobe3 already installed';
    // 2026-09-30: the probe starts careers and saves them to the origin's
    // autosave, so it never runs where the user plays (5174 dev, 5173 frozen).
    const port = String(location.port || '');
    if (port === '5173' || port === '5174') return `navprobe3 refused: ${port} holds the user's saves`;
    if (port !== '5175' && port !== '5176' && !window.__np3Allow) return `navprobe3 refused on port ${port || '(none)'}: set window.__np3Allow = true first`;
    const SS = 'navprobe3:';
    const H = history;
    const orig = {
      push: H.pushState.bind(H), replace: H.replaceState.bind(H),
      go: H.go.bind(H), back: H.back.bind(H), forward: H.forward.bind(H),
    };
    const now = () => performance.now();
    const W = (ms) => new Promise((r) => setTimeout(r, ms));
    const load = (k, d) => { try { const v = sessionStorage.getItem(SS + k); return v ? JSON.parse(v) : d; } catch { return d; } };
    const save = (k, v) => { try { sessionStorage.setItem(SS + k, JSON.stringify(v)); } catch { /* full or blocked */ } };

    const P = {
      version: 3,
      shots: load('shots', {}),        // entry key -> { i, painted, by, t }
      results: load('results', []),    // one per scenario run
      faults: [],
      trace: [],
      checks: [],                      // every user or probe pop, checked 900 ms later
      painted: null,
      driver: null,                    // the hand behind the last step: trusted, synthetic or dev
      driverAt: 0,                     // when that step began
      driverBusy: false,               // a dev call is still running
      floor: -1,                       // entry index a scenario must not go under
      // Pasted after the app booted: its listeners were registered first.
      lateInstall: !!document.querySelector('.app-frame, .pb-start'),
    };
    const hand = (kind) => { P.driver = kind; P.driverAt = now(); };

    // ---------- reading the page ----------
    const vis = (el) => {
      if (!el || el.getClientRects().length === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const txt = (el, n = 28) => (el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const firstVis = (sel) => [...document.querySelectorAll(sel)].find(vis) || null;
    const selected = (sel) => txt([...document.querySelectorAll(sel)].find((b) => vis(b) && (b.getAttribute('aria-current') === 'page' || b.getAttribute('aria-selected') === 'true' || b.classList.contains('is-active'))), 20);
    const scrollable = (el) => { const oy = getComputedStyle(el).overflowY; return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2; };
    const topScroller = () => {
      const layers = [...document.querySelectorAll('.pb-fulloverlay, .pb-tableoverlay')].filter(vis);
      const base = layers.at(-1) || firstVis('main');
      if (!base) return document.scrollingElement;
      for (let el = base; el && el !== document.body; el = el.parentElement) if (scrollable(el)) return el;
      const inner = [...base.querySelectorAll('.pb-tableoverlay__body, .pb-fulloverlay__body, .pb-screen, [class*="scroll"]')].slice(0, 20).find(scrollable);
      return inner || document.scrollingElement;
    };
    const domSig = () => {
      const frame = document.querySelector('.app-frame');
      const sheets = [...document.querySelectorAll('.pb-sheet-host')].filter((h) => h.style.display !== 'none' && vis(h))
        .map((h) => [...h.querySelectorAll('.pb-sheet')].filter(vis).map((s) => txt(s.querySelector('.pb-sheet__title')) || '?').join('+') || '?');
      const layers = [...document.querySelectorAll('.pb-fulloverlay, .pb-tableoverlay')].filter(vis)
        .map((e) => (e.className.match(/is-[a-z-]+|god-sheet/g) || ['overlay']).join('.'));
      const dialogs = [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].filter(vis)
        .filter((d) => !d.closest('.pb-sheet-host') && !d.classList.contains('pb-tip-host') && !d.closest('.pb-tip-host'))
        .map((d) => {
          const id = d.getAttribute('aria-labelledby');
          const t = id ? document.getElementById(id) : d.querySelector('h1,h2,h3,strong');
          return txt(t, 26) || String(d.className || '').slice(0, 20);
        });
      const tips = [...document.querySelectorAll('.pb-tip-host')].filter(vis).map((t) => txt(t.querySelector('.pb-tip__title'), 26) || '?');
      // In-screen choices the tabs do not show: a Colleges chip, the coach
      // profile's Skills segment. Read in the top layer, else the screen.
      const pickRoot = [...document.querySelectorAll('.pb-fulloverlay, .pb-tableoverlay')].filter(vis).at(-1) || firstVis('main');
      const picks = pickRoot ? [...pickRoot.querySelectorAll('[aria-pressed="true"], [aria-checked="true"], .pb-seg [aria-selected="true"], .pb-chip.is-selected, .pb-seg__opt.is-active')]
        .filter((el) => vis(el) && !el.closest('.pb-tabbar, .pb-toptabs')).map((el) => txt(el, 16))
        .filter((v, k, a) => v && a.indexOf(v) === k).slice(0, 6).join('|') : '';
      const sc = topScroller();
      return {
        frame: frame ? frame.className.replace('app-frame', '').trim() : 'none',
        start: !!firstVis('.pb-start'),
        career: txt(firstVis('.pb-appbar__titles strong'), 30),
        heading: txt(firstVis('main h1, main .pb-screen-head__title'), 30),
        tabbar: selected('.pb-tabbar button'),
        section: selected('.pb-toptabs button, .pb-toptabs [role=tab]'),
        step: txt(firstVis('.pb-steprail li.is-current')),
        juneView: txt([...document.querySelectorAll('[aria-label="Postseason view"] [aria-selected="true"]')].find(vis)),
        terms: !!firstVis('.pb-terms'),
        menu: !!firstVis('.pb-menu[role=menu]'),
        picks, sheets, layers, dialogs, tips,
        scroll: sc ? Math.round(sc.scrollTop / 10) * 10 : 0,
      };
    };
    // The model's own view, when the build has one: the ledger's signature if
    // it offers it, else the store's route and layers (dev builds only).
    const modelSig = () => {
      const nav = window.__nav;
      if (nav && typeof nav.levelSig === 'function') {
        try { const d = typeof nav.depth === 'function' ? nav.depth() : nav.depth; return { kind: 'nav', sig: String(nav.levelSig(d)) }; } catch { /* fall through */ }
      }
      const s = window.store?.getState?.();
      if (!s) return null;
      const m = {
        kind: 'store', tab: s.tab, screen: s.screen, phase: s.phase, overlay: s.overlay,
        player: s.selectedPlayer ?? null, coach: s.coachSeat ?? null, god: (s.godStack || []).length,
        stage: s.bracket?.stage ?? null, slot: s.loadedSlot ?? null, atStart: !!s.atStart,
      };
      // V1: levels held while the frame under them paints are not on screen.
      const held = nav?.held;
      if (typeof held === 'number' && Array.isArray(nav.levels)) {
        const below = nav.levels.slice(0, held - 1).filter((l) => l.kind === 'overlay').at(-1);
        for (const l of nav.levels.slice(held - 1)) {
          if (l.kind === 'c') m.coach = null;
          else if (l.kind === 'p') m.player = null;
          else if (l.kind === 'g') m.god -= 1;
          else if (l.kind === 'overlay') m.overlay = below ? String(below.id).split(':')[2] ?? null : null;
        }
      }
      return m;
    };
    // The view transition in flight (plan correction 23): 'update' while its
    // callback is pending and the old frame is frozen on screen, 'animate'
    // after, 'attr' when only crossfade's `data-vt` says so (a late paste).
    let vtPhase = null;
    const svt = document.startViewTransition;
    if (typeof svt === 'function') {
      document.startViewTransition = function (...a) {
        const t = svt.apply(this, a);
        vtPhase = 'update';
        const end = () => { vtPhase = null; };
        try {
          t.updateCallbackDone.then(() => { if (vtPhase === 'update') vtPhase = 'animate'; }, end);
          t.finished.then(end, end);
        } catch { end(); }
        return t;
      };
    }
    const vtNow = () => vtPhase || (document.documentElement?.dataset?.vt ? 'attr' : null);
    const sample = (src) => ({ dom: domSig(), model: modelSig(), src, vt: vtNow(), t: Math.round(now()) });
    // Painted frame: sampled in rAF (what the next paint shows). A hidden tab
    // runs no frames, so a 40 ms timer stands in when rAF has gone quiet.
    let lastRaf = 0;
    const tickRaf = () => { try { P.painted = sample('raf'); lastRaf = now(); } catch { /* booting */ } requestAnimationFrame(tickRaf); };
    requestAnimationFrame(tickRaf);
    setInterval(() => { if (now() - lastRaf > 150) { try { P.painted = sample('timer'); } catch { /* booting */ } } }, 40);

    const brief = (x) => {
      if (!x) return null;
      const d = x.dom || x;
      const bits = [d.frame || '-', `${d.tabbar || '-'}/${d.section || '-'}`];
      if (d.start) bits.push('START');
      if (d.heading) bits.push('h=' + d.heading);
      if (d.step) bits.push('step=' + d.step);
      if (d.juneView) bits.push('june=' + d.juneView);
      if (d.terms) bits.push('TERMS');
      if (d.menu) bits.push('MENU');
      if (d.picks) bits.push('pk=' + d.picks);
      if (d.layers.length) bits.push('ly=' + d.layers.join('+'));
      if (d.sheets.length) bits.push('sh=' + d.sheets.join('+'));
      if (d.dialogs.length) bits.push('dl=' + d.dialogs.join('+'));
      if (d.tips.length) bits.push('tip=' + d.tips.join('+'));
      if (d.scroll) bits.push('sc=' + d.scroll);
      return bits.join(' ');
    };
    const DOM_KEYS = ['frame', 'start', 'career', 'heading', 'tabbar', 'section', 'step', 'juneView', 'terms', 'menu', 'picks', 'sheets', 'layers', 'dialogs', 'tips', 'scroll'];
    const compare = (was, live) => {
      const diff = {};
      for (const k of DOM_KEYS) {
        const a = was.dom[k], b = live.dom[k];
        if (k === 'scroll' ? Math.abs((a || 0) - (b || 0)) > 24 : JSON.stringify(a) !== JSON.stringify(b)) diff[k] = [a, b];
      }
      const dom = Object.keys(diff).length === 0;
      let model = null;
      if (was.model && live.model && was.model.kind === live.model.kind) {
        model = true;
        for (const k of Object.keys(live.model)) {
          if (k === 'kind') continue;
          if (JSON.stringify(was.model[k]) !== JSON.stringify(live.model[k])) { model = false; diff['m.' + k] = [was.model[k], live.model[k]]; }
        }
      }
      return { match: dom && model !== false, dom, model, diff };
    };

    // ---------- entries ----------
    const hasNav = () => !!(window.navigation && navigation.currentEntry);
    const pb2 = (st) => !!st && typeof st === 'object' && st.pb === 2 && typeof st.i === 'number';
    const key = () => (hasNav() ? navigation.currentEntry.key : pb2(H.state) ? `pb:${H.state.boot}:${H.state.i}` : `len:${H.length}`);
    const idx = () => (hasNav() ? navigation.currentEntry.index : -1);
    // The entry number the table reports: the ledger's own `i` once entries
    // carry it, the browser's index before.
    const iNow = () => (pb2(H.state) ? H.state.i : idx());
    const navState = () => {
      const n = window.__nav;
      if (!n) return null;
      const val = (v) => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
      return { depth: val(n.depth), want: val(n.want), eraBase: val(n.eraBase), owed: val(n.owed), pending: val(n.pending) ?? null, cur: val(n.cur) ?? null };
    };
    // The entry on screen, so a pop can file the picture under the one it left.
    let curKey = key();
    let curI = iNow();
    const leave = (by) => {
      if (!P.painted) return;
      P.shots[curKey] = { i: curI, painted: P.painted, by, t: Math.round(now()) };
      save('shots', P.shots);
    };
    const where = () => (new Error().stack || '').split('\n').slice(2, 12).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, ''))
      .filter((l) => !/node_modules|navprobe3|<anonymous>|^(fault|traversal|H\.\w+|history\.\w+) /.test(l)).slice(0, 3).join(' < ');

    // ---------- faults ----------
    let inPop = false;
    let lastTraversal = 0;
    let activatedSinceTraversal = true;
    let lastActivation = 0;
    let pendingGo = null;              // { n, by, t }
    const fault = (kind, extra = {}) => {
      // Soft: a script's click or a store call, which no browser counts as an
      // activation, came after the last traversal (or is still running); a
      // real tap would have been one. A push that follows the traversal itself
      // stays hard whatever hand came before it.
      const soft = kind === 'push-no-activation' && !!P.cur && !!P.driver && P.driver !== 'trusted'
        && (P.driverBusy || P.driverAt > lastTraversal);
      const f = { kind, at: idx(), i: iNow(), t: Math.round(now()), soft, scenario: P.cur?.scenario ?? null, by: where(), ...extra };
      P.faults.push(f);
      return f;
    };
    const activation = (e) => {
      if (!e.isTrusted) return;
      if (e.type === 'keydown' && e.key === 'Escape') return;
      if (e.type === 'pointerdown' && e.pointerType !== 'mouse') return;
      if (e.type === 'pointerup' && e.pointerType === 'mouse') return;
      lastActivation = now();
      activatedSinceTraversal = true;
    };
    for (const t of ['keydown', 'mousedown', 'pointerdown', 'pointerup', 'touchend', 'click']) window.addEventListener(t, activation, true);

    H.pushState = function (st, t, u) {
      if (inPop) fault('push-in-pop');
      const active = navigator.userActivation ? navigator.userActivation.isActive : true;
      if (lastTraversal > 0 && !activatedSinceTraversal && !active) fault('push-no-activation');
      // Not a fault by itself: SW decides from these whether pushes wait for data-vt.
      const vt = vtNow();
      if (vt) fault('push-during-vt', { info: true, vt });
      leave('push');
      P.trace.push({ op: 'push', from: idx(), t: Math.round(now()), vt, by: where() });
      const r = orig.push(st, t, u);
      curKey = key(); curI = iNow();
      return r;
    };
    H.replaceState = function (st, t, u) {
      P.trace.push({ op: 'replace', at: idx(), t: Math.round(now()) });
      const r = orig.replace(st, t, u);
      curKey = key(); curI = iNow();
      return r;
    };
    // A go() that never lands (out of range, dropped) stops counting as in flight.
    const inFlight = () => !!pendingGo && now() - pendingGo.t < 1200;
    const traversal = (n, by) => {
      if (inFlight()) fault('go-while-pending', { n, first: pendingGo.n, firstBy: pendingGo.by });
      pendingGo = { n, by, t: now() };
      P.trace.push({ op: 'go' + n, from: idx(), t: Math.round(now()), by: by === 'app' ? where() : by });
    };
    H.go = function (n) { traversal(typeof n === 'number' ? n : 0, 'app'); return orig.go(n); };
    H.back = function () { traversal(-1, 'app'); return orig.back(); };
    H.forward = function () { traversal(1, 'app'); return orig.forward(); };

    // Capture: at the window Chrome (89+) and WebKit run capture listeners
    // before the app's bubble ones whatever the order they were added in, so a
    // pasted probe still sees the app's pushes and go()s from inside its pop.
    window.addEventListener('popstate', (e) => {
      if (!e.isTrusted) { P.trace.push({ op: 'synthpop', at: idx(), t: Math.round(now()) }); return; }
      leave('pop');
      curKey = key(); curI = iNow();
      inPop = true;
      setTimeout(() => { inPop = false; }, 0);
      lastTraversal = now();
      activatedSinceTraversal = false;
      const mine = pendingGo;
      pendingGo = null;
      P.trace.push({ op: 'pop', at: idx(), i: iNow(), t: Math.round(now()), vt: vtNow(), for: mine ? mine.by : 'user' });
      if (mine && mine.by === 'app') return;
      // A user's (or the probe's) press: compare what it previewed with what is live.
      const landedKey = curKey;
      // What the swipe showed is the landed entry's picture as it stands now.
      // A traversal the app makes after this pop (a refund, a bounce, a
      // give-back, a fold to the root) leaves the entry again and files a new
      // picture under it, one this swipe never showed. Read at the check, that
      // one passed refusals, forward bounces and the plan over a refused terms
      // card as matches (SW probe round 1, 2026-09-30).
      const shown = P.shots[landedKey] ?? null;
      const landed = { at: idx(), i: iNow(), key: landedKey, t: now() };
      const check = { ...landed, done: false };
      P.checks.push(check);
      setTimeout(() => {
        const was = shown;
        const live = sample('live');
        check.preview = was ? brief(was.painted) : null;
        check.shotVt = was ? (was.painted.vt ?? null) : null;
        check.shotSrc = was ? was.painted.src : null;
        check.reshot = (P.shots[landedKey] ?? null) !== shown;
        check.live = brief(live);
        check.nav = navState();
        check.stateI = pb2(H.state) ? H.state.i : null;
        if (was) Object.assign(check, compare(was.painted, live));
        else { check.match = null; check.diff = {}; }
        if (check.nav && typeof check.nav.want === 'number' && check.stateI !== null) check.inv = check.stateI === check.nav.want;
        check.done = true;
      }, 900);
    }, true);
    // ---------- driving ----------
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const label = (el) => clean(el.getAttribute('aria-label')) || clean(el.textContent);
    const named = (el, re) => re.test(clean(el.getAttribute('aria-label'))) || re.test(clean(el.textContent));
    const CLICKABLE = 'button, a, [role=button], [role=tab], [role=menuitem], [role=radio], .pb-listrow';
    class Skip extends Error {}
    const find = (what, scope) => {
      if (what instanceof Element) return what;
      const root = typeof scope === 'string' ? document.querySelector(scope) : (scope || document);
      if (!root) return null;
      if (typeof what === 'string') return [...root.querySelectorAll(what)].find(vis) || null;
      return [...root.querySelectorAll(CLICKABLE)].filter(vis).filter((b) => !b.disabled).find((b) => named(b, what)) || null;
    };
    const hitOf = (el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, hit, clear: !!hit && (hit === el || el.contains(hit)) };
    };
    const press = async (el, x, y) => {
      if (typeof window.__np3Tap === 'function') { hand('trusted'); await window.__np3Tap(x, y); } else { hand('synthetic'); el.click(); }
    };
    // A dialog or tip in the way is put away as a user would, by its safe
    // button (2026-09-30: clicking through the scrim took paths no thumb can).
    const DIALOGS = '.pb-dialog-host, .big-moment';
    const occluder = (hit) => (hit && hit.closest ? hit.closest(DIALOGS + ', .pb-tip-host') : null);
    const putAway = async (host) => {
      const title = txt(host.querySelector('.pb-dialog__title, .pb-tip__title, h1'), 26) || host.getAttribute('aria-label') || '?';
      const btns = [...host.querySelectorAll('button')].filter(vis);
      const btn = btns.find((b) => /pb-btn--secondary/.test(b.className) || /^(Later|Got it|Close|Not now)$/i.test(clean(b.textContent)))
        || btns.find((b) => /pb-btn--primary/.test(b.className)) || (btns.length === 1 ? btns[0] : null);
      if (!btn) return null;
      const h = hitOf(btn);
      if (!h.clear) return null;
      await press(btn, h.x, h.y);
      await settle(300);
      return `put away ${title}`;
    };
    // Anything else in the way ends the runner with an error row.
    const tapEl = async (el, tries = 0) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { el.scrollIntoView({ block: 'center' }); await W(80); }
      let h = hitOf(el);
      if (!h.clear && !occluder(h.hit)) { el.scrollIntoView({ block: 'center' }); await W(80); h = hitOf(el); }
      if (h.clear) { await press(el, h.x, h.y); return null; }
      const host = occluder(h.hit);
      const note = host && tries < 3 && el.isConnected ? await putAway(host) : null;
      if (note) { const more = await tapEl(el, tries + 1); return more ? `${note}; ${more}` : note; }
      throw new Error(`occluded by ${h.hit ? (String(h.hit.className || '') || h.hit.tagName) : 'nothing'}`.slice(0, 60));
    };
    const settle = async (min = 250, max = 2500) => {
      const t0 = now();
      await W(min);
      while (now() - t0 < max) {
        const quiet = !inFlight() && (P.trace.length === 0 || now() - P.trace.at(-1).t > 150);
        if (quiet) return;
        await W(50);
      }
    };
    // Whether a back press here would take the page away. The ledger knows its
    // root; before it, the scenario's floor stands in for one.
    const wouldLeave = () => {
      if (hasNav()) {
        const prev = navigation.entries()[navigation.currentEntry.index - 1];
        if (!prev) return 'first entry';
        if (!prev.sameDocument) return 'another document';
      }
      if (pb2(H.state)) return H.state.i <= 0 ? 'ledger root' : null;
      if (hasNav()) return navigation.currentEntry.index <= P.floor ? 'scenario root' : null;
      return (H.state && H.state.playballRoot) ? 'app root' : null;
    };

    const ctx = {
      W, settle, vis, find, brief, Skip,
      store: () => window.store?.getState?.() ?? null,
      row(r) { const row = { scenario: P.cur?.scenario ?? null, ...r }; P.cur?.rows.push(row); return row; },
      live: () => brief(sample('live')),
      async tap(what, { scope, wait = 700, optional = false, name } = {}) {
        const el = find(what, scope);
        if (!el) {
          if (optional) return null;
          throw new Error('not found: ' + (name || String(what)));
        }
        let note;
        try { note = await tapEl(el); } catch (e) { throw new Error(`${name || label(el).slice(0, 30)}: ${e.message}`); }
        P.cur?.steps.push((name || label(el).slice(0, 30)) + (note ? ` [${note}]` : ''));
        await settle(wait);
        return el;
      },
      tabbar: (l) => ctx.tap(new RegExp('^' + l + '$'), { scope: '.pb-tabbar', name: 'tab ' + l, wait: 800 }),
      section: (l) => ctx.tap(new RegExp('^' + l + '$'), { scope: '.pb-toptabs', name: 'section ' + l, wait: 800 }),
      async dev(what, fn) {
        const s = ctx.store();
        if (!s) throw new Skip('needs window.store (dev server) for: ' + what);
        P.cur?.steps.push('dev: ' + what);
        // Store calls are the probe's hand, not a user's: no activation to expect.
        hand('dev');
        P.driverBusy = true;
        try { return await fn(s, window.store); } finally { await settle(400); P.driverBusy = false; }
      },
      // Dialogs a store call left up (an injury, a tournament exit).
      async clearDialogs() {
        for (let k = 0; k < 6; k++) {
          const host = [...document.querySelectorAll(DIALOGS)].filter(vis).at(-1);
          if (!host) return;
          const note = await putAway(host);
          if (!note) throw new Error('a dialog with no way out: ' + txt(host, 40));
          P.cur?.steps.push(note);
        }
      },
      tutorials(on) { try { const k = 'playball.prefs.v1'; const p = JSON.parse(localStorage.getItem(k) || '{}'); p.tutorials = on; localStorage.setItem(k, JSON.stringify(p)); } catch { /* blocked */ } },
      // A new career in this document: Start is left behind, and the scenario's
      // floor is the entry it began on, so its presses never walk into the last one's.
      // `tapped`: a tap on Start just before the dev start, standing in for the
      // "Take the job" tap a player's career starts from, so what the start
      // opens (the Season plan) has its entry pushed as in play. A store call
      // is no activation: without the tap that push stays owed (§6.10).
      async fresh({ seed = 4242, team = 3, plan = 'later', tips = false, tapped = false } = {}) {
        ctx.tutorials(tips);
        await ctx.dev('back to Start', async (s) => { s.backToStart(); await W(400); });
        P.floor = idx();
        if (tapped) await ctx.tap('.pb-start__title', { name: 'a tap on Start', wait: 100 });
        await ctx.dev(`career ${seed}/${team}`, async (s, st) => {
          // Tapped: off Start in the same commit, as the app is when "Take the
          // job" starts a career (V1: the plan's held frame is that Home).
          st.getState().start(seed, team, undefined, 'full'); if (!tapped) await W(300);
          st.getState().leaveStart(); await W(1400);
        });
        if (plan === 'later') await ctx.tap(/^Decide later$/, { scope: '.pb-plan', optional: true, name: 'Decide later' });
        if (tips) await ctx.endTour();
      },
      async endTour() {
        const el = await ctx.tap(/End tour/, { optional: true, name: 'End tour' });
        if (!el && ctx.store()) ctx.store().markTutorialSeen('today');
        await settle(300);
      },
      async gotIt() {
        const host = [...document.querySelectorAll('.pb-tip-host')].filter(vis).at(-1);
        if (!host) return false;
        await ctx.tap(/Got it|^Close$/, { scope: host, name: 'tip: Got it' });
        return true;
      },
      async sheetClose() {
        const host = [...document.querySelectorAll('.pb-sheet-host')].filter(vis).at(-1);
        if (host) await ctx.tap(/^Close/, { scope: host, name: 'sheet Close', optional: true });
      },
      // One back press, as a swipe would do it; recorded as a table row.
      async back(tag = null) {
        await settle(150);
        const from = iNow();
        const faultsBefore = P.faults.length;
        const leaves = wouldLeave();
        if (leaves) {
          // Not pressed, so the run goes on. A leave the scenario did not
          // expect is a miss: the app still had something to peel.
          return ctx.row({ press: 'back', from, i: null, preview: `(leaves: ${leaves})`, live: ctx.live(), match: tag === 'leave', leaves, tag, faults: [] });
        }
        const n = P.checks.length;
        pendingGo = { n: -1, by: 'probe', t: now() };
        P.trace.push({ op: 'back', from: idx(), t: Math.round(now()), by: 'probe' });
        orig.back();
        const t0 = now();
        while (P.checks.length === n && now() - t0 < 2000) await W(30);
        const c = P.checks[n];
        if (!c) return ctx.row({ press: 'back', from, i: iNow(), preview: '(no popstate)', live: ctx.live(), match: null, tag, faults: [] });
        while (!c.done) await W(30);
        await settle(100);
        const fs = P.faults.slice(faultsBefore).map((f) => f.kind + (f.soft ? '(soft)' : f.info ? `(${f.vt})` : ''));
        return ctx.row({ press: 'back', from, i: c.i, preview: c.preview, live: c.live, match: c.match, dom: c.dom, model: c.model, diff: c.diff, inv: c.inv ?? null, vt: c.shotVt, shotSrc: c.shotSrc, reshot: c.reshot, nav: c.nav, tag, faults: fs });
      },
      async forward(tag = null) {
        await settle(150);
        const from = iNow();
        const n = P.checks.length;
        pendingGo = { n: 1, by: 'probe', t: now() };
        orig.forward();
        const t0 = now();
        while (P.checks.length === n && now() - t0 < 2000) await W(30);
        const c = P.checks[n];
        if (!c) return ctx.row({ press: 'forward', from, i: iNow(), preview: '(no forward entry)', live: ctx.live(), match: null, tag });
        while (!c.done) await W(30);
        await settle(100);
        return ctx.row({ press: 'forward', from, i: c.i, preview: c.preview, live: c.live, match: c.match, diff: c.diff, inv: c.inv ?? null, vt: c.shotVt, reshot: c.reshot, tag });
      },
      // A non-press check: what is on screen now, against what a step expects.
      note(press, ok, extra = {}) { return ctx.row({ press, i: iNow(), preview: null, live: ctx.live(), match: ok, ...extra }); },
      entries: () => (hasNav() ? navigation.entries().length : H.length),
    };

    // ---------- scenarios (design §5.4 plus S15, S16) ----------
    const tipCount = () => [...document.querySelectorAll('.pb-tip-host')].filter(vis).length;
    const sheetTitles = () => [...document.querySelectorAll('.pb-sheet-host .pb-sheet')].filter(vis).map((s) => txt(s.querySelector('.pb-sheet__title')));
    // A hurt starter holds every sim at the lineup gate, so the card is
    // filled before each one.
    // Dialogs the sims leave up are put away after, as a user would.
    const toAwards = async (c) => { await simToAwards(c); await c.clearDialogs(); };
    const simToAwards = async (c) => c.dev('season, June, to Awards', async (s, st) => {
      st.getState().autoLineup();
      await st.getState().playSeason(); await W(500);
      st.getState().autoLineup();
      await st.getState().playPostseason(); await W(500);
      for (let k = 0; k < 80 && st.getState().bracket; k++) {
        st.getState().autoLineup();
        try { st.getState().simBracket('rest'); } catch { /* a modal between rounds */ }
        await W(250);
        if (st.getState().bracket) { try { st.getState().advanceBracket(); } catch { /* not yet */ } await W(150); }
      }
      if (st.getState().phase !== 'awards') throw new Error('did not reach Awards (phase ' + st.getState().phase + ')');
    });
    const nextStep = (c) => c.tap(/^(Continue|Start next season|Tap again)/, { name: 'next step', wait: 1500 });
    const signTerms = async (c) => {
      const sc = find('.pb-terms__scroll');
      if (sc) { sc.scrollTop = sc.scrollHeight; sc.dispatchEvent(new Event('scroll')); await W(400); }
      await c.tap(/^Sign and open the season/, { name: 'Sign and open the season', wait: 1200 });
    };

    const RUNNERS = {
      // Prospect sheet, filters sheet and the Season plan (dev: StrictMode).
      // The career starts from a tap, as a player's does: with only the store
      // call the plan's push stayed owed and back would have left the page with
      // the plan up (SW probe round 1).
      async S1(c) {
        await c.fresh({ plan: 'keep', tapped: true });
        c.note('plan up at career start', sheetTitles().some((t) => /Season plan/.test(t)));
        // The plan's own entry, pushed once Home has painted under it (V1).
        await c.back();
        await c.tap(/^Decide later$/, { scope: '.pb-plan', optional: true, name: 'Decide later' });
        await c.tabbar('Team');
        await c.tabbar('Office');
        await c.tap('.pb-rc-row', { name: 'prospect row' });
        await c.back();                                   // prospect sheet
        await c.tap('.pb-rc-fbtn', { name: 'Filter' });
        await c.back();                                   // filters sheet
        await c.back();                                   // Office -> Team
        await c.back();                                   // Team -> Home
        await c.back('leave');
      },
      // Inbox letters to the standings and to recruiting, then a scouting
      // report's "Build a plan". The letters and the report are seeded, so
      // a career with no mail fails here instead of passing over tab stops.
      async S2(c) {
        await c.fresh();
        await c.dev('letters to the standings and recruiting', (s) => {
          s.post({ kind: 'season', year: s.year, title: 'Probe standings letter', body: '', link: { to: 'standings' } });
          s.post({ kind: 'recruiting', year: s.year, title: 'Probe recruiting letter', body: '', link: { to: 'recruiting' } });
        });
        const letter = (re, name) => c.tap(re, { scope: '[aria-label="Messages"]', name });
        await c.tabbar('Team');
        await c.tap(/^Inbox/, { name: 'Inbox' });
        await letter(/Probe standings letter/, 'standings letter');
        await c.back();                                   // the letter
        await letter(/Probe standings letter/, 'standings letter');
        await c.tap(/^Open the standings/, { name: 'Open the standings', wait: 900 });
        await c.back();                                   // standings -> Inbox
        await letter(/Probe recruiting letter/, 'recruiting letter');
        await c.tap(/^Open recruiting/, { name: 'Open recruiting', wait: 900 });
        await c.back();                                   // Recruiting -> Team
        await c.dev('a scouting report is ready', (s, st) => {
          st.setState({ playbookInvite: s.season.teams.find((t) => t.index !== s.userTeam).def.abbr });
        });
        await c.tap(/^Build a plan$/, { name: 'Build a plan', wait: 1200 });
        await c.back();                                   // Strategy -> Team
        await c.back();                                   // Team -> Home
        await c.back('leave');
      },
      // Play ball, Back to Today, Back to game, the dugout, Record the game.
      async S3(c) {
        await c.fresh();
        await c.tabbar('Team');
        await c.tabbar('Home');
        await c.tap(/^Play ball/, { name: 'Play ball', wait: 1500 });
        await c.back();                                   // the game waits
        await c.tap(/^Back to game|^Play ball/, { name: 'Back to game', wait: 1500 });
        await c.tap(/^Dugout/, { name: 'Dugout' });
        const pick = await c.tap(/^(Pinch hit|Go to the bullpen)/, { name: 'picker', optional: true });
        if (pick) await c.back();                         // the picker
        await c.back();                                   // the dugout
        await c.tap(/^Dugout/, { name: 'Dugout' });
        await c.tap(/^Back to Today/, { name: 'Back to Today (the game waits)', wait: 1200 });
        await c.tap(/^Back to game|^Play ball/, { name: 'Back to game', wait: 1500 });
        await c.tap(/^Dugout/, { name: 'Dugout' });
        await c.tap(/^Sim the rest/, { name: 'Sim the rest' });
        await c.tap(/^Tap again to sim/, { name: 'confirm sim', wait: 2500 });
        await c.tap(/^Record the game/, { name: 'Record the game', wait: 1500 });
        await c.back(); await c.back();
        await c.back('leave');
      },
      // Postseason, the seed dialog, June tabs, a June game.
      async S4(c) {
        await c.fresh();
        await c.dev('play the season', (s) => { s.autoLineup(); return s.playSeason(); });
        await c.tap(/^Postseason/, { name: 'Postseason', wait: 1200 });
        // The seed dialog, held until June's Home has painted under it (V1, 13A).
        await c.back();
        await c.tap(/^Let.s go/, { name: "Let's go", optional: true, wait: 1200 });
        await c.tabbar('Team');
        await c.tabbar('Office');
        await c.tabbar('June');
        await c.back(); await c.back(); await c.back();
        await c.back('leave');                            // June's Home is its era's root (§6.1)
        // June's own button reads "Play this game" (round 1 looked for Play ball and never started one).
        const game = await c.tap(/^Play this game|^Play ball|^Take the field/, { name: 'June game', optional: true, wait: 1500 });
        if (game) await c.back('guard');                  // a June game is played to its end (§6.3)
      },
      // Awards through the offseason steps, then the new year's terms and plan.
      async S5(c) {
        await c.fresh();
        await c.tabbar('Team');
        await c.tabbar('Home');
        await toAwards(c);
        await c.back('leave');                            // Awards is the era root
        await nextStep(c);                                // review
        await c.back();
        await nextStep(c); await nextStep(c);             // coach points, draft
        await c.back();
        for (let k = 0; k < 7 && !find('.pb-terms'); k++) await nextStep(c);
        c.note('terms card up', !!find('.pb-terms'));
        // Refused, both. The card is held until the new season has painted
        // under it (V1), so the first swipe shows that season, then the card
        // shakes (§6.4); the refusal shoots the entry again with the card up,
        // which the second shows.
        await c.back('guard');
        await c.back('guard');
        await signTerms(c);
        c.note('plan up after signing', sheetTitles().some((t) => /Season plan/.test(t)));
        // The plan took the terms card's entry, and the refused swipes left the
        // entry under it shot with the card up (P1.4B). V2 reshoots it: the
        // plan is held, go(-1), go(+1), so this previews the new Home. The
        // picture is read as the pop finds it, never after a later fold.
        await c.back();
        await c.back('leave');
      },
      // The job market (C5): a program calls, the Board's door, taking the
      // job; then between jobs, taking one from the market. A new career has
      // no offers, so two are put on the table first.
      async S6(c) {
        await c.fresh();
        const call = (s, st) => st.setState({
          offers: s.season.teams.filter((t) => t.index !== s.userTeam).slice(0, 2).map((t) => ({
            team: t.index, school: t.def.school, conference: t.conference, prestige: t.prestige, pitch: 'They would like to talk.',
          })),
        });
        await c.dev('two programs call', call);
        if (!c.store()?.offers?.length) throw new Skip('could not put offers on the table');
        const door = /programs? wants? to talk/i;
        await c.tabbar('Office');
        await c.section('Board');
        await c.tap(door, { name: 'jobs' });
        await c.back();                                   // the jobs overlay
        await c.tap(door, { name: 'jobs' });
        await c.tap(/^Take the .+ job$/, { name: 'take a job' });
        await c.tap(/^Tap again/, { name: 'confirm the job', wait: 1500 });
        // A new chair opens with its Season plan, held until the new Home has
        // painted under it (V1, C4a).
        await c.back();
        await c.back('leave');                            // the new school's Home is its era's root (§6.1)
        await c.dev('between jobs, offers up', (s, st) => { call(s, st); st.setState({ jobSearch: true }); });
        await c.tap(/^Take the .+ job$/, { name: 'take a job from the market' });
        await c.tap(/^Tap again/, { name: 'confirm the job', wait: 1500 });
        await c.back();                                   // the plan again, over the new Home
        await c.back('leave');
      },
      // Save and leave, Load, Saved careers, New career steps.
      async S7(c) {
        await c.fresh();
        await c.tabbar('Team');
        await c.tap(/^Coach menu/, { name: 'Coach menu' });
        await c.tap(/Settings and saves/, { name: 'Settings and saves' });
        await c.tap(/^Save and leave/, { name: 'Save and leave', wait: 1500 });
        await c.back('leave');                            // Start is its era's root: the career it left is not under it (§6.1)
        const load = await c.tap(/Load a career/, { name: 'Load a career', optional: true });
        if (load) { await c.back(); }
        const neu = await c.tap(/Start a new career|New career/, { name: 'New career', optional: true, wait: 1000 });
        if (neu) {
          await c.tap(/^Continue/, { name: 'Continue', optional: true });
          await c.tap(/^Continue/, { name: 'Continue', optional: true });
          await c.back(); await c.back(); await c.back();
        }
      },
      // Reload at depth 4, then Resume with the plan owed. Reloads: finish
      // with `await __np3.resume()` after the page is back.
      async S8(c, part = 1) {
        if (part === 1) {
          await c.fresh({ plan: 'keep' });
          await c.tap(/^Decide later$/, { scope: '.pb-plan', optional: true, name: 'Decide later' });
          await c.tabbar('Team'); await c.tabbar('Program'); await c.tabbar('Office');
          await c.dev('owe the plan, save', async (s, st) => { st.setState({ seasonPlanYear: null }); await W(300); await st.getState().saveNow(); });
          return { reload: true };
        }
        c.note('after reload', null, { navType: performance.getEntriesByType('navigation')[0]?.type ?? null, entries: c.entries() });
        await c.tap(/^Resume/, { name: 'Resume', optional: true, wait: 2000 });
        c.note('plan owed on resume', sheetTitles().some((t) => /Season plan/.test(t)));
        // The plan, held until the loaded Home has painted under it (V1,
        // P2.3). Then the loaded Home is the root (§6.5).
        await c.back();
        await c.back('leave');
      },
      // Forward swipes: after a card close, and after the trail is spent. Both
      // are refused (§6.6): the forward entry's picture shows, the page stays.
      async S9(c) {
        await c.fresh();
        await c.tabbar('Team');
        // Roster rows are PlayerRow buttons (round 1's selector found none, so no card opened).
        const card = await c.tap('.pb-roster .pb-prow.is-interactive', { name: 'a player', optional: true, wait: 900 });
        const closed = card && await c.tap('.pb-fulloverlay.is-player .pb-back', { name: 'close the card', optional: true });
        if (closed) await c.forward('refused');           // into the card's old entry
        await c.back();                                   // Team -> Home
        await c.forward('refused');                       // the trail is spent
        await c.forward('refused');
        await c.back('leave');                            // Home at its root (§6.1)
      },
      // Lineup gate: break the card, back (refused), fix, back.
      async S10(c) {
        await c.fresh();
        await c.tabbar('Team');
        await c.section('Lineup');
        await c.dev('double a position', (s, st) => {
          const t = s.season.teams[s.userTeam].team;
          t.lineup[1].pos = t.lineup[0].pos;
          st.setState({ season: { ...s.season } });
        });
        await c.back('refused');
        await c.tap(/auto fix|Let auto/i, { name: 'Let auto fix it', optional: true });
        // The refusal shot Roster's entry again with Lineup up, so the first
        // swipe after the fix previews Lineup (plan §7, P0.6).
        await c.back('residual');
        await c.back();                                   // Team -> Home
        await c.back('leave');
      },
      // Stats tip, back, Got it; the Staff room kept alive under an overlay.
      async S11(c) {
        await c.fresh({ tips: true });
        await c.tabbar('Team');
        await c.section('Stats');
        c.note('stats tip up', tipCount() === 1, { tips: tipCount() });
        await c.back();
        c.note('no tip after back', tipCount() === 0, { tips: tipCount() });
        if (tipCount() > 0) {
          await c.gotIt();
          c.note('Got it clears the tip', tipCount() === 0, { tips: tipCount() });
        }
        c.tutorials(false);
        await c.tabbar('Office');
        await c.section('Staff');
        await c.tabbar('Home');
        await c.dev('reopen the Season plan', (s, st) => st.setState({ seasonPlanYear: null }));
        await c.tap(/^Pitching coach/, { scope: '.pb-plan', name: 'Hire one (pitching coach)', wait: 1200 });
        const seats = sheetTitles().filter((t) => /Open seat/.test(t)).length;
        c.note('one Open seat sheet', seats === 1, { seats });
        // Hire one opens the room and its sheet in one tap: the sheet is held
        // until the room has painted, so each entry has its own (V1, C14/P0.3).
        await c.back();
        await c.back();                                   // the room -> the plan
        await c.back();                                   // the plan -> Home
        await c.back();                                   // Home -> the Staff room, kept alive
        await c.back(); await c.back(); await c.back();   // Office, Team, Home
        await c.back('leave');
      },
      // Inbox scrolled, a letter, the standings over it; then the coach's room
      // over the inbox, its Skills tab, god mode over that (plan S5 verify).
      // Every door is one a thumb can reach: the app bar sits under the inbox.
      async S12(c) {
        await c.fresh();
        await c.dev('a full inbox, god mode on', (s, st) => {
          s.post({ kind: 'season', year: s.year, title: 'Probe standings letter', body: '', link: { to: 'standings' } });
          for (let k = 0; k < 14; k++) s.post({ kind: 'season', year: s.year, title: `Probe letter ${k}`, body: 'Filler.' });
          s.post({ kind: 'board', year: s.year, title: 'Probe coach letter', body: '', link: { to: 'program', sheet: 'coach' } });
          st.setState({ godMode: true });
        });
        const letter = (re, name) => c.tap(re, { scope: '[aria-label="Messages"]', name });
        await c.tap(/^Inbox/, { name: 'Inbox' });
        const body = find('.pb-tableoverlay__body') || find('.pb-tableoverlay');
        if (body) { body.scrollTop = Math.min(600, body.scrollHeight); await W(300); }
        await letter(/Probe standings letter/, 'standings letter');
        await c.tap(/^Open the standings/, { name: 'Open the standings', wait: 900 });
        await c.back('known:S5');                         // standings -> Inbox: it remounts at the top until S5 (P0.4)
        await letter(/Probe coach letter/, 'coach letter');
        await c.tap(/^Open your profile/, { name: 'Open your profile', wait: 900 });
        await c.tap(/^Skills/, { name: 'Skills tab' });
        await c.tap(/Edit your coach in god mode/, { name: 'god mode over the profile', wait: 900 });
        await c.back();                                   // god -> profile, Skills kept
        await c.back();                                   // profile -> Inbox
        await c.back();                                   // Inbox -> Home
        await c.back('leave');
      },
      // Colleges visited twice, each with its own filter.
      async S13(c) {
        await c.fresh();
        await c.tabbar('Program');
        await c.section('Colleges');
        await c.tap(/^Desert/, { name: 'chip Desert', optional: true });
        await c.section('Alumni');
        await c.section('Colleges');
        await c.tap(/^Mountain/, { name: 'chip Mountain', optional: true });
        await c.section('Hall');
        await c.back(); await c.back();                   // Colleges (Mountain), Alumni
        await c.back('known:S6');                         // the first Colleges visit shares the second's screen until S6 (P0.5)
        await c.back(); await c.back();                   // Program, Home
        await c.back('leave');
      },
      // Coach menu open, then back: the menu closes and the route stays.
      async S14(c) {
        await c.fresh();
        await c.tabbar('Team');
        await c.tap(/^Coach menu/, { name: 'Coach menu' });
        c.note('menu open', !!find('.pb-menu[role=menu]'));
        await c.back();
        await c.back();
        await c.back('leave');
      },
      // Resign "now" from the coach profile, the market, then back.
      async S15(c) {
        await c.fresh();
        await toAwards(c);
        await nextStep(c);                                // review grades the season
        await c.tap(/^Coach menu/, { name: 'Coach menu' });
        await c.tap('.pb-menu__profile', { name: 'Coach profile' });
        const r = await c.tap(/^Resign now/, { name: 'Resign now', optional: true });
        if (!r) throw new Skip('no "Resign now" on this career');
        await c.tap(/^Tap again/, { name: 'confirm resign', wait: 2000 });
        c.note('on the market', null, { live: c.live() });
        await c.back('leave');                            // the job market is its era's root (§6.1)
      },
      // Chrome's skippable rule: a push after a traversal with no activation.
      async S16(c) {
        await c.fresh();
        await c.tabbar('Team');
        await c.back();
        const before = c.entries();
        const el = find(/^Inbox/);
        if (el) { hand('synthetic'); el.click(); await settle(800); }
        const after = c.entries();
        const soft = P.faults.filter((f) => f.kind === 'push-no-activation' && f.scenario === 'S16').length;
        c.note('push with no activation after a traversal', soft === 0, { entriesBefore: before, entriesAfter: after, pushesNoActivation: soft, hasBeenActive: navigator.userActivation?.hasBeenActive ?? null });
        // That Inbox came with no tap since the swipe: the ledger refunded into
        // the entry it had left, which shot the entry under it with the Inbox
        // up, so this one swipe previews the Inbox (§6.10).
        await c.back('no-tap');
        await c.back('leave');
      },
    };

    // ---------- running ----------
    const buildInfo = () => ({
      url: location.href, nav: !!window.__nav, store: !!window.store, navigationApi: hasNav(),
      webkit: /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(navigator.userAgent),
      hidden: document.hidden, driver: typeof window.__np3Tap === 'function' ? 'trusted' : 'synthetic',
      lateInstall: P.lateInstall,
    });
    // The plan's accepted trade-offs (design §5.4, plan §6 and §7): a miss that
    // is the design's own answer is counted apart from a real one (the tags are
    // in the header). One that would have left the page held nothing, so it
    // stays a miss.
    const TRADE_OFFS = ['guard', 'refused', 'residual', 'no-tap'];
    // A miss a later package fixes, by name ('known:V2' reshoot, 'known:S5'
    // lower overlays, 'known:S6' one screen per visit; V1's are gone):
    // counted as `known`, never as a match. A known press that matches is a
    // match; the package drops its tags when it lands.
    const isKnown = (tag) => typeof tag === 'string' && tag.startsWith('known:');
    const summarize = (rows, faults) => {
      const presses = rows.filter((r) => r.press === 'back' || r.press === 'forward');
      const traded = (r) => TRADE_OFFS.includes(r.tag) && !r.leaves;
      const known = (r) => isKnown(r.tag) && !r.leaves;
      return {
        presses: presses.length,
        match: presses.filter((r) => r.match === true).length,
        mismatch: presses.filter((r) => r.match === false && !traded(r) && !known(r)).length,
        tagged: presses.filter((r) => r.match === false && traded(r)).length,
        known: presses.filter((r) => r.match === false && known(r)).length,
        // Pressed where the runner expected the page to go: something was still open at an era's root.
        leaveHeld: presses.filter((r) => r.tag === 'leave' && !r.leaves).length,
        unknown: presses.filter((r) => r.match === null).length,
        invFailed: presses.filter((r) => r.inv === false).length,
        checksFailed: rows.filter((r) => r.press !== 'back' && r.press !== 'forward' && r.match === false).length,
        faults: faults.filter((f) => !f.soft && !f.info).length,
        softFaults: faults.filter((f) => f.soft).length,
        vtPushes: faults.filter((f) => f.kind === 'push-during-vt').length,
      };
    };
    const finish = (res, faultStart) => {
      res.faults = P.faults.slice(faultStart);
      res.summary = summarize(res.rows, res.faults);
      res.ms = Math.round(now() - res.t0);
      delete res.t0;
      P.results.push(res);
      save('results', P.results);
      P.cur = null;
      return res;
    };
    const runPart = async (name, part, res, faultStart) => {
      P.cur = res;
      try {
        const out = await RUNNERS[name](ctx, part);
        if (out && out.reload) {
          save('resume', { name, part: part + 1, res, floor: P.floor });
          setTimeout(() => location.reload(), 50);
          return { scenario: name, reloading: true, next: 'eval(sessionStorage.getItem("navprobe3:src")); await __np3.resume()' };
        }
      } catch (e) {
        if (e instanceof Skip) res.skipped = e.message;
        else { res.error = String(e && e.message || e); ctx.row({ press: 'error', note: res.error, live: ctx.live(), match: false }); }
      }
      return finish(res, faultStart);
    };
    const run = async (name) => {
      if (!RUNNERS[name]) throw new Error('no scenario ' + name + '; have ' + Object.keys(RUNNERS).join(' '));
      const res = { scenario: name, build: buildInfo(), rows: [], steps: [], t0: now() };
      P.driver = null;
      return runPart(name, 1, res, P.faults.length);
    };
    const resume = async () => {
      const r = load('resume', null);
      if (!r) return 'nothing to resume';
      try { sessionStorage.removeItem(SS + 'resume'); } catch { /* blocked */ }
      await W(1500);
      P.floor = r.floor;
      const res = { ...r.res, t0: now(), build: { ...r.res.build, afterReload: buildInfo() } };
      return runPart(r.name, r.part, res, P.faults.length);
    };
    const runAll = async (names = Object.keys(RUNNERS)) => {
      const out = [];
      for (const n of names) {
        const r = await run(n);
        out.push(r);
        if (r.reloading) break;
      }
      return out;
    };
    const table = (results = P.results) => results.flatMap((r) => r.rows.map((x) => ({
      scenario: r.scenario, press: x.press, i: x.i, preview: x.preview, live: x.live, match: x.match, inv: x.inv ?? null,
      ...(x.tag ? { tag: x.tag } : {}), ...(x.vt ? { vt: x.vt } : {}), ...(x.reshot ? { reshot: true } : {}),
      ...(x.faults && x.faults.length ? { faults: x.faults } : {}),
      ...(x.diff && Object.keys(x.diff).length ? { diff: x.diff } : {}),
    })));

    window.__np3 = {
      P, ctx, RUNNERS, run, runAll, resume, table, summarize, domSig, sample, brief, compare,
      faults: () => P.faults, hardFaults: () => P.faults.filter((f) => !f.soft && !f.info),
      trace: (n = 40) => P.trace.slice(-n).map((t) => `${t.op}@${t.from ?? t.at}${t.vt ? ' vt:' + t.vt : ''}${t.for ? ' ' + t.for : ''}${t.by && t.by !== 'app' ? ' ' + t.by : ''}`),
      clear: () => { P.results.length = 0; P.faults.length = 0; P.trace.length = 0; P.checks.length = 0; save('results', []); },
    };
    return 'navprobe3 installed' + (load('resume', null) ? ' (a scenario is waiting: await __np3.resume())' : '');
  };
  const said = install();
  // Kept for the reload only where it installed: a refused origin keeps nothing.
  if (window.__np3) { try { sessionStorage.setItem('navprobe3:src', '(' + install.toString() + ')()'); } catch { /* blocked */ } }
  return said;
})();
