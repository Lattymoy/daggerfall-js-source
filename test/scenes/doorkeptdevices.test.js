// AUDIT FB1029f A3 (= C1; FIELD BUGS 2026-10-29f DOOR-KEPT): AN ONLINE HOME'S DOORS ARE THE SERVICE'S, ON EVERY DEVICE. A
// door put back on one device stayed out on another: that device stood the doors its save's scene record held, the
// service's list could only hide doors, and its next furniture write put the door out again for every visitor. The
// list now sets the doors exactly (each named one out, every other back), and the host keeps the save's own record
// unapplied (worldModes.js restoreInteriorScene). On the real base room, interior doors, action system and setBase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBaseRoom, baseBucketOf, standRoomHidden } from '../../src/scenes/decor/decorBase.js';
import { createInteriorDoors } from '../../src/systems/decor/decorInteriorDoors.js';
import { ActionSystem } from '../../src/world/actionSystem.js';
import { toolRig } from '../decorFakes.mjs';

function room() {
  const drawList = [], batches = [], lights = [], buckets = new Map();
  const collider = { addMesh: (k, pos, idx, m) => buckets.set(k, [pos, idx, m]), removeBucket: (k) => buckets.delete(k) };
  const base = createBaseRoom({ drawList, batches: () => batches, lights: () => lights, collider });
  const cpu0 = { positions: new Float32Array(9), indices: new Uint16Array([0, 1, 2]) };
  const draw = { mesh: 41100, key: 'int:m0:41100' };
  drawList.push(draw);
  collider.addMesh(baseBucketOf('m0:41100'), cpu0.positions, cpu0.indices, 'M');
  base.addModel('m0:41100', { model: 41100, draw, cpu: cpu0, matrix: 'M', at: [1, 0, 1] });
  const actions = new ActionSystem({ addMesh() {}, removeBucket() {} });
  const draws = [];
  const doors = createInteriorDoors({ draws, addDoor: (c, m) => actions.addDoor(c, m), removeDoor: (key) => actions.removeDoor(key) });
  const cpu = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) };
  const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1;
  for (const i of [0, 1]) { draws.push({ gpu: {}, object: actions.addDoor(cpu, m) }); doors.adopt(i, cpu, draws[draws.length - 1]); }
  base.roomDoors = doors;
  return { base, doors };
}

test('AUDIT FB1029f A3: a door put back on one device is back on the other, and that device\'s next write keeps it back (mutant: AUDITFB1029F-A3-doors-only-hidden)', async () => {
  let service = ['intdoor:1'];
  const homeDecor = { hidden: async (b) => { service = b.keys; return { ok: true }; } };
  const R = { kind: 'home', where: 'Your home', mapId: 5, buildingKey: 6 };
  const A = room();
  standRoomHidden(A.base, service);
  assert.deepEqual(A.doors.hidden(), ['intdoor:1'], 'device A: the door out, as the service says');
  const B = room();
  standRoomHidden(B.base, service);
  assert.equal(await toolRig({ room: R, homeDecor, base: B.base }).tool.setBase(['intdoor:1'], false), true);
  assert.deepEqual(service, [], 'device B put it back');
  standRoomHidden(A.base, service);   // A reads the room's list again
  assert.deepEqual(A.doors.hidden(), [], 'device A: back');
  assert.equal(await toolRig({ room: R, homeDecor, base: A.base }).tool.setBase(['m0:41100'], true), true);
  assert.deepEqual(service, ['m0:41100'], 'A\'s next write names no door');
});

test('AUDIT FB1029f A3 by source: an online home\'s save record is kept whole and never stood - its doors come from the service; an offline house stands its own (mutant: AUDITFB1029F-A3-save-doors-applied)', () => {
  const m = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(m, /if \(interiorHome \|\| _seatHallVisit\) _keptHidden = data\.hiddenBase \?\? \[\]; else \(interiorCtx\.base\?\.setHidden\(data\.hiddenBase \?\? \[\]\), interiorCtx\.base\?\.roomDoors\?\.apply\?\.\(data\.hiddenBase\)\);/);
});
