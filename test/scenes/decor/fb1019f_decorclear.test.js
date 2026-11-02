// FIELD BUGS 2026-10-19f DECOR-CLEAR - a home's late furniture never closes on the player. Two players' private
// reports: walking into an online home, its furniture moved and boxed them in; inside one, talking to its hired trader, a
// table stood round them and held them. An online home stands as Daggerfall furnished it, and its owner's pieces are
// asked of the account service after the entry (DECOR1c) - each solid only once its model loads, wherever the player
// stands - and a piece of the room's own put back (BASE-HIDE) is solid again at once. Daggerfall Unity lays an interior
// out before the body stands in it (PlayerEnterExit.TransitionInterior: DoLayout, then SetStanding), so nothing ever
// lands on it. The collider holds both faces: a body a solid lands round is held by its inner walls. The fix: one gate a
// collider (player/lateSolid.js) - a piece that would close on the body draws and is withheld from the collider until
// the body is clear of it, asked every frame by the room's decor draw. Driven on the REAL motor and collider, the pieces
// minted by the service's own law (net/decorLaw.js decorPieceOf), the room's own by its build's key.
// bible/01-Overview/bugs/Field-Bugs-2026-10-19f.md DECOR-CLEAR; bible/06-Systems/Online-Arc.md DECOR1c.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS, CROUCH_HEIGHT } from '../../../src/player/motor.js';
import { Collider, SKIN } from '../../../src/player/collider.js';
import { lateSolidsOf, lateSolidCloses } from '../../../src/player/lateSolid.js';
import { heldInSolid } from '../../../src/player/enterExit.js';
import { createDecorRoom } from '../../../src/scenes/decor/decorRoom.js';
import { createBaseRoom, baseBucketOf } from '../../../src/scenes/decor/decorBase.js';
import { decorPieceOf, decorBaseModelKey } from '../../../src/net/decorLaw.js';
import { trs } from '../../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const O = [20, 1, -10];   // the building's origin in the visit's frame
const EAST = Math.PI / 2, WEST = -Math.PI / 2;   // the walk's yaw: +x, -x
const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: false, ...o });
/** A closed box [x0..x1] x [y0..y1] x [z0..z1] - a model's triangles in the meshReader's buffers. */
function box([x0, y0, z0], [x1, y1, z1]) {
  return {
    positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
  };
}
const WARDROBE = box([-0.5, 0, -0.3], [0.5, 2, 0.3]);   // the investigation's: held, every way the body walked
const LOW = box([-1, 0, -1], [1, 0.3, 1]);              // low enough that the body was thrown onto its top
const HALL = box([-2, 0, -2], [2, 2.5, 2]);             // big enough that no face of it is near the body
const SHELF = box([-1, 1.2, -1], [1, 1.7, 1]);          // over a crouched body's head, through a standing one's
const CANOPY = (({ positions, indices }) => ({ positions, indices: indices.slice(6) }))(box([-1, 2, -1], [1, 2.5, 1]));   // hung over the head, open beneath (no bottom face, as Daggerfall's furniture has none)
// its underside within the crouched capsule's box (0.9 m) and outside its skin (the head's sphere at 0.55 m, 0.33 m
// reach), its top over a standing head's (1.45 m): only the parity, at the body's own height, tells them apart
const SLAB = box([-1, 0.89, -1], [1, 1.7, 1]);
const MODELS = [[41000, WARDROBE], [41001, LOW], [41002, HALL], [41003, SHELF], [41004, CANOPY], [41005, SLAB]];
/** A closed room of ten metres by three high about the origin: floor, walls, ceiling. */
function hall() {
  const col = new Collider(() => -Infinity);
  const r = box([O[0] - 5, O[1], O[2] - 5], [O[0] + 5, O[1] + 3, O[2] + 5]);
  col.addMesh('interior', r.positions, r.indices, I);
  return col;
}
/** The motor, standing (settled a half second) at `dx` east of the origin. */
function standing(col, dx = 0) {
  const m = new PlayerMotor(col);
  m.spawn(O[0] + dx, O[1], O[2]);
  for (let f = 0; f < 30; f++) m.update(FIXED_DT, still(), 0);
  return m;
}
/** The room's placed pieces over the real collider, the host's body handed in (worldModes.js `body: player`). */
const roomOf = (col, m, origin = () => O) => createDecorRoom({
  meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels: new Map(MODELS) }, renderer: { drawMesh() {} },
  collider: () => col, origin, body: m,
});
/** A piece as the account service answers it, through the law the host reads it by. */
const served = (id, model, pos = [0, 0, 0]) => decorPieceOf({ id, model, flat: null, pos, rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 100 });
const settle = () => new Promise((r) => setTimeout(r, 0));
/** Frames of walking along `yaw`, the room's draw asked each (the host's frame: the motor, then the draw). */
function walk(m, room, yaw, frames, each = null) {
  for (let f = 0; f < frames; f++) { m.update(FIXED_DT, still({ forward: 1 }), yaw); room?.draw(); each?.(f); }
}
const at3 = (p) => [...p].map((v) => Math.round(v * 1000) / 1000);
const solid = (col, key) => col._buckets.get(key)?.tris.length ?? 0;

