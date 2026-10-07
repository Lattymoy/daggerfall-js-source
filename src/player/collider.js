// Static-world capsule collider: triangle soup in a uniform grid, the
// capsule resolved as a CHAIN of spheres along its axis (COL1 - two, at
// the ends alone, left the waist unsampled). Engine-side (ours,
// like the renderer) - DFU delegates this to Unity's CharacterController;
// the CONTRACT it must honor is verbatim (motor.js constants): radius
// 0.35, height 1.8, stepOffset 0.5, slopeLimit 70 (ground = contact
// normal with ny >= cos 70).
//
// Buckets: triangles register under a string key with an optional
// translation provider, so the streaming world stores PIXEL-LOCAL
// triangles and resolves against the current floating-origin placement
// each query; static scenes use the default zero translation. A
// heightAt(x, z) callback supplies the terrain/ground floor beneath
// everything (mesh triangles win when higher).

import {
  CAPSULE_RADIUS, CAPSULE_HEIGHT, STEP_OFFSET, SLOPE_LIMIT_DEG, RIDE_HEIGHT,
} from './motor.js';

// Grid cell size in world units. The sphere resolve scans the 3x3
// neighborhood around the center cell, so CELL only needs to exceed
// the capsule contact radius (+push) for correctness - and the scan
// cost scales with tris-per-cell. At 8, Privateer's Hold averaged 75
// tris/cell (max 391) and ONE capsule move cost ~2.3ms - invisible
// for the lone player, catastrophic once C11 put ~29 foes on the
// P17 60Hz fixed step (66ms/frame of pure collision on desktop; the
// live "insane lag" report, 2026-08-17). At 2 the same dungeon
// averages ~5 tris/cell and the identical contacts resolve ~20x
// faster. Pure spatial-index change: same triangles found, all
// P14/P16 movement laws untouched.
const CELL = 2;
/** AUDIT BRANCH (WoD) B1: WIDE TRIANGLES. Filing a triangle under every 2-unit cell its XZ box covers is right for
 *  a building's walls and wrong for a MOUNTAIN: World of Daggerfall stands rocks scaled by thousands, whose faces
 *  span hundreds of cells each, and one Mountains layout carries a rock scaled by a MILLION (its object 2, 83 km
 *  under the site - inert in DFU, a collider PhysX never reaches), one face of which filed two million cells and
 *  half a gigabyte before the Map ran out. A triangle over FINE_CELLS_MAX fine cells is WIDE: it is filed once, in the
 *  bucket's `wide` list, and found through the bucket's tree over them (OW-WOD-LAG, below). The fine walks are
 *  untouched: a bucket with no wide triangle pays nothing, and the same triangles are found either way. */
const FINE_CELLS_MAX = 64;
/** PERF-EXT25 (2026-09-25, the players: "fps issues in the exterior but fine in the interior", "me too my
 *  friend.. don't know why. I got a RX6600"): A CELL'S KEY IS A NUMBER. Every triangle a streamed pixel files, and
 *  every cell a query reads, minted a template string - `${gx},${gz}` - to hash, look up and drop: on a synthetic
 *  city pixel (300,000 triangles) the insert was ~1 s of main thread across the build and its garbage the GC's.
 *  (gx + 2^20) * 2^21 + (gz + 2^20) is exact in a double and one-to-one for |g| < 2^20 cells - two million units
 *  on the fine grid, sixty-seven million on the coarse, against a bucket's pixel-local coordinates in the
 *  thousands - and the grid is a BROAD phase: two cells that shared a key would only hand a query more triangles
 *  for the narrow phase to refuse, never fewer. The same triangles are found; every answer is the same bits. */
const cellKey = (gx, gz) => (gx + 0x100000) * 0x200000 + (gz + 0x100000);
/** AUDIT ONCRASH1 B5a: the most sweep steps one move() may be split into - a motion larger than this is taken
 *  whole rather than swept, because a loop whose length a caller's arithmetic chooses is a frozen tab waiting. */
const SUBSTEPS_MAX = 256;
/** The longest single substep move() takes - three quarters of the radius, so no component of one step can carry a
 *  sphere past a surface it never touched (tunnelling). */
const SUBSTEP_LEN = CAPSULE_RADIUS * 0.75;
/** AUDIT DISC28 MO-3: THE LONGEST MOTION ONE move() SWEEPS EXACTLY - SUBSTEPS_MAX substeps of SUBSTEP_LEN, 67.2 units.
 *  Past it the rest is taken whole (B5a below), which no frame of a walk, a swim or a fall comes near. A caller that CAN
 *  hand over more in one frame - the Deep Waters stroke at its Swim Speed Multiplier's top, a hundred metres in a slow
 *  frame - hands it over in pieces of at most this, which is what one CharacterController.Move is: a sweep of the
 *  whole motion, however long. */
export const EXACT_SWEEP_MAX = SUBSTEPS_MAX * SUBSTEP_LEN;
const GROUND_NY = Math.cos((SLOPE_LIMIT_DEG * Math.PI) / 180);
const TAN_SLOPE_LIMIT = Math.tan((SLOPE_LIMIT_DEG * Math.PI) / 180);   // AUDIT LANDFORMS II I3: the terrain floor snap's reach
const SKIN = 0.02;

/** The slack on the broad-phase box, in world units: the triangles' own arithmetic is float, so the box is grown by
 *  a hair rather than trusted to the last bit. Far below CELL, so it costs nothing in rejects. */
const BOX_SKIN = 1e-3;
/** AUDIT NAME1 F2: THE BROAD PHASE. Does the segment `origin + dir * [0, limit]` touch this box at all?
 *  Slab test, exact - a miss here CANNOT hide a hit, because every triangle in the bucket is inside the box the
 *  bucket's own vertices made (BOX_SKIN covers the rounding of that arithmetic). Written as a free function rather
 *  than inline so the one reject is the same reject for every walk that later wants it.
 *  @returns {boolean} true when the box must be walked */
/** PERF-COL1 (2026-09-21, "guards kill the framerate"): THE SPHERE'S BROAD PHASE. Does a sphere of radius `r` at
 *  (lx, ly, lz) - BUCKET-LOCAL, the translation already taken off - touch this bucket's box at all? The bounds
 *  enclose every triangle in the bucket exactly (addMesh keeps them per vertex), so a triangle can only come within
 *  `r` of the centre when the centre's own box overlaps the bucket's: a miss here CANNOT hide a contact, and the
 *  narrow phase's own distance test would have rejected every triangle the skip drops. It is asked once per bucket
 *  with the centre AS IT STANDS at that bucket's turn, which is exact even though a contact pushes the centre as
 *  the walk goes: a bucket's first contact can only be made by the un-pushed centre, so a bucket the un-pushed
 *  centre cannot reach never pushes it. BOX_SKIN covers the rounding of the bounds' arithmetic, as it does for the
 *  ray. An EMPTY bucket has an inverted box and answers false, which is what walking its no cells answered before.
 *  @returns {boolean} true when the bucket's cells must be walked */
export function sphereTouchesBox(lx, ly, lz, r, min, max) {
  return lx + r >= min[0] - BOX_SKIN && lx - r <= max[0] + BOX_SKIN
    && ly + r >= min[1] - BOX_SKIN && ly - r <= max[1] + BOX_SKIN
    && lz + r >= min[2] - BOX_SKIN && lz - r <= max[2] + BOX_SKIN;
}
/** PERF-COL1: ONE visited set for the whole module, cleared per bucket - the two sphere walks minted one per
 *  bucket per sample, which at nine samples a capsule and up to five capsules a step was hundreds of Sets a frame
 *  per body, most of them for buckets nowhere near it. */
const VISITED = new Set();
/** FB0930-FOE-RAYS (2026-09-30, player report: "requestAnimationFrame handler took <N>ms" by the hundred in a
 *  dungeon, CPU at 100%, 500 violations in Privateer's Hold and 40 once every foe was dead): the ray's visited mark
 *  is a STAMP per triangle, not a Set. Every foe casts rays every fixed step - its sight line, and the obstacle probe's
 *  capsule casts (27 rays each, up to eleven of them a step for a foe wedged against a wall while it hunts a detour)
 *  - and each ray had cleared and filled a Set, a hash and an insert per triangle met. The stamp is one integer
 *  compare. `bucket.rayMark` grows with the bucket's triangles; RAY_STAMP is bumped once per bucket walk, and the
 *  marks are zeroed on the (never reached in a session) wrap. Neither query re-enters, as before. */
let RAY_STAMP = 0;
/** FB0930-FRAME: the marks' EPOCH. The stamp wraps once in 2^31 walks, and a wrap zeroed only the bucket being walked
 *  when it came - every other bucket kept marks a later stamp would count up to and meet again, and a triangle marked
 *  then would read as already seen. A wrap now starts a new epoch, and a bucket's marks are zeroed the first time it is
 *  walked in it. */
let MARK_EPOCH = 0;
/** FB0930-FOE-RAYS: capsuleCast's spokes - centre, the four axes, the four diagonals - as (u, v) signs, and the one
 *  origin and result its rays write through (raycastHit does not keep either past its return). */
const CAP_SPOKES = [0, 0, 1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
const CAP_ORIGIN = [0, 0, 0];
const CAP_HIT = { dist: Infinity, key: null, normal: [0, 0, 0], back: false };
function rayMarks(bucket) {
  let m = bucket.rayMark;
  if (!m || m.length < bucket.tris.length) {
    m = new Int32Array(Math.max(bucket.tris.length, m ? m.length * 2 : 0));
    bucket.rayMark = m;
    bucket.markEpoch = MARK_EPOCH;
  }
  if (++RAY_STAMP >= 0x7fffffff) { RAY_STAMP = 1; MARK_EPOCH++; }
  if (bucket.markEpoch !== MARK_EPOCH) { m.fill(0); bucket.markEpoch = MARK_EPOCH; }
  return m;
}
/** FB0930-FRAME: the pin's door to the stamp - test/fb0930_frame.test.js walks a bucket across the wrap. */
export function _setRayStampForTest(n) { RAY_STAMP = n; }
/** PERF-CLIMB: the resolve's fixed-point stop (_resolveCapsule), on unless a pin turns it off to hold the answers the
 *  same with it and without it. */
let FIXED_POINT_STOP = true;
export function _setFixedPointStopForTest(on) { FIXED_POINT_STOP = !!on; }
/** FB0930-FOE-RAYS: the grid is XZ only, so a cell holds the column's whole height - a dungeon's floor and ceiling,
 *  and the floors and ceilings of every level stacked above and below it. A triangle whose Y extent misses the ray's
 *  own Y extent across the cell cannot be hit IN this cell and is not tested there (nor marked, so the cell where the
 *  ray does reach it still tests it: its hit point lies in that cell's column, which its box covers). The slack
 *  covers the cell-boundary rounding. Same triangles hit, same distances - a horizontal sight ray just stops testing
 *  the floors and ceilings it runs between. */
const RAY_Y_SLACK = 1e-3;
/** FB0930-FRAME: the SPHERE walks take the same Y reject - a triangle whose Y extent lies wholly more than the
 *  contact's reach above or below the centre cannot come within it (its nearest point's y is inside that extent), so
 *  the narrow phase's own distance test would reject it; this rejects it for two compares instead of a closest point.
 *  The slack keeps the reject strictly inside the old one. Such a triangle IS marked seen (the sphere walks' visited
 *  law: each triangle is asked once per bucket, at the centre as it stands when its turn comes). */
const SPHERE_Y_SLACK = 1e-3;

/** FB0930-FRAME (2026-09-30, a player's performance trace in a dungeon: 151 ms frames, 76% of them the foes' obstacle
 *  probes - _findDetour's sweep, 27 rays a capsule cast): THE BUCKETS' OWN BROAD PHASE. Every action door, lever and
 *  moving platform is a bucket of its own (actionSystem.addDoor/addAction), and every ray and every sphere walked
 *  EVERY bucket to ask its box - a Map entry, the translation closure and a slab test per bucket per ray. In the
 *  trace the box test alone (segmentHitsBox, 488 ms self) and the default translation closure (127 ms) outweighed the
 *  triangle tests the rays exist for (rayTriangle, 196 ms): a 0.4 m probe paid for every door in the dungeon.
 *
 *  So the buckets that stand still - no translation provider, no turn: their box IS their world box - are filed on a
 *  coarse XZ grid, and a query asks only the ones filed under the cells its own world box covers. Buckets that move
 *  (a translation or a turn), and buckets too big to file (the dungeon's own, a massif, a box that is not finite), are
 *  asked by every query, as before. The walk's ORDER is the Map's (insertion) order, always: candidates are sorted
 *  back into it, so a tie between two buckets and the order the sphere's pushes land in are exactly what they were.
 *  A bucket the query box does not reach is one whose own box test would have answered "no" - the same answers.
 *  The index is a cache of the boxes: addMesh and removeBucket drop it, and the next query files again. */
const BROAD_CELL = 8;
/** A standing bucket over more broad cells than this is asked by every query rather than filed (the dungeon's). */
const BROAD_SPAN_MAX = 64;
/** A query box over more broad cells than this walks every bucket in order, as before (a long sight line). */
const BROAD_QUERY_MAX = 256;
/** _resolveSphere: how far (per axis, x or z) its pushes may carry the centre from where its candidates were
 *  gathered before they are gathered again - the box test is asked at each bucket's turn with the centre as it
 *  stands, so the gathered box is grown by this much and re-asked past it. */
const BROAD_PAD = 1;
let BROAD_STAMP = 0;
const RAY_NEAR = [];      // raycastHit's candidates
const SPHERE_NEAR = [];   // the sphere walks' (never nested in a ray's walk, nor a ray in theirs)
/** File the collider's buckets: `all` in Map order (each bucket's `ord` its place in it), `always` the buckets every
 *  query asks, `cells` the standing ones by broad cell. */
function buildBroad(buckets) {
  const all = [], always = [], cells = new Map();
  for (const bucket of buckets.values()) {
    bucket.ord = all.length;
    all.push(bucket);
    if (bucket.moves) { always.push(bucket); continue; }
    const mn = bucket.min, mx = bucket.max;
    if (!(mn[0] <= mx[0] && mn[1] <= mx[1] && mn[2] <= mx[2])) continue;   // no triangle (an inverted box): every box test answers no
    const x0 = Math.floor((mn[0] - BOX_SKIN) / BROAD_CELL), x1 = Math.floor((mx[0] + BOX_SKIN) / BROAD_CELL);
    const z0 = Math.floor((mn[2] - BOX_SKIN) / BROAD_CELL), z1 = Math.floor((mx[2] + BOX_SKIN) / BROAD_CELL);
    if (!((x1 - x0 + 1) * (z1 - z0 + 1) <= BROAD_SPAN_MAX)) { always.push(bucket); continue; }   // too big - or not finite
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const k = cellKey(gx, gz);
        let list = cells.get(k);
        if (!list) { list = []; cells.set(k, list); }
        list.push(bucket);
      }
    }
  }
  return { all, always, cells };
}

/** OW-WOD-LAG (2026-09-29, Mac: "When near mountains from WOD, the game lags insane"): THE WIDE TRIANGLES IN A TREE.
 *  AUDIT BRANCH (WoD) B1 filed them on a 64-unit XZ grid, so a query near a World of Daggerfall massif - rocks scaled by
 *  hundreds and thousands, stacked over one another - took every face whose footprint covered the column it stood in,
 *  above it and below it alike: 150 to 1,700 of them a sphere on a stand-in rock (the lag investigation's bench, the
 *  real prefab transforms), each looked up, marked seen and tested exactly, and the player's and every nearby foe's
 *  move() runs several spheres a 1/60 step - 1 to 5 ms a body a step where one boulder costs 0.04, and a slow frame
 *  runs more steps. Of those faces 1.2% were within reach of the query in three dimensions. The grid could not tell
 *  them apart because it has no height. Now each wide triangle carries its own 3-D box (tri[3] its min, tri[4] its
 *  max) and the bucket keeps a bounding-volume tree over them, built when first asked after a mesh lands: a query
 *  walks only the boxes it can reach and tests only the faces under them. Exact as the grid was: a point within r of a
 *  triangle is within r of its box, and of every box above it in the tree, so nothing the grid found is missed. One
 *  entry a triangle, however wide - the giant's faces included - where the grid filed a face under every cell it
 *  covered (AUDIT BRANCH B1's memory law, kept). */
const WIDE_LEAF = 4;
/** The bins the split rule weighs a node's centres in, on each axis (binned SAH: linear work a level). */
const WIDE_BINS = 16;
/** The slack a sphere query's tree walk adds to its radius: the fine grid's own guarantee (a query takes the 3x3
 *  cells about its point, so every triangle within a cell's width of it), so a contact's push inside one bucket's
 *  walk meets the same wide faces it would have met filed on a grid. */
const WIDE_MARGIN = CELL;
function wideBox(tri) {
  const a = tri[0], b = tri[1], c = tri[2];
  tri[3] = [Math.min(a[0], b[0], c[0]), Math.min(a[1], b[1], c[1]), Math.min(a[2], b[2], c[2])];
  tri[4] = [Math.max(a[0], b[0], c[0]), Math.max(a[1], b[1], c[1]), Math.max(a[2], b[2], c[2])];
  return Number.isFinite(tri[3][0] + tri[3][1] + tri[3][2] + tri[4][0] + tri[4][1] + tri[4][2]);
}
/** The bucket's tree over its wide triangles, (re)built when the list has grown since. Nodes in flat arrays: `box`
 *  six numbers a node (min xyz, max xyz), `left` the first child (the second is left + 1) or -1 for a leaf, whose
 *  triangles are `order[start .. start + count)`. Split at the median of the longest axis of the centroids. */
