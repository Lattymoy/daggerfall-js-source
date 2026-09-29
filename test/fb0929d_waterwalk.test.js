// WW-LID (FIELD BUGS 2026-09-29d, Cruor on Discord: "Water walking is still evil" - "I fell out the map again..", with
// Water Walking, Tongues, Free Action and Light on the effect list and the dungeon seen from outside it).
//
// Found by fuzzing a water walker through every flooded RDB block with a probe that asks whether the body's centre
// crossed a face in one frame. W0000021.RDB: a flooded room with its ceiling at 3.2 and, in its wall, a doorway whose
// lintel is at 2.8, the passage's ceiling sloping down behind it. A crouched swimmer (0.9 tall) floated to the ceiling
// and swam at the doorway. Water walking moves a swimmer at the LAND speed (LevitateMotor.cs:116-122), so one step
// carried its LOWER sphere under the lintel's floor-sloped underside before its head had met the lintel; PH1's one-way
// floor set the body ON it, and its head, over the room's ceiling now, was pushed out on top of that. A slower swimmer's
// head meets the lintel first and is turned back, which is why only water walking did it. The fuzz found two more roads
// out once that one was shut: a rib under the ceiling through the crouched body's waist, and the step ladder lifting
// the body onto it with its head in the ceiling.
//
// Four laws, each held by a case below (the scenes are built here, never read off the block: its faces are ARENA2's):
//   S - the straddling law DISC28-G gave the rising pass holds in the sideways pass: a surface is a floor to the lower
//       sphere only below the head's centre;
//   H - a resolve never carries the head up through a face (Unity's controller sweeps; it never crosses a plane);
//   B - a sideways pass the resolve refused is not taken: the body is stopped, not left inside what refused it;
//   L - a step-ladder rung the resolve refused is no headroom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor } from '../src/player/motor.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
function mesh(tris) {
  const c = new Collider(() => -Infinity);   // a dungeon: no heightAt floor to catch anything
  c.addMesh('dungeon', new Float32Array(tris.flat(2)), new Uint32Array(tris.length * 3).map((_, k) => k), I);
  return c;
}
/** The field's doorway, in the shape W0000021 lays it: the room (x < 0) under its ceiling at `ceil`, the wall at x 0
 *  with its opening (z -0.8..0.8) up to the lintel at 2.8, the passage's ceiling sloping down to 2.25 behind it. */
function doorway(ceil = 3.2) {
  return mesh([
    ...quad([-6, ceil, -6], [0, ceil, -6], [0, ceil, 6], [-6, ceil, 6]),
    ...quad([0, 0, -6], [0, ceil, -6], [0, ceil, -0.8], [0, 0, -0.8]),
    ...quad([0, 0, 0.8], [0, ceil, 0.8], [0, ceil, 6], [0, 0, 6]),
    ...quad([0, 2.8, -0.8], [0, ceil, -0.8], [0, ceil, 0.8], [0, 2.8, 0.8]),
    ...quad([0, 2.8, -0.8], [1.6, 2.25, -0.8], [1.6, 2.25, 0.8], [0, 2.8, 0.8]),
    ...quad([0, 0, -0.8], [1.6, 0, -0.8], [1.6, 2.25, -0.8], [0, 2.8, -0.8]),
    ...quad([0, 0, 0.8], [1.6, 0, 0.8], [1.6, 2.25, 0.8], [0, 2.8, 0.8]),
    ...quad([-6, 0, -6], [6, 0, -6], [6, 0, 6], [-6, 0, 6]),
  ]);
}
/** A rib under a flat ceiling at 3.2: one sloped face across the room, `lo` at z -0.3 rising to `hi` at z 0.3. */
function ribRoom(lo, hi) {
  return mesh([
    ...quad([-6, 3.2, -6], [6, 3.2, -6], [6, 3.2, 6], [-6, 3.2, 6]),
    ...quad([-6, lo, -0.3], [6, lo, -0.3], [6, hi, 0.3], [-6, hi, 0.3]),
    ...quad([-6, 0, -6], [6, 0, -6], [6, 0, 6], [-6, 0, 6]),
  ]);
}
const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; };
const STRIDES = [[0.077, 0.055], [0.094, 0], [0.066, 0.066], [0.05, 0], [0.12, 0.02]];   // a water walker's step, 1/60 s at land speed

/** Float to the ceiling for 1.2 s, then run along `yaw` (floating up again after 2.4 s) - as a water walker or a
 *  swimmer, the dungeon hosts' own swim test every frame. True when the body's centre crossed a face in a frame, or
 *  its head stood over the ceiling (3.2) where `inside` says the ceiling is. */
