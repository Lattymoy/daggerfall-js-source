// LAYERED-WEAPONS (bible/04-Characters/Layered-Gearing.md): the layered body holds the weapon it uses, not the art's
// own warhammer. The rig (tools/layered-armor/build_weapon_rig.py) says where that hammer is in each frame, per chest
// family: its pixels, the grip, the head, and where the body hid it. A body that holds nothing has the hammer taken
// out and the body filled behind it; a body that holds a weapon has it drawn along the hammer's shaft, in its metal.

import rig from '../../../vendor/layered-armor/weapon/manifest.json' with { type: 'json' };
import { WEAPONS } from '../../characters/weapons.js';
import { THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE } from '../../characters/thunderlockIds.js';
import { customItemClass } from '../../systems/roleplayRealismItems/rriItems.js';
import { drawnPiece } from '../../net/appearanceLaw.js';   // APPEARANCES: a weapon wearing a look is drawn as the look

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
export const isBowCode = (code) => typeof code === 'string' && BOWS.has(code.slice(0, 2));

/** What the sprite of one table shows in the hands: '0' nothing (the hammer taken out), a weapon code, or null - the art
 *  as drawn (the loose's own bow). Sheathed, a readied spell and bare hands show nothing; the bow's tables show the bow. */
export function weaponShownFor(table, held) {
  switch (table) {
    case 'AttackRanged': return null;
    case 'IdleRanged': case 'MoveRanged': return isBowCode(held) ? held : '0';
    case 'IdleMelee': case 'MoveMelee': case 'AttackMelee': return held && !isBowCode(held) ? held : '0';
    default: return '0';
  }
}

/** Empty-handed, a frame whose arm the hammer hid is its walk's mirror twin: the female's front walk 0-2 is 0-0 flipped
 *  (the other leg forward, the arm whole). */
export const BARE_TWINS = Object.freeze({ female: Object.freeze({ '0-2': '0-0' }) });

/** One frame's rig in the family the chest piece is ('l', 'c' or 'p'), or null where the art holds no hammer. */
export function weaponRigOf(body, rf, top = 'l') {
  const f = rig[body]?.frames?.[rf];
  return f ? f[Math.max(0, rig.families.indexOf({ l: 'leather', c: 'chain', p: 'plate' }[top] ?? 'leather'))] : null;
}
export const WEAPON_SPAN = Object.freeze([...rig.span]);

// ── TAKING THE HAMMER OUT ──────────────────────────────────────────────────────────────────────────────────────────
/**
 * Clear the hammer from a composed picture, in place: each of its px takes the side of the nearest px outside it - open
 * air, or the body it hid - and a body px is the rig's copy (`fill`: a shift [0, dx, dy] or a mirror [1, c, dy]) where
 * that lands on the body, else the smooth blend of the body round it.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {Uint8Array} mask 1 where the hammer is
 * @param {any} fill
 */
export function removeWeapon(out, mask, fill) {
  const w = out.width, h = out.height, d = out.data, n = w * h;
  const side = new Int8Array(n).fill(-1), queue = new Int32Array(n);
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1 && side[i] < 0; dy++) for (let dx = -1; dx <= 1 && side[i] < 0; dx++) {
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if (X >= 0 && Y >= 0 && X < w && Y < h && !mask[j]) { side[i] = d[j * 4 + 3] ? 1 : 0; queue[qt++] = i; }
    }
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
    if (side[i] !== 1) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = d[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    const X = copy ? (copy[0] ? 2 * copy[1] - x : x + copy[1]) : -1, Y = copy ? y + copy[2] : -1, j = Y * w + X;
    if (copy && X >= 0 && Y >= 0 && X < w && Y < h && known(j)) { d[i * 4] = d[j * 4]; d[i * 4 + 1] = d[j * 4 + 1]; d[i * 4 + 2] = d[j * 4 + 2]; }
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
 *  where the body is. */
function mirrorHole(d, w, h, mask, copy) {
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i / w) | 0, X = 2 * copy[1] - x, Y = y + copy[2], j = Y * w + X;
    if (X < 0 || Y < 0 || X >= w || Y >= h || mask[j]) continue;
    for (let c = 0; c < 4; c++) d[i * 4 + c] = d[j * 4 + c];
  }
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
/** A bow, held at its middle: [length cm, bulge cm]. */
const BOW_DIMS = Object.freeze({ sb: [86, 11], lb: [116, 14] });

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
    if (s < p.from || s > p.to) continue;
    const a = (s - p.from) / Math.max(1e-6, p.to - p.from);
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

