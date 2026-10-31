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
/** PROFILE-SLOTS: each line's name - the set a whole line makes (the profile's Wear the whole set). */
export const ARMORY_LINE_TEXT = Object.freeze({
  dagonfire: () => t('armory.line.dagonfire', 'Dagonfire'),
  eternal: () => t('armory.line.eternal', 'Eternal'),
  guild: () => t('armory.line.guild', 'Guild'), // GUILD-SHOP
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
  insigniaarmlet: () => t('armory.name.insigniaarmlet', 'Insignia Armlet'), // GUILD-SHOP
});
/** What each piece looks like, in a sentence or two. */
export const ARMORY_LOOK = Object.freeze({
  burningcrown: () =>
    t(
      'armory.look.burningcrown',
      'A circlet of molten iron, with horns of flame and a door of white fire at the brow. Embers lift off the points.',
    ),
  emberheart: () =>
    t(
      'armory.look.emberheart',
      'A cracked coal burns in the chest and beats like a heart. Fire runs out along its veins with every beat.',
    ),
  ashbound: () =>
    t(
      'armory.look.ashbound',
      'A chain of glowing iron winds round the arms, from the shoulders to the wrists. Ash falls from it.',
    ),
  cinderstride: () =>
    t(
      'armory.look.cinderstride',
      'Low flames lick up the shins from a ring of coal at each ankle. Each step leaves an ember on the ground that burns out.',
    ),
  breachbrand: () =>
    t('armory.look.breachbrand', 'Fire runs along the weapon from the grip to the point, and drips from the tip.'),
  eternalhalo: () =>
    t(
      'armory.look.eternalhalo',
      "A band of blue-violet fire turns over the head, runes round it and the Origin's spark at its front.",
    ),
  eternalsigil: () =>
    t(
      'armory.look.eternalsigil',
      "The Origin's dragon of light circles the spark on the chest, biting its own tail. A slow light runs round it.",
    ),
  eternalarmlets: () =>
    t(
      'armory.look.eternalarmlets',
      'Engraved bands of blue-violet fire circle the upper arms and the wrists. Flames lick up off them.',
    ),
  eternalgreaves: () =>
    t(
      'armory.look.eternalgreaves',
      'Blue-violet fire wraps the legs from the knee to the foot, under a lattice of light. Sparks rise as you walk.',
    ),
  eternaledge: () =>
    t(
      'armory.look.eternaledge',
      "A blade of blue-violet light runs along the weapon's edge. Sparks trail from it when you swing.",
    ),
  insigniaarmlet: () =>
    t(
      'armory.look.insigniaarmlet',
      "A gilt band round the left upper arm, enamelled in your guild's colors, with its arms on a shield of beaten gold.",
    ), // GUILD-SHOP
});
/** A SET's name and look (the shop's Eternal Set, its five pieces at once). */
export const ARMORY_SET_TEXT = Object.freeze({ eternalset: () => t('armory.name.eternalset', 'The Eternal Set') });
export const ARMORY_SET_LOOK = Object.freeze({
  eternalset: () =>
    t(
      'armory.look.eternalset',
      'All five Eternal pieces at once: the Halo, the Sigil, the Armlets, the Greaves and the Edge.',
    ),
});
/** A piece's name - or a set's - by its key, or the key for one that is neither. */
export const armoryPieceName = (/** @type {string} */ key) =>
  (
    ARMORY_TEXT[/** @type {keyof typeof ARMORY_TEXT} */ (key)] ??
    ARMORY_SET_TEXT[/** @type {keyof typeof ARMORY_SET_TEXT} */ (key)]
  )?.() ?? key;
/** PROFILE-SLOTS: a line's name by its key. */
export const armoryLineName = (/** @type {string} */ line) =>
  ARMORY_LINE_TEXT[/** @type {keyof typeof ARMORY_LINE_TEXT} */ (line)]?.() ?? line;
/** A slot's name by its key. */
export const armorySlotName = (/** @type {string} */ slot) =>
  ARMORY_SLOT_TEXT[/** @type {keyof typeof ARMORY_SLOT_TEXT} */ (slot)]?.() ?? slot;
/** A piece's slot's name, or ''. */
export const armoryPieceSlotName = (/** @type {string} */ key) => {
  const p = armoryPieceOf(key);
  return p ? armorySlotName(p.slot) : '';
};
