// FLORA-GROUND, THE RINGS (FIELD BUGS 2026-10-27, the owner: "No band aids or half assed work"; the coordinator: "Fix it
// at the root in the terrain's level of detail, so the coarse surface the player sees and the ground the plants stand on
// agree at every ring") - A BUILT PIXEL'S PLANTS DRAWN ON THE GROUND IT DRAWS: the ground a pixel draws one law
// (world/terrain/terrainSurface.js drawnGroundAt - its stride, its bed), which the snow lies on, and every plant of the
// ground drawn on it at every ring by the seat (scenes/floraSeat.js seatFlora) - the woods' batches, a town's nature
// flats, the jungle's, a felled tree under it, the graht-oaks framed on it - and seated again wherever the hosts change
// the ground they draw (a restride, a re-carve, the build's publish, a re-skin). Pinned on made ground (a saddle field
// the far ring's coarse quads cannot follow); on the game's own ground with ARENA2 in floraground_real.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { HEIGHTMAP_DIMENSION as H, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, SCALED_BEACH_ELEVATION } from '../../../src/world/terrain/terrainSampler.js';
import { walkGroundAt, drawnGroundAt, buildTerrainGrid, buildTerrainIndices } from '../../../src/world/terrain/terrainSurface.js';
import { carveBed } from '../../../src/world/water/waterBed.js';
import { MAX_STEEPNESS, SLOPE_SINK_RATIO } from '../../../src/world/terrain/terrainNature.js';
import { seatFlora, standsOnGround, drawnCentre, ringLifts, warmFlora } from '../../../src/scenes/floraSeat.js';
import { sinkFelled } from '../../../src/scenes/treeHost.js';
import { FELLED } from '../../../src/ai/cover.js';
import { flatBatchAabb } from '../../../src/render/frustum.js';
import { createGrahtHost, GRAHT_SLOT } from '../../../src/scenes/grahtHost.js';
import { GRAHT_TREE_FLOATS } from '../../../src/world/jungle/grahtOaks.js';
import { hostText } from '../../hostText.mjs';

const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // a normalized sample in metres
const CELL = TERRAIN_SIZE / (H - 1);
const SINK = MAX_STEEPNESS / SLOPE_SINK_RATIO;   // the deepest a flat is sunk into its slope (DFU's steepness / 70)
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A saddle field over the beach line: a crossed ripple of 14 to 18 samples a wave, which the far ring's quads (four
 *  samples a side) cut through - its ground parts from the near grid's by metres. */
function saddleField() {
  const hm = new Float32Array(H * H);
  const beach = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT;
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) hm[a * H + b] = beach * 1.6 + 0.003 * Math.sin(a / 2.3) * Math.sin(b / 2.9);
  return hm;
}

/** A bed carved under part of a grid (`stride` its class): depths over a lake in the field's south-west, 0 elsewhere. */
function bedOf(stride) {
  const g = 128 / stride + 1, d = new Float32Array(g * g);
  for (let z = 0; z < g; z++) for (let x = 0; x < g; x++) {
    const r = Math.hypot(x * stride * CELL - 200, z * stride * CELL - 260);
    if (r < 120) d[z * g + x] = 2.5 * (1 - r / 120);
  }
  return d;
}

/** THE GROUND A PIXEL DRAWS, read off the mesh itself: its grid at `stride` (buildTerrainGrid), its bed carved off it
 *  (waterBed.js carveBed) and its triangles (buildTerrainIndices) - a vertical line met with the triangle under it, no
 *  law of the code under test. */
function drawnOracle(hm, stride = 1, carve = null) {
  const grid = buildTerrainGrid(hm, stride), g = 128 / stride + 1;
  const positions = carve ? carveBed(grid.positions, grid.normals, carve, g, g).positions : grid.positions;
  const idx = buildTerrainIndices(stride), q = 128 / stride, cell = CELL * stride;
  return (x, z) => {
    const qx = Math.min(q - 1, Math.floor(x / cell)), qz = Math.min(q - 1, Math.floor(z / cell)), o = (qz * q + qx) * 6;
    for (let t = 0; t < 2; t++) {
      const [a, b, c] = [0, 1, 2].map((k) => idx[o + t * 3 + k] * 3).map((i) => [positions[i], positions[i + 1], positions[i + 2]]);
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
      const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * a[1] + l2 * b[1] + l3 * c[1];
    }
    throw new Error(`no triangle under ${x}, ${z}`);
  };
}

