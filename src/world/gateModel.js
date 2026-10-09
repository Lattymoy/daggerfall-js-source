// @ts-check
// WB2 (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area, a gate
// of oblivion"): THE GATE'S SHAPE. Design: bible/11-Multiplayer/World-Bosses.md section 3.
//
// GATE-FBX (2026-10-09, Mac: "replace the oblivion gate model with this handcrafted model which also needs
// texturing"): MAC'S OWN GATE, baked out of his Blender scene (src/assets/gate/oblivionGate.json, tools/bakeGate.mjs) -
// two pillars of black volcanic stone on clawed feet, a lintel flaring over them, the opening's top corners cut in, three
// spines down each pillar's outside. WB2's gate, two horns swept along a cubic over a stepped plinth in code, is gone
// with it. The portal hangs between the pillars (the membrane is a pass of its own - render/gatePass.js - never this
// mesh), fitted to the opening as the stone stands (`gateArchProfile`, sliced off this mesh).
//
// THE TEXTURING. The bake carries none - Mac's materials are Blender's default grey - so every face is laid on the
// port's own art (world/gateArt.js) here: the stone wears the cracked basalt, PROJECTED along the axis its face looks
// down most (`gateFaceUv`, a tile every GATE_TILE_M, v up every standing face, so the fire's veins climb the pillars) -
// seared where a face looks into the opening (`gateRimFace`, GATE_RIM_RECORD: the frame the fire burns in) - and the
// spines - each a cone of faces apart from the rest, meeting at its point (`gateSpines`; Mac's two materials split the
// pillars, not the spines) - wear the spine's horn (GATE_SPINE_RECORD) laid root to point along each, its point
// burning. Every face is flat-shaded (its own three vertices and one normal), the low-polygon stone the rest of
// Daggerfall's world is cut from, and the feet run GATE_FOOT_SINK on under the ground, so a slope never shows light
// under them (WB2's plinth sank its foot the same).
//
// PURE: positions, normals, uvs and indices in the GATE'S OWN FRAME - metres, origin at the centre of the threshold on
// the ground, +y up, the pillars across x and the portal facing +z and -z - and the sub-meshes by texture. The pool
// (scenes/gatePool.js) uploads it once, draws it with the gate's matrix and hands the collider the same triangles.
//
// Not a DFU member. Ledger A (WB).
import GATE_BAKE from '../assets/gate/oblivionGate.json' with { type: 'json' };

/** The gate's textures (world/gateArt.js): the stone's cracked basalt, and the carved flags WB2's plinth wore (the
 *  Sigil Broker's cage wears them still - world/cageModel.js) - the port's own pseudo-archive, far above any classic
 *  archive (bloodArt.js's law, BLOOD_ATLAS_ARCHIVE 38001). */
export const GATE_ARCHIVE = 38101;
export const GATE_STONE_RECORD = 0;
export const GATE_PLINTH_RECORD = 1;
/** WB12d: the faithful's sigil, burned into the earth (world/gateArt.js riteSigilArt) - AUDIT WB12d (G11): its own, where
 *  it wore the plinth's flags across thirteen metres. */
export const RITE_SIGIL_RECORD = 2;
/** GATE-FBX: the spines' horn and the stone seared round the opening (world/gateArt.js gateSpineArt, gateRimArt). */
export const GATE_SPINE_RECORD = 3;
export const GATE_RIM_RECORD = 4;

/** The bake's one part: the gate, in its own frame (tools/bakeGate.mjs FRAME - Mac's metres x 0.53). */
const PART = GATE_BAKE.parts[0];
/** The basalt's tile on the stone, metres - five, where WB2's horns wore one every ~3 m: on Mac's broad flat faces the
 *  veins of a three-metre tile read as a wallpaper of sparks. */
export const GATE_TILE_M = 5;
/** How far the feet run on under the ground, metres. */
export const GATE_FOOT_SINK = 1.2;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** A corner of the bake. */
const corner = (i) => [PART.positions[i * 3], PART.positions[i * 3 + 1], PART.positions[i * 3 + 2]];
/** The whole gate's height - its lintel's crown, read off the bake (16.19 m: the 16.2 of WB2's, tools/bakeGate.mjs
 *  SCALE), for the rise out of the ground and the eye's box. */
export const GATE_HEIGHT = PART.positions.reduce((m, v, i) => (i % 3 === 1 ? Math.max(m, v) : m), 0);
/** How far the stone reaches across x either side of the threshold, its spines' points included (the clearing's
 *  measure - world/gateClearance.js GATE_CLEAR_M). */
export const GATE_HALF_W = PART.positions.reduce((m, v, i) => (i % 3 === 0 ? Math.max(m, Math.abs(v)) : m), 0);

