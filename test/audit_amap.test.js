// AUDIT-AMAP (2026-09-21, Mac: "audit the dungeon automap for me,
// ensure it's bug free and working properly"): four Opus lanes over the
// discovery law, the window, the hosts and the pins. Every finding that
// changed a law is pinned here against the C# it comes from; the pins
// the lanes found missing (a tie-break, a boundary, a pitched camera, a
// sparse layout) sit beside them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  enterDungeonAutomap, exitDungeonAutomap, getDungeonAutomap, resetAutomapStore, snapshotAutomap, restoreAutomap,
  bindAutomapLayout, buildRevealIndex, automapRevealTick, automapEntranceTick, automapInstance,
  enterInteriorAutomap, exitInteriorAutomap, capsuleCentreFromEye, FLOOR_MARCH_STEP, RAYCAST_DISTANCE_DOWN,
} from '../src/systems/automap.js';
import { buildAutomapModel, restoreMatchesLayout } from '../src/systems/automapModel.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT, EYE_HEIGHT } from '../src/player/motor.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const BIG = [-100, -100, -100, 100, 100, 100];
/** A collider over one hall: a DOWN ray lands on the floor at y=0, any
 *  other ray hits a wall `wallAt` units out, and each protection ray's
 *  distance can be skewed by `skew(origin)` - an oblique surface. */
function hallCollider({ wallAt = 5, skew = () => 0, key = 'hall', log = null } = {}) {
  return {
    raycastHit(o, d, max) {
      log?.push({ o: [...o], d: [...d] });
      const down = d[1] < -0.99;
      const dist = (down ? o[1] : wallAt) + skew(o);
      if (dist > max) return null;
      return { dist, key, normal: null };
    },
    raycast() { return Infinity; },
  };
}
const offMain = (o, eye = [0, 2, 0]) => Math.hypot(o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]) > 1e-9;

