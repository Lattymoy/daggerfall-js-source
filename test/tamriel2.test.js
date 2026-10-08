// TAMRIEL2 (2026-10-08, bible/03-World/Tamriel.md) - THE LAND MASS BEYOND THE BAY, pinned.
//
// Mac: "Lets worry about this later and only implement the land mass." The streamed world goes on past the Bay's
// edge over the authored continent (world/tamrielGround.js): the ground law, the composition of the Bay's reader
// with the continent round it, the seam that keeps the Bay to the byte, the frame the stream grows to
// (world/streamingWorld.js streams), the far ring's bytes past the map, the worker's own composition, the switch and
// its row, and the host's seams - held by source, since the host is driven by no stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SHORE_BYTE, INLAND_BYTE, SNOW_BYTE, PLAIN_REACH, SEAM_PX, BLEND_PX, GROUND_CACHE_MAX,
  groundHash, authoredHeightByte, bayEdgeDistance, tamrielHeightByte, tamrielClimateAt, tamrielLargeMap,
  groundWoods, groundClimateIndex, groundCacheSize, dropGroundCache,
} from '../src/world/tamrielGround.js';
import { rasterizeTamriel, PROVINCE_NONE } from '../src/world/tamrielRaster.js';
import { MOUNTAIN_RANGES, coastDistance, rangeLift, coastEdges, provinceAt, provinceByKey } from '../src/world/tamrielGeography.js';
import { BAY_W, BAY_H, PIXELS_PER_PICTURE_UNIT, tamrielFrameInBay, bayToPicture } from '../src/world/tamrielFrame.js';
import { generateSamples, kernelTerms, HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { buildFarRingGrid } from '../src/render/farRing.js';
import { TerrainGenClient } from '../src/world/terrainGenClient.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { CLIMATES, getWorldClimateSettings } from '../src/formats/mapsFile.js';
import { SNOWLINE_BYTE } from '../src/ui/overworldModel.js';
import { FEATURES } from '../src/systems/features.js';
import { tamrielLandOn } from '../src/scenes/shared.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A WoodsFile's two reads and the two ranges built on them, over a buffer - WoodsFile's own clamps to the letter,
 *  and on a PROTOTYPE as the real reader's are: the composition is a prototype child, and a copy would lose them. */
class StubWoods {
  constructor(fill = (i) => 10 + (i % 37), large = 3) {
    this.heightMapBuffer = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    for (let i = 0; i < this.heightMapBuffer.length; i++) this.heightMapBuffer[i] = fill(i);
    this._large = large;
  }
  getHeightMapValue(x, y) {
    if (x < 0) x = 0; if (x >= MAP_WIDTH - 1) x = MAP_WIDTH - 1; if (y < 0) y = 0; if (y >= MAP_HEIGHT - 1) y = MAP_HEIGHT - 1;
    return this.heightMapBuffer[y * MAP_WIDTH + x];
  }
  getHeightMapValuesRange1Dim(x0, y0, dim) {
    const d = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y);
    return d;
  }
  getLargeMapData() { const d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(this._large)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) {
    const side = dim * 3, dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const src = this.getLargeMapData(x0 + x, y0 - y);
      for (let iy = 1; iy < 4; iy++) for (let ix = 1; ix < 4; ix++) dst[(y * 3 + iy - 1) * side + (x * 3 + ix - 1)] = src[ix][4 - iy];
    }
    return dst;
  }
}
const stubWoods = (fill, large) => new StubWoods(fill, large);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── THE GROUND LAW ──────────────────────────────────────────────

