// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-DOORS (2026-09-30) — A DOOR HUNG IN A DOORWAY, AND WHERE ONE GOES.
//
// Asked: "For houses with multiple rooms attached, I want to add a door
// item that can attach to the wall that leads to another room. This
// needs to have an easy element where it tells you where you can place
// it."
//
// THE DOOR is one of Daggerfall's own: the five interior door models
// DaggerfallInterior hangs (world/interior/interiorLayout.js DOOR_MODEL_BASE_ID,
// DOOR_MODEL_COUNT), read into the catalogue from the town blocks' own
// door records (systems/decor/decorCatalogue.js), priced by size as any piece
// is. Placed, it stands as an ACTION DOOR (world/actionSystem.js addDoor,
// keyed `act:decor:<id>` - scenes/decor/decorRoom.js hands it to the host): it
// swings open and shut, blocks while shut, is saved and is shared with
// whoever stands in the room, exactly as the room's own doors are. The
// account service keeps it as the piece it is (a model id, a place), so
// nothing on the service knows a door from a chair.
//
// WHERE ONE GOES: a DOORWAY - an opening in a wall between two floors
// the eye passes between (systems/decor/decorRooms.js links: a doorway is
// exactly where the room finder saw the eye go through a wall). Each
// link is looked across at waist height: where the space either side of
// it narrows to a door's width for no deeper than a wall is thick, and
// opens out again on both sides, that narrowing is a doorway - its
// middle between the jambs, its floor, its lintel, the way through it.
// A corridor narrows for its whole length and is no doorway. A doorway a
// door already hangs in (one of the room's own, open, or one placed) is
// taken.
//
// THE EASY ELEMENT: while a door is being placed, every free doorway is
// marked (the tool's decal pass - decorDoorwayQuad) and the door is
// fitted, whole, into the one the eye looks at (decorDoorwayAimed,
// decorDoorFit: turned into the wall, sized to the opening, stood on its
// floor); a turn swings it the other way. Looking at none, the bar says
// how many are free, or that the house has none.
//
// STEPPED, as the room finder is. Pure: the collider's `raycastHit` is an
// argument. Not a DFU member: Daggerfall Unity has no decorator. Ledger A.
// ═══════════════════════════════════════════════════════════════════

import { DOOR_MODEL_BASE_ID, DOOR_MODEL_COUNT } from '../../world/interior/interiorLayout.js';
import { DECOR_SCALE_MIN, DECOR_SCALE_MAX } from '../../net/decorLaw.js';

/** The narrowest and the widest opening a door is hung in, metres. */
export const DOORWAY_WIDTH_MIN = 0.6;
export const DOORWAY_WIDTH_MAX = 2.4;
/** A doorway a body passes through: at least this high... */
export const DOORWAY_HEIGHT_MIN = 1.8;
/** ...looked for no further up than this. */
export const DOORWAY_HEIGHT_MAX = 4;
/** The deepest a doorway runs - a wall's thickness, never a corridor's length. */
export const DOORWAY_DEPTH_MAX = 1.2;
/** How much wider the space must be either side of the opening, metres - a room each side, not a passage. */
export const DOORWAY_OPENS = 0.3;
/** How far apart the opening is measured along the way through, metres. */
export const DOORWAY_STEP = 0.1;
/** How high above the floor the opening is measured - the room finder's own waist. */
export const DOORWAY_WAIST = 1;
/** Two finds nearer than this across the opening are one doorway. */
export const DOORWAY_SAME = 0.5;
/** A doorway with a door standing this near its middle is taken. */
export const DOORWAY_NEAR_DOOR = 1.5;
/** How far off the eye's line a doorway is still the one looked at, at the least. */
export const DOORWAY_AIM = 1.2;
/** How far either side of the door's plane its lintel is looked for, metres. */
export const DOORWAY_LINTEL_SIDE = 0.05;
/** How many rays one step of the finder casts. */
export const DOORWAY_RAYS_A_STEP = 400;
/** How short of the lintel a fitted door stands. */
export const DOOR_FIT_GAP = 0.02;
/** AUDIT: the most of an opening's width a fitted door may leave open (both sides together) and still close it. */
export const DOOR_FILL_SLACK = 0.2;
/** How high a doorway's mark stands at the most - a door's height, not the ceiling of an arch. */
export const DOORWAY_MARK_HIGH = 2.4;