function escapes(c, [sx, sz], yaw, fps, waterWalking, inside) {
  const m = new PlayerMotor(c, { speed: 70, running: 70, swimming: 50 });
  m.spawn(sx, 0, sz);
  const dt = 1 / fps;
  for (let k = 0; k < 4 * fps; k++) {
    const t = k * dt;
    const input = t < 1.2 ? { forward: 0, strafe: 0, up: true, jump: true, run: false } : { forward: 1, strafe: 0, up: t > 2.4, jump: t > 2.4, run: true };
    m.waterSurfaceY = 8;   // flooded over the ceiling, as the block's water plane is
    m.waterWalking = waterWalking;
    m.isPlayerSwimming = m.swimming = m.pos[1] + m.height / 2 + 50 * 0.025 - 0.95 < 8;
    const from = [m.pos[0], m.pos[1] + m.height / 2, m.pos[2]];
    m.update(dt, input, yaw, 0.1);
    const to = [m.pos[0], m.pos[1] + m.height / 2, m.pos[2]];
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], len = Math.hypot(...d);
    if (len > 1e-5 && Number.isFinite(c.raycast(from, d.map((v) => v / len), len))) return true;
    if (inside(m.pos) && m.pos[1] + m.height > 3.2 + 1e-3) return true;
  }
  return false;
}
const FPS = [60, 30, 20, 12];

test('WW-LID: through the real motor - a water walker floated to the ceiling and run at the doorway stays in the room, as a swimmer always did', () => {
  const c = doorway();
  const out = { walker: 0, swimmer: 0 };
  for (const ww of [true, false]) {
    for (const fps of FPS) {
      for (const z0 of [-0.4, -0.1, 0.2, 0.5]) {
        if (escapes(c, [-1.4, z0], Math.PI / 2, fps, ww, (p) => p[0] < 0)) out[ww ? 'walker' : 'swimmer']++;
      }
    }
  }
  assert.deepEqual(out, { walker: 0, swimmer: 0 }, 'the water walker went out through the ceiling in all 16 of its runs before WW-LID; the swimmer in none');
});

test('WW-LID: the doorway - no stride under the lintel sets the crouched body on the room\'s ceiling (188 of 1680 did)', () => {
  const c = doorway();
  let lifted = 0, tried = 0, worst = -Infinity;
  for (const y of range(2.20, 2.30, 0.005)) {
    for (const x of range(-0.45, -0.30, 0.01)) {
      for (const [dx, dz] of STRIDES) {
        const feet = new Float32Array([x, y, 0.2]);   // the motor's own position type: float32 is part of the knife edge
        c.move(feet, dx, 0, dz, 0.9, false);   // the swim arm's move: no snap
        tried++;
        worst = Math.max(worst, feet[1]);
        if (feet[1] + 0.9 > 3.2 + 1e-3) lifted++;
      }
    }
  }
  assert.equal(tried, 1680);
  assert.equal(lifted, 0, `set on the ceiling ${lifted} times (worst feet ${worst.toFixed(3)})`);
});

test('WW-LID S: under a HIGH room, where no ceiling is crossed, a lintel over the head\'s centre is still never stood on (147 of 2480 strides were)', () => {
  const c = doorway(6);
  let lifted = 0;
  for (const y of range(2.10, 2.25, 0.005)) {
    for (const x of range(-0.45, -0.30, 0.01)) {
      for (const [dx, dz] of STRIDES) {
        const feet = new Float32Array([x, y, 0.2]);
        c.move(feet, dx, 0, dz, 0.9, false);
        if (feet[1] > y + 0.1) lifted++;   // set on the lintel, into the wall over the door
      }
    }
  }
  assert.equal(lifted, 0);
});

