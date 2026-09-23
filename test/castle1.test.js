// CASTLE1 (DragynDance, Discord, 2026-09-22): "Entering castle daggerfall
// removes your ability to interact with anything, so you are unable to
// leave, talk to the guard, or open any doors. Also can't even load the
// game anymore to escape, it pops this up: (different dungeon - world
// state left as built)".
//
// Walked with the real data (tools/castleProbe.mjs): at Castle
// Daggerfall's start marker the eye stands INSIDE the AABB of a large
// action model - the foyer piece, 6.25 x 3.2 x 6.1 m - and the slab test
// answers 0 for a box the ray starts in. Zero beat the exit door at 1.4 m,
// the guard and every door, so that one object took every click. The
// load half is the door StartDungeonInterior takes: the first entrance
// door in the loaded exterior, which the streaming world fills with the
// neighbours' doors too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickActivatableHit, boxContains, rayAabb } from '../src/player/activate.js';
import { dungeonStartDoorFor } from '../src/systems/save.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// The castle's foyer, to the probe's numbers: the eye at the start marker,
// the exit door a pace and a half away along -x, the foyer piece's box
// around both.
const EYE = [50.08, 27.3, 25.58];
const DIR = [-1, 0, 0];
const FOYER = { key: 'act:0:18965', aabb: { min: [44.8, 25.6, 22.55], max: [51.05, 28.8, 28.65] }, distance: 3.2 };
const EXIT = { key: 'exit:0', aabb: { min: [50.15, 25.4, 24.73], max: [51.9, 28.15, 26.48] }, distance: 3.2 };
const GUARD = { key: 'person:0', aabb: { min: [48.0, 25.6, 25.0], max: [49.0, 27.6, 26.2] }, distance: 5.6 };
const openAir = { raycast: () => Infinity };
const wallAt = (d) => ({ raycast: (_e, _d, max) => (d <= max ? d : Infinity) });

test('CASTLE1: the slab test answers 0 for a box the ray starts in - the fact the report rode', () => {
  assert.equal(rayAabb(EYE, DIR, FOYER.aabb), 0);
  assert.ok(boxContains(FOYER.aabb, EYE));
  assert.ok(!boxContains(EXIT.aabb, EYE) || rayAabb(EYE, DIR, EXIT.aabb) === 0);
});

test('CASTLE1: from inside the foyer piece, the exit door a pace away wins the click', () => {
  // The exit door's own box also holds the eye here (the marker stands
  // in the doorway), and its surface is the collider hit 0.82 m out -
  // the probe's `wall` at the exit - inside BOTH boxes. The exit door
  // is a static door on a model in the one static bucket, so no key
  // names it: the tighter box owns the surface, in either list order.
  const eye = [50.95, 27.3, 25.58];
  for (const list of [[FOYER, EXIT], [EXIT, FOYER]]) {
    const pick = pickActivatableHit(eye, DIR, list, wallAt(0.82));
    assert.equal(pick?.key, 'exit:0');
    assert.ok(Math.abs(pick.distance - 0.82) < 1e-9);
  }
});

test('CASTLE1: a surface another target OWNS is never this one\'s - the action door\'s bucket names it', () => {
  // An action door (its own collider bucket, keyed by its object) stands
  // in the foyer piece's box, 1 m from the eye; the foyer's box is the
  // bigger one, so the tie-break alone would still hand it the door's
  // own face were the bucket key not read.
  const door = { key: 'act:0:777', aabb: { min: [44.8, 25.6, 22.55], max: [51.05, 28.8, 28.65] }, distance: 3.2 };
  const bigger = { key: 'act:0:18965', aabb: { min: [40, 20, 20], max: [60, 30, 30] }, distance: 3.2 };
  const keyed = { raycastHit: (_e, _d, max) => (max >= 1 ? { dist: 1, key: 'act:0:777' } : { dist: Infinity, key: null }), raycast: (_e, _d, max) => (max >= 1 ? 1 : Infinity) };
  for (const list of [[bigger, door], [door, bigger]]) assert.equal(pickActivatableHit(EYE, DIR, list, keyed)?.key, 'act:0:777');
  // ...and a surface in the STATIC bucket ('dungeon') names nobody: the box decides
  const plain = { raycastHit: (_e, _d, max) => (max >= 1 ? { dist: 1, key: 'dungeon' } : { dist: Infinity, key: null }), raycast: (_e, _d, max) => (max >= 1 ? 1 : Infinity) };
  assert.equal(pickActivatableHit(EYE, DIR, [bigger], plain)?.key, 'act:0:18965');
});

test('CASTLE1: the guard in front of you beats the piece you stand inside', () => {
  // The eye is in the foyer's box and not in the guard's; the guard's
  // box is entered at 1.08 m and the nearest surface (the far wall) is
  // 5 m off - inside the foyer's box, so the foyer IS hit, at 5 m, and
  // loses to the guard on distance exactly as DFU's one raycast would
  // have met the guard's collider first.
  const pick = pickActivatableHit(EYE, DIR, [FOYER, GUARD], wallAt(5.0));
  assert.equal(pick?.key, 'person:0');
});

