// HAND-WRAPS (2026-10-29, the owner: "allow players using hand combat to recieve the outlines others recieve when a
// weapon is enchanted? Maybe a new weapon type like hand wraps?", then "Carry lines only"). bible/05-Combat/Hand-Wraps.md.
//
// A weapon for the fists. Worn in a hand, it fights as the bare hands do: the fists' art and swing (combat/fpsWeapon.js),
// the Hand-to-Hand skill (characters/weapons.js), both fists up (combat/twoHands/handsLaw.js), and the fists' own damage
// (combat/formulas.js: no weapon damage, no metal). What it adds is what it carries: an enchantment's Strikes payload and
// the loot ladder's lines, read on the fist's blow, and so the glow those give a weapon (systems/weaponGlow.js).
// Cloth, so no metal: every mint is material 0, and the name says none (systems/item/itemInfo.js).
import {
  registerCustomTemplates,
  registerCustomItemGroup,
  registerTemplateLore,
  mintCondition,
  setItemFields,
} from './item/itemTemplates.js';
import { HAND_WRAPS_TEMPLATE, isHandWraps } from '../characters/handWrapsIds.js';

export { HAND_WRAPS_TEMPLATE, isHandWraps };

/**
 * The row, in DFU's ItemTemplates.txt columns. A Gauntlets' enchantment points (400), a cloth's weight, a base price of
 * 30. Its picture in a list is the Mummy Wrappings' strip of cloth (TEXTURE.254 #41, the player's own ARENA2); it
 * draws no layer on the doll (ui/paperDoll.js). Rarity 3: a shelf's common stock.
 */
export const HAND_WRAPS_TEMPLATES = Object.freeze([
  {
    index: HAND_WRAPS_TEMPLATE,
    name: 'Hand Wraps',
    baseWeight: 0.5,
    hitPoints: 400,
    basePrice: 30,
    enchantmentPoints: 400,
    rarity: 3,
    drawOrderOrEffect: 100,
    isBluntWeapon: false,
    isOneHanded: true,
    worldTextureArchive: 254,
    worldTextureRecord: 41,
    playerTextureArchive: 0,
    playerTextureRecord: 0,
  },
]);
registerCustomTemplates(HAND_WRAPS_TEMPLATES);
// a weaponsmith's shelf and the random weapon roll (systems/shopStock.js, systems/loot/loot.js createRandomWeapon)
registerCustomItemGroup(HAND_WRAPS_TEMPLATE, 'Weapons');
registerTemplateLore(
  HAND_WRAPS_TEMPLATE,
  'Strips of linen bound over the knuckles. They add nothing to a punch, but they hold an enchantment as a blade does.',
);

/** Mint one: cloth, material 0, whatever was asked. */
export function createHandWraps() {
  return mintCondition(
    setItemFields({
      group: 'Weapons',
      templateIndex: HAND_WRAPS_TEMPLATE,
      material: 0,
      flags: 0,
      variant: 0,
      message: 0,
      stackCount: 1,
    }),
  );
}
