// HOME-DOORS (2026-09-30, asked: "For houses with multiple rooms attached, I want to add a door item that can attach to
// the wall that leads to another room. This needs to have an easy element where it tells you where you can place it").
//
// A DOOR HUNG IN A DOORWAY. The doorway finder over the real collider built of boxes (systems/decor/decorDoorways.js): an
// opening in a wall is a doorway - its middle between the jambs, in the wall's thickness, its floor, its lintel, the way
// through; a passage is none, nor a gap between two pieces of furniture, nor an opening a shut door stands in. The door
// fitted into it (turned into the wall, sized to the opening, stood on its floor, swung the other way). The catalogue's
// doors (the town blocks' own door records), the room's pool handing a door to the host's action doors, the action
// system taking one back out, and the decorator: every free doorway marked, the door fitted into the one looked at, the
// bar saying where it goes, the rooms found again once it is in. `06-Systems/Online-Arc.md` HOME-DOORS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../../src/player/collider.js';
import { createDecorRooms } from '../../../src/systems/decor/decorRooms.js';
import {
  createDecorDoorways, decorDoorFit, decorDoorwaysFree, decorDoorwayAimed, decorDoorwayQuad, isDoorModel, decorIsDoor,
  DOORWAY_WIDTH_MAX, DOORWAY_NEAR_DOOR, DOORWAY_MARK_HIGH,
} from '../../../src/systems/decor/decorDoorways.js';
import { collectDecor, decorCatalogue, modelKind, DECOR_KINDS } from '../../../src/systems/decor/decorCatalogue.js';
import { DOOR_MODEL_BASE_ID, DOOR_MODEL_COUNT } from '../../../src/world/interior/interiorLayout.js';
import { createDecorRoom, decorKeyOf } from '../../../src/scenes/decor/decorRoom.js';
import { ActionSystem } from '../../../src/world/actionSystem.js';
import { DECOR_DOOR_FINDING, DECOR_DOOR_NONE, decorDoorAimLine, DECOR_DOOR_MARK_AIMED, DECOR_DOOR_MARK_FREE, decorDoorMarkPixels } from '../../../src/scenes/decor/decorTool.js';
import { DECOR_SCALE_MAX } from '../../../src/net/decorLaw.js';
import { toolRig, placeFrom, rmb, settle, near, all } from '../../decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A closed box, in `key`'s bucket. */
function box(c, key, [x0, y0, z0, x1, y1, z1]) {
  const p = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const i = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 5, 4, 0, 1, 5, 3, 6, 2, 3, 7, 6, 0, 7, 3, 0, 4, 7, 1, 6, 5, 1, 2, 6]);
  c.addMesh(key, p, i, IDENTITY);
}
/**
 * A house of thick walls (20 cm), its shell in the 'interior' bucket: x 0 to 20, z 0 to 10, 3 high. `inner`: a wall at x
 * 10 with a doorway z 4.5 to 5.5 under a lintel 2.1 high. `corridor`: instead, two rooms joined by a passage x 8 to 12, z
 * 4.5 to 5.5, its mouths the only openings. `gap`: two cupboards (the room's own furniture, their own buckets) standing
 * a metre apart in the west room. `shut`: a door standing in the doorway. `post`: instead of the inner wall, a stub of
 * it (z 0 to 4.5) and a post of the shell a metre past its end (z 5.5 to 5.7) - two jambs, but no wall going on past
 * the post.
 */
