// FIELD BUGS 2026-10-19f ROCK-CLEAR - an Overworld rock built after the body stands never closes on it (the owner,
// 2026-10-19: "Apply to rocks too"). A player's private report: a fast travel left the character inside a mountain, and
// they could not leave. UNSTUCK-OUT's landing law (player/enterExit.js heldInSolid, openGroundNear) reads the pixel the
// jump lands in, built whole before the body stands; a World of Daggerfall mountain is a mesh scaled by hundreds that
// reaches past its own pixel, and the neighbour pixel that stands it builds AFTER the body stands - its rock filed into
// the collider round the body, whose walls (the collider holds both faces) then hold it. DECOR-CLEAR's gate
// (player/lateSolid.js) is the after-landing law: the pixel build files every solid through the world collider's gate
// (scenes/pixelBuild.js), pixel-local and riding the floating origin, as many parts a pixel's one bucket as it stands;
// the world frame settles the gate every frame with the walking body - none while a jump's landing builds, which the
// landing's own law reads whole; and a bucket dropped anywhere (a pixel streamed out) forgets its withheld parts.
// Driven on the REAL motor, collider and streaming state, the providers in the pixel build's own shape.
// bible/01-Overview/bugs/Field-Bugs-2026-10-19f.md ROCK-CLEAR; bible/03-World/Player-Arc.md UNSTUCK-OUT, DECOR-CLEAR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS } from '../../../src/player/motor.js';
import { Collider, SKIN, onFloatingFrame } from '../../../src/player/collider.js';
import { lateSolidsOf } from '../../../src/player/lateSolid.js';
import { heldInSolid, openGroundNear } from '../../../src/player/enterExit.js';
import { StreamingWorldState } from '../../../src/world/streamingWorld.js';
import { TERRAIN_SIZE as TS } from '../../../src/world/terrain/terrainSampler.js';
import { createDecorRoom } from '../../../src/scenes/decor/decorRoom.js';
import { decorPieceOf } from '../../../src/net/decorLaw.js';
import { trs } from '../../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const EAST = Math.PI / 2, WEST = -Math.PI / 2;
const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: false, ...o });
/** A closed box [x0..x1] x [y0..y1] x [z0..z1] - a model's triangles in the meshReader's buffers. */
function box([x0, y0, z0], [x1, y1, z1]) {
  return {
    positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
  };
}
/** A rock as World of Daggerfall stands its pieces: one small model scaled up hugely (16 x 12 x 16 here) - no face of
 *  it near a body inside, its skin crossed once by a line up from the feet. */
const PEBBLE = box([-0.5, 0, -0.5], [0.5, 1, 0.5]);
const HERE = [100, 100], NEXT = [101, 100];   // the body's pixel, and the neighbour east whose rock reaches into it
const Z = TS / 2;
/** The neighbour's rock, pixel-local: its middle on the pixel's own west edge, so it reaches 8 m back into the body's. */
const ROCK = trs(0, 0, Z, 0, 0, 0, 16, 12, 16);
const BOULDER = trs(-1, 0, Z, 0, 0, 0, 10, 6, 10);   // a second piece of the same pile, also round the body
const HOUSE = trs(300, 0, Z, 0, 0, 0, 6, 5, 6);      // a town's model of the same pixel, nowhere near the body
const keyOf = ([px, py]) => `${px},${py}`;
/** The world as the streaming host stands it: its state at the body's pixel, flat ground, the motor standing 2 m inside
 *  the neighbour's rock-to-be (its west face 8 m off), and the frame's settle - world.js's getter: the body while it
 *  walks the world, none while a jump is under way. */
function world() {
  const state = new StreamingWorldState();
  state.init(...HERE);
  const col = new Collider(() => 0);
  const m = new PlayerMotor(col);
  m.spawn(TS - 2, 0, Z);
  for (let f = 0; f < 30; f++) m.update(FIXED_DT, still(), 0);
  const w = { state, col, m, busy: false };
  w.guard = () => (!w.busy ? m : null);
  w.gate = lateSolidsOf(col);
  w.frame = (input = still(), yaw = 0) => { m.update(FIXED_DT, input, yaw); w.gate.settle(w.guard); };
  // the pixel build's own provider: one array a bucket, riding the floating origin
  w.provider = (px, py) => onFloatingFrame(state, ((o) => () => state.pixelTranslation(px, py, o))([0, 0, 0]));
  return w;
}
const parts = (col, key) => col._buckets.get(key)?.parts ?? 0;
const at3 = (p) => [...p].map((v) => Math.round(v * 1000) / 1000);

