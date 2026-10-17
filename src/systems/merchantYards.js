// @ts-check
// MERCHANT-YARDS (2026-10-10, asked: "I want to add 2 new merchants to each town without removing player's homes or
// breaking anything. 1. The stable where you can purchase horses 2. Transport merchant where you can purchase
// transports. These new places should get detailed locations, signs, sprites, etc that set them apart from other
// places"; and of the wagons: "Transport merchants hold all carts and wagons. The stable holds horses. No longer in
// general shop"): THE TWO YARDS' TRADE - THE LAW.
//
// Every city and town (Daggerfall's TownCity and TownHamlet - systems/travel/travelOptions.js names them "city" and "town";
// not a village, a farm or a manor) stands two open-air yards the port adds: a STABLE, a fenced paddock with its horses
// and its stablemaster, and a WAGON YARD, a wagonwright's yard with a cart and its two wagons drawn up to be seen. They
// are not buildings: Daggerfall's towns are its own fixed blocks, every building in them already a home, a shop or a
// hall, and a yard takes none of them - no building record, no deed, no quest place. Where each stands is the town's
// own open ground (world/merchantYards/merchantYardSites.js); what it looks like is the port's own (world/merchantYards/merchantYardModels.js,
// world/merchantYards/merchantYardArt.js); the host stands both (scenes/merchantYardsHost.js). YARDS-FOUND: it is found as a shop is -
// a row of the town's talk directory under a key no Daggerfall building can hold (`yardDirectoryRows`), its ground and
// its name on the town map (world/merchantYards/merchantYardMap.js), a mark on the Overworld (the host's `overworldMarks`).
//
// THE TRADE (here): the Stable sells the Horse and buys one back; the Wagon Yard sells the Small Cart, the Open Wagon
// and the Caravan (systems/wagon/wagonKinds.js) and buys any of them back - a loaded wagon refused at the counter as
// everywhere (systems/tradeModes.js sellGuardOf). Each opens the same trade window a shop's counter does, priced by the
// same law at YARD_QUALITY. A yard never sells out: each Buy is the yard's whole stock, minted fresh (a custom
// merchant's openBuy - systems/guild/guildServices.js). The General Store no longer shelves or buys a horse, a cart or a
// wagon (systems/shopStock.js) - a departure from DFU, whose every General Store shelves the horse and the cart.
//
// WHO KEEPS THEM: a keeper of the town's own people (the race its walkers wear - characters/mobile/mobilePerson.js walkerRace,
// a Redguard region's Redguard), named from the region's
// name bank on a seed of the town's map id and the yard's kind - every client names the same keeper - and the yard is
// named for them ("Halbrecht's Stables").
//
// CARP-YARD (2026-10-12, Mac: "Let's also redesign their buildings like we did with stables, etc", choosing a new
// Carpenter's Yard, its workbench a Carpentry station): A THIRD YARD, THE JOINERY - a carpenter's open-air workshop, its
// workbench Carpentry's station at the furnisher's own fee (WORKBENCH_FEE), its carpenter its keeper. It trades nothing
// over a counter (yardStock answers it none, yardBuysItem nothing): its row is the bench. It is placed AFTER the port's
// places (CRAFT_YARD_ORDER - scenes/world.js townPlacesFor), and keyed after them (YARD_KEY_SLOT), so no town's Stable,
// Wagon Yard, shipyard or lighthouse moves and no key a save's discovery holds names another place.
//
// Pure: no DOM, no renderer, no clock. Not a DFU member. Ledger A (MERCHANT-YARDS, CARP-YARD).
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { getNameBankOfRegion, GENDERS } from '../characters/nameHelper.js';
import { residentName } from './livingWorld/census.js';
import { setItemFields, mintCondition, TRANSPORT_HORSE } from './item/itemTemplates.js';
import { WAGON_KIND_ORDER, newWagonItem, isWagonItem } from './wagon/wagonKinds.js';
import { birthHorses } from './horse/horseCoats.js';   // STEED1: the stable's horses born at the yard
import { horseBornStats, steedValue } from './steedCare.js';   // STEED1: and priced by what they are
import { UPKEEP_ITEM, newUpkeepItem, upkeepItemsAvailable } from './upkeep/upkeepItemRows.js';   // STEED1/WAGONS4: the oats, the kits
import { WORKBENCH_FEE } from '../net/professionLaw.js';   // CARP-YARD: the joinery's bench asks the furnisher's fee

