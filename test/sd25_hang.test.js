// SD25 S11 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 6): THE HANG AND THE
// WORKS - what hangs under and around the Hour's islands: strata spires, gear rims and chains under each island
// (world/sdIslandModel.js), the far islands, the Works far below (world/sdWorksModel.js), stood and moved by scenes/sdHang.js.
// Every law here is run from its own code; none of it is a collider, and every draw is noShadow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SD_HANG, SD_SPIRE, SD_CHAIN, SD_HANG_ISLANDS, SD_HANG_STAGES, SD_CHAIN_RECORD, SD_FAR_ISLANDS, SD_FAR_CENTRE,
  hangPlan, buildHangModel, buildChainModel, buildFarIslandsModel, chainSwing, chainMatrix, farIslandsMatrix, spireDepth,
} from '../src/world/sdIslandModel.js';
import { SD_WORKS, SD_HANG_NOW, SD_WORKS_RECORD, SD_WORKS_TIP_V, SD_WORKS_FACE_V, SD_WORKS_PITCH, SD_WORKS_TOOTH, buildWorksGear, worksMatrix, worksAngle } from '../src/world/sdWorksModel.js';
import { worksArt, chainArt, hangArt, SD_WORKS_TIP_ROWS, SD_WORKS_TIP_GLOW } from '../src/world/sdHangArt.js';
import { createSdHang, SD_FAR_TURNS } from '../src/scenes/sdHang.js';
import { buildRealmModel, SD_REALM_ROOT_RECORD, SD_REALM_BRASS_RECORD, SD_ISLAND_SIDES, SD_ROOT_DEPTH, SD_LIP, SD_REALM_FLOORS } from '../src/world/sdRealm.js';
import { realmArt } from '../src/world/sdRealmArt.js';
import { SD_HALL_FLOORS } from '../src/world/sdHall.js';
import { SD_CHECKPOINTS, SD_STEPS_COURSE, SD_STEP_THICK } from '../src/world/sdSteps.js';
import { SD_THRESHOLD, SD_ORRERY, SD_ARENA, SD_REALM_ORIGIN, dungeonToRealm } from '../src/net/sdBrain.js';
import { SD_SKY_PAINT_FS, SD_SKY_PERIOD, SD_FURNACE } from '../src/render/sdSky.js';
import { SD_RAMP, sdTick } from '../src/world/sdLook.js';
import { offPalette, paletteOf } from '../src/world/sdPixelKit.js';
import { glslFunctions } from './glsl.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A model's triangles in the realm's frame (each { rec, P: [3 points], uv: [3 uvs] }), through `m` (a matrix) if given. */
function trisOf(model, m = null) {
  const out = [], P = model.positions, U = model.uvs;
  const at = (i) => {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    return m ? dungeonToRealm(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]) : dungeonToRealm(x, y, z);
  };
  for (const s of model.subMeshes) {
    for (let t = 0; t < s.primitiveCount; t++) {
      const i = s.startIndex + t * 3;
      out.push({ rec: s.textureRecord, P: [at(i), at(i + 1), at(i + 2)], uv: [[U[i * 2], U[i * 2 + 1]], [U[i * 2 + 2], U[i * 2 + 3]], [U[i * 2 + 4], U[i * 2 + 5]]] });
    }
  }
  return out;
}
const pointsOf = (model, m) => trisOf(model, m).flatMap((t) => t.P);
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
/** A moment (SD_HANG_NOW) whose chains swing by `a`. */
const swingNow = (a) => { const n = new Float64Array(3); n[SD_HANG_NOW.swing] = a; return n; };

/** EVERY FLOOR THE LAW KNOWS, as footprints with a height: the realm's floors, the hall's (the bridge, the first step), the
 *  Steps' checkpoints and every step's box (a Drift step over its whole swing). */
function lawFloors() {
  const out = [];
  for (const f of [...SD_REALM_FLOORS, ...SD_HALL_FLOORS, { kind: 'disc', ...SD_ARENA }]) out.push({ ...f, y: 0 });
  for (const c of SD_CHECKPOINTS) out.push({ kind: 'disc', x: c.x, z: c.z, r: c.r, y: c.y });
  for (const s of SD_STEPS_COURSE) out.push({ kind: 'box', x0: s.x - s.w / 2 - (s.amp ?? 0), x1: s.x + s.w / 2 + (s.amp ?? 0), z0: s.z - s.d / 2, z1: s.z + s.d / 2, y: s.y });
  return out;
}
const over = (f, p) => (f.kind === 'disc' ? Math.hypot(p[0] - f.x, p[2] - f.z) <= f.r + 1e-6
  : f.kind === 'band' ? Math.abs(p[0] - f.x) <= f.halfW && p[2] >= f.z0 && p[2] <= f.z1
    : p[0] >= f.x0 && p[0] <= f.x1 && p[2] >= f.z0 && p[2] <= f.z1);

