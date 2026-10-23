// ═══════════════════════════════════════════════════════════════════
// WORN-ARMOUR — THE ON-FOOT SPRITE IN THE ARMOUR ACTUALLY WORN.
//
// A skin (LAYERED-GEAR, Eye of the Beholder's `Graphics.LayeredGear`, "On foot Layered Gearing Skin (WIP)", chosen on
// the profile - ui/skinCard.js - as Female or Male): the on-foot body is drawn in the helmet, the chest piece and the
// leg armour it wears, each in its own family (leather / chain / plate) and, for plate, its own metal, in the body
// chosen. A player who chose it is drawn so on every screen: the look carries the choice (`lg`, net/remotePlayers.js
// composeLook). Three slots drive the picture and nothing else:
//
//     EQUIP_SLOTS.Head        -> the helmet (or the hood)
//     EQUIP_SLOTS.ChestArmor  -> the whole upper body: torso, shoulders, arms, hands
//     EQUIP_SLOTS.LegsArmor   -> the whole legs, belt down to the feet
//
// An empty slot is LEATHER - the plain body. Gloves, boots and pauldrons do not change the picture (the chest piece
// owns the arms, the legs piece the feet). Silver, Elven and Dwarven plate have no art and are drawn as steel.
//
// THE ART is `vendor/layered-armor/<gender>/<head>_<top>_<legs>/<record>-<frame>.png`, one STRIP per frame
// (tools/layered-armor/build_strips.py): tile 0 the base picture, tile 1 the slot map (red head, green top, blue legs -
// every plate pixel), tiles 2-8 the seven metals over every plate pixel, 9 the gold rim trim, 10 the wrist-cuff trim.
// A strip with no plate piece is tile 0 alone. The records are Daggerfall's enemy-class layout (player/classSkins.js):
// walk 0-4, attack 5-9, hurt 10-14, idle 15-19, and the bow / cast 20-24 - both bodies carry all of them (the female's
// bow records are the corrected "Frauenbogen" art: 477 / 487, leather from 475's 25-29).
//
// ONLINE needs nothing new on the wire: a peer's look already carries its gender and its equipped items
// (net/wire.js validLookItem: equipSlot + material), so `outfitOfItems` reads the same three slots off it.
// ═══════════════════════════════════════════════════════════════════

import manifest from '../../../vendor/layered-armor/manifest.json' with { type: 'json' };
import cloakManifest from '../../../vendor/layered-armor/cloak/manifest.json' with { type: 'json' };

/** The texture archives the composed pictures are uploaded under - one per body, clear of every vendored archive. */
export const LAYERED_ARCHIVE = Object.freeze({ male: 1700, female: 1701 });

/** EQUIP_SLOTS.Head / ChestArmor / LegsArmor (characters/paperdoll/paperdoll.js) - literals, so the wire-side reader needs no
 *  paperdoll import (test/player/eyeOfTheBeholder/worn_armour.test.js pins them equal). */
export const OUTFIT_SLOTS = Object.freeze({ head: 12, top: 18, legs: 23 });

/** CLOAK: the cloak item's equip slots (Cloak1 / Cloak2) and templates (Casual / Formal Cloak, a man's and a woman's -
 *  itemTemplates.json 154, 155, 191, 192). A worn cloak adds `~<dye>` to the outfit code (dye = DyeColors 0..9, an item
 *  with none (or one out of range) wears Light Brown - the leather cloak's own band, 64-79, as the class sprites draw it). */
export const CLOAK_DEFAULT_DYE = 5;   // DyeColors.LightBrown
export const CLOAK_SLOTS = Object.freeze(/** @type {number[]} */ (cloakManifest.slots));
const CLOAK_TEMPLATES = new Set(/** @type {number[]} */ (cloakManifest.templates));
/** The dye (0..9) of the cloak an equip table wears, or null for none. */
export function cloakOfSlots(slots) {
  for (const s of CLOAK_SLOTS) {
    const it = slots?.[s];
    if (!it || !CLOAK_TEMPLATES.has(it.templateIndex)) continue;
    const dye = Number.isInteger(it.dye) ? it.dye : it.dyeColor;   // a garment's dye (systems/item/itemDye.js itemDyeColor's order)
    return Number.isInteger(dye) && dye >= 0 && dye <= 9 ? dye : CLOAK_DEFAULT_DYE;
  }
  return null;
}

