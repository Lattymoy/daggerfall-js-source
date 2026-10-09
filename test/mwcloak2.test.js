// MW-CLOAK2 (2026-10-09, Mac: "I dont like how the cloak isnt smooth around the shoulders"): THE CLOAK SMOOTHED - two
// levels of Loop subdivision at bake time (tools/meshSubdivide.mjs), and the fit over the armour eased round each
// point that comes through rather than moving a triangle's three corners (src/formats/mwCloakFit.js).
//
// The export is 140 vertices about five units apart. Over the shoulders a face stood up to 35 degrees off its corners'
// normals, the outline turned as sharply as 82 degrees at a vertex, and the fit left a facet over each pauldron's edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { CLASSIC_ARMOR_TEMPLATE } from '../src/characters/ownArmorModels.js';
import { isCloakSlot } from '../src/characters/ownClothingModels.js';
import { CLOAK_EASE_RADIUS, fitCloakOver } from '../src/formats/mwCloakFit.js';
import { loopSubdivide, loopSubdivideOnce, vertexNormals } from '../tools/meshSubdivide.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { bakeObject } from '../tools/bakeSteelPlate.mjs';
import { SOURCE, CLOAK_OBJECT, CLOAK_BOX, CLOAK_SUBDIVISIONS } from '../tools/bakeCloak.mjs';
import { retailSkeleton } from './fixtures/mw/retailRig.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/** A 3 x 3 grid of vertices, flat at z = 2, eight triangles wound to face +z; uv = (x, y) / 2. */
function grid() {
  const positions = []; const uvs = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { positions.push(x, y, 2); uvs.push(x / 2, y / 2); }
  const indices = [];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const a = y * 3 + x; indices.push(a, a + 1, a + 4, a, a + 4, a + 3); }
  return { positions: Float32Array.from(positions), indices: Uint16Array.from(indices), uvs: Float32Array.from(uvs), normals: Float32Array.from({ length: 27 }, (_, k) => (k % 3 === 2 ? 1 : 0)) };
}

