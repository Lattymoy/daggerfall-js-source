// @ts-check
// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot ... and have a sort of rarity glow
// attached to it"): THE SPOILS OF A FALLEN BOSS - what one player's kill pays, rolled from the relay's receipt. Design:
// bible/11-Multiplayer/World-Bosses.md section 7 ("The roll").
//
// PER PLAYER, AND THE SEED'S OWN. The receipt the relay signs for an account that earned the kill carries a loot seed
// (`c`, 32 bits of the relay's CSPRNG - net/gateReceipt.js), and everything here is rolled on `seededRng(c)`
// (systems/wind.js): every player's spoils are their own. The roll reads the player's world as well as the seed (the
// Unleveled Loot formula, the registered custom pieces), so what was rolled is what is kept - scenes/spoilsPool.js
// records the pieces themselves, never the seed alone.
//
// THE ROLL, with the game's own makers: gold (SPOILS_GOLD_PER_LEVEL a level, the seed varying it a fifth either way),
// three pieces minted by ItemBuilder's own random weapon, armour and jewellery (systems/loot.js - no arrows), each with
// SetItem's condition (mintCondition), laddered by Loot Rarity's own applyRarity (systems/lootRarity.js): ONE Rare or
// better (Legendary SPOILS_LEGENDARY of the time), TWO Magic or better by a boss's chances at the ladder's top tier - and
// every one KNOWN (`isIdentified`): the name the floor says is the name the pack shows. And the SIGIL STONE - the gate's
// trophy, one a kill. The spoils are graded whatever the Loot Rarity switch says: their glow is their tier.
//
// THE SIGIL STONE IS ITS OWN TEMPLATE (SIGIL_STONE_TEMPLATE, 570 - past DFU's 288, Climates & Calories' 530-541 and the
// Thunderlock's 560/561), a gem by its group - so the gem stores and the pawn shops buy it - and not a renamed gem: every
// classic gem is an ingredient, an ingredient STACKS, and a Ruby renamed would merge into the Ruby already in the pack
// and lose its name and its price. A custom row is no ingredient and does not stack (inventory.js isStackable). It wears
// the gems' own art, the Ruby's red, and no shelf stocks it: it is in no group's enum a shelf draws from. Registered here,
// and scenes/shared.js imports this file so every host has the row before a save carrying one loads.
//
// Not a DFU member. Ledger A (WB).
import { seededRng } from './wind.js';
import { createRandomWeapon, createRandomArmor, ITEM_GROUPS } from './loot.js';
import { setItemFields, isAmmunition, mintCondition, registerCustomTemplates, templateByIndex } from './itemTemplates.js';
import { applyRarity, rarityChances } from './lootRarity.js';

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it). */
export const SPOILS_GOLD_PER_LEVEL = 250;
/** The Rare-or-better piece is Legendary this share of the time. */
export const SPOILS_LEGENDARY = 0.1;
/** The source the two Magic-or-better pieces are laddered at: a boss, at the ladder's top tier, a player's even luck. */
export const SPOILS_SOURCE = Object.freeze({ boss: true, tier: 21, luck: 50 });
/** The gate's trophy: its template, its name and its price. */
export const SIGIL_STONE_TEMPLATE = 570;
export const SIGIL_STONE = Object.freeze({ name: 'Sigil Stone', value: 5000 });

/** The Sigil Stone's row, in DFU's ItemTemplates.txt columns: a gem's weight and wear, the gate's price, the rarest
 *  rarity, the Ruby's art (TEXTURE.254 record 0). */
export const SIGIL_STONE_TEMPLATES = Object.freeze([{
  index: SIGIL_STONE_TEMPLATE,
  name: SIGIL_STONE.name,
  baseWeight: 0.25,
  hitPoints: 1000,
  basePrice: SIGIL_STONE.value,
  rarity: 20,
  worldTextureArchive: 254,
  worldTextureRecord: 0,
}]);
registerCustomTemplates(SIGIL_STONE_TEMPLATES);
export const isSigilStone = (item) => item?.templateIndex === SIGIL_STONE_TEMPLATE;

const pick = (list, rolls) => list[Math.floor(rolls() * list.length)];

/** One piece to grade: a weapon (never ammunition), a piece of armour or a jewel, the seed choosing which and what, with
 *  SetItem's condition - and never one the port has no row for (a custom class whose template is not registered names
 *  nothing true and wears nothing: the next is made). */
export function spoilsBase(level, rolls) {
  let item = makeBase(level, rolls);
  for (let n = 0; n < 32 && !templateByIndex(item?.templateIndex); n++) item = makeBase(level, rolls);
  return mintCondition(item);
}
function makeBase(level, rolls) {
  const k = Math.floor(rolls() * 3);
  if (k === 0) {
    let w = createRandomWeapon(level, rolls);
    for (let n = 0; n < 32 && isAmmunition(w); n++) w = createRandomWeapon(level, rolls);   // "no arrows" - ItemBuilder's own rule for a made piece
    return w;
  }
  if (k === 1) return createRandomArmor(level, rolls);
  return setItemFields({ group: 'Jewellery', templateIndex: pick(ITEM_GROUPS.Jewellery, rolls) });
}

/** A Magic-or-better tier by the source's own chances, the Common share cut away. */
export function magicOrBetter(rolls, source = SPOILS_SOURCE) {
  const c = rarityChances(source);
  const r = rolls() * c.magic;
  return r < c.legendary ? 'legendary' : r < c.rare ? 'rare' : 'magic';
}

/** The gate's trophy, minted on its own row. */
export function sigilStone() {
  return mintCondition(setItemFields({ group: 'Gems', templateIndex: SIGIL_STONE_TEMPLATE }));
}

/**
 * THE SPOILS of one kill for one player: `{ gold, pieces: [{ item, tier }], sigil }` - the pieces in the order they
 * leave him (the Rare-or-better first). The same seed, level and world answer the same spoils.
 * @param {number} seed the receipt's `c` @param {number} level the player's
 */
export function rollSpoils(seed, level) {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const gold = Math.round(SPOILS_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls()));
  const pieces = [];
  const first = rolls() < SPOILS_LEGENDARY ? 'legendary' : 'rare';
  pieces.push(graded(spoilsBase(lv, rolls), first, rolls));
  for (let i = 0; i < 2; i++) pieces.push(graded(spoilsBase(lv, rolls), magicOrBetter(rolls), rolls));
  return { gold, pieces, sigil: sigilStone() };
}

/** A piece laddered to its tier and known - a Legendary with no record for its kind falls to Rare (applyRarity's own
 *  rule), so the tier is read back off the item. */
function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}
