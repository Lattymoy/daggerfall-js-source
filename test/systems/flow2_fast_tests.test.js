// FLOW2 (2026-09-26, Mac: "is there a way to really ensure we have a faster workflow with the same standards?"): THE
// TWO SLOWEST TESTS, FAST - BY MAKING THE GAME'S OWN CODE FAST, THE SAME ANSWERS. ROADS-CLEAR's whole-world sweep spent
// 130 s inside world/worldOfDaggerfall/wodLocationLoader.js pickLocations - the mod's AddLocation loop, verbatim, scanning all 227,938
// instances for each of 146,446 pixels (a tile load in the game paid the same 228k-entry pass); WEATHER3a's calibration
// gate spent ~100 s in the weather map re-reading the same noise, drawing shapes for candidates it threw away, and in the
// collector. Now: the loop walks the tile's own pixel (LocationSession.pixelIndex) with every decision the scan makes -
// the scan kept, VERBATIM, as pickLocationsScan, the law it is held to here and proven equal over the whole world once
// (587,384 tiles, 239,059 placements, identical); the weather map reads a system's headings once, makes a shape only for
// a kept candidate from the very draws it always took, and a noise corner without a generator (wind.js seededFirst) - the
// same bits, pinned by goldens taken under the code before it. ROADS-CLEAR 136 s -> 1 s; WEATHER3a ~104 s -> ~58 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocationSession, pickLocations, pickLocationsScan, WOD_OCEAN_REGIONS } from '../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { decodeRegionPack } from '../../src/world/worldOfDaggerfall/wodLocationPack.js';
import { seededRng, seededFirst } from '../../src/systems/wind/wind.js';
import { windAt, windPath, weatherAt, systemsNear, resetWeatherMap } from '../../src/systems/weather/weatherMap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A made list: types 0, 1 and 2 over a few pixels (and one off the grid), terrain spots in and out of bounds. */
function madeSession(seed) {
  const r = seededRng(seed);
  const s = new LocationSession();
  const cols = (n, ox) => {
    const c = { count: n, worldX: [], worldY: [], terrainX: [], terrainY: [], type: [], locationID: [], name: [], prefab: [] };
    for (let i = 0; i < n; i++) {
      const px = ox + Math.floor(r() * 3), py = r() < 0.08 ? -1 : 7 + Math.floor(r() * 3);
      c.worldX.push(px); c.worldY.push(py);
      c.terrainX.push(Math.floor(r() * 132) - 1); c.terrainY.push(Math.floor(r() * 132) - 1);
      c.type.push([0, 1, 2, 2, 1][Math.floor(r() * 5)]);
      c.locationID.push(i); c.name.push(`n${i}`); c.prefab.push(`p${Math.floor(r() * 6)}`);
    }
    return c;
  };
  s.appendRegion(1, cols(90, 10));
  // off the grid's right edge (x 1000): a slot taken as y * 1000 + x would be (0, y + 1)'s
  const edge = { count: 6, worldX: [1000, 1000, 0, 1000, 0, 999], worldY: [7, 8, 8, 7, 9, 499], terrainX: [5, 6, 7, 8, 9, 10], terrainY: [5, 6, 7, 8, 9, 10], type: [1, 2, 1, 0, 2, 1], locationID: [0, 1, 2, 3, 4, 5], name: ['e0', 'e1', 'e2', 'e3', 'e4', 'e5'], prefab: ['p2', 'p2', 'p2', 'p2', 'p2', 'p2'] };
  s.appendRegion(3, edge);
  return { s, more: () => s.appendRegion(2, cols(40, 10)) };
}
const PREFABS = { p0: { width: 10, height: 12 }, p1: { width: 40, height: 30 }, p2: { width: 2, height: 2 }, p3: { width: 120, height: 3 }, p4: { width: 5, height: 60 } };
const getPrefab = (n) => PREFABS[n] ?? null;   // p5 is a missing file
const paths = (x, y) => ((x * 7 + y * 3) % 4 === 0 ? 1 : 0);
const refuse = (name, prefab, rect) => (name.charCodeAt(1) + rect.x + rect.y) % 3 !== 0;

