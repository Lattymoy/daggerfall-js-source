// HCC (2026-09-23): THE HOSTS' WIRING - what world.js, exterior.js, worldModes.js, mountRig.js, the inventory
// session, the foe pool and the collider hand Horse Cart and Cargo, pinned by execution where the seam is a
// function (the inventory's open state and wagon toggle, the activation race, the collider's filtered sphere
// cast, the pool's threat qualification) and by reading the host source where the seam is a call in a frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openState, planWagonToggle } from '../src/systems/inventorySession.js';
import { raceActivation, raceWinner } from '../src/player/activationRace.js';
import { Collider } from '../src/player/collider.js';
import { STORAGE_CONTEXT, HCC_TEXT } from '../src/systems/horseCartLaw.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { createMountRig } from '../src/player/mountRig.js';
import { boxTriangles, WAGON_BUCKET } from '../src/scenes/horseCartPool.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const cart = { group: 'Transportation', templateIndex: 93 };   // Transportation.Small_cart (systems/shopStock.js TRANSPORT_SMALL_CART, which transport.js hasCart reads)

/** A stand-in runtime answering the inventory's two questions and the transport window's two rows. */
const fakeRt = ({ allowed = true, exitAllowed = true, select = false, horse = true, cartRow = true } = {}) => {
  const rt = {
    asked: [], used: [],
    canAccessWagonStorage: (ctx) => { rt.asked.push(ctx); const ok = ctx === STORAGE_CONTEXT.DungeonExitSelection ? exitAllowed : allowed; return ok ? { allowed: true, denialMessage: '' } : { allowed: false, denialMessage: ctx === STORAGE_CONTEXT.DungeonExitSelection ? HCC_TEXT.tooFarFromEntrance : HCC_TEXT.notAccessibleFromHere }; },
    consumeWagonSelectionRequest: () => { const r = select; select = false; return r; },
    canMountHorseFromTransportWindow: () => horse, canUseCartFromTransportWindow: () => cartRow,
    tryUseTransport: (m) => { rt.used.push(m); return { handled: true, succeeded: true }; },
  };
  return rt;
};

test('HCC hosts: the inventory opens on the runtime\'s word - a plain open shows no wagon, a selection request shows it in Remove, a refused one does not', () => {
  const rt = fakeRt({ select: true });
  let o = openState({ horseCart: () => rt, items: () => [cart] });
  assert.equal(o.usingWagon, true); assert.equal(o.mode, 'remove'); assert.equal(o.allowDungeonWagonAccess, false, 'DFU\'s own dungeon-wagon path is closed with the mod on');
  assert.deepEqual(rt.asked, [STORAGE_CONTEXT.NormalInventory]);
  o = openState({ horseCart: () => rt, items: () => [cart] });
  assert.equal(o.usingWagon, false, 'the request was consumed by the first open');
  const refused = fakeRt({ allowed: false, select: true });
  o = openState({ horseCart: () => refused, items: () => [cart] });
  assert.equal(o.usingWagon, false); assert.equal(o.refusal, undefined, 'a plain open refused says nothing - the button will');
  o = openState({ horseCart: () => fakeRt({ select: true }), items: () => [cart], loot: { items: () => [] } });
  assert.equal(o.usingWagon, false, 'a loot target outranks the selection');
  // without the mod: DFU's own law stands (the dungeon proximity arm)
  o = openState({ items: () => [cart], dungeon: { inside: true, nearExit: () => true } });
  assert.equal(o.usingWagon, true); assert.equal(o.allowDungeonWagonAccess, true);
});

test('HCC hosts: the dungeon-exit prompt\'s Yes asks CanAccessWagonFromDungeonExit - allowed shows the wagon and marks the grant, refused opens the pack with the reason over it', () => {
  let o = openState({ horseCart: () => fakeRt({ exitAllowed: true }), items: () => [cart], dungeon: { inside: true, wagonPrompt: true } });
  assert.equal(o.usingWagon, true); assert.equal(o.mode, 'remove'); assert.equal(o.dungeonExitAccessGranted, true); assert.equal(o.refusal, undefined);
  o = openState({ horseCart: () => fakeRt({ exitAllowed: false }), items: () => [cart], dungeon: { inside: true, wagonPrompt: true } });
  assert.equal(o.usingWagon, false); assert.equal(o.refusal.text, HCC_TEXT.tooFarFromEntrance); assert.equal(o.refusal.reason, 'horseCart');
  o = openState({ items: () => [cart], dungeon: { inside: true, wagonPrompt: true } });
  assert.equal(o.usingWagon, true, 'without the mod the prompt\'s Yes simply shows the wagon');
});

