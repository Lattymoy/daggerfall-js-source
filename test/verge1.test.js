// VERGE1 (2026-10-07, Mac: "Making sure objects, like trees, avoid pathways and roads. Currently they slightly
// overlap") - CLEAR ROADSIDES: a wilderness flat stands only where the disc of its widest picture - its classic
// picture's half width, or the crown Low Poly Trees stands for it at the tree's own scale - touches no road or track
// (world/roadVerge.js); the herbs and the veins on the stone keep their glow off them; World of Daggerfall's flats count
// their pictures; and the painter's path mask names a track laid over dirt (AUDIT FOREST1 F8, which never held).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { roadRoom, vergeClear, lptCrownOf, natureReach, PATH_HALF_M } from '../src/world/roadVerge.js';
import { LPT_CROWNS } from '../src/world/lptCrowns.js';
import { bakeLptCrowns, lptCrowns } from '../tools/bakeLptCrowns.mjs';
import { lptVariety } from '../src/world/lowPolyTrees.js';
import { MAP_W, MAP_H, DIR } from '../src/world/roadNetwork.js';
import { N, S, E, NE } from '../src/systems/travelPaths.js';
import { boxNearPath, UNITS_PER_METRE } from '../src/world/roadClearance.js';
import { paintRoads, TILE } from '../src/world/roadPainter.js';
import { layoutNature, natureStandsAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { standPatches, PATCH_MARK } from '../src/scenes/herbHost.js';
import { standMineNodes, standMotherlodes, MINE_MARKS, MOTHERLODE_MARK } from '../src/scenes/mineHost.js';
import { herbPatches } from '../src/net/nodeLaw.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { roadVergesOn } from '../src/scenes/shared.js';
import { FEATURES, checkFeature } from '../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { onlineForcedPref } from '../src/systems/onlineLane.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const netWith = (cells) => {
  const roads = new Uint8Array(MAP_W * MAP_H), tracks = new Uint8Array(MAP_W * MAP_H);
  for (const [x, y, bits, kind = 'roads'] of cells) (kind === 'tracks' ? tracks : roads)[x + y * MAP_W] = bits;
  return { roads, tracks };
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('VERGE1: the crowns are the vendored mod\'s - the bake re-run is the module byte for byte, and a crown is its mesh\'s farthest reach across the ground under the prefab\'s scale, rounded up (mutants: the reach along one axis; rounded down; the y axis read)', () => {
  const json = JSON.parse(read('vendor/low-poly-trees/Trees/trees.json'));
  const bin = readFileSync(new URL('../vendor/low-poly-trees/Trees/trees.bin', import.meta.url));
  const u8 = new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
  assert.equal(bakeLptCrowns(json, u8), read('src/world/lptCrowns.js'), 'node tools/bakeLptCrowns.mjs');
  assert.equal(Object.keys(LPT_CROWNS).length, 253, 'every prototype');
  // the temperate woods' Trees, summer, as measured: 5.5 to 11 metres about the trunk
  assert.deepEqual([12, 13, 14, 15, 16, 17, 18, 25, 30].map((r) => LPT_CROWNS[`504_${r}`]), [9.68, 7.24, 8.5, 8.96, 9.25, 10.88, 11.14, 5.8, 5.52]);
  // a crown is never short of its mesh: every vertex of every prototype inside it
  const f = new Float32Array(u8.buffer, u8.byteOffset, json.vertexBytes / 4);
  const raw = lptCrowns(json, u8);
  for (const [key, p] of Object.entries(json.prefabs)) {
    const m = json.meshes[p.mesh];
    let reach = 0, far = 0;
    for (let v = 0; v < m.vertices; v++) {
      const o = (m.vertex + v) * 8;
      const r = Math.hypot(f[o] * p.scale[0], f[o + 2] * p.scale[2]);
      reach = Math.max(reach, r); far = Math.max(far, Math.abs(f[o] * p.scale[0]));
    }
    assert.ok(raw[key] >= reach && raw[key] - reach < 0.01, `${key}: ${raw[key]} covers ${reach}`);
    assert.ok(reach >= far, `${key}: the disc holds the axis reach`);
  }
});

test('VERGE1: the room beside a road - 0 on the band, the distance past its edge off it, the band two tiles about the line from the pixel\'s centre (mutants: the half width; the arm\'s end not clamped; the band\'s edge not taken off)', () => {
  assert.equal(PATH_HALF_M, 6.4, 'Basic Roads paints two tiles');
  const ns = netWith([[500, 200, N | S]]);
  // the north-south road is the tiles 63 and 64: x from 403.2 to 416 m
  assert.deepEqual([403.2, 400, 396.8, 409.6, 416, 420, 430, 500].map((x) => +roadRoom(ns, 500, 200, x, 600, 40).toFixed(9)), [0, 3.2, 6.4, 0, 0, 4, 14, 40], 'its edges, either side; 40 the reach when none comes nearer');
  // a track is a path as a road is
  assert.equal(+roadRoom(netWith([[500, 200, N | S, 'tracks']]), 500, 200, 420, 600, 40).toFixed(9), 4, 'a track');
  // a diagonal: the distance to its line, perpendicular
  const d = netWith([[500, 200, NE]]);
  for (const off of [8, 12]) {
    const x = 600 + off / Math.SQRT2, z = 600 - off / Math.SQRT2;
    assert.ok(near(roadRoom(d, 500, 200, x, z, 40), off - 6.4, 1e-9), `${off} m off the diagonal's line`);
  }
  // an arm's end is round: a point beyond the end of the east arm, off its axis
  const e = netWith([[500, 200, E]]);
  assert.ok(near(roadRoom(e, 500, 200, 409.6 - 10, 409.6 - 10, 40), Math.hypot(10, 10) - 6.4), 'the disc to the arm\'s end');
  // ...where ROADS-CLEAR's grown square calls it near: the verge is the disc, not the square
  assert.equal(boxNearPath(e, 500, 200, (409.6 - 10) * UNITS_PER_METRE, (409.6 - 10) * UNITS_PER_METRE, (409.6 - 10) * UNITS_PER_METRE, (409.6 - 10) * UNITS_PER_METRE, 7.5 * UNITS_PER_METRE), true);
  assert.equal(vergeClear(e, 500, 200, 409.6 - 10, 409.6 - 10, 7.5), true, 'a 7.5 m crown there clears the road');
  assert.equal(vergeClear(e, 500, 200, 409.6 - 10, 409.6 - 10, 9), false, '...a 9 m one reaches it');
  // nothing painted, nothing asked
  assert.equal(roadRoom(null, 500, 200, 0, 0, 12), 12);
});

test('VERGE1: the room runs over the map pixel\'s edges - the arm in the pixel north, a diagonal\'s in the pixel across the corner - and never asks a pixel off the map (mutants: the own pixel alone; north the row below)', () => {
  // the pixel north (py - 1) carries the road's south arm: its band meets this pixel's north edge at x 403.2-416
  const north = netWith([[500, 199, S]]);
  assert.ok(near(roadRoom(north, 500, 200, 420, 815, 30), Math.hypot(10.4, 4.2) - 6.4), 'its round end at the edge');
  assert.equal(roadRoom(north, 500, 200, 420, 5, 30), 30, '...and nothing at the far edge');
  // the pixel across the north-east corner: its south-west arm runs to this pixel's corner
  const corner = netWith([[501, 199, 4]]);   // SW
  assert.ok(roadRoom(corner, 500, 200, 815, 815, 30) < 1, 'beside the corner the band is metres off');
  // the map's edge: no pixel past it is asked (dataPoint answers 0 there, and the walk is cut to the map)
  const edge = netWith([[MAP_W - 1, 0, N | E]]);
  assert.equal(+roadRoom(edge, MAP_W - 1, 0, 409.6 + 10.4, 600, 30).toFixed(9), 4, 'the edge pixel\'s own arm');
  assert.equal(roadRoom(edge, MAP_W - 1, 0, 819.2 - 1, 819.2 - 1, 30) <= 30, true);
});

test('VERGE1: a flat\'s reach - its classic picture\'s half width or its Low Poly tree\'s crown at the tree\'s own scale, the wider; the crown the summer tree\'s or the winter one\'s, the wider - a season moves no flat (mutants: the scale left off; the winter crown unasked; the picture unasked)', () => {
  assert.equal(lptCrownOf(504, 18), 11.14, 'the summer tree');
  assert.equal(lptCrownOf(504, 15), LPT_CROWNS['505_15'], 'the winter tree, wider');
  assert.ok(LPT_CROWNS['505_15'] > LPT_CROWNS['504_15']);
  assert.equal(lptCrownOf(503, 5), LPT_CROWNS['503_5'], 'a desert set has no winter one');
  assert.equal(lptCrownOf(504, 2), 0, 'a record the mod leaves a picture');
  const s = lptVariety(500, 200, 100, 100, false).scale;
  assert.ok(s >= 0.6 && s <= 1.4 && s !== 1);
  assert.equal(natureReach(2, 504, 18, 500, 200, 100, 100), 11.14 * s, 'the crown at the tree\'s scale');
  assert.equal(natureReach(20, 504, 18, 500, 200, 100, 100), 20, 'a picture wider than the crown');
  assert.equal(natureReach(2, 504, 2, 500, 200, 100, 100), 2, 'no crown: the picture');
});

test('VERGE1 (AUDIT FOREST1 F8): the painter marks a track laid over dirt - the tile left the ground\'s, the painter\'s answer unpainted, the mask the path\'s whole run; a road over dirt writes and marks as before (mutants: the mark dropped; the tile written)', () => {
  const dirt = new Uint8Array(129 * 129).fill(TILE.dirt);
  const tilemap = new Uint8Array(128 * 128), paths = new Uint8Array(128 * 128);
  const painted = paintRoads(dirt, tilemap, 0, DIR.N | DIR.S, null, 129, { paths });
  assert.equal(painted, 0, 'the mod writes nothing for a track over dirt');
  assert.equal(tilemap.some((t) => t !== 0), false, 'every tile the ground\'s');
  const marked = [];
  for (let i = 0; i < paths.length; i++) if (paths[i]) marked.push([i % 128, Math.floor(i / 128)]);
  assert.deepEqual([...new Set(marked.map(([x]) => x))].sort((a, b) => a - b), [63, 64], 'the track\'s two columns');
  assert.equal(marked.length, 256, '...the pixel\'s whole height');
  // the woods keep off it (FOREST1's mask, which never held)
  const heights = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.05);
  const tiles = new Uint8Array(128 * 128).fill(1);
  const flats = layoutNature(heights, tiles, { mapPixelX: 230, mapPixelY: 230, rawWorldHeight: 100, climateType: 2, locationRect: null, forests: { archive: 504, pois: [], paths } });
  const onTrack = flats.filter((f) => [63, 64].includes(Math.floor(f.x / 6.4)));
  assert.equal(onTrack.length, 0, 'no flat on the track over dirt');
  assert.ok(flats.length > 300, `the dirt either side still woods (${flats.length})`);
  const free = layoutNature(heights, tiles, { mapPixelX: 230, mapPixelY: 230, rawWorldHeight: 100, climateType: 2, locationRect: null, forests: { archive: 504, pois: [], paths: null } });
  assert.ok(free.some((f) => [63, 64].includes(Math.floor(f.x / 6.4))), 'without the mask a flat stood there');
  // a road over dirt: written and marked
  const t2 = new Uint8Array(128 * 128), p2 = new Uint8Array(128 * 128);
  assert.ok(paintRoads(dirt, t2, DIR.N | DIR.S, 0, null, 129, { paths: p2 }) > 0);
  for (let i = 0; i < t2.length; i++) assert.equal(!!p2[i], t2[i] !== 0, `a road's tile ${i} is written exactly where marked`);
});

const WOODS = CLIMATES.Woodlands;
const flatGrass = () => ({ samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2) });

