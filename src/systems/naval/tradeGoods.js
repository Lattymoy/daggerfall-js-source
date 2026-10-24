// @ts-check
// CAPT-TRADE (2026-10-11, the owner: "giving a reason to players to experience it" - and, of the Eltheric Ocean, "exotic
// resources"; bible/03-World/Captains-Sea.md CAPT-TRADE) - THE EXCHANGE: goods bought cheap where they are made and sold
// dear where they are wanted, carried in a ship's hold (Come Sail Away's cargo, its weight on her way). The port's own -
// Daggerfall's shops buy a captain's cargo at its value and no more.
//
// THE GOODS: the Bay's eight - each crown MAKES some (`CROWN_TRADE` - MADE_K of a good's base) and WANTS others (WANT_K);
// every port twists its crown's trade by one good of its own (`portTrade`, off its key); and the Eltheric Ocean's three,
// made on its isles alone (the Eltheric Ocean's freeports - ETHER-PORTS) and wanted in every port of the Bay. ISLE-TRADE
// (2026-10-17, the owner: "make it so each island does sell at least one normal exchange product so you could feasibly
// live and trade out in the veil"): and every isle's freeport makes one good of the Bay besides (`isleGood`, off its key),
// sold there as any port sells what it makes - so an isle's exchange is a market of the Veil's own, and a captain can
// carry one isle's good to the next isle that wants it without crossing back to the Bay. A day's price
// drifts PRICE_DRIFT about it, the same for every client on the world's day; the exchange sells at SPREAD over it and buys at
// SPREAD under it, and a port sells and buys only so much of a good a day (`DAY_STOCK`): it never runs dry of what it makes,
// and is glutted soon with what it makes itself.
//
// Each good is an item of the port's own (DECLARED - itemLaw.js imports this module, as navalStores.js), a custom
// template from GOODS_TEMPLATE on, stackable, its weight and its base price the row's: a cask of wine in a pack or a
// hold is a cask of wine, sold at any shop at its base like any item.
//
// CREW-TRADE (2026-10-23, the owner: "add crew as a resource that can be sold and traded"; asked, the owner chose the
// exchange alone, a headcount, at a price that varies by port - bible/03-World/Captains-Sea.md CREW-TRADE): and CREW, a
// row of the exchange that is no item. A port has sailors to spare, is short of them, or neither (`crewStandOf`, off its
// key; an isle of the Veil always short), and prices a man as any good by that stand and the day's drift (`priceOf`);
// the exchange signs men on to the ship at the quay and takes them off her (systems/naval/crewTrade.js - her side of it).
// Never an item, so never in a pack, a hold, a shop or a trade between players: a man is on her deck or he is not.

import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { registerCustomTemplates, setItemFields, mintCondition } from '../item/itemTemplates.js';
import { hashKey } from './harbourBoard.js';

/** The goods' first template index - after the carpenter's stores (navalStores.js STORES_TEMPLATE 1330). */
export const GOODS_TEMPLATE = 1331;
export const GOODS_GROUP = 'UselessItems2';
/** @typedef {{ id: string, name: string, unit: string, units: string, base: number, kg: number, icon: readonly number[], ether?: boolean }} Good */
/** CREW-TRADE: what the exchange deals in - a good, or crew (`CREW`, no item and no icon).
 *  @typedef {{ id: string, name: string, unit: string, units: string, base: number, kg: number, ether?: boolean, crew?: boolean }} Dealt */
/** The goods, in the exchange's order: `{ id, name, unit, base (gold), kg, icon: [archive, record], ether? }`.
 *  @type {readonly Good[]} */
