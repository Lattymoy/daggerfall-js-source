// FIELD BUGS 2026-10-02 (Chilloutman on #bug-reports, "Stuck after Climbing Rework": "A two blocks wall is too high for
// my character to climb up, so Im stuck in this hole. Luckily I have levitate. Its 'Ruins of Old Carololda's Farm'" -
// "I would have been able with old climbing mechanics"). The enhanced climb had been proven on boxes and on town blocks
// (AUDIT CLIMB-FIELD); it had never climbed a dungeon. Climbed on the reporter's own dungeon with the freeware ARENA2 -
// every wall in reach of a floor that has a top, Forward held square to it - and on 24 more, five faults the classic
// climb never had (CORNER-TOP the batch's own audit's), each built here in the shape the real models have:
//   SEAM-STEP - Daggerfall's dungeon walls stand in 3.2 m units; where the unit above has a jamb a hand's width over, the
//               climber's head met its underside 1.4 m up the first unit - the reporter's "two blocks";
//   HUG-TOUCH - the free climb pressed 7 cm into the face every step, and the push back out of that press leans along a
//               face's seam: up a wall of two great triangles split on the diagonal it cost 1.3 cm a step, and at
//               Climbing 0 the climb never left the floor;
//   CRACK-LIP - stacked wall pieces stand a unit (2.5 cm) apart: the hand-hold read the slot as a lip, the climb hung
//               from it, found nothing there and let go - over and over;
//   STEP-BACK - a wall piece set 20 cm behind the one under it: the hands' contact ended at the step and the climb stood;
//   CORNER-TOP - in a narrow corner the hands took the side wall and climbed on past the top the look was turned to.
// The real wall half runs where ARENA2_PATH names the game's data, as every real-data test does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { senseGrip, senseLedge, freeClimbSpeed, PARKOUR_SIDESTEP_MAX, PARKOUR_HUG_PRESS, PARKOUR_CRACK } from '../../src/player/parkour.js';
import { MapsFile } from '../../src/formats/mapsFile.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { Arch3dFile } from '../../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../../src/world/meshReader.js';
import { layoutDungeon } from '../../src/world/dungeon/dungeonLayout.js';
import { multiply } from '../../src/world/mat4.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxAt = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
const STEP = 1 / 60;

/** A dungeon floor (no terrain under it) and the boxes given. */
function room(...boxes) {
  const col = new Collider(() => -Infinity);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  boxes.forEach((b, i) => col.addMesh(`b${i}`, boxAt(...b), BOX_IDX, I));
  return col;
}
/** Forward held at the wall across +z from (x, 0, 0.6), the enhanced climb on: where the body stood at the end, how high
 *  it rose and whether it was ever on the wall. Stops once stood on a floor `top` up. */
function climb(col, { x = 0, skill = 100, fatigue = 1, top = Infinity, steps = 60 * 20 } = {}) {
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: skill, fatigue }), say: () => {}, tally: () => {} } });
  m.spawn(x, 0.02, 0.6);
  let on = false, high = 0, lets = 0, was = false;
  for (let i = 0; i < steps; i++) {
    m.update(STEP, { forward: 1, strafe: 0, run: false, jump: false, crouch: false }, 0);
    on ||= m.onWall;
    if (was && !m.onWall && !m._pkMove && !m.grounded) lets++;
    was = m.onWall;
    high = Math.max(high, m.pos[1]);
    if (m.grounded && m.pos[1] > top - 0.05) return { m, on, high, topped: true, lets, t: i * STEP };
  }
  return { m, on, high, topped: false, lets, t: Infinity };
}

