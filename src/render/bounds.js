// @ts-check
// EL5 (2026-09-17, THE FIELD): THE BOUNDS AND THE CULL - a leaf module shared
// by the shadow pass (its cascade, face and camera replays), the air pass
// (its emission replay) and the renderer (which computes a bundle's bounds
// at upload). Nothing here touches GL.
//
// A bundle carries a local bounding sphere [cx, cy, cz, r] (boundsOf); a
// record carries the world one (transformSphere); a replay extracts its
// frustum's six planes once (frustumPlanes) and asks each sphere
// (sphereInPlanes). A bundle without bounds is always drawn - the cull is
// an optimisation, never a gate.

import { frustumPlanes } from './frustum.js';   // EV3's plane extraction - one home

/** A batch with no origin sits at the world's: createBillboardBatch mints
 *  `origin: null` for every static flat. AUDIT 68 S16-v-replay-origin-alloc:
 *  ONE shared, read-only zero for the draw and both replays, which minted
 *  a fresh [0, 0, 0] per origin-less batch per replay. */
export const ZERO_ORIGIN = Object.freeze([0, 0, 0]);

/** The six planes of a view-projection for the sphere test: frustum.js's
 *  Gribb/Hartmann extraction (EV3's, unnormalised - the hosts' box test only
 *  wants the sign), normalised here so a plane distance is in world units
 *  and a radius can be compared to it. [a, b, c, d] x 6. */
export function spherePlanes(m, out = new Float32Array(24)) {
  frustumPlanes(m, out);
  for (let k = 0; k < 6; k++) {
    const l = Math.hypot(out[k * 4], out[k * 4 + 1], out[k * 4 + 2]) || 1;
    out[k * 4] /= l; out[k * 4 + 1] /= l; out[k * 4 + 2] /= l; out[k * 4 + 3] /= l;
  }
  return out;
}

/** EL5: is a sphere at least touching the volume the planes bound? */
export function sphereInPlanes(planes, x, y, z, r) {
  for (let k = 0; k < 6; k++) {
    if (planes[k * 4] * x + planes[k * 4 + 1] * y + planes[k * 4 + 2] * z + planes[k * 4 + 3] < -r) return false;
  }
  return true;
}

/** EL5: a bounding sphere [cx, cy, cz, r] over positions (xyz triples), the
 *  whole array or the vertices an index range names (`start` and `count`
 *  in index units). The centre is the box's, the radius the farthest
 *  vertex from it. Empty input gives a zero sphere at the origin. */
