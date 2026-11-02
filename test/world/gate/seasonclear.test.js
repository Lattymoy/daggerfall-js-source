// STOREFRONT, AUDIT LANE 5 (2026-10-29; bible/03-World/World-Of-Daggerfall.md, the clearings): A SET OF CLEARINGS ASKED BY
// PIXEL. The season's set is the gate and 129 Brass Fissures, and every flat of every pixel built - and every stride of
// the sweep at the set's turn - asked all of them: 4,000 flats 44-65 ms where the gate alone took under one, and the sweep
// half a second. Now a box asks only the members on the pixels it reaches (world/gate/gateClearance.js setNear), so the
// same boxes clear - pinned against the walk over every member - and a member far off is never read.
// tools/mutants/storefront_seasonaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  gateClearFor, gateClearSet, boxNearGate, pointNearGate, reachNearGate, createGateClearSweep, GATE_CLEAR_M, RITE_CLEAR_M, FISSURE_ROCK_M, STAR_ROCK_M,
} from '../../../src/world/gate/gateClearance.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';

const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
/** The walk the set's question was: every member asked. */
const walk = (set, px, py, x0, z0, x1, z1, m) => set.list.some((c) => boxNearGate(c, px, py, x0, z0, x1, z1, m));
/** A season's set: the gate (its circle beside it) on pixel (500, 200), 129 fissures over a 30-pixel square - some on
 *  their pixel's very edges and corners - an arch and a star. */
function seasonSet(rand = seeded()) {
  const gate = gateClearFor({ day: 3001, px: 500, py: 200, spot: [3, PIXEL_M - 4] });
  const fissures = [];
  for (let k = 0; k < 129; k++) {
    const edge = k % 4 === 0;
    const x = edge ? [1, PIXEL_M - 1][k % 8 ? 1 : 0] : 100 + rand() * 600, z = edge ? [2, PIXEL_M - 2][(k >> 3) % 2] : 100 + rand() * 600;
    fissures.push({ f: `1.2.${k}.0`, px: 490 + Math.floor(rand() * 30), py: 190 + Math.floor(rand() * 30), x, z });
  }
  return gateClearSet(gate, [{ b: 'eg1', px: 501, py: 200, x: 2, z: 5 }], [{ s: 'star1', px: 499, py: 201, x: PIXEL_M - 3, z: PIXEL_M - 1 }], fissures);
}

test('AUDIT LANE 5 (1): the same boxes clear - the set asked by pixel answers as the walk over every member, at its edges and its corners, a box across pixels, reversed, past the span, or not a number (mutants: a box\'s pixels one short; the members\' reach one short; a member past the span lost)', () => {
  const set = seasonSet();
  assert.equal(set.list.length, 132);
  const rand = seeded(11);
  let near = 0, n = 0;
  const ask = (px, py, x0, z0, x1, z1, m) => { const a = boxNearGate(set, px, py, x0, z0, x1, z1, m); assert.equal(a, walk(set, px, py, x0, z0, x1, z1, m), `${px},${py} [${x0},${z0},${x1},${z1}] +${m}`); n++; if (a) near++; };
  for (const c of set.list) {
    for (let i = 0; i < 40; i++) {
      // a box about each member, asked from its own pixel and from the ones about it - the clearing's edge each way
      const dx = Math.floor(rand() * 3) - 1, dy = Math.floor(rand() * 3) - 1, px = c.px + dx, py = c.py + dy;
      const r = (c.r ?? GATE_CLEAR_M) + (rand() * 6 - 3);
      const gx = (c.px - px) * PIXEL_M + c.x, gz = (py - c.py) * PIXEL_M + c.z, a = rand() * 2 * Math.PI, w = rand() < 0.5 ? 0 : rand() * 40;
      const x0 = gx + Math.cos(a) * r, z0 = gz + Math.sin(a) * r;
      ask(px, py, x0, z0, x0 + w, z0 + w * 0.5, rand() < 0.5 ? 0 : rand() * 8);
      ask(px, py, x0 + w, z0, x0, z0 - w, 2);   // reversed
    }
  }
  const g = set.list[0];
  ask(g.px, g.py, g.rx + RITE_CLEAR_M - 0.5, g.rz, g.rx + RITE_CLEAR_M - 0.5, g.rz, 0);   // the circle's edge
  ask(500, 200, -2000, -2000, 9000, 9000, 0);   // past the span: every member asked
  ask(500, 200, NaN, 0, 5, 5, 0);
  ask(10, 10, 0, 0, PIXEL_M, PIXEL_M, 30);   // far from every member
  // a box whose margin alone carries it to a member over its pixel's edge - the member's own reach stops short of it
  const edge = gateClearSet(null, [], [], [{ f: 'edge', px: 600, py: 300, x: PIXEL_M - FISSURE_ROCK_M - 5, z: 400 }]);
  assert.equal(boxNearGate(edge, 601, 300, 1, 400, 1, 400, 8), true, 'its margin reaches it');
  assert.equal(boxNearGate(edge, 601, 300, 1, 400, 1, 400, 4), false);
  // a member whose reach spans more pixels than a box is asked across (EG-F's `r`, any reach): asked by every box
  const wide = Object.freeze({ key: 'w', list: Object.freeze([...set.list.slice(0, 3), Object.freeze({ key: 'big', px: 500, py: 200, x: 10, z: 10, r: 9000 })]) });
  for (const [px, py] of [[500, 200], [507, 195], [530, 230]]) assert.equal(boxNearGate(wide, px, py, 400, 400, 401, 401, 0), walk(wide, px, py, 400, 400, 401, 401, 0), `${px},${py}`);
  assert.equal(boxNearGate(wide, 507, 195, 400, 400, 401, 401, 0), true);
  assert.ok(near > n / 4 && near < n * 3 / 4, `${near} of ${n} near: both answers asked`);
  assert.equal(pointNearGate(set, g.px, g.py, g.x + GATE_CLEAR_M - 0.1, g.z), true);
  assert.equal(FISSURE_ROCK_M < STAR_ROCK_M, true);
});