test('DECOR-CLEAR a piece the service stands round the body draws and holds nothing - the body walks out of it, and it is solid behind them the first frame the body is clear of it; walked back into, it stops the body at its face (mutants: the gate passed by - the body held, as it was; the settle gone - never solid; every withheld one stood at once; one stood stood again every frame; the skin read past the radius)', async () => {
  const col = hall();
  const m = standing(col);
  const room = roomOf(col, m);
  const gate = lateSolidsOf(col);
  assert.equal(lateSolidsOf(col), gate, 'one gate a collider');
  room.put(served('w1', 41000));   // the owner's wardrobe, landing where the player stands
  await settle();
  assert.deepEqual({ withheld: gate.withheld('decor:w1'), solid: solid(col, 'decor:w1'), drawn: room.draw() }, { withheld: true, solid: 0, drawn: 1 }, 'drawn, and not in the collider');
  // out east: each frame, withheld while a face of it is deeper in the capsule than the skin
  const xs = [];
  const stoodAt = [];
  walk(m, room, EAST, 120, (f) => { xs.push(m.pos[0] - O[0]); if (!gate.withheld('decor:w1')) stoodAt.push(f); });
  const clear = xs.findIndex((x) => x - 0.5 > CAPSULE_RADIUS - SKIN);   // its east face at 0.5
  assert.ok(clear > 0, 'the body started in it');
  assert.equal(stoodAt[0], clear, 'solid the first frame the body is clear of it, not before');
  assert.deepEqual(at3(m.pos), at3([O[0] + 5 - CAPSULE_RADIUS, O[1], O[2]]), 'walked out to the room\'s wall - held in it, the body moved 0.12 m');
  assert.equal(solid(col, 'decor:w1'), 12, 'solid, once');
  walk(m, room, EAST, 30);
  assert.equal(solid(col, 'decor:w1'), 12, 'and never stood again');
  walk(m, null, WEST, 240);
  assert.deepEqual(at3(m.pos), at3([O[0] + 0.5 + CAPSULE_RADIUS, O[1], O[2]]), 'walked back, stopped at its face');
});

test('DECOR-CLEAR a low piece landing round the feet does not throw the body onto it, and a piece stood again under a body resting on it stands at once - the body rests at the radius, inside the skin (mutants: the skin read past the radius - the body dropped through; the gate passed by - thrown onto it)', async () => {
  const col = hall();
  const m = standing(col);
  const room = roomOf(col, m);
  room.put(served('p1', 41001));
  await settle();
  for (let f = 0; f < 30; f++) { m.update(FIXED_DT, still(), 0); room.draw(); }
  assert.deepEqual({ y: at3(m.pos)[1], withheld: lateSolidsOf(col).withheld('decor:p1') }, { y: O[1], withheld: true }, 'on the floor, in it - not thrown 0.3 m onto it');
  walk(m, room, EAST, 120);
  assert.equal(solid(col, 'decor:p1'), 12, 'solid once the body is off it');
  // up onto it from beside: it is a step
  m.spawn(O[0], O[1] + 0.3, O[2]);
  for (let f = 0; f < 30; f++) { m.update(FIXED_DT, still(), 0); room.draw(); }
  assert.equal(at3(m.pos)[1], O[1] + 0.3, 'standing on it');
  room.put(served('p1', 41001));   // the service's list again (a set of the room), the body on it
  await settle();
  assert.equal(lateSolidsOf(col).withheld('decor:p1'), false, 'a body resting on it is no body in it');
  for (let f = 0; f < 30; f++) { m.update(FIXED_DT, still(), 0); room.draw(); }
  assert.deepEqual(at3(m.pos), at3([O[0], O[1] + 0.3, O[2]]), 'still on it');
});

