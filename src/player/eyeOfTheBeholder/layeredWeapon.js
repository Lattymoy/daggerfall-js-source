// LAYERED-WEAPONS (bible/04-Characters/Layered-Gearing.md): the layered body holds the weapon it uses, not the art's
// own warhammer. The rig (tools/layered-armor/build_weapon_rig.py) says where that hammer is in each frame, per chest
// family: its pixels, the grip, the head, and where the body hid it. A body that holds nothing has the hammer taken
// out and the body filled behind it; a body that holds a weapon has it drawn along the hammer's shaft, in its metal,
// and a bow in its free hand.

import rig from '../../../vendor/layered-armor/weapon/manifest.json' with { type: 'json' };
import { WEAPONS } from '../../characters/weapons.js';
import { THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE } from '../../characters/thunderlockIds.js';
import { customItemClass } from '../../systems/roleplayRealismItems/rriItems.js';
import { drawnPiece } from '../../net/appearanceLaw.js';   // APPEARANCES: a weapon wearing a look is drawn as the look
import { weaponPictureAxis } from './eotbHolster.js';   // the paper doll's picture, as BACK-HOLSTER stands it on the back
import { itemIconColor32 } from '../../ui/item/itemIconColor32.js';
import { inventoryItemImage } from '../../systems/item/itemTemplates.js';

/** The shape each weapon template is drawn as - two letters, the weapon code's head. The Warhammer is the art's own. */
export const WEAPON_SHAPES = Object.freeze({
  [WEAPONS.Dagger]: 'dg', [WEAPONS.Tanto]: 'tn', [WEAPONS.Staff]: 'sf', [WEAPONS.Shortsword]: 'ss',
  [WEAPONS.Wakazashi]: 'wk', [WEAPONS.Broadsword]: 'bs', [WEAPONS.Saber]: 'sa', [WEAPONS.Longsword]: 'ls',
  [WEAPONS.Katana]: 'kt', [WEAPONS.Claymore]: 'cm', [WEAPONS.Dai_Katana]: 'dk', [WEAPONS.Mace]: 'mc',
  [WEAPONS.Flail]: 'fl', [WEAPONS.Warhammer]: 'wh', [WEAPONS.Battle_Axe]: 'ba', [WEAPONS.War_Axe]: 'wa',
  [WEAPONS.Short_Bow]: 'sb', [WEAPONS.Long_Bow]: 'lb', 513: 'ha', 514: 'lf',   // RRI: the Archer's Axe, the Light Flail
  [THUNDERLOCK_TEMPLATE]: 'tl', [PISTOLET_TEMPLATE]: 'pt',
});
/** A custom weapon class with no shape of its own is drawn as its animation set's (fpsWeapon.js WEAPON_TYPES names). */
const TYPE_SHAPES = Object.freeze({ LongBlade: 'ls', Staff: 'sf', Dagger: 'dg', Mace: 'mc', Flail: 'fl', Warhammer: 'wh', Battleaxe: 'ba', Bow: 'sb' });
const BOWS = new Set(['sb', 'lb']);

/** A held item's weapon code - its shape and its metal (WeaponMaterialTypes 0..9), 'ls7' - or null for none, bare hands
 *  and anything not drawn as a weapon (the Hand Wraps are bare hands). */
export function layeredWeaponOf(item) {
  const it = item ? drawnPiece(item) : null;
  if (!it || it.group != null && it.group !== 'Weapons') return null;
  let shape = WEAPON_SHAPES[it.templateIndex];
  if (!shape) shape = TYPE_SHAPES[String(customItemClass(it.templateIndex)?.weaponType?.(false) ?? '').replace('_Magic', '')];
  if (!shape) return null;
  const m = Number.isInteger(it.material) && it.material >= 0 && it.material <= 9 ? it.material : 0;
  return `${shape}${m}`;
}
/** LAYERED-DUAL: what a layered body's hands hold, for its look - a pair's right weapon (`weapon`), its left (`offhand`)
 *  and the hand whose blow is in flight (`strike`); else the hand in use's weapon. SPELL-BURST: a cast's element (`cast`)
 *  and a weapon kept beside the spell (`spellHand`); BACK-SHIELD: sheathed. `s` the rig's state: heldWeapon, and
 *  pairRight, pairLeft, pairStrike where the hands hold a pair; castElement, spellHand, sheathed. */
export function layeredHands(s) {
  const held = s?.pairRight && s?.pairLeft ? { weapon: layeredWeaponOf(s.pairRight), offhand: layeredWeaponOf(s.pairLeft), strike: s.pairStrike ?? null } : { weapon: layeredWeaponOf(s?.heldWeapon) };
  return { ...held, ...(Number.isInteger(s?.castElement) ? { cast: s.castElement } : {}), ...(s?.spellHand ? { spellHand: true } : {}), ...(s?.sheathed ? { sheathed: true } : {}) };
}
export const isBowCode = (code) => typeof code === 'string' && BOWS.has(code.slice(0, 2));

/** What the sprite of one table shows in the hands: '0' nothing (the hammer taken out), a weapon code, or null - the art
 *  as drawn (the loose's own bow). Sheathed, a readied spell and bare hands show nothing; the bow's tables show the bow.
 *  SPELL-BURST: a spell beside a one-handed weapon (`spellHand`, combat/twoHands/spellHand.js) keeps it in hand - readied
 *  (the Spell stance) and cast. */
export function weaponShownFor(table, held, spellHand = false) {
  switch (table) {
    case 'AttackSpell': case 'IdleSpell': case 'MoveSpell': return spellHand && held && !isBowCode(held) ? held : '0';
    case 'AttackRanged': return null;
    case 'IdleRanged': case 'MoveRanged': return isBowCode(held) ? held : '0';
    case 'IdleMelee': case 'MoveMelee': case 'AttackMelee': return held && !isBowCode(held) ? held : '0';
    default: return '0';
  }
}

/** SWING-CUTS (2026-10-30, the owner, of the one swing: "Is there anyway to switch up the animation?"): the art has one
 *  swing, the hammer's six frames - up (0, 1), the strike (2, arms forward), low through (3), back at the chest (4), up
 *  again (5). Each weapon plays its own cut of them: a thrust, a slash, the full chop. */
export const SWING_CUTS = Object.freeze({ thrust: [4, 4, 2, 2, 2, 4], slash: [4, 2, 3, 3, 4, 4], chop: [0, 1, 2, 3, 4, 5] });
const THRUSTS = new Set(['dg', 'tn', 'ss', 'wk']), SLASHES = new Set(['ls', 'bs', 'sa', 'kt']);
const _thrust = new WeakMap();
/** SWING-CUTS: a thrust's strike (the swing's frame 2, arms out) points its blade the way the body faces, along the
 *  arms - the art's hammer line there is the chop's, at the camera: from aside the whole blade forward, from three
 *  quarters shortened, from the front a stub at the camera, from behind hidden past the fists. A frame's rig as
 *  drawWeapon reads one (`len` the body's hammer, px); null for any other frame or weapon. */
export function thrustRigOf(fr, code, view, frame, len = rig.male.len) {
  if (frame !== 2 || !fr || !THRUSTS.has(String(code ?? '').slice(0, 2))) return null;
  let o = _thrust.get(fr);
  if (!o) {
    const [gx, gy, ax, ay] = fr.w ?? [...fr.q, ...fr.t], D = Math.hypot(ax - gx, ay - gy) || 1, v = Math.max(0, Math.min(4, view | 0));
    const fx = FACING_X[v], [ux, uy] = fx ? [Math.sign(fx), 0.12] : [(ax - gx) / D, (ay - gy) / D];
    const k = fx ? Math.abs(fx) : 0.35, n = Math.hypot(ux, uy), L = len * k, [lo, hi] = rig.span;
    const blade = v === 4 ? 'x' : v === 3 ? 'b' : 'f', c = blade === 'x' ? 'b' : blade;
    const ex = gx + (ux / n) * L, ey = gy + (uy / n) * L;
    o = { w: [gx, gy, ex, ey], d: c.repeat(-lo - 3) + 'bbb' + blade.repeat(hi + 1), side: fr.side };   // no second line: the swing's
    _thrust.set(fr, o);
  }
  return o;
}

/** The cut a weapon code swings - a short blade's and a bare fist's thrust, a long blade's slash, else the chop; `back`
 *  (a pair's left hand) plays it the other way round, a rising backhand. */