const METALS = /** @type {string[]} */ (manifest.metals);
/** ARMOR_MATERIAL (systems/armorMaterials.js) -> the metal drawn. Silver, Elven, Dwarven: no art yet - steel. */
const PLATE_METAL = Object.freeze({
  0x0200: 'iron', 0x0201: 'steel', 0x0202: 'steel', 0x0203: 'steel', 0x0204: 'steel',
  0x0205: 'mithril', 0x0206: 'adamantium', 0x0207: 'ebony', 0x0208: 'orcish', 0x0209: 'daedric',
});
const CHAIN = new Set([0x0100, 0x0103]);

/** One slot's look: 'l' leather (or nothing worn), 'c' chain, 'p0'..'p6' plate in METALS[n]. */
export function pieceCode(item) {
  const m = item?.material;
  if (!Number.isInteger(m)) return 'l';
  if (CHAIN.has(m)) return 'c';
  if (m >= 0x0200) return `p${Math.max(0, METALS.indexOf(PLATE_METAL[m] ?? 'steel'))}`;
  return 'l';
}

/** The outfit an equip table wears (`slots[EQUIP_SLOTS.x]`), as head + top + legs piece codes: 'p6cl'. */
export const outfitOfSlots = (slots) => {
  const cloak = cloakOfSlots(slots);
  return `${pieceCode(slots?.[OUTFIT_SLOTS.head])}${pieceCode(slots?.[OUTFIT_SLOTS.top])}${pieceCode(slots?.[OUTFIT_SLOTS.legs])}${cloak == null ? '' : `~${cloak}`}`;
};

/** The outfit a peer's look wears - its items (net/wire.js validLookItem) by their `equipSlot`. */
export function outfitOfItems(items) {
  const slots = {};
  for (const it of Array.isArray(items) ? items : []) if (Number.isInteger(it?.equipSlot)) slots[it.equipSlot] = it;
  return outfitOfSlots(slots);
}

const PIECE = /^(l|c|p[0-6])(l|c|p[0-6])(l|c|p[0-6])(?:~([0-9]))?$/;
const FAMILY = { l: 'leather', c: 'chain', p: 'plate' };
/** An outfit code split into its three pieces (and the cloak's dye, or null), or null. */
export function outfitPieces(outfit) {
  const m = PIECE.exec(String(outfit ?? ''));
  return m ? { head: m[1], top: m[2], legs: m[3], cloak: m[4] == null ? null : Number(m[4]) } : null;
}
/** The art's folder for an outfit: '<head>_<top>_<legs>' families. */
export const outfitCombo = (p) => `${FAMILY[p.head[0]]}_${FAMILY[p.top[0]]}_${FAMILY[p.legs[0]]}`;

const bodyOf = (gender) => (gender === 'female' ? 'female' : 'male');

/** LAYERED-GEAR-ON (2026-10-19, the owner: "Make sure this is on by default"): Graphics.LayeredGear's value for THE
 *  CHARACTER'S OWN BODY, and its default - every character is drawn in its armor, in its own body, until the player
 *  chooses a body or Skins on the profile. Never on the wire: the look sends the body it resolves to (`lg` 1 or 2). */
export const LAYERED_OWN = 3;

/** LAYERED-GEAR: the body a Graphics.LayeredGear choice (or a look's `lg`) draws - 1 female, 2 male, LAYERED_OWN the
 *  character's own (`own`, its `gender`: female, else male) - or null for off. */
export const layeredGenderOf = (choice, own = null) => (choice === 1 ? 'female' : choice === 2 ? 'male'
  : choice === LAYERED_OWN ? bodyOf(own) : null);

/** The class-sheet record group each body table reads (classSkins.js CLASS_TABLE_BASE's law): Death the hurt pose
 *  (10-14) where the body has one, else the idle; the bow / cast (20-24) where the body has it (both do now - an
 *  outfit without them falls back to the idle stance). */
function recordBase(table, hasRanged, hasHurt) {
  switch (table) {
    case 'Move': case 'MoveMelee': case 'MoveRanged': case 'MoveSpell': return 0;
    case 'AttackMelee': return 5;
    case 'AttackRanged': case 'AttackSpell': return hasRanged ? 20 : 15;
    case 'Death': return hasHurt ? 10 : 15;
    case 'Idle': case 'IdleMelee': case 'IdleRanged': case 'IdleSpell': return 15;
    default: return null;
  }
}

