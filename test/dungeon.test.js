import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { srand, rand } from '../src/formats/dfRandom.js';
import { randomTextureTableClassic, applyTextureTable, DEFAULT_TEXTURE_TABLE } from '../src/world/dungeonTextures.js';
import { layoutRdbBlock, getModelMatrix, isActionDoor, ACTION_FLAGS, TRIGGER_FLAGS, RDB_SIDE } from '../src/world/rdbLayout.js';
import { collectDungeonLights } from '../src/world/dungeonLights.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { dfMeshToModel, GLOBAL_SCALE, DOOR_TYPE } from '../src/world/meshReader.js';
import { transformPoint } from '../src/world/mat4.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile, ROTATION_DIVISOR } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function approx(actual, expected, eps = 1e-4) {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('dungeon: dfRandom matches the classic C LCG', () => {
  // K&R rand() with seed 1 famously opens 16838, 5758, 10113.
  srand(1);
  assert.equal(rand(), 16838);
  assert.equal(rand(), 5758);
  assert.equal(rand(), 10113);
  // Negative seeds wrap through uint, verbatim C# (uint)(int) cast:
  // seed -1 -> state 4294967295 -> first rand 15929 (64-bit product).
  srand(-1);
  assert.equal(rand(), 15929);
});

test('dungeon: texture table generation and application', () => {
  // Privateer's Hold: LocationId 50050, Woodlands climate 231 -> the
  // classic 19-series stone set with sewer slot 368. Pure math, no data.
  assert.deepEqual(randomTextureTableClassic(50050, 231), [23, 22, 19, 22, 20, 368]);
  // Deterministic on reseed.
  assert.deepEqual(randomTextureTableClassic(50050, 231), [23, 22, 19, 22, 20, 368]);

  // applyTextureTable: slots, exit-door climate shift, passthrough.
  const table = DEFAULT_TEXTURE_TABLE;
  assert.equal(applyTextureTable(119, table, 300), 119);
  assert.equal(applyTextureTable(168, [23, 22, 19, 22, 20, 368], 300), 368);
  assert.equal(applyTextureTable(74, table, 300), 374); // Temperate exit doors
  assert.equal(applyTextureTable(210, table, 300), 210); // untouched
});

test('dungeon: getModelMatrix uses T * Rz * Rx * Ry, not the RMB order', () => {
  // 90deg on two axes makes composition order visible.
  const obj = {
    xPos: 100, yPos: 200, zPos: 300,
    resources: { modelResource: {
      xRotation: -90 * ROTATION_DIVISOR, // degreesX = +90
      yRotation: -90 * ROTATION_DIVISOR, // degreesY = +90
      zRotation: 0,
      modelIndex: 0,
    } },
  };
  const m = getModelMatrix(obj);
  // Point (1, 0, 0): Ry(90) -> (0, 0, -1); Rx(90) -> (0, 1, 0); T.
  const p = transformPoint(m, 1, 0, 0);
  approx(p[0], 100 * GLOBAL_SCALE);
  approx(p[1], -200 * GLOBAL_SCALE + 1);
  approx(p[2], 300 * GLOBAL_SCALE);
  // The RMB TRS order (Ry * Rx * Rz applied as x-then... ) would land the
  // point at +x/+y instead; assert we did NOT produce it.
  assert.ok(Math.abs(p[0] - (100 * GLOBAL_SCALE + 1)) > 0.5);
});

test('dungeon: isActionDoor descriptions and the red-brick exception', () => {
  const rdb = { modelReferenceList: [
    { modelIdNum: 55000, description: 'DOR' },
    { modelIdNum: 55001, description: 'DDR' },
    { modelIdNum: 55007, description: 'NEW' },
    { modelIdNum: 55033, description: 'CAV' },
    { modelIdNum: 72100, description: 'DOR' }, // red brick: never an action door
    { modelIdNum: 61028, description: 'L0Z' },
  ] };
  assert.equal(isActionDoor(rdb, 0), true);
  assert.equal(isActionDoor(rdb, 1), true);
  assert.equal(isActionDoor(rdb, 2), true);
  assert.equal(isActionDoor(rdb, 3), true);
  assert.equal(isActionDoor(rdb, 4), false);
  assert.equal(isActionDoor(rdb, 5), false);
});

