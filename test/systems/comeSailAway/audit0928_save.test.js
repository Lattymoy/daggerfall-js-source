// AUDIT PRE-MERGE 0928 (the save and the lifecycle) - the Sea Update read before it merges, the save lens's findings
// pinned against the modules they live in:
//   S1  a load that lands while the Disembark key's coroutine holds the player (the helm's freeze still running) was
//       overtaken by it - the loaded player pinned to the destroyed boat's helm, a restored helm dead and then "stopped"
//   S2  a load while placing spent the parts from the list the load had replaced: one parts item, two boats
//   S3  a save taken on a boat, loaded with Come Sail Away off, kept "I'm On A Boat" - a 90,000-round water walk
//   S4  (and lens U's U7) the mod's switch read once, at load, at every door: the shelf's rows and the mod's keys (and
//       the two other next-load mods' doors that read theirs live: Travel Options' key, Iliac Puddle No More's fish rows)
//   C1  (lens C's) a load that lands elsewhere let go of the helm and kept the ship the helm had lent
//   H/S the abyss's way back: a teleport that fails left `transitioning` up for the session and its rejection unheard
// The runtime runs over the vendored hulls and a scripted scene (test/systems/comeSailAway/csa_sailing.test.js's); the hosts' halves that
// cannot be driven outside a browser are pinned by their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat, TRIGGER_MODEL } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_ACTIONS, BOAT_EFFECT_BUNDLE } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { BOAT_ITEM_GROUP, BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { DEEP_WATERS_FISH_TEMPLATES } from '../../../src/systems/deepWater/deepWatersFishItems.js';
import { customItemsForGroup } from '../../../src/systems/item/itemTemplates.js';
import * as MS from '../../../src/systems/modSettings.js';
import * as IA from '../../../src/systems/inputActions.js';
import { setBindings, held } from '../../../src/ui/input.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { assignModBundle, isEntityWaterWalking, WATER_WALKING_SILENT_KIND, effectKindLoaded } from '../../../src/systems/effects.js';
import { assignShipToPlayer, ownsShip, sellShip, SHIP_TYPES } from '../../../src/systems/banking.js';
import { createOceanHolesAbyss } from '../../../src/scenes/oceanHolesAbyss.js';
import { mapPixelToLongitudeLatitude, mapPixelToWorldCoord, worldCoordToMapPixel } from '../../../src/formats/mapsFile.js';
import { enemyRoster } from '../../../src/world/underwater/underwaterEnemies.js';

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });
const near = (a, b, eps = 1e-4) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= eps);

/** The scripted scene of test/systems/comeSailAway/csa_sailing.test.js: the pool keeps what stands (a removed boat leaves it), the helm's
 *  seams recorded, every tile water, Time.deltaTime a quarter second. */
