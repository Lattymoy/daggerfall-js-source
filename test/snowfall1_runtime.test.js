// SNOWFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments seamlessly") -
// THE CONTROLLER AND ITS HOSTS. systems/snowfallRuntime.js is DynamicSnowController's frame over the port's world (the
// local window, the middle ring, the streamed blanket, the far track mask, the stamps, the refill, the snowpack's
// clock); scenes/snowfallHost.js stands it on a host's ground (the tiles, a rebuilt tile replacing its old one, the
// bodies, the save record, the console command); render/snowfallGlsl.js puts the mod's snow into the ground's own
// fragment programs. The model under all of it is pinned bit for bit in snowfall1_model.test.js; this file pins what
// the controller does with it, frame by frame, on a synthetic world (a tilted plane of 128 x 128 tiles a map pixel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SnowCoverage, SNOWFALL_BUILT_IN, roadCorners } from '../src/systems/snowfall.js';
import { SnowfallRuntime, MID, BLANKET, FAR, SNOW_GUARD_BAND, SNOW_FRAME_BUDGET_MS } from '../src/systems/snowfallRuntime.js';
import { createSnowfallHost, snowfallNetwork, settlementsIn, authoredTiles, newSnowfallSaveData, SNOWFALL_COMMAND, snowfallOn } from '../src/scenes/snowfallHost.js';
import { SNOW_VS, snowTerrainFs, SNOW_ATTR, SNOW_UNITS } from '../src/render/snowfallGlsl.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { classicShadowLane } from '../src/render/classicShadowLane.js';
import { setModSetting, modSetting } from '../src/systems/modSettings.js';
import { buildTerrainGrid, surfaceNormalAt, surfaceNormalFromSamples, gridValueAt } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';

const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SIZE = 819.2;

/** A synthetic world: map pixels round (500, 250), each a plane tilted 5 cm and 2 cm a metre, record 1 tiles (with a
 *  water tile in eleven), the scene's origin at pixel (500, 250)'s south-west corner moved by `shift`. */
function syntheticWorld() {
  const tiles = new Map();
  const shift = [0, 0];
  const tileOf = (mx, my) => {
    const k = `${mx},${my}`;
    if (!tiles.has(k)) {
      const tileMap = new Uint8Array(16384);
      for (let i = 0; i < 16384; i++) tileMap[i] = (i % 11 === 0 ? 0 : 1) << 2;
      tiles.set(k, { mapX: mx, mapY: my, size: SIZE, tileMap, winterArchive: 303, stamp: 1, roads: null,
        origin: (out) => { out[0] = (mx - 500) * SIZE + shift[0]; out[1] = 0; out[2] = -(my - 250) * SIZE + shift[1]; return out; },
        height: (lx, lz) => 0.05 * lx + 0.02 * lz,
        normal: (lx, lz, out) => { const l = Math.hypot(0.05, 1, 0.02); out[0] = -0.05 / l; out[1] = 1 / l; out[2] = -0.02 / l; return out; } });
    }
    return tiles.get(k);
  };
  const world = {
    shift,
    terrainAt: (x, z) => tileOf(500 + Math.floor((x - shift[0]) / SIZE), 250 - Math.floor((z - shift[1]) / SIZE)),
    terrainsNear: (ring) => { const out = []; for (let r = 0; r <= ring; r++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (Math.max(Math.abs(j), Math.abs(k)) === r) out.push(tileOf(500 + k, 250 + j)); return out; },
    toGlobal: (x, z) => [500 * SIZE + x - shift[0], 249 * SIZE + z - shift[1]],
    settlements: () => [],
    terrainDistance: 1,
  };
  return world;
}
const coverage = () => new SnowCoverage(MASKS);
/** Run `n` frames walking the player east at `step` a frame from (x, z); answers the last frame's tiers. */
function walk(rt, state, n, { step = 0.08, snowing = false, winter = true, npcs = () => [], inside = false } = {}) {
  let vis = null;
  for (let i = 0; i < n; i++) {
    state.now += 1 / 60; state.sec += 2; state.x += step;
    vis = rt.frame({ now: state.now, inside, enabled: true, player: inside ? null : { x: state.x, y: 0, z: state.z, grounded: true, swimming: false, levitating: false },
      winter, desert: false, snowing, gameSeconds: state.sec, npcs: npcs(state), corpses: [] });
  }
  return vis;
}

test('SNOWFALL1 the controller: a winter walk stands the local window, writes the player\'s track into it and into the world\'s field, then hands the near view to the middle ring and the distance to the blanket and the far mask - the mod\'s order (mutants: the window never ready; the handoff inverted; a stamp at every frame)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 30);
  assert.ok(rt.local.meshReady && rt.local.staticReady, 'the local window stands within half a second (its progressive budgets)');
  let vis = walk(rt, st, 370);
  assert.ok(rt.stampsWritten > 0 && rt.tracks.count > 0, 'the track is written - the window\'s mask and the persistent field');
  assert.ok(rt.mid.completed >= 1 && rt.blanket.completed >= 1, 'the middle ring and the blanket built behind it');
  assert.deepEqual(vis, { local: false, mid: true, blanket: true, far: true }, 'the ring stands for the window once it is ready, the blanket and the far mask beyond');
  assert.ok(rt.stampAttempts < 150 && rt.stampsWritten <= rt.stampAttempts, `stamps at the spacing (0.25 m at 0.08 a frame), not every frame: ${rt.stampAttempts}`);
  assert.equal(rt.local.dynamic.length, 256 * 256 * 4, 'the default mask: 256 a side');
  assert.equal(rt.gridRadius, 32 + SNOW_GUARD_BAND);
  assert.deepEqual([MID.radius, MID.visible, MID.mesh, MID.history, BLANKET.mesh, FAR.res, FAR.radius], [160, 128, 257, 641, 65, 641, 320]);
});