export function swingCutOf(code, back = false) {
  const cut = SWING_CUTS[swingKindOf(code)];
  return back ? [...cut].reverse() : cut;
}
/** SWING-CUTS: the cut a weapon code's swing is - 'thrust', 'slash' or 'chop'. */
export function swingKindOf(code) {
  const head = String(code ?? '0').slice(0, 2);
  return THRUSTS.has(head) || head === '0' ? 'thrust' : SLASHES.has(head) ? 'slash' : 'chop';
}

/** A frame whose arm the hammer hid is drawn as another of its walk: empty-handed, its mirror twin (the front walk's
 *  0-2 is 0-0 flipped, the other leg forward); armed, the walk's next frame, so the weapon keeps its hand. */
const TWIN = Object.freeze({ '0-2': '0-0' }), NEXT = Object.freeze({ '0-2': '0-3' });
export const BARE_TWINS = Object.freeze({ male: TWIN, female: TWIN });
export const ARMED_TWINS = Object.freeze({ male: NEXT, female: NEXT });
/** A gun fires from the swing's arms-forward frame, held - never the hammer's overhead chop. */
export const GUN_FIRE_FRAME = 3;
export const isGunCode = (code) => typeof code === 'string' && (code.startsWith('tl') || code.startsWith('pt'));

/** One frame's rig in the family the chest piece is ('l', 'c' or 'p'), or null where the art holds no hammer. */
export function weaponRigOf(body, rf, top = 'l') {
  const f = rig[body]?.frames?.[rf];
  return f ? f[Math.max(0, rig.families.indexOf({ l: 'leather', c: 'chain', p: 'plate' }[top] ?? 'leather'))] : null;
}
export const WEAPON_SPAN = Object.freeze([...rig.span]);
const _off = new WeakMap();
/** LAYERED-DUAL: px of the second weapon's guard, past the grip, behind its open hand (the handle is, all of it). */
const OFF_GUARD = 3;
/** LAYERED-DUAL: a pair's other weapon's rig in a frame, as drawWeapon reads one - its line in the other hand (the rig's
 *  `off`: the free hand's, else fanned off the first behind the body), the blade on its side and the fist over the
 *  handle - or null where the frame has none. */
export function offRigOf(fr) {
  if (!Array.isArray(fr?.off)) return null;
  let o = _off.get(fr);
  if (!o) {
    // the free hand is open in the art: the handle and the guard pass behind its fingers, which close over them
    const [lo, hi] = rig.span, blade = fr.off[4];
    o = { w: fr.off.slice(0, 4), d: 'b'.repeat(-lo + OFF_GUARD) + blade.repeat(hi + 1 - OFF_GUARD), side: fr.side, cv: fr.cv };
    _off.set(fr, o);
    _depth.set(o, o.d);   // as written: settleDepth's fist rule would bring the guard out over the fingers
  }
  return o;
}

// ── TAKING THE HAMMER OUT ──────────────────────────────────────────────────────────────────────────────────────────
/**
 * Clear the hammer from a composed picture, in place: each of its px takes the side of the nearest px outside it (most
 * of them, at its edge) - open air, or the body it hid - and a body px is the rig's copy (`fill`: a shift [0, dx, dy] or a mirror [1, c, dy]) where
 * that lands on the body, else the smooth blend of the body round it.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {Uint8Array} mask 1 where the hammer is
 * @param {any} fill @param {Int32Array|null} [from] each hole px's own source px (fillFrom), -1 for none, -2 open air
 */
export function removeWeapon(out, mask, fill, from = null) {
  const w = out.width, h = out.height, d = out.data, n = w * h;
  const side = new Int8Array(n).fill(-1), queue = new Int32Array(n);
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) {   // an edge px takes the side most of its outside neighbours are on
    if (!mask[i]) continue;
    const x = i % w, y = (i / w) | 0;
    let body = 0, air = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if (X >= 0 && Y >= 0 && X < w && Y < h && !mask[j]) { if (d[j * 4 + 3]) body++; else air++; }
    }
    if (body + air) { side[i] = body > air ? 1 : 0; queue[qt++] = i; }
  }
  while (qh < qt) {
    const i = queue[qh++], x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h && mask[j] && side[j] < 0) { side[j] = side[i]; queue[qt++] = j; }
    }
  }
  const copy = Array.isArray(fill) ? fill : null;
  const known = (j) => !mask[j] && d[j * 4 + 3] > 0;
  const smooth = [];   // the body px no copy reaches
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const own = from ? from[i] : -1;
    if (side[i] !== 1 || own === -2) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = d[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    const X = copy ? (copy[0] ? 2 * copy[1] - x : x + copy[1]) : -1, Y = copy ? y + copy[2] : -1;
    const j = own >= 0 && known(own) ? own : (copy && X >= 0 && Y >= 0 && X < w && Y < h ? Y * w + X : -1);
    if (j >= 0 && known(j)) { d[i * 4] = d[j * 4]; d[i * 4 + 1] = d[j * 4 + 1]; d[i * 4 + 2] = d[j * 4 + 2]; }
    else { smooth.push(i); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; }
    d[i * 4 + 3] = 255;
  }
  if (smooth.length) blend(d, w, h, mask, smooth);
  if (copy?.[0] === 1) mirrorHole(d, w, h, mask, copy);
}
/** Jacobi: each hole px the mean of the body px round it, until it settles. */
function blend(d, w, h, mask, px) {
  const m = px.length, nb = new Int32Array(m * 4).fill(-1), next = new Float32Array(m * 3);
  const inHole = new Int32Array(w * h).fill(-1);
  for (let k = 0; k < m; k++) inHole[px[k]] = k;
  for (let k = 0; k < m; k++) {
    const i = px[k], x = i % w, y = (i / w) | 0; let c = 0;
    if (x + 1 < w) nb[k * 4 + c++] = i + 1;
    if (x > 0) nb[k * 4 + c++] = i - 1;
    if (y + 1 < h) nb[k * 4 + c++] = i + w;
    if (y > 0) nb[k * 4 + c] = i - w;
  }
  for (let k = 0; k < m * 4; k++) { const j = nb[k]; if (j >= 0 && inHole[j] < 0 && (mask[j] ? !d[j * 4 + 3] : !d[j * 4 + 3])) nb[k] = -1; }
  for (let it = 0; it < 40; it++) {
    for (let k = 0; k < m; k++) {
      let r = 0, g = 0, b = 0, c = 0;
      for (let e = 0; e < 4; e++) { const j = nb[k * 4 + e]; if (j < 0) continue; r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; c++; }
      if (c) { next[k * 3] = r / c; next[k * 3 + 1] = g / c; next[k * 3 + 2] = b / c; }
    }
    for (let k = 0; k < m; k++) { const i = px[k] * 4; d[i] = next[k * 3]; d[i + 1] = next[k * 3 + 1]; d[i + 2] = next[k * 3 + 2]; }
  }
}
/** A mirror fill (a front view) copies the body's other side into every hole px, its alpha too - its shape decides
 *  where the body is. A copied piece that touches no body outside the hole (the other arm, where this one is not) goes. */
function mirrorHole(d, w, h, mask, copy) {
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i / w) | 0, X = 2 * copy[1] - x, Y = y + copy[2], j = Y * w + X;
    if (X < 0 || Y < 0 || X >= w || Y >= h || mask[j]) continue;
    for (let c = 0; c < 4; c++) d[i * 4 + c] = d[j * 4 + c];
  }
  const held = new Uint8Array(w * h), queue = [];
  const each = (i, fn) => { const x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h) fn(Y * w + X); } };
  for (let i = 0; i < w * h; i++) if (mask[i] && d[i * 4 + 3]) each(i, (j) => { if (!held[i] && !mask[j] && d[j * 4 + 3]) { held[i] = 1; queue.push(i); } });
  while (queue.length) each(queue.pop(), (j) => { if (mask[j] && d[j * 4 + 3] && !held[j]) { held[j] = 1; queue.push(j); } });
  for (let i = 0; i < w * h; i++) if (mask[i] && !held[i]) d[i * 4 + 3] = 0;
}

// ── THE PAPER DOLL'S PICTURE ───────────────────────────────────────────────────────────────────────────────────────
// A weapon is drawn as its own paper-doll picture - the pack's, dyed by its metal, the one BACK-HOLSTER hangs on the back
// (eotbHolster.js) - laid along the frame's line. The doll's hand leaves a gap in the handle: that gap is the grip.
const TEMPLATE_OF = Object.freeze(Object.fromEntries(Object.entries(WEAPON_SHAPES).map(([t, sh]) => [sh, Number(t)])));
const PICTURED = (shape) => shape !== 'tl' && shape !== 'pt' && shape !== 'wh';   // the guns keep their drawn shape

