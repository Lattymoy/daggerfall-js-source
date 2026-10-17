// CLIMB ON REAL GEOMETRY (2026-10-01, Mac: "Take care of the what is left including a jump catching a ledge"): the
// enhanced climb had been proven on boxes, prisms and 12,000 random scenes, never on Daggerfall's own buildings - no
// session had the game data. This is the measure for when one does: every side of real ARCH3D building models is
// climbed (Forward held at the foot of the wall: the free climb, its top-out or its hang, and the hang's shimmy) and
// the body's overlap with the model is measured EXACTLY - the capsule's axis against every triangle near it, never
// through the collider's own resolve or penetrationAt (which AUDIT CLIMB2 G2 found blind between its spheres). The
// harness itself is proven here on every run, against synthetic buildings whose overlap the box measure confirms; the
// real models run where ARENA2_PATH names the game's data (as every real-data test in the suite does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PlayerMotor, CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { Arch3dFile } from '../../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../../src/world/meshReader.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const R = CAPSULE_RADIUS;

/** The squared distance from point p to triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
function pointTriDist2(p, a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const at = (q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return at(a);
  const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return at(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return at([a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]); }
  const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return at(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return at([a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return at([b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]);
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return at([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

/** A model's triangles, each with its box, from positions and indices (model space, which is world space here). */
function triangles(positions, indices) {
  const out = [];
  for (let i = 0; i < indices.length; i += 3) {
    const v = [0, 1, 2].map((k) => { const j = indices[i + k] * 3; return [positions[j], positions[j + 1], positions[j + 2]]; });
    const lo = [0, 1, 2].map((a) => Math.min(v[0][a], v[1][a], v[2][a])), hi = [0, 1, 2].map((a) => Math.max(v[0][a], v[1][a], v[2][a]));
    out.push({ v, lo, hi });
  }
  return out;
}

/** How deep a capsule at these feet sits in the triangles: the radius less the axis's nearest approach to any of them,
 *  the axis sampled every 2 cm. A surface the body only touches reads 0; an axis through a surface reads the radius. */
function depth(tris, feet, height = CAPSULE_HEIGHT) {
  const y0 = feet[1] + R, y1 = feet[1] + height - R;
  let near2 = Infinity;
  for (const t of tris) {
    if (t.lo[0] > feet[0] + R || t.hi[0] < feet[0] - R || t.lo[2] > feet[2] + R || t.hi[2] < feet[2] - R || t.lo[1] > feet[1] + height || t.hi[1] < feet[1]) continue;
    for (let y = y0; y <= y1 + 1e-9; y += 0.02) near2 = Math.min(near2, pointTriDist2([feet[0], y, feet[2]], ...t.v));
  }
  return R - Math.sqrt(near2);
}

/** Climb every side of a building standing at `floorY` (its footprint `lo`..`hi` in x and z): from a metre out at the
 *  middle of each side, Forward held at the foot of the wall - the free climb, its top-out or its hang - and from a
 *  hang, Right held along the lip. Answers each side's outcome and the deepest the body went into the model while it
 *  was on the wall or in a move. */
function climbSides(col, tris, lo, hi, floorY, { skill = 100, steps = 900 } = {}) {
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  const sides = [
    { name: '-z', at: [cx, lo[2] - 1], yaw: 0 },
    { name: '+z', at: [cx, hi[2] + 1], yaw: Math.PI },
    { name: '-x', at: [lo[0] - 1, cz], yaw: Math.PI / 2 },
    { name: '+x', at: [hi[0] + 1, cz], yaw: -Math.PI / 2 },
  ];
  return sides.map(({ name, at, yaw }) => {
    const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
      parkour: { enabled: () => true, inputs: () => ({ climbing: skill }), say: () => {}, tally: () => {} },
    });
    m.spawn(at[0], floorY + 0.02, at[1]);
    let worst = 0, climbed = false, hung = false, top = -Infinity;
    const on = () => m.onWall || !!m._pkMove;
    const measure = () => { if (on()) worst = Math.max(worst, depth(tris, m.pos, m.height)); };
    for (let i = 0; i < steps; i++) {
      const done = climbed && !on() && m.grounded;
      m.update(1 / 60, { forward: done ? 0 : 1, strafe: 0, run: false, jump: false, crouch: false }, yaw);
      climbed ||= on();
      hung ||= m.hanging;
      if (i % 3 === 0 || m._pkMove) measure();
      if (m.grounded) top = Math.max(top, m.pos[1]);
      if (done && m.grounded) break;
      if (m.hanging) break;
    }
    let shimmied = 0;
    if (m.hanging) {
      const x0 = [...m.pos];
      for (let i = 0; i < 300 && on(); i++) {
        m.update(1 / 60, { forward: 0, strafe: 1, run: false, jump: false, crouch: false }, yaw);
        if (i % 3 === 0 || m._pkMove) measure();
      }
      shimmied = Math.hypot(m.pos[0] - x0[0], m.pos[2] - x0[2]);
    }
    const outcome = hung ? 'hang' : top > floorY + 1.5 ? 'top' : climbed ? 'let go' : 'no climb';
    return { name, outcome, worst, shimmied };
  });
}

