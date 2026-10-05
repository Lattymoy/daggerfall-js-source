// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FOE-CAP (2026-10-03, Mac: "normal enemies that are non Elite or Enemies
// that have something infront of their real name (like thorned) should
// never drop more then 3 items in total max. Gold included. Bosses/
// worldbosses are not affected" ... "dropchances of those normal enemies
// should whites, rare = blue items, very rare = yellow, almost impossible
// = orange" ... "The exception for the rarity changes are elite dungeons.
// And max drop 5 items in Elite dungeons"; and, asked whether a champion
// counts: "champions are not normal").
//
// THE PORT'S OWN, not DFU's: DFU caps nothing and has no ladder.
//
// WHO IS PLAIN. A foe with no title of its own - never an elite foe
// (`eliteFoe`), a LOOT7 champion (`champion`), a revenant (`revenant`) or
// a feature's named foe (`properName`), and never a BOSS by the ladder's
// own law (lootRarity.js corpseSource: a Daedra, or level BOSS_LEVEL and
// up). An Elite DUNGEON's ordinary foe (`elite`, the place's doubling -
// not an elite foe) is plain too, at the larger cap and on the ladder it
// already had.
//
// ONE STAMP, TWO DOORS. spawnEnemyLoot (scenes/hostCombat.js) decides once
// and writes `entity.lootCap`; the cap is applied there, after the whole
// spawn chain, and again by raiseEnemyDeath (scenes/corpseMarker.js) after
// every OnEnemyDeath handler has added its own (food, a mod's find) - so
// "never more than three" holds for what the body actually carries.
//
// LOOT-EASE (2026-10-05, bible/06-Systems/Loot-Arc.md section 19): the
// ladder eased, the cap keeping a supply before a Common piece
// (CAP-SUPPLIES), and a plain foe's kit rolled at its death (KIT-ROLL) -
// the same stamp read a third time, by every body door.
// ═══════════════════════════════════════════════════════════════════

import {
  corpseSource, rarityRank, lootRarityOn, rarityEligible, rollRarity, applyRarity, lastPass, legendaryFindMult,
} from './lootRarity.js';
import { isGoldPieces } from './inventory.js';
import { POTION_TEMPLATE_INDEX } from './loot.js';   // CAP-SUPPLIES: a potion IS the glass bottle (DFU's IsPotion)
import { equipTableOf } from './equip.js';   // KIT-ROLL: what the foe wore
import { ENEMY_BASICS } from '../characters/enemyBasics.js';   // KIT-ROLL: the row every host hands its spawn

/** The most a plain foe's body carries, gold included. */
export const PLAIN_FOE_LOOT_CAP = 3;
/** ...and a plain foe's in an Elite Dungeon. */
export const ELITE_DUNGEON_FOE_LOOT_CAP = 5;

/** THE PLAIN FOE'S LADDER (per mille of reaching AT LEAST the tier, lootRarity.js RARITY_WEIGHTS' shape). White is the
 *  rule; Magic (blue) rare - 5% at level 0, 19% at most; Rare (yellow) very rare - 0.6% to 3.8%; Legendary (orange)
 *  almost impossible - 0.015% to 0.3%. Aetheric and Artifact are never rolled by a ladder at all.
 *  LOOT-EASE (2026-10-05): a quarter more blue, half again the yellow and the orange, than FOE-CAP's first numbers
 *  (4-15%, 0.4-2.5%, 0.01-0.2%) - the ladder Mac named kept in its order, the drought it made eased. */
export const PLAIN_FOE_RARITY_WEIGHTS = Object.freeze({
  magic:     Object.freeze({ base: 50,   perTier: 5,     cap: 190 }),
  rare:      Object.freeze({ base: 6,    perTier: 1.2,   cap: 38 }),
  legendary: Object.freeze({ base: 0.15, perTier: 0.075, cap: 3 }),
});

/** Has this foe a title of its own (and so no cap)? */
export const titledFoe = (entity) => !!(entity?.eliteFoe || entity?.champion || entity?.revenant || entity?.properName || entity?.worldBoss);

/**
 * THE RULE for one freshly built foe: its cap and whether its corpse rolls on the plain ladder - or null for a foe the
 * rule leaves alone (titled, or a boss). `elite` is the Elite Dungeon's mark, which the dungeon host writes before the
 * loot is rolled (dungeonContext.js applyEliteScaling).
 * @returns {{ cap: number, plainLadder: boolean } | null}
 */
export function plainFoeLootRule(entity, basics = null) {
  if (!entity || titledFoe(entity)) return null;
  if (corpseSource(basics, entity.level, entity.mobileType).boss) return null;
  const eliteDungeon = !!entity.elite;
  return { cap: eliteDungeon ? ELITE_DUNGEON_FOE_LOOT_CAP : PLAIN_FOE_LOOT_CAP, plainLadder: !eliteDungeon };
}

/** CAP-SUPPLIES (LOOT-EASE, 2026-10-05, Mac: the rest items, "majicka potions" and "health pots" "should be more common
 *  loot drops"): THE SUPPLIES - what a body's cap keeps before a Common piece of gear. A potion (DFU's IsPotion: the
 *  glass bottle - the trio's, the healing and the magicka supplies'), and whatever a module registers by name
 *  (restItems.js: REST6's seven). Ranked by worth alone, a Common steel blade outbid every potion and supply on a full
 *  body and the cap threw them away first - measured, two in five of a plain humanoid's supplies at the new rates. */