test('SNOWFALL1 the port\'s pace: a progressive build stops for the frame once the frame\'s snow has spent SNOW_FRAME_BUDGET_MS (2) - the window stands later, never sooner, and still stands; with the budget unbounded the mod\'s own sample counts alone (mutants: the budget never asked; the build abandoned rather than paused)', () => {
  const ready = (opts) => {
    const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), ...opts });
    const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
    let n = 0;
    while (!(rt.local.meshReady && rt.local.staticReady) && n < 3000) { walk(rt, st, 1, { step: 0 }); n++; }
    return n;
  };
  const free = ready({ frameBudgetMs: Infinity });
  let t = 0;
  const paced = ready({ frameBudgetMs: 0, clock: () => (t += 1) });   // every ask over budget: 128 samples a frame
  assert.ok(free <= 30, `the mod's own pace: ${free} frames`);
  assert.ok(paced > free * 4 && paced < 3000, `paced, it still stands: ${paced} frames against ${free}`);
  assert.equal(SNOW_FRAME_BUDGET_MS, 2);
});

test('SNOWFALL1 the eligibility: no surface stands out of winter, in the desert, indoors or with the switch off - and the snowpack keeps its clock whichever (mutants: the desert\'s test; the season\'s; the inside hiding nothing)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  assert.deepEqual(walk(rt, st, 60, { winter: false }), { local: false, mid: false, blanket: false, far: false }, 'summer: nothing');
  const s0 = rt.snowpack.wildernessDepth;
  assert.deepEqual(walk(rt, st, 60, { inside: true }), { local: false, mid: false, blanket: false, far: false }, 'inside: nothing');
  walk(rt, st, 120);
  assert.ok(rt.local.visible || rt.mid.visible, 'winter outside: the snow');
  const desert = rt.frame({ now: st.now + 1, inside: false, enabled: true, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false }, winter: true, desert: true, snowing: false, gameSeconds: st.sec + 2, npcs: [], corpses: [] });
  assert.equal(desert.local || desert.mid, false, 'the desert: nothing');
  const off = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), settings: { ...SNOWFALL_BUILT_IN, enabled: false }, frameBudgetMs: Infinity });
  assert.deepEqual(walk(off, { now: 0, sec: 1_000_000, x: 10, z: 10 }, 60), { local: false, mid: false, blanket: false, far: false }, 'the switch off: nothing');
  assert.ok(Number.isFinite(s0) && s0 > 0, 'the snowpack stands at its wild minimum from the start');
});