function scene(opts = {}) {
  const out = { hud: [], mid: [], log: [], removed: [], sailing: [], assigned: [], scenes: [], packed: [] };
  const started = new Set();
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0 };
  const terrains = [{ mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128).fill(0), sampleHeight: () => 20 }];
  let now = 0;
  const standing = [];
  const deps = {
    pool: {
      models: MODELS,
      ready: () => true,
      spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); standing.push(boat); return boat; },
      remove: (b) => { out.removed.push(b); const i = standing.indexOf(b); if (i >= 0) standing.splice(i, 1); },
    },
    player: () => ({ position: [...player.position], rotation: [0, Math.sin((player.yaw * Math.PI / 180) / 2), 0, Math.cos((player.yaw * Math.PI / 180) / 2)] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => false,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => ({ distance: 3, point: [2, 0, 2], name: 'DaggerfallTerrain', terrain: terrains[0], root: null }),
    playerTerrain: () => terrains[0],
    terrainAt: (x, y) => terrains.find((t) => t.mapPixelX === x && t.mapPixelY === y) ?? null,
    terrains: () => terrains,
    heightMapValue: () => 255,
    worldCompensation: () => [0, 0, 0],
    hudText: (t) => out.hud.push(t),
    midScreenText: (t, s) => out.mid.push([t, s]),
    log: (t) => out.log.push(t),
    random: { range: (min) => min },
    time: () => now,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (items) => items.map((it) => ({ ...it })), deserialize: (records) => records.map((it) => ({ ...it })) },
    dt: () => 0.25,
    setting: (key) => ({ 'Waves.Enable': false })[key],
    input: { has: () => false, started: (a) => started.has(a), horizontal: () => 0, vertical: () => 0, toggleAutorun: false },
    helm: {
      setPlayerPosition: (p) => { player.position = [...p]; },
      setFacing: (yaw) => { player.yaw = yaw; },
      turnPlayer: (d) => { player.yaw += d; },
      freeze: (s) => { player.frozen = s; },
      frozen: () => player.frozen > 0,
      stopRunning: () => {},
      footsteps: () => {},
      alignToGround: () => {},
    },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false },
    ship: { owns: () => false, assign: (t) => out.assigned.push(t), removePermanentScene: (n) => out.scenes.push(n) },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: (items) => items.reduce((a, i) => a + (i.weight ?? 0), 0),
    sphereCastAll: () => [],
    enemies: () => [],
    timeScale: () => 1,
    setTimeScale: () => {},
    messageBox: () => {},
    items: { create: (templateIndex) => ({ group: 'UselessItems2', templateIndex, name: 'Parts of', message: 0, UID: 900 + out.packed.length }), addToPlayer: (item) => out.packed.push(item) },
    ...opts.deps,
  };
  const rt = createComeSailAwayRuntime(deps);
  rt.on('OnUpdateSailing', (v) => out.sailing.push(v));
  /** The host's call (world.js csaCall): an exception in the mod's frame is logged and the frame goes on. */
  const call = (fn) => { try { fn(); } catch (e) { out.log.push(`threw: ${e.message}`); } };
  /** One frame as the host runs it: last frame's coroutines, FixedUpdate, Update, LateUpdate. */
  const frame = ({ press = [], activate = false } = {}) => {
    started.clear();
    for (const a of press) started.add(a);
    call(() => { rt.endOfFrame(); rt.fixedUpdate(); rt.update(); rt.lateUpdate({ activateComplete: activate }); });
    started.clear();
  };
  return { rt, out, player, frame, deps, standing, setTime: (t) => { now = t; }, place: (hull = 1, position = [100, 34, 200]) => rt.PlaceBoat(position, [0, 0, 1], hull, 0, terrains[0]) };
}

/** A save made at the helm of a Large Boat standing at (100, 34, 200). */
function helmRecord() {
  const s = scene();
  s.rt.StartSailing(s.place(1, [100, 34, 200]));
  s.frame();
  return JSON.parse(JSON.stringify(s.rt.getSaveData()));
}
/** At the helm of a Large Boat at (140, 34, 200), the Disembark key pressed and its un-parenting run: the coroutine
 *  holds the player at the helm while the motor's freeze runs. */
function disembarking() {
  const s = scene();
  const boat = s.place(1, [140, 34, 200]);
  s.rt.StartSailing(boat);
  s.frame();
  s.frame({ press: [BOAT_ACTIONS.disembark] });
  s.frame();
  assert.ok(s.player.frozen > 0 && s.rt.state.disembarking != null, 'held at the helm, the freeze running');
  return { s, boat };
}

// ── S1 ──────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 S1: a save made ashore, loaded while the disembark holds the player - the load\'s start ends the disembark (the freeze lifted, OnUpdateSailing(false)) and the player stays where the load put them', () => {
  const { s, boat } = disembarking();
  const ashore = { ...helmRecord(), currentBoat: -1 };
  s.rt.OnStartLoad();
  assert.ok(s.rt.state.disembarking === null, 'no disembark left behind the load\'s start');   // by identity: a failing diff of a boat's graph never ends
  assert.equal(s.player.frozen, 0, 'the freeze lifted, as StopSailing lifts it');
  assert.deepEqual(s.out.sailing, [true, false], 'the sail\'s end said once, at the load\'s start');
  s.rt.restoreSaveData(JSON.parse(JSON.stringify(ashore)));
  s.rt.OnLoad();
  assert.ok(!s.standing.includes(boat), 'the restore destroyed the boat the disembark held');
  s.player.position = [5, 5, 5];   // the save's own place, landed by the load
  s.frame();
  s.frame();
  assert.deepEqual(s.player.position, [5, 5, 5], 'nothing pins the loaded player to the destroyed boat\'s helm');
  assert.deepEqual(s.out.sailing, [true, false]);
  assert.equal(s.rt.isSailing(), false);
});

