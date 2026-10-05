// AUDIT PRE-MERGE 0929 (2026-09-29, Mac: "Audit this") - DISC29-A's half: OnCharacterCollided WHOLE
// (DaggerfallActionCollision.cs:62-89). The port read "beneath the player" as "within 0.15 of the top of the object's
// BOX", and DISC29-A added a standing ray under the capsule's centre: a staircase trap took 2 hits for 16 steps walked
// down (N0000007), and a body crossing a MultiTrigger's floor under its walls was bumping INTO it - Orsinium's castle
// hostile at the first steps (S0000020 object 10406, a DoorText with a trespass on it). Now the contact is the
// collider's (capsuleContact, the nearest point of the object's own triangles within the capsule's skin), WalkOn is
// its direction from the controller's centre (dir.y < -0.9) for every flag, a Collision01 casts its ray, and a side is
// heard only while the body moves into it. The record: bible/01-Overview/Audit-PreMerge-0929.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { Collider } from '../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_HEIGHT, CAPSULE_RADIUS, motionBagOf } from '../src/player/motor.js';
import {
  ActionSystem, actionContact, standsOnAction, hasActionCollision, classifyPlacementAction, COLLISION_TIMEOUT_S, WALK_ON_DIR_Y, TRIGGER_SKIN_WIDTH,
} from '../src/world/actionSystem.js';
import { layoutRdbBlock, TRIGGER_FLAGS, ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { RDB_RESOURCE_TYPES } from '../src/formats/blocksFile.js';
import { worldAabb } from '../src/player/activate.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../src/world/meshReader.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** An axis-aligned box as a mesh (twelve triangles). */
function box(min, max) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]];
  return { positions: new Float32Array(v.flat()), indices: f.flat() };
}
function meshOf(...boxes) {
  const positions = [], indices = [];
  for (const b of boxes) { const n = positions.length / 3; positions.push(...b.positions); indices.push(...b.indices.map((i) => i + n)); }
  return { positions: new Float32Array(positions), indices };
}
/** The ride height the motor stands a body at over a floor (DFU's skinWidth, which the contact reach is). */
const REST = 0.078;

test('AUDIT PRE-MERGE 0929 D1/D2: a contact beneath the controller is WalkOn for every flag; a side is heard only while the body moves into it (a MultiTrigger bumped, WalkInto; a Collision01 then casts its ray); a body touching nothing of the object hears nothing (mutants: the beneath test by the box; the side heard without the press; the ray for every flag; no contact answered)', () => {
  // a room piece: its floor (top at y 0) and its wall (x 1 to 1.2)
  const room = meshOf(box([-3, -0.2, -3], [3, 0, 3]), box([1, 0, -3], [1.2, 3, 3]));
  const surfaces = new Collider(() => -Infinity);
  surfaces.addMesh('act:0:1', room.positions, room.indices, I);
  const multi = { key: 'act:0:1', triggerFlag: TRIGGER_FLAGS.MultiTrigger };
  const col01 = { key: 'act:0:1', triggerFlag: TRIGGER_FLAGS.Collision01 };
  const H = CAPSULE_HEIGHT;
  // on its floor, away from its wall: beneath - WalkOn, whatever the flag (a MultiTrigger refuses it: its floor is no trespass)
  assert.equal(actionContact(multi, [-1, REST, 0], H, surfaces, [1, 0]), 'WalkOn');
  // against its wall, pressing into it: the wall is nearer than the floor, and pressed - WalkInto
  const atWall = [1 - CAPSULE_RADIUS - 0.02, REST, 0];
  assert.equal(actionContact(multi, atWall, H, surfaces, [1, 0]), 'WalkInto', 'a bump into its wall');
  // ...a Collision01 there casts its standing ray, and its own floor is under the feet: WalkOn ("to avoid player being
  // able to push against wall to avoid")
  assert.equal(actionContact(col01, atWall, H, surfaces, [1, 0]), 'WalkOn');
  // along its wall, or away from it: not pressed - what holds the body up is heard, its floor beneath
  assert.equal(actionContact(multi, atWall, H, surfaces, [0, 1]), 'WalkOn', 'walking along a wall bumps nothing');
  assert.equal(actionContact(multi, atWall, H, surfaces, [-1, 0]), 'WalkOn');
  assert.equal(actionContact(multi, atWall, H, surfaces, null), 'WalkInto', 'no direction named: every side pressed');
  // a wall alone (standing on another object's floor): pressed - WalkInto, even for a Collision01 (its ray finds nothing
  // of it); not pressed - nothing of it is heard
  const wallOnly = new Collider(() => -Infinity);
  const w = box([1, 0, -3], [1.2, 3, 3]);
  wallOnly.addMesh('act:0:2', w.positions, w.indices, I);
  assert.equal(actionContact({ key: 'act:0:2', triggerFlag: TRIGGER_FLAGS.Collision01 }, atWall, H, wallOnly, [1, 0]), 'WalkInto');
  assert.equal(actionContact({ key: 'act:0:2', triggerFlag: TRIGGER_FLAGS.MultiTrigger }, atWall, H, wallOnly, [0, 1]), null);
  // touching nothing of it - a box overlapped, an object untouched (the pass's box is its broad phase alone)
  assert.equal(actionContact(multi, [-1, REST + 0.2, 0], H, surfaces, [1, 0]), null, 'a body 0.2 over its floor touches none of it');
  assert.equal(actionContact({ key: 'act:0:9', triggerFlag: TRIGGER_FLAGS.MultiTrigger }, [-1, REST, 0], H, surfaces, [1, 0]), null, 'another object\'s triangles are not this one\'s');
  assert.equal(WALK_ON_DIR_Y, -0.9);
  assert.equal(TRIGGER_SKIN_WIDTH, 0.08);
  // a table top at the waist (COL1's own case): only the chain's middle reaches it - a bump, where a contact taken at
  // the feet's sphere alone touched nothing
  const table = new Collider(() => -Infinity);
  const top = box([0.4, 0.8, -1], [1.4, 0.95, 1]);
  table.addMesh('act:0:4', top.positions, top.indices, I);
  assert.equal(actionContact({ key: 'act:0:4', triggerFlag: TRIGGER_FLAGS.MultiTrigger }, [0.03, REST, 0], H, table, [1, 0]), 'WalkInto');
});