/** A synthetic building as triangles: a box house under a pitched roof, and an octagonal tower. */
function boxTris(x0, y0, z0, x1, y1, z1) {
  return { positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), indices: Uint32Array.from(BOX_IDX) };
}

test('CLIMB REAL: the harness - every side of a house under a pitched roof and of an octagonal tower climbed, the body\'s depth in the triangles measured exactly (the box measure agrees)', () => {
  // the house: a 6 x 4 m box 3 m tall, a 30-degree roof rising from its long sides' eaves
  const col = new Collider(() => 0);
  const parts = [boxTris(-3, 0, -2, 3, 3, 2)];
  const t = Math.tan((30 * Math.PI) / 180), ridge = 3 + 2 * t;
  parts.push({ positions: new Float32Array([-3, 3, -2, 3, 3, -2, 3, ridge, 0, -3, ridge, 0, -3, 3, 2, 3, 3, 2]), indices: Uint32Array.from([0, 2, 1, 0, 3, 2, 4, 5, 2, 4, 2, 3]) });
  parts.forEach((p, i) => col.addMesh(`house${i}`, p.positions, p.indices, I));
  const tris = parts.flatMap((p) => triangles(p.positions, p.indices));
  // the measure against the box's own: a capsule pushed 5 cm into the -z face reads 5 cm
  assert.ok(Math.abs(depth(tris, [0, 0, -2 - R + 0.05]) - 0.05) < 1e-3, 'the triangle measure reads a box\'s depth');
  assert.ok(depth(tris, [0, 0, -2 - R - 0.2]) <= 0, 'and a body clear of it reads nothing in');
  const house = climbSides(col, tris, [-3, 0, -2], [3, 0, 2], 0);
  for (const s of house) {
    assert.ok(s.worst < 0.035, `house ${s.name}: ${s.worst.toFixed(3)} m deep`);
    assert.ok(s.outcome === 'top' || s.outcome === 'hang', `house ${s.name}: ${s.outcome}`);
  }
  // a house under a slab 0.6 m over its top (no room to stand or crouch up there): every side ends hanging from the
  // lip, and the shimmy goes along it
  const lid = new Collider(() => 0);
  const lp = [boxTris(-3, 0, -2, 3, 3, 2), boxTris(-4, 3.6, -3, 4, 3.8, 3)];
  lp.forEach((q, i) => lid.addMesh(`lid${i}`, q.positions, q.indices, I));
  const lidded = climbSides(lid, lp.flatMap((q) => triangles(q.positions, q.indices)), [-3, 0, -2], [3, 0, 2], 0);
  for (const s of lidded) {
    assert.ok(s.worst < 0.035, `lidded house ${s.name}: ${s.worst.toFixed(3)} m deep`);
    assert.ok(s.outcome === 'hang' && s.shimmied > 1, `lidded house ${s.name}: ${s.outcome}, shimmied ${s.shimmied.toFixed(2)} m`);
  }
  // the tower: eight sides of radius 2.5, 6 m tall, flat-topped
  const n = 8, Rt = 2.5, p = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * (i + 0.5)) / n; p.push([Math.sin(a) * Rt, Math.cos(a) * Rt]); }
  const V = [], idx = [];
  for (const y of [0, 6]) for (const [x, z] of p) V.push(x, y, z);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, n + j, i, n + j, n + i); }
  for (let i = 1; i < n - 1; i++) { idx.push(0, i + 1, i); idx.push(n, n + i, n + i + 1); }
  const tc = new Collider(() => 0);
  const tp = new Float32Array(V), ti = Uint32Array.from(idx);
  tc.addMesh('tower', tp, ti, I);
  const tower = climbSides(tc, triangles(tp, ti), [-Rt, 0, -Rt], [Rt, 0, Rt], 0);
  for (const s of tower) {
    assert.ok(s.worst < 0.035, `tower ${s.name}: ${s.worst.toFixed(3)} m deep`);
    assert.ok(s.outcome === 'top' || s.outcome === 'hang', `tower ${s.name}: ${s.outcome}`);
  }
});

