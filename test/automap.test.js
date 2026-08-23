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
  FLOOR_MARCH_STEP, automapDungeonKey, enterDungeonAutomap, getDungeonAutomap,
  snapshotAutomap, restoreAutomap, resetAutomapStore, buildRevealIndex,
  automapRevealTick, automapEntranceTick, slicingPositionY, DEFAULT_SLICING_BIAS_Y,
} from '../src/systems/automap.js';
import {
  AutomapWindow, buildMicroMap, hexColor32,
  FIELD_OF_VIEW_2D, CAMERA_HEIGHT_VIEW_FROM_TOP, MICRO_SIZE_MIN, MICRO_BLOCK_PX,
} from '../src/ui/automapWindow.js';
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
    // the load arm keeps the run - a mid-dungeon quickload is not a re-entry
    again.visitedThisRun.add('0:64');
    const loaded = enterDungeonAutomap(key, 3000, { fromLoad: true });
    assert.equal(loaded.visitedThisRun.has('0:64'), true);
  } finally { resetAutomapStore(); }
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
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('0/probe', 0);
    const index = buildRevealIndex([
      { key: 'floorA', aabb: [0, -0.5, 0, 10, 0.1, 10] },
      { key: 'floorB', aabb: [0, -0.5, 10, 10, 0.1, 20] },
      { key: 'wall', aabb: [0, 0, 19.9, 10, 4, 20.5] },
      { key: 'far', aabb: [50, 0, 50, 60, 4, 60] },
      { key: 'noAabb' },   // filtered out by buildRevealIndex
    ]);
    assert.equal(index.length, 4, 'entries without an AABB never index');
    // floor at y=0, one wall at z=20; anything else misses
    const collider = {
      raycast: (o, d) => {
        if (d[1] === -1) return o[1];                 // straight down -> the floor
        if (d[2] === 1) return 20 - o[2];             // north -> the wall
        return Infinity;
      },
    };
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
    // a pre-A1 snapshot carries no field - nothing remembered, no throw
    delete snap.automap;
    restorePlayer({}, snap);
    assert.equal(getDungeonAutomap('17/Hold'), null);
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

test('A1 window: stepped controls - pan/rotate/zoom/slice/reset, M and Escape close', () => {
  _resetForTests();
  try {
    const deps = { player: () => ({ feet: [10, 1, 20], eye: [10, 2.7, 20], yaw: 0 }) };
    const w = new AutomapWindow(deps);
    assert.deepEqual(w.center, [10, 20], 'opens straight above the player (:1160-1165)');
    assert.equal(w.height, 150);
    assert.equal(w.biasY, DEFAULT_SLICING_BIAS_Y, 'slice resets on open without AutomapRememberSliceLevel (:568-572)');
    w.input('up');
    assert.deepEqual(w.center, [10, 28], 'pan follows the map north at yaw 0');
    w.input('char:q');
    assert.equal(w.yawDeg, 22.5);
    w.input('plus');
    assert.equal(w.height, 120);
    w.input('minus'); w.input('char:-');
    assert.equal(w.height, 187.5, 'both spellings of zoom-out land (overlayAction quirk)');
    w.input('char:t');
    assert.equal(w.biasY, DEFAULT_SLICING_BIAS_Y + 2.5);
    w.input('char:c');
    assert.deepEqual([w.height, w.yawDeg, w.biasY], [150, 0, DEFAULT_SLICING_BIAS_Y], 'ActionResetView (:1774-1793)');
    // the remember setting carries the bias to the NEXT window
    w.input('char:t');
    setValue('Map', 'AutomapRememberSliceLevel', true);
    const w2 = new AutomapWindow(deps);
    assert.equal(w2.biasY, DEFAULT_SLICING_BIAS_Y + 2.5);
    w2.input('char:m');
    assert.equal(w2.done, true, 'M closes, DFU toggle-to-close (:703-714)');
    w.input('back');
    assert.equal(w.done, true, 'Escape closes');
  } finally { _resetForTests(); }
});

test('A1 wiring pins: entry identity at the push sites, the 5 Hz tick in BOTH dungeon hosts, the load re-entry', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /drawList\.push\(\{ mesh: gpu, matrix, key: `\$\{bi\}:\$\{p\.position\}`, aabb \}\)/, 'static entries carry the action-key identity');
  assert.match(ctx, /automapEntries\.push\(\{ key: o\.key, aabb/, 'dynamic entries key by the live action object');
  assert.match(ctx, /enterDungeonAutomap\(automapKey, classicMinutesRef\.value, \{ fromLoad: true \}\)/, 'quickLoad re-enters on the LOAD arm');
  assert.match(src('src/scenes/dungeon.js'), /automapTick\?\.\(dt, cam\.pos, fwd\)/, 'the standalone host ticks');
  assert.match(src('src/scenes/worldModes.js'), /automapTick\?\.\(dt, cam\.pos, fwd\)/, 'the streaming host ticks');
  assert.match(src('src/systems/save.js'), /snap\.automap = snapshotAutomap\(\)/);
  assert.match(src('src/systems/save.js'), /restoreAutomap\(snap\.automap \?\? null\)/);
});

test('A1 wiring pins: the M binding and the mesh shader slice seam', () => {
  const input = src('src/ui/input.js');
  assert.match(input, /KeyM'\) return 'automap'/, 'M is the DFU AutoMap default');
  assert.match(input, /case 'automap': ctx\.toggleAutomap\?\.\(\)/);
  const r = src('src/render/renderer.js');
  assert.match(r, /if \(vWorldPos\.y > uClipY\) discard;/, 'the ceiling cut lives in the mesh FS (_SclicingPositionY)');
  assert.match(r, /setClipY\(y\) \{ this\._clipY = y \?\? 1e9; \}/, 'off = 1e9, the automap window restores it');
  // the window rides the mirrored projection (its mesh pass CULLS -
  // the handedness law) and hands lighting/fog/slice back after
  const w = src('src/ui/automapWindow.js');
  assert.match(w, /mirrorProjectionX\(perspective\(FIELD_OF_VIEW_2D/, 'HANDEDNESS: the culling pass mirrors');
  assert.match(w, /finally \{[\s\S]{0,400}setClipY\(null\)[\s\S]{0,400}setFog\('exp', 0\.005/, 'the dungeon fog returns even if the pass throws');
});
