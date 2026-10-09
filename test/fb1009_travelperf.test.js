// FIELD BUGS 2026-10-09 #3 and #4 (Shabalako: "The first time I open the overworld travel the game has a big freeze ...
// after traveling for a while I get low framerates"; EvoAva: "The game is starting to slow down, and especially freeze")
// - THE OVERWORLD'S COSTS, MEASURED IN THE SOURCE AND PAID.
//
// TV-BURST: the view's first frame started all twelve dungeon models' loads at once, inside its draw (OW-DUNGEONS) - now
// one a frame once the view is up, the nearest first, and a view brought down lets them go to their shelf.
// TV-PIN: their climate's pictures went up through the host's PINNED door and stayed on the GPU for the session - now
// through the place's own hold, freed with it (run here on the REAL data pipeline and renderer over a counting GL).
// TV-SNOW: Snowfall rebuilt and uploaded its tiers round a traveller under the Overworld, which draws no snow - now the
// clocks alone (the controller's own no-player law), the uploads held until the view is down.
// TV-SAVE: every save packed the whole persistent track field again (80-90 ms on this thread at its 65,536 cells, and
// online a checkpoint every two minutes) - now a field unchanged since its last record writes that record's text.
// TV-REFILL: the refill swept the window's mask and the far mask twice a second whichever tier held the track - now a
// tier with nothing in it is not swept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  startDungeonLoads, TV_DUNGEON_LOADS_PER_FRAME, TV_DUNGEON_MODELS_MAX, dungeonEntranceModel, modelFoot, owDungeonGrow,
  owDungeonDrawn, grownModelMatrix,
} from '../src/systems/travelDungeonModels.js';
import { Renderer } from '../src/render/renderer.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { remapSubMeshes } from '../src/world/texRemap.js';
import { trs } from '../src/world/mat4.js';
import { PersistentTrackField, SnowCoverage, TRACK_MAX_CELLS } from '../src/systems/snowfall.js';
import { SnowfallRuntime } from '../src/systems/snowfallRuntime.js';
import { createSnowfallHost, snowPixelBox } from '../src/scenes/snowfallHost.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const lift = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m[1]; };
const settle = (ms = 1) => new Promise((r) => setTimeout(r, ms));

// ── TV-BURST ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('TV-BURST the law: the loads a frame starts - none while the view is not fully up, then one a frame, the nearest of the set not held yet; the set itself untouched (mutants: the rising frames load; every load at once; a held one asked again; the farthest first)', () => {
  assert.equal(TV_DUNGEON_LOADS_PER_FRAME, 1);
  const list = ['a', 'b', 'c', 'd'].map((key) => ({ key }));
  const held = new Map([['a', {}]]);
  const started = [];
  const start = (g) => { started.push(g.key); held.set(g.key, {}); };
  assert.equal(startDungeonLoads(list, held, false, start), 0, 'rising (or coming down): nothing starts');
  assert.deepEqual(started, []);
  assert.equal(startDungeonLoads(list, held, true, start), 1);
  assert.deepEqual(started, ['b'], 'up: the nearest not held - the held one is never asked again');
  startDungeonLoads(list, held, true, start);
  startDungeonLoads(list, held, true, start);
  assert.deepEqual(started, ['b', 'c', 'd'], 'one a frame, in the set\'s own order (nearest first)');
  assert.equal(startDungeonLoads(list, held, true, start), 0, 'all held: nothing more');
  const two = [];
  assert.equal(startDungeonLoads(list, new Map(), true, (g) => two.push(g.key), 2), 2, 'a budget of two starts two');
  assert.deepEqual(two, ['a', 'b']);
  assert.equal(startDungeonLoads(null, held, true, start), 0, 'no set, nothing');
});