/** A weapon code's picture as the pack draws it for this body (color32, row 0 the bottom), or null: a gun, the art's own
 *  hammer, no picture, not in a browser. */
export async function loadHeldPicture(code, body) {
  const shape = String(code ?? '').slice(0, 2), t = TEMPLATE_OF[shape];
  if (!PICTURED(shape) || !Number.isInteger(t)) return null;
  const item = { group: 'Weapons', templateIndex: t, material: Number(String(code).slice(2)) || 0 };
  const identity = { gender: body === 'female' ? 'female' : 'male' }, image = heldImage(item, identity);
  return image ? itemIconColor32(item, { identity, image }) : null;
}
/** AUDIT: does `code` have a paper-doll picture to wait for (one not had yet makes the frame drawn meanwhile provisional)? */
export function heldPictureExpected(code, body) {
  const shape = String(code ?? '').slice(0, 2), t = TEMPLATE_OF[shape];
  if (!PICTURED(shape) || !Number.isInteger(t)) return false;
  const item = { group: 'Weapons', templateIndex: t, material: Number(String(code).slice(2)) || 0 };
  return !!heldImage(item, { gender: body === 'female' ? 'female' : 'male' });
}
/** The picture the hand holds: the pack's, but a katana's flat one (the pack takes the record after it, the doll's
 *  right-hand picture, foreshortened - ItemHelper.cs:418-420). */
export function heldImage(item, identity) {
  const img = inventoryItemImage(item, identity);
  return img && item.templateIndex === WEAPONS.Katana ? { ...img, record: img.record - 1 } : img;
}

const opaqueAt = (img, x, y) => {
  const X = Math.round(x), Y = Math.round(y);
  return X >= 0 && Y >= 0 && X < img.width && Y < img.height && img.colors[(Y * img.width + X) * 4 + 3] > 127;
};
/** The runs of `on` that are off, with on before and after each: [first, past] each. */
function gapsOf(on) {
  const out = [];
  for (let i = 0; i < on.length;) {
    if (on[i]) { i++; continue; }
    let j = i;
    while (j < on.length && !on[j]) j++;
    if (i > 0 && j < on.length) out.push([i, j]);
    i = j;
  }
  return out;
}
/** The longest run of `on` that is off, with on before and after it: [first, past], or null. */
function longestGap(on) {
  return gapsOf(on).reduce((best, g) => (!best || g[1] - g[0] > best[1] - best[0] ? g : best), null);
}
/** The longest notch in a haft between the hand and the head that is filled (heldPicture), in picture px. */
const HAFT_NOTCH = 6;

/** A blade whose handle the picture cuts off (a tanto): the guard, the widest run across, as a gap of no length at its
 *  outer side - the end of the picture it is nearer. [i, i] or null. */
function guardEnd(img, ax, lx, ly, n) {
  const wide = new Float64Array(n);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.colors[(y * img.width + x) * 4 + 3] <= 127) continue;
    const i = Math.round((x - lx) * ax.ux + (y - ly) * ax.uy - ax.s0);
    if (i >= 0 && i < n) wide[i] = Math.max(wide[i], Math.abs((x - lx) * ax.rx + (y - ly) * ax.ry));
  }
  let top = 0;
  for (let i = 1; i < n; i++) if (wide[i] > wide[top]) top = i;
  if (!(wide[top] >= 2)) return null;
  let a = top, b = top;
  while (a > 0 && wide[a - 1] >= wide[top] * 0.6) a--;
  while (b < n - 1 && wide[b + 1] >= wide[top] * 0.6) b++;
  return top < n / 2 ? [a, a] : [b + 1, b + 1];
}

/**
 * A weapon picture held: the grip `g` (the hand's gap's end toward the head, in picture px), the way to the head `u`
 * (the gap's longer side - a blade, a haft's head), the across `r` turned so the head's heavier side (an axe's blade)
 * is +r, and the picture's reach along (from..to) and across (half), in picture px (centimetres). Null without a gap
 * of two px. Pure.
 * @param {{width:number,height:number,colors:ArrayLike<number>}} img
 */
export function heldPicture(img) {
  const ax = weaponPictureAxis(img);
  if (!ax) return null;
  const lx = ax.mx + ax.rho * ax.nx, ly = ax.my + ax.rho * ax.ny, n = Math.ceil(ax.s1 - ax.s0) + 1, on = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = ax.s0 + i;
    for (const r of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) if (opaqueAt(img, lx + ax.ux * s + ax.rx * r, ly + ax.uy * s + ax.ry * r)) { on[i] = 1; break; }
  }
  let gap = longestGap(on);
  if (!gap || gap[1] - gap[0] < 2) gap = guardEnd(img, ax, lx, ly, n);   // a handle the picture cuts off: at the guard
  if (!gap) return null;
  const up = n - gap[1] >= gap[0], sg = ax.s0 + (up ? gap[1] : gap[0]), dir = up ? 1 : -1;
  const ux = ax.ux * dir, uy = ax.uy * dir, gx = lx + ax.ux * sg, gy = ly + ax.uy * sg;
  let rx = ax.rx, ry = ax.ry, heavy = 0, half = 0, from = 0, to = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.colors[(y * img.width + x) * 4 + 3] <= 127) continue;
    const s = (x - gx) * ux + (y - gy) * uy, r = (x - gx) * rx + (y - gy) * ry;
    from = Math.min(from, s); to = Math.max(to, s); half = Math.max(half, Math.abs(r));
    if (s > 0) heavy += r * s;   // the far end weighs most
  }
  if (heavy < 0) { rx = -rx; ry = -ry; }
  const bridge = gap[1] > gap[0] ? bridgeGap(img, ax, lx, ly, gap, up) : null;
  // AUDIT: a notch in the haft past the hand (a war axe's short of its head, a flail's of its cap) is filled with the
  // haft: drawn small, it opened into a gap between the haft and the head
  let pic = img;
  for (const g of gapsOf(on)) {
    if (g[1] - g[0] > HAFT_NOTCH || (up ? g[0] < gap[1] : g[1] > gap[0])) continue;
    const b = bridgeGap(img, ax, lx, ly, g, up);
    if (!b) continue;
    if (pic === img) pic = { ...img, colors: Uint8Array.from(img.colors) };
    for (let i = 3; i < b.colors.length; i += 4) if (b.colors[i] > 127 && pic.colors[i] <= 127) pic.colors.set(b.colors.subarray(i - 3, i + 1), i - 3);
  }
  return { img: pic, gx, gy, ux, uy, rx, ry, from: from - 1, to: to + 1, half: half + 1, bridge };
}

/** The handle carried across the doll's hand gap (steps gap[0]..gap[1] along the axis): the handle side's edge (away
 *  from the head, `up` +s) copied along, no wider than its core near the line and 2 px either side of it - never a
 *  guard's or a pommel's breadth. A picture of the bridge alone, or null where that edge has nothing near the line. */
function bridgeGap(img, ax, lx, ly, gap, up) {
  const e = ax.s0 + (up ? gap[0] - 1 : gap[1]), at = (r) => [lx + ax.ux * e + ax.rx * r, ly + ax.uy * e + ax.ry * r];
  const r0 = [0, -0.5, 0.5, -1, 1, -1.5, 1.5].find((r) => opaqueAt(img, ...at(r)));   // the handle, a px or so off the line
  if (r0 === undefined) return null;
  let lo = r0, hi = r0;
  while (lo > r0 - 2 && opaqueAt(img, ...at(lo - 0.5))) lo -= 0.5;
  while (hi < r0 + 2 && opaqueAt(img, ...at(hi + 0.5))) hi += 0.5;
  const colors = new Uint8Array(img.colors.length), a = ax.s0 + gap[0] - 1, b = ax.s0 + gap[1];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const s = (x - lx) * ax.ux + (y - ly) * ax.uy, r = (x - lx) * ax.rx + (y - ly) * ax.ry;
    if (s <= a + 0.5 || s >= b - 0.5 || r < lo - 0.5 || r > hi + 0.5) continue;
    const [X, Y] = at(Math.max(lo, Math.min(hi, r))).map(Math.round), q = (Y * img.width + X) * 4;
    colors.set(img.colors.subarray(q, q + 4), (y * img.width + x) * 4);
  }
  return { width: img.width, height: img.height, colors };
}

/** A flail's picture held (heldPicture): its chain and ball split off the handle - the px more than 3 px off the
 *  handle's line - as `chain`, hung from the handle's head end (x, y) along its own way (dx, dy) for `len` px; the
 *  handle alone as `handle`. The picture as it was where it has no chain. Pure. @param {any} P */