test('SEAM-STEP: the report - a 6.4 m wall of two 3.2 m units, the upper unit\'s jamb a hand\'s width over the climber: the head met its underside 1.4 m up and the climb stood; the hands move along to where the body rises, and it tops out (mutants: the step never asked; the search one way; no rise in the step)', () => {
  // the wall (z 1..3, x -3..3) to 6.4 with its top a floor; over 3.2 a jamb - a panel 2 cm thick standing out 1 m from
  // the wall into the shaft - at x -0.11, inside the 0.35 body standing at x 0 (as the real N0000090's stands 0.1 m in)
  const col = room([-3, 0, 1, 3, 6.4, 3], [-0.12, 3.2, 0, -0.1, 6.4, 1]);
  const r = climb(col, { top: 6.4 });
  assert.ok(r.on, 'on the wall');
  assert.ok(r.topped, `over the top (rose to ${r.high.toFixed(2)})`);
  assert.ok(r.m.pos[0] - 0 >= 0.24 - 1e-3 && r.m.pos[0] <= 0.45 + 0.01, `along the wall past the jamb, no further than the step's reach (x ${r.m.pos[0].toFixed(3)})`);
  assert.equal(PARKOUR_SIDESTEP_MAX, 0.45);
  // the other hand: the jamb on the body's right, the step goes left
  const mirror = climb(room([-3, 0, 1, 3, 6.4, 3], [0.1, 3.2, 0, 0.12, 6.4, 1]), { top: 6.4 });
  assert.ok(mirror.topped && mirror.m.pos[0] < -0.24 + 1e-3, `the mirror steps the other way (x ${mirror.m.pos[0].toFixed(3)})`);
  // a jamb too far in for the step (its edge past the body's middle by more than the reach) is a top it cannot take -
  // it stands, as under any, and never wanders off along the wall
  const deep = climb(room([-3, 0, 1, 3, 6.4, 3], [-3, 3.2, 0, 0.5, 3.4, 1]), { steps: 60 * 6 });
  assert.ok(!deep.topped && deep.m.onWall, 'held under a slab it cannot step out from');
  assert.ok(Math.abs(deep.m.pos[0]) < 1e-3, `not moved along (x ${deep.m.pos[0].toFixed(3)})`);
});

test('HUG-TOUCH: up a wall of two great triangles split on the diagonal (Daggerfall\'s own, N0000090\'s 25 m x 3.2 m face), the climb rises at its pace - the classic hug\'s deep press leaned on the seam and took 1.3 cm a step, and at Climbing 0 the climber never left the floor (mutants: the press the whole step again; the gap unread)', () => {
  const col = new Collider(() => -Infinity);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 30, 0, -20, 30, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  // the face at z 1, x -3.65..21.8: one triangle to 6.4 at its left end, the other its 3.2 at the right - the seam runs
  // from the floor at x -3.65 up to 3.2 at x 21.8, through the body's middle at 0.46 m (the real wall, its floor at 0)
  col.addMesh('wall', new Float32Array([-3.65, 6.4, 1, 21.8, 3.2, 1, -3.65, 0, 1, 21.8, 0, 1]), [0, 1, 2, 3, 2, 1], I);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 0, fatigue: 1 }), say: () => {}, tally: () => {} } });
  m.spawn(0, 0.02, 0.6);
  let first = null;
  for (let i = 0; i < 60 * 3; i++) {
    m.update(STEP, { forward: 1, strafe: 0, run: false, jump: false, crouch: false }, 0);
    if (m.onWall && first == null) first = i;
  }
  assert.ok(first != null, 'on the wall');
  const pace = freeClimbSpeed(m.speed, 0);
  const rose = m.pos[1], want = pace * STEP * (60 * 3 - first - 1);
  assert.ok(rose > 1.2, `off the floor and climbing (${rose.toFixed(3)} m)`);
  assert.ok(rose >= want * 0.95, `at the climb's pace (${rose.toFixed(3)} of ${want.toFixed(3)} m)`);
  assert.equal(PARKOUR_HUG_PRESS, 0.01);
});

test('CRACK-LIP: a wall of two pieces a unit (2.5 cm) apart - the slot is no lip: the free climb goes on past it and tops out, never hangs from it and lets go; a real lip over a set-back face is still one (mutants: the crack read as a lip; the plain wall\'s rungs ask an eave)', () => {
  // the lower piece to 2.225, the upper from 2.25 to 6.4 - each its own box, its own top in the slot
  const col = room([-3, 0, 1, 3, 2.225, 3], [-3, 2.25, 1, 3, 6.4, 3]);
  const r = climb(col, { top: 6.4 });
  assert.ok(r.topped, `over the top (rose to ${r.high.toFixed(2)})`);
  assert.equal(r.lets, 0, 'never let go on the way');
  // the hand-hold asked at the slot finds none; a 10 cm sill (the face set back over it) is still a hold
  const face = [0, 2.24, 1], N = [0, 0, -1], geo = { radius: 0.35, stand: 1.8, crouch: 0.9, height: 1.8 };
  assert.equal(senseGrip(col, face, N, 2.225, geo), null, 'no grip at the crack');
  const sill = room([-3, 0, 1, 3, 2.225, 3], [-3, 2.225, 1.1, 3, 6.4, 3]);
  assert.ok(senseGrip(sill, face, N, 2.225, geo), 'a sill is a hold');
  // the ledge sensor too: a jump at the cracked wall finds no lip at the slot (it runs on up to the reach)
  // (its 20th rung at 2.235, in the slot)
  const l = senseLedge(col, [0, 0, 0.6], [0, 0, 1], { low: 0.335, high: 2.5, radius: 0.35, stand: 1.8, crouch: 0.9, height: 1.8 });
  assert.equal(l.why, 'too-high', `the wall runs on past the reach, no lip at the slot (${l.why}, ${l.lipY?.toFixed(3)})`);
  assert.ok(PARKOUR_CRACK >= 0.025 && PARKOUR_CRACK < 0.05, 'a unit, under a rung');
});

