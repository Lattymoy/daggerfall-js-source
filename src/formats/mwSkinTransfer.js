// MW-BRIG2 (2026-09-29, Mac on MW-BRIG1: "The texture was great, you just somehow moved the geometry in the
// process"): A WORN MODEL SKINNED FROM THE BODY UNDER IT.
//
// MW-BRIG1 hung the steel brigandine RIGID on the skeleton's "Chest" and "Groin" nodes and took each node's REST
// transform back out (restPoseInverse). The body it was fitted to does not move that way. A retail body part is
// SKINNED (Morrowind-Rules.md MW-D21: "authored part-local, is a torso on the ground"), and the reference places
// every one of its vertices by the part's OWN NiSkinData - v' = v * (Sum w_i * invBind_i * boneSkelMat_i) *
// skinToSkel * skinTransform (rule 20) - on the spine, pelvis and leg bones, never on the Chest node. So the moment
// the idle played, the torso moved by its bones and the brigandine by a node the body never uses, and the two came
// apart. Nothing about the fit could have saved it: two things placed by two different transforms agree in one pose
// at most.
//
// The fix is to stop having two transforms. Each garment vertex copies the skin of the body vertex nearest it - the
// same bones, the same weights, the same inverse binds, the same skin transform - and its own position is solved so
// that, in the pose the modeller fitted it in (the skeleton at rest), that skin puts it exactly where it was
// authored. From then on it is drawn by skinBatch, the one door the body itself goes through, so every frame it moves
// by precisely the transform the skin under it moves by. It is the "copy bone weights" every armour fitter uses,
// with the reference's own skinning doing the rest.
//
// A body part that is RIGID (some mods' are) is a skin of one bone: its attach bone, with the mirror and BoneOffset
// the rigid path applies (rules 13 and 14) as the inverse bind, so a garment over it rides that bone exactly as the
// part does.
//
// MW-BRIG3 (2026-09-29, Mac on MW-BRIG2: "completely broke the morrowind torso" - "it's placed lower where the torso
// should be", worn only, on a male body): THE DEFECT WAS WHERE IT SAT, BOTH TIMES. The skinning above holds the
// garment to the body in every pose, and it holds it exactly as far from the body as it started - so a garment that
// starts too LOW stays too low, and it hides the chest skin it was meant to cover (the cuirass slot shadows it), which
// leaves the upper torso empty under the neck. Both MW-BRIG1 and MW-BRIG2 took the height from the modeller's scene
// on faith (tools/bakeBrigandine.mjs: that scene's body "is" the skeleton at rest), and nobody measured the result on a
// real body. The brigandine itself says the scene's body was not this one: its collar peaks at z 94.8 and its belt at
// z ~67, well under a Morrowind man's neck and waist. So the height is now MEASURED ON THE WEARER (fitLift below): the
// garment's top meets the top of the body part it hides, in the same rest pose the skin is solved in.

import { GRAPH_ROOT } from './mwSkin.js';

const IDENT_TRANSFORM = Object.freeze({ rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0], scale: 1 });

/**
 * A body batch as a SKIN. A skinned batch is returned as it is; a rigid one becomes a skin of its one attach bone,
 * the rigid path's mirror (rule 13) and BoneOffset (rule 14) folded into the inverse bind so the result lands where
 * the rigid path draws the part.
 */