test('SD-LOOK S11 THE LAW: nothing that hangs is law or looks like it - every root, gear rim and chain (at rest and swung both ways, both tiers) hangs at least SD_LIP under its own island\'s floor and inside its disc; nothing of the hang stands over any floor the law knows (the realm\'s, the hall\'s bridge and step, the checkpoints, every step\'s box over its swing) within SD_LIP of it; the Works and the far islands far under every floor; the motor\'s floors and colliders are the realm\'s own (mutants: the skirt hung from the floor; a spire\'s top through the cap; a chain\'s anchor up through the floor; a gear rim out past the disc)', () => {
  const floors = lawFloors();
  const clear = (p, what) => {
    for (const f of floors) if (over(f, p)) assert.ok(p[1] <= f.y - SD_LIP + 1e-4, `${what}: ${p.map((v) => v.toFixed(2))} stands within ${SD_LIP} m of a floor at y ${f.y}`);
  };
  for (const lite of [false, true]) {
    for (const stage of SD_HANG_STAGES) {
      const pts = pointsOf(buildHangModel(stage, { lite }));
      assert.ok(pts.length > 0, `${stage}: roots`);
      for (const p of pts) {
        const own = SD_HANG_ISLANDS.filter((i) => i.stage === stage).find((i) => Math.hypot(p[0] - i.x, p[2] - i.z) <= i.r + 1e-4);
        assert.ok(own, `${stage}: ${p.map((v) => v.toFixed(2))} inside an island's disc - no root widens an island`);
        assert.ok(p[1] <= own.y - SD_LIP + 1e-4, `${stage}: under its island's lip`);
        clear(p, `${stage} roots`);
      }
    }
    for (const isl of SD_HANG_ISLANDS) {
      const { model, axle } = buildChainModel(isl, { lite });
      for (const ang of [0, SD_CHAIN.swing, -SD_CHAIN.swing]) {
        for (const p of pointsOf(model, chainMatrix(axle, swingNow(ang), new Float32Array(16)))) {
          assert.ok(Math.hypot(p[0] - isl.x, p[2] - isl.z) <= isl.r && p[1] <= isl.y - SD_LIP + 1e-4, `${isl.stage} chain: under its island, inside its disc`);
          clear(p, `${isl.stage} chain`);
        }
      }
    }
  }
  for (const g of SD_WORKS) for (const p of pointsOf(buildWorksGear(g), worksMatrix(g, Float64Array.of(12.3, 0, 0), new Float32Array(16)))) assert.ok(p[1] < -200, 'the Works far under every floor');
  for (const p of pointsOf(buildFarIslandsModel(), farIslandsMatrix(Float64Array.of(0, 0, 1.1), new Float32Array(16)))) assert.ok(p[1] < -40, 'the far islands under every floor');
  // the hang stands no collider: its set is stood among the draws alone (scenes/sdHang.js takes no collider)
  const code = read('src/scenes/sdHang.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /collider|addMesh|realmClamp|realmFloorTris|realmColliderTris/, 'the hang touches no law');
});

test('SD-LOOK S11 THE ROOTS: 3-5 spires an island (one a root on the phones), each SD_SPIRE.sides x SD_SPIRE.rings, of different lengths, the main one spireDepth under the island (SD_ROOT_DEPTH at the Threshold\'s size); the skirt hung from the lip\'s own corners (realmIsland\'s, SD_LIP under the floor); the strata level across every spire (the root record\'s v is depth under the floor over the island\'s whole depth), every broken tip at least SD_SPIRE.haze into the haze; 2-3 brass gear rims on a large island, one on a small (mutants: the strata by spire; a tip not hazed; the skirt off the lip; the phones\' spires all stood)', () => {
  for (const isl of SD_HANG_ISLANDS) {
    const plan = hangPlan(isl), lite = hangPlan(isl, { lite: true });
    assert.ok(plan.spires.length >= 3 && plan.spires.length <= 5, `${isl.stage}: 3-5 spires`);
    assert.equal(lite.spires.length, 1, 'the phones: one spire a root');
    assert.equal(new Set(plan.spires.map((s) => s.len.toFixed(3))).size, plan.spires.length, 'of different lengths');
    assert.ok(near(plan.spires[0].len, spireDepth(isl.r)), 'the main one');
    assert.ok(isl.r > 4 ? plan.gears.length >= 2 && plan.gears.length <= 3 : plan.gears.length === 1, 'its gear rims');
    assert.ok(isl.chains >= 1 && isl.chains <= 2, 'one or two chains');
  }
  assert.ok(near(spireDepth(SD_THRESHOLD.r), SD_ROOT_DEPTH, 2.5), 'SD_ROOT_DEPTH at the Threshold\'s size');
  // the skirt's top ring is the lip's foot: realmIsland's own 48 corners, SD_LIP under the floor
  const lip = trisOf(buildRealmModel()).filter((t) => t.rec === SD_REALM_ROOT_RECORD).flatMap((t) => t.P).filter((p) => near(p[1], -SD_LIP) && near(Math.hypot(p[0] - SD_THRESHOLD.x, p[2] - SD_THRESHOLD.z), SD_THRESHOLD.r, 1e-3));
  assert.ok(lip.length >= SD_ISLAND_SIDES, 'the static island keeps its lip, SD_LIP deep at its rim');
  const roots = trisOf(buildHangModel('threshold')), rootPts = roots.filter((t) => t.rec === SD_REALM_ROOT_RECORD).flatMap((t) => t.P);
  const corners = Array.from({ length: SD_ISLAND_SIDES }, (_, k) => { const a = (k / SD_ISLAND_SIDES) * Math.PI * 2; return [SD_THRESHOLD.x + Math.cos(a) * SD_THRESHOLD.r, -SD_LIP, SD_THRESHOLD.z + Math.sin(a) * SD_THRESHOLD.r]; });
  const atCorner = (p, c) => near(p[0], c[0], 1e-3) && near(p[1], c[1], 1e-3) && near(p[2], c[2], 1e-3);
  corners.forEach((c, k) => assert.ok(rootPts.some((p) => atCorner(p, c)), `the skirt hangs from the lip's corner ${k}`));
  const skirtTop = rootPts.filter((p) => near(p[1], -SD_LIP, 1e-3));
  assert.ok(skirtTop.length >= SD_ISLAND_SIDES * 2 && skirtTop.every((p) => corners.some((c) => atCorner(p, c))), 'and from nowhere else');
  // the strata: v is the depth under the floor over the whole depth - level across spires - but at a tip, the haze
  for (const isl of SD_HANG_ISLANDS) {
    const plan = hangPlan(isl), depth = SD_LIP + SD_HANG.skirt + plan.L0, tips = new Set();
    for (const s of plan.spires) tips.add(s);
    const tris = trisOf(buildHangModel(isl.stage)).filter((t) => t.rec === SD_REALM_ROOT_RECORD && t.P.every((p) => Math.hypot(p[0] - isl.x, p[2] - isl.z) <= isl.r + 1e-3));
    let level = 0, hazed = 0, deepest = Infinity;
    for (const t of tris) {
      for (let j = 0; j < 3; j++) {
        const p = t.P[j], v = t.uv[j][1], want = Math.min(1, (isl.y - p[1]) / depth);
        deepest = Math.min(deepest, p[1]);
        if (near(v, want, 2e-3)) level++;
        else { assert.ok(v >= SD_SPIRE.haze - 1e-6 && v >= want - 2e-3, `${isl.stage}: off the strata only at a tip, into the haze (v ${v.toFixed(3)} at depth share ${want.toFixed(3)})`); hazed++; }
      }
    }
    assert.ok(level > hazed * 2 && hazed > 0, `${isl.stage}: level strata, hazed tips`);
    // every broken tip into the haze: about each spire's tip ring, nothing short of SD_SPIRE.haze
    for (const sp of plan.spires) {
      const tipY = plan.foot + 0.05 - sp.len, rt = sp.R * SD_SPIRE.tip * (1 + SD_SPIRE.jitter), tx = sp.x + Math.cos(sp.bendA) * sp.bend, tz = sp.z + Math.sin(sp.bendA) * sp.bend;
      const around = tris.flatMap((t) => t.P.map((p, j) => [p, t.uv[j][1]])).filter(([p]) => Math.hypot(p[0] - tx, p[2] - tz) <= rt * 1.3 && Math.abs(p[1] - tipY) <= rt * 0.7);
      assert.ok(around.length >= SD_SPIRE.sides && around.every(([, v]) => v >= SD_SPIRE.haze - 1e-6), `${isl.stage}: a tip into the haze`);
    }
    assert.ok(deepest <= isl.y - SD_LIP - SD_HANG.skirt - plan.L0 * 0.9, `${isl.stage}: the main spire hangs its depth into the void`);
  }
  // each spire a ring sweep of SD_SPIRE.sides x SD_SPIRE.rings (the bands' quads and the tip's fan), the gear rims in brass
  const isl = SD_HANG_ISLANDS[0], plan = hangPlan(isl, { lite: true }), one = trisOf(buildHangModel('threshold', { lite: true }));
  const rootTris = one.filter((t) => t.rec === SD_REALM_ROOT_RECORD).length, skirt = SD_ISLAND_SIDES * 3;
  assert.equal(rootTris - skirt, plan.spires.length * SD_SPIRE.sides * ((SD_SPIRE.rings - 1) * 2 + (SD_SPIRE.rings - 2) * 2 + 1), 'a spire\'s bands, its ledges and its tip');
  // the cake's ledges face down, into the furnace's light
  const ledges = one.filter((t) => t.rec === SD_REALM_ROOT_RECORD && near(t.P[0][1], t.P[1][1], 1e-4) && near(t.P[1][1], t.P[2][1], 1e-4) && t.P[0][1] < -SD_LIP - SD_HANG.skirt - 0.1);
  assert.equal(ledges.length, plan.spires.length * SD_SPIRE.sides * (SD_SPIRE.rings - 2) * 2, 'a ledge at every inner ring');
  for (const t of ledges) { const u = t.P[1].map((v, i) => v - t.P[0][i]), w = t.P[2].map((v, i) => v - t.P[0][i]); assert.ok(u[2] * w[0] - u[0] * w[2] < 0, 'facing down'); }
  assert.ok(one.some((t) => t.rec === SD_REALM_BRASS_RECORD), 'its gear rims in the realm\'s brass');
});

test('SD-LOOK S11 THE CHAINS: SD_CHAIN.links 4-sided links from each anchor, alternate ones turned a quarter; the swing turns about the line through the anchors, so every anchor stays put while the chain\'s foot swings; one way on each even second, the other on each odd, swung over the tick\'s ease and held (the escapement\'s), never past SD_CHAIN.swing - every chain the same (mutants: the swing about the island\'s centre; the swing smooth; the links never turned)', () => {
  for (const isl of SD_HANG_ISLANDS) {
    const plan = hangPlan(isl), { model, axle } = buildChainModel(isl);
    assert.equal(plan.anchors.length, isl.chains);
    const tris = trisOf(model);
    assert.ok(tris.every((t) => t.rec === SD_CHAIN_RECORD), 'the chains\' record');
    assert.equal(tris.length, isl.chains * SD_CHAIN.links * 16 * 2, 'four bars a link: two faces and two walls a bar');
    const m = chainMatrix(axle, swingNow(SD_CHAIN.swing), new Float32Array(16));
    for (const a of plan.anchors) {
      const d = [SD_REALM_ORIGIN[0] + a[0], a[1], SD_REALM_ORIGIN[2] + a[2]];
      const q = [m[0] * d[0] + m[4] * d[1] + m[8] * d[2] + m[12], m[1] * d[0] + m[5] * d[1] + m[9] * d[2] + m[13], m[2] * d[0] + m[6] * d[1] + m[10] * d[2] + m[14]];
      assert.ok(Math.hypot(q[0] - d[0], q[1] - d[1], q[2] - d[2]) < 1e-3, `${isl.stage}: an anchor stays put`);
    }
    const low = tris.flatMap((t) => t.P).reduce((a, p) => (p[1] < a[1] ? p : a));
    const dl = [SD_REALM_ORIGIN[0] + low[0], low[1], SD_REALM_ORIGIN[2] + low[2]];
    const ql = [m[0] * dl[0] + m[4] * dl[1] + m[8] * dl[2] + m[12], m[2] * dl[0] + m[6] * dl[1] + m[10] * dl[2] + m[14]];
    assert.ok(Math.hypot(ql[0] - dl[0], ql[1] - dl[2]) > 0.1, `${isl.stage}: its foot swings`);
    // alternate links turned: the first link's faces face along one axis, the second's along the other
    const faceN = (t) => { const u = t.P[1].map((v, i) => v - t.P[0][i]), w = t.P[2].map((v, i) => v - t.P[0][i]); return [Math.abs(u[1] * w[2] - u[2] * w[1]), Math.abs(u[0] * w[1] - u[1] * w[0])]; };
    const [n0x, n0z] = faceN(tris[0]), [n1x, n1z] = faceN(tris[32]);
    assert.ok((n0z > n0x) !== (n1z > n1x), 'the next link turned a quarter');
  }
  // the swing: held after the ease, opposite on the next second, bounded
  const at = (t) => chainSwing(sdTick(t));
  for (const s of [0, 7, 1_800_000_000, 1_800_000_001]) {
    assert.ok(near(at(s + 0.3), at(s + 0.9), 1e-9), 'held after the tick\'s ease');
    assert.ok(near(at(s + 0.5), -at(s + 1.5), 1e-9), 'the other way the next second');
    assert.ok(Math.abs(at(s + 0.1)) < SD_CHAIN.swing * 0.99 && Math.abs(at(s + 0.6)) > SD_CHAIN.swing * 0.99 && Math.abs(at(s + 0.6)) <= SD_CHAIN.swing + 1e-12, 'swung over the ease, never past the swing');
  }
});

test('SD-LOOK S11 THE WORKS: four gears 40-80 m across, their faces 240-280 m down under the course; meshed neighbours turn opposite ways (a gear on another\'s axle with it), their pitch circles touching and their teeth in each other\'s gaps at every moment; a tooth a tick on the escapement; the phones\' two; only a tooth\'s tip samples the record\'s tip band; from every point of the course every gear is seen down through the furnace (render/sdSky.js SD_FURNACE, the paint shader\'s own) and inside the dungeon arm\'s 500 m far plane (mutants: a follower half a tooth off; a follower turning with its driver; the face uv reaching the tip band; the furnace narrowed)', () => {
  assert.equal(SD_WORKS.length, 4);
  assert.deepEqual(SD_WORKS.filter((g) => g.lite).length, 2, 'the phones: two gears');
  for (const g of SD_WORKS) {
    const across = 2 * (g.r + SD_WORKS_TOOTH.out * (2 * g.r) / g.teeth);
    assert.ok(across >= 40 && across <= 82, `${g.teeth}: ${across.toFixed(1)} m across`);
    assert.ok(g.y <= -240 && g.y >= -280, 'its face 240-280 m down');
    assert.ok(g.z > SD_THRESHOLD.z && g.z < SD_ARENA.z && Math.abs(g.x) < 60, 'under the course');
  }
  assert.ok(near(SD_WORKS[0].w, (2 * Math.PI) / SD_WORKS[0].teeth), 'the driver: a tooth a tick');
  const pairs = [[0, 1], [2, 3]];
  for (const [i, j] of pairs) {
    const d = SD_WORKS[i], f = SD_WORKS[j];
    assert.ok(Math.sign(d.w) === -Math.sign(f.w), 'meshed neighbours turn opposite ways');
    assert.ok(near(Math.abs(d.w) * d.r, Math.abs(f.w) * f.r, 1e-9), 'their pitch circles roll together');
    assert.ok(near(Math.hypot(f.x - d.x, f.z - d.z), d.r + f.r, 1e-6) && d.y === f.y, 'their pitch circles touch, on one layer');
    const b = Math.atan2(f.z - d.z, f.x - d.x), p = SD_WORKS_PITCH;
    for (const ticks of [0, 0.37, 5.2, 1e5 + 0.61, 1_800_000_000.25]) {
      const wrap = (x) => ((x % p) + p) % p;
      // the driver's teeth and the follower's along the line of their contact, as arc from it: a half-pitch apart
      const sd = wrap(d.r * (worksAngle(d, ticks) - b)), sf = wrap(-f.r * (worksAngle(f, ticks) - b - Math.PI));
      const off = wrap(sd - sf);
      assert.ok(Math.abs(off - p / 2) < 1e-3 * p || (ticks > 1e8 && Math.abs(off - p / 2) < 0.02 * p), `${d.teeth}/${f.teeth} at ${ticks}: a tooth in a gap (${(off / p).toFixed(4)} of a pitch)`);
    }
  }
  assert.ok(SD_WORKS[2].x === SD_WORKS[1].x && SD_WORKS[2].z === SD_WORKS[1].z && SD_WORKS[2].w === SD_WORKS[1].w, 'the upper driver rides the lower follower\'s axle, turning with it');
  // the tip band: a tooth's tip alone
  for (const g of SD_WORKS) {
    const tris = trisOf(buildWorksGear(g));
    assert.ok(tris.every((t) => t.rec === SD_WORKS_RECORD));
    const tipped = tris.filter((t) => t.uv.some(([, v]) => v < SD_WORKS_FACE_V - 1e-6));
    assert.equal(tipped.length, g.teeth * 2, 'one tip a tooth, two triangles each');
    assert.ok(tipped.every((t) => t.uv.every(([, v]) => v >= SD_WORKS_TIP_V[0] - 1e-6 && v <= SD_WORKS_TIP_V[1] + 1e-6)), 'inside the band');
    assert.ok(tris.every((t) => t.uv.every(([u, v]) => u >= -1e-6 && u <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6)), 'one picture over the gear, never wrapped onto the band');
  }
  // seen down through the furnace from every point of the course, inside the far plane
  const eyes = courseEyes();
  let least = Infinity, farthest = 0;
  for (const g of SD_WORKS) for (const e of eyes) {
    const h = Math.hypot(g.x - e[0], g.z - e[2]);
    least = Math.min(least, Math.atan2(e[1] - g.y, h) - Math.atan2(g.r * 1.1, Math.hypot(h, e[1] - g.y)));
    farthest = Math.max(farthest, Math.hypot(h + g.r * 1.1, e[1] - g.y));
  }
  assert.ok(least > SD_FURNACE.from, `every gear seen ${least.toFixed(3)} rad down, past the furnace's rise (${SD_FURNACE.from})`);
  assert.ok(farthest < 500, `inside the far plane (${farthest.toFixed(1)} m)`);
  // the paint shader's own furnace: nothing of it above its rise, its whole glow at its full - the band the Works are seen in
  const f = glslFunctions(SD_SKY_PAINT_FS, { uTime: 0, uHaze: [0, 0, 0], uSteps: 10, uEnding: [0, 0, 0], uEndingIdx: -1, vUv: [0.5, 0.5], texelFetch: () => [0, 0, 0, 0] });
  const lum = (e) => { let s = 0; for (let k = 0; k < 16; k++) { const c = f.voidAt(e, [k % 4, Math.floor(k / 4)]); s += c[0] + c[1] + c[2]; } return s / 16; };
  assert.ok(lum(-SD_FURNACE.from) <= lum(-SD_FURNACE.from + 0.15) + 1e-9, 'nothing of it above its rise (only the mist, deepening to black)');
  assert.ok(lum(-least) > lum(-SD_FURNACE.from) + 0.03, 'the nearest gear\'s depression already in the glow');
  assert.ok(lum(-SD_FURNACE.full) > 0.4, 'its full glow');
});

/** Eyes over every floor of the course (1.7 m up): the stages, the checkpoints, every step. */
function courseEyes() {
  const eyes = [];
  const disc = (c, y = 0) => { for (let r = 0; r <= c.r; r += Math.max(1, c.r / 4)) for (let a = 0; a < 2 * Math.PI; a += 0.5) eyes.push([c.x + Math.cos(a) * r, y + 1.7, c.z + Math.sin(a) * r]); };
  disc(SD_THRESHOLD); disc(SD_ORRERY); disc(SD_ARENA);
  for (const c of SD_CHECKPOINTS) disc(c, c.y);
  for (const s of SD_STEPS_COURSE) eyes.push([s.x, s.y + 1.7, s.z]);
  for (let z = 7; z <= 25; z += 3) eyes.push([0, 1.7, z]);
  return eyes;
}

test('SD-LOOK S11 THE FAR ISLANDS: a dozen, each an 8-gon top on one spire (about 40 triangles); from every point of the course in every turn of the set each stands past 150 m, inside the 500 m far plane, and wholly under the clock-face\'s seen edge (the paint shader\'s own `seen`) - so none ever crosses the face; the set turned about the ring\'s centre, a whole number of turns a sky period (mutants: an island raised over the edge; the turn about the realm\'s origin; the turns not whole)', () => {
  assert.equal(SD_FAR_ISLANDS.length, 12);
  const model = buildFarIslandsModel(), tris = trisOf(model);
  assert.equal(tris.length, 12 * 32, 'about 40 triangles an island');
  const edge = Number(/seen = smoothstep\((-?[\d.]+),/.exec(SD_SKY_PAINT_FS)[1]);
  assert.ok(edge < 0, 'the face is unseen under the horizon\'s mist');
  const eyes = courseEyes(), M = new Float32Array(16);
  let least = Infinity, most = 0, top = -Infinity;
  for (let k = 0; k < 36; k++) {
    farIslandsMatrix(Float64Array.of(0, 0, (k / 36) * 2 * Math.PI), M);
    for (const p of pointsOf(model, M)) for (const e of eyes) {
      const h = Math.hypot(p[0] - e[0], p[2] - e[2]), d = Math.hypot(h, p[1] - e[1]);
      least = Math.min(least, d); most = Math.max(most, d); top = Math.max(top, Math.atan2(p[1] - e[1], h));
    }
  }
  assert.ok(least >= 150, `past 150 m (${least.toFixed(1)})`);
  assert.ok(most < 500, `inside the far plane (${most.toFixed(1)})`);
  assert.ok(top < edge - 0.04, `under the face's seen edge (${top.toFixed(3)} rad, the edge ${edge})`);
  // the turn: about the upright through the ring's centre, whole turns a period
  farIslandsMatrix(Float64Array.of(0, 0, 1.3), M);
  const c = [SD_REALM_ORIGIN[0] + SD_FAR_CENTRE[0], 0, SD_REALM_ORIGIN[2] + SD_FAR_CENTRE[2]];
  assert.ok(near(M[0] * c[0] + M[8] * c[2] + M[12], c[0], 1e-3) && near(M[2] * c[0] + M[10] * c[2] + M[14], c[2], 1e-3), 'the ring\'s centre stays');
  assert.ok(Number.isInteger(SD_FAR_TURNS) && SD_FAR_TURNS !== 0 && SD_SKY_PERIOD > 0, 'whole turns a sky period');
  const hang = createSdHang({ renderer: fakeRenderer(), clock: () => 0, lite: false });
  hang.stand({ dynamicDraws: [] });
  const farDraw = hang.draws().find((d) => d.stage === 'sky'), m0 = [...farDraw.object.matrix];
  const later = createSdHang({ renderer: fakeRenderer(), clock: () => SD_SKY_PERIOD, lite: false });
  later.stand({ dynamicDraws: [] });
  assert.ok(later.draws().find((d) => d.stage === 'sky').object.matrix.every((v, i) => near(v, m0[i], 1e-3)), 'a period on, the set where it was');
});

function fakeRenderer() {
  const made = new Set();
  return { made, createMesh: (m) => { const g = { m }; made.add(g); return g; }, destroyMesh: (g) => { made.delete(g); } };
}

test('SD-LOOK S11 THE HANG\'S ART: the Works\' blackened brass lights its tip band alone (SD_WORKS_TIP_GLOW, the ambient rung) - every row the model\'s tip band reads inside it - in its ramps; the chains unlit, in theirs; both records (80, 81) in the realm\'s art, so they go up with the realm\'s own (mutants: the face glowing; the tips unlit; the band\'s rows short of the model\'s)', () => {
  const W = worksArt(), C = chainArt();
  const lit = (img, row) => { let n = 0; for (let x = 0; x < img.width; x++) { const i = (row * img.width + x) * 4; if (img.colors[i] + img.colors[i + 1] + img.colors[i + 2] > 0) n++; } return n; };
  for (let y = 0; y < W.emission.height; y++) assert.equal(lit(W.emission, y) > 0, y < SD_WORKS_TIP_ROWS, `row ${y}: lit only on the tip band`);
  assert.ok(Math.floor(SD_WORKS_TIP_V[1] * W.albedo.height) < SD_WORKS_TIP_ROWS && Math.floor(SD_WORKS_FACE_V * W.albedo.height) >= SD_WORKS_TIP_ROWS, 'the model\'s band inside the picture\'s, its face past it');
  assert.ok(SD_WORKS_TIP_GLOW >= 0.25 && SD_WORKS_TIP_GLOW <= 0.45, 'the ambient rung');
  for (let y = 0; y < C.emission.height; y++) assert.equal(lit(C.emission, y), 0, 'the chains unlit');
  const { brass, verdigris, void: vo } = SD_RAMP;
  assert.equal(offPalette(W.albedo, paletteOf(brass, verdigris, vo)), 0, 'the Works in their ramps');
  assert.equal(offPalette(C.albedo, paletteOf(brass, verdigris)), 0, 'the chains in theirs');
  // blackened: the face darker than the realm's brass
  const mean = (img, y0) => { let s = 0, n = 0; for (let i = y0 * img.width * 4; i < img.colors.length; i += 4) { s += img.colors[i] + img.colors[i + 1] + img.colors[i + 2]; n++; } return s / n; };
  assert.ok(mean(W.albedo, SD_WORKS_TIP_ROWS + 1) < 120, 'black against the furnace');
  assert.deepEqual(hangArt().map(([r]) => r), [SD_WORKS_RECORD, SD_CHAIN_RECORD]);
  const recs = realmArt().map(([r]) => r);
  assert.ok(recs.includes(SD_WORKS_RECORD) && recs.includes(SD_CHAIN_RECORD), 'carried by the realm\'s art');
});

test('SD-LOOK S11 THE SET: every draw noShadow and tagged with its stage; the desktop\'s 15 (a roots mesh a stage, a chain mesh an island, the far islands, four gears), the phones\' 12 (no far islands, two gears, chains that never swing); the frame swings the chains and turns the gears on the clock it is handed; stood once; clear frees every mesh it made (mutants: a draw casting; the phones\' chains swung; a mesh kept at clear)', () => {
  for (const lite of [false, true]) {
    const r = fakeRenderer(), dyn = [];
    let t = 100.6;
    const hang = createSdHang({ renderer: r, clock: () => t, lite });
    hang.stand({ dynamicDraws: dyn });
    hang.stand({ dynamicDraws: dyn });
    assert.equal(dyn.length, lite ? 12 : 15, 'its draws, stood once');
    assert.ok(dyn.every((d) => d.noShadow === true && typeof d.stage === 'string'), 'noShadow, with a stage');
    assert.deepEqual([...new Set(dyn.map((d) => d.stage))].sort(), (lite ? ['arena', 'orrery', 'steps', 'threshold', 'works'] : ['arena', 'orrery', 'sky', 'steps', 'threshold', 'works']).sort());
    const chains = dyn.filter((d) => d.stage !== 'works' && d.stage !== 'sky' && dyn.indexOf(d) >= 4), gears = dyn.filter((d) => d.stage === 'works');
    const before = chains.map((d) => [...d.object.matrix]), g0 = gears.map((d) => [...d.object.matrix]);
    t = 101.6;
    hang.frame();
    const moved = chains.some((d, i) => d.object.matrix.some((v, k) => !near(v, before[i][k], 1e-7)));
    assert.equal(moved, !lite, lite ? 'the phones\' chains hang still' : 'the chains swing on the tick');
    // on the escapement: swung over the tick's ease and held till the next
    const pose = () => chains.map((d) => [...d.object.matrix]);
    t = 102.3; hang.frame(); const held0 = pose();
    t = 102.9; hang.frame();
    assert.ok(chains.every((d, i) => d.object.matrix.every((v, k) => near(v, held0[i][k], 1e-7))), 'held through the second');
    assert.ok(gears.every((d, i) => d.object.matrix.some((v, k) => !near(v, g0[i][k], 1e-7))), 'the gears turn');
    assert.ok(r.made.size > 0);
    hang.clear();
    assert.equal(r.made.size, 0, 'every mesh freed');
  }
});

test('SD-LOOK S11 THE FRAME MAKES NOTHING (AUDIT SD II L2 F9): the hang\'s frame - the chains swung, the gears turned, the far set turned, every matrix in place - measured in a child with a 64 MB young space against a control that must show (mutants: a fresh matrix a frame; the clock read into a fresh list)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    const { createSdHang } = await import(${url('src/scenes/sdHang.js')});
    const renderer = { createMesh: () => ({}), destroyMesh() {} };
    const clock = Array.from({ length: 4096 }, (_, k) => 1_800_000_000 + k / 60); clock.push('tagged');   // numbers already made, as the host hands them (sd11a's)
    let k = 0;
    const hang = createSdHang({ renderer, clock: () => clock[(k = (k + 1) & 4095)], lite: false });
    hang.stand({ dynamicDraws: [] });
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const sink = [];
    const out = { control: bytes(() => { sink[0] = [k + 0.5, k + 1.5, k + 2.5]; }), hang: bytes(() => hang.frame()) };
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
  assert.ok(m.hang < 2, `the hang: ${m.hang.toFixed(2)} bytes a frame`);
});

test('SD-LOOK S11 THE HOST: the dungeon context stands the hang among its draws alone (no collider), poses it in sdPose before the world pass draws, on the realm\'s anchored seconds, and frees it at teardown with the Hour\'s other sets; the lab stands the same set (mutants: the clear dropped; the hang stood with the collider)', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdHang = _sdRealm \? createSdHang\(\{ renderer, clock: sdEndClock \}\) : null;/, 'made in the Hour alone, on the anchored seconds');
  const pose = D.slice(D.indexOf('sdPose(dt, playerFeet) {'), D.indexOf('sdRiftLanding() {'));
  assert.match(pose, /if \(sdHang\) \{ sdHang\.stand\(\{ dynamicDraws \}\); sdHang\.frame\(\); \}/, 'stood among the draws alone and framed before the draws');
  assert.match(D, /sdRemnant\?\.clear\(\);[^\n]*\n\s*sdHang\?\.clear\(\);/, 'freed with the Hour\'s other sets');
  const L = read('src/tools/abyssLab.js');
  assert.match(L, /hang\.stand\(\{ dynamicDraws \}\);/);
  assert.match(L, /hang\.frame\(\);/);
});
