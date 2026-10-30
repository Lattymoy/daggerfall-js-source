// @ts-check
// BACK-HOLSTER (2026-10-30): a sheathed weapon on an Eye Of The Beholder sprite's back, for my body (eotbBody.js) and
// every walker (peerRiders.js). Not the mod's; the Morrowind body has its own (weaponSheathing.js).
// The picture is the weapon's own paper-doll art, loaded at run time from the player's data, stood upright.
// It hangs on a line across the back, right shoulder to left hip, turned with the picture's facing (portrayedYaw), so
// it snaps with the eight views. From behind it slants one way, from the front the other way and mirrored, from the
// side it stands upright and shorter. From the front it stands behind the body's card, whose depth hides it.

import { EOTB_FIGURE } from '../../render/auraRing.js';
import { RECORD_OFFSETS, ORIENTATIONS, portrayedYaw } from './eotbBillboard.js';
import { weaponSkillUsed } from '../../characters/weapons.js';
import { SKILLS } from '../../systems/skills.js';
import { PISTOLET_TEMPLATE } from '../../characters/thunderlockIds.js';
import { drawnPiece } from '../../net/appearanceLaw.js';   // APPEARANCES: a weapon wearing a look is drawn as the look
import { inventoryItemImage } from '../../systems/item/itemTemplates.js';
import { itemIconColor32, itemIconKey } from '../../ui/item/itemIconColor32.js';

/** The weapon hand's equip slot (EQUIP_SLOTS.RightHand) - a literal, as layeredArmor.js's OUTFIT_SLOTS are, so the
 *  walkers read a look's items without the paper doll (test/player/eyeOfTheBeholder/backholster.test.js pins it). */
export const HOLSTER_HAND_SLOT = 19;

/** The hang, on a figure the sets' size (EOTB_FIGURE: 1.8 m, its shoulders at row 86). `tilt` off the spine toward the
 *  right shoulder; `back` behind the body's middle, past a side view's painted back; `over` the share of the weapon's
 *  height over the shoulder line; `toward` the eye, so from the side, edge-on to the card, it lies over the back's edge
 *  as a strap would - from the front `back` still stands it behind the card. */
export const BACK_HOLSTER = Object.freeze({ tilt: 35 * Math.PI / 180, back: 0.16, over: 0.25, toward: 0.03 });
/** A weapon picture's metres a pixel: the paper doll's scale (a 140 px claymore, a 174 px staff). */
export const PAPERDOLL_MPP = 0.01;
/** How many weapon pictures a store keeps uploaded - one a weapon seen; the least recently asked goes first. */
export const HOLSTER_ART_KEPT = 8;

const COS = Float64Array.from({ length: 180 }, (_, a) => Math.cos(a * Math.PI / 180));
const SIN = Float64Array.from({ length: 180 }, (_, a) => Math.sin(a * Math.PI / 180));
const BACK_SKILLS = new Set(/** @type {number[]} */ ([SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery]));
/** Does this weapon ride the back while sheathed? The long blades, axes, blunt weapons, staffs and bows - and the
 *  Thunderlock, fired on Archery. A short blade belongs at the hip, which this does not draw; the Pistolet too. */
export function holstersOnBack(item) {
  const t = item?.templateIndex;
  if (!Number.isInteger(t) || t === PISTOLET_TEMPLATE) return false;
  return BACK_SKILLS.has(/** @type {number} */ (weaponSkillUsed(t)));
}

/** The weapon in a look's items (net/wire.js validLookItem) - the one in the weapon hand - or null. */
export const holsterItemOfLook = (items) => (Array.isArray(items) ? items.find((it) => it?.equipSlot === HOLSTER_HAND_SLOT) ?? null : null);

/**
 * A weapon picture stood upright: its long axis (the opaque pixels' principal axis) turned to the vertical, the widest
 * end on top, resampled at the sprites' pixel size (EOTB_FIGURE.mpp over PAPERDOLL_MPP source pixels a texel; a texel
 * takes its opaque samples' mean where three of nine are opaque). `img` and the answer are color32 RGBA bytes, row 0
 * the bottom. `mirror` is the same columns reversed. `w` and `h` are the quad in metres on a figure the sets' size.
 * Null with fewer than four opaque pixels. Pure.
 * @param {{width:number,height:number,colors:ArrayLike<number>}} img
 */
