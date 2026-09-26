// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1 (2026-09-25) — A PIECE OF DECOR: WHAT IT IS, WHERE IT STANDS,
// WHAT IT COST.
//
// Mac, on the file attached (Kaedius's Decorator 0.2.2): "building our
// own unique version instead of porting"; decor is "Gold per placement";
// asked, the catalogue holds "Everything Daggerfall furnishes", a piece
// is priced "By size" (moving or turning it is free, removing it gives
// half back), the decorator opens from "A UI element that can be
// clicked to open the decorate panel. Allows free cam mode for
// placement and an intuitive scrolling menu with filters", and it works
// in the offline house and ship too, "kept in the save".
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/decor.js), which keeps an online home's pieces so
// every visitor sees them, and the client, which keeps the offline
// house's and ship's in the save. Pure: no clock, no DOM, no network.
//
// A PIECE is WHAT it is - one of Daggerfall's own models (an ARCH3D id)
// or one of its flats (a TEXTURE archive and record) - and never changes
// once placed; and WHERE it stands - its position from the building's
// own origin (the door matrix's translation, the scene cache's
// 'building' frame, so every client and every visit agree), its turn in
// degrees, its scale, an optional light, whether it holds things, and
// the gold it cost (half of which comes back when it is removed).
// ═══════════════════════════════════════════════════════════════════

/** How many pieces one home holds - a room full of furniture, not a frame-rate. */
export const DECOR_CAP = 200;
/** A piece's id: the client mints it (the save and the service key on the same one). */
export const DECOR_ID_RE = /^[A-Za-z0-9_-]{1,24}$/;
/** ARCH3D model ids run to six digits; TEXTURE records below 512, and archives below 512 - DECOR2c: or the port's own
 *  past them (Roleplay & Realism's weapons and armour, 513 to 526; Climates & Calories', 532 to 539), so a mounted
 *  weapon of theirs shows its own picture. */
export const DECOR_MODEL_MAX = 999_999;
export const DECOR_ARCHIVE_MAX = 999;
export const DECOR_RECORD_MAX = 511;
/** How far from the building's origin a piece may stand, on each axis, in metres - wider than any interior. */
export const DECOR_POS_MAX = 256;
export const DECOR_SCALE_MIN = 0.25;
export const DECOR_SCALE_MAX = 4;
export const DECOR_LIGHT_RANGE_MIN = 1;
export const DECOR_LIGHT_RANGE_MAX = 30;
export const DECOR_LIGHT_INTENSITY_MAX = 4;
/** The price law: by size, as Daggerfall prices a house by its model's size - gold a metre of the piece's
 *  (scaled) radius, bounded to "roughly 20 to 400 gold a piece". */
export const DECOR_PRICE_PER_METRE = 150;
export const DECOR_PRICE_MIN = 20;
export const DECOR_PRICE_MAX = 400;
/** Writes an account may make an hour (a place, a move, a removal each count) - a room is furnished in a few
 *  hundred, and this stops a script, not a decorator. */
export const DECOR_OPS_MAX = 600;
export const DECOR_OPS_WINDOW_S = 3600;

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const round = (v, places) => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};
const triple = (a, max) => Array.isArray(a) && a.length === 3 && a.every((v) => fin(v) && Math.abs(v) <= max);

/** DECOR2a: item template ids run below ten thousand (Daggerfall's 288, the port's own above them). */
export const DECOR_TEMPLATE_MAX = 9_999;

/**
 * DECOR2a: THE OWNER'S OWN ITEM a piece shows - never free text, only the game's own numbers, which every client names
 * and draws from its own data: the template `t`, and what makes it that item - its group `g` (Daggerfall's ItemGroups
 * number: a plant's name hangs on it), its material `m`, variant `v`, artifact `a` and message `p` (a painting's
 * picture, a book's title) - each null when it has none. Or null.
 */
export function decorItemOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { t, g = null, m = null, v = null, a = null, p = null } = raw;
  const small = (x, max) => x === null || (Number.isSafeInteger(x) && x >= 0 && x <= max);
  if (!Number.isSafeInteger(t) || t < 0 || t > DECOR_TEMPLATE_MAX) return null;
  if (!small(g, 63) || !small(m, 0xffff) || !small(v, 255) || !small(a, 255) || !small(p, 0xffff)) return null;
  return { t, g, m, v, a, p };
}