function wideTree(bucket) {
  const n = bucket.wide.length;
  if (bucket.wideTree && bucket.wideTree.n === n) return bucket.wideTree;
  const tris = bucket.tris, order = Int32Array.from(bucket.wide);
  // each triangle's box and centre, once, in flat arrays that move with `order` as it is partitioned
  const tb = new Float64Array(n * 6), cen = new Float64Array(n * 3);
  for (let k = 0; k < n; k++) {
    const t = tris[order[k]], mn = t[3], mx = t[4];
    for (let q = 0; q < 3; q++) { tb[k * 6 + q] = mn[q]; tb[k * 6 + 3 + q] = mx[q]; cen[k * 3 + q] = (mn[q] + mx[q]) / 2; }
  }
  const swap = (i, j) => {
    const t = order[i]; order[i] = order[j]; order[j] = t;
    for (let q = 0; q < 6; q++) { const v = tb[i * 6 + q]; tb[i * 6 + q] = tb[j * 6 + q]; tb[j * 6 + q] = v; }
    for (let q = 0; q < 3; q++) { const v = cen[i * 3 + q]; cen[i * 3 + q] = cen[j * 3 + q]; cen[j * 3 + q] = v; }
  };
  const cap = Math.max(1, 2 * n);
  const box = new Float64Array(cap * 6), left = new Int32Array(cap), start = new Int32Array(cap), count = new Int32Array(cap);
  const binN = new Int32Array(WIDE_BINS), binB = new Float64Array(WIDE_BINS * 6), rightA = new Float64Array(WIDE_BINS);
  const area = (B, o) => { const dx = B[o + 3] - B[o], dy = B[o + 4] - B[o + 1], dz = B[o + 5] - B[o + 2]; return dx * dy + dy * dz + dz * dx; };
  let nodes = 1;
  const stack = [0, n, 0];
  while (stack.length) {
    const node = stack.pop(), hi = stack.pop(), lo = stack.pop();
    const o = node * 6;
    box[o] = box[o + 1] = box[o + 2] = Infinity; box[o + 3] = box[o + 4] = box[o + 5] = -Infinity;
    const c0 = [Infinity, Infinity, Infinity], c1 = [-Infinity, -Infinity, -Infinity];
    for (let k = lo; k < hi; k++) {
      for (let q = 0; q < 3; q++) {
        if (tb[k * 6 + q] < box[o + q]) box[o + q] = tb[k * 6 + q];
        if (tb[k * 6 + 3 + q] > box[o + 3 + q]) box[o + 3 + q] = tb[k * 6 + 3 + q];
        const c = cen[k * 3 + q];
        if (c < c0[q]) c0[q] = c;
        if (c > c1[q]) c1[q] = c;
      }
    }
    if (hi - lo <= WIDE_LEAF) { left[node] = -1; start[node] = lo; count[node] = hi - lo; continue; }
    // the split: the surface-area rule over WIDE_BINS bins of centres on each axis - the cut that leaves the two sides
    // the least box area between them, so the massif's big overlapping faces are kept apart from the small ones (a
    // median cut stacked fat boxes over each other, and every query walked most of the tree)
    let bestCost = Infinity, bestAx = -1, bestBin = 0;
    for (let ax = 0; ax < 3; ax++) {
      const ext = c1[ax] - c0[ax];
      if (!(ext > 0)) continue;
      binN.fill(0);
      for (let i = 0; i < WIDE_BINS; i++) { binB[i * 6] = binB[i * 6 + 1] = binB[i * 6 + 2] = Infinity; binB[i * 6 + 3] = binB[i * 6 + 4] = binB[i * 6 + 5] = -Infinity; }
      for (let k = lo; k < hi; k++) {
        const bi = Math.min(WIDE_BINS - 1, Math.floor(((cen[k * 3 + ax] - c0[ax]) / ext) * WIDE_BINS));
        binN[bi]++;
        for (let q = 0; q < 3; q++) {
          if (tb[k * 6 + q] < binB[bi * 6 + q]) binB[bi * 6 + q] = tb[k * 6 + q];
          if (tb[k * 6 + 3 + q] > binB[bi * 6 + 3 + q]) binB[bi * 6 + 3 + q] = tb[k * 6 + 3 + q];
        }
      }
      const acc = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      const grow = (i) => { for (let q = 0; q < 3; q++) { if (binB[i * 6 + q] < acc[q]) acc[q] = binB[i * 6 + q]; if (binB[i * 6 + 3 + q] > acc[q + 3]) acc[q + 3] = binB[i * 6 + 3 + q]; } };
      let nr = 0;
      for (let i = WIDE_BINS - 1; i >= 1; i--) { if (binN[i]) grow(i); nr += binN[i]; rightA[i] = nr ? area(acc, 0) * nr : 0; }
      acc[0] = acc[1] = acc[2] = Infinity; acc[3] = acc[4] = acc[5] = -Infinity;
      let nl = 0;
      for (let i = 0; i < WIDE_BINS - 1; i++) {
        if (binN[i]) grow(i);
        nl += binN[i];
        if (!nl || nl === hi - lo) continue;
        const cost = area(acc, 0) * nl + rightA[i + 1];
        if (cost < bestCost) { bestCost = cost; bestAx = ax; bestBin = i; }
      }
    }
    let mid;
    if (bestAx < 0) mid = (lo + hi) >> 1;   // every centre in one point: halves, in list order
    else {
      const ext = c1[bestAx] - c0[bestAx];
      let i = lo, j = hi - 1;
      while (i <= j) {
        const bi = Math.min(WIDE_BINS - 1, Math.floor(((cen[i * 3 + bestAx] - c0[bestAx]) / ext) * WIDE_BINS));
        if (bi <= bestBin) i++;
        else { swap(i, j); j--; }
      }
      mid = i;
      if (mid === lo || mid === hi) mid = (lo + hi) >> 1;
    }
    const l = nodes;
    nodes += 2;
    left[node] = l;
    stack.push(lo, mid, l, mid, hi, l + 1);
  }
  bucket.wideTree = { n, order, box, left, start, count };
  return bucket.wideTree;
}
const WIDE_STACK = new Int32Array(128);
const WIDE_NEAR = [];   // the wide triangles a sphere query takes, one scratch (nearCells hands it on)
/** The wide triangles whose boxes a sphere of radius `r` at the bucket-local point reaches. */
function wideNear(bucket, lx, ly, lz, r) {
  WIDE_NEAR.length = 0;
  const T = wideTree(bucket), box = T.box;
  let sp = 0;
  WIDE_STACK[sp++] = 0;
  while (sp) {
    const node = WIDE_STACK[--sp], o = node * 6;
    if (lx + r < box[o] - BOX_SKIN || lx - r > box[o + 3] + BOX_SKIN || ly + r < box[o + 1] - BOX_SKIN || ly - r > box[o + 4] + BOX_SKIN
      || lz + r < box[o + 2] - BOX_SKIN || lz - r > box[o + 5] + BOX_SKIN) continue;
    const l = T.left[node];
    if (l < 0) { for (let k = T.start[node], e = k + T.count[node]; k < e; k++) WIDE_NEAR.push(T.order[k]); continue; }
    WIDE_STACK[sp++] = l; WIDE_STACK[sp++] = l + 1;
  }
  return WIDE_NEAR;
}
/** The wide triangles whose boxes the segment `origin + dir * [0, reach]` touches (the node's slab test, exact). */
function wideOnRay(bucket, ox, oy, oz, dir, reach) {
  const out = [];
  const T = wideTree(bucket), box = T.box;
  let sp = 0;
  WIDE_STACK[sp++] = 0;
  while (sp) {
    const node = WIDE_STACK[--sp], o = node * 6;
    let tMin = 0, tMax = reach, miss = false;
    for (let k = 0; k < 3 && !miss; k++) {
      const lo = box[o + k] - BOX_SKIN, hi = box[o + 3 + k] + BOX_SKIN, d = dir[k], ok = k === 0 ? ox : k === 1 ? oy : oz;
      if (d === 0) { if (ok < lo || ok > hi) miss = true; continue; }
      let t0 = (lo - ok) / d, t1 = (hi - ok) / d;
      if (t0 > t1) { const tt = t0; t0 = t1; t1 = tt; }
      if (t0 > tMin) tMin = t0;
      if (t1 < tMax) tMax = t1;
      if (tMin > tMax) miss = true;
    }
    if (miss) continue;
    const l = T.left[node];
    if (l < 0) { for (let k = T.start[node], e = k + T.count[node]; k < e; k++) out.push(T.order[k]); continue; }
    WIDE_STACK[sp++] = l; WIDE_STACK[sp++] = l + 1;
  }
  return out;
}
/** OW-WOD-LAG: how many wide faces the tree hands a sphere of radius `r` at a WORLD point in bucket `key` (no mover's
 *  turn) - the query's own walk, counted: the pin that the tree culls (test/ow_wod.test.js). */
export function wideCandidates(collider, key, p, r) {
  const bucket = collider._buckets.get(key);
  if (!bucket || !bucket.wide.length) return 0;
  const t = bucket.t();
  return wideNear(bucket, p[0] - t[0], p[1] - t[1], p[2] - t[2], r).length;
}
/** OW-WOD-LAG: and the ray's - how many wide faces the tree hands the segment `p + dir * [0, reach]` (world, no turn). */
export function wideRayCandidates(collider, key, p, dir, reach) {
  const bucket = collider._buckets.get(key);
  if (!bucket || !bucket.wide.length) return 0;
  const t = bucket.t();
  return wideOnRay(bucket, p[0] - t[0], p[1] - t[1], p[2] - t[2], dir, reach).length;
}
/** OW-WOD-LAG: may a sphere of radius `r` at the bucket-local point touch this triangle - false only for a wide
 *  triangle whose own box it cannot reach (a point within r of a triangle is within r of its box). */
const triNear = (tri, lx, ly, lz, r) => tri[3] === undefined || sphereTouchesBox(lx, ly, lz, r, tri[3], tri[4]);

const NEAR = [];   // AUDIT BRANCH (WoD) B1: the cell lists a point query takes, one scratch
/** The triangle lists within a sphere query's reach of (lx, ly, lz) in `bucket`: the fine 3x3 (CELL exceeds every
 *  query radius), then - only where the bucket holds wide triangles - the ones the tree hands a sphere of `r` grown
 *  by WIDE_MARGIN. */
function nearCells(bucket, lx, ly, lz, r) {
  NEAR.length = 0;
  const gx = Math.floor(lx / CELL);
  const gz = Math.floor(lz / CELL);
  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const cell = bucket.grid.get(cellKey(gx + ox, gz + oz));   // PERF-EXT25
      if (cell) NEAR.push(cell);
    }
  }
  if (bucket.wide.length) NEAR.push(wideNear(bucket, lx, ly, lz, r + WIDE_MARGIN));   // OW-WOD-LAG
  return NEAR;
}

export function segmentHitsBox(ox, oy, oz, dir, min, max, limit) {
  if (!(limit >= 0)) return false;
  let tMin = 0, tMax = limit;
  for (let k = 0; k < 3; k++) {
    const lo = min[k] - BOX_SKIN, hi = max[k] + BOX_SKIN;
    if (!(hi >= lo)) return false;           // an empty bucket has no box and nothing to walk
    const d = dir[k];
    const ok = k === 0 ? ox : k === 1 ? oy : oz;   // BLOOD1 AUDIT 3: read in place - this ran per bucket per ray, and boxed the origin into a fresh array each time
    if (d === 0) { if (ok < lo || ok > hi) return false; continue; }
    const inv = 1 / d;
    let t1 = (lo - ok) * inv, t2 = (hi - ok) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }
  return true;
}

/** AUDIT 68 S15-collider-closestpoint-alloc: the point and the edges are
 *  SCALARS - this is the narrow phase of every sphere walk, and the point
 *  and five edge arrays it minted per triangle were garbage in every
 *  move(). Same arithmetic, same order, same answers. */
function closestPointOnTriangle(px, py, pz, a, b, c, out) {
  // Ericson, Real-Time Collision Detection 5.1.5.
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  const apx = px - a[0], apy = py - a[1], apz = pz - a[2];
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return; }
  const bpx = px - b[0], bpy = py - b[1], bpz = pz - b[2];
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0] = a[0] + abx * v; out[1] = a[1] + aby * v; out[2] = a[2] + abz * v;
    return;
  }
  const cpx = px - c[0], cpy = py - c[1], cpz = pz - c[2];
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0] = a[0] + acx * w; out[1] = a[1] + acy * w; out[2] = a[2] + acz * w;
    return;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out[0] = b[0] + (c[0] - b[0]) * w;
    out[1] = b[1] + (c[1] - b[1]) * w;
    out[2] = b[2] + (c[2] - b[2]) * w;
    return;
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  out[0] = a[0] + abx * v + acx * w;
  out[1] = a[1] + aby * v + acy * w;
  out[2] = a[2] + abz * v + acz * w;
}

/** AUDIT DISC28 MO-1: |n.y| of a triangle's own plane, unit and facing-blind (the collider reads no winding) - the
 *  slope a CharacterController judges a touched triangle by. Scalars, no allocation: it runs inside the sphere walk,
 *  and only for a contact the lower sphere's one-way floor already wants. A degenerate triangle answers 0, no floor. */
function faceNy(tri) {
  const a = tri[0], b = tri[1], c = tri[2];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return l > 0 ? Math.abs(ny) / l : 0;
}

/** AUDIT NAV1 (the frame's cost, #12): faceNy of a TURNED bucket's triangle - its plane's normal as the bucket's R
 *  stands it in the world (world = R b + t; R's second row, column-major), the slope judged of the face as it stands. */
function faceNyTurned(tri, R) {
  const a = tri[0], b = tri[1], c = tri[2];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return l > 0 ? Math.abs(R[1] * nx + R[4] * ny + R[7] * nz) / l : 0;
}

/** AUDIT NAV1 (the frame's cost, #12): a world point in a bucket's own frame, into `out` - less its translation, and
 *  turned back through R's transpose where the bucket turns (world = R b + t). */
function intoBucket(x, y, z, t, R, out) {
  const px = x - t[0], py = y - t[1], pz = z - t[2];
  if (!R) { out[0] = px; out[1] = py; out[2] = pz; return out; }
  out[0] = R[0] * px + R[1] * py + R[2] * pz;
  out[1] = R[3] * px + R[4] * py + R[5] * pz;
  out[2] = R[6] * px + R[7] * py + R[8] * pz;
  return out;
}
/** A turned bucket's box as it stands in the world: its own box's centre carried, its half-extents through |R| -
 *  [minX, minY, minZ, maxX, maxY, maxZ], holding every point of the turned box. */
function turnedBox(bucket, t, R, out) {
  for (let i = 0; i < 3; i++) {
    let c = t[i], e = 0;
    for (let j = 0; j < 3; j++) {
      const r = R[j * 3 + i];   // row i of column j
      c += r * ((bucket.min[j] + bucket.max[j]) / 2);
      e += Math.abs(r) * ((bucket.max[j] - bucket.min[j]) / 2);
    }
    out[i] = c - e; out[i + 3] = c + e;
  }
  return out;
}
const LOCAL = [0, 0, 0];   // a query's point in the bucket it is asking - one scratch (no query re-enters another here)
const LOCAL_DIR = [0, 0, 0];   // and a ray's direction there
const TURNED_BOX = [0, 0, 0, 0, 0, 0];

/** MAC-BUG W5: how far apart the two samples of a central difference
 *  are. Half a unit - wide enough that the terrain sampler's own
 *  interpolation answers two different heights on a real slope,
 *  narrow enough that a drop of blood reads the hill it is on rather
 *  than the one over the ridge. */
const GROUND_NORMAL_STEP = 0.5;

export class Collider {
  /** @param {(x:number,z:number)=>number} heightAt floor beneath everything
   *  @param {((x:number,z:number)=>number)|null} [surfaceAt] BLOOD1 AUDIT 3:
   *  the DRAWN ground, where it differs from the floor the capsule
   *  walks on. The world host's `heightAt` is a bilinear read of the
   *  heightmap; the terrain it draws is two triangles a quad, and the
   *  two surfaces are up to 0.08 apart on real grades (terrainSurface.js
   *  measured it) - four times a mark's 2cm lift. The capsule keeps
   *  the bilinear floor it has always had; a thing PLACED on the ground
   *  (surfaceHit, groundNormal) asks where the ground is drawn. */
  constructor(heightAt = () => -Infinity, surfaceAt = null) {
    this.heightAt = heightAt;
    this.surfaceAt = typeof surfaceAt === 'function' ? surfaceAt : null;
    this._buckets = new Map(); // key -> {tris, grid: Map, t: () => [x,y,z], r: (() => number[]|null)|null, min: [x,y,z], max: [x,y,z]}   // AUDIT NAME1 F2: the bounds are the ray's broad phase
    this._broad = null;   // FB0930-FRAME: the buckets filed by broad cell (buildBroad), dropped by every addMesh and removeBucket
    /** @type {any} TACT1: the billboards' cover (ai/cover.js createCoverIndex) - beside the meshes, never in them; null for none */
    this.cover = null;
  }