/** The two yards, in the order a town stands them. */
export const YARD_KIND_ORDER = Object.freeze(['stable', 'transport']);
/** CARP-YARD: the professions' yards - placed after the two and after a port town's places, in this order. */
export const CRAFT_YARD_ORDER = Object.freeze(['carpenter']);
/** Every yard kind, in the order a town stands them. */
export const ALL_YARD_KINDS = Object.freeze([...YARD_KIND_ORDER, ...CRAFT_YARD_ORDER]);
/**
 * Each yard: `title` what follows the keeper's name, `sign` its board's word, `trade` its plaque's line, `keeper` what
 * its keeper is called, `seed` the yard's own salt on the town's map id (its keeper's name and face).
 */
export const YARD_KINDS = Object.freeze({
  stable: Object.freeze({ key: 'stable', title: 'Stables', sign: 'STABLES', trade: 'Horses bought and sold', keeper: 'Stablemaster', seed: 0x57ab1e }),
  transport: Object.freeze({ key: 'transport', title: 'Wagon Yard', sign: 'WAGONS', trade: 'Carts and wagons bought and sold', keeper: 'Wagonwright', seed: 0x3a90e5 }),
  carpenter: Object.freeze({ key: 'carpenter', title: 'Joinery', sign: 'JOINERY', trade: `Carpentry at the workbench - ${WORKBENCH_FEE} gold a craft or a saw`, keeper: 'Carpenter', seed: 0xca4be7 }),   // CARP-YARD
});
/** A kind the law knows, or null. */
export const validYardKind = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(YARD_KINDS, k) ? k : null);

/** The quality every yard's counter prices at (a shop's 1..20 - systems/shopStock.js calculateTradePrice): a middling
 *  shop's, the same in every town, so no yard is a cheaper one to buy at and a dearer one to sell to. */
export const YARD_QUALITY = 10;
/** AUDIT MERCHANT-YARDS Y2: the price index every yard's counter prices at, both ways - DFU's neutral 1000
 *  (shopStock.js calculateCost's), never the region's walk. A yard never sells out and its goods weigh nothing, so a
 *  Caravan bought where the index stood low and sold back where it stood high paid without end (11,250 a Caravan for
 *  the best haggler between 450 and 2100) - the loop ENDLESS-STOCK shut at the shelf. At one index the online cap (half
 *  the least ask) holds every sale at or under its buy; a regional holiday's halved buy breaks even, no more. */
export const YARD_PRICE_INDEX = 1000;

/** The towns that stand the two yards: Daggerfall's cities and its towns (hamlets). */
export const YARD_TOWN_TYPES = Object.freeze([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet]);
/** Whether a location stands the yards (its MAPS.BSA type). */
export const isYardTown = (loc) => YARD_TOWN_TYPES.includes(loc?.mapTableData?.locationType);