/** A set whose members count every read of them - the producer's own members, read through a proxy. */
function counted(set) {
  const n = { reads: 0 };
  const list = set.list.map((c) => new Proxy(c, { get: (o, k) => { n.reads++; return o[k]; } }));
  return { set: Object.freeze({ key: set.key, list: Object.freeze(list) }), n };
}

test('AUDIT LANE 5 (1): a flat asks the members on the pixels it reaches - none off them, after the set\'s one indexing; 4,000 flats of a pixel no member reaches read none (mutants: every member walked)', () => {
  const { set, n } = counted(seasonSet());
  boxNearGate(set, 0, 0, 0, 0, 1, 1, 0);   // the first ask indexes the set
  n.reads = 0;
  for (let i = 0; i < 4000; i++) pointNearGate(set, 600, 300, (i * 37) % 819, (i * 91) % 819, 2);
  assert.equal(n.reads, 0, 'a pixel no clearing reaches reads no member');
  const c = set.list[5];
  n.reads = 0;
  assert.equal(pointNearGate(set, c.px, c.py, c.x, c.z, 0), true);
  assert.ok(n.reads > 0 && n.reads < 40, `${n.reads} reads: the members on its pixel alone`);
});

test('AUDIT LANE 5 (1): the sweep at the season\'s turn asks each stride the clearings come on its pixels - the same pixels built again as the walk would, the members read a few times, not a stride\'s worth each (mutants: the come walked whole)', () => {
  const real = seasonSet();
  const gateOnly = gateClearSet(real.list[0]);
  const built = new Map(), rand = seeded(5);
  for (let i = 0; i < 81; i++) {
    const px = 490 + (i % 9) * 3, py = 190 + Math.floor(i / 9) * 3, reach = [];
    for (let k = 0; k < 400; k++) { const x = rand() * PIXEL_M, z = rand() * PIXEL_M; reach.push(x, z, x + 3, z + 3, rand() * 4); }
    built.set(`${px},${py}`, { px, py, gateClearKey: gateOnly.key, gateRefused: false, wodReach: reach });
  }
  // the walk's answer, before the sweep marks anything current
  const want = [...built.values()].filter((p) => real.list.slice(1).some((c) => reachNearGate(p.wodReach, c, p.px, p.py))).map((p) => `${p.px},${p.py}`).sort();
  const { set, n } = counted(real);
  const sweep = createGateClearSweep();
  sweep.step(gateOnly, new Map());
  const again = sweep.step(set, built).map((p) => `${p.px},${p.py}`).sort();
  assert.deepEqual(again, want);
  assert.ok(want.length > 0 && want.length < 81, `${want.length} built again`);
  assert.ok(n.reads < 81 * 400 * 5, `${n.reads} member reads over 81 pixels of 400 strides - the walk asked all 131 at each`);
});
