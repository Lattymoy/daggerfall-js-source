// @ts-check
// RENOWN-LOOT (2026-10-05, Mac: "Instead of a flat loot increase, lets also tie it to renoun level"; asked, Mac chose
// "Half → all → half again", "The roller's own" Renown, and offline "Keep this PR's numbers"): LOOT-EASE'S BUFF,
// GROWN WITH RENOWN. Design and record: bible/06-Systems/Loot-Arc.md section 20.
//
// LOOT-EASE (section 19) gave every plain foe and every deep pile the same buff over the loot the live game had: three
// pieces in four kept where PLAIN-LOOT kept two, the plain ladder a quarter bluer and half again yellower, healing
// potions commoner, Restore Power and the rest supplies dropping at all online. Online that buff is now SCALED BY THE
// ROLLER'S RENOWN, in the sigils' own five stages (systems/sigil.js renownSigilStage: Renown 1, 10, 20, 30 and 40):
//
//     stage      Renown   the buff      items kept   blue at level 0   healing (a foe)   Restore Power (a foe)
//     Faint        1-9    half             62.5%          4.5%               8%                 3%
//     Kindled     10-19   three quarters   68.75%         4.75%              9%                 4.5%
//     Bright      20-29   all              75%            5%                10%                 6%
//     Radiant     30-39   five quarters    81.25%         5.25%             11%                 7.5%
//     Ascendant   40-50   half again       87.5%          5.5%              12%                 9%
//
// Every LOOT-EASE knob moves by the same share of its own step (`lootEased`): the keep, each tier of the plain ladder
// (its base, its step a tier and its cap), the healing and Restore Power chances of a foe and a pile, and the rest
// supplies' (whose online step starts from none - they never dropped online before LOOT-EASE). What LOOT-EASE FIXED
// stays whole at every stage: a worn kit rolls the ladder at death (KIT-ROLL), the cap keeps supplies before plain gear
// (CAP-SUPPLIES), and the rest supplies drop online at all.
//
// WHOSE RENOWN: the roller's own - the page that rolls the loot (a dungeon's host for its foes, a street's cell owner
// for its foes, and for a treasure pile the page that builds the dungeon - each player's own), as a foe's level and a
// pile's already follow that page's character. Read through SIGIL1's door
// (systems/sigil.js sigilOnline / sigilRenown, set by scenes/world.js as the token's level is adopted), the one every
// Renown-woken power reads. OFFLINE there is no Renown, and the loot is LOOT-EASE's whole (the "Bright" row) - Renown is
// online's own progression. ONLINE BEFORE THE PAGE KNOWS ITS RENOWN (the moments before the first token), the first
// stage: no roll is ever richer than the Renown behind it.
//
// THE FOUR HOSTS read it with no wiring of their own: every knob is read inside the shared rolls (scenes/hostCombat.js
// spawnEnemyLoot, systems/foeLootCap.js rollCorpseKit, the healing and rest supplies' loot hooks), and the door is the
// page's. scenes/world.js sets it; its interiors (worldModes.js) and its dungeons (dungeonContext.js) roll on the same
// page; scenes/exterior.js is the offline town page and never goes online - LOOT-EASE's whole.
//
// Not a DFU member: Daggerfall has no Renown. Ledger A (RENOWN-LOOT).
import { sigilOnline, sigilRenown, renownSigilStage } from './sigil.js';

/** LOOT-EASE's buff at each Renown stage (renownSigilStage's 0..4), in quarters of it: half, three quarters, all, five
 *  quarters, half again. */
export const RENOWN_LOOT_QUARTERS = Object.freeze([2, 3, 4, 5, 6]);
/** Offline - no Renown - LOOT-EASE's buff whole. */
export const RENOWN_LOOT_OFFLINE_QUARTERS = 4;

/** The buff's share, in quarters, for a roll on this page: offline LOOT-EASE's whole; online the stage the roller's
 *  Renown opens - the first while the page does not know it yet. */
export function renownLootQuarters({ online = sigilOnline(), renown = sigilRenown() } = {}) {
  if (!online) return RENOWN_LOOT_OFFLINE_QUARTERS;
  return RENOWN_LOOT_QUARTERS[Math.max(0, renownSigilStage(renown))];
}

/** A knob at `quarters` of LOOT-EASE's step: `before` (the live game's, before LOOT-EASE) moved that share of the way
 *  to `after` (LOOT-EASE's own) - and on past it, above four quarters. Settled to nine places: every knob is a decimal of
 *  a few, and a quarter of 0.4 is not one in binary (1.3 would read 1.2999999999999998). */
export const lootEased = (/** @type {number} */ before, /** @type {number} */ after, /** @type {number} */ quarters) =>
  Math.round((before + ((after - before) * quarters) / 4) * 1e9) / 1e9;
