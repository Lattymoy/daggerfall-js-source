// DISC29-A (2026-09-28, Skibbster on Discord: the throne puzzle's switch never activates when walked on) - A COLLISION01
// OBJECT IS STOOD ON WHEREVER ITS OWN SURFACE IS.
//
// N0000037's two thrones are CastSpell effects with the Collision01 trigger (WalkOn only), chained to a tapestry that
// slides aside off a teleporter brick. DFU's DaggerfallActionCollision calls a contact WalkOn when it is beneath the
// player, and on a Collision01 object ALSO when a ray straight down from the controller's bottom, skinWidth long, hits
// the object's own collider (:68-85). The port's pass read "beneath" as the top of the object's BOX - and a throne's
// box tops its backrest, a metre and a half over the seat - so a player on the seat was WalkInto, refused by the gate,
// and the puzzle never opened. The standing ray is its own arm now (actionSystem.js standsOnAction), probing the
// object's own triangles (a mover's or a door's bucket, or the dungeon host's triggerSurfaces for an effect or relay).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ActionSystem, standsOnAction, ownSurfaceUnderFeet, TRIGGER_SKIN_WIDTH, TRIGGER_RAY_LIFT, TRIGGER_GATE } from '../../src/world/actionSystem.js';
import { Collider } from '../../src/player/collider.js';
import { ACTION_FLAGS, TRIGGER_FLAGS, layoutRdbBlock } from '../../src/world/rdbLayout.js';
import { worldAabb } from '../../src/player/activate.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { Arch3dFile } from '../../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../../src/world/meshReader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A throne in its own model space: a seat at 0.55 over [-0.4, 0.4] square, a backrest up to 2.0 at z 0.4. */
function throneModel() {
  const positions = [];
  const indices = [];
  const quad = (a, b, c, d) => {
    const n = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  quad([-0.4, 0.55, -0.4], [0.4, 0.55, -0.4], [0.4, 0.55, 0.4], [-0.4, 0.55, 0.4]);   // the seat
  quad([-0.4, 0.55, -0.4], [0.4, 0.55, -0.4], [0.4, 0, -0.4], [-0.4, 0, -0.4]);       // its front
  quad([-0.4, 0, 0.4], [0.4, 0, 0.4], [0.4, 2.0, 0.4], [-0.4, 2.0, 0.4]);             // the backrest
  return { positions, indices };
}
const act = (over = {}) => ({
  actionFlag: ACTION_FLAGS.None, triggerFlag: TRIGGER_FLAGS.None,
  index: 0, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1,
  duration: 0, rotation: { x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 },
  ...over,
});
/** The throne as the dungeon host registers an effect: the action, its box, and its triangles in triggerSurfaces. */
function setup(triggerFlag = TRIGGER_FLAGS.Collision01) {
  const collider = new Collider(() => -Infinity);
  const surfaces = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider);
  const cpu = throneModel();
  const cast = [];
  actions._castSpell = (index) => cast.push(index);
  const throne = actions.addEffect(0, 22908, act({ actionFlag: ACTION_FLAGS.CastSpell, triggerFlag, index: 17, nextObject: 23098 }), [0, 0, 0]);
  throne.aabb = worldAabb(cpu.positions, I);
  surfaces.addMesh(throne.key, cpu.positions, cpu.indices, I);
  const tapestry = actions.addAction(0, 23098, { positions: [0, 0, 0, 1, 0, 0, 1, 1, 0], indices: [0, 1, 2] }, I,
    act({ actionFlag: ACTION_FLAGS.Translation, duration: 32, translation: { x: -1.6, y: 0, z: 0 } }));
  return { actions, surfaces, throne, tapestry, cast };
}

test('DISC29-A: on the seat is WalkOn - the box\'s top alone never saw it', () => {
  const { surfaces, throne } = setup();
  const seat = [0, 0.55 + 0.027, 0];   // where the port's motor rests a body on it (the capsule's shell)
  assert.equal(seat[1] >= throne.aabb.max[1] - 0.15, false, 'the box tops the backrest: the old test said WalkInto');
  assert.equal(standsOnAction(throne, seat, throne.aabb, surfaces), true, 'the standing ray finds the seat');
  assert.equal(standsOnAction(throne, [0, 0.55, 0], throne.aabb, surfaces), true, 'a body exactly on the face (the ray starts TRIGGER_RAY_LIFT up)');
  assert.equal(standsOnAction(throne, [0, 0.55 + TRIGGER_SKIN_WIDTH + 0.02, 0], throne.aabb, surfaces), false, 'a hop off the seat is past the skin');
  assert.equal(standsOnAction(throne, [0, 0, -0.6], throne.aabb, surfaces), false, 'on the floor, pressed against the seat\'s front: WalkInto');
  assert.equal(standsOnAction(throne, [0, 1.95, 0.4], throne.aabb, surfaces), true, 'on top of the box: the beneath arm, as before');
});

test('DISC29-A: the standing ray is Collision01\'s alone, and reads only the object\'s own bucket', () => {
  for (const flag of [TRIGGER_FLAGS.Collision03, TRIGGER_FLAGS.MultiTrigger, TRIGGER_FLAGS.Collision09]) {
    const { surfaces, throne } = setup(flag);
    assert.equal(standsOnAction(throne, [0, 0.577, 0], throne.aabb, surfaces), false, `flag ${flag}: the box's top alone, as before`);
    assert.equal(TRIGGER_GATE[flag].includes('WalkOn'), false, 'and it admits no WalkOn - the arm only decides a refusal');
  }
  const { surfaces, throne } = setup();
  assert.equal(ownSurfaceUnderFeet(surfaces, throne.key, [0, 0.577, 0]), true);
  assert.equal(ownSurfaceUnderFeet(surfaces, 'act:0:1', [0, 0.577, 0]), false, 'another object\'s key: its bucket, not this one');
  assert.equal(ownSurfaceUnderFeet(null, throne.key, [0, 0.577, 0]), false);
  assert.equal(TRIGGER_SKIN_WIDTH, 0.08, 'Unity\'s CharacterController skinWidth default');
  assert.equal(TRIGGER_RAY_LIFT, 0.01);
});

