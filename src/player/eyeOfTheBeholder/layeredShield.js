// @ts-check
// LAYERED-SHIELD (2026-10-31, the owner: "Any way we can do shields?", then "Lets try #1"): THE SHIELD ON THE LAYERED
// BODY. The art's one attack is a two-handed swing, so a shield-bearer's is one-handed: the rig names the free arm's
// outline in each swing frame (tools/layered-armor/build_weapon_rig.py SHIELD_ARM, `sa`), which comes out, and a view
// plays only the frames whose sword arm swings on its own side (SHIELD_CUTS). The shield is the paper doll's picture,
// its grip at the free hand or the guard (`sh`): its face toward the eye from the front, its inside from behind.
import { drawnPiece } from '../../net/appearanceLaw.js';
import { isChain, isShieldTemplate } from '../../systems/armorMaterials.js';
import { inventoryItemImage } from '../../systems/item/itemTemplates.js';
import { itemIconColor32 } from '../../ui/item/itemIconColor32.js';
import { removeWeapon, swingKindOf } from './layeredWeapon.js';

/** EQUIP_SLOTS.LeftHand, where a shield is worn - a literal, as layeredArmor.js OUTFIT_SLOTS are. */
export const SHIELD_SLOT = 21;
const SHAPES = Object.freeze({ 109: 'b', 110: 'r', 111: 'k', 112: 't' });   // Buckler, Round, Kite, Tower Shield
const TEMPLATES = Object.freeze({ b: 109, r: 110, k: 111, t: 112 });

/** A worn shield's code: its shape and its material ('l' leather, 'c' chain, '0'..'9' plate, Iron to Daedric) - 'k7' -
 *  or null for none. A shield wearing a look is drawn as the look (APPEARANCES). */
export function layeredShieldOf(item) {
  const it = item ? drawnPiece(item) : null;
  if (!it || (it.group != null && it.group !== 'Armor') || !isShieldTemplate(it.templateIndex)) return null;
  const m = it.material;
  return `${SHAPES[it.templateIndex]}${isChain(m) ? 'c' : Number.isInteger(m) && m >= 0x200 && m <= 0x209 ? m - 0x200 : 'l'}`;
}
/** The item a shield code is drawn as, or null. */
export function shieldItemOf(code) {
  const s = String(code ?? ''), t = TEMPLATES[s[0]], k = s.slice(1);
  if (!t || !/^[lc0-9]$/.test(k)) return null;
  return { group: 'Armor', templateIndex: t, material: k === 'c' ? 0x100 : k === 'l' ? 0 : 0x200 + Number(k) };
}
/** A shield code's paper-doll picture for this body (color32, row 0 the bottom), or null outside a browser. */
export async function loadShieldPicture(code, body) {
  const item = shieldItemOf(code), identity = { gender: body === 'female' ? 'female' : 'male' };
  const image = item ? inventoryItemImage(item, identity) : null;
  return image ? itemIconColor32(item, { identity, image }) : null;
}
/** Does `code` have a picture to wait for (one not had yet makes the frame drawn meanwhile provisional)? */
export const shieldPictureExpected = (code, body) => {
  const item = shieldItemOf(code);
  return !!item && !!inventoryItemImage(item, { gender: body === 'female' ? 'female' : 'male' });
};

/** Where the hand grips each shape, down its height: a round shield at its boss, a kite and a tower above the middle. */
const GRIP_DOWN = Object.freeze({ b: 0.5, r: 0.5, k: 0.42, t: 0.45 });
/** The inside: the face's rim, wooden boards behind it (lighter at the middle, a seam every PLANK picture px), the arm's
 *  strap and the grip across. */
const RIM = 2, RIM_SHADE = 0.8, PLANK = 6, WOOD = [104, 72, 44], SEAM = [70, 48, 30], STRAP = [50, 33, 22];
/**
 * A shield's picture as drawn (`img` color32, row 0 the bottom): its face and its inside top row first, the grip in
 * picture px. Pure.
 * @param {{width:number,height:number,colors:Uint8Array|Uint8ClampedArray}} img @param {string} code
 */
