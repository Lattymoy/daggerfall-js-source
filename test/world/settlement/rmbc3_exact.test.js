// RMB-CONTRACTS RMBC3 (bible/03-World/RMB-Contracts.md RD-13): THE SAME PLAN ON EVERY ENGINE - the generator's sines, cosines,
// angles and lengths are built from exactly rounded arithmetic (exactMath.js), so a plan is a function of its inputs alone.
// The golden prints hold three plans bit for bit: a change that moves one is a new GENERATOR_VERSION, said in its record.
// In the settlements' own lane past the Bay (Hammerfell's ground). Pins mutation-checked (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dsin, dcos, datan2, dhypot } from '../../../src/world/settlement/exactMath.js';
import { generateSettlement, dressSettlement, layoutSettlement, GENERATOR_VERSION } from '../../../src/world/settlement/settlementGen.js';
import { settlementPrint } from '../../../src/world/settlement/settlementContract.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const PLACE = ((0x342 << 20) | 0x80000) >>> 0;

test('RMBC3 exact math: within 2e-15 of Math across turns either way, the quarters and the signs (mutants: a quarter swapped, a term dropped, the halving)', () => {
  let worst = 0;
  for (let i = -20000; i <= 20000; i++) {
    const x = i * 0.00157;
    worst = Math.max(worst, Math.abs(dsin(x) - Math.sin(x)), Math.abs(dcos(x) - Math.cos(x)));
    const y = Math.sin(i * 1.7) * 50, z = Math.cos(i * 0.37) * 30;
    worst = Math.max(worst, Math.abs(datan2(y, z) - Math.atan2(y, z)), Math.abs(dhypot(y, z) - Math.hypot(y, z)) / (1 + Math.hypot(y, z)));
  }
  assert.ok(worst < 2e-15, `worst ${worst}`);
  assert.deepEqual([datan2(0, 0), datan2(0, -1), datan2(-1, 0), datan2(1, 0)], [0, Math.PI, -Math.PI / 2, Math.PI / 2]);
});

test('RMBC3 the generator reads no engine\'s Math.sin, cos, atan2 or hypot (mutant: one put back)', () => {
  for (const f of ['settlementGen.js', 'settlementLayout.js', 'settlementGeometry.js', 'settlementContract.js', 'settlementGround.js']) {
    assert.doesNotMatch(readFileSync(new URL(`../../../src/world/settlement/${f}`, import.meta.url), 'utf8'), /Math\.(sin|cos|tan|atan2?|hypot|exp|pow|log)\(/, f);
  }
});

test('RMBC3 golden prints: three plans bit for bit at generator version 1 (mutant: any change to the layout)', () => {
  assert.equal(GENERATOR_VERSION, 1);
  const print = (archetype) => settlementPrint(generateSettlement({ place: PLACE, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 7, archetype, style: 'Hammerfell', site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC[archetype] }).plan);
  assert.deepEqual([print('fort'), print('river'), print('wetland')], [2924236142, 3082883572, 3655091972]);
});

test('RMBC3 one layout, two parts: the worker\'s layout dressed is the whole generator\'s plan; its dressing draws on the seed too (mutants: either part unseeded)', () => {
  const input = { place: PLACE, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 7, archetype: 'village', style: 'Skyrim', site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC.village };
  const L = JSON.parse(JSON.stringify(layoutSettlement(input, input.env)));   // as the worker hands it over: plain records
  assert.equal(settlementPrint(dressSettlement(input, L).plan), settlementPrint(generateSettlement(input).plan));
  assert.notEqual(settlementPrint(dressSettlement({ ...input, seed: 8 }, L).plan), settlementPrint(dressSettlement(input, L).plan));
});
