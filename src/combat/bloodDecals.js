// @ts-check
// BLOOD1a - THE DECAL POOL: blood that stays where it landed.
//
// The port already draws the classic SPLASH - scenes/hitEffects.js is
// EnemyBlood.cs whole, a one-shot billboard from TEXTURE.380 at ten
// frames a second that plays and retires. What it has never had is the
// mark left behind. This is that: a fixed ring of oriented quads laid
// on whatever surface the blood met, recycled oldest-first.
//
// THE REFERENCE AND THE LINE (bible/05-Combat/Blood-Arc.md). The feel
// is measured off DaggerBlood 1.0.6a (Excoriated), which the port has
// NO permission to integrate: none of its code and none of its
// thirteen textures are here, and nothing in this file is a
// transcription of its assembly. What IS taken is a set of facts -
// numbers and orderings, which are nobody's to own - and the two that
// shape this module are:
//
//   - THE POOL IS A COUNT, NOT A LIFETIME. Its "how long blood stays"
//     setting is really "how many marks exist before yours is reused";
//     the ring below is that, and a decal is never retired on a clock.
//   - THE RATE LADDER is five rungs off damage over the target's max
//     health, and the density setting scales each rung with a floor of
//     one, so a player who turns the blood down never turns a hit into
//     nothing.
//
// NO RENDERER, NO GL, NO TEXTURE. This module answers WHERE a mark
// goes and WHICH one is next out of the ring; the host draws it. That
// split is the same one camp.js/camps.js keeps, and it is what lets
// every law here be driven on a table.

/** A hit for this share of the target's max health is an OVERKILL.
 *  Measured at 175, NOT the 200 the reference's own setting text
 *  claims - the text rounds and the code does not. */
export const OVERKILL_PERCENT = 175;
/** The three rungs with a ceiling of their own, off
 *  `damage / maxHealth * 100`, each INCLUSIVE at its top. */
export const RATE_LADDER = Object.freeze([
  Object.freeze({ upTo: 25, rate: 30 }),
  Object.freeze({ upTo: 50, rate: 50 }),
  Object.freeze({ upTo: 100, rate: 70 }),
]);
/** Past the last rung and short of the threshold: a hit that hurt. */
export const RATE_NEAR_LETHAL = 150;
/** At and past the threshold. THE LADDER'S TOP IS THE OVERKILL LINE
 *  ITSELF, which is why this is not a fourth row in the table above:
 *  the two are one number, and a table would let them drift apart. */
export const RATE_MAX = 200;
/** The overkill burst, in the order it goes off. */
export const OVERKILL_BURST = Object.freeze([
  Object.freeze({ rate: 450, min: 5, max: 10 }),
  Object.freeze({ rate: 350, min: 5, max: 10 }),
]);
/** ...and the ladder's own spawn, underneath it. */
export const OVERKILL_UNDER = Object.freeze({ min: 1, max: 5 });

/** `damage / maxHealth * 100`, or 0 where the target has no health to
 *  measure against (a divide by zero is not an overkill). */
export function damagePercent(damage, maxHealth) {
  if (!(maxHealth > 0) || !(damage > 0)) return 0;
  return (damage / maxHealth) * 100;
}

/** The ladder's particle count for a percent, before density. */
export function ladderRate(percent) {
  if (percent >= OVERKILL_PERCENT) return RATE_MAX;
  for (const rung of RATE_LADDER) if (percent <= rung.upTo) return rung.rate;
  return RATE_NEAR_LETHAL;
}

/** THE FLOOR IS THE POINT. `density` is the particle-amount setting as
 *  a fraction (0.1..1). A hit that lands always marks something, so a
 *  player who turns the blood right down gets less of it and never
 *  none of it - which is why this is `max(1, ...)` and not a bare
 *  multiply. */
export function scaleRate(rate, density = 1) {
  const d = Number.isFinite(density) ? Math.max(0, density) : 1;
  return Math.max(1, Math.round(rate * d));
}

/** The whole ladder in one read: how many marks this hit is worth. */
export const bloodRate = (damage, maxHealth, density = 1) =>
  scaleRate(ladderRate(damagePercent(damage, maxHealth)), density);

/** At or past the threshold. */
export const isOverkill = (damage, maxHealth) => damagePercent(damage, maxHealth) >= OVERKILL_PERCENT;

