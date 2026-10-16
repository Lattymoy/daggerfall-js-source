// Right-drag turning on the 3D dungeon map, measured with a real mouse:  node tools/em3TurnProbe.mjs [dir]
//     node tools/em3ClassicProbe.mjs [dir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SHOTS = process.argv[2] ?? 'artifacts/em3';
mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 5247, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5247/menu.html?skin=enhanced', { waitUntil: 'networkidle' });
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

// TURN-STEADY: real right-drags, measured
const inkBox = await page.evaluate(() => { const r = globalThis.__win._chrome.ink.getBoundingClientRect(); return { l: r.left, t: r.top }; });
const paper = await page.evaluate(() => ({ w: globalThis.__win._paper.w, h: globalThis.__win._paper.h }));
const planAt = (x, y) => page.evaluate(([a, b]) => globalThis.__win._sheet.planAt(a, b), [x, y]);
const out = {};
let worstPivotPx = 0;
async function drag(from, dx, dy, jitter = 0) {
  const X = inkBox.l + from.x, Y = inkBox.t + from.y;
  await page.mouse.move(X, Y); await page.mouse.down({ button: 'right' });
  let first = null;
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(X + (dx * i) / 20, Y + (dy * i) / 20 + (i % 2 ? jitter : -jitter));
    await page.evaluate(() => { for (let k = 0; k < 2; k++) globalThis.__win.tick(1 / 60); });
    // the pivot's world point, where it is on the paper now: it must not move
    const at = await page.evaluate(() => { const s = globalThis.__win._sheet, p = s.pivot; return p ? { p, now: s.paperAt(p.px, p.py, p.y) } : null; });
    if (at) { first ??= at; worstPivotPx = Math.max(worstPivotPx, Math.hypot(at.now[0] - first.now[0], at.now[1] - first.now[1])); }
  }
  await page.mouse.up({ button: 'right' }); await settle();
  return first;
}
const mid = { x: paper.w / 2, y: paper.h / 2 };
// 1. a drag begun on EMPTY paper (a corner): the middle of the paper must stay put
{
  const before = await planAt(mid.x, mid.y);
  const f = await drag({ x: 40, y: 40 }, 260, 0);
  out.emptyStartPivotPaper = f?.p?.paper;
  const after = await planAt(mid.x, mid.y);
  out.emptyStartMiddleDriftM = +Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(3);
}
await page.screenshot({ path: `${SHOTS}/turn-empty.png` });
// 2. a drag begun ON a room away from the middle: the floor under the pointer must stay under it
{
  const p = await page.evaluate(() => { const s = globalThis.__win._sheet; const q = s.planOf(146, 204); return s.paperAt(q[0], q[1], 0); });   // the flooded side room
  const before = await planAt(p[0], p[1]);
  const f = await drag({ x: p[0], y: p[1] }, -220, 0);
  out.onFloorStart = p.map((v) => +v.toFixed(0)); out.onFloorPivotPaper = f?.p?.paper;
  const after = await planAt(p[0], p[1]);
  out.onFloorPointerDriftM = +Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(3);
  out.middleIsPivot = !!f && Math.abs(f.p.paper.x - paper.w / 2) < 1 && Math.abs(f.p.paper.y - paper.h / 2) < 1;
}
// 3. a sideways drag with a shaky hand: the tilt must not move
{
  const p0 = await page.evaluate(() => globalThis.__win._sheet.orbit.pitch);
  await drag(mid, 240, 6, 5);
  const p1 = await page.evaluate(() => globalThis.__win._sheet.orbit.pitch);
  out.shakySidewaysPitchChange = +(p1 - p0).toFixed(4);
}
// 4. PAN-LEFT-ONLY: a left press whose release was lost (let go outside the window), then a right-drag: the map turns
// about the middle and never pans
{
  await page.evaluate(() => { const st = globalThis.__win._chrome.stage, r = st.getBoundingClientRect();
    st.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: r.left + 200, clientY: r.top + 200, bubbles: true })); });
  const before = await planAt(mid.x, mid.y);
  await drag({ x: 60, y: paper.h - 60 }, 300, 0);
  const after = await planAt(mid.x, mid.y);
  out.staleLeftThenRightMiddleDriftM = +Math.hypot(after[0] - before[0], after[1] - before[1]).toFixed(3);
  // and a right-drag on the plan (P) tilts it back out about the middle - the middle stays, nothing pans
  await page.evaluate(() => globalThis.__win.input('KeyP', { preventDefault() {} })); await settle();
  const m0 = await planAt(mid.x, mid.y);
  await drag({ x: 60, y: 60 }, 200, 120);
  const m1 = await planAt(mid.x, mid.y);
  out.planRightDragMiddleDriftM = +Math.hypot(m1[0] - m0[0], m1[1] - m0[1]).toFixed(3);
}
out.worstPivotDriftPx = +worstPivotPx.toFixed(2);
console.log('turn', JSON.stringify(out));
// EM3-3D merge, T3: the laws the final patch states. The pivot is the middle of everything explored, held on its
// paper point for the whole turn (README "a turn turns about a FIXED point"), so the paper's-middle drifts above are
// the old pivot's and are reported, not judged.
const fail = (why) => { console.error('FAIL', why); process.exitCode = 1; };   // T3: a probe judges its subject
if (!(out.worstPivotDriftPx <= 0.5)) fail(`the pivot moved ${out.worstPivotDriftPx} px on the paper during a turn`);
if (out.shakySidewaysPitchChange !== 0) fail(`a shaky sideways drag tilted the map by ${out.shakySidewaysPitchChange}`);
await browser.close(); await server.close();
