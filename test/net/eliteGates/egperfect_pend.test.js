// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect. Traversing between sections should present a challenge, platforming should be detailed"; bible/11-Multiplayer/
// Elite-Gates.md section 10.3, THE PENDULUM): THE TOUCH IS THE DRAWN WEIGHT'S. The judge (net/eliteGates/egSpanLaw.js egPendHits -
// the screen's cast-back, scenes/eliteGates/egSpan.js ride) took feet from 0.6 m under the step to 2.2 m over it, while the screen
// draws the weight from the step's top to a metre over it (egPendModel): a jump that cleared the drawn block by a metre was cast
// back, and a head in it from below never was. Now the body's height (its feet to CAPSULE_HEIGHT over them) meets the weight's
// drawn height. The solver asks it of a body at the step's own height, where both bands agree - no course moves (the goldens:
// test/net/eliteGates/egaudit5_f.test.js). Fixtures from the producers: the law's own Pendulum, the screen's own model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egPendAt, egPendHits, EG_PEND_HALF, EG_PEND_BODY_H, EG_BODY_R } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egPendModel } from '../../../src/scenes/eliteGates/egSpan.js';
import { CAPSULE_HEIGHT, CROUCH_HEIGHT } from '../../../src/player/motor.js';

test('EG-PERFECT THE PENDULUM\'S TOUCH IS ITS DRAWN WEIGHT\'S (section 10.3): a body standing in the weight\'s path is touched; one leaping over it, feet past its drawn top, is not; one under it with its head in the block is; one wholly under it, or crouched under it, is not; swung away nothing; the body is the motor\'s capsule and the weight the screen\'s block (mutants: the old band; the body a point at its feet; the weight\'s height unread)', () => {
  assert.equal(EG_PEND_BODY_H, CAPSULE_HEIGHT, 'the motor\'s body');
  // the screen's block: its brass from the step's top to 2 x EG_PEND_HALF over it (its chain above, thin)
  const P = egPendModel().positions;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i]) > 0.1) { lo = Math.min(lo, P[i + 1]); hi = Math.max(hi, P[i + 1]); }
  assert.deepEqual([lo, hi], [0, 2 * EG_PEND_HALF], 'the weight as drawn');
  let s = null;
  for (let seed = 1; seed < 200 && !s; seed++) for (let h = 51; h <= 100 && !s; h++) s = egHallOf(seed, h, 0).steps.find((q) => q.kind === 'pend' && q.period > 0) ?? null;
  assert.ok(s, 'a Pendulum the law lays');
  // the instant its weight crosses the course's middle
  const t = (((Math.PI - s.phase) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * s.period / (2 * Math.PI), w = egPendAt(s, t);
  assert.ok(Math.abs(w.x - s.x) < 1e-6, 'at the middle');
  const at = (dy, h) => egPendHits(s, t, w.x, s.y + dy, w.z, h);
  assert.equal(at(0), true, 'standing in its path: touched');
  assert.equal(at(2 * EG_PEND_HALF - 0.05), true, 'feet just under its top: touched');
  assert.equal(at(2 * EG_PEND_HALF + 0.05), false, 'leaping over it, feet past its drawn top: clear');
  assert.equal(at(1.5), false, 'a metre and a half over the step - the old band\'s cast-back - clear');
  assert.equal(at(-1.0), true, 'under it, its head in the block: touched');
  assert.equal(at(-EG_PEND_BODY_H - 0.05), false, 'wholly under it: clear');
  assert.equal(at(-1.0, CROUCH_HEIGHT), false, 'crouched under it: clear');
  assert.equal(egPendHits(s, t, w.x + 2 * (EG_PEND_HALF + EG_BODY_R), s.y, w.z), false, 'beside it: clear');
  assert.equal(egPendHits(s, t + s.period / 4, w.x, s.y, w.z), false, 'swung away: clear');
});