test('HCC hosts: the wagon button - showing hides; hidden asks the runtime (the exit\'s door while the grant holds) and a refusal is its own message', () => {
  const rt = fakeRt();
  assert.deepEqual(planWagonToggle({ horseCart: () => rt, items: () => [cart] }, { usingWagon: true }), { ok: true, usingWagon: false });
  assert.equal(rt.asked.length, 0, 'hiding asks nothing');
  assert.deepEqual(planWagonToggle({ horseCart: () => rt, items: () => [cart] }, { usingWagon: false }), { ok: true, usingWagon: true });
  assert.deepEqual(rt.asked, [STORAGE_CONTEXT.NormalInventory]);
  planWagonToggle({ horseCart: () => rt, items: () => [cart], dungeon: { inside: true } }, { usingWagon: false, dungeonExitAccessGranted: true });
  assert.equal(rt.asked.at(-1), STORAGE_CONTEXT.DungeonExitSelection, 'the exit\'s grant asks the exit\'s door');
  planWagonToggle({ horseCart: () => rt, items: () => [cart], dungeon: { inside: false } }, { usingWagon: false, dungeonExitAccessGranted: true });
  assert.equal(rt.asked.at(-1), STORAGE_CONTEXT.NormalInventory, 'outside a dungeon the grant means nothing');
  const r = planWagonToggle({ horseCart: () => fakeRt({ allowed: false }), items: () => [cart] }, { usingWagon: false });
  assert.equal(r.ok, false); assert.equal(r.refusal.text, HCC_TEXT.notAccessibleFromHere);
  const r2 = planWagonToggle({ horseCart: () => fakeRt(), items: () => [] }, { usingWagon: false });
  assert.equal(r2.ok, true, 'with the mod on the runtime decides even without the cart in the pack (its own CanAccessWagonInventory reads HasCart)');
  assert.equal(planWagonToggle({ items: () => [] }, { usingWagon: false }).refusal.reason, 'noWagon', 'without the mod DFU\'s ladder');
});

test('HCC hosts: the activation race - the mod\'s activator stands with the custom activations, after the cart and before the torch, and feeds the rival', () => {
  const pick = (key, distance) => ({ key, distance, reach: 3.2 });
  let r = raceActivation({ horseCart: pick('hccHorse', 2), torch: pick('t', 2), corpse: pick('c', 2.5), doorDistance: 3 });
  assert.equal(r.horseCartWins, true); assert.equal(r.torchWins, false); assert.equal(r.nonPersonRival, 2);
  r = raceActivation({ horseCart: pick('hccHorse', 2), wagon: pick('eotbWagon', 2) });
  assert.equal(r.wagonWins, true); assert.equal(r.horseCartWins, false, 'a tie with Eye Of The Beholder\'s cart goes to the cart, the earlier arm');
  r = raceActivation({ horseCart: pick('hccWagon', 2), torch: pick('t', 1) });
  assert.equal(r.horseCartWins, false); assert.equal(r.torchWins, true, 'nearer wins');
  assert.equal(raceWinner({ horseCart: pick('hccWagon', 2), ground: { key: '__ground__', distance: 2 } }).key, 'hccWagon', 'the plaque reads the same tie');
  assert.equal(raceWinner({ horseCart: pick('hccWagon', 2), peer: pick('peer:1', 1) }).key, 'peer:1');
  assert.equal(raceActivation({}).horseCartWins, false);
});