test('AUDIT PRE-MERGE 0928 S1: a save made at the helm, loaded while the disembark holds the player - the restored helm stands at once and is never told it stopped', () => {
  const { s, boat } = disembarking();
  const rec = helmRecord();
  s.rt.OnStartLoad();
  s.rt.restoreSaveData(JSON.parse(JSON.stringify(rec)));
  s.rt.OnLoad();
  const restored = s.rt.AllBoats[rec.currentBoat];
  assert.ok(restored && s.rt.state.CurrentBoat === restored, 'the save\'s helm taken');
  assert.equal(s.rt.isSailing(), true, 'at the helm at once - no disembark left to shut it');
  for (let i = 0; i < 8; i++) s.frame();   // past the second the old freeze would have run
  assert.ok(near(s.player.position, restored.DrivePosition.position), 'at the restored boat\'s helm, never the destroyed one\'s');
  assert.ok(!near(boat.DrivePosition.position, restored.DrivePosition.position));
  assert.deepEqual(s.out.sailing, [true, false, true], 'the old sail ended at the load\'s start; the restored one never told it stopped');
  assert.ok(s.rt.state.CurrentBoat === restored && s.rt.isSailing());
});

test('AUDIT PRE-MERGE 0928 S1: a load on the frame after the Disembark key, before the un-parenting - the restored helm is not undone by it', () => {
  const s = scene();
  const boat = s.place(1, [140, 34, 200]);
  s.rt.StartSailing(boat);
  s.frame();
  s.frame({ press: [BOAT_ACTIONS.disembark] });   // the head; the un-parenting waits for the frame's end
  const rec = helmRecord();
  s.rt.OnStartLoad();
  s.rt.restoreSaveData(JSON.parse(JSON.stringify(rec)));
  s.rt.OnLoad();
  s.frame();
  assert.ok(s.rt.state.CurrentBoat === s.rt.AllBoats[rec.currentBoat], 'the restored helm stands');
  assert.equal(s.rt.isSailing(), true);
});

test('AUDIT PRE-MERGE 0928 S1: a boat destroyed under the disembark\'s hold (packed at its rudder) ends the coroutine as Unity\'s destroyed transform does - raising nothing, the player left where they are', () => {
  const { s, boat } = disembarking();
  s.rt.activate(TRIGGER_MODEL.drive, { root: boat.GameObject, node: boat.DriveTrigger, distance: 1 }, 'steal');   // PackBoat
  assert.ok(!s.rt.AllBoats.includes(boat) && s.out.packed.length === 1, 'packed: off the list, its parts in the pack');
  s.player.position = [7, 7, 7];
  s.frame();
  assert.deepEqual(s.player.position, [7, 7, 7], 'no pin to a boat that is gone');
  assert.ok(s.rt.state.disembarking === null, 'the disembark ended');
  assert.deepEqual(s.out.sailing, [true], 'the coroutine died before its OnUpdateSailing(false)');
  assert.equal(s.rt.isSailing(), false);
});

// ── S2 ──────────────────────────────────────────────────────────────────────

/** A character as the save module restores one. */
const character = (items) => ({
  name: 'Mac', gender: 'female', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
  startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
  stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0], career: { name: 'Healer', hitPointsPerLevel: 8 },
  items, spells: [], activeEffects: [],
});

