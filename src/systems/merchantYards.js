// @ts-check
// MERCHANT-YARDS (2026-10-10, asked: "I want to add 2 new merchants to each town without removing player's homes or
// breaking anything. 1. The stable where you can purchase horses 2. Transport merchant where you can purchase
// transports. These new places should get detailed locations, signs, sprites, etc that set them apart from other
// places"; and of the wagons: "Transport merchants hold all carts and wagons. The stable holds horses. No longer in
// general shop"): THE TWO YARDS' TRADE - THE LAW.
//
// Every city and town (Daggerfall's TownCity and TownHamlet - systems/travelOptions.js names them "city" and "town";
// not a village, a farm or a manor) stands two open-air yards the port adds: a STABLE, a fenced paddock with its horses
// and its stablemaster, and a WAGON YARD, a wagonwright's yard with a cart and its two wagons drawn up to be seen. They
// are not buildings: Daggerfall's towns are its own fixed blocks, every building in them already a home, a shop or a
// hall, and a yard takes none of them - no building key, no automap byte, no deed, no quest place. Where each stands
// is the town's own open ground (world/merchantYardSites.js); what it looks like is the port's own
// (world/merchantYardModels.js, world/merchantYardArt.js); the host stands both (scenes/merchantYardsHost.js).
//
// THE TRADE (here): the Stable sells the Horse and buys one back; the Wagon Yard sells the Small Cart, the Open Wagon
// and the Caravan (systems/wagonKinds.js) and buys any of them back - a loaded wagon refused at the counter as
// everywhere (systems/tradeModes.js sellGuardOf). Each opens the same trade window a shop's counter does, priced by the
// same law at YARD_QUALITY. A yard never sells out: each Buy is the yard's whole stock, minted fresh (a custom
// merchant's openBuy - systems/guildServices.js). The General Store no longer shelves or buys a horse, a cart or a
// wagon (systems/shopStock.js) - a departure from DFU, whose every General Store shelves the horse and the cart.
//
// WHO KEEPS THEM: a keeper of the town's own people (the race its walkers wear - characters/mobilePerson.js walkerRace,
// a Redguard region's Redguard), named from the region's
// name bank on a seed of the town's map id and the yard's kind - every client names the same keeper - and the yard is
// named for them ("Halbrecht's Stables").
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (MERCHANT-YARDS).
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { getNameBankOfRegion, GENDERS } from '../characters/nameHelper.js';
import { residentName } from './livingWorld/census.js';
import { setItemFields, mintCondition, TRANSPORT_HORSE } from './itemTemplates.js';
import { WAGON_KIND_ORDER, newWagonItem, isWagonItem } from './wagonKinds.js';

/** The two yards, in the order a town stands them. */
export const YARD_KIND_ORDER = Object.freeze(['stable', 'transport']);
/**
 * Each yard: `title` what follows the keeper's name, `sign` its board's word, `trade` its plaque's line, `keeper` what
 * its keeper is called, `seed` the yard's own salt on the town's map id (its keeper's name and face).
 */
export const YARD_KINDS = Object.freeze({
  stable: Object.freeze({ key: 'stable', title: 'Stables', sign: 'STABLES', trade: 'Horses bought and sold', keeper: 'Stablemaster', seed: 0x57ab1e }),
  transport: Object.freeze({ key: 'transport', title: 'Wagon Yard', sign: 'WAGONS', trade: 'Carts and wagons bought and sold', keeper: 'Wagonwright', seed: 0x3a90e5 }),
});
/** A kind the law knows, or null. */
export const validYardKind = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(YARD_KINDS, k) ? k : null);

/** The quality every yard's counter prices at (a shop's 1..20 - systems/shopStock.js calculateTradePrice): a middling
 *  shop's, the same in every town, so no yard is a cheaper one to buy at and a dearer one to sell to. */
export const YARD_QUALITY = 10;

