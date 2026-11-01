// BAY-LEFT-GROUND (2026-10-26, bible/03-World/Landforms.md "BAY-LEFT-GROUND"; the audit "no system left behind in the
// Bay", D3) - THE SNOWFALL MOD PAST THE BAY. Skyrim's winter laid the snow cover and the peaks' caps, but no deep snow to
// wade, no footprint, no track, no corpse's hollow and no berm anywhere past the Bay: the world host's snow ground
// (scenes/snowGround.js, moved out of bootWorld) stood no pixel off the Bay's 1000 x 500 and keyed one by `px * 1000 + py`
// (two pixels a thousand apart one key past it); SnowContextData.Prepare's box (scenes/snowfallHost.js snowPixelBox) and
// its metres (systems/snowfallRuntime.js) were clamped to the Bay's; and its roads read Basic Roads' 1000 x 500 bytes
// alone. Now the world's grid, by the world's key, and past the Bay TESA's own roads by the painter's word.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createSnowGround } from '../../src/scenes/snowGround.js';
import { createSnowfallHost, snowPixelBox, snowfallNetwork, snowfallNetworkBeyond } from '../../src/scenes/snowfallHost.js';
import { SnowContext, SNOW_WORLD_METRES } from '../../src/systems/snowfallRuntime.js';
import { SnowCoverage, BasicRoadsTerrain, ROAD_KIND, SNOWFALL_BUILT_IN } from '../../src/systems/snowfall.js';
import { worldCoordToMapPixel } from '../../src/formats/mapsFile.js';
import { WORLD_PIXEL_SPAN } from '../../src/world/worldWide/worldGrid.js';
import { beyondKey, setArenaRoads } from '../../src/world/arenaRoads.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { DIR, MAP_W, MAP_H } from '../../src/world/road/roadNetwork.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';
import { MASKS } from '../snowMasks.mjs';   // OWN-WORK4: our snow law's masks over a made-up winter set - Snowfall's own are retired

const SIZE = 819.2;
afterEach(() => { setArenaRoads(null); });

/** DFU's own box (SnowContextData.Prepare, clamped to the Bay's map) - the law before, for the Bay's pins. */
const bayBox = (minX, minZ, maxX, maxZ) => {
  const a = worldCoordToMapPixel(Math.trunc(minX * 40), Math.trunc(minZ * 40)), b = worldCoordToMapPixel(Math.trunc(maxX * 40), Math.trunc(maxZ * 40));
  return { x0: Math.max(0, Math.min(999, Math.min(a.x, b.x))), x1: Math.max(0, Math.min(999, Math.max(a.x, b.x))), y0: Math.max(0, Math.min(499, Math.min(a.y, b.y))), y1: Math.max(0, Math.min(499, Math.max(a.y, b.y))) };
};
/** A global box `r` metres round pixel (px, py)'s centre. */
const boxRound = (px, py, r) => [(px + 0.5) * SIZE - r, (499 - py + 0.5) * SIZE - r, (px + 0.5) * SIZE + r, (499 - py + 0.5) * SIZE + r];

test('BAY-LEFT-GROUND D3 Prepare\'s box is the world\'s grid: past the Bay a box answers its own pixels (Solitude, Torval, the Eltheric Ocean west of the Bay), clamped to the grid\'s edge; on the Bay, off its edge, DFU\'s own box to the pixel (mutants: the Bay\'s clamp kept; the grid\'s edge dropped)', () => {
  assert.deepEqual(snowPixelBox(...boxRound(1569, -430, 400)), { x0: 1569, x1: 1569, y0: -430, y1: -430 }, 'Solitude');
  assert.deepEqual(snowPixelBox(...boxRound(1922, 1705, 400)), { x0: 1922, x1: 1922, y0: 1705, y1: 1705 }, 'Torval');
  assert.deepEqual(snowPixelBox(...boxRound(-40, 120, 900)), { x0: -41, x1: -39, y0: 119, y1: 121 }, 'west of the Bay');
  assert.deepEqual(snowPixelBox(...boxRound(0, 250, 500)), { x0: -1, x1: 1, y0: 249, y1: 251 }, 'at the Bay\'s west edge the box reaches the land past it');
  const far = WORLD_PIXEL_SPAN + 50;
  assert.deepEqual(snowPixelBox(...boxRound(far, -far, 400)), { x0: WORLD_PIXEL_SPAN - 1, x1: WORLD_PIXEL_SPAN - 1, y0: -(WORLD_PIXEL_SPAN - 1), y1: -(WORLD_PIXEL_SPAN - 1) }, 'held to the grid');
  // the Bay, away from its edge: DFU's box, pixel for pixel
  const got = [], want = [];
  for (let k = 0; k < 400; k++) {
    const px = 3 + ((k * 7919) % 994), py = 3 + ((k * 104729) % 494), r = 100 + ((k * 31) % 1400);
    const b = boxRound(px, py, r);
    got.push(snowPixelBox(...b)); want.push(bayBox(...b));
  }
  assert.deepEqual(got, want);
});

