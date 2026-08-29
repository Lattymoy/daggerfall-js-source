// DE1 - ENTERING A DUNGEON PUT THE PLAYER ACROSS IT (2026-08-29).
//
// Mac: "when entering a dungeon, it places you at the end of the
// dungeon instead of the entrance."
//
// THERE ARE TWO DFU MEMBERS HERE AND THEY DO NOT AGREE:
//
//   TransitionDungeonInterior (PlayerEnterExit.cs:895-963) - WALKING
//   IN through the entrance, which is how a player actually gets into
//   a dungeon (PlayerActivate.cs:645). It uses dungeon.StartMarker
//   UNCONDITIONALLY, never consults the enter marker, and where the
//   start marker is missing it ABORTS the transition (:923-929)
//   rather than placing the player somewhere invented. It then faces
//   the player along the normal of the nearest dungeon exit door.
//
//   StartDungeonInterior (:968-1016) - starting INSIDE a dungeon with
//   no exterior: a new game, a load, a respawn, a quest teleport. The
//   ENTER marker wins, StartMarker is the fallback, and the facing is
//   plain north (SetFacing(Vector3.forward)).
//
// The port had ONE `enterMarker ?? startMarker` serving both. So the
// walk-in took the enter marker - a different point, and in a large
// starting block a long way from the door the player just opened.
//
// The sentence that stood over it explained the enter-marker
// preference as a fix for a wedging bug in Privateer's Hold, and it
// WAS one - for the standalone host, which is the StartDungeonInterior
// case and is right to prefer it. Applying that host's answer to the
// other member is what put the player across the dungeon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closestDoorTo } from '../src/player/enterExit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

/** dungeonContext's startSpawn law, over a marker pair, with the floor
 *  landing and the collider stubbed out - the branch is what is
 *  pinned, not the snap. */
const chooseMarker = ({ enterMarker, startMarker }, preferEnterMarker = true) =>
  (preferEnterMarker ? (enterMarker ?? startMarker) : startMarker);

test('DE1: the WALK-IN takes the start marker, and never the enter marker', () => {
  const both = { enterMarker: { x: 900, y: 0, z: 900 }, startMarker: { x: 10, y: 0, z: 10 } };
  assert.deepEqual(chooseMarker(both, false), both.startMarker,
    'TransitionDungeonInterior uses dungeon.StartMarker unconditionally');
  // THE BUG, stated as the thing that must not come back: with both
  // markers present the walk-in must not drift to the enter one.
  assert.notDeepEqual(chooseMarker(both, false), both.enterMarker);
});

test('DE1: a walk-in with NO start marker refuses - it does not fall back', () => {
  // :923-929 destroys the dungeon and raises OnFailedTransition. A
  // fallback here is exactly how the player ends up somewhere they
  // did not walk to.
  const enterOnly = { enterMarker: { x: 900, y: 0, z: 900 }, startMarker: null };
  assert.equal(chooseMarker(enterOnly, false), null, 'no start marker, no transition');
});

test('DE1: starting INSIDE prefers the enter marker, and falls back to start', () => {
  const both = { enterMarker: { x: 900, y: 0, z: 900 }, startMarker: { x: 10, y: 0, z: 10 } };
  assert.deepEqual(chooseMarker(both, true), both.enterMarker, 'StartDungeonInterior prefers it');
  const startOnly = { enterMarker: null, startMarker: { x: 10, y: 0, z: 10 } };
  assert.deepEqual(chooseMarker(startOnly, true), startOnly.startMarker, 'and StartMarker is the fallback');
});

test('DE1: the ctx implements exactly that, and defaults to the START-INSIDE member', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /startSpawn\(\{ preferEnterMarker = true \} = \{\}\) \{/,
    'the default is preferEnterMarker true, which is StartDungeonInterior\'s own default');
  assert.match(dc, /const m = preferEnterMarker \? \(this\.enterMarker \?\? this\.startMarker\) : this\.startMarker;/);
  assert.match(dc, /if \(!m\) return null;/, 'a missing marker refuses rather than inventing a point');
  // the old one-law-for-both is gone
  assert.equal(/const m = this\.enterMarker \?\? this\.startMarker;/.test(dc), false);
  assert.equal(/if \(!m\) return \[0, 2, 0\];/.test(dc), false, 'and the invented origin is gone with it');
});

test('DE1: the orientation is the same two members - the door normal, or north', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /entryFacingYaw\(feet, \{ preferEnterMarker = true \} = \{\}\) \{/);
  assert.match(dc, /if \(preferEnterMarker\) return 0;\s*\/\/ SetFacing\(Vector3\.forward\)/,
    'StartDungeonInterior faces north');
  assert.match(dc, /const near = feet \? closestDoorTo\(feet, exitDoors\) : null;/);
  assert.match(dc, /return Math\.atan2\(near\.normal\[0\], near\.normal\[2\]\);/,
    'the transition faces the nearest exit door\'s normal, which points into the dungeon');
  assert.match(dc, /if \(!near\) return null;/, 'no door to read means the caller keeps its bearing');
});

