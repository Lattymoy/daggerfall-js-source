// BOW-BLOOM (combat/bowBloom.js, ui/bowBloomRing.js): a bow shot flies inside a circle each quick shot widens and a
// rest shrinks; the first shot after a rest flies true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOW_BLOOM, bowBloomNow, bowBloomShot, _resetBowBloomForTests } from '../../src/combat/bowBloom.js';
import { bloomRingPx, paintBowBloomRing } from '../../src/ui/bowBloomRing.js';
import { ArrowFlight } from '../../src/combat/arrowFlight.js';

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
});