function house({ inner = true, corridor = false, gap = false, shut = false, post = false } = {}) {
  const c = new Collider();
  const T = 0.2;
  box(c, 'interior', [0, -T, 0, 20, 0, 10]);            // floor
  box(c, 'interior', [0, 3, 0, 20, 3 + T, 10]);         // ceiling
  box(c, 'interior', [-T, 0, 0, 0, 3, 10]);
  box(c, 'interior', [20, 0, 0, 20 + T, 3, 10]);
  box(c, 'interior', [0, 0, -T, 20, 3, 0]);
  box(c, 'interior', [0, 0, 10, 20, 3, 10 + T]);
  if (corridor) {
    for (const x of [8 - T, 12]) {                      // the rooms' walls, each with the passage's mouth
      box(c, 'interior', [x, 0, 0, x + T, 3, 4.5]);
      box(c, 'interior', [x, 0, 5.5, x + T, 3, 10]);
      box(c, 'interior', [x, 2.1, 4.5, x + T, 3, 5.5]);
    }
    box(c, 'interior', [8, 0, 4.5 - T, 12, 3, 4.5]);    // the passage's own walls
    box(c, 'interior', [8, 0, 5.5, 12, 3, 5.5 + T]);
    box(c, 'interior', [8, 2.1, 4.5, 12, 3, 5.5]);      // and its low ceiling
    box(c, 'interior', [8, 0, 0, 12, 3, 4.5 - T]);      // solid either side of it
    box(c, 'interior', [8, 0, 5.5 + T, 12, 3, 10]);
  } else if (inner) {
    box(c, 'interior', [10 - T / 2, 0, 0, 10 + T / 2, 3, 4.5]);
    box(c, 'interior', [10 - T / 2, 0, 5.5, 10 + T / 2, 3, 10]);
    box(c, 'interior', [10 - T / 2, 2.1, 4.5, 10 + T / 2, 3, 5.5]);
  }
  if (gap) { box(c, 'base:m1:41003', [3, 0, 2, 4, 2.2, 2.4]); box(c, 'base:m2:41003', [5, 0, 2, 6, 2.2, 2.4]); }
  if (shut) box(c, 'act:decor:shut', [10 - 0.03, 0, 4.5, 10 + 0.03, 2.1, 5.5]);
  if (post) { box(c, 'interior', [10 - T / 2, 0, 0, 10 + T / 2, 3, 4.5]); box(c, 'interior', [10 - T / 2, 0, 5.5, 10 + T / 2, 3, 5.7]); }
  return c;
}
const WALLS = { only: ['interior'] };
/** The rooms, then the doorways, found as the tool finds them - `filter` the walls' (null: every bucket). */
function doorwaysOf(c, filter = WALLS) {
  const rooms = createDecorRooms({ raycastHit: (o, d, m) => c.raycastHit(o, d, m), box: { min: [0, 0, 0], max: [20, 3, 10] } });
  let n = 0;
  while (!rooms.step(600)) assert.ok(++n < 1000);
  const dw = createDecorDoorways({ raycastHit: (o, d, m) => c.raycastHit(o, d, m, filter), links: rooms.links() });
  let steps = 0;
  while (!dw.step(400)) assert.ok(++steps < 10_000, 'it finishes');
  return { rooms, list: dw.doorways(), steps };
}

test('HOME-DOORS the finder: an opening in a thick wall is ONE doorway - its middle between the jambs and in the wall\'s thickness, its floor, its lintel, its width, the way through - found a few rays at a time, and the rooms either side are one room through it (mutants: the jamb halving; the thickness middle; the lintel)', () => {
  const { rooms, list, steps } = doorwaysOf(house());
  assert.equal(rooms.rooms().length, 1, 'an open doorway joins the halves (decorRooms)');
  assert.ok(steps >= 1);
  // a few rays at a time: a small budget finds none of it in one step, and each step keeps within about its budget
  const c = house();
  let cast = 0;
  const few = createDecorDoorways({ raycastHit: (o, d, m) => { cast++; return c.raycastHit(o, d, m, WALLS); }, links: rooms.links() });
  assert.equal(few.step(20), false, 'not done in one small step');
  assert.ok(cast < 20 + 60, `about its budget (${cast} rays)`);
  assert.equal(list.length, 1, 'one doorway, found once however many links cross it');
  const [w] = list;
  assert.equal(w.id, 1);
  assert.ok(near(w.center[0], 10, 0.02), `in the wall's thickness (${w.center[0]})`);
  assert.ok(near(w.center[2], 5, 0.02), `between the jambs (${w.center[2]})`);
  assert.ok(near(w.center[1], 0, 1e-6), 'on the floor');
  assert.ok(near(w.width, 1, 0.02), `a metre wide (${w.width})`);
  assert.ok(near(w.height, 2.1, 0.06), `under its lintel (${w.height})`);
  assert.deepEqual([...w.normal], [1, 0, 0], 'the way through');
});