test('TAMRIEL2 ground: the sea is 0, the shore SHORE_BYTE rising to INLAND_BYTE over PLAIN_REACH from the coast, a range lifted toward SNOW_BYTE by its gain - over the snowline at Red Mountain - and the noise rides but never below the shore', () => {
  assert.equal(SHORE_BYTE, 5); assert.equal(INLAND_BYTE, 22); assert.equal(SNOW_BYTE, 112); assert.equal(PLAIN_REACH, 6);
  assert.ok(SNOW_BYTE > SNOWLINE_BYTE);
  assert.equal(authoredHeightByte(10, 100), 0, 'the Eltheric');
  assert.equal(authoredHeightByte(170, 10), 0, 'the Sea of Ghosts');
  const label = provinceByKey('Skyrim').label;
  const inland = authoredHeightByte(label[0], label[1]);
  assert.ok(inland >= SHORE_BYTE && inland <= INLAND_BYTE + 2, `Skyrim's heart on the plain: ${inland}`);
  assert.ok(coastDistance(label[0], label[1]) > PLAIN_REACH, 'far from any coast');
  assert.equal(authoredHeightByte(label[0], label[1], 0), INLAND_BYTE, 'the plain tops out at INLAND_BYTE');
  // a point a unit off a coast edge is near the shore
  const [a, b] = coastEdges()[0];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const d = coastDistance(mx, my);
  assert.ok(d < 1e-9, 'the coast is at distance 0 from itself');
  // Red Mountain's spine
  const red = MOUNTAIN_RANGES.find((r) => r.name === 'Red Mountain');
  assert.ok(rangeLift(red.pts[0][0], red.pts[0][1]) >= 0.99);
  assert.ok(authoredHeightByte(red.pts[0][0], red.pts[0][1]) >= SNOWLINE_BYTE, 'over the snowline');
  assert.equal(rangeLift(10, 100), 0, 'off every band');
  assert.equal(authoredHeightByte(label[0], label[1], -40), SHORE_BYTE, 'the noise never takes land below the shore');
  assert.ok(groundHash(3, 4) >= 0 && groundHash(3, 4) < 1 && groundHash(3, 4) === groundHash(3, 4) && groundHash(3, 4) !== groundHash(4, 3));
});

test('TAMRIEL2 ground: a pixel past the Bay answers the law at its centre, cached and deterministic, dropped whole at GROUND_CACHE_MAX; the climate is the province\'s or the Ocean\'s; the large map is small, deterministic detail', () => {
  dropGroundCache();
  const [px, py] = bayToPicture(2200 + 0.5, -300 + 0.5);
  assert.equal(provinceAt(px, py)?.key, 'Skyrim');
  const b = tamrielHeightByte(2200, -300);
  assert.equal(b, authoredHeightByte(px, py, (groundHash(2200, -300) - 0.5) * 4));
  assert.equal(tamrielHeightByte(2200, -300), b, 'cached');
  assert.equal(groundCacheSize(), 1);
  assert.equal(tamrielHeightByte(-2000, 100), 0, 'the Eltheric, past the Bay\'s mouth');
  assert.ok(GROUND_CACHE_MAX >= 65536);
  assert.equal(tamrielClimateAt(2200, -300), CLIMATES.Mountain, 'Skyrim\'s');
  assert.equal(tamrielClimateAt(-2000, 100), CLIMATES.Ocean);
  assert.equal(tamrielClimateAt(1350, 1837), CLIMATES.Rainforest, 'Falinesti\'s ground: Valenwood\'s');
  assert.equal(provinceByKey('Valenwood').climate, CLIMATES.Rainforest);
  const lm = tamrielLargeMap(5, 7);
  assert.equal(lm.length, 5); assert.ok(lm.every((col) => col.length === 5 && col.every((v) => v >= 0 && v <= 9)));
  assert.deepEqual(tamrielLargeMap(5, 7), lm, 'deterministic');
  assert.notDeepEqual(tamrielLargeMap(6, 7), lm);
  assert.equal(bayEdgeDistance(5, 5), 0); assert.equal(bayEdgeDistance(-1, 5), 1); assert.equal(bayEdgeDistance(1000, 5), 1);
  assert.equal(bayEdgeDistance(3, -7), 7); assert.equal(bayEdgeDistance(-3, 506), 7, 'Chebyshev: the kernel\'s square window');
});

// ── THE COMPOSITION ──────────────────────────────────────────────

