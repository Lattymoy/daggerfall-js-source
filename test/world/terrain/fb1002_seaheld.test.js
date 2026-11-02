// FIELD BUGS 2026-10-02 - SEA-HELD. Mac, testing sailing: "your ship can get stuck at sea in place". With Deep Waters on
// (Iliac Puddle No More), Come Sail Away reads a node as water by its ground's height, Terrain.SampleHeight under 34 m -
// and the open sea stands 6 mm under that line (step 579, 33.994 m: FIELD-CSA2). World of Daggerfall levels a site's
// ground AFTER the tiles are read (LocationLoader.AddLocation on OnPromoteTerrainData), lerping EVERY sample of its pixel
// toward the site's mean by 1 / (distance + 1): one rock field on a headland lifts the whole pixel's sea over the line,
// while its tiles stay water and Deep Waters carves and draws a sea there. Every node read land, the boat was beached
// (more than three nodes off water) and nothing moved her; and the C# reads her nodes only when she moves, so she lay
// there for good. And a bow run onto a shore could not back off it: the oars' astern asked the BOW's node. The pins,
// each red on the code before:
//   BEACH-READ  - a beached boat's nodes are read again each frame she lies still: when the ground under her is put
//                 right (her pixel built again under her) she comes off; a beach stays a beach
//   ASTERN      - back asks the STERN's node, the water she backs into: a bow on a shore backs off it, a stern on one
//                 refuses
// Its SEA-SHOAL (a carved cell's ground read as its seafloor) was struck by the record's audit (2026-10-02b): Deep
// Waters' real carve never carves a sea lifted over the line, so it read land still - the sea is kept at its source
// now, the flatten's (SEA-LEVEL, test/world/terrain/fb1002b_sealevel.test.js).
// Every pin runs the real modules: the sampler's sea (world/terrain/terrainSampler.js), Unity's SampleHeight
// (world/terrain/terrainSurface.js), world.js's own csaTerrainOf, and Come Sail Away's runtime over the vendored hulls
// (test/csaScene.mjs).
// `01-Overview/bugs/Field-Bugs-2026-10-02.md`.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as surface from '../../../src/world/terrain/terrainSurface.js';
import { generateSamples, HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { HULL_NAMES } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { scene } from '../../csaScene.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');
const SMALL_SHIP = HULL_NAMES.indexOf('Small Ship');
const H = HEIGHTMAP_DIMENSION;
/** world.js's csaTerrainOf - the Terrain the runtime reads its nodes on - mounted as field_csa2 mounts it, over the
 *  pixel at the scene's origin (csaScene's terrain stands there: its corner at 0, 0, 0). */
function mountTerrainOf() {
  const i = WORLD.indexOf('  const csaTerrainOf = (p) => {');
  assert.ok(i >= 0, 'csaTerrainOf');
  const body = WORLD.slice(i, WORLD.indexOf('\n  };\n', i) + 5);
  const state = { pixelTranslation: (px, py, o) => { o[0] = 0; o[1] = 0; o[2] = 0; return o; } };
  const names = ['_csaTerrains', 'state', 'TERRAIN_SIZE', ...Object.keys(surface)];
  return new Function(...names, `${body}\nreturn csaTerrainOf;`)(new WeakMap(), state, TERRAIN_SIZE, ...Object.values(surface));
}
/** The sea as the sampler writes it: a WOODS.WLD of nought round the pixel - every sample the ocean elevation. */
const SEA_WOODS = { getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d), getLargeHeightMapValuesRange: () => new Uint8Array(81) };
const flatSea = () => generateSamples(SEA_WOODS, 208, 215);
/** The sea lifted over the 34 m line - a pixel's ground as it stood before it was built again (a site's ground levelled
 *  over its sea, World of Daggerfall's flatten before SEA-LEVEL): every sample a twentieth over the sea's. */
const liftedSea = () => flatSea().map((v) => v * 1.05);
/** The helm on `samples` (the scene's pixel, the host's Terrain over it), Deep Waters on: a Small Ship placed at `at`
 *  facing north, and taken. `roll(n, keys)` holds the keys `n` frames and answers how far she went. */
function helmOn(p, { at = [100, 34, 200] } = {}) {
  const terrain = mountTerrainOf()(p);
  const s = scene({ terrains: [terrain] });
  s.deps.iliacPuddleNoMore = () => true;
  const boat = s.helm(s.place(SMALL_SHIP, 0, at, [0, 0, 1]));
  const roll = (n, keys) => {
    const from = boat.GameObject.position.slice();
    s.held.clear();
    for (const k of keys) s.held.add(k);
    s.rt.state.oarThrottle = keys.includes('MoveForwards') ? 1 : keys.includes('MoveBackwards') ? -1 : 0;   // HELM-LADDER: the keys' rung
    for (let i = 0; i < n; i++) s.frame();
    s.held.clear();
    s.rt.state.oarThrottle = 0;
    const to = boat.GameObject.position;
    return { moved: Math.hypot(to[0] - from[0], to[2] - from[2]), dz: to[2] - from[2] };
  };
  return { s, boat, roll, terrain, nodes: () => [...boat.NodeTileMapIndices] };
}