  /** FB0930-FRAME: the buckets a query whose WORLD box is [x0, x1] x [z0, z1] (y unbounded) can reach, in the walk's
   *  order, into `out` - those after `afterOrd` alone (_resolveSphere's re-gather). Every bucket that moves and every
   *  one too big to file is among them; a standing bucket is among them when its box's cells meet the query's. A box
   *  too wide (or not finite) answers every bucket after `afterOrd`, the walk as it was. */
  _near(x0, x1, z0, z1, out, afterOrd = -1) {
    const broad = this._broad ??= buildBroad(this._buckets);
    out.length = 0;
    const cx0 = Math.floor(x0 / BROAD_CELL), cx1 = Math.floor(x1 / BROAD_CELL);
    const cz0 = Math.floor(z0 / BROAD_CELL), cz1 = Math.floor(z1 / BROAD_CELL);
    if (!((cx1 - cx0 + 1) * (cz1 - cz0 + 1) <= BROAD_QUERY_MAX)) {
      const all = broad.all;
      for (let i = afterOrd + 1; i < all.length; i++) out.push(all[i]);
      return out;
    }
    for (const b of broad.always) if (b.ord > afterOrd) out.push(b);
    const stamp = ++BROAD_STAMP;
    let sorted = true;
    for (let gx = cx0; gx <= cx1; gx++) {
      for (let gz = cz0; gz <= cz1; gz++) {
        const list = broad.cells.get(cellKey(gx, gz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (b.ord <= afterOrd || b._broadStamp === stamp) continue;
          b._broadStamp = stamp;
          if (out.length && out[out.length - 1].ord > b.ord) sorted = false;
          out.push(b);
        }
      }
    }
    if (!sorted) {   // back into the walk's order - an insertion sort, the lists are a handful
      for (let i = 1; i < out.length; i++) {
        const b = out[i];
        let j = i - 1;
        while (j >= 0 && out[j].ord > b.ord) { out[j + 1] = out[j]; j--; }
        out[j + 1] = b;
      }
    }
    return out;
  }

  /**
   * DISC16-A (2026-09-24, Mac: "I notice my character is sunken into the
   * ground on hills"): WHERE A CAPSULE'S FEET REST ON THE TERRAIN FLOOR.
   * DFU's body is Unity's CharacterController, a capsule, and on a slope a
   * capsule rests on its rounded bottom: the sphere's centre stands r / cos
   * of the grade over the ground beneath it, so its lowest point, the feet,
   * stands r (1 / cos - 1) over the ground there - 5 cm at 30 degrees, 15 at
   * 45, 35 at 60. The floor here took the ground beneath the centre as the
   * feet, so on a hill every body stood that much lower than DFU's, and the
   * third-person body (placed at the feet) had its uphill foot in the slope.
   * The grade is the heightfield's across the capsule's own width. Flat
   * ground, and a floor with no ground either side of the capsule (a pixel's
   * edge), are unchanged.
   */
  restFloor(x, z) {
    const h = this.heightAt(x, z);
    if (!Number.isFinite(h)) return h;
    const r = CAPSULE_RADIUS;
    const hx0 = this.heightAt(x - r, z), hx1 = this.heightAt(x + r, z), hz0 = this.heightAt(x, z - r), hz1 = this.heightAt(x, z + r);
    if (!(Number.isFinite(hx0) && Number.isFinite(hx1) && Number.isFinite(hz0) && Number.isFinite(hz1))) return h;
    // DW-D (2026-09-25): THE GRADE IS A SLOPE'S, NEVER A STEP'S. The carved
    // sea (Iliac Puddle No More) lays its seafloor under the heightfield, so
    // at a carved cell's edge the floor STEPS from the sea's bed to the shore
    // (the floor's walls stand in the step), and the centred difference read
    // the step as a grade: a body on the shore within a radius of it rested
    // r (sqrt(1 + g^2) - 1) over the ground at g = rise / 2r - twelve metres
    // over a 25 m step, measured through a shore exit. Each axis takes the
    // gentler of its two one-sided grades, and none where they disagree in
    // sign (a ridge, a valley's floor): on a plane both ARE the centred one,
    // so every slope rests as above, and at a step the body rests on the
    // ground beneath it - on a cliff's top at its edge, or at its foot
    // against the wall.
    const gx = minmod((hx1 - h) / r, (h - hx0) / r), gz = minmod((hz1 - h) / r, (h - hz0) / r);
    return h + r * (Math.sqrt(1 + gx * gx + gz * gz) - 1);
  }

  /**
   * Register a mesh's triangles under a bucket. Positions/indices are the
   * meshReader model buffers; matrix bakes them into bucket space.
   *
   * AUDIT NAV1 (the frame's cost, #12): A MOVER'S BUCKET. `rotation`, where
   * given, answers the turn the bucket's triangles stand at beside its
   * translation - a column-major 3x3, orthonormal, or null for none: the
   * world is R b + t. A boat's colliders are baked once and ride her as
   * PhysX moves a MeshCollider by its transform; her every move had
   * re-baked them (three ships near: 4,334 triangles and ~7 ms a frame).
   * Every query takes its point, and a ray its direction, into the
   * bucket's frame, and brings a contact, a normal or a push back out; a
   * bucket with no turn (every bucket but a mover's) is walked exactly as
   * it was.
   */
  addMesh(bucketKey, positions, indices, matrix, translation = null, rotation = null) {
    let bucket = this._buckets.get(bucketKey);
    if (!bucket) {
      // AUDIT NAME1 F2: `min`/`max` are the bucket's own bounds in ITS
      // OWN space (the translation is applied to the RAY, as the DDA
      // already does), kept as the triangles go in - one compare per
      // vertex, paid once at load, against a walk paid per ray.
      bucket = { key: bucketKey, moves: !!(translation || rotation), ord: -1, _broadStamp: 0, tris: [], yLo: [], yHi: [], part: [], parts: 0, rayMark: null, grid: new Map(), wide: [], wideTree: null, t: translation || (() => ZERO3), r: rotation, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };   // AUDIT BRANCH (WoD) B1; OW-WOD-LAG: the wide triangles, and their tree (built when first asked); FB0930-FRAME: its key, whether it moves, its place in the walk
      this._buckets.set(bucketKey, bucket);
    }
    this._broad = null;   // FB0930-FRAME: a new bucket, or a box that grows - filed again at the next query
    const m = matrix;
    const tx = (i) => {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
    };
    const part = bucket.parts++;   // FIELD BUGS 2026-10-02 ROCK-FREE: each call one collider of the bucket's
    // AUDIT REST III E2: A MIRRORED PLACEMENT'S WINDING, AS THE WORLD PASS WINDS IT - a negative determinant turns every
    // triangle over, and the static batch swaps each one's last two corners back (staticBatch.js WOD5), so the face the
    // game draws faces the eye. The answer's normal is turned to face the ray either way; `back` (AUDIT REST II F4) reads
    // the winding, and read a mirrored floor's top as its back. No dungeon placement mirrors today (getModelMatrix is a
    // turn); World of Daggerfall's one wall does.
    const mirrored = !!m && m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]) < 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = tx(indices[i]);
      const b = tx(indices[mirrored ? i + 2 : i + 1]);
      const c = tx(indices[mirrored ? i + 1 : i + 2]);
      const idx = bucket.tris.length;
      bucket.tris.push([a, b, c]);
      bucket.part[idx] = part;
      bucket.yLo[idx] = Math.min(a[1], b[1], c[1]);   // FB0930-FOE-RAYS: the ray walk's Y reject
      bucket.yHi[idx] = Math.max(a[1], b[1], c[1]);
      for (let j = 0; j < 3; j++) {   // PERF-EXT25: the three corners without a fourth array a triangle
        const v = j === 0 ? a : j === 1 ? b : c;
        for (let k = 0; k < 3; k++) {
          if (v[k] < bucket.min[k]) bucket.min[k] = v[k];
          if (v[k] > bucket.max[k]) bucket.max[k] = v[k];
        }
      }
      const minX = Math.floor(Math.min(a[0], b[0], c[0]) / CELL);
      const maxX = Math.floor(Math.max(a[0], b[0], c[0]) / CELL);
      const minZ = Math.floor(Math.min(a[2], b[2], c[2]) / CELL);
      const maxZ = Math.floor(Math.max(a[2], b[2], c[2]) / CELL);
      if ((maxX - minX + 1) * (maxZ - minZ + 1) > FINE_CELLS_MAX) { if (wideBox(bucket.tris[idx])) bucket.wide.push(idx); continue; }   // AUDIT BRANCH (WoD) B1; OW-WOD-LAG: with its own box, for the tree (a vertex that is not finite files nothing, as the fine loop's own bounds never did)
      for (let gx = minX; gx <= maxX; gx++) {
        for (let gz = minZ; gz <= maxZ; gz++) {
          const k = cellKey(gx, gz);   // PERF-EXT25
          let cell = bucket.grid.get(k);
          if (!cell) { cell = []; bucket.grid.set(k, cell); }
          cell.push(idx);
        }
      }
    }
  }

  /** OW-WOD-LAG: build a bucket's tree over its wide triangles NOW - a host calls it once a pixel's meshes are in, inside
   *  its own build (with its breathers), so a massif's tree (7-30 ms on a stand-in rock) is never raised by the first
   *  query of a frame in play. A bucket with none, or whose tree stands, costs nothing; a later mesh raises it again,
   *  lazily, on the query that needs it. */
  settle(bucketKey) {
    const bucket = this._buckets.get(bucketKey);
    if (bucket && bucket.wide.length) wideTree(bucket);
  }

  removeBucket(bucketKey) {
    if (this._buckets.delete(bucketKey)) this._broad = null;   // FB0930-FRAME: the filing is dropped with it
    this.cover?.remove(bucketKey);   // TACT1: a bucket's cover leaves with it
  }

  /** AUDIT CLIMB1 F5: where a bucket stands now - `{ t, r }`, its translation and its turn (r null for an unturned
   *  one; intoBucket's convention: local = r (p - t)), copies, or null for no such bucket. The enhanced climb's move
   *  onto a mover (a boat's hull) reads it every step and rides the difference (player/parkour.js carryMove).
   *  AUDIT CLIMB2 C4: null for a bucket that does not move with a pose - one stood again at its new place instead (a
   *  parked wagon, a gate, an action object) has no pose to ride, and a recentre's shift of a remembered zero carried
   *  the body back the whole recentre. */
  bucketPose(bucketKey) {
    const bucket = this._buckets.get(bucketKey);
    if (!bucket?.moves) return null;
    const t = bucket.t();
    const r = bucket.r ? bucket.r() : null;
    return { t: [t[0], t[1], t[2]], r: r ? Array.from(r) : null };
  }

  /** DECOR-ROOMS: the box every bucket's triangles stand in, in world space (each bucket's own bounds moved by its
   *  translation) - `{ min, max }`, or null for a collider that holds no triangle. */
  bounds() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const bucket of this._buckets.values()) {
      if (!(bucket.min[0] <= bucket.max[0])) continue;   // an empty bucket's box is inverted
      const t = bucket.t();
      const R = bucket.r ? bucket.r() : null;   // AUDIT NAV1 (#12): a mover's, its box as it stands turned
      if (R) {
        const b = turnedBox(bucket, t, R, TURNED_BOX);
        for (let k = 0; k < 3; k++) { if (b[k] < min[k]) min[k] = b[k]; if (b[k + 3] > max[k]) max[k] = b[k + 3]; }
        continue;
      }
      for (let k = 0; k < 3; k++) {
        if (bucket.min[k] + t[k] < min[k]) min[k] = bucket.min[k] + t[k];
        if (bucket.max[k] + t[k] > max[k]) max[k] = bucket.max[k] + t[k];
      }
    }
    return min[0] <= max[0] ? { min, max } : null;
  }

  /**
   * Nearest ray-triangle hit distance along dir (unit), or Infinity.
   * Walks XZ grid cells with a 2D DDA per bucket (Moller-Trumbore per
   * triangle, front and back faces).
   */
  raycast(origin, dir, maxDist, filter = null) {
    return this.raycastHit(origin, dir, maxDist, filter).dist;
  }

  /**
   * Nearest hit WITH the bucket that produced it ({ dist, key });
   * dist Infinity / key null on a miss. The C-slice door senses ask
   * which surface blocked a sight line (EnemySenses.CanSeeTarget
   * records an action door the ray strikes first, :912-918) - action
   * doors are their own buckets keyed by the action object.
   *
   * ROAD-C c2/S1: an OPTIONAL bucket filter - `{ only, skip }`, each
   * an array/Set of bucket keys - lets a caller narrow the walk
   * without a second collider. DFU's automap scan excludes the player
   * collider by name (Automap.cs:1053) and the port's reveal walk
   * wants the same power without paying for a duplicate dungeon-sized
   * bucket (which raycastHit AND _resolveSphere would then walk for
   * movement, senses, activation and arrows). Strictly additive: with
   * no filter the walk is byte-for-byte what it was.
   *
   * TRAVEL-NAV1: and an OPTIONAL `out` - { dist, key, normal: [x, y, z] },
   * the caller's own - which is written and returned in place of a fresh
   * result, the normal into the caller's array ([0, 0, 0] on a miss).
   * The travel steering casts a dozen feelers a frame through here
   * (systems/travelSteer.js createColliderProbe) and owns one result for
   * all of them. Without it the answer is the one it always was.
   */
  raycastHit(origin, dirW, maxDist, filter = null, out = null) {
    let best = Infinity;
    let bestKey = null;
    let bestTri = null;   // M3 climbing: the hit surface's normal rides the result
    let bestR = null;   // AUDIT NAV1 (#12): and the turn of the bucket it stands in
    const only = filter?.only ? new Set(filter.only) : null;
    const skip = filter?.skip ? new Set(filter.skip) : null;
    // FB0930-FRAME: the buckets the ray's own world box reaches, in the walk's order - the rest would fail the box below
    const ex = origin[0] + dirW[0] * maxDist, ez = origin[2] + dirW[2] * maxDist;
    const near = this._near(Math.min(origin[0], ex) - BOX_SKIN, Math.max(origin[0], ex) + BOX_SKIN,
      Math.min(origin[2], ez) - BOX_SKIN, Math.max(origin[2], ez) + BOX_SKIN, RAY_NEAR);
    for (let bi = 0; bi < near.length; bi++) {
      const bucket = near[bi], bkey = bucket.key;
      if (only && !only.has(bkey)) continue;
      if (skip && skip.has(bkey)) continue;
      const t = bucket.t();
      const R = bucket.r ? bucket.r() : null;
      let ox, oy, oz, dir = dirW;   // AUDIT NAV1 (#12): the ray in the bucket's own frame - a mover's turned back
      if (R) {
        intoBucket(origin[0], origin[1], origin[2], t, R, LOCAL);
        ox = LOCAL[0]; oy = LOCAL[1]; oz = LOCAL[2];
        dir = intoBucket(dirW[0], dirW[1], dirW[2], ZERO3, R, LOCAL_DIR);
      } else {
        ox = origin[0] - t[0];
        oy = origin[1] - t[1];
        oz = origin[2] - t[2];
      }
      // AUDIT NAME1 F2: THE BUCKET'S OWN BOX, FIRST. Without it every
      // ray walked a full 2-D DDA to maxDist through EVERY bucket -
      // and an exterior collider holds one bucket per streamed map
      // pixel plus the gates and the action doors, 20-60 in a town. The
      // name pass casts one ray a peer, so the walk was multiplied by
      // the crowd: the audit measured 3.85 ms a frame at 30 buckets x
      // 60 peers and 24 ms at 60 x 199. Measured again here over a
      // synthetic 30-bucket town, before and after: 2.13 -> 0.19 ms a
      // frame at 60 peers, 8.63 -> 0.33 at 199, and 209 cell lookups
      // for 60 rays where the bare DDA walks 21,720. A box test is six
      // compares, and a bucket the ray never enters is now six
      // compares.
      if (!segmentHitsBox(ox, oy, oz, dir, bucket.min, bucket.max, Math.min(maxDist, best))) continue;
      // 2D DDA across cells.
      let cx = Math.floor(ox / CELL);
      let cz = Math.floor(oz / CELL);
      const stepX = dir[0] > 0 ? 1 : -1;
      const stepZ = dir[2] > 0 ? 1 : -1;
      const invX = dir[0] !== 0 ? 1 / dir[0] : Infinity;
      const invZ = dir[2] !== 0 ? 1 / dir[2] : Infinity;
      let tMaxX = dir[0] !== 0 ? ((cx + (stepX > 0 ? 1 : 0)) * CELL - ox) * invX : Infinity;
      let tMaxZ = dir[2] !== 0 ? ((cz + (stepZ > 0 ? 1 : 0)) * CELL - oz) * invZ : Infinity;
      const tDeltaX = Math.abs(CELL * invX);
      const tDeltaZ = Math.abs(CELL * invZ);
      const marks = rayMarks(bucket), stamp = RAY_STAMP;   // FB0930-FOE-RAYS
      const yLoOf = bucket.yLo, yHiOf = bucket.yHi, dy = dir[1];
      let walked = 0;
      while (walked <= Math.min(maxDist, best)) {
        const cell = bucket.grid.get(cellKey(cx, cz));   // PERF-EXT25
        if (cell) {
          // FB0930-FOE-RAYS: the ray's Y span inside this cell, [walked, leaving it] clamped to the reach
          const tOut = Math.min(tMaxX, tMaxZ, maxDist, best);
          const y0 = oy + dy * walked, y1 = oy + dy * tOut;
          const rLo = (y0 < y1 ? y0 : y1) - RAY_Y_SLACK, rHi = (y0 < y1 ? y1 : y0) + RAY_Y_SLACK;
          for (let ci = 0; ci < cell.length; ci++) {
            const ti = cell[ci];
            if (marks[ti] === stamp) continue;
            if (yHiOf[ti] < rLo || yLoOf[ti] > rHi) continue;   // not reachable in this cell - left unmarked
            marks[ti] = stamp;
            const tri = bucket.tris[ti];
            const hit = rayTriangle(ox, oy, oz, dir, tri[0], tri[1], tri[2]);
            if (hit !== null && hit < best && hit <= maxDist) { best = hit; bestKey = bkey; bestTri = tri; bestR = R; }
          }
        }
        if (tMaxX < tMaxZ) { walked = tMaxX; tMaxX += tDeltaX; cx += stepX; }
        else { walked = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; }
      }
      // AUDIT BRANCH (WoD) B1: the wide triangles, where this bucket holds any
      if (bucket.wide.length) {   // OW-WOD-LAG: the tree's, each wide triangle once
        for (const ti of wideOnRay(bucket, ox, oy, oz, dir, Math.min(maxDist, best))) {
          const tri = bucket.tris[ti];
          const hit = rayTriangle(ox, oy, oz, dir, tri[0], tri[1], tri[2]);
          if (hit !== null && hit < best && hit <= maxDist) { best = hit; bestKey = bkey; bestTri = tri; bestR = R; }
        }
      }
    }
    // M3 climbing (GetClimbedWallInfo :608 needs -hit.normal): the
    // best triangle's unit normal, oriented to FACE the ray - both
    // faces hit (as above), so the sign follows the approach side.
    let normal = null;
    let nx = 0, ny = 0, nz = 0;
    // AUDIT REST II F4: `back` - the ray struck the face's BACK, its own winding's normal turned away from the ray's
    // source (the answer's normal is flipped to face the ray, so it cannot say). A downward ray on a ceiling's top is
    // one: dungeonFires.js colliderFireProbe reads a floor by it.
    let back = false;
    if (bestTri) {
      const [a, b, c] = bestTri;
      nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (bestR) {   // AUDIT NAV1 (#12): a mover's face, turned as it stands
        const R = bestR;
        const wx = R[0] * nx + R[3] * ny + R[6] * nz, wy = R[1] * nx + R[4] * ny + R[7] * nz, wz = R[2] * nx + R[5] * ny + R[8] * nz;
        nx = wx; ny = wy; nz = wz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      back = nx * dirW[0] + ny * dirW[1] + nz * dirW[2] > 0;
      if (back) { nx = -nx; ny = -ny; nz = -nz; }
      if (!out) normal = [nx, ny, nz];
    }
    if (out) {   // TRAVEL-NAV1: the caller's own result, written in place
      out.dist = best; out.key = bestKey;
      out.normal[0] = nx; out.normal[1] = ny; out.normal[2] = nz;
      out.back = back;
      return out;
    }
    return { dist: best, key: bestKey, normal, back };
  }

  /**
   * MAC-BUG W5 (Mac, 2026-09-20: "blood doesn't work outside") - THE
   * SAME RAY, PLUS THE GROUND.
   *
   * `raycastHit` walks BUCKETS ALONE: triangles, registered by
   * `addMesh`. That is the whole of the world indoors and underground,
   * where a floor is a mesh - and it is why every caller that wants a
   * wall, a ceiling, a head-bump or a line of sight wants exactly
   * that, and why this is a SECOND door rather than a change to it.
   *
   * Outside, the ground is not a mesh. It is `heightAt` - the terrain
   * sampler in the world host, a flat constant in the exterior one -
   * applied to the capsule in `_resolveSphere` and nowhere else. So a
   * ray cast straight down from something standing on the ground hits
   * NOTHING, and a caller that reads "nothing" as "no surface" is
   * right indoors and silently wrong in the whole outdoors.
   *
   * This answers whichever is NEARER, so a walkway over a valley still
   * catches what lands on it, and the terrain still catches what
   * misses the walkway. The floor is only ever met on the way DOWN.
   *
   * The ground's normal is its own SLOPE, by central difference on the
   * sampler rather than a flat up: a hillside is a surface, and a quad
   * laid flat on a hill stands in it. A sampler with no slope (the
   * exterior host's constant) answers straight up by construction, so
   * the flat case costs nothing but the four lookups.
   */
  surfaceHit(origin, dir, maxDist, filter = null) {
    const mesh = this.raycastHit(origin, dir, maxDist, filter);
    if (!(dir[1] < 0)) return mesh;
    const floor = (this.surfaceAt ?? this.heightAt)(origin[0], origin[2]);   // BLOOD1 AUDIT 3: the drawn ground, where the host draws one
    if (!Number.isFinite(floor)) return mesh;
    const d = (origin[1] - floor) / -dir[1];
    if (!(d >= 0) || d > maxDist) return mesh;
    if (mesh && Number.isFinite(mesh.dist) && mesh.dist <= d) return mesh;
    return { dist: d, key: null, normal: this.groundNormal(origin[0], origin[2]) };
  }

  /** The ground's slope where it is asked, as a unit normal. Central
   *  difference over GROUND_NORMAL_STEP: the gradient of a height
   *  field is (-dh/dx, 1, -dh/dz), normalised. A sampler that answers
   *  a constant - or one that runs off the edge of what is streamed -
   *  gives straight up, which is the right answer for flat ground and
   *  the safe one for no ground at all. */
  groundNormal(x, z) {
    const h = GROUND_NORMAL_STEP;
    const at = this.surfaceAt ?? this.heightAt;   // BLOOD1 AUDIT 3: the slope of the DRAWN ground - inside one triangle the difference is its plane exactly
    const c = at(x, z), xp = at(x + h, z), xm = at(x - h, z), zp = at(x, z + h), zm = at(x, z - h);
    if (!Number.isFinite(xp - xm) || !Number.isFinite(zp - zm) || !Number.isFinite(c)) return [0, 1, 0];
    // DW-D: the gentler one-sided grade per axis, restFloor's rule - on a
    // plane it is the centred difference, and a STEP in the sampler (the
    // carved sea's floor at a cell's edge) is not a cliff face half a
    // sample either side of it: the Deep Waters shore probe read a shore
    // half a metre from the carve as a wall and refused the landing.
    // `|| 0` is not belt and braces: -0 over flat ground is a real
    // answer that compares unequal to 0 and reads as a negative
    // gradient to anything that tests the sign.
    const nx = (-minmod((xp - c) / h, (c - xm) / h)) || 0, nz = (-minmod((zp - c) / h, (c - zm) / h)) || 0;
    const l = Math.hypot(nx, 1, nz) || 1;
    return [nx / l, 1 / l, nz / l];
  }

  /**
   * BOUNTY-ROCK (FIELD BUGS 2026-10-03): whether a world point stands INSIDE static solid - a World of Daggerfall rock
   * or mountain, a model standing in the ground. `partsHolding`'s line straight up (ROCK-FREE's: an odd count of
   * crossings of one part's skin), over every static bucket whose box holds the point. A bucket that turns (a boat's)
   * holds nothing, as in hullSweepAll. `sphereOverlaps` cannot answer this: deep inside a rock no face is near.
   */
  insideSolid(p) {
    const held = SWEEP_HELD;   // the hull sweep's scratch: insideSolid never runs inside a sweep (PERF-COL1: one scratch set)
    for (const bucket of this._buckets.values()) {
      if (bucket.r || !(bucket.min[0] <= bucket.max[0])) continue;   // a mover's; an empty bucket's box is inverted
      const t = bucket.t();
      held.clear();
      partsHolding(bucket, p[0] - t[0], p[1] - t[1], p[2] - t[2], held);
      if (held.size) return true;
    }
    return false;
  }

  /**
   * Static-geometry half of Unity's `Physics.OverlapSphere` - true
   * when any world triangle sits within `radius` of `center`. B1's
   * caller is CreateFoe's spawn-spot rejection (PlaceFoeFreely,
   * CreateFoe.cs:320-323: "Ensure this is open space"). Same 3x3-cell
   * bucket scan as _resolveSphere, but a pure query - no pushing, and
   * the first contact answers. What it cannot see, exactly like
   * capsuleCast below: entities are not in the collider, so the
   * caller supplies its own foe/player proximity term.
   */
  sphereOverlaps(center, radius) {
    const r2 = radius * radius;
    const g = radius + 2 * BOX_SKIN;   // FB0930-FRAME: the buckets the sphere's own box reaches, in the walk's order
    const near = this._near(center[0] - g, center[0] + g, center[2] - g, center[2] + g, SPHERE_NEAR);
    for (let bi = 0; bi < near.length; bi++) {
      const bucket = near[bi];
      const t = bucket.t();
      const R = bucket.r ? bucket.r() : null;
      let lx, ly, lz;
      if (R) { intoBucket(center[0], center[1], center[2], t, R, LOCAL); lx = LOCAL[0]; ly = LOCAL[1]; lz = LOCAL[2]; }   // AUDIT NAV1 (#12): a mover's, turned back
      else {
        lx = center[0] - t[0];
        ly = center[1] - t[1];
        lz = center[2] - t[2];
      }
      if (!sphereTouchesBox(lx, ly, lz, radius, bucket.min, bucket.max)) continue;   // PERF-COL1: the same broad phase (the test below is `< r2`, no skin)
      const marks = rayMarks(bucket), stamp = RAY_STAMP;   // FB0930-FRAME: the walk's stamp, not a Set
      const yLoOf = bucket.yLo, yHiOf = bucket.yHi, yReach = radius + SPHERE_Y_SLACK;
      for (const cell of nearCells(bucket, lx, ly, lz, radius)) {   // AUDIT BRANCH (WoD) B1: the fine 3x3, then any wide triangles
        for (let ci = 0; ci < cell.length; ci++) {
          const ti = cell[ci];
          if (marks[ti] === stamp) continue;
          marks[ti] = stamp;
          if (yHiOf[ti] < ly - yReach || yLoOf[ti] > ly + yReach) continue;   // FB0930-FRAME: out of reach above or below
          const tri = bucket.tris[ti];
          if (!triNear(tri, lx, ly, lz, radius)) continue;   // OW-WOD-LAG
          closestPointOnTriangle(lx, ly, lz, tri[0], tri[1], tri[2], TMP);
          const dx = lx - TMP[0];
          const dy = ly - TMP[1];
          const dz = lz - TMP[2];
          if (dx * dx + dy * dy + dz * dz < r2) return true;
        }
      }
    }
    return false;
  }

  /**
   * AUDIT PRE-MERGE 0929 D1: THE CONTACT a standing body makes with the buckets `filter.only` names - of every point
   * of their triangles within `reach` of the capsule's surface, the NEAREST, into `out` (world), or null for none.
   * The capsule is the chain _resolveCapsule resolves (a sphere of CAPSULE_RADIUS at the feet's end, at the head's,
   * and BEAD_OVERLAP-spaced between), so a contact here is one the motor's own resolve would meet: a wall the body
   * leans on stands SKIN off it and a floor the body rests on its ride height under it, and the nearer of the two is
   * the one the body is pressing. DaggerfallActionCollision reads its WalkOn off WHERE a contact is - the
   * ControllerColliderHit's point against the controller's centre (DaggerfallActionCollision.cs:68-71) - and this
   * is that point. A pure query: nothing is pushed. `beneath` (a number), when given, admits only the points whose
   * direction from the capsule's centre (feet + height/2) has a y below it - the nearest contact BENEATH the body.
   */
  capsuleContact(feet, height, reach, filter = null, out = [0, 0, 0], beneath = null) {
    const axis = Math.max(0, height - 2 * CAPSULE_RADIUS);
    const middles = Math.max(0, Math.ceil(axis / (2 * CAPSULE_RADIUS * BEAD_OVERLAP)) - 1);
    const n = middles + 2;
    const lim = CAPSULE_RADIUS + reach;
    const lim2 = lim * lim;
    const only = filter?.only ? new Set(filter.only) : null;
    let best = Infinity;
    const g = lim + 2 * BOX_SKIN;   // FB0930-FRAME: the buckets the capsule's own box reaches, in the walk's order
    const near = this._near(feet[0] - g, feet[0] + g, feet[2] - g, feet[2] + g, SPHERE_NEAR);
    for (let bi = 0; bi < near.length; bi++) {
      const bucket = near[bi], bkey = bucket.key;
      if (only && !only.has(bkey)) continue;
      const t = bucket.t();
      const R = bucket.r ? bucket.r() : null;   // AUDIT NAV1 (#12): a mover's - each sample turned back, the contact out
      let lx = feet[0] - t[0];
      let lz = feet[2] - t[2];
      for (let i = 0; i < n; i++) {
        let ly = feet[1] + CAPSULE_RADIUS + (axis * i) / (n - 1) - t[1];
        if (R) { intoBucket(feet[0], feet[1] + CAPSULE_RADIUS + (axis * i) / (n - 1), feet[2], t, R, LOCAL); lx = LOCAL[0]; ly = LOCAL[1]; lz = LOCAL[2]; }
        if (!sphereTouchesBox(lx, ly, lz, lim, bucket.min, bucket.max)) continue;
        const marks = rayMarks(bucket), stamp = RAY_STAMP;   // FB0930-FRAME: the walk's stamp, not a Set
        const yLoOf = bucket.yLo, yHiOf = bucket.yHi, yReach = lim + SPHERE_Y_SLACK;
        for (const cell of nearCells(bucket, lx, ly, lz, lim)) {
          for (let ci = 0; ci < cell.length; ci++) {
            const ti = cell[ci];
            if (marks[ti] === stamp) continue;
            marks[ti] = stamp;
            if (yHiOf[ti] < ly - yReach || yLoOf[ti] > ly + yReach) continue;   // FB0930-FRAME: out of reach above or below
            const tri = bucket.tris[ti];
            if (!triNear(tri, lx, ly, lz, lim)) continue;   // OW-WOD-LAG
            closestPointOnTriangle(lx, ly, lz, tri[0], tri[1], tri[2], TMP);
            const dx = lx - TMP[0];
            const dy = ly - TMP[1];
            const dz = lz - TMP[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (!(d2 <= lim2 && d2 < best)) continue;
            let px = TMP[0] + t[0], py = TMP[1] + t[1], pz = TMP[2] + t[2];   // the contact in the world
            if (R) { px = R[0] * TMP[0] + R[3] * TMP[1] + R[6] * TMP[2] + t[0]; py = R[1] * TMP[0] + R[4] * TMP[1] + R[7] * TMP[2] + t[1]; pz = R[2] * TMP[0] + R[5] * TMP[1] + R[8] * TMP[2] + t[2]; }
            if (beneath != null) {
              const cx = px - feet[0], cy = py - (feet[1] + height / 2), cz = pz - feet[2];
              const len = Math.hypot(cx, cy, cz);
              if (!(len > 0 && cy / len < beneath)) continue;
            }
            best = d2; out[0] = px; out[1] = py; out[2] = pz;
          }
        }
      }
    }
    return best < Infinity ? out : null;
  }

  /**
   * CSA-D: `Physics.SphereCastAll` - EVERY bucket the swept sphere meets, each with its first contact, where
   * `sphereCast` answers the nearest alone. Come Sail Away's CheckCollision sweeps its hull's half-beam along the
   * boat both ways and turns each collider met into a direction. Each bucket is swept with the same nine-ray bundle
   * `sphereCast` casts (its documented approximation), the sweep's own box refusing the buckets it never nears; a
   * bucket the sphere already overlaps where the sweep starts answers as Unity answers such a collider - distance 0
   * and the zero point. `filter.skip` leaves buckets out. Answers `[{ key, dist, point }]`, in bucket order.
   */
  sphereCastAll(origin, radius, dir, maxDist, filter = null) {
    const out = [];
    const skip = filter?.skip ? new Set(filter.skip) : null;
    const end = [origin[0] + dir[0] * maxDist, origin[1] + dir[1] * maxDist, origin[2] + dir[2] * maxDist];
    const lo = [0, 1, 2].map((i) => Math.min(origin[i], end[i]) - radius);
    const hi = [0, 1, 2].map((i) => Math.max(origin[i], end[i]) + radius);
    // the bundle's cross-section, as capsuleCast builds it
    let ux = -dir[2], uy = 0, uz = dir[0];
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-6) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const vx = dir[1] * uz - dir[2] * uy, vy = dir[2] * ux - dir[0] * uz, vz = dir[0] * uy - dir[1] * ux;
    const h = radius * Math.SQRT1_2;
    const spokes = [[0, 0, 0], [ux * radius, uy * radius, uz * radius], [-ux * radius, -uy * radius, -uz * radius],
      [vx * radius, vy * radius, vz * radius], [-vx * radius, -vy * radius, -vz * radius],
      [(ux + vx) * h, (uy + vy) * h, (uz + vz) * h], [(ux - vx) * h, (uy - vy) * h, (uz - vz) * h],
      [(-ux + vx) * h, (-uy + vy) * h, (-uz + vz) * h], [(-ux - vx) * h, (-uy - vy) * h, (-uz - vz) * h]];
    const reach = maxDist + radius;
    const r2 = radius * radius;
    for (const [key, bucket] of this._buckets) {
      if (skip && skip.has(key)) continue;
      const t = bucket.t();
      const R = bucket.r ? bucket.r() : null;   // AUDIT NAV1 (#12): a mover's - its box as it stands turned, the start turned back
      let apart = false;
      if (R) {
        const b = turnedBox(bucket, t, R, TURNED_BOX);
        for (let i = 0; i < 3; i++) if (hi[i] < b[i] - BOX_SKIN || lo[i] > b[i + 3] + BOX_SKIN) apart = true;
      } else for (let i = 0; i < 3; i++) if (hi[i] < bucket.min[i] + t[i] - BOX_SKIN || lo[i] > bucket.max[i] + t[i] + BOX_SKIN) apart = true;
      if (apart) continue;
      // the start: a triangle inside the sphere where the sweep begins
      let lx = origin[0] - t[0], ly = origin[1] - t[1], lz = origin[2] - t[2];
      if (R) { intoBucket(origin[0], origin[1], origin[2], t, R, LOCAL); lx = LOCAL[0]; ly = LOCAL[1]; lz = LOCAL[2]; }
      let overlap = false;
      if (sphereTouchesBox(lx, ly, lz, radius, bucket.min, bucket.max)) {
        const visited = VISITED;
        visited.clear();
        for (const cell of nearCells(bucket, lx, ly, lz, radius)) {
          for (const ti of cell) {
            if (visited.has(ti)) continue;
            visited.add(ti);
            const tri = bucket.tris[ti];
            if (!triNear(tri, lx, ly, lz, radius)) continue;   // OW-WOD-LAG
            closestPointOnTriangle(lx, ly, lz, tri[0], tri[1], tri[2], TMP);
            const dx = lx - TMP[0], dy = ly - TMP[1], dz = lz - TMP[2];
            if (dx * dx + dy * dy + dz * dz < r2) { overlap = true; break; }
          }
          if (overlap) break;
        }
      }
      if (overlap) { out.push({ key, dist: 0, point: [0, 0, 0] }); continue; }
      let best = Infinity, bestPoint = null;
      const only = { only: [key] };
      for (const [ox, oy, oz] of spokes) {
        const o = [origin[0] + ox, origin[1] + oy, origin[2] + oz];
        const hit = this.raycastHit(o, dir, reach, only);
        if (hit.dist < best) { best = hit.dist; bestPoint = [o[0] + dir[0] * hit.dist, o[1] + dir[1] * hit.dist, o[2] + dir[2] * hit.dist]; }
      }
      if (Number.isFinite(best)) out.push({ key, dist: Math.max(0, best - radius), point: bestPoint });
    }
    return out;
  }

  /**
   * FIELD BUGS 2026-10-02 ROCK-FREE (Mac: "ships get stuck in the world of daggerfall ocean rocks"), and its audit
   * (2026-10-02b, Mac: "Audit this"): A HULL'S SWEEP, MET AS UNITY MEETS IT - Come Sail Away's CheckCollision through
   * the world's host (scenes/world.js csaSphereCastAll), in place of `sphereCastAll` above. That one is Unity's
   * SphereCastAll over a bucket as ONE collider cast as nine rays, and a static bucket is a pixel's whole ground - every
   * World of Daggerfall rock of it in one: a ledge under her answered the zero point for the whole pixel and hid the
   * rock ahead; from inside a rock its inner walls (both faces, the collider's law) held her in for good; and a rock
   * smaller than the gap between two spokes was never met at all. Here:
   *   - THE SPHERE ITSELF IS SWEPT (`sweepSphereTriangle`: the face, its three edges, its three corners) against every
   *     triangle the swept sphere's box reaches - no rock slips between rays;
   *   - a bucket's PARTS are its colliders - each `addMesh` one, as a World of Daggerfall object or a model is its own
   *     MeshCollider (CreateDaggerfallMeshGameObject) - and each answers ONCE, as Unity answers a collider: an overlap
   *     where the sweep starts at the nearest point she touches (`start: true`, `dist` 0), else her first contact
   *     along the sweep (`dist` her centre's travel to it);
   *   - a part that holds her sphere's centre answers nothing (`partsHolding`; Unity's sweep reads no back face) - she
   *     leaves as she likes; only a static bucket holds (one that turns, a boat's collider, never does);
   *   - `keelY`: nothing wholly under her keel is met - a shelf she floats over is no rock, however the swell pitches
   *     her sweep (a world height; a static bucket's faces only - another boat's are always met);
   *   - `skip`: buckets not asked (her own colliders - CheckCollision would drop them, after the walk).
   * Answers `[{ key, part, dist, point, start? }]`.
   */
  hullSweepAll(origin, radius, dir, maxDist, { keelY = -Infinity, skip = null } = {}) {
    const out = [];
    const end = [origin[0] + dir[0] * maxDist, origin[1] + dir[1] * maxDist, origin[2] + dir[2] * maxDist];
    const lo = [0, 1, 2].map((i) => Math.min(origin[i], end[i]) - radius);
    const hi = [0, 1, 2].map((i) => Math.max(origin[i], end[i]) + radius);
    const held = SWEEP_HELD, first = SWEEP_FIRST;
    for (const [key, bucket] of this._buckets) {
      if (skip && skip.has(key)) continue;
      if (!(bucket.min[0] <= bucket.max[0])) continue;   // an empty bucket's box is inverted
      const t = bucket.t();
      const R = bucket.r ? bucket.r() : null;
      let apart = false;
      if (R) {
        const b = turnedBox(bucket, t, R, TURNED_BOX);
        for (let i = 0; i < 3; i++) if (hi[i] < b[i] - BOX_SKIN || lo[i] > b[i + 3] + BOX_SKIN) apart = true;
      } else for (let i = 0; i < 3; i++) if (hi[i] < bucket.min[i] + t[i] - BOX_SKIN || lo[i] > bucket.max[i] + t[i] + BOX_SKIN) apart = true;
      if (apart) continue;
      intoBucket(origin[0], origin[1], origin[2], t, R, LOCAL);
      const ox = LOCAL[0], oy = LOCAL[1], oz = LOCAL[2];   // copied out: partsHolding and the walk take the scratch
      let dx = dir[0], dy = dir[1], dz = dir[2];
      if (R) { intoBucket(dir[0], dir[1], dir[2], ZERO3, R, LOCAL_DIR); dx = LOCAL_DIR[0]; dy = LOCAL_DIR[1]; dz = LOCAL_DIR[2]; }
      const ex = ox + dx * maxDist, ey = oy + dy * maxDist, ez = oz + dz * maxDist;
      const x0 = Math.min(ox, ex) - radius, x1 = Math.max(ox, ex) + radius;
      const y0 = Math.min(oy, ey) - radius, y1 = Math.max(oy, ey) + radius;
      const z0 = Math.min(oz, ez) - radius, z1 = Math.max(oz, ez) + radius;
      held.clear();
      first.clear();
      if (!bucket.r) partsHolding(bucket, ox, oy, oz, held);
      const keel = bucket.r ? -Infinity : keelY - t[1];   // a static bucket's frame is its translation's alone
      const marks = rayMarks(bucket), stamp = RAY_STAMP;
      const yLoOf = bucket.yLo, yHiOf = bucket.yHi, partOf = bucket.part, tris = bucket.tris;
      const test = (ti) => {
        if (marks[ti] === stamp) return;
        marks[ti] = stamp;
        if (yHiOf[ti] < keel || yHiOf[ti] < y0 || yLoOf[ti] > y1) return;
        const part = partOf[ti];
        if (held.has(part)) return;
        const tri = tris[ti], a = tri[0], b = tri[1], c = tri[2];
        if (Math.max(a[0], b[0], c[0]) < x0 || Math.min(a[0], b[0], c[0]) > x1 || Math.max(a[2], b[2], c[2]) < z0 || Math.min(a[2], b[2], c[2]) > z1) return;
        if (!sweepSphereTriangle(ox, oy, oz, radius, dx, dy, dz, maxDist, a, b, c, SWEEP_HIT)) return;
        // an overlap answers at the part's nearest point to her centre, of every face it touches her with
        const near = SWEEP_HIT[0] === 0 ? (SWEEP_HIT[1] - ox) ** 2 + (SWEEP_HIT[2] - oy) ** 2 + (SWEEP_HIT[3] - oz) ** 2 : 0;
        const was = first.get(part);
        if (!was || SWEEP_HIT[0] < was[0] || (SWEEP_HIT[0] === 0 && near < was[4])) first.set(part, [SWEEP_HIT[0], SWEEP_HIT[1], SWEEP_HIT[2], SWEEP_HIT[3], near]);
      };
      const gx0 = Math.floor(x0 / CELL), gx1 = Math.floor(x1 / CELL), gz0 = Math.floor(z0 / CELL), gz1 = Math.floor(z1 / CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const cell = bucket.grid.get(cellKey(gx, gz));
          if (cell) for (let ci = 0; ci < cell.length; ci++) test(cell[ci]);
        }
      }
      if (bucket.wide.length) {
        const half = maxDist / 2;
        for (const ti of [...wideNear(bucket, ox + dx * half, oy + dy * half, oz + dz * half, half + radius)]) test(ti);
      }
      for (const [part, [d, cx, cy, cz]] of first) {
        const p = R ? [R[0] * cx + R[3] * cy + R[6] * cz + t[0], R[1] * cx + R[4] * cy + R[7] * cz + t[1], R[2] * cx + R[5] * cy + R[8] * cz + t[2]]
          : [cx + t[0], cy + t[1], cz + t[2]];
        out.push(d === 0 ? { key, part, dist: 0, point: p, start: true } : { key, part, dist: d, point: p });
      }
    }
    return out;
  }

  /**
   * Swept-capsule query - the contract Unity's `Physics.CapsuleCast`
   * honors, which DFU's EnemyMotor.ObstacleCheck is written against
   * (EnemyMotor.cs:1154). Sweep a capsule of `radius` whose axis runs
   * p1..p2 along `dir` for `maxDist`; answer the nearest hit distance
   * and the bucket that produced it, Infinity/null on a clear sweep.
   *
   * ENGINE-SIDE, like everything else in this file: the capsule is
   * sampled as a bundle of rays - `axisSamples` points along the axis,
   * each casting from the axis point and from eight points at `radius`
   * on the cross-section perpendicular to `dir` (four axes, four
   * diagonals). That is an approximation of the true swept volume and
   * it is the same kind of approximation the two-sphere capsule above
   * already is. It is sized for its one caller: the enemy obstacle
   * probe casts 0.175 over 0.247, where the bundle's widest gap between
   * rays is smaller than the wall thickness of anything in an RMB or
   * RDB block.
   *
   * A note on what it CANNOT see, which matters for the parity of the
   * caller rather than of this method: entities are not in the
   * collider at all (canSeeTarget's comment says so), so DFU's
   * "the obstacle is my combat target" and "the obstacle is a loot
   * pile" exemptions can never fire here. Action doors CAN: they are
   * their own buckets, keyed by the action object, which is what the
   * returned `key` is for.
   */
  capsuleCast(p1, p2, radius, dir, maxDist, axisSamples = 3, filter = null) {
    const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
    // A perpendicular basis for the cross-section. `dir` is normalized
    // by the caller; cross with world up unless dir IS world up.
    let ux = -dir[2], uy = 0, uz = dir[0];
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-6) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const vx = dir[1] * uz - dir[2] * uy;
    const vy = dir[2] * ux - dir[0] * uz;
    const vz = dir[0] * uy - dir[1] * ux;
    // The rays start on the AXIS, but a real CapsuleCast leads with the
    // capsule's cap: it touches an obstacle `radius` before the axis
    // reaches it, and reports the distance TRAVELLED. So cast
    // maxDist + radius and subtract the cap back off.
    const reach = maxDist + radius;
    let best = Infinity;
    let bestKey = null;
    // FB0930-FRAME: an axis of no length (the clear-path probe casts from the centre to the centre) samples one point
    // however many are asked for - the others are the same nine rays again, which can never beat the first nine's hit
    const n = ax === 0 && ay === 0 && az === 0 ? 1 : Math.max(1, axisSamples);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const bx = p1[0] + ax * t, by = p1[1] + ay * t, bz = p1[2] + az * t;
      // Centre plus EIGHT points on the cross-section: the four axes and
      // the four diagonals. The wave-35 re-read pointed out that a
      // four-point rosette leaves the diagonal quadrants unsampled, so a
      // corner arriving between two spokes could slip through. The
      // diagonals sit at radius/sqrt(2) on each axis, which is the same
      // circle, and cost four more DDA rays over a fifth of a metre.
      const h = radius * Math.SQRT1_2;
      // FB0930-FOE-RAYS: the nine spokes as coefficients on (u, v) - no nine fresh arrays a sample - and each ray
      // reaches only as far as the nearest hit so far: a farther one could never replace it (`<` below), so the
      // answer is the same and a spoke behind a wall the centre already met walks a cell or two, not the reach.
      for (let sp = 0; sp < 9; sp++) {
        const su = CAP_SPOKES[sp * 2], sv = CAP_SPOKES[sp * 2 + 1], k = sp >= 5 ? h : radius;
        CAP_ORIGIN[0] = bx + (su * ux + sv * vx) * k; CAP_ORIGIN[1] = by + (su * uy + sv * vy) * k; CAP_ORIGIN[2] = bz + (su * uz + sv * vz) * k;
        const hit = this.raycastHit(CAP_ORIGIN, dir, Math.min(reach, best), filter, CAP_HIT);   // HCC: the same bucket filter the rays take (a horse stepping past its own parked wagon)
        if (hit.dist < best) { best = hit.dist; bestKey = hit.key; }
      }
    }
    return { dist: Number.isFinite(best) ? Math.max(0, best - radius) : Infinity, key: bestKey };
  }

  /**
   * A6 - `Physics.SphereCast`, the contract PlayerMoveScanner is
   * written against (FindStep :164, FindHeadHit :174). A sphere cast
   * IS a capsule cast whose axis has zero length, so this is
   * capsuleCast with p1 == p2 and one axis sample - the same ray
   * bundle, the same documented approximation, and the same
   * Unity-faithful `dist`: how far the sphere's CENTRE travels before
   * the leading cap touches, Infinity on a clear sweep.
   *
   * `key` is the bucket that produced the hit, which is what the
   * scanner's static-geometry and action lookups ask of it.
   */
  sphereCast(origin, radius, dir, maxDist, filter = null) {
    return this.capsuleCast(origin, origin, radius, dir, maxDist, 1, filter);
  }

  _resolveSphere(center, radius, out, standCeil = Infinity, oneWayFloor = false, midBody = false, skip = null) {
    // Push a sphere out of every nearby triangle; returns strongest
    // ground-ness and whether any ceiling-ish contact happened.
    // AUDIT DECOR-SHELL 1: `skip`, a Set of bucket keys the sphere
    // passes through - the ray's own filter, for the decorator's flying
    // eye (scenes/decorTool.js flyClip), which looks through a piece
    // being moved. Null (every body) is the resolve exactly as it was.
    // SH1 (2026-09-12, Mac: "you can immediately walk over things (like
    // interior tables, tree trunks, etc)"): `standCeil` is the highest
    // world y a contact may sit at and still be GROUND - the entry feet
    // plus stepOffset, the step-up ladder's own law. A contact above it
    // whose normal leans up (a tabletop's edge, a trunk's root flare, a
    // wall's top) is a WALL here: it pushes the sphere out SIDEWAYS by
    // its whole penetration and never grounds it, so the ladder cannot
    // be lifted onto it and the edge cannot ratchet the capsule up a
    // slice a frame. Infinity (every caller but the ladder) is the
    // resolve exactly as it was.
    let grounded = false;
    let ceiling = false;
    let pushedDown = false;
    let groundKey = null;
    let groundY = -Infinity;
    // PERF-COL1 (2026-09-21, SquidKam: "Guards kill the framerate"): THE
    // BROAD PHASE THE RAY HAD AND THE SPHERE DID NOT. This walked EVERY
    // bucket for EVERY sample - nine string keys, nine Map lookups and a
    // fresh Set per bucket - whether or not the bucket was anywhere near
    // the sphere. The streaming world holds a bucket per streamed pixel
    // plus the gates and the mills, the standalone town one per block,
    // and a capsule resolve is ~9 samples, a step up to ~5 resolves, so
    // five watchmen chasing a player through a town paid it ~90 times a
    // frame: measured at 5.5 ms a frame median, 20 ms at p90, 85% of it
    // here (tools/guardCostProbe.mjs, 144 buckets). The sphere's own box
    // against the bucket's bounds - kept by addMesh since AUDIT NAME1 F2
    // for the ray's broad phase - skips every bucket that cannot hold a
    // contact, and the narrow phase below is untouched: same triangles,
    // same pushes, same answers. The visited set is the module's one
    // scratch. (The local point stays LIVE below, per triangle - the
    // note there says why; the box is asked with the centre as it stands
    // when the bucket's turn comes, which sphereTouchesBox's note shows
    // is exact.)
    // FB0930-FRAME: the buckets the sphere's box reaches from where it was gathered (grown by BROAD_PAD), in the walk's
    // order - gathered again, after the last bucket walked, whenever the pushes carry the centre past the pad
    const reach = radius + SKIN, g = reach + BROAD_PAD + 2 * BOX_SKIN;
    let gx = center[0], gz = center[2], walkedOrd = -1;
    let near = this._near(gx - g, gx + g, gz - g, gz + g, SPHERE_NEAR);
    for (let bi = 0; ; bi++) {
      // asked BEFORE the list's end: the last candidate's pushes may carry the centre to buckets the list never held
      if (Math.abs(center[0] - gx) > BROAD_PAD || Math.abs(center[2] - gz) > BROAD_PAD) {
        gx = center[0]; gz = center[2];
        near = this._near(gx - g, gx + g, gz - g, gz + g, SPHERE_NEAR, walkedOrd);
        bi = -1;
        continue;
      }
      if (bi >= near.length) break;
      const bucket = near[bi], bkey = bucket.key;
      walkedOrd = bucket.ord;
      if (skip?.has(bkey)) continue;   // AUDIT DECOR-SHELL 1
      const t = bucket.t();
      // AUDIT NAV1 (the frame's cost, #12): a mover's bucket - the centre turned back into its frame for the box, the
      // cells and each triangle's nearest point, and the contact's direction turned out again: every law below (the
      // ground's slope, the wall above, the one-way floor, the push) reads the world's up, as it stands
      const R = bucket.r ? bucket.r() : null;
      if (R) intoBucket(center[0], center[1], center[2], t, R, LOCAL);
      const bx = R ? LOCAL[0] : center[0] - t[0], by = R ? LOCAL[1] : center[1] - t[1], bz = R ? LOCAL[2] : center[2] - t[2];   // the centre in the bucket, as it stands at the bucket's turn
      if (!sphereTouchesBox(bx, by, bz, radius + SKIN, bucket.min, bucket.max)) continue;
      const marks = rayMarks(bucket), stamp = RAY_STAMP;   // FB0930-FRAME: the walk's stamp, not a Set
      const yLoOf = bucket.yLo, yHiOf = bucket.yHi, yReach = reach + SPHERE_Y_SLACK;
      for (const cell of nearCells(bucket, bx, by, bz, radius + SKIN)) {   // AUDIT BRANCH (WoD) B1: the fine 3x3, then any wide triangles
        for (let ci = 0; ci < cell.length; ci++) {
          const ti = cell[ci];
          if (marks[ti] === stamp) continue;
          marks[ti] = stamp;
          // Live local point: pushes from earlier triangles must be
          // seen by later ones (a stale snapshot compounded pushes).
          let lx = center[0] - t[0];
          let ly = center[1] - t[1];
          let lz = center[2] - t[2];
          if (R) { intoBucket(center[0], center[1], center[2], t, R, LOCAL); lx = LOCAL[0]; ly = LOCAL[1]; lz = LOCAL[2]; }
          if (yHiOf[ti] < ly - yReach || yLoOf[ti] > ly + yReach) continue;   // FB0930-FRAME: out of the contact's reach above or below, at the live point
          const tri = bucket.tris[ti];
          if (!triNear(tri, lx, ly, lz, radius + SKIN)) continue;   // OW-WOD-LAG: the contact's own reach (contactR, below), the live point
          closestPointOnTriangle(lx, ly, lz, tri[0], tri[1], tri[2], TMP);
          let dx = lx - TMP[0];
          let dy = ly - TMP[1];
          let dz = lz - TMP[2];
          if (R) { const wx = R[0] * dx + R[3] * dy + R[6] * dz, wy = R[1] * dx + R[4] * dy + R[7] * dz, wz = R[2] * dx + R[5] * dy + R[8] * dz; dx = wx; dy = wy; dz = wz; }
          const d2 = dx * dx + dy * dy + dz * dz;
          // Ground/contact is detected out to radius + SKIN, but the
          // sphere is only PUSHED OUT to the true radius. A floor at
          // exactly d == radius (feet placed dead on the surface by
          // floorLanding, then velY clamped to 0 so dy == 0 at rest)
          // sat on the knife-edge of the old `d2 >= radius*radius`
          // reject and FLICKERED grounded off frame-to-frame - Mac's
          // F8 caught g:0 while standing perfectly still. The skin
          // makes a resting contact stable without sinking the body.
          const contactR = radius + SKIN;
          if (d2 >= contactR * contactR || d2 === 0) continue;
          const d = Math.sqrt(d2);
          // SH1: the contact point's world y is center - dy (dy is
          // center minus closest); above the stand ceiling with an
          // upward-leaning normal it is a wall, not a tread.
          // AUDIT COL1 F8: A MID-BODY CONTACT IS A WALL - IN THE CODE,
          // NOT ONLY IN THE COMMENT. COL1 gave the middle spheres "the
          // plain push, because a contact at mid-body is something you
          // walked into, never a floor you stand on" - but the plain
          // push is along centre-minus-closest, and out of a TABLE TOP
          // that direction is straight UP. _resolveCapsule copies the
          // middle's y back into the whole capsule, so the body was
          // LIFTED onto the thing it walked into. Measured on the ride
          // stance (h 2.6, the widest band of middles): before COL1 a
          // 0.70-1.30 top was walked through and only <=0.69 could be
          // mounted; with the middles added, tops to 0.85 were mounted
          // by a 0.65 m single-frame rise - past STEP_OFFSET, with
          // `grounded` true the whole way. That is SH1's bug wearing
          // COL1's clothes. The law is enforced where the push is
          // chosen: an upward-leaning face met by a MIDDLE sphere
          // pushes SIDEWAYS by its whole penetration and never grounds
          // - the same branch SH1 wrote for the step ladder's tabletop
          // edges. Legal ground is out of the middles' reach by
          // construction: past the lower sphere's own resolve a slope
          // at the slope limit clears a middle centre by 0.59 > radius,
          // so this fires only on geometry the body is truly inside.
          const wallAbove = (dy > 0 && center[1] - dy > standCeil)
            || (midBody && dy > 0 && dy / d >= GROUND_NY);
          // PH1 (2026-09-14, Mac: "it's possible to randomly walk into
          // the floor in dungeons and get stuck in the ground"): A FLOOR
          // IS ONE-WAY FOR THE LOWER SPHERE. The push-out is along
          // centre-minus-closest, so once the lower sphere's centre had
          // crossed a floor's plane (a mover's mesh advancing past it in
          // one slow frame, the ceiling clamp's sink band, a thin slab's
          // cancelling pushes) the floor pushed it DOWN, and kept pushing
          // until the head sphere caught the same floor from beneath:
          // measured, feet 0.36 below a floor become feet 1.10 below it,
          // "grounded", forever - the dungeon has no heightAt floor to
          // catch it and nothing called findClearFloor. Unity's sweep
          // never crosses a plane, so it never meets this; the port's
          // resolve can, so the law is written where the sign flips: a
          // contact just ABOVE the lower sphere's centre, within its
          // radius and within the slope limit of straight down, on a
          // FLOOR-SLOPED face (AUDIT DISC28 MO-1 below), is a floor the
          // body is under, and the sphere is set ON it. Nothing legal
          // stands there - a surface 0.35-0.7 above the feet is inside
          // the crouched capsule too. The head sphere keeps the plain
          // push: a ceiling is a ceiling.
          // DISC28-G (Discord: in Veraten "the swimming physics persisted after leaving the water ... rose way up and
          // then fell into the void"): THE LAW IS ABOUT A BODY STRADDLING A FLOOR, and a RISING body whose head is still
          // under the surface straddles nothing - it is pressing into a ceiling. The rising vertical pass hands the
          // body's axis (`oneWayFloor` a number): the surface is a floor only below the head's centre (WW-LID: so does
          // the sideways pass - a water walker's stride put its lower sphere under a lintel over its head's centre, and
          // PH1 set the body on it). The crouched
          // swimmer's axis is 0.2 against a 0.2625 step, so a stroke up into a ceiling brought the lower sphere within
          // its radius of the face while the head was still beneath it, and this arm set the whole body ON the
          // ceiling's top - out of the level, under the block's water plane, where it swam on up and fell. PH1's own
          // cases (a floor the lower sphere sank under, the head above it) are every standing body and unchanged.
          // AUDIT DISC28 MO-1 (the pre-merge audit, 2026-09-28 - the same report by another road): A WALL IS NEVER A
          // FLOOR. The test reads the CONTACT's direction (centre minus the closest point, within the slope limit of
          // straight down), and the closest point of a wall is not always on its face: a wall quad is two triangles,
          // and a sphere pressed into it just under the DIAGONAL between them is nearest the upper triangle's edge,
          // above the centre, in a direction that reads as a floor. The lower sphere was set ON that edge (lifted
          // ~0.4) and, under a ceiling, the ceiling's own face was then in reach straight above and set the body on
          // the ceiling's top. Measured through the real motor: a swimmer holding Space along a wall went out of the
          // level at 2-4% of the points it pressed, stroke or none, at 60, 30 and 20 fps, before DISC28-G and after
          // it alike (the horizontal pass is never a rising one); a crouched walker in a 0.95-1.0 crawlspace did the
          // same in 28 walks of 192; a runner sliding along a wall was thrown half a metre up. Unity's
          // CharacterController stands only on what its slopeLimit calls walkable, judged by the TOUCHED TRIANGLE's
          // own normal (PhysX's CctCharacterController testSlope) - so the face's own plane must be floor-sloped too,
          // |n.y| >= cos(slopeLimit), facing-blind as every test here is. A floor's edge is still its floor's; a
          // wall's edge is the wall's, and meets the plain push below.
          const floorAbove = oneWayFloor !== false && d < radius && !wallAbove && dy / d <= -GROUND_NY
            && (oneWayFloor === true || (R ? center[1] - dy : t[1] + (ly - dy)) < center[1] + oneWayFloor)
            && (R ? faceNyTurned(tri, R) : faceNy(tri)) >= GROUND_NY;
          if (floorAbove) {
            const dh2 = dx * dx + dz * dz;
            const cy = R ? center[1] - dy : t[1] + (ly - dy);   // the closest point's world y (a mover's: the centre less the contact's turned-out y)
            center[1] = cy + Math.sqrt(Math.max(0, radius * radius - dh2));   // the sphere ON the surface
            grounded = true;
            if (cy > groundY) groundY = cy;
            if (groundKey == null || bkey !== 'dungeon') groundKey = bkey;
            continue;
          }
          if (d < radius) {
            if (wallAbove) {
              const dh = Math.sqrt(dx * dx + dz * dz);
              if (dh > 1e-6) {
                const pushH = (radius - d) / dh;   // the whole penetration, sideways
                center[0] += dx * pushH;
                center[2] += dz * pushH;
              } else {
                const push = (radius - d) / d;   // dead under a face: the plain push is the only way out
                center[1] += dy * push;
              }
            } else {
              const push = (radius - d) / d;   // only push out of true penetration
              center[0] += dx * push;
              center[1] += dy * push;
              center[2] += dz * push;
            }
          }
          const ny = dy / d;
          // GROUNDING may extend into the SKIN shell (radius..radius+SKIN)
          // so a resting floor a hair away still holds the player up -
          // that was the g:0 fix. But CEILING and PUSHED-DOWN are
          // movement-gate flags (the step-up and ground-snap reject a
          // retry/probe when pushedDown is set): a NON-TOUCHING triangle
          // in the shell must NOT raise them, or it phantom-blocks the
          // step-up on stairs and the player walks into the riser and
          // drops through. So ceiling/pushedDown fire ONLY on real
          // contact (d < radius), never from the shell. (Regression
          // from the g:0 SKIN change - Mac's stairs fell through.)
          const touching = d < radius;
          if (ny >= GROUND_NY && !wallAbove) {
            grounded = true;
            const cy = center[1] - dy;   // the contact's world y
            if (cy > groundY) groundY = cy;
            // Platform riding (Ledger C row, 2026-08-14): the KEY of
            // the grounding bucket - a non-static bucket (mover)
            // wins over the static floor within the skin shell.
            if (groundKey == null || bkey !== 'dungeon') groundKey = bkey;
          }
          if (touching && ny <= -0.5) ceiling = true;
          if (touching && ny <= -GROUND_NY) pushedDown = true;
        }
      }
    }
    out.grounded = out.grounded || grounded;
    out.hitCeiling = out.hitCeiling || ceiling;
    out.pushedDown = out.pushedDown || pushedDown;
    if (grounded) out.groundY = Math.max(out.groundY ?? -Infinity, groundY);
    if (groundKey != null && (out.groundKey == null || groundKey !== 'dungeon')) out.groundKey = groundKey;
  }

  _resolveCapsule(feet, out, height = CAPSULE_HEIGHT, standCeil = Infinity, straddle = false) {
    // Two spheres: lower centered radius above the feet, upper below
    // the top. height varies with the player's stance (P12 crouch:
    // the PlayerHeightChanger controller heights) - passed per call
    // because foes share this collider instance.
    // A6: the AXIS can be zero but never negative. Unity clamps a
    // CharacterController whose height falls below 2 * radius to a
    // SPHERE of that radius, and PlayerHeightChanger has one stance
    // that reaches there - controllerSwimHeight 0.30 against radius
    // 0.35 (:57). Left signed, the "upper" sphere sank 0.40 BELOW the
    // lower one and the sunk swimmer probed the world under his own
    // feet. Every other stance (crouch 0.9, stand 1.8, ride 2.6) is
    // clear of the clamp and is unaffected to the bit.
    const entryY = feet[1];
    const axis = Math.max(0, height - 2 * CAPSULE_RADIUS);
    const low = [feet[0], feet[1] + CAPSULE_RADIUS, feet[2]];
    const high = [feet[0], feet[1] + CAPSULE_RADIUS + axis, feet[2]];
    // COL1 (2026-09-15, Mac: "3d Geometry has no collison. For example,
    // in the first dungeon the table legs do have collison but the table
    // top doesnt"): THE BODY WAS SAMPLED AT TWO POINTS AND HAD A HOLE.
    //
    // A capsule is a sphere SWEPT along a segment; this resolves it as
    // two spheres at the segment's ends, which is only the same shape
    // while those two cover the segment. Standing, they do not: centres
    // sit at feet+0.35 and feet+1.45 with radius 0.35, so the lower
    // reaches feet+0.70 and the upper starts at feet+1.10 and the band
    // BETWEEN THEM IS SAMPLED BY NEITHER. That band is 0.40 tall and it
    // is at exactly waist height, which is where a table top is - hence
    // the report, and hence the legs stopping you while the top did not.
    // The triangles were always in the index (sphereOverlaps finds them
    // at y=0.90); nothing ever asked there. The ride stance is worse:
    // axis 1.9 leaves a 1.2-tall hole.
    //
    // So the sphere COUNT is derived from the axis rather than fixed at
    // two: consecutive centres are never more than one diameter apart,
    // which is the condition for the chain to cover the segment. The
    // ends keep their existing laws exactly - the lower sphere's
    // one-way floor (PH1), the head's plain push - and a contact at
    // mid-body is something you walked into, never a floor you stand
    // on, which AUDIT COL1 F8 below turns from a comment into a branch.
    //
    // AUDIT COL1 F9: THE PRICE, MEASURED. The original note said "one
    // more sphere resolve per iteration at standing height (three
    // instead of two)" and stopped there, which reads as the whole
    // cost and is not. Benchmarked over a cluttered dungeon room,
    // _resolveCapsule itself: standing 20.2 -> 30.7 us (1.5x, the
    // three-for-two), and the RIDE stance 20.4 -> 41.0 us (2.0x -
    // FOUR spheres for two, which the note never mentioned). On top of
    // that a blocked body runs the step ladder's retries where it used
    // to walk through, so calls per move() rise as well - the walked-
    // through path was cheap because it was wrong. CELL=2 leaves the
    // headroom, and the spheres' scratch is reused rather than rebuilt
    // per call (this runs several times a frame per body).
    // AUDIT COL1 F12: THE BEADS MUST OVERLAP, NOT TOUCH. COL1's span was
    // exactly a diameter, which is TANGENCY: at the join between two
    // beads the chain's reach falls to zero, and short of that it is
    // thin - measured 43% of the radius on the ride stance and 26% on a
    // 3.4 m body. Driven: a 3.4 m foe (sprite heights that tall are
    // ordinary - SetupDemoEnemy's height comes off the idle frame) walked
    // clean through a slab anywhere in 2.70-2.93, the last through-band
    // left after COL1 and F8. A 5% overlap gives every join a real bite,
    // closes that band, and costs ONE extra sphere only past ~3.2 m of
    // body: the player's four stances (0.30/0.9/1.8/2.6) keep the sphere
    // counts they had to the bead.
    const span = 2 * CAPSULE_RADIUS * BEAD_OVERLAP;
    const middles = Math.max(0, Math.ceil(axis / span) - 1);
    while (MID_SCRATCH.length < middles) MID_SCRATCH.push([0, 0, 0]);
    const mid = MID_SCRATCH;
    // SQUEEZE1 (2026-09-26, Ashley on the Discord: a quest giant "disappearing after a basically random amount of time
    // entering the dungeon"): A BODY TALLER THAN ITS ROOM STAYS ON ITS FLOOR. The head's plain push below is the last
    // word of every pass, so a body taller than the gap between a floor and a ceiling - a giant's 3.4 m capsule stood
    // at a marker under a 3 m ceiling - was pushed down by its head each pass and dragged its lower sphere after it,
    // under the floor, and fell out of the level. A doorway's lintel stops such a body (a wall, pushed sideways),
    // which is DFU's CharacterController; only a body already under the low ceiling sank, and Unity's controller
    // never depenetrates through a floor. So a body taller than any stance the player takes (RIDE_HEIGHT) keeps the
    // floor its lower sphere was set on when its head is held down: the head stays in the ceiling, and the body
    // stands, stuck, where it was. The player's four stances never reach this arm - their resolve is as it was.
    // AUDIT (the pre-merge audit, S2): and EVERY foe, by its motor's word (move's `keepFloor`) - the height line kept
    // the player's stances out, and every foe from 1.6 m to RIDE_HEIGHT out with them: a 2.4 m body under a 2.0 m
    // ceiling still sank and fell out of the level
    const tall = height > RIDE_HEIGHT || !!this._keepFloor;
    // DISC28-G: the lower sphere's floor is one-way (PH1) - and, in the rising pass (and since WW-LID the sideways
    // one), only for a surface the body straddles: under the head's centre
    const lowOneWay = straddle ? axis : true;
    let lowFloor = -Infinity;
    for (let iter = 0; iter < 3; iter++) {
      const sx = low[0], sy = low[1], sz = low[2];   // PERF-CLIMB: where the pass began
      if (tall) {
        const lo = LOW_OUT;
        lo.grounded = false; lo.hitCeiling = false; lo.pushedDown = false; lo.groundKey = null; lo.groundY = undefined;
        this._resolveSphere(low, CAPSULE_RADIUS, lo, standCeil, lowOneWay);
        if (lo.grounded) lowFloor = low[1];
        out.grounded = out.grounded || lo.grounded;
        out.hitCeiling = out.hitCeiling || lo.hitCeiling;
        out.pushedDown = out.pushedDown || lo.pushedDown;
        if (lo.grounded) out.groundY = Math.max(out.groundY ?? -Infinity, lo.groundY);
        if (lo.groundKey != null && (out.groundKey == null || lo.groundKey !== 'dungeon')) out.groundKey = lo.groundKey;
      } else this._resolveSphere(low, CAPSULE_RADIUS, out, standCeil, lowOneWay);   // PH1: the lower sphere's floor is one-way
      for (let i = 0; i < middles; i++) {
        const m2 = mid[i];
        m2[0] = low[0];
        m2[2] = low[2];
        m2[1] = low[1] + (axis * (i + 1)) / (middles + 1);
        this._resolveSphere(m2, CAPSULE_RADIUS, out, standCeil, false, true);   // COL1: a mid-body contact is a wall, never a floor (AUDIT COL1 F8: enforced, not narrated)
        low[0] = m2[0];
        low[2] = m2[2];
        low[1] = m2[1] - (axis * (i + 1)) / (middles + 1);
      }
      high[0] = low[0];
      high[2] = low[2];
      high[1] = low[1] + axis;
      // The head sphere keeps the plain push (a ceiling is a ceiling; a
      // head above a thin plane is pushed off it, never set on it - the
      // CanStand sweep's 1.2 ceiling stands on that). The swim stance's
      // zero axis makes the two spheres one, and that one is the lower.
      // AUDIT (the pre-merge audit, S1): a floor-keeping body's head never GROUNDS - held on its floor, a head whose
      // centre rose past a low ceiling's plane stood on the ceiling's top face (the collider reads no face's facing), and
      // the report's own giant walked off a ledge and on through the air under a flat ceiling. A wall to it, as a
      // mid-body contact is (COL1).
      // AUDIT CLIMB-FIELD W2 (Mac: "hitting the top of an angled roof at a certain angle can get your character stuck"):
      // and the PLAYER's head never grounds either. A contact under the head sphere's centre is the capsule's cylinder -
      // never its foot - and COL1 F8's law for the middles is the head's too: an eave's knife edge at the chest, met by
      // a jump or a fall beside it, sits in the chain's waist between the middle and the head, and the head's half of it
      // leaned up past the slope limit - the body stood on its head on the edge, grounded in mid-air, and each jump off
      // it landed back on it (measured: an eave 1.6 m up, a body held at 0.43 by its head, Jump held hopping forever).
      // The swim stance's one sphere is the lower's, and keeps its floor.
      this._resolveSphere(high, CAPSULE_RADIUS, out, standCeil, axis === 0 ? lowOneWay : false, axis !== 0);
      low[0] = high[0];
      low[2] = high[2];
      low[1] = high[1] - axis;
      // PERF-CLIMB (the Enhanced Climbing arc's dense-mesh limit, bible/03-World/Parkour-Arc.md): A PASS THAT MOVED
      // NOTHING IS THE LAST. Its centres are all derived from `low` (the middles and the head off it), and nothing else
      // it reads changes between passes - so a pass that ends where it began, to the bit, would be run again exactly,
      // pushing nothing and ORing the same flags into `out`. Stopping there is the same answer, cheaper: a body in the
      // open (every fit the climb's proofs ask, every step of a walk in the clear) paid three passes for one, and a body
      // against a wall two for... the pass that pushed and the one that found it out. A pass the rounding of the
      // low-head-low round trip moved by a bit is not "nothing", and goes on as it always did.
      if (FIXED_POINT_STOP && low[0] === sx && low[1] === sy && low[2] === sz) break;
    }
    feet[0] = low[0];
    feet[1] = low[1] - CAPSULE_RADIUS;
    // SQUEEZE1: the floor wins - neither the head's push nor the too-tight revert below takes a tall body under it
    const floorFeet = tall && out.hitCeiling ? lowFloor - CAPSULE_RADIUS : -Infinity;
    if (feet[1] < floorFeet) feet[1] = floorFeet;
    feet[2] = low[2];
    // A body cannot be depenetrated UP into a ceiling: when the FINAL
    // position still has real head penetration the iterations could
    // not separate, net rise is clamped to entry (P14 stairs audit -
    // slope-legal riser-edge pushes crept a grounded stand 0.7 INSIDE
    // the plane). The clamp fires ONLY on residual penetration - the
    // 08-17 live wedge: clamping on ANY transient ceiling touch
    // reverted the floor's own legitimate push-out every frame and
    // EMBEDDED the capsule in stair treads under low-but-legal
    // stairwell ceilings (and killed every jump from the squeezed
    // stand at one frame).
    // AUDIT COL1 F13: the probe walks the WHOLE chain. It asked the head
    // sphere only, which was every sphere above the feet when the body
    // was two beads; with middles it is one of several, and a body
    // wedged UNDER a low slab at waist height answered "the head is
    // clear" and kept a rise it could not hold. The beads are re-probed
    // at the same centres the loop used, and any one of them still being
    // driven down is the too-tight answer the clamp exists for.
    if (out.hitCeiling && feet[1] > entryY) {
      const probeOut = { grounded: false, hitCeiling: false, pushedDown: false };
      // from the first MIDDLE up to the head - the lower sphere owns the
      // floor, and a floor pushing it up is not what a ceiling clamps
      for (let i = 1; i <= middles + 1; i++) {
        const y = feet[1] + CAPSULE_RADIUS + (axis * i) / (middles + 1);   // A6: the clamped axis, the same centres the loop used
        const probe = [feet[0], y, feet[2]];
        this._resolveSphere(probe, CAPSULE_RADIUS, probeOut);
        if (probe[1] < y - 1e-4) { feet[1] = Math.max(entryY, floorFeet); break; }   // still being pushed DOWN out of a ceiling -> too tight, revert (SQUEEZE1: never under a tall body's floor)
      }
    }
    // WW-LID (FIELD BUGS 2026-09-29d, Cruor on Discord: "Water walking is still evil ... I fell out the map again"): A
    // RESOLVE NEVER CARRIES THE HEAD UP THROUGH A FACE. The clamp above answers a head a ceiling still pushes DOWN; a
    // lift that took the head clean THROUGH one - the lower sphere's one-way floor set the body on a doorway's lintel,
    // and the head sphere, its centre now over the room's ceiling, was pushed out on top of it - left nothing in, and
    // kept its rise. Unity's CharacterController sweeps and never crosses a plane. So when a resolve has raised the
    // body, the path its head's centre rose along is asked, and a face across it refuses the rise, as the clamp above
    // does. The ray starts a skin under the centre: rayTriangle takes no hit nearer than 1e-4, and a head whose centre
    // stood ON a ceiling's plane was lifted through it unasked. A refused rise says so (`out.refused`) - the sideways
    // pass and the step ladder's rung read it (_moveStep).
    if (feet[1] - entryY > SKIN && Number.isFinite(this.raycast([feet[0], entryY + CAPSULE_RADIUS + axis - SKIN, feet[2]], UP, feet[1] - entryY + SKIN))) {
      out.refused = true;
      feet[1] = Math.max(entryY, floorFeet);
    }
  }

  /**
   * Move the capsule (feet position, mutated) by the delta with slide,
   * step-up, ground snap, and the heightAt floor. Large deltas substep
   * so no component ever exceeds a fraction of the radius - a sphere
   * displaced past a surface in one step never contacts it (tunneling;
   * surfaced by starved-frame dt spikes in the headless harness).
   * @returns {{grounded:boolean, hitCeiling:boolean}}
   */
  /** AUDIT (the pre-merge audit, S2): `keepFloor` - a FOE's move (enemyMotor passes it): a body held down by a ceiling
   *  keeps the floor its lower sphere was set on (SQUEEZE1), whatever its height. The player's stances never pass it.
   *  AUDIT CLIMB2 G1: `noStep` - a climber's move (motor.js _freeClimbStep): the hug's press into the wall is always
   *  stopped, which the step ladder reads as a walk into a stair - a climb across under an eave was lifted 0.375 m in
   *  one step, into the eave and the wall. A body on a wall climbs; it never steps. */
  move(feet, dx, dy, dz, height = CAPSULE_HEIGHT, snap = true, keepFloor = false, noStep = false) {
    const was = this._keepFloor, stepped = this._noStep;
    this._keepFloor = !!keepFloor;
    this._noStep = !!noStep;
    try { return this._move(feet, dx, dy, dz, height, snap); } finally { this._keepFloor = was; this._noStep = stepped; }
  }
  _move(feet, dx, dy, dz, height = CAPSULE_HEIGHT, snap = true) {
    const maxComp = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const maxStep = SUBSTEP_LEN;
    if (maxComp > maxStep) {
      // AUDIT ONCRASH1 B5a: THE SUBSTEP COUNT HAS A CEILING, and until now every bound on it lived in a caller.
      // AUDIT WORLD3 F2 hit this exact loop - an unnormalised direction off the wire asked for 2.4e8 substeps and
      // froze the tab for every player in the room - and fixed it by unit-normalising `d` at the ONE call site that
      // had caused it. That is a band-aid: the next caller with bad arithmetic freezes the tab again, and nothing
      // here says no. Past the cap the remainder is taken as a single step, which is what a teleport is: the sweep
      // stops being exact for a motion no frame can produce anyway, and no number can buy an unbounded loop.
      const n = Math.min(SUBSTEPS_MAX, Math.ceil(maxComp / maxStep));
      const out = { grounded: false, hitCeiling: false, pushedDown: false, groundKey: null };
      for (let i = 0; i < n; i++) {
        const r = this._moveStep(feet, dx / n, dy / n, dz / n, height, snap);
        out.grounded = r.grounded;
        out.groundKey = r.groundKey ?? null;
        out.hitCeiling = out.hitCeiling || r.hitCeiling;
      }
      return out;
    }
    return this._moveStep(feet, dx, dy, dz, height, snap);
  }

  /**
   * Is a capsule at these feet penetrating geometry? Runs the resolve
   * on a COPY and reports how far it got pushed - a large push means
   * the position is inside/against a wall (wedged).
   */
  penetrationAt(feet, height = CAPSULE_HEIGHT) {
    const probe = [feet[0], feet[1], feet[2]];
    const out = { grounded: false, hitCeiling: false, pushedDown: false };
    this._resolveCapsule(probe, out, height);
    return Math.hypot(probe[0] - feet[0], probe[1] - feet[1], probe[2] - feet[2]);
  }

  /**
   * Unstick: from feet, step UP until the capsule is in clear space
   * (penetration below a threshold) AND there is floor within a short
   * drop below. Returns clear feet, or the original if nothing found.
   * This is the escape hatch for a spawn that lands inside geometry.
   */
  findClearFloor(feet, maxUp = 6, step = 0.25) {
    for (let up = 0; up <= maxUp; up += step) {
      const test = [feet[0], feet[1] + up, feet[2]];
      if (this.penetrationAt(test) < 0.03) {
        // clear here - now drop to the floor beneath this clear point
        const d = this.raycast([test[0], test[1] + 0.2, test[2]], [0, -1, 0], up + 2);
        if (Number.isFinite(d)) return [test[0], test[1] + 0.2 - d, test[2]];
        return test;
      }
    }
    return feet;
  }

  _moveStep(feet, dx, dy, dz, height = CAPSULE_HEIGHT, snap = true) {
    // Unity CharacterController semantics (the P14 stairs/jump audit,
    // re-deriving the reverted b9e9aa6 on the crouch-height tree;
    // numeric traces in motorStairs.test.js):
    //   1. The step LIFT is capped by head clearance, never a blind
    //      +stepOffset - the old full lift needed 2.3 of headroom, so
    //      every dungeon stairwell under 2.3 blocked or jammed (the
    //      live "can't walk up stairs").
    //   2. Grounded/ceiling flags come from the FINAL vertical state
    //      only - the old OR-accumulation across phases grounded a
    //      RISING capsule off its pre-jump horizontal resolve, and
    //      the motor's velY clamp then killed every jump at one frame
    //      (apex 0.069 = one tick of 4.5/60 - the live "can't jump").
    const out = { grounded: false, hitCeiling: false, pushedDown: false };

    // Horizontal (phase-local flags; only the block test reads them).
    const beforeX = feet[0];
    const beforeZ = feet[2];
    // SH1: the entry feet and the ladder's stand ceiling - a step is a
    // surface at most stepOffset ABOVE THE FEET (CharacterController's
    // own law), never "whatever height the raised capsule resolves to".
    const entryY = feet[1];
    const standCeil = entryY + STEP_OFFSET;
    feet[0] += dx;
    feet[2] += dz;
    const hOut = { grounded: false, hitCeiling: false, pushedDown: false };
    this._resolveCapsule(feet, hOut, height, Infinity, true);   // WW-LID: a body moving sideways straddles a floor only below its head's centre
    // WW-LID: and a sideways pass the resolve refused is not taken - the refusal reverts to the resolve's entry, which is
    // the move itself, so a body with a rib through its waist and no room over it passed clean through the rib. A
    // controller walking into it is stopped by it; the step ladder below then asks whether it is a step.
    if (hOut.refused) { feet[0] = beforeX; feet[2] = beforeZ; }
    const movedSq = (feet[0] - beforeX) ** 2 + (feet[2] - beforeZ) ** 2;
    const wantedSq = dx * dx + dz * dz;

    // Step-up: only while not rising (Unity steps a grounded/falling
    // controller). The ASCENDING lift ladder takes the SMALLEST clear
    // rung up to stepOffset - a low ceiling shrinks the step instead
    // of jamming the head or rejecting the stair outright; the raised
    // height is kept this frame and the snap below settles it onto
    // the tread as forward progress clears the edge.
    if (!this._noStep && dy <= 0 && wantedSq > 1e-8 && movedSq < wantedSq * 0.25) {
      // Each rung's raised start is RESOLVED, and a low ceiling CAPS
      // the rung to its resolved height instead of refusing the stair
      // (the 08-17 live jam: legal 2.0-headroom stairwells - a
      // following ceiling above every tread - blocked at tread 1
      // because the old sweep broke on ANY raised-start ceiling
      // touch; Unity raises as far as the ceiling allows and slides
      // under). The ladder stays MONOTONE in RESOLVED height - a rung
      // that gains nothing over the last ends it - so a thin ceiling
      // plane still cannot be teleported past: every rung is resolved
      // where the plane pushes it back down, never skipped beyond.
      let prevResolvedY = feet[1];
      for (const lift of [0.125, 0.25, 0.375, STEP_OFFSET]) {
        const raisedStart = [beforeX, feet[1] + lift, beforeZ];
        const startOut = { grounded: false, hitCeiling: false, pushedDown: false };
        this._resolveCapsule(raisedStart, startOut, height, standCeil);
        if (raisedStart[1] <= prevResolvedY + 1e-4) break;   // no headroom gained - the ladder tops out
        if (startOut.refused) break;   // WW-LID: a rung the resolve refused (the head has no room there) is no headroom either - it read as the raised height itself
        prevResolvedY = raisedStart[1];
        // Forward from the RESOLVED (possibly ceiling-capped) height,
        // full intent.
        const retry = [beforeX + dx, raisedStart[1], beforeZ + dz];
        const retryOut = { grounded: false, hitCeiling: false, pushedDown: false };
        this._resolveCapsule(retry, retryOut, height, standCeil);
        const retrySq = (retry[0] - beforeX) ** 2 + (retry[2] - beforeZ) ** 2;
        // The raised path must be GENUINELY clear (the same blocked
        // threshold the plain move failed), not merely jitter-better -
        // a wall blocks it at every lift exactly as at 0 (the P9
        // facade-ladder regression pin stands).
        if (retrySq < wantedSq * 0.25 || retryOut.pushedDown) continue;
        // SH1: the resolve may have lifted the raised capsule further
        // still (a top face under the lower sphere) - past the stand
        // ceiling it is not a step.
        if (retry[1] > standCeil + 1e-4) continue;
        // SH1: THE DOWN LEG - Unity's third move (up, forward, DOWN).
        // The old ladder kept the raised height and let the ground snap
        // "settle it onto the tread as forward progress clears the
        // edge" - which is exactly how a table was mounted: the capsule
        // hovered at +stepOffset beside the tabletop's edge, the next
        // frame's ladder lifted it +stepOffset again from the hover,
        // and the edge grounded each slice. So: from the raised,
        // advanced position come down to the first height at which the
        // capsule STANDS - grounded, on a contact no higher than the
        // stand ceiling, with the forward gain kept - and stop there.
        // Nothing to stand on within the rung (the edge of something
        // taller than a step, a wall's top) is not a step: the rung is
        // refused and the plain move's block stands, and the player
        // slides along the table as along any wall.
        let landed = null;
        for (let y = retry[1]; ; y -= STEP_OFFSET / 8) {
          const probeY = Math.max(y, entryY);
          const probe = [retry[0], probeY, retry[2]];
          const probeOut = { grounded: false, hitCeiling: false, pushedDown: false };
          this._resolveCapsule(probe, probeOut, height, standCeil);
          const slidSq = (probe[0] - retry[0]) ** 2 + (probe[2] - retry[2]) ** 2;
          if (probeOut.grounded && !probeOut.pushedDown && slidSq < 1e-8
            && probe[1] <= standCeil + 1e-4 && probe[1] >= entryY - 1e-4) { landed = probe; break; }
          if (probeY <= entryY) break;
        }
        if (!landed) continue;
        feet[0] = landed[0];
        feet[1] = landed[1];
        feet[2] = landed[2];
        break;
      }
    }

    // Vertical - the frame's TRUTH for grounded/ceiling.
    const vx0 = feet[0], vy0 = feet[1], vz0 = feet[2];
    feet[1] += dy;
    this._resolveCapsule(feet, out, height, Infinity, dy > 0);   // DISC28-G: a rising pass meets ceilings, never floors over the head
    // THE DOWN PASS IS COLLIDE-AND-STOP. PhysX's CCT (Unity's
    // CharacterController) sweeps the downward component alone with
    // maxIterDown = 1 (CctCharacterController.cpp moveCharacter, under
    // Unity's ePREVENT_CLIMBING): a descending controller that meets the
    // ground STOPS on it. The penetration resolve above pushes along the
    // contact normal instead, which on a slope or a tread's edge turns
    // the descent into a sideways shove - downhill, back off the step.
    // A walker never shows it (velY is 0 while grounded, so dy is 0);
    // LevitateMotor's over-encumbered sink (a constant Vector3.down while
    // swimming) is the one caller that drives a grounded capsule down
    // every step. So: when the down pass slid, come down only as far as
    // the capsule goes without being pushed (bisected), x/z untouched.
    // AUDIT CLIMB-FIELD W1 (Mac: "hitting the top of an angled roof at a certain angle can get your character stuck"):
    // A STOP IS WHERE THE BODY STANDS. The bisect refuses every descent the resolve pushes, and a body already leaning
    // on a face too steep to stand on (past the slope limit: a 71-degree roof over a wall's top, a wall walk's 76-degree
    // parapet over its floor) is pushed by that face at ANY descent - so it came down nothing, stood on nothing (the
    // flags at rest read the steep face, no ground), and hung there with its fall speed growing, every frame (measured on
    // ARCH3D 633 and 445: motionless at 6.5 m for 25 s, velY past -600). Unity's controller slides off such a face. So
    // the stop is kept only when it stands; otherwise the down pass's own slide (the resolve's answer above) stands.
    if (dy < 0 && out.grounded && ((feet[0] - vx0) ** 2 + (feet[2] - vz0) ** 2) > 1e-12) {
      let lo = 0, hi = -dy;   // lo: a descent known clear; hi: one known to penetrate
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        const probe = [vx0, vy0 - mid, vz0];
        const pOut = { grounded: false, hitCeiling: false, pushedDown: false };
        this._resolveCapsule(probe, pOut, height);
        if ((probe[0] - vx0) ** 2 + (probe[1] - (vy0 - mid)) ** 2 + (probe[2] - vz0) ** 2 < 1e-12) lo = mid; else hi = mid;
      }
      const stop = [vx0, vy0 - lo, vz0];
      const sOut = { grounded: false, hitCeiling: false, pushedDown: false };
      this._resolveCapsule(stop, sOut, height);   // at rest in the skin shell: the flags, no push
      if (sOut.grounded) {
        feet[0] = stop[0]; feet[1] = stop[1]; feet[2] = stop[2];
        out.grounded = true; out.hitCeiling = sOut.hitCeiling; out.pushedDown = sOut.pushedDown;
        out.groundKey = sOut.groundKey; out.groundY = sOut.groundY;
      }
    }

    // Ground snap when moving down: pulls onto steps/slopes. The
    // caller withholds it mid-JUMP (`snap = false`): the probe's
    // STEP_OFFSET reach (0.5) exceeds the discrete jump apex (0.469
    // at 60Hz), so an ungated snap swallowed every jump's entire
    // descent in one frame - rise 200ms, "fall" 33ms, the launch-era
    // snap-down bug. Walking down stairs keeps the snap and is
    // bit-identical either way.
    // PH2 (2026-09-14, Mac: "running up/down stairs makes the screen
    // really jitter"): the snap used to drop the WHOLE capsule
    // STEP_OFFSET and resolve it there - and on a staircase that point
    // is inside the stair's mass, so the resolve ejected the probe up
    // and BACK along the riser (measured: feet z 8.19 -> probe z 9.43)
    // and the gate refused it. Every tread on the way down was an
    // airborne frame: grounded flipped, `falling` rose, the eye filter
    // (MAC1) let go and the head bob re-armed - 24 flips on a 12-tread
    // descent at a walk. So the probe DESCENDS, a quantum at a time
    // (STEP_OFFSET / 8, SH1's down leg), to the first height at which
    // the capsule STANDS - grounded, not pushed down, not slid - and
    // stops there. A tread is met from just above it, never from inside.
    if (snap && dy <= 0 && !out.grounded) {
      for (let y = feet[1] - STEP_OFFSET / 8; y >= feet[1] - STEP_OFFSET - 1e-9; y -= STEP_OFFSET / 8) {
        const probe = [feet[0], y, feet[2]];
        const probeOut = { grounded: false, hitCeiling: false, pushedDown: false };
        this._resolveCapsule(probe, probeOut, height);
        const slidSq = (probe[0] - feet[0]) ** 2 + (probe[2] - feet[2]) ** 2;
        // A down-pushed probe tunneled under geometry (a step top's
        // underside) - snapping to it drags the player through the mesh.
        // A probe may SLIDE a hair: a sphere leaving a tread's edge rests
        // on the edge and the resolve eases it down and off it - Unity's
        // Move sliding along the contact - and that arc is the descent.
        // More than a quantum sideways is the old eject (backwards, up
        // the riser) and is refused.
        if (probeOut.grounded && !probeOut.pushedDown && slidSq <= (STEP_OFFSET / 8) ** 2
          && probe[1] > feet[1] - STEP_OFFSET + 1e-4 && probe[1] <= feet[1] + 1e-4) {
          // Grounding reaches into the SKIN shell, so the quantum that
          // first stands may hover a hair above the tread: settle it a
          // skin further, where the resolve places the feet ON the
          // contact (the old whole-drop probe landed exact; so does this).
          const settle = [probe[0], probe[1] - SKIN, probe[2]];
          const settleOut = { grounded: false, hitCeiling: false, pushedDown: false };
          this._resolveCapsule(settle, settleOut, height);
          const settled = settleOut.grounded && !settleOut.pushedDown && settle[1] <= probe[1] + 1e-6
            && (settle[0] - probe[0]) ** 2 + (settle[2] - probe[2]) ** 2 <= (STEP_OFFSET / 8) ** 2;
          const land = settled ? settle : probe;
          feet[0] = land[0]; feet[1] = land[1]; feet[2] = land[2];
          out.grounded = true;
          out.groundKey = (settled ? settleOut : probeOut).groundKey;   // platform riding survives the snap
          break;
        }
      }
    }

    // MAC3 (2026-09-11, Mac: "when moving down hills, the camera
    // hitches badly"): the snap above probes MESHES, and the terrain
    // floor beneath everything was only a floor - a capsule walking
    // down a heightmap slope left it on every step the slope fell
    // faster than a fresh fall, fell for a dozen, landed hard and left
    // again (measured: 20 degrees, 540 of 600 steps airborne, 59
    // landings in ten seconds). DFU glues the controller to a slope
    // with AcrobatMotor's anti-bump (:191-197, ground within 1.10
    // below the centre); this collider's answer to that spike is its
    // own snap (player/motor.js A6), so the floor takes the same
    // STEP_OFFSET reach, under the same jump gate.
    // AUDIT LANDFORMS II I3: ...or as far as the feet's own run this
    // substep falls at the slope limit, the controller's own law. A
    // Travel Options journey's step is the clock's (TO1: FIXED_DT times
    // the scale, a second at x60), swept in SUBSTEP_LEN substeps, and
    // one that missed the 0.5 m reach flew level for the rest of the
    // step and landed as a fall: on the lifted Dragontail's summit
    // roads over 2,000 HP a descent at x20 to x100 (on DFU's ground,
    // 1,792 HP down one Menevia track at x100). An ordinary step's
    // reach is STEP_OFFSET as it was (a Speed-50 horse runs 0.18 m a
    // step: 0.49 m).
    const floor = this.restFloor(feet[0], feet[2]);
    const floorReach = Math.max(STEP_OFFSET, Math.hypot(feet[0] - beforeX, feet[2] - beforeZ) * TAN_SLOPE_LIMIT);
    if (snap && dy <= 0 && !out.grounded && feet[1] > floor && feet[1] - floor <= floorReach) {
      // ...but never against the step-up LADDER above: a capsule lifted
      // in front of a riser is off the floor on purpose, and the floor
      // takes it only where the mesh leaves the capsule alone there.
      const probe = [feet[0], floor, feet[2]];
      const probeOut = { grounded: false, hitCeiling: false, pushedDown: false };
      this._resolveCapsule(probe, probeOut, height);
      if (!probeOut.hitCeiling && Math.abs(probe[0] - feet[0]) < 1e-6 && Math.abs(probe[2] - feet[2]) < 1e-6 && Math.abs(probe[1] - floor) < 1e-6) {
        feet[1] = floor;
        out.grounded = true;
      }
    }
    // Terrain/ground floor beneath everything. CLIMB-DOWN T1: what it holds up is a body under the floor or settling
    // into its skin - never one RISING clear of it, which it took back down whenever the rise was under the skin: a
    // climb at a third of a slow walk (the classic climb below Speed 25, the free climb at low Climbing) never left the
    // terrain, as Unity's controller, which has no such clamp, leaves it.
    if (feet[1] < floor + SKIN && !(dy > 0 && feet[1] >= floor)) {
      if (dy <= 0) out.grounded = true;
      feet[1] = floor;
    }
    return out;
  }
}