test('HOME-DOORS the finder beside a corner and over a step: an opening whose jamb stands a hand from the room\'s corner is a doorway (the corner\'s wall, not a wall going on, stands past it), and one with a step in it measures to its lintel from its own floor (mutants: the corner unasked; the lintel from inside the step)', () => {
  const T = 0.2;
  const shell = (c) => {
    box(c, 'interior', [0, -T, 0, 20, 0, 10]); box(c, 'interior', [0, 3, 0, 20, 3 + T, 10]);
    box(c, 'interior', [-T, 0, 0, 0, 3, 10]); box(c, 'interior', [20, 0, 0, 20 + T, 3, 10]);
    box(c, 'interior', [0, 0, -T, 20, 3, 0]); box(c, 'interior', [0, 0, 10, 20, 3, 10 + T]);
  };
  const wallWith = (c, z0, z1) => {
    box(c, 'interior', [10 - T / 2, 0, 0, 10 + T / 2, 3, z0]);
    box(c, 'interior', [10 - T / 2, 0, z1, 10 + T / 2, 3, 10]);
    box(c, 'interior', [10 - T / 2, 2.1, z0, 10 + T / 2, 3, z1]);
  };
  const corner = new Collider(); shell(corner); wallWith(corner, 0.2, 1.2);
  const [c1] = doorwaysOf(corner).list;
  assert.ok(c1 && near(c1.center[2], 0.7, 0.02) && near(c1.width, 1, 0.02), `the corner's doorway (${JSON.stringify(c1?.center)})`);
  const step = new Collider(); shell(step); wallWith(step, 4.5, 5.5); box(step, 'interior', [10.03, 0, 0, 20, 0.3, 10]);
  const [s1] = doorwaysOf(step).list;
  assert.ok(s1 && near(s1.height, 2.1, 0.06), `to its lintel, over the step (${s1?.height})`);
});

test('HOME-DOORS no doorway where there is none: a passage\'s length is no doorway (its two mouths are), two cupboards a metre apart are none (the walls alone are read), a wall\'s end and a post a metre past it are none (the wall goes on past each jamb), an opening a shut door stands in is none, and a house with no inner wall has none (mutants: every bucket read; the wall-goes-on test; the open link test)', () => {
  const pass = doorwaysOf(house({ corridor: true })).list;
  assert.equal(pass.length, 2, 'the passage\'s two mouths');
  assert.deepEqual(pass.map((w) => Math.round(w.center[0] * 10) / 10).sort((a, b) => a - b), [7.9, 12.1], 'each in its room\'s wall, never along the passage');
  const gap = doorwaysOf(house({ inner: false, gap: true }));
  assert.equal(gap.list.length, 0, 'the walls alone: furniture makes no doorway');
  assert.equal(doorwaysOf(house({ inner: false, post: true })).list.length, 0, 'a wall\'s end and a post: no wall goes on past the post');
  assert.equal(doorwaysOf(house({ shut: true })).list.length, 0, 'a shut door: no link goes through, so no doorway');
  assert.equal(doorwaysOf(house({ inner: false })).list.length, 0, 'one room, no opening');
  const none = createDecorDoorways({ raycastHit: () => { throw new Error('no'); }, links: null });
  assert.equal(none.step(), true);
  assert.deepEqual(none.doorways(), [], 'no links, nothing found');
});

test('HOME-DOORS the fit: the door turned so its thickness runs through the doorway, sized to the tighter of the opening\'s width and height (within the piece law), its middle on the doorway\'s middle and its foot on the floor - either way its box lies; a flip hangs it from the other jamb (mutants: the turn; the width axis; the scale\'s tighter; the lift; the arch filled)', () => {
  const w = { center: [10, 0, 5], normal: [1, 0, 0], width: 1, height: 2.1 };
  const alongX = [0, 0, -0.05, 1, 2.1, 0.05];      // the hinge at x 0, a metre along x
  const f = decorDoorFit(w, alongX);
  assert.equal(f.yaw, 90, 'local z turned onto the way through');
  assert.ok(near(f.scale, (2.1 - 0.02) / 2.1), 'the height is the tighter here');
  // the box's middle at its foot lands on the doorway's middle: world = Ry * local (mat4 trs)
  const at = (yawDeg, s, [lx, ly, lz]) => { const r = (yawDeg * Math.PI) / 180; return [f.pos[0] + Math.cos(r) * lx * s + Math.sin(r) * lz * s, f.pos[1] + ly * s, f.pos[2] - Math.sin(r) * lx * s + Math.cos(r) * lz * s]; };
  const mid = at(f.yaw, f.scale, [0.5, 0, 0]);
  assert.ok(near(mid[0], 10) && near(mid[2], 5) && near(mid[1], 0), `centred and standing (${mid})`);
  const hinge = at(f.yaw, f.scale, [0, 0, 0]);
  assert.ok(near(hinge[2], 5 + f.scale / 2), 'hung from one jamb');
  const flipped = decorDoorFit(w, alongX, true);
  assert.equal(flipped.yaw, -90, 'half round');
  const r = (flipped.yaw * Math.PI) / 180;
  assert.ok(near(flipped.pos[2] + -Math.sin(r) * 0.5 * flipped.scale, 5), 'still centred');
  assert.ok(near(flipped.pos[2], 5 - flipped.scale / 2), 'from the other jamb');
  const alongZ = decorDoorFit({ ...w, width: 0.5 }, [-0.05, 0, 0, 0.05, 2.1, 1]);
  assert.equal(alongZ.yaw, 0, 'a door a metre along z is turned by its x');
  assert.ok(near(alongZ.scale, 0.5), 'the width is the tighter here');
  assert.ok(near(alongZ.pos[2] + 0.5 * alongZ.scale, 5));
  assert.equal(decorDoorFit({ ...w, width: 40, height: 40 }, alongX).scale, DECOR_SCALE_MAX, 'within the piece law');
  assert.equal(decorDoorFit(w, [0, 0, 0, 0, 0, 0]), null, 'no box, no door');
  assert.equal(decorDoorFit(null, alongX), null);
  // AUDIT: scaled whole, a door closes an opening near its own width - never an arch twice as wide
  assert.equal(f.fills, true, 'a metre door in a metre opening');
  assert.equal(decorDoorFit({ ...w, width: 1.15 }, alongX).fills, true, 'a hand to spare, closed');
  assert.equal(decorDoorFit({ ...w, width: 2 }, alongX).fills, false, 'half a metre open either side: no door for it');
});