/**
 * The worn-armour sprite of one on-foot state, in spriteFor's shape - or null when the option is off, the table is
 * not an on-foot one, or this body has no art for the outfit (the male outfits without a plate piece until
 * male_mixes_v66 is built in): the caller then draws the chosen skin as before.
 * @param {string} table  @param {number} offset the wheel's record offset 0..4  @param {number} frame the body's frame
 * @param {number} tableFrames the table's clip length  @param {{gender?:string, outfit?:string}} look  @param {boolean} mirror
 */
export function layeredSprite(table, offset, frame, tableFrames, look, mirror) {
  const worn = outfitPieces(look?.outfit ?? 'lll');
  if (!worn) return null;
  const body = bodyOf(look?.gender);
  const pieces = worn;
  const combo = outfitCombo(pieces);
  const outfit = manifest[body]?.outfits?.[combo];
  if (!outfit) return null;
  const frames = /** @type {string[]} */ (outfit.frames);
  const base = recordBase(table, frames.includes('20-0'), frames.includes('10-0'));
  if (base == null) return null;
  const record = base + offset;
  const n = frames.filter((k) => k.startsWith(`${record}-`)).length || 1;
  const t = Math.max(1, tableFrames | 0);
  const f = Math.floor((Math.min(Math.max(frame | 0, 0), t - 1) * n) / t);
  const cloakFrames = /** @type {string[]|undefined} */ (cloakManifest[body]?.frames);
  const cloak = pieces.cloak != null && cloakFrames?.includes(`${record}-${f}`) ? pieces.cloak : null;   // a frame with no cloak art draws without
  const code = `${pieces.head}${pieces.top}${pieces.legs}${cloak == null ? '' : `~${cloak}`}`;
  return {
    archive: LAYERED_ARCHIVE[body], record, frame: f, mirror,
    key: `LA:${body}:${combo}:${record}-${f}:${code}`,
    rec: `${code}_${record}-${f}${mirror ? 'm' : ''}`,
  };
}

/** A worn-armour sprite key (`LA:...`) - what eotbSpriteUrl hands back as its own "URL", and the decoders take. */
export const isLayeredKey = (key) => typeof key === 'string' && key.startsWith('LA:');

const IN_BROWSER = typeof window !== 'undefined';
/** `<gender>/<combo>/<record>-<frame>` -> the built strip's URL (eager URL strings, lazy pixels - eotbSprite's law). */
const STRIPS = IN_BROWSER
  ? Object.fromEntries(Object.entries(import.meta.glob('../../../vendor/layered-armor/*/*/*.png', { eager: true, query: '?url', import: 'default' }))
    .map(([p, u]) => [p.split('/').slice(-3).join('/').replace(/\.png$/, ''), /** @type {string} */ (u)]))
  : {};

/** `<gender>/<record>-<frame>` -> the cloak strip's URL. */
const CLOAK_STRIPS = IN_BROWSER
  ? Object.fromEntries(Object.entries(import.meta.glob('../../../vendor/layered-armor/cloak/*/*.png', { eager: true, query: '?url', import: 'default' }))
    .map(([p, u]) => [p.split('/').slice(-2).join('/').replace(/\.png$/, ''), /** @type {string} */ (u)]))
  : {};

/** `<gender>/<combo>/<record>-<frame>` -> the hood fix strip's URL (only where the hooded frame needs one). */
const HOODFIX_STRIPS = IN_BROWSER
  ? Object.fromEntries(Object.entries(import.meta.glob('../../../vendor/layered-armor/hoodfix/*/*/*.png', { eager: true, query: '?url', import: 'default' }))
    .map(([p, u]) => [p.split('/').slice(-3).join('/').replace(/\.png$/, ''), /** @type {string} */ (u)]))
  : {};

const SLOT_RGB = { head: [255, 0, 0], top: [0, 255, 0], legs: [0, 0, 255] };

/** LAYERED-GEAR: the skin card's picture of a body in plain leather, front on and standing (the idle's front frame,
 *  15-0: a strip with no plate piece is the picture itself), or null outside a browser build. */
