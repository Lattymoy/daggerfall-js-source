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
// ride stance (2.6) had a 1.2-tall hole, three times the reported one. The
// condition is the one that makes a chain of spheres a capsule: no two
// consecutive centres further apart than a diameter.
// AUDIT COL1 F6a: "a mid-body contact is a wall, never a floor" was held
// by a GREP, and the slab pin above is blind to the flag - flipping the
// middle sphere's oneWayFloor to true behind a decoy comment passed both
// COL1 pins. It is driven here: with the flag wrong, a shelf at mid-body
// height becomes a floor the body is SET ON, so it climbs 0.88 and walks
// away over the top. With it right, the body is stopped and stays down.
test('COL1: a mid-body contact is a wall, never a floor you are set on', () => {
  for (const shelfY of [0.95, 1.00, 1.05]) {
    const col = dungeonFloor();
    const q = quad(-3, shelfY, 3, 3, shelfY, 3, 3, shelfY, 6, -3, shelfY, 6);
    col.addMesh('shelf', q.positions, q.indices, I);
    const feet = [0, 0, 0];
    for (let n = 0; n < 200; n++) col.move(feet, 0, 0, 0.05, CAPSULE_HEIGHT, true);
    assert.ok(feet[1] < 0.1,
      `a shelf at y=${shelfY} lifted the body to y=${feet[1].toFixed(2)} - the middle sphere treated it as a floor`);
    assert.ok(feet[2] < 3, `and it walked past to z=${feet[2].toFixed(2)}`);
  }
});

// AUDIT COL1 F8 (2026-09-15): THE MIDDLE SPHERE'S PLAIN PUSH IS A LIFT.
// The test above pins the ONE-WAY FLOOR flag, and at the standing stance
// a shelf near 1.0 is met almost side-on, so the plain push happens to
// come out sideways and the pin passes either way. Out of a near-
// HORIZONTAL top face the same plain push is straight UP, and
// _resolveCapsule copies the middle's y back into the whole capsule -
// so the body was lifted onto the table it walked into. It shows on the
// RIDE stance, which has the most middles: measured, tops to 0.85 were
// mounted by a 0.65 m single-frame rise (past STEP_OFFSET, `grounded`
// true throughout) where before COL1 nothing above 0.69 could be
// mounted at all. The step ladder is the ONLY way up, so the rise is
// bounded by STEP_OFFSET and a table above it is a wall.
//
// The band pinned here starts ABOVE the lower sphere's own reach
// (feet + 2R = 0.70). Below that PH1's one-way floor sets the body on a
// near-horizontal surface it is under, by design and since before COL1 -
// that climb is PH1's, not the middles', and is not this pin's business.
test('AUDIT COL1 F8: a middle sphere never LIFTS the body onto what it walked into - the step ladder is the only way up', () => {
  for (const height of [CAPSULE_HEIGHT, 2.6]) {
    for (const topY of [0.75, 0.80, 0.85]) {   // ABOVE the lower sphere's reach (feet + 2R = 0.70): only a middle can act here
      const col = dungeonFloor();
      const q = quad(-3, topY, 3, 3, topY, 3, 3, topY, 6, -3, topY, 6);   // a thin DF tabletop
      col.addMesh('table', q.positions, q.indices, I);
      const feet = [0, 0, 0];
      let maxRise = 0;
      let prev = feet[1];
      for (let n = 0; n < 200; n++) {
        col.move(feet, 0, -0.02, 0.05, height, true);
        maxRise = Math.max(maxRise, feet[1] - prev);
        prev = feet[1];
      }
      assert.ok(feet[1] < topY - 0.1,
        `stance ${height}: a ${topY} top above STEP_OFFFSET was MOUNTED - feet y=${feet[1].toFixed(2)} (the middle sphere lifted the body)`
          .replace('STEP_OFFFSET', 'STEP_OFFSET'));
      assert.ok(feet[2] < 3.1, `stance ${height}: and the body walked on over it to z=${feet[2].toFixed(2)}`);
      assert.ok(maxRise <= STEP_OFFSET + 1e-6,
        `stance ${height}: a single frame rose ${maxRise.toFixed(3)} - only the step ladder may raise the body, and only by STEP_OFFSET (${STEP_OFFSET})`);
    }
  }
  // the law in the source, so the parameter cannot be quietly dropped
  const src = read('src/player/collider.js');
  assert.match(src, /midBody && dy > 0 && dy \/ d >= GROUND_NY/,
    'an upward-leaning face met by a MIDDLE sphere is a wall (the sideways push), never a tread');
  assert.match(src, /this\._resolveSphere\(m2, CAPSULE_RADIUS, out, standCeil, false, true\)/,
    'and the middles are the spheres that pass it');
});