test('HOME-DOORS which doorways are free and which one is looked at: a door standing near a doorway\'s middle takes it (a hinge or a middle, on its storey); the one looked at is the nearest the eye\'s line, ahead and in reach; a doorway\'s mark fills its opening to a door\'s height (mutants: the near test; the storey; behind the eye; the widest aim; the unseen aimed at)', () => {
  const a = { id: 1, center: [10, 0, 5], normal: [1, 0, 0], width: 1, height: 2.1 };
  const b = { id: 2, center: [10, 0, 8], normal: [1, 0, 0], width: 1, height: 2.1 };
  const up = { id: 3, center: [10, 3, 5], normal: [1, 0, 0], width: 1, height: 2.1 };
  assert.deepEqual(decorDoorwaysFree([a, b, up], [[10, 0, 5.5]]).map((w) => w.id), [2, 3], 'a hinge half a metre off the middle takes it, upstairs is another storey');
  assert.deepEqual(decorDoorwaysFree([a, b], [[10, 0, 5 - DOORWAY_NEAR_DOOR - 0.01]]).map((w) => w.id), [1, 2], 'a door further off takes none');
  assert.deepEqual(decorDoorwaysFree([a], null).map((w) => w.id), [1]);
  const eye = [5, 1.05, 5];
  assert.equal(decorDoorwayAimed([a, b], eye, [1, 0, 0], 12)?.id, 1, 'straight at it');
  const toB = [5, 0, 3];
  const n = Math.hypot(...toB);
  assert.equal(decorDoorwayAimed([a, b], eye, toB.map((v) => v / n), 12)?.id, 2);
  assert.equal(decorDoorwayAimed([a, b], eye, [-1, 0, 0], 12), null, 'never one behind');
  assert.equal(decorDoorwayAimed([a, b], eye, [1, 0, 0], 4), null, 'nor one out of reach');
  assert.equal(decorDoorwayAimed([a, b], eye, [0, 0, 1], 12), null, 'nor one far off the line');
  // AUDIT: one the eye cannot see (a wall, a ceiling between) is never the one looked at - the next nearest the line is
  const hidden = (mid) => !(mid[2] === 5);
  const beyond = { id: 4, center: [14, 0, 5.2], normal: [1, 0, 0], width: 1, height: 2.1 };
  assert.equal(decorDoorwayAimed([a, beyond], eye, [1, 0, 0], 12)?.id, 1, 'the nearer the line');
  assert.equal(decorDoorwayAimed([a, beyond], eye, [1, 0, 0], 12, hidden)?.id, 4, 'the one seen, though further off the line');
  assert.equal(decorDoorwayAimed([a], eye, [1, 0, 0], 12, hidden), null, 'looked straight at, through a wall: none');
  const q = decorDoorwayQuad({ ...a, height: 3 });
  assert.equal(q.size, DOORWAY_MARK_HIGH, 'a door\'s height, not an arch\'s');
  assert.ok(near(q.pos[1], DOORWAY_MARK_HIGH / 2) && near(q.stretch * q.size, 1), 'its opening\'s width');
  assert.deepEqual(q.right, [0, 0, 1], 'across the way through');
  assert.equal(DOORWAY_WIDTH_MAX, 2.4);
});

