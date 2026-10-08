// LANDFORM7 (2026-10-08, Mac, of the hills on the real ground: "Do your thing") - A ROAD EASES THE HILLS
// (world/landforms.js). The hills rode a road's profile whole, so a road climbed every hill the country wore: on the real
// map a straight road's grade at the 95th percentile rose from the bare land's 7.5% to 18.5% in the deserts. Within
// `LANDFORM_DIALS.ease` of a road's or a track's centre line the hills ease down to `keep` of themselves at the line.
// Pinned with no game data, on the landforms' synthetic world (test/landformWorld.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { generateSamples, kernelTerms, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, BASE_HEIGHT_SCALE, NOISE_MAP_SCALE } from '../src/world/terrainSampler.js';
import { createLandforms, hillsAt, LANDFORM_DIALS, LANDFORM_KNEE } from '../src/world/landforms.js';
import { DIR } from '../src/world/roadNetwork.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION;
const UNIT = MAX_TERRAIN_HEIGHT;
const at = (s, x, y) => s[x * H + y];
const woods = new WoodsFile();
assert.equal(woods.load(syntheticWoodsBytes()), true);
const NET = network();
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** the share of the hills a sample `d` samples from a way of reach `radius` keeps - the law, written out */
const keepAt = (d, radius) => (d < radius ? 1 - (1 - LANDFORM_DIALS.ease.keep) * (1 - smooth01(d / radius)) : 1);
/** a pixel's hills as the shaper stands them (its ground less the same ground without hills - off every path's cut, the
 *  ground noise and the lift alike in both) and as hillsAt stands them whole, on the kernel's macro height */
function hillsOf(roads, px, py) {
  const shaped = generateSamples(woods, px, py, H, createLandforms({ woods, roads })), flat = generateSamples(woods, px, py, H, createLandforms({ woods, roads, hills: false }));
  const { base, noise } = kernelTerms(woods, px, py, H), ox = px * (H - 1), oy = (MAP_HEIGHT - py) * (H - 1);
  return {
    shaped: (x, y) => (at(shaped, x, y) - at(flat, x, y)) * UNIT,
    whole: (x, y) => { const low = base(x, y) * BASE_HEIGHT_SCALE; return hillsAt(ox + x, oy + y, low + noise(x, y) * NOISE_MAP_SCALE, low); },
  };
}
/** a crossing on the mountain's high flank, away from the fixture's own paths and water: a road east-west down row 230
 *  and a track north-south down column 333, crossing at (333, 230) */
const CROSS = (() => {
  const n = { roads: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), rivers: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), streams: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), water: true, smooth: true };
  for (let x = 326; x <= 340; x++) n.roads[230 * MAP_WIDTH + x] = DIR.E | DIR.W;
  for (let y = 223; y <= 237; y++) n.tracks[y * MAP_WIDTH + 333] = DIR.N | DIR.S;
  return n;
})();

test('LANDFORM7: beside a road the hills ease to `keep` of themselves on its centre line and come back whole by its reach - 1 - smoothstep of the distance, written out', () => {
  const { road } = LANDFORM_DIALS.ease, reach = LANDFORM_DIALS.road.flat + LANDFORM_DIALS.road.bank + LANDFORM_DIALS.road.verge;
  assert.ok(road > 4 * reach, `a road eases far wider than it cuts (${road} against ${reach})`);
  let eased = 0, whole = 0;
  for (const px of [331, 335]) {   // the road east-west down y = 64, two pixels off the track
    const h = hillsOf(CROSS, px, 230);
    for (let x = 0; x <= 128; x += 16) for (const d of [11, 14, 18, 24, 30, 36, 39, 41, 48, 60]) for (const y of [64 - d, 64 + d]) {
      const want = h.whole(x, y) * keepAt(d, road);
      assert.ok(Math.abs(h.shaped(x, y) - want) < 2e-3, `(${px},230) (${x},${y}) ${d} from the road: ${h.shaped(x, y).toFixed(4)} units of hill, the law's ${want.toFixed(4)}`);
      if (d < road && Math.abs(h.whole(x, y)) > 2) eased++;
      if (d >= road && Math.abs(h.whole(x, y)) > 2) whole++;
    }
  }
  assert.ok(eased > 60 && whole > 20, `the hills read where they ease (${eased}) and past the reach (${whole})`);
});

