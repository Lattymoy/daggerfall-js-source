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
// Thunderlock's 560/561), a gem by its group (bound, so no counter buys it - SS4) - and not a renamed gem: every
// classic gem is an ingredient, an ingredient STACKS, and a Ruby renamed would merge into the Ruby already in the pack
// and lose its name and its price. A custom row is no ingredient. SS1 (2026-09-27, Mac: "make sigil stones bound items
// and stackable"): the row STACKS with its own kind alone - it says `stackable`, as the rations' row does
// (inventory.js isStackable), and a stack merges only with the same template, so a stone never joins a Ruby nor a Ruby
// a stone - and it is BOUND (`bound`, systems/itemBound.js): a stone is never handed to another player. A pack saved
// before it stacked is folded on load (restackStones). It wears the gems' own art, the Ruby's red, and no shelf stocks
// it: it is in no group's enum a shelf draws from. Registered here, and scenes/shared.js imports this file so every host
// has the row before a save carrying one loads.
//
// Not a DFU member. Ledger A (WB).
import { seededRng } from './wind.js';
import { createRandomWeapon, createRandomArmor, ITEM_GROUPS } from './loot.js';
import { setItemFields, isAmmunition, mintCondition, registerCustomTemplates, templateByIndex } from './itemTemplates.js';
import { applyRarity, rarityChances, lastPass } from './lootRarity.js';
import { rollRegalia } from './aetheric.js';   // SET6: Ruhn's Regalia - the spoils' last roll
import { stacksWith, addItem } from './inventory.js';   // SS1: the fold of a pack saved before the stone stacked; PORTAL-GIFT: the gift joins the pack's stack
import { wearableItem } from './equip.js';   // RARITY-WEAR: a spoils piece is one a slot takes
import { bossCardRoll } from './bossCards.js';   // CARDS9: the Warden's own card, the hoard's last draw

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it). */
export const SPOILS_GOLD_PER_LEVEL = 250;
/** The Rare-or-better piece is Legendary this share of the time. */
export const SPOILS_LEGENDARY = 0.1;
/** The source the two Magic-or-better pieces are laddered at: a boss, at the ladder's top tier, a player's even luck. */
export const SPOILS_SOURCE = Object.freeze({ boss: true, tier: 21, luck: 50 });
/** The gate's trophy: its template, its name and its price. WB12a (2026-10-01, Mac: "I'd like to rename the stones" -
 *  "Deadlands Ember"): a coal of the breach's fire, carried out when the Warden falls - only the NAME moved; the id, the
 *  binding and every key are the Sigil Stone's (bible World-Bosses.md section 19 A). */
export const SIGIL_STONE_TEMPLATE = 570;
export const SIGIL_STONE = Object.freeze({ name: 'Deadlands Ember', value: 5000 });

/** The Sigil Stone's row, in DFU's ItemTemplates.txt columns: a gem's weight and wear, the gate's price, the rarest
 *  rarity, the Ruby's art (TEXTURE.254 record 0) - and the port's two (SS1): it stacks, with its own kind alone, and it
 *  is bound. */
export const SIGIL_STONE_TEMPLATES = Object.freeze([{
  index: SIGIL_STONE_TEMPLATE,
  name: SIGIL_STONE.name,
  baseWeight: 0.25,
  hitPoints: 1000,
  basePrice: SIGIL_STONE.value,
  rarity: 20,
  worldTextureArchive: 254,
  worldTextureRecord: 0,
  stackable: true,
  bound: true,
}]);
registerCustomTemplates(SIGIL_STONE_TEMPLATES);
export const isSigilStone = (item) => item?.templateIndex === SIGIL_STONE_TEMPLATE;
/** LOOT9 (the Loot arc, bible/06-Systems/Loot-Arc.md section 11): THE WELKYND SHARD - a sliver of Ayleid
 *  magicka-crystal, what a laddered piece is salvaged into and the Reforge's only coin (systems/reforge.js). Its own row
 *  beside the Stone's, on the Stone's laws: it stacks with its own kind alone, and it is BOUND - never sold, traded,
 *  dropped or listed (systems/itemBound.js; net/realmTradeLaw.js BOUND_TEMPLATES names it). The Sapphire's art
 *  (TEXTURE.254 record 2): a Welkynd stone's blue. */
