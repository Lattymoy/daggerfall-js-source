// PH1 / PH2 - THE FLOOR IS ONE-WAY, THE STAIRS ARE DESCENDED (2026-09-14,
// Mac: "It's possible to randomly walk into the floor in dungeons and
// get stuck in the ground" / "Running up/down stairs makes the screen
// really jitter").
//
// PH1. The resolve pushes a sphere along centre-minus-closest, so once
// the lower sphere's centre had crossed a floor's plane the floor pushed
// it DOWN, and kept pushing until the head sphere caught the same floor
// from beneath: feet 0.36 below a floor became feet 1.10 below it,
// "grounded", forever - a dungeon has no heightAt floor and nothing
// called findClearFloor. A near-horizontal surface just above the
// lower sphere's centre, within its radius, is now a floor the body is
// UNDER, and the sphere is set ON it. The head keeps the plain push.
// The platform ride resolves the rider's own stance.
//
// PH2. The ground snap dropped the whole capsule STEP_OFFSET and
// resolved it there - inside a staircase's mass, whence the resolve
// ejected it up and back along the riser and the gate refused it. Every
// tread on the way down was an airborne frame: grounded flipped,
// `falling` rose, MAC1's eye filter let go, the head bob re-armed. The
// snap DESCENDS a quantum at a time to the first height the capsule
// stands at, a hair of slide off a tread's edge allowed (the arc down
// the edge), more refused (the old eject).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerMotor, STEP_OFFSET, CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../src/player/motor.js';   // COL1
import { Collider } from '../src/player/collider.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx2, dy2, dz2) { return { positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx2, dy2, dz2], indices: [0, 1, 2, 0, 2, 3] }; }
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A dungeon-shaped collider: a mesh floor and NO heightAt floor beneath it. */
function dungeonFloor() {
  const col = new Collider(() => -Infinity);
  const f = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
  col.addMesh('dungeon', f.positions, f.indices, I);
  return col;
}
function addStairs(col, { z0 = 2, y0 = 0, run = 0.6, riser = 0.3, count = 12, width = 4 } = {}) {
  const hw = width / 2;
  for (let i = 0; i < count; i++) {
    const zf = z0 + i * run, yb = y0 + i * riser, yt = y0 + (i + 1) * riser;
    const r = quad(-hw, yb, zf, hw, yb, zf, hw, yt, zf, -hw, yt, zf); col.addMesh('dungeon', r.positions, r.indices, I);
    const t = quad(-hw, yt, zf, hw, yt, zf, hw, yt, zf + run, -hw, yt, zf + run); col.addMesh('dungeon', t.positions, t.indices, I);
  }
  const topY = y0 + count * riser, topZ = z0 + count * run;
  const land = quad(-hw, topY, topZ, hw, topY, topZ, hw, topY, topZ + 6, -hw, topY, topZ + 6); col.addMesh('dungeon', land.positions, land.indices, I);
  return { topY, topZ };
}
const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const ahead = (run) => ({ forward: 1, strafe: 0, run, jump: false, up: false, down: false });

test('PH1: a capsule pushed past its radius below a dungeon floor is set back ON it, not driven down to its head (the measured stuck state)', () => {
  for (const start of [-0.2, -0.34, -0.36, -0.5, -0.6]) {
    const m = new PlayerMotor(dungeonFloor());
    m.pos = [0, start, 0]; m.grounded = true;
    for (let i = 0; i < 120; i++) m.update(1 / 60, still, 0);
    assert.ok(Math.abs(m.pos[1]) < 1e-6, `from ${start}: feet ${m.pos[1].toFixed(3)} - on the floor`);
    assert.equal(m.grounded, true);
    assert.equal(m.falling, false);
  }
  // the one-way law is the LOWER sphere's: a head under a ceiling is still pushed down, never lifted through it
  const col = dungeonFloor();
  col.addMesh('dungeon', [-40, 1.75, -40, 40, 1.75, -40, 40, 1.75, 40, -40, 1.75, 40], [0, 2, 1, 0, 3, 2], I);
  const m = new PlayerMotor(col);
  m.pos = [0, 0, 0]; m.grounded = true;
  for (let i = 0; i < 60; i++) m.update(1 / 60, still, 0);
  assert.ok(m.pos[1] < 0.2 && m.pos[1] > -0.2, `under a 1.75 ceiling the feet stay near the floor (${m.pos[1].toFixed(3)})`);
});