test('LANDFORM7: a track eases them over its own narrower reach, and where a road and a track meet a sample keeps the less of the two', () => {
  const { road, track } = LANDFORM_DIALS.ease;
  assert.ok(track < road, 'a track eases a narrower way than a road');
  const lone = hillsOf(CROSS, 333, 226);   // the track north-south down x = 64, four pixels off the road
  for (let y = 0; y <= 128; y += 16) for (const d of [10, 14, 20, 27, 29, 40]) for (const x of [64 - d, 64 + d]) {
    const want = lone.whole(x, y) * keepAt(d, track);
    assert.ok(Math.abs(lone.shaped(x, y) - want) < 2e-3, `(333,226) (${x},${y}) ${d} from the track: ${lone.shaped(x, y).toFixed(4)}, the law's ${want.toFixed(4)}`);
  }
  const both = hillsOf(CROSS, 333, 230);   // the crossing: the road down y = 64, the track down x = 64
  let met = 0;
  for (const dx of [12, 16, 22]) for (const dy of [12, 18, 26, 34]) for (const [x, y] of [[64 - dx, 64 - dy], [64 + dx, 64 + dy]]) {
    const kr = keepAt(dy, road), kt = keepAt(dx, track), want = both.whole(x, y) * Math.min(kr, kt);
    assert.ok(Math.abs(both.shaped(x, y) - want) < 2e-3, `(${x},${y}): ${both.shaped(x, y).toFixed(4)}, the lesser keep's ${want.toFixed(4)}`);
    if (Math.abs(kr - kt) > 0.05 && Math.abs(both.whole(x, y)) > 0.8) met++;   // the country's hills low here: a unit and more
  }
  assert.ok(met > 6, `the two ways' keeps read apart (${met})`);
});

test('LANDFORM7: a river keeps its valley where a road crosses it - the ease comes before the carve, which takes the water to its dale whatever a road does', () => {
  const noRoads = { ...NET, roads: new Uint8Array(NET.roads.length), tracks: new Uint8Array(NET.tracks.length) };
  const reach = LANDFORM_DIALS.road.flat + LANDFORM_DIALS.road.bank + LANDFORM_DIALS.road.verge;
  const withRoad = generateSamples(woods, 300, 255, H, createLandforms({ woods, roads: NET })), without = generateSamples(woods, 300, 255, H, createLandforms({ woods, roads: noRoads }));
  let read = 0;
  for (let x = 0; x <= 128; x += 2) {   // the river east-west down y = 64, the road crossing it down x = 64
    if (Math.abs(x - 64) <= reach) continue;
    assert.ok(Object.is(at(withRoad, x, 64), at(without, x, 64)), `x=${x}: the river's floor beside the road the floor without it`);
    if (Math.abs(x - 64) < LANDFORM_DIALS.ease.road) read++;
  }
  assert.ok(read > 10, `the floor read where the road eases the hills (${read})`);
});

test('LANDFORM7: a pure function of world position - every edge round the crossing and round the fixture\'s diagonal track, the pixels beside its corners too, one number from both pixels', () => {
  const lf = createLandforms({ woods, roads: CROSS }), lfNet = createLandforms({ woods, roads: NET });
  const pairs = [[lf, [[332, 229], [333, 229], [332, 230], [333, 230], [334, 230], [333, 231]]], [lfNet, [[290, 244], [291, 244], [290, 243], [292, 242], [293, 242], [292, 241], [293, 241]]]];
  for (const [shape, list] of pairs) {
    const cache = new Map(), S = (px, py) => { const k = `${px},${py}`; if (!cache.has(k)) cache.set(k, generateSamples(woods, px, py, H, shape)); return cache.get(k); };
    for (const [px, py] of list) {
      const a = S(px, py), east = S(px + 1, py), north = S(px, py - 1);
      for (let k = 0; k < H; k++) {
        assert.ok(Object.is(at(a, 128, k), at(east, 0, k)), `${px},${py} east edge ${k}`);
        assert.ok(Object.is(at(a, k, 128), at(north, k, 0)), `${px},${py} north edge ${k}`);
      }
    }
  }
});

test('LANDFORM7: never over the hills themselves - the knee\'s bound holds beside every way (a hill under 0.91 of the land\'s height over the knee)', () => {
  const h = hillsOf(CROSS, 333, 230);
  const { base, noise } = kernelTerms(woods, 333, 230, H);
  for (let x = 0; x <= 128; x += 8) for (let y = 0; y <= 128; y += 8) {
    const macro = base(x, y) * BASE_HEIGHT_SCALE + noise(x, y) * NOISE_MAP_SCALE;
    assert.ok(Math.abs(h.shaped(x, y)) <= Math.abs(h.whole(x, y)) + 2e-3, `(${x},${y}): eased, never more`);
    assert.ok(Math.abs(h.shaped(x, y)) < 0.91 * (macro - LANDFORM_KNEE), `(${x},${y}): under the knee's bound`);
  }
});