export function heldChain(P) {
  const { img } = P, chain = Uint8Array.from(img.colors), handle = Uint8Array.from(img.colors);
  let top = -Infinity, n = 0, cx = 0, cy = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    if (img.colors[i + 3] <= 127) { chain[i + 3] = 0; continue; }
    const s = (x - P.gx) * P.ux + (y - P.gy) * P.uy, r = (x - P.gx) * P.rx + (y - P.gy) * P.ry;
    if (Math.abs(r) > 3 && s > 0) { handle[i + 3] = 0; n++; cx += x; cy += y; } else { chain[i + 3] = 0; if (s > top) top = s; }
  }
  if (n < 8 || !(top > 0)) return P;
  const x = P.gx + P.ux * top, y = P.gy + P.uy * top, D = Math.hypot(cx / n - x, cy / n - y) || 1;
  const dx = (cx / n - x) / D, dy = (cy / n - y) / D;
  let len = 0, half = 0;
  for (let py = 0; py < img.height; py++) for (let px = 0; px < img.width; px++) {
    if (chain[(py * img.width + px) * 4 + 3] <= 127) continue;
    len = Math.max(len, (px - x) * dx + (py - y) * dy); half = Math.max(half, Math.abs((px - x) * dy - (py - y) * dx));
  }
  const pic = (colors) => ({ width: img.width, height: img.height, colors });
  return { ...P, handle: pic(handle), chain: { img: pic(chain), x, y, dx, dy, len: len + 1, half: half + 1 } };
}

/** Does the axis's line run through a band wider than a string: as many px 1.5 to 4 px off it as on it? */
function lineIsThick(img, ax) {
  const lx = ax.mx + ax.rho * ax.nx, ly = ax.my + ax.rho * ax.ny;
  let on = 0, near = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.colors[(y * img.width + x) * 4 + 3] <= 127) continue;
    const r = Math.abs((x - lx) * ax.rx + (y - ly) * ax.ry);
    if (r <= 1.5) on++; else if (r <= 4) near++;
  }
  return near >= on * 0.6;
}
/** The picture with the axis's band (4 px either side) cleared. */
function offLine(img, ax) {
  const lx = ax.mx + ax.rho * ax.nx, ly = ax.my + ax.rho * ax.ny, colors = Uint8Array.from(img.colors);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (Math.abs((x - lx) * ax.rx + (y - ly) * ax.ry) <= 4) colors[(y * img.width + x) * 4 + 3] = 0;
  }
  return { width: img.width, height: img.height, colors };
}

/**
 * A bow picture held: the string is its long axis; the grip is the gap in the limb (the doll's hand), `g` on the limb,
 * `u` along the string, `r` from the string toward the limb (the bow's back), the longer limb's way (`long`) and reach.
 * Null without a limb gap. Pure.
 * @param {{width:number,height:number,colors:ArrayLike<number>}} img
 */
export function heldBow(img) {
  let ax = weaponPictureAxis(img);
  if (!ax) return null;
  // the string is a line a pixel wide; a short bow's thick limb can hold more pixels on one line than its string does
  if (lineIsThick(img, ax)) ax = weaponPictureAxis(offLine(img, ax)) ?? ax;
  const lx = ax.mx + ax.rho * ax.nx, ly = ax.my + ax.rho * ax.ny, n = Math.ceil(ax.s1 - ax.s0) + 1;
  const limb = new Float64Array(n).fill(NaN);   // the limb's across at each step along, NaN where none
  let side = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.colors[(y * img.width + x) * 4 + 3] <= 127) continue;
    const r = (x - lx) * ax.rx + (y - ly) * ax.ry;
    if (Math.abs(r) > 2.5) side += r;
  }
  const sgn = side < 0 ? -1 : 1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.colors[(y * img.width + x) * 4 + 3] <= 127) continue;
    const s = (x - lx) * ax.ux + (y - ly) * ax.uy, r = ((x - lx) * ax.rx + (y - ly) * ax.ry) * sgn, i = Math.round(s - ax.s0);
    if (r > 2.5 && i >= 0 && i < n && !(limb[i] >= r)) limb[i] = r;
  }
  const gap = longestGap(Array.from(limb, (v) => (Number.isNaN(v) ? 0 : 1)));
  if (!gap) return null;
  const sg = ax.s0 + (gap[0] + gap[1]) / 2, rg = (limb[gap[0] - 1] + limb[gap[1]]) / 2;
  const rx = ax.rx * sgn, ry = ax.ry * sgn;
  // the doll's picture cuts the lower limb short: the bow is drawn from its longer limb, both ways from the grip
  const from = ax.s0 - sg - 1, to = ax.s1 - sg + 1;
  return { img, gx: lx + ax.ux * sg + rx * rg, gy: ly + ax.uy * sg + ry * rg, ux: ax.ux, uy: ax.uy, rx, ry,
    long: to >= -from ? 1 : -1, reach: Math.max(to, -from), back: rg + 1 };
}

// ── DRAWING ONE ────────────────────────────────────────────────────────────────────────────────────────────────────
const ramp = (a, b) => Array.from({ length: 16 }, (_, i) => a.map((v, k) => Math.round(v + ((b[k] - v) * i) / 15)));
/** WeaponMaterialTypes -> the metal's 16-step ramp: the armour's own seven (from the strips), and silver, elven and
 *  dwarven, which the armour has no art for. */
const METAL_RAMPS = [
  rig.ramps.iron, rig.ramps.steel, ramp([62, 64, 72], [250, 250, 255]), ramp([58, 56, 24], [248, 240, 168]),
  ramp([66, 38, 14], [252, 196, 112]), rig.ramps.mithril, rig.ramps.adamantium, rig.ramps.ebony, rig.ramps.orcish, rig.ramps.daedric,
];
const WOOD = ramp([34, 20, 10], [196, 146, 92]), GRIP = ramp([18, 12, 9], [118, 84, 58]), GOLD = ramp([64, 42, 6], [255, 228, 120]);
const L3 = (() => { const v = [-0.5, -0.7, 0.6], l = Math.hypot(...v); return v.map((x) => x / l); })();
const H3 = (() => { const v = [L3[0], L3[1], L3[2] + 1], l = Math.hypot(...v); return v.map((x) => x / l); })();

/** A weapon's parts in cm from the grip (the fist's top edge, + toward the head the hammer had): [from, to, half-width
 *  at from, at to, material, kind]. kind: rod (round), blade (two bevels), block (flat), ball. side: 1 the face side
 *  only, -1 the back only; `axe`: an axe's blade on that side, w1 its reach. A curved blade bends its tip toward the
 *  back (`curve`, cm). */
