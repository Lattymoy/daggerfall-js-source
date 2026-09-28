// DECOR-ROOMS (2026-09-27, Discord: "For a house with multiple connects, add room switching tabs").
//
// THE ROOMS OF A HOUSE, found in its own collider (systems/decorRooms.js): floors a body stands on - headroom over
// them and a ceiling above - joined to their neighbours where the rise is a step and nothing stands between them at
// waist height. A doorway joins; a shut door, a wall or a storey between parts them. Driven over the real collider
// (player/collider.js) built of quads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../src/player/collider.js';
import { createDecorRooms, DECOR_ROOM_EYE, DECOR_ROOM_MIN_CELLS } from '../src/systems/decorRooms.js';
import { toolRig, settle, all } from './decorFakes.mjs';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A quad as the collider takes a mesh - four corners, two triangles. */
function addQuad(c, key, a, b, cc, d) {
  c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
}
/** A closed box, its own bucket. */
function addBox(c, key, [x0, y0, z0, x1, y1, z1]) {
  const p = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const i = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  c.addMesh(key, p, i, IDENTITY);
}
/** Two halves of a house, 20 by 10 and 3 high, a wall at x = 10 with a doorway (z 4 to 6, 2.2 high) - and, `shut`, a
 *  door standing in it; `upstairs`, a second storey over it, 3 more high. */
function house({ shut = false, upstairs = false, table = false } = {}) {
  const c = new Collider();
  const storey = (y0, y1, k) => {
    addQuad(c, `floor${k}`, [0, y0, 0], [20, y0, 0], [20, y0, 10], [0, y0, 10]);
    addQuad(c, `walls${k}`, [0, y0, 0], [0, y1, 0], [0, y1, 10], [0, y0, 10]);
    addQuad(c, `walls${k}b`, [20, y0, 0], [20, y1, 0], [20, y1, 10], [20, y0, 10]);
    addQuad(c, `walls${k}c`, [0, y0, 0], [20, y0, 0], [20, y1, 0], [0, y1, 0]);
    addQuad(c, `walls${k}d`, [0, y0, 10], [20, y0, 10], [20, y1, 10], [0, y1, 10]);
    addQuad(c, `inner${k}a`, [10, y0, 0], [10, y1, 0], [10, y1, 4], [10, y0, 4]);
    addQuad(c, `inner${k}b`, [10, y0, 6], [10, y1, 6], [10, y1, 10], [10, y0, 10]);
    addQuad(c, `lintel${k}`, [10, y0 + 2.2, 4], [10, y1, 4], [10, y1, 6], [10, y0 + 2.2, 6]);
    addQuad(c, `ceiling${k}`, [0, y1, 0], [20, y1, 0], [20, y1, 10], [0, y1, 10]);
  };
  storey(0, 3, 0);
  if (upstairs) storey(3, 6, 1);
  if (shut) addQuad(c, 'door', [10, 0, 4], [10, 2.2, 4], [10, 2.2, 6], [10, 0, 6]);
  if (table) addBox(c, 'table', [3, 0, 3, 4.5, 0.8, 4]);
  const box = { min: [0, 0, 0], max: [20, upstairs ? 6 : 3, 10] };
  return { finder: createDecorRooms({ raycastHit: (o, d, m) => c.raycastHit(o, d, m), box }), c };
}
const run = (finder) => { let steps = 0; while (!finder.step(50)) { steps++; assert.ok(steps < 10_000, 'it finishes'); } return steps; };

