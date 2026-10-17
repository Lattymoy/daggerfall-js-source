// EG-ZO (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 25.1 and 25.8 - "a fall
// past the Spire's broken underside when you enter a new region"): THE FALL PAST THE SPIRE'S UNDERSIDE. The model
// (world/eliteGates/egUnderside.js): the torn floor, the rock under it, its spires, the galleries' floors, the colonnade and the
// girders, built with the arc's one mesh kit (world/eliteGates/meshKit.js) in the band's own dress (world/eliteGates/egBandArt.js) - its own
// geometry checked face by face - and made a slice at a time. The fall's law: a camera from rest to its terminal speed,
// drifting out, raising its eyes, its look eased over the stair's own clock - among the spires as the veil shuts, below
// the last tip as the least hold ends, the underside in view through the longest hold, never in rock. The shaders
// (render/eliteGates/egStairPass.js) evaluated through test/glsl.mjs: the void as the falling camera sees it and the underside lit
// from below and melting into it, EG-ZE's reversed smoothstep fix kept and the picture's own reversed edge gone. The pass
// and the veil (ui/gate/gateVeil.js) over a recording GL: the underside made a slice a tick, never in the tick the veil shuts
// in, uploaded once, drawn depth-tested through the camera, and every GL allocation of it freed on every exit - the veil
// opened, a flash of another look, another band's fall, the veil destroyed, an upload that failed part way. And the breach
// client (scenes/eliteGates/egClient.js) played: the circle swap in place into Hall 26 lands under the fall, after the underside
// stood, its hall held centred.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import {
  EG_UNDERSIDE, EG_UNDERSIDE_SPIRES, EG_UNDERSIDE_GALLERIES, EG_UNDERSIDE_COLUMNS, EG_UNDERSIDE_GIRDERS, EG_UNDERSIDE_RECORDS, EG_UNDERSIDE_HAZE,
  EG_UNDERSIDE_LAYS, EG_FALL, EG_FALL_SPAN, egUndersidePlan, egUndersideRockR, egUndersideSpireRing, buildEgUndersideModel, egUndersideParts,
  egFallDepth, egFallPitch, egFallEye, egFallCamera,
} from '../../../src/world/eliteGates/egUnderside.js';
import { createMeshKit } from '../../../src/world/eliteGates/meshKit.js';
import { EG_DRESS, egBandArt, egBandArtOf, egBandArchive, EG_BAND_RECORDS } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_STAIR_FS, EG_UNDERSIDE_FS, EG_STAIR_MODE, EG_STAIR_LOOK, EG_UNDERSIDE_LOOK, EG_MOON, EG_VOID_GLSL, EgStairRenderer } from '../../../src/render/eliteGates/egStairPass.js';
import { sdSkyBasisInto } from '../../../src/render/superDungeon/sdSky.js';
import { lookAtInto, perspectiveInto } from '../../../src/render/shadowPass.js';
import { createGateVeil } from '../../../src/ui/gate/gateVeil.js';
import { VEIL_HOLD_MAX_S } from '../../../src/render/gate/gateVeil.js';
import { egStairStep, EG_STAIR_VEIL } from '../../../src/world/eliteGates/egLights.js';
import { EG_SKIES, egStairOf } from '../../../src/world/eliteGates/egLook.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egHallOf, EG_SEALED_MS, EG_BRINK_HALLS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const settle = () => new Promise((r) => setImmediate(r));

/** A packed model's triangles: corners, stored normal, centroid, uvs and record. */
function tris(m) {
  const out = [];
  for (const s of m.subMeshes) for (let i = s.startIndex; i < s.startIndex + s.primitiveCount * 3; i += 3) {
    const v = [0, 1, 2].map((k) => { const j = m.indices[i + k] * 3; return [m.positions[j], m.positions[j + 1], m.positions[j + 2]]; });
    const uv = [0, 1, 2].map((k) => { const j = m.indices[i + k] * 2; return [m.uvs[j], m.uvs[j + 1]]; });
    const j = m.indices[i] * 3;
    out.push({ v, uv, n: [m.normals[j], m.normals[j + 1], m.normals[j + 2]], c: [0, 1, 2].map((a) => (v[0][a] + v[1][a] + v[2][a]) / 3), rec: s.textureRecord });
  }
  return out;
}
/** One part of the underside laid alone (EG_UNDERSIDE_LAYS) and packed. */
const partOf = (name) => { const k = createMeshKit(); EG_UNDERSIDE_LAYS[name](k, egUndersidePlan()); return k.pack(egBandArchive(0)); };
/** A point through a camera (egFallCamera's arrays): its NDC x, y and its distance in front. */
function project(cam, p) {
  const v = cam.view, P = cam.proj;
  const ex = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12], ey = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13], ez = v[2] * p[0] + v[6] * p[1] + v[10] * p[2] + v[14];
  return [(P[0] * ex + P[8] * ez) / -ez, (P[5] * ey + P[9] * ez) / -ez, -ez];
}
const camArrays = () => ({ eye: new Float32Array(3), view: new Float32Array(16), proj: new Float32Array(16) });

