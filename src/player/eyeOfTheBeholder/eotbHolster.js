// @ts-check
// BACK-HOLSTER (2026-10-30): a sheathed weapon on an Eye Of The Beholder sprite's back, for my body (eotbBody.js) and
// every walker (peerRiders.js). Not the mod's; the Morrowind body has its own (weaponSheathing.js).
// The picture is the weapon's own paper-doll art, loaded at run time from the player's data, stood upright.
// It hangs on a line across the back, right shoulder to left hip, turned with the picture's facing (portrayedYaw), so
// it snaps with the eight views. From behind it slants one way, from the front the other way and mirrored, from the
// side it stands upright, shorter, just past the painted back. Except from behind it stands behind the body's card.

import { EOTB_FIGURE, auraSpriteAcross } from '../../render/auraRing.js';
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
 *  right shoulder; `back` behind the body's middle; `clear` past the painted back in a side view (the picture's own
 *  depth, spriteMarks' chestHalf); `over` the share of the weapon's height over the shoulder line; `nudge` toward the
 *  eye where the eye sees the back, else away, so from the front and the side the card covers it where they meet. */
export const BACK_HOLSTER = Object.freeze({ tilt: 35 * Math.PI / 180, back: 0.16, clear: 0.03, over: 0.25, nudge: 0.03 });
/** A weapon picture's metres a pixel: the paper doll's scale (a 140 px claymore, a 174 px staff). */
export const PAPERDOLL_MPP = 0.01;
/** How many weapon pictures a store keeps uploaded - one a weapon seen; the least recently asked goes first. */
export const HOLSTER_ART_KEPT = 8;
/** AUDIT BACK-HOLSTER A1: past HOLSTER_ART_KEPT, only a picture unasked this long goes - a crowd of more weapons than
 *  the store keeps grows it, never takes its turn evicting a picture still on screen. */
export const HOLSTER_ART_HOLD_MS = 2000;
/** AUDIT BACK-HOLSTER A3: a picture that did not come (none, too slow, a decode error) is asked again after this. */
export const HOLSTER_RETRY_MS = 30000;
/** The owner a holster or a glow of MY body is listed under - the aura host's own wearer's id (scenes/auraHost.js). */
export const SELF_OWNER = 'self';

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

/** EQUIP_SLOTS.LeftHand - a literal, as HOLSTER_HAND_SLOT is. */
export const HOLSTER_LEFT_SLOT = 21;
/** The weapon in a look's items (net/wire.js validLookItem) in the hand in use - the left with the pose's `lh` - or null. */
export const holsterItemOfLook = (items, left = false) => (Array.isArray(items)
  ? items.find((it) => it?.equipSlot === (left ? HOLSTER_LEFT_SLOT : HOLSTER_HAND_SLOT)) ?? null : null);

/**
 * A weapon picture's long axis (the straight line through the most opaque pixels), the widest end toward +s: its mean
 * (mx, my), the axis u and the across r (u turned a quarter clockwise), the opaque pixels' extents along (s0..s1) and
 * across (w0..w1), and `rho`, the line's offset along its normal (nx, ny) from the mean. Null with fewer than four
 * opaque pixels. Pure (LAYERED-WEAPONS holds the same picture in the hand, layeredWeapon.js heldPicture).
 * @param {{width:number,height:number,colors:ArrayLike<number>}} img
 */
export function weaponPictureAxis(img) {
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
  return { mx, my, ux, uy, rx, ry, s0, s1, w0, w1, nx: COS[a], ny: SIN[a], rho: (best % (2 * R + 1)) - R };
}

/**
 * A weapon picture stood upright: its long axis (the opaque pixels' principal axis) turned to the vertical, the widest
 * end on top, resampled at the sprites' pixel size (EOTB_FIGURE.mpp over PAPERDOLL_MPP source pixels a texel; a texel
 * takes its opaque samples' mean where three of nine are opaque). `img` and the answer are color32 RGBA bytes, row 0
 * the bottom. `mirror` is the same columns reversed. `w` and `h` are the quad in metres on a figure the sets' size.
 * Null with fewer than four opaque pixels. Pure.
 * @param {{width:number,height:number,colors:ArrayLike<number>}} img
 */
export function uprightWeaponPicture(img) {
  const ax = weaponPictureAxis(img);
  if (!ax) return null;
  const W = img.width | 0, H = img.height | 0, src = img.colors, { mx, my, ux, uy, rx, ry, s0, s1, w0, w1 } = ax;
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
 * One layer's weapon pictures: `ensure(item, identity)` answers `{ archive, w, h }` once that weapon's picture is up,
 * else null - in flight, or none to be had (asked again after HOLSTER_RETRY_MS). Keyed by the pack's (archive, record,
 * dye): two weapons that look alike share one upload. HOLSTER_ART_KEPT stay uploaded, more while more are asked (EVERY
 * ALLOCATION HAS AN OWNER); one the renderer let go under another store is uploaded again from the kept pixels.
 * @param {() => any} getRenderer @param {(item: any, identity: any) => Promise<any>} [load] @param {() => number} [clock]
 */