export function shieldPicture(img, code) {
  const W = img.width, H = img.height, c = img.colors, face = new Uint8Array(W * H * 4);
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = ((H - 1 - y) * W + x) * 4;
    if (c[s + 3] <= 127) continue;
    face.set([c[s], c[s + 1], c[s + 2], 255], (y * W + x) * 4);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const gx = (x0 + x1 + 1) / 2, gy = y0 + (y1 - y0 + 1) * (GRIP_DOWN[String(code)[0]] ?? 0.5), half = (x1 - x0 + 1) / 2;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && face[(y * W + x) * 4 + 3] > 0;
  const inside = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (!face[o + 3]) continue;
    let rim = false;
    for (let d = -RIM; d <= RIM && !rim; d++) rim = !solid(x + d, y) || !solid(x, y + d);
    const strap = Math.abs(y + 0.5 - gy) < 2.5 || Math.abs(y + 0.5 - (gy - (y1 - y0) * 0.22)) < 1.5;
    const k = 0.75 + 0.35 * (1 - Math.abs((x + 0.5 - gx) / half));   // the boards' curve: lighter at the middle
    const col = rim ? [face[o], face[o + 1], face[o + 2]].map((v) => v * RIM_SHADE) : strap ? STRAP
      : (Math.round(x - x0) % PLANK === 0 ? SEAM : WOOD).map((v) => v * k);
    inside.set([...col.map((v) => Math.min(255, Math.round(v))), 255], o);
  }
  return { width: W, height: H, face, inside, gx, gy };
}
const _pics = new WeakMap();   // the door -> `${body}:${code}` -> Promise of the shield's picture
/** A shield code's picture as drawn (shieldPicture), once a door, body and code - or null, asked again next time. */
export function shieldPictureOf(code, body, load = loadShieldPicture) {
  const key = `${body}:${code}`;
  let byKey = _pics.get(load);
  if (!byKey) _pics.set(load, (byKey = new Map()));
  if (!byKey.has(key)) {
    const p = Promise.resolve().then(() => load(code, body)).then((img) => (img ? shieldPicture(img, code) : null), () => null);
    byKey.set(key, p);
    p.then((pic) => { if (!pic) byKey.delete(key); });
  }
  return /** @type {Promise<any>} */ (byKey.get(key));
}

/** Per view (0 front .. 4 back): the shield's face toward the eye or its inside, over the body or behind it (open air
 *  only), and its width's share as the view turns it. From the side the free arm is the far one. */
export const SHIELD_VIEWS = Object.freeze([
  Object.freeze({ face: true, over: true, squeeze: 0.92 }),
  Object.freeze({ face: true, over: true, squeeze: 0.74 }),
  Object.freeze({ face: false, over: false, squeeze: 0.56 }),
  Object.freeze({ face: false, over: false, squeeze: 0.74 }),
  Object.freeze({ face: false, over: false, squeeze: 0.92 }),
]);
/**
 * Draw a shield into a composed frame, in place: its grip at `sh` ([x, y] and, where the frame turns it otherwise, its
 * width's share), `cm` the body's px a picture px. A px a third of whose samples fall on the picture takes their mean.
 * The open air it fills (`drawn`, 1 each: what the body's outline gains) and what fell off the canvas (`spill`: x, y, r,
 * g, b each, for padFrame to lay on a wider one).
 * @param {{width:number,height:number,data:Uint8Array}} out @param {number[]} sh @param {any} P shieldPicture's
 * @param {number} view 0..4 @param {number} cm @returns {{drawn:Uint8Array, spill:number[]}}
 */
