// FIELD-CSA2 (2026-09-29, Discord #general through Mac - ItMustBeMonday: "I can't get my boat to work"; SylviaBun:
// "people are saying Ports are bugged for player boats"; Mac's own line the night before, 2026-09-28e: "a player is at
// a port but unable to set sail"). A deed's boat is put in the water near a port, and with Iliac Puddle No More on (the
// default) Come Sail Away reads each of a boat's five nodes as water when `Terrain.SampleHeight(node) < 34` - the mod's
// WaterLevel, the sea's own height over the terrain. The terrain sampler clamps the whole sea to the ocean elevation,
// 27.2 x 1.25 = 34 m, and Unity holds a heightmap in 16-bit steps (kMaxHeight, 32766 to the terrain's height): the flat
// sea is 579.105 steps, held as 579 - 33.994 m, under the line. The port's stand-in read the drawn ground's floats,
// 34.000001 m, never under it: every node of every boat on the open sea read land, so no boat rowed, "Unable to raise
// sail. Boat is obstructed.", and the Overworld's crossing never launched. Seen live (the retail data, the open Bay
// south of Daggerfall's harbour at 209, 216 and 210, 217: the ground under the hull 34.000001 m, the Small Ship's nodes
// [1, 1, 1, 1, 1] before the fix and [0, 0, 0, 0, 0] after).
// The host's stand-in (world.js csaTerrainOf) is mounted from its source; the runtime is the real one over the
// vendored hulls; the last test reads the retail WOODS.WLD and MAPS.BSA (ARENA2_PATH).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as surface from '../../../src/world/terrain/terrainSurface.js';
import { generateSamples, SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { StreamingWorldState } from '../../../src/world/streamingWorld.js';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, WATER_LEVEL, BOAT_ACTIONS } from '../../../src/systems/comeSailAway/comeSailAway.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
/** One two-space-indented `const name = (...) => {` of world.js's host, whole. */
const constOf = (head) => {
  const i = WORLD.indexOf(head);
  assert.ok(i >= 0, head);
  return WORLD.slice(i, WORLD.indexOf('\n  };\n', i) + 5);
};
/** world.js's csaTerrainOf - the Terrain the runtime reads its nodes on - over a real StreamingWorldState, every
 *  terrainSurface export in scope as the host's import has it. */
function mountTerrainOf(state) {
  const names = ['_csaTerrains', 'state', 'TERRAIN_SIZE', ...Object.keys(surface)];
  const src = constOf('  const csaTerrainOf = (p) => {');
  return new Function(...names, `${src}\nreturn csaTerrainOf;`)(new WeakMap(), state, TERRAIN_SIZE, ...Object.values(surface));
}

/** The sea as the sampler writes it: a WOODS.WLD of nought round the pixel - every sample clamped to the ocean elevation. */
const SEA_WOODS = { getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d), getLargeHeightMapValuesRange: () => new Uint8Array(81) };
const flatSea = () => generateSamples(SEA_WOODS, 208, 215);
const WORLD_HEIGHT = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;

test('FIELD-CSA2: the sea the sampler writes is the ocean elevation to the float - 34.000001 m as the drawn ground reads it, never under the mod\'s 34', () => {
  const sea = flatSea();
  const clamp = Math.fround(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT);
  assert.ok(sea.every((v) => v === clamp), 'every sample the clamp');
  assert.equal(WATER_LEVEL, 34, 'ComeSailAway.WaterLevel with no World of Daggerfall terrain');
  const drawn = surface.surfaceHeightAt(sea, 400, 400);
  assert.ok(drawn >= WATER_LEVEL && drawn - WATER_LEVEL < 1e-5, `the drawn ground ${drawn}: at the line, not under it (why every node read land)`);
});