const P = (from, to, w0, w1, mat, kind, extra = {}) => ({ from, to, w0, w1, mat, kind, ...extra });
const SWORD = (blade, width, guard, grip, { curve = 0, round = false, pommel = true } = {}) => [
  ...(pommel ? [P(-grip - 3.5, -grip, 2.6, 2.6, 'metal', 'ball')] : []),
  P(-grip, 0, 2, 2, 'grip', 'rod'),
  round ? P(0, 1.8, guard, guard, 'gold', 'block') : P(0, 2.4, guard, guard, 'metal', 'rod'),
  P(1.8, blade * 0.8, width, width * 0.85, 'metal', 'blade', { curve }),
  P(blade * 0.8, blade, width * 0.85, 0.2, 'metal', 'blade', { curve }),
];
const SHAPES = Object.freeze({
  dg: SWORD(28, 2.8, 5.5, 10), tn: SWORD(30, 2.5, 4, 11, { curve: 1.5, round: true, pommel: false }),
  ss: SWORD(52, 3.2, 8, 11), wk: SWORD(52, 2.8, 4.2, 14, { curve: 2.5, round: true, pommel: false }),
  bs: SWORD(72, 4.2, 11, 12), sa: SWORD(70, 3.1, 7.5, 12, { curve: 5 }), ls: SWORD(84, 3.5, 12, 15),
  kt: SWORD(72, 2.9, 4.8, 22, { curve: 3.5, round: true, pommel: false }), cm: SWORD(106, 4.2, 17, 24),
  dk: SWORD(92, 3.2, 5.4, 28, { curve: 4, round: true, pommel: false }),
  mc: [P(-8, 42, 1.9, 1.9, 'grip', 'rod'), P(42, 58, 5.5, 5.5, 'metal', 'block'), P(44, 56, 9, 9, 'metal', 'blade'), P(58, 62, 2, 0.8, 'metal', 'rod')],
  fl: [P(-8, 28, 2, 2, 'wood', 'rod'), P(28, 44, 1.1, 1.1, 'metal', 'rod', { links: true }), P(44, 62, 0, 0, 'metal', 'ball', { r: 8.5, spikes: true })],
  lf: [P(-6, 22, 1.7, 1.7, 'wood', 'rod'), P(22, 32, 0.9, 0.9, 'metal', 'rod', { links: true }), P(32, 46, 0, 0, 'metal', 'ball', { r: 6.5, spikes: true })],
  ba: [P(-14, 66, 2.1, 2.1, 'wood', 'rod'), P(44, 66, 0, 15, 'metal', 'blade', { axe: 1 }), P(44, 66, 0, 15, 'metal', 'blade', { axe: -1 }), P(66, 70, 2, 0.7, 'metal', 'rod')],
  wa: [P(-16, 78, 2.2, 2.2, 'wood', 'rod'), P(50, 80, 0, 19, 'metal', 'blade', { axe: 1 }), P(58, 70, 4.5, 0.6, 'metal', 'block', { side: -1 }), P(78, 84, 2.2, 0.4, 'metal', 'rod')],
  ha: [P(-6, 40, 1.7, 1.7, 'wood', 'rod'), P(24, 40, 0, 11, 'metal', 'blade', { axe: 1 })],
  sf: [P(-50, -46, 2.4, 2.4, 'metal', 'rod'), P(-46, 86, 2.4, 2.4, 'wood', 'rod'), P(86, 95, 4, 4, 'metal', 'ball')],
  tl: [P(-26, -2, 3.8, 2.8, 'wood', 'block'), P(-2, 9, 3.2, 3.2, 'metal', 'block'), P(9, 66, 1.9, 1.9, 'metal', 'rod'), P(63, 68, 2.5, 2.5, 'metal', 'rod')],
  pt: [P(-10, 0, 3.2, 2.6, 'wood', 'block'), P(0, 6, 3, 3, 'metal', 'block'), P(6, 28, 1.7, 1.7, 'metal', 'rod'), P(25, 29, 2.2, 2.2, 'metal', 'rod')],
});
/** The warhammer's grip-to-head length, in cm - the rig's `len` is the art's own, so one px is len/70 cm. */
const HAMMER_CM = 70;
/** A bow, as parts of the body's own (the loose's art, which is the long bow): [tip to tip, the grip's reach past the
 *  string]. */
const BOW_DIMS = Object.freeze({ sb: [0.75, 0.11], lb: [1, 0.15] });
/** Each view's screen x of the body's facing and of the bow hand's side (the art's: its side view holds the weapon
 *  near and the bow hand far). A held bow turns its back BOW_TURN from the facing toward that side and leans BOW_LEAN
 *  forward, so no view sees it edge on. */
/** Screen x of the body's facing, per view (0 front .. 4 back). */
export const FACING_X = Object.freeze([0, -0.707, -1, -0.707, 0]);
const BOW_SIDE_X = [1, 0.707, 0, -0.707, -1];
const BOW_TURN = Math.PI / 8, BOW_LEAN = Math.PI / 15;
const BOW_WOOD = ramp([30, 20, 9], [124, 78, 44]);   // the loose's own bow's browns

const shadeOf = (n) => {
  const diff = Math.max(0, n[0] * L3[0] + n[1] * L3[1] + n[2] * L3[2]);
  const spec = Math.max(0, n[0] * H3[0] + n[1] * H3[1] + n[2] * H3[2]) ** 14;
  return Math.max(0, Math.min(15, Math.round((0.18 + 0.82 * diff) * 13 + spec * 5)));
};
function colourOf(mat, metal, n) {
  const k = shadeOf(n);
  if (mat === 'gold') return GOLD[k];
  if (mat === 'grip') return GRIP[k];
  if (mat === 'wood') return metal >= 2 ? METAL_RAMPS[metal][Math.max(0, k - 2)] : WOOD[k];   // a bow or staff past steel wears its metal, as Daggerfall dyes it
  return (METAL_RAMPS[metal] ?? METAL_RAMPS[0])[k];
}

/** The part of a shape at (s cm along, v cm across), in draw order back to front: [mat, normal] or null. */
function sample(parts, s, v, side, px) {
  let hit = null;
  for (const p of parts) {
    if (p.kind === 'ball') {
      const r = p.r ?? p.w0, c = (p.from + p.to) / 2, ds = s - c;
      const dd = Math.hypot(ds, v);
      const spike = p.spikes && dd <= r * 1.35 && Math.abs(((Math.atan2(v, ds) / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) < 0.12;
      if (dd > r && !spike) continue;
      const z = Math.sqrt(Math.max(0, 1 - Math.min(1, dd / r) ** 2));
      hit = ['' + p.mat, [(ds / r) * px.ux + (v / r) * px.nx, (ds / r) * px.uy + (v / r) * px.ny, z]];
      continue;
    }
    if (p.axe) {   // an axe's blade: narrow at the haft, tall at its curved edge
      const vv = v * side * p.axe, W = p.w1, c = (p.from + p.to) / 2, half = (p.to - p.from) / 2;
      if (vv < 0 || vv > W) continue;
      const hh = half * (0.3 + 0.7 * (vv / W) ** 1.2), ds = s - c;
      if (Math.abs(ds) > hh || vv > W - 0.35 * W * (ds / Math.max(hh, 1e-6)) ** 2) continue;
      const e = vv > W * 0.82 ? 0.7 : 0.35, t = e * p.axe * side;
      hit = [p.mat, [t * px.nx, t * px.ny, Math.sqrt(1 - e * e)]];
      continue;
    }
    const pad = Math.max(0, ((px.minS ?? 0) - (p.to - p.from)) / 2);   // a guard seen end on keeps a px of thickness
    if (s < p.from - pad || s > p.to + pad) continue;
    const a = Math.max(0, Math.min(1, (s - p.from) / Math.max(1e-6, p.to - p.from)));
    let hw = p.w0 + (p.w1 - p.w0) * a;
    let vv = v + (p.curve ? side * p.curve * a * a : 0);
    if (p.side) { const sv = vv * side * p.side; if (sv < 0 || sv > hw) continue; vv = sv - hw / 2; hw /= 2; }
    else if (Math.abs(vv) > hw) continue;
    if (p.links && (Math.floor(s / 1.6) % 2) && Math.abs(vv) > hw * 0.4) continue;
    const c = Math.max(-1, Math.min(1, vv / Math.max(hw, 0.3)));
    let n;
    if (p.kind === 'rod') { const z = Math.sqrt(1 - c * c); n = [c * px.nx, c * px.ny, z]; }
    else if (p.kind === 'blade') { const e = Math.abs(c) > 0.78 ? 0.75 : 0.42, t = c >= 0 ? e : -e; n = [t * px.nx, t * px.ny, Math.sqrt(1 - t * t)]; }
    else n = [0.18 * c * px.nx, 0.18 * c * px.ny, 0.98];
    hit = [p.mat, n];
  }
  return hit;
}

/** The depth along the shaft, '?' (open air) settled to its nearest known neighbour, 'f' where there is none; the 4 px
 *  out of the fist take the shaft's side past them, so a weapon never starts a hand's width from the hand. */
function settleDepth(d, lo = WEAPON_SPAN[0]) {
  const s = String(d ?? ''), out = s.split('');
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== '?') continue;
    let k = 1;
    for (; k < out.length; k++) {
      const a = s[i - k], b = s[i + k];
      if (a && a !== '?') { out[i] = a; break; }
      if (b && b !== '?') { out[i] = b; break; }
    }
    if (out[i] === '?') out[i] = 'f';
  }
  for (let t = 0; t <= 4; t++) if (out.slice(-lo + t + 1, -lo + t + 6).includes('f')) out[-lo + t] = 'f';
  return out.join('');
}
const _depth = new WeakMap();
const depthOf = (fr) => { let v = _depth.get(fr); if (!v) { v = settleDepth(fr.d); _depth.set(fr, v); } return v; };

/**
 * Draw a weapon into a composed picture along a frame's shaft, in place. Where the hammer was behind the body the
 * weapon stays behind it (drawn only into open air); the fist round the grip covers its handle.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {any} fr the frame's rig (weaponRigOf)
 * @param {string} code the weapon code ('ls7') @param {number} len the body's hammer length, px @param {number} view 0..4
 * @param {{bow?:number, pic?:any, cm?:number, swing?:boolean, mirror?:boolean}} [art] the body's own bow (tip to tip,
 *   px); the paper-doll picture and the body's px a centimetre (`cm`); `swing` an attack's frame, `mirror` a flipped one
 */