const ZERO3 = [0, 0, 0];
/** FIELD BUGS 2026-10-02 ROCK-FREE: `partsHolding`'s line, straight up, and how near two of its crossings are one (a
 *  shared edge, a vertex - the skin crossed once); hullSweepAll's scratch - the parts holding her centre, each part's
 *  first contact, the sweep's answer - and partsHolding's, each part's crossings. */
const UP3 = [0, 1, 0];
const CROSSING_SAME = 1e-4;
const SWEEP_HELD = new Set();
const SWEEP_FIRST = new Map();   // hullSweepAll: each part's first contact, [dist, x, y, z, an overlap's squared distance]
const SWEEP_HIT = [0, 0, 0, 0];   // sweepSphereTriangle's answer: [dist, x, y, z]
const HOLD_CROSSINGS = new Map();

/**
 * FIELD BUGS 2026-10-02 ROCK-FREE: the parts of a static bucket whose solid holds a point of the bucket's own frame, into
 * `out`. WINDING-BLIND, as every query here is (the collider reads no winding): a line straight up from a point crosses
 * a closed solid's skin an odd number of times when the point is in it, its crossings at one height counted once (a line
 * through two faces' shared edge, or a vertex, crosses the skin once). A rock open beneath - a model standing in the
 * ground - holds what is under its crown.
 */