test('ROCK-CLEAR a neighbour pixel\'s mountain built round the standing body draws and holds nothing - the pixel\'s other parts stand at once, in its one bucket; the body walks out, and the rock and its boulder are solid behind it the first frame it is clear; walked back into, the rock stops it at its face (mutants: the probe, the box or the stand off the pixel\'s provider; one part a key; a getter read as a body; the settle standing what closes)', () => {
  const w = world();
  w.gate.settle(w.guard);
  const key = keyOf(NEXT), t = w.provider(...NEXT);
  const asked = [
    w.gate.add(key, PEBBLE.positions, PEBBLE.indices, HOUSE, { translation: t }),
    w.gate.add(key, PEBBLE.positions, PEBBLE.indices, ROCK, { translation: t }),
    w.gate.add(key, PEBBLE.positions, PEBBLE.indices, BOULDER, { translation: t }),
  ];
  assert.deepEqual({ asked, parts: parts(w.col, key), withheld: w.gate.withheld(key), held: w.gate.size() },
    { asked: [true, false, false], parts: 1, withheld: true, held: 2 }, 'the house stands; the rock and the boulder round the body are held back');
  assert.equal(heldInSolid(w.col, w.m.pos), false, 'the body is in nothing the collider holds');
  // out west: the rock's west face at TS - 8 (the boulder's at TS - 6); clear once that face is out of the skin
  const xs = [], stood = [];
  for (let f = 0; f < 300; f++) { w.frame(still({ forward: 1 }), WEST); xs.push(w.m.pos[0]); if (!w.gate.withheld(key)) stood.push(f); }
  const clear = xs.findIndex((x) => TS - 8 - x > CAPSULE_RADIUS - SKIN);
  assert.ok(clear > 0, 'the body started in it');
  assert.deepEqual({ first: stood[0], parts: parts(w.col, key), held: w.gate.size() }, { first: clear, parts: 3, held: 0 }, 'both stood, the frame the body was clear - before it, held');
  for (let f = 0; f < 300; f++) w.frame(still({ forward: 1 }), EAST);
  assert.deepEqual(at3(w.m.pos), at3([TS - 8 - CAPSULE_RADIUS, 0, Z]), 'walked back, stopped at the rock\'s face');
});

test('ROCK-CLEAR the floating origin moves while the rock is held back: it stays held, rides the pixel\'s provider with the body, and stands where the recentre put it (mutants: the box off the provider; the probe off it)', () => {
  const w = world();
  w.gate.settle(w.guard);
  const key = keyOf(NEXT);
  w.gate.add(key, PEBBLE.positions, PEBBLE.indices, ROCK, { translation: w.provider(...NEXT) });
  // the body steps over into the neighbour pixel: the stream recentres by a pixel, the motor with it
  const { offset } = w.state.update([TS + 1, 0, Z]);
  assert.deepEqual(offset, [-TS, 0, 0]);
  w.m.offsetOrigin(offset);
  w.frame();
  assert.deepEqual({ x: at3(w.m.pos)[0], withheld: w.gate.withheld(key) }, { x: at3([-2])[0], withheld: true }, 'still round the body, a pixel over');
  for (let f = 0; f < 300; f++) w.frame(still({ forward: 1 }), WEST);
  for (let f = 0; f < 300; f++) w.frame(still({ forward: 1 }), EAST);
  assert.deepEqual(at3(w.m.pos), at3([-8 - CAPSULE_RADIUS, 0, Z]), 'solid where the recentre moved it');
});

test('ROCK-CLEAR a pixel streamed out takes its held-back rock with it: the collider\'s own removeBucket (destroyPixel\'s, releaseFailedBuild\'s) forgets it, and no settle stands it later (mutants: the collider\'s hook gone)', () => {
  const w = world();
  w.gate.settle(w.guard);
  const key = keyOf(NEXT);
  w.gate.add(key, PEBBLE.positions, PEBBLE.indices, ROCK, { translation: w.provider(...NEXT) });
  assert.equal(w.gate.withheld(key), true);
  w.col.removeBucket(key);   // the pixel's teardown, as the host writes it
  assert.deepEqual([w.gate.withheld(key), w.gate.size()], [false, 0]);
  for (let f = 0; f < 300; f++) w.frame(still({ forward: 1 }), WEST);
  assert.equal(w.col._buckets.has(key), false, 'no bucket stood again for a pixel that is gone');
});

test('ROCK-CLEAR a jump\'s landing builds whole for the landing\'s own law: while the jump is under way the world names no body, so a rock round where the body stood before it is filed at once - heldInSolid sees it, openGroundNear moves the landing to open ground - and once the body walks the world again, a neighbour\'s rock round it is held back (mutants: the getter unread; the landing\'s pixel withheld from its law)', () => {
  const w = world();
  w.gate.settle(w.guard);
  w.busy = true;   // a fast travel: worldMoveBusy() from its first statement, the landing pixel building
  const key = keyOf(NEXT), t = w.provider(...NEXT);
  assert.equal(w.gate.add(key, PEBBLE.positions, PEBBLE.indices, ROCK, { translation: t }), true, 'filed at once');
  const pos = [w.m.pos[0], w.m.pos[1], w.m.pos[2]];
  assert.equal(heldInSolid(w.col, pos), true, 'the landing\'s law sees the rock');
  assert.deepEqual(at3(openGroundNear(w.col, pos[0], pos[2])), at3([TS - 10, 0, Z]), 'and moves the landing to open ground - its first spot past the rock\'s west face');
  w.m.spawn(TS - 10, 0, Z);   // landed
  w.busy = false;
  w.frame();
  const next = keyOf([102, 100]);
  assert.equal(w.gate.add(next, PEBBLE.positions, PEBBLE.indices, trs(-TS - 10, 0, Z, 0, 0, 0, 16, 12, 16), { translation: w.provider(102, 100) }), false, 'walking again: held back');
});