export const layeredPreviewUrl = (gender) => STRIPS[`${bodyOf(gender)}/leather_leather_leather/15-0`] ?? null;

// ── CLOAK ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// A worn cloak is a layer over the finished body (assets: tools/layered-armor/build_cloak.py, cloak/<body>/<record>-<frame>.png,
// seven tiles of the body's own canvas): 0 the cape, 1 the hood + face (painted over the body - nothing under it is erased,
// so the shoulder armour and the helmet's own neck guard stay whole), 2-4 the trim for a leather / chain / plate helmet
// (alpha: what the worn helmet pushes into the open air beside the hood - horn and wing tips), 5 the loincloth (alpha: the
// base's green cloth, which takes the dye too), 6 the shoulders (px the body's shoulder armour keeps as worn without a
// cloak - over the cape's top corners from behind, and on the female's walk / idle over the hood's foot too; its red
// says for which chest pieces: 255 any, else bits 1 leather / 2 chain / 4 plate - a bare leather shoulder lies under
// the cape, a pauldron over it).
// Depth follows the class sheets: a back view (record offsets 3, 4) draws the cape OVER the body, any other view only
// where the body leaves the picture empty. The dye is Daggerfall's own clothing dye - the cloth's green ramp step for step
// onto the dye's 16-colour band (characters/dyes.js CLOTHING_STARTS); everything not green (skin, folds, metal, straps,
// boots) stays as drawn.
const GREEN_LUM = /** @type {number[][]} */ (cloakManifest.ramp).map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);
/** Is this colour the cloth's green (hue 60-165, not grey, not black)? */
function isCloth(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0 || mx < 31 || d / mx < 0.15) return false;
  let h;
  if (mx === r) h = (60 * (g - b)) / d; else if (mx === g) h = 120 + (60 * (b - r)) / d; else return false;
  if (h < 0) h += 360;
  return h >= 60 && h <= 165;
}
/** A cloth colour in the dye's band: its luminance's place on the green ramp, the same place on the dye's. */
export function dyeCloth(r, g, b, dye) {
  const band = (/** @type {number[][][]} */ (cloakManifest.dyes))[dye] ?? cloakManifest.dyes[0];
  const L = 0.299 * r + 0.587 * g + 0.114 * b, last = GREEN_LUM.length - 1;
  let t = 0;
  if (L <= GREEN_LUM[last]) t = last;
  else if (L < GREEN_LUM[0]) { let i = 0; while (GREEN_LUM[i + 1] >= L) i++; t = i + (GREEN_LUM[i] - L) / (GREEN_LUM[i] - GREEN_LUM[i + 1]); }
  const a = Math.floor(t), c = Math.min(last, a + 1), f = t - a;
  return [0, 1, 2].map((k) => Math.round(band[a][k] * (1 - f) + band[c][k] * f));
}
/**
 * HOOD-GAP: the hood sits on the body. Under the hood's lower edge a run of 1-5 empty px with the body right below it
 * (the neck the cleaned frames left open, the female's side walk above all) takes the colour of the hood's own foot px
 * in that column - the shadow under the hood. Only the columns of the hood's lower edge (its foot within 6 px of the
 * lowest), so a weapon or an arm raised beside the hood never closes onto it.
 * @param {Uint8Array} d  @param {number} w  @param {number} h  @param {Int16Array} foot the hood's lowest px per column, or -1
 */
export function closeHoodFoot(d, w, h, foot) {
  let low = -1;
  for (let x = 0; x < w; x++) if (foot[x] > low) low = foot[x];
  if (low < 0) return;
  for (let x = 0; x < w; x++) {
    const f = foot[x];
    if (f < 0 || f < low - 6) continue;
    let k = 1;
    while (k <= 5 && f + k < h && d[((f + k) * w + x) * 4 + 3] === 0) k++;
    if (k === 1 || k > 5 || f + k >= h) continue;   // nothing empty, too long a run (open air), or the canvas ends
    const s = (f * w + x) * 4;
    for (let y = f + 1; y < f + k; y++) { const o = (y * w + x) * 4; d[o] = d[s]; d[o + 1] = d[s + 1]; d[o + 2] = d[s + 2]; d[o + 3] = 255; }
  }
}