test('PH1: a lift advancing past the sphere\'s radius in one frame carries the rider up, and the ride resolves the rider\'s own stance', () => {
  for (const lift of [0.2, 0.3, 0.4, 0.6]) {
    const col = new Collider(() => -Infinity);
    let y = 0;
    const plate = () => quad(-2, y, -2, 2, y, -2, 2, y, 2, -2, y, 2);
    const p = plate(); col.addMesh('lift', p.positions, p.indices, I);
    const m = new PlayerMotor(col); m.pos = [0, 0, 0]; m.grounded = true;
    for (let i = 0; i < 20; i++) {
      y += lift; col.removeBucket('lift'); const q = plate(); col.addMesh('lift', q.positions, q.indices, I);   // the mover's mesh jumps first (actionSystem)
      col.move(m.pos, 0, lift, 0, m.height);   // then the ride applies the frame delta (shared.ridePlatform)
      m.update(1 / 60, still, 0);
    }
    assert.ok(Math.abs(m.pos[1] - y) < 1e-3, `lift ${lift}/frame: feet ${m.pos[1].toFixed(3)} on the plate at ${y.toFixed(2)}`);
    assert.equal(m.grounded, true);
  }
  assert.match(read('src/scenes/shared.js'), /player\.collider\.move\(player\.pos, d\[0\], d\[1\], d\[2\], player\.height\);/, 'the ride resolves the rider\'s own capsule');
});

/** Walk a staircase down (from the landing, -z) or up, counting what the camera would feel. */
function stairs({ riser, run, running, down }) {
  const col = dungeonFloor(); const { topY, topZ } = addStairs(col, { riser, run });
  const m = new PlayerMotor(col);
  if (down) { m.pos = [0, topY, topZ + 1]; } else { m.pos = [0, 0, 0]; }
  m.grounded = true;
  let air = 0, flips = 0, worstDrop = 0, worstRise = 0, prevG = true, prevE = m.eyeAt()[1];
  const done = () => (down ? m.pos[2] <= 1.0 : m.pos[2] >= topZ + 0.5);
  for (let i = 0; i < 900 && !done(); i++) {
    m.update(1 / 60, ahead(running), down ? Math.PI : 0);
    if (!m.grounded || m.falling) air++;
    if (m.grounded !== prevG) flips++; prevG = m.grounded;
    const e = m.eyeAt()[1]; const d = e - prevE; prevE = e;
    worstDrop = Math.min(worstDrop, d); worstRise = Math.max(worstRise, d);
  }
  assert.ok(done(), `the walk reached the other end (z ${m.pos[2].toFixed(2)})`);
  return { air, flips, worstDrop, worstRise, m };
}

test('PH2: descending a staircase never leaves the ground - no airborne frame, no grounded flip, the eye only descends, and by less per frame than a riser', () => {
  for (const [riser, run] of [[0.3, 0.6], [0.45, 0.7], [0.25, 0.4]]) {
    for (const running of [false, true]) {
      const r = stairs({ riser, run, running, down: true });
      const tag = `${riser}/${run} ${running ? 'run' : 'walk'}`;
      assert.equal(r.air, 0, `${tag}: airborne frames`);
      assert.equal(r.flips, 0, `${tag}: grounded flips`);
      assert.ok(r.worstRise < 1e-6, `${tag}: the eye never climbs on the way down (${r.worstRise.toFixed(4)})`);
      assert.ok(-r.worstDrop < riser * 0.5, `${tag}: the worst eye drop ${(-r.worstDrop).toFixed(3)} is well under a riser`);
      assert.ok(Math.abs(r.m.pos[1]) < 0.02, `${tag}: on the floor at the bottom (${r.m.pos[1].toFixed(3)})`);
    }
  }
  // ...and ascending is as it was (P14/P16's ladder): grounded throughout
  for (const running of [false, true]) {
    const r = stairs({ riser: 0.3, run: 0.6, running, down: false });
    assert.equal(r.air, 0, `up ${running ? 'run' : 'walk'}: airborne frames`);
    assert.ok(Math.abs(r.m.pos[1] - 3.6) < 0.02, 'reached the landing');
  }
});

