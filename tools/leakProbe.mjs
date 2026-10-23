// LEAK-PROBE (2026-10-23, Mac: "look for memory leaks and overall performance improvements. No band aids"): THE LEAK
// PROBE - what a long session KEEPS. bible/07-Rendering/Performance-Priority.md LEAK-PROBE. frameProbe.mjs measures one
// frame; this walks the REAL game through the action a player repeats all session - a door in, a door out - and after
// each round trip, with the collector run to the end, reads what is still alive:
//  - the JS heap after a full collection (CDP HeapProfiler.collectGarbage, then Runtime.getHeapUsage);
//  - every live WebGL object by kind (each create* counted up, each delete* down, by an init script over the context);
//  - the renderer's own texture map (`window.__renderer.textures.size`) and the DOM's nodes and listeners (CDP
//    Performance.getMetrics: Nodes, JSEventListeners);
//  - the live intervals, object URLs and observers (each start counted up, each stop down).
// A round trip through a door the session has already seen must leave every one of them where the last trip through it
// did: the first lap over the doors warms the scene cache (P1) and the decoders, the laps after it are the measure. A
// figure that climbs lap over lap is a leak, and the probe says by how much a trip.
//
// Every wait is FRAME-SYNCED on the shot-mode `__frame` counter, never a sleep (bible/Home.md). The stream's build slice
// and the grass field use frameProbe's probe-only transforms, so a scene settles in minutes.
//
// Run:  ARENA2_PATH=/path/to/arena2 node tools/leakProbe.mjs [scene]      (scene: frameProbe's SCENES, default knight)
//   DOORS=3     distinct enterable doors a lap;   LAPS=4   laps over them (the first warms)
//   STAY=20     frames inside and outside each trip;   OUT=<dir> where the record goes (default: the OS temp dir's leakProbe/)
//   SNAP=1      also write a heap snapshot after the first lap and after the last, and the constructors that grew between
//   TREE=<dir>  serve another worktree (an A/B's base);   TAG=<name> the record's name;   PORT=5243
// Like every probe that drives SwiftShader, run it alone: it takes three of a four-core machine's cores.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { SCENES, probeTransforms, waitFrames, settle, SWIFTSHADER_ARGS } from './frameProbe.mjs';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.OUT || join(tmpdir(), 'leakProbe');
const PORT = Number(process.env.PORT || 5243);
const DOORS = Number(process.env.DOORS || 3);
const LAPS = Number(process.env.LAPS || 4);
const STAY = Number(process.env.STAY || 20);
const W = Number(process.env.W || 480), H = Number(process.env.H || 270);

/** The enterable building types the other door probes use (bankProbe.mjs): a house, a shop, a tavern, a guild... */
export const ENTERABLE = Object.freeze([0, 2, 5, 6, 7, 8, 9, 12, 13, 15]);

/** The live-object ledger, installed before the page's own scripts: each kind's starts count up and its stops down, so
 *  `window.__live()` is what is alive now. Kinds a page never stops (a texture it keeps for good) read as their count;
 *  what matters is the count's movement lap over lap, not its size. */
export const LEDGER = `(() => {
  const L = window.__ledger = new Map();
  const up = (k) => L.set(k, (L.get(k) || 0) + 1);
  const down = (k) => L.set(k, (L.get(k) || 0) - 1);
  const P = WebGL2RenderingContext.prototype;
  for (const kind of ['Texture', 'Buffer', 'Framebuffer', 'Renderbuffer', 'VertexArray', 'Program', 'Shader', 'Query', 'Sampler', 'TransformFeedback']) {
    const c = P['create' + kind], d = P['delete' + kind];
    if (typeof c !== 'function' || typeof d !== 'function') continue;
    P['create' + kind] = function (...a) { const o = c.apply(this, a); if (o) up('gl.' + kind); return o; };
    P['delete' + kind] = function (o) { if (o) down('gl.' + kind); return d.call(this, o); };
  }
  const si = window.setInterval, ci = window.clearInterval, live = new Set();
  window.setInterval = function (...a) { const id = si.apply(this, a); live.add(id); return id; };
  window.clearInterval = function (id) { live.delete(id); return ci.call(this, id); };
  const cu = URL.createObjectURL, ru = URL.revokeObjectURL, urls = new Set();
  URL.createObjectURL = function (o) { const u = cu.call(URL, o); urls.add(u); return u; };
  URL.revokeObjectURL = function (u) { urls.delete(u); return ru.call(URL, u); };
  const observers = new Map();
  for (const name of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
    const O = window[name];
    if (typeof O !== 'function') continue;
    const watching = new Set();
    observers.set(name, watching);
    const ob = O.prototype.observe, dc = O.prototype.disconnect;
    O.prototype.observe = function (...a) { watching.add(this); return ob.apply(this, a); };
    O.prototype.disconnect = function () { watching.delete(this); return dc.call(this); };
  }
  window.__live = () => {
    const o = Object.fromEntries(L);
    o.intervals = live.size;
    o.objectUrls = urls.size;
    for (const [name, s] of observers) o[name] = s.size;
    o.textures = window.__renderer?.textures?.size ?? null;
    return o;
  };
})();`;

