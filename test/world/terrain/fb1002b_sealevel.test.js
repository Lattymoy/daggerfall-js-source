// FIELD BUGS 2026-10-02b - THE LIFTED SEA, AT ITS SOURCE (Mac: "Audit this"; "Controls for the player vessel are
// currently broken, including not being able to lower sails"). FIELD BUGS 2026-10-02's SEA-SHOAL read a carved cell's
// seafloor where World of Daggerfall's flatten had lifted a pixel's sea over Come Sail Away's 34 m line - and its
// audit found it inert: Deep Waters' REAL hole mask carves a cell only where its four corners stand at the ocean's
// height (34.019 m at most), so it carved none of the lifted sea, and every node there still read land. The ship lay
// beached at sea, her sails refused at every press ("Unable to raise sail. Boat is obstructed.") - her helm dead. Struck,
// and the sea kept at its source:
//   SEA-LEVEL    - the flatten (world/worldOfDaggerfall/wodLocationLoader.js flattenForLocation) never raises the sea past SEA_RAMP
//                  samples of the site's own ground: the site's ground is the mod's, a ramp down to the water within
//                  SEA_RAMP, and past it the sea as the sampler left it - Deep Waters carves it, every node reads it,
//                  and her sails go up at the key
//   PLACE-AFLOAT - a water tile standing over the sea's line (a town's harbour basin at its ground's height) is no
//                  water her nodes can read: placing her there is refused with a word, where she was placed and lay
//                  beached from the first frame
// Every pin runs the real modules: the sampler's sea (world/terrain/terrainSampler.js), the mod's flatten, Unity's
// SampleHeight (world/terrain/terrainSurface.js), Deep Waters' hole mask (world/deepWater/deepWaterFloor.js), world.js's own csaTerrainOf
// lifted from its source, and Come Sail Away's runtime over the vendored hulls (test/csaScene.mjs). Each is red on the
// record's own code (e2466e2bd). `01-Overview/bugs/Field-Bugs-2026-10-02b.md`.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as surface from '../../../src/world/terrain/terrainSurface.js';
import { generateSamples, HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { flattenForLocation, distanceFromRect, SEA_RAMP } from '../../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { carvedFloorLocalY } from '../../../src/scenes/deepWater/deepWatersHost.js';
import { computeHoleMask, HOLES_RESOLUTION, VERTEX_GRID_SIZE } from '../../../src/world/deepWater/deepWaterFloor.js';
import * as csa from '../../../src/systems/comeSailAway/comeSailAway.js';
import { HULL_NAMES } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { scene } from '../../csaScene.mjs';

const { WATER_LEVEL } = csa;
const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const SMALL_SHIP = HULL_NAMES.indexOf('Small Ship'), CARRACK = HULL_NAMES.indexOf('Carrack');
const H = HEIGHTMAP_DIMENSION;
/** The host's own floor read (scenes/deepWater/deepWatersHost.js). */
const DEEP_WATERS = { floorLocalY(entry, lx, lz) { return carvedFloorLocalY(entry?.deepWaters, lx, lz); } };
/** world.js's csaTerrainOf - the Terrain the runtime reads its nodes on - mounted over the pixel at the scene's
 *  origin (csaScene's terrain stands there: its corner at 0, 0, 0). */
function mountTerrainOf() {
  const i = WORLD.indexOf('  const csaTerrainOf = (p) => {');
  assert.ok(i >= 0, 'csaTerrainOf');
  const body = WORLD.slice(i, WORLD.indexOf('\n  };\n', i) + 5);
  const state = { pixelTranslation: (px, py, o) => { o[0] = 0; o[1] = 0; o[2] = 0; return o; } };
  const names = ['_csaTerrains', 'state', 'TERRAIN_SIZE', 'deepWaters', ...Object.keys(surface)];
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${body}\nreturn csaTerrainOf;`)(new WeakMap(), state, TERRAIN_SIZE, DEEP_WATERS, ...Object.values(surface));
}
/** The sea as the sampler writes it: a WOODS.WLD of nought round the pixel - every sample the ocean elevation. */
const SEA_WOODS = { getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d), getLargeHeightMapValuesRange: () => new Uint8Array(81) };
const flatSea = () => generateSamples(SEA_WOODS, 208, 215);
/** The headland: samples 100..128 along both axes (640 m on). */
const HEADLAND = 100;
const onHeadland = (x, z) => x >= HEADLAND && z >= HEADLAND;
/** World of Daggerfall's site on it, at its corner - the sea a sample or two off its rect. */
const SITE = { x: 101, y: 101, width: 4, height: 4 };
/** A coastal pixel: the open sea and a headland standing `rise` times the sea's height, before the site is levelled. */
function coast(rise = 2) {
  const s = flatSea();
  const sea = s[0];
  for (let x = 0; x < H; x++) for (let z = 0; z < H; z++) if (onHeadland(x, z)) s[x * H + z] = sea * rise;
  return s;
}
/** Points of the open sea, the boat's water among them, and others far off the site. */
const SEA_POINTS = [[100, 200], [400, 50], [50, 600], [600, 300], [10, 10]];
/** Deep Waters' real carve of a pixel whose every tile is water: a sea pixel's tile (no local-water fallback), every
 *  point carved water by the bake's own word - the heights decide. The floor 20 m under the sea. */
function carve(samples) {
  const mask = computeHoleMask({ samples, tilemap: new Uint8Array(128 * 128) }, { usesLocalWaterFallback: false, isCarvedWater: () => true }, { isWaterAt: () => true });
  return { holes: mask.holes, floor: { vertexLocalY: new Float32Array(VERTEX_GRID_SIZE * VERTEX_GRID_SIZE).fill(14) } };
}

test('SEA-LEVEL: World of Daggerfall\'s flatten keeps the sea - a site on a coastal headland levels its own ground as the mod does and ramps down to the water within SEA_RAMP samples, and every sample of the sea past that is the sampler\'s own, under the 34 m line (one site lifted the whole pixel\'s sea over it)', () => {
  for (const rise of [2, 1 + 7 / 34]) {   // a headland at twice the sea, and a site 7 m over it
    const before = coast(rise);
    const after = Float32Array.from(before);
    const avg = flattenForLocation(after, SITE);
    let sea = 0, ramp = 0, land = 0;
    const f32 = Math.fround;
    for (let x = 1; x <= 127; x++) {
      for (let z = 1; z <= 127; z++) {
        const i = x * H + z;
        const d = distanceFromRect(SITE, x, z);
        const lerped = f32(before[i] + f32(f32(avg - before[i]) * Math.min(1, f32(1 / f32(d + 1)))));   // the mod's own lerp
        if (onHeadland(x, z)) { land++; assert.equal(after[i], lerped, `(${x}, ${z}) the land, levelled as the mod levels it`); }
        else if (d > SEA_RAMP) { sea++; assert.equal(after[i], before[i], `(${x}, ${z}) the sea, untouched`); }
        else { ramp++; assert.equal(after[i], lerped, `(${x}, ${z}) the ramp down to the water, the mod's own`); assert.ok(after[i] > before[i]); }
      }
    }
    assert.ok(ramp >= 8, `the ramp asked (${ramp})`);
    assert.ok(sea > 10000 && land > 600, `the sea asked (${sea}), the land beside it (${land}), the ramp (${ramp})`);
    for (const [lx, lz] of SEA_POINTS) assert.ok(surface.terrainSampleHeightAt(after, lx, lz) < WATER_LEVEL, `(${lx}, ${lz}) ${surface.terrainSampleHeightAt(after, lx, lz)}: the sea, under the line`);
  }
});

