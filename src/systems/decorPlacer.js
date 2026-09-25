// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1d (2026-09-25) — WHERE A NEW PIECE WILL STAND.
//
// Mac: placing is done from "free cam mode"; decor is "Gold per
// placement", priced "By size". The placement tool's own state - the
// turn, the lift, the scale, the grid - and the one piece of arithmetic
// it exists for: a surface point the free camera's eye meets, turned
// into the piece record the law takes (net/decorLaw.js) and the room
// stands (scenes/decorRoom.js).
//
// A MODEL is lifted by its own bottom: its origin is not its base (a
// Daggerfall model's origin sits wherever its maker put it -
// interiorLayout.js lifts the room's props the same way), so the box
// the model is measured by, turned and scaled as it will stand, decides
// how far above the surface its origin goes, and the RECORD says where
// the origin is - nothing is re-derived at a restore. A FLAT stands on
// its base, as every billboard does. The owner's own lift is added to
// either, and the grid (a quarter metre) snaps where it stands across
// the floor, never its height - a piece on a table stays on the table.
//
// The turn is a yaw in whole steps of fifteen degrees (one degree held
// fine), wrapped to a half-circle each way as the law bounds it; the
// scale steps by a tenth, within the law's quarter to four times; the
// price is the law's, by the scaled size - and a piece whose size the
// scan could not read has no price and is never placed.
//
// DECOR2c: A MOUNT (a weapon or a shield of the owner's own) is set
// ON the surface the eye meets, not above it: its heading and tilt are
// the surface's (a floor's heading the eye's own, so the picture reads
// upright from where the owner stands), the turn is its spin on the
// surface, it hangs a hair off it, the grid snaps it across the surface
// and the owner's lift moves it up the surface. No surface, no mount.
// ═══════════════════════════════════════════════════════════════════

import { trs } from '../world/mat4.js';
import { transformedAabb } from '../render/frustum.js';
import { decorPieceOf, decorPrice, decorMountFrame, DECOR_SCALE_MIN, DECOR_SCALE_MAX, DECOR_MOUNT_LIFT } from '../net/decorLaw.js';

export const DECOR_TURN_STEP = 15;
export const DECOR_TURN_FINE = 1;
export const DECOR_RAISE_STEP = 0.05;
export const DECOR_RAISE_FINE = 0.01;
/** The owner's own lift is bounded: a piece hangs at most this far above where it would stand, or sinks this far. */
export const DECOR_RAISE_MAX = 3;
export const DECOR_RAISE_MIN = -1;
export const DECOR_SCALE_STEP = 1.1;
export const DECOR_GRID = 0.25;

/** A turn wrapped into (-180, 180]. */
export function wrapTurn(deg) {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}
const round = (v, places) => { const k = 10 ** places; return Math.round(v * k) / k; };
const snapTo = (v, step) => round(Math.round(v / step) * step, 3);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const DEG = 180 / Math.PI;

/**
 * THE TOOL for one catalogue `entry`. `radius` its measured radius in metres (null: unmeasured), `box` a model's local
 * bounds [minX, minY, minZ, maxX, maxY, maxZ] (render/frustum.js localAabb), null for a flat. DECOR1e: `from` a placed
 * piece being moved - the tool starts at its turn and its scale. DECOR2a: `free` - the player's own item, which costs
 * nothing whatever its size, and whose piece carries its descriptor (`entry.item`). DECOR2c: an entry that is a `mount`
 * is set on the surface, the turn its spin there.
 */