function tiles() {
  const out = [];
  for (const x of [0, 9, 10, 11, 12, 13, 999, 1000]) for (const y of [-1, 6, 7, 8, 9, 10, 499]) {
    for (const hasLocation of [false, true]) for (const [regionIndex, worldHeight] of [[-1, 10], [WOD_OCEAN_REGIONS[0], 1], [WOD_OCEAN_REGIONS[1], 3]]) {
      out.push({ mapPixelX: x, mapPixelY: y, hasLocation, regionIndex, worldHeight });   // AUDIT FB1018f L4-3: the pixel's region, the field the sea arm reads (WOD-SEA-TEST)
    }
  }
  return out;
}

test('FLOW2 the pixel walk makes every decision the verbatim scan makes: a made list of types 0, 1 and 2 - a type 0 anywhere ends the call once the tile holds a location or is sea, a type 2 skips then, every other type is placed unsmoothed - over pixels on and off the grid, with and without roads and a site refused, before and after a region is appended (mutants: a type 0 between them unread; the last own instance taken for between; the index kept past an append; the grid\'s right edge aliased onto the next row)', () => {
  let compared = 0, placed = 0, cut = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { s, more } = madeSession(seed);
    for (const phase of [0, 1]) {
      if (phase === 1) more();
      for (const tile of tiles()) for (const [pp, sc] of [[null, null], [paths, null], [null, refuse], [paths, refuse]]) {
        const want = pickLocationsScan(tile, s, getPrefab, pp, sc), got = pickLocations(tile, s, getPrefab, pp, sc);
        assert.deepEqual(got, want, `seed ${seed} phase ${phase} ${JSON.stringify(tile)}`);
        compared++; placed += want.length;
        if (want.length && want.length < s.count) cut++;
      }
    }
  }
  assert.ok(compared > 5000 && placed > 500 && cut > 100, `the made lists exercise the loop: ${compared} tiles, ${placed} placements`);
});

