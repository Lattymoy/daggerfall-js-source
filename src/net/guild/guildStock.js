// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE GUILD'S FURNITURE STOCK AS THE CLIENT LAST READ IT - how many of each
// hall piece the guild owns (server-account/src/guildShop.js guildShopOf). The decor tool says it beside a guild piece and
// stops a placement past it; the service holds the count. Fed by the guild book (its shop read), asked by the decor tool
// through the reader the book sets - module state, so no host grows a line for it (HOST-SPLIT).

/** @type {(() => unknown) | null} */
let _reader = null;
/** @type {Map<string, number> | null} */
let _owned = null;

/** The guild book's shop read, set once it is made. */
export function setGuildStockReader(/** @type {(() => unknown) | null} */ fn) { _reader = typeof fn === 'function' ? fn : null; }
/** The shop as a read said it (its `wares`), or null for none - the reader in no guild. */
export function noteGuildShop(/** @type {any} */ shop) {
  _owned = Array.isArray(shop?.wares) ? new Map(shop.wares.filter((w) => w.payer === 'guild').map((w) => [String(w.key), Number(w.owned) || 0])) : null;
}
/** How many of `ware` the guild owns - null while unread (and a read is asked). */
export function guildStockOwned(/** @type {unknown} */ ware) {
  if (!_owned) { try { _reader?.(); } catch { /* the next ask */ } return null; }
  return _owned.get(String(ware)) ?? 0;
}
/** For the tests: nothing read, no reader. */
export function _resetGuildStock() { _reader = null; _owned = null; }