export const GOODS = Object.freeze([
  Object.freeze({ id: 'wine', name: 'Wine', unit: 'cask', units: 'casks', base: 30, kg: 10, icon: Object.freeze([205, 11]) }),
  Object.freeze({ id: 'grain', name: 'Grain', unit: 'sack', units: 'sacks', base: 12, kg: 10, icon: Object.freeze([205, 17]) }),
  Object.freeze({ id: 'wool', name: 'Wool', unit: 'bale', units: 'bales', base: 18, kg: 10, icon: Object.freeze([205, 24]) }),
  Object.freeze({ id: 'iron', name: 'Iron', unit: 'pig', units: 'pigs', base: 24, kg: 12, icon: Object.freeze([254, 63]) }),
  Object.freeze({ id: 'spice', name: 'Spices', unit: 'sack', units: 'sacks', base: 60, kg: 4, icon: Object.freeze([205, 18]) }),
  Object.freeze({ id: 'silk', name: 'Silk', unit: 'bolt', units: 'bolts', base: 75, kg: 4, icon: Object.freeze([205, 21]) }),
  Object.freeze({ id: 'silver', name: 'Silver', unit: 'bar', units: 'bars', base: 90, kg: 6, icon: Object.freeze([254, 65]) }),
  Object.freeze({ id: 'ivory', name: 'Ivory', unit: 'tusk', units: 'tusks', base: 110, kg: 8, icon: Object.freeze([254, 70]) }),
  // ETHER-PORTS: the Eltheric Ocean's, made on its isles alone
  Object.freeze({ id: 'etheramber', name: 'Ether-amber', unit: 'lump', units: 'lumps', base: 240, kg: 2, icon: Object.freeze([254, 8]), ether: true }),
  Object.freeze({ id: 'starglass', name: 'Starglass', unit: 'shard', units: 'shards', base: 320, kg: 1, icon: Object.freeze([254, 4]), ether: true }),
  Object.freeze({ id: 'voidsilk', name: 'Voidsilk', unit: 'bolt', units: 'bolts', base: 280, kg: 2, icon: Object.freeze([254, 6]), ether: true }),
]);
export const goodById = (id) => GOODS.find((g) => g.id === id) ?? null;
/** A good's template index (GOODS' order from GOODS_TEMPLATE). */
export const goodTemplate = (id) => { const i = GOODS.findIndex((g) => g.id === id); return i < 0 ? null : GOODS_TEMPLATE + i; };
/** The good a template index is, or null. */
export const goodOfTemplate = (t) => (Number.isInteger(t) && t >= GOODS_TEMPLATE && t < GOODS_TEMPLATE + GOODS.length ? GOODS[t - GOODS_TEMPLATE] : null);

/** The goods' template rows (none bound: a cask of wine changes hands). */
export const GOODS_ROWS = Object.freeze(GOODS.map((g, i) => Object.freeze({
  index: GOODS_TEMPLATE + i, name: g.name, baseWeight: g.kg, hitPoints: 1, capacityOrTarget: 0, basePrice: g.base,
  enchantmentPoints: 0, rarity: g.ether ? 8 : 2, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: g.icon[0], worldTextureRecord: g.icon[1], playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: true,
})));
registerCustomTemplates(GOODS_ROWS);

/** `n` of a good as one stack. */
export const mintGood = (id, n) => mintCondition(setItemFields({ group: GOODS_GROUP, templateIndex: goodTemplate(id), material: 0, flags: 0, variant: 0, message: 0, stackCount: Math.max(1, n | 0) }));
/** How many of a good a list of items holds. */
export const goodIn = (items, id) => { const t = goodTemplate(id); return (items ?? []).reduce((n, it) => n + (it?.templateIndex === t ? Math.max(1, it.stackCount | 0) : 0), 0); };
/** `n` of a good taken from a list of items (the stacks' counts down, a spent stack gone). Answers how many were taken. */
export function takeGood(items, id, n) {
  const t = goodTemplate(id);
  let left = Math.max(0, n | 0);
  for (let i = (items ?? []).length - 1; i >= 0 && left > 0; i--) {
    const it = items[i];
    if (it?.templateIndex !== t) continue;
    const have = Math.max(1, it.stackCount | 0);
    if (have > left) { it.stackCount = have - left; left = 0; } else { items.splice(i, 1); left -= have; }
  }
  return Math.max(0, n | 0) - left;
}
/** The weight of the goods in a list of items (kg). */
export const goodsWeight = (items) => (items ?? []).reduce((kg, it) => { const g = goodOfTemplate(it?.templateIndex); return kg + (g ? g.kg * Math.max(1, it.stackCount | 0) : 0); }, 0);

/** CREW-TRADE: a man at the exchange - half what the shipwright asks to find one (navalDamage.js REPAIR_PRICE.crew,
 *  pinned equal: this module is in the item law's graph, which the account service reads, and the sea's is not). */
export const CREW_BASE = 15;
/** CREW-TRADE: crew, the exchange's row that is no item - a headcount on the deck of the ship at the quay. */
export const CREW = Object.freeze({ id: 'crew', name: 'Crew', unit: 'man', units: 'men', base: CREW_BASE, kg: 0, crew: true });
/** CREW-TRADE: how a port stands to sailors - 'makes' (men to spare), 'wants' (short of them) or 'neither', a third of
 *  the Bay's ports each, off its key on its own scrambled draw (isleGood's: a plain hash bunches neighbours); every isle
 *  of the Veil short of them. The same on every client, as the key is. @param {{ key: string, ether?: boolean }} port */