export function boundsOf(positions, indices = null, start = 0, count = -1, stride = 3) {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const n = indices ? (count < 0 ? indices.length - start : count) : Math.floor(positions.length / stride);
  const at = (k) => (indices ? indices[start + k] : k) * stride;   // EL7: `stride` floats per vertex (a character rig's interleaved 9 or 11)
  for (let k = 0; k < n; k++) {
    const o = at(k), x = positions[o], y = positions[o + 1], z = positions[o + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const out = new Float32Array(4);
  if (n === 0) return out;
  out[0] = (minX + maxX) / 2; out[1] = (minY + maxY) / 2; out[2] = (minZ + maxZ) / 2;
  let r2 = 0;
  for (let k = 0; k < n; k++) {
    const o = at(k), dx = positions[o] - out[0], dy = positions[o + 1] - out[1], dz = positions[o + 2] - out[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2) r2 = d2;
  }
  out[3] = Math.sqrt(r2);
  return out;
}

/** EL5: a local sphere through an affine matrix (column-major): the centre
 *  transformed, the radius scaled by the largest axis scale. */
export function transformSphere(m, s, out, o = 0) {
  return transformSphereScaled(m, s, matrixScale(m), out, o);
}
/** EL5's largest axis scale of an affine matrix (column-major) - the factor a sphere's radius takes through it.
 *
 *  PERF-EXT4 (2026-09-25, the players' "fps issues in the exterior but fine in the interior"): ASKED ONCE A MATRIX.
 *  The shadow record's mesh arm put the mesh's sphere and EVERY sub-mesh's through one matrix, and each call took
 *  the three column lengths again - 3 x (1 + sub-meshes) Math.hypot a record, some 1,800 a frame on the cpu lens's
 *  town, at 40 ns apiece where the arithmetic around them is 3. A caller with many spheres under one matrix asks
 *  this once and hands it to transformSphereScaled. Still Math.hypot, not a square root of the sum: the same
 *  operations on the same values, so every radius keeps its bits. */
export function matrixScale(m) {
  return Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
}
/** transformSphere with the matrix's scale already in hand (matrixScale) - the one home of the transform. */
export function transformSphereScaled(m, s, sc, out, o = 0) {
  const x = s[0], y = s[1], z = s[2];
  out[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  out[o + 3] = s[3] * sc;
  return out;
}


/** A shadow record's own sphere, or always when it carries none. */
export function recordVisible(planes, r) {
  return !r.bounded || sphereInPlanes(planes, r.sphere[0], r.sphere[1], r.sphere[2], r.sphere[3]);
}
/** Sub-mesh i of a bounded mesh record: its own sphere, or always when it has none (radius -1). */
export function subMeshVisible(planes, r, i) {
  if (!r.bounded) return true;
  const o = i * 4, rad = r.subSpheres[o + 3];
  return rad < 0 || sphereInPlanes(planes, r.subSpheres[o], r.subSpheres[o + 1], r.subSpheres[o + 2], rad);
}
/**
 * A billboard batch's world sphere [x, y, z, r] into `out`, from the bounds
 * createBillboardBatch computed and the batch's origin - or null when it
 * carries no bounds.
 *
 * THE SPHERE IS LIFTED HALF A HEIGHT, and that is the whole correctness of
 * it. `createBillboardBatch` stores a sphere over the PLACEMENT points with
 * the sprite's half-diagonal added to the radius, but the billboard vertex
 * shader is bottom-anchored (`uUp * ((aCorner.y + 0.5) * uSize.y)`): the
 * quad stands its full height from that point, so the stored sphere does
 * not reach the top of anything taller than it is wide. Lifting the centre
 * by h/2 bounds the quad exactly - from there it spans w/2 sideways and
 * h/2 either way in y, which is what a radius of hypot(w, h)/2 already
 * covers. (A negative height - droppedTorches' flame, drawn upside down on
 * a negated localScale.y - lifts DOWNWARD by the same rule, which is where
 * its quad hangs.)
 *
 * GHOST1 (2026-09-19, Clerical Error: "loaded from a save and we have ghost
 * campfires now"; kurkku: "sprites disappear and reappear at certain(?)
 * angles"): the lift used to live in TWO hand-written copies - PERF-CROWD's
 * in world.js and PERF-CROWD2's in renderer.js - while this function, which
 * the shadow replay and the AIR PASS's emitters cull by, had none. So the
 * two passes disagreed about the same sprite: the main pass dropped a flat
 * the emission replay kept, and what was left on screen was the bloom of a
 * sprite that never drew. A ghost campfire, exactly as reported. One home,
 * one answer, and every caller takes it. AUDIT 68 S16-batch-sphere-dup:
 * SHADOW-REACH's shadowReachBatch and SC1's signature and dynamic scans had
 * written the lift out three more times; they take this now.
 * @param {{ bounds?: ArrayLike<number>|null, origin?: ArrayLike<number>|null, size?: { h: number }|null }} b
 * @param {Float64Array|Float32Array|number[]} out
 */
export function batchSphere(b, out) {
  const s = b.bounds;
  if (!s) return null;
  const o = b.origin;
  out[0] = s[0] + (o ? o[0] : 0);
  out[1] = s[1] + (o ? o[1] : 0) + batchLift(b);
  out[2] = s[2] + (o ? o[2] : 0);
  out[3] = s[3];
  return out;
}
/** THE LIFT's one home (batchSphere says why it is the whole correctness of the sphere): how far above its placement a
 *  batch's quad is centred - half its height, downward for an upside-down flame's negative one.
 *
 *  PERF-EXT (2026-09-25, the review of the shadows; the players' "fps issues in the exterior but fine in the interior"):
 *  PERF-EXT1's two placement queries below wrote it out again inline, a copy each - GHOST1's ghost campfire was two
 *  copies of this line disagreeing. Every sphere of a flat and every quad of a batch lift by this now.
 *  @param {{ size?: { h: number }|null }} b */
export function batchLift(b) {
  return (b.size?.h ?? 0) * 0.5;
}
/** A flat's half-diagonal - how far its quad reaches from its centre at any facing (BB_VS spans w/2 by h/2 about it).
 *  PERF-EXT (the review, as batchLift): one home for the batch's sphere at birth (createBillboardBatch), after a move
 *  (moveBillboardBatch) and each quad's bound (placementRadius), which had written it three times. */
export function quadHalfDiagonal(size) {
  return Math.hypot(size.w, size.h) * 0.5;
}
const _batchSphere = new Float64Array(4);   // batchVisible's scratch - the replays' hot path allocates nothing
/** A billboard batch against the planes, on batchSphere's sphere (no bounds: always drawn). */
export function batchVisible(planes, b) {
  const c = batchSphere(b, _batchSphere);
  return !c || sphereInPlanes(planes, c[0], c[1], c[2], c[3]);
}

/**
 * PERF-EXT1 (2026-09-25, two players via Mac: "fps issues in the exterior
 * but fine in the interior", "me too my friend.. don't know why. I got a
 * RX6600"): A FLAT BATCH REACHES A SHADOW BY ITS PLACEMENTS, NOT BY ITS
 * SPHERE.
 *
 * A streamed pixel's flats are ONE batch per (archive, record) across the
 * whole pixel (world.js builds them so: a climate's nature record is 120 to
 * 260 trees over 819 units), so batchSphere above is a sphere of about four
 * hundred units. It passes every sun cascade and every lantern face in its
 * pixel, and SC1 finds it "near" every lantern there - and a tree record
 * sways in any breeze, so every lantern in a town redrew six faces on the
 * sway's beat to draw a wood none of whose trees stood in its reach. The
 * provers' census of the real city: at night 1,676 of 2,301 draws a frame
 * were that replay, and 16.6 of them had a tree in the face.
 *
 * So a static batch of more than one flat keeps its placements, bucketed
 * on a grid over their footprint, and the questions below are asked of the
 * QUADS: is any of them in this volume (a cascade, a face), is any of them
 * in this lantern's cube. A quad is bounded by the sphere at its placement
 * lifted h/2 (batchSphere's lift, the sign kept for an upside-down flame)
 * of radius hypot(w, h)/2 plus WIND3's lean at the crown - BB_VS's own
 * corners, sway included - and a sphere outside a plane rasterises nothing
 * behind it. So a batch these answer "no" for draws nothing into that
 * volume: skipping it cannot move a depth texel.
 *
 * ON A 4 x 4 GRID, cells first, then the cell's placements - and this
 * form is the one of two that MEASURED cheaper. Two lenses found the win.
 * The draw-submission lens split a batch 4 x 4 over its footprint and
 * tested every cell's sphere, then its placements; the shadow lens kept a
 * finer grid (up to 16 x 16) and visited only the cells under the volume -
 * cut, for a cascade, to the batch's own height span through the volume's
 * inverted corners. Same draws, and a linear scan of every placement is out
 * either way (it cost more JS than the draws saved). With a free no-op GL
 * over the provers' harnesses at real density the fine grid was the dearer
 * by day (0.21 ms a frame against the base's 0.12; the 4 x 4 0.15), because
 * the cut costs more per batch than sixteen sphere tests; but it was the
 * cheaper at a lantern's CUBE (14 us a frame against 24 for eight lamps).
 * So: the 4 x 4 cells, every cell's sphere against a volume's planes, and
 * against a cube only the cells the cube's box meets (the shadow lens's
 * query) - 0.15 ms by day, 0.37 at night against the base's 0.44.
 * A batch built DYNAMIC never gets one (its centres move - a gib), and a
 * move drops it (moveBillboardBatch): the draw lens's prover found a kept
 * copy tested at its birth place, and a gib's shadow gone.
 */
/** PERF-EXT1: the grid's side - four cells a side past PLACEMENT_ONE_CELL placements, one cell at or under it. */
export const PLACEMENT_GRID = 4;
export const PLACEMENT_ONE_CELL = 16;
/** PERF-EXT1: the placements of `centers` on the grid over their xz box. `pts` holds the vertex buffer's own float32
 *  centres, cell-major; `start` the prefix of the cells' counts; `cs` each cell's sphere over its centres (radius -1:
 *  empty), a hair wide for the float32 it is stored in. */
export function placementGrid(centers) {
  const n = centers.length;
  const G = n > PLACEMENT_ONE_CELL ? PLACEMENT_GRID : 1;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = centers[i]; pts[i * 3] = c[0]; pts[i * 3 + 1] = c[1]; pts[i * 3 + 2] = c[2]; }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n * 3; i += 3) {
    const x = pts[i], z = pts[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const sx = (x1 - x0) / G || 1, sz = (z1 - z0) / G || 1;
  const cell = new Int32Array(n), start = new Uint32Array(G * G + 1);
  for (let i = 0; i < n; i++) {
    const gx = Math.min(G - 1, Math.floor((pts[i * 3] - x0) / sx)), gz = Math.min(G - 1, Math.floor((pts[i * 3 + 2] - z0) / sz));
    cell[i] = gx * G + gz; start[cell[i] + 1]++;
  }
  for (let k = 0; k < G * G; k++) start[k + 1] += start[k];
  const fill = start.slice(0, G * G), byCell = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const o = fill[cell[i]]++ * 3; byCell[o] = pts[i * 3]; byCell[o + 1] = pts[i * 3 + 1]; byCell[o + 2] = pts[i * 3 + 2]; }
  const cs = new Float32Array(G * G * 4);
  for (let k = 0; k < G * G; k++) {
    const a = start[k] * 3, e = start[k + 1] * 3;
    if (a === e) { cs[k * 4 + 3] = -1; continue; }
    let lx = Infinity, ly = Infinity, lz = Infinity, hx = -Infinity, hy = -Infinity, hz = -Infinity;
    for (let i = a; i < e; i += 3) {
      if (byCell[i] < lx) lx = byCell[i]; if (byCell[i] > hx) hx = byCell[i];
      if (byCell[i + 1] < ly) ly = byCell[i + 1]; if (byCell[i + 1] > hy) hy = byCell[i + 1];
      if (byCell[i + 2] < lz) lz = byCell[i + 2]; if (byCell[i + 2] > hz) hz = byCell[i + 2];
    }
    const cx = (lx + hx) / 2, cy = (ly + hy) / 2, cz = (lz + hz) / 2;
    let r2 = 0;
    for (let i = a; i < e; i += 3) { const dx = byCell[i] - cx, dy = byCell[i + 1] - cy, dz = byCell[i + 2] - cz; if (dx * dx + dy * dy + dz * dz > r2) r2 = dx * dx + dy * dy + dz * dz; }
    cs[k * 4] = cx; cs[k * 4 + 1] = cy; cs[k * 4 + 2] = cz; cs[k * 4 + 3] = Math.sqrt(r2) * (1 + 1e-6) + 1e-4;
  }
  return { G, x0, z0, x1, z1, sx, sz, start, pts: byCell, cs, hw: NaN, hh: NaN, half: 0 };   // the review: the half-diagonal's memo (placedHalfDiagonal), born empty
}
/** PERF-EXT1: the radius that bounds one quad of a batch - its half-diagonal `half` plus WIND3's `lean` at the crown -
 *  a hair wide, so the float32 the GPU places a corner in can never land outside the double this is compared in. */
export function placementRadius(half, lean) {
  return (half + lean) * (1 + 1e-5) + 1e-3;
}
/** PERF-EXT (2026-09-25, the review of the shadows): a placed batch's quad half-diagonal, taken ONCE for the size it
 *  has. The replays, the lanterns' dynamic scans and the signature walk asked Math.hypot for it at every ask - 230 to
 *  800 a frame on the provers' harnesses, some 50 ns each, and 40 a lamp a frame in the reviewer's room before the
 *  walk there went by the sphere. A batch's size is its host's to rewrite (a walker's is written through every frame),
 *  so the grid keeps the w and h its answer is of and asks again for any other: the same arithmetic on the same
 *  values, so every radius keeps its bits. */
export function placedHalfDiagonal(b) {
  const q = b._place, s = b.size;
  if (q.hw !== s.w || q.hh !== s.h) { q.hw = s.w; q.hh = s.h; q.half = quadHalfDiagonal(s); }
  return q.half;
}
const _cells = new Int32Array(4);
/** PERF-EXT1: the grid cells a box [x0, z0, x1, z1] in the batch's own frame meets, into _cells - false when it
 *  misses the grid. The same float compare that filed a centre files the box's edges, so a centre inside the box is
 *  in a cell of the range. */
function cellRange(q, x0, z0, x1, z1) {
  if (x1 < q.x0 || x0 > q.x1 || z1 < q.z0 || z0 > q.z1) return false;
  const top = q.G - 1;
  _cells[0] = Math.max(0, Math.min(top, Math.floor((x0 - q.x0) / q.sx)));
  _cells[1] = Math.max(0, Math.min(top, Math.floor((x1 - q.x0) / q.sx)));
  _cells[2] = Math.max(0, Math.min(top, Math.floor((z0 - q.z0) / q.sz)));
  _cells[3] = Math.max(0, Math.min(top, Math.floor((z1 - q.z0) / q.sz)));
  return true;
}
/** PERF-EXT1: does any quad of batch `b` (its `_place`, its origin and size, a quad radius `rad` from
 *  placementRadius) reach a lantern's CUBE [pos - far, pos + far]? The six faces' frusta tile that cube, so a quad
 *  outside it rasterises into none of them - the cube, not the far SPHERE, whose corners a face still draws. */
export function placementsInCube(b, rad, px, py, pz, far) {
  const q = b._place, o = b.origin || ZERO_ORIGIN, R = far + rad;
  const lx = px - o[0], ly = py - o[1] - batchLift(b), lz = pz - o[2];   // the light in the batch's frame, the lift folded in
  if (!cellRange(q, lx - R, lz - R, lx + R, lz + R)) return false;
  const G = q.G, cs = q.cs, st = q.start, p = q.pts;
  for (let gx = _cells[0], gx1 = _cells[1]; gx <= gx1; gx++) {
    for (let k = gx * G + _cells[2], ke = gx * G + _cells[3]; k <= ke; k++) {
      const cr = cs[k * 4 + 3];
      if (cr < 0) continue;
      const rr = R + cr;
      if (Math.abs(cs[k * 4] - lx) > rr || Math.abs(cs[k * 4 + 1] - ly) > rr || Math.abs(cs[k * 4 + 2] - lz) > rr) continue;
      for (let i = st[k] * 3, e = st[k + 1] * 3; i < e; i += 3) {
        if (Math.abs(p[i] - lx) <= R && Math.abs(p[i + 1] - ly) <= R && Math.abs(p[i + 2] - lz) <= R) return true;
      }
    }
  }
  return false;
}
/** PERF-EXT1: does any quad of batch `b` (a quad radius `rad` from placementRadius) touch the volume `planes` bound
 *  (a cascade, a face)? Each cell's sphere first, then that cell's placements, each against the planes. */
export function placementsInVolume(b, rad, planes) {
  const q = b._place, o = b.origin || ZERO_ORIGIN;
  const ox = o[0], oy = o[1] + batchLift(b), oz = o[2];
  const cs = q.cs, st = q.start, p = q.pts;
  for (let k = 0, n = q.G * q.G; k < n; k++) {
    const cr = cs[k * 4 + 3];
    if (cr < 0 || !sphereInPlanes(planes, cs[k * 4] + ox, cs[k * 4 + 1] + oy, cs[k * 4 + 2] + oz, cr + rad)) continue;
    for (let i = st[k] * 3, e = st[k + 1] * 3; i < e; i += 3) {
      if (sphereInPlanes(planes, p[i] + ox, p[i + 1] + oy, p[i + 2] + oz, rad)) return true;
    }
  }
  return false;
}
