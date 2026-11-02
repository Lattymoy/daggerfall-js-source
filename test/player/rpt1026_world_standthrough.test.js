// RPT1026-WORLD STAND-THROUGH (a private report, 2026-10-22: in dungeons a crouch and a jump left the level's geometry,
// a low ceiling held nobody, and the treasure of an upper room was taken through its floor from below):
// A STAND NEVER PUTS THE HEAD PAST A FACE. DFU's CanStand sweeps to feet + 1.25 (AUDIT 64 F5), and DoStand raises the
// capsule to 1.8 - so under a ceiling 1.25 to 1.45 m over the feet the standing head sphere's centre stood on the far
// side of the ceiling's face and the winding-blind collider pushed it out that way, up through the slab. Driven through
// the real PlayerMotor and Collider (player/motor.js standHeadClear, the stand arm of _heightAction).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, standHeadClear, CAPSULE_HEIGHT, CROUCH_HEIGHT } from '../../src/player/motor.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DT = 1 / 60;
const IN = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: false, ...o });
const quad = (c, pts) => c.addMesh('dungeon', new Float32Array(pts.flat()), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
/** A floor at 0, a ceiling through (0, h) rising `tilt` degrees to +x, and the floor of the room above `slab` m over it. */
function crawl(h, tilt = 0, slab = 0.15) {
  const t = Math.tan((tilt * Math.PI) / 180), c = new Collider(() => -Infinity);
  quad(c, [[-6, 0, -6], [6, 0, -6], [6, 0, 6], [-6, 0, 6]]);
  quad(c, [[-6, h - 6 * t, -6], [6, h + 6 * t, -6], [6, h + 6 * t, 6], [-6, h - 6 * t, 6]]);
  quad(c, [[-6, h - 6 * t + slab, -6], [6, h + 6 * t + slab, -6], [6, h + 6 * t + slab, 6], [-6, h - 6 * t + slab, 6]]);
  return { c, ceilAt: (x) => h + x * t };
}
/** A body crouched at the origin on the crawl's floor, settled. */
function crouched(c) {
  const m = new PlayerMotor(c);
  m.spawn(0, 0.02, 0);
  m.crouching = true;
  for (let k = 0; k < 20; k++) m.update(DT, IN(), 0, 0);
  return m;
}

test('STAND-THROUGH: crouched under a ceiling tilted 10 degrees at 1.35 m, the room above 0.15 m over it - a stand is refused and the body stays under the ceiling; it had stood on the room above\'s floor, 3.8 m along (mutant: the head\'s line unasked)', () => {
  const { c, ceilAt } = crawl(1.35, 10);
  const m = crouched(c);
  assert.ok(Math.abs(m.pos[1]) < 0.05 && m.crouching, 'crouched on the floor');
  m.update(DT, IN({ crouch: true }), 0, 0);
  for (let k = 0; k < 60; k++) m.update(DT, IN(), 0, 0);
  assert.equal(m.crouching, true, 'the stand refused: still crouched');
  assert.ok(Math.abs(m.pos[1]) < 0.05, `on its own floor (feet ${m.pos[1].toFixed(3)})`);
  assert.ok(m.pos[1] + m.height < ceilAt(m.pos[0]), 'under the ceiling');
  assert.ok(Math.hypot(m.pos[0], m.pos[2]) < 0.05, 'where it was');
});

test('STAND-THROUGH: flat ceilings - at 1.3 and 1.4 m the stand is refused, the body unmoved; at 1.5 and 1.7 m (the head\'s centre under the face) the body stands as DFU stands it, its head clipping, under the ceiling; at 1.2 m DFU\'s own sweep refuses (mutant: the head\'s line unasked)', () => {
  for (const h of [1.3, 1.4]) {
    const m = crouched(crawl(h).c);
    m.update(DT, IN({ crouch: true }), 0, 0);
    for (let k = 0; k < 40; k++) m.update(DT, IN(), 0, 0);
    assert.equal(m.crouching, true, `${h}: refused`);
    assert.ok(Math.abs(m.pos[1]) < 0.05, `${h}: unmoved (feet ${m.pos[1].toFixed(3)})`);
  }
  for (const h of [1.5, 1.7]) {
    const m = crouched(crawl(h).c);
    m.update(DT, IN({ crouch: true }), 0, 0);
    for (let k = 0; k < 40; k++) m.update(DT, IN(), 0, 0);
    assert.equal(m.crouching, false, `${h}: stood`);
    assert.ok(m.pos[1] + 0.35 < h, `${h}: its feet under the ceiling (feet ${m.pos[1].toFixed(3)})`);
  }
  const low = crouched(crawl(1.2).c);
  low.update(DT, IN({ crouch: true }), 0, 0);
  for (let k = 0; k < 40; k++) low.update(DT, IN(), 0, 0);
  assert.equal(low.crouching, true, '1.2: CanStand\'s own sweep');
});

test('STAND-THROUGH: a crouched jump under a 1.65 m ceiling, a stand pressed at the top of its rise (CanStand\'s sweep clear to 1.56) - refused in the air: the body comes down crouched on its own floor, its head never past the ceiling (mutant: the head\'s line unasked)', () => {
  const { c } = crawl(1.65, 0, 0.3);
  const m = crouched(c);
  let top = -Infinity, above = -Infinity;
  for (let k = 0; k < 90; k++) {
    m.update(DT, IN({ jump: k < 6, crouch: k === 8 }), 0, 0);
    top = Math.max(top, m.pos[1] + m.height - 0.35);   // the head sphere's centre
    above = Math.max(above, m.pos[1]);
  }
  assert.ok(above > 0.25, `the jump rose (${above.toFixed(3)})`);
  assert.equal(m.crouching, true, 'the stand in the air refused');
  assert.ok(top < 1.65, `the head's centre never past the ceiling (${top.toFixed(3)})`);
  assert.ok(Math.abs(m.pos[1]) < 0.05, `back on its own floor (feet ${m.pos[1].toFixed(3)})`);
});

test('STAND-THROUGH the law: the head\'s line, from the capsule\'s head now to the standing capsule\'s - a face across it refuses, none clears; a body already standing asks nothing; a stand-in collider with no ray asks nothing', () => {
  const { c } = crawl(1.35);
  assert.equal(standHeadClear(c, [0, 0, 0], CROUCH_HEIGHT), false, 'the ceiling at 1.35 across feet + 0.55 .. 1.45');
  assert.equal(standHeadClear(crawl(1.5).c, [0, 0, 0], CROUCH_HEIGHT), true, 'at 1.5: the head\'s centre stays under it');
  assert.equal(standHeadClear(c, [0, 0, 0], CAPSULE_HEIGHT), true, 'standing: no rise to ask');
  assert.equal(standHeadClear({}, [0, 0, 0], CROUCH_HEIGHT), true, 'no raycast');
});