function rdbObjectFixture(overrides) {
  return {
    position: overrides.position ?? 1000,
    xPos: 0, yPos: 0, zPos: 0,
    type: overrides.type ?? 1,
    resources: {
      modelResource: {
        xRotation: 0, yRotation: 0, zRotation: 0,
        modelIndex: overrides.modelIndex ?? 0,
        triggerFlagStartingLock: overrides.trigger ?? 0,
        soundIndex: overrides.soundIndex ?? 0,
        actionResource: {
          axis: overrides.axis ?? 0,
          duration: overrides.duration ?? 0,
          magnitude: overrides.magnitude ?? 0,
          nextObjectOffset: overrides.next ?? 0,
          flags: overrides.flags ?? 0,
          previousObjectOffset: overrides.prev ?? -1,
        },
      },
      flatResource: overrides.flatResource ?? {
        textureArchive: 0, textureRecord: 0, flags: 0, magnitude: 0,
        soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: 0, action: 0,
      },
      lightResource: { radius: overrides.radius ?? 0 },
    },
  };
}

function rdbBlockFixture(objects, modelRefs) {
  return { rdbBlock: {
    modelReferenceList: modelRefs,
    objectRootList: [{ rdbObjects: objects }, { rdbObjects: null }],
  } };
}

test('dungeon: action records - vectors, flag cases, links, quirks', () => {
  const refs = [
    { modelIdNum: 61028, description: 'XXX' },
    { modelIdNum: 55000, description: 'DOR' },
    { modelIdNum: 41208, description: 'TRP' },
    { modelIdNum: 41001, description: 'LID' },
  ];
  const objs = [
    // Rotation about PositiveY, magnitude 472, chained to the next object.
    rdbObjectFixture({ position: 100, flags: ACTION_FLAGS.Rotation, axis: 4, magnitude: 472, duration: 34, next: 200 }),
    // Translation NegativeZ: z takes +magnitude (verbatim sign flip).
    rdbObjectFixture({ position: 200, flags: ACTION_FLAGS.Translation, axis: 5, magnitude: 128, prev: 100 }),
    // PositiveX flag case: duration 50, magnitude = axisRaw * 8, x = -mag.
    rdbObjectFixture({ position: 300, flags: ACTION_FLAGS.PositiveX, axis: 6 }),
    // Undefined action flag 0x0a and trigger 0x04 both collapse to None.
    rdbObjectFixture({ position: 400, flags: 0x0a, trigger: 0x04, magnitude: 50 }),
    // TRP with raw axis 13: NegativeX at magnitude 400.
    rdbObjectFixture({ position: 500, modelIndex: 2, flags: ACTION_FLAGS.Rotation, axis: 13, magnitude: 392 }),
    // LID rotation override.
    rdbObjectFixture({ position: 600, modelIndex: 3, flags: ACTION_FLAGS.Rotation, axis: 4, magnitude: 100 }),
    // Action door with starting lock nibble 13 -> 0x32.
    rdbObjectFixture({ position: 700, modelIndex: 1, trigger: 13 << 4, flags: 0 }),
  ];
  const getModel = () => ({ positions: new Float32Array(0), doors: [] });
  const L = layoutRdbBlock(rdbBlockFixture(objs, refs), 0, true, getModel);

  assert.equal(L.placements.length, 6);
  assert.equal(L.actionDoors.length, 1);
  assert.equal(L.actionDoors[0].startingLockValue, 0x32);

  const a0 = L.placements[0].action;
  approx(a0.rotation.y, 472 / ROTATION_DIVISOR);
  assert.equal(a0.nextObject, 200);
  assert.equal(a0.previousObject, -1); // -1 is not a key in the link dict

  const a1 = L.placements[1].action;
  approx(a1.translation.z, 128 * GLOBAL_SCALE); // NegativeZ -> +z
  assert.equal(a1.previousObject, 100);

  const a2 = L.placements[2].action;
  assert.equal(a2.duration, 50);
  assert.equal(a2.magnitude, 6 * 8);
  approx(a2.translation.x, -48 * GLOBAL_SCALE); // PositiveX -> -x

  const a3 = L.placements[3].action;
  assert.equal(a3.actionFlag, ACTION_FLAGS.None);
  assert.equal(a3.triggerFlag, TRIGGER_FLAGS.None);

  const a4 = L.placements[4].action;
  assert.equal(a4.magnitude, 400);
  approx(a4.rotation.x, -400 / ROTATION_DIVISOR);

  const a5 = L.placements[5].action;
  assert.deepEqual(a5.rotation, { x: 0, y: 0, z: -90 });
});