export function uprightWeaponPicture(img) {
  const W = img?.width | 0, H = img?.height | 0, src = img?.colors;
  if (!(W > 0) || !(H > 0) || !src || src.length < W * H * 4) return null;
  let n = 0, mx = 0, my = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (src[(y * W + x) * 4 + 3] > 127) { n++; mx += x; my += y; }
  if (n < 4) return null;
  mx /= n; my /= n;
  // the long axis: the straight line through the most opaque pixels (a haft, a blade, a bowstring), by the degree - an
  // axe's or a mace's head would pull a mean axis off the haft
  const R = Math.ceil(Math.hypot(W, H)), votes = new Int32Array(180 * (2 * R + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[(y * W + x) * 4 + 3] <= 127) continue;
    for (let a = 0; a < 180; a++) votes[a * (2 * R + 1) + R + Math.round((x - mx) * COS[a] + (y - my) * SIN[a])]++;
  }
  let best = 0;
  for (let i = 1; i < votes.length; i++) if (votes[i] > votes[best]) best = i;
  const a = Math.floor(best / (2 * R + 1));   // the line's normal; the axis runs a quarter turn from it
  let ux = -SIN[a], uy = COS[a];
  // the extents along the axis (s) and across it (t), and the widest stretch of the eight along it
  const BINS = 8, lo = new Float64Array(BINS).fill(Infinity), hi = new Float64Array(BINS).fill(-Infinity);
  let s0 = Infinity, s1 = -Infinity;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[(y * W + x) * 4 + 3] <= 127) continue;
    const s = (x - mx) * ux + (y - my) * uy;
    if (s < s0) s0 = s;
    if (s > s1) s1 = s;
  }
  const span = Math.max(1e-6, s1 - s0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[(y * W + x) * 4 + 3] <= 127) continue;
    const dx = x - mx, dy = y - my, s = dx * ux + dy * uy, t = dy * ux - dx * uy;
    const b = Math.min(BINS - 1, Math.floor(((s - s0) / span) * BINS));
    if (t < lo[b]) lo[b] = t;
    if (t > hi[b]) hi[b] = t;
  }
  let widest = 0;
  for (let b = 1; b < BINS; b++) if (hi[b] - lo[b] > hi[widest] - lo[widest]) widest = b;
  if (widest < BINS / 2) { ux = -ux; uy = -uy; const k = s0; s0 = -s1; s1 = -k; }   // a half turn, not a mirror: the widest end up
  // across: the quad's right, (uy, -ux) - u turned a quarter clockwise, so the picture keeps its own handedness
  const rx = uy, ry = -ux;
  let w0 = Infinity, w1 = -Infinity;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[(y * W + x) * 4 + 3] <= 127) continue;
    const r = (x - mx) * rx + (y - my) * ry;
    if (r < w0) w0 = r;
    if (r > w1) w1 = r;
  }
  const step = EOTB_FIGURE.mpp / PAPERDOLL_MPP;
  const oh = Math.max(1, Math.ceil((s1 - s0 + 1) / step)), ow = Math.max(1, Math.ceil((w1 - w0 + 1) / step));
  const out = new Uint8Array(ow * oh * 4), mirror = new Uint8Array(ow * oh * 4);
  for (let row = 0; row < oh; row++) for (let col = 0; col < ow; col++) {
    let k = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const s = s0 - 0.5 + (row + (i + 0.5) / 3) * step, c = w0 - 0.5 + (col + (j + 0.5) / 3) * step;
      const x = Math.round(mx + ux * s + rx * c), y = Math.round(my + uy * s + ry * c);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const q = (y * W + x) * 4;
      if (src[q + 3] <= 127) continue;
      k++; r += src[q]; g += src[q + 1]; b += src[q + 2];
    }
    if (k < 3) continue;
    for (const [buf, cc] of /** @type {[Uint8Array, number][]} */ ([[out, col], [mirror, ow - 1 - col]])) {
      const o = (row * ow + cc) * 4;
      buf[o] = Math.round(r / k); buf[o + 1] = Math.round(g / k); buf[o + 2] = Math.round(b / k); buf[o + 3] = 255;
    }
  }
  return { width: ow, height: oh, colors: out, mirror, w: ow * step * PAPERDOLL_MPP, h: oh * step * PAPERDOLL_MPP };
}