test('TV-BURST the host: the view\'s first frames - twelve dungeons about the traveller - start no load while it rises, then one a frame, every one drawn once loaded; a set that moves lets its leaver go; the view down lets them all go to their shelf (mutants: the draw\'s own loop loading; fullyUp unread; the drop left out)', () => {
  const draw = lift(/\n {2}(const _tvDngAt = \[0, 0, 0\];\n {2}function drawTvDungeonModels\(eye, up\) \{[\s\S]*?\n {2}\})\n/, 'drawTvDungeonModels');
  const drop = lift(/\n {2}(function dropTvDungeonModels\(\) \{[\s\S]*?\n {2}\})\n/, 'dropTvDungeonModels');
  const s = { list: [], loads: [], released: [], draws: 0 };
  const map = new Map();
  const d = {
    tvDungeonModelList: () => s.list, _tvDngModel: map, startDungeonLoads,
    tvDungeonModelLoad: (g) => {
      s.loads.push(g.key);
      map.set(g.key, { key: g.key, px: g.px, py: g.py, ready: true, gpu: { key: g.key }, local: trs(0, 0, 0, 0, 0, 0), box: [-2, 0, -2, 2, 8, 2], h: 8, texRemap: null, matrix: new Float32Array(16), hold: { release: () => s.released.push(g.key) } });
    },
    state: { pixelTranslation: (px, py) => [px * 1000, 0, py * 1000] }, modelFoot, owDungeonGrow, owDungeonDrawn, grownModelMatrix,
    built: new Map(), tvGroundAt: () => 0, tvGroundGenNow: () => 1, renderer: { drawMesh: () => { s.draws++; } },
  };
  const names = Object.keys(d).join(', ');
  const host = new Function('d', `const { ${names} } = d;\n${draw}\n${drop}\nreturn { drawTvDungeonModels, dropTvDungeonModels };`)(d);
  s.list = Array.from({ length: TV_DUNGEON_MODELS_MAX }, (_, i) => ({ key: `dng:${i}`, px: i, py: 0 }));
  const eye = [0, 450, 0];
  for (let f = 0; f < 30; f++) host.drawTvDungeonModels(eye, false);
  assert.deepEqual(s.loads, [], 'the view rising: not one load - the first frame started all twelve');
  for (let f = 1; f <= TV_DUNGEON_MODELS_MAX; f++) {
    host.drawTvDungeonModels(eye, true);
    assert.equal(s.loads.length, f, `frame ${f} up: ${f} started, one a frame`);
  }
  assert.deepEqual(s.loads, s.list.map((g) => g.key), 'the nearest first');
  s.draws = 0;
  host.drawTvDungeonModels(eye, true);
  assert.equal(s.loads.length, TV_DUNGEON_MODELS_MAX, 'all held: nothing more');
  assert.equal(s.draws, TV_DUNGEON_MODELS_MAX, 'and every one drawn');
  // the set moves on: the leaver let go at once, the newcomer started the next frame it is up
  s.list = [...s.list.slice(1), { key: 'dng:new', px: 40, py: 0 }];
  host.drawTvDungeonModels(eye, false);
  assert.deepEqual(s.released, ['dng:0'], 'the leaver let go, falling or not');
  assert.equal(map.has('dng:new'), false, 'the newcomer waits for the view to be up');
  host.drawTvDungeonModels(eye, true);
  assert.equal(map.has('dng:new'), true);
  // the view down: every one let go to its shelf, the map empty
  host.dropTvDungeonModels();
  assert.equal(map.size, 0);
  assert.equal(s.released.length, 1 + TV_DUNGEON_MODELS_MAX, 'each one released once');
  // the frame's own seams: the frame's fullyUp handed, and the view down drops them
  assert.match(WORLD, /\n {4}if \(tvf\) drawTvDungeonModels\(travelView\?\.eye \?\? null, tvf\.fullyUp\);[^\n]*\n {4}else if \(_tvDngModel\.size\) dropTvDungeonModels\(\);/);
  assert.match(readFileSync(new URL('../src/scenes/travelView.js', import.meta.url), 'utf8'), /blend: t, fullyUp: state === 'up', state,/, 'the view\'s frame says when it is fully up');
});

// ── TV-PIN ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A WebGL2 that answers everything and COUNTS what is alive, by kind (test/fb1004d_placelru.test.js's own). */
function countingGl() {
  const live = new Map();
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k !== 'string') return undefined;
      if (k.startsWith('create')) {
        const kind = k.slice(6);
        return () => { const o = { kind, id: ++ids }; if (!live.has(kind)) live.set(kind, new Set()); live.get(kind).add(o); return o; };
      }
      if (k.startsWith('delete')) { const kind = k.slice(6); return (o) => { if (o) live.get(kind)?.delete(o); }; }
      if (k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { gl, alive: (o) => !!o && !!live.get(o.kind)?.has(o) };
}
/** A TEXTURE file of `n` 1x1 records (test/audit68_scenes_ab's synthetic archive). */
function textureArchive(n) {
  const recPos = 26 + 20 * n, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, n, true);
  for (let i = 0; i < n; i++) v.setInt32(26 + 20 * i + 2, recPos, true);
  v.setInt16(recPos + 4, 1, true); v.setInt16(recPos + 6, 1, true);
  v.setUint32(recPos + 10, 256, true); v.setUint32(recPos + 14, RECORD_HEADER, true); v.setUint16(recPos + 20, 1, true);
  bytes[recPos + RECORD_HEADER] = 5;
  return bytes;
}