/** Points over the pixel, quad edges and corners among them. */
function lattice() {
  const out = [];
  for (let k = 0; k < 900; k++) out.push([((k * 0.6180339887) % 1) * TERRAIN_SIZE, ((k * 0.7548776662) % 1) * TERRAIN_SIZE]);
  for (const v of [0, 25.6, 102.4, 409.6, 819.2]) for (const w of [0, 12.8, 51.2, 700.8, 819.2]) out.push([v, w]);
  return out;
}

/** A pixel's plants: on the walk floor, each sunk by its slope's share - but every seventh a town's tree a mound raised
 *  2.5 m off the ground (no plant of the ground: never marked). */
function plantsOn(hm, n = 400) {
  const centers = [], ground = [];
  for (let k = 0; k < n; k++) {
    const x = 3 + ((k * 0.3819660113) % 1) * (TERRAIN_SIZE - 6), z = 3 + ((k * 0.5698402910) % 1) * (TERRAIN_SIZE - 6);
    const onGround = k % 7 !== 3;
    const c = [x, walkGroundAt(hm, x, z) + (onGround ? -SINK * ((k % 5) / 4) : 2.5), z];
    if (onGround) standsOnGround(c);
    centers.push(c); ground.push(onGround);
  }
  return { centers, ground };
}

/** The centres' places alone - OW-SEAT's mark (floraSeat.js ON_GROUND) rides a ground plant's own array. */
const xyz = (cs) => cs.map((c) => [c[0], c[1], c[2]]);

/** A renderer that keeps what each batch was last drawn at. */
function drawRecorder() {
  const at = new Map();
  let moves = 0;
  return { at, get moves() { return moves; }, moveBillboardBatch(b, c) { moves++; at.set(b, c.map((v) => [...v])); return true; } };
}

test('FLORA-GROUND THE RINGS the ground a pixel draws is one law: drawnGroundAt is the terrain surface\'s own vertices and triangles at the near grid\'s stride and the far ring\'s, with the bed its water carved and without, the walk floor its near ring with no bed - and on this field the far ring parts from the walk floor by metres (mutants: the ring\'s stride; the bed unread; the bed\'s cell)', () => {
  const hm = saddleField(), pts = lattice();
  let apart = 0;
  for (const stride of [1, 4]) {
    for (const carve of [null, bedOf(stride)]) {
      const drawn = drawnOracle(hm, stride, carve);
      let worst = 0;
      for (const [x, z] of pts) worst = Math.max(worst, Math.abs(drawnGroundAt(hm, x, z, stride, carve) - drawn(x, z)));
      assert.ok(worst < 1e-3, `stride ${stride}${carve ? ', the bed carved' : ''}: the law ${worst.toFixed(5)} m off the drawn mesh`);
    }
  }
  for (const [x, z] of pts) {
    assert.equal(drawnGroundAt(hm, x, z), walkGroundAt(hm, x, z), 'the near ring with no bed is the walk floor');
    apart = Math.max(apart, Math.abs(drawnGroundAt(hm, x, z, 4) - walkGroundAt(hm, x, z)));
  }
  assert.ok(apart > 1, `the far ring's ground parts from the walk floor by ${apart.toFixed(2)} m on this field`);
  assert.match(src('src/systems/snowfall/snowGroundLaw.js'), /return drawnGroundAt\(p\.samples, lx, lz, p\._stride \?\? 1, p\._bed\?\.depths \?\? null\);/, 'the snow lies on the same law, its bed with it');
});