test('SNOWFALL1 the snowpack\'s clock: three game hours of snowfall raise the wild\'s depth one step, the melt\'s 72 clear hours lower it one - read off the frame\'s game seconds (mutants: the step; the interval)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  rt.completeSession(1_000_000, false);
  const base = rt.snowpack.wildernessDepth;
  const frame = (sec, snowing) => rt.frame({ now: sec / 1000, inside: true, enabled: true, player: null, winter: true, desert: false, snowing, gameSeconds: sec, npcs: [], corpses: [] });
  frame(1_000_000, true);
  frame(1_000_000 + 3 * 3600 + 1, true);
  assert.equal(Math.fround(rt.snowpack.wildernessDepth), Math.fround(base + 0.1), 'one step after three hours of snow');
  frame(1_000_000 + 3 * 3600 + 2, false);
  frame(1_000_000 + 3 * 3600 + 2 + 72 * 3600 + 1, false);
  assert.equal(Math.fround(rt.snowpack.wildernessDepth), Math.fround(base), 'and one down after 72 clear hours');
});

test('SNOWFALL1 the refill: a track fills back by the hours (PassiveRefillHours, 12) in the window, the ring and the far mask alike, a byte step at a time off the game seconds - and a tier stays deformed until its last track is full (mutants: a tier called whole too soon)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 400);
  assert.ok(rt.local.hasDeformation && rt.mid.hasDeformation, 'the walk pressed its track');
  const low = (a) => { let m = 255; for (let k = 0; k < a.length; k += 4) m = Math.min(m, a[k]); return m; };
  const before = low(rt.mid.history);
  const still = (hours) => {
    st.now += 0.6; st.sec += hours * 3600;
    rt.frame({ now: st.now, inside: false, enabled: true, player: { x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false }, winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [] });
  };
  still(1);
  assert.equal(low(rt.mid.history), before + 21, 'an hour of twelve: 21 of 255 back (the remainder carried)');
  assert.ok(rt.mid.hasDeformation && rt.local.hasDeformation, 'still deformed - the track is not yet full');
  for (let h = 0; h < 12; h++) still(1);
  assert.equal(low(rt.mid.history), 255, 'twelve hours: the ring whole');
  assert.equal(rt.mid.hasDeformation || rt.local.hasDeformation, false, 'and called whole once it is');
});

test('SNOWFALL1 the townsfolk and the foes: an NPC walking beside the player leaves its own track, sampled every 0.1 s; one past 320 m or off the ground leaves none (mutants: the distance\'s square; the grounded test)', () => {
  const run = (npc) => {
    const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
    walk(rt, { now: 0, sec: 1_000_000, x: 10, z: 10 }, 400, { npcs: (s) => [npc(s)] });
    return rt.npcSegmentsWritten;
  };
  assert.ok(run((s) => ({ id: 'foe', x: s.x + 3, z: s.z + 2, active: true, grounded: true, radius: 0.45, citizen: false })) > 0);
  assert.ok(run((s) => ({ id: 'citizen', x: s.x + 3, z: s.z - 2, active: true, grounded: false, radius: 0, citizen: true })) > 0, 'a citizen walks whatever its controller says');
  assert.equal(run((s) => ({ id: 'far', x: s.x + 400, z: s.z, active: true, grounded: true, radius: 0.45, citizen: false })), 0);
  assert.equal(run((s) => ({ id: 'flyer', x: s.x + 3, z: s.z, active: true, grounded: false, radius: 0.45, citizen: false })), 0);
});