test('EG-ZO THE UNDERSIDE\'S MODEL (world/eliteGates/egUnderside.js, the mesh\'s own geometry): built with the one mesh kit - a sub-mesh for each of its four records, lowest first, under the band\'s own archive, the same stone shape in every band; every face wound to its stored normal; the floor\'s flags up, its broken edge and the rock\'s flank out from the axis, the torn lip and every cake ledge down into the deep\'s light, each spire\'s faces out from its own line; nothing over the floor and nothing wider than its rim; the strata by depth, a broken tip in the haze; its counts the plan\'s own (mutants: a face wound in; a ledge facing up; the strata off the depth; a spire\'s tip out of the haze; the floor\'s underside folded; a part left out)', () => {
  const U = EG_UNDERSIDE, S = EG_UNDERSIDE_SPIRES, G = EG_UNDERSIDE_GALLERIES, C = EG_UNDERSIDE_COLUMNS, R = EG_UNDERSIDE_GIRDERS;
  assert.deepEqual(EG_UNDERSIDE_RECORDS, [EG_DRESS.floor, EG_DRESS.brass, EG_DRESS.root, EG_DRESS.pillar]);
  const models = [0, 1, 2, 3].map(buildEgUndersideModel);
  for (const [b, m] of models.entries()) {
    assert.ok(m.indices instanceof Uint32Array, 'THE ONE INDEX TYPE');
    assert.deepEqual(m.subMeshes.map((s) => [s.textureArchive, s.textureRecord]), EG_UNDERSIDE_RECORDS.map((r) => [egBandArchive(b), r]), `band ${b}: its own dress`);
    assert.deepEqual([...m.positions], [...models[0].positions], 'one Spire: the same stone shape in every band');
  }
  // the counts, from the plan's own numbers: the floor's fan and the galleries' slabs; the girders; the lip, the rock's
  // flank and ledges, its tip and the spires; the broken edge and the colonnade
  const per = Object.fromEntries(models[0].subMeshes.map((s) => [s.textureRecord, s.primitiveCount]));
  assert.deepEqual(per, {
    [EG_DRESS.floor]: U.sides + G.n * (5 * 2 + 3 * 2),
    [EG_DRESS.brass]: R.n * (4 * 2 + 2 * 2),
    [EG_DRESS.root]: U.sides * 2 + (U.rings - 1) * U.sides * 4 + U.sides + S.n * ((S.rings - 1) * S.sides * 2 + (S.rings - 2) * S.sides * 2 + S.sides),
    [EG_DRESS.pillar]: U.sides * 2 + C.n * C.sides * (1 + 4 * 2),
  });
  const all = tris(models[0]);
  for (const t of all) {
    const w = cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0]));
    assert.ok(dot(w, t.n) > 0 && near(Math.hypot(...t.n), 1, 1e-4), 'the stored normal is the winding\'s');
  }
  const plan = egUndersidePlan(), rimMax = Math.max(...plan.rim.map((p) => Math.hypot(p[0], p[1])));
  const P = models[0].positions;
  for (let i = 0; i < P.length; i += 3) {
    assert.ok(P[i + 1] <= 1e-6, 'nothing stands over the torn floor');
    assert.ok(Math.hypot(P[i], P[i + 2]) <= rimMax + 1e-4, 'nothing wider than its rim');
  }
  assert.deepEqual(egUndersidePlan(), plan, 'seeded: every screen the same');
  // the plan's laws: a ragged rim, a rock narrowing by its taper and jittered ring by ring, spires bent and broken
  const rimR = plan.rim.map((p) => Math.hypot(p[0], p[1]));
  assert.ok(rimR.every((r) => r >= U.r * (1 - U.rag) && r <= U.r * (1 + U.rag)) && Math.max(...rimR) - Math.min(...rimR) > U.r * U.rag, 'the rim ragged, within its share');
  assert.deepEqual([0, 0.5, 1, 2].map(egUndersideRockR), [U.waist * U.r, U.waist * U.r * 0.5 ** U.taper, 0, 0]);
  for (const [i, ring] of plan.rings.entries()) {
    if (i === 0) continue;
    const R0 = egUndersideRockR(i / U.rings), rr = ring.corners.map((p) => Math.hypot(p[0], p[2]));
    assert.ok(rr.every((r) => r >= R0 * (1 - U.jitter) - 1e-9 && r <= R0 * (1 + U.jitter) + 1e-9) && Math.max(...rr) - Math.min(...rr) > R0 * U.jitter * 0.5, `ring ${i}: jittered about its taper`);
    assert.ok(ring.corners.every((p) => near(p[1], -U.slab - U.depth * (i / U.rings), 1e-9)) && ring.step > 1 && ring.step <= 1 + U.step * 1.4, 'level, its cake stepped');
  }
  for (const s of plan.spires) {
    const t0 = egUndersideSpireRing(s, 0), tl = egUndersideSpireRing(s, S.rings - 1);
    assert.deepEqual([t0.x, t0.y, t0.z, t0.R], [s.x, s.y, s.z, s.R], 'its top where it hangs from');
    assert.ok(near(tl.x - s.x, Math.cos(s.bendA) * S.bend * s.len, 1e-9) && near(tl.z - s.z, Math.sin(s.bendA) * S.bend * s.len, 1e-9) && near(tl.y, s.y - s.len, 1e-9), 'bent away as it falls');
    assert.ok(near(tl.R, s.R * S.tip, 1e-9), 'its tip broken to a share of its top');
    assert.ok(s.len >= S.len[0] && s.len <= S.len[1] && s.R >= S.r[0] && s.R <= S.r[1] && Math.hypot(s.x, s.z) >= U.r * S.at[0] - 1e-9 && Math.hypot(s.x, s.z) <= U.r * S.at[1] + 1e-9);
  }
  // THE FLOOR AND THE ROCK, alone
  const rock = tris(partOf('rock')), axisOut = (t) => t.c[0] * t.n[0] + t.c[2] * t.n[2];
  const top = rock.filter((t) => t.rec === EG_DRESS.floor);
  assert.equal(top.length, U.sides);
  assert.ok(top.every((t) => t.n[1] > 0.999 && t.v.every((p) => p[1] === 0)), 'the flags face up at the floor');
  assert.ok(rock.filter((t) => t.rec === EG_DRESS.pillar).every((t) => axisOut(t) > 0 && Math.abs(t.n[1]) < 1e-6), 'the broken edge out from the axis');
  const rootT = rock.filter((t) => t.rec === EG_DRESS.root), flat = rootT.filter((t) => Math.abs(t.n[1]) > 0.999);
  assert.ok(flat.every((t) => t.n[1] < 0), 'the torn lip and every cake ledge face down, into the deep\'s light');
  assert.equal(flat.length, U.sides * 2 + (U.rings - 1) * U.sides * 2);
  assert.ok(rootT.filter((t) => Math.abs(t.n[1]) <= 0.999 && t.c[1] > plan.rings.at(-1).y).every((t) => axisOut(t) > 0), 'the rock\'s flank out from its axis');
  assert.ok(plan.rings[0].corners.every((p, k) => Math.hypot(p[0], p[2]) < Math.hypot(...plan.rim[k])), 'the rock\'s top ring inside the rim: the floor\'s underside never folded');
  const strata = (y) => Math.max(0, Math.min(1, -y / (U.slab + U.depth)));
  const onRim = (p) => plan.rim.some((q) => near(p[0], q[0], 1e-4) && near(p[2], q[1], 1e-4));
  for (const t of rootT) for (let k = 0; k < 3; k++) assert.ok(near(t.uv[k][1], onRim(t.v[k]) ? 0 : strata(t.v[k][1]), 1e-4), 'the strata by depth - the torn lip at the rim, the tip in the haze');
  // THE SPIRES, alone: each face out from its own line, every tip in the haze
  const sp = tris(partOf('spires'));
  assert.ok(sp.every((t) => t.rec === EG_DRESS.root));
  const lineAt = (s, y) => { const k = Math.max(0, Math.min(S.rings - 1.0001, ((s.y - y) / s.len) * (S.rings - 1))), i = Math.floor(k), a = egUndersideSpireRing(s, i), b = egUndersideSpireRing(s, i + 1), f = k - i; return [a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f]; };
  let sides = 0;
  for (const s of plan.spires) {
    const k1 = createMeshKit();
    EG_UNDERSIDE_LAYS.spires(k1, { ...plan, spires: [s] });   // one spire alone: every face its own
    const one = tris(k1.pack(0)), last = egUndersideSpireRing(s, S.rings - 1);
    for (const t of one) {
      for (let k = 0; k < 3; k++) if (t.v[k][1] <= last.y + last.R * 0.75) assert.ok(t.uv[k][1] >= EG_UNDERSIDE_HAZE - 1e-6, 'a broken tip in the haze');
      if (t.v.some((p) => p[1] < last.y - last.R * 0.7)) { assert.ok(t.n[1] < 0, 'the broken tip closed downward'); continue; }
      if (Math.abs(t.n[1]) >= 0.999) { assert.ok(t.n[1] < 0, 'a spire\'s ledge faces down'); continue; }
      const L = lineAt(s, t.c[1]);
      assert.ok((t.c[0] - L[0]) * t.n[0] + (t.c[2] - L[1]) * t.n[2] > 0, 'a spire\'s face out from its own line');
      sides++;
    }
  }
  assert.ok(sides >= S.n * S.sides * 2 * (S.rings - 1), `${sides} sides read`);
  assert.ok(sp.every((t) => t.uv.every((u) => u[1] >= 0 && u[1] <= 1)));
  // THE WRECK, alone: the galleries' flags, the girders' metal, the colonnade's stone - every one rooted in the rock or the
  // floor and jutting from it
  const wr = tris(partOf('wreck'));
  assert.deepEqual(kindsOf(wr), { [EG_DRESS.floor]: G.n * 16, [EG_DRESS.brass]: R.n * 12, [EG_DRESS.pillar]: C.n * C.sides * 9 });
  const flank = (y) => egUndersideRockR((-y - U.slab) / U.depth);
  assert.equal(plan.galleries.length, G.n);
  for (const g of plan.galleries) {
    assert.ok(g.poly.every((p, k) => { const a = g.poly[k], b = g.poly[(k + 1) % 5], c = g.poly[(k + 2) % 5]; return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0; }), 'a gallery\'s slab convex (its caps fanned)');
    const r = g.poly.map((p) => Math.hypot(p[0], p[1]));
    assert.ok(Math.min(...r) < flank(g.y) && Math.max(...r) > flank(g.y) + G.out[0], 'rooted in the rock, jutting from its flank');
    assert.ok(g.y <= G.y[0] && g.y >= G.y[1]);
  }
  for (const g of plan.girders) {
    assert.ok(Math.hypot(g.a[0], g.a[2]) < flank(g.a[1]) && Math.hypot(g.b[0], g.b[2]) > flank(g.a[1]) + R.out[0] - 1e-9, 'a girder welded through the rock');
    assert.ok(near(g.a[1] - g.b[1], R.droop, 1e-9), 'drooping');
  }
  for (const c of plan.columns) assert.ok(plan.rim.some((p, i) => near(c.x, (p[0] + plan.rings[0].corners[i][0]) / 2, 1e-9) && near(c.z, (p[1] + plan.rings[0].corners[i][2]) / 2, 1e-9)), 'a column under the floor, between the rock and the rim');
  const cols = wr.filter((t) => t.rec === EG_DRESS.pillar);
  assert.ok(cols.every((t) => t.v.every((p) => p[1] <= -U.slab + 1e-5)) && cols.some((t) => t.v.some((p) => near(p[1], -U.slab, 1e-5))), 'hung from the floor\'s underside');
});
const kindsOf = (ts) => ts.reduce((a, t) => ({ ...a, [t.rec]: (a[t.rec] ?? 0) + 1 }), {});

