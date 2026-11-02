// @ts-check
// EG-E (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, THE LORDS' NAMED
// LEGENDARIES): each Battlespire lord drops one named piece - a fixed base and a fixed name, 1 in EG_LORD_ARM_IN at its
// Redoubt (net/eliteGates/egPay.js; systems/eliteGates/egSpoils.js rollEgSpoils draws it). Its powers are the loot ladder's, rolled at the
// Redoubt's door like every Legendary's, and its technique line the door's last pass (TECH1 law 4: a technique is found,
// never chosen) - so a lord's piece is a chase, not a recipe. The name is written over the ladder's, as a revenant's
// trophy's is (systems/revenant/revenantTrophy.js): a Legendary's record keeps its powers, not its name.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { createWeapon, randomMaterial, WEAPONS_ENUM as W } from '../../combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../item/itemTemplates.js';
import { applyRarity } from '../loot/lootRarity.js';

/** Each lord's piece: its name and its base (a weapon template), section 19's table. */
export const EG_LORD_ARMS = Object.freeze({
  hound: Object.freeze({ name: 'The Houndfang', template: W.Saber }),
  spellmaster: Object.freeze({ name: "The Examiner's Staff", template: W.Staff }),
  armsmaster: Object.freeze({ name: 'The Last Lesson', template: W.Longsword }),
  ilthys: Object.freeze({ name: 'Conquest', template: W['War Axe'] }),
  cairnkeeper: Object.freeze({ name: 'Tithe', template: W.Mace }),
  twins: Object.freeze({ name: 'Rivalry', template: W['Dai-Katana'] }),
  morvayn: Object.freeze({ name: 'Soulchain', template: W.Flail }),
  dusk: Object.freeze({ name: 'Duskwing', template: W['Long Bow'] }),
  stalker: Object.freeze({ name: 'Bloodmoon', template: W.Tanto }),
  seyth: Object.freeze({ name: 'Mirrorshard', template: W.Shortsword }),
  colossus: Object.freeze({ name: "The Engine's Heart", template: W.Warhammer }),
  wyrm: Object.freeze({ name: 'Wyrmbreath', template: W.Claymore }),
  garoth: Object.freeze({ name: 'The Clan-Breaker', template: W['Battle Axe'] }),
});

/**
 * A LORD'S NAMED LEGENDARY, minted on the spoils' own draws: its base of the better of two materials at the level (the
 * revenant trophy's), laddered Legendary, named for it. Null for a key with no piece (a champion).
 * @param {string} lord @param {number} level @param {() => number} rolls
 */
export function egLordArm(lord, level, rolls) {
  const arm = EG_LORD_ARMS[lord];
  if (!arm) return null;
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const material = Math.max(randomMaterial(lv, rolls), randomMaterial(lv, rolls));
  const item = mintCondition(setItemFields({ group: 'Weapons', ...createWeapon(arm.template, material, rolls) }));
  if (!item) return null;
  applyRarity(item, 'legendary', rolls);
  item.isIdentified = true;
  item.name = arm.name;
  return item;
}
