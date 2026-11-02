// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect"; bible/11-Multiplayer/Elite-Gates.md section 10.3 - a Drift "hangs on two chains from an anchor 18 m up"): A DRIFT'S
// HANG UNDER A FLOOR ABOVE. LAW 9 stacks its ways, and its drifts' 18 m chains and anchors passed through the floors over them
// (3.1% of the drifts the audit swept, 12.9-17 m up). The screen (scenes/eliteGates/egSpan.js egHangReach, standTells, hangLook)
// now hangs a drift's anchor just under the lowest floor its chains or anchor would pass, on chains that long, leaning by
// their own length so its brackets stay beside the swung deck; the deck's swing is the law's, untouched. Fixtures from the
// producers: the law's own halls, the screen's own spans and models.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCircleSpecs, egCircleOfHall, egBandOfCircle, egLawSeam } from '../../../src/net/eliteGates/egLaw.js';
import { egPieceAt } from '../../../src/net/eliteGates/egSpanLaw.js';
import { createEgSpan, egHangModel, egHangReach, EG_HANG_TOP, EG_HANG_CABLE_M } from '../../../src/scenes/eliteGates/egSpan.js';
import { SD_PENDULUM } from '../../../src/world/superDungeon/sdStepsModel.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';

// PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18): the audit's drifts on spec law 9's halls, named through THE SEAM (law 10 lays
// seed 2's anew)
egLawSeam(9);
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
/** A model's lowest and highest y, and the highest off its middle line (the crane's beam under its cable, 0.1 m thin). */
function extent(m) {
  let lo = Infinity, hi = -Infinity, wide = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) { const x = m.positions[i], y = m.positions[i + 1]; lo = Math.min(lo, y); hi = Math.max(hi, y); if (Math.abs(x) > 0.06) wide = Math.max(wide, y); }
  return { lo, hi, wide };
}
const xf = (M, v) => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];

test('EG-PERFECT A DRIFT\'S HANG UNDER A FLOOR (section 10.3): each band\'s anchor stands EG_HANG_TOP over its pivot (the crane\'s cable on to EG_HANG_CABLE_M); in seed 2 hall 12 (its ground 2) the drifts 8 m up stand under a bridge 14.8 m over them - their 18 m chains would pass through it, and now their anchors hang under its underside on 13.12 m chains; an open sky keeps the 18 m hang byte for byte (mutants: the floor unread; the anchor\'s height unread; the full hang changed)', () => {
  for (let b = 0; b < 4; b++) {
    const e = extent(egHangModel(b));
    const anchor = b === 3 ? e.wide : e.hi;   // the crane's beam, its cable on over it
    assert.ok(near(anchor, EG_HANG_TOP[b], 0.01), `band ${b}: its anchor ${anchor.toFixed(3)} m over the pivot`);
    assert.ok(near(e.lo, -(SD_PENDULUM.len + SD_PENDULUM.into) - SD_PENDULUM.rod / 2), 'down to the brackets');
    assert.ok(near(e.hi, b === 3 ? EG_HANG_CABLE_M : EG_HANG_TOP[b], 0.01), `band ${b}: its top`);
    const c = extent(egHangModel(b, 9.5, 1.2));
    assert.ok(near(c.lo, -(9.5 + SD_PENDULUM.into) - SD_PENDULUM.rod / 2), `band ${b}: shorter chains down to the brackets`);
    assert.ok(near(c.hi, b === 3 ? 1.2 : EG_HANG_TOP[b], 0.01), `band ${b}: the crane's cable to the floor`);
  }
  assert.deepEqual([...egHangModel(2, SD_PENDULUM.len, EG_HANG_CABLE_M).positions], [...egHangModel(2).positions], 'the full hang\'s bytes');
  const spec = egHallOf(2, 12, 2), band = egBandOfCircle(egCircleOfHall(12));   // the seed's ground of span decrees (seed % 9 - its circles past the first)
  const drifts = spec.steps.filter((q) => q.kind === 'drift');
  assert.ok(drifts.length >= 2);
  for (const s of drifts) {
    const bridge = spec.lanes.find((l) => l.y - s.y > 10 && l.y - s.y < SD_PENDULUM.len && Math.min(l.ax, l.bx) - l.hw < s.x + s.amp + 2.4 && Math.max(l.ax, l.bx) + l.hw > s.x - s.amp - 2.4 && Math.min(l.az, l.bz) - l.hw < s.z + 0.25 && Math.max(l.az, l.bz) + l.hw > s.z - 0.25);
    assert.ok(bridge, `drift ${s.i}: a bridge over its chains`);
    assert.ok(near(bridge.y - s.y, 14.8, 0.01), `drift ${s.i}: ${(bridge.y - s.y).toFixed(1)} m over it`);
    const R = egHangReach(spec, s, band);
    assert.deepEqual(R, { len: 13.12, over: EG_HANG_CABLE_M }, `drift ${s.i}: hung under the bridge`);
    assert.ok(R.len + EG_HANG_TOP[band] <= bridge.y - s.y - 0.5, 'its anchor under the bridge\'s underside');
  }
  // an open sky: the hang as it always was
  /** how far in plan from drift `s` the nearest floor over it stands (a plate, a bridge, a room's box) */
  const gap = (x0, z0, x1, z1, s) => Math.hypot(Math.max(0, x0 - s.x, s.x - x1), Math.max(0, z0 - s.z, s.z - z1));
  const clearOf = (sp, s) => Math.min(Infinity, ...sp.discs.filter((d) => d.y > s.y + 2.4).map((d) => gap(d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, s)),
    ...sp.lanes.filter((l) => l.y > s.y + 2.4).map((l) => gap(Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw, s)),
    ...(sp.heroes ?? []).filter((q) => q.box && q.box[4] > s.y + 2.4).map((q) => gap(q.box[0], q.box[2], q.box[3], q.box[5], s)));   // (a room's box in the hall's frame - THE AUDIT)
  let open = null;
  for (let seed = 1; seed <= 6 && !open; seed++) for (const sp of egCircleSpecs(seed, 3, seed % 9)) { const s = sp.steps.find((q) => q.kind === 'drift' && clearOf(sp, q) > 12); if (s) { open = { sp, s }; break; } }
  assert.ok(open, 'a drift under the open sky');
  assert.deepEqual(egHangReach(open.sp, open.s, band), { len: SD_PENDULUM.len, over: EG_HANG_CABLE_M });
});