test('DECOR-CLEAR a piece so big no face of it is near the body still closes on it - the parity law (enterExit.js heldInSolid) - and a body crouched under a shelf is clear of it where a standing one is not: the body\'s own height; a piece hung wholly over the head, open beneath, holds nothing though a line up from the feet crosses it once - its box misses the capsule\'s (mutants: the parity unasked - shut in; the height unread, by the contact or by the head; the box unasked)', async () => {
  const col = hall();
  const m = standing(col);
  const room = roomOf(col, m);
  room.put(served('h1', 41002));
  await settle();
  assert.equal(lateSolidsOf(col).withheld('decor:h1'), true, 'two metres from every wall of it, its top a metre over the head');
  walk(m, room, EAST, 240);
  assert.deepEqual({ x: at3(m.pos)[0], solid: solid(col, 'decor:h1') }, { x: O[0] + 5 - CAPSULE_RADIUS, solid: 12 }, 'walked out, solid behind');
  // the shelf: through a standing body, over a crouched one
  const probe = new Collider();
  probe.addMesh('shelf', SHELF.positions, SHELF.indices, trs(O[0], O[1], O[2], 0, 0, 0));
  const feet = [O[0], O[1], O[2]];
  assert.deepEqual([lateSolidCloses(probe, { pos: feet }), lateSolidCloses(probe, { pos: feet, height: CROUCH_HEIGHT })], [true, false]);
  const col2 = hall();
  const low = standing(col2);
  low.update(FIXED_DT, still({ crouch: true }), 0);
  for (let f = 0; f < 60 && !low.crouching; f++) low.update(FIXED_DT, still(), 0);
  assert.equal(low.height, CROUCH_HEIGHT, 'the motor crouched');
  const room2 = roomOf(col2, low);
  room2.put(served('s1', 41003));
  await settle();
  assert.deepEqual({ withheld: lateSolidsOf(col2).withheld('decor:s1'), solid: solid(col2, 'decor:s1') }, { withheld: false, solid: 12 }, 'over the crouched body: solid at once');
  // the slab: the crouched head under it, a standing one's in it
  const slab = new Collider();
  slab.addMesh('slab', SLAB.positions, SLAB.indices, trs(O[0], O[1], O[2], 0, 0, 0));
  assert.deepEqual([heldInSolid(slab, feet), heldInSolid(slab, feet, CROUCH_HEIGHT), lateSolidCloses(slab, { pos: feet, height: CROUCH_HEIGHT })], [true, false, false]);
  const col4 = hall();
  const low2 = standing(col4);
  low2.update(FIXED_DT, still({ crouch: true }), 0);
  for (let f = 0; f < 60 && !low2.crouching; f++) low2.update(FIXED_DT, still(), 0);
  const room4 = roomOf(col4, low2);
  room4.put(served('s2', 41005));
  await settle();
  assert.deepEqual({ height: low2.height, withheld: lateSolidsOf(col4).withheld('decor:s2'), solid: solid(col4, 'decor:s2') }, { height: CROUCH_HEIGHT, withheld: false, solid: 12 }, 'over the crouched head: solid at once');
  // the canopy: the parity alone says the feet are in it; its box is over the capsule's
  const over = new Collider();
  over.addMesh('canopy', CANOPY.positions, CANOPY.indices, trs(O[0], O[1], O[2], 0, 0, 0));
  assert.deepEqual([heldInSolid(over, feet), lateSolidCloses(over, { pos: feet })], [true, false]);
  const col3 = hall();
  const m3 = standing(col3);
  const room3 = roomOf(col3, m3);
  room3.put(served('c1', 41004));
  await settle();
  assert.deepEqual({ withheld: lateSolidsOf(col3).withheld('decor:c1'), solid: solid(col3, 'decor:c1') }, { withheld: false, solid: 10 }, 'over the head: solid at once');
});