// AUDIT COL1 F13: THE CEILING CLAMP ASKED ONE BEAD. "A body cannot be
// depenetrated UP into a ceiling" was enforced by re-probing the HEAD
// sphere, which was every sphere above the feet while the body was two
// beads. With middles it is one of several, so a body whose WAIST was
// wedged under a slab answered "the head is clear" and kept a rise it
// could not hold - measured, a slab at 1.10-1.45 lifted the feet by up
// to 0.35 straight into it. The clamp re-probes the whole chain.
test('AUDIT COL1 F13: the ceiling clamp re-probes every bead - a wedged WAIST reverts the rise, not just a wedged head', () => {
  for (const slabY of [1.15, 1.25, 1.40]) {
    const col = dungeonFloor();
    const q = quad(-3, slabY, -3, 3, slabY, -3, 3, slabY, 6, -3, slabY, 6);
    col.addMesh('slab', q.positions, q.indices, I);
    const entryY = -0.12;                      // started inside the floor, so the resolve wants to lift
    const feet = [0, entryY, 1];
    const out = { grounded: false, hitCeiling: false, pushedDown: false };
    col._resolveCapsule(feet, out, CAPSULE_HEIGHT);
    assert.equal(out.hitCeiling, true, `slab ${slabY}: the body is against it`);
    assert.ok(feet[1] <= entryY + 1e-9,
      `slab ${slabY}: the body rose to ${feet[1].toFixed(4)} with a bead still wedged - the clamp asked the head only`);
  }
  const src = read('src/player/collider.js');
  const clamp = src.slice(src.indexOf('if (out.hitCeiling && feet[1] > entryY) {'));
  assert.match(clamp.slice(0, 700), /for \(let i = 1; i <= middles \+ 1; i\+\+\)/,
    'from the first middle up to the head - every bead a ceiling can wedge');
});

test('COL1: every stance is covered - consecutive sphere centres OVERLAP, never merely touch', () => {
  const src = read('src/player/collider.js');
  assert.match(src, /const middles = Math\.max\(0, Math\.ceil\(axis \/ span\) - 1\);/,
    'the count is derived from the axis, never fixed');

  // AUDIT COL1 F6b: this used to recompute `2 * CAPSULE_RADIUS` inside the
  // test, so the SOURCE's spacing constant was never pinned - setting
  // `span = CAPSULE_RADIUS` (half the true diameter, so twice as many
  // spheres and a slower resolve for nothing) left both COL1 pins green.
  // The constant is read out of the source and driven.
  // AUDIT COL1 F12: and the constant is no longer a whole diameter. A
  // diameter is TANGENCY - the chain's reach falls to zero at the join -
  // so the step is a diameter times an overlap, both read from source.
  const spanSrc = /const span = ([^;]+);/.exec(src)?.[1]?.trim();
  assert.equal(spanSrc, '2 * CAPSULE_RADIUS * BEAD_OVERLAP',
    'the chain steps by a diameter LESS an overlap - a whole diameter is a join with no bite');
  const overlap = Number(/const BEAD_OVERLAP = ([\d.]+);/.exec(src)?.[1]);
  assert.ok(overlap > 0.5 && overlap < 1,
    `the overlap is a real fraction of a diameter (read ${overlap}) - 1 is tangency, small is wasted spheres`);
  const SPAN = 2 * CAPSULE_RADIUS * overlap;

  // the derivation itself, over every stance the PlayerHeightChanger has
  // AND the tall end of the foe range (SetupDemoEnemy takes the height
  // off the idle sprite, so 3+ metres is ordinary).
  for (const height of [0.30, 0.9, 1.8, 2.6, 3.0, 3.4]) {
    const axis = Math.max(0, height - 2 * CAPSULE_RADIUS);
    const middles = Math.max(0, Math.ceil(axis / SPAN) - 1);
    const centres = [0];
    for (let i = 0; i < middles; i++) centres.push((axis * (i + 1)) / (middles + 1));
    centres.push(axis);
    for (let i = 1; i < centres.length; i++) {
      const gap = centres[i] - centres[i - 1];
      assert.ok(gap <= SPAN + 1e-9,
        `stance ${height}: centres ${centres[i - 1].toFixed(2)} and ${centres[i].toFixed(2)} leave a hole`);
      // the REACH at the join - what the old "<= a diameter" pin never said
      const reach = Math.sqrt(Math.max(0, CAPSULE_RADIUS ** 2 - (gap / 2) ** 2));
      assert.ok(reach > CAPSULE_RADIUS * 0.25,
        `stance ${height}: the join at ${centres[i].toFixed(2)} bites only ${reach.toFixed(3)} - a thin slab there is walked through`);
    }
  }
});

// AUDIT COL1 F12: and the coverage is DRIVEN, not derived. The pin above
// is arithmetic about centres; this walks a body into a thin slab at
// every height along it, for every stance and the tall end of the foe
// range. It is how the last hole was found: after COL1 and F8, a 3.4 m
// foe still walked clean through a slab anywhere in 2.70-2.93, the
// tangent join between its top two beads.
test('AUDIT COL1 F12: a thin slab at ANY height along ANY body is solid - the beads leave no join to slip through', () => {
  const through = [];
  for (const height of [0.9, 1.8, 2.1, 2.6, 3.0, 3.4]) {
    for (let slabY = 0.75; slabY <= height - 0.05; slabY += 0.025) {
      const col = dungeonFloor();
      const q = quad(-3, slabY, 3, 3, slabY, 3, 3, slabY, 6, -3, slabY, 6);
      col.addMesh('slab', q.positions, q.indices, I);
      const feet = [0, 0, 0];
      for (let n = 0; n < 200; n++) col.move(feet, 0, -0.02, 0.05, height, true);
      if (feet[2] > 3.2 && feet[1] < slabY - 0.2) through.push(`h=${height} slab=${slabY.toFixed(3)} -> z=${feet[2].toFixed(2)} at y=${feet[1].toFixed(2)}`);
    }
  }
  assert.deepEqual(through, [], `a body walked through a slab it should have been stopped by:\n${through.join('\n')}`);
});