/** The towns that stand the two yards: Daggerfall's cities and its towns (hamlets). */
export const YARD_TOWN_TYPES = Object.freeze([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet]);
/** Whether a location stands the yards (its MAPS.BSA type). */
export const isYardTown = (loc) => YARD_TOWN_TYPES.includes(loc?.mapTableData?.locationType);

/** What a yard sells - its whole stock, minted as a shelf mints a row (setItemFields, mintCondition): the Stable a
 *  Horse; the Wagon Yard the Small Cart, the Open Wagon and the Caravan, in WAGON_KIND_ORDER. A fresh list each call. */
export function yardStock(kind) {
  const mint = (it) => mintCondition(setItemFields(it));
  if (validYardKind(kind) === 'stable') return [mint({ group: 'Transportation', templateIndex: TRANSPORT_HORSE })];
  if (validYardKind(kind) === 'transport') return WAGON_KIND_ORDER.map((k) => mint(newWagonItem(k)));
  return [];
}
/** Whether a yard buys an item back: the Stable a horse, the Wagon Yard a cart or a wagon of any kind (DFU's Small Cart,
 *  marked or not). Nothing else - and neither buys the other's. */
export function yardBuysItem(kind, item) {
  if (!item) return false;
  if (validYardKind(kind) === 'stable') return item.templateIndex === TRANSPORT_HORSE;
  if (validYardKind(kind) === 'transport') return isWagonItem(item);
  return false;
}

/** A seed of the town and the kind. Pure. */
export const yardSeed = (mapId, kind) => (Math.imul((mapId >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ (YARD_KINDS[validYardKind(kind) ?? 'stable'].seed)) >>> 0;

/**
 * A yard's keeper: their name (FullName on the region's bank, on the yard's seed - DFU's stream put back as it stood),
 * their gender, and `variant` which of the race's four outfits they wear. Pure.
 * @param {number} mapId @param {string} kind @param {number} regionIndex
 */
export function yardKeeper(mapId, kind, regionIndex) {
  const seed = yardSeed(mapId, kind);
  const female = ((seed >>> 7) & 1) === 1;
  const gender = female ? GENDERS.Female : GENDERS.Male;
  const name = residentName(seed, getNameBankOfRegion(Number.isInteger(regionIndex) ? regionIndex : -1), gender);
  return { name, gender, sex: female ? 'female' : 'male', variant: (seed >>> 11) & 3 };
}

/** The yard's name, after its keeper: their surname where the bank gives one, else their name ("Halbrecht's Stables",
 *  "Jalib's Wagon Yard"). Pure. */
export function yardName(kind, keeperName) {
  const K = YARD_KINDS[validYardKind(kind) ?? 'stable'];
  const parts = String(keeperName ?? '').trim().split(/\s+/).filter(Boolean);
  const who = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
  return who ? `${who}'s ${K.title}` : `The ${K.title}`;
}

/** The yard's counter as the trade window reads a building's: its kind's own word for a type (never a DFU building
 *  type - no table of Daggerfall's is keyed by it), the yard's quality, the town's region, and what it buys. */
export function yardCounter(kind, regionIndex) {
  const k = validYardKind(kind) ?? 'stable';
  return { buildingType: `yard:${k}`, quality: YARD_QUALITY, regionIndex: regionIndex ?? 0, buildingKey: 0, yard: k, accepts: (/** @type {any} */ it) => yardBuysItem(k, it) };
}

/** What the yards say: Info on a keeper, Steal at a yard, a press on a horse or a wagon on show, a window that would not
 *  open, and the plaque rows. */
export const YARD_TEXT = Object.freeze({
  steal: 'The keeper never takes an eye off the stock.',
  ask: (keeper) => `Ask the ${keeper.toLowerCase()} to buy.`,
  shut: 'The yard\'s counter will not open here.',
});
export const YARD_ROWS = Object.freeze([
  Object.freeze({ id: 'buy', label: 'Buy' }),
  Object.freeze({ id: 'sell', label: 'Sell' }),
]);
