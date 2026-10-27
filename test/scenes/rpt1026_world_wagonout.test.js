// RPT1026-WORLD WAGON-OUT (a private report, 2026-10-20: a caravan summoned in or right by a building, entered and left -
// the player set down inside the house, and only /unstuck got them out): THE CARAVAN'S DOOR NEVER LETS THE PLAYER OUT
// INTO A WALL. The real door (scenes/caravanRoom.js createCaravanAccess: the room entered from the parked caravan, and
// returnToWagon - the landing behind its rear door) over the real collider (player/collider.js), its ground the world
// host's own (`caravanStepOut`, which world.js hands it), the caravan's door where the wagon's model puts it
// (world/wagonModels.js doorFor, turned and carried as scenes/horseCartPool.js caravanDoorAt carries it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';
import { heldInSolid } from '../../src/player/enterExit.js';
import { createCaravanAccess, caravanStepOut } from '../../src/scenes/caravanRoom.js';
import { doorFor } from '../../src/world/wagonModels.js';
import { quatRotate } from '../../src/world/quat.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A building's closed shell [x0..x1] x [y0..y1] x [z0..z1] - its walls, floor and roof, twelve triangles. */
function house(col, key, [x0, y0, z0], [x1, y1, z1]) {
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const i = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  col.addMesh(key, p, i, I);
}
/** My caravan parked at `position`, its heading `rotation`: its door as the cart's pool says it (caravanDoorAt). */
function parkedAt(position, rotation) {
  const door = doorFor('caravan');
  const off = quatRotate(rotation, door.step), out = quatRotate(rotation, [0, 0, -1]);
  return { position, rotation, step: [position[0] + off[0], position[1] + off[1], position[2] + off[2]], yaw: Math.atan2(out[0], out[2]) };
}
/** Into the caravan and back out: where its door stands me. */
async function inAndOut(col, at) {
  let room = null;
  const access = createCaravanAccess({
    available: () => true, mode: () => 'exterior', busy: () => false, say() {}, ownsCaravan: () => true, parked: () => at,
    toNative: (p) => p, fromNative: (p) => p, ground: (p) => caravanStepOut(col, p),
    enterInterior: async (r) => { room = r; return true; },
  });
  assert.equal(await access.enter(), true);
  return access.returnToWagon(room).position;
}

test('WAGON-OUT: a caravan parked with its rear door against a house - out of it, the player stands on the open ground beside the house, never in it; with its back to the open street, behind its door as before (mutant: the landing unasked - the body stood in the house)', async () => {
  const col = new Collider(() => 0);
  const at = parkedAt([0, 0.3, 0], [0, 0, 0, 1]);   // heading +z: the door behind it, toward -z
  const step = at.step;
  assert.ok(step[2] < -1, `the door's step behind the caravan (${step[2].toFixed(2)})`);
  house(col, 'house', [-6, 0, step[2] - 6], [6, 7, step[2] + 0.5]);   // the house the caravan backed up to: its wall past the step
  const out = await inAndOut(col, at);
  assert.equal(heldInSolid(col, out), false, `out of the house: ${out.map((v) => v.toFixed(2))}`);
  assert.ok(Math.hypot(out[0] - step[0], out[2] - step[2]) <= 32, 'on the nearest open ring');
  assert.equal(heldInSolid(col, [step[0], 0.15, step[2]]), true, 'where the door stood it, the house holds the body');
  const open = new Collider(() => 0);
  house(open, 'house', [-6, 0, 20], [6, 7, 30]);   // a house across the street
  const free = await inAndOut(open, at);
  assert.deepEqual(free.map((v) => +v.toFixed(6)), [+step[0].toFixed(6), 0.15, +step[2].toFixed(6)], 'the ground behind its door, the landing law\'s own height');
});

test('WAGON-OUT the law and its wiring: a held landing with no open ground anywhere keeps its spot; the sea\'s floor is no ground when the host says so; world.js hands the caravan\'s door caravanStepOut on the street\'s collider, above the sea', () => {
  const vast = new Collider(() => 0);
  house(vast, 'massif', [-600, 0, -600], [600, 50, 600]);
  assert.deepEqual(caravanStepOut(vast, [0, 0, 0]), [0, 0.15, 0], 'nowhere open: where it was');
  const shore = new Collider((x) => x - 40);   // the ground falls into the sea to the west
  house(shore, 'house', [-10, -60, -10], [10, 10, 10]);
  const dry = caravanStepOut(shore, [0, 0, 0], () => 0);
  assert.ok(dry[0] >= 40 && heldInSolid(shore, dry) === false, `on dry ground: ${dry}`);
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes("ground: (p) => caravanStepOut(collider, p, tvSeaY),"), 'the world host\'s door');
});