test('AUDIT PRE-MERGE 0929 D1/D2: the pass hands the contact the direction the body presses - the motor\'s own sin and cos of forward and strafe - from the yaw the motor moved it by, which the one motion bag carries (mutants: the press unread; the motor keeping no yaw)', () => {
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const pass = dc.slice(dc.indexOf('function collisionTriggers('), dc.indexOf('function waterSurfaceYAt('));
  assert.match(pass, /_wish\[0\] = sn \* playerMove\.forward \+ cs \* playerMove\.strafe;/);
  assert.match(pass, /_wish\[1\] = cs \* playerMove\.forward - sn \* playerMove\.strafe;/);
  assert.match(pass, /wish = _wish;/);
  const motor = readFileSync(new URL('../src/player/motor.js', import.meta.url), 'utf8');
  assert.match(motor, /vx = \(sin \* input\.forward \+ cos \* input\.strafe\)/, 'the motor\'s own direction, which the pass mirrors');
  assert.match(motor, /vz = \(cos \* input\.forward - sin \* input\.strafe\)/);
  assert.match(dc, /collisionTriggers\(dt, playerFeet, moveHeld, playerHeight, playerMove\);/);
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const h = readFileSync(new URL(`../${host}`, import.meta.url), 'utf8');
    assert.match(h, /rawFoes\(dt, canvas, proj, view, cam\.pos, player\.pos, anyMove\(moveHeld\(keys\)\), player\.height, !!player\.isSneaking, motionBagOf\(player\)/, `${host}: the one motion bag`);
  }
  // the real motor: the yaw it moved by rides its bag, and the press the pass derives from the bag is the way it moved
  const floor = new Collider(() => 0);
  const m = new PlayerMotor(floor);
  m.spawn(0, 0, 0);
  assert.ok(Number.isNaN(motionBagOf(m).yaw), 'before a step, no yaw - the pass presses every side, as before');
  for (let f = 0; f < 30; f++) m.update(FIXED_DT, { forward: 0, strafe: 0 }, 1.25);
  const at = [m.pos[0], m.pos[2]];
  for (let f = 0; f < 30; f++) m.update(FIXED_DT, { forward: 1, strafe: -1, run: false, jump: false }, 1.25);
  const bag = motionBagOf(m);
  assert.equal(bag.yaw, 1.25, 'the bag carries the yaw the motor moved by');
  const sn = Math.sin(bag.yaw), cs = Math.cos(bag.yaw);
  const press = [sn * bag.forward + cs * bag.strafe, cs * bag.forward - sn * bag.strafe];
  const moved = [m.pos[0] - at[0], m.pos[2] - at[1]];
  const cos = (press[0] * moved[0] + press[1] * moved[1]) / Math.hypot(...press) / Math.hypot(...moved);
  assert.ok(Math.hypot(...moved) > 0.5 && cos > 0.999, `the press is the way the body went (cos ${cos.toFixed(4)})`);
});

