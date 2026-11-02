// THE WATER'S LEVEL, PHOTOGRAPHED IN THE REAL GAME - THE
// REVERT's lesson ("a look change wants a shot from the real game before it lands, not a probe number"). Boots the
// streaming world headless on SwiftShader with the player's ARENA2 (tools/waterLookProbe.mjs's way), Basic Roads' rivers
// on, and photographs the water each body law draws: Daggerfall's moat and the Bay river beside it, Sentinel's palace
// pool and harbour, a river and a lake of Cyrodiil, and a lake of World 2.0's hammerfell-test. Each scene finds its own
// water in the built pixels, so the same run shoots the same places before and after a change.
//
//  ARENA2_PATH=... node tools/waterLevelProbe.mjs /tmp/waterlevel/before [scene ...]
//
// Scenes: daggerfall, sentinel, harbour, cyrodiil, cyrodiillake, wg2 (all by default); each body's shore also close and
// low. Renders of game data are game data (Port-Doctrine):
// write them outside the tree. Fails on a page error or a shader that would not build.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2];
if (!out) { console.error('usage: node tools/waterLevelProbe.mjs out-prefix [scene ...]'); process.exit(2); }
mkdirSync(dirname(`${out}_x`), { recursive: true });
const PORT = Number(process.env.PORT || 5207);
// WL_BASE replaces the page's query (another skin, hour or season); WL_UI is JSON merged into the UI prefs (waterQuality)
const BASE = process.env.WL_BASE || 'world&shot&class=0&season=summer&tod=12:00&weather=sunny&timescale=0&skin=enhanced&novideo&nofoes&touch=off';
const UI = { landViewDistance: 1, tutorialPopups: false, survival: false, ...JSON.parse(process.env.WL_UI || '{}') };

/** The page's helpers: a pose aimed at a point, and the water tiles of a pixel grouped into bodies (WATERS: water and the
 *  shores the marching squares and the river painter lay). */
const HELPERS = `(() => {
  window.WATERS = [0, 5, 6, 7, 20, 21, 22, 30, 31, 32, 48, 49, 50];
  window.__wl = {
    aim(p, d, h, yaw) { __pose(p.x - Math.sin(yaw) * d, p.y + h, p.z - Math.cos(yaw) * d, yaw, -Math.atan2(h, d)); return p; },
    bodies(pixel, records = [0]) {
      const tiles = __findTiles(records, 200000).filter((t) => t.pixel === pixel), key = (t) => Math.round(t.x / 6.4) + ',' + Math.round(t.z / 6.4);
      const at = new Map(tiles.map((t) => [key(t), t])), seen = new Set(), out = [];
      for (const t of tiles) {
        if (seen.has(key(t))) continue;
        const body = [], stack = [t]; seen.add(key(t));
        while (stack.length) {
          const u = stack.pop(); body.push(u);
          const [i, j] = key(u).split(',').map(Number);
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (i + di) + ',' + (j + dj); if (at.has(k) && !seen.has(k)) { seen.add(k); stack.push(at.get(k)); } }
        }
        const c = body.reduce((a, u) => [a[0] + u.x / body.length, a[1] + u.z / body.length], [0, 0]);
        out.push({ n: body.length, tiles: body, cx: c[0], cz: c[1] });
      }
      return out.sort((a, b) => b.n - a.n);
    },
    /** the tile of a body nearest a point, raised to the ground there */
    nearest(body, x, z) { return body.tiles.reduce((a, t) => (Math.hypot(t.x - x, t.z - z) < Math.hypot(a.x - x, a.z - z) ? t : a)); },
    here() { const r = window.__renderer; return r?.camera?.pos ?? null; },
    /** A close, low look at a shore - the body's edge tile nearest its middle (a neighbour not water, inside
     *  the body's own box, so never a pixel's seam), from over the water \`d\` back and \`h\` up; \`y\` the water's height */
    low(body, d, h, y) {
      const ij = body.tiles.map((t) => [Math.round(t.x / 6.4), Math.round(t.z / 6.4)]), at = new Set(ij.map((p) => p[0] + ',' + p[1]));
      const xs = ij.map((p) => p[0]), zs = ij.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const open = (n) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !at.has((ij[n][0] + a) + ',' + (ij[n][1] + b)));
      const inner = body.tiles.filter((t, n) => { const [i, j] = ij[n]; return i > x0 && i < x1 && j > z0 && j < z1 && open(n); });
      const edge = inner.length ? inner : body.tiles.filter((t, n) => open(n));
      const e = { ...edge.reduce((a, t) => (Math.hypot(t.x - body.cx, t.z - body.cz) < Math.hypot(a.x - body.cx, a.z - body.cz) ? t : a)) };
      if (y != null) e.y = y;
      __wl.aim(e, d, h, Math.atan2(e.x - body.cx, e.z - body.cz));
      return e;
    },
  };
  return true;
})()`;