test('BAY-LEFT-GROUND D3 SnowContextData.Prepare scans the box about the player wherever he stands: past the Bay the box round Whiterun, unclamped; on the Bay the same box as DFU\'s (mutants: the Bay\'s metres kept)', () => {
  const asked = [];
  const ctxAt = (px, py) => {
    const world = { toGlobal: (x, z) => [px * SIZE + x, (499 - py) * SIZE + z], terrainsIn: (...b) => { asked.push(b); return []; }, settlements: () => [], footprints: null };
    const c = new SnowContext(world, null);
    asked.length = 0;
    c.prepare(SIZE / 2, SIZE / 2, 60, 24, 12, { ...SNOWFALL_BUILT_IN, basicRoadsIntegration: true });
    return asked[0];
  };
  const span = Math.ceil((60 + Math.max(24, SNOWFALL_BUILT_IN.pathBoundaryFeather, SNOWFALL_BUILT_IN.roadBermWidth)) * 40) / 40;
  const centre = (px, py) => [px * SIZE + SIZE / 2, (499 - py) * SIZE + SIZE / 2];   // the world's toGlobal of the scene point
  for (const [px, py] of [[1891, -202], [3355, 1108], [-40, 120], [500, 250]]) {
    const [gx, gz] = centre(px, py);
    assert.deepEqual(ctxAt(px, py), [gx - span, gz - span, gx + span, gz + span], `(${px}, ${py}): the box about the player`);
  }
  assert.equal(SNOW_WORLD_METRES.minX, -(WORLD_PIXEL_SPAN - 1) * SIZE);
  assert.equal(SNOW_WORLD_METRES.maxZ, (499 + WORLD_PIXEL_SPAN) * SIZE);
  // at the world's edge it is held there
  const [gx] = centre(WORLD_PIXEL_SPAN - 1, 0);
  assert.equal(ctxAt(WORLD_PIXEL_SPAN - 1, 0)[2], Math.min(SNOW_WORLD_METRES.maxX, gx + span));
});

/** The world host's built entries and its stream state, as scenes/snowGround.js reads them. */
function streamAt(X0, Y0, { ring = 3 } = {}) {
  const built = new Map();
  for (let j = -ring; j <= ring; j++) {
    for (let i = -ring; i <= ring; i++) {
      const px = X0 + i, py = Y0 + j;
      built.set(`${px},${py}`, { px, py, samples: new Float32Array(129 * 129), tilemapBytes: new Uint8Array(16384).fill(1 << 2), locationRect: null, paths: null });
    }
  }
  const state = {
    mapOrigin: { x: X0, y: Y0 }, compensation: [0, 0, 0], current: { x: X0, y: Y0 }, terrainDistance: 3,
    pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = (px - X0) * SIZE; out[1] = 0; out[2] = (Y0 - py) * SIZE; return out; },
  };
  const { snowGround, _snowPixels } = createSnowGround({
    blocks: null, locationIndex: new Map(), maps: { getClimateIndex: () => 230 }, terrainGen: { roads: () => null },
    built, deepWaters: null, state, tileSide: SIZE / 128,
  });
  return { built, state, snowGround, _snowPixels };
}