test('MW-CLOAK2: one level of Loop subdivision - every triangle in four, an edge\'s vertex 3/8 its ends and 1/8 its far corners (the open edge its middle), an old vertex Loop\'s beta (the open edge 3/4 and 1/8 its rim), the normals its own facing the source\'s way; a seam or an edge three faces share refused', () => {
  const g = grid();
  const s = loopSubdivideOnce(g);
  assert.equal(s.positions.length / 3, 9 + 16, 'V + E');
  assert.equal(s.indices.length / 3, 8 * 4, '4F');
  for (let v = 0; v < s.positions.length / 3; v++) assert.ok(near(s.positions[v * 3 + 2], 2), 'a flat net stays flat');
  for (let v = 0; v < s.normals.length / 3; v++) assert.ok(near(s.normals[v * 3 + 2], 1, 1e-5), 'its normals face +z, as the source\'s did');
  const at = (x, y) => { for (let v = 0; v < s.positions.length / 3; v++) if (near(s.positions[v * 3], x) && near(s.positions[v * 3 + 1], y)) return v; return -1; };
  // the centre - an interior vertex of six neighbours - stays put by symmetry; a rim vertex keeps its line
  assert.ok(at(1, 1) >= 0, 'the centre where it was');
  assert.ok(at(1, 0) >= 0 && near(s.uvs[at(1, 0) * 2], 0.5), 'the bottom rim\'s middle vertex on its rim: 3/4 it and 1/8 each rim neighbour');
  // a corner on the rim pulls in along both its rim edges: 3/4 (0,0) + 1/8 (1,0) + 1/8 (0,1)
  assert.ok(at(1 / 8, 1 / 8) >= 0, 'a corner relaxes into the curve');
  // the open edge's new vertex is its middle, its UV the middle of its ends'
  const m = at(0.5, 0);
  assert.ok(m >= 0 && near(s.uvs[m * 2], 0.25) && near(s.uvs[m * 2 + 1], 0));
  // an interior edge's: (0,0)-(1,1) with far corners (1,0) and (0,1) -> 3/8 (0,0)+(1,1) + 1/8 (1,0)+(0,1) = (0.5, 0.5)
  assert.ok(at(0.5, 0.5) >= 0);
  // Loop's beta on a valence-six vertex: a bump at the centre falls to 1 - 6 beta = 5/8 of itself
  const bump = grid(); bump.positions[4 * 3 + 2] = 3;
  const sb = loopSubdivideOnce(bump);
  assert.ok(near(sb.positions[4 * 3 + 2], 2 + 5 / 8, 1e-6), `the centre's bump kept 5/8 (z ${sb.positions[4 * 3 + 2]})`);
  assert.equal(loopSubdivide(g, 0), g, 'no level, no change');
  assert.equal(loopSubdivide(g, 2).indices.length / 3, 8 * 16);
  // a seam (two vertices at one position) and an edge three faces share are refused, not torn
  assert.throws(() => loopSubdivideOnce({ ...g, positions: Float32Array.from([...g.positions.slice(0, 24), 0, 0, 2]) }), /shares its position/);
  assert.throws(() => loopSubdivideOnce({ positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1]), indices: Uint16Array.from([0, 1, 2, 1, 0, 3, 0, 1, 4]) }), /three faces/);
  // the normals are the result's own: a fresh area-weighted pass over its positions agrees
  const fresh = vertexNormals(s.positions, s.indices);
  for (let k = 0; k < fresh.length; k++) assert.ok(near(fresh[k], s.normals[k], 1e-5));
  // AUDIT MW-CLOAK: on a net with no symmetry to hide behind, an interior edge's vertex is 3/8 its ends and 1/8 its far
  // corners - not its middle: a quad (0,0) (4,0) (4,4) (0,4) split on its diagonal, the far corners lifted unequally
  const quad = { positions: Float32Array.from([0, 0, 0, 4, 0, 1, 4, 4, 0, 0, 4, 3]), indices: Uint16Array.from([0, 1, 2, 0, 2, 3]) };
  const sq = loopSubdivideOnce(quad);
  const diag = [0, 1, 2].map((c) => 3 / 8 * (quad.positions[c] + quad.positions[6 + c]) + 1 / 8 * (quad.positions[3 + c] + quad.positions[9 + c]));
  let hit = false;
  for (let v = 0; v < sq.positions.length / 3; v++) if ([0, 1, 2].every((c) => near(sq.positions[v * 3 + c], diag[c], 1e-5))) hit = true;
  assert.ok(hit, `the diagonal's vertex at ${diag.map((x) => x.toFixed(3))} (its middle would be 2, 2, 0)`);
  // a bow tie's waist is refused, not dragged through one wing; the result's bounds are its own
  assert.throws(() => loopSubdivideOnce({ positions: Float32Array.from([0, 0, 0, 1, 1, 0, 1, -1, 0, -1, 1, 0, -1, -1, 0]), indices: Uint16Array.from([0, 1, 2, 0, 3, 4]) }), /open edges' runs meet/);
  for (let c = 0; c < 3; c++) {
    const xs = Array.from(s.positions).filter((_, i) => i % 3 === c);
    assert.ok(near(s.bounds.min[c], Math.min(...xs), 1e-6) && near(s.bounds.max[c], Math.max(...xs), 1e-6), 'the bounds the result\'s own');
  }
});

