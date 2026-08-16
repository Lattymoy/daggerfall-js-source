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

  /**
   * Nearest ray-triangle hit distance along dir (unit), or Infinity.
   * Walks XZ grid cells with a 2D DDA per bucket (Moller-Trumbore per
   * triangle, front and back faces).
   */
  raycast(origin, dir, maxDist) {
    let best = Infinity;
    for (const bucket of this._buckets.values()) {
      const t = bucket.t();
      const ox = origin[0] - t[0];
      const oy = origin[1] - t[1];
      const oz = origin[2] - t[2];
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
            if (hit !== null && hit < best && hit <= maxDist) best = hit;
          }
        }
        if (tMaxX < tMaxZ) { walked = tMaxX; tMaxX += tDeltaX; cx += stepX; }
        else { walked = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; }
      }
    }
    return best;
  }

  _resolveSphere(center, radius, out) {
    // Push a sphere out of every nearby triangle; returns strongest
    // ground-ness and whether any ceiling-ish contact happened.
    let grounded = false;
    let ceiling = false;
    let pushedDown = false;
    let groundKey = null;
    for (const [bkey, bucket] of this._buckets) {
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
            if (d < radius) {
              const push = (radius - d) / d;   // only push out of true penetration
              center[0] += dx * push;
              center[1] += dy * push;
              center[2] += dz * push;
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
            if (ny >= GROUND_NY) {
              grounded = true;
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
    if (groundKey != null && (out.groundKey == null || groundKey !== 'dungeon')) out.groundKey = groundKey;
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
   * step-up, ground snap, and the heightAt floor. Large deltas substep
   * so no component ever exceeds a fraction of the radius - a sphere
   * displaced past a surface in one step never contacts it (tunneling;
   * surfaced by starved-frame dt spikes in the headless harness).
   * @returns {{grounded:boolean, hitCeiling:boolean}}
   */
  move(feet, dx, dy, dz) {
    const maxComp = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const maxStep = CAPSULE_RADIUS * 0.75;
    if (maxComp > maxStep) {
      const n = Math.ceil(maxComp / maxStep);
      const out = { grounded: false, hitCeiling: false, pushedDown: false, groundKey: null };
      for (let i = 0; i < n; i++) {
        const r = this._moveStep(feet, dx / n, dy / n, dz / n);
        out.grounded = r.grounded;
        out.groundKey = r.groundKey ?? null;
        out.hitCeiling = out.hitCeiling || r.hitCeiling;
      }
      return out;
    }
    return this._moveStep(feet, dx, dy, dz);
  }

  /**
   * Is a capsule at these feet penetrating geometry? Runs the resolve
   * on a COPY and reports how far it got pushed - a large push means
   * the position is inside/against a wall (wedged).
   */
  penetrationAt(feet) {
    const probe = [feet[0], feet[1], feet[2]];
    const out = { grounded: false, hitCeiling: false, pushedDown: false };
    this._resolveCapsule(probe, out);
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

  _moveStep(feet, dx, dy, dz) {
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
      // The raised path must be GENUINELY clear (the same blocked
      // threshold the plain move failed), not merely jitter-better.
      // The old `retrySq > movedSq` accepted jitter-gained retries at
      // +stepOffset EVERY frame against a flat wall and laddered the
      // player up any facade (repro: walk into a wall -> maxY reached
      // the full wall height; jump+press escaped through the ceiling
      // into the building shell). A real step clears the raised sweep
      // outright; a wall blocks it at +0.5 exactly as at 0.
      if (retrySq >= wantedSq * 0.25 && !retryOut.pushedDown) {
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
