// SD-SKY (2026-10-08, the Super Dungeons arc; the Discord, of a live Abyss Dungeon - maya: "WHY DID I GET TPED HERE WHEN
// I WENT INTO THE RIFT", ValenValarys: "portal keep teleporting me out of dungeon", each picture high over the Hollow by its
// column of light, its banner still saying it stands): THE WAY OUT OF THE HOUR LANDED IN THE PIXEL'S FRAME. The world
// host's door list (scenes/world.js buildingDoors) keeps each door in its PIXEL's frame - doorTargets hands the mode
// machine the scene's (shiftedDoor: the pixel's translation under the floating origin, AUDIT 68 S22) - and the Hollow's
// two seams read the list raw: `sdHollowDoors`, which the Hour's way out lands before (scenes/worldModes.js
// returnLanding), and the find's door (scenes/sdHost.js `door`). A door found stood the player at its native height - the
// streamer's vertical shift (StreamingWorldState.compensation[1], minus the eye's height at each recentre past 500 m) over
// the Hollow: in the sky. SD-LAND read the same picture as a door NOT found; it was a door found in the wrong frame.
// Design: bible/11-Multiplayer/Super-Dungeons.md sections 6 and 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getStaticDoors } from '../src/world/staticDoors.js';
import { DOOR_TYPE } from '../src/world/meshReader.js';
import { dungeonEntranceLanding, doorWorldPosition, repositionFeetY } from '../src/player/enterExit.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');

/** The world host's own shiftedDoor, its own sdHollowDoors and its own sdHost `door` seam, read off its source and stood
 *  over a streamer whose pixel translations are `tr` (`'px,py'` -> [x, y, z]). */