/** Whether a model is one of the doors (the five DaggerfallInterior hangs). */
export const isDoorModel = (model) => Number.isSafeInteger(model) && model >= DOOR_MODEL_BASE_ID && model < DOOR_MODEL_BASE_ID + DOOR_MODEL_COUNT;
/** Whether a placed piece is a door - a catalogue door (never one's own item). */
export const decorIsDoor = (piece) => !!piece && !piece.item && isDoorModel(piece.model);

const DOWN = Object.freeze([0, -1, 0]);
const UP = Object.freeze([0, 1, 0]);

/**
 * THE FINDER for one interior, over the room finder's `links` (decorRooms.js links()). `raycastHit(origin, dir, max)`
 * answers `{ dist }` (player/collider.js). `step(rays)` casts about that many rays and answers whether it is done;
 * `doorways()` the doorways once it is (null until then), lowest first, each
 * `{ id, center: [x, y, z] (its floor, between the jambs), normal: [x, 0, z] (the way through), width, height }`.
 * @param {{ raycastHit: (o: number[], d: readonly number[], max: number) => ({ dist: number }|null),
 *   links: { a: number[], b: number[], dir: number[] }[] | null }} o
 */
export function createDecorDoorways({ raycastHit, links }) {
  const all = Array.isArray(links) ? links : [];
  const cast = (o, d, max) => {
    let h = null;
    try { h = raycastHit(o, d, max); } catch { h = null; }
    const dist = h?.dist;
    return typeof dist === 'number' && dist >= 0 ? dist : Infinity;
  };
  const found = [];
  let next = 0;
  /** @type {any[]|null} */
  let list = null;

  const same = (d, c) => d.normal[0] === c.normal[0] && d.normal[2] === c.normal[2]
    && Math.abs((c.center[0] - d.center[0]) * c.normal[2] + (c.center[2] - d.center[2]) * c.normal[0]) < DOORWAY_SAME
    && Math.abs((c.center[0] - d.center[0]) * c.normal[0] + (c.center[2] - d.center[2]) * c.normal[2]) < DOORWAY_DEPTH_MAX / 2
    && Math.abs(c.center[1] - d.center[1]) < DOORWAY_SAME;

  /**
   * One link looked across: a doorway kept, or none. Answers the rays it cast. A ray runs along the way through from
   * `a`, stepped sideways (`u` across it): in the opening it goes through, and past a jamb it meets the wall the
   * opening is in. So the opening is the run of `u` that goes through, and each jamb is the first `u` either side that
   * does not - both meeting the same wall, which goes on past them.
   */
  function probe(link) {
    const { a, b, dir } = link;
    const p = [dir[2], 0, dir[0]];   // across the way through
    const h = Math.max(a[1], b[1]) + DOORWAY_WAIST;
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    let rays = 0;
    const along = (u, from = a, sign = 1, max = len) => { rays++; return cast([from[0] + p[0] * u, h, from[2] + p[2] * u], [dir[0] * sign, 0, dir[2] * sign], max); };
    // no wall within half the widest door either side: the link is in the open, never through a doorway
    const reach = DOORWAY_WIDTH_MAX / 2 + DOORWAY_STEP;
    if (!Number.isFinite(along(reach)) && !Number.isFinite(along(-reach))) return rays;
    if (Number.isFinite(along(0))) return rays;
    /** The jamb on one side: `{ u, t }` - where the wall begins across the way through, and how far along it stands. */
    const jamb = (side) => {
      let open = 0;
      for (let u = DOORWAY_STEP; u <= DOORWAY_WIDTH_MAX + 1e-9; u += DOORWAY_STEP) {
        const t = along(side * u);
        if (!Number.isFinite(t)) { open = u; continue; }
        let lo = open, hi = u, at = t;
        for (let i = 0; i < 4; i++) {   // halved four times: the jamb to a few millimetres
          const mid = (lo + hi) / 2;
          const tm = along(side * mid);
          if (Number.isFinite(tm)) { hi = mid; at = tm; } else lo = mid;
        }
        return { u: side * hi, t: at };
      }
      return null;
    };
    const r = jamb(1);
    if (!r) return rays;
    const l = jamb(-1);
    if (!l) return rays;
    const width = r.u - l.u;
    if (width < DOORWAY_WIDTH_MIN || width > DOORWAY_WIDTH_MAX) return rays;
    if (Math.abs(r.t - l.t) > DOORWAY_DEPTH_MAX / 2) return rays;   // not one wall
    // the wall goes on past both jambs, at the same depth - a wall with an opening in it, not a gap between two things
    const beyond = DOORWAY_OPENS + DOORWAY_STEP;
    const tr = along(r.u + beyond), tl = along(l.u - beyond);
    // AUDIT: or a wall meets it at a corner within that reach - a doorway beside a room's corner (a ray along the wall's
    // face, just in front of it, outward from the jamb); a free-standing post has neither
    const cornered = (j, side) => {
      rays++;
      const back = j.t - DOORWAY_STEP;
      return cast([a[0] + p[0] * j.u + dir[0] * back, h, a[2] + p[2] * j.u + dir[2] * back], [p[0] * side, 0, p[2] * side], beyond) < beyond;
    };
    const goesOn = (t, j, side) => Math.abs(t - j.t) <= DOORWAY_STEP * 2 || cornered(j, side);
    if (!goesOn(tr, r, 1) || !goesOn(tl, l, -1)) return rays;
    // the wall's far face, looked for back from past the thickest wall (a floor in the doorway may stand inside the
    // wall's thickness): the door hangs in the middle of the wall
    const near = Math.min(r.t, l.t);
    const past = near + DOORWAY_DEPTH_MAX + DOORWAY_STEP;
    const back = along(r.u + beyond, [a[0] + dir[0] * past, a[1], a[2] + dir[2] * past], -1, past - near);
    const far = Number.isFinite(back) ? past - back : near;
    if (far - near > DOORWAY_DEPTH_MAX || far < near - DOORWAY_STEP) return rays;
    const tc = (near + Math.max(near, far)) / 2;
    const uc = (r.u + l.u) / 2;
    const cx = a[0] + p[0] * uc + dir[0] * tc;
    const cz = a[2] + p[2] * uc + dir[2] * tc;
    rays++;
    const drop = cast([cx, h, cz], DOWN, h - Math.min(a[1], b[1]) + 0.5);
    if (!Number.isFinite(drop)) return rays;
    const floor = h - drop;
    // the lintel, a hair either side of the door's plane (a wall's own plane sees along its face, never into it)
    // the lintel, either side of the wall's plane - each side from its own floor (AUDIT: a step at the doorway put one
    // side's ray inside the step, and the opening measured a hand high), measured from the doorway's floor
    rays += 4;
    const lintel = Math.min(...[-1, 1].map((k) => {
      const sx = cx + dir[0] * k * DOORWAY_LINTEL_SIDE, sz = cz + dir[2] * k * DOORWAY_LINTEL_SIDE;
      const sd = cast([sx, h, sz], DOWN, h - Math.min(a[1], b[1]) + 0.5);
      const sideFloor = Number.isFinite(sd) ? h - sd : floor;
      const u = cast([sx, sideFloor + 0.05, sz], UP, DOORWAY_HEIGHT_MAX);
      return Number.isFinite(u) ? sideFloor + 0.05 + u : Infinity;
    }));
    const height = Number.isFinite(lintel) ? lintel - floor : DOORWAY_HEIGHT_MAX;
    if (height < DOORWAY_HEIGHT_MIN) return rays;
    const c = { center: [cx, floor, cz], normal: [dir[0], 0, dir[2]], width, height };
    if (!found.some((d) => same(d, c))) found.push(c);
    return rays;
  }

  function step(budget = DOORWAY_RAYS_A_STEP) {
    if (list) return true;
    let spent = 0;
    while (spent < budget && next < all.length) spent += probe(all[next++]);
    if (next >= all.length) {
      found.sort((x, y) => x.center[1] - y.center[1] || x.center[0] - y.center[0] || x.center[2] - y.center[2]);
      list = found.map((d, i) => Object.freeze({ id: i + 1, center: Object.freeze(d.center), normal: Object.freeze(d.normal), width: d.width, height: d.height }));
    }
    return !!list;
  }

  return {
    step,
    done: () => !!list,
    doorways: () => list,
    progress: () => (list ? 1 : next / Math.max(1, all.length)),
  };
}