export function sourceSkin(batch, { attachRef = null, mirrored = false, boneOffset = null } = {}) {
  if (batch.skinned && batch.skin) return batch;
  const n = batch.positions.length / 3;
  const a = Float32Array.from([mirrored ? -1 : 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const t = boneOffset ? [boneOffset[0], boneOffset[1], boneOffset[2]] : [0, 0, 0];
  return {
    ...batch,
    skinned: true,
    skin: {
      skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT, transform: IDENT_TRANSFORM, shapeTransform: null,
      bones: [{ ref: attachRef, name: '', invBind: { a, t }, indices: Array.from({ length: n }, (_, i) => i), weights: new Array(n).fill(1) }],
    },
  };
}

/**
 * MW-BRIG3: THE LIFT that puts a garment on the wearer. Morrowind is Z-up; this answers how far along +Z the garment
 * must move so that its highest point meets the highest point of `anchors` - the body part it hides, SKINNED in
 * `ctx`'s pose (the rest pose the transfer is solved in). Skinned, never read raw: a retail part's authored vertices
 * are part-local, "a torso on the ground" (Morrowind-Rules.md MW-D21). A pure translation, so the garment's shape is
 * the modeller's to the last vertex. Null with no garment or no anchor vertex: nothing to measure against.
 * `ctx` is { skeleton, pose, mats, skinBatch }; the anchors are skins (sourceSkin).
 */
export function fitLift(garments, anchors, ctx) {
  let top = -Infinity;
  for (const g of garments) for (let i = 2; i < g.positions.length; i += 3) top = Math.max(top, g.positions[i]);
  let anchorTop = -Infinity;
  for (const a of anchors) {
    const p = new Float32Array(a.positions.length);
    ctx.skinBatch(a, ctx.skeleton, ctx.pose, ctx.mats, p, null);
    for (let i = 2; i < p.length; i += 3) anchorTop = Math.max(anchorTop, p[i]);
  }
  if (!Number.isFinite(top) || !Number.isFinite(anchorTop)) return null;
  return { lift: anchorTop - top, top, anchorTop };
}

/** The garment batch moved `lift` along +Z, on a copy: the bound batch is never written. */
export function liftBatch(batch, lift) {
  const positions = Float32Array.from(batch.positions);
  for (let i = 2; i < positions.length; i += 3) positions[i] += lift;
  return { ...batch, positions };
}

/** Every vertex's influences, as [boneIndex, weight] pairs, read off the skin's per-bone lists. */
function influencesOf(skin, n) {
  const out = Array.from({ length: n }, () => []);
  skin.bones.forEach((b, bi) => {
    for (let k = 0; k < b.indices.length; k++) out[b.indices[k]]?.push([bi, b.weights[k]]);
  });
  return out;
}

function invert33(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!(Math.abs(det) > 1e-12)) return null;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}

/**
 * Each listed source vertex's whole skinning affine in `pose`, MEASURED through skinBatch itself rather than
 * re-derived: four probe vertices per source vertex (the origin and the three unit axes) carrying that vertex's
 * influences, skinned once. The columns and the translation are read off the result, so the garment is solved with
 * exactly the arithmetic that will draw it. Answers Map(j -> { a: 3x3 row-major, t }).
 */
function measureAffines(src, js, { skeleton, pose, mats, skinBatch }) {
  const infl = src.infl;
  const bones = src.batch.skin.bones.map((b) => ({ ref: b.ref, name: b.name, invBind: b.invBind, indices: [], weights: [] }));
  const positions = new Float32Array(js.length * 12);
  js.forEach((j, q) => {
    positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], q * 12);
    for (const [bi, w] of infl[j]) for (let c = 0; c < 4; c++) { bones[bi].indices.push(q * 4 + c); bones[bi].weights.push(w); }
  });
  const probe = { skin: { ...src.batch.skin, bones }, positions, normals: null };
  const out = new Float32Array(positions.length);
  skinBatch(probe, skeleton, pose, mats, out, null);
  const res = new Map();
  js.forEach((j, q) => {
    const o = q * 12;
    const t = [out[o], out[o + 1], out[o + 2]];
    const col = (k) => [out[o + k * 3] - t[0], out[o + k * 3 + 1] - t[1], out[o + k * 3 + 2] - t[2]];
    const [cx, cy, cz] = [col(1), col(2), col(3)];
    res.set(j, { a: [cx[0], cy[0], cz[0], cx[1], cy[1], cz[1], cx[2], cy[2], cz[2]], t });
  });
  return res;
}