export function drawWeapon(out, fr, code, len, view = 2, art = {}) {
  const shape = code.slice(0, 2), metal = Number(code.slice(2)) || 0, pic = art.cm > 0 ? art.pic ?? null : null;
  if (shape === 'wh') return;   // the art's own
  if (BOWS.has(shape)) {
    const bow = art.mirror ? fr.bowM : fr.bow;   // a flipped frame's left hand is the art's other one (the rig's bowM)
    if (!Array.isArray(bow)) return out;
    return pic ? drawBowPicture(out, bow, pic, view, (art.bow ?? 70) * (BOW_DIMS[shape] ?? BOW_DIMS.sb)[0]) : drawBow(out, bow, shape, metal, view, art.bow ?? 70);
  }
  const w = out.width, h = out.height, d = out.data;
  // the line the weapon is drawn on: the hammer's, or (`w`) where the hammer hides its shaft - pointed at the camera,
  // or behind the body - Daggerfall's own sword's (bible/04-Characters/Layered-Gearing.md, "Held")
  const [qx, qy, tx, ty] = Array.isArray(fr.w) ? fr.w : [...fr.q, ...fr.t];
  const D = Math.hypot(tx - qx, ty - qy) || 1;
  const ux = (tx - qx) / D, uy = (ty - qy) / D, nx = -uy, ny = ux;
  const k = len / HAMMER_CM;   // px a cm
  const f = Math.max(0.14, Math.min(1, D / len));   // the shaft's foreshortening in this frame
  const depth = depthOf(fr), lo = WEAPON_SPAN[0];
  // f before the body, b behind it (open air only), x hidden whatever is behind it (a back view's blade)
  const depthAt = (proj) => depth[Math.max(0, Math.min(depth.length - 1, Math.round(proj) - lo))];
  const shown = (alpha, proj) => { const k = depthAt(proj); return k !== 'x' && (!alpha || k === 'f'); };
  const px = { ux, uy, nx, ny, minS: 1.1 / (k * f) };
  const side = fr.side || 1, wx = fr.wx ?? 1;   // BACK-CARRY: its width's share where the frame turns it edge on
  // a flail's chain hangs: its heavier side down the picture, whatever the hammer's face
  const face = shape === 'fl' || shape === 'lf' ? (ny >= 0 ? 1 : -1) : side;
  if (pic) {
    const L = { qx, qy, ux, uy, nx, ny, along: /** @type {number} */ (art.cm) * f, across: /** @type {number} */ (art.cm) * wx, side: face };
    const was = d.slice();
    // the doll's hand gap: its handle, where no fist of the art's covers it
    if (pic.bridge) drawPicture(out, pic, L, (a, proj) => !a && shown(a, proj), pic.bridge);
    dropSpecks(drawPicture(out, pic, L, shown, pic.chain ? pic.handle : pic.img), was);
    return pic.chain ? drawChain(out, pic, L, shown, chainWay(fr.cv, L, !!art.swing, art.frame ?? null)) : out;
  }
  const parts = SHAPES[shape];
  if (!parts) return;
  const sMin = Math.min(...parts.map((p) => p.from)), sMax = Math.max(...parts.map((p) => p.to));
  const wide = 20 * k;   // the widest part's reach from the shaft, px
  const ends = [sMin, sMax].map((sv) => [qx + ux * sv * k * f, qy + uy * sv * k * f]);
  const box = [Math.min(ends[0][0], ends[1][0]) - wide, Math.min(ends[0][1], ends[1][1]) - wide, Math.max(ends[0][0], ends[1][0]) + wide, Math.max(ends[0][1], ends[1][1]) + wide];
  return paint(out, (x, y) => {
    const ex = x - qx, ey = y - qy;
    const proj = ex * ux + ey * uy, s = proj / (k * f), v = (ex * nx + ey * ny) / (k * wx);
    if (s < sMin - 1 || s > sMax + 1 || Math.abs(v) > 20) return null;
    return sample(parts, s, v, side, px);
  }, (a, x, y) => shown(a, (x - qx) * ux + (y - qy) * uy), box, metal);

  function paint(o, at, inFront, b, mt) {
    const x0 = Math.max(0, Math.floor(b[0])), x1 = Math.min(w - 1, Math.ceil(b[2]));
    const y0 = Math.max(0, Math.floor(b[1])), y1 = Math.min(h - 1, Math.ceil(b[3]));
    const drawn = new Uint8Array(w * h);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let hits = 0, R = 0, G = 0, Bl = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const hit = at(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3);
        if (!hit) continue;
        const c = hit[0] === 'string' ? [196, 190, 172] : colourOf(hit[0], mt, hit[1]);
        R += c[0]; G += c[1]; Bl += c[2]; hits++;
      }
      if (hits < 4) continue;
      const i = (y * w + x) * 4;
      if (!inFront(d[i + 3], x + 0.5, y + 0.5)) continue;   // the body is in front here, or the blade is hidden
      d[i] = R / hits; d[i + 1] = G / hits; d[i + 2] = Bl / hits; d[i + 3] = 255; drawn[y * w + x] = 1;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {   // a dark rim, as the art's own weapons have
      const j = y * w + x;
      if (!drawn[j]) continue;
      const edge = (x === 0 || !drawn[j - 1]) || (x === w - 1 || !drawn[j + 1]) || (y === 0 || !drawn[j - w]) || (y === h - 1 || !drawn[j + w]);
      if (edge) { const i = j * 4; d[i] *= 0.72; d[i + 1] *= 0.72; d[i + 2] *= 0.72; }
    }
    return o;
  }
}

/** AUDIT: the loose's own bow (records 20-24 draw the art's, which no rig takes out): its limbs and string, the px with
 *  few opaque within BOW_THIN_R of them, in pieces of BOW_PIECE px or more - a toe's or an elbow's corner is fewer. A
 *  weapon mask (composeStrip `held`), so its glow stands round the bow. Pure. @param {{width:number,height:number,data:Uint8Array}} img */
export function artBowPx(img) {
  const { width: w, height: h, data: d } = img, thin = new Uint8Array(w * h), out = new Uint8Array(w * h);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y)) continue;
    let n = 0;
    for (let dy = -BOW_THIN_R; dy <= BOW_THIN_R; dy++) for (let dx = -BOW_THIN_R; dx <= BOW_THIN_R; dx++) if (on(x + dx, y + dy)) n++;
    if (n <= BOW_THIN_N) thin[y * w + x] = 1;
  }
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!thin[i] || seen[i]) continue;
    const piece = [i], st = [i];
    seen[i] = 1;
    while (st.length) {
      const j = /** @type {number} */ (st.pop()), x = j % w, y = (j / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, k = Y * w + X;
        if (X >= 0 && Y >= 0 && X < w && Y < h && thin[k] && !seen[k]) { seen[k] = 1; st.push(k); piece.push(k); }
      }
    }
    if (piece.length >= BOW_PIECE) for (const k of piece) out[k] = 1;
  }
  return out;
}
const BOW_THIN_R = 3, BOW_THIN_N = 16, BOW_PIECE = 6;

/** The loose's bow is drawn again behind a ghost of itself where the female wears a leather chest (2026-10-31, the
 *  owner, of a sheet: "Fix all the minor issues and the attached innormalities"); the same frame in a chain chest is
 *  clean. The chest whose render a body's loose takes its bow from, by the chest it wears. */
export const LOOSE_BOW_FROM = Object.freeze({ female: Object.freeze({ leather: 'chain' }) });
/** The loose's bow as `ref` (the same frame in a clean chest) draws it, in place: in open air - where `ref` has at most
 *  LOOSE_AIR_N px within 3 - a px only `img` draws goes, and one only `ref` draws comes. `ref` may be a wider strip. */
export function bowFrom(img, ref) {
  const { width: w, height: h, data: d } = img, rw = ref.width, rd = ref.data;
  const rOn = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rd[(y * rw + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, mine = d[i + 3] > 0, theirs = rOn(x, y);
    if (mine === theirs) continue;
    let n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (rOn(x + dx, y + dy)) n++;
    if (n > LOOSE_AIR_N) continue;
    if (mine) d.fill(0, i, i + 4);
    else { const k = (y * rw + x) * 4; d.set(rd.subarray(k, k + 4), i); }
  }
  return img;
}
const LOOSE_AIR_N = 20;

/** AUDIT: a px of a held picture alone in the air - none of the picture beside it, nor the body - is a speck its
 *  sampling left off a guard's tip or an axe's edge, and is put back as it `was`. A px between the fingers stays. */
export function dropSpecks(out, was) {
  const w = out.width, h = out.height, d = out.data, put = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const k = i * 4; put[i] = d[k] !== was[k] || d[k + 1] !== was[k + 1] || d[k + 2] !== was[k + 2] || d[k + 3] !== was[k + 3] ? 1 : 0; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!put[y * w + x]) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h && (put[j] || was[j * 4 + 3])) { near = true; break; }
    }
    if (!near) { const k = (y * w + x) * 4; d.set(was.subarray(k, k + 4), k); }
  }
  return out;
}