function partsHolding(bucket, lx, ly, lz, out) {
  if (lx < bucket.min[0] || lx > bucket.max[0] || lz < bucket.min[2] || lz > bucket.max[2] || ly > bucket.max[1]) return out;
  const crossings = HOLD_CROSSINGS;
  crossings.clear();
  const cross = (ti) => {
    if (bucket.yHi[ti] < ly) return;
    const tri = bucket.tris[ti];
    const h = rayTriangle(lx, ly, lz, UP3, tri[0], tri[1], tri[2]);
    if (h === null) return;
    const part = bucket.part[ti];
    const list = crossings.get(part);
    if (list) list.push(h); else crossings.set(part, [h]);
  };
  const cell = bucket.grid.get(cellKey(Math.floor(lx / CELL), Math.floor(lz / CELL)));
  if (cell) for (const ti of cell) cross(ti);
  if (bucket.wide.length) for (const ti of wideOnRay(bucket, lx, ly, lz, UP3, bucket.max[1] - ly + 1)) cross(ti);
  for (const [part, hits] of crossings) {
    hits.sort((a, b) => a - b);
    let n = 0, last = -Infinity;
    for (const x of hits) { if (x - last > CROSSING_SAME) n++; last = x; }
    if (n & 1) out.add(part);
  }
  return out;
}