test('TV-PIN the climate\'s pictures are the dungeon\'s own: world.js\'s load over the REAL data pipeline and renderer - its model, its own picture and its climate\'s held while it stands, and once it is let go and off its shelf every one of them freed, the GL texture deleted (mutants: the pinned door handed again; the hold\'s door unasked)', async () => {
  const load = lift(/\n {2}(function tvDungeonModelLoad\(g\) \{[\s\S]*?\n {2}\})\n/, 'tvDungeonModelLoad');
  const drop = lift(/\n {2}(function dropTvDungeonModels\(\) \{[\s\S]*?\n {2}\})\n/, 'dropTvDungeonModels');
  const glc = countingGl();
  const renderer = new Renderer({ getContext: () => glc.gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const p = (x, z) => ({ x, y: 0, z, nx: 0, ny: -1, nz: 0, u: 0, v: 0 });
  const MODEL = 777001;
  const arch = {
    getRecordIndex: (id) => (id === MODEL ? id : -1),
    getMesh: () => ({ totalVertices: 3, totalTriangles: 1, subMeshes: [{ textureArchive: 120, textureRecord: 3, totalTriangles: 1, planes: [{ points: [p(0, 0), p(40, 0), p(0, 40)] }] }] }),
  };
  const palette = new DFPalette(); palette.makeGrayscale();
  const tex = textureArchive(64);
  const pipeline = createDataPipeline({ renderer, arch, palette, fetch: async (name) => (name === 'FLATS.CFG' ? new Uint8Array(0) : tex) });
  pipeline.keepPlaces('owdungeon', TV_DUNGEON_MODELS_MAX);
  const _tvDngModel = new Map();
  const d = {
    _tvDngModel, maps: { getClimateIndex: () => 0 }, blocks: {}, isEnhanced: () => true, tileSide: 6.4, season: 0,
    layoutLocation: () => ({ blocks: [{ originX: 0, originZ: 0, layout: { models: [{ modelIdNum: MODEL, matrix: trs(0, 0, 0, 0, 0, 0) }] } }] }),
    getLocationTerrainTileOrigin: () => ({ x: 0, y: 0 }), arch, dungeonEntranceModel, pipeline, cpuModels: pipeline.cpuModels,
    isClimateFreeModel: () => false, NO_CLIMATE_REMAP: new Map(), remapSubMeshes,
    applyClimate: (a) => a + 200,   // the climate's swap: 120 -> 320
    getWorldClimateSettings: () => ({ climateType: 1 }),
    transformedAabb: () => [-1, 0, -1, 1, 4, 1], archAabb: () => [-1, 0, -1, 1, 4, 1],
  };
  const names = Object.keys(d).join(', ');
  const host = new Function('d', `const { ${names} } = d;\n${load}\n${drop}\nreturn { tvDungeonModelLoad, dropTvDungeonModels };`)(d);
  host.tvDungeonModelLoad({ key: 'dng:1', px: 3, py: 4, loc: { climate: { climateType: 1 } } });
  for (let i = 0; i < 20 && !_tvDngModel.get('dng:1').ready; i++) await settle();
  const e = _tvDngModel.get('dng:1');
  assert.equal(e.ready, true, 'the model stands');
  assert.equal(e.texRemap.get('120_3'), '320_3', 'dressed in its climate');
  const own = renderer.textures.get('120_3#opaque'), swapped = renderer.textures.get('320_3#opaque');
  assert.ok(own && swapped, 'its own picture and its climate\'s are up');
  assert.ok(glc.alive(swapped));
  // the view down: the place let go to its shelf - still warm (a view raised again where it was builds nothing)
  host.dropTvDungeonModels();
  assert.equal(_tvDngModel.size, 0);
  assert.ok(renderer.textures.has('320_3#opaque'), 'kept warm on the shelf');
  // past the shelf: the place dropped - and everything it held with it
  pipeline.keepPlaces('owdungeon', 0);
  assert.equal(pipeline.gpuMeshes.has(MODEL), false, 'the model freed');
  assert.equal(renderer.textures.has('120_3#opaque'), false, 'its own picture freed');
  assert.equal(renderer.textures.has('320_3#opaque'), false, 'and its climate\'s - it was PINNED, kept for the session');
  assert.equal(glc.alive(swapped), false, 'the GL texture deleted');
  assert.equal(pipeline.placeStats().pinned.tex, 0, 'nothing of it pinned');
});

// ── TV-SNOW ────────────────────────────────────────────────────────────────────────────────────────────────────────

const SIZE = 819.2;
const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));