test('FLORA-GROUND THE RINGS every plant of the ground is drawn on the ground its pixel draws, at every ring: at stride 4 each on the far ring\'s mesh by its own sink, a mound\'s tree where it stands, the cull boxes with them; again at the same ring nothing moves; at stride 1 each back on the walk floor; a bed carved under it in the near ring, each on the carved ground (mutants: the mark unread; the lift reversed; the near ring\'s bed ignored; the seat that never moves; the box left behind; the pixel\'s box ungrown; the lift kept across a re-carve)', () => {
  const hm = saddleField();
  const { centers, ground } = plantsOn(hm);
  const r = drawRecorder();
  const batch = { id: 'woods' }, size = { w: 3, h: 7 };
  const g = { batch, centers, size };
  const p = { samples: hm, _stride: 4, _bed: null, _box: [0, 0, 0, 1, 1, 1], forest: { groups: new Map([['504_3', g]]) } };
  const far = drawnOracle(hm, 4);
  let stoodOff = 0;
  for (let i = 0; i < centers.length; i++) if (ground[i] && Math.abs(walkGroundAt(hm, centers[i][0], centers[i][2]) - far(centers[i][0], centers[i][2])) > 0.25) stoodOff++;
  assert.ok(stoodOff > centers.length / 10, `${stoodOff} plants' ground more than 25 cm off the far ring's mesh before the seat - the field reaches the bug`);
  seatFlora(p, r);
  const drawn = r.at.get(batch);
  assert.ok(drawn, 'the far ring\'s batch moved');
  for (let i = 0; i < centers.length; i++) {
    const [x, , z] = centers[i];
    if (!ground[i]) { assert.deepEqual(drawn[i], centers[i], 'a mound\'s tree keeps its picture where it stands'); continue; }
    const rise = centers[i][1] - walkGroundAt(hm, x, z);
    assert.ok(Math.abs(drawn[i][1] - rise - far(x, z)) < 1e-3, `plant ${i} drawn ${(drawn[i][1] - rise - far(x, z)).toFixed(4)} m off the far ring's ground`);
    assert.equal(drawn[i][0], x); assert.equal(drawn[i][2], z);
  }
  assert.ok(centers.every((c, i) => !ground[i] || Math.abs(c[1] - (walkGroundAt(hm, c[0], c[2]) - SINK * ((i % 5) / 4))) < 1e-9), 'the plants\' places stay the walk floor\'s');
  assert.deepEqual(batch._box, flatBatchAabb(drawn, size), 'its cull box where it is drawn');
  for (let k = 0; k < 3; k++) assert.ok(p._box[k] <= batch._box[k] && p._box[3 + k] >= batch._box[3 + k], 'the pixel\'s box holds it');
  const moves = r.moves;
  seatFlora(p, r);
  assert.equal(r.moves, moves, 'seated again at the same ring: nothing moves');
  p._stride = 1;
  seatFlora(p, r);
  assert.deepEqual(r.at.get(batch), xyz(centers), 'promoted: every plant back on the walk floor');
  const bed = bedOf(1), carved = drawnOracle(hm, 1, bed);
  p._bed = { depths: bed };
  seatFlora(p, r);
  let onBed = 0;
  for (let i = 0; i < centers.length; i++) {
    if (!ground[i]) continue;
    const [x, , z] = centers[i], rise = centers[i][1] - walkGroundAt(hm, x, z), at = r.at.get(batch)[i][1];
    assert.ok(Math.abs(at - rise - carved(x, z)) < 1e-3, `plant ${i} on the carved near ground`);
    if (walkGroundAt(hm, x, z) - carved(x, z) > 0.05) onBed++;
  }
  assert.ok(onBed > 5, `${onBed} plants over the bed, drawn down onto it`);
  const bed2 = bedOf(1).map((d) => d * 0.5);
  p._bed = { depths: bed2 };
  seatFlora(p, r);
  const carved2 = drawnOracle(hm, 1, bed2);
  assert.ok(centers.every((c, i) => !ground[i] || Math.abs(r.at.get(batch)[i][1] - (c[1] - walkGroundAt(hm, c[0], c[2])) - carved2(c[0], c[2])) < 1e-3), 're-carved: each on the bed as it lies now');
  assert.equal(ringLifts(hm, centers, 1, null), null, 'the near ring with no bed lifts nothing');
});

