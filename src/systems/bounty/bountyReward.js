// @ts-check
// BOUNTY1: THE PURSE AND THE PIECE a bounty pays (systems/bounty/bountyBoard.js owns the numbers; this mints the item).
//
// One piece of kit: a weapon or a piece of armour, half and half - never ammunition, never a shield of a custom
// class the registry cannot name. It comes at the bounty level's share of its maxCondition (bountyItemRule), which
// is minted first for armour (mintCondition: a plain armour piece leaves the generator with no condition at all), and
// from level 4 it may be minted Magic (blue) through the loot ladder's own applyRarity - never higher. With Loot
// Rarity off the ladder has no Magic tier to mint, so the piece stays white.
import { createRandomWeapon, createRandomArmor } from '../loot/loot.js';
import { applyRarity, lootRarityOn, rarityOf, RARITIES } from '../loot/lootRarity.js';
import { mintCondition, isAmmunition, templateByIndex } from '../item/itemTemplates.js';
import { bountyItemRule } from './bountyBoard.js';

/** How many rolls the mint takes before it settles for a plain weapon. */
const MINT_TRIES = 12;

/** A piece the reward may be: a named weapon or armour piece the template table knows, never ammunition. */
function usable(item) {
  if (!item || (item.group !== 'Weapons' && item.group !== 'Armor')) return false;
  if (item.group === 'Weapons' && isAmmunition(item)) return false;
  return !!(item.name && String(item.name).trim()) && !!templateByIndex(item.templateIndex);
}

/**
 * Mint the reward's piece for a bounty of `level`.
 * @param {number} level the bounty's level
 * @param {{ rolls?: () => number, rarityOn?: boolean }} [o]
 */
export function mintBountyItem(level, { rolls = Math.random, rarityOn = lootRarityOn() } = {}) {
  const rule = bountyItemRule(level);
  let item = null;
  for (let i = 0; i < MINT_TRIES && !usable(item); i++) {
    item = rolls() < 0.5 ? createRandomWeapon(level, rolls) : createRandomArmor(level, rolls);
  }
  if (!usable(item)) item = createRandomWeapon(1, () => 0.4);   // a plain blade, whatever the rolls said
  mintCondition(item);
  const max = Number(item.maxCondition) || 0;
  if (max > 0) item.currentCondition = Math.max(1, Math.round(max * rule.condition));
  if (max > 0) item.foundCondition = item.currentCondition;   // AUDIT SUGGESTIONS-1019 L1-3: SELL-AS-FOUND's mark (tradeModes.js) - online a mended reward sells as it was handed over and a third of the mend (MEND-THIRD)
  if (rarityOn && rule.magicChance > 0 && rolls() < rule.magicChance) applyRarity(item, 'magic', rolls);
  return item;
}

/** "an Iron Longsword", "a Helm" - the piece as the notice names it. */
export function bountyItemName(item) {
  const n = String(item?.name ?? 'trinket').trim();
  if (/\b(Boots|Greaves|Gauntlets)$/.test(n)) return `a pair of ${n}`;
  return `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;
}

/** The notice's reward rows: the gold, and the piece with its tier's word and colour and its condition. */
export function bountyRewardRows(gold, item) {
  const tier = rarityOf(item);
  const r = RARITIES[tier] ?? RARITIES.common;
  const max = Number(item?.maxCondition) || 0;
  const cond = max > 0 ? Math.round((100 * (Number(item.currentCondition) || 0)) / max) : null;
  return {
    gold: `${gold} gold pieces`,
    item: String(item?.name ?? '').trim(),
    tier: tier === 'common' ? 'Common' : r.label,
    colour: r.colour,
    condition: cond == null ? '' : `${cond}% condition`,
  };
}