test('BAY-LEFT-GROUND D3 the world host\'s snow ground stands every pixel of the world\'s grid by its world key: Whiterun\'s and the pixel a thousand rows south of its west neighbour - one key under `px * 1000 + py` - each its own entry; the Bay\'s own; off the grid none (mutants: the Bay\'s bound kept; the Bay\'s key kept)', () => {
  const { built, snowGround, _snowPixels } = streamAt(1891, -202);
  const alias = { px: 1890, py: 798, samples: new Float32Array(129 * 129), tilemapBytes: new Uint8Array(16384) };
  built.set('1890,798', alias);
  built.set('500,250', { px: 500, py: 250, samples: new Float32Array(129 * 129), tilemapBytes: new Uint8Array(16384) });
  assert.equal(1891 * 1000 + -202, 1890 * 1000 + 798, 'the Bay\'s key: one number for the two');
  _snowPixels.clear();
  // identities by ===: a failing assert.equal inspects an entry's 16,641 floats whole, the size of the machine
  assert.ok(snowGround.pixelOn(1891, -202) === built.get('1891,-202'), 'Whiterun');
  assert.ok(snowGround.pixelOn(1890, 798) === alias, 'and its alias, its own');
  assert.ok(snowGround.pixelOn(1891, -202) === built.get('1891,-202'), 'asked again, still Whiterun');
  assert.ok(snowGround.pixelOn(500, 250) === built.get('500,250'), 'the Bay');
  assert.ok(snowGround.pixelOn(WORLD_PIXEL_SPAN, 0) === null, 'off the grid');
  assert.ok(snowGround.pixelAt(SIZE * 0.5, SIZE * 0.5) === built.get('1891,-202'), 'the scene point over the player\'s pixel');
});

/** The real snow host, its runtime and the world host's real ground (`stream`, streamAt's), a winter's minute of a walk
 *  with a body lying in the snow: what stands. */
async function winterOn({ snowGround }, climate = 230) {
  const host = createSnowfallHost({ enhanced: true, ground: snowGround, loadMasks: async () => MASKS });
  const warn = console.warn; console.warn = () => {};
  const bodies = [{ key: 'foeCorpse:1', pos: [14, 0, 12] }];
  try {
    const frame = (now, sec, x) => host.frame({ now, inside: false, player: { x, y: 0, z: 10, grounded: true, swimming: false, levitating: false }, weather: 'snow', seconds: sec, winter: true, climate, overworld: false, npcs: [], corpses: () => bodies });
    frame(0, 1_000_000, 10);
    await new Promise((r) => setTimeout(r, 10));
    for (const t of [...snowGround.pixelsNear(3)]) host.promoted(t);
    let now = 0, sec = 1_000_000;
    for (let i = 0; i < 1200; i++) { now += 1 / 30; sec += 2; frame(now, sec, 10 + Math.min(i, 600) * 0.02); }
  } finally { console.warn = warn; }
  const rt = host.runtime;
  const out = { meshReady: rt.local.meshReady, staticReady: rt.local.staticReady, midReady: !!rt.mid.ready, blanketOverlays: [...rt.blanket.overlays.values()].filter((o) => o.ready).length,
    tracks: rt.tracks.count > 0, impressions: rt.corpses.impressions.length };
  host.dispose();
  return out;
}

test('BAY-LEFT-GROUND D3 the real Snowfall runtime over the world host\'s real ground stands at Whiterun in winter as on the Bay: the deep snow\'s window built, the middle tier ready, the blanket\'s overlays laid, the walk\'s track kept and the body\'s hollow - where it stood none (mutants: the ground\'s bound; the box\'s clamp; the metres\' clamp)', async () => {
  // the ground stands the pixel first: a winter walked on no ground is a runtime retrying every frame (a pin unread)
  const at = (x, y) => { const st = streamAt(x, y); assert.ok(st.snowGround.pixelOn(x, y), `(${x}, ${y}): the snow's ground stands it`); return st; };
  const bay = await winterOn(at(500, 250));
  assert.deepEqual(bay, { meshReady: true, staticReady: true, midReady: true, blanketOverlays: 49, tracks: true, impressions: 1 }, 'the Bay, as before (the audit\'s probe, lane D p7)');
  assert.deepEqual(await winterOn(at(1891, -202)), bay, 'Whiterun: the same snow');
  assert.deepEqual(await winterOn(at(-40, 120)), bay, 'and west of the Bay');
});

class FlatWoods {
  constructor(v) { this.heightMapBuffer = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(v); }
  getHeightMapValue(x, y) { return this.heightMapBuffer[Math.max(0, Math.min(MAP_HEIGHT - 1, y)) * MAP_WIDTH + Math.max(0, Math.min(MAP_WIDTH - 1, x))]; }
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y); return d; }
  getLargeMapData() { const d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(3)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) { const d = new Uint8Array(dim * dim).fill(3); return d; }
}
const bayNet = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H), water: false, smooth: false });

