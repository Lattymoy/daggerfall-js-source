// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT16 (2026-10-07) — THE TEMPLE'S LIFTING.
//
// The Loot arc II (bible/06-Systems/Loot-II-Arc.md section 8; Mac:
// "what could we do to make it even more amazing, while also balancing
// everyrhing?", then "Lets go all in"). A CURSED FIND (lootRarity.js
// cursePiece - one Rare or Legendary in twelve that a body or a pile
// mints) carries a line more and one drawback of DFU's own catalogue,
// and is known for what it is only once identified (DFU's IsIdentified:
// worn unknowing, it bites unsaid). Known, a TEMPLE's Cure Disease
// priest lifts it for gold - the drawback gone, the line KEPT: the
// find's reward, paid for. The price is a quarter of the piece's own,
// at least LIFT_FLOOR.
//
// The temple's row (ui/guildServiceWindow.js LIFT_ROW; the Plus face's
// beside it) opens the Reforge's window on its one page
// (ui/reforgeWindow.js 'lift'); the window draws and asks, and what it
// does is here. OFF IS DFU EXACTLY: with the loot-rarity row off nothing
// is cursed and nothing is lifted.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn, isCursed } from './lootRarity.js';
import { itemBaseValue } from './itemTemplates.js';
import { isEquipped } from './equip.js';
import { totalGoldAmount, deductGold } from './court.js';
import { itemIsIdentified } from './tradeModes.js';

/** The least a lifting costs, in gold, and the share of the piece's own price it costs above that. */
export const LIFT_FLOOR = 300;
export const LIFT_SHARE = 0.25;
/** What lifting a piece's curse costs - a quarter of its price, at least LIFT_FLOOR - or null for a piece with none. */
export function liftPrice(item) {
  if (!isCursed(item)) return null;
  const value = Number.isFinite(item.value) ? item.value : itemBaseValue(item);
  return Math.max(LIFT_FLOOR, Math.round(value * LIFT_SHARE));
}
/** The pieces of a pack the temple sees a curse on: cursed, and known (a curse the guild has not named is no curse the
 *  priest can see - and listing it would say what Identify has not). */
export const cursedKnown = (items) => (Array.isArray(items) ? items : []).filter((it) => isCursed(it) && itemIsIdentified(it));
/** Why a piece's curse may not be lifted now, or null: 'off', 'not' (no curse), 'unknown' (not yet identified), 'worn'
 *  (its drawback is on the wearer - off first, as the Reforge asks), 'gold'. `player` is the payer. */
export function liftRefusal(item, player) {
  if (!lootRarityOn()) return 'off';
  if (!isCursed(item)) return 'not';
  if (!itemIsIdentified(item)) return 'unknown';
  if (isEquipped(item)) return 'worn';
  if (totalGoldAmount(player) < /** @type {number} */ (liftPrice(item))) return 'gold';
  return null;
}
/** THE LIFTING, MADE: paid, the drawback out of the piece's enchantments and its mark gone - the line it came with and
 *  its price kept (a drawback is worth nothing). Answers `{ ok: true, price }` or `{ ok: false, reason }` with nothing
 *  taken ('gone' for a piece not in the payer's pack). */
export function liftCurse(item, player) {
  if (!player || !Array.isArray(player.items) || !player.items.includes(item)) return { ok: false, reason: 'gone' };
  const why = liftRefusal(item, player);
  if (why) return { ok: false, reason: why };
  const price = /** @type {number} */ (liftPrice(item));
  const c = item.cursed;
  const list = Array.isArray(item.enchantments) ? item.enchantments : [];
  let at = -1;
  for (let i = list.length - 1; i >= 0 && at < 0; i--) if (list[i]?.type === c.type && list[i]?.param === c.param) at = i;   // the curse's own: the last of its kind
  item.enchantments = list.filter((_, i) => i !== at);
  delete item.cursed;
  deductGold(player, price);
  return { ok: true, price };
}
