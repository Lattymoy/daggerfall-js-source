// IS1 (AUDIT 26 F221): BUILDING INTERIORS SAVE AND LOAD.
//
// DFU's law, read at the source: an inside player's save carries the
// entered exterior door array and the building discovery record
// (SerializablePlayer.cs:183-187), the load re-enters through the
// Respawner's building arm - StartBuildingInterior off
// exteriorDoors[0] (PlayerEnterExit.cs:559-567, :1022-1035) - and the
// saved position then lands RAW (RestorePosition's interior arm,
// transform.position = saved). A save whose door cannot be found
// takes the reposition arm (:615-621, "Building has no exterior
// doors. Repositioning player."). And the ONLY standing save block in
// all of DFU is mid-rappel (RappelMotor.cs:66, the sole
// RegisterPreventSaveCondition caller) - a building never prevented
// saving; the port's interior `savingPrevented: () => true` was a
// stopgap for the unbuilt serialization, not a law.
//
// The envelope half is behavioral below; the host wiring is
// SOURCE-pinned (headless cannot boot a canvas), the SAV3 shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snapshotPlayer, restorePlayer, SAVE_VERSION } from '../src/systems/save.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const mkEntity = () => ({
  name: 'Mac', gender: 'female', careerIndex: 4, level: 3, reflexes: 2,
  health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
  startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120,
  readyToLevelUp: false, pendingLevel: null, chargenDone: true,
  stats: { strength: 55, luck: 60 },
  skills: [30, 28], skillUses: [100, 0],
  career: { name: 'Healer', hitPointsPerLevel: 8 },
  items: [], spells: [], activeEffects: [],
});

// The bag the world host composes: the door identity trio +
// buildingKey, and the discovery record with its insideOpenShop latch
// (F066's field) riding on it.
const INTERIOR = {
  door: { blockIndex: 341, recordIndex: 2, doorIndex: 1, buildingKey: 217134 },
  building: {
    buildingKey: 217134, buildingType: 9, factionId: 510, quality: 12,
    regionIndex: 17, name: 'The Odd Blades', insideOpenShop: true,
  },
};

test('IS1: the interior bag rides the envelope verbatim (opaque, like world), and a pre-IS1 save restores null', () => {
  const snap = snapshotPlayer(mkEntity(), { interior: INTERIOR });
  assert.equal(snap.v, SAVE_VERSION, 'an additive field never bumps the version (the save charter)');
  const extras = restorePlayer({}, snap);
  assert.deepEqual(extras.interior, INTERIOR, 'the bag comes back whole - identity, latch and all');
  // A save written before IS1 has no key at all: JSON round-trip of
  // the OLD literal - delete simulates the absent slot.
  const old = JSON.parse(JSON.stringify(snap));
  delete old.interior;
  assert.equal(restorePlayer({}, old).interior, null, 'absent slot reads as null, never undefined leaking');
  // ...and a host that passes nothing saves null, not a hole.
  assert.equal(snapshotPlayer(mkEntity(), {}).interior, null);
});

test('IS1: the world host resolves the interior half BEFORE the snapshot reads the cache', () => {
  const src = read('src/scenes/world.js');
  const body = src.slice(src.indexOf('function worldQuickSave'), src.indexOf('let _loading'));
  const atInterior = body.indexOf("const interior = modes?.interiorSaveData?.() ?? null;");
  const atSnap = body.indexOf('snapshotPlayer(playerEntity, {');
  assert.ok(atInterior > -1, 'the composer asks the mode host');
  assert.ok(atSnap > atInterior,
    'interiorSaveData writes the live scene into the P1 cache, so it must run before snapshotPlayer reads entity.sceneCache');
  assert.match(body, /\n      interior,\n/, 'the bag rides the envelope');
});

test('IS1: interiorSaveData - interior mode only, the live scene cached first, the door identity whole', () => {
  const src = read('src/scenes/worldModes.js');
  const body = src.slice(src.indexOf('interiorSaveData()'), src.indexOf('async restoreInterior'));
  assert.match(body, /if \(mode !== 'interior' \|\| !exteriorDoor\) return null;/,
    'null anywhere but interior mode - the exterior and dungeon arms have their own composers');
  assert.ok(body.indexOf('cacheInteriorScene();') > -1 && body.indexOf('cacheInteriorScene();') < body.indexOf('return {'),
    'the live shelves land in the entity cache BEFORE the bag returns - the envelope must carry them');
  for (const f of ['blockIndex: exteriorDoor.blockIndex', 'recordIndex: exteriorDoor.recordIndex', 'doorIndex: exteriorDoor.doorIndex', 'buildingKey: interiorBuilding?.buildingKey ?? 0']) {
    assert.ok(body.includes(f), `the door identity carries ${f.split(':')[0]}`);
  }
  assert.match(body, /building: interiorBuilding \? \{ \.\.\.interiorBuilding \} : null,/,
    'the discovery record rides as a plain copy (SerializablePlayer :185-186)');
});

test('IS1: ONE transition core - the click and the restore share TransitionInterior', () => {
  const src = read('src/scenes/worldModes.js');
  assert.match(src, /return enterInteriorCore\(hit, entries\);\n  \}/,
    'tryEnter ends in the shared core, exactly as PlayerActivate routes through TransitionInterior');
  assert.match(src, /async function enterInteriorCore\(hit, entries, restore = null\)/);
  // The restore takes the SAVED record whole - identity AND latch
  // (SerializablePlayer.cs:394-400 restores BuildingDiscoveryData +
  // IsPlayerInsideOpenShop rather than recomputing at the load hour).
  const body = src.slice(src.indexOf('async function enterInteriorCore'), src.indexOf('function rayAabbProbe'));
  assert.match(body, /interiorBuilding = restore\.building \?\? null;\n        insideOpenShop = !!interiorBuilding\?\.insideOpenShop;/,
    'a shop saved open loads open, whatever hour the load happens at');
  assert.match(body, /const spot = restore\?\.pos \?\? floored;/,
    "RestorePosition's interior arm: the saved position lands raw over the door landing");
  assert.match(body, /if \(!landing\) \{ ctx\.destroy\(\); throw new Error\('no interior landing'\); \}/,
    'the doorless-interior guard still runs on a restore - it must refuse exactly as it refuses a click (and NT1 frees the build it abandons)');
});