/** The depth along the shaft, '?' (open air) settled to its nearest known neighbour, 'f' where there is none. */
function settleDepth(d) {
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
  return out.join('');
}
const _depth = new WeakMap();
const depthOf = (fr) => { let v = _depth.get(fr); if (!v) { v = settleDepth(fr.d); _depth.set(fr, v); } return v; };

/**
 * Draw a weapon into a composed picture along a frame's shaft, in place. Where the hammer was behind the body the
 * weapon stays behind it (drawn only into open air); the fist round the grip covers its handle.
 * @param {{width:number,height:number,data:Uint8Array}} out @param {any} fr the frame's rig (weaponRigOf)
 * @param {string} code the weapon code ('ls7') @param {number} len the body's hammer length, px @param {number} view 0..4
 */
export function drawWeapon(out, fr, code, len, view = 2) {
  const shape = code.slice(0, 2), metal = Number(code.slice(2)) || 0;
  if (shape === 'wh') return;   // the art's own
  const w = out.width, h = out.height, d = out.data;
  const [qx, qy] = fr.q, [tx, ty] = fr.t;
  const D = Math.hypot(tx - qx, ty - qy) || 1, ux = (tx - qx) / D, uy = (ty - qy) / D, nx = -uy, ny = ux;
  const k = len / HAMMER_CM;   // px a cm
  const f = Math.max(0.14, Math.min(1, D / len));   // the shaft's foreshortening in this frame
  const depth = depthOf(fr), lo = WEAPON_SPAN[0];
  const front = (proj) => depth[Math.max(0, Math.min(depth.length - 1, Math.round(proj) - lo))] === 'f';
  const px = { ux, uy, nx, ny };
  const side = fr.side || 1;
  let parts, toLocal;
  if (BOWS.has(shape)) {
    // a bow hangs in the hand upright, its belly forward (away from where the hammer trailed), seen edge-on from the
    // front and the back
    const [L, B] = BOW_DIMS[shape];
    const fwd = ux > 0 ? -1 : 1, amp = [0, 0.7, 1, 0.7, 0][view] ?? 1;
    const inFront = [1, 2, 3, 4, 5].filter((t) => front(t)).length >= 3;
    parts = null;
    toLocal = (x, y) => ({ s: (qy - y) / k, v: (x - qx) * fwd / k, inFront });
    return paint(out, (x, y) => {
      const { s, v } = toLocal(x, y), half = L / 2, a = Math.abs(s) / half;
      if (a > 1) return null;
      const belly = B * amp * (1 - a * a) - B * amp;   // the grip at 0, the tips back toward the string
      const limb = 2.4 - 1.2 * a;
      if (Math.abs(v - belly) <= limb) { const c = (v - belly) / limb; return ['wood', [c * fwd, 0, Math.sqrt(1 - c * c)]]; }
      if (amp > 0 && Math.abs(v + B * amp) <= 0.55) return ['string', [0, 0, 1]];
      return null;
    }, () => inFront, [qx - (B + 4) * k, qy - (L / 2 + 4) * k, qx + (B + 4) * k, qy + (L / 2 + 4) * k], metal);
  }
  parts = SHAPES[shape];
  if (!parts) return;
  const sMin = Math.min(...parts.map((p) => p.from)), sMax = Math.max(...parts.map((p) => p.to));
  const wide = 20 * k;   // the widest part's reach from the shaft, px
  const ends = [sMin, sMax].map((sv) => [qx + ux * sv * k * f, qy + uy * sv * k * f]);
  const box = [Math.min(ends[0][0], ends[1][0]) - wide, Math.min(ends[0][1], ends[1][1]) - wide, Math.max(ends[0][0], ends[1][0]) + wide, Math.max(ends[0][1], ends[1][1]) + wide];
  return paint(out, (x, y) => {
    const ex = x - qx, ey = y - qy;
    const proj = ex * ux + ey * uy, s = proj / (k * f), v = (ex * nx + ey * ny) / k;
    if (s < sMin - 1 || s > sMax + 1 || Math.abs(v) > 20) return null;
    return sample(parts, s, v, side, px);
  }, (x, y) => front((x - qx) * ux + (y - qy) * uy), box, metal);

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
      if (d[i + 3] && !inFront(x + 0.5, y + 0.5)) continue;   // the body is in front here
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
export const weaponLen = (body) => rig[body]?.len ?? 30;