/**
 * Lay a cloak over a composed body, in place. `cloak` = { strip (decoded PNG), dye, over }.
 * @param {{width:number,height:number,data:Uint8Array}} out  @param {{width:number,height:number,data:Uint8Array|Uint8ClampedArray}} cs
 * @param {number} dye  @param {boolean} over  @param {string} head the worn helmet's family: 'l', 'c' or 'p'
 * @param {boolean} [noSlivers] drop a cape px that shows only as a 1-px line beside the body (the body's manifest says)
 * @param {string} [top] the worn chest piece's family: 'l', 'c' or 'p'
 */
export function applyCloak(out, cs, dye, over, head = 'l', noSlivers = false, top = 'l') {
  const w = out.width, h = out.height, d = out.data, sw = cs.width, c = cs.data;
  if (sw !== w * 7 || cs.height !== h) return;   // not this canvas: no cloak rather than a misplaced one
  const TRIM = { l: 2, c: 3, p: 4 }[head] ?? 2, LOIN = 5, SHO = 6, TOP_BIT = { l: 1, c: 2, p: 4 }[top] ?? 1;
  const at = (tile, x, y) => (y * sw + tile * w + x) * 4;
  const put = (o, q) => {
    let r = c[q], g = c[q + 1], b = c[q + 2];
    if (isCloth(r, g, b)) [r, g, b] = dyeCloth(r, g, b, dye);
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {          // the loincloth: the base's green cloth takes the dye
    const o = (y * w + x) * 4;
    if (c[at(LOIN, x, y) + 3] && d[o + 3] && isCloth(d[o], d[o + 1], d[o + 2])) [d[o], d[o + 1], d[o + 2]] = dyeCloth(d[o], d[o + 1], d[o + 2], dye);
  }
  // the worn helmet's tips in the open air beside the hood go (they stand over nothing, so nothing is left behind).
  // A trim px at the hood's foot or below it (3 px up from its lowest px in that column, along the hood's lower edge -
  // its foot within 6 px of the lowest) is the helmet's neck under the hood, not a tip: it stays, or the hood floats
  // over a gap (HOOD-GAP, the female's side walk 2-2 / 2-3 and idle 17-0 in a chain or plate helmet).
  const hoodFoot = new Int16Array(w).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (c[at(1, x, y) + 3]) hoodFoot[x] = y;
  let lowFoot = -1;
  for (let x = 0; x < w; x++) if (hoodFoot[x] > lowFoot) lowFoot = hoodFoot[x];
  const neck = (x, y) => hoodFoot[x] >= 0 && hoodFoot[x] >= lowFoot - 6 && y >= hoodFoot[x] - 3;   // the lower edge, not the sides
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (c[at(TRIM, x, y) + 3] && !neck(x, y)) d[(y * w + x) * 4 + 3] = 0;
  const keep = [];                                                    // the shoulder armour, to lay back over the cape
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; const s = at(SHO, x, y); if (c[s + 3] && d[o + 3] && (c[s] === 255 || (c[s] & TOP_BIT))) keep.push(o, d[o], d[o + 1], d[o + 2]); }
  const drawn = noSlivers ? new Uint8Array(w * h) : null;
  const under = noSlivers ? new Uint8Array(w * h * 4) : null;        // what each cape px covered, to give back if it goes
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {          // the cape: over the body from behind, else only in the gaps
    const q = at(0, x, y), o = (y * w + x) * 4;
    if (c[q + 3] && (over || d[o + 3] === 0)) {
      if (under) { under[o] = d[o]; under[o + 1] = d[o + 1]; under[o + 2] = d[o + 2]; under[o + 3] = d[o + 3]; }
      put(o, q); if (drawn) drawn[y * w + x] = 1;
    }
  }
  const restore = (i) => { const o = i * 4; d[o] = under[o]; d[o + 1] = under[o + 1]; d[o + 2] = under[o + 2]; d[o + 3] = under[o + 3]; };
  if (drawn) {                                                        // a cape px with no cape px beside it on the left and the
    const drop = [];                                                  // right, or above and below, is a 1-px line: it goes
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!drawn[y * w + x]) continue;
      const D = (X, Y) => X >= 0 && Y >= 0 && X < w && Y < h && drawn[Y * w + X] === 1;
      if (!((D(x - 1, y) || D(x + 1, y)) && (D(x, y - 1) || D(x, y + 1)))) drop.push(y * w + x);
    }
    for (const i of drop) { restore(i); drawn[i] = 0; }
    // ...and a piece of cape of <= 6 px seen through a small gap in the body (between an arm and the side) is noise
    const seen = new Uint8Array(w * h), stack = [];
    for (let i0 = 0; i0 < w * h; i0++) {
      if (!drawn[i0] || seen[i0]) continue;
      const piece = []; stack.push(i0); seen[i0] = 1;
      while (stack.length) {
        const i = /** @type {number} */ (stack.pop()); piece.push(i);
        const x = i % w, y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy, j = Y * w + X;
          if (X >= 0 && Y >= 0 && X < w && Y < h && drawn[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
      if (piece.length <= 6) for (const i of piece) restore(i);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = at(1, x, y); if (c[q + 3]) put((y * w + x) * 4, q); }   // the hood
  closeHoodFoot(d, w, h, hoodFoot);
  // the shoulder armour, last: as the body wears it without a cloak - over the cape's corners and over the hood's foot
  for (let n = 0; n < keep.length; n += 4) { const o = keep[n]; d[o] = keep[n + 1]; d[o + 1] = keep[n + 2]; d[o + 2] = keep[n + 3]; d[o + 3] = 255; }
}

// ── HOOD FIX ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The hooded frames were cleaned by hand on their own, so for some outfits and frames "body + cloak" is a few px off.
// hoodfix/<body>/<combo>/<record>-<frame>.png (tools/layered-armor/build_hoodfix.mjs) holds those px, laid over the
// cloaked picture: the body strip's first 9 tiles (base, slot map, 7 metals; one tile for a combo with no plate piece).
// A px in the slot map takes the metal of that slot's piece, else the base. Alpha 255: the colour, dyed if it is the
// cloth's green; 128: the colour as it is; 1: the px is cleared.
/**
 * @param {{width:number,height:number,data:Uint8Array}} out  @param {{width:number,height:number,data:Uint8Array|Uint8ClampedArray}} fs
 * @param {{head:string,top:string,legs:string}} pieces  @param {number} dye
 */
export function applyHoodFix(out, fs, pieces, dye) {
  const w = out.width, h = out.height, d = out.data, sw = fs.width, f = fs.data;
  const tilesN = sw === w * 9 ? 9 : sw === w ? 1 : 0;
  if (!tilesN || fs.height !== h) return;   // not this canvas: leave the picture as it is
  const slotPiece = [pieces.head, pieces.top, pieces.legs];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let q = (y * sw + x) * 4;
    if (tilesN === 9) {
      const s = (y * sw + w + x) * 4;
      if (f[s + 3]) {
        const slot = f[s] ? 0 : f[s + 1] ? 1 : 2, p = slotPiece[slot];
        if (p[0] === 'p') { const m = (y * sw + (2 + Number(p.slice(1))) * w + x) * 4; if (f[m + 3]) q = m; }
      }
    }
    const a = f[q + 3];
    if (!a) continue;
    const o = (y * w + x) * 4;
    if (a === 1) { d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0; continue; }
    let r = f[q], g = f[q + 1], b = f[q + 2];
    if (a === 255 && isCloth(r, g, b)) [r, g, b] = dyeCloth(r, g, b, dye);
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
}

/**
 * Compose one strip (a decoded PNG, top row first, RGBA bytes) into the outfit's picture: the base, then each plate
 * piece's metal over its own slot's pixels, then that metal's trim, then the cloak if the outfit wears one. Pure - the
 * pins drive it.
 * @param {{width:number,height:number,data:Uint8Array|Uint8ClampedArray}} strip
 * @param {string} code the outfit code ('p6cl', 'p6cl~2' with a cloak dyed Red)
 * @param {{strip:{width:number,height:number,data:Uint8Array|Uint8ClampedArray}, over:boolean, noSlivers?:boolean,
 *   fix?:{width:number,height:number,data:Uint8Array|Uint8ClampedArray}|null}|null} [cloak] the frame's cloak strip (and its hood fix)
 * @returns {{width:number,height:number,data:Uint8Array}}
 */
export function composeStrip(strip, code, cloak = null) {
  const pieces = outfitPieces(code);
  const plate = pieces ? Object.entries({ head: pieces.head, top: pieces.top, legs: pieces.legs }).filter(([, p]) => p[0] === 'p') : [];
  const tilesN = manifest.tiles.length;
  const w = plate.length && strip.width % tilesN === 0 ? strip.width / tilesN : strip.width;
  const h = strip.height, sw = strip.width, src = strip.data;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(src.subarray(y * sw * 4, (y * sw + w) * 4), y * w * 4);
  const res = { width: w, height: h, data: out };
  const finish = () => {
    if (cloak && pieces?.cloak != null) {
      applyCloak(res, cloak.strip, pieces.cloak, cloak.over, pieces.head[0], cloak.noSlivers === true, pieces.top[0]);
      if (cloak.fix) applyHoodFix(res, cloak.fix, pieces, pieces.cloak);
    }
    return res;
  };
  if (w === sw) return finish();
  for (const [slot, p] of plate) {
    const metal = METALS[Number(p.slice(1))] ?? 'steel';
    const mt = 2 + METALS.indexOf(metal), tt = manifest.trim[metal] === 'cuffs' ? 10 : 9;
    const [r, g, b] = SLOT_RGB[slot];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = (y * sw + w + x) * 4;   // tile 1, the slot map
        if (src[s + 3] === 0 || src[s] !== r || src[s + 1] !== g || src[s + 2] !== b) continue;
        const o = (y * w + x) * 4;
        for (const tile of [mt, tt]) {
          const q = (y * sw + tile * w + x) * 4;
          if (src[q + 3]) { out[o] = src[q]; out[o + 1] = src[q + 1]; out[o + 2] = src[q + 2]; out[o + 3] = src[q + 3]; }
        }
      }
    }
  }
  return finish();
}