/** The renderer's archive a weapon picture is uploaded under (record 0 as drawn, 1 mirrored) - its own, so no world
 *  flat or icon of the same record is ever replaced by it. */
export const holsterArtArchive = (iconKey) => `eotb-holster:${iconKey}`;

/** The default picture door: the weapon's own picture, as the pack draws it for its wearer (`identity`: gender and
 *  race), stood upright - or null (no picture, not in a browser). */
export async function loadHolsterPicture(item, identity) {
  return uprightWeaponPicture(/** @type {any} */ (await itemIconColor32(drawnPiece(item), { identity: identity ?? undefined })));
}

/**
 * One layer's weapon pictures: `ensure(item, identity)` answers `{ archive, w, h }` once that weapon's picture is
 * uploaded, else null - asked once, in flight, or none to be had (never asked again). The picture's key is the pack's
 * (archive, record, dye), so two weapons that look alike share one upload. HOLSTER_ART_KEPT stay uploaded (EVERY
 * ALLOCATION HAS AN OWNER); one let go by the renderer under another store is uploaded again from the kept pixels.
 * @param {() => any} getRenderer
 * @param {(item: any, identity: any) => Promise<any>} [load]
 */
export function createHolsterArt(getRenderer, load = loadHolsterPicture) {
  const art = new Map();   // icon key -> Promise in flight | { archive, w, h, pic } | null (none)
  const keys = new WeakMap();   // item -> { identity, drawn, key }: a crowd's weapons are not resolved again every frame
  const keyOf = (item, identity) => {
    const drawn = drawnPiece(item), memo = keys.get(item);   // drawnPiece keeps one object while the look stands
    if (memo && memo.identity === identity && memo.drawn === drawn) return memo.key;
    let key = null;
    try { const img = inventoryItemImage(drawn, identity ?? undefined); key = img ? itemIconKey(img) : null; } catch { key = null; }
    keys.set(item, { identity, drawn, key });
    return key;
  };
  const upload = (renderer, a) => {
    renderer.uploadTexture(a.archive, 0, { width: a.pic.width, height: a.pic.height, colors: a.pic.colors });
    renderer.uploadTexture(a.archive, 1, { width: a.pic.width, height: a.pic.height, colors: a.pic.mirror });
  };
  function evict(renderer) {
    while (art.size > HOLSTER_ART_KEPT) {
      const [k, a] = /** @type {[string, any]} */ (art.entries().next().value);
      art.delete(k);
      if (a && !(a instanceof Promise)) for (const rec of [0, 1]) renderer?.evictTexture?.(`${a.archive}_${rec}`);
    }
  }
  return {
    ensure(item, identity) {
      const renderer = getRenderer();
      const key = item && typeof item === 'object' && renderer ? keyOf(item, identity) : null;
      if (!key) return null;
      const have = art.get(key);
      if (have !== undefined) {
        if (!have || have instanceof Promise) return null;
        art.delete(key); art.set(key, have);   // the most recently asked, last
        if (renderer.textures?.has && !renderer.textures.has(`${have.archive}_0`)) upload(renderer, have);
        return have;
      }
      const p = Promise.resolve().then(() => load(item, identity)).then((pic) => {
        if (art.get(key) !== p) return;
        const r = getRenderer();
        if (!pic || !r) { art.set(key, null); return; }
        const a = { archive: holsterArtArchive(key), w: pic.w, h: pic.h, pic };
        upload(r, a);
        art.set(key, a);
      }, () => { if (art.get(key) === p) art.set(key, null); });
      art.set(key, p);
      evict(renderer);
      return null;
    },
    /** The pictures this store holds, uploaded or not (the pins). */
    get size() { return art.size; },
  };
}

/** One sprite's holster: its batch, the basis it is drawn on and the scratch its placement is written to. */
export function createSpriteHolster() {
  return {
    batch: null, list: [],            // the billboard, and the one-element list drawBillboards takes
    right: [1, 0, 0], up: [0, 1, 0], origin: [0, 0, 0], mid: [0, 0, 0],
    w: 0, h: 0, fullH: 0, mirror: false, archive: null,
  };
}