test('BAY-LEFT-GROUND D3 the roads past the Bay under the snow: a pixel the kernel paints with TESA\'s road and track (curves) is classified by the painter\'s own word - its paved tiles the road (berms beside it), its worn ones along the track the track (packed snow), a road\'s shoulder neither; nothing painted, no network (mutants: the paved record; the track\'s reach; the painted word unread)', () => {
  const w = new FlatWoods(20);
  const px = 1200, py = -30;
  setArenaRoads({ roads: new Map([[beyondKey(px, py), DIR.W | DIR.E]]), tracks: new Map([[beyondKey(px, py), DIR.N | DIR.S]]), join: new Map() });
  const o = generatePixelTerrain({ woods: w, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302, roads: bayNet() });
  assert.ok(o.paths, 'the painter\'s record');
  const net = snowfallNetworkBeyond(px, py, o.paths);
  const t = new BasicRoadsTerrain(px, py, o.tilemapBytes, new Uint8Array(16384), net, { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  assert.ok(t.roadTiles > 100, `the road's tiles (${t.roadTiles})`);
  assert.ok(t.pathTiles > 50, `the track's tiles (${t.pathTiles})`);
  // the road runs east-west across the middle, the track north-south: a tile on each line, and the corner far from both
  assert.equal(t.at(20, 64), ROAD_KIND.road, 'on the road');
  assert.equal(t.at(64, 20), ROAD_KIND.path, 'on the track');
  assert.equal(t.at(10, 10), ROAD_KIND.none, 'the wild');
  for (let i = 0; i < 16384; i++) if (t.kinds[i] === ROAD_KIND.road) assert.ok([46, 47, 55].includes(o.tilemapBytes[i] >> 2), 'every road tile a paved one');
  // the road's worn shoulder (painted, not paved) away from the track: neither - the berm lies over it
  let shoulder = 0;
  for (let z = 50; z < 78; z++) for (let x = 4; x < 44; x++) {
    const i = z * 128 + x;
    if (o.paths[i] && ![46, 47, 55].includes(o.tilemapBytes[i] >> 2)) { shoulder++; assert.equal(t.kinds[i], ROAD_KIND.none, `the shoulder at (${x}, ${z})`); }
  }
  assert.ok(shoulder > 10, `the road's shoulder (${shoulder} tiles)`);
  // the painter's word unread is no road: the same tiles with nothing painted stand none
  const unpainted = new BasicRoadsTerrain(px, py, o.tilemapBytes, new Uint8Array(16384), snowfallNetworkBeyond(px, py, new Uint8Array(16384)), { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  assert.deepEqual([unpainted.roadTiles, unpainted.pathTiles], [0, 0], 'nothing painted: no road, no track');
  // an authored tile (a town's own block) is no road's, as the mod's authored scan says on the Bay
  const town = new BasicRoadsTerrain(px, py, o.tilemapBytes, new Uint8Array(16384).fill(1), net, { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  assert.deepEqual([town.roadTiles, town.pathTiles], [0, 0], 'every tile authored: none');
  // the snow reads them: a track packs, a road banks its edge
  const cov = new SnowCoverage(MASKS);
  assert.equal(t.samplePath(64.5, 20.5, SIZE / 128, 1), 255, 'the track\'s middle: packed whole');
  let berm = 0;
  for (let z = 50; z < 80; z += 0.25) berm = Math.max(berm, t.sampleBerm(20.5, z, SIZE / 128, SNOWFALL_BUILT_IN.roadBermWidth, 303, cov));
  assert.ok(berm > 0, `a berm beside the road (${berm})`);
  // a pixel the painter wrote nothing on stands no network
  assert.equal(snowfallNetworkBeyond(px, py, null), null);
  // the world host's snow ground hands the snow these roads past the Bay - whatever network the Bay's own roads stand on;
  // on the Bay Basic Roads' network alone, so none without it (mutants: the Bay's source asked past the Bay)
  const { built, snowGround } = streamAt(px, py, { ring: 0 });
  built.set(`${px},${py}`, { ...built.get(`${px},${py}`), tilemapBytes: o.tilemapBytes, paths: o.paths });
  const fromHost = snowGround.roads(built.get(`${px},${py}`));
  assert.equal(typeof fromHost?.kindAt, 'function', 'past the Bay: TESA\'s roads by the painter\'s word');
  const hosted = new BasicRoadsTerrain(px, py, o.tilemapBytes, fromHost.authored, fromHost, fromHost.rect);
  assert.deepEqual([hosted.roadTiles, hosted.pathTiles], [t.roadTiles, t.pathTiles]);
  assert.ok(snowGround.roads({ px: 500, py: 250, paths: o.paths, locationRect: null }) === null, 'the Bay without Basic Roads: none');
  // a BEND past the Bay is a curve (VOYAGER2), and Basic Roads' arms predict its tiles nowhere near it: the painter's word
  // finds the road and the track the arms' prediction misses
  setArenaRoads({ roads: new Map([[beyondKey(px, py), DIR.W | DIR.NE]]), tracks: new Map([[beyondKey(px, py), DIR.S | DIR.NW]]), join: new Map() });
  const b = generatePixelTerrain({ woods: w, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: 302, roads: bayNet() });
  const bent = snowfallNetworkBeyond(px, py, b.paths);
  const now = new BasicRoadsTerrain(px, py, b.tilemapBytes, new Uint8Array(16384), bent, { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  const arms = new BasicRoadsTerrain(px, py, b.tilemapBytes, new Uint8Array(16384), { roads: bent.roads, paths: bent.paths, roadCorners: 0, pathCorners: 0 }, { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
  assert.ok(now.roadTiles > 100 && now.pathTiles > 50, `the bends' tiles (${now.roadTiles} road, ${now.pathTiles} track)`);
  assert.ok(arms.roadTiles + arms.pathTiles < (now.roadTiles + now.pathTiles) / 2, `the arms' prediction misses the curves (${arms.roadTiles + arms.pathTiles} of ${now.roadTiles + now.pathTiles})`);
});

test('BAY-LEFT-GROUND D3 on the Bay Basic Roads\' own network, byte for byte, with a crossing\'s join on its road bits - TESA5\'s road carried onto the Bay, which the ground paints there (mutants: the join unread)', () => {
  const roads = new Uint8Array(1000 * 500), tracks = new Uint8Array(1000 * 500);
  roads[10 + 20 * 1000] = 0x88; roads[9 + 20 * 1000] = 0x50; roads[11 + 20 * 1000] = 0x05; tracks[10 + 20 * 1000] = 0x22;
  const before = snowfallNetwork({ roads, tracks }, 10, 20);
  setArenaRoads({ roads: new Map(), tracks: new Map(), join: new Map([[beyondKey(998, 120), DIR.E | DIR.W]]) });
  assert.deepEqual(snowfallNetwork({ roads, tracks }, 10, 20), before, 'a pixel no join reaches: the same');
  assert.equal(snowfallNetwork({ roads, tracks }, 998, 120).roads, DIR.E | DIR.W, 'the join\'s road');
  assert.equal(snowfallNetwork({ roads, tracks }, 998, 120, () => 0).roads, 0, 'none without it');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
test('BAY-LEFT-GROUND D3 with ARENA2: on the player\'s own trace, Whiterun\'s own ground (the kernel\'s, over the continent\'s heights and its tundra\'s climate) stands the whole snow in winter - the window, the middle tier, the blanket, the track and the hollow (the audit\'s probe, lane D p7, on the real ground)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundWoods, tamrielClimateAt } = await import('../../src/world/tamriel/tamrielGround.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { getWorldClimateSettings } = await import('../../src/formats/mapsFile.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const g = groundWoods(woods);
    const [X0, Y0] = [1891, -202];
    const climate = tamrielClimateAt(X0, Y0);
    assert.notEqual(getWorldClimateSettings(climate)?.climateType, 0, 'Whiterun\'s tundra is no desert');
    const stream = streamAt(X0, Y0);
    for (const p of stream.built.values()) {
      const o = generatePixelTerrain({ woods: g, px: p.px, py: p.py, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: getWorldClimateSettings(tamrielClimateAt(p.px, p.py))?.climateType ?? 0, roads: null });
      p.samples = o.samples; p.tilemapBytes = o.tilemapBytes; p.groundNormals = null;
    }
    // the stream's translation stands each pixel at its own ground: the player's feet on Whiterun's
    const got = await winterOn(stream, climate);
    assert.deepEqual(got, { meshReady: true, staticReady: true, midReady: true, blanketOverlays: 49, tracks: true, impressions: 1 });
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