test('WW-LID B, H, L: a rib under the ceiling - a water walker pressed to the ceiling and run at it is stopped by it, never lifted into the ceiling over it nor let through it', () => {
  const inRoom = (p) => Math.abs(p[0]) < 5.5 && Math.abs(p[2]) < 5.5;
  const runs = (c, spawns, yaws) => {
    let bad = 0;
    for (const fps of FPS) for (const s of spawns) for (const yaw of yaws) if (escapes(c, s, yaw, fps, true, inRoom)) bad++;
    return bad;
  };
  // from the rib's LOW end: its edge through the crouched body's waist - lifted onto it into the ceiling (36 of 36)
  assert.equal(runs(ribRoom(2.8, 3.1), [[0, -1.2], [0.5, -1.5], [-0.5, -1.0]], [0, 0.3, -0.3]), 0, 'rib 2.8-3.1 from its low end');
  // a nearly flat rib met from its high side, through the waist with no room over it - let through it (36 of 36)
  assert.equal(runs(ribRoom(2.72, 2.8), [[0, 1.2], [0.5, 1.5], [-0.5, 1.0]], [Math.PI, Math.PI - 0.3, Math.PI + 0.3]), 0, 'rib 2.72-2.8 from its high side');
  // and a steep one met from its high side: the step ladder's rung, refused and read as headroom
  assert.equal(runs(ribRoom(2.7, 3.0), [[0, 1.2], [0.5, 1.5], [-0.5, 1.0]], [Math.PI, Math.PI - 0.3, Math.PI + 0.3]), 0, 'rib 2.7-3.0 from its high side');
  // ...and the body stopped by the nearly flat rib is stopped: pressed to the ceiling on its near side
  const c = ribRoom(2.72, 2.8);
  const m = new PlayerMotor(c, { speed: 70, running: 70, swimming: 50 });
  m.spawn(0, 0, 1.2);
  for (let k = 0; k < 240; k++) {
    m.waterSurfaceY = 8; m.waterWalking = true;
    m.isPlayerSwimming = m.swimming = m.pos[1] + m.height / 2 + 50 * 0.025 - 0.95 < 8;
    m.update(1 / 60, k < 72 ? { forward: 0, strafe: 0, up: true, jump: true } : { forward: 1, strafe: 0, run: true }, Math.PI, 0.1);
  }
  assert.ok(m.pos[2] > 0.3, `stopped on the rib's near side (z ${m.pos[2].toFixed(3)})`);
  assert.ok(Math.abs(m.pos[1] + 0.9 - 3.2) < 0.01, `still pressed to the ceiling (feet ${m.pos[1].toFixed(3)})`);
});

test('WW-LID H: the head never rises through a face - a floor the body straddles is not stood on when the room over it is lower than the body', () => {
  for (const ceil of [1.5, 1.2]) {   // 1.2: a slot 0.2 over the floor - and the start at 0.65 puts the head's centre ON
    // the ceiling's plane, nearer than the ray takes a hit
    const crawl = mesh([
      ...quad([-5, 1.0, -5], [5, 1.0, -5], [5, 1.0, 5], [-5, 1.0, 5]),
      ...quad([-5, ceil, -5], [5, ceil, -5], [5, ceil, 5], [-5, ceil, 5]),
    ]);
    for (const y of range(0.46, 0.65, 0.01)) {   // lower centre (y + 0.35) under the floor, head centre (y + 0.55) over it
      const feet = new Float32Array([0, y, 0]);
      crawl.move(feet, 0, 0, 0, 0.9, false);
      assert.ok(feet[1] + 0.55 < ceil, `feet ${y.toFixed(2)}: the head's centre ${(feet[1] + 0.55).toFixed(3)} went through the ceiling at ${ceil}`);
    }
  }
  // PH1 still holds where the body fits: the same floor with room over it, straddled, is stood on
  const open = mesh([...quad([-5, 1.0, -5], [5, 1.0, -5], [5, 1.0, 5], [-5, 1.0, 5])]);
  const on = new Float32Array([0, 0.5, 0]);   // lower centre 0.85 under the floor, head centre 1.05 over it
  open.move(on, 0, 0, 0, 0.9, false);
  assert.ok(Math.abs(on[1] - 1.0) < 1e-3, `set on the floor it straddles (${on[1].toFixed(3)})`);
  // ...and a floor over the head's centre is a ceiling to it (S)
  const under = new Float32Array([0, 0.4, 0]);   // lower centre 0.75, head centre 0.95: the floor at 1.0 is over both
  open.move(under, 0, 0, 0, 0.9, false);
  assert.ok(under[1] + 0.9 <= 1.0 + 1e-3, `pushed under it, not set on it (${under[1].toFixed(3)})`);
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'BLOCKS.BSA')) ? 'ARENA2_PATH has no BLOCKS.BSA' : false;

test('WW-LID: the real block - W0000021.RDB, the fuzz\'s own step at its doorway, stays under the ceiling', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../src/world/meshReader.js');
  const { layoutRdbBlock } = await import('../src/world/rdbLayout.js');
  const blocks = new BlocksFile(); blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const models = new Map();
  const getModel = (id) => { if (!models.has(id)) models.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 }))); return models.get(id); };
  const index = blocks.getBlockIndex('W0000021.RDB');
  const layout = layoutRdbBlock(blocks.getBlock(index), index, false, getModel);
  assert.equal(-layout.waterLevel * 0.025, 5.2, 'a flooded block: its water plane two metres over the room\'s ceiling');
  const c = new Collider(() => -Infinity);
  for (const p of layout.placements) { const m = getModel(p.modelIdNum); c.addMesh('dungeon', m.positions, m.indices, p.matrix); }
  const feet = new Float32Array([17.25053596496582, 2.230633020401001, 16.56682777404785]);
  c.move(feet, 0.07687958625080059, 0, 0.05460135926983658, 0.9, false);
  assert.ok(feet[1] < 2.3 + 1e-3, `the step set the body at ${feet[1].toFixed(3)} - it was set on the ceiling at 3.2`);
});
