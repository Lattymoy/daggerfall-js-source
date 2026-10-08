// AUDIT ENVIRONS (2026-10-08, Mac: "Lets do a comprehensive audit on everything and ensure perfection and performance
// doesnt take a hit") - THE FOUR ENVIRONMENT MODS AUDITED: Snowfall, Windfall, Heat Haze and Sands of the Alik'r, each
// lens reading the port against the mods' own assemblies and shaders (bible/01-Overview/Audit-Environs.md). Every fix
// here carries its `AUDIT ENVIRONS <id>` in the code and is mutated in tools/mutants/audit_environs.json; the pins it
// moved in the arcs' own files say so where they stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SnowCoverage, SNOWFALL_BUILT_IN, SNOWFALL_VENDOR } from '../src/systems/snowfall.js';
import { SnowfallRuntime, SnowContext, BLANKET } from '../src/systems/snowfallRuntime.js';
import { createSnowfallHost, snowPixelBox, newSnowfallSaveData } from '../src/scenes/snowfallHost.js';
import { SnowfallSurface } from '../src/render/snowfallSurface.js';
import { restoreModSaveRecords } from '../src/systems/modSaveData.js';
import { createWindfall, WINDFALL_BUILT_IN } from '../src/systems/windfall.js';
import { createWindfallEffects } from '../src/systems/windfallEffects.js';
import { WindfallParticles } from '../src/render/windfallParticles.js';
import { windfallAnchorAfterShift } from '../src/render/windfallSway.js';
import { createWindfallHost } from '../src/scenes/windfallHost.js';
import { createHeatHaze, hazeFrameSettings, HAZE_OFF, HEAT_HAZE_VENDOR } from '../src/systems/heatHaze.js';
import { hazePhase } from '../src/render/heatHaze.js';
import { ShadowPass } from '../src/render/shadowPass.js';
import { setModSetting, modSetting } from '../src/systems/modSettings.js';
import { SEASONS } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SIZE = 819.2;
const coverage = () => new SnowCoverage(MASKS);
const seeded = (s = 7) => () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

/** A synthetic world round pixel (500, 250): flat tiles of record 1, loaded `ring` pixels about the player's (a far
 *  tile's own roads where `roads` says), and `replace(x, y)` building a pixel's tile again (a new object, its stamp on). */
function syntheticWorld({ ring = 4, roads = new Map() } = {}) {
  const tiles = new Map();
  const make = (mx, my, stamp = 1) => {
    const tileMap = new Uint8Array(16384).fill(1 << 2);
    return { mapX: mx, mapY: my, size: SIZE, tileMap, winterArchive: 303, stamp, roads: roads.get(`${mx},${my}`) ?? null,
      origin: (out) => { out[0] = (mx - 500) * SIZE; out[1] = 0; out[2] = -(my - 250) * SIZE; return out; },
      height: () => 0, normal: (lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; } };
  };
  const tileOf = (mx, my) => { const k = `${mx},${my}`; if (!tiles.has(k)) tiles.set(k, make(mx, my)); return tiles.get(k); };
  const loaded = (mx, my) => Math.max(Math.abs(mx - 500), Math.abs(my - 250)) <= ring;
  return {
    tileOf,
    replace: (mx, my) => { const old = tileOf(mx, my); const t = make(mx, my, old.stamp + 1); tiles.set(`${mx},${my}`, t); return [t, old]; },
    terrainAt: (x, z) => tileOf(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    terrainsNear: (r) => { const out = []; for (let d = 0; d <= Math.min(r, ring); d++) for (let j = -d; j <= d; j++) for (let k = -d; k <= d; k++) if (Math.max(Math.abs(j), Math.abs(k)) === d) out.push(tileOf(500 + k, 250 + j)); return out; },
    terrainsIn: (minX, minZ, maxX, maxZ) => { const b = snowPixelBox(minX, minZ, maxX, maxZ), out = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (loaded(x, y)) out.push(tileOf(x, y)); return out; },
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z],
    settlements: () => [],
    terrainDistance: 3,
  };
}
const playerAt = (x, z) => ({ x, y: 0, z, grounded: true, swimming: false, levitating: false });
function frameOf(st, o = {}) {
  return { now: st.now, inside: false, enabled: true, player: playerAt(st.x, st.z), winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [], ...o };
}
function walk(rt, st, n, { step = 0.08, npcs = null, ...o } = {}) {
  let vis = null;
  for (let i = 0; i < n; i++) { st.now += 1 / 60; st.sec += 2; st.x += step; vis = rt.frame(frameOf(st, { ...o, npcs: npcs ? npcs(st) : [] })); }
  return vis;
}

