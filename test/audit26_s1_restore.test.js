// SAVE WAVE S1 - A DUNGEON SAVE MUST BE RESTORABLE.
//
// PlayerEnterExit.RestorePositionHelper (Game/PlayerEnterExit.cs:592-655)
// is the seam: it respawns the player in the CONTEXT the save was made
// in, and SaveLoadManager.cs runs it at :1476 - strictly BEFORE
// RestoreSaveData(saveData) at :1497 puts the saved world back. The
// port had no such seam. A dungeon quicksave stamped which dungeon and
// where in it and never where in the WORLD that dungeon is, so a boot
// with ?load ran the world half instead: the player stood on the
// exterior start pixel with their character and none of their dungeon,
// and the next F9 overwrote the one slot.
//
// These pins run the SHIPPED seam - its body is lifted out of
// scenes/world.js and executed against stub hosts - so a change to the
// arms, or to their order, fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  snapshotPlayer, restorePlayer, savedInsideDungeon, dungeonLocationKey,
} from '../src/systems/save.js';
import { longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8');

/** The `{ ... }` block containing index `i`, matched rather than
 *  guessed at by character count (worldsave.test.js' helper). */
function braceBlock(text, i) {
  const open = text.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === '{') depth++;
    else if (text[k] === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  return text.slice(open);
}

// ---------------------------------------------------------------
// 1. THE CONTEXT STAMP. PlayerPositionData_v1.insideDungeon
//    (SerializableGameObject.cs:235) is what RestorePositionHelper's
//    first arm branches on (:622). The port answers it off the
//    `locationKey` every envelope has carried since S12 rather than a
//    second boolean beside it - ONE DFU MEMBER, ONE EXPORT.
// ---------------------------------------------------------------
test('S1: the saved context is read off locationKey, and only a dungeon key answers insideDungeon', () => {
  assert.equal(dungeonLocationKey(42), 'dungeon:42');
  assert.equal(savedInsideDungeon({ locationKey: dungeonLocationKey(42) }), true);
  assert.equal(savedInsideDungeon({ locationKey: 'dungeon:probe' }), true);
  assert.equal(savedInsideDungeon({ locationKey: 'world' }), false);
  // a pre-S12 envelope carries no key at all, and must not throw
  assert.equal(savedInsideDungeon({}), false);
  assert.equal(savedInsideDungeon({ locationKey: null }), false);
  assert.equal(savedInsideDungeon(null), false);
  // the ONE builder: the dungeon host must mint its key through it, or
  // the prefix the reader tests for can drift away from the writer's
  const dc = readSrc('src/scenes/dungeonContext.js');
  assert.ok(dc.includes('const _locationKey = dungeonLocationKey('),
    'the dungeon host stamps its context through the shared builder');
});

// ---------------------------------------------------------------
// 2. THE MAP PIXEL. PlayerPositionData_v1.worldPosX/worldPosZ
//    (:233-234) is what the dungeon arm hands to RespawnPlayer, which
//    turns it into a map pixel and teleports the streamer there
//    (PlayerEnterExit.cs:489-497). Without it a dungeon save could not
//    be respawned into at all.
// ---------------------------------------------------------------
test('S1: the dungeon envelope carries the map pixel, off the same map-table read every site uses', () => {
  const dc = readSrc('src/scenes/dungeonContext.js');
  const cw = braceBlock(dc, dc.indexOf('function collectWorld()'));
  assert.ok(cw.includes('longitudeLatitudeToMapPixel(dfLocation.mapTableData.longitude, dfLocation.mapTableData.latitude)'),
    'the dungeon world half stamps worldPosX/worldPosZ as this location\'s map pixel');
  // and it rides `world.pixel` - the SAME member the exterior host
  // writes - so the restore seam reads one place for both hosts
  assert.ok(/\n\s*pixel:/.test(cw), 'stamped as `pixel`, the exterior half\'s own name');
  const w = readSrc('src/scenes/world.js');
  assert.ok(braceBlock(w, w.indexOf('function worldQuickSave()')).includes('pixel: playerTravelPixel()'),
    'the exterior host still writes the same member');
  // the envelope really round-trips it (Privateer\'s Hold\'s own row)
  const pixel = longitudeLatitudeToMapPixel(1234, 5678);
  const snap = snapshotPlayer({ stats: {}, skills: [], items: [] }, {
    position: [3, 1, 4], locationKey: dungeonLocationKey(19), world: { pixel, foes: [], piles: [] },
  });
  const extras = restorePlayer({ stats: {}, skills: [], items: [] }, JSON.parse(JSON.stringify(snap)), null);
  assert.ok(extras, 'the version round-trips');
  assert.equal(savedInsideDungeon(extras), true);
  assert.deepEqual(extras.world.pixel, pixel);
  assert.deepEqual(extras.position, [3, 1, 4]);
});

// ---------------------------------------------------------------
// 3. THE SEAM ITSELF, RUN. The shipped body of
//    world.js:restorePositionHelper against stub hosts.
// ---------------------------------------------------------------
/** Lift `async function restorePositionHelper(snap) { ... }` out of
 *  scenes/world.js and bind its four free names to recorders. Running
 *  the REAL body is the only way this pin can speak for the shipped
 *  arms; a hand-written copy of them would pin the copy. */
function loadSeam({ enteredDungeon = true } = {}) {
  const w = readSrc('src/scenes/world.js');
  const i = w.indexOf('async function restorePositionHelper(snap)');
  assert.ok(i > 0, 'the seam is where it says it is');
  const body = braceBlock(w, i);
  const log = [];
  const modes = {
    forceExitToExterior: () => log.push('forceExitToExterior'),
    startInDungeon: async () => { log.push('startInDungeon'); return enteredDungeon; },
  };
  const teleport = async (x, y) => { log.push(`teleport:${x},${y}`); };
  const fakeConsole = { warn: (m) => log.push(`warn:${m}`), error: () => {} };
  const make = new Function('modes', '_teleportToPixel', 'savedInsideDungeon', 'console',
    `return async function restorePositionHelper(snap) ${body};`);
  return { seam: make(modes, teleport, savedInsideDungeon, fakeConsole), log };
}

const dungeonSnap = { locationKey: dungeonLocationKey(19), world: { pixel: { x: 207, y: 213 } } };
const worldSnap = { locationKey: 'world', world: { pixel: { x: 12, y: 34 } } };

test('S1: the seam takes the DUNGEON arm for a dungeon snapshot - respawn at the saved pixel, in the dungeon', async () => {
  const { seam, log } = loadSeam();
  assert.equal(await seam(dungeonSnap), 'dungeon');
  // RespawnPlayer :453-460 destroys the standing context, Respawner
  // :527-534 teleports and THEN StartDungeonInterior - in that order
  assert.deepEqual(log, ['forceExitToExterior', 'teleport:207,213', 'startInDungeon']);
});

test('S1: the seam takes the EXTERIOR arm for a world snapshot, and leaves any dungeon first', async () => {
  const { seam, log } = loadSeam();
  assert.equal(await seam(worldSnap), 'exterior');
  assert.deepEqual(log, ['forceExitToExterior', 'teleport:12,34']);
  // BOTH DIRECTIONS: the exit happens before anything is applied, so
  // loading a world save while standing underground cannot leave the
  // player below with an exterior envelope laid over them.
  assert.equal(log.indexOf('forceExitToExterior'), 0);
  assert.ok(!log.includes('startInDungeon'), 'a world snapshot never enters a dungeon');
});

test('S1: a dungeon location with no entrance falls to DFU\'s own "all else fails" exterior arm', async () => {
  const { seam, log } = loadSeam({ enteredDungeon: false });
  assert.equal(await seam(dungeonSnap), 'exterior');
  assert.deepEqual(log, ['forceExitToExterior', 'teleport:207,213', 'startInDungeon',
    'warn:[load] no dungeon entrance at the saved map pixel - exterior landing (the C# fallback arm)']);
});

test('S1: the insideBuilding arm is explicit and UNHANDLED - it falls through to "start outside" (S2)', async () => {
  const { seam, log } = loadSeam();
  // PlayerEnterExit.cs:632 needs exteriorDoors and the port saves none,
  // so :645\'s "start outside" is DFU\'s own answer here too.
  assert.equal(await seam({ locationKey: 'world', insideBuilding: true, world: { pixel: { x: 1, y: 2 } } }), 'exterior');
  assert.ok(log.some((l) => l.startsWith('warn:[load] interior saves are unbuilt')), 'it says so rather than pretending');
  assert.ok(!log.includes('startInDungeon'));
});

test('S1: a PRE-S1 snapshot has no map pixel and still loads the world arm - never a strand, never a throw', async () => {
  // exactly the shape a dungeon quicksave wrote before this wave:
  // a dungeon locationKey, a world half with foes/piles/actions and
  // NO pixel anywhere in it.
  const preS1 = { locationKey: dungeonLocationKey(19), position: [1, 2, 3], world: { foes: [], piles: [], actions: [] } };
  const { seam, log } = loadSeam();
  assert.equal(await seam(preS1), 'exterior');
  assert.deepEqual(log, ['forceExitToExterior'], 'nothing to teleport to, so nothing is teleported');
  // and a pre-world-half envelope (no `world` key at all) is the same
  const { seam: s2, log: l2 } = loadSeam();
  assert.equal(await s2({ locationKey: 'world' }), 'exterior');
  assert.deepEqual(l2, ['forceExitToExterior']);
  const { seam: s3, log: l3 } = loadSeam();
  assert.equal(await s3({}), 'exterior');
  assert.deepEqual(l3, ['forceExitToExterior']);
});

// ---------------------------------------------------------------
// 4. THE ORDER. SaveLoadManager.cs:1476 (RestorePositionHelper) comes
//    BEFORE :1497 (RestoreSaveData). This is the bug that has shipped
//    here before: a field restored in the wrong order is silently
//    clobbered, and a WORLD restored before its host is a world laid
//    over the wrong scene.
// ---------------------------------------------------------------
test('S1: worldQuickLoad switches host BEFORE it applies either half (SaveLoadManager :1476 < :1497)', () => {
  const w = readSrc('src/scenes/world.js');
  const lf = braceBlock(w, w.indexOf('async function worldQuickLoad()'));
  const switchAt = lf.indexOf('await restorePositionHelper(snap)');
  assert.ok(switchAt > 0, 'the load runs the one seam');
  for (const after of [
    'modes?.restoreDungeonScene(extras)',          // :1497, the dungeon arm
    'state.localFromWorld(w.nativeX, w.nativeZ)',  // :1497, the exterior position
    'droppedLoot.restoreWorld(',                   // :1497, the exterior scene
    'exteriorFoes.spawnFoe(',
  ]) {
    const at = lf.indexOf(after);
    assert.ok(at > switchAt, `${after} is applied AFTER the host switch, never before`);
  }
  // the teleport moved INTO the seam - the apply half must not carry a
  // second one, or the two would disagree about where the player is
  assert.ok(!lf.slice(switchAt).includes('_teleportToPixel('),
    'the respawn owns the teleport; the apply half only overlays the scene');
  // ...and NOTHING before the switch may touch position or scene
  // state either. This is the half of the order that actually bit:
  // a world laid over the wrong host, or a player moved before the
  // host that owns them exists. The seam is the ONLY door to both.
  const before = lf.slice(0, switchAt);
  for (const early of [
    '_teleportToPixel(', 'player.spawn(', 'cam.pos =', 'localFromWorld(',
    'droppedLoot.restoreWorld(', 'exteriorFoes.', 'restoreDungeonScene',
    'startInDungeon', 'forceExitToExterior',
  ]) {
    assert.ok(!before.includes(early),
      `${early} must not run before the host switch - SaveLoadManager.cs restores position at :1476 and the world at :1497`);
  }
  // and the boot door runs the same one loader (main.js sets ?load)
  assert.ok(w.includes("if (params.has('load')) {") && w.includes('await worldQuickLoad();'),
    'boot with ?load rides the same seam as F11');
});

// ---------------------------------------------------------------
// 5. THE FOUR HOSTS. One seam, both entry points, both directions.
// ---------------------------------------------------------------
test('S1: the dungeon host defers to the ONE seam, and the modal host carries it down and back', () => {
  const dc = readSrc('src/scenes/dungeonContext.js');
  const q = braceBlock(dc, dc.indexOf('quickLoad(setPlayerPos) {'));
  assert.ok(q.includes('if (opts.hostQuickLoad) { opts.hostQuickLoad(); return; }'),
    'F11 underground runs the host seam, not a second host-blind copy of the restore');
  // ...and the scene half is ONE body, called by the seam and by the
  // standalone scene alike (SaveLoadManager :1497)
  assert.ok(dc.includes('applyLoadedScene(extras, setPlayerPos) {'), 'the scene half is its own seam');
  assert.ok(q.includes('this.applyLoadedScene(extras, setPlayerPos)'), 'the standalone load runs that same body');
  const wm = readSrc('src/scenes/worldModes.js');
  assert.ok(/hostQuickLoad = null,/.test(wm), 'the modal host takes the loader from the world host');
  assert.ok(braceBlock(wm, wm.indexOf('async function tryEnterDungeon(')).includes('hostQuickLoad,'),
    'and hands it to every dungeon context it builds');
  assert.ok(braceBlock(wm, wm.indexOf('restoreDungeonScene(extras) {')).includes('dungeonCtx.applyLoadedScene(extras,'),
    'and drains the saved scene back into the context the respawn built');
  const w = readSrc('src/scenes/world.js');
  assert.ok(w.includes('hostQuickLoad: () => { worldQuickLoad()'), 'the world host is the one that supplies it');
  // ASYNC NEVER DROPS: the key ladder that reaches it is synchronous
  assert.ok(/hostQuickLoad: \(\) => \{ worldQuickLoad\(\)\.catch\(/.test(w), 'the delegated promise is caught, not dropped');
  // the standalone ?dungeon scene has no world to respawn into and
  // passes none - its in-place load is the N/A arm, unchanged
  assert.ok(!readSrc('src/scenes/dungeon.js').includes('hostQuickLoad'),
    'the standalone dungeon scene stays on the in-place load');
});