test('IS1: the exterior door latches at entry and leaves at every exit', () => {
  const src = read('src/scenes/worldModes.js');
  assert.match(src, /exitReturn = \{ siblings \};\n      exteriorDoor = hit\.door;/,
    'SetExteriorDoors (PlayerEnterExit.cs:469) - the save needs the way back in');
  assert.ok((src.match(/exteriorDoor = null;/g) || []).length >= 2,
    'cleared at the real door (tryExit) AND the forced exit - a stale door would save a building the player left');
});

test('IS1: restoreInterior - the identity trio, buildingKey disambiguation, the core with the saved bag', () => {
  const src = read('src/scenes/worldModes.js');
  const at = src.indexOf('async restoreInterior');
  const body = src.slice(at, src.indexOf('tryEnter,', at));
  assert.match(body, /if \(!d \|\| mode !== 'exterior'\) return false;/,
    'the re-entry runs from the exterior the load just rebuilt, nowhere else');
  for (const f of ['e.door.blockIndex === d.blockIndex', 'e.door.recordIndex === d.recordIndex', 'e.door.doorIndex === d.doorIndex']) {
    assert.ok(body.includes(f), `the match carries ${f}`);
  }
  assert.match(body, /matches\.length > 1 && d\.buildingKey/,
    'twin blocks in one location disambiguate by buildingKey - DFU keys discovery on it (:1032)');
  assert.match(body, /\{ building: saved\.building \?\? null, pos \}/,
    'the core gets the SAVED discovery record, not a recompute');
  assert.match(body, /return mode === 'interior';/,
    'success is the MODE having changed, not the call having returned');
});

test('IS1: the load path never caches the dying scene', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /forceExitToExterior\(\{ cacheScene = true \} = \{\}\)/,
    'quest teleports keep the Teleport.cs:145-148 caching default');
  assert.match(modes, /if \(cacheScene\) cacheInteriorScene\(\);/,
    'the load alone opts out - by then the entity cache is the SAVE’s own');
  const world = read('src/scenes/world.js');
  const body = world.slice(world.indexOf('async function worldQuickLoad'), world.indexOf('function applyPose'));
  const atExit = body.indexOf('modes?.forceExitToExterior({ cacheScene: false })');
  const atTeleport = body.indexOf('await _teleportToPixel');
  assert.ok(atExit > -1 && atTeleport > atExit,
    'RespawnPlayer destroys the standing interior FIRST (:453-459), and without serializing it (:464)');
});

test("IS1: the load re-enters the building or takes DFU's reposition arm", () => {
  const world = read('src/scenes/world.js');
  const body = world.slice(world.indexOf('async function worldQuickLoad'), world.indexOf('function applyPose'));
  assert.match(body, /modes\?\.restoreInterior\?\.\(extras\.interior, \[lx, ly, lz\]\)/,
    'the saved position rides into the core - RestorePosition lands it raw');
  assert.ok(body.includes("townTalk.say('Building has no exterior doors. Repositioning player.');"),
    "DFU's own line, verbatim (RestorePositionHelper :619)");
  assert.match(body, /\} else \{\n          if \(walkMode\) \{ player\.spawn\(lx, ly, lz\); playerSpawned = true; \}/,
    'the plain exterior landing survives as the else arm');
});

test('IS1: the interior pause and F9/F11 land on the world composer; the stopgap gate is GONE', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.ok(!modes.includes('savingPrevented'),
    'RETIRING A FLAG DELETES THE SENTENCE: no interior cannot-save arm survives anywhere in the mode host');
  // PX26 gave togglePause its own options; the slice follows it. The
  // law here is unchanged - the interior pause hands the world's
  // composer through.
  const pause = modes.slice(modes.indexOf('    togglePause(opts = {}) {'), modes.indexOf('    toggleCharSheet()'));
  for (const door of ['quickSave: host.quickSave', 'quickLoad: host.quickLoad', 'playerName: host.playerName', 'saveAs: host.saveAs', 'loadKey: host.loadKey']) {
    assert.ok(pause.includes(door), `the pause hands ${door.split(':')[0]} through`);
  }
  assert.match(modes, /quickSave\(\) \{ host\.quickSave\?\.\(\); \},\n    quickLoad\(\) \{ host\.quickLoad\?\.\(\); \},/,
    'the routeKey ctx answers the quick keys (GameManager.cs:570-586 is scene-free)');
  // THE FOUR HOSTS: world.js hands its ONE composer into the host bag;
  // dungeonContext.js keeps its own; exterior.js stays the probe host
  // and still says the cannot-save line - ITS recorded posture, not
  // the interior's.
  const world = read('src/scenes/world.js');
  for (const door of ['quickSave: () => worldQuickSave()', 'quickLoad: () => worldQuickLoad()', 'playerName: () => playerEntity.name', 'saveAs: (saveName) => worldQuickSave(saveName)', 'loadKey: (key) => worldQuickLoad({ key })']) {
    assert.ok(world.includes(door), `the host bag carries ${door.split(':')[0]}`);
  }
  assert.match(read('src/scenes/exterior.js'), /savingPrevented: \(\) => true,/,
    'the block-viewer probe host keeps its refusal - it has no composer to hand');
});
