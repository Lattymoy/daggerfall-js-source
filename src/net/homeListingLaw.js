// @ts-check
// FOUNDATION F3 (2026-10-30, bible/03-World/Foundation-Arc.md) - PROPERTY AS DATA: which buildings are sold online, and
// at what, as rows of src/net/homeListings.json, read by both ends - the client's door (systems/online/onlineHomes.js
// homePurchasable, the door's price) and the account service's claim (server-account/src/homes.js claimHome). A row
// names a town by its unsigned map id and either one building (`key`, talkTopics.js makeBuildingKey) or one cell of its
// grid (`cell`, [blockX, blockY]): `sale: false` takes it off the market, `price` sets what it costs (in the law's range).
// The rows are checked against the world's atlas (world/atlas/atlas.js) at the fill and in the tests. Pure.
import LISTINGS from './homeListings.json' with { type: 'json' };
import { homeMapIdOk, homeBuildingKeyOk, homePriceOk, homeOnlinePrice, homeLayoutsMatch, HOME_KEY_MAX } from './homeLaw.js';

/** @typedef {{ map: number, key?: number, cell?: [number, number], sale?: boolean, price?: number, note?: string }} HomeListing */

/** A row's problems, as codes: none for a good row. @param {any} r */
export function homeListingProblems(r) {
  const out = [];
  if (!r || typeof r !== 'object') return ['not a row'];
  if (!homeMapIdOk(r.map)) out.push('map');
  const hasKey = r.key !== undefined, hasCell = r.cell !== undefined;
  if (hasKey === hasCell) out.push('key-or-cell');
  if (hasKey && !homeBuildingKeyOk(r.key)) out.push('key');
  if (hasCell && !(Array.isArray(r.cell) && r.cell.length === 2 && r.cell.every((v) => Number.isSafeInteger(v) && v >= 0 && v < 8))) out.push('cell');
  if (r.sale !== undefined && r.sale !== false) out.push('sale-false');
  if (r.price !== undefined && !homePriceOk(r.price)) out.push('price');
  if (r.sale === undefined && r.price === undefined) out.push('says nothing');
  return out;
}

/** The game's rows, each checked - a bad row is dropped and named once. @param {any} json @returns {readonly HomeListing[]} */
export function homeListingsOf(json) {
  const rows = Array.isArray(json?.listings) ? json.listings : [];
  return Object.freeze(rows.filter((r) => homeListingProblems(r).length === 0).map((r) => Object.freeze({ ...r })));
}
/** The game's listings. */
export const HOME_LISTINGS = homeListingsOf(LISTINGS);
let _rows = HOME_LISTINGS;
/** The rows both ends read now - the game's, or a test's (setHomeListings). */
export const homeListings = () => _rows;
/** For the pins: rows in place of the game's; none given, the game's again. @param {readonly HomeListing[]} [rows] */
export const setHomeListings = (rows = HOME_LISTINGS) => { _rows = rows; };

/** A building key's cell, `[blockX, blockY]` (talkTopics.js makeBuildingKey) - AUDIT FOUNDATION P1: block 0,0's record 0
 *  is spelt 1 << 24 (BUILDING_KEY_0), its cell 0,0. @param {number} k */
export const homeKeyCell = (k) => (k === HOME_KEY_MAX ? [0, 0] : [k >> 16, (k >> 8) & 0xff]);

/** The row for a building of a town - its own row first, else its cell's - or null. A key row names a building of
 *  Daggerfall's own layout (WD3) and is read only there (AUDIT FOUNDATION II P6): in a town a pack lays out anew
 *  (`layout`, homeLaw.js homeLayoutsMatch) the key is another building, and the town is curated by cell.
 *  @param {unknown} mapId @param {unknown} key @param {readonly HomeListing[]} [rows] @param {unknown} [layout] */
export function homeListingOf(mapId, key, rows = _rows, layout = null) {
  if (!rows.length || !homeBuildingKeyOk(key)) return null;
  const map = Number(mapId) >>> 0, k = /** @type {number} */ (key), [bx, by] = homeKeyCell(k);
  return (homeLayoutsMatch(layout, null) ? rows.find((r) => r.map === map && r.key === k) : null) ?? rows.find((r) => r.map === map && r.cell && r.cell[0] === bx && r.cell[1] === by) ?? null;
}
/** Whether a building is off the market by its row. @param {unknown} mapId @param {unknown} key
 *  @param {readonly HomeListing[]} [rows] @param {unknown} [layout] */
export const homeListedOff = (mapId, key, rows = _rows, layout = null) => homeListingOf(mapId, key, rows, layout)?.sale === false;
/** AUDIT FOUNDATION P2: the price a home's ground is held to (homeLaw.js homeGroundOk) - where a row sets the home's
 *  price, the law's for that ground while the price paid covers it (AUDIT FOUNDATION II P5: never more room than the
 *  gold bought), else the price paid. @param {unknown} mapId @param {unknown} key @param {number} price
 *  @param {unknown} ground @param {unknown} townBlocks @param {unknown} [layout] */
export const homeGroundPrice = (mapId, key, price, ground, townBlocks, layout = null) => {
  if (homeListingOf(mapId, key, _rows, layout)?.price == null) return price;
  const law = homeOnlinePrice(/** @type {number} */ (ground), /** @type {number} */ (townBlocks));
  return law <= price ? law : price;
};
/** What a building costs online: its row's price where it sets one, else `lawPrice`. @param {unknown} mapId
 *  @param {unknown} key @param {number} lawPrice @param {readonly HomeListing[]} [rows] @param {unknown} [layout] */
export const homeListedPrice = (mapId, key, lawPrice, rows = _rows, layout = null) => homeListingOf(mapId, key, rows, layout)?.price ?? lawPrice;

/**
 * THE ROWS CHECKED AGAINST THE WORLD (world/atlas/atlas.js): each row's town a place with an exterior, and its cell (a
 * key's own) inside the town's grid. Answers the rows that name nothing, with why; `bundleOf` undefined is a town not
 * known here, passed over. @param {readonly HomeListing[]} rows
 * @param {(map: number) => (undefined|null|{ exterior: { w: number, h: number } | null })} bundleOf
 */
export function homeListingsUnplaced(rows, bundleOf) {
  const out = [];
  for (const r of rows) {
    const b = bundleOf(r.map), [bx, by] = r.cell ?? homeKeyCell(/** @type {number} */ (r.key));
    if (b === undefined) continue;   // a town not stood here: no word on it (the tests check every row against the whole world)
    if (!b?.exterior) out.push({ row: r, why: 'no such town' });
    else if (bx >= b.exterior.w || by >= b.exterior.h) out.push({ row: r, why: 'no such cell' });
  }
  return out;
}