test('AUDIT PRE-MERGE 0928 S2: one parts item, one boat, across a load - the parts used, the game loaded while placing, the click spends the LOADED pack\'s copy (by its UID), and there is nothing left to place a second', () => {
  const s = scene();
  const entity = character([{ group: 'UselessItems2', templateIndex: BOAT_PARTS_TEMPLATE, name: "Parts of Rowboat 'I'", UID: 123, message: 0 }]);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(entity, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  const rec = JSON.parse(JSON.stringify(s.rt.getSaveData()));
  // the host hands the pack as a live list (world.js csaLiveList): the entity's own lists are ItemCollections whose
  // object a load keeps, as DFU's DeserializeItems fills the same collection
  s.setTime(10);
  s.rt.useBoatParts(entity.items[0], () => entity.items);
  assert.equal(s.rt.placing, true);
  // F9: OnStartLoad, the save's player (a new list), the mod loop, OnLoad
  s.rt.OnStartLoad();
  restorePlayer(entity, snap, new Map());
  s.rt.restoreSaveData(JSON.parse(JSON.stringify(rec)));
  s.rt.OnLoad();
  assert.deepEqual(entity.items.map((i) => i.UID), [123], 'the loaded pack holds the parts');
  s.setTime(11);
  s.frame({ activate: true });   // the click on the water
  assert.equal(s.rt.AllBoats.length, 1, 'the boat placed');
  assert.deepEqual(entity.items.filter((i) => i.templateIndex === BOAT_PARTS_TEMPLATE), [], 'and its parts spent from the pack the load stood');
  assert.equal(s.out.log.some((l) => l.startsWith('threw')), false);
});

test('AUDIT PRE-MERGE 0928 S2: the host hands the item-use door\'s list to the runtime as the live one - the pack and the wagon by their getters, a container as itself', () => {
  const w = src('scenes/world.js');
  assert.match(w, /const csaLiveList = \(c\) => \(c === playerEntity\.items \? \(\) => playerEntity\.items : c === playerEntity\.wagonItems \? \(\) => playerEntity\.wagonItems : c\);/);
  assert.match(w, /csaCall\(\(\) => \{ used = csaRuntime\[use\]\(item, csaLiveList\(collection\)\); \}\);/);
});

// ── S3 ──────────────────────────────────────────────────────────────────────

/** A character stood on a deck: StartWaterwalking's bundle, as world.js csaAssignBundle assigns it. */
function onDeck() {
  const entity = character([]);
  assignModBundle(entity, { name: BOAT_EFFECT_BUNDLE, kind: WATER_WALKING_SILENT_KIND, rounds: 90000, bundleType: 'Spell' });
  assert.ok(isEntityWaterWalking(entity));
  return JSON.parse(JSON.stringify(snapshotPlayer(entity, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
}

test('AUDIT PRE-MERGE 0928 S3: a save taken on a boat, loaded with Come Sail Away not loaded - the restore skips its WaterWalkingSilent, as DFU\'s broker cannot instantiate an effect no loaded mod registered', () => {
  MS._resetModSettings();
  try {
    const snap = onDeck();
    MS.setModSetting('come-sail-away', 'Enabled', false);   // the game loads with the mod off
    MS.latchModLoaded?.('come-sail-away', false);          // ...and the world host latches it so at its mount
    const loaded = {};
    restorePlayer(loaded, snap, new Map());
    assert.equal(isEntityWaterWalking(loaded), false, 'no water walk without the mod');
    assert.equal(loaded.activeEffects.some((a) => a.bundleName === BOAT_EFFECT_BUNDLE), false, 'nor its bundle (Iliac Puddle No More\'s swim reads its name)');
    // the mod loaded: the effect comes back, and the runtime's LateUpdate takes it off a player who is off the boat
    MS._resetModSettings();
    MS.latchModLoaded?.('come-sail-away', true);
    const kept = {};
    restorePlayer(kept, snap, new Map());
    assert.equal(isEntityWaterWalking(kept), true);
  } finally { MS._resetModSettings(); }
});

// ── S4 / U7 ─────────────────────────────────────────────────────────────────

const boatRows = () => customItemsForGroup(BOAT_ITEM_GROUP).filter((t) => t === BOAT_PARTS_TEMPLATE || t === BOAT_DEED_TEMPLATE);
const FISH = DEEP_WATERS_FISH_TEMPLATES[0].index;
const fishRows = () => customItemsForGroup(BOAT_ITEM_GROUP).filter((t) => t === FISH);
const keysFor = () => { const store = IA.createBindings(); IA.resetDefaults(store); setBindings(store); };

// PIN MOVED (SHIPYARDS, 2026-10-11): the boat rows stand on no shelf at all now - a port town's shipyard sells every hull
// (systems/shipyards.js) - so S4's latch is pinned by the fish rows below, the one home's other mod rows
test('AUDIT PRE-MERGE 0928 S4 x SHIPYARDS: no shelf stocks a boat row, whatever the switch and however the game loaded it - the shipyard sells the hulls', () => {
  MS._resetModSettings();
  try {
    MS.setModSetting('come-sail-away', 'Enabled', false);
    MS.latchModLoaded?.('come-sail-away', false);   // loaded off
    MS.setModSetting('come-sail-away', 'Enabled', true);   // the pane, mid-game
    assert.deepEqual(boatRows(), [], 'loaded off, switched on');
    MS._resetModSettings();
    MS.latchModLoaded?.('come-sail-away', true);   // loaded on
    MS.setModSetting('come-sail-away', 'Enabled', false);
    assert.deepEqual(boatRows(), [], 'loaded on, switched off');
    MS._resetModSettings();
    assert.deepEqual(boatRows(), [], 'no host latched it: the switch as it stands');
    // AUDIT SHIPYARDS (the mutation rerun: S4-reset-keeps-latch survived the move above) - the latch still goes with the
    // settings a test resets, seen through the mod's one door left, its effect kind
    MS.latchModLoaded?.('come-sail-away', false);
    assert.equal(effectKindLoaded(WATER_WALKING_SILENT_KIND), false, 'latched off');
    MS._resetModSettings();
    assert.equal(effectKindLoaded(WATER_WALKING_SILENT_KIND), true, 'the latch reset with the settings: the switch as it stands (on)');
  } finally { MS._resetModSettings(); }
});

test('AUDIT PRE-MERGE 0928 U7: the mod\'s keys answer as the game loaded it - switched off at the helm, the Disembark and sail keys still answer until the next load; a mod whose host latches nothing reads its switch live', () => {
  MS._resetModSettings();
  try {
    keysFor();
    MS.latchModLoaded?.('come-sail-away', true);
    MS.setModSetting('come-sail-away', 'Enabled', false);
    assert.equal(held(new Set(['Quote']), 'BoatDisembark'), true);
    assert.equal(held(new Set(['End']), 'BoatToggleSail'), true);
    MS._resetModSettings();
    MS.setModSetting('come-sail-away', 'Enabled', true);
    MS.latchModLoaded?.('come-sail-away', false);
    assert.equal(held(new Set(['Quote']), 'BoatDisembark'), false, 'loaded off: its keys are nothing, whatever the pane says now');
    // Travel Options is the other next-load mod with a key (its runtime is made at the world's mount)
    MS._resetModSettings();
    MS.latchModLoaded?.('travel-options', true);
    MS.setModSetting('travel-options', 'Enabled', false);
    assert.equal(held(new Set(['KeyK']), 'FollowPaths'), true);
    // a mod that takes effect at once stays live: Handheld Torches' throw
    MS._resetModSettings();
    MS.setModSetting('handheld-torches', 'Enabled', true);
    assert.equal(held(new Set(['KeyX']), 'TorchThrow'), true);
    MS.setModSetting('handheld-torches', 'Enabled', false);
    assert.equal(held(new Set(['KeyX']), 'TorchThrow'), false);
  } finally { MS._resetModSettings(); }
});

test('AUDIT PRE-MERGE 0928 S4: Iliac Puddle No More\'s fish rows on the same shelf answer its switch as the world loaded it', () => {
  MS._resetModSettings();
  try {
    MS.latchModLoaded?.('iliac-puddle-no-more', false);
    MS.setModSetting('iliac-puddle-no-more', 'Enabled', true);
    assert.deepEqual(fishRows(), [], 'switched on mid-game: no fish until the sea is built');
    MS._resetModSettings();
    MS.setModSetting('iliac-puddle-no-more', 'Enabled', true);
    MS.latchModLoaded?.('iliac-puddle-no-more', true);
    MS.setModSetting('iliac-puddle-no-more', 'Enabled', false);
    assert.deepEqual(fishRows(), [FISH], 'switched off mid-game: the sea still stands, and its fish sell');
  } finally { MS._resetModSettings(); }
});

test('AUDIT PRE-MERGE 0928 S4/U7: the world host latches each next-load mod it builds at its mount - Come Sail Away, Travel Options, Iliac Puddle No More - with the answer it built on', () => {
  const w = src('scenes/world.js');
  assert.match(w, /const _csaOnAtLoad = latchModLoaded\('come-sail-away', \(\(\) => \{ try \{ return modSetting\('come-sail-away', 'Enabled'\) !== false; \} catch \{ return false; \} \}\)\(\)\);/);
  assert.match(w, /const dwRender = deepWatersOn\(\) \? new DeepWatersRenderer\(renderer\) : null;\n\s+latchModLoaded\(DEEP_WATERS_VENDOR, !!dwRender\);/);
  assert.match(w, /const travelOptionsOn = modSetting\(TRAVEL_OPTIONS_VENDOR, 'Enabled'\);\n\s+latchModLoaded\(TRAVEL_OPTIONS_VENDOR, travelOptionsOn\);/);
});

// ── C1 ──────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 C1: a load that lands elsewhere lets go of a crewed boat\'s helm AND takes back the ship it lent - the lent-ship arm of StopSailing (IL_b0e7-IL_b121), which RestoreSaveData never reaches for a helm it does not take', () => {
  const player = { ownedShip: SHIP_TYPES.None };
  const s = scene({ deps: { ship: { owns: () => ownsShip(player), assign: (type) => assignShipToPlayer(player, SHIP_TYPES[type], {}), removePermanentScene: () => {} } } });
  s.rt.StartSailing(s.place(2));   // the Small Ship: crewed - the player, owning none, is lent the small ship
  assert.equal(player.ownedShip, SHIP_TYPES.Small);
  const rec = JSON.parse(JSON.stringify(s.rt.getSaveData()));
  const savedShip = player.ownedShip;
  assert.equal(rec.TemporaryShip, true);
  s.rt.OnStartLoad();
  player.ownedShip = savedShip;   // restorePlayer: the save's character owns the lent ship (save.js ownedShip)
  s.rt.restoreSaveData({ ...rec, currentBoat: -1 });   // world.js csaHelmLeft: landed elsewhere, the helm let go
  s.rt.ReturnTemporaryShip?.();   // the host's arm after the mod loop, for a let-go record whose TemporaryShip is up
  assert.equal(ownsShip(player), false, 'the lent ship taken back');
  assert.deepEqual(sellShip([{ accountGold: 0 }], 0, player, {}), { kind: 'none' }, 'nothing for a bank to buy');
  assert.equal(s.rt.state.TemporaryShip, false);
  const w = src('scenes/world.js');
  assert.match(w, /restoreModSaveRecords\(extras\.modData, csaModLoadFailed\);[^\n]*\n\s+if \(csaElsewhere && csaRuntime && extras\.modData\?\.\[COME_SAIL_AWAY_VENDOR\]\?\.TemporaryShip\) csaCall\(\(\) => csaRuntime\.ReturnTemporaryShip\(\)\);/);
});

// ── H/S: the abyss's way back ───────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 H/S: the abyss\'s way back with a teleport that fails - the rejection is caught and said once, `transitioning` comes down, and the next pit opens', async () => {
  const PIT = { x: 392, y: 338 };
  const ll = mapPixelToLongitudeLatitude(100, 100);
  const template = { loaded: true, hasDungeon: true, name: 'Template Crypt', regionIndex: 0, locationIndex: 0,
    mapTableData: { mapId: 5000, longitude: ll.x, latitude: ll.y, dungeonType: 6 },
    exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } },
    dungeon: { blocks: [0, 1, 2].map((i) => ({ blockName: `B${i}.RDB`, waterLevel: 10000 })) } };
  const corner = mapPixelToWorldCoord(PIT.x, PIT.y);
  const gps = { x: corner.x + 20000, z: corner.y + 12000 };
  const P = { insideDungeon: false };
  let live = null, fail = false;
  const dungeonOf = (location) => {
    let name = location.name, mapId = location.mapTableData.mapId;
    return { location: () => ({ regionIndex: 0, locationIndex: 0 }), summaryName: () => name, summaryId: () => mapId, rename(n, id) { name = n; mapId = id; },
      startMarkerY: () => 10, maxMeshTopY: () => 30, originY: () => 0, setAllBlockWaterLevels() {}, setBlockWaterLevel() {}, foes: () => [],
      destroyFoe() {}, replaceFoe() {}, settle: () => Promise.resolve(), removeQuestResources() {}, removeLightFixtures() {} };
  };
  const abyss = createOceanHolesAbyss({
    settings: () => ({ dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 }),
    maps: { regionCount: 1, locationCount: () => 1, location: () => template },
    siteLinks: () => [], isMainStoryDungeon: () => false,
    gps: { worldX: () => gps.x, worldZ: () => gps.z, currentMapPixel: () => worldCoordToMapPixel(gps.x, gps.z), currentLocation: () => null },
    teleportToWorld: async (x, z) => { if (fail) throw new Error('the world did not build'); gps.x = x; gps.z = z; return true; },
    renameGps: () => {},
    player: { isInside: () => P.insideDungeon, isInsideDungeon: () => P.insideDungeon, isSwimming: () => true, anchor: () => null, teleportedIntoDungeon: () => false,
      isRespawning: () => false, loadInProgress: () => false, placeFeet: () => {}, placeCentreY: () => {}, clearFallingDamage: () => {} },
    modes: { async enterAbyss(clone) { const d = dungeonOf(clone); live = d; await abyss.onDungeonSet(d); P.insideDungeon = true; abyss.onDungeonEntered(d); return true; }, dungeon: () => live },
    pitEntrance: () => null, oceanSurfaceY: () => 34, pitPlacement: () => ({ x: 600, z: 610 }), terrainReady: () => true,
    hud: () => {}, roster: () => enemyRoster(), nowSeconds: () => 0, waitFrame: () => Promise.resolve(),
  });
  assert.equal(await abyss.tryEnterPit(PIT.x, PIT.y), true);
  P.insideDungeon = false; live = null; fail = true;
  const said = [];
  const warn = console.warn;
  console.warn = (...a) => said.push(a.join(' '));
  try {
    await assert.doesNotReject(abyss.onDungeonExited(), 'the host drops this promise (world.js onTransitionDungeonExterior): it must not reject');
  } finally { console.warn = warn; }
  assert.equal(said.length, 1, 'said once');
  assert.equal(abyss.transitioning, false, 'the failed way back leaves no transition standing');
  fail = false;
  assert.equal(await abyss.tryEnterPit(PIT.x, PIT.y), true, 'the next pit opens');
});