test('MW-CLOAK2: the cloak smoothed two levels - the creases past 20 degrees from 54 to the six at the left strap\'s very tip, the outline\'s sharpest turn from 82 degrees to 24, and over the shoulders the bend between neighbouring faces from 14.8 degrees to 3', () => {
  const base = bakeObject(readFbx(raw(SOURCE)), CLOAK_OBJECT, CLOAK_BOX);
  assert.equal(CLOAK_SUBDIVISIONS, 2);
  const smooth = loopSubdivide(base, CLOAK_SUBDIVISIONS);
  assert.deepEqual([base.positions.length / 3, smooth.positions.length / 3, smooth.indices.length / 3], [140, 1949, 3712]);
  const bends = (m) => {
    const P = m.positions; const I = m.indices;
    const fn = [];
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...n) || 1; fn.push(n.map((x) => x / l));
    }
    const faces = new Map(); const rim = new Map();
    for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], b = I[t + (e + 1) % 3]; const k = a < b ? `${a},${b}` : `${b},${a}`; if (!faces.has(k)) faces.set(k, []); faces.get(k).push(t / 3); }
    const shoulder = []; const creases = [];
    for (const [k, f] of faces) {
      const [a, b] = k.split(',').map(Number);
      if (f.length === 1) { for (const [v, w] of [[a, b], [b, a]]) { if (!rim.has(v)) rim.set(v, []); rim.get(v).push(w); } continue; }
      const z = (P[a * 3 + 2] + P[b * 3 + 2]) / 2;
      const deg = Math.acos(Math.max(-1, Math.min(1, fn[f[0]].reduce((s, x, i) => s + x * fn[f[1]][i], 0)))) * 180 / Math.PI;
      if (z > 100) shoulder.push(deg);
      if (deg > 20) creases.push(z);
    }
    const turns = [];
    for (const [v, [p, q]] of rim) {
      if (P[v * 3 + 2] < 100) continue;
      const u = [0, 1, 2].map((i) => P[v * 3 + i] - P[p * 3 + i]), w = [0, 1, 2].map((i) => P[q * 3 + i] - P[v * 3 + i]);
      turns.push(Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / Math.hypot(...u) / Math.hypot(...w)))) * 180 / Math.PI);
    }
    return { mean: shoulder.reduce((s, x) => s + x, 0) / shoulder.length, creases, turn: Math.max(...turns) };
  };
  const was = bends(base); const now = bends(smooth);
  assert.ok(was.mean > 14 && now.mean < 3.1, `the shoulders' mean bend ${was.mean.toFixed(1)} to ${now.mean.toFixed(1)}`);
  assert.equal(was.creases.length, 54);
  assert.equal(now.creases.length, 6);
  assert.ok(now.creases.every((z) => z > 116), 'the six left are at the strap\'s tip, the top of the cloak');
  assert.ok(was.turn > 80 && now.turn < 25, `the outline's sharpest turn ${was.turn.toFixed(0)} to ${now.turn.toFixed(0)}`);
  // the cloak keeps its size: the hem where it was, the top within a fifth of a unit
  const z = (m) => { const zs = Array.from(m.positions).filter((_, i) => i % 3 === 2); return [Math.min(...zs), Math.max(...zs)]; };
  assert.ok(Math.abs(z(smooth)[0] - z(base)[0]) < 0.05 && Math.abs(z(smooth)[1] - z(base)[1]) < 0.2);
});

