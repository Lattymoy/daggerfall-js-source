// @ts-check
// BACK-HOLSTER GLOW (2026-10-30, Mac: "if the weapon has an effect, like the shock effect or an equipped weapon aura,
// does it show?" - then "Do this and yes to #2"): A WEAPON'S GLOW ON AN EYE OF THE BEHOLDER SPRITE, mine and every
// walker's - on the weapon on its back while sheathed, and while drawn round the weapon in the hand: a worn-armour
// body's own (LAYERED-GLOW), else the whole sprite (a skin's weapon is painted into its picture, with nothing to tell
// it from the hand). The look is the weapon glow's own law (systems/
// weaponGlow.js); the drawing the classic outline's, on a world quad (render/renderer.js drawBillboardGlow). Each owner
// lists what it drew this frame; the aura host draws each over its own cape, under a nearer one (scenes/auraHost.js).

import { meshGlow, glowFromWord, fistGlow, weaponGlowOn } from '../../systems/weaponGlow.js';
import { redrawHolstersOver } from './eotbHolster.js';

/** The look a weapon of MINE wears on a sprite: law 9's set, law 8's crimson, its element, law 7's Armory piece, or
 *  law 5's arcane (meshGlow - a paper-doll picture has no enchanted sheet, as a Morrowind model has none). A bare fist
 *  wears its Hand Wraps' glow, else the kit's weapon piece (weaponRig.js handGlowOf's order). None with the switch off. */
export function myWeaponGlow(item, on = weaponGlowOn(), wraps = null) {
  if (!on) return null;
  if (item) return meshGlow(item, { on: true });
  return wraps ? meshGlow(wraps, { on: true }) : fistGlow(undefined, true);
}

/** The look a PEER's weapon wears: its look's word (net/wire.js validLookItem `glow`, written by meshGlow on their
 *  side), or for a bare fist their kit's weapon piece (`kit` their token's, peer.ak). By MY switch. */
export function peerWeaponGlow(item, kit = null, on = weaponGlowOn()) {
  if (!on) return null;
  return item ? glowFromWord(item.glow) : fistGlow(kit, true);
}

/** One glow drawn on a sprite this frame: its picture's renderer key and look, its quad as the billboard stands, and
 *  `owner` the wearer's id its aura is drawn under (eotbHolster.js SELF_OWNER mine). */
export function createSpriteGlow(owner = null) {
  return { owner, key: '', archive: /** @type {any} */ (null), record: /** @type {any} */ (null), glow: /** @type {any} */ (null), origin: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], w: 0, h: 0, art: [0, 0] };
}

/** Fill `g` in place: the texture (`archive`, `record` - its key written only when they change: the draw path allocates
 *  nothing), `glow` its spec, the quad's foot's middle, its right and up, its size (m) and its cells (the picture's own
 *  pixels, wide and tall). Answers `g`. */
export function setSpriteGlow(g, archive, record, glow, origin, right, up, w, h, cellsW, cellsH) {
  if (g.archive !== archive || g.record !== record) { g.archive = archive; g.record = record; g.key = `${archive}_${record}`; }
  g.glow = glow;
  for (let i = 0; i < 3; i++) { g.origin[i] = origin[i]; g.right[i] = right[i]; g.up[i] = up[i]; }
  g.w = w; g.h = h; g.art[0] = cellsW; g.art[1] = cellsH;
  return g;
}

/** LAYERED-GLOW (2026-10-30, the owner: "ensure all third person weapons get the glow on equip (a prior change kinda
 *  did this but for the whole body)"): the renderer record suffix of a worn-armour sprite's weapon picture; a pair's
 *  second weapon's its own (OFF_SUFFIX), glowing its own hand's colours. */
export const HELD_SUFFIX = '#w', OFF_SUFFIX = '#o';
/** AUDIT: how long a worn-armour frame drawn before its weapon's paper-doll picture came stands before it is decoded
 *  again (eotbBody's and the walkers' stores; layeredArmor.js decodeLayered `provisional`). */
export const PICTURE_RETRY_MS = 5000;

