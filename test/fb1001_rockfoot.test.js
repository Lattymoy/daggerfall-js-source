// FIELD BUGS 2026-10-01 - "People are trying to mine boulders on the outside, but it's not letting people mine" (Mac).
//
// ROCK-FOOT. A boulder is a rock field's piece (PROF0 23), and the pieces were carried as their WHOLE mesh's box
// (scenes/world.js pixelRocks). World of Daggerfall's fields are a few models scaled by tens to hundreds, turned and
// sunk, so a piece's box ran far past the rock that shows - and it is that box a boulder's foot stood on the edge of,
// and that every other foot was asked to stay out of (AUDIT 29 C11). On the shipped layouts a boulder's one foot fell
// inside a neighbour's box most of the time, and then nothing stood: the piece was spent, no other piece or side was
// asked, and the veins had already taken the field's clear pieces. Where one did stand, its stones lay on the box's
// edge, metres to hundreds of metres off any rock a player could see. Now a piece is carried as it stands out of the
// ground (terrainNature.js rockFootprint), a node takes the nearest piece with a clear foot on any side (the side facing
// its point first), and the boulders claim before the veins (a vein has the stone beside the field to fall back on, a
// boulder has nothing). The real meshes are ARENA2's; a cube stands in for each model over the shipped layouts' own
// transforms, at the sizes and origins that bracket a real rock's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { rockFootprint, groundAt, insideRocks } from '../src/world/terrainNature.js';
import { standMineNodes, mineKind, ROCK_OFFSET, NODE_SPACING_M, FOOT_INSET_M } from '../src/scenes/mineHost.js';
import { createGatherHost } from '../src/scenes/gatherHost.js';
import { boulders, veins, nodeCount } from '../src/net/nodeLaw.js';
import { objectMatrix } from '../src/world/wodLocationObjects.js';
import { loadLocationPrefab } from '../src/world/wodLocationData.js';
import { LocationSession, pickLocations, placeObjects, WOD_TERRAIN_HEIGHT_MAX } from '../src/world/wodLocationLoader.js';
import { decodeRegionPack } from '../src/world/wodLocationPack.js';
import { transformedAabb } from '../src/render/frustum.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const WOODS = CLIMATES.Woodlands, MOUNTAIN = CLIMATES.Mountain, GLENUMBRA = 59;
const PX = 405, PY = 150, DAY = 20500;
const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
const G = groundAt(samples, 400, 400);
const grass = new Uint8Array(128 * 128).fill(2);

/** A box mesh [x0..x1] x [y0..y1] x [z0..z1], model-local: its eight corners and twelve faces. */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const positions = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  return { positions, indices };
}
const unit = boxMesh(-1, -1, -1, 1, 1, 1);
/** A piece's matrix at pixel-local (x, y, z), rolled `roll` about the north (z) axis, scaled. */
function piece(x, y, z, s, roll = 0) {
  return objectMatrix([x, y, z], { x: 0, y: 0, z: Math.sin(roll / 2), w: Math.cos(roll / 2) }, { x: s, y: s, z: s });
}
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

