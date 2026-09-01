// A1: THE DUNGEON AUTOMAP - the reveal law (Automap.cs
// CheckForNewlyDiscoveredMeshes :1149-1275 at the port's collider),
// the two-tier discovery record + the region/name dictionary with its
// LRU prune (:2216-2238), the save halves riding snapshotPlayer, the
// slice plane, the micro-map bitmap law (:1739-1832), and the keyed
// window's stepped controls. Source pins hold the host wiring: entry
// identity at the push sites, the 5 Hz tick in both dungeon hosts,
// the mesh shader's uClipY discard, and the M binding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCAN_INTERVAL_S, RAYCAST_DISTANCE_DOWN, RAYCAST_DISTANCE_VIEW, RAYCAST_DISTANCE_ENTRANCE,
  FLOOR_MARCH_STEP, automapDungeonKey, enterDungeonAutomap, exitDungeonAutomap, getDungeonAutomap,
  snapshotAutomap, restoreAutomap, resetAutomapStore, buildRevealIndex,
  automapRevealTick, automapEntranceTick, slicingPositionY, DEFAULT_SLICING_BIAS_Y,
} from '../src/systems/automap.js';
import {
  AutomapWindow, buildMicroMap, hexColor32, MICRO_SIZE_MIN, MICRO_BLOCK_PX,
  resetAutomapWindowState, signalAutomapReset, automapCameraState,
} from '../src/ui/automapWindow.js';
// ONE HOME, ROAD-C c2/S5: the lens constants live in ui/automapCamera.js
// with the rest of the control law - the window stopped re-exporting them
// when it stopped owning a camera of its own.
import { FIELD_OF_VIEW_2D, CAMERA_HEIGHT_VIEW_FROM_TOP, VIEW_2D, VIEW_3D } from '../src/ui/automapCamera.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

test('A1 constants: the DFU probe set digit for digit', () => {
  assert.equal(SCAN_INTERVAL_S, 1 / 5, 'scanRateGeometryDiscoveryInHertz = 5 (:172)');
  assert.equal(RAYCAST_DISTANCE_DOWN, 3.0);
  assert.equal(RAYCAST_DISTANCE_VIEW, 30.0);
  assert.equal(RAYCAST_DISTANCE_ENTRANCE, 100.0);
  assert.equal(FLOOR_MARCH_STEP, 1.0);
  assert.equal(DEFAULT_SLICING_BIAS_Y, 0.2, 'defaultSlicingBiasY (window :51)');
  assert.equal(slicingPositionY(10, 1.5, 0.25), 11.75, 'playerY + eye height + bias (:1296-1304)');
  assert.equal(FIELD_OF_VIEW_2D, 15.0);
  assert.equal(CAMERA_HEIGHT_VIEW_FROM_TOP, 150.0);
});

test('A1 entry law: fresh entry resets visitedThisRun, a LOAD arm preserves it (InitWhenInInteriorOrDungeon :2492-2493)', () => {
  resetAutomapStore();
  try {
    const key = automapDungeonKey(17, "Privateer's Hold");
    assert.equal(key, "17/Privateer's Hold", 'the RegionName/Name dictionary key, one lookup earlier (:2206)');
    const rec = enterDungeonAutomap(key, 1000);
    rec.revealed.add('0:64'); rec.visitedThisRun.add('0:64');
    assert.equal(rec.lastVisited, 1000);
    // walking back in: revealed persists, this-run resets
    const again = enterDungeonAutomap(key, 2000);
    assert.equal(again, rec);
    assert.equal(again.revealed.has('0:64'), true);
    assert.equal(again.visitedThisRun.size, 0, 'a fresh entry forgets the run');
    assert.equal(again.lastVisited, 2000);
    // the load arm is a BARE fetch - a mid-dungeon quickload is not a
    // re-entry: no run reset, no stamp, no prune (DFU's SetState is a
    // dictionary replacement; stamping belongs to save time, :2155)
    again.visitedThisRun.add('0:64');
    const loaded = enterDungeonAutomap(key, 3000, { fromLoad: true });
    assert.equal(loaded.visitedThisRun.has('0:64'), true);
    assert.equal(loaded.lastVisited, 2000, 'a load never re-stamps the visit clock');
  } finally { resetAutomapStore(); }
});