const _supplies = new Map();
export function registerLootSupply(name, fn) { if (typeof fn === 'function') _supplies.set(name, fn); else _supplies.delete(name); }
export function isLootSupply(item) {
  if (!item) return false;
  if (item.group === 'UselessItems1' && item.templateIndex === POTION_TEMPLATE_INDEX) return true;
  for (const fn of _supplies.values()) { try { if (fn(item)) return true; } catch { /* a predicate's throw is not the cap's */ } }
  return false;
}
/** The cap's order, best first: a Magic-or-better piece by its tier, then a supply, then the rest. */
const capRank = (it) => { const r = rarityRank(it); return r > 0 ? 1 + r : (isLootSupply(it) ? 1 : 0); };

/**
 * CAP A LIST IN PLACE: gold first (every coin stack folded into the first - one item, its count the sum), then a quest's
 * items (never thrown away, even past the cap), then the rest best first until the cap: a Magic-or-better piece by its
 * tier, then a supply (CAP-SUPPLIES), then the rest - the dearer first within each. Answers the items dropped.
 * @param {any[]} items
 * @param {number} cap
 */
export function capLootList(items, cap) {
  if (!Array.isArray(items) || !(cap >= 0) || items.length <= cap) return [];
  let gold = null;
  for (const it of items) {
    if (!isGoldPieces(it)) continue;
    if (!gold) gold = it;
    else gold.stackCount = (gold.stackCount | 0) + (it.stackCount | 0);
  }
  const quest = items.filter((it) => it?.questItem && it !== gold);
  const rest = items.filter((it) => it && it !== gold && !isGoldPieces(it) && !it.questItem)
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (capRank(b.it) - capRank(a.it)) || ((b.it.value ?? 0) - (a.it.value ?? 0)) || (a.i - b.i))
    .map((r) => r.it);
  const keep = [...(gold ? [gold] : []), ...quest];
  for (const it of rest) { if (keep.length >= cap) break; keep.push(it); }
  const kept = new Set(keep);
  const dropped = items.filter((it) => !kept.has(it));
  // in place, in the list's own order (the inventory window reads it as it stands)
  const order = items.filter((it) => kept.has(it));
  items.length = 0;
  items.push(...order);
  return dropped;
}

/** The body's own cap, as its spawn stamped it (`entity.lootCap`); nothing for a foe without one. */
export function capFoeLoot(entity) {
  const cap = entity?.lootCap;
  if (!Number.isInteger(cap) || !Array.isArray(entity.items) || titledFoe(entity)) return [];   // a foe promoted after its spawn (the street's elite) is titled by its death
  return capLootList(entity.items, cap);
}

/**
 * KIT-ROLL (LOOT-EASE, 2026-10-05, Mac: "Players are reporting only recieving steel items also"). LR4 rolls a foe's
 * ladder over what it CARRIES and never what it WEARS - a piece the ladder made would be fought with
 * (lootRarity.js rollCorpseLoot) - and a plain humanoid's droppable kit is 85-98% of the gear its body leaves: measured
 * through the spawn chain, that gear was Common 99 times in 100 at every level, the Iron and Steel blades and the
 * leather, chain and plate the kit is minted in, and nothing else. AT ITS DEATH NOBODY WEARS IT. A plain foe on the
 * plain ladder - its spawn stamped `lootCap`; never an Elite Dungeon's foe (its ladder is the whole one), never a titled
 * foe, never a boss (LR4's own case: a Daedra Lord's hand) - rolls each piece of its kit its body still carries on the
 * ladder its carried loot rolled at the spawn: the same source (the row every host hands spawnEnemyLoot, ENEMY_BASICS by
 * its mobile type), the player's luck, the finders, and the door's last pass. Once: a piece rolled here is `untaken`
 * (LOOT8's mark, so its take counts for the drought as any source door's piece does) and a second call passes it by.
 * Every body door calls it BEFORE anything reads the body's tiers - the chime (LR3), the sigil (SIGIL1), the cap.
 * Off, or no plain foe, nothing. Answers the pieces it laddered.
 */
export function rollCorpseKit(entity, { rolls = Math.random, luck = 50 } = {}) {
  if (!lootRarityOn() || !entity || !Array.isArray(entity.items) || !Number.isInteger(entity.lootCap) || entity.elite || titledFoe(entity)) return [];
  const worn = new Set(entity.equip ? equipTableOf(entity).filter(Boolean) : []);
  if (!worn.size) return [];
  const source = { ...corpseSource(ENEMY_BASICS[entity.mobileType] ?? null, entity.level, entity.mobileType), weights: PLAIN_FOE_RARITY_WEIGHTS };
  const find = legendaryFindMult();
  const minted = [];
  for (const it of entity.items) {
    if (!worn.has(it) || it.untaken === true || !rarityEligible(it)) continue;
    it.untaken = true;
    const tier = rollRarity({ ...source, luck, find }, rolls);
    if (tier !== 'common') { applyRarity(it, tier, rolls, null, { family: source.family ?? null }); minted.push(it); }
  }
  lastPass(minted, rolls);
  return minted;
}