test('AUDIT PRE-MERGE 0929 D1: a body riding a stair\'s edge stands on it - the edge under the capsule is beneath the controller, where the box\'s top (the top step) and a ray under the centre saw nothing (mutants: the contact taken at the capsule\'s centre alone)', () => {
  const step = box([0.2, -1, -2], [3, 0.3, 2]);
  const s = new Collider(() => -Infinity);
  s.addMesh('act:0:3', step.positions, step.indices, I);
  const o = { key: 'act:0:3', triggerFlag: TRIGGER_FLAGS.Collision01 };
  // the capsule's bottom sphere over the step's nose, its centre past it: nothing of the step under the centre
  const feet = [0, 0.28, 0];   // the bottom sphere (centre 0.63) 0.386 from the nose - touching, not in it
  assert.equal(Number.isFinite(s.raycast([feet[0], feet[1] + 0.01, feet[2]], [0, -1, 0], 0.09, { only: [o.key] })), false, 'the old standing ray: nothing under the centre');
  assert.equal(actionContact(o, feet, CAPSULE_HEIGHT, s, [1, 0]), 'WalkOn');
  // and the capsule contact's beneath filter answers the same edge
  const c = s.capsuleContact(feet, CAPSULE_HEIGHT, TRIGGER_SKIN_WIDTH, { only: [o.key] }, [0, 0, 0], WALK_ON_DIR_Y);
  assert.ok(c && Math.abs(c[0] - 0.2) < 1e-6 && Math.abs(c[1] - 0.3) < 1e-6, `the nose: ${c}`);
});

// ── THE REAL DATA ───────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'BLOCKS.BSA')) ? 'ARENA2_PATH has no BLOCKS.BSA' : false;
let _arch = null, _blocks = null;
const models = new Map();
function getModel(id) {
  if (!models.has(id)) models.set(id, dfMeshToModel(_arch.getMesh(_arch.getRecordIndex(id)), () => ({ width: 1, height: 1 })));
  return models.get(id);
}
/** A real RDB block stood up as the dungeon host stands it: the shared collider, every collision-trigger effect's and
 *  relay's triangles in triggerSurfaces, the movers and doors their own buckets. */