/** Is the cape drawn OVER the body on this frame? The walk / attack / hurt / idle by the view (record offsets 3, 4: from
 *  behind); the bow / cast (records 20-24), where the archer turns side-on to shoot, by the frame (`overFrames`) - which
 *  also names the odd on-foot frame whose cape hangs over the back's edge (the male's side swing). */
const cloakOver = (body, rf) => {
  const rec = Number(rf.split('-')[0]), m = cloakManifest[body], of = m?.overFrames ?? [];
  return rec >= 20 ? of.includes(rf) : (m?.over ?? [3, 4]).includes(rec % 5) || of.includes(rf);
};

/**
 * Fetch and compose a worn-armour key's picture, top row first - the decoders (eotbBody decodeSprite, peerRiders
 * decodeUrl) turn it to the world's row order as they do any PNG. `decodePng` is theirs (systems/textureReplacement.js).
 * A cloak's strip that cannot be had is left off: the body draws without it.
 * @param {string} key  @param {(bytes:Uint8Array)=>Promise<{width:number,height:number,data:Uint8Array}>} decodePng
 */
export async function decodeLayered(key, decodePng, { fetchUrl = (u) => fetch(u), urlOf = (k) => STRIPS[k], cloakUrlOf = (k) => CLOAK_STRIPS[k], hoodFixUrlOf = (k) => HOODFIX_STRIPS[k] } = {}) {
  const [, body, combo, rf, code] = key.split(':');
  const url = urlOf(`${body}/${combo}/${rf}`);
  if (!url) throw new Error(`${key}: no art`);
  const res = await fetchUrl(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const strip = await decodePng(new Uint8Array(await res.arrayBuffer()));
  let cloak = null;
  if (outfitPieces(code)?.cloak != null) {
    const cu = cloakUrlOf(`${body}/${rf}`);
    try {
      const cr = cu ? await fetchUrl(cu) : null;
      if (cr?.ok) cloak = { strip: await decodePng(new Uint8Array(await cr.arrayBuffer())), over: cloakOver(body, rf), noSlivers: cloakManifest[body]?.noSlivers === true, fix: null };
    } catch { cloak = null; }
    const fu = cloak ? hoodFixUrlOf(`${body}/${combo}/${rf}`) : null;   // a hood fix that cannot be had is left off
    if (fu) {
      try { const fr = await fetchUrl(fu); if (fr?.ok) cloak.fix = await decodePng(new Uint8Array(await fr.arrayBuffer())); } catch { /* no fix */ }
    }
  }
  return composeStrip(strip, code, cloak);
}
