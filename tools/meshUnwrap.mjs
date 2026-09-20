// AN UNWRAP, BECAUSE THE EXPORT DOES NOT HAVE ONE.
//
//     node tools/meshUnwrap.mjs <in.json> <out.json> [--angle=66]
//                               [--margin=4] [--size=512]
//
// FIELD-GUN-MW2 (2026-09-20). Mac asked for the Thunderlock to be
// textured, and the FBX carries a `LayerElementUV` named "UVMap", which
// looks like an unwrap right up until it is measured:
//
//   45 DISTINCT UV COORDINATES over 539 vertices, every one of them on
//   an exact eighth (0.125, 0.25, 0.375 ...), and the triangles' UV
//   areas TOTAL 8.49 - the atlas covered eight and a half times over.
//   Every single covered texel is claimed by more than one triangle,
//   and one texel by THIRTY-NINE.
//
// That is not a bad unwrap, it is Blender's factory cylinder mapping:
// the UVs a `Cylinder` primitive is born with. Every section that was
// extruded or duplicated to build the gun inherited the same eight
// strips, so the barrel, the receiver and the grip all sit on top of
// each other in texture space.
//
// THE CONSEQUENCE IS NOT SUBTLE: any texture at all puts the SAME
// pixels on every part of the weapon. The first bake off this file
// proved it - four deliberately different bands came back within three
// levels of each other on all four, because the last triangle to
// rasterise a texel won and which one that was is arbitrary.
//
// ═══ SO THE UNWRAP IS COMPUTED ════════════════════════════════════
//
// Not painted around, not worked with - replaced. Four steps, each one
// the standard answer to its own question:
//
//   ISLANDS   Faces are grouped by walking shared edges and stopping at
//             a hard angle (66 degrees by default, the same threshold
//             Blender's own Smart UV Project uses). WELDED position
//             indices drive the adjacency, not vertex indices, because
//             the export splits a vertex at every hard edge and UV seam
//             - walked by vertex index, every face would be its own
//             island and the atlas would be confetti.
//
//   PROJECT   Each island onto the plane of its AREA-WEIGHTED average
//             normal. Area-weighted so one sliver cannot tilt a plate.
//
//   ROTATE    To the minimum-area bounding rectangle, found by sampling
//             the quarter turn. A rectangle is what packs; an island
//             left at an arbitrary angle wastes the atlas around it.
//
//   PACK      Shelf packing, tallest first, with ONE global scale for
//             every island - so a texel is the same size in world units
//             everywhere on the gun, which is the property that makes a
//             texture look like it belongs to the model. The scale is
//             found by bisection: the largest that still fits.
//
// Islands are separated by a MARGIN in texels, and a vertex on the
// boundary between two islands is SPLIT, because it holds two different
// UVs and a vertex buffer has room for one.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * IS THIS AN UNWRAP AT ALL? The measurement that condemned the FBX's
 * own UVs, as a function, so the finding is reproducible and so a
 * future export can be checked before anybody paints anything.
 *
 * `coverage` is the summed UV area of every triangle: 1.0 is an atlas
 * filled exactly once, and anything much above 1 means islands are
 * stacked on each other.
 */
export function unwrapQuality(mesh) {
  const U = mesh.uvs; const I = mesh.indices;
  if (!U) return { hasUvs: false, coverage: 0, distinct: 0, verdict: 'no UVs at all' };
  let coverage = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = [U[I[t] * 2], U[I[t] * 2 + 1]];
    const b = [U[I[t + 1] * 2], U[I[t + 1] * 2 + 1]];
    const c = [U[I[t + 2] * 2], U[I[t + 2] * 2 + 1]];
    coverage += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  }
  const distinct = new Set();
  for (let i = 0; i < U.length; i += 2) distinct.add(`${U[i].toFixed(5)},${U[i + 1].toFixed(5)}`);
  // 1.3 rather than 1.0: a real unwrap wastes some atlas and a little
  // overlap at a seam is normal. 8.49 is not a little.
  const overlapping = coverage > 1.3;
  return {
    hasUvs: true,
    coverage: +coverage.toFixed(3),
    distinct: distinct.size,
    vertices: U.length / 2,
    overlapping,
    verdict: overlapping
      ? `islands overlap: the triangles' UV areas total ${coverage.toFixed(2)}, and ${distinct.size} distinct coordinates over ${U.length / 2} vertices`
      : 'usable',
  };
}

/** Union-find, small and flat. */
function makeUnion(n) {
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  return { find, join(a, b) { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; } };
}

/**
 * Group the triangles into islands: shared edge AND a fold no sharper
 * than `angleDeg`.
 */