test('DECOR-CLEAR a withheld piece stays withheld through a recentre, moved with it, and a piece taken out while withheld never stands (mutants: the recentre standing it; its triangles not moved; the removal forgetting nothing)', async () => {
  const col = hall();
  const m = standing(col);
  let o = O;
  const room = roomOf(col, m, () => o);
  room.put(served('w1', 41000));
  await settle();
  // the world recentres a metre east: the room's origin and the body with it
  o = [O[0] + 1, O[1], O[2]];
  m.pos[0] += 1;
  room.restand();
  assert.deepEqual({ withheld: lateSolidsOf(col).withheld('decor:w1'), solid: solid(col, 'decor:w1') }, { withheld: true, solid: 0 }, 'still round the body: withheld');
  walk(m, room, EAST, 120);
  walk(m, null, WEST, 240);
  assert.equal(at3(m.pos)[0], at3([O[0] + 1 + 0.5 + CAPSULE_RADIUS])[0], 'solid where the recentre moved it');
  // a piece taken out while withheld is forgotten with it
  const col2 = hall();
  const m2 = standing(col2);
  const room2 = roomOf(col2, m2);
  room2.put(served('w2', 41000));
  await settle();
  room2.remove('w2');
  assert.equal(lateSolidsOf(col2).withheld('decor:w2'), false);
  walk(m2, room2, EAST, 120);
  assert.equal(solid(col2, 'decor:w2'), 0, 'gone, and nothing of it stands');
});

test('DECOR-CLEAR the room\'s own piece put back round the body (BASE-HIDE: the service\'s list, or the owner\'s Put back) draws and is withheld - the body the room\'s decor draw hands the collider\'s gate every frame - and that draw stands it once the body is clear; one taken out again while withheld never stands (mutants: show past the gate; the gate guarding no body; hide forgetting nothing)', () => {
  const col = hall();
  const m = standing(col, 3);   // the body beside it while the room is built
  const decor = roomOf(col, m);   // the host's placed pieces, drawn every frame over the same collider
  const drawList = [], batches = [], lights = [];
  const base = createBaseRoom({ drawList, batches: () => batches, lights: () => lights, collider: col });   // interiorContext.js's, as built
  const key = decorBaseModelKey(4, 41000);
  const matrix = trs(O[0], O[1], O[2], 0, 0, 0);
  const draw = { mesh: 'wardrobe', matrix };
  drawList.push(draw);
  col.addMesh(baseBucketOf(key), WARDROBE.positions, WARDROBE.indices, matrix);   // the build's own bucket (interiorContext.js)
  base.addModel(key, { model: 41000, draw, cpu: WARDROBE, matrix, at: [O[0], O[1] + 1, O[2]] });
  base.setHidden([key]);   // its owner took it out
  assert.equal(solid(col, baseBucketOf(key)), 0);
  m.spawn(O[0], O[1], O[2]);   // and stands where it stood - the host's frames: the motor, then the room's draw
  for (let f = 0; f < 30; f++) { m.update(FIXED_DT, still(), 0); decor.draw(); }
  base.setHidden([]);   // put back
  const gate = lateSolidsOf(col);
  assert.deepEqual({ drawn: drawList.includes(draw), withheld: gate.withheld(baseBucketOf(key)), solid: solid(col, baseBucketOf(key)) }, { drawn: true, withheld: true, solid: 0 });
  walk(m, decor, EAST, 120);
  assert.deepEqual({ withheld: gate.withheld(baseBucketOf(key)), solid: solid(col, baseBucketOf(key)) }, { withheld: false, solid: 12 }, 'stood by the room\'s draw');
  walk(m, null, WEST, 240);
  assert.equal(at3(m.pos)[0], at3([O[0] + 0.5 + CAPSULE_RADIUS])[0], 'walked back, stopped at its face');
  // out again, the body in its place, back, out again while withheld: never stands
  base.setHidden([key]);
  m.spawn(O[0], O[1], O[2]);
  for (let f = 0; f < 30; f++) { m.update(FIXED_DT, still(), 0); decor.draw(); }
  base.setHidden([]);
  base.setHidden([key]);
  assert.equal(gate.withheld(baseBucketOf(key)), false);
  walk(m, decor, EAST, 120);
  assert.equal(solid(col, baseBucketOf(key)), 0, 'out, and nothing of it stands');
});