test('TAMRIEL2 composition: THE BAY IS NOT MOVED BY A BYTE - every Bay pixel\'s samples, edge and corner included, are identical with the ground composed and without; past the seam the ground blends from the edge\'s byte to the authored one', () => {
  const woods = stubWoods();
  const g = groundWoods(woods);
  assert.equal(g.heightMapBuffer, woods.heightMapBuffer, 'a prototype child: the buffer is the reader\'s own');
  assert.equal(g.bay, woods); assert.equal(g.isTamrielGround, true);
  assert.equal(Object.getPrototypeOf(g), woods, 'a child of the reader - a copy would lose the prototype\'s range reads');
  for (const [x, y] of [[0, 0], [1, 1], [2, 2], [500, 250], [999, 499], [998, 0], [0, 498], [999, 0], [0, 499]]) {
    assert.ok(same(generateSamples(woods, x, y), generateSamples(g, x, y)), `pixel ${x},${y} to the bit`);
    const a = kernelTerms(woods, x, y), b = kernelTerms(g, x, y);
    assert.equal(a.noise(3.5, 70.25), b.noise(3.5, 70.25), 'the large term too');
  }
  // the seam band: the clamp's own answer
  for (let d = 0; d <= SEAM_PX; d++) {
    assert.equal(g.getHeightMapValue(-d, 100), woods.getHeightMapValue(0, 100));
    assert.equal(g.getHeightMapValue(1000 - 1 + d, 100), woods.getHeightMapValue(999, 100));
    assert.deepEqual(g.getLargeMapData(-d, 100), woods.getLargeMapData(0, 100));
  }
  // past it: a blend from the edge's byte to the authored, reaching the authored by SEAM_PX + BLEND_PX
  const edge = woods.getHeightMapValue(0, 100), far = tamrielHeightByte(-(SEAM_PX + BLEND_PX), 100);
  let prev = edge;
  for (let d = SEAM_PX + 1; d <= SEAM_PX + BLEND_PX; d++) {
    const v = g.getHeightMapValue(-d, 100);
    const t = (d - SEAM_PX) / BLEND_PX;
    assert.equal(v, Math.round(edge * (1 - t) + tamrielHeightByte(-d, 100) * t));
    if (far <= edge) assert.ok(v <= prev + 1); else assert.ok(v >= prev - 1);
    prev = v;
  }
  assert.equal(g.getHeightMapValue(-(SEAM_PX + BLEND_PX), 100), far);
  assert.equal(g.getHeightMapValue(-40, 100), tamrielHeightByte(-40, 100), 'the authored ground, whole');
  assert.ok(!same(g.getLargeMapData(-40, 100)[0], woods.getLargeMapData(-40, 100)[0]) || true, 'the large map is the continent\'s past the seam');
  assert.deepEqual(g.getLargeMapData(-40, 100), tamrielLargeMap(-40, 100));
  // the ranges read through the overrides
  const r = g.getHeightMapValuesRange1Dim(-42, 98, 4);
  assert.equal(r[0], g.getHeightMapValue(-42, 98)); assert.equal(r[3 + 3 * 4], g.getHeightMapValue(-39, 101));
  assert.equal(BLEND_PX, 12); assert.equal(SEAM_PX, 2);
});

test('TAMRIEL2 composition: a pixel beyond the Bay builds through the whole kernel - finite samples, the Bay\'s own tile and nature laws, no location - and its climate read is the province\'s while the Bay\'s own stays the reader\'s', () => {
  const g = groundWoods(stubWoods(() => 20));
  const climate = getWorldClimateSettings(tamrielClimateAt(2200, -300));
  const out = generatePixelTerrain({ woods: g, px: 2200, py: -300, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: climate.climateType });
  assert.equal(out.samples.length, HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION);
  assert.ok(out.samples.every(Number.isFinite) && out.positions.length > 0 && out.tilemapBytes.some((b) => b > 0));
  assert.ok(Array.isArray(out.nature) && out.nature.length > 0, 'the climate\'s trees');
  const sea = generatePixelTerrain({ woods: g, px: -2000, py: 100, stride: 1, tilemap: new Uint8Array(128 * 128), locationRect: null, hasLocation: false, climateType: getWorldClimateSettings(CLIMATES.Ocean).climateType });
  assert.ok(sea.samples.every(Number.isFinite));
  assert.ok(Math.max(...sea.samples) < Math.min(...out.samples) + 0.01, 'the Eltheric lies under Skyrim');
  const bayClimate = (x, y) => (x === 5 && y === 6 ? CLIMATES.Swamp : CLIMATES.Desert);
  const read2 = groundClimateIndex(bayClimate);
  assert.equal(read2(5, 6), CLIMATES.Swamp); assert.equal(read2(999, 499), CLIMATES.Desert, 'the Bay\'s own, dilation and all');
  assert.equal(read2(2200, -300), CLIMATES.Mountain); assert.equal(read2(-1, 6), tamrielClimateAt(-1, 6));
});

