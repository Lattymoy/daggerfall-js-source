// @ts-check
// NAV-D (2026-09-28, Mac: "actual sailing ships to the world that players can encounter and pillage") - THE PRIZE:
// what a taken ship's hold gives up, and what her captor can make of her. The port's own; pure - the host draws the
// items through DFU's own loot tables (systems/loot.js generateItems, LootTables.GenerateRandomLoot).
//
// A HOLD IS LOTS. A ship carries one lot for each tier of its class's cargo (navalShips.js `cargo`, 1-4), each lot a
// draw of DFU's treasure tables under a key that fits her trade (HOLD_KEYS): a pirate's plunder is gold, jewels and
// arms ('S', 'E', 'Q'), a merchantman's cloth, spices and books ('Q', 'N', 'P', 'J'), a navy's its armoury ('T', 'F',
// 'J'). A flagship's last lot is the captain's strongbox - 'J', whatever her trade. The keys are drawn from the
// ship's seed, so the hold is the same whoever takes her.
//
// THE CAPTOR'S CHOICE is Black Flag's, in Daggerfall's words - one of:
//   Repair   - her timber and cordage to your own ship: REPAIR_SHARE of your hull and sails made good
//   Powder   - her powder and fire barrels: your barrels filled (navalShips.js BARREL.stock) and every battery loaded
//   Press    - her crew pressed to your guns: PRESS_SHARE of your crew's losses made good
// - and then her fate: SCUTTLE her (she sinks) or SET HER ADRIFT (she drifts, taken - no one takes her twice), or -
// SHIP-CLAIM - CLAIM her (she is the captor's own boat, on a deed worth PRIZE_DEED_SHARE of her hull's price).
//
// FLOTSAM. A ship sunk rather than taken gives up FLOTSAM_OF her lots as casks afloat (navalShots.js dropFlotsam),
// each a lot of her hold; a boat that sails through one hauls it into its own cargo.
//
// SALVAGE (2026-10-03, Mac: "allow sunken vessels to provide nessecary materials so you dont have to rely on the port") -
// beside her casks a sunk ship leaves her WRECKAGE afloat: a floater as a cask is, its lot SALVAGE_LOT. A boat that sails
// through it (or a swimmer who reaches it) hauls in what a carpenter and a gunner can use - her timber, pitch and canvas
// as CARPENTER'S STORES (navalStores.js), SALVAGE_SHARE of her hull's whole in their work (navalYard.js STORE_POINTS), at
// least one; and her dry powder as SALVAGE_BARRELS fire barrels, for a stern that rolls them. What the yard sold, the sea
// now gives back: a captain who sinks what she meets mends her ship and fills her barrels without making port.

import { mulberry32 } from '../../combat/bloodArt.js';
import { NOTORIETY } from './navalLaw.js';
import { HULL_PRICES } from '../comeSailAwayBoat.js';   // SHIP-CLAIM: a claimed prize's deed, at a share of her hull's price
import { hullBuild } from './navalShips.js';
import { STORE_POINTS } from './navalYard.js';

export const HOLD_KEYS = Object.freeze({
  pirate: Object.freeze(['S', 'E', 'Q']),
  merchant: Object.freeze(['Q', 'N', 'P', 'J']),
  navy: Object.freeze(['T', 'F', 'J']),
});
/** The flagship's strongbox. */
export const STRONGBOX_KEY = 'J';
/** AUDIT NAV1 (online #15): every key a lot can be drawn under, once - a cask says its lot on the wire by its row here. */
export const LOT_KEYS = Object.freeze([...new Set([...Object.values(HOLD_KEYS).flat(), STRONGBOX_KEY])]);
/** The captor's choices (AUDIT NAV1 B13: her papers the fourth). @type {readonly ('repair'|'powder'|'press'|'papers')[]} */
export const CHOICES = Object.freeze(['repair', 'powder', 'press', 'papers']);
/**
 * AUDIT NAV1 (B13) - Black Flag's "lower your wanted level", the prize's fourth choice: a lawful prize's papers burned
 * (no witness left to name the captor) or a pirate's crew handed to the crown's justice - this much notoriety off the
 * crown's waters she was taken in, the boarding's own weight (NOTORIETY.board). The only way down but the days' decay.
 */