test('SNOWFALL1 the floating origin and a reset: offsetOrigin moves every centre the snow keeps by the shift; worldReset stands every tier again; the save carries the field and the snowpack into a new session (mutants: a centre left behind; the reset keeping the ring; the save\'s depths)', () => {
  const world = syntheticWorld();
  const rt = new SnowfallRuntime({ world, coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 400);
  const c = [...rt.local.center], m = [...rt.mid.center], f = [...rt.far.center];
  world.shift[0] += 100; world.shift[1] -= 50;
  rt.offsetOrigin([100, 0, -50]);
  assert.deepEqual(rt.local.center, [Math.fround(c[0] + 100), Math.fround(c[1] - 50)]);
  assert.deepEqual(rt.mid.center, [Math.fround(m[0] + 100), Math.fround(m[1] - 50)]);
  assert.deepEqual(rt.far.center, [Math.fround(f[0] + 100), Math.fround(f[1] - 50)]);
  const save = rt.writeSaveData(newSnowfallSaveData());
  assert.ok(save.CellCount > 0 && save.PackedCells.length > 0);
  rt.worldReset();
  assert.equal(rt.mid.ready || rt.local.meshReady || rt.far.ready, false, 'every tier stands again');
  const again = new SnowfallRuntime({ world, coverage: coverage(), frameBudgetMs: Infinity });
  again.beginSession();
  assert.equal(again.restoreSaveData(save, 2_000_000), true);
  again.completeSession(2_000_000, false);
  assert.equal(again.tracks.count, rt.tracks.count, 'the field');
  assert.equal(again.snowpack.wildernessDepth, rt.snowpack.wildernessDepth, 'the snowpack');
});

test('SNOWFALL1 a tile built again: terrainPromoted over the window or the ring builds it again; a far tile\'s promotion leaves them (mutants: the overlap test; the window untouched)', () => {
  const world = syntheticWorld();
  const rt = new SnowfallRuntime({ world, coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 400);
  rt.terrainPromoted(world.terrainsNear(3).at(-1), st.now);
  assert.equal(rt.mid.rebuildPending, false, 'three pixels off: the ring is not touched');
  rt.terrainPromoted(world.terrainAt(st.x, st.z), st.now);
  assert.equal(rt.mid.rebuildPending, true, 'the player\'s own pixel: the ring builds again');
  assert.equal(rt.local.heightRebuild && rt.local.staticRebuild, true, 'and the window');
});

test('SNOWFALL1 the host: the masks load once, the runtime starts on the first frame after; the save record waits for it; a body is the mod\'s HandleEnemyDeath once and its hollow outlives it; a map pixel built again replaces its old tile - and snow_status answers (mutants: a body registered every frame; the replaced tile kept; the pending save lost)', async () => {
  const pixels = new Map();
  const pixel = (x, y) => { const k = `${x},${y}`; if (!pixels.has(k)) pixels.set(k, { x, y, samples: true }); return pixels.get(k); };
  const tileMap = new Uint8Array(16384).fill(1 << 2);
  const ground = {
    size: SIZE, terrainDistance: 1,
    pixelAt: (x, z) => pixel(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    pixelsNear: (ring) => { const out = []; for (let j = -ring; j <= ring; j++) for (let k = -ring; k <= ring; k++) out.push(pixel(500 + k, 250 + j)); return out; },
    translation: (p, out) => { out[0] = (p.x - 500) * SIZE; out[1] = 0; out[2] = -(p.y - 250) * SIZE; return out; },
    height: () => 0, normal: (p, lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; },
    tileMap: () => tileMap, climate: () => 231, mapPixel: (p) => ({ x: p.x, y: p.y }),
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z], settlements: () => [],
  };
  let loads = 0;
  const host = createSnowfallHost({ enhanced: true, ground, loadMasks: async () => { loads++; return MASKS; } });
  const frame = (o = {}) => host.frame({ now: o.now ?? 1, inside: false, player: { x: 20, y: 0, z: 20, grounded: true, swimming: false, levitating: false }, weather: 'snow', seconds: 3_000_000, winter: true, climate: 231, ...o });
  frame();
  assert.equal(host.runtime, null, 'the masks are a fetch away');
  await new Promise((r) => setTimeout(r, 10));
  const bodies = [{ key: 'foeCorpse:1', pos: [25, 0, 22] }];
  for (let i = 0; i < 5; i++) frame({ now: 2 + i / 60, corpses: () => bodies });
  assert.equal(loads, 1);
  assert.ok(host.runtime, 'the runtime stands');
  assert.equal(host.runtime.corpses.impressions.length, 1, 'one body, one impression - not one a frame');
  bodies.length = 0;
  frame({ now: 3, corpses: () => bodies });
  assert.equal(host.runtime.corpses.activeCount, 0, 'the body gone: its hollow refills');
  // a rebuilt pixel: a new entry on the same map pixel replaces the old tile
  const calls = [];
  const was = host.runtime.terrainPromoted.bind(host.runtime);
  host.runtime.terrainPromoted = (t, now, replaced) => { calls.push([t.mapX, t.mapY, replaced ? `${replaced.mapX},${replaced.mapY}` : null]); was(t, now, replaced); };
  const old = pixel(500, 250);
  pixels.set('500,250', { x: 500, y: 250, samples: true });
  host.promoted(pixels.get('500,250'));
  assert.deepEqual(calls, [[500, 250, '500,250']], 'the rebuilt pixel\'s new tile replaces its old one');
  host.promoted({ x: 520, y: 250, samples: true });
  assert.deepEqual(calls.at(-1), [520, 250, null], 'a pixel first built is promoted with nothing replaced');
  assert.notEqual(old, pixels.get('500,250'));
  assert.match(host.runtime.status(null), /^Dynamic Snow runtime\nactive=/);
  // a later boot's host: the one before it lets its surfaces go, and is never ticked again
  const next = createSnowfallHost({ enhanced: true, ground, loadMasks: async () => MASKS });
  const stamps = host.runtime.stampAttempts;
  frame({ now: 9, player: { x: 40, y: 0, z: 40, grounded: true, swimming: false, levitating: false } });
  assert.equal(host.runtime.stampAttempts, stamps, 'the old host does nothing once a later one stands');
  next.dispose();

  assert.deepEqual(SNOWFALL_COMMAND, { name: 'snow_status', description: 'Print Dynamic Snow stamping and mask state.', usage: 'snow_status' });
});

test('SNOWFALL1 the switch: the Features row\'s key (General.Enabled) and `?snowfall=off` both turn the snow off, read every frame (mutants: the page door ignored; the switch read once)', () => {
  const was = modSetting('snowfall', 'Enabled');
  try {
    assert.equal(snowfallOn(''), true, 'on by default');
    assert.equal(snowfallOn('?snowfall=off'), false);
    setModSetting('snowfall', 'Enabled', false);
    assert.equal(snowfallOn(''), false);
  } finally { setModSetting('snowfall', 'Enabled', was); }
});

test('SNOWFALL1 the ground\'s helpers: BasicRoadsBridge\'s network round a pixel (its bits, its corners from its neighbours), the vanilla locations on the pixels a box touches, and a location\'s authored tiles (a block that will not read refuses the pixel) (mutants: the corner\'s side; a ship counted a settlement; the block row)', () => {
  const roads = new Uint8Array(1000 * 500), tracks = new Uint8Array(1000 * 500);
  roads[10 + 20 * 1000] = 0x88; roads[9 + 20 * 1000] = 0x50; roads[11 + 20 * 1000] = 0x05; tracks[10 + 20 * 1000] = 0x22;
  assert.deepEqual(snowfallNetwork({ roads, tracks }, 10, 20), { roads: 0x88, paths: 0x22, roadCorners: roadCorners(0x50, 0x05), pathCorners: 0 });
  assert.equal(snowfallNetwork(null, 1, 1), null);
  const loc = (type, w = 2, h = 2) => ({ mapTableData: { locationType: type }, exterior: { exteriorData: { width: w, height: h, blockNames: ['A'] } } });
  const at = (x, y) => (x === 100 && y === 200 ? loc(0) : x === 101 && y === 200 ? loc(14) : x === 100 && y === 199 ? loc(5, 0, 1) : null);
  const minX = 100 * SIZE - 10, maxX = 101 * SIZE + 10, minZ = (499 - 200) * SIZE + 5, maxZ = (499 - 199) * SIZE + 10;
  const rects = settlementsIn(at, minX, minZ, maxX, maxZ);
  assert.equal(rects.length, 1, 'the town counts; your ship (14) and a location with no blocks do not');
  assert.equal(rects[0].minX, (100 * 32768 + 48 * 256) / 40, 'a 2 x 2 town\'s tiles start at 48 - its 32 tiles centred in the 128');
  assert.equal(rects[0].maxZ, ((499 - 200) * 32768 + 48 * 256 + 2 * 4096) / 40, 'two blocks of 4096 world units north');
  const ground = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 3 })));
  const blocks = { checkName: (n) => n, getBlockIndex: (n) => (n === 'MISSING' ? -1 : 0), getBlock: () => ({ rmbBlock: { fldHeader: { groundData: { groundTiles: ground } } } }) };
  const maps = { getRmbBlockName: (l, x, y) => (l.missing && x === 1 ? 'MISSING' : `B${x}${y}`) };
  const authored = authoredTiles(loc(0), maps, blocks);
  let n = 0; for (const v of authored) n += v;
  assert.equal(n, 4 * 256, 'four blocks of 256 tiles');
  assert.equal(authored[48 * 128 + 48], 1);
  assert.throws(() => authoredTiles({ ...loc(0), missing: true }, maps, blocks), /Authored block unavailable/);
});