/** test/snowfall1_runtime.test.js's host ground: map pixels round (500, 250), flat, record 1 tiles. */
function hostGround() {
  const pixels = new Map();
  const pixel = (x, y) => { const k = `${x},${y}`; if (!pixels.has(k)) pixels.set(k, { x, y, samples: true }); return pixels.get(k); };
  const tileMap = new Uint8Array(16384).fill(1 << 2);
  return {
    size: SIZE, terrainDistance: 1,
    pixelAt: (x, z) => pixel(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    pixelsNear: (ring) => { const out = []; for (let j = -ring; j <= ring; j++) for (let k = -ring; k <= ring; k++) out.push(pixel(500 + k, 250 + j)); return out; },
    pixelOn: (x, y) => pixel(x, y),
    translation: (p, out) => { out[0] = (p.x - 500) * SIZE; out[1] = 0; out[2] = -(p.y - 250) * SIZE; return out; },
    height: () => 0, normal: (p, lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; },
    tileMap: () => tileMap, climate: () => 231, mapPixel: (p) => ({ x: p.x, y: p.y }),
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z], settlements: () => [],
  };
}

/** One host's ride: a walk in the snow, then (`overworld`) the travel view up while the traveller crosses 3 km and the
 *  weather turns from snow to clear over eight game hours, then the view down. Answers what the clocks and the GPU's
 *  share saw. */
async function ride(overworld) {
  const glc = countingGl();
  const host = createSnowfallHost({ gl: glc.gl, renderer: {}, enhanced: true, ground: hostGround(), loadMasks: async () => MASKS, loadAlbedo: async () => null });
  const st = { now: 1, sec: 3_000_000, x: 20, z: 20 };
  const frame = (o = {}) => { st.now += 1 / 60; host.frame({ now: st.now, inside: false, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false }, weather: 'snow', seconds: st.sec, winter: true, climate: 231, ...o }); };
  frame();
  await settle(10);
  for (let i = 0; i < 120; i++) { st.x += 0.08; st.sec += 2; frame(); }
  assert.ok(host.runtime && host.surface, 'the runtime and its surface stand');
  const syncs = [];
  host.surface.sync = (rt, now) => { syncs.push(now); };
  frame();
  assert.equal(syncs.length, 1, 'a frame in play hands the GPU its share');
  const window0 = [...host.runtime.local.center];
  const stale0 = host.runtime.staleCancellations;
  syncs.length = 0;
  // the travel view: 480 frames, 3 km crossed, 4 hours of snow then 4 clear
  for (let i = 0; i < 480; i++) { st.x += 6.25; st.sec += 60; frame({ overworld, weather: i < 240 ? 'snow' : 'sunny' }); }
  const under = { syncs: syncs.length, window: [...host.runtime.local.center], recentering: host.runtime.local.recentering, outrun: host.runtime.staleCancellations - stale0 };
  // the view down
  frame({ weather: 'sunny' });
  const after = { syncs: syncs.length };
  const sp = host.runtime.snowpack;
  const clocks = { wild: sp.wildernessDepth, town: sp.settlementDepth, progress: sp.phaseProgressSeconds, snowing: sp.phaseWasSnowing, observed: sp.lastObservedGameSeconds, refill: host.runtime.lastGameSeconds };
  host.dispose();
  return { under, after, clocks, window0 };
}

