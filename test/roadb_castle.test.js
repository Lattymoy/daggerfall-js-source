// ROAD-B b4-castle-interiors: the three castle-and-interior laws.
//
//  1. GameManager.IsPlayerInsideCastle (GameManager.cs:420-423) is
//     PlayerEnterExit.IsPlayerInsideDungeonCastle (:136-139), which is
//     the CURRENT dungeon block's CastleBlock flag (:338). Four talk /
//     quest mounts in scenes/world.js hardcoded `false`.
//  2. DaggerfallAction.CastleDaggerfallMagicDoorsSpecialOpenHack
//     (DaggerfallAction.cs:183, :256-273) - the two magically-held
//     Castle Daggerfall foyer doors, named by LoadID, open for a player
//     who teleported in behind them.
//  3. PlayerEnterExit.IsPlayerInsideTavern / IsPlayerInsideResidence
//     (:160-170), latched by PlayerActivate.TransitionInterior
//     (:1121-1122) and read by SpawnCityGuards' indoor arm
//     (PlayerEntity.cs:628-641).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ActionSystem, CASTLE_DAGGERFALL_MAP_ID, CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS,
} from '../src/world/actionSystem.js';
import { TRIGGER_FLAGS, ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { BUILDING_TYPES, isTavern, isResidence } from '../src/world/buildingNames.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const SRC = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};
function stubCollider() {
  const buckets = new Set();
  return { buckets, addMesh: (k) => buckets.add(k), removeBucket: (k) => buckets.delete(k), raycast: () => Infinity };
}

// ---------------------------------------------------------------
// 1. IsPlayerInsideCastle, live
// ---------------------------------------------------------------

test('ROAD-B B4: the mode host publishes IsPlayerInsideDungeonCastle off the block flag', () => {
  const wm = SRC('scenes/worldModes.js');
  assert.match(wm,
    /get insideDungeonCastle\(\) \{ return mode === 'dungeon' \? \(dungeonCtx\?\.inCastle \?\? false\) : false; \}/,
    'PlayerEnterExit.cs:338 - the flag is the current dungeon block\'s CastleBlock, and false outside a dungeon');
});

test('ROAD-B B4: every world.js talk/quest mount takes the LIVE castle flag', () => {
  const w = SRC('scenes/world.js');
  const live = w.match(/isPlayerInsideCastle: \(\) => modes\?\.insideDungeonCastle \?\? false,/g) ?? [];
  assert.equal(live.length, 4,
    'the topic tree, the NPC session, the answer pipeline and the quest bridge all read GameManager.IsPlayerInsideCastle');
  assert.doesNotMatch(w, /isPlayerInsideCastle: \(\) => false/,
    'no mount may hardcode the flag again - the castle questor door, the Where-am-I dungeon arm and both '
    + 'DaggerfallQuestOfferWindow carve-outs all fork on it');
});

// ---------------------------------------------------------------
// 2. CastleDaggerfallMagicDoorsSpecialOpenHack
// ---------------------------------------------------------------

test('ROAD-B B4: the foyer-door constants are DFU\'s literals', () => {
  assert.equal(CASTLE_DAGGERFALL_MAP_ID, 1291010263);
  assert.deepEqual([...CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS], [29331574, 29331622]);
});

/** A locked, closed action door carrying `loadID`, in a system whose
 *  ambient context is the Castle Daggerfall teleport-in case. */
function magicDoorRig(over = {}, loadID = 29331574) {
  const c = stubCollider();
  const { action = null, ...ctxOver } = over;
  const ctx = {
    playerTeleportedIntoDungeon: true,
    isPlayerInsideDungeon: true,
    currentMapId: CASTLE_DAGGERFALL_MAP_ID,
    ...ctxOver,
  };
  const a = new ActionSystem(c, { magicDoorsContext: () => ctx });
  // With no `action`, TriggerFlag is None: the door's own record accepts
  // NOTHING but a chain cascade, which is the point - DFU runs the hack
  // BEFORE that switch. Pass one to make the record observable.
  const door = a.addDoor(CUBE, I, {
    ns: 0, positionKey: 7, startingLockValue: 20, loadID, action,
  });
  return { a, c, door, ctx };
}

test('ROAD-B B4: the hack unlocks and opens a magically-held foyer door', () => {
  for (const loadID of CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS) {
    const { a, c, door } = magicDoorRig({}, loadID);
    assert.equal(door.currentLockValue, 20, 'IsMagicallyHeld (>= 20) at the start');
    a.receive(door, 'Direct');
    assert.equal(door.currentLockValue, 0, 'CurrentLockValue = 0');
    assert.equal(door.state, 'forward', 'ToggleDoor() swung it open');
    assert.equal(c.buckets.has(door.key), false, 'MakeTrigger(true) - the player can walk through');
  }
});

test('ROAD-B B4: the hack\'s ToggleDoor() is NOT activatedByPlayer (DaggerfallAction.cs:272)', () => {
  // The live foyer doors carry a DaggerfallAction - the hack runs from
  // Receive, so the component is there - and a record with no action at
  // all cannot tell the two arities apart. With activatedByPlayer TRUE
  // the DoorText first-activation hold (DaggerfallActionDoor.cs:265,
  // ported at actionSystem.js's _openDoor) swallows the open and leaves
  // the door shut with its collider solid, which is precisely what DFU
  // wrote the hack to prevent ("just to prevent player being locked
  // inside throne room", :268).
  const { a, c, door } = magicDoorRig({
    action: {
      actionFlag: ACTION_FLAGS.DoorText, index: 5, magnitude: 0, axisRaw: 0,
      duration: 0, nextObject: -1, triggerFlag: TRIGGER_FLAGS.Direct,
      rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 },
    },
  });
  a.receive(door, 'Direct');
  assert.equal(door.currentLockValue, 0, 'CurrentLockValue = 0 either way');
  assert.equal(door.state, 'forward',
    'ToggleDoor() with its default activatedByPlayer = false opens straight through the DoorText hold');
  assert.equal(c.buckets.has(door.key), false, 'MakeTrigger(true) - the throne room is not sealed');
});