test('DECOR-ROOMS a doorway joins the two halves into one room; a shut door parts them into two, lowest and largest first, each flown from over its own floor (mutants: the waist ray skipped; the join over a wall)', () => {
  const open = house();
  run(open.finder);
  assert.equal(open.finder.rooms().length, 1, 'one room through the doorway');
  const shut = house({ shut: true });
  const steps = run(shut.finder);
  assert.ok(steps > 5, 'stepped, a few rays at a time');
  const rooms = shut.finder.rooms();
  assert.deepEqual(rooms.map((r) => r.name), ['Room 1', 'Room 2']);
  assert.ok(rooms.every((r) => r.cells >= DECOR_ROOM_MIN_CELLS));
  const sides = rooms.map((r) => r.eye[0] < 10);
  assert.deepEqual(sides.sort(), [false, true], 'one each side of the door');
  for (const r of rooms) assert.ok(Math.abs(r.eye[1] - DECOR_ROOM_EYE) < 1e-6, 'the eye over the floor');
  assert.equal(shut.finder.roomOf([3, 1, 5]).eye[0] < 10, true, 'a point in the west half is the west room\'s');
  assert.equal(shut.finder.roomOf([17, 1, 5]).eye[0] > 10, true);
  assert.equal(shut.finder.roomOf([50, 1, 5]), null, 'outside the house: none');
});

test('DECOR-ROOMS a storey is its own room, and a table top is no room - nor is the roof (mutants: the ceiling test; the headroom test; the least size)', () => {
  const two = house({ upstairs: true });
  run(two.finder);
  const rooms = two.finder.rooms();
  assert.equal(rooms.length, 2, 'ground and upstairs');
  assert.ok(rooms[0].floor < 0.01 && Math.abs(rooms[1].floor - 3) < 0.01, 'the lower floor first');
  assert.equal(two.finder.roomOf([5, 4, 5]).floor, rooms[1].floor, 'a point upstairs stands upstairs');
  assert.equal(two.finder.roomOf([5, 1, 5]).floor, rooms[0].floor);
  const tabled = house({ table: true });
  run(tabled.finder);
  assert.equal(tabled.finder.rooms().length, 1, 'the table top is no room of its own');
  assert.equal(tabled.finder.rooms()[0].cells, 199, 'and the floor under it, with no headroom, is none of the room\'s: 200 samples, less the one under the table');
  assert.equal(tabled.finder.roomOf([3.5, 1, 3.5])?.name, 'Room 1', 'a thing on the table is in the room');
});

test('DECOR-ROOMS no box, no rooms; a collider that throws finds none rather than breaking the panel', () => {
  const none = createDecorRooms({ raycastHit: () => null, box: null });
  assert.equal(none.step(), true);
  assert.deepEqual(none.rooms(), []);
  const bad = createDecorRooms({ raycastHit: () => { throw new Error('bad'); }, box: { min: [0, 0, 0], max: [4, 3, 4] } });
  while (!bad.step()) { /* stepping */ }
  assert.deepEqual(bad.rooms(), []);
});

// ── the decorator: the tabs, the lists, where a flight begins ─────────


/** The rig's building (origin 10, 0, 10; the eye at 10, 1.6, 10): a house x 4 to 24, z 5 to 15, 3 high, a shut door
 *  in the wall at x = 14 - the eye in its west room. */
function rigHouse() {
  const c = new Collider();
  addQuad(c, 'floor', [4, 0, 5], [24, 0, 5], [24, 0, 15], [4, 0, 15]);
  addQuad(c, 'ceiling', [4, 3, 5], [24, 3, 5], [24, 3, 15], [4, 3, 15]);
  addQuad(c, 'w1', [4, 0, 5], [4, 3, 5], [4, 3, 15], [4, 0, 15]);
  addQuad(c, 'w2', [24, 0, 5], [24, 3, 5], [24, 3, 15], [24, 0, 15]);
  addQuad(c, 'w3', [4, 0, 5], [24, 0, 5], [24, 3, 5], [4, 3, 5]);
  addQuad(c, 'w4', [4, 0, 15], [24, 0, 15], [24, 3, 15], [4, 3, 15]);
  addQuad(c, 'inner1', [14, 0, 5], [14, 3, 5], [14, 3, 9], [14, 0, 9]);
  addQuad(c, 'inner2', [14, 0, 11], [14, 3, 11], [14, 3, 15], [14, 0, 15]);
  addQuad(c, 'lintel', [14, 2.2, 9], [14, 3, 9], [14, 3, 11], [14, 2.2, 11]);
  addQuad(c, 'door', [14, 0, 9], [14, 2.2, 9], [14, 2.2, 11], [14, 0, 11]);
  return c;
}
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');