/**
 * FIELD BUGS 2026-10-02b ROCK-FREE's audit: A SPHERE SWEPT AGAINST ONE TRIANGLE, exactly - the sphere of radius `r`
 * from (cx, cy, cz) along the unit (dx, dy, dz) for at most `L`. Its first contact into `out` - [travel, x, y, z], the
 * point on the triangle it touches - true; false if it touches nothing on the way. WINDING-BLIND, as every query here
 * is. An overlap where it starts is travel 0 at the nearest point. Else the face (met before any edge or corner where
 * it is met at all), then the three edges (each the infinite line's quadratic, kept where the contact falls on the
 * segment) and the three corners (each a ray against a sphere about it), the earliest.
 */
export function sweepSphereTriangle(cx, cy, cz, r, dx, dy, dz, L, a, b, c, out) {
  const r2 = r * r;
  closestPointOnTriangle(cx, cy, cz, a, b, c, TMP);
  const qx = cx - TMP[0], qy = cy - TMP[1], qz = cz - TMP[2];
  if (qx * qx + qy * qy + qz * qz <= r2) { out[0] = 0; out[1] = TMP[0]; out[2] = TMP[1]; out[3] = TMP[2]; return true; }
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const n0x = e1y * e2z - e1z * e2y, n0y = e1z * e2x - e1x * e2z, n0z = e1x * e2y - e1y * e2x;
  const nl = Math.hypot(n0x, n0y, n0z);
  if (nl > 1e-12) {
    let nx = n0x / nl, ny = n0y / nl, nz = n0z / nl;
    let s = nx * (cx - a[0]) + ny * (cy - a[1]) + nz * (cz - a[2]);
    if (s < 0) { s = -s; nx = -nx; ny = -ny; nz = -nz; }   // the side she is on
    const nd = nx * dx + ny * dy + nz * dz;
    if (nd < -1e-12 && s >= r) {
      const tp = (s - r) / -nd;
      if (tp <= L) {
        const px = cx + dx * tp - nx * r, py = cy + dy * tp - ny * r, pz = cz + dz * tp - nz * r;
        const tol = -1e-9 * nl;   // inside all three edges, by the triangle's own normal
        if (edgeSide(e1x, e1y, e1z, px - a[0], py - a[1], pz - a[2], n0x, n0y, n0z) >= tol
          && edgeSide(c[0] - b[0], c[1] - b[1], c[2] - b[2], px - b[0], py - b[1], pz - b[2], n0x, n0y, n0z) >= tol
          && edgeSide(a[0] - c[0], a[1] - c[1], a[2] - c[2], px - c[0], py - c[1], pz - c[2], n0x, n0y, n0z) >= tol) {
          out[0] = tp; out[1] = px; out[2] = py; out[3] = pz;
          return true;
        }
      }
    }
  }
  let best = sweepEdge(cx, cy, cz, r2, dx, dy, dz, L, a, b, Infinity, out);
  best = sweepEdge(cx, cy, cz, r2, dx, dy, dz, L, b, c, best, out);
  best = sweepEdge(cx, cy, cz, r2, dx, dy, dz, L, c, a, best, out);
  best = sweepCorner(cx, cy, cz, r2, dx, dy, dz, L, a, best, out);
  best = sweepCorner(cx, cy, cz, r2, dx, dy, dz, L, b, best, out);
  best = sweepCorner(cx, cy, cz, r2, dx, dy, dz, L, c, best, out);
  if (best === Infinity) return false;
  out[0] = best;
  return true;
}
/** sweepSphereTriangle's edge test: (u x v) . n - which side of an edge `u` a point `v` from its start lies. */
const edgeSide = (ux, uy, uz, vx, vy, vz, nx, ny, nz) => (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz;
/** sweepSphereTriangle's edge p..q: the infinite line's quadratic, kept where the contact falls on the segment and
 *  before `best` - its point into `out[1..3]`. The earlier of the two. */
function sweepEdge(cx, cy, cz, r2, dx, dy, dz, L, p, q, best, out) {
  const ex = q[0] - p[0], ey = q[1] - p[1], ez = q[2] - p[2];
  const wx = cx - p[0], wy = cy - p[1], wz = cz - p[2];
  const ee = ex * ex + ey * ey + ez * ez, ed = ex * dx + ey * dy + ez * dz, ew = ex * wx + ey * wy + ez * wz;
  const A = ee - ed * ed;   // |d| = 1
  if (A <= 1e-12 * ee) return best;   // along the edge: its corners answer
  const B = 2 * (ee * (dx * wx + dy * wy + dz * wz) - ed * ew);
  const C = ee * (wx * wx + wy * wy + wz * wz - r2) - ew * ew;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return best;
  const tt = (-B - Math.sqrt(disc)) / (2 * A);
  if (tt < 0 || tt > L || tt >= best) return best;
  const f = (ed * tt + ew) / ee;
  if (f < 0 || f > 1) return best;
  out[1] = p[0] + ex * f; out[2] = p[1] + ey * f; out[3] = p[2] + ez * f;
  return tt;
}
/** sweepSphereTriangle's corner `v`: a ray against a sphere about it. The earlier of it and `best`. */
function sweepCorner(cx, cy, cz, r2, dx, dy, dz, L, v, best, out) {
  const wx = cx - v[0], wy = cy - v[1], wz = cz - v[2];
  const B = 2 * (dx * wx + dy * wy + dz * wz), C = wx * wx + wy * wy + wz * wz - r2;
  const disc = B * B - 4 * C;
  if (disc < 0) return best;
  const tt = (-B - Math.sqrt(disc)) / 2;
  if (tt < 0 || tt > L || tt >= best) return best;
  out[1] = v[0]; out[2] = v[1]; out[3] = v[2];
  return tt;
}
const TMP = [0, 0, 0];
const UP = Object.freeze([0, 1, 0]);   // WW-LID: the head's rise, asked as a ray
/** restFloor's limiter: the smaller of two one-sided grades that agree in sign, else 0. */
const minmod = (a, b) => (a * b <= 0 ? 0 : Math.abs(a) < Math.abs(b) ? a : b);
// AUDIT COL1 F9: the middle spheres' centres, reused. _resolveCapsule
// runs several times per move() per body and is never re-entered, so
// rebuilding this array per call was pure garbage at frame rate.
const MID_SCRATCH = [];
/** SQUEEZE1: the lower sphere's own answer, for a body taller than the player's stances (merged into the pass's as _resolveSphere merges). */
const LOW_OUT = { grounded: false, hitCeiling: false, pushedDown: false, groundKey: null, groundY: undefined };
// AUDIT COL1 F12: the fraction of a DIAMETER that consecutive bead
// centres may be apart. 1 is tangency - a join with no bite at all.
const BEAD_OVERLAP = 0.95;

/** Moller-Trumbore, both faces; distance along unit dir or null. */
function rayTriangle(ox, oy, oz, d, a, b, c) {
  const e1x = b[0] - a[0]; const e1y = b[1] - a[1]; const e1z = b[2] - a[2];
  const e2x = c[0] - a[0]; const e2y = c[1] - a[1]; const e2z = c[2] - a[2];
  const px = d[1] * e2z - d[2] * e2y;
  const py = d[2] * e2x - d[0] * e2z;
  const pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const tx = ox - a[0]; const ty = oy - a[1]; const tz = oz - a[2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-4 ? t : null;
}