/** STEED1: the horses a Stable stands on a day - each its own horse (systems/steedCare.js: its seed its stats). */
export const STABLE_HORSES_OFFERED = 3;
/** STEED1 / WAGONS4: the stack a yard sells its upkeep in - the Stable's oats, the Wagon Yard's kits. */
export const YARD_OATS_STACK = 20;
export const YARD_KITS_STACK = 5;
/** A 32-bit mix of three integers (a stable's town, its day, its stall). */
const mix3 = (a, b, c) => {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c >>> 0) + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
};
/** mulberry32: a stream of [0, 1) off a 32-bit seed. */
const stream = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/**
 * STEED1 (the owner: "Every horse should have different stats"): THE STABLE'S HORSES ON A DAY - STABLE_HORSES_OFFERED
 * of them, each born at the yard (horseCoats.js birthHorses on a stream of the town's map id, the world's day and its
 * stall - every client in the town that day sees the same three), so a buyer sees each one's look and stats before they
 * pay. A horse the buyer already owns (its seed in `owned`) is not stood again. `priced`: its price by its born stats
 * (steedCare.js steedValue - horse care on), else the template's.
 * @param {number} mapId @param {number} day @param {{ owned?: Set<number>|number[], priced?: boolean }} [o]
 */
export function stableHorses(mapId, day, { owned = [], priced = false } = {}) {
  const have = new Set(owned);
  const out = [];
  for (let i = 0; i < STABLE_HORSES_OFFERED; i++) {
    const h = mintCondition(setItemFields({ group: 'Transportation', templateIndex: TRANSPORT_HORSE }));
    birthHorses([h], stream(mix3(mapId | 0, day | 0, i)));
    if (have.has(h.horseSeed)) continue;
    if (priced) h.value = steedValue(horseBornStats(h));
    out.push(h);
  }
  return out;
}
/** What a yard sells - its whole stock, minted as a shelf mints a row (setItemFields, mintCondition): the Stable a
 *  Horse (STEED1: three of them, on the town's day - stableHorses) and a sack of oats; the Wagon Yard the Small Cart, the
 *  Open Wagon and the Caravan, in WAGON_KIND_ORDER, and a Wagon Repair Kit. The oats and the kits only where they may be
 *  sold (online while UPKEEP_ITEMS_ONLINE is on - systems/upkeep/upkeepItemRows.js). A fresh list each call.
 *  @param {string} kind @param {{ mapId?: number, day?: number, online?: boolean, owned?: Set<number>|number[], priced?: boolean }} [o] */
export function yardStock(kind, { mapId = 0, day = 0, online = false, owned = [], priced = false } = {}) {
  const mint = (it) => mintCondition(setItemFields(it));
  const upkeep = upkeepItemsAvailable(online);
  if (validYardKind(kind) === 'stable') return [...stableHorses(mapId, day, { owned, priced }), ...(upkeep ? [mint(newUpkeepItem(UPKEEP_ITEM.Oats, YARD_OATS_STACK))] : [])];
  if (validYardKind(kind) === 'transport') return [...WAGON_KIND_ORDER.map((k) => mint(newWagonItem(k))), ...(upkeep ? [mint(newUpkeepItem(UPKEEP_ITEM.WagonKit, YARD_KITS_STACK))] : [])];
  return [];   // CARP-YARD: the joinery keeps no counter - its trade is the bench
}
/** Whether a yard buys an item back: the Stable a horse, the Wagon Yard a cart or a wagon of any kind (DFU's Small Cart,
 *  marked or not). Nothing else - and neither buys the other's. */
export function yardBuysItem(kind, item) {
  if (!item) return false;
  if (validYardKind(kind) === 'stable') return item.templateIndex === TRANSPORT_HORSE;
  if (validYardKind(kind) === 'transport') return isWagonItem(item);
  return false;
}

/** SHIPYARDS (2026-10-11): a seed of the town and a salt - a yard's kind's own, or another of the town's places'
 *  (systems/portPlaces.js portKeeper: the shipmaster's, the crewmaster's, the lightkeeper's). Pure. */