/** The doorways no door stands in - `doors` the points doors stand at (a hinge, a middle), world. */
export function decorDoorwaysFree(doorways, doors) {
  const at = Array.isArray(doors) ? doors.filter((d) => Array.isArray(d) && d.length >= 3) : [];
  return (doorways ?? []).filter((w) => !at.some((d) => Math.hypot(d[0] - w.center[0], d[2] - w.center[2]) < DOORWAY_NEAR_DOOR
    && Math.abs(d[1] - w.center[1]) < DOORWAY_HEIGHT_MIN));
}

/**
 * THE DOORWAY THE EYE LOOKS AT: of `doorways`, the one whose middle is nearest the line from `eye` along `dir`, ahead of
 * it and within `reach`, and no further off the line than half its width (DOORWAY_AIM at the least) - or null.
 * AUDIT: `seen(mid, dist)`, when given, answers whether the eye sees that middle - a doorway behind a wall or above
 * the ceiling is never the one looked at (the ghost and its mark would stand out of sight, and a click hang it there).
 */
export function decorDoorwayAimed(doorways, eye, dir, reach, seen = null) {
  let best = null;
  let bestD = Infinity;
  for (const w of doorways ?? []) {
    const m = [w.center[0], w.center[1] + Math.min(w.height, DOORWAY_MARK_HIGH) / 2, w.center[2]];
    const v = [m[0] - eye[0], m[1] - eye[1], m[2] - eye[2]];
    const t = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2];
    if (!(t > 0) || t > reach) continue;
    const off = Math.hypot(v[0] - dir[0] * t, v[1] - dir[1] * t, v[2] - dir[2] * t);
    if (off > Math.max(DOORWAY_AIM, w.width / 2) || off >= bestD) continue;
    if (seen && !seen(m, Math.hypot(v[0], v[1], v[2]))) continue;
    bestD = off;
    best = w;
  }
  return best;
}