/** A scene: one boot (`query`), then shots - each `pose` an expression that leaves the camera where the shot stands. */
const SCENES = {
  daggerfall: {
    query: 'region=Daggerfall&loc=Daggerfall',
    shots: [
      { name: 'moat_near', pose: `(() => { const b = __wl.bodies('207,213', WATERS)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 16, 5, 0.6); return { n: b.n, t }; })()` },
      { name: 'moat_wide', pose: `(() => { const b = __wl.bodies('207,213', WATERS)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 40, 16, 2.2); return { n: b.n, t }; })()` },
      { name: 'river_near', pose: `(() => { const b = __wl.bodies('207,212', WATERS)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 14, 5, 1.1); return { n: b.n, t }; })()` },
      { name: 'river_wide', pose: `(() => { const b = __wl.bodies('207,212', WATERS)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 45, 18, -0.4); return { n: b.n, t }; })()` },
      { name: 'river_top', pose: `(() => { const b = __wl.bodies('207,212', WATERS)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 6, 40, 1.1); return { n: b.n, t }; })()` },
      { name: 'moat_top', pose: `(() => { const b = __wl.bodies('207,213', WATERS)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 6, 40, 2.2); return { n: b.n, t }; })()` },
      { name: 'river_low', pose: `(() => { const b = __wl.bodies('207,212', WATERS)[0]; return { n: b.n, t: __wl.low(b, 10, 2.5) }; })()` },
    ],
  },
  sentinel: {
    query: 'region=Sentinel&loc=Sentinel',
    shots: [
      { name: 'pool_near', pose: `(() => { const px = __currentPixel(); const bs = __wl.bodies(px).filter((b) => b.n >= 4 && b.n <= 120); const b = bs[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 14, 6, 0.3); return { px, n: b.n, t }; })()` },
      { name: 'pool_wide', pose: `(() => { const px = __currentPixel(); const bs = __wl.bodies(px).filter((b) => b.n >= 4 && b.n <= 120); const b = bs[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 34, 15, 2.5); return { px, n: b.n, t }; })()` },
      { name: 'pool_top', pose: `(() => { const px = __currentPixel(); const bs = __wl.bodies(px).filter((b) => b.n >= 4 && b.n <= 120); const b = bs[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 6, 40, 0.3); return { px, n: b.n, t }; })()` },
    ],
  },
  harbour: {
    query: 'region=Sentinel&loc=Sentinel',
    // Sentinel's coast, a pixel north of the town: the open sea Iliac Puddle No More draws, and the near sheet's coast
    jump: '[397, 342]',
    shots: [
      { name: 'coast', pose: `(() => { const per = new Map(), e = __cam(); for (const t of __findTiles([0], 400000)) per.set(t.pixel, (per.get(t.pixel) ?? 0) + 1);
        const px = [...per].sort((a, b) => b[1] - a[1])[0][0], b = __wl.bodies(px)[0], t = { ...__wl.nearest(b, e[0], e[2]) }; t.y = window.__seaY?.() ?? t.y; __wl.aim(t, 60, 22, Math.atan2(t.x - e[0], t.z - e[2])); return { px, n: b.n, t }; })()` },
      { name: 'coast_low', pose: `(() => { const per = new Map(), e = __cam(); for (const t of __findTiles([0], 400000)) per.set(t.pixel, (per.get(t.pixel) ?? 0) + 1);
        const px = [...per].sort((a, b) => b[1] - a[1])[0][0], b = __wl.bodies(px)[0], t = { ...__wl.nearest(b, e[0], e[2]) }; t.y = window.__seaY?.() ?? t.y; __wl.aim(t, 25, 6, Math.atan2(t.x - e[0], t.z - e[2]) + 0.5); return { px, n: b.n, t }; })()` },
      { name: 'coast_top', pose: `(() => { const per = new Map(), e = __cam(); for (const t of __findTiles([0], 400000)) per.set(t.pixel, (per.get(t.pixel) ?? 0) + 1);
        const px = [...per].sort((a, b) => b[1] - a[1])[0][0], b = __wl.bodies(px)[0], t = { ...__wl.nearest(b, e[0], e[2]) }; t.y = window.__seaY?.() ?? t.y; __wl.aim(t, 8, 50, Math.atan2(t.x - e[0], t.z - e[2])); return { px, n: b.n, t }; })()` },
      { name: 'coast_far', pose: `(() => { const e = __cam(); const t = { x: e[0], y: window.__seaY?.() ?? e[1], z: e[2] }; __wl.aim(t, 300, 120, 0.4); return { t }; })()` },
    ],
  },
  cyrodiil: {
    query: 'region=Daggerfall&loc=Daggerfall',
    trace: true,
    // a river of Cyrodiil inland, under 150 m across and 40 m over the sea, the nearest such to Lake Canulus outside it
    jump: `(async () => { const law = (await import('/src/world/tamriel/tamrielWaters.js')).tamrielWaters(); let best = null;
      const lake = law.lakes.find((l) => l.key === 'canulus') ?? law.lakes[0], d = (k) => Math.hypot(Math.floor(k / 65536) - lake.at[0], k % 65536 - lake.at[1]);
      const off = (k) => { const x = Math.floor(k / 65536), y = k % 65536, b = lake.box; return x < b[0] - 3 || x > b[2] + 3 || y < b[1] - 3 || y > b[3] + 3; };
      for (const [k, p] of law.pixels) if (p.width >= 30 && p.width < 150 && p.level * 1.25 > 74 && off(k) && (!best || d(k) < d(best.k))) best = { k, width: p.width };
      const px = Math.floor(best.k / 65536), py = best.k % 65536; window.__wlTarget = { px, py }; return [px, py, best.width]; })()`,
    shots: [
      { name: 'river_near', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 22, 12, 0.9); return { n: b.n, t }; })()` },
      { name: 'river_wide', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 60, 24, -0.6); return { n: b.n, t }; })()` },
      { name: 'bank_low', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; return { n: b.n, t: __wl.low(b, 10, 2.5) }; })()` },
    ],
  },
  cyrodiillake: {
    query: 'region=Daggerfall&loc=Daggerfall',
    trace: true,
    jump: `(async () => { const law = (await import('/src/world/tamriel/tamrielWaters.js')).tamrielWaters(); const l = law.lakes.reduce((a, b) => ((b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) > (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) ? b : a));
      const x = l.ring[0], y = l.ring[1]; const px = Math.floor(x), py = Math.floor(y); window.__wlTarget = { px, py, key: l.key }; return [px, py, l.key]; })()`,
    shots: [
      { name: 'shore_near', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 20, 7, 1.4); return { n: b.n, t }; })()` },
      { name: 'shore_wide', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 70, 30, 2.6); return { n: b.n, t }; })()` },
      { name: 'shore_low', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; return { n: b.n, t: __wl.low(b, 10, 2.5) }; })()` },
      { name: 'under', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx, b.cz); __wl.aim(t, 6, 0.8, 1.4); return { n: b.n, t }; })()` },
    ],
  },
  wg2: {
    query: 'region=Daggerfall&loc=Daggerfall&wg2=hammerfell-test',
    trace: true,
    // the region's largest lake (not a salt flat): the pixel holding most of its cells
    jump: `(async () => { const r = (await import('/src/world/gen2/gen2Ground.js')).gen2Regions()[0]; const L = r.fields.lake, count = new Map(), pix = new Map();
      for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) { const id = L.get(i, j); if (!id || r.header.lakes[id - 1].kind === 'playa') continue; count.set(id, (count.get(id) ?? 0) + 1);
        const k = id + ':' + Math.floor(L.x0 + (i + 0.5) / L.res) + ',' + Math.floor(L.y0 + (j + 0.5) / L.res); pix.set(k, (pix.get(k) ?? 0) + 1); }
      const id = [...count].sort((a, b) => b[1] - a[1])[0][0]; const at = [...pix].filter(([k]) => k.startsWith(id + ':')).sort((a, b) => b[1] - a[1])[0][0].split(':')[1].split(',').map(Number);
      window.__wlTarget = { px: at[0], py: at[1], id, level: r.header.lakes[id - 1].level }; return window.__wlTarget; })()`,
    shots: [
      { name: 'lake_near', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx + 400, b.cz); __wl.aim(t, 18, 6, 1.6); return { n: b.n, t }; })()` },
      { name: 'lake_wide', pose: `(() => { const { px, py } = window.__wlTarget; const b = __wl.bodies(px + ',' + py)[0]; const t = __wl.nearest(b, b.cx + 400, b.cz); __wl.aim(t, 70, 28, 2.2); return { n: b.n, t }; })()` },
      // over the lake's own surface (34 + its level, the sea's line beside it), never on its bed as lake_near is: at the
      // water tile nearest the lake's middle whose ground stands just under that surface - its shore
      { name: 'lake_low', pose: `(() => { const { px, py, level } = window.__wlTarget, y = window.__seaY() + level, b = __wl.bodies(px + ',' + py, WATERS)[0];
        const near = b.tiles.filter((u) => u.y > y - 0.6 && u.y < y), d = (u) => Math.hypot(u.x - b.cx, u.z - b.cz);
        if (!near.length) return { n: b.n, t: __wl.low(b, 10, 2.5, y) };
        const t = { ...near.reduce((a, u) => (d(u) < d(a) ? u : a)), y }; __wl.aim(t, 10, 2.5, Math.atan2(t.x - b.cx, t.z - b.cz)); return { n: b.n, t }; })()` },
    ],
  },
};