test('STEP-BACK: a wall piece set back over the one under it (its top too shallow to stand on), the wall going on high over it - the climb passes the step and goes on up, where it hung from the step, let go and fell, over and over; it rises straight past the step, never pressed onto its edge (mutants: the step-back never reached for; any face reached for; the step not passed unpressed)', () => {
  // set back 0.2 m at 5.75 (N0000033's) and 0.3 m at 3.0, the upper piece to 9 m - no top in reach from under the step
  for (const [lo, back] of [[5.75, 0.2], [3.0, 0.3]]) {
    const r = climb(room([-3, 0, 1, 3, lo, 3], [-3, lo, 1 + back, 3, 9, 3]), { top: 9, steps: 60 * 10 });
    assert.ok(r.topped, `${back} m back at ${lo}: up past the step and over the top (rose to ${r.high.toFixed(2)})`);
    assert.equal(r.lets, 0, `${back} m back at ${lo}: never let go on the way`);
  }
  // held at the step, the climber is not lifted onto its edge by the reach: Left alone moves it along, at its height
  const col = room([-3, 0, 1, 3, 1.6, 1.3], [-3, 0, 1.3, 3, 9, 3]);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100, fatigue: 1 }), say: () => {}, tally: () => {} } });
  m.spawn(0, 0.02, 0.6);
  for (let i = 0; i < 300 && !m._wall?.seek; i++) m.update(STEP, { forward: 1, strafe: 0, jump: false }, 0);
  assert.equal(m._wall?.seek, true, 'reaching for the wall behind the plinth');
  const y = m.pos[1];
  for (let i = 0; i < 90; i++) m.update(STEP, { forward: 0, strafe: 1, jump: false }, 0);
  assert.ok(Math.abs(m.pos[1] - y) < 0.02 && m.pos[2] < 0.7, `along, not up onto the plinth's edge (y ${y.toFixed(3)} -> ${m.pos[1].toFixed(3)}, z ${m.pos[2].toFixed(3)})`);
  // a face turned away from the wall (a corridor's side, not this wall set back) is not reached for: the climb up a
  // wall that simply ends under a ceiling-high opening still stands there
  const turned = room([-3, 0, 1, 3, 5.75, 3], [-3, 5.75, 1.2, -0.1, 9, 1.22]);
  const t = climb(turned, { steps: 60 * 8 });
  assert.ok(!t.m.onWall || t.m.pos[1] < 5.75, `no climb up a face turned across the wall (feet ${t.m.pos[1].toFixed(2)})`);
});

test('CORNER-TOP: in a corner, the hands holding the side wall (which runs on up past the lip of the wall the look is turned to) climb onto that wall\'s top, where they climbed the side wall on under it; either hand (mutants: the corner never asked; the look unread; one side only)', () => {
  // the front wall (z 1) to 4 m with its top; the side wall to 12 m, its face at x -0.5 (or +0.5), the climber in the
  // corner looking 45 or 60 degrees round toward the side wall - which the start takes, as N0000090's corner did
  for (const flip of [1, -1]) {
    for (const deg of [45, 60]) {
      const side = flip > 0 ? [-3, 0, -3, -0.5, 12, 3] : [0.5, 0, -3, 3, 12, 3];
      const col = room([-3, 0, 1, 3, 4, 3], side);
      const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100, fatigue: 1 }), say: () => {}, tally: () => {} } });
      m.spawn(-0.14 * flip, 0.02, 0.64);
      const yaw = (-flip * deg * Math.PI) / 180;
      let held = null;
      for (let i = 0; i < 60 * 8 && !(m.grounded && m.pos[1] > 3.9); i++) {
        m.update(STEP, { forward: 1, strafe: 0, jump: false }, yaw);
        if (m.onWall && !held) held = [...m._wall.normal];
      }
      assert.ok(held && Math.abs(held[0]) > 0.9, `${flip > 0 ? 'left' : 'right'} ${deg}: the side wall held`);
      assert.ok(m.grounded && Math.abs(m.pos[1] - 4) < 0.05, `${flip > 0 ? 'left' : 'right'} ${deg}: onto the front wall's top (feet ${m.pos[1].toFixed(2)})`);
    }
  }
});