export const PAPERS_NOTORIETY = NOTORIETY.board;
export const REPAIR_SHARE = 0.4;
export const PRESS_SHARE = 0.6;
/** The share of a sunk ship's lots that float free (at least one). */
export const FLOTSAM_OF = 0.5;
/**
 * SHIP-CLAIM (2026-10-01, Mac: "Claim captured prizes - Keep a ship you take by boarding as your own boat") - HER
 * PAPERS: a prize claimed is the captor's own boat on a Come Sail Away deed (scenes/navalHost.js claimPrize), and the
 * deed is worth PRIZE_DEED_SHARE of what her hull's deed costs on the shelf (comeSailAwayBoat.js HULL_PRICES) - a taken
 * ship is no bought one, and a full-price deed would make every pirate a fortune to sell.
 */
export const PRIZE_DEED_SHARE = 0.25;
/** A claimed prize's deed's value: PRIZE_DEED_SHARE of her hull's price, in whole gold. */
export const prizeDeedValue = (hull) => Math.round(HULL_PRICES[hull] * PRIZE_DEED_SHARE);
/**
 * The rarity tier a lot is rolled at (systems/lootRarity.js pileSource - the dungeon tiers' own scale, 3 a cemetery to
 * 18 a dragon's den): a merchantman's cargo a mine's (5), a pirate's plunder a human stronghold's (6), a navy's armoury
 * a giant's hold's (8), a flagship's strongbox a barbarian chief's (11).
 */
export const HOLD_RARITY_TIER = Object.freeze({ merchant: 5, pirate: 6, navy: 8 });
export const STRONGBOX_RARITY_TIER = 11;
/** A lot's rarity tier: its ship's trade's, or the strongbox's. */
export const holdTier = (shipClass, strongbox = false) => (strongbox ? STRONGBOX_RARITY_TIER : HOLD_RARITY_TIER[shipClass?.faction] ?? HOLD_RARITY_TIER.merchant);

/** The keys of a ship's hold, one a lot, from her seed. */
export function holdKeys(shipClass, seed) {
  const keys = HOLD_KEYS[shipClass.faction] ?? HOLD_KEYS.merchant;
  const rng = mulberry32((seed ^ 0x401d) >>> 0);
  const lots = Math.max(1, Math.min(4, shipClass.cargo | 0));
  const out = [];
  for (let i = 0; i < lots; i++) out.push(keys[Math.floor(rng() * keys.length) % keys.length]);
  if (shipClass.flagship) out[out.length - 1] = STRONGBOX_KEY;
  return out;
}

/** SALVAGE: the wreckage's lot - never one of LOT_KEYS (a hold's draw); the wire says it on a key of its own. */
export const SALVAGE_LOT = 'salvage';
/** SALVAGE: her stores' work as a share of her hull's whole, and the fire barrels her powder fills. */
export const SALVAGE_SHARE = 0.4;
export const SALVAGE_BARRELS = 2;
/** Whether a floater's lot is a wreck's salvage. */
export const isSalvage = (lot) => lot === SALVAGE_LOT;
/**
 * SALVAGE: what a sunk ship's wreckage gives up - `{ stores, barrels }`: her stores (SALVAGE_SHARE of her hull's points
 * in a store's work, at least one) and her powder (SALVAGE_BARRELS for a hull that carried guns). Nothing for no class.
 */
export function salvageOf(shipClass) {
  if (!shipClass) return { stores: 0, barrels: 0 };
  return {
    stores: Math.max(1, Math.round((shipClass.hullHp * SALVAGE_SHARE) / STORE_POINTS)),
    barrels: hullBuild(shipClass.hull).gun ? SALVAGE_BARRELS : 0,
  };
}

/** The lots that float free when she sinks: FLOTSAM_OF of them, at least one - the first of her keys. */
export function flotsamKeys(shipClass, seed) {
  const keys = holdKeys(shipClass, seed);
  return keys.slice(0, Math.max(1, Math.round(keys.length * FLOTSAM_OF)));
}

/**
 * The hold, drawn: every lot's items through `generate(key, tier)` (the host's DFU loot roll at the player's level,
 * its rarity at the lot's tier - `holdTier`), one list - what the loot window opens on.
 */
export function drawHold(shipClass, seed, generate) {
  const items = [];
  const keys = holdKeys(shipClass, seed);
  keys.forEach((key, i) => {
    const strongbox = !!shipClass.flagship && i === keys.length - 1;
    for (const it of generate(key, holdTier(shipClass, strongbox)) ?? []) items.push(it);
  });
  return items;
}

