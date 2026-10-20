// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-VENDOR (2026-10-03, Mac: "add the ability for players that own houses to buy npcs that sell goods for them when
// someone visits the house ... make the available npcs visible on the board with a tab and item search filter"; asked,
// "Yes only in the house and you should be able to set a waypoint where the trader is ... Selfplaced npcs should sell
// stuff waaaaay longer").
//
// A VENDOR is a placed piece of a home's decor made the `vendor` station (net/decorLaw.js DECOR_STATIONS) - its licence
// is the station's fee, paid once on the owner's record, as every station's. Its STOCK is market listings of pieces from
// the owner's pack, for gold (MARKET-ANY's route, server-account/src/market.js listGood), carried AT THE VENDOR: such a
// listing stands on no regional board and is bought at its vendor alone, by a visitor standing in the house. It stands
// VENDOR_LISTING_S, not the market's 72 hours. The proceeds are the market's gold (market_gold), collected at any board.
//
// The Notice Board's Vendors tab lists the region's vendors and their stock, searched by the item, the owner or the
// town; a row sets a waypoint on the trader's house.
//
// Pure: no clock, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { DECOR_ID_RE } from './decorLaw.js';

/** The station a placed piece is made to be a vendor. */
export const VENDOR_STATION = 'vendor';
/** A vendor's listing stands this long (the market's own is 72 hours): thirty days. */
export const VENDOR_LISTING_S = 30 * 86_400;
/** The most stock rows a home's answer carries, and a region's directory. */
export const VENDOR_STOCK_SHOWN = 60;
/** MARKET-AUDIT: the pieces an account's traders stand at once - their own count, never the board's thirty (a stall stands
 *  on no board), at most what one home's answer carries. */
export const VENDOR_STOCK_MAX = VENDOR_STOCK_SHOWN;
export const VENDOR_BOARD_SHOWN = 300;
/** A search's longest words. */
export const VENDOR_QUERY_MAX = 60;
/** What a trader says where it cannot trade - offline, or the market not this account's: pressed (worldModes.js
 *  openHomeVendor), or made (scenes/decor/decorTool.js setStation - never sold where it cannot work, AUDIT 29 B2's law). */
export const VENDOR_COLD_LINE = 'The trader only deals with travelers online.';

/** A town's map id, unsigned, as the homes registry keys it (homeLaw.js homeMapIdOk's bound). */
const mapOk = (v) => Number.isSafeInteger(v) && v > 0 && v <= 0xffffffff;

/** A vendor named on the wire - `{ map, id }`: the home's town and the decor piece's id - or null. */
export function vendorOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { map, id } = raw;
  if (!mapOk(map) || typeof id !== 'string' || !DECOR_ID_RE.test(id)) return null;
  return { map, id };
}

/** Whether two vendors are the same one. */
export const sameVendor = (a, b) => !!a && !!b && a.map === b.map && a.id === b.id;

/** A search's words, folded: lower case, the spaces squeezed, bounded. */
export function vendorQuery(q) {
  return typeof q === 'string' ? q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, VENDOR_QUERY_MAX) : '';
}

/**
 * THE DIRECTORY SEARCHED: the rows whose item's name, owner or town hold every word of `q` (in any order). `nameOf`
 * names a row's item as the pack names it; `townOf` names its town. An empty search keeps every row.
 * @template {{ item?: any, owner?: string, map?: number }} R
 * @param {R[]} rows @param {string} q @param {{ nameOf?: (item: any) => string, townOf?: (map: number) => string }} [names]
 * @returns {R[]}
 */
export function vendorSearch(rows, q, { nameOf = () => '', townOf = () => '' } = {}) {
  const words = vendorQuery(q).split(' ').filter(Boolean);
  if (!words.length) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    let hay = '';
    try { hay = `${nameOf(r.item) ?? ''} ${r.owner ?? ''} ${Number.isSafeInteger(r.map) ? townOf(/** @type {number} */ (r.map)) ?? '' : ''}`.toLowerCase(); } catch { hay = ''; }
    return words.every((w) => hay.includes(w));
  });
}

/** The words a refusal of the vendor routes says (accountClient's accountRefusalText reads these). */
export const VENDOR_REFUSAL_WORDS = Object.freeze({
  'vendor-only': 'That item is sold by a trader in a house. Buy it there.',
  'vendor-not-here': 'That item is not this trader\'s.',
  'vendor-gone': 'That trader is no longer standing.',
  'vendor-not-yours': 'Only the house\'s owner stocks its trader.',
  'vendor-stocked': 'The trader still has goods for sale. Take them back first.',
  'home-vendor-stocked': 'A trader in this house still has goods for sale. Take them back first.',
  'bad-vendor': 'That is not a trader.',
  'vendor-full': `Your traders already hold ${VENDOR_STOCK_MAX} items. Take one back, or wait for one to sell.`,   // MARKET-AUDIT
});