test('DECOR-CLEAR the gate: one a collider (none for no collider); a gate no body has settled stands a solid at once, as every solid stood (a bench, a test); once settled it guards that body for a solid that names none, and `null` stands one at once; a settle handed no body stands none and keeps the body it guards (mutants: the unknown body taken as clear; the body unguarded; a gate an asking)', () => {
  const col = hall();
  const gate = lateSolidsOf(col);
  assert.deepEqual([lateSolidsOf(col) === gate, lateSolidsOf(null), lateSolidsOf(undefined)], [true, null, null]);
  const at = (x) => trs(O[0] + x, O[1], O[2], 0, 0, 0);
  const body = { pos: [O[0] + 2, O[1], O[2]] };
  assert.equal(gate.add('decor:a', WARDROBE.positions, WARDROBE.indices, at(2)), true, 'no body guarded yet: at once');
  assert.equal(solid(col, 'decor:a'), 12);
  assert.equal(gate.add('decor:b', WARDROBE.positions, WARDROBE.indices, at(2), { body }), false, 'round the body named: withheld');
  assert.deepEqual([gate.settle(null), gate.size(), gate.withheld('decor:b')], [0, 1, true], 'no body known: none');
  assert.equal(gate.add('decor:c', WARDROBE.positions, WARDROBE.indices, at(2)), true, 'a settle handed none guards none');
  assert.equal(gate.settle(body), 0, 'the body still in it');
  assert.equal(gate.add('decor:d', WARDROBE.positions, WARDROBE.indices, at(2)), false, 'named none: the guarded body\'s');
  assert.equal(gate.settle(null), 0);
  assert.equal(gate.add('decor:e', WARDROBE.positions, WARDROBE.indices, at(2)), false, 'still guarded through a settle handed none');
  assert.equal(gate.add('decor:f', WARDROBE.positions, WARDROBE.indices, at(2), { body: null }), true, 'null: at once');
  body.pos[0] = O[0] - 2;
  assert.deepEqual([gate.settle(body), gate.size(), solid(col, 'decor:b'), solid(col, 'decor:d'), solid(col, 'decor:e')], [3, 0, 12, 12, 12], 'clear: stood');
});

test('DECOR-CLEAR by source: the interior host hands the body - the motor itself, never the eye\'s low-passed feet - to its placed pieces (worldModes.js; the room\'s own furniture is guarded through their draw); a yard\'s pool names none - ROCK-CLEAR: it goes by the world collider\'s gate, settled by the world frame (PIN MOVED: a yard\'s own body, DECOR-CLEAR\'s, is gone - its draw handing the gate a plain body wrote over the frame\'s, and a jump\'s landing was asked against the body where it had stood) (mutants: the wiring gone)', () => {
  const wm = rd('src/scenes/worldModes.js');
  const decor = wm.slice(wm.indexOf('  const interiorDecor = createDecorRoom({'), wm.indexOf('  let _decorVisit = 0;'));
  assert.ok(decor.includes('\n    body: player,   // DECOR-CLEAR'), 'the placed pieces');
  const y = rd('src/scenes/homeYards.js');
  const yard = y.slice(y.indexOf('    y.pool = createDecorRoom({'), y.indexOf('    yards.set(key, y);'));
  assert.ok(yard.length > 0 && !/\bbody:/.test(yard), 'a yard\'s pool names no body of its own');
  const w = rd('src/scenes/world.js');
  const yards = w.slice(w.indexOf('createHomeYards({'), w.indexOf('outside: () => _mode() === \'exterior\''));
  assert.ok(yards.length > 0 && !/\bbody:/.test(yards), 'nor the world\'s yards');
});