test('ROAD-B B4: the hack runs BEFORE the trigger-flag switch (DaggerfallAction.cs:183)', () => {
  const { a, door } = magicDoorRig();
  assert.equal(door.triggerFlag, TRIGGER_FLAGS.None,
    'a None-flagged record refuses every trigger type but ActionObject');
  a.receive(door, 'Direct');   // the switch would `return` on this
  assert.equal(door.state, 'forward', 'the door still opened');
  assert.equal(door.activationCount, 0, 'and the record itself never fired - Receive returned at the switch');
});

test('ROAD-B B4: the hack is gated on the IsPlaying check above it', () => {
  const { a, door } = magicDoorRig();
  door.moveState = 'forward';   // DaggerfallAction.IsPlaying - the record's Move state
  a.receive(door, 'Direct');
  assert.equal(door.currentLockValue, 20, 'Receive returns before the hack');
  assert.equal(door.state, 'start');
});

test('ROAD-B B4: every term of the hack\'s conjunction refuses on its own', () => {
  const cases = [
    ['not teleported in', { playerTeleportedIntoDungeon: false }, 29331574],
    ['not inside a dungeon', { isPlayerInsideDungeon: false }, 29331574],
    ['a different location', { currentMapId: 1291010264 }, 29331574],
    ['a door with another LoadID', {}, 29331575],
  ];
  for (const [why, over, loadID] of cases) {
    const { a, door } = magicDoorRig(over, loadID);
    a.receive(door, 'Direct');
    assert.equal(door.currentLockValue, 20, `${why}: the door stays magically held`);
    assert.equal(door.state, 'start', `${why}: and shut`);
  }
});

test('ROAD-B B4: an unlocked or already-open foyer door is left alone (IsLocked && IsClosed)', () => {
  const unlocked = magicDoorRig();
  unlocked.door.currentLockValue = 0;
  unlocked.a.receive(unlocked.door, 'Direct');
  assert.equal(unlocked.door.state, 'start', 'IsLocked is false - the hack must not open a door the player closed');

  const open = magicDoorRig();
  open.door.state = 'end';
  open.a.receive(open.door, 'Direct');
  assert.equal(open.door.currentLockValue, 20, 'IsClosed is false - nothing happens');
  assert.equal(open.door.state, 'end');
});

test('ROAD-B B4: a non-door action object with a foyer LoadID is skipped (GetComponent<DaggerfallActionDoor>)', () => {
  const c = stubCollider();
  const a = new ActionSystem(c, {
    magicDoorsContext: () => ({
      playerTeleportedIntoDungeon: true, isPlayerInsideDungeon: true, currentMapId: CASTLE_DAGGERFALL_MAP_ID,
    }),
  });
  const relay = a.addRelay(0, 5, { actionFlag: 0, index: 0, axisRaw: 0, nextObject: -1, triggerFlag: TRIGGER_FLAGS.Direct });
  relay.loadID = 29331574;
  a.receive(relay, 'Direct');
  assert.equal(relay.currentLockValue, undefined, 'a relay has no lock to clear');
  assert.equal(relay.state, 'start', 'and no hinge to swing');
});