test('AUDIT-AMAP F1: an OBLIQUE wall reveals - DFU compares each ray to the true geometry (Automap.cs:1121-1123), never one ray to another', () => {
  resetAutomapStore();
  try {
    const model = buildAutomapModel([{ key: 'hall', aabb: BIG }]);
    for (const angle of [10, 30, 60, 80]) {
      const rec = enterDungeonAutomap(`amap/oblique${angle}`, 0);
      // parallel rays 0.1 apart land 0.1*tan(angle) apart on a wall that
      // many degrees off-square - past 0.01 beyond ~6 degrees
      const skew = (o) => (offMain(o) ? 0.1 * Math.tan(angle * Math.PI / 180) : 0);
      automapRevealTick(rec, { eye: [0, 2, 0], fwd: [0, 0, 1], collider: hallCollider({ skew }), model });
      assert.equal(rec.revealed.has('hall'), true, `mutants: the inter-ray test back - a wall ${angle} degrees off-square revealing nothing`);
    }
    // the door bucket is the test's whole content: a nearest hit on an
    // action door reveals nothing at any angle
    const rec = enterDungeonAutomap('amap/door', 0);
    automapRevealTick(rec, { eye: [0, 2, 0], fwd: [0, 0, 1], collider: hallCollider({ key: 'door#1' }), model, isDoorBucket: (k) => k === 'door#1' });
    assert.equal(rec.revealed.size, 0, 'mutants: the door discrimination dropped');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP H7: a MOVED action model blocks the scan, as DFU\'s true-vs-copy test does for a platform off its rest', () => {
  resetAutomapStore();
  try {
    const model = buildAutomapModel([{ key: 'hall', aabb: BIG }]);
    const rec = enterDungeonAutomap('amap/moved', 0);
    automapRevealTick(rec, { eye: [0, 2, 0], fwd: [0, 0, 1], collider: hallCollider({ key: 'lift' }), model, isMovedBucket: (k) => k === 'lift' });
    assert.equal(rec.revealed.size, 0, 'mutants: a raised platform resolving to whichever at-rest box holds the hit');
    const rec2 = enterDungeonAutomap('amap/atrest', 0);
    automapRevealTick(rec2, { eye: [0, 2, 0], fwd: [0, 0, 1], collider: hallCollider({ key: 'lift' }), model, isMovedBucket: () => false });
    assert.equal(rec2.revealed.has('hall'), true, 'at rest it reveals like any wall');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP T6: the march stops BEFORE a step that lands on the wall (Magnitude(step) >= hit.distance breaks, :1181-1184)', () => {
  resetAutomapStore();
  try {
    const model = buildAutomapModel([{ key: 'hall', aabb: BIG }]);
    const rec = enterDungeonAutomap('amap/march', 0);
    const { rays } = automapRevealTick(rec, { eye: [0, 2, 0], fwd: [0, 0, 1], collider: hallCollider({ wallAt: 3 * FLOOR_MARCH_STEP }), model });
    // down + view + steps 1 and 2 (the step AT 3.0 does not cast), three rays each
    assert.equal(rays, 3 * (1 + 1 + 2), 'mutants: `<=` marching a third step onto the wall');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP T5: the march\'s protection offset is ZERO for a level look and REAL for a pitched one (cross(camera-down, world-down), :1176-1190)', () => {
  resetAutomapStore();
  try {
    const model = buildAutomapModel([{ key: 'hall', aabb: BIG }]);
    const marchOrigins = (fwd) => {
      const log = [];
      const rec = enterDungeonAutomap(`amap/pitch${fwd.join(',')}`, 0);
      automapRevealTick(rec, { eye: [0, 2, 0], fwd, collider: hallCollider({ wallAt: 4, log }), model });
      // the march rays are the DOWN casts not from the eye
      const down = log.filter((r) => r.d[1] < -0.99 && r.o[2] > 1e-6);   // the march casts, along +z from the eye
      return new Set(down.map((r) => r.o.map((v) => v.toFixed(6)).join('/'))).size;
    };
    assert.equal(marchOrigins([0, 0, 1]), 3, 'level: three coincident rays per step - Unity normalizes the zero vector to zero (steps 1..3)');
    const s = Math.SQRT1_2;
    assert.ok(marchOrigins([0, -s, s]) > 3, 'mutants: camera-down replaced by world-down - a pitched look must spread the trio');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP T4: resolveAt - equal boxes tie to the FIRST in DFU walk order', () => {
  const model = buildAutomapModel([
    { key: 'b', aabb: [0, 0, 0, 10, 10, 10], blockIndex: 1, elementIndex: 0, modelIndex: 0 },
    { key: 'a', aabb: [0, 0, 0, 10, 10, 10], blockIndex: 0, elementIndex: 0, modelIndex: 0 },
  ]);
  assert.equal(model.resolveAt([5, 5, 5], 0).key, 'a', 'mutants: `<=` (last wins)');
  const tight = buildAutomapModel([
    { key: 'big', aabb: [0, 0, 0, 10, 10, 10], blockIndex: 0 },
    { key: 'small', aabb: [4, 4, 4, 6, 6, 6], blockIndex: 1 },
  ]);
  assert.equal(tight.resolveAt([5, 5, 5], 0).key, 'small', 'the tightest box wins');
});

test('AUDIT-AMAP T1: a SPARSE layout (a block with no rows) survives the save wire - the guard must not refuse the dungeon\'s own layout', () => {
  resetAutomapStore();
  try {
    // block 1 contributes no row (every placement failed to load)
    const rows = [
      { key: '0:1', aabb: BIG, blockIndex: 0, blockName: 'B0.RDB' },
      { key: '2:1', aabb: BIG, blockIndex: 2, blockName: 'B2.RDB' },
    ];
    const model = buildRevealIndex(rows);
    assert.deepEqual(model.blockNames, ['B0.RDB', null, 'B2.RDB'], 'mutants: a HOLE at index 1 (JSON writes it as null and the compare then fails)');
    assert.equal(0 in model.blockNames && 1 in model.blockNames, true, 'dense - no empty slot');
    const rec = enterDungeonAutomap('amap/sparse', 0);
    bindAutomapLayout(rec, model);
    rec.revealed.add('0:1');
    const wire = JSON.parse(JSON.stringify(snapshotAutomap(0)));
    restoreAutomap(wire);
    const loaded = enterDungeonAutomap('amap/sparse', 0, { fromLoad: true });
    assert.equal(restoreMatchesLayout(model, loaded.blockNames), true, 'the same layout agrees with itself after a round trip');
    bindAutomapLayout(loaded, model);
    assert.deepEqual([...loaded.revealed], ['0:1'], 'mutants: the reveals wiped on every load');
    // and a hole in an OLD save (written before this fix) reads as the same absence
    assert.equal(restoreMatchesLayout(model, ['B0.RDB', undefined, 'B2.RDB']), true);
    assert.equal(restoreMatchesLayout(model, ['B0.RDB', 'B1.RDB', 'B2.RDB']), false, 'a real disagreement still refuses');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP F4/H1-H3: the LOAD arm re-binds - the layout guard runs on the loaded record and Automap.instance answers it', () => {
  resetAutomapStore();
  try {
    const model = buildRevealIndex([{ key: '0:1', aabb: BIG, blockIndex: 0, blockName: 'LIVE.RDB' }]);
    const live = enterDungeonAutomap('amap/load', 0);
    bindAutomapLayout(live, model);
    // a save from a DIFFERENT layout of the same dungeon
    restoreAutomap({ 'amap/load': { revealed: ['0:1'], visitedThisRun: ['0:1'], entranceDiscovered: true, lastVisited: 5, blockNames: ['OTHER.RDB'], notes: [], teleporters: [] } });
    const loaded = enterDungeonAutomap('amap/load', 0, { fromLoad: true });
    assert.notEqual(loaded, live, 'restoreAutomap minted a new record object');
    bindAutomapLayout(loaded, model);   // what dungeonContext does after the fetch now
    assert.equal(loaded.revealed.size, 0, 'the block-name guard cleared the mismatched reveals (:2385-2386)');
    assert.equal(loaded.entranceDiscovered, false);
    assert.equal(automapInstance()?.rec, loaded, 'mutants: map_revealall writing into the pre-load object');
    const ctx = rd('src/scenes/dungeonContext.js');
    assert.match(ctx, /enterDungeonAutomap\(automapKey, classicMinutesRef\.value, \{ fromLoad: true \}\);\n[\s\S]{0,400}bindAutomapLayout\(automapRec, automapModel\);\n\s*signalAutomapReset\(\);/,
      'the host binds AND raises the reset signal on the load arm (InitWhenInInteriorOrDungeon :2490, :2496)');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP F5: a save taken INSIDE A BUILDING at N=0 keeps the dungeon maps - IsPlayerInside is true there (:2133)', () => {
  resetAutomapStore(); _resetForTests();
  try {
    setValue('Map', 'AutomapNumberOfDungeons', 0);
    enterDungeonAutomap('amap/keep', 100).revealed.add('0:1');
    exitDungeonAutomap(100);
    assert.equal(getDungeonAutomap('amap/keep'), null, 'N=0: leaving the dungeon forgets it (the vanilla law)');
    enterDungeonAutomap('amap/keep2', 200).revealed.add('0:1');
    // the port's own bookkeeping: the dungeon record can outlive _inside only through a load; simulate one
    restoreAutomap({ 'amap/keep2': { revealed: ['0:1'], visitedThisRun: [], entranceDiscovered: false, lastVisited: 200 } });
    exitDungeonAutomap();   // hmm: N=0 wipes here too; so restore AFTER the exit
    restoreAutomap({ 'amap/keep2': { revealed: ['0:1'], visitedThisRun: [], entranceDiscovered: false, lastVisited: 200 } });
    enterInteriorAutomap();
    const snap = snapshotAutomap(300);
    assert.ok(snap['amap/keep2'], 'mutants: the outdoors wipe firing inside a shop');
    assert.ok(getDungeonAutomap('amap/keep2'));
    exitInteriorAutomap();
    assert.deepEqual(snapshotAutomap(300), {}, 'outdoors, N=0 writes an empty dictionary');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('AUDIT-AMAP F6/F7: revealed is the DRAW GATE - a visited-but-hidden key is undiscovered, and the snapshot nests the two sets', () => {
  resetAutomapStore();
  try {
    const model = buildAutomapModel([{ key: 'k', aabb: BIG }]);
    const rec = enterDungeonAutomap('amap/tiers', 0);
    rec.visitedThisRun.add('k');   // what HideAll leaves behind (:2450-2461)
    const p = model.partition(rec);
    assert.deepEqual([p.visited.length, p.revealed.length, p.undiscovered.length], [0, 0, 1], 'mutants: the keyword tested before the renderer flag');
    rec.revealed.add('k');
    const q = model.partition(rec);
    assert.deepEqual([q.visited.length, q.revealed.length, q.undiscovered.length], [1, 0, 0]);
    rec.visitedThisRun.add('ghost');
    assert.deepEqual(snapshotAutomap(0)['amap/tiers'].visitedThisRun, ['k'], 'mutants: a visited key that is not revealed written to the save');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP F8/F9: the entrance LOS runs to the player CAPSULE (:1216, :1219-1268) - its centre, its radius', () => {
  assert.deepEqual(capsuleCentreFromEye([1, 2, 3]), [1, 2 - EYE_HEIGHT + CAPSULE_HEIGHT / 2, 3]);
  assert.deepEqual(capsuleCentreFromEye([0, 0.8, 0], 0.8, 1.0), [0, 0.5, 0], 'a crouch passes its own eye and capsule');
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('amap/los', 0);
    automapEntranceTick(rec, [0, 0, 0], [10, 0, 0], { raycast: () => 10 - CAPSULE_RADIUS - 0.01 });
    assert.equal(rec.entranceDiscovered, false, 'a hit short of the capsule surface is a wall');
    automapEntranceTick(rec, [0, 0, 0], [10, 0, 0], { raycast: () => 10 - CAPSULE_RADIUS });
    assert.equal(rec.entranceDiscovered, true, 'mutants: the 0.5 slack, or a slack of nothing');
  } finally { resetAutomapStore(); }
});

test('AUDIT-AMAP F11/F12: the exit stamps the EXIT time (:2155), and both hosts keep the 5 Hz phase without a catch-up burst', () => {
  resetAutomapStore();
  try {
    const rec = enterDungeonAutomap('amap/stamp', 10);
    assert.equal(rec.lastVisited, 10);
    exitDungeonAutomap(55);
    assert.equal(rec.lastVisited, 55, 'mutants: the exit not stamping');
    enterDungeonAutomap('amap/stamp2', 10);
    exitDungeonAutomap();   // no clock: the entry stamp stands
    assert.equal(getDungeonAutomap('amap/stamp2').lastVisited, 10);
  } finally { resetAutomapStore(); }
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/interiorContext.js']) {
    assert.match(rd(f), /automapScanT = \(automapScanT - SCAN_INTERVAL_S\) % SCAN_INTERVAL_S;/, `${f}: the clock keeps its phase (WaitForSeconds(0.2) never drifts under 5 Hz)`);
  }
  assert.ok(RAYCAST_DISTANCE_DOWN === 3.0);
});

test('AUDIT-AMAP H5/H6/H8/H9/H12 SOURCE: the bracket saves the trilight, a mover draws at rest, the probe host frees the cursor, OnPop is public, the micro-map has defaults', () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /ambientTri: this\._ambientTri \? \{ sky: Array\.from\(this\._ambientTri\.sky\), ground: Array\.from\(this\._ambientTri\.ground\) \} : null,/, 'H5: saved by name');
  assert.match(r, /this\.setLighting\(s\.ambient, s\.sunScale, s\.sunColor\);\n\s*this\.setAmbientTrilight\(s\.ambientTri\);/, 'H5: and restored after setLighting nulls it');
  const w = rd('src/ui/automapWindow.js');
  assert.match(w, /for \(const d of this\.deps\.dynamicDraws\) push\(d\.gpu, byKey\?\.get\(d\.object\.key\)\?\.matrix \?\? d\.object\.matrix, d\.object\.key\);/, 'H6: the at-rest matrix the index and the picker hold');
  assert.match(w, /\n  onPop\(\) \{/, 'H9: OnPop is public');
  assert.doesNotMatch(w, /_onPop/, 'H9: no private twin left');
  assert.match(rd('src/scenes/dungeonContext.js'), /activeOverlay\?\.onPop\?\.\(\);\s*\/\/[^\n]*\n\s*activeOverlay\?\.dispose\?\.\(\);/, 'H9: the death presenter runs it before the dispose');
  const i = rd('src/scenes/interior.js');
  assert.match(i, /const lookGate = makeLookGate\(canvas\);/, 'H8: the probe host has the gate');
  assert.match(i, /lookGate\(!!overlay\);/, 'H8: and runs it every frame');
  const d = rd('src/systems/settingsDefaults.js');
  for (const k of ['DungeonMicMapQoL', 'DunMicMapInnerColor', 'DunMicMapBorderColor']) assert.match(d, new RegExp(`"${k}": "`), `H12: ${k} has a defaults row`);
});

test('AUDIT-AMAP W11: layoutMessageBox takes WidthOverride as the WHOLE width and rounds it up to the slice', async () => {
  const { layoutMessageBox } = await import('../src/ui/messageBox.js');
  const font = { fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
  assert.equal(layoutMessageBox(font, [{ text: 'x', center: false }], [], { widthOverride: 306 }).w, 308, 'ceil(306 / 22) * 22');
  assert.equal(layoutMessageBox(font, [{ text: 'x', center: false }], [], { widthOverride: 0 }).w < 308, true, 'unset: the content sizes the box');
});