test('VERGE1: a herb patch keeps its glow off the roads - the verge asked with half the glow\'s width at the patch\'s point, a refused one standing nowhere and the rest as they stood (mutants: the reach the plant\'s; the clear unasked)', () => {
  const { samples, tilemap } = flatGrass();
  const day = 20000;
  const law = herbPatches({ x: 405, y: 150, day, climate: WOODS });
  assert.ok(law.length >= 2, 'the day has patches');
  const all = standPatches({ px: 405, py: 150, day, climate: WOODS, samples, tilemap });
  assert.equal(all.length, law.length);
  const asked = [];
  const none = standPatches({ px: 405, py: 150, day, climate: WOODS, samples, tilemap, verge: (x, z, r) => { asked.push([x, z, r]); return false; } });
  assert.deepEqual(none, [], 'every patch refused');
  assert.ok(asked.length >= all.length && asked.every(([, , r]) => r === PATCH_MARK.w / 2), 'each asked with its glow\'s half width, 1.1 m');
  assert.equal(PATCH_MARK.w / 2, 1.1);
  const first = all[0];
  const one = standPatches({ px: 405, py: 150, day, climate: WOODS, samples, tilemap, verge: (x, z) => !(x === first.local[0] && z === first.local[2]) });
  assert.equal(one.length, all.length - 1, 'the one on the verge alone');
  assert.equal(one.some((p) => p.slot === first.slot), false);
  // natureStandsAt answers the road's question last, at the stand it would give
  const at = natureStandsAt(samples, tilemap, null, 10, 12);
  assert.ok(at);
  assert.equal(natureStandsAt(samples, tilemap, null, 10, 12, () => false), null);
  assert.deepEqual(natureStandsAt(samples, tilemap, null, 10, 12, (x, z) => x === at.x && z === at.z), at);
});