test('ROCK-FOOT rockFootprint: a piece as it stands out of the ground - a sunk rock its cut at the ground, never its whole box; a buried one none (mutants: the ground unasked; the cut at the ground left out)', () => {
  // a 10 m cube sunk to its middle, square to the axes: its footprint is its square
  const half = rockFootprint(unit.positions, unit.indices, piece(400, G, 400, 5), samples);
  assert.ok(near(half[0], 395) && near(half[3], 405) && near(half[2], 395) && near(half[5], 405));
  assert.ok(near(half[1], G) && near(half[4], G + 5), 'from the ground to its top');
  // the same cube stood on its edge (rolled 45 degrees) and sunk to 2 m under its middle: the ground cuts it where it
  // is 2 * (7.07 - 2) = 10.14 m across - the box of the whole mesh is 14.14 m, and the top that shows (its upper edge,
  // its only corners above the ground) is a line
  const edge = rockFootprint(unit.positions, unit.indices, piece(400, G - 2, 400, 5, Math.PI / 4), samples);
  const full = transformedAabb([-1, -1, -1, 1, 1, 1], piece(400, G - 2, 400, 5, Math.PI / 4));
  assert.ok(near(full[3] - full[0], 14.142, 1e-2), 'its whole box');
  assert.ok(near(edge[3] - edge[0], 2 * (5 * Math.SQRT2 - 2), 1e-3), `cut at the ground: ${(edge[3] - edge[0]).toFixed(3)} m across`);
  assert.ok(near(edge[2], 395) && near(edge[5], 405), 'its length along the edge as it is');
  // a hill: scaled by a hundred and rolled, its middle 95 m down - the top of it shows, and its box is a field wide
  const hill = rockFootprint(unit.positions, unit.indices, piece(400, G - 95, 400, 100, 0.6), samples);
  const hillBox = transformedAabb([-1, -1, -1, 1, 1, 1], piece(400, G - 95, 400, 100, 0.6));
  assert.ok(hillBox[3] - hillBox[0] > 150, 'the mesh\'s box is a field wide');
  assert.ok(hill[3] - hill[0] < (hillBox[3] - hillBox[0]) / 2, `across its roll, what shows is a fraction of it (${(hill[3] - hill[0]).toFixed(0)} of ${(hillBox[3] - hillBox[0]).toFixed(0)} m)`);
  // wholly under the ground: none
  assert.equal(rockFootprint(unit.positions, unit.indices, piece(400, G - 20, 400, 5), samples), null);
});

test('ROCK-FOOT standMineNodes: a boulder whose piece faces into a neighbour stands on its open side; a piece shut on every side passes it to the next (mutants: one piece asked; one side asked)', () => {
  const law = boulders({ x: PX, y: PY, day: DAY, climate: WOODS });
  assert.equal(law.length, 3, 'the Woodlands\' three (BOULDERS)');
  const bx = law[0].u * TERRAIN_SIZE, bz = law[0].v * TERRAIN_SIZE;
  const first = (rocks) => standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: grass, rocks }).find((n) => n.what === 'boulder' && n.slot === 0);
  // its point on a piece's west end, and a neighbour over that end and the point (the field's pieces overlap): the
  // foot facing the point is inside the neighbour - the piece's north side is open
  const p = [bx - 1, G, bz - 1, bx + 5, G + 4, bz + 1];
  const w = [bx - 10, G, bz - 10, bx + 0.5, G + 6, bz + 10];
  const one = first([p, w]);
  assert.ok(one, 'it stands');
  assert.deepEqual(one.rock, p, 'at its own piece');
  assert.ok(near(one.local[0], bx + 2) && near(one.local[2], bz + 1 + ROCK_OFFSET), `on its open north side (${one.local[0] - bx}, ${one.local[2] - bz})`);
  assert.equal(insideRocks([p, w], one.local[0], one.local[2]), false, 'clear of every piece');
  // a piece wholly inside another, both over the point: its every foot is inside - the other is asked
  const a = [bx - 1, G, bz - 1, bx + 1, G + 3, bz + 1];
  const b = [bx - 20, G, bz - 20, bx + 20, G + 8, bz + 20];
  const next = first([a, b]);
  assert.ok(next, 'still it stands');
  assert.deepEqual(next.rock, b, 'at the piece round it');
  assert.equal(insideRocks([a, b], next.local[0], next.local[2]), false);
});