export function createHolsterArt(getRenderer, load = loadHolsterPicture, clock = () => Date.now()) {
  /** @type {Map<string, { at: number, v: any }>} icon key -> { at: last asked, v: Promise in flight | { archive, w, h, pic } | { failedAt } } */
  const art = new Map();
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
  function evict(renderer, now) {
    for (const [k, slot] of art) {   // the least recently asked first
      if (art.size <= HOLSTER_ART_KEPT || now - slot.at < HOLSTER_ART_HOLD_MS) return;
      art.delete(k);
      if (slot.v?.archive) for (const rec of [0, 1]) renderer?.evictTexture?.(`${slot.v.archive}_${rec}`);
    }
  }
  return {
    ensure(item, identity) {
      const renderer = getRenderer();
      const key = item && typeof item === 'object' && renderer ? keyOf(item, identity) : null;
      if (!key) return null;
      const now = clock();
      let slot = art.get(key);
      if (slot) {
        art.delete(key); art.set(key, slot); slot.at = now;   // the most recently asked, last - in flight or failed too
        const v = slot.v;
        if (v instanceof Promise || now - v.failedAt < HOLSTER_RETRY_MS) return null;
        if (v.archive) {
          if (renderer.textures?.has && !renderer.textures.has(`${v.archive}_0`)) upload(renderer, v);
          return v;
        }
      } else art.set(key, (slot = { at: now, v: null }));
      const s = slot, failed = () => { if (art.get(key) === s && s.v === p) s.v = { failedAt: clock() }; };
      const p = Promise.resolve().then(() => load(item, identity)).then((pic) => {
        if (art.get(key) !== s || s.v !== p) return;   // let go while in flight - never uploaded
        const r = getRenderer();
        if (!pic || !r) { failed(); return; }
        const a = { archive: holsterArtArchive(key), w: pic.w, h: pic.h, pic };
        upload(r, a);
        s.v = a;
      }, failed);
      s.v = p;
      evict(renderer, now);
      return null;
    },
    /** The pictures this store holds, uploaded or not (the pins). */
    get size() { return art.size; },
  };
}

/** One sprite's holster: its batch, the basis it is drawn on and the scratch its placement is written to; `owner` the
 *  wearer's id its aura is drawn under (SELF_OWNER mine). */
export function createSpriteHolster(owner = null) {
  return {
    owner, batch: null, list: [],            // the billboard, and the one-element list drawBillboards takes
    right: [1, 0, 0], up: [0, 1, 0], origin: [0, 0, 0], mid: [0, 0, 0],
    w: 0, h: 0, fullH: 0, mirror: false, archive: null, cellW: 0, cellH: 0,   // BACK-HOLSTER GLOW: its picture's pixels
  };
}

/**
 * Where the weapon hangs this frame, written into `l`: `fig` the sprite as drawn (eotbBody figure() / peerRiders
 * figureOf: its quad's foot over the feet `base`, its metres a pixel `mpp`, its `marks`, its offset along the view's
 * right `shift`), `view` its eight-way view, `feet` and `eye` in the world, `camRight` the view's right, `art` the
 * picture's quad in metres on a figure the sets' size, `B` the hang (BACK_HOLSTER; eotbQuiver.js BACK_QUIVER). Answers
 * `l`, or null when it cannot hang (no figure, no line of sight). Pure but for `l`.
 * @param {any} l @param {any} fig @param {number} view @param {any} feet @param {any} eye @param {any} camRight @param {any} art
 * @param {{ tilt: number, back: number, clear: number, over: number, nudge: number, side?: number }} [B] */