test('HOME-DOORS the catalogue\'s doors are Daggerfall\'s own - the five models AddActionDoors hangs, read from the town blocks\' door records, kind Doors, numbered; a piece is a door by its model and never one\'s own item (mutants: the door records unread; the modulo; the kind)', () => {
  assert.equal(DOOR_MODEL_BASE_ID, 9000);
  assert.equal(DOOR_MODEL_COUNT, 5);
  const cat = decorCatalogue(collectDecor([rmb([41000], [], [0, 1, 6]), rmb([], [], [1])]));
  const doors = cat.filter((e) => e.kind === 'door');
  assert.deepEqual(doors.map((e) => [e.model, e.count, e.name]), [[9001, 3, 'Door 2'], [9000, 1, 'Door 1']], 'index 6 is the second door (six mod five), most common first');
  assert.equal(DECOR_KINDS.door, 'Doors');
  assert.equal(modelKind(9004), 'door');
  assert.equal(modelKind(9005), 'furniture');
  assert.equal(isDoorModel(8999), false);
  assert.equal(decorIsDoor({ model: 9002 }), true);
  assert.equal(decorIsDoor({ model: 9002, item: { t: 1 } }), false, 'one\'s own furniture as a door\'s look is no door');
});

test('HOME-DOORS the room\'s pool hands a door piece to the host\'s action doors: no solid bucket of its own and no eye target of its own (the door is both), taken down with the piece, moved by a put again; with no host doors it stands as any model (mutants: the hand-off; the bucket; the target; the take-down)', async () => {
  const buckets = [];
  const added = [];
  const removed = [];
  const room = createDecorRoom({
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[9000, { positions: new Float32Array([0, 0, 0, 1, 2, 0.1]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {} }, collider: () => ({ addMesh: (k) => buckets.push(k), removeBucket: () => {} }), origin: () => [0, 0, 0],
    doors: { add: (piece, model, matrix) => { added.push([piece.id, model.gpu, matrix[12]]); return { key: `act:decor:${piece.id}` }; }, remove: (id) => removed.push(id) },
  });
  const piece = { id: 'door1', model: 9000, flat: null, pos: [2, 0, 3], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 150 };
  room.put(piece);
  await settle(); await settle();
  assert.deepEqual(added, [['door1', 9000, 2]], 'hung as the room\'s own door, at its place');
  assert.deepEqual(buckets, [], 'no solid bucket of its own');
  assert.deepEqual(room.targets(), [], 'the door answers the eye itself');
  assert.equal(room.draw({ drawMesh() { throw new Error('the host draws it'); } }), 0);
  room.put({ ...piece, pos: [4, 0, 3] });
  await settle(); await settle();
  assert.deepEqual(removed, ['door1'], 'moved: the old one down');
  assert.equal(added.at(-1)[2], 4, 'and hung at its new place');
  room.remove('door1');
  assert.deepEqual(removed, ['door1', 'door1'], 'removed: down');
  const plain = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels: new Map([[9000, { positions: new Float32Array([0, 0, 0, 1, 2, 0.1]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {} }, collider: () => ({ addMesh: (k) => buckets.push(k), removeBucket: () => {} }), origin: () => [0, 0, 0],
  });
  plain.put(piece);
  await settle(); await settle();
  assert.deepEqual(buckets, [decorKeyOf('door1')], 'no host doors: a model like any');
});

test('HOME-DOORS the action system takes a door back out - the object, its link and its bucket, open or shut - and nothing else (mutants: the bucket left; the link left; any object taken)', () => {
  const gone = [];
  const collider = { addMesh() {}, removeBucket: (k) => gone.push(k) };
  const actions = new ActionSystem(collider);
  const cpu = { positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) };
  const door = actions.addDoor(cpu, new Float32Array(IDENTITY), { ns: 'decor', positionKey: 'abc' });
  assert.equal(door.key, 'act:decor:abc', 'keyed by the piece: the same key on every client and visit');
  assert.equal(actions.removeDoor('act:decor:nope'), false);
  const shut = actions.addDoor(cpu, new Float32Array(IDENTITY), { ns: 'decor', positionKey: 'def' });
  actions.toggleDoor(door, true);
  gone.length = 0;   // opening it takes its bucket out already - what counts is what the take-down itself does
  assert.equal(actions.removeDoor('act:decor:abc'), true, 'open as it is');
  assert.equal(actions.objects.has('act:decor:abc'), false);
  assert.equal(actions._links.has('decor:abc'), false);
  assert.deepEqual(gone, ['act:decor:abc']);
  assert.equal(actions.objects.get(shut.key), shut, 'the other door is not taken');
  gone.length = 0;
  assert.equal(actions.removeDoor(shut.key), true, 'shut as it is');
  assert.deepEqual(gone, ['act:decor:def'], 'a shut door\'s bucket is what stands in the doorway');
  assert.equal(actions.objects.size, 0);
});

test('HOME-DOORS a placed door\'s state that comes before its door - a save\'s, the room\'s memory\'s, a peer\'s, read while its model is still fetched - is taken by the door when it is hung, and written with the scene\'s records meanwhile; only a placed door\'s key waits, a handful at most (mutants: the early record dropped; the save forgetting it; any key kept)', () => {
  const buckets = new Map();
  const collider = { addMesh: (k) => buckets.set(k, true), removeBucket: (k) => buckets.delete(k) };
  const actions = new ActionSystem(collider);
  const cpu = { positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) };
  actions.restoreSaveData([{ key: 'act:decor:d1', state: 'end', t: 1, lock: 7 }, { key: 'door:99', state: 'end', t: 1 }]);
  assert.deepEqual(actions.collectSaveData().map((r) => r.key), ['act:decor:d1'], 'kept, and saved while the door is not hung; a stranger\'s key is not');
  const d1 = actions.addDoor(cpu, new Float32Array(IDENTITY), { ns: 'decor', positionKey: 'd1' });
  assert.deepEqual([d1.state, d1.t, d1.currentLockValue], ['end', 1, 7], 'hung open and locked, as it was left');
  assert.equal(buckets.has('act:decor:d1'), false, 'open: nothing to walk into');
  assert.deepEqual(actions.collectSaveData().map((r) => r.key), ['act:decor:d1'], 'once: the door\'s own record now');
  // a peer's frame for a door this client has not hung yet
  assert.equal(actions.applyRemote([{ key: 'act:decor:d2', state: 'end', t: 1 }]), 0);
  const d2 = actions.addDoor(cpu, new Float32Array(IDENTITY), { ns: 'decor', positionKey: 'd2' });
  assert.equal(d2.state, 'end', 'the room\'s door as the others see it');
  for (let i = 0; i < 100; i++) actions.restoreSaveData([{ key: `act:decor:x${i}`, state: 'end', t: 1 }]);
  assert.ok(actions.collectSaveData().length <= 2 + 64, 'a handful waits, never the wire\'s worth');
});

/** The rig's house (origin 10, 0, 10; the eye at 10, 1.6, 10), thick-walled: x 4 to 24, z 5 to 15, 3 high, a wall at x 14
 *  with a doorway z 9.5 to 10.5 under a lintel 2.1 high - the eye in the west half, looking east at it. */
function rigHouse() {
  const c = new Collider();
  const T = 0.2;
  box(c, 'interior', [4, -T, 5, 24, 0, 15]);
  box(c, 'interior', [4, 3, 5, 24, 3 + T, 15]);
  box(c, 'interior', [4 - T, 0, 5, 4, 3, 15]);
  box(c, 'interior', [24, 0, 5, 24 + T, 3, 15]);
  box(c, 'interior', [4, 0, 5 - T, 24, 3, 5]);
  box(c, 'interior', [4, 0, 15, 24, 3, 15 + T]);
  box(c, 'interior', [14 - T / 2, 0, 5, 14 + T / 2, 3, 9.5]);
  box(c, 'interior', [14 - T / 2, 0, 10.5, 14 + T / 2, 3, 15]);
  box(c, 'interior', [14 - T / 2, 2.1, 9.5, 14 + T / 2, 3, 10.5]);
  return c;
}

test('HOME-DOORS the decorator: a door chosen is fitted into the doorway looked at - never where the eye meets a wall; every free doorway marked (the one looked at gold); the bar says the doorways are being found, then how many are free, then its price; a turn swings it the other way; placed, it is paid for, its doorway taken and the house\'s rooms found again, parted by it (mutants: the fit skipped; the marks unwritten; the flip unread; the rooms kept; the taken doorway offered)', async () => {
  const collider = rigHouse();
  const rig = toolRig({ collider, gold: 50_000, doors: [0], walls: WALLS, doorsHere: () => [] });
  const roomTabs = () => {
    const out = [];
    (function walk(n) { if (n.tag === 'button' && String(n.className).includes('dfdecor-room')) out.push(n); for (const k of n.children ?? []) walk(k); })(rig.doc.body);
    return out.length;
  };
  rig.frame();
  rig.tool.openPanel();
  for (let i = 0; i < 20; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const before = roomTabs();
  rig.doc.body.children.find((c) => c.className === 'dfdecor').children[0].children[0].children.find((b) => b.textContent === 'Close').fire('click');
  rig.cam.yaw = Math.PI / 2;   // looking east, at the doorway
  rig.cam.pitch = 0;
  await placeFrom(rig, 'm9000');
  // the finder steps a few rays a frame: first it says so
  assert.ok([DECOR_DOOR_FINDING, decorDoorAimLine(1)].includes(rig.tool.why()) || rig.tool.ghost(), `it says where it is (${rig.tool.why()})`);
  for (let i = 0; i < 80 && !rig.tool.ghost(); i++) { rig.frame(); await settle(); }
  const ghost = rig.tool.ghost();
  assert.ok(ghost, 'fitted into the doorway looked at');
  assert.equal(ghost.model, 9000);
  assert.equal(ghost.rot[0], 90, 'turned into the wall');
  // its middle: the hinge (origin + pos) plus half its fitted width along its turned x (world -z)
  assert.ok(near(10 + ghost.pos[0], 14, 0.02), 'in the wall');
  assert.ok(near(10 + ghost.pos[2] - ghost.scale / 2, 10, 0.02), 'centred in the opening');
  assert.ok(near(ghost.pos[1], 0, 1e-6), 'on the floor');
  const marks = rig.decals.at(-1);
  assert.ok(marks && marks.writes.length >= 1, 'the doorways marked');
  const floats = marks.writes.at(-1)[1];
  assert.deepEqual(floats.slice(5, 9).map((v) => Math.round(v * 100) / 100), [...DECOR_DOOR_MARK_AIMED], 'the one looked at, gold');
  assert.deepEqual(DECOR_DOOR_MARK_FREE.length, 4);
  assert.equal(rig.tool.why(), null, 'nothing stands in its way');
  // a turn swings it the other way
  rig.win.fire('keydown', { code: 'ArrowRight' });
  rig.frame();
  assert.equal(rig.tool.ghost().rot[0], -90, 'swung the other way');
  assert.ok(near(10 + rig.tool.ghost().pos[2] + rig.tool.ghost().scale / 2, 10, 0.02), 'still centred');
  // looking away: how many are free
  rig.cam.yaw = -Math.PI / 2;
  rig.frame();
  assert.equal(rig.tool.ghost(), null);
  assert.equal(rig.tool.why(), decorDoorAimLine(1));
  rig.cam.yaw = Math.PI / 2;
  rig.frame();
  const price = rig.tool.ghost().paid;
  assert.ok(price > 0);
  assert.equal(await rig.tool.commit(), true, 'placed');
  assert.deepEqual(rig.w.paid, [price], 'paid its fit\'s price');
  assert.equal(rig.standing.at(-1).model, 9000);
  rig.frame();
  assert.equal(rig.tool.ghost(), null, 'its doorway is taken');
  assert.equal(rig.tool.why(), DECOR_DOOR_NONE, 'and the house has no other');
  rig.tool.back();
  for (let i = 0; i < 20; i++) { rig.frame({ overlayUp: true }); await settle(); }
  assert.equal(roomTabs(), Math.max(2, before + 1), `the rooms found again: the door parts the house (${before} before)`);
});

test('HOME-DOORS a door hung on an earlier visit is moved within its own doorway - found again with the placed doors seen through, its own doorway free to it alone (mutants: the placed doors walled in; a door made a light)', async () => {
  const collider = rigHouse();
  const rig = toolRig({ collider, gold: 50_000, doors: [0], walls: WALLS, doorsHere: () => [] });
  rig.cam.yaw = Math.PI / 2;
  rig.cam.pitch = 0;
  await placeFrom(rig, 'm9000');
  for (let i = 0; i < 80 && !rig.tool.ghost(); i++) { rig.frame(); await settle(); }
  assert.equal(await rig.tool.commit(), true);
  const door = rig.standing.at(-1);
  rig.tool.back();
  // the next visit: the door stands shut in its doorway from the start (its bucket on the collider), found by no link
  const next = toolRig({ collider, gold: 50_000, doors: [0], walls: WALLS, doorsHere: () => [] });
  next.standing.push({ ...door });
  next.cam.yaw = Math.PI / 2;
  next.cam.pitch = 0;
  next.frame();
  next.tool.openPanel();
  for (let i = 0; i < 40; i++) { next.frame({ overlayUp: true }); await settle(); }
  const panel = next.doc.body.children.find((c) => c.className === 'dfdecor');
  all(panel, 'dfdecor-chip').find((c) => /^In this room/.test(c.textContent)).fire('click');
  next.frame({ overlayUp: true });
  all(panel, 'dfdecor-row').find((r) => r.dataset.key === door.id).fire('click');
  next.frame({ overlayUp: true });
  // AUDIT: a door is no station (whose licence it could never use), holds nothing and gives no light - offered none, and
  // a press reaching the tool changes nothing
  const btn = (re) => all(panel, 'dfdecor-btn').find((b) => re.test(b.textContent));
  for (const re of [/^Light/, /^Holds things/, /^Station/]) assert.equal(btn(re)?.disabled, true, `${re} not offered for a door`);
  btn(/^Light/).fire('click');
  await settle();
  assert.equal(next.standing.find((p) => p.id === door.id).light ?? null, null, 'no light hung on it');
  all(panel, 'dfdecor-btn').find((b) => b.textContent === 'Move').fire('click');
  for (let i = 0; i < 120 && !next.tool.ghost(); i++) { next.frame(); await settle(); }
  const ghost = next.tool.ghost();
  assert.ok(ghost, `its own doorway found and free to it (${next.tool.why()})`);
  assert.ok(near(10 + ghost.pos[0], 14, 0.02), 'in the wall');
  assert.equal(next.tool.why(), null);
});

test('HOME-DOORS a house whose doorways are taken - one of the room\'s own doors standing in it - offers none, and says so (mutant: the host\'s doors unread)', async () => {
  const rig = toolRig({ collider: rigHouse(), gold: 50_000, doors: [0], walls: WALLS, doorsHere: () => [[14, 0, 10.5]] });
  rig.cam.yaw = Math.PI / 2;
  await placeFrom(rig, 'm9000');
  for (let i = 0; i < 80 && rig.tool.why() === DECOR_DOOR_FINDING; i++) { rig.frame(); await settle(); }
  assert.equal(rig.tool.ghost(), null);
  assert.equal(rig.tool.why(), DECOR_DOOR_NONE);
});

test('HOME-DOORS the mark\'s picture is a bright frame round a faint fill; the host by source: a placed door hangs as one of the room\'s own action doors (drawn with them, keyed by the piece, taken down with it), the room\'s own doors are asked where they stand, the walls alone are read for doorways, and the shell\'s bucket is named once (mutants: the hooks unwired; the walls filter lost)', async () => {
  const px = decorDoorMarkPixels(16);
  assert.equal(px.colors.length, 16 * 16 * 4);
  assert.equal(px.colors[3], 255, 'the frame');
  assert.equal(px.colors[(8 * 16 + 8) * 4 + 3], 90, 'the fill');
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /doors: decorDoorHooks,/);
  assert.match(wm, /ctx\.actions\.addDoor\(model\.cpu, matrix, \{ ns: 'decor', positionKey: piece\.id \}\)/);
  assert.match(wm, /ctx\.dynamicDraws\.push\(\{ gpu: model\.gpu, object, decorDoor: piece\.id \}\)/);
  assert.match(wm, /ctx\.actions\.removeDoor\(`act:decor:\$\{id\}`\)/);
  assert.match(wm, /doorsHere: \(\) => decorBuiltInDoors\(\), walls: \{ only: \[INTERIOR_SHELL_BUCKET\] \}/);
  assert.match(wm, /!String\(o\.key\)\.startsWith\('act:decor:'\)/, 'the placed doors aside - the decorator counts those itself');
  // the shell's bucket named where the decorator reads it is the one the build stands the shell in
  assert.equal((await import('../../../src/scenes/decor/decorBase.js')).INTERIOR_SHELL_BUCKET, 'interior');
  assert.match(src('src/scenes/interiorContext.js'), /collider\.addMesh\(baseKey \? baseBucketOf\(baseKey\) : 'interior', cpu\.positions/);
});

test('HOME-DOORS the panel says where a door goes before it is placed: a door\'s line in the catalogue says it hangs in a doorway and how many this house has free, or that they are still being found, or that it has none (mutant: the line unread)', async () => {
  const { decorDoorLine } = await import('../../../src/ui/decorPanel.js');
  assert.equal(decorDoorLine(null), 'hangs in a doorway. Finding the doorways...');
  assert.equal(decorDoorLine(0), 'hangs in a doorway. This house has none free');
  assert.equal(decorDoorLine(2), 'hangs in a doorway - 2 free here, marked while you place it');
  const rig = toolRig({ collider: rigHouse(), gold: 50_000, doors: [0], walls: WALLS, doorsHere: () => [] });
  rig.frame();
  rig.tool.openPanel();
  for (let i = 0; i < 30; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  const rowsOf = (n, out = []) => { if (String(n.className).split(/\s+/).includes('dfdecor-row')) out.push(n); for (const k of n.children ?? []) rowsOf(k, out); return out; };
  rowsOf(root).find((r) => r.dataset.key === 'm9000').fire('click');
  const line = (function find(n) { if (n.className === 'dfdecor-pick-line') return n; for (const k of n.children ?? []) { const f = find(k); if (f) return f; } return null; })(root);
  assert.match(line.textContent, /hangs in a doorway - 1 free here/);
});