/**
 * Skin `garment` (a rigid batch whose positions are where the modeller fitted it, in the pose `pose`) from the body
 * batches `sources` (skins, see sourceSkin). Answers one skinned batch per source the garment's triangles land on:
 * each carries that source's skin (bones, inverse binds, skin and shape transforms) with the garment's own
 * influences, positions solved so that skinning them in `pose` gives back the authored positions, and the garment's
 * UVs, material and triangles.
 *
 * A triangle goes to the source nearest the majority of its corners, and each corner copies the nearest vertex OF
 * THAT SOURCE, so a triangle is never split across two skins. `ctx` is { skeleton, pose, mats, skinBatch }.
 */
export function transferSkin(garment, sources, ctx) {
  if (!sources.length) return [];
  const src = sources.map((batch) => {
    const n = batch.positions.length / 3;
    const p = new Float32Array(batch.positions.length);
    ctx.skinBatch(batch, ctx.skeleton, ctx.pose, ctx.mats, p, null);
    return { batch, n, p, infl: influencesOf(batch.skin, n) };
  });
  const G = garment.positions;
  const gn = G.length / 3;
  const nearestIn = (s, v) => {
    const { p, n } = src[s];
    const x = G[v * 3], y = G[v * 3 + 1], z = G[v * 3 + 2];
    let best = -1; let bd = Infinity;
    for (let j = 0; j < n; j++) {
      const dx = p[j * 3] - x, dy = p[j * 3 + 1] - y, dz = p[j * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = j; }
    }
    return { j: best, d: bd };
  };
  const cache = new Map();
  const nearest = (s, v) => { const k = s * gn + v; let r = cache.get(k); if (!r) { r = nearestIn(s, v); cache.set(k, r); } return r; };
  const overall = (v) => { let bs = 0; let bd = Infinity; for (let s = 0; s < src.length; s++) { const r = nearest(s, v); if (r.d < bd) { bd = r.d; bs = s; } } return bs; };

  const subs = src.map(() => ({ map: new Map(), verts: [], indices: [] }));
  const I = garment.indices;
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    const votes = tri.map(overall);
    const s = votes.find((x) => votes.filter((y) => y === x).length >= 2) ?? votes[0];
    const sub = subs[s];
    for (const v of tri) {
      let at = sub.map.get(v);
      if (at === undefined) { at = sub.verts.length; sub.map.set(v, at); sub.verts.push({ v, j: nearest(s, v).j }); }
      sub.indices.push(at);
    }
  }

  const out = [];
  subs.forEach((sub, s) => {
    if (!sub.indices.length) return;
    const { batch, infl } = src[s];
    const js = [...new Set(sub.verts.map((x) => x.j))];
    const aff = measureAffines(src[s], js, ctx);
    const bones = batch.skin.bones.map((b) => ({ ref: b.ref, name: b.name, invBind: b.invBind, indices: [], weights: [] }));
    const positions = new Float32Array(sub.verts.length * 3);
    const uvs = garment.uvs ? new Float32Array(sub.verts.length * 2) : null;
    sub.verts.forEach(({ v, j }, k) => {
      const m = aff.get(j);
      const inv = invert33(m.a);
      const gx = G[v * 3] - m.t[0], gy = G[v * 3 + 1] - m.t[1], gz = G[v * 3 + 2] - m.t[2];
      if (inv) {
        positions[k * 3] = inv[0] * gx + inv[1] * gy + inv[2] * gz;
        positions[k * 3 + 1] = inv[3] * gx + inv[4] * gy + inv[5] * gz;
        positions[k * 3 + 2] = inv[6] * gx + inv[7] * gy + inv[8] * gz;
      } else {
        positions.set([G[v * 3], G[v * 3 + 1], G[v * 3 + 2]], k * 3);
      }
      for (const [bi, w] of infl[j]) { bones[bi].indices.push(k); bones[bi].weights.push(w); }
      if (uvs) { uvs[k * 2] = garment.uvs[v * 2]; uvs[k * 2 + 1] = garment.uvs[v * 2 + 1]; }
    });
    out.push({
      name: garment.name || '', skinned: true,
      skin: { ...batch.skin, bones: bones.filter((b) => b.indices.length) },
      positions, normals: null, uvs, colors: null, material: garment.material ?? null,
      indices: Uint16Array.from(sub.indices),
    });
  });
  return out;
}
