// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE GUILD SHOP AS THE CLIENT LAST READ IT - how many of each hall
// piece the guild owns, and which of the account's wares it holds (server-account/src/guildShop.js guildShopOf). The decor
// tool and the fleet's paint panel read it; the service holds the truth. Fed by the guild book (its shop read), asked
// through the reader the book sets - module state, so no host grows a line for it (HOST-SPLIT).

/** @type {(() => unknown) | null} */
let _reader = null;
/** @type {Map<string, number> | null} */
let _owned = null;
/** @type {Set<string> | null} */
let _held = null;

/** The guild book's shop read, set once it is made. */
export function setGuildStockReader(/** @type {(() => unknown) | null} */ fn) { _reader = typeof fn === 'function' ? fn : null; }
/** The shop as a read said it (its `wares`), or null for none - the reader in no guild. `none` (a read that found no
 *  guild) stands as a shop of nothing, so nothing asks again until the guild's tab reads it. */
export function noteGuildShop(/** @type {any} */ shop, none = false) {
  const wares = Array.isArray(shop?.wares) ? shop.wares : none ? [] : null;
  _owned = wares ? new Map(wares.filter((/** @type {any} */ w) => w.payer === 'guild').map((/** @type {any} */ w) => [String(w.key), Number(w.owned) || 0])) : null;
  _held = wares ? new Set(wares.filter((/** @type {any} */ w) => w.payer === 'account' && w.held).map((/** @type {any} */ w) => String(w.key))) : null;
}
const ask = () => { try { _reader?.(); } catch { /* the next ask */ } };
/** How many of `ware` the guild owns - null while unread (and a read is asked). */
export function guildStockOwned(/** @type {unknown} */ ware) {
  if (!_owned) { ask(); return null; }
  return _owned.get(String(ware)) ?? 0;
}
/** GUILD-SHOP: how many more of guild piece `e` may stand in a room of `pieces` - the guild's stock less what stands there
 *  (a guild holds one hall), or Infinity while unread (the service holds the count). AUDIT GUILD-SHOP D5: out of the decor
 *  tool, a host held to its ceiling. */
export function guildPieceLeft(/** @type {any} */ e, /** @type {any[] | null | undefined} */ pieces) {
  const owned = guildStockOwned(e?.guild);
  if (owned == null) return Infinity;
  let n = 0;
  for (const q of pieces ?? []) if (q?.model === e.model) n++;
  return owned - n;
}
/** Whether the account holds `ware` (one of the account's: the Guild Sailcloth) - null while unread (and a read is asked). */
export function guildWareHeld(/** @type {unknown} */ ware) {
  if (!_held) { ask(); return null; }
  return _held.has(String(ware));
}
/** For the tests: nothing read, no reader. */
export function _resetGuildStock() { _reader = null; _owned = null; _held = null; }
