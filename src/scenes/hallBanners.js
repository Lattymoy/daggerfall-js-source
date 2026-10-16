// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1d (2026-09-30, Mac: "Lets do this") — A GUILD'S BANNERS AT ITS
// HALL'S DOOR (bible/11-Multiplayer/Seats-Arc.md 3.4: "two flanking the
// palace's door (the building record's position and facing)" - a
// seat's anchor, and the hall's first: SEAT1a's town anchors take the
// same measure).
//
// A hall whose guild has chosen its heraldry hangs two banners, one each
// side of its door: the door is the building's first door record (the
// model's own, measured where the pixel is built - scenes/world.js
// `homeFrames` - as two opposite corners in the pixel's frame), its span
// the wall's direction and its face the side away from the building's
// middle. The cloth hangs BANNER_OUT_M off the wall, its top
// BANNER_TOP_M over the door's foot, BANNER_SIDE_GAP_M beyond each jamb.
// A hall with no heraldry, or a building whose door the build did not
// measure, hangs none.
//
// Online alone (the town's homes are the account service's). Four
// hosts: world.js WIRED (the streets); worldModes.js and dungeonContext.js
// stand no street; exterior.js (the bench) not wired - it draws no online homes.
// ═══════════════════════════════════════════════════════════════════
import { heraldryKey } from '../net/heraldryLaw.js';   // GUILD2c: a banner's whole arms as its key
import { BANNER_W_M, BANNERS_MAX } from '../render/bannerPass.js';
import { doorFaceSign } from '../systems/siegeField.js';

/** The cloth's top over the door's foot, its gap beyond each jamb, and how far it hangs off the wall - metres. */
export const BANNER_TOP_M = 3.5;
export const BANNER_SIDE_GAP_M = 0.35;
export const BANNER_OUT_M = 0.15;
/** How often the town's halls are read again for their banners (the registry's version moving reads them at once). */
export const BANNER_REFRESH_MS = 1000;

/** A door record's two opposite corners (`vert0`, `vert2`, the model's own space) through a column-major `matrix`: the
 *  pixel-local points, or null. Pure. */
export function doorCornersOf(door, matrix) {
  const v0 = door?.vert0, v2 = door?.vert2;
  if (!v0 || !v2 || !matrix) return null;
  const m = matrix;
  const at = (v) => [m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12], m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13], m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14]];
  const a = at(v0), b = at(v2);
  return [...a, ...b].every(Number.isFinite) ? { a, b } : null;
}

/** CASTLE-GATE (AUDIT G1): a door record's outward normal (`normal`, the model's own space - world/meshReader.js, the one
 *  DFU's exit landing steps out along: player/enterExit.js doorWorldNormal) through a column-major `matrix`'s rotation
 *  alone (no translation), unit length, pixel-local - or null. Pure. */
export function doorNormalOf(door, matrix) {
  const n = door?.normal;
  if (!n || !matrix) return null;
  const m = matrix;
  const v = [m[0] * n.x + m[4] * n.y + m[8] * n.z, m[1] * n.x + m[5] * n.y + m[9] * n.z, m[2] * n.x + m[6] * n.y + m[10] * n.z];
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-9 ? v.map((c) => c / l) : null;
}

/**
 * THE TWO ANCHORS beside a hall's door - `frame` its `{ box, door: { a, b } }` in the pixel's frame (a castle's entrance's
 * also its `normal`, CASTLE-GATE). Each is the cloth's top edge's middle (`top`), the wall's direction (`right`) and the
 * face it hangs out along (`out`), pixel-local. Null for a door narrower than a man or none. Pure.
 */