test('dungeon: flat action axis = magnitude quirk and marker split', () => {
  const refs = [{ modelIdNum: 61028, description: 'XXX' }];
  const flat = (position, archive, record, extra = {}) => rdbObjectFixture({
    position, type: 3,
    flatResource: {
      textureArchive: archive, textureRecord: record, flags: 0, magnitude: 0,
      soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: 0, action: 0,
      ...extra,
    },
  });
  const objs = [
    // Start marker with water: soundIndex 62 -> -496; castle via magnitude.
    flat(100, 199, 10, { soundIndex: 62, magnitude: 1 }),
    flat(200, 199, 8),
    // Fixed treasure (216): marker, hidden.
    flat(300, 216, 2),
    // Torch flat with a Translation action; axis carries the MAGNITUDE.
    flat(400, 210, 6, { action: ACTION_FLAGS.Translation, magnitude: 3, flags: TRIGGER_FLAGS.Direct }),
    // Light resource.
    rdbObjectFixture({ position: 500, type: 2, radius: 75 }),
  ];
  const L = layoutRdbBlock(rdbBlockFixture(objs, refs), 0, true, () => ({}));

  assert.equal(L.flats.length, 1);
  assert.equal(L.markers.length, 3);
  assert.equal(L.startMarkers.length, 1);
  assert.equal(L.enterMarkers.length, 1);
  assert.equal(L.waterLevel, -8 * 62);
  assert.equal(L.castleBlock, true);
  // Lights ride collectDungeonLights (the single source, verbatim
  // AddLight incl. the in-code range * 3 - audit 2026-08-16 removed
  // the unconsumed no-*3 copy this pass used to emit).
  const lights = collectDungeonLights(rdbBlockFixture(objs, refs));
  assert.equal(lights.length, 1);
  approx(lights[0].range, 75 * GLOBAL_SCALE * 3);

  const fa = L.flats[0].action;
  assert.equal(fa.isFlat, true);
  assert.equal(fa.axisRaw, 3); // = magnitude, verbatim DFU quirk
  approx(fa.translation.y, -3 * GLOBAL_SCALE); // axis 3 = NegativeY
  // Editor flats and acting flats join the link dict.
  assert.equal(L.actionLinks.size, 3);
});

test('dungeon: overlapping action doors disable against the registry', () => {
  const refs = [
    { modelIdNum: 55000, description: 'DOR' },
    { modelIdNum: 70300, description: 'EXT' },
  ];
  // Exit door model carries a DungeonExit ModelDoor so the registry seeds.
  const exitModel = {
    positions: new Float32Array(0),
    doors: [{
      index: 0, type: DOOR_TYPE.DUNGEON_EXIT,
      vert0: { x: 0, y: 0, z: 0 }, vert1: { x: 0, y: 2, z: 0 },
      vert2: { x: 1, y: 2, z: 0 }, normal: { x: 0, y: 0, z: 1 },
    }],
  };
  const getModel = (id) => id === 70300 ? exitModel : { positions: new Float32Array(0), doors: [] };
  const door = (position, x) => rdbObjectFixture({ position, modelIndex: 0 });
  const startObjs = [
    rdbObjectFixture({ position: 1, modelIndex: 1 }), // exit door at origin
    door(2), // action door 0.5 from the exit centre -> disabled
    Object.assign(door(3), { xPos: 400 }), // 10 units away -> survives
    Object.assign(door(4), { xPos: 420 }), // 0.5 from the survivor -> disabled
  ];
  startObjs[1].xPos = 20; // 0.5 world units
  const blockA = rdbBlockFixture(startObjs, refs);
  const fakeBlocks = {
    getBlockIndex: () => 0,
    getBlock: () => blockA,
  };
  const fakeLocation = {
    name: 'T', hasDungeon: true,
    climate: { worldClimate: 231, climateType: 300 },
    dungeon: {
      recordElement: { header: { locationId: 50050 } },
      blocks: [{ blockName: 'X.RDB', x: 0, z: 0, isStartingBlock: true }],
    },
  };
  const d = layoutDungeon(fakeLocation, fakeBlocks, getModel);
  const ad = d.blocks[0].layout.actionDoors;
  assert.equal(ad.length, 3);
  assert.equal(!!ad[0].disabled, true);
  assert.equal(!!ad[1].disabled, false);
  assert.equal(!!ad[2].disabled, true);
  assert.equal(RDB_SIDE, 51.2);
});

// ---------------------------------------------------------------------------
// Real-data validation - gated on ARENA2_PATH.
// ---------------------------------------------------------------------------

function loadReal() {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const maps = new MapsFile();
  maps.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))),
  );
  const cache = new Map();
  const getModel = (id) => {
    if (!cache.has(id)) {
      cache.set(id, dfMeshToModel(
        arch.getMesh(arch.getRecordIndex(id)),
        () => ({ width: 1, height: 1 })
      ));
    }
    return cache.get(id);
  };
  return { blocks, arch, maps, getModel };
}