test('ROCK-SHARE: a piece holds a node on each of its sides NODE_SPACING_M apart - the boulders first; a stone too small for two holds one, and the veins stand on the stone beside it (mutants: the spacing unasked; the boulders after the veins in the list)', () => {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const b = boulders({ x: PX, y: PY, day: DAY, climate: WOODS })[0];
  const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE;
  const stone = new Uint8Array(128 * 128).fill(3);
  const stand = (rocks) => standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: stone, rocks });
  const apart = (nodes) => {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].local[0] - nodes[j].local[0], nodes[i].local[2] - nodes[j].local[2]);
      assert.ok(d >= NODE_SPACING_M - 1e-9, `${nodes[i].key} and ${nodes[j].key} ${d.toFixed(2)} m apart`);
    }
  };
  // a field's one great piece, sixty metres across: every boulder and every vein at its foot, each on its own side
  const hill = [[x - 30, G, z - 30, x + 30, G + 9, z + 30]];
  const all = stand(hill);
  assert.equal(all.filter((n) => n.what === 'boulder').length, 3, 'the three boulders');
  assert.equal(all.filter((n) => n.what === 'vein').length, law.length, 'and the veins');
  assert.ok(all.every((n) => n.rock === hill[0] && !insideRocks(hill, n.local[0], n.local[2])), 'all at the piece, outside it');
  apart(all);
  // one stone a metre across: one node - the first boulder's; the rest of the boulders none, the veins on the stone
  const pebble = [[x - 0.5, G, z - 0.5, x + 0.5, G + 1, z + 0.5]];
  const few = stand(pebble);
  const bs = few.filter((n) => n.what === 'boulder'), vs = few.filter((n) => n.what === 'vein');
  assert.deepEqual(bs.map((n) => [n.slot, n.rock]), [[0, pebble[0]]], 'the first boulder claims it - before the veins');
  assert.equal(vs.length, law.length, 'every vein stands');
  assert.ok(vs.every((n) => n.rock === null && !insideRocks(pebble, n.local[0], n.local[2])), 'on the stone, outside the rock');
  apart(few);
  assert.deepEqual(few.map((n) => n.what), [...vs.map(() => 'vein'), 'boulder'], 'the list in its order, the veins first');
});

test('FOOT-IN (the audit of ROCK-FOOT): a node stands on its own pixel - a piece over the edge holds it on the inside, a piece past the edge none; and the gathering host finds it from the next pixel (mutant: the pixel unasked)', async () => {
  const law = boulders({ x: PX, y: PY, day: DAY, climate: WOODS });
  const bz = law[0].v * TERRAIN_SIZE;
  const stand = (rocks) => standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: grass, rocks });
  // the boulder's point near the east edge, and a piece straddling it: its east side is the next pixel's ground
  const E = TERRAIN_SIZE;
  const over = [[E - 2, G, bz - 3, E + 40, G + 5, bz + 3]];
  for (const n of stand(over)) {
    assert.ok(n.local[0] >= FOOT_INSET_M && n.local[0] <= E - FOOT_INSET_M && n.local[2] >= FOOT_INSET_M && n.local[2] <= E - FOOT_INSET_M, `${n.key} on the pixel (${n.local[0].toFixed(1)}, ${n.local[2].toFixed(1)})`);
  }
  assert.ok(stand(over).some((n) => n.what === 'boulder' && n.rock === over[0]), 'the piece over the edge holds a boulder, on its inside');
  // a piece wholly past the edge: no boulder at it, every node on the pixel
  const past = [[E + 5, G, bz - 3, E + 40, G + 5, bz + 3]];
  const p = stand(past);
  assert.equal(p.filter((n) => n.what === 'boulder').length, 0, 'none at a piece on the next pixel\'s ground');
  assert.ok(p.every((n) => n.local[0] >= 0 && n.local[0] <= E && n.local[2] >= 0 && n.local[2] <= E));
  // the real gathering host over the pixel with the piece over its edge: the player on the next pixel's ground, a metre
  // and a half from the boulder, looking at it - the target (a node past the edge was lit and never found)
  const book = { state: { open: true, today: {}, caps: { stores: 5000 } }, stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }),
    askPixels: async () => [], pump: () => {}, dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}) };
  const entry = { px: PX, py: PY, samples, tilemap: grass, locationRect: null, batches: [], rocks: over };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 };
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * Math.PI / 180) * Math.cos(view.pitch * Math.PI / 180), Math.sin(view.pitch * Math.PI / 180), Math.cos(view.yaw * Math.PI / 180) * Math.cos(view.pitch * Math.PI / 180)] });
  const host = createGatherHost({
    book, kinds: [mineKind({ book })], hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map([[`${PX},${PY}`, entry]]), pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => (DAY * 86_400 + 43_200) * 1000, eye, view: () => view, feet: () => feet, entity: () => ({ items: [] }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true,
  });
  try {
    host.onBuilt(entry);
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    const b = host.nodesOf(PX, PY).find((n) => n.what === 'boulder' && n.rock === over[0]);
    assert.ok(b && b.local[0] > E - 3, `a boulder near the edge (${b?.local[0] - E} m)`);
    feet[0] = E + 0.5; feet[1] = b.local[1]; feet[2] = b.local[2];   // just over the edge, on the next pixel
    const dx = b.local[0] - feet[0], dz = b.local[2] - feet[2], dy = b.local[1] + b.lift - (feet[1] + 1.6);
    view.yaw = Math.atan2(dx, dz) * 180 / Math.PI; view.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
    host.tick(0.016);
    assert.equal(host.target?.node.key, b.key, 'found from the next pixel');
  } finally { host.dispose(); }
});