test('AUDIT ENVIRONS S1: SnowContextData.Prepare reads the roads of the map pixels ITS box touches - a blanket tile four pixels out finds its own Basic Roads tiles, not the player\'s ring-2 neighbourhood (mutants: the box\'s scan back to the player\'s rings)', () => {
  const far = { pathTiles: 12, roadTiles: 0 };
  const world = syntheticWorld({ ring: 4, roads: new Map([['504,250', far]]) });
  const ctx = new SnowContext(world, coverage());
  const t = world.tileOf(504, 250), og = t.origin([0, 0, 0]);
  const s = { ...SNOWFALL_BUILT_IN, basicRoadsIntegration: true };
  ctx.prepare(og[0] + SIZE / 2, og[2] + SIZE / 2, SIZE / 2, s.settlementBoundaryFeather, s.locationLoaderBoundaryFeather, s);
  assert.deepEqual(ctx.roads.map((r) => [r.mapX, r.mapY]), [[504, 250]], 'its own tile, four pixels from the player');
  assert.equal(ctx.roads[0].data, far);
  assert.ok(Math.abs(ctx.roads[0].x - 504 * SIZE) < 1e-6, 'at its own global place');
  // the box's map pixels, rows north to south as MapsFile counts them
  const b = snowPixelBox(503 * SIZE + 1, 248 * SIZE + 1, 505 * SIZE - 1, 250 * SIZE - 1);
  assert.deepEqual(b, { x0: 503, x1: 504, y0: 250, y1: 251 }, 'global z 248-250 pixels north of the map\'s south edge: rows 251 and 250');
  assert.match(read('src/systems/snowfallRuntime.js'), /for \(const t of this\.world\.terrainsIn\(minGX, minGZ, maxGX, maxGZ\)\) \{/);
});

test('AUDIT ENVIRONS S3 + S8: a Surface setting that rebuilds the window on a frame leaves that frame on the NEW window - nothing stamped against its unset centre - and the rebuild zeroes the refill\'s remainder; CompleteSession\'s refill clock ticks half a second on, on the weather it is told (mutants: the frame kept on the old window; the remainder kept; the clock at once)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: -30, z: 10 };   // the walk ends by the scene's origin, where a stale centre would land
  walk(rt, st, 400, { npcs: (s) => [{ id: 'foe', x: s.x + 3, z: s.z + 2, active: true, grounded: true, radius: 0.45, citizen: false }] });
  assert.ok(rt.local.meshReady && rt.local.hasDeformation, 'the window stands, a track in it');
  rt.local.resourceRebuild = true;   // ApplySettings: SnowRadius, MeshResolution or MaskResolution changed
  const stamps = rt.stampAttempts, npcSegs = rt.npcSegmentsWritten;
  st.now += 0.5; st.x += 0.6; st.sec += 2;
  rt.frame(frameOf(st, { npcs: [{ id: 'foe', x: st.x + 3, z: st.z + 2, active: true, grounded: true, radius: 0.45, citizen: false }] }));
  assert.equal(rt.local.hasCenter, true, 'the new window takes its centre on that frame (Update\'s `if (!hasWindowCenter)`)');
  assert.equal(rt.local.hasDeformation, false, 'the new window holds no track');
  assert.ok(rt.local.dynamic.every((v, i) => i % 4 !== 0 || v === 255), 'its mask is whole snow - no walker written against its unset centre');
  assert.equal(rt.local.pending.length, 0, 'nor queued against it');
  assert.equal(rt.stampAttempts, stamps, 'no stamp tried against the new window before it stands');
  assert.equal(rt.npcSegmentsWritten, npcSegs, 'nor a walker\'s');
  rt.refillRemainder = 0.75;
  rt._rebuildGrid();
  assert.equal(rt.refillRemainder, 0, 'CreateGridResources zeroes the remainder');
  rt.completeSession(2_000_000, true, 40);
  assert.equal(rt.nextRefillTime, 40.5, 'ResetRefillClock: half a second on');
  assert.equal(rt.isSnowing, true, 'the weather it was told (WeatherManager.IsSnowing)');
});