export function createDecorPlacer(entry, { radius = null, box = null, from = null, free = false } = {}) {
  const mount = !!entry.mount;
  const s = { yaw: from ? wrapTurn((mount ? from.rot?.[2] : from.rot?.[0]) ?? 0) : 0, raise: 0, scale: from?.scale ?? 1, snap: false };

  /** How far above a surface point the piece's origin stands, before the owner's own lift. */
  function lift() {
    if (entry.model == null || !box) return 0;
    const b = transformedAabb(box, trs(0, 0, 0, 0, s.yaw, 0, s.scale, s.scale, s.scale));
    return -b[1];
  }

  /** DECOR2c: THE MOUNT for a surface point and its `normal` (the eye's hit's, facing the eye), or null with no surface. */
  function mountAt(hit, origin, id, normal, camYaw, paid) {
    const len = normal ? Math.hypot(normal[0], normal[1], normal[2]) : 0;
    if (!(len > 0)) return null;
    const n = [normal[0] / len, normal[1] / len, normal[2] / len];
    const level = Math.hypot(n[0], n[2]) > 1e-3;
    const heading = level ? Math.atan2(n[0], n[2]) : (Number.isFinite(camYaw) ? camYaw : 0) + Math.PI;
    const rot = [wrapTurn(round(heading * DEG, 1)), round(Math.asin(Math.max(-1, Math.min(1, n[1]))) * DEG, 1), s.yaw];
    const { right, up } = decorMountFrame([rot[0], rot[1], 0]);   // the surface's own axes, before the spin
    let p = [hit[0] - origin[0], hit[1] - origin[1], hit[2] - origin[2]];
    if (s.snap) {   // across the surface, never off it
      const a = snapTo(dot(p, right), DECOR_GRID);
      const b = snapTo(dot(p, up), DECOR_GRID);
      const c = dot(p, n);
      p = [0, 1, 2].map((i) => right[i] * a + up[i] * b + n[i] * c);
    }
    p = [0, 1, 2].map((i) => p[i] + up[i] * s.raise + n[i] * DECOR_MOUNT_LIFT);
    return decorPieceOf({
      id, model: null, flat: [entry.flat[0], entry.flat[1]], item: entry.item ?? null, pos: p, rot, scale: s.scale,
      light: entry.light ? { ...entry.light, color: [...entry.light.color] } : null, storage: false, paid,
    });
  }

  return {
    entry,
    state: () => ({ ...s }),
    /** Turn by `deg` (a step, or a fine one). */
    turn(deg) { s.yaw = wrapTurn(round(s.yaw + deg, 1)); },
    /** Lift or lower by `d` metres, within the tool's own bound. */
    raise(d) { s.raise = round(Math.min(DECOR_RAISE_MAX, Math.max(DECOR_RAISE_MIN, s.raise + d)), 3); },
    /** A size step up or down, within the law's. */
    rescale(up) {
      const next = up ? s.scale * DECOR_SCALE_STEP : s.scale / DECOR_SCALE_STEP;
      s.scale = round(Math.min(DECOR_SCALE_MAX, Math.max(DECOR_SCALE_MIN, next)), 3);
    },
    /** The grid, on or off; answers which. */
    toggleSnap() { s.snap = !s.snap; return s.snap; },
    /** The price at this scale (the law's), or null for a piece the scan could not measure; nothing for one's own. */
    price() {
      if (free) return 0;
      return radius != null && radius > 0 ? decorPrice(radius, s.scale) : null;
    },
    /**
     * THE PIECE for a surface point `hit` (the free camera's eye meeting the room, this visit's frame), measured from
     * the building's `origin` - projected by the law, or null (unpriced, or outside what a piece may be). DECOR2c: a
     * mount takes the surface's `normal` there, and the eye's `camYaw` for a floor's heading.
     * @param {number[]} hit
     * @param {number[]} origin
     * @param {string} id
     * @param {number[]|null} [normal]
     * @param {number} [camYaw]
     */
    pieceAt(hit, origin, id, normal = null, camYaw = 0) {
      const paid = this.price();
      if (paid == null || !hit || !origin) return null;
      if (mount) return mountAt(hit, origin, id, normal, camYaw, paid);
      const up = lift() + s.raise;
      let x = hit[0] - origin[0];
      let z = hit[2] - origin[2];
      if (s.snap) { x = snapTo(x, DECOR_GRID); z = snapTo(z, DECOR_GRID); }
      return decorPieceOf({
        id, model: entry.model ?? null, flat: entry.flat ? [entry.flat[0], entry.flat[1]] : null, item: entry.item ?? null,
        pos: [x, hit[1] - origin[1] + up, z], rot: [s.yaw, 0, 0], scale: s.scale,
        light: entry.light ? { ...entry.light, color: [...entry.light.color] } : null,
        storage: !!entry.storage, paid,
      });
    },
  };
}