test('SEA-LEVEL: Deep Waters carves the levelled sea and her nodes read it - the real hole mask carves the open sea (it carved none of the lifted sea), and a Small Ship and a Carrack there have all five nodes on water, their sails go up at the key and they sail (every node read land: "Unable to raise sail. Boat is obstructed.")', () => {
  const samples = coast();
  flattenForLocation(samples, SITE);
  const dw = carve(samples);
  let carved = 0, sea = 0;
  for (let cz = 0; cz < HOLES_RESOLUTION; cz++) for (let cx = 0; cx < HOLES_RESOLUTION; cx++) if (!onHeadland(cx, cz)) { sea++; if (!dw.holes[cz * HOLES_RESOLUTION + cx]) carved++; }
  assert.ok(carved > sea * 0.99, `the open sea carved: ${carved} of ${sea} cells`);
  for (const hull of [SMALL_SHIP, CARRACK]) {
    const terrain = mountTerrainOf()({ px: 10, py: 20, samples, tilemapBytes: null, deepWaters: dw });
    const s = scene({ terrains: [terrain] });
    s.deps.iliacPuddleNoMore = () => true;
    s.deps.handling = () => 'responsive';   // the Features row's Ship handling as it ships (under Classic the mod's own Carrack makes no way - kept, CSA-D)
    const boat = s.helm(s.place(hull, 0, [100, 34, 200], [0, 0, 1]));
    assert.deepEqual([...boat.NodeTileMapIndices], [0, 0, 0, 0, 0], `${HULL_NAMES[hull]}: every node on the water`);
    s.rt.state.windVectorCurrent = [0, 0, 3];
    s.rt.state.windVectorTarget = [0, 0, 3];
    s.frame({ press: ['BoatToggleSail'] });   // the sail key (End)
    assert.ok(s.out.hud.includes('Sail raised!') && !s.out.hud.some((t) => /obstructed/.test(t)), `${HULL_NAMES[hull]}: the sails up (${s.out.hud.join(' | ')})`);
    const z0 = boat.GameObject.position[2];
    for (let i = 0; i < 80; i++) s.frame();
    assert.ok(boat.GameObject.position[2] - z0 > 5, `${HULL_NAMES[hull]}: she sails (${(boat.GameObject.position[2] - z0).toFixed(2)} m)`);
    s.frame({ press: ['BoatToggleSail'] });
    assert.ok(s.out.hud.includes('Sail lowered!') && s.rt.state.sailPosition === 0, `${HULL_NAMES[hull]}: and come down at it again`);
  }
});