test('AUDIT ENVIRONS S4 + S7: the blanket queues every visible tile again when it stands again (SetActive), so a tile rebuilt while it was off is built; and it builds no tile past the rings it draws (mutants: the reactivation\'s requeue; the live test)', () => {
  const world = syntheticWorld({ ring: 5 });
  const rt = new SnowfallRuntime({ world, coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 900, { step: 0 });
  assert.ok(rt.blanket.completed >= 9, `the rings drawn built: ${rt.blanket.completed}`);
  // off: the player indoors; a neighbour rebuilt meanwhile; on again in the same pixel
  walk(rt, st, 5, { step: 0, inside: true, player: null });
  assert.equal(rt.blanket.active, false);
  const [fresh, old] = world.replace(501, 250);
  rt.terrainPromoted(fresh, st.now, old);
  walk(rt, st, 300, { step: 0 });
  assert.ok(rt.blanket.overlays.get(fresh)?.ready, 'the tile rebuilt while the blanket was off is built once it stands again');
  // a tile five rings out, promoted: queued, never built (the blanket draws min(4, TerrainDistance) rings)
  const outer = world.tileOf(505, 250);
  const built = rt.blanket.completed;
  rt.terrainPromoted(outer, st.now, null);
  walk(rt, st, 120, { step: 0 });
  assert.equal(rt.blanket.overlays.has(outer), false, 'no overlay for a tile the blanket never draws');
  assert.equal(rt.blanket.completed, built, 'and no build spent on it');
  assert.equal(BLANKET.mesh, 65);
});

/** A host's ground over the synthetic plane: `stamps` moves a pixel's stamp (a rebuilt TileMap or stride), `lift` the
 *  player's pixel's ground. */
function hostGround() {
  const pixels = new Map(), stamps = new Map();
  let lift = 0;
  const pixel = (x, y) => { const k = `${x},${y}`; if (!pixels.has(k)) pixels.set(k, { x, y }); return pixels.get(k); };
  const tileMap = new Uint8Array(16384).fill(1 << 2);
  return {
    stamps, setLift: (v) => { lift = v; },
    size: SIZE, terrainDistance: 1,
    pixelAt: (x, z) => pixel(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    pixelOn: (x, y) => pixel(x, y),
    pixelsNear: (ring) => { const out = []; for (let j = -ring; j <= ring; j++) for (let k = -ring; k <= ring; k++) out.push(pixel(500 + k, 250 + j)); return out; },
    translation: (p, out) => { out[0] = (p.x - 500) * SIZE; out[1] = 0; out[2] = -(p.y - 250) * SIZE; return out; },
    height: (p) => (p.x === 500 && p.y === 250 ? lift : 0), normal: (p, lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; },
    tileMap: () => tileMap, climate: () => 231, mapPixel: (p) => ({ x: p.x, y: p.y }),
    stamp: (p) => stamps.get(`${p.x},${p.y}`) ?? 0,
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z], settlements: () => [],
  };
}
async function standingHost(ground, opts = {}, at = [20, 20]) {
  const host = createSnowfallHost({ enhanced: true, ground, loadMasks: async () => MASKS, ...opts });
  const st = { now: 1, sec: 3_000_000, x: at[0], z: at[1] };
  const frame = (o = {}) => host.frame({ now: st.now, inside: false, player: playerAt(st.x, st.z), weather: 'sunny', seconds: st.sec, winter: true, climate: 231, ...o });
  frame();
  await new Promise((r) => setTimeout(r, 10));
  frame();
  host.runtime.frameBudgetMs = Infinity;
  for (let i = 0; i < 400; i++) { st.now += 1 / 60; st.sec += 1; st.x += 0.08; frame(); }
  return { host, st, frame };
}

test('AUDIT ENVIRONS S2: a load completes its session on the LOADED game\'s clock - RestoreTrackData at the clock\'s nought, CompleteSession on the next frame - so a save half a day later than the game it replaces keeps its tracks and its snowpack (mutants: CompleteSession on the last frame\'s clock; the restore anchored on it)', async () => {
  // the record: a walk's persistent cells
  const src = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  walk(src, { now: 0, sec: 1_000_000, x: 10, z: 10 }, 400);
  const save = src.writeSaveData(newSnowfallSaveData());
  assert.ok(save.CellCount > 0);
  const { host, st, frame } = await standingHost(hostGround());
  restoreModSaveRecords({ [SNOWFALL_VENDOR]: save });   // dungeonContext.js: the records before the save's clock, no frame between
  const cells = host.runtime.tracks.count, depth = host.runtime.snowpack.wildernessDepth;
  assert.equal(cells, src.tracks.count, 'the record restored');
  st.sec += 13 * 3600;   // the loaded game, thirteen hours past the one it replaced (PassiveRefillHours: 12)
  for (let i = 0; i < 120; i++) { st.now += 1 / 30; st.sec += 1; frame(); }
  assert.equal(host.runtime.tracks.count, cells, 'its tracks stand - the refill\'s clock started at the load');
  assert.equal(host.runtime.snowpack.wildernessDepth, depth, 'and the snowpack did not run the gap');
  assert.match(read('src/scenes/snowfallHost.js'), /if \(!runtime\.restoreSaveData\(d, 0\)\)/);
});

test('AUDIT ENVIRONS S5: a tile\'s ground rebuilt as a build reads it is heard when the runtime\'s frame is done (OnPromoteTerrainData is the streaming world\'s, never the frame\'s) - the window builds again on the new ground, not committed on the old (mutants: the promotion delivered inside the build)', async () => {
  const ground = hostGround();
  const { host, st, frame } = await standingHost(ground, {}, [200, 200]);   // the window inside one map pixel
  const L0 = host.runtime.local;
  assert.ok(L0.meshReady && L0.staticReady && !L0.heightRebuild, 'the window stands');
  ground.stamps.set('500,250', 1); ground.setLift(-1);   // a cap's TileMap landed: the player's pixel carved a metre down
  st.now += 1 / 60; st.x += 12;   // and the frame that reads it crosses the recentre distance
  frame();
  assert.equal(host.runtime.local.heightRebuild, true, 'the window builds again on the ground that stands');
  for (let i = 0; i < 120; i++) { st.now += 1 / 60; frame(); }
  const L = host.runtime.local;
  let high = -Infinity;
  for (let k = 1; k < L.pos.length; k += 3) high = Math.max(high, L.pos[k]);
  assert.ok(high < -0.5, `the whole window stands on the carved ground (none kept from the old): its highest vertex ${high}`);
});

test('AUDIT ENVIRONS S6: snow_status is GetRuntimeStatus line for line - its lines in its order, C#\'s booleans, the NotGrounded line, the terrain, the lighting and Basic Roads\' word (mutants: a line dropped; a JS boolean)', () => {
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 200);
  const f = frameOf(st, { player: { ...playerAt(st.x, st.z), grounded: false } });
  f.rawPlayer = f.player;
  rt.frame(f);
  const s = rt.status(f, { climate: 231, ambient: [0.25, 0.5, 0.75], surface: true, uploads: 9, roads: 'ready' });
  const keys = s.split('\n').map((l) => l.match(/^[a-zA-Z ]+[=(]?/)[0]);
  assert.deepEqual(keys, ['Dynamic Snow runtime', 'active=', 'playerGrounded=', 'stampAttempts=', 'maskMinimum=', 'localBuild=', 'terrain=', 'lighting=', 'npcTargets=',
    'persistentTrackCells=', 'savePayload=', 'farTracks=', 'midDetail=', 'streamedBlanket=', 'localVertices=', 'snowpack=', 'context=', 'lastStamp=', 'corpses active=', 'basicRoads=']);
  assert.match(s, /^active=True exterior=True meshReady=True staticReady=True$/m);
  assert.match(s, /^playerGrounded=False controllerGrounded=False swimming=False levitating=False$/m);
  assert.match(s, /^terrain=climateIndex=231 climateType=Temperate season=\w+ expectedArchive=30[23] bundledWinterArchives=103,303,403$/m);
  assert.match(s, /^lighting=ambient\(0\.250,0\.500,0\.750\) probes=Off$/m);
  assert.match(s, /^lastStamp=rejected: grounded=False, controllerGrounded=False, swimming=False, levitating=False$/m);
  assert.match(s, /^localVertices=25921 localMaskUploads=9$/m);
  assert.match(s, /history=(True|False)px=\d+ pending=\d+ vertices=66049/, 'the ring\'s line as C# runs its words together');
  assert.match(s, /^basicRoads=ready pathWeight=0\.00 pathCap=\d\.\d\dm bermWeight=0\.00 contextDepth=\d\.\d{3}m \(before coverage\/tracks\)$/m);
});

test('AUDIT ENVIRONS G1 + G3 + G4: the snow\'s GL owes the renderer its seam before its first bind - the 2D run closed and every shadow forgotten, so the HUD\'s vertex array never takes the blanket\'s index buffer; the albedo decoded bottom row first (an ImageBitmap takes no UNPACK_FLIP_Y_WEBGL) and read at its nearest level (Point) (mutants: the seam dropped; the flip back on the upload; the levels blended)', () => {
  const log = [];
  const gl = new Proxy({}, { get: (_, k) => {
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (typeof k === 'string' && k.toUpperCase() === k) return k;
    return (...a) => { log.push([k, ...a]); };
  } });
  const renderer = { endUiRun: () => log.push(['endUiRun']), markForeignPass: () => log.push(['markForeignPass']) };
  const surface = new SnowfallSurface(gl, renderer);
  log.length = 0;
  const rt = new SnowfallRuntime({ world: syntheticWorld(), coverage: coverage(), frameBudgetMs: Infinity });
  walk(rt, { now: 0, sec: 1_000_000, x: 10, z: 10 }, 900, { step: 0 });
  assert.ok(rt.dirty.blanket.size > 0, 'a blanket tile to upload');
  surface.sync(rt, 1);
  assert.deepEqual(log.slice(0, 2).map((c) => c[0]), ['endUiRun', 'markForeignPass'], 'the seam first');
  const firstIndex = log.findIndex((c) => c[0] === 'bindBuffer' && c[1] === 'ELEMENT_ARRAY_BUFFER');
  assert.ok(firstIndex > 1, 'the index buffers bound after it');
  log.length = 0;
  surface.setAlbedo({ width: 64, height: 64 });
  assert.equal(log[0]?.[0], 'endUiRun');
  assert.ok(!log.some((c) => c[0] === 'pixelStorei' && c[1] === 'UNPACK_FLIP_Y_WEBGL' && c[2] === true), 'no flip asked of an ImageBitmap');
  assert.ok(log.some((c) => c[0] === 'texParameteri' && c[2] === 'TEXTURE_MIN_FILTER' && c[3] === 'NEAREST_MIPMAP_NEAREST'), 'FilterMode.Point: the nearest level');
  assert.match(read('src/scenes/snowfallHost.js'), /createImageBitmap\(await r\.blob\(\), \{ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' \}\)/);
});

test('AUDIT ENVIRONS G6: the blanket\'s tiles are culled to the frame\'s frustum by their bounds - the ground\'s span and the deepest snow over it - as each tile\'s renderer is culled in the mod (mutants: the cull ignored; the bounds without the snow; the span unread)', () => {
  const gl = new Proxy({}, { get: (_, k) => {
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  } });
  const blanketDraws = [];
  const renderer = { endUiRun() {}, markForeignPass() {}, drawSnow: (_m, u) => { if (u.flags[1] === 1) blanketDraws.push(u.origin.slice()); } };
  const surface = new SnowfallSurface(gl, renderer);
  surface.setAlbedo({ width: 64, height: 64 });
  const rt = new SnowfallRuntime({ world: syntheticWorld({ ring: 1 }), coverage: coverage(), frameBudgetMs: Infinity });
  walk(rt, { now: 0, sec: 1_000_000, x: 10, z: 10 }, 900, { step: 0 });
  surface.sync(rt, 1);
  surface.draw(rt);
  const all = blanketDraws.length;
  assert.equal(all, 9, 'every tile of the drawn rings, with no frustum');
  blanketDraws.length = 0;
  const boxes = [];
  surface.draw(rt, (box, x, y, z) => { boxes.push([...box, x, y, z]); return x > 0; });   // the tiles east of the scene's origin out of view
  assert.equal(blanketDraws.length, 6, 'the three east of the origin culled');
  assert.ok(blanketDraws.every((o) => o[0] <= 0));
  const [minX, minY, minZ, maxX, maxY, maxZ] = boxes[0];
  assert.deepEqual([minX, minZ, maxX, maxZ], [0, 0, SIZE, SIZE].map(Math.fround), 'the tile, local to its origin');
  assert.equal(minY, 0, 'the ground\'s lowest');
  assert.ok(maxY >= rt.snowpack.wildernessDepth + 0.008 - 1e-6 && maxY >= SNOWFALL_BUILT_IN.wildernessMaximumDepth, `its highest with the deepest snow over it: ${maxY}`);
});

test('AUDIT ENVIRONS I5: the snow and the wind cost themselves, never the frame - a program that will not build leaves the snow undrawn, a draw or a frame that throws lets it go once; the snow\'s program is built with its surface, not inside the first snowy frame (mutants: the draw unguarded; the frame unguarded; the build at the draw)', async () => {
  const gl = new Proxy({}, { get: (_, k) => {
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  } });
  let prepared = 0;
  const renderer = { prepareTerrainSnow: () => { prepared++; }, endUiRun() {}, markForeignPass() {}, drawSnow: () => { throw new Error('link failed'); } };
  await quiet(async () => {
    const { host } = await standingHost(hostGround(), { gl, renderer, loadAlbedo: async () => ({ width: 64, height: 64 }) });
    assert.equal(prepared, 1, 'the program built beside the surface');
    assert.ok(host.surface, 'the surface stands');
    assert.equal(host.draw(), false, 'the draw that threw answers nothing drawn');
    assert.equal(host.surface, null, 'and its surface is let go');
    assert.equal(host.draw(), false);
    const rt = host.runtime;
    let ticks = 0;
    rt.frame = () => { ticks++; throw new Error('a bug'); };
    assert.doesNotThrow(() => host.frame({ now: 50, inside: false, player: playerAt(30, 30), weather: 'sunny', seconds: 3_100_000, winter: true, climate: 231 }));
    host.frame({ now: 51, inside: false, player: playerAt(30, 30), weather: 'sunny', seconds: 3_100_001, winter: true, climate: 231 });
    assert.equal(ticks, 1, 'the snow stops at the frame that threw');
    // a program the driver will not build: the snow kept, never drawn
    const bad = { ...renderer, prepareTerrainSnow: () => { throw new Error('link failed'); } };
    const { host: h2 } = await standingHost(hostGround(), { gl, renderer: bad, loadAlbedo: async () => ({ width: 64, height: 64 }) });
    assert.ok(h2.runtime && h2.surface === null, 'the runtime stands, no surface');
    assert.equal(h2.draw(), false);
  });
  const wind = createWindfallHost({ enhanced: true, engine: { source: () => ({ volume: 1, pitch: 1, isPlaying: false, playOneShot() {}, stop() {}, dispose() {} }), registerSound: async () => true }, picture: async () => null });
  let ticks = 0;
  wind.model.tick = () => { ticks++; throw new Error('a bug'); };
  const f = { dt: 0.02, outside: true, weather: 'sunny', minutes: 523530, climate: 231, mapPixel: { x: 100, y: 200 }, heading: [1, 0], feet: [0, 0, 0], height: 1.8 };
  await quiet(() => { assert.equal(wind.frame(f), null); assert.equal(wind.frame(f), null); });
  assert.equal(ticks, 1, 'the wind stops at the frame that threw');
  assert.match(read('src/render/renderer.js'), /prepareTerrainSnow\(\) \{ this\._ensureTerrainSnow\(\); \}/);
});

test('AUDIT ENVIRONS I2 + I7: a teleport\'s new frame carries the snow, the wind and the haze by its move (state.init\'s initOffset) as a recentre carries them - the old place\'s tracks stay on the old place, the arrival\'s first stamp no trench - and the haze\'s layer held while airborne rides a recentre\'s height (mutants: the snow left in the old frame; the layer left behind)', () => {
  const world = syntheticWorld();
  const rt = new SnowfallRuntime({ world, coverage: coverage(), frameBudgetMs: Infinity });
  const st = { now: 0, sec: 1_000_000, x: 10, z: 10 };
  walk(rt, st, 400);
  const writes = rt.tracks.count;
  // the arrival 30 m off in the new frame, the old place 32 km away in it
  rt.offsetOrigin([-32768, 0, 0]);
  st.x += 30; walk(rt, st, 1, { step: 0 });
  assert.match(rt.lastStampStatus, /^rejected teleport-sized segment: 327\d\d\.\d\dm$/, 'the departure\'s last stamp is 32 km behind: no trench to the arrival');
  assert.equal(rt.tracks.count, writes, 'no phantom cells at the arrival');
  const w = read('src/scenes/world.js');
  const at = w.indexOf('    csaReanchor(state.initOffset);   // FIELD-CSA1');
  const block = w.slice(at, w.indexOf('\n    _streamSince = null;', at));
  for (const line of ['snowfall.offsetOrigin(state.initOffset);', 'windfall.offsetOrigin(state.initOffset);', 'hazeGl?.offsetOrigin(state.initOffset);', 'heatHaze.reset();']) assert.ok(block.includes(line), `the re-anchor: ${line}`);
  // the haze's layer: taken grounded, held airborne, carried by a recentre's height
  const h = createHeatHaze();
  const noon = { exterior: true, climate: 224, weather: 'sunny', minuteOfDay: 720, settings: { ...HAZE_OFF, enabled: true, intensity: 1.5 } };
  h.tick({ ...noon, dt: 0.1, foot: [0, 10, 0], grounded: true });
  h.offsetOrigin([0, -500, 0]);
  assert.equal(h.tick({ ...noon, dt: 0.1, foot: [0, -480, 0], grounded: false }).center[1], 11.5 - 500, 'the layer over the land, not the scene');
});

test('AUDIT ENVIRONS I8: the console\'s gust is the console\'s alone - takeEvents answers the gust it started, never the frame\'s already played (mutants: the frame\'s list kept for the console)', () => {
  const w = createWindfall({ settings: WINDFALL_BUILT_IN });
  const date = { year: 405, month: 5, day: 3 };
  let played = 0;
  for (let i = 0; i < 4000 && !played; i++) {
    const r = w.tick({ dt: 0.25, outside: true, weather: 'sunny', date, minuteOfDay: 600, absoluteDay: 100, season: SEASONS.Summer, climate: 231, mapPixel: { x: 100, y: 200 }, heading: null, settings: WINDFALL_BUILT_IN });
    played += r.events.length;
  }
  assert.ok(played > 0, 'a frame started a gust');
  w.triggerGust();
  assert.equal(w.takeEvents().length, 1, 'the console\'s one gust');
  assert.equal(w.takeEvents().length, 0, 'taken once');
});

test('AUDIT ENVIRONS W3: the shadow and AO replays keep the land\'s place of the mod\'s law across a crossing - a billboard record\'s anchor moves back by the shift, as the host\'s does (mutants: the record\'s anchor left behind)', () => {
  const gl = new Proxy({}, { get: (_, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, nm) => nm;
    if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  } });
  const sp = new ShadowPass(gl, { build: () => ({ id: 1 }), vs: { mesh: '', bb: '', terrain: '', char: '' } });
  const law = new Float32Array([0.1, 0.02, 1, 2, 1, 0, 123.5, 77.25]);
  sp.recordBillboards([], new Float32Array(4), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]), law);
  sp.recordBillboards([], new Float32Array(4), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  sp.shiftOrigin([819.2, 0, -819.2]);
  const want = windfallAnchorAfterShift([123.5, 77.25], [819.2, 0, -819.2]);
  assert.deepEqual([...sp.records[0].windfall.slice(6, 8)], want.map(Math.fround), 'the law\'s anchor, moved back');
  assert.deepEqual([...sp.records[1].windfall], new Array(8).fill(0), 'no law, nothing moved');
});

test('AUDIT ENVIRONS W4 + W7: the haze\'s shimmer runs on the game\'s seconds (_Time.y) - none while paused - and its strength on the real clock; the frame reads the mod\'s keys only when one is written; the phase is written in place (mutants: the shimmer on the real clock; the keys read every frame)', () => {
  const h = createHeatHaze();
  const noon = { exterior: true, climate: 224, weather: 'sunny', minuteOfDay: 720, foot: [0, 0, 0], grounded: true, settings: { ...HAZE_OFF, enabled: true, intensity: 1.5 } };
  const a = h.tick({ ...noon, dt: 0.1, time: 0.1 });
  const b = h.tick({ ...noon, dt: 0.1, time: 0 });   // paused: the shimmer holds, the ease goes on
  assert.equal(b.seconds, a.seconds, 'paused: the shimmer holds');
  assert.ok(b.intensity > a.intensity, 'the strength still eases on the real clock');
  assert.equal(h.tick({ ...noon, dt: 0.1, time: 6 }).seconds, a.seconds + 6, 'a travel\'s time scale: the shimmer runs with the world');
  const was = modSetting(HEAT_HAZE_VENDOR, 'Heat Haze.Intensity');
  try {
    const s1 = hazeFrameSettings(), s2 = hazeFrameSettings();
    assert.equal(s1, s2, 'one read until a key is written');
    setModSetting(HEAT_HAZE_VENDOR, 'Heat Haze.Intensity', 2);
    const s3 = hazeFrameSettings();
    assert.notEqual(s3, s1);
    assert.equal(s3.intensity, 2, 'the written key read');
    setModSetting(HEAT_HAZE_VENDOR, 'Enabled', false);
    assert.equal(hazeFrameSettings(), HAZE_OFF, 'the switch read every frame');
  } finally { setModSetting(HEAT_HAZE_VENDOR, 'Enabled', true); setModSetting(HEAT_HAZE_VENDOR, 'Heat Haze.Intensity', was); }
  const out = [9, 9, 9, 9];
  assert.equal(hazePhase([1, 2, 3], 4, 4.5, out), out, 'written into the draw\'s own four');
});

test('AUDIT ENVIRONS W5: the console\'s sixty leaves rise where TriggerLeafTest emits them - 8 m upwind and 4 up - however the next frame\'s UpdatePresentation moves the flow (mutants: the burst at the flow\'s place)', () => {
  const fx = createWindfallEffects({ random: seeded(5) });
  const parts = new WindfallParticles(null, { random: seeded(9) });
  fx.triggerLeafTest([0, 0, 0], [1, 0]);
  fx.update({ outside: true, weather: 0, natureArchive: 302, season: SEASONS.Summer, climate: 231, windyDay: false, storm: false, gust: 0, windDirection: [1, 0], dt: 0.016, playerPos: [0, 0, 0] });
  assert.deepEqual(fx.flows.leaves.position, [-13, 7, 0], 'the frame moved the flow to its own place');
  parts.step(fx.flows, 0.016);
  const L = parts.systems.leaves;
  assert.ok(L.count >= 60);
  let x = 0, y = 0;
  for (let i = 0; i < 60; i++) { x += L.pos[i * 3]; y += L.pos[i * 3 + 1]; }
  x /= 60; y /= 60;
  assert.ok(Math.abs(x + 8) < 4 && Math.abs(y - 4) < 1.5, `the burst about (-8, 4): (${x.toFixed(2)}, ${y.toFixed(2)})`);
  assert.equal(fx.flows.leaves.emitAt, null, 'spent');
});