/**
 * THE SPINES: the bake's polygons gathered into the pieces they make (polygons sharing a corner are one piece), and of
 * those the cones - three faces or more, every one meeting at one point - `[{ polygons, tip }]`, each spine's polygon
 * indices and the corner they all share (Mac's are three triangles each). Nothing in the file names them: his two
 * materials are the two pillars.
 */
export function gateSpines(part = PART) {
  const up = part.polygons.map((_, k) => k);
  const find = (k) => { while (up[k] !== k) k = up[k] = up[up[k]]; return k; };
  const owner = new Map();
  part.polygons.forEach((poly, k) => { for (const v of poly) { if (owner.has(v)) up[find(k)] = find(owner.get(v)); else owner.set(v, k); } });
  const pieces = new Map();
  part.polygons.forEach((_, k) => { const r = find(k); if (!pieces.has(r)) pieces.set(r, []); pieces.get(r).push(k); });
  const out = [];
  for (const ks of pieces.values()) {
    const tip = part.polygons[ks[0]].find((v) => ks.every((k) => part.polygons[k].includes(v)));
    if (ks.length >= 3 && tip !== undefined) out.push({ polygons: ks, tip });
  }
  return out;
}

/** What a face belongs to - the pins measure each by its own law (the stone against the bake, a spike against its own
 *  axis). */
export const GATE_PART = Object.freeze({ Stone: 0, Spike: 1 });

/** A builder of flat-shaded triangles, gathered by texture record, each tagged with its part. WB3b: the Burning
 *  Court's builder too (world/gateArena.js) - the court is cut from the gate's own stone. */
export function faces() {
  const byRec = new Map();
  let part = GATE_PART.Stone;
  const tri = (rec, a, b, c, ua, ub, uc) => {
    let g = byRec.get(rec);
    if (!g) byRec.set(rec, g = { p: [], n: [], uv: [], parts: [] });
    g.parts.push(part);
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const [v, u] of [[a, ua], [b, ub], [c, uc]]) { g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.uv.push(u[0], u[1]); }
  };
  const quad = (rec, a, b, c, d, ua, ub, uc, ud) => { tri(rec, a, b, c, ua, ub, uc); tri(rec, a, c, d, ua, uc, ud); };
  return { tri, quad, byRec, as: (p) => { part = p; } };
}

/** A four-sided spike from a base square (centre `b`, half-size `w`, in the plane its axis `ax` leaves) to `tip` -
 *  the court's spires', the Deadlands' and the bridge's one shape, wound outward whatever way it points. */
export function spike(f, b, w, tip) {
  f.as(GATE_PART.Spike);
  const ax = norm(sub(tip, b));
  const up = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const s1 = norm(cross(ax, up)), s2 = norm(cross(ax, s1));
  const q = [0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; return [b[0] + (s1[0] * Math.cos(a) + s2[0] * Math.sin(a)) * w, b[1] + (s1[1] * Math.cos(a) + s2[1] * Math.sin(a)) * w, b[2] + (s1[2] * Math.cos(a) + s2[2] * Math.sin(a)) * w]; });
  for (let k = 0; k < 4; k++) {
    const a = q[k], c = q[(k + 1) % 4];
    const n = cross(sub(c, a), sub(tip, a));
    const mid = [(a[0] + c[0] + tip[0]) / 3 - b[0], (a[1] + c[1] + tip[1]) / 3 - b[1], (a[2] + c[2] + tip[2]) / 3 - b[2]];
    if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] >= 0) f.tri(GATE_STONE_RECORD, a, c, tip, [0, 0], [0.25, 0], [0.12, 0.8]);
    else f.tri(GATE_STONE_RECORD, a, tip, c, [0, 0], [0.12, 0.8], [0.25, 0]);
  }
}

/**
 * Where a point of a face of normal `n` lies on the basalt: projected along the axis the face looks down most - a top
 * or a bottom across x and z, a face looking along x across z and up y, one looking along z across x and up y - a tile
 * every GATE_TILE_M. A box projection: the bake has no seams to unwrap along, and the stone is the same stone whichever
 * way a face is turned.
 * @param {number[]} p @param {number[]} n
 */
export function gateFaceUv(p, n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0] / GATE_TILE_M, p[2] / GATE_TILE_M];
  if (ax >= az) return [p[2] / GATE_TILE_M, p[1] / GATE_TILE_M];
  return [p[0] / GATE_TILE_M, p[1] / GATE_TILE_M];
}