test('BEACH-READ: a boat beached by a reading the ground has since put right comes off - her nodes are read again each frame she lies still (the C# reads them only when she moves, and a beached boat never moves); a beach stays a beach, and no terrain under the player throws nothing', () => {
  const p = { px: 10, py: 20, samples: liftedSea(), tilemapBytes: null, deepWaters: null };
  const h = helmOn(p);
  assert.deepEqual(h.nodes(), [1, 1, 1, 1, 1], 'read on the lifted ground: all five land');
  assert.equal(h.s.rt.IsBeached(h.boat), true);
  h.s.frame();   // her first frame at the helm takes the moved arm - the C#'s read, the collision with it
  h.s.deps.sphereCastAll = () => [{ point: [100, 34, 150], distance: 30, name: 'Rock', root: null, terrain: false, entity: false }];   // a rock astern
  assert.equal(h.roll(8, ['MoveForwards']).moved, 0, 'beached: the oars move nothing');
  assert.deepEqual(h.s.rt.state.collisionDirections, [], 'and lying still she sweeps nothing');
  p.samples = flatSea();   // her pixel built again under her: the sea at its own height
  h.s.frame();
  assert.deepEqual(h.nodes(), [0, 0, 0, 0, 0], 'read again where she lies: water');
  assert.equal(h.s.rt.state.collisionDirections.length, 2, 'and her collision with them, the frame she comes off (both sweeps)');
  h.s.deps.sphereCastAll = () => [];
  const r = h.roll(24, ['MoveForwards']);
  assert.ok(r.dz > 1, `off, and rowing (${r.dz.toFixed(2)} m)`);
  // a beach stays a beach: on the lifted ground every reading is land, every frame
  const beach = helmOn({ px: 10, py: 20, samples: liftedSea(), tilemapBytes: null, deepWaters: null });
  assert.deepEqual(beach.nodes(), [1, 1, 1, 1, 1]);
  assert.equal(beach.roll(24, ['MoveForwards']).moved, 0, 'still beached');
  assert.deepEqual(beach.nodes(), [1, 1, 1, 1, 1]);
  // no built terrain under the player while she lies beached: nothing read, nothing thrown (the C#'s throw is on a move)
  const none = helmOn({ px: 10, py: 20, samples: liftedSea(), tilemapBytes: null, deepWaters: null });
  none.s.frame();   // her first frame at the helm takes the moved arm (the last place it holds is not hers) - the C#'s read
  none.s.deps.playerTerrain = () => null;
  assert.doesNotThrow(() => { for (let i = 0; i < 8; i++) none.s.frame(); });
  assert.deepEqual(none.nodes(), [1, 1, 1, 1, 1], 'read on nothing: as they were');
});

test('ASTERN: back asks the STERN\'s node, the water she backs into - a bow run onto a shore backs off it (it asked the bow\'s, and the centre\'s water rowed her on in); a stern on a shore refuses back and still rows ahead; forward asks the centre\'s, as the C# does', () => {
  // a straight shore north of her: samples 33 on (211.2 m) stand at twice the sea; her bow's node (219.9 m) on it
  const north = flatSea();
  for (let x = 0; x < H; x++) for (let z = 33; z < H; z++) north[x * H + z] = north[0] * 2;
  const bow = helmOn({ px: 10, py: 20, samples: north, tilemapBytes: null, deepWaters: null });
  assert.deepEqual(bow.nodes(), [0, 1, 0, 0, 0], 'the bow on the shore, the rest afloat');
  const back = bow.roll(80, ['MoveBackwards']);   // the shore's line crossed 204.9 m on: 15 m astern
  assert.ok(back.dz < -15, `she backs off it (${back.dz.toFixed(2)} m)`);
  assert.deepEqual(bow.nodes(), [0, 0, 0, 0, 0], 'off the shore');
  // a shore south of her: samples to 28 (179.2 m) on it; her stern's node (175.7 m) there
  const south = flatSea();
  for (let x = 0; x < H; x++) for (let z = 0; z <= 28; z++) south[x * H + z] = south[0] * 2;
  const stern = helmOn({ px: 10, py: 20, samples: south, tilemapBytes: null, deepWaters: null });
  assert.deepEqual(stern.nodes(), [0, 0, 1, 0, 0], 'the stern on the shore');
  assert.equal(stern.roll(24, ['MoveBackwards']).moved, 0, 'back: refused - the stern would go up the shore');
  assert.ok(stern.roll(24, ['MoveForwards']).dz > 1, 'ahead: the centre\'s water, as the C# asks');
});
