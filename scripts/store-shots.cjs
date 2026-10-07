/*
  scripts/store-shots.cjs
  The Play Store screenshots, taken from the real app (audit 17, M26).

  Drives the dev server through the store on window (main.tsx, dev only) to
  each scene in docs/16-store-listing.md and writes 1080x1920 PNGs:

      npx vite --port 5199 --strictPort     (in another terminal)
      node scripts/store-shots.cjs store             all eight
      node scripts/store-shots.cjs store desk,god    just those

  Needs Playwright and a Chromium; PLAYWRIGHT_MODULE and CHROMIUM point at
  them when they are not where npm would put them. Tutorials, sound and
  haptics are off and the theme is light, so every shot is the same app.
  shot-08 is the June big-moment card; the awards list is written beside it
  as shot-08-awards.png for anyone who prefers it.
*/
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const OUT = process.argv[2];
const only = process.argv[3];
const PREFS = (god) => JSON.stringify({ tutorials: false, tsz: true, ts2: true, textScale: 1, bcast: true, sound: false, haptics: false, theme: 'light', field: '3d', godMode: god });
async function page(b, god = false) {
  const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  await p.goto('http://localhost:5199/');
  await p.evaluate((prefs) => { localStorage.clear(); localStorage.setItem('playball.prefs.v1', prefs); indexedDB.deleteDatabase('playball'); }, PREFS(god));
  await p.reload();
  await p.waitForFunction(() => window.store, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  return p;
}
const start = (p, seed, team, god = false) => p.evaluate(([seed, team, god]) => {
  const s = window.store.getState(); s.start(seed, team, undefined, 'full', undefined, god);
  const g = window.store.getState(); if (g.seasonOpener) g.dismissSeasonOpener(); g.closeSeasonPlan?.();
}, [seed, team, god]);
const holds = (p) => p.evaluate(() => { const s = window.store.getState(); const t = s.season.teams[s.userTeam].team; s.autoLineup(); for (const x of [...t.bench, ...t.bullpen]) s.keepCover?.(x.id); });
const clear = (p) => p.evaluate(() => window.store.setState({ overlay: null, overlayStack: [], selectedPlayer: null, godStack: [], coachSeat: null }));
const shot = async (p, name) => { await p.evaluate(() => document.querySelectorAll('*').forEach((e) => e.getAnimations?.().forEach((a) => a.finish?.()))); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const want = (n) => !only || only.split(',').includes(n);
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  if (want('desk') || want('recruiting') || want('program') || want('player')) {
    const p = await page(b);
    await start(p, 4242, 3); await holds(p);
    // A few days in, so the desk has a record and the board has movement.
    await p.evaluate(async () => { for (let i = 0; i < 4; i++) { const s = window.store.getState(); s.autoLineup(); s.advanceDay(); } });
    await clear(p);
    if (want('desk')) { await p.evaluate(() => window.store.getState().go('home', 'today')); await p.waitForTimeout(1200); await shot(p, 'shot-02-desk'); }
    if (want('recruiting')) {
      await p.evaluate(() => window.store.getState().go('office', 'recruiting')); await p.waitForTimeout(1200);
      const n = await p.locator('.pb-rc-row').count();
      if (n > 0) { await p.locator('.pb-rc-row').nth(0).click(); await p.waitForTimeout(900); }
      await shot(p, 'shot-03-recruiting');
      await p.keyboard.press('Escape'); await clear(p);
    }
    if (want('program')) {
      await p.evaluate(() => { const s = window.store.getState(); for (const seat of ['pitching', 'hitting', 'recruiting']) { try { s.hireAssistant(seat, 0); } catch (e) { console.log(e); } } });
      await p.evaluate(() => window.store.getState().go('office', 'staff')); await p.waitForTimeout(1200); await shot(p, 'shot-05-program'); }
    if (want('player')) {
      await p.evaluate(() => { const s = window.store.getState(); const t = s.season.teams[s.userTeam].team; const best = [...t.lineup].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))[0]; s.go('team', 'roster'); window.__best = best.id; });
      await p.waitForTimeout(1200);
      await p.evaluate(() => window.store.getState().openPlayer(window.__best));
      await p.waitForTimeout(1200); await shot(p, 'shot-06-player');
    }
    await p.close();
  }
  if (want('bracket') || want('awards')) {
    const p = await page(b);
    await start(p, 7331, 12);
    for (let i = 0; i < 40; i++) {
      const done = await p.evaluate(() => { const s = window.store.getState(); return s.season.dayIndex >= s.season.schedule.length; });
      if (done) break;
      await holds(p);
      await p.evaluate(() => window.store.getState().playSeason());
      await p.waitForTimeout(300);
    }
    await holds(p);
    await p.evaluate(() => window.store.getState().playPostseason());
    await p.waitForTimeout(1500);
    await clear(p); await p.evaluate(() => window.store.getState().go('home'));
    await p.waitForTimeout(1500);
    const intro = p.getByRole('button', { name: /Let.s go/ });
    if (await intro.count()) { await intro.first().click(); await p.waitForTimeout(1200); }
    if (want('bracket')) await shot(p, 'shot-04-bracket');
    for (let i = 0; i < 400; i++) {
      const ph = await p.evaluate(() => window.store.getState().phase);
      if (ph !== null) break;
      await holds(p);
      await p.evaluate(() => { const s = window.store.getState(); if (s.myBracket) s.simBracket('rest'); else s.advanceBracket(); });
      await p.waitForTimeout(80);
    }
    await clear(p); await p.waitForTimeout(2000);
    if (want('awards')) {
      const later = p.getByRole('button', { name: 'Later' });
      if (await later.count()) { await later.first().click(); await p.waitForTimeout(1500); }
      await shot(p, 'shot-08-big-moment');
      for (let k = 0; k < 3; k++) { await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
      const turn = p.getByText('Turn them all');
      if (await turn.count()) { await turn.first().click(); await p.waitForTimeout(2500); }
      await shot(p, 'shot-08-awards');
    }
    await p.close();
  }
  if (want('god')) {
    const p = await page(b, true);
    await start(p, 4242, 3, true); await clear(p);
    await p.evaluate(() => { const s = window.store.getState(); s.openGod({ kind: 'program', team: s.userTeam }); });
    await p.waitForTimeout(1500); await shot(p, 'shot-07-god-mode');
    await p.close();
  }
  if (want('dugout')) {
    const p = await page(b);
    await start(p, 4242, 3); await holds(p); await clear(p);
    await p.evaluate(() => window.store.getState().startManagedGame());
    await p.waitForTimeout(3000);
    for (let i = 0; i < 60; i++) {
      const st = await p.evaluate(() => { const l = window.store.getState().live; const pd = l?.pending; return { on: (pd?.runners ?? []).length ?? 0, inning: pd?.inning ?? 0, over: !!l?.over }; });
      if (st.over || (st.inning >= 3 && st.on >= 2)) break;
      await p.evaluate(() => { const s = window.store.getState(); const o = s.live?.pending?.options.find((x) => x.available); if (o) s.submitTactic(o.tactic); });
      await p.waitForTimeout(2600);
    }
    await p.waitForTimeout(2500);
    await shot(p, 'shot-01-dugout');
    await p.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
