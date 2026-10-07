// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") — A SEAT TOWN'S BANNERS
// (bible/11-Multiplayer/Seats-Arc.md 3.4).
//
// The anchors, derived from the town's own layout, at most
// SEAT_BANNERS_MAX (8) a town, in this order:
//   1. two flanking the palace's door - its building's first door record,
//      measured where the pixel is built (scenes/world.js `homeFrames`),
//      the same measure the guild halls' banners take
//      (scenes/hallBanners.js hallBannerAnchors);
//   2. one beside each city gate (world/rmbLayout.js isCityGate), on its
//      town side, at a post;
//   3. one pennant above each Notice Board - a town's RUMOUR boards, every
//      board BOUNTY1 did not take (systems/bountyBoard.js
//      questBoardIndices).
// and CASTLE-GATE (2026-10-02): a crown seat's two more flanking its
// castle's entrance in the city - the lowest of the pixel's dungeon-
// entrance doors (systems/siegeField.js castleEntranceOf), after the
// palace's two. A town that is no seat, or whose seats are not open to
// this account, hangs none.
//
// THE BANNER: while a seat is unheld, the kingdom's plain banner - the
// crown's metal, no device; a March's its two claimants' metals; a Free
// Land's nothing (net/townSeatLaw.js seatPlainBanner). SEAT1c: a held
// seat hangs its holder's own heraldry in its place (seatBannerOf). The
// cloth is GUILD1d's own pass
// (render/bannerPass.js). FESTIVAL-STAGE (2026-10-02): while a Festival
// rules, its own more after them (scenes/seatFestival.js).
//
// Online alone. Four hosts: world.js WIRED (the streets); worldModes.js
// and dungeonContext.js stand no street; exterior.js (the bench) FLAGGED -
// it runs no account service, so no seat is open there.
// ═══════════════════════════════════════════════════════════════════
import { BANNER_W_M, BANNERS_MAX } from '../render/bannerPass.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { hallBannerAnchors, bannerKeyOf, BANNER_REFRESH_MS } from './hallBanners.js';
import { SEAT_BANNERS_MAX, seatBannerOf, festivalRules } from '../net/townSeatLaw.js';

/** A gate banner's top below the gate model's own top, and a board's pennant's top above the board's - metres. */
export const GATE_BANNER_DROP_M = 0.6;
export const BOARD_PENNANT_RISE_M = 3.2;
/** How far a banner hangs off the face it hangs on - metres. */
export const SEAT_BANNER_OUT_M = 0.2;

/** The building keys of a laid-out town's Palace records (buildingType 16) - its blocks' own building data, the key
 *  every building of the pixel carries (talkTopics.js makeBuildingKey's shape: `makeKey(x, y, recordIndex)`). Pure. */
export function palaceKeysOf(blocks, makeKey) {
  const out = [];
  for (const b of blocks ?? []) {
    const list = b?.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? [];
    const count = Math.min(list.length, b?.dfBlock?.rmbBlock?.subRecords?.length ?? list.length);
    for (let i = 0; i < count; i++) if (list[i]?.buildingType === BUILDING_TYPES.Palace) out.push(makeKey(b.x ?? 0, b.y ?? 0, i));
  }
  return out;
}

/** A model's own x and z axes on the ground, unit, off its column-major matrix - or null for a degenerate one. */
function groundAxes(m) {
  const xl = Math.hypot(m[0], m[2]), zl = Math.hypot(m[8], m[10]);
  if (!(xl > 1e-6) || !(zl > 1e-6)) return null;
  return { rx: m[0] / xl, rz: m[2] / xl, fx: m[8] / zl, fz: m[10] / zl };
}
/** Half an axis-aligned box's reach along the ground direction (dx, dz). */
const halfAlong = (box, dx, dz) => (Math.abs(dx) * (box[3] - box[0]) + Math.abs(dz) * (box[5] - box[2])) / 2;

/**
 * A CITY GATE'S BANNER - `gate` its `{ local, box }` (matrix and box, pixel-local), `centre` the town's middle on the
 * ground ([x, z]). One cloth on the town side, beside the gate's post, its top below the gate's own. Null for a gate
 * whose matrix will not give a face. Pure.
 */
export function gateBannerAnchor(gate, centre) {
  const ax = groundAxes(gate?.local ?? []);
  const box = gate?.box;
  if (!ax || !Array.isArray(box) || box.length < 6) return null;
  const cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
  let ox = ax.fx, oz = ax.fz;
  if ((centre[0] - cx) * ox + (centre[1] - cz) * oz < 0) { ox = 0 - ox; oz = 0 - oz; }   // the town side (0 -: never a signed zero)
  const rx = 0 - oz, rz = ox + 0;   // (+0: never a signed zero - AUDIT GUILD1d R4's measure)
  const side = Math.max(0, halfAlong(box, rx, rz) - BANNER_W_M / 2);
  const out = halfAlong(box, ox, oz) + SEAT_BANNER_OUT_M;
  return { top: [cx + rx * side + ox * out, box[4] - GATE_BANNER_DROP_M, cz + rz * side + oz * out], right: [rx, 0, rz], out: [ox, 0, oz] };
}

