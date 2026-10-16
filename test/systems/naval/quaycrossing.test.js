// QUAY-CROSSING (from the field: "Docks Crossing - In Penwall Derry there are two docks crossing over and blocking each
// other") - a harbour's quays never cross. Each berth's jetty is walked landward along its own shore's normal up to
// JETTY_MAX across Deep Waters' shallow shelf (systems/naval/quays.js planQuay); round a point of land the normals of two
// berths BERTH_SPACING apart converge, and each was planned alone - the two piers stood one over the other in an X. A
// later berth's jetty now ends on an earlier berth's pier (planQuay `others`, laid in the berths' order by
// scenes/quayPool.js), and no berth is sounded whose ship and quay lie across another's (shipLife.js findHarbour quayBox).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHarbour, BERTH_QUAY_IN, BERTH_QUAY_ENDS } from '../../../src/systems/naval/shipLife.js';
import { planQuay, quayToScene, JETTY_MAX, QUAY_GAP, QUAY_WIDTH, QUAY_ENDS } from '../../../src/systems/naval/quays.js';
import { createQuayPool } from '../../../src/scenes/quayPool.js';

const SEA = 34;
/** The water off `land` with a shelf `shelf` m wide that only a boat floats on (Deep Waters' shore fit), deep past it. */
function shore(land, shelf) {
  const near = new Map();
  const dist = (x, z) => {
    const k = `${Math.round(x)},${Math.round(z)}`;
    if (near.has(k)) return near.get(k);
    let best = land(x, z) ? 0 : Infinity;
    for (let a = 0; a < 24 && best; a++) {
      const t = (a / 24) * 2 * Math.PI;
      for (let d = 4; d <= shelf; d += 4) if (land(x + Math.sin(t) * d, z + Math.cos(t) * d)) { best = Math.min(best, d); break; }
    }
    near.set(k, best);
    return best;
  };
  const depth = (x, z) => { const d = dist(x, z); return d === 0 ? -2 : d < shelf ? 1.2 : 8; };
  return { isWater: (x, z, h) => depth(x, z) > (h < 0 ? 0.05 : [0.8, 1.4, 2.5, 2.8, 3.2][h]), groundAt: (x, z) => SEA - depth(x, z) };
}
/** A plan's rectangles in the scene: [name, four corners]. */
const rects = (p, origin) => {
  const f = { ...p.frame, origin };
  return [['deck', p.quay], ['jetty', p.jetty], ['ramp', p.ramp]].filter(([, r]) => r && r.x1 - r.x0 > 0)
    .map(([k, r]) => [k, [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([x, z]) => quayToScene(f, x, z))]);
};
/** Two rectangles overlapping by more than `tol` m (separating axes). */
function overlap(a, b, tol = 0.1) {
  for (const q of [a, b]) for (let i = 0; i < 4; i++) {
    const [px, pz] = q[i], [qx, qz] = q[(i + 1) % 4], l = Math.hypot(qx - px, qz - pz), ax = (pz - qz) / l, az = (qx - px) / l;
    const sa = a.map(([x, z]) => x * ax + z * az), sb = b.map(([x, z]) => x * ax + z * az);
    if (Math.max(...sa) <= Math.min(...sb) + tol || Math.max(...sb) <= Math.min(...sa) + tol) return false;
  }
  return true;
}
const crossings = (berths, plans) => {
  const out = [];
  for (let i = 0; i < plans.length; i++) for (let j = i + 1; j < plans.length; j++) {
    for (const [ka, A] of rects(plans[i], berths[i].pos)) for (const [kb, B] of rects(plans[j], berths[j].pos)) if (overlap(A, B)) out.push(`${i}.${ka} x ${j}.${kb}`);
  }
  return out;
};
const settle = () => new Promise((r) => setTimeout(r, 0));
function poolOf(harbour, groundAt) {
  const w = { ground: groundAt };
  const pool = createQuayPool({
    renderer: { createMesh: (m) => ({ m }), destroyMesh: () => {}, drawMesh: () => {} }, prepare: async () => {},
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), harbours: () => [{ key: 'port:1', name: 'Penwall Derry', harbour }],
    seaY: () => SEA, groundAt: (x, z) => w.ground(x, z), feet: () => [harbour.mouth[0], SEA, harbour.mouth[1]], mode: () => 'exterior', now: () => 0,
  });
  return { pool, w };
}

// a bay between two horns of land, an 80 m shelf all round: the horns' berths walk their jetties into the same point
const BAY = (x, z) => z > 0 && !(x * x + z * z < 150 ** 2 && z < 120);
const BAY_TOWN = { minX: -100, maxX: 100, minZ: 130, maxZ: 300 };