/**
 * GATE-FBX: WHETHER A FACE OF THE STONE LOOKS INTO THE OPENING - the frame the fire burns in: a face turned in across
 * the threshold toward its middle (the pillars' and the feet's inner faces), or one looking down over it (the cut
 * corners' and the lintel's undersides, within the pillars' inner faces). `c` its middle, `n` its normal.
 * @param {number[]} c @param {number[]} n
 */
export function gateRimFace(c, n) {
  if (n[0] * Math.sign(c[0]) < -0.5) return true;
  return n[1] < -0.3 && c[1] > ARCH_Y0 + 1 && Math.abs(c[0]) < GATE_ROOT.x;
}

/**
 * The gate, whole: `{ positions, normals, uvs, indices, subMeshes: [{ textureArchive, textureRecord, startIndex,
 * primitiveCount }] }` - renderer.createMesh's own model shape - and `triangles`, the collider's copy (the positions,
 * unindexed, which flat shading makes them anyway), and `parts`, each triangle's GATE_PART.
 */
export function buildGateModel() {
  const f = faces();
  const trisOf = PART.polygons.map(() => []);
  PART.triangleOf.forEach((k, t) => trisOf[k].push([PART.triangles[t * 3], PART.triangles[t * 3 + 1], PART.triangles[t * 3 + 2]]));
  const tipOf = new Map(gateSpines().flatMap((s) => s.polygons.map((k) => [k, s.tip])));
  PART.polygons.forEach((poly, k) => {
    if (tipOf.has(k)) {
      // the spine's horn laid root to point: its point at v 1, the two corners of its root along v 0
      f.as(GATE_PART.Spike);
      const tip = tipOf.get(k);
      const roots = poly.filter((v) => v !== tip);
      const uvOf = (v) => (v === tip ? [0.5, 1] : v === roots[0] ? [0, 0] : [1, 0]);
      for (const [a, b, c] of trisOf[k]) f.tri(GATE_SPINE_RECORD, corner(a), corner(b), corner(c), uvOf(a), uvOf(b), uvOf(c));
      return;
    }
    f.as(GATE_PART.Stone);
    const n = norm(cross(sub(corner(poly[1]), corner(poly[0])), sub(corner(poly[2]), corner(poly[0]))));
    const lay = (p) => gateFaceUv(p, n);
    if (poly.every((v) => Math.abs(corner(v)[1]) < 1e-3)) {
      // A FOOT'S SOLE: run on under the ground - a wall down from each of its edges, and the sole again below
      const down = (p) => [p[0], p[1] - GATE_FOOT_SINK, p[2]];
      for (let i = 0; i < poly.length; i++) {
        const a = corner(poly[i]), b = corner(poly[(i + 1) % poly.length]);
        const wall = norm(cross(sub(b, a), sub(down(b), a)));
        const on = (p) => gateFaceUv(p, wall);
        const mid = [(a[0] + b[0]) / 2, -GATE_FOOT_SINK / 2, (a[2] + b[2]) / 2];   // a slope may bare it: seared where the foot over it is
        f.quad(gateRimFace(mid, wall) ? GATE_RIM_RECORD : GATE_STONE_RECORD, a, b, down(b), down(a), on(a), on(b), on(down(b)), on(down(a)));
      }
      for (const [a, b, c] of trisOf[k]) f.tri(GATE_STONE_RECORD, down(corner(a)), down(corner(b)), down(corner(c)), lay(corner(a)), lay(corner(b)), lay(corner(c)));
      return;
    }
    const mid = poly.reduce((m, v) => { const p = corner(v); return [m[0] + p[0] / poly.length, m[1] + p[1] / poly.length, m[2] + p[2] / poly.length]; }, [0, 0, 0]);
    const rec = gateRimFace(mid, n) ? GATE_RIM_RECORD : GATE_STONE_RECORD;
    for (const [a, b, c] of trisOf[k]) f.tri(rec, corner(a), corner(b), corner(c), lay(corner(a)), lay(corner(b)), lay(corner(c)));
  });
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const parts = new Uint8Array(count / 3);
  const indices = new Uint32Array(count);   // WBX1: the renderer's one index type (renderer.createMesh) - a Uint16Array under it drew nothing
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec);
    const n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2); parts.set(g.parts, v / 3);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: GATE_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes, triangles: positions, parts };
}

/** How many heights the arch's opening is measured at - the membrane's mask (render/gatePass.js uProfile). */
export const ARCH_PROFILE_N = 24;
/** The opening's bottom: the ground - the feet's inner edges meet it. */
export const ARCH_Y0 = 0;
/** The opening's top: the lintel's underside over the middle of the threshold - the least height at which the stone
 *  stands over (0, 0), read off the bake. */
