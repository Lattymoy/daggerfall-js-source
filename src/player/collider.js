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
  CAPSULE_RADIUS, CAPSULE_HEIGHT, STEP_OFFSET, SLOPE_LIMIT_DEG,
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
/** AUDIT ONCRASH1 B5a: the most sweep steps one move() may be split into - a motion larger than this is taken
 *  whole rather than swept, because a loop whose length a caller's arithmetic chooses is a frozen tab waiting. */
const SUBSTEPS_MAX = 256;
const GROUND_NY = Math.cos((SLOPE_LIMIT_DEG * Math.PI) / 180);
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

function closestPointOnTriangle(p, a, b, c, out) {
  // Ericson, Real-Time Collision Detection 5.1.5.
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const d1 = ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2];
  const d2 = ac[0] * ap[0] + ac[1] * ap[1] + ac[2] * ap[2];
  if (d1 <= 0 && d2 <= 0) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return; }
  const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
  const d3 = ab[0] * bp[0] + ab[1] * bp[1] + ab[2] * bp[2];
  const d4 = ac[0] * bp[0] + ac[1] * bp[1] + ac[2] * bp[2];
  if (d3 >= 0 && d4 <= d3) { out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0] = a[0] + ab[0] * v; out[1] = a[1] + ab[1] * v; out[2] = a[2] + ab[2] * v;
    return;
  }
  const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const d5 = ab[0] * cp[0] + ab[1] * cp[1] + ab[2] * cp[2];
  const d6 = ac[0] * cp[0] + ac[1] * cp[1] + ac[2] * cp[2];
  if (d6 >= 0 && d5 <= d6) { out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0] = a[0] + ac[0] * w; out[1] = a[1] + ac[1] * w; out[2] = a[2] + ac[2] * w;
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
  out[0] = a[0] + ab[0] * v + ac[0] * w;
  out[1] = a[1] + ab[1] * v + ac[1] * w;
  out[2] = a[2] + ab[2] * v + ac[2] * w;
}

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
    this._buckets = new Map(); // key -> {tris, grid: Map, t: () => [x,y,z], min: [x,y,z], max: [x,y,z]}   // AUDIT NAME1 F2: the bounds are the ray's broad phase
  }

  /**
   * Register a mesh's triangles under a bucket. Positions/indices are the
   * meshReader model buffers; matrix bakes them into bucket space.
   */
  addMesh(bucketKey, positions, indices, matrix, translation = null) {
    let bucket = this._buckets.get(bucketKey);
    if (!bucket) {
      // AUDIT NAME1 F2: `min`/`max` are the bucket's own bounds in ITS
      // OWN space (the translation is applied to the RAY, as the DDA
      // already does), kept as the triangles go in - one compare per
      // vertex, paid once at load, against a walk paid per ray.
      bucket = { tris: [], grid: new Map(), t: translation || (() => ZERO3), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      this._buckets.set(bucketKey, bucket);
    }
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
    for (let i = 0; i < indices.length; i += 3) {
      const a = tx(indices[i]);
      const b = tx(indices[i + 1]);
      const c = tx(indices[i + 2]);
      const idx = bucket.tris.length;
      bucket.tris.push([a, b, c]);
      for (const v of [a, b, c]) {
        for (let k = 0; k < 3; k++) {
          if (v[k] < bucket.min[k]) bucket.min[k] = v[k];
          if (v[k] > bucket.max[k]) bucket.max[k] = v[k];
        }
      }
      const minX = Math.floor(Math.min(a[0], b[0], c[0]) / CELL);
      const maxX = Math.floor(Math.max(a[0], b[0], c[0]) / CELL);
      const minZ = Math.floor(Math.min(a[2], b[2], c[2]) / CELL);
      const maxZ = Math.floor(Math.max(a[2], b[2], c[2]) / CELL);
      for (let gx = minX; gx <= maxX; gx++) {
        for (let gz = minZ; gz <= maxZ; gz++) {
          const k = `${gx},${gz}`;
          let cell = bucket.grid.get(k);
          if (!cell) { cell = []; bucket.grid.set(k, cell); }
          cell.push(idx);
        }
      }
    }
  }

  removeBucket(bucketKey) {
    this._buckets.delete(bucketKey);
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
   */
  raycastHit(origin, dir, maxDist, filter = null) {
    let best = Infinity;
    let bestKey = null;
    let bestTri = null;   // M3 climbing: the hit surface's normal rides the result
    const only = filter?.only ? new Set(filter.only) : null;
    const skip = filter?.skip ? new Set(filter.skip) : null;
    for (const [bkey, bucket] of this._buckets) {
      if (only && !only.has(bkey)) continue;
      if (skip && skip.has(bkey)) continue;
      const t = bucket.t();
      const ox = origin[0] - t[0];
      const oy = origin[1] - t[1];
      const oz = origin[2] - t[2];
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
      const visited = new Set();
      let walked = 0;
      while (walked <= Math.min(maxDist, best)) {
        const cell = bucket.grid.get(`${cx},${cz}`);
        if (cell) {
          for (const ti of cell) {
            if (visited.has(ti)) continue;
            visited.add(ti);
            const tri = bucket.tris[ti];
            const hit = rayTriangle(ox, oy, oz, dir, tri[0], tri[1], tri[2]);
            if (hit !== null && hit < best && hit <= maxDist) { best = hit; bestKey = bkey; bestTri = tri; }
          }
        }
        if (tMaxX < tMaxZ) { walked = tMaxX; tMaxX += tDeltaX; cx += stepX; }
        else { walked = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; }
      }
    }
    // M3 climbing (GetClimbedWallInfo :608 needs -hit.normal): the
    // best triangle's unit normal, oriented to FACE the ray - both
    // faces hit (as above), so the sign follows the approach side.
    let normal = null;
    if (bestTri) {
      const [a, b, c] = bestTri;
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      if (nx * dir[0] + ny * dir[1] + nz * dir[2] > 0) { nx = -nx; ny = -ny; nz = -nz; }
      normal = [nx, ny, nz];
    }
    return { dist: best, key: bestKey, normal };
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
    const hx = at(x + h, z) - at(x - h, z);
    const hz = at(x, z + h) - at(x, z - h);
    if (!Number.isFinite(hx) || !Number.isFinite(hz)) return [0, 1, 0];
    // `|| 0` is not belt and braces: -0 over flat ground is a real
    // answer that compares unequal to 0 and reads as a negative
    // gradient to anything that tests the sign.
    const nx = (-hx / (2 * h)) || 0, nz = (-hz / (2 * h)) || 0;
    const l = Math.hypot(nx, 1, nz) || 1;
    return [nx / l, 1 / l, nz / l];
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
    for (const [, bucket] of this._buckets) {
      const t = bucket.t();
      const lx = center[0] - t[0];
      const ly = center[1] - t[1];
      const lz = center[2] - t[2];
      if (!sphereTouchesBox(lx, ly, lz, radius, bucket.min, bucket.max)) continue;   // PERF-COL1: the same broad phase (the test below is `< r2`, no skin)
      const gx = Math.floor(lx / CELL);
      const gz = Math.floor(lz / CELL);
      const visited = VISITED;
      visited.clear();
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const cell = bucket.grid.get(`${gx + ox},${gz + oz}`);
          if (!cell) continue;
          for (const ti of cell) {
            if (visited.has(ti)) continue;
            visited.add(ti);
            const tri = bucket.tris[ti];
            closestPointOnTriangle([lx, ly, lz], tri[0], tri[1], tri[2], TMP);
            const dx = lx - TMP[0];
            const dy = ly - TMP[1];
            const dz = lz - TMP[2];
            if (dx * dx + dy * dy + dz * dz < r2) return true;
          }
        }
      }
    }
    return false;
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
  capsuleCast(p1, p2, radius, dir, maxDist, axisSamples = 3) {
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
    const n = Math.max(1, axisSamples);
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
      for (const [ox, oy, oz] of [
        [0, 0, 0],
        [ux * radius, uy * radius, uz * radius],
        [-ux * radius, -uy * radius, -uz * radius],
        [vx * radius, vy * radius, vz * radius],
        [-vx * radius, -vy * radius, -vz * radius],
        [(ux + vx) * h, (uy + vy) * h, (uz + vz) * h],
        [(ux - vx) * h, (uy - vy) * h, (uz - vz) * h],
        [(-ux + vx) * h, (-uy + vy) * h, (-uz + vz) * h],
        [(-ux - vx) * h, (-uy - vy) * h, (-uz - vz) * h],
      ]) {
        const h = this.raycastHit([bx + ox, by + oy, bz + oz], dir, reach);
        if (h.dist < best) { best = h.dist; bestKey = h.key; }
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
  sphereCast(origin, radius, dir, maxDist) {
    return this.capsuleCast(origin, origin, radius, dir, maxDist, 1);
  }

  _resolveSphere(center, radius, out, standCeil = Infinity, oneWayFloor = false, midBody = false) {
    // Push a sphere out of every nearby triangle; returns strongest
    // ground-ness and whether any ceiling-ish contact happened.
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
    for (const [bkey, bucket] of this._buckets) {
      const t = bucket.t();
      if (!sphereTouchesBox(center[0] - t[0], center[1] - t[1], center[2] - t[2], radius + SKIN, bucket.min, bucket.max)) continue;
      const gx = Math.floor((center[0] - t[0]) / CELL);
      const gz = Math.floor((center[2] - t[2]) / CELL);
      const visited = VISITED;
      visited.clear();
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const cell = bucket.grid.get(`${gx + ox},${gz + oz}`);
          if (!cell) continue;
          for (const ti of cell) {
            if (visited.has(ti)) continue;
            visited.add(ti);
            const tri = bucket.tris[ti];
            // Live local point: pushes from earlier triangles must be
            // seen by later ones (a stale snapshot compounded pushes).
            const lx = center[0] - t[0];
            const ly = center[1] - t[1];
            const lz = center[2] - t[2];
            closestPointOnTriangle([lx, ly, lz], tri[0], tri[1], tri[2], TMP);
            const dx = lx - TMP[0];
            const dy = ly - TMP[1];
            const dz = lz - TMP[2];
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
            // near-horizontal surface just ABOVE the lower sphere's centre,
            // within its radius, is a floor the body is under, and the
            // sphere is set ON it. Nothing legal stands there - a surface
            // 0.35-0.7 above the feet is inside the crouched capsule too.
            // The head sphere keeps the plain push: a ceiling is a ceiling.
            const floorAbove = oneWayFloor && d < radius && !wallAbove && dy / d <= -GROUND_NY;
            if (floorAbove) {
              const dh2 = dx * dx + dz * dz;
              const cy = t[1] + (ly - dy);   // the closest point's world y
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
            if (globalThis.__logContacts) {
              globalThis.__contacts = globalThis.__contacts || [];
              globalThis.__contacts.push({ tri: tri.map((v) => v.map((n) => Number(n.toFixed(2)))), ny: Number(ny.toFixed(2)) });
            }
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
    }
    out.grounded = out.grounded || grounded;
    out.hitCeiling = out.hitCeiling || ceiling;
    out.pushedDown = out.pushedDown || pushedDown;
    if (grounded) out.groundY = Math.max(out.groundY ?? -Infinity, groundY);
    if (groundKey != null && (out.groundKey == null || groundKey !== 'dungeon')) out.groundKey = groundKey;
  }

  _resolveCapsule(feet, out, height = CAPSULE_HEIGHT, standCeil = Infinity) {
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
    for (let iter = 0; iter < 3; iter++) {
      this._resolveSphere(low, CAPSULE_RADIUS, out, standCeil, true);   // PH1: the lower sphere's floor is one-way
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
      this._resolveSphere(high, CAPSULE_RADIUS, out, standCeil, axis === 0);
      low[0] = high[0];
      low[2] = high[2];
      low[1] = high[1] - axis;
    }
    feet[0] = low[0];
    feet[1] = low[1] - CAPSULE_RADIUS;
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
        if (probe[1] < y - 1e-4) { feet[1] = entryY; break; }   // still being pushed DOWN out of a ceiling -> too tight, revert
      }
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
  move(feet, dx, dy, dz, height = CAPSULE_HEIGHT, snap = true) {
    const maxComp = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const maxStep = CAPSULE_RADIUS * 0.75;
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
    this._resolveCapsule(feet, hOut, height);
    const movedSq = (feet[0] - beforeX) ** 2 + (feet[2] - beforeZ) ** 2;
    const wantedSq = dx * dx + dz * dz;

    // Step-up: only while not rising (Unity steps a grounded/falling
    // controller). The ASCENDING lift ladder takes the SMALLEST clear
    // rung up to stepOffset - a low ceiling shrinks the step instead
    // of jamming the head or rejecting the stair outright; the raised
    // height is kept this frame and the snap below settles it onto
    // the tread as forward progress clears the edge.
    if (dy <= 0 && wantedSq > 1e-8 && movedSq < wantedSq * 0.25) {
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
    feet[1] += dy;
    this._resolveCapsule(feet, out, height);

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
    const floor = this.heightAt(feet[0], feet[2]);
    if (snap && dy <= 0 && !out.grounded && feet[1] > floor && feet[1] - floor <= STEP_OFFSET) {
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
    // Terrain/ground floor beneath everything.
    if (feet[1] < floor + SKIN) {
      if (dy <= 0) out.grounded = true;
      feet[1] = floor;
    }
    return out;
  }
}

const ZERO3 = [0, 0, 0];
const TMP = [0, 0, 0];
// AUDIT COL1 F9: the middle spheres' centres, reused. _resolveCapsule
// runs several times per move() per body and is never re-entered, so
// rebuilding this array per call was pure garbage at frame rate.
const MID_SCRATCH = [];
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
