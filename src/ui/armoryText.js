// @ts-check
// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md): THE AURA ARMORY IN THE PLAYER'S LANGUAGE - each slot's name,
// each piece's name and what it looks like, read through the text core where they are drawn (the account card, the shop,
// the Collections page, the chat's word of a find). The English is the service's too (net/armoryLaw.js ARMORY_NAME - a
// pin holds the two equal).
import { t } from '../systems/textManager.js';
import { armoryPieceOf } from '../net/armoryLaw.js';

/** Each slot's name. */
export const ARMORY_SLOT_TEXT = Object.freeze({
  head: () => t('armory.slot.head', 'Head'),
  torso: () => t('armory.slot.torso', 'Torso'),
  arms: () => t('armory.slot.arms', 'Arms'),
  legs: () => t('armory.slot.legs', 'Legs'),
  weapon: () => t('armory.slot.weapon', 'Weapon'),
});
/** Each piece's name. */
export const ARMORY_TEXT = Object.freeze({
  burningcrown: () => t('armory.name.burningcrown', 'Crown of the Burning Door'),
  emberheart: () => t('armory.name.emberheart', 'Ember Heart'),
  ashbound: () => t('armory.name.ashbound', 'Ashbound Bracers'),
  cinderstride: () => t('armory.name.cinderstride', 'Cinderstride'),
  breachbrand: () => t('armory.name.breachbrand', 'Brand of the Breach'),
  eternalhalo: () => t('armory.name.eternalhalo', 'Eternal Halo'),
  eternalsigil: () => t('armory.name.eternalsigil', 'Eternal Sigil'),
  eternalarmlets: () => t('armory.name.eternalarmlets', 'Eternal Armlets'),
  eternalgreaves: () => t('armory.name.eternalgreaves', 'Eternal Greaves'),
  eternaledge: () => t('armory.name.eternaledge', 'Eternal Edge'),
});
/** What each piece looks like, in a sentence or two. */
export const ARMORY_LOOK = Object.freeze({
  burningcrown: () => t('armory.look.burningcrown', 'A ring of fire over the brow, with horns of flame that rise from it. Embers lift off the points.'),
  emberheart: () => t('armory.look.emberheart', 'A coal burns in the chest and beats like a heart. Veins of fire run out from it across the ribs.'),
  ashbound: () => t('armory.look.ashbound', 'Chains of glowing ember wind round the arms, from the shoulders to the wrists. Ash falls from them.'),
  cinderstride: () => t('armory.look.cinderstride', 'Low flames lick up the shins. Each step leaves an ember on the ground that burns out.'),
  breachbrand: () => t('armory.look.breachbrand', 'Fire runs along the weapon from the grip to the point, and drips from the tip.'),
  eternalhalo: () => t('armory.look.eternalhalo', 'A thin ring of blue-violet fire turns over the head, with the Origin\'s spark at its front.'),
  eternalsigil: () => t('armory.look.eternalsigil', 'The Origin\'s ring burns on the chest, its spark at the heart. A slow light runs round it.'),
  eternalarmlets: () => t('armory.look.eternalarmlets', 'Bands of blue-violet fire circle the upper arms and the wrists. Wisps trail behind them.'),
  eternalgreaves: () => t('armory.look.eternalgreaves', 'Blue-violet fire wraps the legs from the knee to the foot. Sparks rise as you walk.'),
  eternaledge: () => t('armory.look.eternaledge', 'A blade of blue-violet light runs along the weapon\'s edge. Sparks trail from it when you swing.'),
});
/** A piece's name by its key, or the key for one that is no piece. */
export const armoryPieceName = (/** @type {string} */ key) => ARMORY_TEXT[/** @type {keyof typeof ARMORY_TEXT} */ (key)]?.() ?? key;
/** A slot's name by its key. */
export const armorySlotName = (/** @type {string} */ slot) => ARMORY_SLOT_TEXT[/** @type {keyof typeof ARMORY_SLOT_TEXT} */ (slot)]?.() ?? slot;
/** A piece's slot's name, or ''. */
export const armoryPieceSlotName = (/** @type {string} */ key) => { const p = armoryPieceOf(key); return p ? armorySlotName(p.slot) : ''; };