export const ARCH_Y1 = (() => {
  let top = Infinity;
  const T = PART.triangles;
  for (let t = 0; t < T.length; t += 3) {
    const [a, b, c] = [corner(T[t]), corner(T[t + 1]), corner(T[t + 2])];
    // (0, 0) inside the triangle seen from above: the same side of all three edges
    const side = (p, q) => (q[0] - p[0]) * (0 - p[2]) - (q[2] - p[2]) * (0 - p[0]);
    const s1 = side(a, b), s2 = side(b, c), s3 = side(c, a);
    if (!((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0))) continue;
    const area = s1 + s2 + s3;
    if (Math.abs(area) < 1e-9) continue;   // edge-on from above: a standing face says nothing of what stands over the middle
    const y = (s2 * a[1] + s3 * b[1] + s1 * c[1]) / area;
    if (y > 0.5 && y < top) top = y;
  }
  return top;
})();
/** The portal's centre: half-way up the opening (the fire's light and the beacon's foot are measured from it). */
export const PORTAL_CENTRE_Y = (ARCH_Y0 + ARCH_Y1) / 2;

/**
 * THE OPENING'S SHAPE: at ARCH_PROFILE_N heights from ARCH_Y0 to ARCH_Y1, the half-width of the clear space between
 * the pillars, less `margin`, never below zero. GATE-FBX: SLICED, where WB2's read the horns' vertices in bands - Mac's
 * gate has 72 corners, and most heights have none: each height's clear is the least |x| of the stone over the band from
 * the height below it to the height above (every triangle cut to that band - its corners in it and its edges where they
 * cross its two ends; a piece of stone spanning the middle closes it), so the fire the pass draws between two heights
 * (render/gatePass.js uProfile, interpolated) is never wider than the stone allows anywhere between them - a point
 * sample let it run 0.27 m into the cut corners' tips. Measured off the built mesh itself, so the membrane fits the stone
 * it hangs in whatever its shape becomes.
 * @param {{positions: Float32Array}} [model] @param {number} [margin] metres left between the fire and the stone
 */
export function gateArchProfile(model = buildGateModel(), margin = 0.15) {
  const out = new Float32Array(ARCH_PROFILE_N).fill(Infinity);
  const P = model.positions;
  const band = (ARCH_Y1 - ARCH_Y0) / (ARCH_PROFILE_N - 1);
  for (let k = 0; k < ARCH_PROFILE_N; k++) {
    // inside the opening by a millimetre at its two ends: the soles and the lintel's underside lie IN those planes
    const lo = Math.max(ARCH_Y0 + 1e-3, ARCH_Y0 + (k - 1) * band), hi = Math.min(ARCH_Y1 - 1e-3, ARCH_Y0 + (k + 1) * band);
    for (let i = 0; i < P.length; i += 9) {
      let left = Infinity, right = -Infinity;
      const take = (x) => { left = Math.min(left, x); right = Math.max(right, x); };
      for (let e = 0; e < 3; e++) {
        const a = i + e * 3, b = i + ((e + 1) % 3) * 3, ya = P[a + 1], yb = P[b + 1];
        if (ya >= lo && ya <= hi) take(P[a]);
        for (const h of [lo, hi]) if ((ya - h) * (yb - h) < 0) take(P[a] + (P[b] - P[a]) * ((h - ya) / (yb - ya)));
      }
      if (left > right) continue;
      const clear = left <= 0 && right >= 0 ? 0 : Math.min(Math.abs(left), Math.abs(right));
      if (clear < out[k]) out[k] = clear;
    }
  }
  for (let k = 0; k < ARCH_PROFILE_N; k++) out[k] = Number.isFinite(out[k]) ? Math.max(0, out[k] - margin) : 0;
  return out;
}

/** The pillars' roots: the lowest GATE_ROOT_TOP metres of the stone either side of the threshold - the middle of its
 *  reach across x (`x`, either way), its half-span there (`halfX`) and how far it reaches through z (`halfZ`), read off
 *  the bake (scenes/gatePool.js ROOT_TRAP: where a body standing as the stone comes up whole is sealed in). */
export const GATE_ROOT_TOP = 2.8;
export const GATE_ROOT = (() => {
  let lo = Infinity, hi = 0, deep = 0;
  const spine = new Set(gateSpines().flatMap((s) => s.polygons));
  PART.polygons.forEach((poly, k) => {
    if (spine.has(k)) return;
    for (const v of poly) {
      const [x, y, z] = corner(v);
      if (y > GATE_ROOT_TOP) continue;
      lo = Math.min(lo, Math.abs(x)); hi = Math.max(hi, Math.abs(x)); deep = Math.max(deep, Math.abs(z));
    }
  });
  return Object.freeze({ x: (lo + hi) / 2, halfX: (hi - lo) / 2, halfZ: deep });
})();