test('ROAD-B B4: a host with no magic-doors context cannot fire the hack', () => {
  const c = stubCollider();
  const a = new ActionSystem(c);   // interiorContext's shape
  const door = a.addDoor(CUBE, I, { ns: 0, positionKey: 7, startingLockValue: 20, loadID: 29331574 });
  a.receive(door, 'Direct');
  assert.equal(door.currentLockValue, 20);
  assert.equal(door.state, 'start');
});

test('ROAD-B B4: LoadID is blockData.Position + obj.Position, and it reaches the door', () => {
  // RDBLayout.cs:240-242 / :1179.
  const rdb = SRC('world/rdbLayout.js');
  assert.match(rdb, /const blockPosition = dfBlock\.position \?\? 0;/);
  assert.match(rdb, /loadID: blockPosition \+ obj\.position,/);
  assert.match(SRC('scenes/dungeonContext.js'), /loadID: d\.loadID,/,
    'the dungeon host hands the layout\'s id to the runtime door');
  // ...and the runtime keeps it, defaulting to DFU's not-serialized 0.
  const a = new ActionSystem(stubCollider());
  assert.equal(a.addDoor(CUBE, I, { loadID: 4242 }).loadID, 4242);
  assert.equal(a.addDoor(CUBE, I, {}).loadID, 0);
});

test('ROAD-B B4: the dungeon host supplies the hack\'s three ambient reads', () => {
  const dc = SRC('scenes/dungeonContext.js');
  assert.match(dc, /magicDoorsContext: \(\) => \(\{/);
  assert.match(dc, /playerTeleportedIntoDungeon: !!playerEntity\.playerTeleportedIntoDungeon,/);
  assert.match(dc, /currentMapId: dfLocation\?\.mapTableData\?\.mapId \?\? 0,/);
});

// Real-data validation: the two LoadIDs must name two real action doors
// in the Castle Daggerfall dungeon, or the hack can never fire in play.
test('ROAD-B B4 (real data): both foyer LoadIDs resolve to locked Castle Daggerfall doors', { skip: skipReal }, async () => {
  const { BsaFile } = await import('../src/formats/bsaFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { layoutDungeon } = await import('../src/world/dungeonLayout.js');

  const bsa = new BsaFile();
  bsa.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const maps = new MapsFile();
  maps.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))),
  );
  const loc = maps.getLocationByName('Daggerfall', 'Daggerfall');
  assert.equal(loc.mapTableData.mapId, CASTLE_DAGGERFALL_MAP_ID, 'the hack\'s MapId is this location');
  const dungeon = layoutDungeon(loc, blocks, () => ({ positions: new Float32Array(0), indices: new Uint32Array(0), doors: [] }));
  const found = new Map();
  for (const b of dungeon.blocks) {
    for (const d of b.layout.actionDoors) {
      if (CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS.includes(d.loadID)) found.set(d.loadID, { block: b.name, lock: d.startingLockValue });
    }
  }
  for (const id of CASTLE_DAGGERFALL_FOYER_DOOR_LOAD_IDS) {
    assert.ok(found.has(id), `LoadID ${id} names an action door in Castle Daggerfall`);
    assert.ok(found.get(id).lock >= 20, `LoadID ${id} is magically held (IsMagicallyHeld, lock >= 20)`);
  }
});

// ---------------------------------------------------------------
// 3. IsPlayerInsideTavern / IsPlayerInsideResidence
// ---------------------------------------------------------------

test('ROAD-B B4: RMBLayout.IsTavern / IsResidence over every building type', () => {
  // IsTavern (:803) is a bare equality; IsResidence (:753-760) is
  // House1..House4 and DFU's own comment says only those four.
  for (const [name, t] of Object.entries(BUILDING_TYPES)) {
    assert.equal(isTavern(t), name === 'Tavern', `isTavern(${name})`);
    assert.equal(isResidence(t), ['House1', 'House2', 'House3', 'House4'].includes(name), `isResidence(${name})`);
  }
  assert.equal(isResidence(BUILDING_TYPES.House5), false, 'House5/House6 are NOT residences by DFU\'s test');
  assert.equal(isResidence(BUILDING_TYPES.HouseForSale), false);
});

