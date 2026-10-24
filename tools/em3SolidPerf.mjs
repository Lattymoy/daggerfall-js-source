// EM3-3D perf probe: a big walked dungeon with a real flight of steps; times the solid sheet's full repaint.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SHOTS = process.argv[2] ?? 'artifacts/em3';
mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 5242, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto('http://127.0.0.1:5242/menu.html?skin=enhanced', { waitUntil: 'networkidle' });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
globalThis.__cdp = cdp;
const out = await page.evaluate(async () => {
  document.getElementById('enhanced-menu')?.remove();
  const { HeldMapWindow } = await import('/src/ui/heldMap.js');
  const am = await import('/src/systems/automap/automap.js');
  const rows = [];
  const quad = (key, y, x0, z0, x1, z1) => rows.push({ key, positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
  // three storeys of a 6x4 grid of 14 m rooms joined by 3 m corridors
  for (let f = 0; f < 3; f++) {
    const y = f * 9;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const x0 = i * 20, z0 = j * 20;
      quad(`r${f}.${i}.${j}`, y, x0, z0, x0 + 14, z0 + 14);
      if (i < 5) quad(`cx${f}.${i}.${j}`, y, x0 + 14, z0 + 5, x0 + 20, z0 + 8);
      if (j < 3) quad(`cz${f}.${i}.${j}`, y, x0 + 5, z0 + 14, x0 + 8, z0 + 20);
    }
  }
  // a flight of steps from storey 0 up to storey 1 beside the grid: 36 treads of 0.25 m over 0.3 m each
  for (let k = 0; k < 36; k++) quad(`st${k}`, (k + 1) * 0.25, 125 + k * 0.3, 30, 125 + (k + 1) * 0.3, 34);
  quad('land0', 0, 120, 28, 125, 36); quad('land1', 9, 125 + 36 * 0.3, 28, 125 + 36 * 0.3 + 5, 36);
  const model = { rows };
  const rec = am.enterDungeonAutomap('perf', 0);
  for (const r of rows) rec.revealed.add(r.key);
  for (let f = 0; f < 3; f++) for (let x = 1; x < 120; x += 2) for (let z = 6; z < 80; z += 20) am.automapTrailTick(rec, [x, f * 9 + 1.6, z], 1.6);
  for (let x = 121; x < 142; x++) am.automapTrailTick(rec, [x, x < 125 ? 1.6 : Math.min(9, (x - 125) / 0.3 * 0.25) + 1.6, 32], 1.6);
  globalThis.__feet = [130, 4, 32];
  const deps = { where: () => ({ insideDungeon: true }) };
  deps.automap = { record: () => rec, model: () => model, player: () => ({ feet: globalThis.__feet, yaw: 0.5 }), startMarker: { x: 3, y: 0, z: 3 }, insideBuilding: false, title: 'Perf Keep' };
  const win = new HeldMapWindow(deps);
  globalThis.__win = win;
  for (let i = 0; i < 60; i++) win.tick(1 / 30);
  // time 20 forced repaints of the kept layer, as a pan does
  const sheet = win._sheet;
  const ps = sheet.paintStatic.bind(sheet);
  let tp = 0; sheet.paintStatic = (c, e) => { const a = performance.now(); ps(c, e); tp += performance.now() - a; };
  const po = sheet.paintOverlay.bind(sheet);
  let to = 0; sheet.paintOverlay = (c, e) => { const a = performance.now(); po(c, e); to += performance.now() - a; };
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) { win._view = { ...win._view, ox: win._view.ox + 0.3 }; win._dirty = true; win.tick(1 / 60); }
  const pan = (performance.now() - t0) / 20;
  // a turn: Q, then the frames of its ease (the quick sketch), then the frame it lands on (the full drawing)
  return { pan, stat: tp / 20, over: to / 20, scale: win._view.scale };
});
console.log(JSON.stringify(out));
const PROF = process.argv.includes('--prof');
if (PROF) await cdp.send('Profiler.start');
const out2 = await page.evaluate(() => {
  const win = globalThis.__win;
  win.input('KeyE', { preventDefault() {} });
  const turn = [];
  for (let i = 0; i < 40; i++) { const a = performance.now(); win.tick(1 / 60); turn.push(performance.now() - a); }
  const zoom = [];
  for (let i = 0; i < 10; i++) { const a = performance.now(); win._zoomBy(1.05, 800, 400); win.tick(1 / 60); zoom.push(performance.now() - a); }
  const settle = [];
  for (let i = 0; i < 30; i++) { const a = performance.now(); win.tick(1 / 60); settle.push(performance.now() - a); }
  const r = (xs) => xs.map((x) => Math.round(x)).join(' ');
  return { turn: r(turn), zoom: r(zoom), settle: r(settle) };
});
console.log(JSON.stringify(out2));
if (PROF) {
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)); });
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${(v / 1000).toFixed(0)}ms ${k}`).join('\n'));
}
await page.evaluate(() => { const w = globalThis.__win; for (let i = 0; i < 30; i++) w.tick(1 / 30); });
await page.screenshot({ path: `${SHOTS}/perf.png` });
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(3, 1000, 450); for (let i = 0; i < 40; i++) w.tick(1 / 30); });
await page.screenshot({ path: `${SHOTS}/perf-zoom.png` });
// EM3-3D merge, T3: the finished drawing is KEPT (README, third round): once the map rests, a frame repaints nothing,
// whatever the machine. The turn and zoom times are this machine's and are reported, not judged.
const fail = (why) => { console.error('FAIL', why); process.exitCode = 1; };   // T3: a probe judges its subject
const settled = out2.settle.split(' ').slice(1).map(Number);
if (settled.some((ms) => ms > 5)) fail(`the map repaints while it rests: ${out2.settle}`);
if (!(out.pan > 0 && out.stat > 0)) fail(`the timings did not run: ${JSON.stringify(out)}`);
await browser.close(); await server.close();