test('FIELD BUGS 2026-10-02 by source: the four laws where the motor and the sensor ask them', () => {
  const motor = readFileSync(new URL('../../src/player/motor.js', import.meta.url), 'utf8');
  const parkour = readFileSync(new URL('../../src/player/parkour.js', import.meta.url), 'utf8');
  assert.match(motor, /if \(!side && vert > 0 && \(w\.stuck \|\| \(w\.sidestep && w\.sidestep\.gone < w\.sidestep\.want\)\)\) this\._fcSidestep\(v, n, dt, held\);/);
  assert.match(motor, /const press = Math\.min\(this\.speed \* dt, Math\.max\(0, this\._wall\?\.gap \?\? Infinity\) \+ PARKOUR_HUG_PRESS\);/);
  assert.match(motor, /w\.gap = c\.dist - CAPSULE_RADIUS;/);
  assert.match(parkour, /if \(!Number\.isFinite\(at\(i - 1\)\) && faceGoesOn\(collider, ox, rungY\(i - 1\), oz, dir, dist, PARKOUR_GRIP_RUNG\)\) continue;/);
  assert.match(motor, /if \(s && s\.normal\[0\] \* n\[0\] \+ s\.normal\[2\] \* n\[2\] >= PARKOUR_FACE_FOLLOW\) \{\n\s+w\.past = this\._fcFaceTop\(was, into\);\n\s+w\.seek = true;/);
});

/** The reporter's dungeon as the dungeon host builds its collider: every block's placed models and its doors. */
function carololda() {
  const blocks = new BlocksFile(); blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const cache = new Map();
  const getModel = (id) => { if (!cache.has(id)) cache.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 }))); return cache.get(id); };
  const d = layoutDungeon(maps.getLocationByName('Daggerfall', "Ruins of Old Carololda's Farm"), blocks, getModel);
  const col = new Collider(() => -Infinity);
  for (const b of d.blocks) {
    const om = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, b.originX, 0, b.originZ, 1];
    for (const p of b.layout.placements) { const m = getModel(p.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(om, p.matrix)); }
    for (const dr of b.layout.actionDoors) { if (dr.disabled) continue; const m = getModel(dr.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(om, dr.matrix)); }
  }
  return col;
}

test('FIELD BUGS 2026-10-02 on the reporter\'s dungeon (Ruins of Old Carololda\'s Farm): a 6.4 m wall of N0000035 the climb stood under at 1.4 m tops out; N0000090\'s great diagonal face is climbed off the floor at Climbing 5', { skip: skipReal }, () => {
  const col = carololda();
  const run = (x, y, z, yaw, skill, top) => {
    const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: skill, fatigue: 1 }), say: () => {}, tally: () => {} } });
    m.spawn(x, y + 0.02, z);
    let high = y;
    for (let i = 0; i < 60 * 15; i++) {
      m.update(STEP, { forward: 1, strafe: 0, run: false, jump: false, crouch: false }, yaw);
      high = Math.max(high, m.pos[1]);
      if (m.grounded && m.pos[1] > top - 0.3) return { topped: true, high };
    }
    return { topped: false, high };
  };
  const seam = run(14.5, 28.8, 14.5, -Math.PI / 2, 100, 35.2);
  assert.ok(seam.topped, `N0000035's 6.4 m wall topped (rose to ${(seam.high - 28.8).toFixed(2)} m; it stood at 1.42)`);
  const diag = run(16.5, 6.4, -70.9, 0, 5, 12.8);
  assert.ok(diag.high - 6.4 > 2, `N0000090's face climbed at Climbing 5 (rose ${(diag.high - 6.4).toFixed(2)} m; it stood at 0.02)`);
});