export const WELKYND_SHARD_TEMPLATE = 571;
export const WELKYND_SHARD = Object.freeze({ name: 'Welkynd Shard', value: 250 });
export const WELKYND_SHARD_TEMPLATES = Object.freeze([{
  index: WELKYND_SHARD_TEMPLATE,
  name: WELKYND_SHARD.name,
  baseWeight: 0.1,
  hitPoints: 1000,
  basePrice: WELKYND_SHARD.value,
  rarity: 20,
  worldTextureArchive: 254,
  worldTextureRecord: 2,
  bound: true,
  stackable: true,
}]);
registerCustomTemplates(WELKYND_SHARD_TEMPLATES);
export const isWelkyndShard = (item) => item?.templateIndex === WELKYND_SHARD_TEMPLATE;
/** `n` shards (at least one), one stack, minted on their own row. */
export function welkyndShards(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'Gems', templateIndex: WELKYND_SHARD_TEMPLATE })), { stackCount: Math.max(1, Math.trunc(Number(n) || 1)) });
}
/** PORTAL1 (systems/portalStone.js): THE PORTAL STONE - what the shards buy at every shop's counter, one portal a stone.
 *  Its own row beside the shard's, on the same laws: it stacks with its own kind alone, and it is BOUND (the shards that
 *  bought it are, so it never carries their worth to another player; net/realmTradeLaw.js BOUND_TEMPLATES names it). Its
 *  price is the shards' (PORTAL_STONE_SHARDS of them at the shard's value). The Diamond's art (TEXTURE.254 record 3) -
 *  but NOT a gem's group: every Gems piece is a crystal a slot takes (equipTable.js getEquipSlot), so a stone in it was
 *  worn from the hotbar and the pack. It is miscellany (UselessItems2), as the rest supplies are (restItems.js). */
export const PORTAL_STONE_TEMPLATE = 572;
/** What a stone costs at the counter, in Welkynd Shards (a Magic piece salvages into 1, a Rare 3, a Legendary 8). */
export const PORTAL_STONE_SHARDS = 5;
export const PORTAL_STONE = Object.freeze({ name: 'Portal Stone', value: PORTAL_STONE_SHARDS * WELKYND_SHARD.value });
export const PORTAL_STONE_TEMPLATES = Object.freeze([{
  index: PORTAL_STONE_TEMPLATE,
  name: PORTAL_STONE.name,
  baseWeight: 0.25,
  hitPoints: 1000,
  basePrice: PORTAL_STONE.value,
  rarity: 20,
  worldTextureArchive: 254,
  worldTextureRecord: 3,
  bound: true, stackable: true,   // the shard's two laws
}]);
registerCustomTemplates(PORTAL_STONE_TEMPLATES);
export const isPortalStone = (item) => item?.templateIndex === PORTAL_STONE_TEMPLATE;
/** PORTAL-GIFT (2026-10-04, the owner: "every current player should recieve x10 of these. They should stack"): EVERY
 *  CHARACTER THAT ALREADY EXISTS IS GIVEN PORTAL_GIFT_STONES STONES, ONCE - LOAN-AMNESTY's shape (banking.js
 *  forgiveLoans). A character's `portalGift` says which gift it has had: a save written before the gift carries no mark
 *  (0), and every save written after carries the mark (save.js snapshotPlayer), so a character made after the gift is
 *  born past it, and a character given it is never given it again. Given as the save is restored (save.js
 *  restorePlayer - every load, offline and online, the realm's boot among them), onto the pack's own unlocked stack of
 *  stones (addItem: they stack), and said once the world stands (takePortalGiftNotice, world.js). Client only, as the
 *  amnesty is: a bound piece the realm's service never weighs (realmGoldLaw.js counts gold alone). Answers how many
 *  stones it gave (0: none - the mark already stood). */
export const PORTAL_GIFT = 1;
export const PORTAL_GIFT_STONES = 10;
let _giftNotice = 0;
export function givePortalGift(entity) {
  if (!entity || typeof entity !== 'object') return 0;
  if ((Number.isSafeInteger(entity.portalGift) ? entity.portalGift : 0) >= PORTAL_GIFT) return 0;
  entity.portalGift = PORTAL_GIFT;
  if (!Array.isArray(entity.items)) entity.items = [];
  addItem(entity.items, portalStones(PORTAL_GIFT_STONES));
  _giftNotice += PORTAL_GIFT_STONES;
  return PORTAL_GIFT_STONES;
}
/** The stones given since the last ask (0: none), and the notice cleared - the host says it once. */
export const takePortalGiftNotice = () => { const n = _giftNotice; _giftNotice = 0; return n; };
/** `n` Portal Stones (at least one), one stack. */
export function portalStones(n = 1) {
  const count = Math.max(1, Math.trunc(Number(n) || 1));
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: PORTAL_STONE_TEMPLATE })), { stackCount: count });
}