/** Sample a held picture over one px: the mean colour of its opaque samples where a third of them are, else null.
 *  `at(x, y)` answers the picture's point for a sample of the composed picture; a sample `spread` px either side across
 *  the screen counts as its own (a thing thinner than the picture draws it). */
function samplePicture(img, x, y, n, at, spread = 0) {
  let k = 0, R = 0, G = 0, B = 0;
  const offs = spread > 0 ? [0, -spread, spread, -spread / 2, spread / 2] : [0];
  for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) for (const o of offs) {
    const [px, py] = at(x + (sx + 0.5) / n + o, y + (sy + 0.5) / n), X = Math.round(px), Y = Math.round(py);
    if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue;
    const q = (Y * img.width + X) * 4;
    if (img.colors[q + 3] <= 127) continue;
    k++; R += img.colors[q]; G += img.colors[q + 1]; B += img.colors[q + 2];
    break;
  }
  return k * 3 >= n * n ? [R / k, G / k, B / k] : null;
}

/**
 * Draw a held picture (heldPicture) along a frame's line, in place: its grip at the line's grip, its head along the
 * line foreshortened as the shaft is (`along` px a picture px), its across unshortened (`across`), its heavier side on
 * the hammer face's side. Where the hammer was behind the body, open air only.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {any} P
 * @param {{qx:number,qy:number,ux:number,uy:number,nx:number,ny:number,along:number,across:number,side:number}} L
 * @param {(alpha:number, proj:number) => boolean} shown
 */