test('FIELD-CSA2: Terrain.SampleHeight at Unity\'s heightmap precision - 16-bit steps of kMaxHeight 32766: the flat sea 579 steps, 33.994 m, under the line; a step up is land; elsewhere the drawn ground to within a step', () => {
  assert.equal(typeof surface.terrainSampleHeightAt, 'function', 'the sampler exists');
  assert.equal(surface.UNITY_HEIGHTMAP_MAX_HEIGHT, 32766);
  const sea = flatSea();
  assert.equal(surface.unityHeightmapStep(sea[0]), 579, '0.0176738 x 32766 = 579.105: step 579');
  // the port rounds to the nearest step - the record's declared choice: whether Unity's SetHeights rounds or truncates
  // is in no source the port has, and the sea is step 579 either way
  assert.equal(surface.unityHeightmapStep(579.6 / 32766), 580);
  assert.equal(surface.unityHeightmapStep(579.4 / 32766), 579);
  const step = Math.fround(WORLD_HEIGHT / 32766);
  for (const [lx, lz] of [[0, 0], [3.2, 6.4], [400, 400], [812.8, 1.1], [TERRAIN_SIZE, TERRAIN_SIZE]]) {
    const h = surface.terrainSampleHeightAt(sea, lx, lz);
    assert.equal(h, Math.fround(579 * step), `(${lx}, ${lz}) is 579 steps`);
    assert.ok(h < WATER_LEVEL, `(${lx}, ${lz}) ${h} under the water level`);
  }
  // one step up - the vanilla coast's first rise - is land, as Unity reads it
  const up = new Float32Array(sea.length).fill(580 / 32766);
  assert.ok(surface.terrainSampleHeightAt(up, 400, 400) >= WATER_LEVEL, 'step 580 is 34.05 m: land');
  // any ground: the same two triangles as the drawn ground, off it by no more than one step
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const hills = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).map(() => 0.02 + rnd() * 0.3);
  for (let i = 0; i < 400; i++) {
    const lx = rnd() * TERRAIN_SIZE, lz = rnd() * TERRAIN_SIZE;
    const d = Math.abs(surface.terrainSampleHeightAt(hills, lx, lz) - surface.surfaceHeightAt(hills, lx, lz));
    assert.ok(d <= step * 1.001, `(${lx}, ${lz}) ${d} within a step`);
  }
  // the far ring's stride reads its own coarser quads, as the drawn ground does
  for (let i = 0; i < 100; i++) {
    const lx = rnd() * TERRAIN_SIZE, lz = rnd() * TERRAIN_SIZE;
    const d = Math.abs(surface.terrainSampleHeightAt(hills, lx, lz, 4) - surface.surfaceHeightAt(hills, lx, lz, 4));
    assert.ok(d <= step * 1.001, `stride 4 (${lx}, ${lz}) ${d} within a step`);
  }
});

test('FIELD-CSA2: the host\'s Terrain (world.js csaTerrainOf, mounted) answers SampleHeight at Unity\'s precision - the open sea under the line wherever the recentres have carried it', () => {
  const state = new StreamingWorldState(1);
  state.init(207, 213);
  state.compensation[1] = -501;   // a vertical recentre: SampleHeight is over the terrain's own y, which the compensation moves
  const terrainOf = mountTerrainOf(state);
  const p = { px: 208, py: 215, samples: flatSea(), tilemapBytes: null };
  const t = terrainOf(p);
  assert.ok(t === terrainOf(p), 'one Terrain a pixel');
  const o = state.pixelTranslation(208, 215, [0, 0, 0]);
  for (const [lx, lz] of [[112, 60.8], [409.6, 409.6], [800, 20]]) {
    const h = t.sampleHeight([o[0] + lx, 34 - 501, o[2] + lz]);
    assert.ok(h < WATER_LEVEL, `the sea at (${lx}, ${lz}) reads ${h}: water (it read 34.000001, land)`);
  }
  // past the terrain's edge: the edge's height (CSA-J), still the sea
  assert.ok(t.sampleHeight([o[0] - 50, 0, o[2] + TERRAIN_SIZE + 50]) < WATER_LEVEL);
});

// ── the runtime over the vendored hulls ────────────────────────────────────────

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });

/** A helm over one built pixel, Iliac Puddle No More on, its Terrain the host's own (mounted). */
function helmOnThe(samples, { px = 208, py = 215, isPortTown = () => false } = {}) {
  const state = new StreamingWorldState(1);
  state.init(px, py);
  const terrain = mountTerrainOf(state)({ px, py, samples, tilemapBytes: new Uint8Array(128 * 128) });
  const out = { hud: [], mid: [] };
  const held = new Set();
  const started = new Set();
  const player = { position: [400, 36, 400], yaw: 0, frozen: 0 };
  const rt = createComeSailAwayRuntime({
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, pl) => { spawnBoat(boat, { models: MODELS, player: () => pl, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) }); return boat; }, remove: () => {} },
    player: () => ({ position: [...player.position], rotation: [0, Math.sin((player.yaw * Math.PI / 180) / 2), 0, Math.cos((player.yaw * Math.PI / 180) / 2)] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: px, Y: py }),
    isPlayerInside: () => false,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => true,
    raycast: () => null,
    playerTerrain: () => terrain,
    terrainAt: (x, y) => (x === px && y === py ? terrain : null),
    terrains: () => [terrain],
    heightMapValue: () => 255,
    worldCompensation: () => [...state.compensation],
    hudText: (t) => out.hud.push(t),
    midScreenText: (t) => out.mid.push(t),
    log: () => {},
    random: { range: (min) => min },
    time: () => 0,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (items) => items, deserialize: (records) => records },
    dt: () => 0.25,
    setting: (key) => ({ 'Waves.Enable': false })[key],
    input: {
      has: (a) => held.has(a),
      started: (a) => started.has(a),
      horizontal: () => 0,
      vertical: () => (held.has('MoveForwards') ? 1 : 0),
      toggleAutorun: false,
    },
    helm: { setPlayerPosition: (q) => { player.position = [...q]; }, setFacing: (yaw) => { player.yaw = yaw; }, turnPlayer: (d) => { player.yaw += d; }, freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: () => 0,
    sphereCastAll: () => [],
    enemies: () => [],
    timeScale: () => 1,
    setTimeScale: () => {},
    messageBox: () => {},
    isPortTown,
    items: { create: (templateIndex) => ({ templateIndex, message: 0, UID: 1 }), addToPlayer: () => {} },
  });
  const frame = ({ press = [] } = {}) => {
    started.clear();
    for (const a of press) started.add(a);
    rt.endOfFrame();
    rt.fixedUpdate();
    rt.update();
    rt.lateUpdate();
    started.clear();
  };
  return { rt, out, held, frame, state, terrain };
}

test('FIELD-CSA2: on the open sea, Iliac Puddle No More on - every deed\'s hull reads its five nodes as water, raises its sail and rows (it read [1, 1, 1, 1, 1]: "Unable to raise sail. Boat is obstructed.", and beached)', () => {
  // the three hulls a shelf's deed is (AssignVariantsToShopItems: Random.Range(1, 4)), and the parts' Rowboat
  for (const hull of [0, 1, 2, 3]) {
    const s = helmOnThe(flatSea());
    const boat = s.rt.PlaceBoat([409.6, 34, 409.6], [0, 0, 1], hull, 0, s.terrain);
    assert.deepEqual([...boat.NodeTileMapIndices], [0, 0, 0, 0, 0], `hull ${hull}: the nodes read the sea`);
    s.rt.StartSailing(boat);
    assert.equal(s.rt.isSailing(), true);
    s.frame({ press: [BOAT_ACTIONS.toggleSail] });
    if (boat.Sails.length) {
      assert.ok(s.out.hud.includes('Sail raised!'), `hull ${hull}: ${JSON.stringify(s.out.hud)}`);
      assert.ok(!s.out.hud.includes('Unable to raise sail. Boat is obstructed.'));
      assert.equal(s.rt.state.sailPosition, 1);
      s.frame({ press: [BOAT_ACTIONS.toggleSail] });   // stowed again, for the oars
    }
    const start = [...boat.GameObject.position];
    s.frame({ press: ['MoveForwards'] });   // HELM-LADDER: a rung up - her oars pulling ahead
    for (let i = 0; i < 7; i++) s.frame();
    const moved = Math.hypot(boat.GameObject.position[0] - start[0], boat.GameObject.position[2] - start[2]);
    assert.ok(s.rt.state.MoveVectorCurrent[2] > 0, `hull ${hull}: under way (a beached boat's move is zeroed each frame)`);
    assert.ok(moved > 0.25, `hull ${hull}: the oars pulled it ${moved} m in two seconds (none while beached)`);
  }
});

test('FIELD-CSA2: the shore stays the shore - a hull over ground a step above the sea reads land and stays obstructed, as the mod reads it', () => {
  const s = helmOnThe(new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(580 / 32766));
  const boat = s.rt.PlaceBoat([409.6, 34, 409.6], [0, 0, 1], 1, 0, s.terrain);
  assert.deepEqual([...boat.NodeTileMapIndices], [1, 1, 1, 1, 1]);
  s.rt.StartSailing(boat);
  s.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.ok(s.out.hud.includes('Unable to raise sail. Boat is obstructed.'), JSON.stringify(s.out.hud));
});