/** A NOTICE BOARD'S PENNANT - `board` its `{ local, box }`: one cloth over the board, facing as the board does. Pure. */
export function boardPennantAnchor(board) {
  const ax = groundAxes(board?.local ?? []);
  const box = board?.box;
  if (!ax || !Array.isArray(box) || box.length < 6) return null;
  const cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
  return { top: [cx, box[4] + BOARD_PENNANT_RISE_M, cz], right: [ax.rx, 0, ax.rz], out: [ax.fx, 0, ax.fz] };
}

/** The town's middle on the ground, [x, z]: the mean of its buildings' own places (`homeFrames` values' `at`). */
export function townCentreOf(frames) {
  let x = 0, z = 0, n = 0;
  for (const f of frames?.values?.() ?? []) if (Array.isArray(f?.at)) { x += f.at[0]; z += f.at[2]; n++; }
  return n ? [x / n, z / n] : [0, 0];
}

/**
 * A SEAT TOWN'S ANCHORS, in the record's order, at most SEAT_BANNERS_MAX: the palace door's two (each palace, while room
 * remains), CASTLE-GATE's two at a crown's castle entrance (`castle`, its `{ door, box }` frame, or null), a banner at
 * each city gate, a pennant over each rumour board (`bounty` the boards' indices BOUNTY1 took). `frames` the pixel's
 * building frames (`homeFrames`), `palaceKeys` its palaces' building keys, `gates` and `boards` `{ local, box }`,
 * `centre` the town's middle [x, z]. Pure.
 */
export function seatBannerAnchors({ frames = null, palaceKeys = [], castle = null, gates = [], boards = [], bounty = new Set(), centre = [0, 0] } = {}) {
  const out = [];
  const add = (a) => { if (a && out.length < SEAT_BANNERS_MAX) out.push(a); };
  const pair = (frame) => { const two = hallBannerAnchors(frame); if (two && out.length + 2 <= SEAT_BANNERS_MAX) two.forEach(add); };
  for (const k of palaceKeys) pair(frames?.get?.(k));
  pair(castle);   // CASTLE-GATE: a crown's two at its castle's entrance
  for (const g of gates) add(gateBannerAnchor(g, centre));
  boards.forEach((b, i) => { if (!bounty.has(i)) add(boardPennantAnchor(b)); });
  return out;
}

/**
 * THE SEAT TOWNS' BANNERS. `deps`: `built()` the world's built pixels (each `{ px, py, homeTown, seatAnchors }`),
 * `seatAt(mapId)` the seat a town is while the seats are open to this account (else null), `translation(px, py)` a
 * pixel's place in the scene now, `eye()` where the view stands, `now()` ms, `version()` what moves the seats' answer (a
 * read of the service's list). `list()` answers this frame's banners for render/bannerPass.js.
 */
export function createSeatBanners({ built, seatAt, translation, eye = () => null, now = () => Date.now(), version = () => 0 }) {
  /** @type {{px: number, py: number, a: any, key: string, heraldry: any, phase: number}[]} */
  let held = [];
  let at = -Infinity;
  let seen = -1;
  // AUDIT-SEATS C12: THE LIST HANDED OUT IS KEPT - one banner object each, made at a read and its top refilled in place
  // each frame (the pixel's place in the scene moves with the floating origin); the nearest BANNERS_MAX chosen into one
  // kept array. A frame between reads makes no banner, no list and no slice.
  /** @type {any[]} */
  let outs = [];
  /** @type {any[]} */
  const nearest = [];
  let eyeAt = null;
  const byEye = (x, y) => Math.hypot(x.top[0] - eyeAt[0], x.top[2] - eyeAt[2]) - Math.hypot(y.top[0] - eyeAt[0], y.top[2] - eyeAt[2]);
  function read() {
    const out = [];
    for (const [, p] of built?.() ?? []) {
      if (!p?.homeTown || !p.seatAnchors?.length) continue;
      const seat = seatAt(p.homeTown);
      const h = seat ? seatBannerOf(seat) : null;   // SEAT1c: a held seat's in its holder's own colours
      if (!h) continue;
      p.seatAnchors.forEach((a, i) => out.push({ px: p.px, py: p.py, a, key: bannerKeyOf(h), heraldry: h, phase: ((p.homeTown % 11) * 0.9) + i * 1.7 }));
      // FESTIVAL-STAGE (7.6): a Festival's more, after the seat's own (scenes/seatFestival.js festivalBannerAnchors)
      if (festivalRules(seat)) (p.festivalAnchors ?? []).forEach((a, i) => out.push({ px: p.px, py: p.py, a, key: bannerKeyOf(h), heraldry: h, phase: ((p.homeTown % 11) * 0.9) + (p.seatAnchors.length + i) * 1.7 }));
    }
    held = out;
    outs = held.map((b) => ({ key: b.key, heraldry: b.heraldry, phase: b.phase, top: [0, 0, 0], right: b.a.right, out: b.a.out }));
  }
  return {
    list() {
      const v = version();
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