test('CLIMB REAL: Daggerfall\'s own buildings - every side of the first 24 building-sized ARCH3D models climbed, never into the model', { skip: skipReal }, () => {
  const arch = new Arch3dFile();
  assert.equal(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))), true);
  const report = [];
  let taken = 0;
  for (let i = 0; i < arch.count && taken < 24; i++) {
    const cpu = dfMeshToModel(arch.getMesh(i), () => ({ width: 1, height: 1 }));
    const pos = cpu.positions;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < pos.length; k += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[k + a]); hi[a] = Math.max(hi[a], pos[k + a]); }
    const w = hi[0] - lo[0], d = hi[2] - lo[2], h = hi[1] - lo[1];
    if (!(w >= 5 && w <= 25 && d >= 5 && d <= 25 && h >= 3 && h <= 15)) continue;   // building-sized
    taken++;
    const col = new Collider(() => lo[1]);   // the ground at the model's foot
    col.addMesh(`m${i}`, pos, cpu.indices, I);
    const sides = climbSides(col, triangles(pos, cpu.indices), lo, hi, lo[1]);
    report.push(`#${i} (id ${arch.getRecordId(i)}, ${w.toFixed(1)} x ${d.toFixed(1)} x ${h.toFixed(1)} m): ${sides.map((s) => `${s.name} ${s.outcome} ${s.worst.toFixed(3)}${s.shimmied ? ` shimmy ${s.shimmied.toFixed(1)} m` : ''}`).join(', ')}`);
    for (const s of sides) assert.ok(s.worst < 0.035, `model #${i} ${s.name}: ${s.worst.toFixed(3)} m into the model (${s.outcome})`);
  }
  assert.equal(taken, 24, 'twenty-four building-sized models in the archive');
  console.log(report.join('\n'));
});

test('CLIMB REAL: a temperate town block\'s houses (RESIAM06) - Forward held at the middle of every side reaches the roof over its eave on most, and a climb that cannot go on is never a trap: Jump pushes off it (AUDIT CLIMB-FIELD: none reached a roof before)', { skip: skipReal }, () => {
  const arch = new Arch3dFile();
  assert.equal(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))), true);
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const byId = new Map();
  for (let i = 0; i < arch.count; i++) byId.set(arch.getRecordId(i), i);
  const col = new Collider(() => -0.025);
  const houses = new Map();
  for (const p of layoutRmbBlock(blocks.getBlockByName('RESIAM06.RMB')).models) {
    const i = byId.get(p.modelIdNum);
    if (i == null) continue;
    const cpu = dfMeshToModel(arch.getMesh(i), () => ({ width: 1, height: 1 }));
    col.addMesh('world', cpu.positions, cpu.indices, p.matrix);
    if (p.recordIndex == null) continue;
    const M = p.matrix, P = cpu.positions;
    let b = houses.get(p.recordIndex);
    if (!b) houses.set(p.recordIndex, b = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] });
    for (let k = 0; k < P.length; k += 3) {
      for (let a = 0; a < 3; a++) {
        const w = M[a] * P[k] + M[4 + a] * P[k + 1] + M[8 + a] * P[k + 2] + M[12 + a];
        b.lo[a] = Math.min(b.lo[a], w); b.hi[a] = Math.max(b.hi[a], w);
      }
    }
  }
  const tally = { roof: 0, held: 0, other: 0 };
  for (const b of houses.values()) {
    if (b.hi[1] - b.lo[1] < 2.5) continue;
    const cx = (b.lo[0] + b.hi[0]) / 2, cz = (b.lo[2] + b.hi[2]) / 2;
    for (const [x, z, yaw] of [[cx, b.lo[2] - 1.5, 0], [cx, b.hi[2] + 1.5, Math.PI], [b.lo[0] - 1.5, cz, Math.PI / 2], [b.hi[0] + 1.5, cz, -Math.PI / 2]]) {
      const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
        parkour: { enabled: () => true, inputs: () => ({ climbing: 100, jumping: 50 }), say: () => {}, tally: () => {} },
      });
      m.spawn(x, 0, z);
      let top = -Infinity;
      for (let i = 0; i < 700 && top < 2; i++) {
        m.update(1 / 60, { forward: 1, strafe: 0, run: false, jump: false, crouch: false }, yaw);
        if (m.grounded) top = Math.max(top, m.pos[1]);
      }
      if (top >= 2) { tally.roof++; continue; }
      if (!m.onWall) { tally.other++; continue; }
      tally.held++;
      // stalled on the wall (an eave past the hands' reach, a roof past 50 degrees): the keys let go, Jump pushes off
      for (let i = 0; i < 6; i++) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: i >= 2, crouch: false }, yaw);
      assert.ok(!m.onWall, `stalled at ${m.pos.map((v) => v.toFixed(2))}: Jump let go of the wall`);
    }
  }
  console.log(JSON.stringify(tally));
  assert.ok(tally.roof >= 0.6 * (tally.roof + tally.held + tally.other), `most sides climbed onto the roof (${JSON.stringify(tally)})`);
});
