// Water on the 3D dungeon map, from the top, at an angle and from the side:  node tools/em3WaterProbe.mjs [dir]
//     node tools/em3ClassicProbe.mjs [dir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SHOTS = process.argv[2] ?? 'artifacts/em3';
mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 5245, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('DBG')) console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5245/menu.html?skin=enhanced', { waitUntil: 'networkidle' });
const info = await page.evaluate(async () => {
  document.getElementById('enhanced-menu')?.remove();
  const { HeldMapWindow } = await import('/src/ui/heldMap.js');
  const am = await import('/src/systems/automap/automap.js');
  const rows = [];
  // one model: a list of quads [corners..., normal]
  const model = (key, quads) => {
    const pos = [], nrm = [], idx = [];
    for (const { c: c0, n } of quads) {
      // wound so its front (the game's culling: (B-A)x(C-A) at the eye) is the side its normal names
      const [A, B, C] = c0, u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const c = w[0] * n[0] + w[1] * n[1] + w[2] * n[2] >= 0 ? c0 : [...c0].reverse();
      const b = pos.length / 3;
      for (const p of c) { pos.push(...p); nrm.push(...n); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    rows.push({ key, positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx), matrix: null });
  };
  const H = 4;
  // a room shell: floor, ceiling, and four inward walls with doorway gaps [side, from, to] (side: n e s w)
  const room = (key, y, x0, z0, x1, z1, gaps = []) => {
    const q = [];
    q.push({ c: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], n: [0, 1, 0] });
    q.push({ c: [[x0, y + H, z0], [x0, y + H, z1], [x1, y + H, z1], [x1, y + H, z0]], n: [0, -1, 0] });
    const wall = (side, a, b) => {
      if (side === 'n') q.push({ c: [[a, y, z1], [b, y, z1], [b, y + H, z1], [a, y + H, z1]], n: [0, 0, -1] });
      if (side === 's') q.push({ c: [[a, y, z0], [b, y, z0], [b, y + H, z0], [a, y + H, z0]], n: [0, 0, 1] });
      if (side === 'e') q.push({ c: [[x1, y, a], [x1, y, b], [x1, y + H, b], [x1, y + H, a]], n: [-1, 0, 0] });
      if (side === 'w') q.push({ c: [[x0, y, a], [x0, y, b], [x0, y + H, b], [x0, y + H, a]], n: [1, 0, 0] });
    };
    for (const [side, lo, hi] of [['n', x0, x1], ['s', x0, x1], ['e', z0, z1], ['w', z0, z1]]) {
      const gs = gaps.filter((g) => g[0] === side).sort((a, b) => a[1] - b[1]);
      let at = lo;
      for (const [, g0, g1] of gs) { if (g0 > at) wall(side, at, g0); at = g1; }
      if (at < hi) wall(side, at, hi);
    }
    model(key, q);
  };
  // a SOLID block, as most of Daggerfall's dungeon pieces are: a room carved in a box of rock a metre thick, the
  // cavity's faces looking into the room and the rock's outer faces looking out, doorways cut through both
  const solid = (key, y, x0, z0, x1, z1, gaps = []) => {
    const q = [], T = 1;
    const box = (X0, Z0, X1, Z1, Y0, Y1, out) => {
      const s = out ? 1 : -1;   // outward normals for the rock, inward for the cavity
      q.push({ c: [[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], n: [0, -s, 0] });
      q.push({ c: [[X0, Y1, Z0], [X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0]], n: [0, s, 0] });
      const wall = (side, a, b) => {
        if (side === 'n') q.push({ c: [[a, Y0, Z1], [b, Y0, Z1], [b, Y1, Z1], [a, Y1, Z1]], n: [0, 0, s] });
        if (side === 's') q.push({ c: [[a, Y0, Z0], [b, Y0, Z0], [b, Y1, Z0], [a, Y1, Z0]], n: [0, 0, -s] });
        if (side === 'e') q.push({ c: [[X1, Y0, a], [X1, Y0, b], [X1, Y1, b], [X1, Y1, a]], n: [s, 0, 0] });
        if (side === 'w') q.push({ c: [[X0, Y0, a], [X0, Y0, b], [X0, Y1, b], [X0, Y1, a]], n: [-s, 0, 0] });
      };
      for (const [side, lo, hi] of [['n', X0, X1], ['s', X0, X1], ['e', Z0, Z1], ['w', Z0, Z1]]) {
        const gs = gaps.filter((g) => g[0] === side).sort((a, b) => a[1] - b[1]);
        let at = lo;
        for (const [, g0, g1] of gs) { if (g0 > at) wall(side, at, g0); at = g1; }
        if (at < hi) wall(side, at, hi);
      }
    };
    box(x0 - T, z0 - T, x1 + T, z1 + T, y - T, y + H + T, true);
    box(x0, z0, x1, z1, y, y + H, false);
    // the doorways' floors and jambs through the rock
    for (const [side, g0, g1] of gaps) {
      const ns = side === 'n' || side === 's';
      const a = side === 'n' ? z1 : side === 's' ? z0 - T : side === 'e' ? x1 : x0 - T, b = a + T;
      if (ns) {
        q.push({ c: [[g0, y, a], [g1, y, a], [g1, y, b], [g0, y, b]], n: [0, 1, 0] });
        q.push({ c: [[g0, y, a], [g0, y, b], [g0, y + H, b], [g0, y + H, a]], n: [1, 0, 0] });
        q.push({ c: [[g1, y, a], [g1, y, b], [g1, y + H, b], [g1, y + H, a]], n: [-1, 0, 0] });
      } else {
        q.push({ c: [[a, y, g0], [b, y, g0], [b, y, g1], [a, y, g1]], n: [0, 1, 0] });
        q.push({ c: [[a, y, g0], [b, y, g0], [b, y + H, g0], [a, y + H, g0]], n: [0, 0, 1] });
        q.push({ c: [[a, y, g1], [b, y, g1], [b, y + H, g1], [a, y + H, g1]], n: [0, 0, -1] });
      }
    }
    model(key, q);
  };
  room('hall', 0, 100, 200, 124, 216, [['e', 206, 209], ['n', 110, 113]]);
  room('corr', 0, 124, 206, 140, 209, [['w', 206, 209], ['e', 206, 209]]);
  room('side', 0, 140, 198, 152, 214, [['w', 206, 209]]);
  room('north', 0, 104, 216, 122, 234, [['s', 110, 113]]);
  // a ramp up to a room on the next floor
  model('ramp', [
    { c: [[152, 0, 204], [152, 0, 208], [166, 7, 208], [166, 7, 204]], n: [-0.45, 0.89, 0] },
    { c: [[152, 0, 204], [166, 7, 204], [166, 11, 204], [152, 4, 204]], n: [0, 0, 1] },
    { c: [[166, 7, 208], [152, 0, 208], [152, 4, 208], [166, 11, 208]], n: [0, 0, -1] },
  ]);
  room('upper', 7, 166, 198, 184, 216, [['w', 204, 208]]);
  // a real flight of steps, treads and risers, the way Daggerfall builds its stairs: 28 steps of 0.25 up and
  // 0.35 along, north out of the north room, walled both sides
  {
    const q = [];
    for (let k = 0; k < 28; k++) {
      const z0 = 234 + k * 0.35, z1 = z0 + 0.35, y0 = k * 0.25, y1 = y0 + 0.25;
      q.push({ c: [[110, y0, z0], [113, y0, z0], [113, y1, z0], [110, y1, z0]], n: [0, 0, -1] });   // riser
      q.push({ c: [[110, y1, z0], [113, y1, z0], [113, y1, z1], [110, y1, z1]], n: [0, 1, 0] });    // tread
    }
    q.push({ c: [[110, 0, 234], [110, 0, 243.8], [110, 11, 243.8], [110, 11, 234]], n: [1, 0, 0] });
    q.push({ c: [[113, 0, 234], [113, 0, 243.8], [113, 11, 243.8], [113, 11, 234]], n: [-1, 0, 0] });
    model('stairs', q);
  }
  // the side room is flooded to 0.6 m, as a watered RDB block's rows carry their level (automapWaterLevel)
  for (const r of rows) if (r.key === 'side' || r.key === 'corr') r.waterLevel = 0.6;
  const mdl = { rows };
  const rec = am.enterDungeonAutomap('classic-probe', 0);
  for (const r of rows) rec.revealed.add(r.key);
  globalThis.__rec = rec;
  for (let x = 102; x < 150; x++) am.automapTrailTick(rec, [x, 1.6, 207.5], 1.6);
  globalThis.__feet = [115, 0, 207];
  const deps = { where: () => ({ insideDungeon: true }) };
  deps.automap = { record: () => rec, model: () => mdl, player: () => ({ feet: globalThis.__feet, yaw: 1.2 }), startMarker: { x: 102, y: 0, z: 207 }, insideBuilding: false, title: 'Classic Keep' };
  const win = new HeldMapWindow(deps);
  globalThis.__win = win;
  for (let i = 0; i < 60; i++) win.tick(1 / 30);
  return { gl: !!win._sheet && true };
});
console.log(JSON.stringify(info));
const settle = () => page.evaluate(() => { for (let i = 0; i < 60; i++) globalThis.__win.tick(1 / 30); });
await page.waitForTimeout(300); await settle();

// WATER: stand in the flooded side room, press Me (centres on you), zoom in, then look straight down and from the side
await page.evaluate(() => { globalThis.__feet = [146, 0, 206]; globalThis.__win.input('Home', { preventDefault() {} }); });
await settle();
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(1.8, w._paper.w / 2, w._paper.h / 2); }); await settle();
const shoot = async (name) => {
  const box = await page.evaluate(() => { const r = globalThis.__win._chrome.ink.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, clip: box });
};
// straight down
await page.evaluate(() => { const s = globalThis.__win._sheet; for (let i = 0; i < 40; i++) s.key('KeyR'); }); await settle(); await settle();
await page.evaluate(() => globalThis.__win.input('Home', { preventDefault() {} })); await settle();
await shoot('water-top');
// the rest tilt, three-quarter
await page.evaluate(() => { const s = globalThis.__win._sheet; for (let i = 0; i < 3; i++) s.key('KeyF'); s.key('KeyE'); }); await settle(); await settle();
await page.evaluate(() => globalThis.__win.input('Home', { preventDefault() {} })); await settle();
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(1.5, w._paper.w / 2, w._paper.h / 2); }); await settle();
await shoot('water-angle');
// from the side, low
await page.evaluate(() => { const s = globalThis.__win._sheet; for (let i = 0; i < 40; i++) s.key('KeyF'); s.key('KeyR'); }); await settle(); await settle();
await page.evaluate(() => globalThis.__win.input('Home', { preventDefault() {} })); await settle();
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(2.4, w._paper.w / 2, w._paper.h / 2); }); await settle();
await shoot('water-side');
console.log('pitch', await page.evaluate(() => globalThis.__win._sheet.orbit));
// the flagstones up close, at the rest tilt, in the dry hall
await page.evaluate(() => { globalThis.__feet = [112, 0, 208]; const s = globalThis.__win._sheet; for (let i = 0; i < 40; i++) s.key('KeyR'); for (let i = 0; i < 3; i++) s.key('KeyF'); }); await settle(); await settle();
await page.evaluate(() => globalThis.__win.input('Home', { preventDefault() {} })); await settle();
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(1.6, w._paper.w / 2, w._paper.h / 2); }); await settle();
await shoot('floor-close');
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(0.4, w._paper.w / 2, w._paper.h / 2); }); await settle();
await shoot('floor-far');
// ALL-FLOORS: one floor, then every explored floor (L), then Me - still every floor
await page.evaluate(() => { const s = globalThis.__win._sheet; s.key('KeyE'); }); await settle(); await settle();
await page.evaluate(() => globalThis.__win.input('Home', { preventDefault() {} })); await settle();
await page.evaluate(() => { const w = globalThis.__win; w._zoomBy(0.6, w._paper.w / 2, w._paper.h / 2); }); await settle();
await shoot('floors-one');
await page.evaluate(() => globalThis.__win.input('KeyL', { preventDefault() {} })); await settle();
await shoot('floors-all');
await page.evaluate(() => globalThis.__win.input('Home', { preventDefault() {} })); await settle();
await shoot('floors-all-me');
const storeys = await page.evaluate(() => globalThis.__win._sheet.storeys().map((q) => q.y));
const all = await page.evaluate(() => ({ on: globalThis.__win._sheet.allFloors, status: globalThis.__win._sheet.toolStatus() }));
console.log('storeys', storeys);
console.log('all floors', all);
// EM3-3D merge, T3: the flooded level's two storeys, and All (L) keeps both on the paper through Me (Home)
const fail = (why) => { console.error('FAIL', why); process.exitCode = 1; };   // T3: a probe judges its subject
if (storeys.length !== 2) fail(`the flooded level reads ${storeys.length} storeys, not 2`);
if (!all.on || !all.status?.all || all.status?.of !== 2) fail(`All floors is not on across both storeys after Me: ${JSON.stringify(all)}`);
await browser.close(); await server.close();