/** DECOR2b: Daggerfall's ItemGroups.Furniture - the furnisher's pieces, whose shape the owner chooses among the
 *  game's own models. */
export const DECOR_FURNITURE_GROUP = 8;
/** DECOR2c: Daggerfall's ItemGroups.Weapons and .Armor, and the arrows (a weapon never hung). */
export const DECOR_WEAPONS_GROUP = 3;
export const DECOR_ARMOR_GROUP = 2;
export const DECOR_ARROW_TEMPLATE = 131;

/**
 * DECOR2c: A MOUNT - a piece whose item is one of the owner's weapons (arrows aside) or shields. It hangs FLAT against
 * the surface it was set on, its picture turned as `rot` says - the surface's heading and tilt, then its own turn on
 * it - where every other flat turns to the eye. Every client reads it off the item's own numbers, so a visitor sees
 * it hang as the owner hung it. ARMOR-MOUNT (2026-09-26, Mac: "Cant set down armor in house - Would be awesome to
 * display armor as well so people can run shop and show collection"): and any piece of armour - a cuirass, a helm,
 * boots - where DECOR2c hung the shields alone; it hangs as its pack picture, as a shield does.
 */
export function decorIsMount(piece) {
  const it = piece?.item;
  if (!it || piece.model != null || !Array.isArray(piece.flat)) return false;
  return (it.g === DECOR_WEAPONS_GROUP && it.t !== DECOR_ARROW_TEMPLATE) || it.g === DECOR_ARMOR_GROUP;
}

/** DECOR2c: how far a mount hangs off its surface, in metres - the blood marks' own hair (combat/bloodDecals.js
 *  SURFACE_LIFT), so it wins the depth test against the wall behind it. */
export const DECOR_MOUNT_LIFT = 0.02;
const RAD = Math.PI / 180;

/**
 * DECOR2c: A MOUNT'S FRAME from its turn [heading, tilt, spin], degrees: `normal` out of the surface toward whoever
 * faces it (the eye's own lookDir: the heading about up, the tilt up from level), and `right` and `up` in the surface
 * as that viewer reads the picture - right to their right, up the wall (up a floor, away from them) - both spun about
 * the normal, a positive spin clockwise as they see it.
 */
export function decorMountFrame(rot) {
  const [yaw, pitch, spin] = [0, 1, 2].map((i) => (Number.isFinite(rot?.[i]) ? rot[i] * RAD : 0));
  const cp = Math.cos(pitch);
  const normal = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  const r0 = [-Math.cos(yaw), 0, Math.sin(yaw)];
  const u0 = [r0[1] * normal[2] - r0[2] * normal[1], r0[2] * normal[0] - r0[0] * normal[2], r0[0] * normal[1] - r0[1] * normal[0]];   // r0 x normal
  const c = Math.cos(spin);
  const s = Math.sin(spin);
  return {
    normal,
    right: [r0[0] * c - u0[0] * s, r0[1] * c - u0[1] * s, r0[2] * c - u0[2] * s],
    up: [u0[0] * c + r0[0] * s, u0[1] * c + r0[1] * s, u0[2] * c + r0[2] * s],
  };
}

/** WHAT a piece is - `{ model, flat: null }` or `{ model: null, flat: [archive, record] }` - or null. DECOR2a: a flat
 *  may be the owner's own item, `item` its descriptor (decorItemOf), carried only when it is one. DECOR2b: a model may
 *  be one too, when the item is a piece of furniture (its group Daggerfall's Furniture) - a delivered table takes the
 *  shape of one of the game's own; any other own item stands as its own picture, a flat. */
export function decorWhatOf(raw) {
  const model = raw?.model ?? null;
  const flat = raw?.flat ?? null;
  const item = raw?.item ?? null;
  if (flat === null && Number.isSafeInteger(model) && model > 0 && model <= DECOR_MODEL_MAX) {
    if (item === null) return { model, flat: null };
    const own = decorItemOf(item);
    return own && own.g === DECOR_FURNITURE_GROUP ? { model, flat: null, item: own } : null;
  }
  if (model === null && Array.isArray(flat) && flat.length === 2
    && Number.isSafeInteger(flat[0]) && flat[0] >= 0 && flat[0] <= DECOR_ARCHIVE_MAX
    && Number.isSafeInteger(flat[1]) && flat[1] >= 0 && flat[1] <= DECOR_RECORD_MAX) {
    if (item === null) return { model: null, flat: [flat[0], flat[1]] };
    const own = decorItemOf(item);
    return own ? { model: null, flat: [flat[0], flat[1]], item: own } : null;
  }
  return null;
}