export function drawShield(out, sh, P, view, cm) {
  const w = out.width, h = out.height, d = out.data, spill = [], drawn = new Uint8Array(w * h);
  const V = SHIELD_VIEWS[Math.max(0, Math.min(4, view | 0))], kx = cm * (sh[2] ?? V.squeeze), ky = cm;
  const img = V.face ? P.face : P.inside, W = P.width, H = P.height;
  const x0 = Math.floor(sh[0] - P.gx * kx) - 1, x1 = Math.ceil(sh[0] + (W - P.gx) * kx) + 1;
  const y0 = Math.floor(sh[1] - P.gy * ky) - 1, y1 = Math.min(h - 1, Math.ceil(sh[1] + (H - P.gy) * ky) + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const on = x >= 0 && y >= 0 && x < w, i = (y * w + x) * 4;
    if (on && !V.over && d[i + 3]) continue;   // behind the body: open air only
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      let u = P.gx + (x + (sx + 0.5) / 3 - sh[0]) / kx;
      const v = P.gy + (y + (sy + 0.5) / 3 - sh[1]) / ky;
      if (!V.face) u = W - u;   // from behind, the other way round
      const X = Math.floor(u), Y = Math.floor(v);
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const q = (Y * W + X) * 4;
      if (!img[q + 3]) continue;
      r += img[q]; g += img[q + 1]; b += img[q + 2]; n++;
    }
    if (n < 3) continue;
    if (!on) { spill.push(x, y, r / n, g / n, b / n); continue; }
    if (!d[i + 3]) drawn[y * w + x] = 1;
    d[i] = r / n; d[i + 1] = g / n; d[i + 2] = b / n; d[i + 3] = 255;
  }
  return { drawn, spill };
}
/**
 * A composed frame on a canvas wide and tall enough for what fell off it (drawShield's `spill`): as much more on each
 * side, the more above - the sprite stands on its feet at its middle, so the body stays where it was. Its `held` and
 * `shield` masks too.
 * @param {{width:number,height:number,data:Uint8Array,held?:Uint8Array,shield?:Uint8Array}} img @param {number[]} spill
 */
export function padFrame(img, spill) {
  if (!spill.length) return img;
  const w = img.width, h = img.height;
  let side = 0, top = 0;
  for (let k = 0; k < spill.length; k += 5) { side = Math.max(side, -spill[k], spill[k] - (w - 1)); top = Math.max(top, -spill[k + 1]); }
  const W = w + 2 * side, H = h + top, data = new Uint8Array(W * H * 4);
  /** @param {Uint8Array|undefined} m */
  const wider = (m) => {
    if (!m) return undefined;
    const to = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) to.set(m.subarray(y * w, (y + 1) * w), (y + top) * W + side);
    return to;
  };
  for (let y = 0; y < h; y++) data.set(img.data.subarray(y * w * 4, (y + 1) * w * 4), ((y + top) * W + side) * 4);
  const held = wider(img.held), shield = wider(img.shield) ?? new Uint8Array(W * H);
  for (let k = 0; k < spill.length; k += 5) {
    const i = (spill[k + 1] + top) * W + spill[k] + side;
    data.set([spill[k + 2], spill[k + 3], spill[k + 4], 255], i * 4);
    shield[i] = 1;
  }
  return { ...img, width: W, height: H, data, shield, ...(held ? { held } : {}) };
}
/** ARMORY: an upload's px (row 0 the bottom, mirrored as `mirror` says) with the air the shield filled (`shield` the
 *  compose's mask, top row first) open again - where the body stands is read off its outline, not off what it carries. */
export function withoutShield(colors, shield, w, h, mirror = false) {
  if (!shield || shield.length !== w * h) return colors;
  const out = colors.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (shield[y * w + x]) out[(h - 1 - y) * w + (mirror ? w - 1 - x : x)] = 0;
  return out;
}

/** Is (x, y) inside the polygon P ([[x, y], ...])? Even-odd. */
const inPolygon = (x, y, P) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** The opaque px of `img` inside any of the outlines (`polys`, [[x, y], ...] each), 1 each. */
export function outlineMask(img, polys) {
  const w = img.width, h = img.height, m = new Uint8Array(w * h);
  for (const P of polys) {
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x++) {
        if (img.data[(y * w + x) * 4 + 3] && inPolygon(x + 0.5, y + 0.5, P)) m[y * w + x] = 1;
      }
    }
  }
  return m;
}
/** Take the free arm out of a frame, in place: the body px inside the rig's outlines (`polys`), filled as a hammer's hole
 *  is (layeredWeapon.js removeWeapon, the smooth blend) - from a graft's idle torso where it has one (`from`: its picture,
 *  its arm, the shift `fill`) - but a filled px no path of filled px joins to the body is open air, and a scrap of the
 *  arm's edge left floating beside the hole (ARM_SCRAP px at most) goes with it. The px taken out, 1 each. */