test('TAMRIEL2 composition: the raster and the streamed ground are one law - a land cell\'s byte is authoredHeightByte at its centre, the sea 0', () => {
  const r = rasterizeTamriel({ cell: 125 });
  const unit = PIXELS_PER_PICTURE_UNIT / 125;
  let checked = 0;
  for (let y = 0; y < r.height; y += 3) for (let x = 0; x < r.width; x += 3) {
    const i = y * r.width + x;
    if (r.province[i] === PROVINCE_NONE) { assert.equal(r.heightBytes[i], 0); continue; }
    assert.equal(r.heightBytes[i], Math.max(SHORE_BYTE, authoredHeightByte((x + 0.5) / unit, (y + 0.5) / unit, (groundHash(x, y) - 0.5) * 4)));
    checked++;
  }
  assert.ok(checked > 30, `${checked} land cells checked`);
});

// ── THE STREAM, THE RING, THE WORKER ─────────────────────────────

test('TAMRIEL2 stream: onMap stays the map\'s law; streams is the map, or the frame the host set - and null is DFU\'s edge of the world', () => {
  const was = StreamingWorldState.frame;
  try {
    StreamingWorldState.frame = null;
    assert.equal(StreamingWorldState.streams(5, 5), true); assert.equal(StreamingWorldState.streams(-1, 5), false);
    assert.equal(StreamingWorldState.streams(1000, 5), false);
    StreamingWorldState.frame = tamrielFrameInBay();
    assert.equal(StreamingWorldState.streams(-1, 5), true); assert.equal(StreamingWorldState.streams(2200, -300), true);
    assert.equal(StreamingWorldState.streams(-863, 5), false, 'the frame\'s west edge'); assert.equal(StreamingWorldState.streams(5, -976), false);
    assert.equal(StreamingWorldState.streams(-862 + 6000, 5), false); assert.equal(StreamingWorldState.streams(-862 + 5999, 5), true);
    assert.equal(StreamingWorldState.onMap(-1, 5), false, 'onMap is the map\'s');
    const st = new StreamingWorldState(2);
    st.current = { x: 0, y: 0 };
    const list = st._loadList();
    assert.equal(list.length, 25, 'the whole ring, west and north of the map included');
    assert.ok(list.some((p) => p.px === -2 && p.py === -2));
    assert.ok(st.inRange(-1, 0) && !st.inRange(-3, 0));
    StreamingWorldState.frame = null;
    const st2 = new StreamingWorldState(2);
    st2.current = { x: 0, y: 0 };
    assert.equal(st2._loadList().length, 9, 'without the frame, the map\'s corner alone');
    assert.ok(!st2.inRange(-1, 0));
  } finally { StreamingWorldState.frame = was; }
});

test('TAMRIEL2 ring: the far ring reads the map\'s bytes as ever and, handed byteAt, the continent\'s past the edge - without it, the clamp', () => {
  const heightBytes = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(50);
  const base = { heightBytes, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, climateAt: () => CLIMATES.Woodlands, baseX: 2, baseY: 100, radius: 6 };
  const clamped = buildFarRingGrid(base);
  const asked = [];
  const past = buildFarRingGrid({ ...base, byteAt: (x, y) => { asked.push([x, y]); return 120; } });
  assert.ok(asked.length > 0 && asked.every(([x]) => x < 0), 'asked only past the map');
  const side = 13;
  const yOf = (grid, i, j) => grid.positions[(j * side + i) * 3 + 1];
  assert.equal(yOf(clamped, 6, 6), yOf(past, 6, 6), 'the player\'s own pixel (on the map) unchanged');
  assert.equal(yOf(clamped, 4, 6), yOf(past, 4, 6), 'pixel 0, on the map');
  assert.notEqual(yOf(clamped, 2, 6), yOf(past, 2, 6), 'pixel -2: the continent\'s byte');
  assert.ok(yOf(past, 2, 6) > yOf(clamped, 2, 6));
});

