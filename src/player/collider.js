// Static-world capsule collider: triangle soup in a uniform grid, the
// capsule approximated as two spheres (feet + head). Engine-side (ours,
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

const CELL = 8; // grid cell size in world units
const GROUND_NY = Math.cos((SLOPE_LIMIT_DEG * Math.PI) / 180);
const SKIN = 0.02;

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

export class Collider {
  /** @param {(x:number,z:number)=>number} heightAt floor beneath everything */
  constructor(heightAt = () => -Infinity) {
    this.heightAt = heightAt;
    this._buckets = new Map(); // key -> {tris: Float32Array, grid: Map, t: () => [x,y,z]}
  }

  /**
   * Register a mesh's triangles under a bucket. Positions/indices are the
   * meshReader model buffers; matrix bakes them into bucket space.
   */
  addMesh(bucketKey, positions, indices, matrix, translation = null) {
    let bucket = this._buckets.get(bucketKey);
    if (!bucket) {
      bucket = { tris: [], grid: new Map(), t: translation || (() => ZERO3) };
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

  _resolveSphere(center, radius, out) {
    // Push a sphere out of every nearby triangle; returns strongest
    // ground-ness and whether any ceiling-ish contact happened.
    let grounded = false;
    let ceiling = false;
    let pushedDown = false;
    for (const bucket of this._buckets.values()) {
      const t = bucket.t();
      const gx = Math.floor((center[0] - t[0]) / CELL);
      const gz = Math.floor((center[2] - t[2]) / CELL);
      const visited = new Set();
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
            if (d2 >= radius * radius || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const push = (radius - d) / d;
            center[0] += dx * push;
            center[1] += dy * push;
            center[2] += dz * push;
            const ny = dy / d;
            if (ny >= GROUND_NY) grounded = true;
            if (ny <= -0.5) ceiling = true;
            if (ny <= -GROUND_NY) pushedDown = true;
          }
        }
      }
    }
    out.grounded = out.grounded || grounded;
    out.hitCeiling = out.hitCeiling || ceiling;
    out.pushedDown = out.pushedDown || pushedDown;
  }

  _resolveCapsule(feet, out) {
    // Two spheres: lower centered radius above the feet, upper below the top.
    const low = [feet[0], feet[1] + CAPSULE_RADIUS, feet[2]];
    const high = [feet[0], feet[1] + CAPSULE_HEIGHT - CAPSULE_RADIUS, feet[2]];
    for (let iter = 0; iter < 3; iter++) {
      this._resolveSphere(low, CAPSULE_RADIUS, out);
      high[0] = low[0];
      high[2] = low[2];
      high[1] = low[1] + (CAPSULE_HEIGHT - 2 * CAPSULE_RADIUS);
      this._resolveSphere(high, CAPSULE_RADIUS, out);
      low[0] = high[0];
      low[2] = high[2];
      low[1] = high[1] - (CAPSULE_HEIGHT - 2 * CAPSULE_RADIUS);
    }
    feet[0] = low[0];
    feet[1] = low[1] - CAPSULE_RADIUS;
    feet[2] = low[2];
  }

  /**
   * Move the capsule (feet position, mutated) by the delta with slide,
   * step-up, ground snap, and the heightAt floor.
   * @returns {{grounded:boolean, hitCeiling:boolean}}
   */
  move(feet, dx, dy, dz) {
    const out = { grounded: false, hitCeiling: false, pushedDown: false };

    // Horizontal, with a step-up retry: if blocked, try from stepOffset
    // higher and keep the result only if it gained ground.
    const beforeX = feet[0];
    const beforeZ = feet[2];
    feet[0] += dx;
    feet[2] += dz;
    this._resolveCapsule(feet, out);
    const movedSq = (feet[0] - beforeX) ** 2 + (feet[2] - beforeZ) ** 2;
    const wantedSq = dx * dx + dz * dz;
    if (wantedSq > 1e-8 && movedSq < wantedSq * 0.25) {
      const retry = [beforeX + dx, feet[1] + STEP_OFFSET, beforeZ + dz];
      const retryOut = { grounded: false, hitCeiling: false, pushedDown: false };
      this._resolveCapsule(retry, retryOut);
      const retrySq = (retry[0] - beforeX) ** 2 + (retry[2] - beforeZ) ** 2;
      if (retrySq > movedSq && !retryOut.pushedDown) {
        feet[0] = retry[0];
        feet[1] = retry[1];
        feet[2] = retry[2];
      }
    }

    // Vertical.
    feet[1] += dy;
    this._resolveCapsule(feet, out);

    // Ground snap when moving down: pulls onto steps/slopes.
    if (dy <= 0 && !out.grounded) {
      const probe = [feet[0], feet[1] - STEP_OFFSET, feet[2]];
      const probeOut = { grounded: false, hitCeiling: false, pushedDown: false };
      this._resolveCapsule(probe, probeOut);
      // A down-pushed probe tunneled under geometry (a step top's
      // underside) - snapping to it drags the player through the mesh.
      if (probeOut.grounded && !probeOut.pushedDown
        && probe[1] > feet[1] - STEP_OFFSET + 1e-4 && probe[1] <= feet[1] + 1e-4) {
        feet[1] = probe[1];
        out.grounded = true;
      }
    }

    // Terrain/ground floor beneath everything.
    const floor = this.heightAt(feet[0], feet[2]);
    if (feet[1] < floor + SKIN) {
      if (dy <= 0) out.grounded = true;
      feet[1] = floor;
    }
    return out;
  }
}

const ZERO3 = [0, 0, 0];
const TMP = [0, 0, 0];