test('FLOW2 over the shipped World of Daggerfall lists: the walk answers what the scan answers on the busiest pixels and a spread of the rest (the whole world proven once: 587,384 tiles identical); a hand-made session without the index walks the scan (mutants: the walk off its own pixel)', () => {
  const V = join(ROOT, 'vendor/world-of-daggerfall');
  const s = new LocationSession();
  for (const f of readdirSync(join(V, 'Locations')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) s.appendRegion(parseInt(f, 10), decodeRegionPack(new Uint8Array(readFileSync(join(V, 'Locations', f)))));
  const counts = new Map();
  for (let i = 0; i < s.count; i++) { const k = `${s.worldX[i]},${s.worldY[i]}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const keys = [...counts.keys()];
  const busiest = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k]) => k);
  const spread = keys.filter((_, i) => i % 1000 === 0);
  const size = { width: 12, height: 10 };
  let placed = 0;
  for (const k of [...busiest, ...spread]) {
    const [x, y] = k.split(',').map(Number);
    for (const tile of [{ mapPixelX: x, mapPixelY: y, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 }, { mapPixelX: x, mapPixelY: y, hasLocation: false, mapRegionIndex: 17, worldHeight: 40 }]) {
      const want = pickLocationsScan(tile, s, () => size), got = pickLocations(tile, s, () => size);
      assert.deepEqual(got, want, k);
      placed += want.length;
    }
  }
  assert.ok(placed > 50, `placements compared: ${placed}`);
  const plain = { count: 2, worldX: [3, 3], worldY: [4, 4], terrainX: [5, 6], terrainY: [5, 6], type: [1, 1], prefab: ['a', 'b'] };
  assert.deepEqual(pickLocations({ mapPixelX: 3, mapPixelY: 4, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 }, plain, () => size).map((p) => p.index), [0, 1], 'no index: the scan');
});

// Taken under the weather code BEFORE FLOW2 (and identical after): [x, z, t, u, windAt(x, z, t), windPath(x, z, t, u)]
const WIND_GOLDEN = [
  [267472.34598733485, 434410.24421481416, 2369410.950690508, 2374394.4987887517, [0.41033156748368366, 0.13326408030365078], [2144.19986259667, -302.65365083992896]],
  [708181.212306954, 134220.2886706218, 1892852.1103225648, 1893319.084130926, [0.37519084715854456, 0.13924522753030474], [129.7271185312842, 100.20421604344168]],
  [779372.6114323363, 250112.98813624308, 5011112.497653812, 5014995.945042465, [0.30313955903369494, 0.32084373439260083], [1238.1084209588507, -722.6838787499868]],
  [265063.7811748311, 270196.0719306953, 773306.6319487989, 776035.2069104556, [0.3592610381619238, 0.20905598178361867], [1053.1657527219982, -379.77157241788404]],
];
// [climate, x, z, minutes, word, intensity, system id, system x, system z, its shape's second term]
// RAIN-HOURS (2026-10-13): taken again under the law as it stands. The calibration moved every birth (the ceilings and
// the weights are the table's, as worn), so the first set's places read other skies; RAIN-HEART's strength is in a rain
// front's intensity. Before the calibration moved, the strength alone left every system, place, shape and cell of the
// first set the same bits and scaled each rain intensity by exactly its front's strength.
const SKY_GOLDEN = [
  [231, 321818.54934897274, 179055.78460777178, 1920670.9819845855, "overcast", 0.9264574192285582, "overcast:2:1:1333:0", 353456.3056704953, 169972.68042170658, 0.1711820447245842],
  [229, 108617.48442985117, 295710.54856292903, 3780803.7479408085, "cloudy", 0.09255964018404482, "rain:1:1:2624:1", 228148.01724596153, 302394.0258315138, 0.27920526072497326],
  [231, 338505.3640929982, 251807.46059166268, 4658500.080462545, "rain", 0.46334426693531294, "rain:2:1:3234:0", 361979.4989197483, 285201.1331234632, -0.07264692177200953],
  [231, 364279.0702637285, 134487.7981999889, 4378573.379479349, "cloudy", 0.8872227178912168, "cloudy:2:0:3040:1", 333132.14296045166, 132917.09521383425, 0.15426364368470197],
  [232, 388649.591547437, 278114.061683882, 3367353.316862136, "rain", 0.33157110832250564, "rain:2:1:2337:0", 346318.03849949536, 280125.146656208, 0.010166454901134016],
  [229, 462573.0175059289, 51651.149690151215, 8390934.257302433, "rain", 0.6061511162898268, "rain:2:0:5826:2", 470313.7816852514, 62111.66897321414, 0.09120889614886706],
];

// [climate, x, z, minutes, a CELL over the place, its x and z, and where it was born - its front's wind path at its birth]
const CELL_GOLDEN = [
  [229, 443586.44713647664, 249350.52995570004, 3840793.158393353, "rain:3:1:2667:1/434", 449518.5790031049, 242891.2223312895, 447635.7958606506, 241720.20620851868],
  [229, 87811.91655434668, 288982.9821093008, 3871998.6071810126, "rain:-1:1:2688:0/572", 88526.55313053216, 293769.6178451, 87671.08099720281, 292816.993643681],
  [227, 131714.6158311516, 323605.113371741, 3826601.7604619265, "rain:0:2:2657:0/154", 124553.81723154188, 319571.7533392088, 124547.73097433602, 319159.5477438253],
];

test('FLOW2 the weather map\'s answers are the same bits as before it read a system\'s headings once, made shapes only for kept candidates and drew a noise corner without a generator: the wind and its path, and the sky with the system over it, its place and its shape, and a front\'s cells where its wind carried them (mutants: a shape\'s draws in another order; a corner\'s seed moved; a front\'s path read backwards)', () => {
  for (const [x, z, t, u, w, p] of WIND_GOLDEN) {
    assert.deepEqual(windAt(x, z, t), w);
    assert.deepEqual(windPath(x, z, t, u), p);
  }
  resetWeatherMap();
  for (const [c, x, z, m, word, intensity, id, sx, sz, shape1] of SKY_GOLDEN) {
    const w = weatherAt(x, z, m, () => c);
    assert.equal(w.word, word); assert.equal(w.intensity, intensity);
    assert.equal(w.system?.id, id); assert.equal(w.system.x, sx); assert.equal(w.system.z, sz);
    assert.equal(w.system.shape ? w.system.shape[1] : null, shape1);
  }
  for (const [c, x, z, m, id, cx, cz, bx, bz] of CELL_GOLDEN) {
    const cell = systemsNear(x, z, m, () => c, 0).find((s) => s.id === id);
    assert.ok(cell, id); assert.equal(cell.x, cx); assert.equal(cell.z, cz); assert.equal(cell.bornX, bx); assert.equal(cell.bornZ, bz);
  }
  // a seed's first draw, without the generator
  const r = seededRng(0xABCDEF);
  for (let i = 0; i < 2000; i++) { const seed = Math.floor(r() * 4294967296); assert.equal(seededFirst(seed), seededRng(seed)()); }
  assert.equal(seededFirst(-1), seededRng(-1)(), 'a seed past 32 bits wraps as the generator\'s does');
});
