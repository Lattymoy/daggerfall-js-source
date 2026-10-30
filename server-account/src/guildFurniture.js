// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): A GUILD'S FURNITURE IN ITS HALL. A piece the guild bought in the guild
// shop (src/net/guild/guildShopLaw.js, its `model`) stands only in a guild's own hall, costs no gold where it is set down
// (its silver was paid), holds nothing and serves as no station - and only while the guild owns more of it than its halls
// already stand. The count is asked inside the placement's own statement, so two keepers setting down the last one at
// once stand it once. Pieces a sold hall stood are counted no more: the guild sets them down again in its next.
import { guildWareOfModel } from '../../src/net/guild/guildShopLaw.js';

/** Why a piece of the guild's furniture may not be placed so - a refusal word, or null (also null for any other piece). */
export function guildPieceRule(/** @type {any} */ p, /** @type {{ hall: boolean, yard: boolean }} */ where) {
  if (!guildWareOfModel(p?.model)) return null;
  if (!where.hall || where.yard) return 'guild-ware-hall';
  if (p.paid !== 0 || p.storage || p.station) return 'bad-decor';
  return null;
}

/** The placement's guard for a guild piece: `[sql, binds]` read in its INSERT's WHERE - the hall's guild owns more of the
 *  ware than its halls stand - or `['', []]` for any other piece. */
export function guildStockGuard(/** @type {any} */ p, /** @type {number} */ mapId, /** @type {string} */ buildingKey) {
  const w = guildWareOfModel(p?.model);
  if (!w) return ['', []];
  return [` AND COALESCE((SELECT f.owned FROM guild_furniture f JOIN homes h ON h.guild_id = f.guild_id WHERE h.map_id = ? AND h.building_key = ? AND f.ware = ?), 0)
    > (SELECT COUNT(*) FROM home_decor d JOIN homes h2 ON h2.map_id = d.map_id AND h2.building_key = d.building_key
       WHERE h2.guild_id = (SELECT guild_id FROM homes WHERE map_id = ? AND building_key = ?) AND d.model = ?)`, [mapId, buildingKey, w.key, mapId, buildingKey, w.model]];
}

/** How many more of a guild piece's ware its hall's guild may stand - owned less what its halls stand; Infinity for any
 *  other piece. */
export async function guildStockLeft(/** @type {any} */ db, /** @type {any} */ p, /** @type {number} */ mapId, /** @type {string} */ buildingKey) {
  const w = guildWareOfModel(p?.model);
  if (!w) return Infinity;
  const r = await db.prepare(`SELECT COALESCE((SELECT f.owned FROM guild_furniture f JOIN homes h ON h.guild_id = f.guild_id WHERE h.map_id = ?1 AND h.building_key = ?2 AND f.ware = ?3), 0)
    - (SELECT COUNT(*) FROM home_decor d JOIN homes h2 ON h2.map_id = d.map_id AND h2.building_key = d.building_key
       WHERE h2.guild_id = (SELECT guild_id FROM homes WHERE map_id = ?1 AND building_key = ?2) AND d.model = ?4) AS n`).bind(mapId, buildingKey, w.key, w.model).first();
  return Number(r?.n ?? 0);
}
/** Whether a guild piece's placement found no stock left. */
export const guildStockSpent = async (/** @type {any} */ db, /** @type {any} */ p, /** @type {number} */ mapId, /** @type {string} */ buildingKey) => (await guildStockLeft(db, p, mapId, buildingKey)) < 1;