test('SNOWFALL1 the shader: the snow program is the ground\'s own fragment program on all three lanes - its tile decode alone replaced by the mod\'s snow, its light, shadows and fog kept; the vertex law feeds what the ground\'s fragment reads; the pictures sit above every unit the world programs use (mutants: the decode span; the light dropped; a unit inside 0-15)', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const sources = [];
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, nm) => nm;
    if (k === 'shaderSource') return (_s, src) => sources.push(src);
    if (typeof k === 'string' && k.startsWith('create')) return () => ({});
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  } });
  void new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const classic = sources.find((s) => s.includes('uniform usampler2D uTilemap;') && !s.includes('elDecode('));
  assert.ok(classic, 'the classic terrain program');
  for (const [name, fs] of [['classic', classic], ['enhanced', EL_LANE.terrainFs], ['classic shadows', classicShadowLane().terrainFs]]) {
    const snow = snowTerrainFs(fs);
    const tail = fs.slice(fs.indexOf('  vec3 n = normalize(vNormal);\n'));
    assert.ok(snow.endsWith(tail), `${name}: the light after the decode is the ground's own, unchanged`);
    assert.ok(!snow.slice(snow.indexOf('void main() {')).includes('unwrapped'), `${name}: the tile decode is gone`);
    assert.match(snow, /SNOWFALL1: THE MOD'S SNOW IN PLACE OF THE TILE/);
    assert.match(snow, /in vec4 vSnow;/);
    if (fs.includes('elDecode(')) assert.match(snow, /elDecode\(texture\(uSnowAlbedo/, `${name}: the albedo decoded as the lane decodes its pictures`);
    for (const v of ['vNormal', 'vWorldPos', 'vLocalXZ']) assert.match(fs, new RegExp(`in vec[23] ${v};`), `${name} reads ${v}`);
  }
  for (const v of ['out vec3 vNormal;', 'out vec3 vWorldPos;', 'out vec2 vLocalXZ;', 'out vec4 vSnow;']) assert.ok(SNOW_VS.includes(v), v);
  assert.throws(() => snowTerrainFs('void main() { }'), /ONE span/);
  assert.deepEqual(Object.values(SNOW_ATTR), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const u of Object.values(SNOW_UNITS)) assert.ok(u >= 16 && u < 32, `unit ${u}: above the world's 0-15, under WebGL2's 32`);
});

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('SNOWFALL1 the hosts: world.js and exterior.js build the one runtime on their lane over the ground they draw, tick it indoors (the surfaces hidden, the snowpack by the event clock) and outdoors (the walkers and the bodies handed), draw it after the ground and before the sky - a later boot\'s host letting the last one\'s surfaces go; world.js tells it each pixel published and carries it across the floating origin; the interiors and the dungeons build none (THE FOUR HOSTS: their frames are the hosts\' indoor branch) (mutants: a host unwired; the draw before the ground; the promote dropped)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /const snowfall = createSnowfallHost\(\{ gl: renderer\.gl, renderer, enhanced: !!sky\.enhanced, ground: /, `${host}: built on the lane, over its ground`);
    assert.match(s, /snowfall\.frame\(\{ now: now \/ 1000, inside: true, player: null, weather, seconds: worldMinutes\(\) \* 60, winter: season === SEASON\.Winter, /, `${host}: ticked indoors`);
    assert.match(s, /snowfall\.frame\(\{ now: now \/ 1000, inside: false, player: snowPlayer\(\), weather, seconds: worldMinutes\(\) \* 60, winter: season === SEASON\.Winter, [^\n]*npcs: snowNpcs, corpses: snowBodies \}\);/, `${host}: ticked outdoors, the walkers and the bodies handed`);
    const ground = s.indexOf('renderer.drawTerrain('), draw = s.search(/^ {4}(if \(!tvf\) )?snowfall\.draw\(\);/m), sky = s.indexOf('sky.draw(', draw);
    assert.ok(ground > 0 && draw > ground && sky > draw, `${host}: the snow after the ground, before the sky`);
    const tick = s.search(/^ {4}snowfall\.frame\(\{ now: now \/ 1000, inside: false/m), begin = s.indexOf('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);');
    assert.ok(tick > 0 && begin > tick, `${host}: the snow's uploads before the world frame opens (beginFrame forgets the shadows they move)`);
    assert.match(s, /for \(const f of exteriorFoes\.foes\) if \(!f\.dead && f\.ai\?\.feet\) out\.push\(\{ id: f, [^\n]*grounded: !!f\.ai\.isGrounded, radius: BODY_CAPSULE_RADIUS, citizen: false \}\);/, `${host}: the foes`);
    assert.match(s, /for \(const seat of _livePersons\) out\.push\(\{ id: seat\.person, [^\n]*citizen: true \}\);/, `${host}: the townsfolk`);
    assert.match(s, /const snowBodies = \(\) => exteriorFoes\.physicalCorpses\(\)\.concat\(cityGuards\.physicalCorpses\(\)\);/, `${host}: the bodies`);
  }
  const w = read('src/scenes/world.js');
  assert.match(w, /snowfall\.offsetOrigin\(r\.offset\);/);
  assert.match(w, /^ {4}snowfall\.promoted\(built\.get\(key\)\);/m, 'OnPromoteTerrainData');
  assert.match(w, /if \(!tvf\) snowfall\.draw\(\);/, 'never under the travel view');
  assert.match(w, /return surfaceHeightAt\(p\.samples, lx, lz, p\._stride \?\? 1\) \+ t\[1\];/, 'the drawn ground the snow reads is the one surfaceAt answers');
  assert.match(w, /bare: \(p, lx, lz\) => !!p\.deepWaters && carvedFloorLocalY\(p\.deepWaters, lx, lz\) != null,/, 'the carved sea is bare');
  assert.match(w, /const net = raw\?\.source === 'basic-roads' \? snowfallNetwork\(raw, p\.px, p\.py\) : null;/, 'Basic Roads\' own network, or none');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /createSnowfallHost/, `${host}: none`);
});

test('SNOWFALL1 the renderer\'s snow draw: the installed set\'s snow program, the frame\'s block once a frame, the five pictures on units 16-20 through the selector, both faces over the ground by the mod\'s own 8 mm - and every state it touched handed back (cull on, the generic attributes 0,0,0,1, unit 0 selected) (mutants: the cull left off; a generic left set; the frame block every draw)', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const log = [];
  const ids = new Map();
  const glEnum = (k) => { if (!ids.has(k)) ids.set(k, 0x9000 + ids.size); return ids.get(k); };
  const stub = new Proxy({}, { get: (o, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, name) => ({ name });
    if (k === 'getAttribLocation') return () => 0;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
    if (k === 'getExtension') return () => null;
    if (k === 'drawingBufferWidth') return 320;
    if (k === 'drawingBufferHeight') return 200;
    if (typeof k === 'string' && k.toUpperCase() === k) return glEnum(k);
    return (...args) => { log.push([k, ...args]); };
  } });
  const r = new Renderer({ getContext: () => stub, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  r.beginFrame(I, I, new Float32Array([0, -1, 0]));
  log.length = 0;
  const u = { origin: [1, 2, 3], depths: [0.4, 0.2, 0.1, 0.1], limits: [0.05, 0.8, 0.4, 0.1], dynMap: [0, 0, 1, 0], dynTexel: [1, 1, 1, 1], statMap: [0, 0, 1, 0], flags: [1, 0, 0, 1], radius: [44, 0, 0.008, 4], inner: [0, 0, 0, 0], outer: [0, 0, 20, 32], boundaryFade: 0, darkening: 0.18 };
  const tex = { dynamic: { id: 'd' }, static: { id: 's' }, context: { id: 'c' }, far: { id: 'f' }, albedo: { id: 'a' } };
  r.drawSnow({ vao: { id: 'snowVao' }, indexCount: 6, generic: [[SNOW_ATTR.ctxA, [-1, 0, 0, 0]]] }, u, tex);
  r.drawSnow({ vao: { id: 'snowVao2' }, indexCount: 6 }, u, tex);
  const calls = (k) => log.filter((c) => c[0] === k);
  const proj = log.filter((c) => c[0] === 'uniformMatrix4fv' && c[1]?.name === 'uProj');
  assert.equal(proj.length, 1, 'the frame\'s block once a frame');
  assert.equal(calls('drawElements').length, 2);
  const units = calls('activeTexture').map((c) => c[1] - glEnum('TEXTURE0'));
  const from = units.indexOf(16);
  assert.deepEqual(units.slice(from, from + 6), [16, 17, 18, 19, 20, 0], 'the pictures on 16-20, unit 0 selected again');
  const binds = log.slice(log.findIndex((c) => c[0] === 'activeTexture' && c[1] === glEnum('TEXTURE0') + 16)).filter((c) => c[0] === 'bindTexture').slice(0, 5).map((c) => c[2].id);
  assert.deepEqual(binds, ['d', 's', 'c', 'f', 'a'], 'dynamic, static, context, far, albedo');
  const order = log.map((c) => c[0] === 'enable' || c[0] === 'disable' ? `${c[0]}:${[...ids].find(([, v]) => v === c[1])?.[0]}` : c[0] === 'polygonOffset' ? `offset:${c[1]},${c[2]}` : c[0] === 'drawElements' ? 'draw' : null).filter(Boolean);
  assert.deepEqual(order.slice(0, 3), ['disable:CULL_FACE', 'draw', 'enable:CULL_FACE'], 'both faces, the cull handed back - and no window-depth layer of its own');
  const generic = calls('vertexAttrib4f');
  assert.deepEqual(generic.map((c) => c.slice(1)), [[SNOW_ATTR.ctxA, -1, 0, 0, 0], [SNOW_ATTR.ctxA, 0, 0, 0, 1]], 'the local window\'s Excluded context, and 0,0,0,1 again after it');
  const model = log.filter((c) => c[0] === 'uniformMatrix4fv' && c[1]?.name === 'uModel').at(-1)[3];
  assert.deepEqual([...model.slice(12, 15)], [1, 2, 3], 'the tier\'s origin');
});

test('SNOWFALL1 the ground the snow reads: a pixel\'s normal from its samples alone is the drawn grid\'s (buildTerrainGrid\'s vertex normals at its stride, on surfaceHeightAt\'s triangle) - the grass\'s own normals where it keeps them; a grid\'s value (the bed\'s depth) on the same triangle (mutants: the difference\'s sign; the stride\'s span; the diagonal)', () => {
  const H = HEIGHTMAP_DIMENSION;
  let seed = 3;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const samples = Float32Array.from({ length: H * H }, (_, i) => 0.1 + 0.05 * Math.sin(i * 0.37) + 0.02 * rnd());
  const grid = buildTerrainGrid(samples, 1);
  for (let k = 0; k < 200; k++) {
    const lx = 6.4 + rnd() * 800, lz = 6.4 + rnd() * 800;
    const a = surfaceNormalFromSamples(samples, lx, lz, 1, [0, 0, 0]), b = surfaceNormalAt(grid.normals, lx, lz, [0, 0, 0]);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(a[c] - b[c]) < 1e-6, `${lx},${lz}: ${a} vs ${b}`);
  }
  const g4 = buildTerrainGrid(samples, 4), gx = 128 / 4 + 1;
  for (const [xi, zi] of [[3, 5], [10, 20], [31, 1]]) {
    const n = surfaceNormalFromSamples(samples, xi * 25.6, zi * 25.6, 4, [0, 0, 0]);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(n[c] - g4.normals[(zi * gx + xi) * 3 + c]) < 1e-6, `stride 4 vertex ${xi},${zi}`);
  }
  // the grid's value on the drawn triangle: a plane's own value back, and the diagonal's halves
  const plane = Float32Array.from({ length: 33 * 33 }, (_, i) => 2 * (i % 33) + 3 * Math.floor(i / 33));
  assert.ok(Math.abs(gridValueAt(plane, 33, 33, 25.6, 100, 200) - (2 * 100 / 25.6 + 3 * 200 / 25.6)) < 1e-9);
  const bump = new Float32Array(4); bump[3] = 1;   // one quad, its (1,1) corner raised
  assert.equal(gridValueAt(bump, 2, 2, 1, 0.75, 0.25), 0.25, 'below the diagonal: the (1,0) half');
  assert.equal(gridValueAt(bump, 2, 2, 1, 0.25, 0.75), 0.25, 'above it: the (0,1) half');
});
