// PEAKS2 (2026-10-26, bible/03-World/Peaks.md PEAKS2; the owner: "The world of daggerfall mountains need to be completely
// redesigned from the ground up with more integration into the terrian ...") - THE MASSIF'S SHAPE, built whole and NOT
// WIRED: world/peaks/massif.js, the relief the kernel's shaper is to stand where LANDFORM8's cones stood. Held here: the
// foothills grade it in from nothing; it is centred on the land (the heightmap's shape stands); its spurs run down the
// fall line; its crests rise to summits and fall to saddles; it is a function of world position alone (a seam one number);
// it costs at most eight noise reads a sample; and its faces stand far less steep than the cones' did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MASSIF_DIALS, MASSIF_NORM, massifAmp, massifShape, massifAt } from '../../src/world/peaks/massif.js';
import { perlinNoise } from '../../src/world/perlin.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const signed = (x, y) => 2 * perlinNoise(x, y) - 1;
/** A unit fall line's doubled angle, from its angle (radians). */
const fall = (t) => [Math.cos(2 * t), Math.sin(2 * t)];

test('PEAKS2 THE FOOTHILLS: the massif\'s relief is nothing to `foot` over the knee, rises smoothly and never falls, and is whole (`high`) from `crest` up; on the low ground massifAt is 0 whatever the shape (mutants: the foot, the crest, the high, the low ground\'s zero)', () => {
  const D = MASSIF_DIALS;
  assert.deepEqual([D.foot, D.crest, D.high], [240, 1500, 300]);
  assert.equal(massifAmp(0), 0);
  assert.equal(massifAmp(D.foot), 0);
  assert.equal(massifAmp(D.crest), D.high);
  assert.equal(massifAmp(D.crest + 900), D.high);
  near(massifAmp((D.foot + D.crest) / 2), D.high / 2, 1e-9, 'half way, half');
  let last = 0;
  for (let e = 0; e <= 2000; e += 10) { const a = massifAmp(e); assert.ok(a >= last - 1e-12, `never falls (${e})`); assert.ok(a - last < 4, `smooth (${e})`); last = a; }
  for (const [x, y] of [[100, 200], [5000, 3100], [-800, 77]]) assert.equal(massifAt(x, y, 1, 0, 0.3, D.foot - 1), 0, 'the low ground');
  near(massifAt(4321, 1234, 1, 0, 0.3, 2000), D.high * massifShape(4321, 1234, 1, 0, 0.3), 1e-9, 'the whole relief its shape');
});