export function crewStandOf(port) {
  if (port?.ether) return 'wants';
  const r = mulberry32(hashKey(`${port?.key ?? ''}:crew`) >>> 0);
  return /** @type {const} */ (['makes', 'wants', 'neither'])[Math.floor(r() * 3) % 3];
}

/** A good made where it is made at this share of its base, wanted where it is wanted at this; a day's drift about it. */
export const MADE_K = 0.6;
export const WANT_K = 1.55;
export const PRICE_DRIFT = 0.12;
/** The exchange sells over the price by this share and buys under it by this. */
export const SPREAD = 0.08;
/** CAPTAIN-TREE: the most of SPREAD a captain's dealing closes (exchangeOf `edge`) - never the whole, so no good is bought
 *  and sold again at the one exchange for nothing. */
export const TRADE_MOST = 0.75;
/** The Eltheric Ocean's goods in a port of the Bay, and the Bay's in an Eltheric isle's exchange: wanted at this. */
export const EXOTIC_K = 1.4;
/** What each crown's ports make and want. */
export const CROWN_TRADE = Object.freeze({
  Daggerfall: Object.freeze({ makes: Object.freeze(['grain', 'iron', 'wool']), wants: Object.freeze(['wine', 'spice', 'silk']) }),
  Wayrest: Object.freeze({ makes: Object.freeze(['wine', 'silver']), wants: Object.freeze(['iron', 'ivory', 'grain']) }),
  Sentinel: Object.freeze({ makes: Object.freeze(['spice', 'silk', 'ivory']), wants: Object.freeze(['wool', 'iron', 'silver']) }),
});
/** A day's dealing a port does in one good: it sells up to `sell` and buys up to `buy` - by whether it makes it, wants
 *  it, or neither. */
export const DAY_STOCK = Object.freeze({ makes: Object.freeze({ sell: 30, buy: 4 }), wants: Object.freeze({ sell: 2, buy: 30 }), neither: Object.freeze({ sell: 10, buy: 12 }) });
const BAY = GOODS.filter((g) => !g.ether).map((g) => g.id);
const ETHER = GOODS.filter((g) => g.ether).map((g) => g.id);

/**
 * ISLE-TRADE (2026-10-17): the good of the Bay an Eltheric isle's freeport makes - one of the eight, drawn off its key
 * (`etherPortOf`'s `"px,py"`, scenes/world.js) on its own scrambled draw: a plain `hash % 8` gave neighbouring isles the
 * same few goods (Veilhaven and its five nearest: silver, iron, iron, wine, silver, iron), the draw an even spread (the
 * 234 ports within 400 px of Veilhaven, 19 to 34 of each good). The same on every client, as the key is.
 * @param {{ key: string }} port
 */
export function isleGood(port) {
  const r = mulberry32(hashKey(`${port?.key ?? ''}:isle`) >>> 0);
  return BAY[Math.floor(r() * BAY.length) % BAY.length];
}

/**
 * A PORT'S TRADE: what it makes and wants - its crown's, twisted by one good of its own off its key (made there, or
 * wanted there, whichever its crown does neither of); an Eltheric isle's (`ether`) makes the Eltheric goods and, ISLE-TRADE,
 * its own good of the Bay (`isleGood`), and wants every other good of the Bay.
 * @param {{ key: string, crown?: string|null, ether?: boolean }} port
 */
export function portTrade(port) {
  if (port?.ether) { const own = isleGood(port); return { makes: [...ETHER, own], wants: BAY.filter((g) => g !== own) }; }
  const base = CROWN_TRADE[port?.crown] ?? { makes: [], wants: [] };
  const makes = [...base.makes], wants = [...base.wants];
  const free = BAY.filter((g) => !makes.includes(g) && !wants.includes(g));
  const h = hashKey(`${port?.key ?? ''}:trade`);
  if (free.length) (h & 1 ? makes : wants).push(free[(h >>> 1) % free.length]);
  return { makes, wants };
}
/** How a port stands to a good: 'makes', 'wants' or 'neither' - the Eltheric goods wanted in every port of the Bay;
 *  CREW-TRADE: crew as `crewStandOf`. */
export function standOf(port, id) {
  if (id === CREW.id) return crewStandOf(port);
  const g = goodById(id);
  if (!g) return 'neither';
  const t = portTrade(port);
  if (t.makes.includes(id)) return 'makes';
  if (t.wants.includes(id) || (g.ether && !port?.ether)) return 'wants';
  return 'neither';
}