export function islandsOf(mesh, angleDeg = 66) {
  const P = mesh.positions; const I = mesh.indices;
  // WELD FIRST. Adjacency has to be about the SURFACE, and the surface
  // does not care that the exporter split a vertex for a normal.
  const key = new Map();
  const posId = new Int32Array(P.length / 3);
  for (let v = 0; v < P.length / 3; v++) {
    const k = `${P[v * 3].toFixed(5)},${P[v * 3 + 1].toFixed(5)},${P[v * 3 + 2].toFixed(5)}`;
    if (!key.has(k)) key.set(k, key.size);
    posId[v] = key.get(k);
  }
  const faces = I.length / 3;
  const faceNormal = [];
  for (let f = 0; f < faces; f++) {
    const [a, b, c] = [I[f * 3], I[f * 3 + 1], I[f * 3 + 2]].map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    faceNormal.push(cross(sub(b, a), sub(c, a)));
  }
  const cosLimit = Math.cos((angleDeg * Math.PI) / 180);
  const edges = new Map();
  const u = makeUnion(faces);
  for (let f = 0; f < faces; f++) {
    for (let e = 0; e < 3; e++) {
      const a = posId[I[f * 3 + e]]; const b = posId[I[f * 3 + ((e + 1) % 3)]];
      if (a === b) continue;                                   // a degenerate edge joins nothing
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      const prev = edges.get(k);
      if (prev === undefined) { edges.set(k, f); continue; }
      const n1 = norm(faceNormal[prev]); const n2 = norm(faceNormal[f]);
      if (dot(n1, n2) >= cosLimit) u.join(prev, f);
    }
  }
  const groups = new Map();
  for (let f = 0; f < faces; f++) {
    const r = u.find(f);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(f);
  }
  return { islands: [...groups.values()], faceNormal, posId };
}

/** The minimum-area bounding rectangle of a 2D point set, by sampling
 *  the quarter turn. Exact enough at one degree and far shorter than
 *  rotating calipers, which needs a convex hull first. */
export function bestAngle(points, steps = 90) {
  let best = { angle: 0, area: Infinity, w: 0, h: 0 };
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * (Math.PI / 2);
    const ca = Math.cos(a); const sa = Math.sin(a);
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const p of points) {
      const x = p[0] * ca - p[1] * sa; const y = p[0] * sa + p[1] * ca;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const w = x1 - x0; const h = y1 - y0;
    const area = w * h;
    if (area < best.area) best = { angle: a, area, w, h, x0, y0 };
  }
  return best;
}

/** Shelf packing, tallest first. Returns null when they do not fit. */
function shelfPack(boxes, scale, margin) {
  const order = boxes.map((b, i) => ({ i, w: b.w * scale + margin, h: b.h * scale + margin }))
    .sort((a, b) => b.h - a.h || b.w - a.w);
  const placed = new Array(boxes.length);
  let shelfY = margin; let shelfH = 0; let x = margin;
  for (const box of order) {
    if (box.w > 1 - margin || box.h > 1 - margin) return null;
    if (x + box.w > 1 - margin) { shelfY += shelfH; shelfH = 0; x = margin; }
    if (shelfY + box.h > 1 - margin) return null;
    placed[box.i] = { x, y: shelfY };
    x += box.w;
    if (box.h > shelfH) shelfH = box.h;
  }
  return placed;
}

/**
 * Unwrap a baked mesh. Returns a NEW mesh - positions, normals and
 * indices are rebuilt, because a vertex on an island boundary carries
 * two UVs and has to become two vertices.
 */