/**
 * What a choice does to the captor's ship: `{ repair?: { hull, sail }, barrels?: n, reload?: true, crew?: n,
 * notoriety?: -n }` - `notoriety` the captor's in her crown's waters now (the papers take up to PAPERS_NOTORIETY of it).
 * @param {'repair'|'powder'|'press'|'papers'} choice
 * @param {{ maxHull: number, hull: number, maxSail: number, sail: number, maxCrew: number, crew: number }} mine
 * @param {{ barrelStock?: number, notoriety?: number }} [armament]
 */
export function choiceEffect(choice, mine, { barrelStock = 0, notoriety = 0 } = {}) {
  if (choice === 'repair') return { repair: { hull: Math.round(mine.maxHull * REPAIR_SHARE), sail: Math.round(mine.maxSail * REPAIR_SHARE) } };
  if (choice === 'powder') return { barrels: barrelStock, reload: true };
  if (choice === 'press') return { crew: Math.ceil((mine.maxCrew - mine.crew) * PRESS_SHARE) };
  if (choice === 'papers') return { notoriety: -Math.min(Math.max(0, notoriety), PAPERS_NOTORIETY) };
  return {};
}

/** The choices' names, as the plunder window says them (the papers' by her trade - choiceOffer). */
export const CHOICE_TITLES = Object.freeze({ repair: 'Timber and cordage', powder: 'Powder and shot', press: 'Press her crew', papers: 'Burn her papers' });
/** AUDIT NAV1 (B13): a pirate prize's papers are her crew, given up to the crown. */
export const PIRATE_PAPERS_TITLE = 'Hand her to the crown';

/**
 * A choice as the window offers it: `{ id, title, detail, useful }` - what it would make good on the captor's ship
 * NOW (the effect bounded by what is missing), and whether it would make anything good at all (a sound ship's timber,
 * a whole crew's pressed men, a loaded battery's powder are offered and refused - the tile stands, greyed, with why).
 * @param {'repair'|'powder'|'press'|'papers'} choice
 * @param {{ maxHull: number, hull: number, maxSail: number, sail: number, maxCrew: number, crew: number }} mine
 * @param {{ barrelStock?: number, barrels?: number, barrelGuns?: boolean, loaded?: boolean, guns?: boolean }} [armament]
 *   `guns` false: a boat with none (AUDIT NAV1 - a rowboat's powder is for no gun)
 * @param {{ notoriety?: number, lawful?: boolean, crown?: string }} [law] - AUDIT NAV1 (B13): my notoriety in the waters
 *   of the crown she answers to, whether she is lawful, that crown's name
 */
export function choiceOffer(choice, mine, { barrelStock = 0, barrels = 0, barrelGuns = false, loaded = false, guns = true } = {}, { notoriety = 0, lawful = true, crown = '' } = {}) {
  const fx = choiceEffect(choice, mine, { barrelStock, notoriety });
  const title = choice === 'papers' && !lawful ? PIRATE_PAPERS_TITLE : CHOICE_TITLES[choice] ?? choice;
  if (choice === 'repair') {
    const hull = Math.max(0, Math.min(fx.repair.hull, Math.round(mine.maxHull - mine.hull)));
    const sail = Math.max(0, Math.min(fx.repair.sail, Math.round(mine.maxSail - mine.sail)));
    const useful = hull > 0 || sail > 0;
    return { id: choice, title, useful, detail: useful ? `Mend ${[hull > 0 ? `${hull} of hull` : null, sail > 0 ? `${sail} of canvas` : null].filter(Boolean).join(' and ')}` : 'Your ship is sound' };
  }
  if (choice === 'powder') {
    if (!guns) return { id: choice, title, useful: false, detail: 'No guns aboard' };   // AUDIT NAV1: a rowboat's, never "loaded"
    const topUp = barrelGuns && barrels < barrelStock;
    const useful = !loaded || topUp;
    return { id: choice, title, useful, detail: useful ? `Every gun loaded${barrelGuns ? ` - fire barrels to ${barrelStock}` : ''}` : 'Your guns are loaded' };
  }
  if (choice === 'press') {
    const n = Math.max(0, fx.crew | 0);
    return { id: choice, title, useful: n > 0, detail: mine.maxCrew <= 0 ? 'No berths for them' : n > 0 ? `${n} ${n === 1 ? 'hand' : 'hands'} to your guns` : 'Your crew is whole' };
  }
  if (choice === 'papers') {
    const n = -(fx.notoriety ?? 0);
    const waters = crown ? `${crown}'s waters` : 'these waters';
    return { id: choice, title, useful: n > 0, detail: n > 0 ? `Your notoriety in ${waters} falls by ${n}` : `No one hunts you in ${waters}` };
  }
  return { id: choice, title, useful: false, detail: '' };
}