test('DE1: closestDoorTo is FindClosestDoorToPlayer - nearest world centre wins', () => {
  const door = (x, z, nx, nz) => ({
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    centre: { x, y: 0, z }, normal: { x: nx, y: 0, z: nz },
  });
  const doors = [door(100, 0, 1, 0), door(3, 0, 0, 1), door(50, 0, -1, 0)];
  const near = closestDoorTo([0, 0, 0], doors);
  assert.equal(near.index, 1, 'the nearest, not the first');
  assert.deepEqual(near.normal, [0, 0, 1]);
  // DISTANCE IS 3D, as Vector3.Distance is - and the fixture has to be
  // one where height changes the answer, or a ground-plane measure
  // passes it. Standing high above door A: on the floor plane A is
  // nearest (10 < 30), in three dimensions B is (30 < 200.2).
  const stacked = [door(10, 0, 1, 0), { ...door(30, 0, 0, 1), centre: { x: 30, y: 200, z: 0 } }];
  assert.equal(closestDoorTo([0, 200, 0], stacked).index, 1,
    'height counts toward the distance - a door on your own level beats one far below');
  assert.equal(closestDoorTo([0, 0, 0], stacked).index, 0, 'and on the ground the near one wins again');
  // and an empty array is a miss, not a throw (DFU returns false)
  assert.equal(closestDoorTo([0, 0, 0], []), null);
  assert.equal(closestDoorTo([0, 0, 0], null), null);
});

test('DE2: every dungeon facing LEVELS THE PITCH, as all three DFU calls do', () => {
  // DE1 shipped the yaw half and left the pitch. SetFacing(Vector3) is
  // `LookRotation(forward).eulerAngles` fed to SetFacing(yaw, pitch)
  // (PlayerMouseLook.cs:286-291), and every vector the dungeon members
  // pass is HORIZONTAL - Vector3.forward, a door normal - so the pitch
  // it computes is 0. The exit says it outright: SetHorizontalFacing
  // is SetFacing(yaw, 0f) (:294-299). Walk in looking at the sky and
  // DFU levels you; the port left you craning.
  const modes = read('src/scenes/worldModes.js');
  // the ENTRY - inside the same guard as the yaw, because
  // TransitionDungeonInterior only faces when it found a door
  assert.match(modes, /if \(_yaw !== null\) \{\n\s*cam\.yaw = _yaw;[\s\S]{0,900}?cam\.pitch = 0;\n\s*\}/,
    'the entry levels the pitch, and only when it faces at all');
  // the EXIT landing
  assert.match(modes, /cam\.yaw = Math\.atan2\(landing\.normal\[0\], landing\.normal\[2\]\);[\s\S]{0,700}?cam\.pitch = 0;/,
    'the exit levels the pitch');
  // exactly two transition sites level it - a third would mean some
  // other path started snapping the view without a DFU member behind it
  assert.equal((modes.match(/cam\.pitch = 0;/g) ?? []).length, 2);
  // and BUILDINGS still do not face at all: neither TransitionInterior
  // nor BuildingTransitionExteriorLogic touches PlayerMouseLook, so a
  // shop door leaves the player's bearing alone
  const at = modes.indexOf('const landing = interiorLanding(');
  assert.equal(/cam\.(yaw|pitch) = /.test(modes.slice(at, at + 900)), false,
    'a building door must not snap the view - DFU never faces on either building transition');
});

test('DE2: the standalone host is already level by construction', () => {
  // StartDungeonInterior faces Vector3.forward, which is yaw 0 pitch 0.
  // scenes/dungeon.js builds its camera that way, so it needs no arm -
  // and a pin here stops someone "fixing" it into one.
  assert.match(read('src/scenes/dungeon.js'), /const cam = \{ pos: spawn, yaw: 0, pitch: 0 \};/);
});

test('DE1: each host call site takes the member it actually is', () => {
  const modes = read('src/scenes/worldModes.js');
  // the walk-in default is the transition - the common way in
  assert.match(modes, /async function tryEnterDungeon\(hit, entries, \{ preferEnterMarker = false \} = \{\}\)/,
    'the DEFAULT is the door transition, because that is how a player gets in');
  assert.match(modes, /const spawn = ctx\.startSpawn\(\{ preferEnterMarker \}\);/);
  assert.match(modes, /if \(!spawn\) \{ console\.error\('\[dungeon\] no start marker; transition aborted'\); return false; \}/,
    'the refusal is carried through: the player stays outside at the door');
  // DE2 re-anchored this: the one-liner became a block when the pitch
  // half landed, and the law it holds - the host asks for the facing
  // of the member it IS, and applies it - did not change.
  assert.match(modes, /const _yaw = ctx\.entryFacingYaw\(spawn, \{ preferEnterMarker \}\);\n\s*if \(_yaw !== null\) \{/);
  // a new game is the OTHER member
  assert.match(modes, /return tryEnterDungeon\(hit, entries, \{ preferEnterMarker: true \}\);/);
  // and the standalone host is StartDungeonInterior by definition
  assert.match(read('src/scenes/dungeon.js'), /ctx\.startSpawn\(\) \?\? \[0, 2, 0\]/,
    'it keeps the default, and carries its own floor for the refusal');
});