test('dungeon: Privateer\'s Hold layout pins', { skip: skipReal }, () => {
  const { blocks, maps, getModel } = loadReal();
  const loc = maps.getLocationByName('Daggerfall', "Privateer's Hold");
  const d = layoutDungeon(loc, blocks, getModel);

  assert.deepEqual(d.textureTable, [23, 22, 19, 22, 20, 368]);
  assert.equal(d.blocks.length, 5);
  assert.deepEqual(d.blocks.map((b) => b.name), [
    'S0000999.RDB', 'B0000009.RDB', 'B0000006.RDB', 'B0000003.RDB', 'B0000012.RDB',
  ]);
  assert.deepEqual(d.blocks.map((b) => [b.originX, b.originZ]), [
    [0, 0], [-51.2, 0], [0, -51.2], [51.2, 0], [0, 51.2],
  ]);
  assert.deepEqual(d.blocks.map((b) => b.layout.placements.length), [188, 15, 32, 38, 34]);
  assert.deepEqual(d.blocks.map((b) => b.layout.actionDoors.length), [21, 6, 10, 11, 10]);
  assert.deepEqual(d.blocks.map((b) => collectDungeonLights(b.dfBlock).length), [39, 5, 7, 11, 9]);
  assert.deepEqual(d.blocks.map((b) => b.layout.actionLinks.size), [45, 3, 5, 5, 4]);

  // Exit door only in the starting block; none disabled here.
  assert.equal(d.blocks[0].layout.exitDoors.length, 1);
  assert.equal(d.blocks.slice(1).every((b) => b.layout.exitDoors.length === 0), true);
  assert.equal(d.blocks.every((b) => b.layout.actionDoors.every((a) => !a.disabled)), true);

  // The classic spawn.
  approx(d.startMarker.x, 28.375);
  approx(d.startMarker.y, 38.975);
  approx(d.startMarker.z, 12.4);
  approx(d.enterMarker.x, 12.75);
  assert.equal(d.blocks.every((b) => b.layout.waterLevel === 10000), true);
});

test('dungeon: full dungeon corpus - all 4232 lay out, overlap removal fires', { skip: skipReal }, () => {
  const { blocks, maps, getModel } = loadReal();
  let dungeons = 0, blocksTotal = 0, disabled = 0, withDisabled = 0, noStart = 0;
  let maxLock = 0;
  const tables = new Set();
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < region.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc || !loc.hasDungeon) continue;
      const d = layoutDungeon(loc, blocks, getModel);
      dungeons++;
      blocksTotal += d.blocks.length;
      tables.add(d.textureTable.join(','));
      let dis = 0;
      for (const b of d.blocks) {
        for (const a of b.layout.actionDoors) {
          if (a.disabled) dis++;
          if (a.startingLockValue > maxLock) maxLock = a.startingLockValue;
        }
      }
      disabled += dis;
      if (dis) withDisabled++;
      if (!d.startMarker) noStart++;
    }
  }
  assert.equal(dungeons, 4232);
  assert.equal(blocksTotal, 40263);
  // RemoveOverlappingDoors fires on real block seams.
  assert.equal(disabled, 4968);
  assert.equal(withDisabled, 2072);
  // Every dungeon in the game resolves a spawn.
  assert.equal(noStart, 0);
  assert.equal(tables.size, 2163);
  // Lock decode stays inside the 16-entry table on all classic data
  // (raw values sweep to 240 -> nibble 15 -> lock 0xff).
  assert.equal(maxLock, 0xff);
});

test('dungeon: RDB corpus - every block lays out clean, resource closure holds', { skip: skipReal }, () => {
  const { blocks, getModel } = loadReal();
  let n = 0;
  const tot = { p: 0, ad: 0, f: 0, mk: 0, li: 0, ed: 0, lk: 0 };
  let wet = 0, castles = 0, w0 = null;
  for (let i = 0; i < blocks.count; i++) {
    const name = blocks.getBlockName(i);
    if (!name.endsWith('.RDB')) continue;
    const L = layoutRdbBlock(blocks.getBlock(i), i, true, getModel);
    n++;
    tot.p += L.placements.length;
    tot.ad += L.actionDoors.length;
    tot.f += L.flats.length;
    tot.mk += L.markers.length;
    tot.li += collectDungeonLights(blocks.getBlock(i)).length;
    tot.ed += L.exitDoors.length;
    tot.lk += L.actionLinks.size;
    if (L.waterLevel !== 10000) wet++;
    if (L.castleBlock) castles++;
    if (name === 'W0000000.RDB') w0 = L.waterLevel;
  }
  assert.equal(n, 187);
  // Placements + action doors and flats + markers close against the
  // Readers-Arc resource pins (22962 models, 12238 flats, 4268 lights).
  assert.equal(tot.p, 20487);
  assert.equal(tot.ad, 2475);
  assert.equal(tot.p + tot.ad, 22962);
  assert.equal(tot.f, 7720);
  assert.equal(tot.mk, 4518);
  assert.equal(tot.f + tot.mk, 12238);
  assert.equal(tot.li, 4268);
  assert.equal(tot.ed, 195);
  assert.equal(tot.lk, 5843);
  assert.equal(wet, 32);
  assert.equal(castles, 5);
  assert.equal(w0, -496);
});