test('QUAY-CROSSING THE JETTIES: round a point of land each berth\'s jetty walked landward along its own shore\'s normal met another\'s - a later berth\'s jetty ends on the earlier berth\'s pier, never across it; every quay still reaches the land (mutant: each berth planned alone)', async () => {
  const { isWater, groundAt } = shore(BAY, 80);
  const h = findHarbour({ rect: BAY_TOWN, isWater });
  assert.ok(h && h.berths.length >= 5, 'the bay\'s harbour');
  const { pool } = poolOf(h, groundAt);
  pool.frame(); await settle();
  const plans = pool.standing().map((s) => s.plan);
  assert.equal(plans.length, h.berths.length, 'every berth laid');
  assert.deepEqual(crossings(h.berths, plans), [], 'no two piers cross');
  let ends = 0;
  for (const [i, p] of plans.entries()) {
    assert.ok(p.jetty && p.jetty.x1 - p.jetty.x0 > 20, `berth ${i}: a pier, never a quay alone`);
    const alone = planQuay({ berth: h.berths[i], hull: h.hull, key: 'port:1', index: i, seaY: SEA, groundAt });
    if (alone.jetty.x1 - p.jetty.x1 > 1) ends++;   // cut short: it ends on an earlier berth's pier
  }
  assert.ok(ends >= 1, 'a jetty ended on another\'s');
  assert.ok(JETTY_MAX > 80);
});

test('QUAY-CROSSING IN THE BERTHS\' ORDER: a berth is laid only once every earlier one has its plan - a later one never planned past a pier not yet laid, so every client stands the same piers', async () => {
  const { isWater, groundAt } = shore(BAY, 80);
  const h = findHarbour({ rect: BAY_TOWN, isWater });
  const [bx, bz] = h.berths[0].pos;
  const { pool, w } = poolOf(h, (x, z) => (Math.hypot(x - bx, z - bz) < 40 ? NaN : groundAt(x, z)));
  pool.frame(); await settle();
  assert.equal(pool.standing().length, 0, 'the first berth\'s ground not built: none laid');
  w.ground = groundAt;
  pool.frame(); await settle();   // QUAY_RETRY_S not passed: the first waits, and the rest with it
  assert.equal(pool.standing().length, 0);
});

test('QUAY-CROSSING THE DECKS: no berth is sounded whose ship and quay lie across another\'s - on a winding shore two berths BERTH_SPACING apart turned to each other stood their quays\' ends one over the other', () => {
  const capes = [
    { blobs: [{ x: 158, z: 101, rx: 48, rz: 69 }, { x: 2, z: 86, rx: 43, rz: 79 }, { x: 136, z: 53, rx: 41, rz: 60 }, { x: -36, z: 17, rx: 92, rz: 144 }, { x: -138, z: 6, rx: 115, rz: 133 }], shelf: 80 },
    { blobs: [{ x: 58, z: 115, rx: 96, rz: 89 }, { x: 247, z: 0, rx: 38, rz: 49 }], shelf: 40 },
  ];
  for (const { blobs, shelf } of capes) {
    const land = (x, z) => z > 200 || blobs.some((b) => ((x - b.x) / b.rx) ** 2 + ((z - b.z) / b.rz) ** 2 < 1);
    const { isWater, groundAt } = shore(land, shelf);
    const b0 = blobs[0];
    const h = findHarbour({ rect: { minX: b0.x - 20, maxX: b0.x + 20, minZ: b0.z - 20, maxZ: b0.z + 20 }, isWater });
    assert.ok(h && h.berths.length >= 4, 'the cape\'s harbour');
    const plans = [];
    for (const [i, b] of h.berths.entries()) plans.push(planQuay({ berth: b, hull: h.hull, key: 'k', index: i, seaY: SEA, groundAt, others: plans.map((p, j) => ({ plan: p, origin: h.berths[j].pos })) }));
    assert.deepEqual(crossings(h.berths, plans).filter((c) => /deck x \d+\.deck/.test(c)), [], 'no two quays\' decks across each other');
  }
});

test('QUAY-CROSSING: findHarbour\'s quay box is the quay planQuay lays - shipLife.js keeps its own numbers (quays.js imports it), so they are pinned to quays.js\'s', () => {
  assert.equal(BERTH_QUAY_IN, QUAY_GAP + QUAY_WIDTH);
  assert.equal(BERTH_QUAY_ENDS, QUAY_ENDS);
});
