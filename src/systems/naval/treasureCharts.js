// @ts-check
// CAPT-CHARTS (2026-10-11, the owner: "giving a reason to players to experience it"; bible/03-World/Captains-Sea.md
// CAPT-CHARTS) - TREASURE CHARTS: a pirate's papers sometimes hold a chart to a cache sunk off the Bay's coast. Read (the
// item used), it is marked on the captain's own charts - a cache CHART_PX map pixels off one of the Bay's ports, in open
// water, the same cache for the same chart on every client - and the chart is spent; sailed to, the cache floats up
// beside the ship (the naval host's sites, as a contract's wreck's casks do) and hauled aboard it pays CACHE_GOLD and
// two of a strongbox's lots (navalPlunder.js STRONGBOX_KEY at STRONGBOX_RARITY_TIER).
//
// A chart is found among a pirate's papers when the captain ends her - sunk or taken: CHART_CHANCE of a pirate's, more
// in the deep waters, a flagship's oftener - by her seed on CHART_SALT's stream, so a ship holds one or does not.
// The item is the port's own (DECLARED - itemLaw.js imports this module): Daggerfall's parchment picture, its `message`
// the chart's seed.

import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { registerCustomTemplates, setItemFields, mintCondition } from '../item/itemTemplates.js';
import { siteFor, compassWords, leaguesWords } from './harbourBoard.js';

/** The chart's template index - after the exchange's goods (tradeGoods.js GOODS_TEMPLATE 1331..1341). */
export const CHART_TEMPLATE = 1342;
export const CHART_GROUP = 'UselessItems2';
/** The chart's template row (not bound: a chart changes hands). */
export const CHART_ROW = Object.freeze({
  index: CHART_TEMPLATE, name: 'Treasure Chart', baseWeight: 0.25, hitPoints: 1, capacityOrTarget: 0, basePrice: 150,
  enchantmentPoints: 0, rarity: 9, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 209, worldTextureRecord: 8, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false,
});
registerCustomTemplates([CHART_ROW]);
/** A chart's own stream's salt; the share of pirates that carry one - the coast's, the deep's, a flagship's. */
export const CHART_SALT = 0xc4a27;
export const CHART_CHANCE = Object.freeze({ pirate: 0.08, deep: 0.18, flagship: 0.6 });
/** A cache lies this many map pixels off its port. */
export const CHART_PX = Object.freeze({ near: 6, far: 14 });
/** A cache's gold: this, and this a level of the captain's. */
export const CACHE_GOLD = Object.freeze({ base: 250, level: 60 });
/** A cache's site's id: `chart:<seed>`. */
export const CHART_SITE = 'chart:';
/** AUDIT CAPTAIN'S SEA B6: a chart draws its port again on its own stream this many times while the port drawn has no
 *  open water for a cache (one chart in five was a dud for good - a port inland, or its water past the drawn reach). */
export const CHART_PORT_TRIES = 32;

/** A chart of `seed` (its `message`). */
export const mintChart = (seed) => mintCondition(setItemFields({ group: CHART_GROUP, templateIndex: CHART_TEMPLATE, material: 0, flags: 0, variant: 0, message: seed >>> 0, stackCount: 1 }));
export const isChart = (it) => it?.templateIndex === CHART_TEMPLATE;

/**
 * Whether a ship ended by the captain carries a chart among her papers: a pirate's, CHART_CHANCE's share - the deep
 * waters', a flagship's - off her seed. Answers the chart's seed, or null.
 * @param {{ faction?: string, flagship?: boolean }} cls @param {number} seed @param {{ deep?: boolean }} [o]
 */
export function chartAboard(cls, seed, { deep = false } = {}) {
  if (cls?.faction !== 'pirate') return null;
  const r = mulberry32(((seed >>> 0) ^ CHART_SALT) >>> 0);
  const p = cls.flagship ? CHART_CHANCE.flagship : deep ? CHART_CHANCE.deep : CHART_CHANCE.pirate;
  if (!(r() < p)) return null;
  return (r() * 0x100000000) >>> 0;
}

/**
 * A CHART READ: its cache's site - a port of the Bay off its seed, and open water CHART_PX off it - `{ id, seed, px, py,
 * near, words }`: the port drawn again on the chart's own stream while the one drawn has no open water about it
 * (CHART_PORT_TRIES - AUDIT CAPTAIN'S SEA B6), null only where none of them has (the chart's ink run). The same site on
 * every client.
 * @param {number} seed @param {{ key: string, name: string, px: number, py: number }[]} ports @param {(px: number, py: number) => boolean} seaAt
 */
export function chartSite(seed, ports, seaAt) {
  const list = (ports ?? []).filter(Boolean);
  if (!list.length) return null;
  const r = mulberry32(((seed >>> 0) ^ (CHART_SALT << 1)) >>> 0);
  for (let i = 0; i < CHART_PORT_TRIES; i++) {
    const port = list[Math.floor(r() * list.length) % list.length];
    const site = siteFor(port, r, seaAt, CHART_PX);
    if (!site) continue;
    const words = `${leaguesWords(site.d)} ${compassWords(site.px - port.px, site.py - port.py)} of ${port.name}`;
    return { id: `${CHART_SITE}${seed >>> 0}`, seed: seed >>> 0, px: site.px, py: site.py, near: port.name, words };
  }
  return null;
}

/** A cache's gold for a captain of `level`, off its seed (within a fifth either way). */
export function cacheGold(seed, level) {
  const r = mulberry32(((seed >>> 0) ^ 0xca5e) >>> 0);
  return Math.round((CACHE_GOLD.base + CACHE_GOLD.level * Math.max(1, level | 0)) * (0.8 + 0.4 * r()));
}