test('FLORA-GROUND THE RINGS a felled tree lies under the ground its pixel draws: Logging\'s sink draws each centre through the ring\'s one law (floraSeat.js drawnCentre), a restride keeps the felled one down and the rest on the new ground (mutants: the sink off the ring; the felled tree stood up by the restride; the ring\'s lift dropped from the sink)', () => {
  const hm = saddleField();
  const { centers, ground } = plantsOn(hm, 60);
  const r = drawRecorder();
  const batch = { id: 'forest' }, size = { w: 3, h: 7 };
  const groups = new Map([['504_5', { batch, centers, size }]]);
  const p = { samples: hm, _stride: 4, _bed: null, _box: [0, 0, 0, 1, 1, 1], forest: { groups } };
  seatFlora(p, r);
  const far = drawnOracle(hm, 4), f = ground.indexOf(true);
  sinkFelled(p.forest, new Set([`504_5#${f}`]), r);
  const rise = (i) => centers[i][1] - walkGroundAt(hm, centers[i][0], centers[i][2]);
  const atFar = r.at.get(batch);
  assert.ok(Math.abs(atFar[f][1] - (far(centers[f][0], centers[f][2]) + rise(f) - size.h - 1)) < 1e-3, 'the felled tree under the far ring\'s ground by its height and a metre');
  for (let i = 0; i < centers.length; i++) if (i !== f && ground[i]) assert.ok(Math.abs(atFar[i][1] - rise(i) - far(centers[i][0], centers[i][2])) < 1e-3, 'the rest on it');
  assert.ok(FELLED.has(centers[f]));
  p._stride = 1;
  seatFlora(p, r);
  const near = r.at.get(batch);
  assert.ok(Math.abs(near[f][1] - (centers[f][1] - size.h - 1)) < 1e-9, 'promoted, the felled tree still down - under the walk floor');
  assert.deepEqual(near.filter((_, i) => i !== f), xyz(centers.filter((_, i) => i !== f)), 'and the rest on the walk floor');
  assert.equal(drawnCentre({ lift: null, size }, centers[1], 1, false), centers[1], 'a centre nothing moves is the centre itself');
  sinkFelled(p.forest, new Set(), r);
  assert.deepEqual(r.at.get(batch), xyz(centers), 'a day\'s turn stands it again');
});

/** A renderer that records what it is asked - the GPU's calls through a GL that answers anything (GRAHT1's own). */
function grahtRenderer() {
  const calls = [];
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); return {}; }) });
  return {
    gl, calls, slots: [], _casting: false, _fogMode: 0, _fogRange: [0, 0],
    setLowPolyTrees(fr, s) { this.slots[s] = fr; },
    createAtlasTexture(w, h, n) { return { w, h, n }; }, uploadAtlasRows() {}, releaseAtlasTexture() {},
    createMesh(m) { return { vao: {}, model: m }; }, destroyMesh() {}, recordShadowMesh() {},
  };
}

test('FLORA-GROUND THE RINGS the graht-oaks stand on the ground their pixel draws: the seat gives the set each root\'s lift, and their host frames each tree at its root on that ground - its place, its bodies, the walk floor\'s (mutants: the set\'s lift unset; the frame blind to it)', async () => {
  const hm = saddleField();
  const roots = [[120.4, 300.2], [500.9, 77.7], [700.1, 650.3]];
  const trees = new Float32Array(roots.length * GRAHT_TREE_FLOATS);
  roots.forEach(([x, z], k) => { const o = k * GRAHT_TREE_FLOATS; trees[o] = x; trees[o + 1] = walkGroundAt(hm, x, z); trees[o + 2] = z; trees[o + 3] = 0.5; trees[o + 4] = 1; trees[o + 5] = k % 3; });
  const p = { samples: hm, _stride: 4, _bed: null, forest: { groups: new Map() }, grahtOaks: { px: 1, py: 2, trees }, _t: [0, 0, 0] };
  seatFlora(p, drawRecorder());
  const far = drawnOracle(hm, 4);
  assert.ok(p.grahtOaks.lift, 'the far ring lifts the set');
  roots.forEach(([x, z], k) => assert.ok(Math.abs(trees[k * GRAHT_TREE_FLOATS + 1] + p.grahtOaks.lift[k] - far(x, z)) < 1e-3, `oak ${k} on the far ring's ground`));
  assert.ok(roots.some(([x, z]) => Math.abs(walkGroundAt(hm, x, z) - far(x, z)) > 0.25), 'the field parts them');
  const r = grahtRenderer();
  const host = createGrahtHost({ renderer: r, breathe: async () => {} });
  await host.prepare();
  host.frame([p], [400, 50, 400], null);
  const up = r.calls.filter((c) => c[0] === 'bufferSubData').at(-1)[3];
  const ys = [];
  for (let i = 0; i < host.stats.drawn; i++) ys.push([up[i * 5], up[i * 5 + 1]]);
  assert.equal(ys.length, roots.length, 'every oak drawn');
  for (const [x, y] of ys) {
    const k = roots.findIndex(([rx]) => Math.abs(rx - x) < 1e-3);
    assert.ok(Math.abs(y - Math.fround(far(roots[k][0], roots[k][1]))) < 1e-2, `the oak at ${x.toFixed(1)} framed on the far ring's ground`);
  }
  p._stride = 1;
  seatFlora(p, drawRecorder());
  assert.equal(p.grahtOaks.lift, null, 'promoted: on the walk floor');
  host.destroy?.();
  assert.equal(GRAHT_SLOT, 2);
});

