// EM3-3D probe: a synthetic five-storey dungeon on the real held window, real mouse clicks on the floor strip.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SHOTS = process.argv[2] ?? 'artifacts/em3';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 5241, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
// EM3-3D merge: the floor LIST this probe clicks is the flat plan's - the 3D map moved its floors to the window's
// button bar - so it opens the 2D Enhanced map, the dungeon-map-3d row's Off (ui/map/mapSkin.js dungeonMap3dOn)
await page.goto('http://127.0.0.1:5241/menu.html?skin=enhanced&dungeonmap=flat', { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  document.getElementById('enhanced-menu')?.remove();
  const { HeldMapWindow } = await import('/src/ui/heldMap.js');
  const am = await import('/src/systems/automap/automap.js');
  const rows = [];
  const quad = (key, y, x0, z0, x1, z1) => rows.push({ key, positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
  // a round room as a fan of thin triangles, the shape that pocks the raster
  const fan = (key, y, cx, cz, R, n) => {
    const pos = [cx, y, cz]; const idx = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pos.push(cx + R * Math.cos(a), y, cz + R * Math.sin(a)); if (i) idx.push(0, i, i + 1); }
    rows.push({ key, positions: new Float32Array(pos), indices: new Uint16Array(idx), matrix: null });
  };
  const box = (key, y, x0, z0, x1, z1, hgt) => quad(key, y + hgt, x0, z0, x1, z1);   // a wall top / crate lid
  for (let f = 0; f < 5; f++) {
    const y = f * 9;
    // one big model per storey (Daggerfall's models are big): a hall, a corridor and a round room
    const pos = [], idx = [];
    const add = (x0, z0, x1, z1) => { const b = pos.length / 3; pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    add(100, 200, 130, 214); add(112, 214, 118, 240); add(104, 240, 132, 258); add(60, 200, 100, 204); add(40, 190, 60, 230);
    rows.push({ key: `s${f}`, positions: new Float32Array(pos), indices: new Uint16Array(idx), matrix: null });
    fan(`round${f}`, y, 145, 250, 9, 40);
    quad(`link${f}`, y, 132, 247, 137, 252);
    box(`walltop${f}`, y, 100, 199, 130, 200, 3.5);
    box(`crate${f}`, y, 120, 205, 121, 206, 0.9);
  }
  // ramps between storeys
  for (let f = 0; f < 4; f++) {
    const y = f * 9;
    rows.push({ key: `ramp${f}`, positions: new Float32Array([40, y, 230, 60, y, 230, 60, y + 9, 250, 40, y + 9, 250].map((v, i) => (i % 3 === 2 ? v + f * 0 : v))), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
  }
  const model = { rows };
  const rec = am.enterDungeonAutomap('probe', 0);
  // the reveal is whole models, as Daggerfall's is: the player saw every storey's big model from the stairs
  for (const r of rows) rec.revealed.add(r.key);
  // the player WALKED floor 1's hall and corridor and floor 3's round room
  const walk = (y, pts) => { for (const [x, z] of pts) am.automapTrailTick(rec, [x, y + 1.6, z], 1.6); };
  const line = (x0, z0, x1, z1) => { const out = []; const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0)); for (let i = 0; i <= n; i++) out.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); return out; };
  walk(0, [...line(102, 207, 128, 207), ...line(115, 207, 115, 238)]);
  walk(18, [...line(134, 249, 150, 250), ...line(145, 244, 145, 256)]);
  globalThis.__rec = rec;
  globalThis.__feet = [145, 18, 250];
  const deps = { where: () => ({ insideDungeon: true }) };
  deps.automap = { record: () => rec, model: () => model, player: () => ({ feet: globalThis.__feet, yaw: 0.5 }), startMarker: { x: 102, y: 0, z: 207 }, insideBuilding: false, title: 'Probe Keep' };
  const win = new HeldMapWindow(deps);
  globalThis.__win = win;
  for (let i = 0; i < 60; i++) win.tick(1 / 30);
});
await page.waitForTimeout(500);
await page.evaluate(() => { for (let i = 0; i < 30; i++) globalThis.__win.tick(1 / 30); });
await page.screenshot({ path: `${SHOTS}/a-open.png` });
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(1.0, w._paper.w / 2, w._paper.h / 2); w.input('KeyE', { preventDefault() {} }); for (let i = 0; i < 60; i++) w.tick(1 / 30); });
await page.screenshot({ path: `${SHOTS}/z-zoom.png` });
await page.evaluate(() => { const w = globalThis.__win; w.input('KeyQ', { preventDefault() {} }); for (let i = 0; i < 60; i++) w.tick(1 / 30); });
const info = await page.evaluate(() => {
  const w = globalThis.__win, s = w._sheet;
  const r = w._chrome.ink.getBoundingClientRect();
  return { lane: w._lane, floor: s.floor, floors: s.floors().map((f) => f.label), strip: s.strip?.rows.map((q) => ({ i: q.index, l: q.label, x: q.x, y: q.y, w: q.w, h: q.h })), ink: { l: r.left, t: r.top, w: r.width, h: r.height }, hint: w._chrome.hint.textContent };
});
console.log(JSON.stringify(info));
console.log(JSON.stringify(await page.evaluate(() => { const w = globalThis.__win; const L = w._limits(); return { view: w._view, goal: w._goal, home: w._sheet.homeView(L), L, size: w._sheet.size(), orbit: w._sheet.orbit }; })));
// real mouse clicks on every row, at the word's middle and at a point just right of it
const res = [];
for (const q of info.strip ?? []) {
  for (const [tag, dx] of [['mid', q.w / 2], ['right', q.w + 10], ['left', -8]]) {
    const X = info.ink.l + q.x + dx, Y = info.ink.t + q.y + q.h / 2;
    // a real hand drifts while it clicks
    await page.mouse.move(X, Y); await page.mouse.down(); await page.mouse.move(X + 7, Y + 5, { steps: 3 }); await page.mouse.up();
    await page.evaluate(() => { for (let i = 0; i < 5; i++) globalThis.__win.tick(1 / 30); });
    const now = await page.evaluate(() => globalThis.__win._sheet.floor);
    res.push(`${q.l || 'chev'}:${tag}->${now === q.i ? 'OK' : 'got ' + now}`);
  }
}
console.log(res.join('  '));
const keys = [];
for (const k of ['PageDown', 'PageUp', 'KeyP']) { await page.evaluate((k2) => { globalThis.__win.input(k2, { preventDefault() {} }); for (let i = 0; i < 20; i++) globalThis.__win.tick(1 / 30); }, k); keys.push(k + '->' + await page.evaluate(() => globalThis.__win._sheet.floor + (globalThis.__win.done ? ' CLOSED' : ''))); }
console.log(keys.join('  '));
// EM3-3D merge, T3: every row takes its click with a drifting hand, and PgDn/PgUp page away and back
const fail = (why) => { console.error('FAIL', why); process.exitCode = 1; };   // T3: a probe judges its subject
if (!res.length) fail('the flat plan drew no floor list to click');
for (const r of res) if (!r.endsWith('OK')) fail(`a floor row did not take its click: ${r}`);
if (keys[0] === `PageDown->${info.floor}` || keys[1] !== `PageUp->${info.floor}`) fail(`PgDn/PgUp did not page away and back from floor ${info.floor}: ${keys.join(' ')}`);
await page.screenshot({ path: `${SHOTS}/p-plan.png` });
await page.evaluate(() => globalThis.__win.input('KeyP', { preventDefault() {} }));
await page.evaluate(() => { const w = globalThis.__win; w._sheet.setFloor(2); w._dirty = true; for (let i = 0; i < 30; i++) w.tick(1 / 30); });
await page.screenshot({ path: `${SHOTS}/b-floor3.png` });
await page.evaluate(() => { const w = globalThis.__win; w._sheet.setFloor(0); w._dirty = true; for (let i = 0; i < 30; i++) w.tick(1 / 30); });
await page.screenshot({ path: `${SHOTS}/c-floor1.png` });
await browser.close(); await server.close();