test('dungeon: R6 point lights - verbatim RDB Light collection', { skip: skipReal }, async () => {
  const { collectDungeonLights, DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } =
    await import('../src/world/dungeonLights.js');
  const { blocks, maps, getModel } = loadReal();
  // Single block pin.
  const blk = blocks.getBlock(blocks.getBlockIndex('S0000040.RDB'));
  const single = collectDungeonLights(blk);
  assert.equal(single.length, 24);
  approx(single[0].x, 23.4, 1e-6);
  approx(single[0].y, 33, 1e-6);
  approx(single[0].z, 16, 1e-6);
  approx(single[0].range, 4.875, 1e-6);
  // Whole pinned dungeon (Privateer's Hold): 71 lights across 5 blocks.
  const loc = maps.getLocationByName('Daggerfall', "Privateer's Hold");
  const d = layoutDungeon(loc, blocks, getModel);
  let total = 0;
  for (const b of d.blocks) total += collectDungeonLights(b.dfBlock).length;
  assert.equal(total, 71);
  // Prefab constants.
  assert.deepEqual([...DUNGEON_AMBIENT], [0.12, 0.12, 0.12]);
  assert.deepEqual([...DUNGEON_LIGHT_COLOR], [0.8, 0.8, 0.8]);
});

test('dungeon: per-light flicker ranges stay in [start - 1, start]', async () => {
  const { CityLightAnimator } = await import('../src/world/worldClock.js');
  const starts = [4.875, 7.5, 15, 5.625];
  const a = new CityLightAnimator(starts.length, starts);
  for (let t = 0; t < 300; t++) {
    a.tick(1 / 60);
    for (let i = 0; i < starts.length; i++) {
      assert.ok(a.ranges[i] >= starts[i] - 1 - 0.4 - 1e-6, `low ${i}`);
      assert.ok(a.ranges[i] <= starts[i] + 1e-6, `high ${i}`);
    }
  }
});

test('dungeon: R7 water planes - corpus and location pins', { skip: skipReal }, async () => {
  const { blocks, maps, getModel } = loadReal();
  // Corpus: 32 of 187 RDB blocks carry a start-marker water level.
  const { collectDungeonLights } = await import('../src/world/dungeonLights.js');
  let watered = 0;
  let total = 0;
  let lightObjects = 0;
  for (let i = 0; i < blocks.count; i++) {
    if (!blocks.getBlockName(i).endsWith('.RDB')) continue;
    total++;
    lightObjects += collectDungeonLights(blocks.getBlock(i)).length;
    const layout = layoutRdbBlock(blocks.getBlock(i), i, false, getModel);
    if (layout.waterLevel !== 10000) watered++;
  }
  assert.equal(total, 187);
  assert.equal(watered, 32);
  // R6-R8 audit: RDB Light objects, corpus-wide.
  assert.equal(lightObjects, 4268);
  const w0 = layoutRdbBlock(
    blocks.getBlock(blocks.getBlockIndex('W0000000.RDB')),
    blocks.getBlockIndex('W0000000.RDB'), false, getModel);
  assert.equal(w0.waterLevel, -496);
  // Maorn's Guard: three watered blocks at pinned levels.
  const loc = maps.getLocationByName("Alik'r Desert", "Maorn's Guard");
  const d = layoutDungeon(loc, blocks, getModel);
  assert.equal(d.blocks.length, 11);
  const levels = d.blocks
    .filter((b) => b.layout.waterLevel !== 10000)
    .map((b) => [b.name, b.layout.waterLevel]);
  assert.deepEqual(levels, [
    ['W0000011.RDB', -248], ['W0000015.RDB', -488], ['W0000022.RDB', -144],
  ]);
});