test('FLORA-GROUND THE RINGS the hosts seat the plants wherever the ground they draw changes - a restride (its new class), a re-carve (Deep Waters\' TileMap), the build (before it publishes and its felled trees are sunk), a re-skin (its new pictures, after its box) - and the build marks every plant of the ground: the wild\'s flats, the jungle\'s, a town\'s nature on its ground but not on a mound (mutants: each seat dropped; each mark dropped; a mound\'s tree marked)', () => {
  const W = hostText('src/scenes/world.js');
  const re = W.slice(W.indexOf('function restrideTerrain(p, stride'), W.indexOf('function destroyPixel('));
  assert.match(re, /p\._stride = stride;\n\s+seatFlora\(p, renderer\);/, 'a restride seats its plants at the new class, after the class is written');
  const rc = W.slice(W.indexOf('function dwRecarve(p) {'), W.indexOf('function hostBed('));
  assert.match(rc, /p\._bed = \{ grid: grid\.positions[^\n]*\n\s+if \(!moved\) return;\n[\s\S]*?\n\s+seatFlora\(p, renderer\);/, 'a re-carve seats them on the bed as it lies');   // PIN MOVED (WATER-LEVEL): the bed kept first, the ground uploaded and seated where the carve moved
  const B = src('src/scenes/pixelBuild.js');
  const seat = B.indexOf('seatFlora({ samples, _stride: stride, _bed: bed, _box: bounds, forest: { groups: forestGroups }, grahtOaks: grahtStood?.set ?? null, landProps: landStood?.set ?? null }, renderer);');   // PIN MOVED (TESA-LANDS, the merge with FLORA-GROUND): and the lands' landmarks (test/world/tesalands_props.test.js)
  assert.ok(seat > B.indexOf('for (const [gk, g] of jungleGroups) {') && seat > B.indexOf('const grahtStood = '), 'the build seats them once every group and the graht-oaks stand');
  assert.ok(seat < B.indexOf('swap.publish(px, py, key, made, {') && seat < B.indexOf('host.gatherHost?.onBuilt(built.get(pkey));'), 'before it publishes - before its felled trees are sunk in it');
  assert.match(B, /_box: bounds,[^\n]*\n\s+_stride: stride,[^\n]*\n\s+_bed: bed,/, 'the very box, ring and bed the entry publishes with');
  const skin = B.slice(B.indexOf('async function reskinPixelNow'), B.indexOf('_reskin.skinWith('));
  assert.ok(skin.indexOf('seatFlora(p, renderer);') > skin.indexOf('for (let i = 0; i < 6; i++) p._box[i] = flats.box[i];'), 'a re-skin seats its new pictures, after its box is laid');
  assert.match(B, /flatLog\.push\(\{ archive, record, c, \.\.\.skin \}\);\n\s+if \(skin\?\.wild != null\) standsOnGround\(c\);/, 'the wild\'s flats marked as they are logged');
  assert.match(B, /for \(const \[gk, g\] of jungleGroups\) \{\n\s+await breather\.breathe\(\);\n\s+g\.centers\.forEach\(standsOnGround\);/, 'the jungle\'s trees and pairs');
  // PIN MOVED (SOLITUDE-RELIEF, bible/03-World/Arena-Provinces.md): the hill ground read off its block's tier, its flat stood off it
  assert.match(B, /const hillY = hillSeat && isNatureArchive\(flat\.archive\) \? NATURE_FLATS_Y \+ off - \(blockY - locLocal\[1\]\) : null;/);
  assert.match(B, /\n\s+if \(hillY !== null \? seatNatureFlat\(hillSeat, flat\.x, flat\.z, hillY\) === hillY : flat\.archive === natureArchive\) standsOnGround\(flatLog\[flatLog\.length - 1\]\.c\);/, 'a town\'s nature flat on its ground, a mound\'s not');
  assert.match(src('src/scenes/grahtHost.js'), /const y0 = lift \? tr\[i \+ 1\] \+ lift\[i \/ GRAHT_TREE_FLOATS\] : tr\[i \+ 1\];/, 'the graht-oaks framed at their lift');
});

test('FLORA-GROUND THE RINGS a pixel built about the player makes its far ring\'s lifts ahead, in its build\'s own breath: nothing is drawn by them while it stands near, and the crossing that first sends it out takes them and reads no ground (mutants: the lifts not made ahead; the build\'s warm dropped; the far class not handed to the build)', () => {
  const hm = saddleField();
  const { centers, ground } = plantsOn(hm, 120);
  const r = drawRecorder();
  const batch = { id: 'near-built' }, g = { batch, centers, size: { w: 3, h: 7 } };
  const trees = Float32Array.of(300.5, walkGroundAt(hm, 300.5, 410.2), 410.2, 0, 1, 0);
  const p = { samples: hm, _stride: 1, _bed: null, _box: [0, 0, 0, 1, 1, 1], forest: { groups: new Map([['504_9', g]]) }, grahtOaks: { trees } };
  seatFlora(p, r);
  warmFlora(p, 4);
  const made = g._ringLift?.lift, oak = p.grahtOaks._ringLift?.lift;
  assert.ok(made instanceof Float32Array && oak instanceof Float32Array, 'the far ring\'s lifts made ahead, the woods\' and the oaks\'');
  assert.equal(r.moves, 0, 'and nothing moved by them: the pixel draws the near ring');
  assert.equal(p.grahtOaks.lift ?? null, null);
  p._stride = 4;
  seatFlora(p, r);
  assert.equal(g.lift, made, 'the crossing takes the lifts made ahead');
  assert.equal(p.grahtOaks.lift, oak);
  const far = drawnOracle(hm, 4), at = r.at.get(batch);
  centers.forEach((c, i) => { if (ground[i]) assert.ok(Math.abs(at[i][1] - (c[1] - walkGroundAt(hm, c[0], c[2])) - far(c[0], c[2])) < 1e-3); });
  const B = src('src/scenes/pixelBuild.js');
  const seat = B.indexOf('seatFlora({ samples, _stride: stride, _bed: bed, _box: bounds,'), warm = B.indexOf('if (stride === 1 && lodStride > 1) { await breather.breathe(); warmFlora({ samples, forest: { groups: forestGroups }, grahtOaks: grahtStood?.set ?? null, landProps: landStood?.set ?? null }, lodStride); }');   // PIN MOVED (TESA-LANDS): and the landmarks
  assert.ok(seat > 0 && warm > seat && warm < B.indexOf('swap.publish(px, py, key, made, {'), 'a near build makes them after its seat, before it publishes');
  assert.match(B, /worldHeight, lodStride,/, 'the build takes the far class');
  assert.match(hostText('src/scenes/world.js'), /const lodStride = lodOn \? LOD_STRIDE : 1;/, 'the world host hands it: EV4\'s stride, none on the 1:1 lane');   // PIN MOVED (AUDIT SHIP-READY S7, HOST-SPLIT's seam): a binding of the host's, handed by name
});
