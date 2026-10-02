// navprobe3-driver.mjs — runs navprobe3.js in a headless Chrome of its own
// (plan package PR, 2026-09-30).
//
// Why a driver: the ledger pushes an entry only after a real activation, and
// a script's el.click() is not one. Chrome's DevTools protocol gives trusted
// taps, paints frames (a background tab in the Browser pane does not), and
// injects the probe before the app boots, so it sees the first history write
// and survives the reload in S8. Each scenario gets a fresh document.
//
//   node tests/probes/navprobe3-driver.mjs --url http://localhost:5176/ \
//     --scenarios S1,S3,S5,S11 --out <file.json> [--chrome <exe>] [--headful]
//
// Point it at a dev server on 5175 (`playball-check`) or a no-watch port like
// 5176, never 5174: the profile is a throwaway folder, but the origin's saves
// are only safe on a port nobody plays on. Chrome is closed at the end.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (name, d) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : d; };
const flag = (name) => process.argv.includes('--' + name);
const url = arg('url', 'http://localhost:5176/');
if (/:(5173|5174)\b/.test(url)) { console.error('5173 and 5174 hold the user\'s saves; use 5175 or 5176.'); process.exit(2); }
const scenarios = arg('scenarios', 'S1,S3,S5,S11').split(',').map((s) => s.trim()).filter(Boolean);
const out = arg('out', null);
const chrome = arg('chrome', [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p)));
const perScenarioMs = Number(arg('timeout', '240000'));
const probe = readFileSync(new URL('./navprobe3.js', import.meta.url), 'utf8');

const W = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'navprobe3-'));
const proc = spawn(chrome, [
  flag('headful') ? '--window-size=420,900' : '--headless=new',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });

let ws = null;
const cleanup = async () => {
  try { ws?.close(); } catch { /* closed */ }
  try { proc.kill(); } catch { /* gone */ }
  await W(800);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked for a moment */ }
};

try {
  // The port Chrome picked, from the file it writes in the profile.
  let port = null;
  for (let k = 0; k < 100 && !port; k++) {
    await W(100);
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { /* not yet */ }
  }
  if (!port) throw new Error('Chrome did not open a debugging port');
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const waiting = new Map();
  const handlers = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? w.rej(new Error(msg.error.message)) : w.res(msg.result); }
    else if (msg.method) for (const h of handlers.get(msg.method) || []) h(msg.params);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; waiting.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
  const on = (method, fn) => { handlers.set(method, [...(handlers.get(method) || []), fn]); };
  const once = (method, ms = 30000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timed out waiting for ' + method)), ms);
    const fn = (p) => { clearTimeout(t); handlers.set(method, (handlers.get(method) || []).filter((f) => f !== fn)); res(p); };
    on(method, fn);
  });

  const errors = [];
  on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description?.split('\n')[0] ?? p.exceptionDetails?.text));
  on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)); });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  // Trusted taps: the probe asks through a binding, the driver clicks there.
  await send('Runtime.addBinding', { name: '__np3TapBinding' });
  on('Runtime.bindingCalled', async (p) => {
    if (p.name !== '__np3TapBinding') return;
    const { id: tap, x, y } = JSON.parse(p.payload);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await send('Runtime.evaluate', { expression: `window.__np3TapWait && window.__np3TapWait[${tap}] && window.__np3TapWait[${tap}]()` });
  });
  // The profile is a throwaway folder, so the probe may install on any port
  // but the two it always refuses (5173, 5174).
  const shim = `window.__np3Allow = true;
  window.__np3Tap = (x, y) => new Promise((res) => {
    const n = (window.__np3TapN = (window.__np3TapN || 0) + 1);
    (window.__np3TapWait = window.__np3TapWait || {})[n] = res;
    window.__np3TapBinding(JSON.stringify({ id: n, x, y }));
  });`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: shim + '\n' + probe });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const open = async (u) => {
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: u });
    await loaded;
    await W(2500);
  };

  const results = [];
  for (const name of scenarios) {
    const sep = url.includes('?') ? '&' : '?';
    await open(`${url}${sep}np3=${name}-${Date.now()}`);
    const errorsBefore = errors.length;
    const guard = (p) => Promise.race([p, W(perScenarioMs).then(() => ({ scenario: name, error: 'driver timeout' }))]);
    let r;
    try {
      r = await guard(evaluate(`__np3.run(${JSON.stringify(name)})`));
      if (r && r.reloading) {
        await once('Page.loadEventFired').catch(() => null);
        await W(2500);
        r = await guard(evaluate('__np3.resume()'));
      }
    } catch (e) {
      // A reload tears the context down under a pending evaluate.
      if (/context|destroyed|navigat/i.test(String(e.message))) {
        await W(3500);
        r = await guard(evaluate('__np3.resume()'));
      } else r = { scenario: name, error: String(e.message) };
    }
    r.pageErrors = errors.slice(errorsBefore);
    results.push(r);
    const s = r.summary ?? {};
    console.log(`${name}: presses ${s.presses ?? '-'}, match ${s.match ?? '-'}, mismatch ${s.mismatch ?? '-'}, tagged ${s.tagged ?? '-'}, known ${s.known ?? '-'}, leave held ${s.leaveHeld ?? '-'}, inv failed ${s.invFailed ?? '-'}, faults ${s.faults ?? '-'}, vt pushes ${s.vtPushes ?? '-'}${r.skipped ? ' (skipped: ' + r.skipped + ')' : ''}${r.error ? ' ERROR ' + r.error : ''}`);
  }
  const table = results.flatMap((r) => (r.rows || []).map((x) => ({
    scenario: r.scenario, press: x.press, i: x.i, preview: x.preview, live: x.live, match: x.match, inv: x.inv ?? null,
    ...(x.tag ? { tag: x.tag } : {}), ...(x.vt ? { vt: x.vt } : {}), ...(x.reshot ? { reshot: true } : {}),
    ...(x.faults && x.faults.length ? { faults: x.faults } : {}),
    ...(x.diff && Object.keys(x.diff).length ? { diff: x.diff } : {}),
  })));
  const report = { when: new Date().toISOString(), url, driver: 'cdp-trusted', chrome, scenarios, table, results };
  if (out) writeFileSync(out, JSON.stringify(report, null, 1));
  else console.log(JSON.stringify(table, null, 1));
} finally {
  await cleanup();
}