function worldSeams(tr, buildingDoors) {
  const state = { pixelTranslation: (px, py) => [...tr[`${px},${py}`]] };
  const sd = /\n {2}(const shiftedDoor = \(entry\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  assert.ok(sd, 'the world host\'s shiftedDoor');
  const shiftedDoor = new Function('state', `${sd[1]}\nreturn shiftedDoor;`)(state);
  // AUDIT SD IV (F40, PIN MOVED): the list is one const, the mode machine's seam and the step out to the pixel both read it
  const hd = /\n {2}const sdHollowDoorsOf = (\(h\) => .*?);\n/.exec(W);
  assert.ok(hd && /\n {4}sdHollowDoors: \(h\) => sdHollowDoorsOf\(h\),/.test(W), 'the world host\'s sdHollowDoors');
  const sdHollowDoors = new Function('buildingDoors', 'DOOR_TYPE', 'shiftedDoor', `return ${hd[1]};`)(buildingDoors, DOOR_TYPE, shiftedDoor);
  const dr = /\n {4}door: \(key\) => \{\n([\s\S]*?)\n {4}\},\n/.exec(W);
  assert.ok(dr && /_sdDoorAt/.test(dr[1]), 'the sdHost\'s door seam');
  const door = new Function('buildingDoors', 'DOOR_TYPE', 'shiftedDoor', 'doorWorldPosition', 'doorGeneration', `let _sdDoorAt = null;\nreturn (key) => {\n${dr[1]}\n};`)(buildingDoors, DOOR_TYPE, shiftedDoor, doorWorldPosition, 0);
  return { shiftedDoor, sdHollowDoors, door };
}

/** A Hollow's entrance as the pixel build mints it (getStaticDoors over a model's door, under the model's PIXEL-LOCAL
 *  matrix - its native height in it), in the door list's own shape. */
function hollowEntry(pixelKey, local) {
  const model = { doors: [{ type: DOOR_TYPE.DUNGEON_ENTRANCE, index: 0, vert0: { x: -1, y: 0, z: 0 }, vert2: { x: 1, y: 2.5, z: 0 }, normal: { x: 0, y: 0, z: 1 } }] };
  const [door] = getStaticDoors(model, 7, 3, local);
  return { door, pixelKey, dfBlock: null, blockX: 0, blockY: 0, recordIndex: 3, climateBase: 2, season: 0 };
}
const at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

// the screenshots' case: the Hollow on a hill 412 m up (native), the eye once past 500 m, so the streamer's vertical
// shift stands at -560 - the Hollow's ground at -148 in the scene - and the Hollow's pixel the one the player stands in
const NATIVE_Y = 412, SHIFT_Y = -560, GROUND = NATIVE_Y + SHIFT_Y;
const TR = { '5,5': [0, SHIFT_Y, 0], '6,5': [TERRAIN_SIZE, SHIFT_Y, 0] };

test('SD-SKY the Hour\'s way out lands before the Hollow\'s door in the scene\'s frame - the door list keeps each door in its pixel\'s, and a door read raw stood the player the streamer\'s vertical shift over the Hollow, 560 m in the sky (mutant: the doors raw)', () => {
  const entry = hollowEntry('5,5', at(300, NATIVE_Y, 500));
  const { sdHollowDoors } = worldSeams(TR, [entry, hollowEntry('9,9', at(1, NATIVE_Y, 1))]);
  const doors = sdHollowDoors({ key: '5,5' });
  assert.equal(doors.length, 1, 'its own pixel\'s entrance alone');
  assert.deepEqual(doorWorldPosition(doors[0]), [300, GROUND + 1.25, 500], 'the door where the scene stands it');
  const landing = dungeonEntranceLanding(doors);
  // exitDungeonNow's spawn: the door's centre as the body's, never under the ground
  const feet = repositionFeetY(GROUND, landing.pos[1]);
  assert.ok(feet >= GROUND && feet - GROUND < 1, `on the ground before its door (feet ${feet.toFixed(2)}, ground ${GROUND})`);
  // what shipped: the same door read raw - its native height, in the scene
  const raw = dungeonEntranceLanding([entry.door]);
  assert.ok(repositionFeetY(GROUND, raw.pos[1]) - GROUND > 500, 'raw, the sky: the picture in the Discord');
  // the list's own door is never moved - doorTargets and the living world read it in its pixel's frame
  assert.deepEqual(doorWorldPosition(entry.door), [300, NATIVE_Y + 1.25, 500]);
});

test('SD-SKY the same through the mode machine\'s own way out: returnLanding asks the world host\'s doors and lands there, the Hollow standing; with its door gone, where I went in (SD-LAND); a neighbouring pixel\'s Hollow moved by its own translation (mutants: the doors raw; the shift without its height)', () => {
  const m = /\n {2}(const returnLanding = \(\) => [^\n]*)\n/.exec(WM);
  assert.ok(m, 'returnLanding');
  const landingOf = (dungeonReturn, host) => new Function('dungeonReturn', 'host', 'dungeonEntranceLanding', `${m[1].replace(/\s+\/\/.*$/, '')}\nreturn returnLanding();`)(dungeonReturn, host, dungeonEntranceLanding);
  const from = { pos: [409.6, GROUND + 0.9, 409.6], normal: [0, 0, 1] };
  const near = worldSeams(TR, [hollowEntry('5,5', at(300, NATIVE_Y, 500))]);
  const out = landingOf({ sdHollow: { key: '5,5' }, candidates: [], from }, { sdHollowDoors: near.sdHollowDoors });
  assert.ok(out && out !== from, 'before the door it found');
  assert.ok(Math.abs(out.pos[1] - (GROUND + 1.25)) < 1e-9, `at the door's height in the scene (${out.pos[1]})`);
  assert.equal(landingOf({ sdHollow: { key: '5,5' }, candidates: [], from }, { sdHollowDoors: worldSeams(TR, []).sdHollowDoors }), from, 'its door gone: where I went in');
  // the Hollow a pixel east of the one I stand in: its door by that pixel's translation, x and y both
  const east = worldSeams(TR, [hollowEntry('6,5', at(20, NATIVE_Y, 500))]);
  const o2 = landingOf({ sdHollow: { key: '6,5' }, candidates: [], from }, { sdHollowDoors: east.sdHollowDoors });
  assert.ok(Math.abs(o2.pos[0] - (TERRAIN_SIZE + 20)) < 1e-9 && Math.abs(o2.pos[1] - (GROUND + 1.25)) < 1e-9, `the east pixel's door (${o2.pos})`);
});

test('SD-SKY the find\'s door in the scene\'s frame too - measured against the feet, which are the scene\'s: a Hollow\'s door on the pixel beside mine stood TERRAIN_SIZE off, and no find was said from beside it (mutant: the find\'s door raw)', () => {
  const { door } = worldSeams(TR, [hollowEntry('6,5', at(4, NATIVE_Y, 500))]);
  assert.deepEqual(door('6,5'), [TERRAIN_SIZE + 4, GROUND + 1.25, 500]);
  assert.equal(door('5,5'), null, 'no entrance there: none');
});