// ── H/S: the abyss's way down ───────────────────────────────────────────────
// Lens S, after its fixes: the descent drops its promise too (world.js onEnterPit), and a teleport or a door that threw
// left `entering` up for the session - every load, fast travel and Recall waits on it (worldMoveBusy) - with the
// rejection unheard. DFU's teleport cannot fail; the port's can (departure (8): the port's refusals fail the door).

function descentRig() {
  const PIT = { x: 392, y: 338 };
  const ll = mapPixelToLongitudeLatitude(100, 100);
  const template = { loaded: true, hasDungeon: true, name: 'Template Crypt', regionIndex: 0, locationIndex: 0,
    mapTableData: { mapId: 5000, longitude: ll.x, latitude: ll.y, dungeonType: 6 },
    exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } },
    dungeon: { blocks: [0, 1, 2].map((i) => ({ blockName: `B${i}.RDB`, waterLevel: 10000 })) } };
  const corner = mapPixelToWorldCoord(PIT.x, PIT.y);
  const gps = { x: corner.x + 20000, z: corner.y + 12000 };
  const P = { insideDungeon: false };
  // plan: what each teleport in turn does ('ok' or 'throw'); past its end, 'ok'
  const rig = { PIT, plan: [], doorThrows: false, live: null, teleports: [] };
  const dungeonOf = (location) => {
    let name = location.name, mapId = location.mapTableData.mapId;
    return { location: () => ({ regionIndex: 0, locationIndex: 0 }), summaryName: () => name, summaryId: () => mapId, rename(n, id) { name = n; mapId = id; },
      startMarkerY: () => 10, maxMeshTopY: () => 30, originY: () => 0, setAllBlockWaterLevels() {}, setBlockWaterLevel() {}, foes: () => [],
      destroyFoe() {}, replaceFoe() {}, settle: () => Promise.resolve(), removeQuestResources() {}, removeLightFixtures() {} };
  };
  rig.abyss = createOceanHolesAbyss({
    settings: () => ({ dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 }),
    maps: { regionCount: 1, locationCount: () => 1, location: () => template },
    siteLinks: () => [], isMainStoryDungeon: () => false,
    gps: { worldX: () => gps.x, worldZ: () => gps.z, currentMapPixel: () => worldCoordToMapPixel(gps.x, gps.z), currentLocation: () => null },
    teleportToWorld: async (x, z) => {
      const how = rig.plan[rig.teleports.length] ?? 'ok';
      rig.teleports.push(how);
      if (how === 'throw') throw new Error('the world did not build');
      gps.x = x; gps.z = z; return true;
    },
    renameGps: () => {},
    player: { isInside: () => P.insideDungeon, isInsideDungeon: () => P.insideDungeon, isSwimming: () => true, anchor: () => null, teleportedIntoDungeon: () => false,
      isRespawning: () => false, loadInProgress: () => false, placeFeet: () => {}, placeCentreY: () => {}, clearFallingDamage: () => {} },
    modes: {
      async enterAbyss(clone) {
        if (rig.doorThrows) throw new Error('the build threw');
        const d = dungeonOf(clone); rig.live = d; await rig.abyss.onDungeonSet(d); P.insideDungeon = true; rig.abyss.onDungeonEntered(d); return true;
      },
      dungeon: () => rig.live,
    },
    pitEntrance: () => null, oceanSurfaceY: () => 34, pitPlacement: () => ({ x: 600, z: 610 }), terrainReady: () => true,
    hud: () => {}, roster: () => enemyRoster(), nowSeconds: () => 0, waitFrame: () => Promise.resolve(),
  });
  return rig;
}
/** The descent as the host runs it (world.js onEnterPit drops the promise): it must settle, never reject. */
async function descend(r) {
  const said = [];
  const warn = console.warn;
  console.warn = (...a) => said.push(a.join(' '));
  try {
    let value;
    await assert.doesNotReject((async () => { value = await r.abyss.tryEnterPit(r.PIT.x, r.PIT.y); })(), 'the host drops this promise: it must not reject');
    return { value, said };
  } finally { console.warn = warn; }
}