test('TV-SNOW under the Overworld the snow\'s tiers stand down and its uploads wait - the window neither follows the traveller nor samples, the GPU is handed nothing - while the snowpack and the refill keep the event clock frame by frame: the view down, every clock is the one a frame in play keeps (mutants: the player handed under the view; the sync unheld; the frame not run at all)', async () => {
  const play = await ride(false);
  const view = await ride(true);
  assert.ok(play.under.syncs > 400, `in play the GPU is handed its share every frame: ${play.under.syncs}`);
  assert.equal(view.under.syncs, 0, 'under the Overworld: nothing - the frame draws no snow');
  assert.equal(view.after.syncs, 1, 'the view down: the first frame hands it what waited');
  assert.ok(play.under.outrun > 20, `in play the window chases the rider, outrun and rebuilt again and again: ${play.under.outrun}`);
  assert.equal(view.under.outrun, 0, 'under the Overworld it is never begun');
  assert.deepEqual(view.under.window, view.window0, 'and stands where it stood');
  assert.equal(view.under.recentering, false, 'no window rebuilding round the traveller');
  assert.deepEqual(view.clocks, play.clocks, 'the snowpack\'s depths, its phase and the refill clock - the same as a frame in play');
  assert.ok(view.clocks.wild > 0.4, `four hours of snow raised the wild\'s depth: ${view.clocks.wild}`);
  assert.equal(view.clocks.snowing, false, 'and the clear sky is its phase now');
  // the world host hands the view's word, beside the walkers and the bodies
  assert.match(WORLD, /snowfall\.frame\(\{ now: now \/ 1000, inside: false, player: snowPlayer\(\), weather, seconds: worldMinutes\(\) \* 60, winter: season === SEASON\.Winter, climate: maps\.getClimateIndex\(_wfPx\.x, _wfPx\.y\), overworld: !!tvf, npcs: snowNpcs, corpses: snowBodies \}\);/);
  assert.ok(WORLD.indexOf('const tvf = travelView?.frame(') < WORLD.indexOf('overworld: !!tvf'), 'read after the view\'s frame');
});

// ── TV-SAVE ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The operations a field meets in play - each replayed on a fresh field, which has never packed, as the reference. */
const OPS = {
  walk: (f, x0) => { for (let x = x0; x < x0 + 40; x += 1) f.stampSegment(x, 0, x + 1, 0.3, 1.2, 0.2); },
  deeper: (f, x0) => { for (let x = x0; x < x0 + 10; x += 1) f.stampSegment(x, 0, x + 1, 0.3, 1.2, 0.05); },   // the walk's own cells, no new one
  shallower: (f, x0) => { for (let x = x0; x < x0 + 10; x += 1) f.stampSegment(x, 0, x + 1, 0.3, 1.2, 0.6); },
  refill: (f, step) => f.refill(step),
  restore: (f, rec) => f.restoreSaveData(rec),
  clear: (f) => f.clear(),
};
const field = () => new PersistentTrackField((x, z) => [x, z]);
const record = (f) => { const d = {}; f.writeSaveData(d); return { d, stats: [f.lastSaveRawBytes, f.lastSaveCompressedBytes, f.lastSaveBase64Characters] }; };

test('TV-SAVE the track field\'s record: a field unchanged since its last record is not packed again, and every record - after a walk, a deeper track, a shallower one, a refill, a cell let go, a clear, a restore of another field the same size - is character for character the record a field that never packed writes (mutants: the cache unasked; each change unmarked)', () => {
  const live = field();
  const log = [];
  let packs = 0;
  const step = (op, arg, { packs: expect }) => {
    if (op) { OPS[op](live, arg); log.push([op, arg]); }
    const got = record(live);
    const ref = field();
    for (const [o, a] of log) OPS[o](ref, a);
    const want = record(ref);
    assert.deepEqual(got.d, want.d, `after ${op ?? 'nothing'}: the record a field that never packed writes`);
    assert.deepEqual(got.stats, want.stats, `after ${op ?? 'nothing'}: and its sizes`);
    assert.deepEqual(got.stats, [live.count * 9, Buffer.from(got.d.PackedCells, 'base64').length, got.d.PackedCells.length], `after ${op ?? 'nothing'}: the sizes of the record it wrote (snow_status)`);
    packs += expect;
    assert.equal(live.packs, packs, `after ${op ?? 'nothing'}: packed ${expect ? 'again' : 'not again'}`);
    return got.d;
  };
  step(null, null, { packs: 0 });   // empty: nothing to pack
  step('walk', 0, { packs: 1 });
  step(null, null, { packs: 0 });
  step(null, null, { packs: 0 });
  const cells = live.count;
  step('deeper', 5, { packs: 1 });
  assert.equal(live.count, cells, 'deepened, not made');
  step('shallower', 5, { packs: 0 });   // less deep than what lies there: nothing changed
  step('refill', 30, { packs: 1 });
  const twin = step(null, null, { packs: 0 });
  step('refill', 200, { packs: 1 });   // the shallow cells filled and let go
  assert.ok(live.count > 0, 'the deep ones stand');
  step('walk', 100, { packs: 1 });
  step('clear', null, { packs: 0 });
  assert.equal(live._packed, null, 'the last record\'s text let go with the field');
  step('restore', twin, { packs: 1 });   // another field of the very size the cache held before the clear
  step(null, null, { packs: 0 });
});