/** LAYERED-GLOW: a worn-armour picture's weapon px as uploaded - `held` the compose's mask (top row first; `part` 1 the
 *  line's weapon, 2 a pair's second), `colors` the upload (row 0 the bottom, mirrored as `mirror` says): { idx, col }, or
 *  null for a picture with no weapon of its own. */
export function heldGlowPx(colors, held, w, h, mirror = false, part = 1) {
  if (!held || held.length !== w * h) return null;
  const idx = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (held[y * w + x] === part) idx.push((h - 1 - y) * w + (mirror ? w - 1 - x : x));
  const at = Uint32Array.from(idx);
  return { idx: at, col: Uint32Array.from(at, (i) => colors[i]), of: /** @type {any} */ (null), rec: '', key: '' };
}

/** LAYERED-GLOW: the record a hand glow outlines - the weapon's own picture (`held`, heldGlowPx), uploaded once under the
 *  sprite's record and HELD_SUFFIX; '' where this frame shows none of it (no glow); null where the picture has no
 *  weapon of its own (a skin, a bare hand: the whole sprite). */
export function heldGlowRecord(renderer, archive, rec, held, w, h, suffix = HELD_SUFFIX) {
  if (!held) return null;
  if (!held.idx.length) return '';
  if (held.of !== rec) { held.of = rec; held.rec = `${rec}${suffix}`; held.key = `${archive}_${held.rec}`; }   // once: the draw path allocates nothing
  if (renderer?.uploadTexture && !renderer.textures?.has?.(held.key)) {
    const colors = new Uint32Array(w * h);
    for (let i = 0; i < held.idx.length; i++) colors[held.idx[i]] = held.col[i];
    renderer.uploadTexture(archive, held.rec, { width: w, height: h, colors });
  }
  return held.rec;
}

/** LAYERED-GLOW: let a sprite's weapon picture go with the sprite's (`key` its renderer key), where one was uploaded. */
export function evictHeld(renderer, key) {
  for (const k of [`${key}${HELD_SUFFIX}`, `${key}${OFF_SUFFIX}`]) if (renderer?.textures?.has?.(k)) renderer.evictTexture?.(k);
}

/** Draw the frame's sprite glows in `lists` (eotbBody and the walkers' glowsDrawn) whose owner `keep` takes (null: all).
 *  Answers how many drew. */
export function drawSpriteGlows(renderer, keep, ...lists) {
  if (!renderer?.drawBillboardGlow) return 0;
  let n = 0;
  for (const list of lists) for (const g of list ?? []) if (g?.glow && (!keep || keep(g.owner)) && renderer.drawBillboardGlow(g.key, g.glow, g)) n++;
  return n;
}

/** AUDIT BACK-HOLSTER A2: THE SPRITES' BACKS BY WEARER - an owner's weapons on the back (drawn again) and its glows,
 *  `sources()` the frame's owners (eotbBody and the walkers: holstersDrawn, glowsDrawn). `has(id)` and `draw(id)` one
 *  wearer's, straight after its aura (eotbHolster.js drawAurasThenBacks); `drawBare(worn)` the glows of every owner
 *  not in `worn` (a Set of ids), before the auras, so a nearer one lies over them. */
export function createSpriteBacks(renderer, sources) {
  let id = null, worn = /** @type {Set<any>} */ (new Set());
  const own = (o) => o === id, bare = (o) => !worn.has(o);
  const owns = (list, k) => { for (const x of list ?? []) if (x?.owner === k) return true; return false; };
  return {
    has(k) {
      for (const s of sources()) if (owns(s?.holstersDrawn?.(), k) || owns(s?.glowsDrawn?.(), k)) return true;
      return false;
    },
    draw(k) {
      id = k;
      for (const s of sources()) { redrawHolstersOver(renderer, own, s?.holstersDrawn?.()); drawSpriteGlows(renderer, own, s?.glowsDrawn?.()); }
    },
    drawBare(w) {
      worn = w;
      let n = 0;
      for (const s of sources()) n += drawSpriteGlows(renderer, bare, s?.glowsDrawn?.());
      return n;
    },
  };
}