test('ROCK-FOOT over the shipped rock fields, where the game stands them (FOOT-IN: the real sites, picked and placed by the loader): most of the law\'s boulders stand, every one at a rock that shows, outside every piece and on its own pixel (before: under one in ten, and a fifth of those off the pixel)', () => {
  const V = new URL('../vendor/world-of-daggerfall/', import.meta.url);
  const prefabs = new Map();
  for (const f of readdirSync(new URL('LocationPrefab/', V))) prefabs.set(f.replace(/\.txt$/, ''), loadLocationPrefab(readFileSync(new URL(`LocationPrefab/${f}`, V), 'utf8')));
  const session = new LocationSession();
  for (const f of readdirSync(new URL('Locations/', V)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) session.appendRegion(parseInt(f, 10), decodeRegionPack(new Uint8Array(readFileSync(new URL(`Locations/${f}`, V)))));
  const ROCKY = /^WOD_(?:Rocks_(?!Cave)|Mountain_)/;
  const pixels = new Map();
  for (let i = 0; i < session.count; i++) if (ROCKY.test(session.prefab[i] ?? '')) pixels.set(`${session.worldX[i]},${session.worldY[i]}`, [session.worldX[i], session.worldY[i]]);
  const sample = [...pixels.values()].filter((_, i) => i % 97 === 0);
  assert.ok(sample.length > 300, `${sample.length} rock-field pixels`);
  // a model a metre across, its origin at its middle and at its foot: what a real rock's is lies between
  for (const [label, mesh] of [['centred', boxMesh(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)], ['on its origin', boxMesh(-0.5, 0, -0.5, 0.5, 1, 0.5)]]) {
    let want = 0, stood = 0;
    for (const [x, y] of sample) {
      const picks = pickLocations({ mapPixelX: x, mapPixelY: y, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 }, session, (nm) => prefabs.get(nm) ?? null, null);
      const rocks = [];
      for (const pick of picks) {
        if (!ROCKY.test(session.prefab[pick.index] ?? '')) continue;
        for (const { obj, pos } of placeObjects(pick, G / WOD_TERRAIN_HEIGHT_MAX, () => true)) {
          if (obj.type !== 0 || obj.scale.x >= 1e5) continue;   // never object 2, the mountains' rock a million times over (the road's test refuses it)
          const r = rockFootprint(mesh.positions, mesh.indices, objectMatrix(pos, obj.rot, obj.scale), samples);
          if (r) rocks.push(r);
        }
      }
      if (!rocks.length) continue;
      for (const climate of [WOODS, CLIMATES.MountainWoods, MOUNTAIN, CLIMATES.Desert]) {
        want += nodeCount(climate, 'boulder');
        for (const n of standMineNodes({ px: x, py: y, day: DAY, climate, region: GLENUMBRA, samples, tilemap: grass, rocks })) {
          if (n.what !== 'boulder') continue;
          stood++;
          assert.equal(insideRocks(rocks, n.local[0], n.local[2]), false, `${x},${y}: no boulder inside a piece`);
          assert.ok(n.local[0] >= FOOT_INSET_M && n.local[0] <= TERRAIN_SIZE - FOOT_INSET_M && n.local[2] >= FOOT_INSET_M && n.local[2] <= TERRAIN_SIZE - FOOT_INSET_M, `${x},${y}: on its own pixel`);
          const d = Math.hypot(Math.max(n.rock[0] - n.local[0], 0, n.local[0] - n.rock[3]), Math.max(n.rock[2] - n.local[2], 0, n.local[2] - n.rock[5]));
          assert.ok(d > 0 && d <= ROCK_OFFSET + 1e-9, `${x},${y}: a boulder's stones at the foot of its rock as it shows (${d.toFixed(2)} m)`);
        }
      }
    }
    assert.ok(stood / want > 0.85, `${label}: ${stood} of ${want} boulders stand`);   // ROCK-SHARE: a field's pieces hold one on each side
  }
});