function drawPicture(out, P, L, shown, img = P.img) {
  const w = out.width, h = out.height, d = out.data, sg = L.side >= 0 ? 1 : -1;
  const ends = [P.from, P.to].map((s) => [L.qx + L.ux * s * L.along, L.qy + L.uy * s * L.along]), wide = P.half * L.across + 1;
  const x0 = Math.max(0, Math.floor(Math.min(ends[0][0], ends[1][0]) - wide)), x1 = Math.min(w - 1, Math.ceil(Math.max(ends[0][0], ends[1][0]) + wide));
  const y0 = Math.max(0, Math.floor(Math.min(ends[0][1], ends[1][1]) - wide)), y1 = Math.min(h - 1, Math.ceil(Math.max(ends[0][1], ends[1][1]) + wide));
  const n = Math.max(3, Math.min(12, Math.ceil(2 / Math.min(L.along, L.across))));   // half a picture px apart, or closer
  const at = (x, y) => {
    const ex = x - L.qx, ey = y - L.qy, s = (ex * L.ux + ey * L.uy) / L.along, v = ((ex * L.nx + ey * L.ny) / L.across) * sg;
    return [P.gx + P.ux * s + P.rx * v, P.gy + P.uy * s + P.ry * v];
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * 4;
    if (!shown(d[i + 3], (x + 0.5 - L.qx) * L.ux + (y + 0.5 - L.qy) * L.uy)) continue;   // the body is in front here
    const c = samplePicture(img, x, y, n, at, 0.25);   // a handle a picture px wide keeps a px on screen
    if (!c) continue;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return out;
}

/** How a flail's chain lags and flies (screen px): a hand's move of a px tilts it this much off the plumb, at most
 *  CHAIN_TILT radians; in a swing it is flung out along the handle (FLING), trails the blow (1) and sags (SAG). */
const CHAIN_LAG = 0.07, CHAIN_TILT = 0.55, CHAIN_FLING = 1, CHAIN_SAG = 0.35;
/** Which way a flail's chain lies on screen, a unit [x, y]: down, lagging the head's move since the frame before (`cv`,
 *  the rig's - a walk swings it); in a swing, flung out along the handle and trailing the blow while the hands speed up
 *  (the raise, frames 0, 1 and 5). From the blow on (`frame` 2-4) the ball leads: out along the handle at the strike,
 *  carried on past it and falling through, then hanging as the arms come back. */
export function chainWay(cv, L, swing, frame = null) {
  const [vx, vy] = Array.isArray(cv) ? cv : [0, 0], sp = Math.hypot(vx, vy);
  if (swing && frame != null && frame >= 2 && frame <= 4) {
    const [mx, my] = sp ? [vx / sp, vy / sp] : [0, 0];
    const [x, y] = frame === 2 ? [L.ux, L.uy + CHAIN_SAG] : frame === 3 ? [L.ux / 2 + mx, L.uy / 2 + my + 2 * CHAIN_SAG] : [mx * CHAIN_SAG, 1];
    const n = Math.hypot(x, y);
    return n ? [x / n, y / n, frame === 2 ? 1 : 0] : [0, 1];   // at the strike it lies along the handle, as foreshortened
  }
  if (!sp) return [0, 1];   // at rest: plumb
  if (swing) {
    const x = L.ux * CHAIN_FLING - vx / sp, y = L.uy * CHAIN_FLING - vy / sp + CHAIN_SAG, n = Math.hypot(x, y) || 1;
    return [x / n, y / n];
  }
  const a = Math.max(-CHAIN_TILT, Math.min(CHAIN_TILT, Math.atan2(-vx * CHAIN_LAG, 1 + vy * CHAIN_LAG * 0.5)));
  return [Math.sin(a), Math.cos(a)];
}

/** A flail's chain (heldChain) from its handle's head end the way `g` says (chainWay), as drawPicture laid the handle:
 *  unshortened, but as foreshortened as the handle where it lies along it (`g[2]`, the strike's); at the head end's
 *  depth. */
function drawChain(out, P, L, shown, g = [0, 1]) {
  const C = P.chain, w = out.width, h = out.height, d = out.data, k = L.across, sg = L.side >= 0 ? 1 : -1;
  const rs = (C.x - P.gx) * P.ux + (C.y - P.gy) * P.uy, rr = ((C.x - P.gx) * P.rx + (C.y - P.gy) * P.ry) * sg;
  const hx = L.qx + L.ux * rs * L.along + L.nx * rr * k, hy = L.qy + L.uy * rs * L.along + L.ny * rr * k, proj = rs * L.along;
  const wide = C.half * k + 1, kAlong = (gx, gy) => k * (1 - (g[2] ?? 0) * Math.abs(gx * L.ux + gy * L.uy) * (1 - L.along / L.across));
  let [gx, gy] = g, reach = C.len * kAlong(gx, gy);
  // the ball stays in the picture: the chain turns back toward the plumb till it does
  for (let t = 0; t < 8 && (hx + gx * reach < wide || hx + gx * reach > w - wide || hy + gy * reach < wide); t++) {
    const x = gx * 0.7, y = gy * 0.7 + 0.3, n = Math.hypot(x, y) || 1;
    gx = x / n; gy = y / n; reach = C.len * kAlong(gx, gy);
  }
  const ex = hx + gx * reach, ey = hy + gy * reach, ka = reach / C.len;
  const x0 = Math.max(0, Math.floor(Math.min(hx, ex) - wide)), x1 = Math.min(w - 1, Math.ceil(Math.max(hx, ex) + wide));
  const y0 = Math.max(0, Math.floor(Math.min(hy, ey) - wide)), y1 = Math.min(h - 1, Math.ceil(Math.max(hy, ey) + wide));
  const n = Math.max(3, Math.min(12, Math.ceil(2 / Math.min(k, ka))));
  const at = (x, y) => {
    const c = ((x - hx) * gx + (y - hy) * gy) / ka, v = ((x - hx) * gy - (y - hy) * gx) / k;
    return [C.x + C.dx * c - C.dy * v, C.y + C.dy * c + C.dx * v];
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * 4;
    if (!shown(d[i + 3], proj)) continue;
    const c = samplePicture(C.img, x, y, n, at, 0.3);   // a chain is round: a px wide at the least, from any side
    if (!c) continue;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return out;
}

/** A held bow picture (heldBow) in the free hand, as drawBow lays the drawn one: its grip in the fist, the string along
 *  the bow's upright, its back turned BOW_TURN off the facing; `tips` px tip to tip, as the loose draws its bow. */
function drawBowPicture(out, bow, P, view, tips) {
  const [hx, hy, before, hand = 1] = bow, w = out.width, h = out.height, d = out.data, cm = tips / (2 * P.reach);
  const v = Math.max(0, Math.min(4, view | 0));
  const bx = Math.cos(BOW_TURN) * FACING_X[v] + Math.sin(BOW_TURN) * BOW_SIDE_X[v] * hand;
  const lean = Math.sin(BOW_LEAN) * FACING_X[v], up = Math.cos(BOW_LEAN);
  const reach = P.reach * cm, back = P.back * cm;
  const x0 = Math.max(0, Math.floor(hx - reach * Math.abs(lean) - back - 2)), x1 = Math.min(w - 1, Math.ceil(hx + reach * Math.abs(lean) + back + 2));
  const y0 = Math.max(0, Math.floor(hy - reach * up - 1)), y1 = Math.min(h - 1, Math.ceil(hy + reach * up + 1));
  const n = Math.max(3, Math.min(12, Math.ceil(2 / (cm * Math.abs(bx)))));
  const spread = Math.max(0.3, cm * Math.sqrt(1 - bx * bx));   // the limb's own width out of the bow's plane: edge on, a line
  const at = (x, y) => {
    const s = (hy - y) / (cm * up), r = (x - hx - s * cm * lean) / (cm * bx), sl = Math.abs(s) * P.long;   // the longer limb, both ways
    return [P.gx + P.ux * sl + P.rx * r, P.gy + P.uy * sl + P.ry * r];
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * 4;
    if (bowHidden(d[i + 3], before, x + 0.5 - hx, y + 0.5 - hy)) continue;
    const c = samplePicture(P.img, x, y, n, at, spread);
    if (!c) continue;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return out;
}

/** A bow px the body hides: any px over the body, for a hand behind it; else the fist's own, round the grip. */
const bowHidden = (alpha, before, dx, dy) => alpha > 0 && (!before || dx * dx + dy * dy <= 4.4);

/**
 * Draw a bow into a composed picture in the free hand, in place (the rig's `bow`: the fist, and 1 where it is before the
 * body): upright, its back turned BOW_TURN from the facing toward that hand's side and leant forward, the string on the
 * body's side. The fist closes over the grip; a hand behind the body shows the bow only in open air.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {number[]} bow @param {string} shape 'sb' or 'lb'
 * @param {number} metal @param {number} view 0..4 @param {number} bowPx the body's own bow, tip to tip, px
 */
function drawBow(out, bow, shape, metal, view, bowPx) {
  const [hx, hy, before, hand = 1] = bow, w = out.width, h = out.height, d = out.data;
  const [lr, br] = BOW_DIMS[shape] ?? BOW_DIMS.sb, half = (bowPx * lr) / 2, B = bowPx * br;
  const v = Math.max(0, Math.min(4, view | 0));
  const bx = Math.cos(BOW_TURN) * FACING_X[v] + Math.sin(BOW_TURN) * BOW_SIDE_X[v] * hand;   // the bow's back, screen x
  const lean = Math.sin(BOW_LEAN) * FACING_X[v], up = Math.cos(BOW_LEAN);
  const string = Math.abs(bx) > 0.2;
  // at u (-1 the bottom tip .. 1 the top): the limb's centre, its slope dx/dy, and the string's
  const at = (x, y) => {
    const u = (hy - y) / (half * up);
    if (Math.abs(u) > 1) return null;
    const lx = hx + u * half * lean - B * u * u * bx, slope = -(half * lean - 2 * B * u * bx) / (half * up);
    const n = Math.hypot(1, slope), dist = (x - lx) / n, hw = Math.abs(u) < 0.08 ? 1.0 : 0.8 - 0.3 * Math.abs(u);
    if (Math.abs(dist) <= hw) {
      const c = dist / hw, nrm = [c / n, (-c * slope) / n, Math.sqrt(1 - c * c)];
      return [Math.abs(u) < 0.08 ? 'grip' : 'wood', nrm];
    }
    const sx = hx + u * half * lean - B * bx;
    if (string && Math.abs((x - sx) / Math.hypot(1, lean / up)) <= 0.5) return ['string', null];
    return null;
  };
  const x0 = Math.max(0, Math.floor(hx - half * Math.abs(lean) - B - 2)), x1 = Math.min(w - 1, Math.ceil(hx + half * Math.abs(lean) + B + 2));
  const y0 = Math.max(0, Math.floor(hy - half * up - 1)), y1 = Math.min(h - 1, Math.ceil(hy + half * up + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * 4;
    if (bowHidden(d[i + 3], before, x + 0.5 - hx, y + 0.5 - hy)) continue;
    let hits = 0, R = 0, G = 0, Bl = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      const hit = at(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3);
      if (!hit) continue;
      const k = hit[1] ? shadeOf(hit[1]) : 0;
      const c = hit[0] === 'string' ? [104, 96, 80] : hit[0] === 'grip' ? GRIP[k] : metal >= 2 ? (METAL_RAMPS[metal] ?? METAL_RAMPS[0])[Math.max(0, k - 2)] : BOW_WOOD[k];
      R += c[0]; G += c[1]; Bl += c[2]; hits++;
    }
    if (hits < 4) continue;
    d[i] = R / hits; d[i + 1] = G / hits; d[i + 2] = Bl / hits; d[i + 3] = 255;
  }
  return out;
}

/** Recolour the art's own warhammer head to another metal: its px within the head's radius, step for step by
 *  brightness onto the metal's ramp (the shaft's wood stays). */
export function recolourHammer(out, mask, fr, metal) {
  if (!metal) return;
  const rampOf = METAL_RAMPS[metal]; if (!rampOf) return;
  const w = out.width, d = out.data, [tx, ty] = fr.t, r2 = (fr.hr + 1) ** 2;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || !d[i * 4 + 3]) continue;
    const x = i % w, y = (i / w) | 0;
    if ((x - tx) ** 2 + (y - ty) ** 2 > r2) continue;
    const L = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const c = rampOf[Math.max(0, Math.min(15, Math.round((L / 255) * 15 * 1.25)))];
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
  }
}

/** The mask of one family's tile in a rig strip (three tiles: leather, chain, plate chest), 1 where the hammer is. */
export function maskTile(strip, top = 'l') {
  const tiles = rig.families.length, w = strip.width / tiles, h = strip.height;
  const k = Math.max(0, rig.families.indexOf({ l: 'leather', c: 'chain', p: 'plate' }[top] ?? 'leather'));
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = strip.data[(y * strip.width + k * w + x) * 4 + 3] > 127 ? 1 : 0;
  return m;
}
/** Each hole px's own source px in one family's tile (the rig writes (dx, dy) + 128 in red and green, blue 255 where
 *  there is one), -1 where it has none, -2 where the rig marks it open air (blue 1..127: a head out past the hand). */
export function fillFrom(strip, top = 'l') {
  const tiles = rig.families.length, w = strip.width / tiles, h = strip.height;
  const k = Math.max(0, rig.families.indexOf({ l: 'leather', c: 'chain', p: 'plate' }[top] ?? 'leather'));
  const from = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * strip.width + k * w + x) * 4, d = strip.data;
    if (d[i + 3] < 128) continue;
    if (d[i + 2] < 128) { if (d[i + 2]) from[y * w + x] = -2; continue; }
    const X = x + d[i] - 128, Y = y + d[i + 1] - 128;
    if (X >= 0 && Y >= 0 && X < w && Y < h) from[y * w + x] = Y * w + X;
  }
  return from;
}
export const weaponLen = (body) => rig[body]?.len ?? 30;
/** The body's own bow (the loose's), tip to tip, px. */
export const bowLen = (body) => rig[body]?.bow ?? 70;
/** The body's px a centimetre, for a paper-doll picture (a picture px is a centimetre, eotbHolster PAPERDOLL_MPP). */
export const weaponCm = (body) => rig[body]?.cm ?? 0.6;
const flailPicture = (code, P) => (P && /^(fl|lf)/.test(code) ? heldChain(P) : P);
const _held = new WeakMap();   // the door -> `${body}:${code}` -> Promise of the held picture
/** A weapon code's paper-doll picture held (heldPicture, a bow's heldBow), once a door, body and code - or null, asked
 *  again next time. `load` the picture's door (loadHeldPicture). */
export function heldPictureOf(code, body, load = loadHeldPicture) {
  const key = `${body}:${code}`;
  let byKey = _held.get(load);
  if (!byKey) _held.set(load, (byKey = new Map()));
  if (!byKey.has(key)) {
    const p = Promise.resolve().then(() => load(code, body)).then((img) => (img ? (isBowCode(code) ? heldBow(img) : flailPicture(code, heldPicture(img))) : null), () => null);
    byKey.set(key, p);
    p.then((held) => { if (!held) byKey.delete(key); });
  }
  return /** @type {Promise<any>} */ (byKey.get(key));
}
