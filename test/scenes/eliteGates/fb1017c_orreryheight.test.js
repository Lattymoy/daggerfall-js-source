// FIELD BUGS 2026-10-17c - ORRERY-HEIGHT (bible/01-Overview/bugs/Field-Bugs-2026-10-17c.md; the Discord's #general, Boar: "Is
// this room bugged?" over an Athenaeum - "Turn the Orrery true. Stones true: 0 of 6"; Lanxus: "Yeah, i just kill my run
// there"): AN ORRERY STONE'S HANDLES STAND OVER ITS OWN FLOOR. THE ASCENT (spec law 9) lays an Athenaeum's court 15-24 m
// off the 0 floor and says each stone's spot's height in the law's centimetres (net/eliteGates/egLaw.js); the activation
// ray's handles (scenes/eliteGates/egSpan.js targets) stood at 1 m over 0 whatever the court's height, out of every
// reach - no stone could be turned and the hall's lock never opened. Fixtures from the producers: the hall's spec off the
// law (egHallOf - the build's law 9, and law 8 given as a breach opened under it is), the circle's collider
// (egCircleColliderTris), the span stood (createEgSpan) and the real pick (player/activate.js pickActivatableHit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egFirstHallOf, egCirclePlan, egSpecForget } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { egCircleColliderTris, egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { pickActivatableHit, DEFAULT_ACTIVATION_DISTANCE } from '../../../src/player/activate.js';

/** The first circle (seeds 1-80, circles 2-20) of law `law` whose Athenaeum `want` takes: `{ seed, c, s }`. */
function findAthenaeum(law, want) {
  for (let seed = 1; seed <= 80; seed++) for (let c = 2; c <= 20; c++) {
    const k = egCirclePlan(seed, c, law).findIndex((p) => p.kind === 'athenaeum');
    if (k < 0) continue;
    const s = egHallOf(seed, egFirstHallOf(c) + k, 0, law);
    if (want(s)) return { seed, c, s };
  }
  throw new Error('no such Athenaeum');
}
const stand = (span) => span.stand({ dynamicDraws: [], collider: { addMesh: () => {} } });
/** Does a level triangle of the collider lie under (x, z) at height y (the dungeon's frame)? */
function floorUnder(tris, x, y, z) {
  for (let i = 0; i < tris.length; i += 9) {
    if (![tris[i + 1], tris[i + 4], tris[i + 7]].every((q) => Math.abs(q - y) < 0.05)) continue;
    const ax = tris[i], az = tris[i + 2], bx = tris[i + 3], bz = tris[i + 5], cx = tris[i + 6], cz = tris[i + 8];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    if (l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6) return true;
  }
  return false;
}
/** The circle's collider as the pick reads it: the nearest triangle the ray meets within `max` (Moller-Trumbore). */
const colliderOf = (tris) => ({
  raycast(o, d, max) {
    let best = Infinity;
    for (let i = 0; i < tris.length; i += 9) {
      const e1 = [tris[i + 3] - tris[i], tris[i + 4] - tris[i + 1], tris[i + 5] - tris[i + 2]], e2 = [tris[i + 6] - tris[i], tris[i + 7] - tris[i + 1], tris[i + 8] - tris[i + 2]];
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) continue;
      const t0 = [o[0] - tris[i], o[1] - tris[i + 1], o[2] - tris[i + 2]], u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) / det;
      if (u < 0 || u > 1) continue;
      const qv = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
      if (v < 0 || u + v > 1) continue;
      const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
      if (t > 1e-6 && t < best && t <= max) best = t;
    }
    return best;
  },
});
/** Every stone's two handles, each picked by the real ray over the circle's own collider from an eye 1.6 m over the stone's
 *  floor at its middle, aimed at a point a metre over that floor and 0.9 m to the handle's side: the handle's key, inside its
 *  reach. */
function eachHandleReached(span, s, floorY, tris) {
  const targets = span.targets();
  assert.equal(targets.filter((t) => t.key.startsWith(`egstone:${s.h}:`)).length, 2 * s.spots.stone.length, 'each stone\'s two handles');
  for (const [j, q] of s.spots.stone.entries()) for (const a of [1, -1]) {
    const key = `egstone:${s.h}:${j}:${a > 0 ? 'f' : 'b'}`;
    const eye = egToDungeon(s, q.x, floorY + 1.6, q.z), at = egToDungeon(s, q.x + a * 0.9, floorY + 1.0, q.z);
    // its box about that point (a box with no number for a side is a slab the ray meets at any height - player/activate.js rayAabb)
    const box = targets.find((t) => t.key === key).aabb;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs((box.min[k] + box.max[k]) / 2 - at[k]) < 1e-6, `${key}: its box about ${at.map((x) => x.toFixed(2))}`);
    const v = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], n = Math.hypot(...v);
    const hit = pickActivatableHit(eye, v.map((x) => x / n), targets, colliderOf(tris));
    assert.equal(hit?.key, key, `${key}: the ray from the stone's floor finds its handle (floor ${floorY} m)`);
    assert.ok(hit.distance <= DEFAULT_ACTIVATION_DISTANCE && hit.reach === DEFAULT_ACTIVATION_DISTANCE, `${key}: within reach (${hit.distance.toFixed(2)} m)`);
  }
}

test('ORRERY-HEIGHT (FIELD BUGS 2026-10-17c): under THE ASCENT an Athenaeum\'s court stands off the 0 floor, and every Orrery stone\'s two handles stand a metre over its own floor - found by the real ray from a body on that floor, inside its reach, and named (mutants: the handles at 1 m over 0, as shipped; the spot\'s centimetres read as metres)', () => {
  const { seed, c, s } = findAthenaeum(9, (q) => Math.abs(q.spots.stone?.[0]?.y ?? 0) >= 400);
  assert.equal(s.law, 9);
  const floorY = s.spots.stone[0].y / 100;
  assert.ok(s.spots.stone.every((q) => q.y === s.spots.stone[0].y), 'the six stones on one court');
  // the court's floor is where the spot says: the circle's collider holds a floor under every stone at that height
  const tris = egCircleColliderTris(seed, c, 0);
  for (const q of s.spots.stone) { const p = egToDungeon(s, q.x, floorY, q.z); assert.ok(floorUnder(tris, p[0], p[1], p[2]), `a floor under the stone at ${q.x}, ${q.z}, ${floorY} m`); }
  const span = createEgSpan({ seed, c });
  stand(span);
  eachHandleReached(span, s, floorY, tris);
  // and the plaque names it - PIN MOVED (FIELD BUGS 2026-10-17e, ORRERY-SIGHT): by the stone's own name and sign, as the
  // riddles name it, never "Orrery stone 1"
  assert.equal(span.hoverName(`egstone:${s.h}:0:f`).title, 'Daggerfall - the lion');
});

test('ORRERY-HEIGHT (FIELD BUGS 2026-10-17c): the laws before THE ASCENT lay no spot height and stand the Athenaeum\'s court at 0 - its handles a metre over 0, as before (mutant: a spot with no height read as no number)', () => {
  const { seed, c, s } = findAthenaeum(8, () => true);
  assert.equal(s.spots.stone[0].y, undefined, 'law 8 lays no spot height');
  egGive8(seed, [c], 0);
  try {
    const given = egHallOf(seed, s.h, 0);
    assert.equal(given.law ?? 8, 8, 'the law 8 hall given');
    const span = createEgSpan({ seed, c });
    stand(span);
    eachHandleReached(span, given, 0, egCircleColliderTris(seed, c, 0));
  } finally { egSpecForget(); }
});