/** How far off the surface a mark floats, so it does not fight the
 *  wall it is on. hitEffects.js nudges its splash by the same 2cm for
 *  the same reason (EnemyBlood.cs:35's `+ transform.forward * 0.02f`). */
export const SURFACE_LIFT = 0.02;

/**
 * An orthonormal pair spanning the plane of `normal`, with `turn`
 * (radians) spinning them inside it.
 *
 * The seed axis is the WORLD UP unless the surface is itself near
 * horizontal, where up and the normal are parallel and their cross
 * product collapses to nothing - a floor is exactly the case this
 * module exists for, so the degenerate one is the common one and is
 * handled first rather than guarded against.
 */
export function surfaceBasis(normal, turn = 0) {
  const n = unit(normal) ?? [0, 1, 0];
  const seed = Math.abs(n[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const r0 = unit(cross(seed, n)) ?? [1, 0, 0];
  const u0 = cross(n, r0);   // already unit: n and r0 are unit and perpendicular
  const c = Math.cos(turn), s = Math.sin(turn);
  return {
    normal: n,
    right: [r0[0] * c + u0[0] * s, r0[1] * c + u0[1] * s, r0[2] * c + u0[2] * s],
    up: [u0[0] * c - r0[0] * s, u0[1] * c - r0[1] * s, u0[2] * c - r0[2] * s],
  };
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit(v) {
  if (!v) return null;
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}

// ---- the geometry the host uploads ---------------------------------
//
// A decal is FOUR VERTICES and the host draws a thousand of them in one
// call, so the corner maths lives here - pure, pinned, and nowhere near
// a GL context - and the renderer's pass is plumbing over it. The same
// reason the rest of this module has no renderer in it.

/** pos(3) + uv(2) + rgba(4). */
export const DECAL_FLOATS_PER_VERTEX = 9;
/** A quad, drawn as two triangles through an index buffer. */
export const DECAL_VERTS = 4;
/** One decal's stride into the batch's vertex buffer. */
export const DECAL_FLOATS = DECAL_VERTS * DECAL_FLOATS_PER_VERTEX;

const WHITE = Object.freeze([1, 1, 1, 1]);

/**
 * Write one decal's four corners into `out` at `offset` (in FLOATS).
 *
 * The corners go BL, TL, TR, BR - counter-clockwise seen from the
 * front, which is the side the surface normal points at. The host
 * draws with culling off (a decal on a ceiling is seen from behind its
 * own normal as often as not), so the winding is for the index buffer's
 * sake and for anything that ever wants to cull, not for correctness
 * today.
 *
 * `size` is the decal's FULL width, so the half-extent is half of it -
 * a decal of size 1 covers a metre of floor, which is what a caller
 * passing a metre expects.
 *
 * Answers the next free offset, so a loop over the ring can chain.
 */
export function writeDecalQuad(out, offset, decal, uv = null) {
  const u0 = uv?.u0 ?? 0, v0 = uv?.v0 ?? 0, u1 = uv?.u1 ?? 1, v1 = uv?.v1 ?? 1;
  const [px, py, pz] = decal.pos;
  const h = decal.size / 2;
  const rx = decal.right[0] * h, ry = decal.right[1] * h, rz = decal.right[2] * h;
  const ux = decal.up[0] * h, uy = decal.up[1] * h, uz = decal.up[2] * h;
  const c = decal.tint ?? WHITE;
  const corner = (i, sx, sy, u, v) => {
    const o = offset + i * DECAL_FLOATS_PER_VERTEX;
    out[o] = px + rx * sx + ux * sy;
    out[o + 1] = py + ry * sx + uy * sy;
    out[o + 2] = pz + rz * sx + uz * sy;
    out[o + 3] = u; out[o + 4] = v;
    out[o + 5] = c[0]; out[o + 6] = c[1]; out[o + 7] = c[2]; out[o + 8] = c[3] ?? 1;
  };
  corner(0, -1, -1, u0, v0);
  corner(1, -1, 1, u0, v1);
  corner(2, 1, 1, u1, v1);
  corner(3, 1, -1, u1, v0);
  return offset + DECAL_FLOATS;
}

/**
 * A SLOT WITH NOTHING IN IT IS A ZERO-AREA QUAD, not a gap in the
 * buffer. The ring is written by slot and drawn whole in one call, so
 * a hole has to be something the rasteriser throws away rather than
 * something the draw has to skip - skipping would mean either a second
 * draw call per run of live decals or an index rebuild on every
 * placement, and this costs four degenerate vertices.
 */
export function clearDecalQuad(out, offset) {
  out.fill(0, offset, offset + DECAL_FLOATS);
  return offset + DECAL_FLOATS;
}

/** The index buffer for `capacity` quads: two triangles each, BL-TR-TL
 *  and BL-BR-TR, matching the corner order above. */
export function decalIndices(capacity) {
  const out = new Uint32Array(capacity * 6);
  for (let q = 0; q < capacity; q++) {
    const b = q * DECAL_VERTS, o = q * 6;
    out[o] = b; out[o + 1] = b + 2; out[o + 2] = b + 1;
    out[o + 3] = b; out[o + 4] = b + 3; out[o + 5] = b + 2;
  }
  return out;
}

/**
 * The ring.
 *
 * `capacity` marks exist from the first call and no more are ever
 * made: `place` hands back the OLDEST slot once the ring is full, so
 * the cost of blood is decided at boot and cannot grow during a fight.
 * `serial` rises forever and is what a draw sorts or a test reads;
 * `slot` is the ring index and repeats.
 *
 * @param {{capacity?:number, rng?:() => number}} [opts]
 */
export function createBloodDecalPool({ capacity = 1000, rng = Math.random } = {}) {
  const cap = Math.max(1, Math.floor(capacity));
  /** @type {Array<any>} */
  const ring = new Array(cap).fill(null);
  let next = 0;        // the slot `place` takes
  let serial = 0;      // how many have ever been placed
  let live = 0;

  /**
   * Lay a mark. `point` is where the blood met the surface and
   * `normal` is that surface's, as collider.raycastHit answers it
   * (already turned to face the ray). Answers the decal, or null when
   * the caller handed nothing to place it on.
   */
  function place(point, normal, { size = 1, tint = null, parent = null, turn = null } = {}) {
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])) return null;
    const basis = surfaceBasis(normal, Number.isFinite(turn) ? turn : rng() * Math.PI * 2);
    const slot = next;
    const d = {
      slot,
      serial: serial++,
      // LIFTED OFF THE SURFACE, and stored lifted: a decal that is
      // re-read after a floating-origin shift must not have to
      // remember which way its own wall faced.
      pos: [
        point[0] + basis.normal[0] * SURFACE_LIFT,
        point[1] + basis.normal[1] * SURFACE_LIFT,
        point[2] + basis.normal[2] * SURFACE_LIFT,
      ],
      normal: basis.normal,
      right: basis.right,
      up: basis.up,
      size: Math.max(0, size),
      tint,
      // A mark on something that MOVES rides it: the reference lets a
      // decal attach to a parent so blood on a body travels with the
      // body. `parent` answers a position each frame, or null.
      parent,
    };
    if (!ring[slot]) live++;
    ring[slot] = d;
    next = (next + 1) % cap;
    return d;
  }

  /** Every live mark, oldest first. The draw reads this. */
  function decals() {
    const out = [];
    for (let i = 0; i < cap; i++) {
      const d = ring[(next + i) % cap];
      if (d) out.push(d);
    }
    return out;
  }

  /**
   * THE STREAMING WORLD MOVES UNDER THE MARKS. When the host recenters
   * (world.js's `state.compensation`), everything already placed is in
   * the OLD frame and would jump a pixel's width. Every live mark takes
   * the same delta, which is why they are stored in world space and not
   * as a surface plus an offset.
   */
  function shiftOrigin(delta) {
    if (!delta) return 0;
    let n = 0;
    for (const d of ring) {
      if (!d) continue;
      d.pos[0] += delta[0]; d.pos[1] += delta[1]; d.pos[2] += delta[2];
      n++;
    }
    return n;
  }

  /** A mode change throws the room away, and the blood with it. */
  function clear() {
    ring.fill(null);
    next = 0; live = 0;
    return true;
  }

  return {
    place, decals, shiftOrigin, clear,
    get capacity() { return cap; },
    get count() { return live; },
    get placed() { return serial; },
    /** Tests only: the ring as it stands, holes included. */
    _ring: () => ring.slice(),
  };
}
