// @ts-check
// BACK-HOLSTER GLOW (2026-10-30, Mac: "if the weapon has an effect, like the shock effect or an equipped weapon aura,
// does it show?" - then "Do this and yes to #2"): A WEAPON'S GLOW ON AN EYE OF THE BEHOLDER SPRITE, mine and every
// walker's - on the weapon on its back while sheathed, and round the whole sprite while drawn (the weapon is painted
// into the picture, with nothing to tell it from the hand). The look is the weapon glow's own law (systems/
// weaponGlow.js); the drawing the classic outline's, on a world quad (render/renderer.js drawBillboardGlow). Each owner
// lists what it drew this frame, and the aura host draws them last, over the capes (scenes/auraHost.js).

import { meshGlow, glowFromWord, fistGlow, weaponGlowOn } from '../../systems/weaponGlow.js';

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

/** One glow drawn on a sprite this frame: its picture's renderer key and look, and its quad as the billboard stands. */
export function createSpriteGlow() {
  return { key: '', glow: /** @type {any} */ (null), origin: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], w: 0, h: 0, art: [0, 0] };
}

/** Fill `g` in place: `key` the texture (`archive_record`), `glow` its spec, the quad's foot's middle, its right and up,
 *  its size (m) and its cells (the picture's own pixels, wide and tall). Answers `g`. */
export function setSpriteGlow(g, key, glow, origin, right, up, w, h, cellsW, cellsH) {
  g.key = key; g.glow = glow;
  for (let i = 0; i < 3; i++) { g.origin[i] = origin[i]; g.right[i] = right[i]; g.up[i] = up[i]; }
  g.w = w; g.h = h; g.art[0] = cellsW; g.art[1] = cellsH;
  return g;
}

/** Draw the frame's sprite glows - each owner's list (eotbBody and the walkers' glowsDrawn). Answers how many drew. */
export function drawSpriteGlows(renderer, ...lists) {
  if (!renderer?.drawBillboardGlow) return 0;
  let n = 0;
  for (const list of lists) for (const g of list ?? []) if (g?.glow && renderer.drawBillboardGlow(g.key, g.glow, g)) n++;
  return n;
}