/**
 * Where the weapon hangs this frame, written into `l`: `fig` the sprite as drawn (eotbBody figure() / peerRiders
 * figureOf: its quad's foot over the feet `base`, its metres a pixel `mpp`, its `marks` and its offset along the
 * view's right `shift`), `view` the eight-way view it is painted in, `feet` and `eye` in the world, `camRight` the
 * view's right, `art` the picture's quad in metres on a figure the sets' size. Answers `l`, or null when it cannot hang
 * (no figure, no line of sight). Pure but for `l`.
 */
export function hangSpriteHolster(l, fig, view, feet, eye, camRight, art) {
  if (!fig || !(fig.mpp > 0) || !Number.isInteger(view) || !eye || !art) return null;
  const toEye = [eye[0] - feet[0], 0, eye[2] - feet[2]];
  const yaw = portrayedYaw(view, toEye);
  if (yaw === null) return null;
  const B = BACK_HOLSTER, m = fig.mpp * (fig.marks?.art > 0 ? fig.marks.art : 1), k = m / EOTB_FIGURE.mpp;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;   // the picture's forward, and its right
  const L = art.h * k, st = Math.sin(B.tilt), ct = Math.cos(B.tilt);
  // the line's middle: on the painted body's middle across the card, behind the body, its upper end over the shoulders
  const across = (fig.shift ?? 0) + (fig.marks?.chest ?? fig.marks?.head ?? 0) * m;
  const top = fig.base + EOTB_FIGURE.shoulder * m + B.over * L * ct;
  const el = Math.hypot(toEye[0], toEye[2]) || 1;
  const cx = feet[0] + camRight[0] * across - fx * B.back * k + (toEye[0] / el) * B.toward * k;
  const cy = feet[1] + top - 0.5 * L * ct;
  const cz = feet[2] + camRight[2] * across - fz * B.back * k + (toEye[2] / el) * B.toward * k;
  // the line laid into the view plane (the view's right, the world's up): its slant and its length as seen
  const dx = (rx * st) * camRight[0] + (rz * st) * camRight[2], dy = ct;
  const len = Math.hypot(dx, dy), ax = dx / len, ay = dy / len;
  const up = l.up, right = l.right;
  up[0] = camRight[0] * ax; up[1] = ay; up[2] = camRight[2] * ax;
  right[0] = camRight[0] * ay; right[1] = -ax; right[2] = camRight[2] * ay;
  l.w = art.w * k; l.fullH = L; l.h = L * len;
  l.origin[0] = cx - up[0] * l.h * 0.5; l.origin[1] = cy - up[1] * l.h * 0.5; l.origin[2] = cz - up[2] * l.h * 0.5;
  l.mid[0] = cx; l.mid[1] = cy; l.mid[2] = cz;
  // seen from the front or its three-quarter the weapon shows its other face
  l.mirror = RECORD_OFFSETS[((view % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS] < 2;
  l.archive = art.archive ?? null;
  return l;
}

/** The batch, placed where `hangSpriteHolster` put it: minted the first time, then the picture, its face and its size
 *  written through it. Answers the batch; `l.list` is `[batch]`. */
export function mintSpriteHolster(l, renderer) {
  const rec = l.mirror ? 1 : 0;
  if (!l.batch) {
    l.batch = renderer.createBillboardBatch(l.archive, rec, { w: l.w, h: l.fullH }, [[0, 0, 0]]);
    l.batch.origin = [0, 0, 0];
    l.list[0] = l.batch;
  }
  const b = l.batch;
  b.archive = l.archive; b.record = rec;
  b.size.w = l.w; b.size.h = l.h;
  b.origin[0] = l.origin[0]; b.origin[1] = l.origin[1]; b.origin[2] = l.origin[2];
  return b;
}

/** EVERY ALLOCATION HAS AN OWNER: the batch freed; the picture stays with its store. Safe on one never drawn. */
export function dropSpriteHolster(l, renderer) {
  if (!l?.batch) return;
  renderer?.destroyBillboardBatch?.(l.batch);
  l.batch = null;
  l.list.length = 0;
}