// ── the retail data: the Bay by Daggerfall's harbour ───────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'WOODS.WLD')) || !existsSync(join(ARENA2, 'MAPS.BSA')) ? 'ARENA2_PATH has no WOODS.WLD and MAPS.BSA' : false;

test('FIELD-CSA2 on the retail data: the open Bay south of Daggerfall (209, 216) - its deed answers "a port is near", the Small Ship put there reads the Bay and raises its sail; the coast\'s first rise is land', { skip: skipReal }, async () => {
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { buildMapDict, locationSummaryAt } = await import('../../../src/systems/map/mapDirectory.js');
  const { smoothLocationNeighbourhood } = await import('../../../src/world/terrain/terrainHelper.js');
  const woods = new WoodsFile();
  woods.load(readFileSync(join(ARENA2, 'WOODS.WLD')));
  const maps = new MapsFile();
  maps.load(readFileSync(join(ARENA2, 'MAPS.BSA')), readFileSync(join(ARENA2, 'CLIMATE.PAK')), readFileSync(join(ARENA2, 'POLITIC.PAK')));
  const mapDict = buildMapDict(maps);
  smoothLocationNeighbourhood(mapDict, woods);   // the boot's own repair (world.js), before any pixel streams
  // world.js's own csaIsPortTown, mounted: Daggerfall (207, 213) is a port by its byte
  const { hasPortFor } = await import('../../../src/systems/travel/travelPorts.js');
  // PIN MOVED (THE CAPTAIN'S SEA, ETHER-PORTS - found by AUDIT CAPTAIN'S SEA's touched run with the data): an isle's port
  // is a port past the Veil (`etherSea && inEther(x, y)` first), so the sea, its law and an isle's port stand in scope - the
  // sea on, and an isle's port answering every pixel it is asked of, so a Bay pixel that asked it would read a port
  const { inEther } = await import('../../../src/world/ethericSea.js');
  const isPortTown = new Function('travelLocationSummaryAt', 'mapDict', 'maps', 'hasPortFor', 'etherSea', 'inEther', 'etherPortAt', `${constOf('  const csaIsPortTown = (x, y) => {')}\nreturn csaIsPortTown;`)(locationSummaryAt, mapDict, maps, hasPortFor, true, inEther, () => ({}));
  assert.equal(isPortTown(207, 213), true, 'Daggerfall is a port');
  assert.equal(isPortTown(209, 216), false, 'the open Bay is none - the Bay\'s pixel never asks the sea\'s ports');
  // the Bay a pixel off the coast: every sample the sea's clamp (seen live too, the roads' pass and all: 34.000001
  // under the whole hull, the Small Ship's nodes [1, 1, 1, 1, 1] before the fix and [0, 0, 0, 0, 0] after)
  const sea = generateSamples(woods, 209, 216);
  assert.ok(sea.every((v) => v === Math.fround(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT)), 'the open Bay');
  const s = helmOnThe(sea, { px: 209, py: 216, isPortTown });
  assert.equal(s.rt.IsNearPort(3), true, 'the deed is used here: Daggerfall is in the search square');
  const o = s.state.pixelTranslation(209, 216, [0, 0, 0]);
  const boat = s.rt.PlaceBoat([o[0] + 409.6, 34, o[2] + 409.6], [0, 0, 1], 2, 0, s.terrain);
  assert.deepEqual([...boat.NodeTileMapIndices], [0, 0, 0, 0, 0], 'the Small Ship\'s nodes read the Bay');
  s.rt.StartSailing(boat);
  s.frame({ press: [BOAT_ACTIONS.toggleSail] });
  assert.ok(s.out.hud.includes('Sail raised!'), JSON.stringify(s.out.hud));
  // the coast pixel north of it (208, 215): its sampler's first rise out of the sea - a step and more over the line - is
  // land, as Unity reads it
  const coast = helmOnThe(generateSamples(woods, 208, 215), { px: 208, py: 215 });
  const c = coast.state.pixelTranslation(208, 215, [0, 0, 0]);
  const rise = coast.terrain.sampleHeight([c[0] + 96, 0, c[2] + 100.8]);
  assert.ok(rise >= WATER_LEVEL && rise < WATER_LEVEL + 1, `the rise ${rise}: land`);
});