test('EG-ZO THE SLICES AND THE PICTURES (world/eliteGates/egUnderside.js egUndersideParts, world/eliteGates/egBandArt.js egBandArtOf): the underside made a slice at a time - its floor and rock, its spires, its wreck, the pack, then its four pictures - the same model and pixels as built whole; the band\'s pictures one at a time, the same as its whole dress, its walkways\' tesserae (the costliest) never painted for a fall; a record the band does not paint refused (mutants: a slice skipped; every slice at once; a picture off its record)', () => {
  for (const b of [0, 3]) {
    const parts = egUndersideParts(b), seen = [];
    assert.equal(parts.slices, 3 + 1 + EG_UNDERSIDE_RECORDS.length);
    let steps = 0;
    while (!parts.done) { assert.equal(parts.step(), steps + 1 === parts.slices); steps++; seen.push([parts.model ? 1 : 0, parts.art.length]); }
    assert.equal(steps, parts.slices, 'one slice a step');
    assert.deepEqual(seen, [[0, 0], [0, 0], [0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], 'the model, then its pictures, one a slice');
    assert.equal(parts.step(), true, 'and nothing more');
    const whole = buildEgUndersideModel(b);
    assert.deepEqual([...parts.model.positions], [...whole.positions]);
    assert.deepEqual([...parts.model.uvs], [...whole.uvs]);
    assert.deepEqual(parts.model.subMeshes, whole.subMeshes);
    assert.deepEqual(parts.art.map((a) => a[0]), EG_UNDERSIDE_RECORDS);
    const dress = new Map(egBandArt(b));
    for (const [rec, art] of parts.art) assert.deepEqual([...art.albedo.colors], [...dress.get(rec).albedo.colors], `band ${b} record ${rec}: the band's own picture`);
  }
  assert.ok(!EG_UNDERSIDE_RECORDS.includes(EG_DRESS.cobble), 'the walkways\' tesserae never painted for a fall');
  assert.deepEqual(egBandArt(2).map((a) => a[0]), [...EG_BAND_RECORDS], 'the whole dress, every record once, in its order');
  for (const rec of EG_BAND_RECORDS) assert.deepEqual([...egBandArtOf(1, rec)[1].albedo.colors], [...new Map(egBandArt(1)).get(rec).albedo.colors]);
  assert.throws(() => egBandArtOf(0, 82), /no record 82/);   // PIN MOVED (EG-LOOK): 81 is the kit's chain now (world/eliteGates/egKit.js)
  assert.equal(egBandArtOf(9, EG_DRESS.floor)[1].albedo.width, egBandArtOf(3, EG_DRESS.floor)[1].albedo.width, 'the band clamped');
  assert.deepEqual([...egBandArtOf(9, EG_DRESS.root)[1].albedo.colors], [...egBandArtOf(3, EG_DRESS.root)[1].albedo.colors]);
});

test('EG-ZO THE FALL\'S PATH AND TIMING (section 7, world/eliteGates/egUnderside.js): from rest toward its terminal speed, never rising; drifting out a fixed share of each metre fallen; the eyes raised from the void under it to the underside overhead, eased over the stair\'s own clock (0.8 s in, the 1.2 s hold, 0.8 s out) and still at both ends; stepped off the torn floor\'s rim, among the spires as the veil shuts, below the last stone as the least hold ends; never within 10 m of the rock; the underside in view and climbing the screen through the longest hold the veil allows; the camera\'s matrices the port\'s own lookAt and perspective (mutants: the fall at full speed from the first frame; no drift; the eyes still; the raise past the stair\'s clock; the view off the axis)', () => {
  const F = EG_FALL;
  assert.equal(EG_FALL_SPAN, EG_STAIR_VEIL.close + EG_STAIR_VEIL.fallHold + EG_STAIR_VEIL.open);
  assert.equal(EG_FALL_SPAN, 2.8);
  // the fall: from rest, accelerating toward v, never rising
  assert.equal(egFallDepth(0), 0);
  assert.equal(egFallDepth(-1), 0);
  assert.ok(egFallDepth(0.01) < 0.01, 'from rest');
  let last = 0, speed = 0;
  for (let t = 0.02; t <= 30; t += 0.02) {
    const d = egFallDepth(t), v = (d - last) / 0.02;
    assert.ok(d > last && v >= speed - 1e-9 && v <= F.v + 1e-6, 'falling ever faster, never past its terminal speed');
    last = d; speed = v;
  }
  assert.ok(near(speed, F.v, 0.01), 'at its terminal speed');
  for (const t of [0.3, 1.1, 2.4]) assert.ok(near(egFallDepth(t), F.v * (t - F.tau * (1 - Math.exp(-t / F.tau))), 1e-9), 'the void\'s drag');
  // the drift and the eye
  for (const t of [0, 0.8, 2, 5]) assert.deepEqual(egFallEye(t), [F.d0 + F.drift * egFallDepth(t), F.y0 - egFallDepth(t), 0]);
  // the eyes: eased over the stair's clock, still at both ends, held past it
  assert.equal(egFallPitch(0), F.pitch0);
  assert.ok(near(egFallPitch(EG_FALL_SPAN), F.pitch1, 1e-12) && egFallPitch(9) === egFallPitch(EG_FALL_SPAN));
  assert.ok(near(egFallPitch(EG_FALL_SPAN / 2), (F.pitch0 + F.pitch1) / 2, 1e-12));
  const rate = (t) => (egFallPitch(t + 1e-4) - egFallPitch(t)) / 1e-4;
  assert.ok(Math.abs(rate(0)) < 1e-3 && Math.abs(rate(EG_FALL_SPAN - 1e-4)) < 1e-3, 'still at both ends');
  assert.ok(Math.max(...Array.from({ length: 28 }, (_, i) => Math.abs(rate(i * 0.1)))) < 0.5, 'slow: never half a radian a second');
  assert.ok(F.pitch0 < 0 && F.pitch1 > 0, 'from the void under it to the underside overhead');
  // where it stands against the underside, as section 7 times it
  const m = buildEgUndersideModel(0), plan = egUndersidePlan(), P = m.positions;
  let lowest = Infinity, rim = 0;
  for (let i = 0; i < P.length; i += 3) { lowest = Math.min(lowest, P[i + 1]); rim = Math.max(rim, Math.hypot(P[i], P[i + 2])); }
  const tips = plan.spires.map((s) => egUndersideSpireRing(s, EG_UNDERSIDE_SPIRES.rings - 1).y);
  assert.ok(F.y0 > 0 && F.d0 > rim, 'stepped off the torn floor\'s rim');
  const shut = egFallEye(EG_STAIR_VEIL.close);
  assert.ok(shut[1] < -EG_UNDERSIDE.slab && shut[1] > Math.min(...tips), 'among the spires as the veil shuts');
  assert.ok(egFallEye(EG_STAIR_VEIL.close + EG_STAIR_VEIL.fallHold)[1] < lowest, 'below the last stone as the least hold ends');
  let closest = Infinity;
  for (let t = 0; t <= VEIL_HOLD_MAX_S; t += 0.05) {
    const e = egFallEye(t);
    for (let i = 0; i < P.length; i += 3) closest = Math.min(closest, Math.hypot(P[i] - e[0], P[i + 1] - e[1], P[i + 2] - e[2]));
  }
  assert.ok(closest > 10, `never in rock: ${closest.toFixed(2)} m at the closest`);
  // in view, climbing the screen: the underside's heart through the camera
  const cam = camArrays(), heart = [0, -(EG_UNDERSIDE.slab + EG_UNDERSIDE.depth) / 2, 0];
  let prev = -Infinity;
  for (const t of [0, 0.4, 0.8, 1.4, 2, 2.8, 6, 12, VEIL_HOLD_MAX_S]) {
    egFallCamera(t, 16 / 9, cam);
    const q = project(cam, heart);
    assert.ok(q[2] > 0 && Math.abs(q[0]) < 1e-6 && Math.abs(q[1]) < 1, `the underside in view at ${t} s (${q[1].toFixed(3)})`);
    assert.ok(q[1] > prev, 'climbing the screen');
    prev = q[1];
    let shown = 0;
    for (let i = 0; i < P.length; i += 3) { const p = project(cam, [P[i], P[i + 1], P[i + 2]]); if (p[2] > 0 && Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1) shown++; }
    assert.ok(shown / (P.length / 3) > 0.95, `nearly all of it on the screen at ${t} s`);
  }
  egFallCamera(EG_STAIR_VEIL.close + EG_STAIR_VEIL.fallHold, 16 / 9, cam);
  assert.ok(project(cam, heart)[1] > 0 && project(cam, [0, 0, 0])[1] > project(cam, heart)[1], 'overhead as the least hold ends');
  // the matrices: the port's own lookAt toward the axis at the pitch, and its perspective
  for (const t of [0, 1.3, 4]) {
    egFallCamera(t, 1.5, cam);
    const e = egFallEye(t), p = egFallPitch(t), V = new Float32Array(16), Pr = new Float32Array(16);
    lookAtInto(V, e, e[0] - Math.cos(p), e[1] + Math.sin(p), e[2], [0, 1, 0]);
    perspectiveInto(Pr, F.fov, 1.5, F.near, F.far);
    assert.ok([...cam.view].every((x, i) => near(x, V[i], 1e-4)), `the view at ${t} s`);
    assert.ok([...cam.proj].every((x, i) => near(x, Pr[i], 1e-6)), 'the lens');
    assert.deepEqual([...cam.eye], [...new Float32Array(e)]);
  }
  // the fall is the stair's at a band's first hall alone; the veil and the cut keep their own
  assert.deepEqual([1, ...EG_BRINK_HALLS].map((h) => egStairStep(h).kind), [1, ...EG_BRINK_HALLS].map(() => 'fall'));
  assert.deepEqual([egStairOf(27), egStairStep(26, true).kind], ['veil', 'cut']);
});

/** The stair's shader with the falling camera's basis bound (t seconds in, a w x h canvas). */
function stairFs(t, w = 427, h = 240) {
  const cam = egFallCamera(t, w / h, camArrays()), B = sdSkyBasisInto(cam.view, cam.proj, { right: [0, 0, 0], up: [0, 0, 0], fwd: [0, 0, 0], lens: [0, 0, 0, 0] });
  const f = glslFunctions(EG_STAIR_FS, { uRes: [w, h], uTime: t, uCover: 1, uMode: EG_STAIR_MODE.fall, uBand: 0, uRight: [...B.right], uUp: [...B.up], uFwd: [...B.fwd], uLens: [...B.lens], gl_FragCoord: [0, 0, 0, 1], o: [0, 0, 0, 0] }, { eager: true });
  return { f, cam };
}

test('EG-ZO THE SHADERS (render/eliteGates/egStairPass.js, evaluated): in the fall the void is painted as the falling camera sees it - straight ahead its forward, its top edge its pitch and half its lens, the main\'s colour the scene\'s along that ray; EG-ZE\'s fix kept (the deep\'s rise never a reversed edge) and the picture\'s own reversed edge gone with it; the underside lit from below by the band\'s deep, the horizon all round, the zenith from above and the Shade\'s moon, melting into the band\'s void with distance - the one void both programs paint; the dither leaves the world where the veil has not taken (mutants: the fall\'s void on the screen\'s rows; the deep\'s light from above; the moon in every band; the haze never thickening; the dither inverted)', () => {
  // THE VOID AS THE CAMERA SEES IT
  for (const t of [0, 1.5, 3]) {
    const { f } = stairFs(t), p = egFallPitch(t);
    const mid = f.fallRay([427 / 2, 120]);
    assert.ok(near(mid[0], 0, 1e-9) && near(mid[1], Math.sin(p), 1e-6), `straight ahead at ${t} s: the forward (the camera's arrays are single precision)`);
    const topRow = f.fallRay([427 / 2, 240]);
    assert.ok(near(topRow[1], Math.sin(p + EG_FALL.fov / 2), 1e-6), 'the top edge: the pitch and half the lens');
    const right = f.fallRay([427, 120]), lens = egFallCamera(t, 427 / 240, camArrays()).proj[0];
    assert.ok(near(right[0], Math.atan(1 / lens) * EG_UNDERSIDE_LOOK.azimuth, 1e-6), 'the right edge: half the lens across, the embers\' columns about the eye');
    for (const q of [[30, 20], [213, 120], [400, 230]]) {
      f.globals.gl_FragCoord = [q[0] + 0.5, q[1] + 0.5, 0, 1];
      f.main();
      const ray = f.fallRay([q[0] + 0.5, q[1] + 0.5]), want = f.sdPixel(f.stairScene(ray, t, 0, EG_STAIR_MODE.fall), [q[0], q[1]], EG_STAIR_LOOK.steps);
      assert.deepEqual([...f.globals.o].slice(0, 3), want, 'the main paints the scene along the camera\'s ray');
    }
  }
  // the veil and the cut keep the screen's rows
  const v = glslFunctions(EG_STAIR_FS, { uRes: [427, 240], uTime: 1, uCover: 1, uMode: EG_STAIR_MODE.veil, uBand: 1, gl_FragCoord: [100.5, 50.5, 0, 1], o: [0, 0, 0, 0] });
  v.main();
  assert.deepEqual([...v.globals.o].slice(0, 3), v.sdPixel(v.stairScene([(100.5 - 213.5) / 120, (50.5 - 120) / 120], 1, 1, EG_STAIR_MODE.veil), [100, 50], EG_STAIR_LOOK.steps));
  // EG-ZE's fix intact, and no reversed edge in either program
  assert.ok(EG_STAIR_FS.includes('c += DEEP[b] * 0.35 * k * smoothstep(0.0, 1.0, -e);   // never a reversed edge (SD20c V14)'), 'the deep\'s rise as EG-ZE fixed it');
  assert.ok(!/undersideEdge|smoothstep\(edge \+ 0\.03, edge/.test(EG_STAIR_FS), 'the picture and its reversed edge gone');
  for (const src of [EG_STAIR_FS, EG_UNDERSIDE_FS]) for (const c of src.matchAll(/smoothstep\(\s*([^,()]+)\s*,\s*([^,()]+)\s*,/g)) {
    const a = Number(c[1]), b = Number(c[2]);
    assert.ok(Number.isFinite(a) && Number.isFinite(b) && a < b, `an edge in order: ${c[0]}`);
  }
  // THE UNDERSIDE'S LIGHT
  const texel = [0.6, 0.5, 0.4, 1];
  const u = glslFunctions(EG_UNDERSIDE_FS, { uTex: 'uTex', uEye: [60, 0, 0], uCover: 1, uBand: 0, vPos: [40, -10, 0], vN: [0, -1, 0], vUv: [0.2, 0.3], gl_FragCoord: [10.5, 10.5, 0, 1], o: [0, 0, 0, 0], texture: (s, uv) => { assert.equal(s, 'uTex'); assert.deepEqual(uv, [0.2, 0.3]); return texel; } }, { eager: true });
  const L = EG_UNDERSIDE_LOOK, mix3 = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
  const lit = (n, b) => { const S = EG_SKIES[b], md = EG_MOON.dir.map((x) => x / Math.hypot(...EG_MOON.dir)); return [0, 1, 2].map((i) => S.deep[i] * (L.deep * Math.max(0, -n[1]) + L.side * (1 - Math.abs(n[1]))) + S.horizon[i] * L.hor + S.zenith[i] * L.zen * Math.max(0, n[1]) + EG_MOON.color[i] * L.moon * (S.moon ? 1 : 0) * Math.max(0, dot(n, md))); };
  for (const b of [0, 1, 2, 3]) for (const n of [[0, -1, 0], [0, 1, 0], [1, 0, 0], [0.55, 0.42, -0.72].map((x) => x / Math.hypot(0.55, 0.42, -0.72))]) {
    const got = u.litBy(n, b);
    assert.ok(got.every((x, i) => near(x, lit(n, b)[i], 1e-4)), `band ${b}: the place's light on ${n}`);
  }
  assert.ok(u.litBy([0, -1, 0], 0)[0] > u.litBy([0, 1, 0], 0)[0] * 3, 'the Galleries\' underside lit from below by the fire-sea');
  const toMoon = EG_MOON.dir.map((x) => x / Math.hypot(...EG_MOON.dir));
  assert.ok(u.litBy(toMoon, 2)[2] > u.litBy(toMoon.map((x) => -x), 2)[2] + 0.2, 'the Shade\'s moon on a face toward it');
  assert.ok(near(u.litBy(toMoon, 0)[2], lit(toMoon, 0)[2], 1e-6) && !EG_SKIES[0].moon, 'no moon in the Galleries');
  // melting into the void along the eye's ray
  for (const [p, eye] of [[[40, -10, 0], [60, 0, 0]], [[0, -30, 0], [900, -800, 0]]]) {
    const n = [0, -1, 0], r = sub(p, eye), d = Math.hypot(...r), k = Math.exp(-d * L.fog);
    const want = mix3(u.voidOf(r[1] / d, 0), lit(n, 0).map((x, i) => x * texel[i]), k);
    assert.ok(u.undersideAt(p, n, texel.slice(0, 3), eye, 0).every((x, i) => near(x, want[i], 1e-4)), `at ${d.toFixed(0)} m`);
  }
  const far = u.undersideAt([0, -30, 0], [0, -1, 0], [1, 1, 1], [1500, -1400, 0], 0), voidThere = u.voidOf(1370 / Math.hypot(1500, 1370), 0);
  assert.ok(far.every((x, i) => near(x, voidThere[i], 2e-3)), 'far off, the void');
  // one void, both programs
  const sf = stairFs(0).f;
  for (const e of [-0.9, -0.2, 0, 0.3, 0.95]) for (const b of [0, 1, 2, 3]) assert.deepEqual(u.voidOf(e, b), sf.voidOf(e, b));
  assert.ok(EG_STAIR_FS.includes(EG_VOID_GLSL) && EG_UNDERSIDE_FS.includes(EG_VOID_GLSL));
  assert.deepEqual(sf.stairScene([0.3, -0.4], 0, 2, EG_STAIR_MODE.cut), sf.voidOf(-0.4, 2).map((x) => x * EG_STAIR_LOOK.veilDim), 'the cut\'s void, dim');
  // the dither: the world where the veil has not taken, the underside whole where it has
  u.globals.uCover = 0;
  assert.throws(() => u.main(), GlslDiscard);
  u.globals.uCover = 1;
  u.main();
  assert.equal(u.globals.o[3], 1);
  assert.deepEqual([...u.globals.o].slice(0, 3), u.sdPixel(u.undersideAt([40, -10, 0], [0, -1, 0], texel.slice(0, 3), [60, 0, 0], 0), [10, 10], EG_STAIR_LOOK.steps));
});

/** A recording GL: every call kept, every object a create* makes its own (`at` the call that made it), every delete*
 *  noted - and, asked, a picture's upload that throws or a program whose source holds `failProgram` that will not link. */
function recordingGl({ failProgram = null, failTexAt = 0 } = {}) {
  const calls = [], made = [], gone = new Set(), sources = new Map(), attached = new Map();
  const consts = { COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100 };
  let id = 0, texN = 0;
  const failed = (sh) => !!failProgram && !!sources.get(sh)?.includes(failProgram);
  const gl = new Proxy({}, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      if (k in consts) return consts[k];
      if (/^[A-Z0-9_]+$/.test(k)) return k;   // every other enum its own name
      return (...a) => {
        calls.push([k, ...a]);
        if (k.startsWith('create')) { const o = { kind: k.slice(6), id: ++id, at: calls.length - 1 }; made.push(o); return o; }
        if (k.startsWith('delete')) { if (a[0]) gone.add(a[0]); return undefined; }
        if (k === 'shaderSource') sources.set(a[0], a[1]);
        if (k === 'attachShader') { if (!attached.has(a[0])) attached.set(a[0], []); attached.get(a[0]).push(a[1]); }
        if (k === 'getShaderParameter') return !failed(a[0]);
        if (k === 'getProgramParameter') return !(attached.get(a[0]) ?? []).some(failed);
        if (k === 'getShaderInfoLog' || k === 'getProgramInfoLog') return 'refused';
        if (k === 'getUniformLocation') return a[1];
        if (k === 'texImage2D' && failTexAt && ++texN === failTexAt) throw new Error('out of memory');
        return undefined;
      };
    },
  });
  const progOf = (token) => made.find((o) => o.kind === 'Program' && (attached.get(o) ?? []).some((sh) => sources.get(sh)?.includes(token)));
  return { gl, calls, made, gone, progOf };
}
const FALL_KINDS = ['VertexArray', 'Buffer', 'Texture'];
const kinds = (objs) => objs.reduce((a, o) => ({ ...a, [o.kind]: (a[o.kind] ?? 0) + 1 }), {});

test('EG-ZO THE PASS (render/eliteGates/egStairPass.js, over a recording GL): the underside uploaded - its program once, one vertex array, three vertex buffers and its Uint32 index buffer, a picture a record (nearest up close, mipmapped, the strata clamped top to tip); drawn after the void through the falling camera, depth cleared, tested and written, back faces culled, a sub-mesh a picture at its own offset, and the state given back; never in the veil or the cut; destroyed, every object it made deleted, once; an upload that fails part way frees what it made, and a program that will not build is never tried again (mutants: the depth never cleared; a sub-mesh at the wrong offset; the culling left on; a picture leaked; the program rebuilt each upload)', () => {
  const R = recordingGl(), pass = new EgStairRenderer(R.gl), parts = egUndersideParts(1);
  while (!parts.done) parts.step();
  const before = R.made.length;
  const under = pass.upload(parts);
  assert.ok(under?.live);
  const made = R.made.slice(before), mine = made.filter((o) => FALL_KINDS.includes(o.kind));
  assert.deepEqual(kinds(made), { Program: 1, Shader: 2, VertexArray: 1, Buffer: 4, Texture: 4 });
  const ib = R.calls.find((c) => c[0] === 'bufferData' && c[1] === 'ELEMENT_ARRAY_BUFFER');
  assert.equal(ib[2], parts.model.indices, 'the pack\'s Uint32 indices');
  assert.deepEqual(R.calls.filter((c) => c[0] === 'vertexAttribPointer').slice(-3).map((c) => [c[1], c[2], c[3]]), [[0, 3, 'FLOAT'], [1, 3, 'FLOAT'], [2, 2, 'FLOAT']], 'positions, normals, uvs');
  const tex = R.calls.filter((c) => c[0] === 'texImage2D');
  assert.deepEqual(tex.map((c) => [c[3], c[4], c[5]]), parts.art.map(([, a]) => ['RGBA8', a.albedo.width, a.albedo.height]));
  assert.ok(tex.every((c, i) => c[9] === parts.art[i][1].albedo.colors), 'the band\'s own pixels');
  assert.equal(R.calls.filter((c) => c[0] === 'generateMipmap').length, 4);
  const params = R.calls.filter((c) => c[0] === 'texParameteri');
  assert.equal(params.filter((c) => c[2] === 'TEXTURE_MAG_FILTER' && c[3] === 'NEAREST').length, 4, 'the pixel art crisp up close');
  assert.equal(params.filter((c) => c[2] === 'TEXTURE_MIN_FILTER' && c[3] === 'NEAREST_MIPMAP_LINEAR').length, 4);
  assert.deepEqual(params.filter((c) => c[2] === 'TEXTURE_WRAP_T').map((c) => c[3]), EG_UNDERSIDE_RECORDS.map((r) => (r === EG_DRESS.root ? 'CLAMP_TO_EDGE' : 'REPEAT')), 'the strata clamped top to tip');
  // drawn: the void, then the underside through the camera
  const cam = egFallCamera(1, 16 / 9, camArrays()), mark = R.calls.length;
  pass.draw(427, 240, 1, { cover: 1 }, { mode: EG_STAIR_MODE.fall, band: 1, cam, under });
  const d = R.calls.slice(mark), first = (name, k = 0) => d.map((c, j) => (c[0] === name ? j : -1)).filter((j) => j >= 0)[k] ?? -1;
  assert.deepEqual(d.find((c) => c[0] === 'clear'), ['clear', 0x4000 | 0x100], 'colour and depth cleared');
  assert.ok(first('drawArrays') >= 0 && first('drawArrays') < first('drawElements'), 'the void first');
  assert.ok(d.some((c) => c[0] === 'uniform3fv' && c[1] === 'uRight') && d.some((c) => c[0] === 'uniform4fv' && c[1] === 'uLens'), 'the void through the camera');
  assert.deepEqual(d.filter((c) => c[0] === 'uniformMatrix4fv').map((c) => [c[1], c[3]]), [['uProj', cam.proj], ['uView', cam.view]]);
  assert.equal(d.find((c) => c[0] === 'uniform3fv' && c[1] === 'uEye')[2], cam.eye);
  assert.deepEqual(d.filter((c) => c[0] === 'drawElements').map((c) => [c[2], c[3], c[4]]), parts.model.subMeshes.map((s) => [s.primitiveCount * 3, 'UNSIGNED_INT', s.startIndex * 4]), 'a sub-mesh a draw, at its own offset');
  assert.deepEqual(d.filter((c) => c[0] === 'bindTexture' && c[2]).map((c) => c[2]), EG_UNDERSIDE_RECORDS.map((r) => under.tex.get(r)), 'each with its record\'s picture');
  assert.deepEqual([d[first('enable', 0)][1], d[first('enable', 1)][1]], ['DEPTH_TEST', 'CULL_FACE']);
  assert.ok(first('enable', 1) < first('drawElements'));
  assert.deepEqual(d.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [true], 'depth written');
  assert.deepEqual(d.filter((c) => c[0] === 'disable').map((c) => c[1]), ['CULL_FACE', 'DEPTH_TEST'], 'the state given back');
  assert.ok(first('disable', 1) > first('drawElements', 3));
  // never in the veil or the cut, whatever is handed
  for (const mode of [EG_STAIR_MODE.veil, EG_STAIR_MODE.cut]) {
    const m0 = R.calls.length;
    pass.draw(427, 240, 1, { cover: 1 }, { mode, band: 1, cam, under });
    const dd = R.calls.slice(m0);
    assert.deepEqual(dd.filter((c) => ['drawElements', 'uniformMatrix4fv', 'enable'].includes(c[0])), [], 'no underside');
    assert.deepEqual(dd.find((c) => c[0] === 'clear'), ['clear', 0x4000], 'no depth cleared');
  }
  // destroyed: every object it made, once - and never drawn again
  under.destroy();
  assert.ok(mine.every((o) => R.gone.has(o)) && !under.live);
  const n = R.calls.filter((c) => c[0].startsWith('delete')).length;
  under.destroy();
  assert.equal(R.calls.filter((c) => c[0].startsWith('delete')).length, n, 'once');
  const m1 = R.calls.length;
  pass.draw(427, 240, 1, { cover: 1 }, { mode: EG_STAIR_MODE.fall, band: 1, cam, under });
  assert.ok(!R.calls.slice(m1).some((c) => ['drawElements', 'uniformMatrix4fv', 'enable'].includes(c[0])), 'a freed underside is never drawn');
  // the program kept: a second upload builds none
  const p0 = R.made.filter((o) => o.kind === 'Program').length, again = pass.upload(parts);
  assert.equal(R.made.filter((o) => o.kind === 'Program').length, p0, 'built once, kept with the pass');
  again.destroy();
  pass.destroy();
  assert.ok(R.gone.has(R.progOf('undersideAt')) && R.gone.has(R.progOf('stairScene')), 'both programs go with the pass');
  // an upload that fails at its third picture frees what it made; a program that will not build is tried once
  const warn = console.warn, warns = [];
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    const F = recordingGl({ failTexAt: 3 }), fp = new EgStairRenderer(F.gl), f0 = F.made.length;
    assert.equal(fp.upload(parts), null);
    const fm = F.made.slice(f0).filter((o) => FALL_KINDS.includes(o.kind));
    assert.deepEqual(kinds(fm), { VertexArray: 1, Buffer: 4, Texture: 3 }, 'made up to the picture that failed');
    assert.ok(fm.every((o) => F.gone.has(o)), 'and every one of them freed');
    assert.equal(warns.length, 1);
    const N = recordingGl({ failProgram: 'undersideAt' }), np = new EgStairRenderer(N.gl);
    assert.equal(np.upload(parts), null);
    assert.equal(np.upload(parts), null);
    assert.equal(N.calls.filter((c) => c[0] === 'shaderSource' && c[2].includes('undersideAt')).length, 1, 'tried once');
    assert.equal(N.calls.filter((c) => c[0] === 'texImage2D').length, 0, 'nothing uploaded');
    assert.equal(warns.length, 2);
    np.draw(427, 240, 1, { cover: 1 }, { mode: EG_STAIR_MODE.fall, band: 1, cam, under: null });
    assert.ok(N.calls.some((c) => c[0] === 'drawArrays') && !N.calls.some((c) => c[0] === 'drawElements'), 'the void alone');
  } finally { console.warn = warn; }
});