/** One reading, after the collector has run to the end: the heap, the ledger, the DOM's nodes and listeners. */
async function reading(cdp, page) {
  for (let i = 0; i < 2; i++) await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const live = await page.evaluate(() => window.__live());
  return { heapMB: +(usedSize / 1048576).toFixed(2), nodes: m.Nodes, listeners: m.JSEventListeners, ...live };
}

/** The doors a lap walks: the first DOORS whose building is enterable and whose interior MOUNTS (bankProbe's lesson -
 *  `__enter()`'s answer is not proof), each tried once now so the first lap already knows it works. */
async function pickDoors(page) {
  const doors = await page.evaluate(() => window.__doors());
  const picked = [];
  for (let i = 0; i < doors.length && picked.length < DOORS; i++) {
    const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
    if (!b || !ENTERABLE.includes(b.buildingType)) continue;
    if (await trip(page, doors[i])) picked.push(doors[i]);
  }
  return picked;
}

const ready = (page, want) => page.waitForFunction((w) => window.__mode?.() === w && window.__streamIdle?.() !== false, want, { timeout: 900000, polling: 250 });

/** One round trip: stand at the door facing it, go in, stay, come out, stay. False when the door did not open onto a
 *  mounted interior (nothing was entered, so nothing to come out of). */
async function trip(page, d) {
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [d.pos[0] + d.normal[0] * 1.5, d.pos[1] - 1.2, d.pos[2] + d.normal[2] * 1.5, Math.atan2(-d.normal[0], -d.normal[2])]);
  if (!await page.evaluate(() => window.__enter())) return false;
  try { await ready(page, 'interior'); } catch { return false; }
  if (!JSON.parse(await page.evaluate(() => window.__building()) ?? 'null')) return false;
  await waitFrames(page, STAY);
  await page.evaluate(() => window.__exit());
  await ready(page, 'exterior');
  await waitFrames(page, STAY);
  return true;
}

/** A heap snapshot to a file, streamed (a game's heap is hundreds of MB). */
async function snapshot(cdp, file) {
  const out = createWriteStream(file);
  const onChunk = ({ chunk }) => out.write(chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await new Promise((r) => out.end(r));
}

/** What grew lap over lap: each figure's growth a trip over the measured laps (all but the first), and the laps it rose
 *  in. A figure that rose in every measured lap is a leak's mark; one that settled is a cache warming. */
export function growth(laps) {
  const keys = [...new Set(laps.flatMap((l) => Object.keys(l)))].filter((k) => k !== 'lap' && typeof laps[0][k] === 'number');
  const measured = laps.slice(1);
  const rows = {};
  for (const k of keys) {
    const first = laps[0][k], last = laps.at(-1)[k];
    let rose = 0;
    for (let i = 1; i < laps.length; i++) if (laps[i][k] > laps[i - 1][k]) rose++;
    rows[k] = { afterWarm: first, last, perTrip: measured.length ? +((last - first) / (measured.length * DOORS)).toFixed(3) : 0, roseInLaps: `${rose}/${measured.length}` };
  }
  return rows;
}

async function run(scene) {
  const server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, plugins: [probeTransforms()], server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ args: SWIFTSHADER_ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(LEDGER);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}${SCENES[scene]}`);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1200000, polling: 500 });
    await settle(page);
    console.log(`  [${scene}] ready after ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');
    const start = await reading(cdp, page);
    console.log(`  start ${JSON.stringify(start)}`);
    const doors = await pickDoors(page);
    if (doors.length < DOORS) throw new Error(`leakProbe: ${doors.length} enterable doors mounted near the spawn, wanted ${DOORS}`);
    console.log(`  doors: ${doors.map((d) => `${d.block}#${d.record}`).join(', ')}`);
    const laps = [];
    mkdirSync(OUT, { recursive: true });
    const tag = scene + (process.env.TAG ? '.' + process.env.TAG : '');
    for (let lap = 0; lap < LAPS; lap++) {
      for (const d of doors) if (!await trip(page, d)) throw new Error(`leakProbe: the door ${d.block}#${d.record} stopped opening on lap ${lap}`);
      const r = { lap, ...(await reading(cdp, page)) };
      laps.push(r);
      console.log(`  lap ${lap} ${JSON.stringify(r)}`);
      if (process.env.SNAP === '1' && (lap === 0 || lap === LAPS - 1)) await snapshot(cdp, `${OUT}/${tag}.lap${lap}.heapsnapshot`);
    }
    const res = { scene, doors: doors.map((d) => `${d.block}#${d.record}`), trips: DOORS * LAPS, start, laps, growth: growth(laps), errors: errors.slice(0, 20) };
    writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(res, null, 1));
    console.log(`== ${scene}: growth a trip after the warm lap`);
    for (const [k, g] of Object.entries(res.growth)) console.log(`  ${k.padEnd(22)} ${String(g.afterWarm).padStart(10)} -> ${String(g.last).padStart(10)}  (${g.perTrip >= 0 ? '+' : ''}${g.perTrip} a trip, rose in ${g.roseInLaps} laps)`);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 5).join(' | ')}`);
    return res;
  } finally { await browser.close(); await server.close(); }
}

if (isMain(import.meta.url)) {
  const scene = process.argv[2] || 'knight';
  if (!SCENES[scene]) throw new Error(`leakProbe: name a scene of ${Object.keys(SCENES).join(', ')}`);
  await run(scene);
}