export const townSeed = (mapId, salt) => (Math.imul((mapId >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ (salt >>> 0)) >>> 0;
/** A seed of the town and the kind. Pure. */
export const yardSeed = (mapId, kind) => townSeed(mapId, YARD_KINDS[validYardKind(kind) ?? 'stable'].seed);

/**
 * SHIPYARDS: A KEEPER OF THE TOWN'S, off a seed of theirs (townSeed's) - their name (FullName on the region's bank,
 * DFU's stream put back as it stood), their gender, and `variant` which of the race's four outfits they wear. The one
 * home of a keeper's draw: a yard's (`yardKeeper`) and a port's (systems/portPlaces.js portKeeper). Pure.
 * @param {number} seed @param {number} regionIndex
 */
export function townKeeper(seed, regionIndex) {
  const female = ((seed >>> 7) & 1) === 1;
  const gender = female ? GENDERS.Female : GENDERS.Male;
  const name = residentName(seed, getNameBankOfRegion(Number.isInteger(regionIndex) ? regionIndex : -1), gender);
  return { name, gender, sex: female ? 'female' : 'male', variant: (seed >>> 11) & 3 };
}
/**
 * A yard's keeper, on the yard's seed (townKeeper's draw). Pure.
 * @param {number} mapId @param {string} kind @param {number} regionIndex
 */
export const yardKeeper = (mapId, kind, regionIndex) => townKeeper(yardSeed(mapId, kind), regionIndex);

/** SHIPYARDS: a place named after its keeper - their surname where the bank gives one, else their name - and its
 *  title ("Halbrecht's Stables"); with no name, "The <title>". The one home of the yards' and the shipyard's names. Pure. */
export function namedAfter(keeperName, title) {
  const parts = String(keeperName ?? '').trim().split(/\s+/).filter(Boolean);
  const who = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
  return who ? `${who}'s ${title}` : `The ${title}`;
}
/** The yard's name, after its keeper ("Halbrecht's Stables", "Jalib's Wagon Yard"). Pure. */
export const yardName = (kind, keeperName) => namedAfter(keeperName, YARD_KINDS[validYardKind(kind) ?? 'stable'].title);

/** The yard's counter as the trade window reads a building's: its kind's own word for a type (never a DFU building
 *  type - no table of Daggerfall's is keyed by it), the yard's quality, the town's region, and what it buys. AUDIT
 *  MERCHANT-YARDS: its price index (Y2, YARD_PRICE_INDEX), its name over the window (Y5 - the window's heading read
 *  " - Buy" and the classic popups' %cpn nothing; the kind's own title where none is given), and its word on a steal
 *  (Y1 - the window's own Steal, not only the street's: a yard never sells out, and a Caravan stolen from its Buy and
 *  sold back was gold without end). */
export function yardCounter(kind, regionIndex, name = '') {
  const k = validYardKind(kind) ?? 'stable';
  return {
    buildingType: `yard:${k}`, quality: YARD_QUALITY, regionIndex: regionIndex ?? 0, buildingKey: 0, yard: k,
    name: (typeof name === 'string' && name.trim()) || `The ${YARD_KINDS[k].title}`, priceIndex: YARD_PRICE_INDEX, noSteal: YARD_TEXT.steal,
    accepts: (/** @type {any} */ it) => yardBuysItem(k, it),
  };
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
/** WAGONS4: the Wagon Yard's third row - its wright mends the wagon driven (systems/wagon/wagonUpkeep.js mendPrice). */
export const YARD_MEND_ROW = Object.freeze({ id: 'mend', label: 'Mend' });
/** CARP-YARD: THE JOINERY'S WORKBENCH AS A STATION - what the street's workbench question answers at one (scenes/world.js
 *  workbenchHere): a shop's, at the furnisher's own fee (WORKBENCH_FEE - no bench is a cheaper one), its carpenter the
 *  one paid, and `yard` (the Stores page keeps the furnisher's counter - his Linen - a Furniture Store's alone). */
export const YARD_BENCH = Object.freeze({ kind: 'shop', fee: WORKBENCH_FEE, who: 'carpenter', yard: true });
/** CARP-YARD: the joinery's one row - its workbench, Carpentry's station (the Stores page, at the bench). */
export const YARD_BENCH_ROW = Object.freeze({ id: 'bench', label: 'Workbench' });
/** A yard's keeper's rows: the Stable's two, the Wagon Yard's three, the joinery's bench. */
export const yardRowsFor = (kind) => (validYardKind(kind) === 'carpenter' ? [YARD_BENCH_ROW]
  : validYardKind(kind) === 'transport' ? [...YARD_ROWS, YARD_MEND_ROW] : [...YARD_ROWS]);
/** CARP-YARD: what the joinery's carpenter says on Steal (the bench where the Stores page is not says ui/professions/profPages.js
 *  WORKBENCH_COLD_LINE, a home's workbench's own word). */
export const CARPENTER_STEAL_TEXT = 'The carpenter never takes an eye off the tools.';

/**
 * YARDS-FOUND (2026-10-10, from play: "The new stable and transport merchant shops dont show on town maps/overworld",
 * "Ensure these locations appear when talking to NPCs"): A YARD IN THE TOWN'S TALK DIRECTORY. The directory is the one
 * list the Where-is page, the compass's "%di of here" (systems/talk/talk.js buildingCompassDirection), the knowledge roll and
 * the map's mark ("Let me just mark %loc here on your map" - systems/discovery.js discoverBuilding) all read a building
 * from, so a yard joins it as a shop's row does and every one of them answers it unchanged.
 *
 * Its key is one no building of Daggerfall's can hold: a building's is (layoutX << 16) + (layoutY << 8) + record, under
 * 1 << 19 in the largest city, and the key 0 is BUILDING_KEY_0, 1 << 24 (systems/talk/talkTopics.js makeBuildingKey) - a
 * yard's is YARD_KEY_BASE (1 << 25) and its kind's place in YARD_KIND_ORDER. Its type is its counter's (`yard:<kind>`,
 * never a DFU building type - no table of Daggerfall's is keyed by it, and no DFU group, regional row or quest place
 * takes it).
 */
export const YARD_KEY_BASE = 1 << 25;
/** Each yard's place past YARD_KEY_BASE - the Stable's and the Wagon Yard's their order's; CARP-YARD: the joinery's
 *  after the port's four places (systems/portPlaces.js FOUND_KIND_ORDER, whose index each one's is - a leaf here, it
 *  cannot read that order; test/systems/carpyard1.test.js holds the two to one), so the shipyard's, the crew hall's, the
 *  lighthouse's and the docks' keys stay theirs. */
export const YARD_KEY_SLOT = Object.freeze({ stable: 0, transport: 1, carpenter: 6 });
/** A yard's key in its town's directory. */
export const yardBuildingKey = (kind) => YARD_KEY_BASE + YARD_KEY_SLOT[validYardKind(kind) ?? 'stable'];
/** YARDS-FOUND: the Where-is page's group for each yard, as DFU's are worded ("General stores", "Taverns"). */
export const YARD_TALK_GROUPS = Object.freeze({ stable: 'Stables', transport: 'Wagon yards', carpenter: 'Carpenters' });
/**
 * YARDS-FOUND: a town's yards as rows of its talk directory - the shape systems/talk/talkTopics.js buildBuildingDirectory
 * mints (`name`, `buildingType`, `factionId`, `quality`, `position` in the location's frame, `buildingKey`), and `yard`
 * its kind. `sites` the host's (world/merchantYards/merchantYardSites.js yardSite's, the keeper beside each - scenes/world.js
 * merchantYardSitesFor); none, or none a kind the law knows, is no row. Pure; a fresh list.
 * @param {Array<any>|null|undefined} sites
 */
export function yardDirectoryRows(sites) {
  const out = [];
  for (const s of sites ?? []) {
    const kind = validYardKind(s?.kind);
    if (!kind || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
    out.push({
      name: yardName(kind, s.keeper?.name), buildingType: `yard:${kind}`, factionId: 0, quality: YARD_QUALITY,
      position: [s.x, 0, s.z], buildingKey: yardBuildingKey(kind), yard: kind,
    });
  }
  return out;
}