test('VERGE1: a vein on the stone and a Motherlode keep their glow off the roads - the nearest stone the road leaves them (mutants: the vein\'s reach the Motherlode\'s; the verge never handed to the stone\'s search)', () => {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap = new Uint8Array(128 * 128).fill(3);
  const day = 20000, MOUNTAIN = 226, REGION = 6;
  const plain = standMineNodes({ px: 400, py: 200, day, climate: MOUNTAIN, region: REGION, samples, tilemap }).filter((n) => n.what === 'vein');
  assert.ok(plain.length > 0, 'the day has veins on the stone');
  const asked = new Set();
  // a road down x = 0..40 m: every stand within reach of it refused
  const verge = (x, z, r) => { asked.add(r); return x - r > 40; };
  const kept = standMineNodes({ px: 400, py: 200, day, climate: MOUNTAIN, region: REGION, samples, tilemap, verge }).filter((n) => n.what === 'vein');
  assert.deepEqual([...asked], [MINE_MARKS.vein.w / 2], 'the vein\'s glow, 0.8 m');
  assert.equal(kept.length, plain.length, 'every vein still stands - on the nearest stone the road leaves it');
  assert.ok(kept.every((n) => n.local[0] - 0.8 > 40));
  const lode = { k: 0, key: 'lode', x: 300, y: 120, climate: 226, region: 21, material: 'ore:ebony' };
  const mAsked = new Set();
  const [m] = standMotherlodes({ lodes: [lode], samples, tilemap, rocks: [], verge: (x, z, r) => { mAsked.add(r); return Math.abs(x - 409.6) - r > 20; } });
  assert.ok(m, 'it stands');
  assert.deepEqual([...mAsked], [MOTHERLODE_MARK.w / 2], 'its heap\'s glow, 1.7 m');
  assert.ok(Math.abs(m.local[0] - 409.6) - 1.7 > 20, 'off the road through the pixel\'s heart');
});