test('HCC hosts: the collider\'s sphere cast takes the ray\'s bucket filter - the parked wagon\'s box stops a sweep unless skipped', () => {
  const col = new Collider(() => -Infinity);
  const box = boxTriangles([2, 0, -1], [3, 2, 1]);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  col.addMesh(WAGON_BUCKET, box.positions, box.indices, I);
  const hit = col.sphereCast([0, 1, 0], 0.35, [1, 0, 0], 5);
  assert.ok(Number.isFinite(hit.dist) && hit.dist < 2 && hit.key === WAGON_BUCKET, `the box stops the sweep: ${JSON.stringify(hit)}`);
  const skipped = col.sphereCast([0, 1, 0], 0.35, [1, 0, 0], 5, { skip: [WAGON_BUCKET] });
  assert.equal(skipped.dist, Infinity, 'skipped, the sweep is clear');
  assert.equal(col.capsuleCast([0, 1, 0], [0, 1.5, 0], 0.3, [1, 0, 0], 5, 3, { skip: [WAGON_BUCKET] }).dist, Infinity);
  col.removeBucket(WAGON_BUCKET);
  assert.equal(col.sphereCast([0, 1, 0], 0.35, [1, 0, 0], 5).dist, Infinity);
});

test('HCC hosts: the transport window - with the mod on the horse and cart rows are the runtime\'s answers and a row goes through TryUseTransport', () => {
  const src = rd('src/player/mountRig.js');
  assert.match(src, /horseCart = null,/);
  assert.match(src, /hasHorse: rt \? !!rt\.canMountHorseFromTransportWindow\(\) : hasHorse\(playerEntity\.items \?\? \[\]\)/);
  assert.match(src, /hasCart: rt \? !!rt\.canUseCartFromTransportWindow\(\) : hasCart\(playerEntity\.items \?\? \[\]\)/);
  assert.match(src, /if \(rt && \(mode === TRANSPORT_MODES\.Horse \|\| mode === TRANSPORT_MODES\.Cart\)\) \{ rt\.tryUseTransport\(mode\); return; \}/);
  assert.match(src, /if \(mode === TRANSPORT_MODES\.Ship\) \{ onShip\?\.\(\); return; \}\n\s+if \(rt/, 'the ship row is still the host\'s, before the runtime');
  // the rig is built with the hook and reads it at open (a null hook is DFU's window)
  const rig = createMountRig({ renderer: null, canvas: null, fetchBytes: null, palette: null, audio: null, player: { transportMode: TRANSPORT_MODES.Foot, grounded: false, setTransportMode() {} }, playerEntity: { items: [] }, showOverlay: () => {}, horseCart: () => null });
  assert.equal(typeof rig.open, 'function');
  rig.open();   // not grounded: nothing opens, nothing throws
});

test('HCC hosts: world.js - the frame, the draw, the origin, the ray, the plaque, the save, the transitions, the fast travel and the cell stream', () => {
  const w = rd('src/scenes/world.js');
  for (const re of [
    /const hcc = createHorseCartPool\(\{/, /const hccRuntime = createHorseCartRuntime\(\{/, /hcc\.attach\(hccRuntime\)/,
    /ready: \(\) => walkMode && playerSpawned && !_teleporting && !_traveling/,
    /isOnShip: \(\) => isOnShip\(playerEntity, playerEntity\.boardShipPosition \?\? null, playerTravelPixel\(\)\)/,
    /ratio: \(\) => SCENE_MAP_RATIO/, /dungeonId: \(\) => modes\?\.roomIdentity\?\.\(\)\?\.mapId \?\? null/,
    /wagonWeight: \(\) => totalWeight\(playerEntity\.wagonItems \?\? \[\]\), wagonKgLimit: \(\) => WAGON_KG_LIMIT/,
    /travelOptionsActive: \(\) => \(travelOptions \? !!travelOptions\.isTravelActive : null\)/,
    /new InputMessageBoxWindow\(\{ lines: \[\], label, value, maxCharacters/,
    /isQualifyingThreatState\(true, !!f\.ai\.isHostile, f\.entity\?\.team === 'PlayerAlly', isLocalPlayerTarget\(f\.ai\.target\), !!f\.ai\.detected\)/,
    // AUDIT HCC H1: LateUpdate ONCE a frame, in every mode - the modal branch, and the exterior frame before the world pass
    /hcc\.setEnabled\(hccOn\(\)\); if \(hcc\.enabled\) hccPollSettings\(nowMs\); hcc\.frame\(dt, cam\.pos, gamePaused\(\) \? 0 : dt \* (?:worldTimeScale|hccTimeScale)\(\)\);/,   // AUDIT HCC (branch audit): the runtime's Time.deltaTime - held by the pause, scaled with the world
    /hccTick\(dt, now\);[^\n]*\n\s+townTalk\.frame\(dt\);\n\s+capturePendingScreenshot\(canvas\);/,
    /hccTick\(dt, now\);[^\n]*\n\s+renderer\.setClearColor\(SKY_CLEAR\);/,
    /if \(hcc\.enabled && _mode\(\) === 'exterior'\) livePersonBatches\.push\(\.\.\.hcc\.batches\(\)\);/,
    // AUDIT HCC K2/K3: GetKeyDown is the frame's edge ring, behind HandleConfiguredHotkeys' IsPlayingGame / LoadInProgress gate
    /const hccKeyDown = \(name\) => \{ const c = domCodeForKeyCode\(name\); return !!c && !gamePaused\(\) && !pointerSurfaces\.size && !_loading && pressedCode\(latch\.edge, c\); \};/,
    // AUDIT HCC U6: the mod's HUD label, where the plaque is not already naming the horse
    /horseNameTooltip\.set\(tipOn \? hcc\.tooltipText\(cam\.pos, /,
    /camps\.draw\(renderer\);[^\n]*\n\s+hcc\.draw\(renderer\);/, /camps\.offsetAll\(r\.offset\);[^\n]*\n\s+hcc\.offsetAll\(r\.offset\);/,
    /const _hccPick = pickActivatableHit\(cam\.pos, useFwd, hcc\.targets\(\), collider\);/, /horseCart: _hccPick,/,
    /else if \(_race\.horseCartWins\) \{ hcc\.activate\(_hccPick\.key, _hccPick\.distance, \(l\) => townTalk\.say\(l\), \(\) => setMidScreenText\(TOO_FAR_AWAY_TEXT\)\); \}/,
    /\(key\) => hcc\.hoverName\(key\),/, /horseCart: pickActivatableHit\(cam\.pos, _hd, hcc\.targets\(\), collider\),/,
    // AUDIT HCC H3: DFU's per-mod slot on every save; OnStartLoad before any await, RestoreSaveData once the place stands
    /modData: \{ \[HCC_VENDOR\]: hccRuntime\.getSaveData\(\) \},/,
    /autoBuildArms\(playerEntity\);[^\n]*\n\s+hccRuntime\.handleStartLoad\(\);/,
    /const hccRecord = extras\.modData\?\.\[HCC_VENDOR\] \?\? null;\n\s+if \(hccRecord\) hccRuntime\.restoreSaveData\(hccRecord\);/,
    /horseCartSave: \(\) => hccRuntime\.getSaveData\(\),/, /horseCartLoad: \(rec\) => \{ hccRuntime\.handleStartLoad\(\); if \(rec\) hccRuntime\.restoreSaveData\(rec\); \},/,
    /if \(!_loadedGame\) hccRuntime\.handleNewGame\(\);/, /horseCart: hccRuntimeOn,\s+\/\/ HCC: the runtime's transition handlers/,
    // AUDIT HCC H2: the travel map's journey (the mod's one subscription), and the online respawn treated as one
    /if \(_traveling\) return;\n(?:\s*\/\/[^\n]*\n)*\s+hccRuntimeOn\(\)\?\.handlePreFastTravel\(\);\n\s+let hccPostDue = true;[^\n]*\n\s+_traveling = true;/,
    /travelStart, modEvent: 'travel' \}\);\n\s+hccPostDue = false; hccRuntimeOn\(\)\?\.handlePostFastTravel\(\);/, /if \(hccPostDue\) hccRuntimeOn\(\)\?\.handlePostFastTravel\(\);[^\n]*\n\s+_traveling = false;/,
    /hccRuntimeOn\(\)\?\.handlePreFastTravel\(\);\n\s+try \{ await _teleportToPixel\(land\.x, land\.y, null, \{ reposition: REPOSITION\.RandomStartMarker \}\); \}\n\s+finally \{ hccRuntimeOn\(\)\?\.handlePostFastTravel\(\); \}/,
    /exteriorFoes\.foesFrame\(full, _hccDirty\)/, /if \(cell && full\) frame\.c = camps\.wireRecords\(campToWire\); if \(cell && \(full \|\| _hccDirty\)\) \{ frame\.hv = hcc\.wireRecord\(campToWire\); _hccDirty = false; \}/,
    /if \(isCellRoom\(online\.room\)\) \{ const ids = ownerIds\(\); if \(ids\) camps\.sweepOwners\(ids, now, FOES_STALE_MS\); \}[^\n]*\n\s*if \(isCellRoom\(online\.room\)\) \{ const ids = ownerIds\(\); if \(ids\) hcc\.sweepOwners\(ids, now, FOES_STALE_MS\); \}/,
    /exteriorFoes\.setOnHcc\(\(from, hv, at\) => hcc\.applyOwner\(from, hv, campToScene, at\), \(\) => hcc\.clearPeers\(\)\);/,
    /horseCart: \(\) => hccRuntimeOn\(\),\s+\/\/ HCC: TrailingWagonTransportWindow/, /horseCart: hccRuntimeOn,\s+\/\/ HCC: the wagon's storage access is the runtime's word/,
  ]) assert.match(w, re, `world.js lost ${re}`);
  assert.equal((w.match(/hcc\.clearPeers\(\)/g) ?? []).length, 1, 'the peers\' teams clear wherever the pool\'s puppets do - the pool\'s own clearPuppets hook, so the pinned room-change and leave lines stand as they were');
  assert.match(w, /if \(!seam\) exteriorFoes\.clearPuppets\(\);/); assert.match(w, /online\.leave\(\); exteriorFoes\.clearPuppets\(\); _foesRoom = null;/);
});

test('HCC hosts: exterior.js mirrors the same seams over the fixed city (no stream, no save, no ship, no fast travel)', () => {
  const e = rd('src/scenes/exterior.js');
  for (const re of [
    /const hcc = createHorseCartPool\(\{/, /const hccRuntime = createHorseCartRuntime\(\{/, /hcc\.attach\(hccRuntime\)/,
    /gps: \{ worldX: \(\) => _anchorNative\(player\.pos\)\.x, worldZ: \(\) => _anchorNative\(player\.pos\)\.z/,
    /streaming: \{ isReady: \(\) => true, isInit: \(\) => false, mapPixelX: \(\) => _locPixel\.x, mapPixelY: \(\) => _locPixel\.y, ratio: \(\) => 1 \/ GLOBAL_SCALE \}/,
    /isOnShip: \(\) => false/,
    /hcc\.setEnabled\(hccOn\(\)\); if \(hcc\.enabled\) hccPollSettings\(nowMs\); hcc\.frame\(dt, cam\.pos, gamePaused\(\) \? 0 : dt \* (?:worldTimeScale|hccTimeScale)\(\)\);/,   // AUDIT HCC (branch audit): the runtime's Time.deltaTime - held by the pause, scaled with the world
    /hccTick\(dt, now\);[^\n]*\n\s+townTalk\.frame\(dt\);/, /hccTick\(dt, now\);[^\n]*\n\s+renderer\.setClearColor\(SKY_CLEAR\);/,
    /if \(hcc\.enabled\) personBatches\.push\(\.\.\.hcc\.batches\(\)\);/,
    /const hccKeyDown = \(name\) => \{ const c = domCodeForKeyCode\(name\); return !!c && !gamePaused\(\) && pressedCode\(latch\.edge, c\); \};/,
    /camps\.draw\(renderer, texRemap\);[^\n]*\n\s+hcc\.draw\(renderer, texRemap\);/,
    /const _hccPick = pickActivatableHit\(cam\.pos, useFwd, hcc\.targets\(\), collider\);/, /horseCart: _hccPick,/,
    /else if \(_race\.horseCartWins\) \{ hcc\.activate\(_hccPick\.key, _hccPick\.distance, \(l\) => townTalk\.say\(l\), \(\) => setMidScreenText\(TOO_FAR_AWAY_TEXT\)\); \}/,
    /\(key\) => hcc\.hoverName\(key\),/, /horseCart: pickActivatableHit\(cam\.pos, _hd, hcc\.targets\(\), collider\),/,
    /horseCart: hccRuntimeOn,/, /horseCart: \(\) => hccRuntimeOn\(\),/,
  ]) assert.match(e, re, `exterior.js lost ${re}`);
  assert.doesNotMatch(e, /wireRecord|applyOwner|sweepOwners/, 'no room, no wire on this host');
  assert.doesNotMatch(e, /travelOptions/, 'and no Travel Options seam (ENH-NOTICE3 A: the journey is world.js\'s alone) - the runtime reads the absent seam as "no such mod"');
});

test('HCC hosts: worldModes fires the mod\'s transition handlers - pre before the dismount, success after the mode change, failure on the way out, exterior on every way back', () => {
  const m = rd('src/scenes/worldModes.js');
  const pre = [...m.matchAll(/host\.horseCart\?\.\(\)\?\.handlePreTransition\(\{ type: '(ToBuildingInterior|ToDungeonInterior)', door: hccDoorOf\(hit\) \}\);/g)].map((x) => x[1]);
  assert.deepEqual(pre, ['ToBuildingInterior', 'ToDungeonInterior']);
  assert.match(m, /const hccDoorOf = \(h\) => \(h && h\.door \? doorWorldPosition\(h\.door\) : null\);/, 'the door through a helper: CRUX1 forbids the dungeon entry reading `hit.door` itself');
  assert.match(m, /handlePreTransition\(\{ type: 'ToBuildingInterior'[^\n]*\n\s+unleveledLootPreTransition\(\);[^\n]*\n\s+dismountPlayer\('ToBuildingInterior'\);/, 'before the dismount, so the entry mode is read off the mode the player rode');
  assert.match(m, /handlePreTransition\(\{ type: 'ToDungeonInterior'[^\n]*\n\s+dismountPlayer\('ToDungeonInterior'\);/);
  assert.match(m, /_hccLanded = true; host\.horseCart\?\.\(\)\?\.handleSuccessfulInteriorTransition\(\{ type: 'ToBuildingInterior', buildingKey: interiorBuilding\?\.buildingKey \?\? 0 \}\);[^\n]*\n\s+setMode\('interior'\);/, 'the building is built and keyed; the mode flip and its pinned tail (the unlock, the camera, the pose) stand as they were');
  assert.match(m, /_hccLanded = true; host\.horseCart\?\.\(\)\?\.handleSuccessfulInteriorTransition\(\{ type: 'ToDungeonInterior', dungeonId: dfLocation\?\.mapTableData\?\.mapId \?\? null \}\);/);
  assert.equal((m.match(/if \(!_hccLanded\) host\.horseCart\?\.\(\)\?\.handleFailedTransition\(\{ type: '(ToBuildingInterior|ToDungeonInterior)' \}\);/g) ?? []).length, 2);
  assert.equal((m.match(/host\.horseCart\?\.\(\)\?\.handleExteriorTransition\(\);/g) ?? []).length, 3, 'the building exit, the dungeon exit, the load or teleport out');
  assert.match(m, /horseCart: \(\) => host\.horseCart\?\.\(\) \?\? null,\s+\/\/ HCC: the wagon's storage access at a dungeon exit/);
  assert.match(rd('src/scenes/dungeonContext.js'), /horseCart: \(\) => opts\.horseCart\?\.\(\) \?\? null,/);
  const inv = rd('src/ui/nativeInventory.js');
  assert.match(inv, /this\.dungeonExitAccessGranted = !!open\.dungeonExitAccessGranted;/);
  assert.match(inv, /if \(open\.refusal\) this\.boxes = \[\{ rows: \[\{ text: open\.refusal\.text, center: true \}\] \}\];/);
});

test('HCC-ONLINE hosts: the foe pool carries the `hv` field past its room test and can be asked for a frame with no foe in it', () => {
  const f = rd('src/scenes/exteriorFoes.js');
  assert.match(f, /function foesFrame\(full = false, force = false\)/);
  assert.match(f, /if \(!out\.length && !full && !force\) return null;/);
  assert.match(f, /if \(data\.hv !== undefined\) _onHcc\?\.\(from, data\.hv, _now\(\)\);/);
  assert.match(f, /if \(data\.hv !== undefined\) _onHcc[^\n]*\n\s+if \(Array\.isArray\(data\.c\)\) _onCamps/, 'past the room test the camps pass, beside them');
  assert.match(f, /function setOnHcc\(fn, onClear = null\)/);
  assert.match(f, /_pupPending\.clear\(\);\n\s+_onHccClear\?\.\(\);/, 'the peers\' teams go with the puppets');
  assert.match(f, /setOnCamps, setOnHcc \};/);
  assert.doesNotMatch(rd('server/src/index.js'), /\bhv\b/, 'the relay reads nothing inside a foes frame - no relay change, no version bump');
});
