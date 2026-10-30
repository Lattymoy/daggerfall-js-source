// BOW-BLOOM (combat/bowBloom.js, ui/bowBloomRing.js): a bow shot flies inside a circle each quick shot widens and a
// rest shrinks; the first shot after a rest flies true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOW_BLOOM, BOW_FAST, BOW_KINDS, bowKindOf, bowShotStamp, bowBloomNow, bowBloomShot, bowFastShot, bowFastDamage, whileShaftLands, landingShaft, _resetBowBloomForTests } from '../../src/combat/bowBloom.js';
import { bloomRingPx, paintBowBloomRing } from '../../src/ui/bowBloomRing.js';
import { ArrowFlight, shaftOnRelayBody } from '../../src/combat/arrowFlight.js';

const deg = (a, b) => (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
const FWD = [0, 0, -1];

test('BOW-BLOOM THE LAW: 2 degrees a shot, 8 at most, 3 a second back (mutants: a step moved; the cap off)', () => {
  assert.deepEqual({ ...BOW_BLOOM }, { step: 2, most: 8, settle: 3 });
});

test('BOW-BLOOM: the first shot flies true; a quick one strays inside the circle as it stood; spam caps at 8 degrees (mutants: the first shot bloomed; the settle unread)', () => {
  _resetBowBloomForTests();
  assert.deepEqual(bowBloomShot(FWD, 100, () => 1), FWD, 'the first shot true');
  assert.equal(bowBloomNow(100), 2);
  const second = bowBloomShot(FWD, 100.25, () => 1);   // the edge of the disc: 2 - 0.75 = 1.25 degrees
  assert.ok(Math.abs(deg(second, FWD) - 1.25) < 1e-6, `${deg(second, FWD)}`);
  for (let k = 2; k < 20; k++) bowBloomShot(FWD, 100 + k * 0.25, () => 0.5);
  assert.equal(bowBloomNow(104.75), BOW_BLOOM.most, 'four a second: the widest');
  for (let k = 0; k < 50; k++) assert.ok(deg(bowBloomShot(FWD, 105, Math.random), FWD) <= BOW_BLOOM.most + 1e-9, 'never past the circle');
  assert.equal(bowBloomNow(105 + 8 / 3), 0, 'a rest closes it');
});

test('BOW-BLOOM: an archer loosing every 0.9 s never blooms past one step; every 0.57 s it grows slowly (mutants: the settle unread)', () => {
  _resetBowBloomForTests();
  for (let k = 0; k < 30; k++) bowBloomShot(FWD, 200 + k * 0.9);
  assert.ok(bowBloomNow(200 + 29 * 0.9) <= BOW_BLOOM.step, 'a Speed-50 archer: one step at most');
  _resetBowBloomForTests();
  for (let k = 0; k < 6; k++) bowBloomShot(FWD, 300 + k * 0.57);
  const r = bowBloomNow(300 + 5 * 0.57);
  assert.ok(r > BOW_BLOOM.step && r < 4, `a Speed-70 archer: ${r.toFixed(2)} after six`);
});

test('BOW-BLOOM THE RING: its size on screen, hidden once it closes (mutants: the field of view unread)', () => {
  assert.equal(bloomRingPx(8, 1000, Math.PI / 3), Math.round((1000 * Math.tan((8 * Math.PI) / 180)) / Math.tan(Math.PI / 6)));
  assert.ok(bloomRingPx(8, 1000, Math.PI / 2) < bloomRingPx(8, 1000, Math.PI / 3), 'a wider view, a smaller ring');
  const ring = { style: /** @type {Record<string, string>} */ ({}) };
  paintBowBloomRing(ring, 4, 1000, Math.PI / 3);
  assert.equal(ring.style.display, 'block');
  assert.equal(ring.style.width, `${bloomRingPx(4, 1000, Math.PI / 3)}px`);
  paintBowBloomRing(ring, 0, 1000, Math.PI / 3);
  assert.equal(ring.style.display, 'none');
});

test('BOW-BLOOM THE LANE: a player\'s bow shot blooms; a foe\'s, a technique\'s never (mutants: the lane unwired; a technique bloomed)', () => {
  _resetBowBloomForTests();
  const fl = new ArrowFlight({ getGpuMesh: () => null });
  fl.fire([0, 0, 0], FWD, { fromPlayer: true, weapon: null });
  assert.ok(bowBloomNow() > BOW_BLOOM.step - 0.1, 'the player\'s shot widened the circle');
  _resetBowBloomForTests();
  fl.fire([0, 0, 0], FWD, { fromPlayer: false, weapon: null });
  fl.fire([0, 0, 0], FWD, { fromPlayer: true, weapon: null, technique: { id: 'volley' } });
  assert.equal(bowBloomNow(), 0, 'a foe\'s shot and a technique\'s leave it');
  _resetBowBloomForTests();
});

test('BOW-FAST THE LAW: 20% a stack, 4 at most, a shot within 1 s of the last (mutants: the cut moved; the cap off)', () => {
  assert.deepEqual({ ...BOW_FAST }, { cut: 20, most: 4, within: 1 });
});

test('BOW-FAST: a rested shot whole; each quick one a stack more, to four; a rest clears them; at least 1 lands (mutants: the window unread; the floor off)', () => {
  _resetBowBloomForTests();
  assert.deepEqual([0, 0.25, 0.5, 0.75, 1, 1.25].map((t) => bowFastShot(400 + t)), [0, 1, 2, 3, 4, 4]);
  assert.equal(bowFastShot(403), 0, 'a rest of a second or more: whole again');
  assert.deepEqual([0, 1, 2, 3, 4].map((fast) => bowFastDamage({ fast }, 50)), [50, 40, 30, 20, 10]);
  assert.equal(bowFastDamage({ fast: 4 }, 2), 1, 'never nothing where it was something');
  assert.equal(bowFastDamage(null, 30), 30, 'no shaft: whole');
  _resetBowBloomForTests();
  for (let k = 0; k < 30; k++) bowFastShot(500 + k * 0.9);
  assert.equal(bowFastShot(500 + 30 * 0.9), 4, 'every 0.9 s is inside the window: it stacks');
});

test('BOW-FAST THE LANE: the player\'s bow shaft carries its stacks; a duel\'s door reads the shaft landing; a foe\'s shaft none (mutants: the stamp off; the landing unset)', () => {
  _resetBowBloomForTests();
  const fl = new ArrowFlight({ getGpuMesh: () => null });
  fl.fire([0, 0, 0], FWD, { fromPlayer: true, weapon: null });
  fl.fire([0, 0, 0], FWD, { fromPlayer: true, weapon: null });
  fl.fire([0, 0, 0], FWD, { fromPlayer: false, weapon: null });
  assert.deepEqual(fl.arrows.map((a) => a.fast), [0, 1, undefined]);
  assert.equal(landingShaft(), null);
  assert.equal(whileShaftLands({ fast: 2 }, () => bowFastDamage(landingShaft(), 100)), 60);
  assert.equal(landingShaft(), null, 'cleared after');
  assert.equal(shaftOnRelayBody({ fast: 3 }, { name: 'x' }, 50), 20);
});

test('BOW-KINDS: the short bow whole at 0.75 s, its circle back 4 a second; the long bow whole at 1.25 s and x1.5; any other bow the plain law; paced, the two land about the same a second (mutants: a window moved; the pull unread; the settle unread)', () => {
  const SHORT = { templateIndex: 129 }, LONG = { templateIndex: 130 };
  assert.deepEqual([bowKindOf(SHORT), bowKindOf(LONG)], [BOW_KINDS[129], BOW_KINDS[130]]);
  assert.deepEqual({ ...bowKindOf(null) }, { within: BOW_FAST.within, settle: BOW_BLOOM.settle, pull: 1 });
  _resetBowBloomForTests();
  assert.deepEqual([0, 0.75, 1.5].map((t) => bowShotStamp(SHORT, 700 + t).fast), [0, 0, 0], 'the short bow every 0.75 s: whole');
  _resetBowBloomForTests();
  assert.deepEqual([0, 1, 2].map((t) => bowShotStamp(LONG, 800 + t)), [{ fast: 0, pull: 1.5 }, { fast: 1, pull: 1.5 }, { fast: 2, pull: 1.5 }], 'the long bow every second: it stacks');
  assert.equal(bowShotStamp(LONG, 803.25).fast, 0, 'the long bow after 1.25 s: whole');
  assert.equal(bowFastDamage({ fast: 0, pull: 1.5 }, 12), 18);
  assert.equal(bowFastDamage({ fast: 1, pull: 1.5 }, 12), 14);
  // paced: the short bow's mean 11 every 0.75 s against the long bow's 12 x1.5 every 1.25 s
  assert.ok(Math.abs(11 / 0.75 - 18 / 1.25) < 0.5);
  _resetBowBloomForTests();
  bowBloomShot(FWD, 900, () => 0.5, BOW_KINDS[129]);
  assert.equal(bowBloomNow(900.25), 1, 'the short bow\'s circle: 2 - 4 x 0.25');
  bowBloomShot(FWD, 901, () => 0.5, BOW_KINDS[130]);
  assert.equal(bowBloomNow(901.5), 0.5, 'the long bow\'s: 2 - 3 x 0.5');
});