test('A1 review: a load never evicts save-carried records; the save-time prune is where the cap bites (GetState :378-382)', () => {
  resetAutomapStore(); _resetForTests();
  try {
    // a restored store already AT the default cap of 5
    restoreAutomap(Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`r/${i}`, { revealed: [], visitedThisRun: [], entranceDiscovered: false, lastVisited: i * 100 }])));
    // standing in a SIXTH dungeon, F11: the re-fetch adds a record but
    // prunes nothing - the save's data survives the act of loading
    enterDungeonAutomap('r/6', 999, { fromLoad: true });
    assert.equal([...Array(5)].every((_, i) => getDungeonAutomap(`r/${i + 1}`)), true);
    assert.ok(getDungeonAutomap('r/6'));
    // the NEXT save stamps the live dungeon newest and prunes to the
    // cap - dropping the save's oldest, exactly as DFU's own save does
    const snap = snapshotAutomap(1000);
    assert.equal(getDungeonAutomap('r/1'), null, 'the oldest record prunes at SAVE time');
    assert.ok(snap['r/6']);
    assert.equal(snap['r/6'].lastVisited, 1000, 'the live dungeon is stamped at save time (:2155)');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('A1 review: the live dungeon never evicts and boundary ties survive (the strict-< removal, :2229-2237)', () => {
  resetAutomapStore(); _resetForTests();
  try {
    setValue('Map', 'AutomapNumberOfDungeons', 1);
    // the floored-clock inversion: a restored record carries a
    // FRACTIONAL stamp newer than the floored clock the entry gets
    restoreAutomap({ 'r/C': { revealed: ['x'], visitedThisRun: [], entranceDiscovered: false, lastVisited: 12345.7 } });
    enterDungeonAutomap('r/A', 12345);
    assert.ok(getDungeonAutomap('r/A'), 'the dungeon the player stands in survives its own entry');
    assert.ok(getDungeonAutomap('r/C'), 'the boundary record survives too (ties/overflow, as DFU)');
    // an exact tie at the limit: strict-< removes neither
    resetAutomapStore();
    restoreAutomap({ 'r/X': { revealed: [], visitedThisRun: [], entranceDiscovered: false, lastVisited: 500 } });
    enterDungeonAutomap('r/Y', 500);
    assert.ok(getDungeonAutomap('r/X') && getDungeonAutomap('r/Y'));
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('A1 review: AutomapNumberOfDungeons = 0 forgets at EXIT and at outside-save (the vanilla law, :2133-2137)', () => {
  resetAutomapStore(); _resetForTests();
  try {
    setValue('Map', 'AutomapNumberOfDungeons', 0);
    const rec = enterDungeonAutomap('r/P', 100);
    rec.revealed.add('0:64');
    // inside, saving keeps the map (0 treated as 1 while inside)
    assert.ok(snapshotAutomap(100)['r/P']);
    // stepping OUT forgets it on the spot (OnTransitionToDungeonExterior)
    exitDungeonAutomap();
    assert.equal(getDungeonAutomap('r/P'), null);
    // and a save made outside writes (and keeps) an empty dictionary
    enterDungeonAutomap('r/P', 200).revealed.add('0:64');
    exitDungeonAutomap();   // N=0 already cleared, but prove the snapshot arm too
    restoreAutomap({ 'r/Q': { revealed: [], visitedThisRun: [], entranceDiscovered: false, lastVisited: 1 } });
    assert.deepEqual(snapshotAutomap(300), {}, 'saving while outside clears the dictionary');
    assert.equal(getDungeonAutomap('r/Q'), null);
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('A1 LRU prune: the newest AutomapNumberOfDungeons survive; N=0 keeps the live record (:2145-2149, :2216-2238)', () => {
  resetAutomapStore(); _resetForTests();
  try {
    setValue('Map', 'AutomapNumberOfDungeons', 2);
    enterDungeonAutomap('1/A', 100);
    enterDungeonAutomap('2/B', 200);
    enterDungeonAutomap('3/C', 300);   // prunes to the 2 newest
    assert.equal(getDungeonAutomap('1/A'), null, 'the oldest visit is forgotten');
    assert.ok(getDungeonAutomap('2/B'));
    assert.ok(getDungeonAutomap('3/C'), 'the entering dungeon always survives its own entry');
    // N=0 is classic's forgetfulness, treated as 1 while inside
    setValue('Map', 'AutomapNumberOfDungeons', 0);
    enterDungeonAutomap('4/D', 400);
    assert.equal(getDungeonAutomap('2/B'), null);
    assert.equal(getDungeonAutomap('3/C'), null);
    assert.ok(getDungeonAutomap('4/D'));
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('A1 reveal law: DOWN + VIEW + the floor march paint the path, by hit point against entry AABBs', () => {
  // ROAD-C c2/S1 rewrote the LAW under this pin: the single ray became
  // DFU's three (ScanWithRaycastInDirectionAndUpdateMeshesAndMaterials
  // :1021-1144) and the index became the model. The probe SET and the
  // paths it paints - which is what this pin has always been about -
  // are unchanged, so the assertions below stand as written. The new
  // law's own pins live in test/roadc_automap_model.test.js.
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('0/probe', 0);
    const index = buildRevealIndex([
      { key: 'floorA', aabb: [0, -0.5, 0, 10, 0.1, 10] },
      { key: 'floorB', aabb: [0, -0.5, 10, 10, 0.1, 20] },
      { key: 'wall', aabb: [0, 0, 19.9, 10, 4, 20.5] },
      { key: 'far', aabb: [50, 0, 50, 60, 4, 60] },
      { key: 'noAabb' },   // filtered out by the model builder
    ]);
    assert.equal(index.length, 4, 'entries without an AABB never index');
    // floor at y=0, one wall at z=20; anything else misses. The answer
    // is origin-independent, so the three parallel rays agree exactly.
    const collider = {
      raycastHit: (o, d) => {
        if (d[1] === -1) return { dist: o[1], key: 'dungeon', normal: null };       // straight down -> the floor
        if (d[2] === 1) return { dist: 20 - o[2], key: 'dungeon', normal: null };   // north -> the wall
        return { dist: Infinity, key: null, normal: null };
      },
    };
    collider.raycast = (o, d, m) => collider.raycastHit(o, d, m).dist;
    automapRevealTick(rec, { eye: [5, 2, 5], fwd: [0, 0, 1], collider, index });
    assert.equal(rec.revealed.has('floorA'), true, 'the DOWN probe (:1161-1164)');
    assert.equal(rec.revealed.has('wall'), true, 'the VIEW probe (:1168-1170)');
    assert.equal(rec.revealed.has('floorB'), true, 'the 1-unit floor march painted past z=10 (:1176-1190)');
    assert.equal(rec.revealed.has('far'), false);
    assert.equal(rec.visitedThisRun.has('floorA'), true, 'both tiers mark together (DisableKeyword :1137)');
    // a view ray that misses marches nowhere
    const rec2 = enterDungeonAutomap('0/probe2', 0);
    automapRevealTick(rec2, { eye: [5, 2, 5], fwd: [0, 0, -1], collider, index });
    assert.deepEqual([...rec2.revealed], ['floorA'], 'DOWN alone - no march without a view hit');
    // out of range: eye too high for the 3-unit down probe (:168 "flying too high")
    const rec3 = enterDungeonAutomap('0/probe3', 0);
    automapRevealTick(rec3, { eye: [5, 4, 5], fwd: [0, 0, -1], collider, index });
    assert.equal(rec3.revealed.size, 0);
  } finally { resetAutomapStore(); }
});

test('A1 entrance discovery: clear LOS to the player within 100 units reveals the beacon (:1197-1274)', () => {
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('0/e', 0);
    let calls = 0;
    const clear = { raycast: () => { calls++; return Infinity; } };
    const blocked = { raycast: () => 10 };
    // too far: no ray is even cast (raycastDistanceEntranceMarkerReveal = 100)
    automapEntranceTick(rec, [0, 1, 0], [150, 1, 0], clear);
    assert.equal(rec.entranceDiscovered, false);
    assert.equal(calls, 0);
    // blocked: a wall sits between
    automapEntranceTick(rec, [0, 1, 0], [30, 1, 0], blocked);
    assert.equal(rec.entranceDiscovered, false);
    // the near-boundary counts as clear (hit >= dist - 0.5)
    automapEntranceTick(rec, [0, 1, 0], [30, 1, 0], { raycast: () => 29.6 });
    assert.equal(rec.entranceDiscovered, true);
    // discovered latches - no further casts
    automapEntranceTick(rec, [0, 1, 0], [30, 1, 0], { raycast: () => { throw new Error('cast after discovery'); } });
    assert.equal(rec.entranceDiscovered, true);
  } finally { resetAutomapStore(); }
});

test('A1 save: the dictionary rides snapshotPlayer beside discovery, JSON-clean, Sets restored; pre-A1 saves restore empty', () => {
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('17/Hold', 5000);
    rec.revealed.add('0:64'); rec.visitedThisRun.add('0:64'); rec.entranceDiscovered = true;
    const w = { name: 'W', health: 10, maxHealth: 10, level: 1, stats: {}, skills: [30], skillUses: [], items: [] };
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(w, { classicMinutes: 5000 })));
    assert.deepEqual(snap.automap['17/Hold'].revealed, ['0:64'], 'Sets travel as arrays');
    resetAutomapStore();
    restorePlayer({}, snap);
    const back = getDungeonAutomap('17/Hold');
    assert.ok(back.revealed instanceof Set);
    assert.equal(back.revealed.has('0:64'), true);
    assert.equal(back.visitedThisRun.has('0:64'), true, 'a load never resets the run (:2492-2493)');
    assert.equal(back.entranceDiscovered, true);
    assert.equal(back.lastVisited, 5000);
    // a pre-A1 snapshot carries no field - the session's own maps
    // SURVIVE the load: DFU restores the automap only when the save
    // carries data (SaveLoadManager :1503-1509), never wiping the
    // in-memory dictionary over a missing file (A1 review)
    delete snap.automap;
    restorePlayer({}, snap);
    assert.ok(getDungeonAutomap('17/Hold'), 'a field-less save leaves session memory alone');
    // and the plain module halves roundtrip on their own
    enterDungeonAutomap('1/X', 10).revealed.add('k');
    const s2 = snapshotAutomap();
    restoreAutomap(JSON.parse(JSON.stringify(s2)));
    assert.equal(getDungeonAutomap('1/X').revealed.has('k'), true);
  } finally { resetAutomapStore(); }
});

test('A1 micro-map: the 2px/block grid with sizeMin 7, B-prefix border colour, half-block entrance/player pixels (:1739-1832)', () => {
  const opts = { qol: true, inner: 0xff111111, border: 0xff222222 };
  const one = buildMicroMap([{ x: 0, z: 0, name: 'W0000000.RDB' }], null, null, opts);
  assert.equal(one.width, MICRO_SIZE_MIN * MICRO_BLOCK_PX, 'a lone block still spans the sizeMin 7 grid');
  assert.equal(one.height, 14);
  // block at grid (0,0) paints at pixel (2,2) from the bottom-left
  // (origin margin +1, 2px blocks); data row 0 is the TOP row
  const at = (bmp, x, yBottom) => bmp.colors[(bmp.height - 1 - yBottom) * bmp.width + x];
  assert.equal(at(one, 2, 2), 0xff111111 >>> 0, 'inner colour for a non-B block');
  assert.equal(at(one, 0, 0), 0, 'the margin stays transparent');
  const border = buildMicroMap([{ x: 0, z: 0, name: 'B0000000.RDB' }], null, null, opts);
  assert.equal(at(border, 2, 2), 0xff222222 >>> 0, 'B-prefixed border blocks take the border colour (:1790-1795)');
  const classic = buildMicroMap([{ x: 0, z: 0, name: 'B0000000.RDB' }], null, null, { ...opts, qol: false });
  assert.equal(at(classic, 2, 2), 0xff00ffff, 'QoL off paints Color.yellow (:1799)');
  // entrance green + player red at half-block resolution (:1805-1830)
  const marked = buildMicroMap([{ x: 0, z: 0, name: 'W.RDB' }], [0, 0, 0], [25.6, 0, 25.6], opts);
  assert.equal(at(marked, 2, 2), 0xff00ff00 >>> 0, 'entrance pixel overwrites its block');
  assert.equal(at(marked, 3, 3), 0xff0000ff >>> 0, 'player half-block pixel');
  assert.equal(buildMicroMap([], null, null, opts), null);
  // the settings colour parser: RRGGBBAA -> packed ABGR
  assert.equal(hexColor32('D487D0FF', 0), 0xffd087d4);
  assert.equal(hexColor32('nonsense', 7), 7);
});

// A1's "stepped controls" pin is RETIRED, not lost (ROAD-C c2/S5). It
// held a recorded DEPARTURE - "one action per press, scaled from DFU's
// per-second speeds", with WASD/QE/+- as the whole vocabulary - and the
// native window replaces that departure with DFU's own control law:
// nine buttons on their own rects, press-HOLD polled per frame, mouse
// drags, and the DialogShortcuts hotkey table. The replacement laws are
// pinned against the C# in test/roadc_automap_window.test.js, where the
// camera they drive (ui/automapCamera.js) also lives. What stays here is
// the slice bias, which is still this arc's state and still resets on
// open unless the setting holds.
test('c2/S5: the slice bias still resets on open unless AutomapRememberSliceLevel holds (:567-572)', () => {
  _resetForTests();
  resetAutomapWindowState();
  try {
    const deps = { player: () => ({ feet: [10, 1, 20], eye: [10, 2.7, 20], yaw: 0 }) };
    signalAutomapReset();
    const w = new AutomapWindow(deps);
    assert.equal(automapCameraState().slicingBiasY, DEFAULT_SLICING_BIAS_Y);
    w.runVerb('ActionIncreaseSliceLevel', 1);
    assert.equal(automapCameraState().slicingBiasY, DEFAULT_SLICING_BIAS_Y + 25, 'moveUpDownSpeed 25/s (:1589-1596)');
    // a REOPEN with the setting off goes back to the default...
    new AutomapWindow(deps);
    assert.equal(automapCameraState().slicingBiasY, DEFAULT_SLICING_BIAS_Y);
    // ...and with it on, the bias survives the close
    w.runVerb('ActionIncreaseSliceLevel', 1);
    setValue('Map', 'AutomapRememberSliceLevel', true);
    new AutomapWindow(deps);
    assert.equal(automapCameraState().slicingBiasY, DEFAULT_SLICING_BIAS_Y + 25);
  } finally { _resetForTests(); resetAutomapWindowState(); }
});

test('A1 wiring pins: entry identity at the push sites, the 5 Hz tick in BOTH dungeon hosts, the load re-entry', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /drawList\.push\(\{ mesh: gpu, matrix, key: `\$\{bi\}:\$\{p\.position\}`, aabb \}\)/, 'static entries carry the action-key identity');
  assert.match(ctx, /automapEntries\.push\(amapRow\(o\.key, aabb, true\)\)/, 'dynamic entries key by the live action object (c2/S1: through the identity row builder)');
  assert.match(ctx, /enterDungeonAutomap\(automapKey, classicMinutesRef\.value, \{ fromLoad: true \}\)/, 'quickLoad re-enters on the LOAD arm');
  assert.match(src('src/scenes/dungeon.js'), /automapTick\?\.\(dt, cam\.pos, fwd\)/, 'the standalone host ticks');
  assert.match(src('src/scenes/worldModes.js'), /automapTick\?\.\(dt, cam\.pos, fwd\)/, 'the streaming host ticks');
  assert.match(src('src/systems/save.js'), /snap\.automap = snapshotAutomap\(snap\.classicMinutes\)/, 'the snapshot takes the clock - the save-time stamp law');
  assert.match(src('src/systems/save.js'), /restoreAutomap\(snap\.automap \?\? null\)/);
});

test('A1 wiring pins: the M binding and the mesh shader slice seam', () => {
  const input = src('src/ui/input.js');
  // I2: the binding is the registry's ['KeyM', 'AutoMap'] default
  // (inputActions.js, ResetDefaults :1027); the router consumes it.
  assert.match(src('src/systems/inputActions.js'), /\['KeyM', 'AutoMap'\]/, 'M is the DFU AutoMap default');
  assert.match(input, /case 'AutoMap': ctx\.toggleAutomap\?\.\(\)/);
  const r = src('src/render/renderer.js');
  assert.match(r, /if \(vWorldPos\.y > uClipY\) discard;/, 'the ceiling cut lives in the mesh FS (_SclicingPositionY)');
  assert.match(r, /this\._clipY = y \?\? 1e9;/, 'off = 1e9, the automap window restores it');
  assert.match(r, /gl\.uniform1f\(this\._solidFog\.clipY, this\._clipY\)/, 'setClipY uploads immediately - the window lifts the slice MID-pass for the beacons');
  // the window rides the mirrored projection (its mesh pass CULLS -
  // the handedness law) and hands lighting/fog/slice back after
  const w = src('src/ui/automapWindow.js');
  assert.match(w, /mirrorProjectionX\(perspective\(lens\.fov \* DEG/, 'HANDEDNESS: the culling pass mirrors, at the LIVE mode\'s lens (c2/S5)');
  // PIN MOVED, ROAD-C c2/S2: the window no longer holds its own
  // save/restore list at all - `renderer.panelFrame` saves the whole
  // global surface before the pass and returns it in a finally
  // (EV6: the renderer owns GL state). The LAW is unchanged and is
  // now pinned as behaviour, on a throwing body, in
  // test/roadc_panelframe.test.js. What this pin holds here is that
  // the window really goes through the bracket and keeps nothing of
  // its own.
  assert.match(w, /renderer\.panelFrame\(\{/, 'the pass runs inside the renderer\'s bracket');
  assert.equal(/renderer\.setFog\('exp'/.test(w), false, 'and restores nothing by hand');
  // A1 review: beacons are never sliced (DFU injects the slicing
  // shader into the GEOMETRY only, Automap.cs:1906 vs :1355-1362) -
  // the slice lifts before the arrow/marker draws
  assert.match(w, /setClipY\(null\);\n\s*renderer\.setAutomapMode\(0\);\n\s*if \(this\.deps\.arrowMesh/, 'the arrow draws with the slice lifted (and untinted, A2)');
  // A1 review: the death presenter force-replaces the overlay slot -
  // it must release the occupant, and the micro-map version counter
  // is module-global so a leaked key can never serve a stale bitmap
  assert.match(src('src/scenes/dungeonContext.js'), /activeOverlay\?\.dispose\?\.\(\);/, 'the forced overwrite disposes first');
  assert.match(w, /let _microVer = 0;/, 'module-level micro-map versions');
  assert.match(src('src/scenes/dungeonContext.js'), /destroy\(\) \{\n[\s\S]{0,500}exitDungeonAutomap\(\);/, 'dungeon teardown runs the exit law (N=0 forgets; window widened for NT1\'s dead latch ahead of it)');
});