export function removeShieldArm(out, polys, from = null) {
  const w = out.width, h = out.height, m = outlineMask(out, polys);
  removeWeapon(out, m, 0);
  const d = out.data, n = w * h;
  if (from) {
    const R = from.img, [fx, fy] = from.fill;
    for (let i = 0; i < n; i++) {
      if (!m[i] || !d[i * 4 + 3]) continue;
      const X = (i % w) + fx, Y = ((i / w) | 0) + fy, j = Y * R.width + X;
      if (X >= 0 && Y >= 0 && X < R.width && Y < R.height && R.data[j * 4 + 3] && !from.arm[j]) d.set(R.data.subarray(j * 4, j * 4 + 4), i * 4);
    }
  }
  const piece = new Int32Array(n).fill(-1), sizes = [], near = [];
  const each = (i, fn) => { const x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h) fn(Y * w + X); } };
  for (let i0 = 0; i0 < n; i0++) {   // the body's own px in 8-joined pieces: each one's size, and does it touch the hole?
    if (m[i0] || !d[i0 * 4 + 3] || piece[i0] >= 0) continue;
    const k = sizes.length, stack = [i0];
    piece[i0] = k; sizes.push(0); near.push(false);
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop());
      sizes[k]++;
      each(i, (j) => { if (m[j]) near[k] = true; else if (d[j * 4 + 3] && piece[j] < 0) { piece[j] = k; stack.push(j); } });
    }
  }
  const body = sizes.indexOf(Math.max(...sizes)), joined = new Uint8Array(n), queue = [];
  for (let i = 0; i < n; i++) if (piece[i] === body) { joined[i] = 1; queue.push(i); }
  while (queue.length) {   // the filled px a path of filled px joins to the body
    const i = /** @type {number} */ (queue.pop()), x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j >= 0 && j < n && m[j] && !joined[j] && d[j * 4 + 3]) { joined[j] = 1; queue.push(j); }
    }
  }
  for (let i = 0; i < n; i++) {
    const k = piece[i];
    if ((m[i] && !joined[i]) || (k >= 0 && k !== body && near[k] && sizes[k] <= ARM_SCRAP)) d.fill(0, i * 4, i * 4 + 4);
  }
  return m;
}
/** A graft's arm (`from`: the idle's picture, its arm's px, the shift `at` it hangs from this frame's shoulder by) laid
 *  over a frame, in place. The px it covers, 1 each. */
export function graftArm(out, from) {
  const w = out.width, h = out.height, R = from.img, [ax, ay] = from.at, laid = new Uint8Array(w * h);
  for (let y = 0; y < R.height; y++) for (let x = 0; x < R.width; x++) {
    const j = y * R.width + x, X = x - ax, Y = y - ay;
    if (!from.arm[j] || X < 0 || Y < 0 || X >= w || Y >= h) continue;
    out.data.set(R.data.subarray(j * 4, j * 4 + 4), (Y * w + X) * 4);
    laid[Y * w + X] = 1;
  }
  return laid;
}
/** The most px a scrap of the arm's edge left floating beside its hole has. */
const ARM_SCRAP = 24;

/** A shield-bearer's swing, per view (0 front .. 4 back) and cut: the frames whose sword arm swings on its own side. From
 *  three quarters before, the arms cross to the shield's side after the follow-through (4, 5); from the front and from
 *  behind, after the strike (3, 4, 5); from aside the shield's arm is the far one, so the whole swing plays. */
const FRONT_CUTS = Object.freeze({ thrust: [3, 3, 2, 2, 2, 3], slash: [1, 2, 2, 3, 3, 1], chop: [0, 1, 2, 3, 3, 1] });
const SQUARE_CUTS = Object.freeze({ thrust: [1, 1, 2, 2, 2, 1], slash: [1, 2, 2, 2, 1, 1], chop: [0, 1, 2, 2, 2, 1] });
export const SHIELD_CUTS = Object.freeze([SQUARE_CUTS, FRONT_CUTS, null, SQUARE_CUTS, SQUARE_CUTS]);
/** The cast's four frames with a shield, per view: from the front and from behind, its last is the throw held. */
export const SHIELD_CAST = Object.freeze([[0, 1, 2, 2], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 2], [0, 1, 2, 2]]);
/** A shot with a shield, per view: from the front and from behind, the strike's frame (the art's 3 crosses over). */
export const SHIELD_GUN = Object.freeze([2, 3, 3, 2, 2]);
/** The swing a shield-bearer plays with `code` in this view, or null where it is the weapon's own (SWING_CUTS). */
export const shieldCutOf = (code, view) => SHIELD_CUTS[view]?.[swingKindOf(code)] ?? null;