function blockWorld(name, events) {
  if (!_blocks) {
    _blocks = new BlocksFile(); _blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
    _arch = new Arch3dFile(); _arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  }
  const index = _blocks.getBlockIndex(name);
  const layout = layoutRdbBlock(_blocks.getBlock(index), index, false, getModel);
  const collider = new Collider(() => -Infinity);
  const triggerSurfaces = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider, { damagePlayer: () => events.push('hurt'), castSpell: () => events.push('cast'), playerLevel: () => 10 });
  actions.onDoorText = () => events.push('doorText');
  actions.onTrespass = () => events.push('TRESPASS');
  actions.onTeleport = () => events.push('TELEPORT');
  actions.resolvePosition = () => ({ pos: [0, 0, 0], yawDeg: 0 });
  for (const p of layout.placements) {
    const cpu = getModel(p.modelIdNum);
    const aabb = worldAabb(cpu.positions, p.matrix);
    let standable = null;
    if (p.action) {
      const cls = classifyPlacementAction(p.action.actionFlag, false);
      if (cls === 'move') { const o = actions.addAction(0, p.position, cpu, p.matrix, p.action); o.aabb = aabb; o.restOnlyTrigger = true; continue; }
      if (cls === 'specialDoor') { const o = actions.addSpecialDoor(0, p.position, cpu, p.matrix, p.action); o.aabb = aabb; o.restOnlyTrigger = true; continue; }
      if (cls === 'effect') { const eo = actions.addEffect(0, p.position, p.action, [p.matrix[12], p.matrix[13], p.matrix[14]], p.modelIdNum); eo.aabb = aabb; standable = eo; }
      else standable = actions.addRelay(0, p.position, p.action, aabb, [p.matrix[12], p.matrix[13], p.matrix[14]], p.modelIdNum);
    }
    collider.addMesh('dungeon', cpu.positions, cpu.indices, p.matrix);
    if (standable && hasActionCollision(standable)) triggerSurfaces.addMesh(standable.key, cpu.positions, cpu.indices, p.matrix);
  }
  for (const d of layout.actionDoors) { if (d.disabled) continue; actions.addDoor(getModel(d.modelIdNum), d.matrix, { ns: 0, positionKey: d.position, action: d.action, startingLockValue: d.startingLockValue, loadID: d.loadID }); }
  return { actions, collider, triggerSurfaces };
}
/** dungeonContext.js collisionTriggers, as it stands - its source is pinned in disc29_throne.test.js. */
function pass(world, dt, feet, wish, heard) {
  const { actions, collider, triggerSurfaces } = world;
  const R = 0.45, H = 1.8;
  for (const o of actions.objects.values()) {
    if (!o.aabb || !hasActionCollision(o)) continue;
    if (o.restOnlyTrigger && o.state !== 'start') continue;
    o._colTimer = (o._colTimer ?? COLLISION_TIMEOUT_S) + dt;
    if (o._colTimer < COLLISION_TIMEOUT_S) continue;
    const a = o.aabb;
    if (!(feet[0] + R > a.min[0] && feet[0] - R < a.max[0] && feet[2] + R > a.min[2] && feet[2] - R < a.max[2])) continue;
    if (!(feet[1] + H > a.min[1] && feet[1] < a.max[1] + 0.15)) continue;
    const touch = o.isFlat
      ? (standsOnAction(o, feet, a, triggerSurfaces) ? 'WalkOn' : 'WalkInto')
      : actionContact(o, feet, H, o.kind === 'effect' || o.kind === 'relay' ? triggerSurfaces : collider, wish);
    if (!touch) continue;
    heard.push([o.key, touch]);
    actions.receive(o, touch);
    o._colTimer = 0;
  }
}
/** Hold forward along `yaw` from `from`, the pass run every fixed step. */
function walk(world, from, yaw, frames, heard) {
  const m = new PlayerMotor(world.collider);
  m.spawn(...from);
  for (let f = 0; f < 30; f++) m.update(FIXED_DT, { forward: 0, strafe: 0 }, yaw);
  const wish = [Math.sin(yaw), Math.cos(yaw)];
  for (let f = 0; f < frames; f++) {
    m.update(FIXED_DT, { forward: 1, strafe: 0, run: false, jump: false }, yaw);
    pass(world, FIXED_DT, [m.pos[0], m.pos[1], m.pos[2]], wish, heard);
    world.actions.update?.(FIXED_DT);
  }
  return m;
}

test('AUDIT PRE-MERGE 0929 D1: N0000007\'s staircase trap (object 20798, Hurt22 + Collision01, in 69 dungeons) bites at every window a body walks it - it bit 2 times walking all sixteen steps down, 4 walking up', { skip: skipReal }, () => {
  for (const [label, from, yaw, least] of [['down', [35.0, 6.5, 19.7], 0, 8], ['up', [35.0, 0.6, 26.2], Math.PI, 12]]) {
    const events = [];
    const world = blockWorld('N0000007.RDB', events);
    const heard = [];
    walk(world, from, yaw, 600, heard);
    const stairs = heard.filter(([k]) => k === 'act:0:20798');
    const on = stairs.filter(([, t]) => t === 'WalkOn').length;
    assert.ok(on >= least, `${label}: the stairs heard WalkOn ${on} times (WalkInto ${stairs.length - on})`);
    assert.ok(stairs.length - on <= 1, `${label}: WalkInto ${stairs.length - on}`);
    assert.ok(events.filter((e) => e === 'hurt').length >= least, `${label}: bit ${events.filter((e) => e === 'hurt').length} times`);
  }
});

