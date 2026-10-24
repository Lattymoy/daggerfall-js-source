// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD-PANE (2026-10-23) - WHAT MAY BE PUT IN THE GUILD'S VAULT, ONE LAW FOR BOTH FACES.
//
// The vault has two faces on the client: the Social page's Put in (ui/socialPanel.js guildVaultNodes) and the pack's pane
// (ui/enhanced/enhancedInventory.js, through scenes/guildVaultHost.js). Each filtered the pack its own way; the pane's
// stow ladder has guards the page never had (a pack-only piece, a bound one, a letter of credit online). This is the one
// function both ask, so the two surfaces never drift: a piece it refuses is offered nowhere and reaches the service from
// nowhere. The service's own law (net/realm/realmTradeLaw.js takeTradeGoods) is the last word - this is the words a
// player can act on, before a press.
//
// Client-only: it reads the pack's laws (systems/tradePack.js, item/itemBound.js, item/itemLock.js, peerWord.js), which the
// service does not carry, so it is not net/guild/guildVaultLaw.js (shared by both ends).
import { tradeRefusal } from '../../systems/tradePack.js';
import { isLocked, lockedText } from '../../systems/item/itemLock.js';
import { isPackOnly, packOnlyText, boundRefusesPut, boundText } from '../../systems/item/itemBound.js';
import { letterRefusesPut, letterPutText } from '../../systems/peerWord.js';

/**
 * Why `item` may not be put in the vault, in words - or null: it may. Ahead of the service, in the order of the pack's own
 * stow ladder: a pack-only piece, what a trade may not carry (worn, quest, summoned, gold, bound, a boat, the Materials
 * Bag), the pack's own refusal (`pack.refuses`: the loaded wagon), a lock, a bound piece the vault is no keeping for, a
 * letter of credit (a guild's members take from the vault; online it is handed over by a trade alone).
 * @param {any} item
 * @param {{ refuses?: (item: any) => (string|null) }|null} [pack]
 * @param {(item: any) => string} [nameOf]
 * @returns {string|null}
 */
export function vaultPutRefusal(item, pack = null, nameOf = (it) => it?.name ?? '') {
  if (!item || typeof item !== 'object') return tradeRefusal(item);
  const name = nameOf(item);
  if (isPackOnly(item)) return packOnlyText(name);
  const trade = tradeRefusal(item);
  if (trade) return trade;
  const packs = pack?.refuses?.(item);
  if (packs) return packs;
  if (isLocked(item)) return lockedText(name);
  if (boundRefusesPut(item, 'vault')) return boundText(name, item);
  if (letterRefusesPut(item, { container: true, own: false, online: true })) return letterPutText(name);
  return null;
}