export function unwrap(mesh, { angle = 66, margin = 4, size = 512 } = {}) {
  const P = mesh.positions; const N = mesh.normals; const I = mesh.indices;
  const { islands, faceNormal } = islandsOf(mesh, angle);
  const marginUv = margin / size;

  // Project each island onto its own plane and square it up.
  const projected = islands.map((faces) => {
    // AREA-WEIGHTED: the un-normalised face normal IS twice the area
    // times the unit normal, so summing them weights by area for free.
    let n = [0, 0, 0];
    for (const f of faces) n = [n[0] + faceNormal[f][0], n[1] + faceNormal[f][1], n[2] + faceNormal[f][2]];
    if (Math.hypot(...n) < 1e-12) n = [0, 0, 1];               // a fully folded island: any plane will do
    n = norm(n);
    // A stable tangent frame about n.
    const s = n[2] >= 0 ? 1 : -1;
    const a = -1 / (s + n[2]);
    const b = n[0] * n[1] * a;
    const tx = [1 + s * n[0] * n[0] * a, s * b, -s * n[0]];
    const ty = [b, s + n[1] * n[1] * a, -n[1]];
    const verts = new Set();
    for (const f of faces) for (let e = 0; e < 3; e++) verts.add(I[f * 3 + e]);
    const list = [...verts];
    const flat = list.map((v) => {
      const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
      return [dot(p, tx), dot(p, ty)];
    });
    const fit = bestAngle(flat);
    const ca = Math.cos(fit.angle); const sa = Math.sin(fit.angle);
    // LANDSCAPE, ALWAYS. A quarter turn costs an island nothing - it is
    // a rectangle either way - and shelf packing fills far better when
    // the heights are as small as they can be. Measured on this mesh:
    // 25% of the atlas used without it, 45% with.
    const turn = fit.h > fit.w;
    const local = new Map();
    list.forEach((v, k) => {
      const x = flat[k][0] * ca - flat[k][1] * sa - fit.x0;
      const y = flat[k][0] * sa + flat[k][1] * ca - fit.y0;
      local.set(v, turn ? [y, x] : [x, y]);
    });
    return { faces, local, w: turn ? fit.h : fit.w, h: turn ? fit.w : fit.h };
  });

  // ONE SCALE FOR EVERY ISLAND, the largest that fits. Bisection rather
  // than a formula because shelf packing has no closed form - and a
  // per-island scale, which would always fit, is exactly the thing that
  // makes one part of a model blurry next to another.
  //
  // THE UPPER BOUND HAS TO BE FOUND, not assumed. A first cut wrote
  // `hi = 1` and the bisection dutifully returned exactly 1 - which is
  // not a coincidence, it is the cap: the islands are in the MESH'S
  // OWN units (longest axis 1 after the MW1 bake), so at scale 1 the
  // widest island is a quarter of the atlas and they all fit in the
  // bottom 40% of it. Sixty per cent of the texture was empty and the
  // gun was sampling a quarter of the texels it could have. So: double
  // until it does NOT fit, and only then bisect.
  let lo = 0; let hi = 1;
  while (shelfPack(projected, hi, marginUv) && hi < 1e6) { lo = hi; hi *= 2; }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (shelfPack(projected, mid, marginUv)) lo = mid; else hi = mid;
  }
  const scale = lo;
  const places = shelfPack(projected, scale, marginUv);
  if (!places) throw new Error('nothing packs - the islands do not fit at any scale');

  // Rebuild the vertex buffer: one vertex per (original vertex, island).
  const positions = []; const normals = []; const uvs = []; const indices = [];
  const remap = new Map();
  projected.forEach((island, ii) => {
    const at = places[ii];
    for (const f of island.faces) {
      for (let e = 0; e < 3; e++) {
        const v = I[f * 3 + e];
        const k = `${ii}:${v}`;
        let out = remap.get(k);
        if (out === undefined) {
          out = positions.length / 3;
          positions.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          if (N) normals.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
          const [lx, ly] = island.local.get(v);
          uvs.push(at.x + lx * scale, at.y + ly * scale);
          remap.set(k, out);
        }
        indices.push(out);
      }
    }
  });

  const out = {
    ...mesh,
    positions: positions.map((v) => +v.toFixed(6)),
    normals: normals.length ? normals.map((v) => +v.toFixed(6)) : null,
    uvs: uvs.map((v) => +v.toFixed(6)),
    indices,
    unwrap: {
      tool: 'tools/meshUnwrap.mjs',
      replaced: unwrapQuality(mesh),
      islands: islands.length,
      angle,
      marginTexels: margin,
      atlasSize: size,
      scale: +scale.toFixed(6),
      vertices: positions.length / 3,
    },
  };
  out.unwrap.quality = unwrapQuality(out);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => Number(args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) {
    console.error('usage: node tools/meshUnwrap.mjs <in.json> <out.json> [--angle=66] [--margin=4] [--size=512]');
    process.exit(2);
  }
  const mesh = JSON.parse(readFileSync(files[0], 'utf8'));
  const before = unwrapQuality(mesh);
  console.log(`${files[0]}: ${before.verdict}`);
  const out = unwrap(mesh, { angle: opt('angle', 66), margin: opt('margin', 4), size: opt('size', 512) });
  mkdirSync(dirname(files[1]), { recursive: true });
  writeFileSync(files[1], `${JSON.stringify(out)}\n`);
  const u = out.unwrap;
  console.log(`${files[1]}: ${u.islands} islands, ${mesh.positions.length / 3} -> ${u.vertices} vertices`);
  console.log(`  coverage ${before.coverage} -> ${u.quality.coverage} (1.0 fills the atlas exactly once)`);
  console.log(`  ${u.quality.distinct} distinct coordinates, ${u.quality.verdict}`);
}