test('TV-SAVE at the field\'s limit: past 65,536 cells the oldest go, and the record still follows - packed again only when it moved', () => {
  const live = field();
  for (let z = 0; live.count < TRACK_MAX_CELLS; z += 1) live.stampSegment(0, z, 150, z, 0.8, 0.2);
  const a = {}; live.writeSaveData(a);
  const packs = live.packs;
  const again = {}; live.writeSaveData(again);
  assert.equal(live.packs, packs, 'unchanged: not packed again');
  assert.equal(again.PackedCells, a.PackedCells);
  const evicted = live.evictedCells;
  live.stampSegment(0, 1000, 150, 1000, 0.8, 0.2);
  assert.ok(live.evictedCells > evicted && live.count === TRACK_MAX_CELLS, 'the oldest let go for the newest');
  const b = {}; live.writeSaveData(b);
  assert.equal(live.packs, packs + 1, 'moved: packed again');
  assert.notEqual(b.PackedCells, a.PackedCells);
  const ref = field(); ref.restoreSaveData(b);
  const c = {}; ref.writeSaveData(c);
  assert.equal(c.PackedCells, b.PackedCells, 'and what it wrote reads back to itself');
});

// ── TV-REFILL ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** test/snowfall1_runtime.test.js's synthetic world: map pixels round (500, 250), each a gently tilted plane. */
function syntheticWorld() {
  const tiles = new Map();
  const tileOf = (mx, my) => {
    const k = `${mx},${my}`;
    if (!tiles.has(k)) {
      const tileMap = new Uint8Array(16384);
      for (let i = 0; i < 16384; i++) tileMap[i] = (i % 11 === 0 ? 0 : 1) << 2;
      tiles.set(k, { mapX: mx, mapY: my, size: SIZE, tileMap, winterArchive: 303, stamp: 1, roads: null,
        origin: (out) => { out[0] = (mx - 500) * SIZE; out[1] = 0; out[2] = -(my - 250) * SIZE; return out; },
        height: (lx, lz) => 0.05 * lx + 0.02 * lz,
        normal: (lx, lz, out) => { const l = Math.hypot(0.05, 1, 0.02); out[0] = -0.05 / l; out[1] = 1 / l; out[2] = -0.02 / l; return out; } });
    }
    return tiles.get(k);
  };
  return {
    terrainAt: (x, z) => tileOf(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    terrainsNear: (ring) => { const out = []; for (let r = 0; r <= ring; r++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (Math.max(Math.abs(j), Math.abs(k)) === r) out.push(tileOf(500 + k, 250 + j)); return out; },
    terrainsIn: (minX, minZ, maxX, maxZ) => { const b = snowPixelBox(minX, minZ, maxX, maxZ), out = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) out.push(tileOf(x, y)); return out; },
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z],
    settlements: () => [],
    terrainDistance: 1,
  };
}