export function hallBannerAnchors(frame) {
  const d = frame?.door;
  const box = frame?.box;
  if (!d || !Array.isArray(box) || box.length < 6) return null;
  let rx = d.b[0] - d.a[0], rz = d.b[2] - d.a[2];
  const w = Math.hypot(rx, rz);
  if (!(w >= 0.3)) return null;
  rx /= w; rz /= w;
  const cx = (d.a[0] + d.b[0]) / 2, cz = (d.a[2] + d.b[2]) / 2;
  const foot = Math.min(d.a[1], d.b[1]);
  // the face: square to the door's span, away from the building's middle - CASTLE-GATE (AUDIT G1): along the door's own
  // outward normal where the frame carries it (a castle's entrance)
  const [ox, oz] = doorFaceSign(-rz, rx, cx, cz, box, frame.normal);
  // AUDIT GUILD1d R4: the cloth's width runs from its face, never from the door record's own vertex order - under the
  // port's mirrored projection one of the two orders drew the device mirror-imaged
  rx = 0 - oz; rz = ox + 0;   // (+0: never a signed zero)
  const side = w / 2 + BANNER_SIDE_GAP_M + BANNER_W_M / 2;
  return [-1, 1].map((s) => ({
    top: [cx + rx * side * s + ox * BANNER_OUT_M, foot + BANNER_TOP_M, cz + rz * side * s + oz * BANNER_OUT_M],
    right: [rx, 0, rz], out: [ox, 0, oz],
  }));
}

/** A heraldry's texture key. */
// GUILD2c: a divided or recoloured banner keys by its whole arms (heraldryLaw.js heraldryKey) - two banners sharing a field,
// a border and a device but parted differently are two textures; a plain banner (and a seat's device-less cloth) keeps
// GUILD1d's key, so every texture already cached keeps its name
export const bannerKeyOf = (h) => (h?.division || h?.charge ? heraldryKey(h) : `${h.field}|${h.border}|${h.device}`);

/**
 * THE STREETS' BANNERS. `deps`: `built()` the world's built pixels (each `{ px, py, homeTown, homeFrames }`), `homes` the
 * online homes' registry (systems/online/onlineHomes.js: homeAt, version), `translation(px, py)` a pixel's place in the scene
 * now, `eye()` where the view stands (the nearest first when there are more than a frame draws), `now()` ms.
 * `list()` answers this frame's banners for render/bannerPass.js.
 */
export function createHallBanners({ built, homes, translation, eye = () => null, now = () => Date.now() }) {
  /** @type {{px: number, py: number, a: any, key: string, heraldry: any, phase: number}[]} */
  let held = [];
  let at = -Infinity;
  let seen = -1;
  // AUDIT SEATS-3 C4: THE LIST HANDED OUT IS KEPT, as the seats' (seatBanners.js, AUDIT-SEATS C12) - one banner object
  // each, made at a read and its top refilled in place each frame; the nearest BANNERS_MAX chosen into one kept array
  /** @type {any[]} */
  let outs = [];
  /** @type {any[]} */
  const nearest = [];
  let eyeAt = null;
  const byEye = (x, y) => Math.hypot(x.top[0] - eyeAt[0], x.top[2] - eyeAt[2]) - Math.hypot(y.top[0] - eyeAt[0], y.top[2] - eyeAt[2]);
  function read() {
    const out = [];
    for (const [, p] of built?.() ?? []) {
      if (!p?.homeTown || !p.homeFrames) continue;
      for (const [bk, frame] of p.homeFrames) {
        const h = homes?.homeAt?.(p.homeTown, bk)?.hall?.heraldry ?? null;
        if (!h) continue;
        const anchors = hallBannerAnchors(frame);
        if (!anchors) continue;
        anchors.forEach((a, i) => out.push({ px: p.px, py: p.py, a, key: bannerKeyOf(h), heraldry: h, phase: (bk % 13) * 0.7 + i * 1.9 }));
      }
    }
    held = out;
    outs = held.map((b) => ({ key: b.key, heraldry: b.heraldry, phase: b.phase, top: [0, 0, 0], right: b.a.right, out: b.a.out }));
  }
  return {
    list() {
      const v = homes?.version?.() ?? 0;
      if (v !== seen || now() - at >= BANNER_REFRESH_MS) { read(); seen = v; at = now(); }
      if (!held.length) return outs;   // (empty)
      for (let i = 0; i < held.length; i++) {
        const b = held[i], t = translation(b.px, b.py), top = outs[i].top;
        top[0] = t[0] + b.a.top[0]; top[1] = t[1] + b.a.top[1]; top[2] = t[2] + b.a.top[2];
      }
      if (outs.length <= BANNERS_MAX) return outs;
      const e = eye();
      nearest.length = 0;
      for (const o of outs) nearest.push(o);
      if (e) { eyeAt = e; nearest.sort(byEye); }
      nearest.length = BANNERS_MAX;
      return nearest;
    },
  };
}