test('MW-CLOAK2: the fit over the armour eases the cloak round each point that comes through - the push slopes gently, not a triangle\'s step - and its normals are its new shape\'s', async () => {
  const worn = composeWornArmor({ pieces: [...Object.values(CLASSIC_ARMOR_TEMPLATE).map((templateIndex) => ({ templateIndex, material: ARMOR_MATERIAL.Ebony })), { kind: 'clothing', templateIndex: 154, name: 'Casual Cloak', dye: 2 }], armors: [], bodyPool: [] });
  const build = () => assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts: worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: new Uint8Array(raw(`src/assets/mw/meshes/${a.model}`)) })) });
  const isCloak = (p) => isCloakSlot(p.slot);
  const slope = async (radius) => {
    const asm = await build();
    const c = asm.pieces.find(isCloak); const before = Float32Array.from(c.positions); const oldNormals = c.batch.normals;
    const fit = fitCloakOver(asm, { isCloak, isUnder: (p) => !isCloak(p), radius, poses: [{}] });   // the rest alone: the ease, not the poses
    poseAssembly(asm);
    const A = c.positions; const I = c.indices;
    const push = (v) => Math.hypot(A[v * 3] - before[v * 3], A[v * 3 + 1] - before[v * 3 + 1], A[v * 3 + 2] - before[v * 3 + 2]);
    // AUDIT MW-CLOAK: and how it lands - each vertex's push in this pose straight back (carried into the bind through
    // its own blend, which the bind-to-rest turn is not), and its mean over the vertices eased
    let side = 0; let sum = 0; let moved = 0;
    for (let v = 0; v < A.length / 3; v++) {
      side = Math.max(side, Math.abs(A[v * 3] - before[v * 3]), Math.abs(A[v * 3 + 2] - before[v * 3 + 2]));
      if (push(v) > 1e-6) { sum += push(v); moved++; }
    }
    let steepest = 0;
    for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = I[t + e], b = I[t + (e + 1) % 3];
      const d = Math.hypot(before[a * 3] - before[b * 3], before[a * 3 + 1] - before[b * 3 + 1], before[a * 3 + 2] - before[b * 3 + 2]);
      if (d > 1e-6) steepest = Math.max(steepest, Math.abs(push(a) - push(b)) / d);
    }
    return { fit, steepest, side, mean: sum / moved, batch: c.batch, oldNormals, asm };
  };
  const eased = await slope(CLOAK_EASE_RADIUS);
  assert.equal(CLOAK_EASE_RADIUS, 8);
  assert.ok(eased.fit.pushed > 500 && eased.fit.most > 3 && eased.fit.most < 4, `${eased.fit.pushed} vertices eased, the furthest ${eased.fit.most.toFixed(2)}`);
  assert.ok(eased.steepest < 0.8, `the push slopes at most ${eased.steepest.toFixed(2)} a unit`);
  assert.ok(eased.side < 1e-3, `pushed straight back - ${eased.side.toFixed(4)} aside`);
  // the falloff (1 - (d / 8)^2)^2: the mean push over the eased vertices 1.66 (a falloff of (1 - (d / 8)^2) alone, 1.90)
  assert.ok(eased.mean > 1.55 && eased.mean < 1.78, `the eased vertices' mean push ${eased.mean.toFixed(3)}`);
  const stepped = await slope(1e-3);
  assert.ok(stepped.steepest > 5, `a triangle's corners alone step ${stepped.steepest.toFixed(1)} a unit - the facet over the pauldron`);
  // its normals are its new shape's, facing as before
  const fresh = vertexNormals(eased.batch.positions, eased.batch.indices);
  let agree = 0; let facing = 0;
  for (let v = 0; v < fresh.length / 3; v++) {
    const d = fresh[v * 3] * eased.batch.normals[v * 3] + fresh[v * 3 + 1] * eased.batch.normals[v * 3 + 1] + fresh[v * 3 + 2] * eased.batch.normals[v * 3 + 2];
    if (Math.abs(Math.abs(d) - 1) < 1e-4) agree++;
    facing += eased.batch.normals[v * 3] * eased.oldNormals[v * 3] + eased.batch.normals[v * 3 + 1] * eased.oldNormals[v * 3 + 1] + eased.batch.normals[v * 3 + 2] * eased.oldNormals[v * 3 + 2];
  }
  assert.equal(agree, fresh.length / 3, 'every vertex\'s normal the fitted shape\'s');
  assert.ok(facing > 0.9 * fresh.length / 3, 'facing out as the baked ones did');
  assert.notEqual(eased.batch.normals, eased.oldNormals, 'a new array');
  // a cloak wound against its normals keeps facing out: the fresh normals are turned to the old ones' way
  const flipped = await build();
  const fc = flipped.pieces.find(isCloak);
  const rev = Uint16Array.from(fc.indices, (_, k) => fc.indices[k - (k % 3) + [0, 2, 1][k % 3]]);
  fc.batch = { ...fc.batch, indices: rev }; fc.indices = rev;
  const baked = fc.batch.normals;
  fitCloakOver(flipped, { isCloak, isUnder: (p) => !isCloak(p), poses: [{}] });
  let out = 0;
  for (let k = 0; k < baked.length; k += 3) out += baked[k] * fc.batch.normals[k] + baked[k + 1] * fc.batch.normals[k + 1] + baked[k + 2] * fc.batch.normals[k + 2];
  assert.ok(out > 0.9 * baked.length / 3, 'facing out whatever the winding');
});