/** A light a piece carries, projected - `{ color: [r,g,b] 0..1, range, intensity }` - or null for a bad one. */
export function decorLightOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { color, range, intensity } = raw;
  if (!Array.isArray(color) || color.length !== 3 || !color.every((c) => fin(c) && c >= 0 && c <= 1)) return null;
  if (!fin(range) || range < DECOR_LIGHT_RANGE_MIN || range > DECOR_LIGHT_RANGE_MAX) return null;
  if (!fin(intensity) || intensity <= 0 || intensity > DECOR_LIGHT_INTENSITY_MAX) return null;
  return { color: color.map((c) => round(c, 3)), range: round(range, 2), intensity: round(intensity, 2) };
}

/**
 * WHERE a piece stands and what it cost - the half a move may change - projected and rounded (a millimetre, a tenth
 * of a degree; `rot` is [yaw, pitch, roll]), or null. `light` null is no light; `storage` whether it holds things.
 */
export function decorPlaceOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { pos, rot, scale, light = null, storage = false, paid } = raw;
  if (!triple(pos, DECOR_POS_MAX) || !triple(rot, 180)) return null;
  if (!fin(scale) || scale < DECOR_SCALE_MIN || scale > DECOR_SCALE_MAX) return null;
  if (typeof storage !== 'boolean') return null;
  if (!Number.isSafeInteger(paid) || paid < 0 || paid > DECOR_PRICE_MAX) return null;
  const lit = light === null ? null : decorLightOf(light);
  if (light !== null && !lit) return null;
  return { pos: pos.map((v) => round(v, 3)), rot: rot.map((v) => round(v, 1)), scale: round(scale, 3), light: lit, storage, paid };
}

/** A WHOLE piece - its id, what it is, where it stands - projected, or null. DECOR2a: the owner's own item costs
 *  nothing to stand (Mac: "Free and can be picked back up") and holds nothing - it IS a thing, not a place to keep
 *  things - so one that says it cost gold (half of it would come back at a sale) or holds things is no piece. */
export function decorPieceOf(raw) {
  if (typeof raw?.id !== 'string' || !DECOR_ID_RE.test(raw.id)) return null;
  const what = decorWhatOf(raw);
  const place = decorPlaceOf(raw);
  if (!what || !place || (what.item && (place.paid !== 0 || place.storage))) return null;
  return { id: raw.id, ...what, ...place };
}

/** THE PRICE: by the piece's size - its radius in metres, times its scale - bounded; 0 for a size nobody can read. */
export function decorPrice(radiusMetres, scale = 1) {
  if (!fin(radiusMetres) || radiusMetres <= 0 || !fin(scale) || scale <= 0) return 0;
  return Math.min(DECOR_PRICE_MAX, Math.max(DECOR_PRICE_MIN, Math.round(DECOR_PRICE_PER_METRE * radiusMetres * scale)));
}

/** What removing a piece gives back: half of what it cost. */
export const decorRefund = (paid) => Math.trunc((Number.isSafeInteger(paid) && paid > 0 ? paid : 0) / 2);
/** DECOR1e: what a sold room's pieces give back - each one's half, as removing it would (the account service sums an
 *  online home's the same way, server-account/src/homes.js releaseHome). */
export const decorSaleBack = (pieces) => (Array.isArray(pieces) ? pieces : []).reduce((n, p) => n + decorRefund(p?.paid), 0);

/**
 * A NEW SCALE for a placed piece: grown, the difference is paid; shrunk, half the difference comes back (as removing
 * gives half back). Answers `{ pay, refund, paid }` - `paid` the piece's new cost.
 */
export function decorRescale(radiusMetres, paid, scale) {
  const now = decorPrice(radiusMetres, scale);
  const was = Number.isSafeInteger(paid) && paid > 0 ? paid : 0;
  if (now >= was) return { pay: now - was, refund: 0, paid: now };
  return { pay: 0, refund: Math.trunc((was - now) / 2), paid: now };
}

/** A fresh piece id - twelve base-36 characters, the client's own (the save and the service key on it). */
export function mintDecorId(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(rand() * 36).toString(36);
  return s;
}