/** One scene: its boot, its jump, its shots. */
async function shootScene(name, scene) {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 600) } });
  page.on('pageerror', (e) => { faults.push(`${name}: ${e.message}`); console.log('[pageerror]', e.message); });
  page.on('console', (m) => {
    const t = m.text();
    if (/shader|compile|link|GL_INVALID|INVALID_OPERATION|water/i.test(t) && (m.type() === 'error' || m.type() === 'warning')) { faults.push(`${name}: ${t}`); console.log(`[page:${m.type()}]`, t.slice(0, 600)); }
  });
  await page.addInitScript((ui) => {
    localStorage.setItem('dagger.ui.v1', JSON.stringify(ui));
    localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
    // Basic Roads' rivers (off as the mod ships it, offline); Snowfall's deep snow off - it lies to the tiles' edge and
    // hides the shore the water draws
    localStorage.setItem('dfjs-mod-settings', JSON.stringify({ 'roads-hazelnut': { RiversAndStreams: true }, snowfall: { Enabled: false } }));
  }, UI);
  const frames = async (n) => { const f = await page.evaluate(() => window.__frame); await page.waitForFunction(([f0, k]) => window.__frame >= f0 + k, [f, n], { timeout: 900000, polling: 1000 }); };
  const idle = () => page.waitForFunction(() => !window.__streamIdle || window.__streamIdle() === true, null, { timeout: 1800000, polling: 2000 });
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/play/?${BASE}&${scene.query}`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
  console.log(name, 'ready in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await page.evaluate(() => window.__arenaCloseOverlays?.());
  await idle();
  await page.evaluate(HELPERS);
  if (scene.trace) await page.waitForFunction(async () => !!(await import('/src/world/tamriel/tamrielLand.js')).tamrielTrace(), null, { timeout: 900000, polling: 2000 });
  if (scene.jump) {
    const at = await page.evaluate(scene.jump);
    console.log(name, 'jump ->', JSON.stringify(at));
    const [px, py] = Array.isArray(at) ? at : [at.px, at.py];
    await page.evaluate(([x, y]) => { window.__tesaJump(x, y); }, [px, py]);
    await frames(2);
    // the stream re-centred within a pixel of the target (a teleport stands the player at a marker, maybe next door), its
    // ground built - the target's pixel among the built
    await page.waitForFunction(([x, y]) => { const c = window.__currentPixel?.()?.split(',').map(Number); return window.__streamIdle?.() === true && !!c && Math.max(Math.abs(c[0] - x), Math.abs(c[1] - y)) <= 1; }, [px, py], { timeout: 1800000, polling: 1000 });
    console.log(name, 'at', await page.evaluate(() => window.__currentPixel()));
    await page.evaluate(() => window.__arenaCloseOverlays?.());
  }
  await frames(4);
  for (const s of scene.shots) {
    try { console.log(name, s.name, '->', JSON.stringify(await page.evaluate(s.pose)).slice(0, 300)); } catch (e) { faults.push(`${name}/${s.name}: ${e.message}`); console.log('pose failed', s.name, e.message); continue; }
    await idle();
    await frames(4);
    const file = `${out}_${name}_${s.name}.png`;
    await page.screenshot({ path: file, timeout: 300000 });
    console.log('shot', file);
  }
  await page.close();
}

const want = process.argv.slice(3).length ? process.argv.slice(3) : ['daggerfall', 'sentinel', 'harbour', 'cyrodiil', 'cyrodiillake', 'wg2'];
const server = await createServer({ root: process.cwd(), configFile: process.cwd() + '/vite.config.js', server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const faults = [];
for (const name of want) {
  const scene = SCENES[name];
  if (!scene) { console.error('no scene', name); continue; }
  try { await shootScene(name, scene); } catch (e) { faults.push(`${name}: ${e.message}`); console.log('scene failed', name, e.message); }
}
if (faults.length) { console.error('FAIL', faults.length, 'fault(s):', faults[0].slice(0, 400)); process.exitCode = 1; }
await browser.close(); await server.close();