test('EG-PERFECT A CAPPED HANG ON THE SCREEN (section 10.3: "leaning as it swings"): the spans stand seed 2 hall 12\'s drifts on their 13.12 m chains - the pivot that high over the deck\'s rest, the model\'s brackets that far under it - and lean them by their own length, so the brackets stay beside the deck the law swings; the hall\'s hangs one kind still (mutants: the pivot left 18 m up; the lean by 18 m)', () => {
  const plain = () => ({ createMesh: (m) => ({ subMeshes: m.subMeshes, model: m }), destroyMesh: () => {} });
  const c = egCircleOfHall(12), span = createEgSpan({ renderer: plain(), seed: 2, c, geo: 2, lite: false }), draws = [];
  span.stand({ dynamicDraws: draws, collider: null });
  try {
    const spec = egHallOf(2, 12, 2), s = spec.steps.find((q) => q.kind === 'drift'), slot = span.slots.find((q) => q.h === 12 && q.i === s.i);
    assert.ok(slot?.hang, 'its hang stood');
    const len = 13.12;
    assert.ok(slot.pivot.every((v, k) => near(v, realmToDungeon(spec.x0 + s.x, s.y + len, s.z)[k], 1e-3)), 'its pivot 13.12 m over the deck\'s rest');
    assert.ok(near(extent(slot.hang.gpu.model).lo, -(len + SD_PENDULUM.into) - SD_PENDULUM.rod / 2, 1e-3), 'its model\'s brackets that far under it');
    const t = (s.period / 4 - (s.phase * s.period) / (2 * Math.PI)) + 50 * s.period, dx = egPieceAt(s, t).dx;
    span.ride(t, 0.016, null, false);
    assert.ok(Math.abs(dx) > 0.9, `swung (${dx.toFixed(2)})`);
    const M = slot.hang.object.matrix, a = Math.asin(dx / len);
    assert.ok(near(M[0], Math.cos(a)) && near(M[1], Math.sin(a)), 'leaning by its own length');
    const foot = xf(M, [SD_PENDULUM.foot, -(len + SD_PENDULUM.into), 0]), [dxW] = realmToDungeon(spec.x0 + s.x + dx, s.y, s.z);
    assert.ok(Math.abs(foot[0] - (dxW + SD_PENDULUM.foot)) < 0.06, `its bracket beside the swung deck (${foot[0].toFixed(3)} against ${(dxW + SD_PENDULUM.foot).toFixed(3)})`);
  } finally { span.clear(); }
});