test('VERGE1: the switch - the row, the enhanced skin, ?verges=off; online the room\'s', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.roadVerges;
  assert.equal(pref, true, 'on by default');
  try {
    setUiSkin('enhanced'); setPref('roadVerges', true);
    assert.equal(roadVergesOn(''), true);
    assert.equal(roadVergesOn('?verges=off'), false, 'the kill door');
    setPref('roadVerges', false);
    assert.equal(roadVergesOn(''), false, 'the row is the switch');
    assert.equal(roadVergesOn('?online=1'), true, 'online: where the wild\'s flats stand is the room\'s ground');
    setPref('roadVerges', true); setUiSkin('classic');
    assert.equal(roadVergesOn(''), false, 'offline, the classic skin stands DFU\'s flats where DFU stands them');
    assert.equal(roadVergesOn('?online=1&verges=off'), true, 'the kill door is offline\'s');
  } finally { setUiSkin(skin); setPref('roadVerges', pref); }
  assert.equal(onlineForcedPref('roadVerges', '?online=1'), true);
  const row = FEATURES.find((f) => f.id === 'road-verges');
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual([...row.kinds], ['enhanced']);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'roadVerges', initial: true, online: true });
});

test('VERGE1: the world host - the switch read once at its mount; each wild flat\'s reach asked of the roads the kernel painted, after the gate and the rocks; a site\'s flat its picture; the gathering nodes handed the pixel\'s verge (mutants: the verge on the network before it painted; the half widths a replacement\'s; the site\'s flat its root alone)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const verges = roadVergesOn\(\);/);
  assert.equal((w.match(/roadVergesOn\(/g) ?? []).length, 1, 'once, not a pixel at a time');
  assert.match(w, /hw = Float64Array\.from\(\{ length: t\.recordCount \}, \(_, r\) => classicBillboardSize\(t, r\)\.w \/ 2\);/, 'DFU\'s own record size, never a replacement\'s');
  assert.match(w, /const vergeNet = verges && withRoads \? terrainGen\.roads\(\) : null;/, 'the network the kernel painted with, or none');
  assert.match(w, /if \(forests && insideRocks\(pixelRocks, f\.x, f\.z\)\) continue;\n[^\n]*\n\s+const base = f\.archive \?\? climate\.natureArchive, archive = [^\n]*\n[^\n]*\n\s+if \(vergeNet && !vergeClear\(vergeNet, px, py, f\.x, f\.z, natureReach\(vergeHalf\.get\(base\)\[f\.record\] \?\? 0, base, f\.record, px, py, f\.x, f\.z\)\)\) \{ vergeOff\+\+; continue; \}/, 'after the gate and the rocks, before the flat is added');
  assert.match(w, /if \(vergeNet && !vergeClear\(vergeNet, px, py, f\.base\[0\], f\.base\[2\], WOD_PIECE_ROAD_CLEAR \/ UNITS_PER_METRE \+ \(\(await halfWidthsOf\(f\.archive\)\)\[f\.record\] \?\? 0\) \* f\.scale\.x\)\) \{ _wodOffRoad\+\+; continue; \}/, 'a site\'s flat: its picture past the pieces\' margin');
  assert.match(w, /verge: vergeNet \? \(x, z, reach\) => vergeClear\(vergeNet, px, py, x, z, reach\) : null,/, 'the entry\'s road question');
  assert.match(read('src/scenes/herbHost.js'), /verge: entry\.verge \?\? null,/);
  assert.match(read('src/scenes/mineHost.js'), /verge: entry\.verge \?\? null,/);
});