/**
 * A DOOR FITTED TO A DOORWAY: the door model's box (`[x0, y0, z0, x1, y1, z1]`, its own frame - render/frustum.js
 * localAabb) turned so its thickness runs along the way through, sized to the opening (its width, or its height, the
 * tighter - within the piece law's scale), and stood with its middle on the doorway's middle and its foot on its floor.
 * `flip` turns it half round: hung from the other jamb, swinging into the other room. Answers the model's origin
 * `pos` (world), its `yaw` in degrees (the piece's own turn, net/decorLaw.js rot[0]) and its `scale` - or null for a
 * box that is no door's.
 */
export function decorDoorFit(doorway, box, flip = false) {
  if (!doorway || !Array.isArray(box) || box.length < 6) return null;
  const [x0, y0, z0, x1, y1, z1] = box;
  const wx = x1 - x0, wz = z1 - z0, high = y1 - y0;
  if (!(high > 0) || !(Math.max(wx, wz) > 0)) return null;
  const n = doorway.normal;
  const alongX = wx >= wz;
  // world = Ry(yaw) * local (world/mat4.js trs): local Z goes to (sin, 0, cos), local X to (cos, 0, -sin)
  let yaw = alongX ? Math.atan2(n[0], n[2]) : Math.atan2(-n[2], n[0]);
  if (flip) yaw += Math.PI;
  const wide = alongX ? wx : wz;
  const fit = Math.min(doorway.width / wide, (doorway.height - DOOR_FIT_GAP) / high);
  const scale = Math.min(DECOR_SCALE_MAX, Math.max(DECOR_SCALE_MIN, fit));
  const mx = ((x0 + x1) / 2) * scale, mz = ((z0 + z1) / 2) * scale;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let deg = (yaw * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  return {
    pos: [doorway.center[0] - (c * mx + s * mz), doorway.center[1] - y0 * scale, doorway.center[2] - (-s * mx + c * mz)],
    yaw: Math.round(deg * 10) / 10 + 0,   // never -0
    scale,
    // AUDIT: whether the door, so sized, closes the opening - scaled whole, a door in an opening much wider than itself
    // (an arch) leaves a gap either side that parts no room and stops nobody
    fills: doorway.width - wide * scale <= DOOR_FILL_SLACK,
  };
}

/** A DOORWAY'S MARK: the quad that fills its opening (the tool's decal pass - combat/blood/bloodDecals.js writeDecalQuad's
 *  shape: `pos` its middle, `size` its height, `stretch` its width over its height, `right` across it, `up`). */
export function decorDoorwayQuad(w) {
  const high = Math.min(w.height, DOORWAY_MARK_HIGH);
  return {
    pos: [w.center[0], w.center[1] + high / 2, w.center[2]],
    size: high,
    stretch: w.width / high,
    right: [w.normal[2], 0, w.normal[0]],
    up: [0, 1, 0],
  };
}