test('DECOR-ROOMS the decorator: a house of two rooms gets a tab each, the eye\'s own pressed; its lists are the chosen room\'s; a room chosen, the next flight begins over its floor, and a piece moved flies from its own room (mutants: the tabs never drawn; the flight from the eye whatever is chosen; the lists unfiltered)', async () => {
  const collider = rigHouse();
  const rig = toolRig({ collider, gold: 50_000 });
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 12; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = panelOf(rig);
  let tabs = all(root, 'dfdecor-room');
  assert.deepEqual(tabs.map((t) => t.textContent), ['Room 1 (0)', 'Room 2 (0)'], 'a tab a room');
  const pressed = () => all(panelOf(rig), 'dfdecor-room').find((t) => t.attrs['aria-pressed'] === 'true');
  const west = pressed();
  assert.ok(west, 'the room the eye stands in is chosen');
  // choose the other room, and place from it
  const east = tabs.find((t) => t !== west);
  east.fire('click');
  rig.frame({ overlayUp: true });
  assert.equal(pressed().dataset.room, east.dataset.room, 'the choice pressed');
  all(root, 'dfdecor-row').find((r) => r.dataset.key === 'f209.0').fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  const cam = { pos: [0, 0, 0] };
  rig.tool.cameraOverride(cam);
  assert.ok(cam.pos[0] > 14, `the flight begins in the east room (${cam.pos.map((v) => v.toFixed(2))})`);
  rig.frame(); await settle(); rig.frame();
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  for (let i = 0; i < 2; i++) { rig.frame({ overlayUp: true }); await settle(); }
  tabs = all(panelOf(rig), 'dfdecor-room');
  assert.equal(tabs.find((t) => t.dataset.room === east.dataset.room).textContent, `Room ${east.dataset.room} (1)`, 'the piece is counted in its room');
  assert.equal(tabs.find((t) => t.dataset.room === west.dataset.room).textContent, `Room ${west.dataset.room} (0)`);
  // the room's list: back in the west room, "In this room" does not list the east room's piece
  west.fire('click');
  rig.frame({ overlayUp: true });
  const roomTab = all(panelOf(rig), 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent));
  assert.equal(roomTab.textContent, 'In this room (0)', 'the west room holds none');
  // a piece moved flies from its own room, whichever is chosen
  const piece = rig.standing.at(-1);
  roomTab.fire('click');
  east.fire('click'); rig.frame({ overlayUp: true });
  all(panelOf(rig), 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent)).fire('click');
  all(panelOf(rig), 'dfdecor-row').find((r) => r.dataset.key === piece.id).fire('click');
  all(panelOf(rig), 'dfdecor-btn').find((b) => b.textContent === 'Move').fire('click');
  const cam2 = { pos: [0, 0, 0] };
  rig.tool.cameraOverride(cam2);
  assert.ok(cam2.pos[0] > 14, 'moving the east room\'s piece flies from the east room');
});

test('DECOR-ROOMS one room is no choice: no tabs, and the flight begins at the eye as ever (mutant: tabs for one room)', async () => {
  const c = rigHouse();
  c.removeBucket('door');
  c.removeBucket('inner1'); c.removeBucket('inner2'); c.removeBucket('lintel');
  const rig = toolRig({ collider: c, gold: 50_000 });
  rig.frame();
  rig.tool.openPanel();
  for (let i = 0; i < 12; i++) { rig.frame({ overlayUp: true }); await settle(); }
  assert.equal(all(panelOf(rig), 'dfdecor-room').length, 0);
  all(panelOf(rig), 'dfdecor-row').find((r) => r.dataset.key === 'f209.0').fire('click');
  all(panelOf(rig), 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  const cam = { pos: [0, 0, 0] };
  rig.tool.cameraOverride(cam);
  assert.deepEqual(cam.pos, [10, 1.6, 10], 'at the eye');
});