export function hangSpriteHolster(l, fig, view, feet, eye, camRight, art, B = BACK_HOLSTER) {
  if (!fig || !(fig.mpp > 0) || !Number.isInteger(view) || !eye || !art) return null;
  const toEye = [eye[0] - feet[0], 0, eye[2] - feet[2]];
  const yaw = portrayedYaw(view, toEye);
  if (yaw === null) return null;
  const m = fig.mpp * (fig.marks?.art > 0 ? fig.marks.art : 1), k = m / EOTB_FIGURE.mpp;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;   // the picture's forward, and its right
  const L = art.h * k, st = Math.sin(B.tilt), ct = Math.cos(B.tilt);
  const rec = RECORD_OFFSETS[((view % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS];
  // the line's middle: on the painted body's middle across the card (the cape's law), behind the body - from the side
  // just past its painted back, as deep as the picture draws it - its upper end over the shoulders; QUIVER: `side` toward
  // the body's right, as the view sees it (its depth unmoved, so the card still covers it from the side)
  const across = auraSpriteAcross(fig) + (B.side ?? 0) * k * (rx * camRight[0] + rz * camRight[2]), half = fig.marks?.chestHalf;
  const back = rec === 2 && Number.isFinite(half) ? half * fig.mpp + B.clear * k : B.back * k;
  const nudge = (rec >= 3 ? B.nudge : -B.nudge) * k;
  const top = fig.base + EOTB_FIGURE.shoulder * m + B.over * L * ct;
  const el = Math.hypot(toEye[0], toEye[2]) || 1;
  const cx = feet[0] + camRight[0] * across - fx * back + (toEye[0] / el) * nudge;
  const cy = feet[1] + top - 0.5 * L * ct;
  const cz = feet[2] + camRight[2] * across - fz * back + (toEye[2] / el) * nudge;
  // the line laid into the view plane (the view's right, the world's up): its slant and its length as seen
  const dx = (rx * st) * camRight[0] + (rz * st) * camRight[2], dy = ct;
  const len = Math.hypot(dx, dy), ax = dx / len, ay = dy / len;
  const up = l.up, right = l.right;
  up[0] = camRight[0] * ax; up[1] = ay; up[2] = camRight[2] * ax;
  right[0] = camRight[0] * ay; right[1] = -ax; right[2] = camRight[2] * ay;
  l.w = art.w * k; l.fullH = L; l.h = L * len;
  l.origin[0] = cx - up[0] * l.h * 0.5; l.origin[1] = cy - up[1] * l.h * 0.5; l.origin[2] = cz - up[2] * l.h * 0.5;
  l.mid[0] = cx; l.mid[1] = cy; l.mid[2] = cz;
  l.mirror = rec < 2;   // seen from the front or its three-quarter the weapon shows its other face
  l.archive = art.archive ?? null;
  l.cellW = art.pic?.width ?? 0; l.cellH = art.pic?.height ?? 0;
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
  // AUDIT BACK-HOLSTER A4: the cull's sphere stands upright over the foot (render/bounds.js batchSphere); the weapon
  // leans off it, its middle as far from the sphere's as the slant moves it
  if (b.bounds) b.bounds[3] = Math.hypot(l.w, l.h) * 0.5 + 0.5 * l.h * Math.hypot(l.up[0], l.up[1] - 1, l.up[2]);
  return b;
}

/** EVERY ALLOCATION HAS AN OWNER: the batch freed; the picture stays with its store. Safe on one never drawn. */
export function dropSpriteHolster(l, renderer) {
  if (!l?.batch) return;
  renderer?.destroyBillboardBatch?.(l.batch);
  l.batch = null;
  l.list.length = 0;
}

// OVER THE AURA (2026-10-30, Mac: "if a cape aura is present, the holster should appear over the aura"). The auras
// draw after the bodies, added light that writes no depth, so the Shadow Cloak's cape glowed over the weapon. The aura
// pass (scenes/auraHost.js) draws the frame's holsters again after itself, each owner's list of what it drew this
// frame: at LEQUAL each passes exactly where it stood and stays hidden where the body hid it.
/** Draw again, over what was drawn since them, the holsters in `lists` (eotbBody and the walkers' holstersDrawn) whose
 *  owner `keep` takes (null: all): the depth test LEQUAL, no second shadow, the baseline LESS given back. Answers how many. */
export function redrawHolstersOver(renderer, keep, ...lists) {
  const gl = renderer?.gl;
  if (!gl || !lists.some((l) => l?.length)) return 0;
  let n = 0;
  gl.depthFunc(gl.LEQUAL);
  try {
    for (const list of lists) {
      for (const l of list ?? []) {
        const b = l?.batch;
        if (!b || b._dead || (keep && !keep(l.owner))) continue;
        b.noShadow = true;
        renderer.drawBillboards(l.list, l.right, l.up);
        b.noShadow = false;
        n++;
      }
    }
  } finally { gl.depthFunc(gl.LESS); }
  return n;
}

/** AUDIT BACK-HOLSTER A2: OVER ITS OWN AURA, UNDER A NEARER ONE. The auras drawn farthest first, in runs, and each
 *  sprite's back (its weapon drawn again, its glows) straight after its own: a nearer wearer's cape, which writes no
 *  depth, lay under every weapon drawn after the whole pass. `wearers` nearest first (auraWearers' order);
 *  `drawAuras(run)` draws a nearest-first run, answering how many; `hasBacks(w)` and `drawBacks(w)` a wearer's. */
export function drawAurasThenBacks(wearers, drawAuras, hasBacks, drawBacks, run = []) {
  let drawn = 0, hi = wearers.length - 1;
  for (let i = hi; i >= 0; i--) {
    if (i > 0 && !hasBacks(wearers[i])) continue;
    run.length = 0;
    for (let j = i; j <= hi; j++) run.push(wearers[j]);
    drawn += drawAuras(run);
    if (hasBacks(wearers[i])) drawBacks(wearers[i]);
    hi = i - 1;
  }
  return drawn;
}