test('DISC29-A: the puzzle - WalkOn on the throne casts its spell and slides the tapestry; WalkInto is refused', () => {
  const { actions, surfaces, throne, tapestry, cast } = setup();
  actions.receive(throne, standsOnAction(throne, [0, 0, -0.6], throne.aabb, surfaces) ? 'WalkOn' : 'WalkInto');
  assert.equal(throne.activationCount, 0, 'pressed against its front: the gate refuses WalkInto');
  assert.equal(tapestry.state, 'start');
  actions.receive(throne, standsOnAction(throne, [0, 0.577, 0], throne.aabb, surfaces) ? 'WalkOn' : 'WalkInto');
  assert.equal(throne.activationCount, 1);
  assert.equal(tapestry.state, 'forward', 'Play fires the next object first (DaggerfallAction.cs:286-287)');
  actions.update(5);
  assert.equal(tapestry.state, 'end', 'the tapestry is aside');
  assert.deepEqual(cast, [17], 'and the throne casts its spell (record 17): the first Play finds the cooldown at 0 (the S4b law)');
});

test('DISC29-A: the dungeon host - collision-trigger effects and relays keep their triangles in triggerSurfaces, and the pass asks actionContact (AUDIT PRE-MERGE 0929 D1/D2: every such model, not Collision01\'s alone; an acting flat keeps its box)', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /const triggerSurfaces = new Collider\(\(\) => -Infinity\);/);
  assert.match(dc, /standable = eo;/);
  assert.match(dc, /standable = actions\.addRelay\(bi, p\.position, p\.action, aabb, \[matrix\[12\], matrix\[13\], matrix\[14\]\], p\.modelIdNum\);/);
  assert.match(dc, /collider\.addMesh\('dungeon', cpu\.positions, cpu\.indices, matrix\);\n\s+if \(standable && hasActionCollision\(standable\)\) triggerSurfaces\.addMesh\(standable\.key, cpu\.positions, cpu\.indices, matrix\);/,
    'the copy beside the shared bucket - the player still stands on the shared one');
  const pass = dc.slice(dc.indexOf('function collisionTriggers('), dc.indexOf('function waterSurfaceYAt('));
  assert.match(pass, /: actionContact\(o, playerFeet, playerHeight, o\.kind === 'effect' \|\| o\.kind === 'relay' \? triggerSurfaces : collider, wish\);/);
  assert.match(pass, /const touch = o\.isFlat\n\s+\? \(standsOnAction\(o, playerFeet, a, triggerSurfaces\) \? 'WalkOn' : 'WalkInto'\)/, 'an acting flat keeps its box');
  assert.match(pass, /if \(!touch\) continue;/, 'a box touched with nothing of the object touched hears nothing');
  assert.doesNotMatch(pass, /folds into the beneath test/, 'the assumption that hid it is gone');
});

test('DISC29-A: N0000037\'s thrones on the real data - Collision01 CastSpell chained to the tapestry, and a body on the seat stands on it', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  assert.equal(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))), true);
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const models = new Map();
  const getModel = (id) => {
    if (!models.has(id)) models.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 })));
    return models.get(id);
  };
  const index = blocks.getBlockIndex('N0000037.RDB');
  const layout = layoutRdbBlock(blocks.getBlock(index), index, false, getModel);
  const byPos = new Map(layout.placements.map((p) => [p.position, p]));
  const tapestry = byPos.get(23098);
  assert.ok(tapestry?.action, 'the tapestry is an action model');
  assert.equal(tapestry.action.actionFlag, ACTION_FLAGS.Translation);
  for (const pos of [22908, 22979]) {
    const p = byPos.get(pos);
    assert.ok(p?.action, `throne ${pos}`);
    assert.equal(p.modelIdNum, 41123);
    assert.equal(p.action.triggerFlag, TRIGGER_FLAGS.Collision01);
    assert.equal(p.action.actionFlag, ACTION_FLAGS.CastSpell);
    assert.equal(p.action.nextObject, 23098, 'both thrones slide the one tapestry');
    const cpu = getModel(p.modelIdNum);
    const box = worldAabb(cpu.positions, p.matrix);
    const surfaces = new Collider(() => -Infinity);
    const o = { key: `act:0:${pos}`, triggerFlag: p.action.triggerFlag };
    surfaces.addMesh(o.key, cpu.positions, cpu.indices, p.matrix);
    const [x, , z] = [p.matrix[12], p.matrix[13], p.matrix[14]];
    const drop = surfaces.raycast([x, box.max[1] + 1, z], [0, -1, 0], 10, { only: [o.key] });
    assert.ok(Number.isFinite(drop), 'a surface under the throne\'s own origin');
    const seatY = box.max[1] + 1 - drop;
    assert.ok(seatY < box.max[1] - 1, `the seat (${seatY.toFixed(3)}) stands over a metre under the box's top (${box.max[1].toFixed(3)})`);
    const feet = [x, seatY + 0.027, z];
    assert.equal(feet[1] >= box.max[1] - 0.15, false, 'the box\'s top alone: WalkInto, refused - the report');
    assert.equal(standsOnAction(o, feet, box, surfaces), true, 'the standing ray: WalkOn');
  }
});
