// @ts-check
// AUDIT-STOREFRONT (2026-10-29, the owner: "exceptional design for all assets"; bible/06-Systems/Storefront.md section 9):
// THE EFFECTS' EMBLEMS - a kill effect's, a portal skin's and a mount look's picture where the effect itself cannot
// play: a bundle's stage, the profile's slot choices, the Battle Pass's track. AUDIT-STOREFRONT II (the owner: "the
// glyphs for the horse and the general art of those icons is so bad"): drawn again by the profile icons' engine
// (ui/profileIcons.js drawnIconNode) - a lit field in a bezel, the picture modelled and moving, still for less motion;
// the drawings are ui/icons/effectEmblemArt.js. A document that cannot make SVG answers null. Not a DFU member.
import { effectName } from './effectText.js';
import { drawnIconNode } from './profileIcons.js';
import { EMBLEM_ART } from './icons/effectEmblemArt.js';

export { EMBLEM_ART };

/**
 * AN EFFECT'S EMBLEM, as an `<svg>` element `size` px square in `doc` (classed `cls`): its field, its bezel and its
 * picture, moving unless `still` (by default the player's reduced motion). Null for an effect with no emblem or a
 * document that cannot make SVG.
 * @param {any} doc @param {string} slot @param {string} key @param {string} [cls] @param {number} [size] @param {{ still?: boolean }} [o]
 */
export function effectEmblemNode(doc, slot, key, cls = 'fx-emblem', size = 64, o = {}) {
  const id = `${slot}:${key}`;
  const art = Object.hasOwn(EMBLEM_ART, id) ? /** @type {any} */ (EMBLEM_ART)[id] : null;
  return art ? drawnIconNode(doc, art, { key: `fxem-${slot}-${key}`, label: effectName(slot, key), cls, size, ...o }) : null;
}