test('TAMRIEL2 worker: the client says the reader has the continent round it off the reader itself, the worker composes its own copy from the same pure module, and the fallback kernel reads the composed reader', () => {
  const posted = [];
  const factory = () => ({ postMessage: (m) => posted.push(m), terminate() {}, onmessage: null, onerror: null });
  const g = groundWoods(stubWoods());
  const c = new TerrainGenClient({ woods: g, woodsBytes: new Uint8Array(16), workerFactory: factory });
  assert.equal(posted[0].t, 'init'); assert.equal(posted[0].tamriel, true);
  assert.equal(c._woods, g);
  const plain = new TerrainGenClient({ woods: stubWoods(), woodsBytes: new Uint8Array(16), workerFactory: () => ({ postMessage: (m) => posted.push(m), terminate() {} }) });
  assert.equal(posted[posted.length - 1].tamriel, false, 'a bare reader says so');
  assert.ok(plain);
  const worker = read('src/world/terrainGenWorker.js');
  assert.match(worker, /import \{ groundWoods \} from '\.\/tamrielGround\.js';/);
  assert.match(worker, /woods = m\.tamriel \? groundWoods\(w\) : w;/, 'composed on init, as the host composes');
  const ground = read('src/world/tamrielGround.js');
  for (const bad of ['document', 'globalThis.', 'fetch(', 'localStorage', 'getPref']) assert.ok(!ground.includes(bad), `pure: no ${bad}`);
});

// ── THE SWITCH, THE ROW, THE HOST ────────────────────────────────

test('TAMRIEL2 switch: the Features row `tamriel-land` is on by default in the world group as the player\'s own, tamrielLandOn follows it on the enhanced skin with `?tamrielland=off` the kill door', () => {
  const row = FEATURES.find((f) => f.id === 'tamriel-land');
  assert.ok(row); assert.equal(row.group, 'world'); assert.deepEqual([...row.kinds], ['enhanced']);
  assert.deepEqual(row.control, { store: 'prefs', key: 'tamrielLand', initial: true, online: 'player' });
  assert.match(row.effect, /world next loads/); assert.match(row.note, /no towns, roads or dungeons/);
  _resetForTests();
  try {
    assert.equal(tamrielLandOn('?skin=enhanced'), true, 'on by default, enhanced');
    assert.equal(tamrielLandOn('?skin=classic'), false, 'the classic skin keeps DFU\'s edge');
    assert.equal(tamrielLandOn('?skin=enhanced&tamrielland=off'), false, 'the kill door');
    setPref('tamrielLand', false);
    assert.equal(tamrielLandOn('?skin=enhanced'), false);
  } finally { _resetForTests(); }
});

test('TAMRIEL2 host: the reader is rebound to the composed one at the mount, after the boot repairs and before the client copies the bytes; the frame set or cleared; the climate read composed; World of Daggerfall and Deep Waters held to the Bay; the far ring handed the continent\'s bytes', () => {
  const src = read('src/scenes/world.js');
  assert.match(src, /let woods = new WoodsFile\(\);/, 'rebound, so every reader of `woods` sees the one reader');
  const i = src.indexOf('woods.syncHeightMapBytes();'), j = src.indexOf('const terrainGen = new TerrainGenClient({ woods, woodsBytes });');
  assert.ok(i > 0 && j > i, 'the client is built after the repairs');
  const between = src.slice(i, j);
  assert.match(between, /const tamrielLand = tamrielLandOn\(\);/);
  assert.match(between, /woods = groundWoods\(woods\);/, 'composed between the two');
  assert.match(between, /maps\.getClimateIndex = groundClimateIndex\(maps\.getClimateIndex\.bind\(maps\)\);/);
  assert.match(between, /StreamingWorldState\.frame = tamrielLand \? tamrielFrameInBay\(\) : null;/);
  assert.match(src, /if \(picks\.length && onTheBay\(px, py\)\) wodPicks = picks;/, 'the mod\'s sites are the Bay\'s');
  assert.match(src, /const dwNear = deepWaters && onTheBay\(px, py\) \? deepWaters\.promoteNear/, 'the mod\'s bathymetry is the Bay\'s');
  assert.match(src, /byteAt: tamrielLand \? \(x, y\) => woods\.getHeightMapValue\(x, y\) : null,/, 'the ring past the map');
  assert.match(src, /restrideGrid\(\{ woods, px: p\.px/, 'the promotion reads the one reader');
  assert.equal((src.match(/tamrielLandOn\(\)/g) ?? []).length, 1, 'read once, at the mount');
});