test('PLACE-AFLOAT: with Iliac Puddle No More on, a water tile standing over the sea\'s line (a harbour\'s basin at its town\'s ground) refuses her with a word - no boat, the deed kept; at the sea\'s own height she is placed; with the mod off, the tile alone decides, as the C# does (she was placed there, beached, her sails refused)', () => {
  /** A pixel of water tiles whose ground stands `height` - the harbour's basin, or the sea. */
  const pixelAt = (height) => ({ mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => height });
  const placeOn = (height, ipnm) => {
    const terrain = pixelAt(height);
    const s = scene({ terrains: [terrain] });
    s.deps.iliacPuddleNoMore = () => ipnm;
    s.deps.camera = () => ({ position: [100, height + 20, 190], forward: [0, -2, 1] });
    s.deps.raycast = (o, d) => (d[1] < 0 ? { point: [100, height, 200], distance: 20, name: 'DaggerfallTerrain', terrain, root: null } : null);
    s.rt.PlaceBoatAtRayHit(SMALL_SHIP, 0);
    return s;
  };
  const harbour = placeOn(36, true);
  assert.deepEqual(harbour.out.mid, [[csa.PLACE_RAISED_TEXT, 3]], 'refused, with the word');
  assert.equal(harbour.rt.state.AllBoats.length, 0, 'no boat');
  assert.ok(!harbour.out.hud.includes('Boat placed!'));
  const sea = placeOn(33.994, true);
  assert.equal(sea.rt.state.AllBoats.length, 1, 'at the sea\'s height: placed');
  assert.deepEqual([...sea.rt.state.AllBoats[0].NodeTileMapIndices], [0, 0, 0, 0, 0], 'afloat');
  const off = placeOn(36, false);
  assert.equal(off.rt.state.AllBoats.length, 1, 'the mod off: the tile\'s water, as the C# reads it');
});