test('ROCK-CLEAR a yard\'s piece goes by the same gate: its pool names no body, and the world frame\'s settle is the body it is held back from (mutants: a pool with no body standing at once over a guarded gate)', async () => {
  const w = world();
  w.gate.settle(w.guard);
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => ({ gpu: 'fence' }), cpuModels: new Map([[41000, box([-0.5, 0, -0.3], [0.5, 2, 0.3])]]) }, renderer: { drawMesh() {} },
    collider: () => w.col, origin: () => [TS - 2, 0, Z],   // homeYards.js's: no body
  });
  pool.put(decorPieceOf({ id: 'y1', model: 41000, flat: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 100 }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([w.gate.withheld('decor:y1'), w.col._buckets.has('decor:y1')], [true, false]);
  for (let f = 0; f < 120; f++) w.frame(still({ forward: 1 }), WEST);
  assert.equal(w.col._buckets.has('decor:y1'), true, 'solid once the body is clear');
});

test('ROCK-CLEAR by source: the pixel build files every solid through the world collider\'s gate, each with its bucket\'s provider - the mills, the town\'s models and gates, Gothway\'s boards, World of Daggerfall\'s pieces, the Hold\'s camp - and the hill patch (ground) alone directly; the world frame settles the gate after the motor\'s step with the walking body, none while a jump is under way; the collider forgets a removed bucket\'s held parts (mutants: each site past the gate; the settle gone; the jump\'s body named; the hook gone)', () => {
  const p = rd('src/scenes/pixelBuild.js');
  // PIN MOVED (the merge of main: PRECIP HOST-7's standFlatGroups stands between them): the one gate is the build's scope's,
  // made once above the build
  const gateAt = p.indexOf('\n  const late = lateSolidsOf(collider);\n');
  assert.ok(gateAt > 0 && gateAt < p.indexOf('\n  async function buildPixelNow(') && p.indexOf('lateSolidsOf(') === p.lastIndexOf('lateSolidsOf('), 'one gate, the world collider\'s');
  const sites = [
    'late.add(key, BODY.positions, BODY.indices, local,\n              { translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])) });',
    'late.add(gateKey, cpu.positions, cpu.indices, local,\n            { translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])), sight: sightMarksOf(placed.modelIdNum, cpu) });',   // PIN MOVED (FIELD BUGS 2026-10-25i SIGN-PASS): a sign's hung triangles a ray's alone (world/signSolid.js sightMarksOf)
    'late.add(key, cpuB.positions, cpuB.indices, local, { translation: onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0])) });',
    'late.add(key, cpu.positions, cpu.indices, m.matrix, { translation: wodBucket });',
    'late.add(key, cpu.positions, cpu.indices, local, { translation: holdBucket });',
  ];
  assert.deepEqual(sites.map((s) => p.split(s).length - 1), [1, 1, 1, 1, 1], 'each solid through the gate');
  assert.deepEqual((p.match(/collider\.addMesh\(/g) ?? []).map(() => 'direct'), ['direct'], 'one filed directly');
  assert.ok(p.includes('collider.addMesh(key, hillPatch.positions, hillPatch.indices, originMatrix,'), 'the hill patch - ground, not a solid');
  const w = rd('src/scenes/world.js');
  const motorAt = w.indexOf('        }, cam.yaw, cam.pitch);'), settleAt = w.indexOf('        lateSolidsOf(collider)?.settle(() => (walkMode && playerSpawned && !worldMoveBusy() ? player : null));');
  assert.ok(motorAt > 0 && settleAt > motorAt && settleAt - motorAt < 1200, 'the frame\'s settle, after the motor\'s step');
  assert.ok(w.includes('        travelNavFrame.strafe = _travelDrive && !_overlayHeld && !_seasonHeld && !paralyzed ? axes.strafe : 0;\n        lateSolidsOf(collider)?.settle(() => (walkMode && playerSpawned && !worldMoveBusy() ? player : null));'), 'the frame\'s settle, after the motor\'s step');
  assert.ok(rd('src/player/collider.js').includes('    this.late?.forget(bucketKey);'), 'the collider\'s hook');
});