/** A page with a canvas, a frame clock and a recording GL - the veil's whole world. Each `step` is one tick of the
 *  veil's loop; `tickOf(j)` the tick call j was made in (0 before the first), `ticksOf(name)` the ticks a call was
 *  made in, `phases` the veil's phase after each tick (when `veil` is set). */
function page({ reduce = false, R = recordingGl() } = {}) {
  let frames = [], t = 1000;
  const ends = [], nodes = [], phases = [];
  const canvas = { style: {}, width: 0, height: 0, ctx: null, setAttribute() {}, remove() {}, getContext: (k, a) => { canvas.ctx = a; return R.gl; } };
  const doc = { body: { appendChild: (n) => { if (n !== canvas) nodes.push(n); } }, createElement: (tag) => (tag === 'canvas' ? canvas : { tag, style: {}, textContent: '', removed: false, setAttribute() {}, remove() { this.removed = true; } }) };
  const engine = { soundIndexForId: () => -1, playOneShot: () => {} };
  const win = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, matchMedia: (q) => ({ matches: reduce && /reduced-motion/.test(q) }) };
  const P = { doc, raf: (f) => frames.push(f), now: () => t, engine, win, R, canvas, nodes, phases, veil: null };
  P.step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); ends.push(R.calls.length); phases.push(P.veil?.phase); };
  P.tickOf = (j) => { const i = ends.findIndex((n) => n > j); return i < 0 ? ends.length + 1 : i + 1; };
  P.ticksOf = (name) => [...new Set(R.calls.map((c, j) => (c[0] === name ? P.tickOf(j) : -1)).filter((x) => x >= 0))];
  P.ticks = () => ends.length;
  P.label = () => nodes[0] ?? null;
  P.fallOf = (tick) => R.made.filter((o) => FALL_KINDS.includes(o.kind) && P.tickOf(o.at) === tick);
  P.stairAt = () => P.tickOf(R.calls.findIndex((c) => c[0] === 'shaderSource' && c[2].includes('stairScene')));
  P.untilUp = (ms = 16, max = 80) => { while (!P.ticksOf('texImage2D').length && P.ticks() < max) P.step(ms); return P.ticksOf('texImage2D')[0]; };
  return P;
}
const veilOn = (p) => (p.veil = createGateVeil(p));