test('CASTLE1: a containing box with no surface on the ray is no hit at all', () => {
  // Nothing in the collider within reach: the ray leaves the box before
  // meeting any geometry, so the object was never struck (every triangle
  // it owns lies inside its own AABB).
  assert.equal(pickActivatableHit(EYE, DIR, [FOYER], openAir), null);
  // A surface OUTSIDE the box - the far corridor wall at 12 m, past the
  // box's -x face at 5.28 m - is somebody else's, not this object's.
  assert.equal(pickActivatableHit(EYE, DIR, [{ ...FOYER, distance: 20 }], wallAt(12)), null);
  // ...and a surface inside it, within reach, is the object itself.
  const pick = pickActivatableHit(EYE, DIR, [{ ...FOYER, distance: 20 }], wallAt(3));
  assert.equal(pick?.key, 'act:0:18965');
  assert.equal(pick.distance, 3);
});

test('CASTLE1: a flat whose box holds the eye has no geometry to meet - never a hit', () => {
  const fire = { key: 'hearth:0', aabb: { min: [49, 25, 24], max: [51, 28, 27] }, distance: 3.2, noSurface: true };
  assert.equal(pickActivatableHit(EYE, DIR, [fire], wallAt(0.5)), null);
  // and it does not shadow the door behind it either
  assert.equal(pickActivatableHit([50.95, 27.3, 25.58], DIR, [fire, EXIT], wallAt(0.82))?.key, 'exit:0');
});

test('CASTLE1: a box the ray merely ENTERS is picked as before - the slab distance, no collider question asked', () => {
  const eye = [53, 27.3, 25.58];   // a pace outside the foyer's +x face at 51.05
  let asked = 0;
  const collider = { raycast: (_e, _d, max) => { asked++; return max > 100 ? 1 : Infinity; } };
  const pick = pickActivatableHit(eye, DIR, [FOYER], collider);
  assert.equal(pick?.key, 'act:0:18965');
  assert.ok(Math.abs(pick.distance - 1.95) < 1e-9);
  assert.equal(asked, 1, 'the one occlusion cast the pick always made');
});

// ---- the load's door ----------------------------------------------------

const door = (group, locationId, i) => ({ i, group, door: { doorType: 2 }, dfLocation: { dungeon: { recordElement: { header: { locationId } } } } });
const CASTLE = [door('207,213', 1291010263, 0), door('207,213', 1291010263, 1)];
const NEIGHBOUR = door('205,214', 555, 2);
const KEEP = door('209,211', 777, 3);
const SITE = { group: '207,213', door: null, dfLocation: { dungeon: { recordElement: { header: { locationId: 1291010263 } } } } };

test('CASTLE1: the load takes the SAVED dungeon\'s own door, wherever it stands in the list', () => {
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, KEEP, ...CASTLE], SITE, 'dungeon:1291010263').i, 0);
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, KEEP, ...CASTLE], null, 'dungeon:777').i, 3);
});

test('CASTLE1: with no key, or a key nobody carries, the player\'s own pixel\'s door - then the doorless site', () => {
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, KEEP, ...CASTLE], SITE, null).i, 0);
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, KEEP, ...CASTLE], SITE, 'dungeon:999').i, 0);
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, KEEP], SITE, null), SITE, 'no door on this pixel: the site itself (CRUX1)');
  assert.equal(dungeonStartDoorFor([], SITE, 'dungeon:1291010263'), SITE);
});

test('CASTLE1: a pixel with no dungeon of its own keeps the old fallback - the first door there is, or nothing', () => {
  assert.equal(dungeonStartDoorFor([NEIGHBOUR, KEEP], null, null).i, 2);
  assert.equal(dungeonStartDoorFor([], null, null), null);
  assert.equal(dungeonStartDoorFor(null, null, 'dungeon:1'), null);
});

test('CASTLE1: by source - the load hands the save\'s key to startInDungeon, and the arm reads the ONE law', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /modes\?\.startInDungeon\?\.\(\{ locationKey: extras\.locationKey \}\)/, 'worldQuickLoad\'s dungeon arm passes the saved key');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /async function startInDungeon\(\{ locationKey = null \} = \{\}\)/);
  assert.match(wm, /dungeonStartDoorFor\(entries\.filter\(\(e\) => e\.door\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE\), host\.dungeonStartSite\?\.\(\) \?\? null, locationKey\)/);
  assert.doesNotMatch(wm, /entries\.find\(\(e\) => e\.door\.doorType === DOOR_TYPE\.DUNGEON_ENTRANCE\) \?\? host\.dungeonStartSite/, 'the first-door arm is gone');
});

// ---- the dungeon's own load door -----------------------------------------

test('CASTLE1: by source - a save from another place, loaded through the dungeon\'s own door, is the world host\'s load', () => {
  const dc = read('src/scenes/dungeonContext.js');
  // before restorePlayer, off the slot's own key, a microtask on (the door is reached from inside the context's overlay dispatch)
  assert.match(dc, /if \(!snap\) \{ hudText\.add\('No saved game\.'\); return; \}[\s\S]{0,2000}?if \(opts\.worldLoad && snap\.locationKey != null && snap\.locationKey !== _locationKey\) \{\s*\n\s*const k = key;\s*\n\s*Promise\.resolve\(\)\.then\(\(\) => opts\.worldLoad\(k\)\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*const extras = restorePlayer\(playerEntity, snap, spellsByIndex\);/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /worldLoad: host\.loadSave \? \(key\) => host\.loadSave\(key\) : null,/, 'the mode host hands the world host\'s load down, or nothing');
  const w = read('src/scenes/world.js');
  assert.match(w, /loadSave: \(key\) => worldQuickLoad\(key != null \? \{ key \} : \{\}\),/, 'the world host\'s load by key - the QuickSave slot when none');
  // the standalone ?dungeon scene passes no worldLoad: its line stands
  assert.doesNotMatch(read('src/scenes/dungeon.js'), /worldLoad/);
});