test('ROAD-B B4: the mode host latches both flags at the door and publishes all three', () => {
  const wm = SRC('scenes/worldModes.js');
  // PlayerActivate.cs:1121-1122, in the same block as insideOpenShop.
  assert.match(wm, /_insideTavern = isTavern\(interiorBuilding\?\.buildingType \?\? BUILDING_TYPES\.None\);/);
  assert.match(wm, /_insideResidence = isResidence\(interiorBuilding\?\.buildingType \?\? BUILDING_TYPES\.None\);/);
  assert.match(wm, /get insideTavern\(\) \{ return _insideTavern; \}/);
  assert.match(wm, /get insideResidence\(\) \{ return _insideResidence; \}/);
  assert.match(wm, /get insideOpenShop\(\) \{ return !!interiorBuilding\?\.insideOpenShop; \}/);
  // PlayerEnterExit.cs:874 and :1112 clear the TAVERN latch at both
  // exits; VERBATIM QUIRK - neither clears the residence one.
  const tavernClears = (wm.match(/(?<!let )_insideTavern = false;/g) ?? []).length;
  assert.equal(tavernClears, 3, 'the building exit, the teleport/load exit, and the dungeon transition');
  assert.equal((wm.match(/(?<!let )_insideResidence = false;/g) ?? []).length, 0,
    'DFU never clears IsPlayerInsideResidence - preserved');
});

/** cityGuards with every seam stubbed and a spawn path that THROWS, so
 *  "did the indoor gate return early" is observable without ARENA2. */
function guardRig(flags) {
  return createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { heightAt: () => 0, raycast: () => Infinity },
    fetchBytes: async () => { throw new Error('SPAWNED'); },
    getTexture: async () => ({ getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecordFrame: () => {},
    currentMinute: () => 0,
    playerEntity: { level: 1, reflexes: 2, skills: 30, stats: { strength: 50, agility: 50, luck: 50 } },
    audio: null,
    onPlayerHurt: () => {},
    rand: () => 0.9,
    enterExitFlags: () => flags,
  });
}

test('ROAD-B B4: SpawnCityGuards\' indoor arm returns before the exterior pool', async () => {
  // PlayerEntity.cs:628-641 - the `return` is unconditional inside the
  // arm, so an interior summons the street watch through no door.
  for (const flag of ['insideOpenShop', 'insideTavern', 'insideResidence']) {
    const g = guardRig({ isPlayerInside: true, insideOpenShop: false, insideTavern: false, insideResidence: false, [flag]: true });
    let disabled = 0;
    await g.spawnCityGuards(true, {
      playerFeet: [0, 0, 0],
      playerFwd: [0, 0, 1],
      pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => disabled++ }],
    });
    assert.equal(g.activeCount(), 0, `${flag}: nobody spawns`);
    assert.equal(disabled, 0, `${flag}: and no street NPC is consumed`);
  }
});

test('ROAD-B B4: outside, and inside a building the arm does NOT name, the exterior pool still runs', async () => {
  const outside = guardRig({ isPlayerInside: false, insideOpenShop: true, insideTavern: true, insideResidence: true });
  await assert.rejects(
    outside.spawnCityGuards(true, {
      playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
      pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }],
    }),
    /SPAWNED/, 'IsPlayerInside is the first term of the conjunction');

  // A guild hall, a temple, a palace: inside, but none of the three latches.
  const other = guardRig({ isPlayerInside: true, insideOpenShop: false, insideTavern: false, insideResidence: false });
  await assert.rejects(
    other.spawnCityGuards(true, {
      playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
      pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }],
    }),
    /SPAWNED/, 'the arm names exactly three latches');

  // No host flags at all (the standalone exterior host).
  const bare = guardRig(null);
  await assert.rejects(
    bare.spawnCityGuards(true, {
      playerFeet: [0, 0, 0], playerFwd: [0, 0, 1],
      pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }],
    }),
    /SPAWNED/);
});

test('ROAD-B B4: the world host feeds the guard gate the mode host\'s three latches', () => {
  const w = SRC('scenes/world.js');
  assert.match(w, /enterExitFlags: \(\) => \(\{[\s\S]{0,400}?insideOpenShop: modes\?\.insideOpenShop \?\? false,/);
  assert.match(w, /insideTavern: modes\?\.insideTavern \?\? false,/);
  assert.match(w, /insideResidence: modes\?\.insideResidence \?\? false,/);
});