test('AUDIT PRE-MERGE 0929 D2: crossing Orsinium\'s castle floor (S0000020 object 10406, a MultiTrigger DoorText with a trespass on it) is standing on it - refused - where the port bumped into it at every step and turned the castle hostile', { skip: skipReal }, () => {
  const events = [];
  const world = blockWorld('S0000020.RDB', events);
  const heard = [];
  walk(world, [46.78, 0.3, 23.52], 0, 60, heard);
  const floor = heard.filter(([k]) => k === 'act:0:10406');
  assert.ok(floor.length >= 6, `the floor heard ${floor.length} touches`);
  assert.deepEqual([...new Set(floor.map(([, t]) => t))], ['WalkOn']);
  assert.equal(events.includes('TRESPASS'), false, 'a trespass for crossing a floor');
});

test('AUDIT PRE-MERGE 0929 D1: the throne puzzle (N0000037) at the motor\'s own rest - DISC29-A\'s pins stood the feet by hand 0.027 over the seat; the motor holds a body 0.078 over it - is WalkOn, and casts', { skip: skipReal }, () => {
  const events = [];
  const world = blockWorld('N0000037.RDB', events);
  const heard = [];
  // walk from the floor in front of the throne up onto its seat, as Skibbster did (facing -x: the seat's front at x
  // 33.64, its backrest at 32.79)
  walk(world, [34.9, 33.0, 39.4], -Math.PI / 2, 240, heard);
  const throne = heard.filter(([k]) => k === 'act:0:22979' || k === 'act:0:22908');
  assert.ok(throne.some(([, t]) => t === 'WalkOn'), `the throne heard ${JSON.stringify(throne.slice(0, 4))}`);
  assert.ok(events.includes('cast'), 'the throne casts its spell');
});

test('FIELD BUGS 2026-10-05c FLAT-RELAY ("red brick sections are not always working at teleporters"): a Teleport an RDB FLAT carries, Collision03, is heard by its box when walked into and sends the body to its next object - the relay keeps the flat\'s mark (addRelay isFlat), as an effect and a moving flat do; a model\'s relay is no flat (mutants: the mark dropped, every relay a flat)', () => {
  // the flat as BlocksFile mints it (no ARENA2): an editor flat (199.11) whose Teleport links to a start marker 50 units away
  const flat = (position, record, { x = 0, z = 0, action = 0, flags = 0, next = -1 } = {}) => ({
    position, xPos: x, yPos: 0, zPos: z, type: RDB_RESOURCE_TYPES.Flat,
    resources: { flatResource: { textureArchive: 199, textureRecord: record, flags, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: next, action } },
  });
  const block = { position: 0, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: [
    flat(100, 11, { action: ACTION_FLAGS.Teleport, flags: TRIGGER_FLAGS.Collision03, next: 200 }), flat(200, 10, { x: 2000, z: 2000 }),
  ] }, { rdbObjects: null }] } };
  const layout = layoutRdbBlock(block, 0, false, () => null);
  const { action } = layout.markers.find((m) => m.position === 100);
  assert.equal(action.isFlat, true, 'the producer marks a flat\'s action');
  // registered as dungeonContext.js registerFlatAction registers it: a relay over its billboard's box, no triangles
  const collider = new Collider(() => -Infinity), triggerSurfaces = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider, {});
  const sent = [];
  actions.onTeleport = (dest) => sent.push(dest);
  actions.resolvePosition = (_ns, pos) => (pos === 200 ? { pos: [50, 0, 50], yawDeg: 0 } : null);
  const o = actions.addRelay(0, 100, action, { min: [-0.5, -1, -0.5], max: [0.5, 1, 0.5] }, [0, 0, 0]);
  assert.equal(o.isFlat, true, 'the relay keeps the mark');
  const heard = [];
  pass({ actions, collider, triggerSurfaces }, COLLISION_TIMEOUT_S, [0.6, -1, 0], [-1, 0], heard);
  assert.deepEqual(heard, [[o.key, 'WalkInto']], 'walked into, heard');
  actions.update?.(FIXED_DT);
  assert.equal(sent.length, 1, 'and sent on');
  assert.deepEqual(sent[0].pos, [50, 0, 50]);
  // a model's relay (rdbLayout modelAction: isFlat false) is not heard by its box
  assert.equal(actions.addRelay(0, 300, { ...action, isFlat: false }, null).isFlat, false);
});