/** SS1: STONES WON BEFORE THEY STACKED ARE ONE STACK. A pack saved before the row stacked holds a record a stone; each
 *  goes into the first record before it that it stacks with (a locked stone into a locked one - inventory.js
 *  stacksWith), so the load shows the stack the next kill would have made. Runs where no index into the list is still
 *  to be read (systems/save.js, below its index-keyed relinks). Answers how many records it folded. */
export function restackStones(list) {
  if (!Array.isArray(list)) return 0;
  let folded = 0;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (!isSigilStone(it)) continue;
    const into = list.findIndex((held, j) => j < i && isSigilStone(held) && stacksWith(held, it));
    if (into < 0) continue;
    list[into].stackCount = (list[into].stackCount ?? 1) + (it.stackCount ?? 1);
    list.splice(i, 1);
    i--;
    folded++;
  }
  return folded;
}

/** WB12a: THE EMBER'S NAME, GIVEN TO EVERY STONE. A stone's name is written into its record at the mint and kept by
 *  every save, so a stone won before the rename still said "Sigil Stone" - and a stack it heads keeps its name through
 *  every merge (inventory.js stacksWith never compares names). Every record of the template under another name takes
 *  the template's (systems/save.js, beside the rarity names' repair; the crash record's pieces, scenes/spoilsPool.js).
 *  Answers how many it renamed. */
export function nameEmbers(list) {
  if (!Array.isArray(list)) return 0;
  let renamed = 0;
  for (const it of list) if (isSigilStone(it) && it.name !== SIGIL_STONE.name) { it.name = SIGIL_STONE.name; renamed++; }
  return renamed;
}

const pick = (list, rolls) => list[Math.floor(rolls() * list.length)];

/** One piece to grade: a weapon (never ammunition), a piece of armour or a jewel, the seed choosing which and what, with
 *  SetItem's condition - and never one the port has no row for (a custom class whose template is not registered names
 *  nothing true and wears nothing: the next is made). RARITY-WEAR (FIELD BUGS 2026-10-01, Cruor: a King's Mark "spawn[ed]
 *  as wands, they cannot be equipped"): nor one no slot takes - the Wand is the eighth jewel, and a tier on it is read by
 *  nothing - so it is made again too; a seed that drew no wand draws what it drew before. */
export function spoilsBase(level, rolls) {
  let item = makeBase(level, rolls);
  for (let n = 0; n < 32 && (!templateByIndex(item?.templateIndex) || !wearableItem(item)); n++) item = makeBase(level, rolls);
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

/** A Magic-or-better tier by the source's own chances, the Common share cut away (RAID4b: a town's thanks name their own
 *  source - systems/raidSpoils.js).
 * @param {() => number} rolls @param {{ kind?: string, tier?: number, boss?: boolean, luck?: number }} [source] */
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
 * leave him (the Rare-or-better first; SET6: a Regalia piece, when one drops, last). The same seed, level and world
 * answer the same spoils.
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
  // SET6 (Sigil Sets, bible/11-Multiplayer/Sigil-Sets.md section 6): a piece of the Warden's own Regalia, Aetheric, a
  // sixth of the time - rolled LAST, so every spoils before it is what it was for its seed; it leaves him last
  const regalia = rollRegalia(rolls);
  if (regalia) pieces.push({ item: regalia, tier: regalia.rarity });
  // LOOT2 (bible/06-Systems/Loot-Arc.md section 4): the ladder's last pass - a Legendary among them Exalted one time in
  // ten - rolled after the Regalia, so every spoils before it is what it was for its seed
  lastPass(pieces.map((p) => p.item), rolls);
  // CARDS9 (bible/11-Multiplayer/Tavern-Cards.md section 28): THE WARDEN'S OWN CARD - one draw more, LAST of all (after
  // the last pass), so every spoils before it is what it was for its seed; kept beside the pieces, never among them
  const card = bossCardRoll('gate', rolls);
  return { gold, pieces, sigil: sigilStone(), card };
}

/** A piece laddered to its tier and known - a Legendary with no record for its kind falls to Rare (applyRarity's own
 *  rule), so the tier is read back off the item. */
function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}