test('TV-REFILL a tier with nothing in it is not swept: the track walked and the walker gone 2 km, the field still holds it and refills it - while the clean window is neither swept nor marked for a whole upload, and the clean far mask not swept; a tier holding the track refills to whole as ever (mutants: the window swept clean; the far flag unread; a far write unflagged; the flag left up)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: new SnowCoverage(MASKS), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  const frame = (o = {}) => rt.frame({ now: st.now, inside: false, enabled: true, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false }, winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [], ...o });
  for (let i = 0; i < 400; i++) { st.now += 1 / 60; st.sec += 2; st.x += 0.08; frame(); }
  assert.ok(rt.local.hasDeformation && rt.tracks.count > 0, 'the walk pressed its track');
  assert.equal(rt.far.deformed, true, 'the far mask holds it - and says so');
  // the walker gone: 2 km east, the tiers rebuilt round them over the field's empty ground
  st.x += 2000;
  for (let i = 0; i < 600 && !(rt.local.meshReady && rt.local.staticReady && !rt.local.recentering && rt.far.center[0] > 1500); i++) { st.now += 1 / 60; st.sec += 2; frame(); }
  assert.equal(rt.local.hasDeformation, false, 'the window here is clean');
  assert.equal(rt.far.deformed, false, 'and the far mask');
  assert.ok(rt.tracks.count > 0, 'the field keeps the track it left behind');
  // a sentinel in each clean mask's red: a sweep would raise it
  rt.local.dynamic[0] = 100; rt.far.pixels[0] = 100;
  rt.rects.local.take(); rt.rects.far.take();
  const field0 = new Map([...rt.tracks.cells].map(([k, c]) => [k, c.remaining]));
  st.now += 0.6; st.sec += 3600; frame();   // one refill tick: an hour of twelve, 21 of 255
  assert.equal(rt.local.dynamic[0], 100, 'the clean window is not swept');
  assert.equal(rt.rects.local.any, false, 'nor marked for a whole upload');
  assert.equal(rt.far.pixels[0], 100, 'the clean far mask is not swept');
  const field1 = new Map([...rt.tracks.cells].map(([k, c]) => [k, c.remaining]));
  const [k0] = field1.keys();
  const step = field1.get(k0) - field0.get(k0);
  assert.ok(step >= 21, `an hour's step and the carried remainder: ${step}`);
  for (const [k, v] of field0) assert.equal(field1.get(k), v + step >= 255 ? undefined : v + step, 'the field refills by its step as ever - a full cell let go');
  rt.local.dynamic[0] = 255; rt.far.pixels[0] = 255;
  // back at the track: the tiers hold it again and refill it to whole
  st.x -= 2000;
  for (let i = 0; i < 600 && !(rt.local.meshReady && rt.local.staticReady && !rt.local.recentering && rt.far.center[0] < 500); i++) { st.now += 1 / 60; st.sec += 2; frame(); }
  assert.equal(rt.local.hasDeformation, true, 'the window laid the field\'s track again');
  assert.equal(rt.far.deformed, true, 'and the far mask');
  for (let h = 0; h < 14; h++) { st.now += 0.6; st.sec += 3600; frame(); }
  const low = (a) => { let m = 255; for (let k = 0; k < a.length; k += 4) m = Math.min(m, a[k]); return m; };
  assert.equal(low(rt.local.dynamic), 255, 'the window whole');
  assert.equal(low(rt.far.pixels), 255, 'the far mask whole');
  assert.equal(rt.tracks.count, 0, 'the field empty');
  rt._farRefill(1);
  assert.equal(rt.far.deformed, false, 'and the far mask called clean once a sweep finds nothing');
});

test('TV-REFILL the far mask\'s flag is raised by every write of its red - a stamp, a stand, a recentre\'s restore - kept through a scroll, and lowered by a clear', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: new SnowCoverage(MASKS), frameBudgetMs: Infinity });
  const F = rt.far;
  assert.equal(F.deformed, false, 'a new mask is clean');
  rt._farTick(true, 0, 0);
  assert.equal(F.ready && F.deformed, false, 'stood over an empty field: clean');
  rt._farStamp(-5, 0, 5, 0, 1.2, 0.2);
  assert.equal(F.deformed, true, 'a stamp raises it');
  rt._farTick(true, 60, 0);   // past FAR.recenter: scrolled, the track still on the mask
  assert.equal(F.deformed, true, 'kept through a scroll');
  rt.clearDynamicMask();
  assert.equal(F.deformed, false, 'a clear lowers it');
  rt.tracks.stampSegment(100, 0, 110, 0, 1.2, 0.2);   // scene metres - the field keeps them global
  rt._farTick(true, 3000, 0);   // a recentre far off: filled, then the field's track laid back
  rt._farTick(true, 100, 0);
  assert.equal(F.deformed, true, 'a recentre that lays the field\'s track raises it');
  F.ready = false;
  rt._farTick(true, 100, 0);
  assert.equal(F.deformed, true, 'and a stand that does');
});