test('EG-ZO THE FALL ON THE VEIL (ui/gate/gateVeil.js, over a recording GL): the canvas asks a depth buffer; a fall into a band makes its underside a slice a tick from the stair\'s first frame - never in the tick the veil shuts in, whose end runs the step\'s own work - uploads it in one tick while the veil still closes, and draws it each frame through the falling camera on the stair\'s own clock; every GL allocation of it is freed as the fall ends - the veil opened, a flash of another look, another band\'s fall, the veil destroyed - and an upload that fails leaves nothing and the void alone; the veil, the cut and reduced motion make no underside (mutants: every slice in one tick; a slice in the shutting tick; the underside kept past the veil; kept past another look; kept past the destroy; the camera off the stair\'s clock; a fall in the cut)', async () => {
  const slices = egUndersideParts(0).slices, s26 = egStairStep(26);
  // a fall into the Soul Cairn
  const p = page(), veil = veilOn(p);
  veil.cover(s26.look, s26.opts);
  assert.equal(p.canvas.ctx.depth, true, 'a depth buffer for the fall');
  const up = p.untilUp();
  assert.equal(up, p.stairAt() + slices + 1, 'a slice a tick from the stair\'s first frame, then the upload');
  assert.equal(veil.phase, 'closing', 'all of it made while the veil closes');
  assert.deepEqual([p.ticksOf('generateMipmap'), p.ticksOf('vertexAttribPointer').filter((t) => t > p.stairAt())], [[up], [up]], 'uploaded in one tick');
  const objs = p.fallOf(up);
  assert.deepEqual(kinds(objs), { VertexArray: 1, Buffer: 4, Texture: 4 });
  for (let i = 0; i < 5; i++) p.step();
  assert.deepEqual(p.ticksOf('drawElements'), [up, up + 1, up + 2, up + 3, up + 4, up + 5], 'drawn each frame once it stands');
  const eyes = p.R.calls.filter((c) => c[0] === 'uniform3fv' && c[1] === 'uEye'), sNow = (p.now() - 1000) / 1000;
  assert.deepEqual([...eyes.at(-1)[2]], [...new Float32Array(egFallEye(sNow))], 'the camera on the stair\'s own clock');
  const views = p.R.calls.filter((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uView');
  assert.deepEqual([...views.at(-1)[3]], [...egFallCamera(sNow, Math.round(1280 / 3) / Math.round(720 / 3), camArrays()).view]);
  assert.equal(p.R.calls.filter((c) => c[0] === 'drawElements').length / 6, EG_UNDERSIDE_RECORDS.length, 'a picture a draw');
  // the veil opened: every allocation of the fall freed
  while (veil.phase === 'closing') p.step();
  veil.frameDrawn(); veil.reveal();
  while (veil.phase !== 'idle') { veil.frameDrawn(); p.step(); }
  assert.ok(objs.every((o) => p.R.gone.has(o)), 'freed as the veil opens');
  assert.equal(p.label().style.display, 'none');
  assert.equal(p.ticksOf('texImage2D').length, 1, 'made once a fall');
  // slow frames: the tick the veil shuts in makes no slice - the swap's
  const q = page(), slow = veilOn(q);
  slow.cover(s26.look, s26.opts);
  const qUp = q.untilUp(200);
  const shutTick = q.phases.indexOf('shut') + 1;
  assert.ok(shutTick > q.stairAt() && shutTick < qUp, 'the veil shut while the underside was still being made');
  assert.equal(qUp, q.stairAt() + slices + 2, 'one tick passed over: the one the veil shut in');
  slow.destroy();
  // a flash of another look frees it at once
  const a = page(), va = veilOn(a), s51 = egStairStep(51);
  va.cover(s51.look, s51.opts);
  const aObjs = a.fallOf(a.untilUp());
  va.flash('egVeil', egStairStep(52).opts);
  assert.ok(aObjs.length === 9 && aObjs.every((o) => a.R.gone.has(o)), 'another look: freed in the flash itself');
  for (let i = 0; i < 20; i++) a.step();
  assert.equal(a.ticksOf('texImage2D').length, 1, 'and no underside for the veil');
  // another band's fall frees the first and makes its own
  const b = page(), vb = veilOn(b);
  vb.cover(s26.look, s26.opts);
  const bObjs = b.fallOf(b.untilUp());
  vb.flash(egStairStep(76).look, egStairStep(76).opts);
  assert.ok(bObjs.every((o) => b.R.gone.has(o)), 'the Cairn\'s underside freed for the Wellhead\'s');
  for (let i = 0; i < slices + 2; i++) b.step();
  const [, up2] = b.ticksOf('texImage2D');
  assert.ok(up2 > 0 && b.fallOf(up2).length === 9, 'the Wellhead\'s own made');
  const bands = b.R.calls.filter((c) => c[0] === 'uniform1i' && c[1] === 'uBand').map((c) => c[2]);
  assert.equal(bands.at(-1), 3);
  // the veil destroyed mid-fall
  const bLive = b.fallOf(up2);
  vb.destroy();
  assert.ok(bLive.every((o) => b.R.gone.has(o)), 'destroyed: the fall freed');
  assert.ok(b.R.gone.has(b.R.progOf('undersideAt')) && b.R.gone.has(b.R.progOf('stairScene')), 'and both programs');
  // an upload that fails: nothing held, the void alone, never tried again
  const warn = console.warn;
  console.warn = () => {};
  try {
    const f = page({ R: recordingGl({ failTexAt: 2 }) }), vf = veilOn(f);
    vf.cover(s26.look, s26.opts);
    const fUp = f.untilUp();
    for (let i = 0; i < 10; i++) f.step();
    assert.ok(f.R.made.filter((o) => FALL_KINDS.includes(o.kind) && f.tickOf(o.at) === fUp).every((o) => f.R.gone.has(o)), 'what it made, freed');
    assert.equal(f.ticksOf('texImage2D').length, 1, 'never tried again');
    assert.deepEqual(f.ticksOf('drawElements'), [], 'no underside');
    assert.ok(f.ticksOf('drawArrays').includes(f.ticks()), 'the void still drawn');
  } finally { console.warn = warn; }
  // the veil, the cut and reduced motion make none
  for (const [h, reduce] of [[27, false], [26, true], [3, true]]) {
    const c = page({ reduce }), vc = veilOn(c), st = egStairStep(h, reduce);
    vc.cover(st.look, st.opts);
    for (let i = 0; i < 30; i++) c.step();
    assert.deepEqual([c.ticksOf('texImage2D'), c.ticksOf('drawElements'), c.ticksOf('uniformMatrix4fv')], [[], [], []], `hall ${h}${reduce ? ', reduced motion' : ''}: no underside`);
  }
});

const ME = 'acct-0';
const B = '0123456789abcdef';
const T0 = 1_800_000_000_000;
const json = (w) => JSON.parse(JSON.stringify(w));

test('EG-ZO THE SWAP UNDER THE FALL (scenes/eliteGates/egClient.js played, a real veil over a recording GL): the step into Hall 26 is the circle swap in place under the full fall - the next circle built during the rest, stood while the veil is shut, after the underside stood, in a tick that made nothing of the fall; the underside drawn on through the hold after it, Hall 26 held centred; every allocation of the fall freed as the veil opens, and the company stands in circle 6 (mutants: the swap before the veil shut; the underside never freed)', async () => {
  const p = page(), veil = veilOn(p);
  const clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = 26; Br.sg = 'arrive'; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 }; Br.sa = clock - 1000; Br.su = clock + 20_000;
  let standing = 5;
  const swaps = [];
  const modes = {
    mode: 'dungeon', egHallBreach: () => Br.b, egHallCircle: () => standing, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    // the mode machine's own step (scenes/worldModes.js stepThroughFire): the veil closed, the place changed, the veil opened
    stepThroughFire: async (go, look, opts) => { try { await veil.cover(look, opts); return await go(); } finally { veil.reveal(); } },
    egPrebuild: () => 'ready',
    egSwapCircle: (r) => { swaps.push({ c: r.c, phase: veil.phase, tick: p.ticks() }); standing = r.c; return true; },
  };
  const spec = egHallOf(77, 26, 0);
  const player = { pos: realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z), height: 1.8, grounded: true, collider: { move: () => {} } };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => ({ welcomes: 1, terminal: false, sendEg: () => true }), hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: () => {}, veil: () => veil, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [],
    store: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); } },
    audio: { playOneShot: () => {} }, win: p.win, renderer: null });
  client.word(validEgOut(json(egStateOf(Br, clock))));
  client.frame();
  let label = '';
  for (let i = 0; i < 400 && (veil.phase !== 'idle' || !swaps.length); i++) { p.step(); veil.frameDrawn(); await settle(); if (p.label()?.style.display === 'block') label = p.label().textContent; }
  assert.equal(swaps.length, 1);
  assert.deepEqual([swaps[0].c, swaps[0].phase], [6, 'shut'], 'the circle swap in place, under the shut veil');
  const up = p.ticksOf('texImage2D')[0];
  assert.ok(up < swaps[0].tick, 'after the underside stood');
  assert.deepEqual(p.fallOf(swaps[0].tick), [], 'the swap\'s tick made nothing of the fall');
  const after = p.ticksOf('drawElements').filter((t) => t > swaps[0].tick);
  assert.ok(after.length >= Math.round(EG_STAIR_VEIL.fallHold / 0.016) / 2, `drawn on through the hold (${after.length} frames)`);
  assert.equal(label, 'Hall 26', 'its hall held centred');
  assert.ok(p.fallOf(up).every((o) => p.R.gone.has(o)), 'freed as the veil opens');
  assert.equal(standing, 6);
});