test('PEAKS2 CENTRED ON THE LAND: over 40 km of world positions the shape\'s mean is the land\'s (within 0.01 of nothing) on a flank, on a crest and between, for any fall line; its spread about half its unit; never past 1.6 either way (mutants: the spurs\' centre, the crest\'s centre, a gain)', () => {
  for (const [grade, t] of [[0.5, 0], [0.5, 0.7], [0, 0], [0.06, 1.9]]) {
    const [c2, s2] = fall(t);
    let n = 0, s = 0, ss = 0, lo = Infinity, hi = -Infinity;
    for (let y = -20000; y < 20000; y += 97) for (let x = -20000; x < 20000; x += 101) {
      const v = massifShape(x, y, c2, s2, grade);
      n++; s += v; ss += v * v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    const mean = s / n, sd = Math.sqrt(ss / n - mean * mean);
    assert.ok(Math.abs(mean) < 0.01, `mean ${mean} (grade ${grade}, ${t})`);
    assert.ok(sd > 0.3 && sd < 0.6, `spread ${sd} (grade ${grade}, ${t})`);
    assert.ok(lo > -1.6 && hi < 1.6, `range ${lo}..${hi}`);
  }
  assert.deepEqual(MASSIF_NORM, { spurs: [0.979, 1.6], crest: [0.401, 2.68] });
});

test('PEAKS2 THE SPURS RUN DOWN THE FALL LINE: on a flank the shape changes far less along the fall line than across it, whichever way the land falls (mutants: the stretch, the frames\' axis)', () => {
  for (const t of [0, 0.5, 1.1, 2.6]) {
    const [c2, s2] = fall(t), ax = Math.cos(t), ay = Math.sin(t), step = 60;
    let along = 0, across = 0, n = 0;
    for (let k = 0; k < 4000; k++) {
      const x = (k * 7919) % 30000, y = (k * 104729) % 30000;
      const v = massifShape(x, y, c2, s2, 0.5);
      along += Math.abs(massifShape(x + ax * step, y + ay * step, c2, s2, 0.5) - v);
      across += Math.abs(massifShape(x - ay * step, y + ax * step, c2, s2, 0.5) - v);
      n++;
    }
    assert.ok(along < 0.7 * across, `fall line ${t}: along ${(along / n).toFixed(3)} across ${(across / n).toFixed(3)}`);
  }
});

test('PEAKS2 SUMMITS AND SADDLES: on the high ground (no grade) the crest field\'s crest lines rise to summits and fall to saddles - a tenth of 60 km of crest rows stand under three quarters of the crest\'s top (with no saddles every row stands within a tenth of it), and the summits stand well over the land (mutants: the saddle\'s depth, the saddles\' field)', () => {
  // walk the field: at each row the crest is the highest sample of a cross-section; along the rows it rises and falls
  const rows = [];
  for (let y = 0; y < 9000; y += 120) {
    let best = -Infinity;
    for (let x = 0; x < 2200; x += 20) best = Math.max(best, massifShape(x, y, 1, 0, 0));
    rows.push(best);
  }
  rows.sort((a, b) => a - b);
  const top = rows[rows.length - 1], p10 = rows[Math.floor(rows.length * 0.1)];
  assert.ok(rows.length > 50);
  assert.ok(top > 0.9, `the summits ${top}`);
  assert.ok(p10 < 0.75 * top, `saddles: a tenth of the crest's rows under ${p10.toFixed(2)} against its top ${top.toFixed(2)}`);
  assert.equal(MASSIF_DIALS.saddle, 0.35);
});

test('PEAKS2 ONE FUNCTION OF WORLD POSITION: the same number at a pixel\'s east edge and its neighbour\'s west edge (both a world position), from any reader, any order; blended between two frames without a step (mutants: a reader\'s own state)', () => {
  const span = 128;
  for (const [px, py] of [[10, 20], [517, 230], [-40, 600]]) {
    for (let y = 0; y <= span; y += 16) {
      const a = massifAt(px * span + span, py * span + y, 0.3, 0.95, 0.2, 1600), b = massifAt((px + 1) * span + 0, py * span + y, 0.3, 0.95, 0.2, 1600);
      assert.equal(a, b);
    }
  }
  const first = massifShape(1234.5, 678.25, 0.8, 0.6, 0.04);
  for (let k = 0; k < 50; k++) massifShape(k * 311, k * 97, -0.6, 0.8, 0.5);
  assert.equal(massifShape(1234.5, 678.25, 0.8, 0.6, 0.04), first, 'pure');
  // the fall line turning by a hundredth of a radian never jumps the land
  for (let t = 0; t < Math.PI; t += 0.01) {
    const [c0, s0] = fall(t), [c1, s1] = fall(t + 0.01);
    assert.ok(Math.abs(massifShape(5555, 4444, c1, s1, 0.5) - massifShape(5555, 4444, c0, s0, 0.5)) < 0.12, `turn at ${t.toFixed(2)}`);
  }
  // the grade passing a flank's threshold never jumps it either
  for (let g = 0; g < 0.12; g += 0.001) assert.ok(Math.abs(massifShape(777, 999, 1, 0, g + 0.001) - massifShape(777, 999, 1, 0, g)) < 0.06, `grade ${g.toFixed(3)}`);
});

test('PEAKS2 THE COST: at most six noise reads a sample and under four on the mean (a flank\'s one frame two, the turn between two frames four, the crest two more where a flank meets the high ground) - against the Mountain land\'s ridgelines\' three to six and LANDFORM8\'s cones\' up to four cells of seven hashes, which it is to stand in place of (mutants: an octave more)', () => {
  let calls = 0;
  const counting = (x, y) => { calls++; return signed(x, y); };   // the same noise, counted
  let worst = 0, total = 0, n = 0;
  for (let k = 0; k < 2000; k++) {
    const t = (k % 157) / 50, [c2, s2] = fall(t), g = (k % 13) / 100;
    calls = 0;
    massifShape((k * 7919) % 30000, (k * 104729) % 30000, c2, s2, g, counting);
    worst = Math.max(worst, calls); total += calls; n++;
  }
  assert.ok(worst <= 6, `worst ${worst}`);
  assert.ok(total / n < 4, `mean ${(total / n).toFixed(2)}`);
  assert.match(readFileSync('src/world/peaks/massif.js', 'utf8'), /NOT WIRED YET/, 'the module says it stands unwired');
});

test('PEAKS2 A FLANK, NOT A FIELD OF SPIKES: at its whole relief on a flank the massif stands under 2% of its ground past 52 degrees (SNOW-FACE counted a third of a high Mountain pixel past it under the cones and the ridged hills), its steepest face under 65 degrees (mutants: the spurs\' spacing, the high)', () => {
  const cell = 6.4, unit = 1.25;   // a sample (m) and a kernel unit (m)
  const f = (x, y) => massifAt(x, y, 1, 0, 0.5, 2000);
  let over = 0, n = 0, worst = 0;
  for (let y = 0; y < 6000; y += 13) for (let x = 0; x < 6000; x += 17) {
    const hx = (f(x + 1, y) - f(x - 1, y)) * unit / (2 * cell), hy = (f(x, y + 1) - f(x, y - 1)) * unit / (2 * cell);
    n++;
    const g = Math.hypot(hx, hy);
    if (g > worst) worst = g;
    if (1 / Math.hypot(hx, hy, 1) < 0.62) over++;
  }
  assert.ok(over / n < 0.02, `past 52 degrees: ${(100 * over / n).toFixed(2)}%`);
  assert.ok(Math.atan(worst) * 180 / Math.PI < 65, `the steepest ${(Math.atan(worst) * 180 / Math.PI).toFixed(1)} degrees`);
  assert.ok(over > 0, 'and some faces still stand steep - a range, not a dome');
  assert.equal(MASSIF_DIALS.across, 380);
});