/**
 * A GOOD'S PRICE AT A PORT ON A DAY: its base, times MADE_K where made, WANT_K where wanted (EXOTIC_K for the other sea's
 * goods), times the day's drift (within PRICE_DRIFT, off the port, the good and the day - every client's the same) - and the
 * exchange's two: `sell` (what the captain pays) SPREAD over it, `buy` (what the captain is paid) SPREAD under it.
 * CREW-TRADE: crew priced so too, a man of either sea's own.
 * @param {{ key: string, crown?: string|null, ether?: boolean }} port @param {string} id @param {number} day
 */
export function priceOf(port, id, day) {
  /** @type {Dealt | null} */
  const g = id === CREW.id ? CREW : goodById(id);
  if (!g) return null;
  const stand = standOf(port, id);
  const exotic = !g.crew && !!g.ether !== !!port?.ether;
  const mood = stand === 'makes' ? MADE_K : stand === 'wants' ? (exotic ? EXOTIC_K : WANT_K) : 1;
  const r = mulberry32((hashKey(`${port?.key ?? ''}:${id}`) ^ Math.imul((day | 0) + 1, 0x85ebca6b)) >>> 0);
  const mid = g.base * mood * (1 - PRICE_DRIFT + 2 * PRICE_DRIFT * r());
  return { id, stand, mid, sell: Math.max(1, Math.round(mid * (1 + SPREAD))), buy: Math.max(1, Math.round(mid * (1 - SPREAD))) };
}

/**
 * THE EXCHANGE'S BOARD at a port on a day: each good it deals in - every good of its sea, and the other sea's it wants or,
 * ISLE-TRADE, makes (an isle's own good of the Bay: sold there, at its made price and stock, never 'not sold here') -
 * its price, its stand, and how many more it sells (`sells`) and buys (`buys`) today - `dealt` the captain's dealing
 * here today: `{ bought: { id: n } }` from the exchange, `{ sold: { id: n } }` to it. CAPTAIN-TREE: `edge` the share of the
 * SPREAD the captain's dealing closes (systems/naval/captainTree.js `trade`, to TRADE_MOST): each price nearer the
 * good's middle, the exchange still buying under what it sells. SEA-TRADE (bible/06-Systems/Town-Economy-Arc.md section
 * 8): `town` the port town's economy, online (net/townEconLaw.js townExchangeFactors - `ask` on what it sells, `pay` on
 * what it pays, the pay never above the ask), or null (offline, an isle of the Veil: no town economy) - the prices as
 * they were. CREW-TRADE: `crew` - and crew's row first, priced, spread and stocked as a good's (crewTrade.js crewRowOf
 * reads it there).
 * @param {{ key: string, crown?: string|null, ether?: boolean }} port @param {number} day @param {{ sold?: any, bought?: any }} [dealt] @param {number} [edge]
 * @param {{ ask: number, pay: number } | null} [town] @param {boolean} [crew]
 */
export function exchangeOf(port, day, dealt = {}, edge = 0, town = null, crew = false) {
  const k = SPREAD * (1 - Math.max(0, Math.min(TRADE_MOST, Number(edge) || 0)));
  const ask = town && Number.isFinite(town.ask) && town.ask > 0 ? town.ask : 1;
  const pay = town && Number.isFinite(town.pay) && town.pay > 0 ? Math.min(ask, town.pay) : 1;
  const rows = [];
  /** @type {readonly Dealt[]} */
  const dealing = crew ? [CREW, ...GOODS] : GOODS;
  for (const g of dealing) {
    const stand = standOf(port, g.id);
    const other = !g.crew && !!g.ether !== !!port?.ether;
    if (other && stand === 'neither') continue;   // the other sea's goods: only where they are wanted - or made (ISLE-TRADE)
    const p = priceOf(port, g.id, day);
    const stock = DAY_STOCK[stand];
    const exotic = other && stand !== 'makes';   // ISLE-TRADE: an isle's own good of the Bay is its own, sold as made
    // AUDIT 2: never buying at what it sells - a cheap good's two prices, the spread closed by the captain's stars, rounded
    // to one number (made grain at the tree's most: 7 and 7), and the round trip was free and paid the log's `traded`
    const sell = Math.max(2, Math.round(p.mid * (1 + k) * ask));   // SEA-TRADE: the port town's asking factor
    rows.push({
      id: g.id, name: g.name, unit: g.unit, units: g.units, kg: g.kg, stand, sell, buy: Math.max(1, Math.min(sell - 1, Math.round(p.mid * (1 - k) * pay))), exotic,   // SEA-TRADE: and its paying factor   // AUDIT CAPTAIN'S SEA B16: the other sea's - never sold here
      sells: exotic ? 0 : Math.max(0, stock.sell - (dealt.bought?.[g.id] | 0)), buys: Math.max(0, stock.buy - (dealt.sold?.[g.id] | 0)),
    });
  }
  return rows;
}