test('AUDIT PRE-MERGE 0928 H/S: the abyss\'s way down with a teleport, a door or a way back that throws - the descent never rejects, says it once, and leaves no `entering` or transition standing, so the next pit opens', async () => {
  for (const [what, plan, doorThrows, teleports, said] of [
    ['the descent\'s own teleport throws (the swimmer never left)', ['throw'], false, 1, 1],
    ['the door\'s build throws (a door that never opened: back to the pit)', [], true, 2, 1],
    ['the door throws and the way back from it throws too', ['ok', 'throw'], true, 2, 2],
  ]) {
    const r = descentRig();
    r.plan = plan; r.doorThrows = doorThrows;
    const out = await descend(r);
    assert.equal(out.value, false, `${what}: no abyss`);
    assert.equal(r.teleports.length, teleports, `${what}: the teleports it made`);
    assert.equal(out.said.length, said, `${what}: each failure said once`);
    assert.equal(r.abyss.entering, false, `${what}: no descent left standing (worldMoveBusy reads it)`);
    assert.equal(r.abyss.transitioning, false, `${what}: no transition left standing`);
    r.doorThrows = false; r.plan = [];
    r.teleports.length = 0;
    assert.equal(await r.abyss.tryEnterPit(r.PIT.x, r.PIT.y), true, `${what}: the next pit opens`);
  }
});