test('PH2: the snap descends a quantum at a time from the feet, accepts a hair of slide off an edge and refuses more; a drop past STEP_OFFSET is still a fall', () => {
  const src = read('src/player/collider.js');
  assert.match(src, /for \(let y = feet\[1\] - STEP_OFFSET \/ 8; y >= feet\[1\] - STEP_OFFSET - 1e-9; y -= STEP_OFFSET \/ 8\) \{/, 'the descent');
  assert.match(src, /slidSq <= \(STEP_OFFSET \/ 8\) \*\* 2/, 'the slide tolerance');
  assert.doesNotMatch(src, /const probe = \[feet\[0\], feet\[1\] - STEP_OFFSET, feet\[2\]\];/, 'the whole-STEP_OFFSET teleport probe is gone');
  assert.match(src, /const floorAbove = oneWayFloor && d < radius && !wallAbove && dy \/ d <= -GROUND_NY;/, 'PH1: the one-way floor');
  assert.match(src, /this\._resolveSphere\(low, CAPSULE_RADIUS, out, standCeil, true\);/, 'the lower sphere\'s');
  assert.match(src, /this\._resolveSphere\(high, CAPSULE_RADIUS, out, standCeil, axis === 0\);/, 'never the head\'s');
  // a ledge deeper than STEP_OFFSET is a fall, as MAC3 pins for terrain
  const col = dungeonFloor();
  const low = quad(-10, -(STEP_OFFSET + 0.3), 20, 10, -(STEP_OFFSET + 0.3), 20, 10, -(STEP_OFFSET + 0.3), 40, -10, -(STEP_OFFSET + 0.3), 40);
  col.addMesh('dungeon', low.positions, low.indices, I);
  const m = new PlayerMotor(col); m.pos = [0, 0, 18]; m.grounded = true;
  let fell = false;
  for (let i = 0; i < 240; i++) { m.update(1 / 60, ahead(false), 0); if (m.falling) fell = true; }
  assert.ok(fell, 'a drop past STEP_OFFSET is a fall, not a snap');
  assert.ok(Math.abs(m.pos[1] + (STEP_OFFSET + 0.3)) < 1e-3, `and it lands on the lower floor (${m.pos[1].toFixed(3)})`);
});

// COL1 (2026-09-15, Mac: "3d Geometry has no collison. For example, in the
// first dungeon the table legs do have collison but the table top doesnt").
//
// A capsule is a sphere SWEPT along a segment. _resolveCapsule resolved two
// spheres at the segment's ENDS, which is the same shape only while those two
// cover the segment - and standing they do not. Radius 0.35, centres at
// feet+0.35 and feet+1.45: the lower reaches feet+0.70, the upper starts at
// feet+1.10, and the 0.40-tall band between them was sampled by NEITHER. That
// band is waist height, which is where a table top is. The legs cross the
// lower sphere and stopped you; the top lived in the hole.
//
// The triangles were never missing - sphereOverlaps finds them at y=0.90, so
// the index was right and the QUERY was wrong. The sphere count is derived
// from the axis now: consecutive centres never more than one diameter apart.
test('COL1: the capsule has no hole - a thin slab at any height along the body is solid', () => {
  const axis = CAPSULE_HEIGHT - 2 * CAPSULE_RADIUS;
  // the arithmetic that WAS the bug, stated so the shape cannot regress quietly
  assert.ok(axis > 2 * CAPSULE_RADIUS,
    'the stance is taller than one diameter, so two end spheres cannot cover it - this is why the chain exists');

  for (const slabY of [0.75, 0.90, 1.05, 1.20, 1.40]) {
    const col = dungeonFloor();
    // a boxed table TOP with no legs: the walker must be stopped by the top alone
    const y1 = slabY + 0.1;
    for (const [i, q] of [
      quad(-3, y1, 3, 3, y1, 3, 3, y1, 6, -3, y1, 6),
      quad(-3, slabY, 3, 3, slabY, 3, 3, slabY, 6, -3, slabY, 6),
      quad(-3, slabY, 3, 3, slabY, 3, 3, y1, 3, -3, y1, 3),
    ].entries()) col.addMesh(`slab${i}`, q.positions, q.indices, I);

    const feet = [0, 0, 0];
    for (let n = 0; n < 200; n++) col.move(feet, 0, 0, 0.05, CAPSULE_HEIGHT, true);
    // THROUGH is the defect: past the slab's near edge and still at floor
    // level. Stopped at the edge is the fix; ON TOP is also solid, and is
    // what a low slab gives - the lower sphere's one-way floor (PH1) sets
    // the body on a near-horizontal surface it is under, and STEP_OFFSET
    // climbs the rest. That climb predates COL1 and is not what was
    // reported; the pin holds "not through", which is the claim.
    const through = feet[2] > 3 && feet[1] < slabY - 0.2;
    assert.ok(!through,
      `a slab at y=${slabY} let the body walk through it - z=${feet[2].toFixed(2)} at y=${feet[1].toFixed(2)}`);
  }
});

// COL1: and the chain covers EVERY stance, not just the standing one - the
// ride stance (2.6) had a 1.2-tall hole, four times the reported one. The
// condition is the one that makes a chain of spheres a capsule: no two
// consecutive centres further apart than a diameter.
test('COL1: every stance is covered - no two consecutive sphere centres are more than a diameter apart', () => {
  const src = read('src/player/collider.js');
  assert.match(src, /const middles = Math\.max\(0, Math\.ceil\(axis \/ span\) - 1\);/,
    'the count is derived from the axis, never fixed');
  assert.match(src, /this\._resolveSphere\(m2, CAPSULE_RADIUS, out, standCeil, false\)/,
    'a mid-body contact takes the plain push - it is a thing you walked into, not a floor');

  // the derivation itself, over every stance the PlayerHeightChanger has
  for (const height of [0.30, 0.9, 1.8, 2.6]) {
    const axis = Math.max(0, height - 2 * CAPSULE_RADIUS);
    const middles = Math.max(0, Math.ceil(axis / (2 * CAPSULE_RADIUS)) - 1);
    const centres = [0];
    for (let i = 0; i < middles; i++) centres.push((axis * (i + 1)) / (middles + 1));
    centres.push(axis);
    for (let i = 1; i < centres.length; i++) {
      assert.ok(centres[i] - centres[i - 1] <= 2 * CAPSULE_RADIUS + 1e-9,
        `stance ${height}: centres ${centres[i - 1].toFixed(2)} and ${centres[i].toFixed(2)} leave a hole`);
    }
  }
});
